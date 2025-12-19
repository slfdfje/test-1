import 'dotenv/config';
import express from "express";
import multer from "multer";
import cors from "cors";
import { spawn } from "child_process";
import fs from "fs";
import AWS from "aws-sdk";
import path from "path";
import { authMiddleware } from "./auth.mjs";
import { sendWebhook } from "./webhook.mjs";

const app = express();

// CORS configuration - allow Vercel frontend
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.FRONTEND_URL,
  /\.vercel\.app$/
].filter(Boolean);

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.some(allowed => 
      allowed instanceof RegExp ? allowed.test(origin) : allowed === origin
    )) {
      return callback(null, true);
    }
    return callback(null, true); // Allow all for now
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  credentials: true
}));

// Handle preflight
app.options('*', cors());

app.use(express.json());

const upload = multer({ dest: "uploads/" });

// Enable/disable authentication
const REQUIRE_AUTH = process.env.REQUIRE_AUTH === "true" || false;

// Reference images directory
const REF_DIR = "reference_images";

// WASABI / S3 config from environment
const s3Endpoint = process.env.AWS_ENDPOINT || "s3.eu-west-1.wasabisys.com";
const s3Region = process.env.AWS_REGION || "eu-west-1";
const s3 = new AWS.S3({
  endpoint: `https://${s3Endpoint}`,
  region: s3Region,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  signatureVersion: "v4",
  s3ForcePathStyle: true
});

const BUCKET = process.env.S3_BUCKET || "jigu";
console.log(`S3 Config: endpoint=${s3Endpoint}, region=${s3Region}, bucket=${BUCKET}`);
console.log(`AWS Credentials: key=${process.env.AWS_ACCESS_KEY_ID ? 'SET' : 'MISSING'}`);

if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");
if (!fs.existsSync(REF_DIR)) fs.mkdirSync(REF_DIR);

// Optional auth middleware
const optionalAuth = REQUIRE_AUTH ? authMiddleware("read") : (req, res, next) => next();
const writeAuth = REQUIRE_AUTH ? authMiddleware("write") : (req, res, next) => next();

// Health check
app.get("/", (req, res) => {
  res.json({ status: "ok", service: "AI Glasses Backend" });
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
    console.log(`Found ${files.length} GLB models in S3`);
    res.json(files);
  } catch (e) {
    console.error("S3 error:", e.message);
    // Fallback: create models list based on local reference images
    try {
      if (fs.existsSync(REF_DIR)) {
        const refImages = fs.readdirSync(REF_DIR).filter(f => 
          f.toLowerCase().endsWith('.jpg') || f.toLowerCase().endsWith('.png')
        );
        const models = refImages.map(img => {
          const base = path.parse(img).name;
          const glbName = base + '.glb';
          return {
            name: glbName,
            url: s3.getSignedUrl("getObject", { Bucket: BUCKET, Key: glbName, Expires: 3600 })
          };
        });
        console.log(`Returning ${models.length} models based on reference images`);
        res.json(models);
      } else {
        res.json([]);
      }
    } catch (fallbackError) {
      console.error("Fallback error:", fallbackError);
      res.status(500).json({ error: "Failed to list models" });
    }
  }
});

app.post("/upload-model", writeAuth, upload.fields([{ name: "file" }, { name: "thumb" }]), async (req, res) => {
  try {
    const file = req.files['file'] ? req.files['file'][0] : null;
    const thumb = req.files['thumb'] ? req.files['thumb'][0] : null;
    if (!file) return res.status(400).json({ error: "No GLB file uploaded" });

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
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const py = spawn(pythonCmd, ["match.py", "--build"], { cwd: process.cwd() });
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
    
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const py = spawn(pythonCmd, ["match.py", ...filePaths], { cwd: process.cwd() });
    let out = "", errOut = "";
    py.stdout.on("data", d => { out += d.toString(); });
    py.stderr.on("data", d => { errOut += d.toString(); console.log("Python:", d.toString()); });
    py.on("close", async code => {
      filePaths.forEach(p => fs.unlink(p, () => {}));
      if (code !== 0) return res.status(500).json({ error: "AI matching failed", details: errOut || out });
      try {
        const jsonOut = JSON.parse(out);
        
        // Add model URL to response
        jsonOut.model_url = s3.getSignedUrl("getObject", { 
          Bucket: BUCKET, 
          Key: jsonOut.best_model, 
          Expires: 3600 
        });
        
        // Send webhook notification
        sendWebhook("match", {
          ...jsonOut,
          timestamp: new Date().toISOString(),
          images_count: req.files.length
        }).catch(err => console.error("Webhook error:", err));
        
        res.json(jsonOut);
      } catch (e) {
        console.error("Parse error:", e, "Raw output:", out);
        res.status(500).json({ error: "Bad AI output", raw: out });
      }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Internal error" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`3D AI Dashboard backend running on ${PORT}`));
