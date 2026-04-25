# Fix: No 3D Model Showing After Upload

## The Problem

You uploaded glasses images and got "0% Match" but no 3D model is visible because:
1. ❌ No AWS/Wasabi S3 credentials configured
2. ❌ No 3D models in the storage
3. ❌ No reference images for AI matching

## Quick Solution (2 Options)

### ✅ Option A: Use Local File Server (NO S3 NEEDED)

**Step 1:** Stop the current backend (find the terminal and press Ctrl+C)

**Step 2:** Start the local file server:
```bash
cd backend
node local-server.mjs
```

**Step 3:** Add test models:
- Download some free GLB models from: https://sketchfab.com/3d-models?features=downloadable&sort_by=-likeCount
- Or use: https://github.com/KhronosGroup/glTF-Sample-Models
- Place GLB files in: `backend/local_models/`

**Step 4:** Add reference images:
- Take photos of glasses from different angles
- Place images in: `backend/reference_images/`

**Step 5:** Rebuild embeddings (via admin panel or):
```bash
cd backend
python match.py --build
```

**Step 6:** Test again!

---

### ✅ Option B: Configure S3/Wasabi

**Step 1:** Get credentials from Wasabi or AWS

**Step 2:** Edit `backend/.env`:
```bash
AWS_ACCESS_KEY_ID=your_key_here
AWS_SECRET_ACCESS_KEY=your_secret_here
AWS_ENDPOINT=s3.eu-west-1.wasabisys.com
S3_BUCKET=jigu
```

**Step 3:** Restart backend:
```bash
cd backend
node server.mjs
```

**Step 4:** Upload models via admin panel

---

## Why 0% Match?

The AI matching requires:
1. ✅ Reference images in `reference_images/` folder
2. ✅ Pre-built embeddings (`reference_embeddings.pt`)
3. ✅ Python with PyTorch installed

If you don't have these, the match will show 0% and pick a random model.

## Quick Test Setup

I recommend Option A (local server) for testing. Here's the complete flow:

```bash
# 1. Create directories
cd backend
mkdir local_models
mkdir reference_images

# 2. Download a test GLB model
# Visit: https://github.com/KhronosGroup/glTF-Sample-Models/tree/master/2.0
# Download any .glb file to backend/local_models/

# 3. Add reference images
# Copy some glasses images to backend/reference_images/

# 4. Install Python dependencies
pip install torch torchvision pillow

# 5. Build embeddings
python match.py --build

# 6. Start local server
node local-server.mjs

# 7. Test in browser
# Go to http://localhost:5173 and upload images
```

## Verify Setup

Check these URLs:
- Backend health: http://localhost:5000/health
- List models: http://localhost:5000/models
- Debug info: http://localhost:5000/debug

## Still Not Working?

Check:
1. Python installed? `python --version`
2. PyTorch installed? `pip list | grep torch`
3. Models in folder? `ls backend/local_models`
4. References in folder? `ls backend/reference_images`
5. Embeddings built? `ls backend/reference_embeddings.pt`
