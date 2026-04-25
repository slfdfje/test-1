import express from "express";
import multer from "multer";
import cors from "cors";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

const upload = multer({ dest: "uploads/" });

// In-memory database
let glassesDatabase = [];

// Create directories
['uploads', 'output', 'temp', 'thumbnails'].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Load existing database
const DB_FILE = 'glasses-database.json';
if (fs.existsSync(DB_FILE)) {
  glassesDatabase = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function saveDatabase() {
  fs.writeFileSync(DB_FILE, JSON.stringify(glassesDatabase, null, 2));
}

// Health check
app.get("/", (req, res) => {
  res.json({ 
    status: "ok", 
    service: "Admin Workflow System (No Blender Mode)",
    version: "1.0.0",
    totalModels: glassesDatabase.length,
    pending: glassesDatabase.filter(g => g.status === 'pending').length,
    approved: glassesDatabase.filter(g => g.status === 'approved').length,
    timestamp: new Date().toISOString()
  });
});

// Upload glasses image
app.post("/admin/upload-glasses", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image uploaded" });
    }

    const id = uuidv4();
    const { brand, model, price, category } = req.body;

    // Save thumbnail
    const thumbnailPath = path.join('thumbnails', `${id}.jpg`);
    fs.copyFileSync(req.file.path, thumbnailPath);

    const glassesItem = {
      id,
      brand: brand || 'Unknown',
      model: model || 'Unnamed',
      price: parseFloat(price) || 0,
      category: category || 'general',
      status: 'pending',
      uploadedAt: new Date().toISOString(),
      thumbnailUrl: `/thumbnails/${id}.jpg`,
      modelUrl: null,
      measurements: null,
      approvedAt: null,
      approvedBy: null
    };

    glassesDatabase.push(glassesItem);
    saveDatabase();

    // Clean up upload
    fs.unlinkSync(req.file.path);

    console.log(`[Upload] New glasses: ${brand} ${model} (${id})`);

    res.json({
      success: true,
      id,
      message: "Glasses uploaded successfully",
      item: glassesItem
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate 3D model (WITHOUT BLENDER - uses test model)
app.post("/admin/generate-model/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const item = glassesDatabase.find(g => g.id === id);

    if (!item) {
      return res.status(404).json({ error: "Glasses not found" });
    }

    const { width, bridge, temple } = req.body;

    console.log(`[Generate] Creating model for ${item.brand} ${item.model}`);
    console.log(`⚠️  Blender not available - using test model`);

    // Copy test model to output
    const testModelPath = 'local_models/glasses.glb';
    const outputPath = path.join('output', `${id}.glb`);

    if (!fs.existsSync(testModelPath)) {
      return res.status(500).json({ 
        error: "Test model not found. Please install Blender for real 3D generation.",
        details: "Missing: local_models/glasses.glb"
      });
    }

    // Copy test model
    fs.copyFileSync(testModelPath, outputPath);

    // Update database
    item.modelUrl = `/output/${id}.glb`;
    item.measurements = { width, bridge, temple };
    item.status = 'generated';
    item.generatedWith = 'test-model';
    saveDatabase();

    console.log(`[Generate] Model created: ${item.modelUrl} (using test model)`);

    res.json({
      success: true,
      message: "Model generated successfully (using test model)",
      modelUrl: item.modelUrl,
      item,
      note: "Install Blender for custom 3D generation"
    });

  } catch (error) {
    console.error('Generation error:', error);
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

  res.json(item);
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
app.use('/local_models', express.static('local_models'));

// Statistics
app.get("/admin/stats", (req, res) => {
  const stats = {
    total: glassesDatabase.length,
    pending: glassesDatabase.filter(g => g.status === 'pending').length,
    generated: glassesDatabase.filter(g => g.status === 'generated').length,
    approved: glassesDatabase.filter(g => g.status === 'approved').length,
    rejected: glassesDatabase.filter(g => g.status === 'rejected').length,
    categories: {}
  };

  glassesDatabase.forEach(g => {
    stats.categories[g.category] = (stats.categories[g.category] || 0) + 1;
  });

  res.json(stats);
});

const PORT = process.env.PORT || 5002;

app.listen(PORT, () => {
  console.log(`\n🎯 Admin Workflow System (No Blender Mode) running on port ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}/admin/stats`);
  console.log(`📦 Total models: ${glassesDatabase.length}`);
  console.log(`✅ Approved: ${glassesDatabase.filter(g => g.status === 'approved').length}`);
  console.log(`⏳ Pending: ${glassesDatabase.filter(g => g.status === 'pending').length}`);
  console.log(`\n⚠️  NOTE: Blender not detected - using test model for all generations`);
  console.log(`   Install Blender and add to PATH for custom 3D generation\n`);
});
