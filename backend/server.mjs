import 'dotenv/config';
import express from "express";
import multer from "multer";
import cors from "cors";
import { spawn, execSync } from "child_process";
import fs from "fs";
import AWS from "aws-sdk";
import path from "path";
import { authMiddleware } from "./auth.mjs";
import { sendWebhook } from "./webhook.mjs";

const app = express();

// CORS configuration - allow all origins
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  credentials: false
}));

// Handle preflight requests
app.options('*', cors());

app.use(express.json());

const upload = multer({ dest: "uploads/" });

// Enable/disable authentication
const REQUIRE_AUTH = process.env.REQUIRE_AUTH === "true" || false;

// WASABI / S3 config - supports multiple env var names
const s3Endpoint = process.env.AWS_ENDPOINT || process.env.WASABI_ENDPOINT_URI || "s3.ap-southeast-1.wasabisys.com";
const s3Region = process.env.AWS_REGION || "ap-southeast-1";
const s3 = new AWS.S3({
  endpoint: s3Endpoint.replace('https://', '').replace('http://', ''),
  region: s3Region,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  signatureVersion: "v4",
  s3ForcePathStyle: true
});

const BUCKET = process.env.S3_BUCKET || process.env.S3_BUCKET_NAME || "jigu";
console.log(`S3 Config: endpoint=${s3Endpoint}, bucket=${BUCKET}`);
console.log(`AWS Credentials: key=${process.env.AWS_ACCESS_KEY_ID ? 'SET' : 'MISSING'}, secret=${process.env.AWS_SECRET_ACCESS_KEY ? 'SET' : 'MISSING'}`);
const REF_DIR = "reference_images";

if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");
if (!fs.existsSync(REF_DIR)) fs.mkdirSync(REF_DIR);

// Download reference images from S3 on startup
async function downloadReferenceImages() {
  console.log("Checking reference images...");
  try {
    const data = await s3.listObjectsV2({ Bucket: BUCKET, Prefix: "reference_images/" }).promise();
    const images = (data.Contents || []).filter(f => !f.Key.endsWith("/"));
    
    if (images.length === 0) {
      console.log("No reference images found in S3");
      return;
    }
    
    // Check how many we already have
    const existingFiles = fs.existsSync(REF_DIR) ? fs.readdirSync(REF_DIR) : [];
    console.log(`Found ${images.length} reference images in S3, ${existingFiles.length} locally`);
    
    // Download missing images
    let downloaded = 0;
    for (const obj of images) {
      const filename = path.basename(obj.Key);
      const localPath = path.join(REF_DIR, filename);
      
      if (!fs.existsSync(localPath)) {
        console.log(`Downloading ${filename}...`);
        const fileData = await s3.getObject({ Bucket: BUCKET, Key: obj.Key }).promise();
        fs.writeFileSync(localPath, fileData.Body);
        downloaded++;
      }
    }
    
    console.log(`Downloaded ${downloaded} new reference images`);
  } catch (e) {
    console.error("Error downloading reference images:", e.message);
  }
}

// Optional auth middleware
const optionalAuth = REQUIRE_AUTH ? authMiddleware("read") : (req, res, next) => next();
const writeAuth = REQUIRE_AUTH ? authMiddleware("write") : (req, res, next) => next();

// Health check endpoint
app.get("/", (req, res) => {
  res.json({ 
    status: "ok", 
    service: "AI Glasses Backend",
    version: "1.0.0",
    endpoints: ["/models", "/match-model", "/upload-model", "/rebuild-embeddings"],
    timestamp: new Date().toISOString()
  });
});

