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
app.use(cors());
app.use(express.json());

const upload = multer({ dest: "uploads/" });

// Enable/disable authentication
const REQUIRE_AUTH = process.env.REQUIRE_AUTH === "true" || false;

// WASABI / S3 config - replace with your credentials
const s3 = new AWS.S3({
  endpoint: "s3.eu-west-1.wasabisys.com",
  region: "eu-west-1",
  accessKeyId: "CIRUITZOGBCJ0JVNF24E",
  secretAccessKey: "q7yMsemeGeQ70P4DYzXrmFeuUjb5ms62bucg28ec",
  signatureVersion: "v4"
});

const BUCKET = "jigu";

if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

// Optional auth middleware
const optionalAuth = REQUIRE_AUTH ? authMiddleware("read") : (req, res, next) => next();
const writeAuth = REQUIRE_AUTH ? authMiddleware("write") : (req, res, next) => next();

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
    const py = spawn("python", ["match.py", "--build"], { cwd: process.cwd() });
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
    const py = spawn("python", ["match.py", ...filePaths], { cwd: process.cwd() });
    let out = "", errOut = "";
    py.stdout.on("data", d => out += d.toString());
    py.stderr.on("data", d => errOut += d.toString());
    py.on("close", async code => {
      filePaths.forEach(p => fs.unlink(p, () => {}));
      if (code !== 0) return res.status(500).json({ error: "AI matching failed", details: errOut || out });
      try {
        const jsonOut = JSON.parse(out);
        
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
      } catch (e) {
        res.status(500).json({ error: "Bad AI output", raw: out.toString() });
      }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Internal error" });
  }
});

const PORT = 5000;
app.listen(PORT, () => console.log(`3D AI Dashboard backend running on ${PORT}`));
