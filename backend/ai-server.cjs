const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { exec } = require("child_process");

const faceapi = require("face-api.js");
const canvas = require("canvas");
const { Canvas, Image, ImageData } = canvas;

faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

const app = express();
const upload = multer({ dest: "uploads/" });

const MODELS_PATH = path.join(__dirname, "models");
const OUTPUT_PATH = path.join(__dirname, "output");

if (!fs.existsSync(OUTPUT_PATH)) {
    fs.mkdirSync(OUTPUT_PATH, { recursive: true });
}

let modelsLoaded = false;

async function loadModels() {
    console.log("Loading face-api models...");
    await faceapi.nets.tinyFaceDetector.loadFromDisk(MODELS_PATH);
    await faceapi.nets.faceLandmark68Net.loadFromDisk(MODELS_PATH);
    modelsLoaded = true;
    console.log("Face-api models loaded successfully!");
}

loadModels().catch(console.error);

app.post("/analyze", upload.single("image"), async (req, res) => {
    if (!modelsLoaded) {
        return res.status(503).json({ error: "Models not loaded yet" });
    }

    if (!req.file) {
        return res.status(400).json({ error: "No image uploaded" });
    }

    try {
        const imgPath = req.file.path;
        const img = await canvas.loadImage(imgPath);

        const detection = await faceapi
            .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks();

        if (!detection) {
            fs.unlinkSync(imgPath);
            return res.status(400).json({ error: "No face detected in image" });
        }

        const landmarks = detection.landmarks;
        const positions = landmarks.positions;

        const leftEye = [
            Math.round(positions[36].x),
            Math.round(positions[36].y)
        ];
        const rightEye = [
            Math.round(positions[45].x),
            Math.round(positions[45].y)
        ];

        const nose = positions[30];
        const leftCheek = positions[0];
        const rightCheek = positions[16];

        const faceWidth = Math.sqrt(
            Math.pow(rightEye[0] - leftEye[0], 2) + 
            Math.pow(rightEye[1] - leftEye[1], 2)
        );

        const leftEyeCenter = [
            (positions[36].x + positions[39].x) / 2,
            (positions[36].y + positions[39].y) / 2
        ];
        const rightEyeCenter = [
            (positions[42].x + positions[45].x) / 2,
            (positions[42].y + positions[45].y) / 2
        ];

        const faceCenterX = (leftEyeCenter[0] + rightEyeCenter[0]) / 2;
        const faceCenterY = (leftEyeCenter[1] + rightEyeCenter[1]) / 2;

        const glassesWidth = Math.round(faceWidth * 1.3);
        const bridgeWidth = Math.round(faceWidth * 0.18);
        const templeLength = Math.round(faceWidth * 0.8);

        const eyeLevel = Math.round(leftEyeCenter[1]);
        const faceTilt = Math.atan2(
            rightEyeCenter[1] - leftEyeCenter[1],
            rightEyeCenter[0] - leftEyeCenter[0]
        ) * (180 / Math.PI);

        fs.unlinkSync(imgPath);

        res.json({
            success: true,
            measurements: {
                glassesWidth,
                bridgeWidth,
                templeLength,
                eyeLevel,
                faceWidth: Math.round(faceWidth)
            },
            landmarks: {
                leftEye: leftEye,
                rightEye: rightEye,
                nose: { x: Math.round(nose.x), y: Math.round(nose.y) },
                leftCheek: { x: Math.round(leftCheek.x), y: Math.round(leftCheek.y) },
                rightCheek: { x: Math.round(rightCheek.x), y: Math.round(rightCheek.y) }
            },
            position: {
                faceCenter: { x: Math.round(faceCenterX), y: Math.round(faceCenterY) },
                faceTilt: Math.round(faceTilt * 10) / 10
            }
        });

    } catch (error) {
        console.error("Analysis error:", error);
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: "Failed to analyze image: " + error.message });
    }
});

app.post("/generate-glasses", upload.single("image"), async (req, res) => {
    if (!modelsLoaded) {
        return res.status(503).json({ error: "Models not loaded yet" });
    }

    if (!req.file) {
        return res.status(400).json({ error: "No image uploaded" });
    }

    try {
        const imgPath = req.file.path;
        const img = await canvas.loadImage(imgPath);

        const detection = await faceapi
            .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks();

        if (!detection) {
            fs.unlinkSync(imgPath);
            return res.status(400).json({ error: "No face detected" });
        }

        const landmarks = detection.landmarks;
        const positions = landmarks.positions;

        const leftEyeCenter = [
            (positions[36].x + positions[39].x) / 2,
            (positions[36].y + positions[39].y) / 2
        ];
        const rightEyeCenter = [
            (positions[42].x + positions[45].x) / 2,
            (positions[42].y + positions[45].y) / 2
        ];

        const faceWidth = Math.sqrt(
            Math.pow(rightEyeCenter[0] - leftEyeCenter[0], 2) + 
            Math.pow(rightEyeCenter[1] - leftEyeCenter[1], 2)
        );

        const glassesWidth = faceWidth * 1.3;
        const bridgeWidth = faceWidth * 0.18;

        const faceCenterX = (leftEyeCenter[0] + rightEyeCenter[0]) / 2;
        const faceCenterY = (leftEyeCenter[1] + rightEyeCenter[1]) / 2;

        const faceTilt = Math.atan2(
            rightEyeCenter[1] - leftEyeCenter[1],
            rightEyeCenter[0] - leftEyeCenter[0]
        );

        const scale = glassesWidth / 140;

        const result = {
            success: true,
            glassesConfig: {
                width: Math.round(glassesWidth),
                bridgeWidth: Math.round(bridgeWidth),
                scale: Math.round(scale * 1000) / 1000,
                rotation: Math.round(faceTilt * 100) / 100
            },
            position: {
                x: Math.round(faceCenterX),
                y: Math.round(faceCenterY - faceWidth * 0.1)
            },
            imageDimensions: {
                width: img.width,
                height: img.height
            }
        };

        fs.unlinkSync(imgPath);
        res.json(result);

    } catch (error) {
        console.error("Generate error:", error);
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: "Failed to generate: " + error.message });
    }
});

app.get("/status", (req, res) => {
    res.json({
        status: modelsLoaded ? "ready" : "loading",
        modelsLoaded,
        uptime: process.uptime()
    });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
    console.log(`AI Face Analysis server running on port ${PORT}`);
});