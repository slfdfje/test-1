# Quick Start Guide

## Fix Current Errors

The errors you're seeing are because the frontend is trying to connect to a remote API that may not be accessible. Here's how to fix it:

### Option 1: Run Backend Locally

1. **Start the backend server:**
```bash
cd backend
node server.mjs
```

The backend will start on `http://localhost:5000`

2. **Restart the frontend** (stop with Ctrl+C and run again):
```bash
cd frontend
npm run dev
```

The frontend will now connect to your local backend at `http://localhost:5000`

### Option 2: Use Production Backend

If you want to use the production backend, update `frontend/.env`:

```bash
VITE_API_URL=https://test-1-production-7a52.up.railway.app
```

Then restart the frontend.

## Environment Setup

### Backend Requirements

1. **Install Python dependencies:**
```bash
cd backend
pip install -r requirements.txt
```

2. **Configure AWS/Wasabi credentials** (create `.env` in backend folder):
```bash
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_ENDPOINT=s3.eu-west-1.wasabisys.com
AWS_REGION=eu-west-1
S3_BUCKET=jigu
PORT=5000
```

3. **Start backend:**
```bash
node server.mjs
```

### Frontend Setup

1. **Install dependencies:**
```bash
cd frontend
npm install
```

2. **Configure API URL** (already done in `.env`):
```bash
VITE_API_URL=http://localhost:5000
```

3. **Start frontend:**
```bash
npm run dev
```

## Access the Application

- **Main App**: http://localhost:5173/
- **Admin Panel**: http://localhost:5173/admin.html

## Common Issues

### CORS Errors
- Make sure backend is running
- Check that `VITE_API_URL` in frontend/.env matches your backend URL
- Backend already has CORS enabled for all origins

### "Failed to fetch" Error
- Backend is not running or not accessible
- Check backend console for errors
- Verify the API URL is correct

### Python/AI Errors
- Install Python dependencies: `pip install torch torchvision pillow`
- Download reference images from S3
- Build embeddings: `python match.py --build`

## Testing the Setup

1. **Test backend health:**
```bash
curl http://localhost:5000/health
```

2. **Test model listing:**
```bash
curl http://localhost:5000/models
```

3. **Upload test images** through the frontend UI

## Next Steps

1. Upload reference images to S3 bucket under `reference_images/` folder
2. Build AI embeddings: `POST http://localhost:5000/rebuild-embeddings`
3. Upload 3D models (GLB files) through admin panel
4. Test image matching through main interface
