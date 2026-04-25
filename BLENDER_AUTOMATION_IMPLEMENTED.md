# Blender Upload Automation — Implementation Guide

## Overview

The Blender Upload Automation feature automates 3D model generation for AR glasses.
When an admin uploads product images and enters frame dimensions, the system
immediately starts a Blender generation job in the background, updates the dashboard
with live status, and makes the generated model available automatically.

No manual "Generate Model" button is required. The workflow is:

```
Upload images + dimensions
        ↓
Backend validates input
        ↓
Record created (status: processing)
        ↓
HTTP response returned immediately
        ↓
Blender spawned asynchronously
        ↓
Status updated → generated / failed
        ↓
Dashboard auto-refreshes (every 3 s)
```

---

## Dimension Guidelines

All dimensions are in millimetres (mm).

| Dimension | Min | Max | Default | Description |
|-----------|-----|-----|---------|-------------|
| Frame Width | 100 | 180 | 140 | Total horizontal width from hinge to hinge |
| Bridge Width | 10 | 30 | 20 | Width of the nose bridge between the two lenses |
| Temple Length | 120 | 160 | 145 | Length of the temple arm from hinge to tip |

Typical adult frames: Frame Width 125–145 mm, Bridge Width 14–24 mm, Temple Length 135–150 mm.

---

## Error Messages and Troubleshooting

| Error Code | User-Facing Message | Cause | Fix |
|------------|---------------------|-------|-----|
| `BLENDER_NOT_FOUND` | Blender is not installed or not found at the expected location | `BLENDER_PATH` env var points to a non-existent file | Install Blender or update `BLENDER_PATH` in `.env` |
| `TIMEOUT` | Model generation took too long and was cancelled (timeout: 5 minutes) | Blender process ran longer than `GENERATION_TIMEOUT_MS` | Increase timeout or investigate script performance |
| `FILE_NOT_FOUND` | Blender completed but did not create the expected model file | `glasses_parametric.py` exited 0 but wrote no GLB | Check the Python script for logic errors |
| `EMPTY_FILE` | Blender created an empty model file | GLB file exists but has 0 bytes | Check disk space and Python script output |
| `BLENDER_ERROR` | Blender script error: `<traceback>` | Blender exited with non-zero code | Read the traceback in the error message |
| `SPAWN_ERROR` | Failed to start Blender process: `<reason>` | OS-level spawn failure | Check permissions and `BLENDER_PATH` |

### Common Issues

**Dashboard shows "processing" indefinitely**
- Check backend logs for Blender output.
- Verify `BLENDER_PATH` is correct.
- Check `GET /admin/queue-status` to see if the job is active or queued.

**Validation errors on upload**
- Ensure all three dimension fields are filled in.
- Check that values are within the allowed ranges (see table above).
- Exactly 3 images must be selected (front + left temple + right temple).

**Retry button not appearing**
- The Retry button only appears when `generationStatus === 'failed'`.
- Refresh the page if the status has not updated yet.

---

## API Documentation

### POST /admin/upload-glasses

Upload glasses images and start automatic 3D generation.

**Request:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `images` | File[] | Yes | 1–3 image files (front + temples) |
| `brand` | string | Yes | Brand name |
| `model` | string | Yes | Model name |
| `price` | number | No | Price in USD |
| `category` | string | No | `sunglasses`, `eyeglasses`, `sports`, `fashion` |
| `frameWidth` | number | Yes | 100–180 mm |
| `bridgeWidth` | number | Yes | 10–30 mm |
| `templeLength` | number | Yes | 120–160 mm |

**Response 200:**
```json
{
  "success": true,
  "id": "uuid",
  "message": "Glasses uploaded successfully - generation started",
  "item": { "...full record..." }
}
```

**Response 400 (validation failure):**
```json
{
  "error": "Validation failed",
  "validationErrors": ["Frame width must be between 100mm and 180mm"]
}
```

---

### POST /admin/retry-model/:id

Retry a failed generation job using the stored dimensions.

**Response 200:**
```json
{
  "success": true,
  "message": "Generation retry started",
  "item": { "...updated record..." }
}
```

**Response 400:** `{ "error": "Can only retry failed generations" }`

---

### GET /admin/glasses

List all glasses records with optional filtering.

**Query parameters:**

| Parameter | Description |
|-----------|-------------|
| `status` | Filter by status: `processing`, `generated`, `failed`, `approved`, `rejected` |
| `category` | Filter by category |

**Response 200:**
```json
{
  "total": 5,
  "glasses": [ { "...record..." } ]
}
```

Records are sorted by `uploadedAt` descending (most recent first).

