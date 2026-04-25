# End-to-End Test Scenarios

Automated E2E testing requires a running browser and a live Blender installation.
The scenarios below are designed for **manual testing** or for automation with a
tool such as Playwright once the environment is available.

---

## Prerequisites

- Backend running: `cd backend && node admin-workflow-server.mjs`
- Frontend served: `cd frontend && npm run dev`
- Dashboard open: `http://localhost:5173/admin-workflow-automated.html`
- Three test images available (any JPEG/PNG files will do for smoke tests)

---

## Scenario 1 — Complete Upload Workflow

**Goal:** Verify that uploading glasses with valid dimensions triggers automatic
3D model generation and the dashboard reflects the final state.

### Steps

1. Open the dashboard.
2. Fill in the upload form:
   - Images: select 3 image files (front + left temple + right temple)
   - Brand: `TestBrand`
   - Model: `TestModel`
   - Price: `150`
   - Category: `Eyeglasses`
   - Frame Width: `140`
   - Bridge Width: `20`
   - Temple Length: `145`
3. Click **Upload & Generate**.

### Expected Results

- The form clears immediately after submission.
- A success toast/message appears: "Glasses uploaded – generation started automatically!"
- The new item appears in the catalog with status badge **PROCESSING** (pulsing animation).
- The auto-refresh indicator ("Auto-refreshing") becomes visible.
- Within 5–15 seconds (if Blender is installed) the status badge changes to **GENERATED**.
- The "View Model" and "Approve" buttons appear on the card.
- The generation duration is displayed on the card.

---

## Scenario 2 — Status Updates in Dashboard

**Goal:** Verify that the dashboard polls and updates status without a manual
page refresh.

### Steps

1. Upload a new glasses item (see Scenario 1).
2. Do **not** manually refresh the page.
3. Wait up to 30 seconds.

### Expected Results

- The status badge updates from PROCESSING → GENERATED automatically.
- The "Auto-refreshing" indicator is visible while any job is processing.
- The "Auto-refreshing" indicator disappears once all jobs complete.
- The stats counters (Processing, Generated) update accordingly.
- The "Last updated" timestamp refreshes every 3 seconds while polling is active.

---

## Scenario 3 — Retry Functionality

**Goal:** Verify that a failed generation can be retried from the dashboard.

### Steps

1. Temporarily rename or move the Blender executable so it cannot be found.
2. Upload a new glasses item.
3. Wait for the status to change to **FAILED**.
4. Verify the error message is displayed on the card (e.g., "Blender is not installed
   or not found at the expected location").
5. Restore the Blender executable.
6. Click the **🔄 Retry** button on the failed card.
7. Confirm the retry dialog (which shows the previous error message).

### Expected Results

- After clicking Retry, the status badge changes back to **PROCESSING**.
- The auto-refresh indicator reappears.
- The retry count badge appears on the card (e.g., "(1 retry)").
- If Blender is now available, the status eventually changes to **GENERATED**.
- If Blender is still unavailable, the status returns to **FAILED** with the same
  error message.

---

## Scenario 4 — Model Preview

**Goal:** Verify that a generated model can be previewed.

### Steps

1. Upload a glasses item and wait for status **GENERATED**.
2. Click the **View Model** button on the card.

### Expected Results

- A new browser tab opens pointing to the AR try-on page with the model ID as a
  URL parameter (e.g., `/ar-tryon.html?model=<id>`).
- The 3D model loads in the viewer.
- Basic camera controls (orbit, zoom) work.

---

## Scenario 5 — Error Handling

**Goal:** Verify that validation errors and runtime errors are surfaced clearly.

### Sub-scenario 5a — Invalid Dimensions

1. Fill in the upload form with out-of-range dimensions:
   - Frame Width: `50` (below minimum 100)
   - Bridge Width: `5` (below minimum 10)
   - Temple Length: `200` (above maximum 160)
2. Click **Upload & Generate**.

**Expected:** The backend returns HTTP 400. The frontend displays all three
validation error messages. No new item is added to the catalog.

### Sub-scenario 5b — Missing Images

1. Submit the form without selecting any images.

**Expected:** The frontend shows "Please select exactly 3 images" before even
sending the request.

### Sub-scenario 5c — Blender Not Installed

1. Ensure Blender is not installed (or BLENDER_PATH points to a non-existent path).
2. Upload a valid glasses item.

**Expected:** The item appears with status **PROCESSING**, then transitions to
**FAILED** with the message "Blender is not installed or not found at the expected
location". The Retry button is visible.

### Sub-scenario 5d — Generation Timeout

1. Set `GENERATION_TIMEOUT_MS=5000` (5 seconds) in `.env` for testing.
2. Upload a valid glasses item.

**Expected:** After ~5 seconds the status changes to **FAILED** with the message
"Model generation took too long and was cancelled (timeout: 5 minutes)" (or the
configured timeout value).

---

## Scenario 6 — Concurrent Uploads

**Goal:** Verify that the queue system handles more than 3 simultaneous uploads.

### Steps

1. Rapidly submit 5 upload requests (open 5 browser tabs or use a script).
2. Observe the dashboard.

### Expected Results

- The first 3 jobs start immediately (status: PROCESSING).
- Jobs 4 and 5 are queued; they transition to PROCESSING once a slot frees up.
- `GET /admin/stats` shows `queue.active` ≤ 3 and `queue.queued` ≥ 0.
- `GET /admin/queue-status` returns the live queue state.
- All 5 jobs eventually complete (GENERATED or FAILED).

---

## Scenario 7 — Backward Compatibility

**Goal:** Verify that legacy records (without generation fields) display correctly.

### Steps

1. Manually add a legacy record to `glasses-database.json` without
   `generationStatus`, `generationError`, `generationStartedAt`, or
   `generationCompletedAt` fields.
2. Restart the backend.
3. Open the dashboard.

### Expected Results

- The legacy record appears in the catalog.
- If the record has a `modelUrl`, its status badge shows **GENERATED**.
- If the record has no `modelUrl`, its status badge shows **PENDING**.
- No JavaScript errors appear in the browser console.

---

## Manual Testing Checklist (from spec)

| # | Scenario | Pass / Fail | Notes |
|---|----------|-------------|-------|
| 1 | Upload with valid dimensions → verify auto-generation | | |
| 2 | Upload with invalid dimensions → verify validation errors | | |
| 3 | Simulate Blender failure → verify error display and retry | | |
| 4 | Upload multiple items → verify concurrent processing | | |
| 5 | Test with Blender not installed → verify graceful error | | |
| 6 | Status updates appear in dashboard without manual refresh | | |
| 7 | Retry functionality resets status and relaunches generation | | |
| 8 | Model preview opens correct GLB file | | |
| 9 | Legacy records display correctly after server restart | | |
| 10 | Queue status endpoint returns accurate data | | |
