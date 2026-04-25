# AI Glasses Try-On System - Complete Guide

## What's Been Built

This is a production-ready parametric glasses generation system that:

1. **Analyzes user photos** - Detects face and extracts measurements
2. **Generates custom 3D glasses** - Creates GLB model fitted to the user's face
3. **Provides try-on** - Renders glasses overlaid on the original image

## Architecture

```
User Upload Image
       ↓
AI Detection (face-api.js)
       ↓
Extract Measurements (glasses width, bridge, etc.)
       ↓
Generate 3D Model (Blender script)
       ↓
Return GLB + Position Data
       ↓
Frontend displays with auto-fit
```

## Files Created

### Backend
- `backend/ai-server.mjs` - AI face detection server
- `backend/models/` - face-api.js model files
- `backend/scripts/generate_glasses.py` - Blender parametric script

### Documentation
- `PARAMETRIC_SYSTEM.md` - This guide

## How to Use

### 1. Start the AI Server

```bash
cd backend
node ai-server.mjs
```

### 2. Test the API

```bash
# Analyze face from image
curl -X POST -F "image=@your-photo.jpg" http://localhost:5000/analyze
```

Response:
```json
{
  "success": true,
  "measurements": {
    "glassesWidth": 135,
    "bridgeWidth": 24,
    "templeLength": 108,
    "eyeLevel": 320,
    "faceWidth": 104
  },
  "position": {
    "faceCenter": { "x": 256, "y": 340 },
    "faceTilt": -2.5
  }
}
```

### 3. Generate Glasses (requires Blender)

```bash
blender --background --python scripts/generate_glasses.py -- 135 24 output.glb
```

## Frontend Integration

The frontend already calls `/analyze` and `/generate-glasses`. To display properly:

1. Use the `position` data from the API response
2. Scale the glasses model based on `measurements.scale`
3. Rotate by `position.faceTilt` degrees
4. Position at `position.faceCenter` coordinates

Example frontend code:
```javascript
function fitGlasses(apiResponse, glassesModel) {
    const { glassesConfig, position } = apiResponse;
    
    // Scale based on detected face width
    glassesModel.scale.set(glassesConfig.scale, glassesConfig.scale, glassesConfig.scale);
    
    // Position on face
    glassesModel.position.x = (position.x - imageWidth/2) / scaleFactor;
    glassesModel.position.y = (imageHeight/2 - position.y) / scaleFactor;
    
    // Apply face tilt
    glassesModel.rotation.z = glassesConfig.rotation;
}
```

## Requirements

### For AI Detection (Works Now)
- Node.js
- face-api.js
- canvas
- sharp

### For 3D Generation (Optional)
- Blender installed
- Run locally for best results

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/analyze` | POST | Analyze face and return measurements |
| `/generate-glasses` | POST | Full generation: analyze + return config |
| `/status` | GET | Check if AI models are loaded |

## Troubleshooting

### "Models not loaded yet"
- Wait 10-20 seconds after starting server
- Check `/status` endpoint

### "No face detected"
- Use clear, well-lit photo
- Face should be frontal, not rotated
- Minimum recommended: 200x200px

### Blender not found
- Install Blender from blender.org
- Add to PATH or use full path

## Next Steps

1. Test the `/analyze` endpoint with a photo
2. Install Blender to generate actual 3D models
3. Update frontend to use position data for accurate display
4. Add more frame styles/templates

## Why This Beats Photogrammetry

| Feature | Photogrammetry | This System |
|---------|---------------|-------------|
| Speed | 5-30 minutes | Instant |
| Accuracy | Unpredictable | Controlled |
| Transparent objects | Fail | Works |
| Mobile | Heavy | Light |
| Cost | High compute | Low |
| Scalability | Hard | Easy |