# Setting Up S3/Wasabi Credentials

## Why You Need This

Your app is showing "0% Match" and no 3D model because it can't access the S3/Wasabi storage where the 3D models are stored.

## Quick Fix Options

### Option 1: Add Your S3/Wasabi Credentials (RECOMMENDED)

1. **Get your credentials** from Wasabi or AWS S3 dashboard

2. **Edit `backend/.env`** file:
```bash
AWS_ACCESS_KEY_ID=your_actual_access_key
AWS_SECRET_ACCESS_KEY=your_actual_secret_key
AWS_ENDPOINT=s3.eu-west-1.wasabisys.com
AWS_REGION=eu-west-1
S3_BUCKET=jigu
```

3. **Restart the backend**:
```bash
# Stop the current backend (Ctrl+C)
cd backend
node server.mjs
```

### Option 2: Use Local Files for Testing

If you don't have S3 credentials yet, I can create a local file server:

1. **Create a local models folder**:
```bash
mkdir backend/local_models
```

2. **Add some test GLB files** to `backend/local_models/`

3. **I'll modify the server** to serve local files instead of S3

### Option 3: Use Public Test Models

I can configure the app to use publicly available 3D models for testing.

## What's Happening Now

Looking at your backend logs:
```
Error: Missing credentials in config
Could not load credentials from any providers
```

The backend is trying to connect to S3/Wasabi but doesn't have credentials.

## Where to Get Credentials

### Wasabi (Recommended - Cheaper than AWS)
1. Go to https://wasabi.com
2. Sign up for free trial
3. Create a bucket named "jigu"
4. Go to "Access Keys" and create new key
5. Copy Access Key ID and Secret Access Key

### AWS S3
1. Go to https://aws.amazon.com/s3/
2. Sign in to AWS Console
3. Go to IAM → Users → Create Access Key
4. Copy Access Key ID and Secret Access Key
5. Create an S3 bucket

## After Adding Credentials

1. Upload 3D models (GLB files) to your bucket
2. Upload reference images to `reference_images/` folder in bucket
3. Rebuild embeddings via admin panel
4. Test the matching again

## Need Help?

Let me know which option you want to use:
- Option 1: I'll help you configure S3/Wasabi
- Option 2: I'll create a local file server
- Option 3: I'll set up public test models
