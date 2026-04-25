import express from "express";
import multer from "multer";
import cors from "cors";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

const upload = multer({ dest: "uploads/" });

// Create necessary directories
['uploads', 'output', 'temp', 'scripts'].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Health check
app.get("/", (req, res) => {
  res.json({ 
    status: "ok", 
    service: "Photogrammetry Pipeline",
    version: "1.0.0",
    features: ["meshroom", "blender", "parametric"],
    timestamp: new Date().toISOString()
  });
});

// Photogrammetry endpoint (requires Meshroom + Blender)
app.post("/photogrammetry", upload.array("images", 50), async (req, res) => {
  if (!req.files || req.files.length < 10) {
    return res.status(400).json({ 
      error: "Need at least 10 images for photogrammetry",
      received: req.files?.length || 0
    });
  }

  const jobId = uuidv4();
  const jobFolder = path.join(process.cwd(), "temp", jobId);
  
  fs.mkdirSync(jobFolder, { recursive: true });

  // Move uploaded files
  req.files.forEach(file => {
    fs.renameSync(file.path, path.join(jobFolder, file.originalname));
  });

  console.log(`[${jobId}] Starting photogrammetry with ${req.files.length} images`);

  // Step 1: Run Meshroom
  const meshroomCmd = `bash scripts/run_meshroom.sh ${jobFolder} ${jobId}`;
  
  const meshroom = spawn('bash', ['scripts/run_meshroom.sh', jobFolder, jobId]);
  
  let meshroomOutput = '';
  meshroom.stdout.on('data', (data) => {
    meshroomOutput += data.toString();
    console.log(`[Meshroom] ${data}`);
  });

  meshroom.stderr.on('data', (data) => {
    console.error(`[Meshroom Error] ${data}`);
  });

  meshroom.on('close', (code) => {
    if (code !== 0) {
      console.error(`[${jobId}] Meshroom failed with code ${code}`);
      return res.status(500).json({ 
        error: "Meshroom processing failed",
        details: meshroomOutput
      });
    }

    console.log(`[${jobId}] Meshroom complete, starting Blender...`);

    // Step 2: Run Blender
    const blenderCmd = `blender --background --python scripts/blender_fix.py -- ${jobId}`;
    
    const blender = spawn('blender', [
      '--background',
      '--python', 'scripts/blender_fix.py',
      '--', jobId
    ]);

    let blenderOutput = '';
    blender.stdout.on('data', (data) => {
      blenderOutput += data.toString();
      console.log(`[Blender] ${data}`);
    });

    blender.on('close', (code2) => {
      if (code2 !== 0) {
        console.error(`[${jobId}] Blender failed with code ${code2}`);
        return res.status(500).json({ 
          error: "Blender processing failed",
          details: blenderOutput
        });
      }

      console.log(`[${jobId}] Pipeline complete!`);

      res.json({
        success: true,
        jobId,
        message: "3D model created successfully",
        modelUrl: `/output/${jobId}.glb`,
        imagesProcessed: req.files.length
      });
    });
  });
});

// Parametric generation (practical for glasses)
app.post("/parametric", upload.single("image"), async (req, res) => {
  const jobId = uuidv4();
  
  // Extract measurements (you can add AI detection here)
  const width = parseFloat(req.body.width) || 140;
  const bridge = parseFloat(req.body.bridge) || 20;
  const temple = parseFloat(req.body.temple) || 145;
  
  console.log(`[${jobId}] Generating parametric model: ${width}x${bridge}x${temple}`);

  const blender = spawn('blender', [
    '--background',
    '--python', 'scripts/glasses_parametric.py',
    '--', width.toString(), bridge.toString(), temple.toString(), jobId
  ]);

  let output = '';
  blender.stdout.on('data', (data) => {
    output += data.toString();
  });

  blender.on('close', (code) => {
    if (code !== 0) {
      return res.status(500).json({ 
        error: "Parametric generation failed",
        details: output
      });
    }

    res.json({
      success: true,
      jobId,
      message: "Parametric model created",
      modelUrl: `/output/${jobId}.glb`,
      measurements: { width, bridge, temple }
    });
  });
});

// List jobs
app.get("/jobs", (req, res) => {
  const outputDir = path.join(process.cwd(), "output");
  if (!fs.existsSync(outputDir)) {
    return res.json([]);
  }

  const files = fs.readdirSync(outputDir)
    .filter(f => f.endsWith('.glb'))
    .map(f => ({
      id: f.replace('.glb', ''),
      url: `/output/${f}`,
      created: fs.statSync(path.join(outputDir, f)).mtime
    }));

  res.json(files);
});

// Serve output files
app.use('/output', express.static('output'));

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`\n🚀 Photogrammetry Pipeline running on port ${PORT}`);
  console.log(`📸 Photogrammetry: POST /photogrammetry (10-50 images)`);
  console.log(`📐 Parametric: POST /parametric (measurements)`);
  console.log(`📋 Jobs: GET /jobs\n`);
});
