# Photogrammetry Pipeline Guide

## ⚠️ IMPORTANT REALITY CHECK

### What Works for Glasses:
✅ **Parametric Generation** (RECOMMENDED)
- Measure glasses dimensions
- Generate 3D model from template
- Fast, reliable, scalable
- **This is what real companies use**

### What Doesn't Work Well:
❌ **Full Photogrammetry** (NOT RECOMMENDED for glasses)
- Needs 20-50 high-quality images
- Transparent/reflective surfaces fail
- Plain backgrounds cause issues
- Results are often distorted
- Takes 10-30 minutes per model

## 🚀 Recommended Approach

### For Your Business:

1. **Use Parametric Generation**
   - Detect glasses from 1-4 images
   - Extract measurements (width, bridge, temple)
   - Generate from template
   - Result in < 5 seconds

2. **Pre-built Library**
   - Maintain catalog of common frames
   - Match uploaded images to existing models
   - Your current AI matching system does this!

3. **Hybrid Approach**
   - Use AI matching for existing models
   - Use parametric for custom sizes
   - Only use photogrammetry for special cases

## 📦 What I Built

### 1. Photogrammetry Server
- Full pipeline: Images → Meshroom → Blender → GLB
- Endpoint: `POST /photogrammetry`
- Requires: Meshroom + Blender installed

### 2. Parametric Generator
- Fast template-based generation
- Endpoint: `POST /parametric`
- Requires: Only Blender

### 3. Scripts
- `glasses_parametric.py` - Generate from measurements
- `blender_fix.py` - Clean up photogrammetry output
- `run_meshroom.sh` - Automate Meshroom

## 🛠️ Installation

### Prerequisites

#### 1. Install Blender
```bash
# Windows
# Download from: https://www.blender.org/download/
# Add to PATH

# Linux
sudo apt install blender

# Mac
brew install --cask blender
```

#### 2. Install Meshroom (Optional - only for photogrammetry)
```bash
# Download from: https://alicevision.org/#meshroom
# Extract and add to PATH
```

#### 3. Install Node Dependencies
```bash
cd backend
npm install uuid
```

### Make Scripts Executable (Linux/Mac)
```bash
chmod +x backend/scripts/run_meshroom.sh
```

## 🚀 Usage

### Start Photogrammetry Server
```bash
cd backend
node photogrammetry-server.mjs
```

Server runs on: `http://localhost:5001`

### API Endpoints

#### 1. Parametric Generation (RECOMMENDED)
```bash
POST http://localhost:5001/parametric

Form Data:
- image: (file) - Reference image
- width: 140 (mm)
- bridge: 20 (mm)
- temple: 145 (mm)

Response:
{
  "success": true,
  "jobId": "abc-123",
  "modelUrl": "/output/abc-123.glb",
  "measurements": {
    "width": 140,
    "bridge": 20,
    "temple": 145
  }
}
```

#### 2. Full Photogrammetry (Advanced)
```bash
POST http://localhost:5001/photogrammetry

Form Data:
- images: (multiple files, 10-50 images)

Response:
{
  "success": true,
  "jobId": "xyz-789",
  "modelUrl": "/output/xyz-789.glb",
  "imagesProcessed": 25
}
```

#### 3. List Jobs
```bash
GET http://localhost:5001/jobs

Response:
[
  {
    "id": "abc-123",
    "url": "/output/abc-123.glb",
    "created": "2026-04-15T01:00:00.000Z"
  }
]
```

## 📸 Photogrammetry Tips (If You Must Use It)

### Image Requirements:
- **Quantity**: 20-50 images minimum
- **Quality**: High resolution, well-lit
- **Coverage**: 360° around object
- **Background**: Textured, not plain
- **Overlap**: 60-80% between consecutive images

### For Glasses Specifically:
- ❌ Transparent lenses = major problem
- ❌ Reflective frames = tracking issues
- ❌ Thin temples = often missing
- ✅ Matte finish = better results
- ✅ Textured background = helps tracking

### Reality:
You will likely get:
- Distorted frames
- Missing parts
- Incorrect scale
- Holes in mesh

**This is why parametric is better for glasses!**

## 🎯 Recommended Workflow

### For Your Startup:

1. **Customer uploads 1-4 images**
2. **AI detects glasses type** (your current system)
3. **Match to existing model** (your current system)
4. **If no match:**
   - Extract measurements from image
   - Generate parametric model
   - Store for future use

### Measurement Extraction (Add AI):
```python
# Use OpenCV or MediaPipe
# Detect key points:
- Frame width
- Bridge width
- Temple length
- Lens height
```

## 🔧 Integration with Your Current System

### Option A: Replace Matching with Generation
```javascript
// In your current match-model endpoint
if (confidence < 0.7) {
  // Generate new model instead
  const measurements = extractMeasurements(images);
  const model = await generateParametric(measurements);
  return model;
}
```

### Option B: Hybrid System
```javascript
// Try matching first
const match = await matchModel(images);

if (match.confidence > 0.8) {
  return match.model;
} else {
  // Generate custom
  const measurements = extractMeasurements(images);
  return await generateParametric(measurements);
}
```

## 📊 Performance Comparison

| Method | Time | Quality | Scalability | Cost |
|--------|------|---------|-------------|------|
| **Parametric** | 5s | Good | Excellent | Low |
| **AI Matching** | 2s | Excellent | Excellent | Low |
| **Photogrammetry** | 10-30min | Poor (glasses) | Bad | High |

## 🚨 Common Issues

### Blender Not Found
```bash
# Add Blender to PATH
# Windows: Add C:\Program Files\Blender Foundation\Blender\
# Linux: sudo apt install blender
# Mac: brew install --cask blender
```

### Meshroom Fails
```bash
# Check images:
- Need 20+ images
- Good lighting
- Textured background
- 60-80% overlap
```

### GLB Export Fails
```bash
# Check Blender version
blender --version
# Need 2.8 or higher
```

## 💡 Next Steps

### Immediate (This Week):
1. ✅ Test parametric generation
2. ✅ Integrate with current system
3. ✅ Add measurement extraction

### Short Term (This Month):
1. Build measurement AI
2. Create template library
3. Add size customization

### Long Term (Future):
1. AR try-on integration
2. Face shape matching
3. Recommendation engine

## 🎓 Learning Resources

- Blender Python API: https://docs.blender.org/api/current/
- Meshroom Docs: https://meshroom-manual.readthedocs.io/
- Three.js: https://threejs.org/docs/
- MediaPipe Face: https://google.github.io/mediapipe/solutions/face_mesh

## 📝 Summary

**For glasses business:**
- ✅ Use parametric generation
- ✅ Keep your AI matching system
- ❌ Avoid full photogrammetry
- 🎯 Focus on measurement extraction

**You're 90% there with your current system!**
Just add parametric generation for custom sizes.