app.get("/health", (req, res) => {
  res.json({ 
    status: "healthy", 
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});

// Debug endpoint to check system status
app.get("/debug", async (req, res) => {
  const refImages = fs.existsSync(REF_DIR) ? fs.readdirSync(REF_DIR) : [];
  const embeddingsExist = fs.existsSync("reference_embeddings.pt");
  
  // Check Python
  let pythonVersion = "not found";
  let torchInstalled = "unknown";
  try {
    const { execSync } = await import("child_process");
    pythonVersion = execSync("python3 --version 2>&1 || python --version 2>&1").toString().trim();
    torchInstalled = execSync("python3 -c 'import torch; print(torch.__version__)' 2>&1 || echo 'not installed'").toString().trim();
  } catch (e) {
    pythonVersion = "error: " + e.message;
  }
  
  res.json({
    referenceImages: refImages.length,
    embeddingsExist,
    pythonVersion,
    torchInstalled,
    cwd: process.cwd(),
    uploadsExist: fs.existsSync("uploads"),
    refDirExist: fs.existsSync(REF_DIR)
  });
});

app.get("/models", optionalAuth, async (req, res) => {
  try {
    const data = await s3.listObjectsV2({ Bucket: BUCKET }).promise();
    const files = (data.Contents || [])
        .filter(f => f.Key.toLowerCase().endsWith(".glb"))
        .map(f => ({
            name: f.Key,
            url: s3.getSignedUrl("getObject", { Bucket: BUCKET, Key: f.Key, Expires: 3600 })
        }));
    res.json(files);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to list models" });
  }
});

app.post("/upload-model", writeAuth, upload.fields([{ name: "file" }, { name: "thumb" }]), async (req, res) => {
  try {
    const file = req.files['file'] ? req.files['file'][0] : null;
    const thumb = req.files['thumb'] ? req.files['thumb'][0] : null;
    if (!file) return res.status(400).json({ error: "No GLB file uploaded (field 'file')" });

    const glbKey = file.originalname;
    await s3.upload({ Bucket: BUCKET, Key: glbKey, Body: fs.createReadStream(file.path), ContentType: "model/gltf-binary" }).promise();

    if (thumb) {
      const thumbKey = path.posix.join("reference_images", thumb.originalname);
      await s3.upload({ Bucket: BUCKET, Key: thumbKey, Body: fs.createReadStream(thumb.path), ContentType: thumb.mimetype || "image/png" }).promise();
    }

    fs.unlinkSync(file.path);
    if (thumb) fs.unlinkSync(thumb.path);

    res.json({ ok: true, name: glbKey });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Upload failed" });
  }
});

app.post("/rebuild-embeddings", writeAuth, async (req, res) => {
  try {
    const py = spawn("python3", ["match.py", "--build"], { cwd: process.cwd() });
    let out = "", errOut = "";
    py.stdout.on("data", d => out += d.toString());
    py.stderr.on("data", d => errOut += d.toString());
    py.on("close", code => {
      if (code !== 0) return res.status(500).json({ error: "Rebuild failed", details: errOut || out });
      res.json({ ok: true, output: out });
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to start rebuild" });
  }
});

app.post("/match-model", optionalAuth, upload.array("images", 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: "No images uploaded" });
    const filePaths = req.files.map(f => f.path);
    console.log("Running match.py with files:", filePaths);
    const py = spawn("python3", ["match.py", ...filePaths], { cwd: process.cwd() });
    let out = "", errOut = "";
    py.stdout.on("data", d => { out += d.toString(); console.log("Python stdout:", d.toString()); });
    py.stderr.on("data", d => { errOut += d.toString(); console.log("Python stderr:", d.toString()); });
    py.on("close", async code => {
      console.log("Python exit code:", code, "stdout:", out, "stderr:", errOut);
      filePaths.forEach(p => fs.unlink(p, () => {}));
      
      // Try to parse, even if status code is non-zero (exception handler might have printed json)
      try {
        const jsonOut = JSON.parse(out);
        if (jsonOut.error) {
             console.error("Match.py returned error:", jsonOut.error);
             return res.status(500).json(jsonOut);
        }
        
        // Send webhook notification
        const webhookData = {
          best_model: jsonOut.best_model,
          confidence: jsonOut.confidence,
          source_image: jsonOut.source_image,
          model_url: s3.getSignedUrl("getObject", { 
            Bucket: BUCKET, 
            Key: jsonOut.best_model, 
            Expires: 3600 
          }),
          timestamp: new Date().toISOString(),
          images_count: req.files.length
        };
        
        sendWebhook("match", webhookData).catch(err => {
          console.error("Webhook error:", err);
        });
        
        res.json(jsonOut);
      } catch (parseError) {
        console.error("Failed to parse output:", out);
        if (code !== 0) return res.status(500).json({ error: "AI matching failed", details: errOut || out, code, raw: out });
        res.status(500).json({ error: "Bad AI output", raw: out.toString() });
      }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Internal error" });
  }
});

const PORT = process.env.PORT || 5000;

// Start server immediately, download images in background
app.listen(PORT, () => {
  console.log(`3D AI Dashboard backend running on ${PORT}`);
  // Download reference images in background (don't block startup)
  downloadReferenceImages().catch(err => {
    console.error("Background download error:", err);
  });
});