---

### GET /admin/glasses/:id

Get a single glasses record with computed generation duration.

**Response 200:**
```json
{
  "id": "uuid",
  "generationStatus": "generated",
  "generationDurationSeconds": 12,
  "...all other fields..."
}
```

---

### GET /admin/queue-status

Get the current Blender job queue status.

**Response 200:**
```json
{
  "active": 2,
  "queued": 1,
  "maxConcurrent": 3,
  "activeJobs": ["job-id-1", "job-id-2"]
}
```

---

### GET /admin/stats

Get aggregate statistics including queue status.

**Response 200:**
```json
{
  "total": 10,
  "pending": 0,
  "processing": 2,
  "generated": 5,
  "approved": 3,
  "rejected": 0,
  "failed": 0,
  "categories": { "eyeglasses": 6, "sunglasses": 4 },
  "queue": { "active": 2, "queued": 0, "maxConcurrent": 3, "activeJobs": [] }
}
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (admin-workflow-automated.html)                    │
│  ┌──────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │ Upload Form  │  │ Glasses Catalog  │  │ Stats Panel   │  │
│  │ (dimensions) │  │ (status badges)  │  │ (counters)    │  │
│  └──────┬───────┘  └────────┬─────────┘  └───────────────┘  │
│         │ POST /upload      │ GET /glasses (poll 3s)         │
└─────────┼───────────────────┼─────────────────────────────────┘
          │                   │
┌─────────▼───────────────────▼─────────────────────────────────┐
│  Backend (admin-workflow-server.mjs)                           │
│  ┌──────────────────┐  ┌──────────────────┐                   │
│  │ Express Routes   │  │ db-helpers.mjs   │                   │
│  │ /upload-glasses  │  │ normaliseRecord  │                   │
│  │ /retry-model/:id │  │ updateStatus     │                   │
│  │ /glasses         │  │ setTimestamps    │                   │
│  │ /queue-status    │  │ getJobsByStatus  │                   │
│  └────────┬─────────┘  └──────────────────┘                   │
│           │ spawnBlenderJob()                                  │
│  ┌────────▼─────────────────────────────────────────────────┐ │
│  │ blender-runner.mjs                                        │ │
│  │  - Max 3 concurrent jobs                                  │ │
│  │  - Job queue for overflow                                 │ │
│  │  - 5-minute timeout per job                               │ │
│  │  - Output file verification                               │ │
│  └────────┬─────────────────────────────────────────────────┘ │
└───────────┼────────────────────────────────────────────────────┘
            │ spawn()
┌───────────▼────────────────────────────────────────────────────┐
│  Blender 5.1 (glasses_parametric.py)                           │
│  Writes: backend/output/<id>.glb                               │
└────────────────────────────────────────────────────────────────┘
            │
┌───────────▼────────────────────────────────────────────────────┐
│  glasses-database.json  (persisted after every status change)  │
└────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

- **Non-blocking uploads:** The HTTP response is returned before Blender finishes.
  Generation happens in a fire-and-forget async chain.
- **Async mutex:** `db-helpers.mjs` uses a serial write queue to prevent race
  conditions when multiple jobs complete simultaneously.
- **Backward compatibility:** `normaliseRecord()` adds new fields to legacy records
  on load without modifying the stored JSON until the next write.
- **Retry tracking:** Each retry increments `retryCount` on the record so the
  dashboard can show how many attempts have been made.

---

## File Reference

| File | Purpose |
|------|---------|
| `backend/admin-workflow-server.mjs` | Express server, all HTTP endpoints |
| `backend/blender-runner.mjs` | Blender process manager (spawn, queue, timeout) |
| `backend/db-helpers.mjs` | Database helper functions (status, timestamps, normalise) |
| `backend/glasses-database.json` | Persistent JSON database |
| `backend/scripts/glasses_parametric.py` | Blender Python script for parametric generation |
| `backend/scripts/migrate-database.mjs` | One-time migration script for legacy records |
| `backend/tests/unit.test.mjs` | Backend unit tests |
| `backend/tests/integration.test.mjs` | Backend integration tests |
| `backend/tests/e2e-scenarios.md` | Manual E2E test scenarios |
| `frontend/admin-workflow-automated.html` | Admin dashboard UI |
| `frontend/tests/unit.test.mjs` | Frontend unit tests |

---

## Running Tests

```bash
# Backend unit + integration tests
cd backend
npm test

# Backend unit tests only
npm run test:unit

# Backend integration tests only
npm run test:integration

# Frontend unit tests
cd frontend
node --test tests/unit.test.mjs
```
