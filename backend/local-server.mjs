import express from "express";
import multer from "multer";
import cors from "cors";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

const upload = multer({ dest: "uploads/" });

if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");
if (!fs.existsSync("local_models")) fs.mkdirSync("local_models");
if (!fs.existsSync("reference_images")) fs.mkdirSync("reference_images");

// Serve static files
app.use('/models', express.static('local_models'));
app.use('/references', express.static('reference_images'));

app.get("/", (req, res) => {
  res.json({ 
    status: "ok", 
    service: "AI Glasses Backend (Local Mode)",
    version: "1.0.0",
    mode: "local_files",
    endpoints: ["/models", "/match-model", "/upload-model", "/debug"],
    timestamp: new Date().toISOString()
  });
});

app.get("/health", (req, res) => {
  res.json({ 
    status: "healthy", 
    mode: "local_files",
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.get("/debug", (req, res) => {
  const models = fs.existsSync("local_models") ? fs.readdirSync("local_models").filter(f => f.endsWith('.glb')) : [];
  const refImages = fs.existsSync("reference_images") ? fs.readdirSync("reference_images") : [];
  const embeddingsExist = fs.existsSync("reference_embeddings.pt");
  
  res.json({
    mode: "local_files",
    models: models.length,
    referenceImages: refImages.length,
    embeddingsExist,
    modelsDir: path.resolve("local_models"),
    referencesDir: path.resolve("reference_images")
  });
});

app.get("/models", (req, res) => {
  try {
    if (!fs.existsSync("local_models")) {
      return res.json([]);
    }
    
    const files = fs.readdirSync("local_models")
      .filter(f => f.toLowerCase().endsWith(".glb"))
      .map(f => ({
        name: f,
        url: `http://localhost:5000/models/${f}`
      }));
    
    res.json(files);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to list models" });
  }
});

app.post("/upload-model", upload.fields([{ name: "file" }, { name: "thumb" }]), (req, res) => {
  try {
    const file = req.files['file'] ? req.files['file'][0] : null;
    const thumb = req.files['thumb'] ? req.files['thumb'][0] : null;
    
    if (!file) {
      return res.status(400).json({ error: "No GLB file uploaded" });
    }

    const glbPath = path.join("local_models", file.originalname);
    fs.copyFileSync(file.path, glbPath);
    fs.unlinkSync(file.path);

    if (thumb) {
      const thumbPath = path.join("reference_images", thumb.originalname);
      fs.copyFileSync(thumb.path, thumbPath);
      fs.unlinkSync(thumb.path);
    }

    res.json({ ok: true, name: file.originalname, url: `http://localhost:5000/models/${file.originalname}` });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Upload failed" });
  }
});

app.post("/rebuild-embeddings", (req, res) => {
  try {
    const py = spawn("python", ["match.py", "--build"], { cwd: process.cwd() });
    let out = "", errOut = "";
    py.stdout.on("data", d => out += d.toString());
    py.stderr.on("data", d => errOut += d.toString());
    py.on("close", code => {
      if (code !== 0) {
        return res.status(500).json({ error: "Rebuild failed", details: errOut || out });
      }
      res.json({ ok: true, output: out });
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to start rebuild" });
  }
});

app.post("/match-model", upload.array("images", 5), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No images uploaded" });
    }
    
    const filePaths = req.files.map(f => f.path);
    const py = spawn("python", ["match.py", ...filePaths], { cwd: process.cwd() });
    
    let out = "", errOut = "";
    py.stdout.on("data", d => out += d.toString());
    py.stderr.on("data", d => errOut += d.toString());
    
    py.on("close", code => {
      filePaths.forEach(p => fs.unlink(p, () => {}));
      
      if (code !== 0) {
        return res.status(500).json({ error: "AI matching failed", details: errOut || out });
      }
      
      try {
        const jsonOut = JSON.parse(out);
        res.json(jsonOut);
      } catch (e) {
        res.status(500).json({ error: "Bad AI output", raw: out.toString() });
      }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Internal error" });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`\n🚀 AI Glasses Backend (Local Mode) running on port ${PORT}`);
  console.log(`📁 Models directory: ${path.resolve("local_models")}`);
  console.log(`🖼️  References directory: ${path.resolve("reference_images")}`);
  console.log(`\n💡 To add test models, place GLB files in: backend/local_models/`);
  console.log(`💡 To add reference images, place images in: backend/reference_images/\n`);
});
