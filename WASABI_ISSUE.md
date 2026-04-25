# Wasabi Connection Issue

## Problem

The Wasabi credentials are not working. Error:
```
The AWS Access Key Id you provided does not exist in our records.
```

## Possible Causes

### 1. Trial Expired ⚠️
Your screenshot shows "Trial Expired" and "Upgrade Now" in red.
- **Solution**: Upgrade your Wasabi account or create a new trial

### 2. Access Key Deactivated
The access key might have been deactivated when the trial expired.
- **Solution**: Create a new access key in Wasabi console

### 3. Wrong Region
The bucket might be in a different region than eu-west-1.
- **Solution**: Check bucket region in Wasabi console

## Quick Fixes

### Option A: Create New Access Key

1. Go to Wasabi Console: https://console.wasabisys.com
2. Click "Access Keys" in left menu
3. Delete old key (if needed)
4. Click "Create Access Key"
5. Copy new credentials
6. Update `backend/.env` file

### Option B: Check Bucket Region

1. Go to "Buckets" in Wasabi console
2. Click on "jigu" bucket
3. Check the region (should show in bucket details)
4. Update `backend/.env` with correct region:
   - us-east-1: `s3.wasabisys.com`
   - us-east-2: `s3.us-east-2.wasabisys.com`
   - us-west-1: `s3.us-west-1.wasabisys.com`
   - eu-central-1: `s3.eu-central-1.wasabisys.com`
   - eu-west-1: `s3.eu-west-1.wasabisys.com`

### Option C: Upgrade Wasabi Account

1. Click "Upgrade Now" in Wasabi console
2. Choose a plan
3. Complete payment
4. Access keys should work again

### Option D: Use Local Files Instead

If you don't want to deal with Wasabi right now:

1. Stop backend (Ctrl+C)
2. Start local server:
   ```bash
   cd backend
   node local-server.mjs
   ```
3. Add GLB files to `backend/local_models/`
4. Works without any cloud storage!

## Testing

After fixing credentials, test with:
```bash
cd backend
node test-wasabi.mjs
```

Should show:
```
✅ Successfully connected to Wasabi!
✅ Successfully accessed jigu bucket!
```

## Current Credentials

From your screenshot:
- Access Key: PB3G5ZVQNWASiB7DHLlD
- Secret Key: aZHL9u0z7jCAu9VZPAXBJfQXTYv2bRrLUwgETjF
- Bucket: jigu
- Region: eu-west-1 (assumed)

## Recommendation

Since your trial expired, I recommend:

1. **Short term**: Use local file server (Option D above)
2. **Long term**: Either upgrade Wasabi or use AWS S3 free tier

The local file server works perfectly for development and testing!
