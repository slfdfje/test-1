import express from "express";
import multer from "multer";
import cors from "cors";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { spawnBlenderJob, getErrorMessage, getQueueStatus } from "./blender-runner.mjs";
import {
  updateGenerationStatus,
  getJobsByStatus,
  setGenerationTimestamps,
  normaliseDatabase,
} from "./db-helpers.mjs";

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

const upload = multer({ dest: "uploads/" });

// In-memory database (use MongoDB/PostgreSQL in production)
let glassesDatabase = [];

// Create directories
['uploads', 'output', 'temp', 'thumbnails'].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Load existing database and normalise legacy records
const DB_FILE = 'glasses-database.json';
if (fs.existsSync(DB_FILE)) {
  glassesDatabase = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  normaliseDatabase(glassesDatabase);
  console.log(`[DB] Loaded ${glassesDatabase.length} records (legacy fields normalised)`);
}

function saveDatabase() {
  fs.writeFileSync(DB_FILE, JSON.stringify(glassesDatabase, null, 2));
}

// Health check
app.get("/", (req, res) => {
  res.json({ 
    status: "ok", 
    service: "Admin Workflow System",
    version: "1.0.0",
    totalModels: glassesDatabase.length,
    pending: glassesDatabase.filter(g => g.status === 'pending').length,
    approved: glassesDatabase.filter(g => g.status === 'approved').length,
    timestamp: new Date().toISOString()
  });
});

// Upload glasses images (3 images: front + 2 temples)
app.post("/admin/upload-glasses", upload.array("images", 3), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No images uploaded" });
    }

    // Requirement 5.4: at least one image file is required
    // (3 images recommended: front + both temple sides, but not enforced)

    const id = uuidv4();
    const { brand, model, price, category, frameWidth, bridgeWidth, templeLength } = req.body;

    // Validate dimensions
    const width = parseFloat(frameWidth);
    const bridge = parseFloat(bridgeWidth);
    const temple = parseFloat(templeLength);

    const validationErrors = [];
    
    if (!frameWidth || isNaN(width) || width < 100 || width > 180) {
      validationErrors.push('Frame width must be between 100mm and 180mm');
    }
    if (!bridgeWidth || isNaN(bridge) || bridge < 10 || bridge > 30) {
      validationErrors.push('Bridge width must be between 10mm and 30mm');
    }
    if (!templeLength || isNaN(temple) || temple < 120 || temple > 160) {
      validationErrors.push('Temple length must be between 120mm and 160mm');
    }

    if (validationErrors.length > 0) {
      // Clean up uploaded files
      req.files.forEach(file => fs.unlinkSync(file.path));
      return res.status(400).json({ 
        error: "Validation failed",
        validationErrors 
      });
    }

    // Save all images
    const sourceImages = [];
    req.files.forEach((file, index) => {
      const imagePath = path.join('thumbnails', `${id}_${index}.jpg`);
      fs.copyFileSync(file.path, imagePath);
      sourceImages.push(imagePath);
      fs.unlinkSync(file.path); // Clean up temp file
    });

    // Use first image as thumbnail
    const thumbnailPath = sourceImages[0];

    const glassesItem = {
      id,
      brand: brand || 'Unknown',
      model: model || 'Unnamed',
      price: parseFloat(price) || 0,
      category: category || 'general',
      status: 'processing',
      uploadedAt: new Date().toISOString(),
      thumbnailUrl: `/thumbnails/${id}_0.jpg`,
      sourceImages: sourceImages,
      dimensions: {
        frameWidth: width,
        bridgeWidth: bridge,
        templeLength: temple
      },
      modelUrl: null,
      measurements: null,
      generationStatus: 'processing',
      generationError: null,
      generationStartedAt: new Date().toISOString(),
      generationCompletedAt: null,
      approvedAt: null,
      approvedBy: null
    };

    glassesDatabase.push(glassesItem);
    saveDatabase();

    console.log(`[Upload] New glasses: ${brand} ${model} (${id}) - Starting automatic generation`);

    // Return response immediately
    res.json({
      success: true,
      id,
      message: "Glasses uploaded successfully - generation started",
      item: glassesItem
    });

    // Start Blender generation asynchronously (don't await)
    // Pass thumbnails dir so Blender can sample frame colour from uploaded photos
    const imageDir = path.join('thumbnails');
    spawnBlenderJob(id, glassesItem.dimensions, imageDir)
      .then(async (modelUrl) => {
        // Success: update database via helpers
        const item = glassesDatabase.find(g => g.id === id);
        if (item) {
          item.modelUrl = modelUrl;
          item.measurements = glassesItem.dimensions;
          await updateGenerationStatus(glassesDatabase, id, 'generated', null, saveDatabase);
          await setGenerationTimestamps(glassesDatabase, id, null, new Date().toISOString(), saveDatabase);
          console.log(`[Upload] Generation completed for ${id}: ${modelUrl}`);
        }
      })
      .catch(async (error) => {
        // Failure: update database with error via helpers
        await updateGenerationStatus(glassesDatabase, id, 'failed', getErrorMessage(error), saveDatabase);
        await setGenerationTimestamps(glassesDatabase, id, null, new Date().toISOString(), saveDatabase);
        console.error(`[Upload] Generation failed for ${id}:`, error.message);
      });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate 3D model
app.post("/admin/generate-model/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const item = glassesDatabase.find(g => g.id === id);

    if (!item) {
      return res.status(404).json({ error: "Glasses not found" });
    }

    const { width, bridge, temple } = req.body;

    console.log(`[Generate] Creating model for ${item.brand} ${item.model}`);

    // Generate parametric model
    const blenderPath = 'C:\\Program Files\\Blender Foundation\\Blender 5.1\\blender.exe';
    const blender = spawn(blenderPath, [
      '--background',
      '--python', 'scripts/glasses_parametric.py',
      '--',
      (width || 140).toString(),
      (bridge || 20).toString(),
      (temple || 145).toString(),
      id
    ]);

    let output = '';
    blender.stdout.on('data', (data) => {
      output += data.toString();
      console.log(`[Blender] ${data}`);
    });

    blender.stderr.on('data', (data) => {
      console.error(`[Blender Error] ${data}`);
    });

    blender.on('close', (code) => {
      if (code !== 0) {
        return res.status(500).json({ 
          error: "Model generation failed",
          details: output
        });
      }

      // Update database
      item.modelUrl = `/output/${id}.glb`;
      item.measurements = { width, bridge, temple };
      item.status = 'generated';
      saveDatabase();

      console.log(`[Generate] Model created: ${item.modelUrl}`);

      res.json({
        success: true,
        message: "Model generated successfully",
        modelUrl: item.modelUrl,
        item
      });
    });

  } catch (error) {
    console.error('Generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Retry failed generation
app.post("/admin/retry-model/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const item = glassesDatabase.find(g => g.id === id);

    if (!item) {
      return res.status(404).json({ error: "Glasses not found" });
    }

    if (item.generationStatus !== 'failed') {
      return res.status(400).json({ error: "Can only retry failed generations" });
    }

    if (!item.dimensions) {
      return res.status(400).json({ error: "No dimensions found for retry" });
    }

    console.log(`[Retry] Retrying generation for ${item.brand} ${item.model} (${id})`);

    // Reset generation fields
    item.status = 'processing';
    item.generationStatus = 'processing';
    item.generationError = null;
    item.generationStartedAt = new Date().toISOString();
    item.generationCompletedAt = null;
    item.retryCount = (item.retryCount || 0) + 1;
    saveDatabase();

    // Return response immediately
    res.json({
      success: true,
      message: "Generation retry started",
      item
    });

    // Start Blender generation asynchronously
    spawnBlenderJob(id, item.dimensions)
      .then(async (modelUrl) => {
        const item = glassesDatabase.find(g => g.id === id);
        if (item) {
          item.modelUrl = modelUrl;
          item.measurements = item.dimensions;
          await updateGenerationStatus(glassesDatabase, id, 'generated', null, saveDatabase);
          await setGenerationTimestamps(glassesDatabase, id, null, new Date().toISOString(), saveDatabase);
          console.log(`[Retry] Generation completed for ${id}: ${modelUrl}`);
        }
      })
      .catch(async (error) => {
        await updateGenerationStatus(glassesDatabase, id, 'failed', getErrorMessage(error), saveDatabase);
        await setGenerationTimestamps(glassesDatabase, id, null, new Date().toISOString(), saveDatabase);
        console.error(`[Retry] Generation failed for ${id}:`, error.message);
      });

  } catch (error) {
    console.error('Retry error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Approve glasses
app.post("/admin/approve/:id", (req, res) => {
  try {
    const { id } = req.params;
    const { approvedBy } = req.body;

    const item = glassesDatabase.find(g => g.id === id);

    if (!item) {
      return res.status(404).json({ error: "Glasses not found" });
    }

    if (!item.modelUrl) {
      return res.status(400).json({ error: "Model not generated yet" });
    }

    item.status = 'approved';
    item.approvedAt = new Date().toISOString();
    item.approvedBy = approvedBy || 'admin';
    saveDatabase();

    console.log(`[Approve] ${item.brand} ${item.model} approved by ${item.approvedBy}`);

    res.json({
      success: true,
      message: "Glasses approved",
      item
    });

  } catch (error) {
    console.error('Approval error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Reject glasses
app.post("/admin/reject/:id", (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const item = glassesDatabase.find(g => g.id === id);

    if (!item) {
      return res.status(404).json({ error: "Glasses not found" });
    }

    item.status = 'rejected';
    item.rejectedAt = new Date().toISOString();
    item.rejectionReason = reason || 'No reason provided';
    saveDatabase();

    console.log(`[Reject] ${item.brand} ${item.model} rejected: ${reason}`);

    res.json({
      success: true,
      message: "Glasses rejected",
      item
    });

  } catch (error) {
    console.error('Rejection error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete glasses
app.delete("/admin/delete/:id", (req, res) => {
  try {
    const { id } = req.params;
    const index = glassesDatabase.findIndex(g => g.id === id);

    if (index === -1) {
      return res.status(404).json({ error: "Glasses not found" });
    }

    const item = glassesDatabase[index];

    // Delete files
    if (item.thumbnailUrl) {
      const thumbPath = path.join('.', item.thumbnailUrl);
      if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
    }
    if (item.modelUrl) {
      const modelPath = path.join('.', item.modelUrl);
      if (fs.existsSync(modelPath)) fs.unlinkSync(modelPath);
    }

    glassesDatabase.splice(index, 1);
    saveDatabase();

    console.log(`[Delete] ${item.brand} ${item.model} deleted`);

    res.json({
      success: true,
      message: "Glasses deleted"
    });

  } catch (error) {
    console.error('Deletion error:', error);
    res.status(500).json({ error: error.message });
  }
});

// List all glasses (admin view)
app.get("/admin/glasses", (req, res) => {
  const { status, category } = req.query;

  let filtered = glassesDatabase;

  if (status) {
    filtered = filtered.filter(g => g.status === status);
  }

  if (category) {
    filtered = filtered.filter(g => g.category === category);
  }

  // Sort by most recent first (uploadedAt descending)
  filtered = [...filtered].sort((a, b) => {
    const aTime = a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0;
    const bTime = b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0;
    return bTime - aTime;
  });

  res.json({
    total: filtered.length,
    glasses: filtered
  });
});

// Get single glasses item
app.get("/admin/glasses/:id", (req, res) => {
  const { id } = req.params;
  const item = glassesDatabase.find(g => g.id === id);

  if (!item) {
    return res.status(404).json({ error: "Glasses not found" });
  }

  // Compute generation duration when both timestamps are available
  let generationDurationSeconds = null;
  if (item.generationStartedAt && item.generationCompletedAt) {
    const started = new Date(item.generationStartedAt).getTime();
    const completed = new Date(item.generationCompletedAt).getTime();
    if (!isNaN(started) && !isNaN(completed) && completed >= started) {
      generationDurationSeconds = Math.round((completed - started) / 1000);
    }
  }

  res.json({ ...item, generationDurationSeconds });
});

// Save alignment
app.post("/admin/save-alignment/:id", (req, res) => {
  try {
    const { id } = req.params;
    const { alignment } = req.body;

    const item = glassesDatabase.find(g => g.id === id);

    if (!item) {
      return res.status(404).json({ error: "Glasses not found" });
    }

    item.alignment = alignment;
    item.alignmentUpdated = new Date().toISOString();
    saveDatabase();

    console.log(`[Alignment] Saved for ${item.brand} ${item.model}`);

    res.json({
      success: true,
      message: "Alignment saved successfully",
      alignment
    });

  } catch (error) {
    console.error('Alignment save error:', error);
    res.status(500).json({ error: error.message });
  }
});

// List approved glasses (public API)
app.get("/models", (req, res) => {
  const approved = glassesDatabase
    .filter(g => g.status === 'approved' && g.modelUrl)
    .map(g => ({
      id: g.id,
      name: `${g.brand} ${g.model}`,
      brand: g.brand,
      model: g.model,
      price: g.price,
      category: g.category,
      url: `http://localhost:5002${g.modelUrl}`,
      thumbnailUrl: `http://localhost:5002${g.thumbnailUrl}`
    }));

  res.json(approved);
});

// Serve static files
app.use('/output', express.static('output'));
app.use('/thumbnails', express.static('thumbnails'));

// Serve model preview page
app.get('/model-preview.html', (req, res) => {
  res.sendFile('model-preview.html', { root: '.' });
});

// Statistics
app.get("/admin/stats", (req, res) => {
  const stats = {
    total: glassesDatabase.length,
    pending: glassesDatabase.filter(g => g.status === 'pending').length,
    processing: glassesDatabase.filter(g => g.status === 'processing').length,
    generated: glassesDatabase.filter(g => g.status === 'generated').length,
    approved: glassesDatabase.filter(g => g.status === 'approved').length,
    rejected: glassesDatabase.filter(g => g.status === 'rejected').length,
    failed: glassesDatabase.filter(g => g.status === 'failed').length,
    categories: {},
    queue: getQueueStatus()
  };

  glassesDatabase.forEach(g => {
    stats.categories[g.category] = (stats.categories[g.category] || 0) + 1;
  });

  res.json(stats);
});

// Queue status endpoint
app.get("/admin/queue-status", (req, res) => {
  res.json(getQueueStatus());
});

const PORT = process.env.PORT || 5002;

app.listen(PORT, () => {
  console.log(`\n🎯 Admin Workflow System running on port ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}/admin/stats`);
  console.log(`📦 Total models: ${glassesDatabase.length}`);
  console.log(`✅ Approved: ${glassesDatabase.filter(g => g.status === 'approved').length}`);
  console.log(`⏳ Pending: ${glassesDatabase.filter(g => g.status === 'pending').length}\n`);
});
