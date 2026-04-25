# Testing Summary — Blender Upload Automation

## Test Coverage

### Backend Unit Tests (`tests/unit.test.mjs`)

**34 tests, all passing**

- **normaliseRecord** (7 tests)
  - Adds default fields to legacy records
  - Defaults generationStatus based on modelUrl presence
  - Preserves existing fields
  - Reconstructs dimensions from legacy measurements
  - Handles missing data gracefully

- **getJobsByStatus** (4 tests)
  - Filters records by status
  - Returns empty array when no matches
  - Does not mutate original database

- **updateGenerationStatus** (4 tests)
  - Valid transitions: processing → generated, processing → failed
  - Invalid transitions log warnings but still update
  - Returns null for missing records

- **setGenerationTimestamps** (6 tests)
  - Sets started/completed timestamps independently or together
  - Preserves existing timestamps when null is passed
  - Calls saveDatabase after update

- **Upload validation logic** (13 tests)
  - Validates dimension ranges (frameWidth 100-180, bridgeWidth 10-30, templeLength 120-160)
  - Tests boundary values
  - Handles missing/invalid inputs
  - Reports all validation errors

---

### Backend Integration Tests (`tests/integration.test.mjs`)

**7 tests, all passing**

- **Full upload flow** (1 test)
  - Upload → processing → simulate Blender completion → generated
  - Verifies status transitions, timestamps, modelUrl

- **Upload → failure flow** (1 test)
  - Upload → simulate Blender failure → failed with error message
  - Verifies error storage and timestamp

- **Retry after failure** (2 tests)
  - Failed job → retry → processing → generated
  - Retry increments retryCount on each attempt

- **Concurrent job limiting** (2 tests)
  - Verifies queue behavior when > 3 jobs submitted
  - Jobs beyond limit are queued, not dropped

- **Status filtering integration** (1 test)
  - getJobsByStatus returns correct subset after status changes

---

### Frontend Unit Tests (`frontend/tests/unit.test.mjs`)

**30 tests, all passing**

- **Form validation logic** (13 tests)
  - Validates dimension ranges (same as backend)
  - Tests boundary values
  - Handles empty/non-numeric inputs

- **Status badge rendering** (10 tests)
  - Correct icons for each status (processing ⏳, generated ✓, approved ✅, failed ✗)
  - Correct CSS classes for each status

- **Polling mechanism** (7 tests)
  - managePoll starts/stops correctly
  - Does not start duplicate intervals
  - Can restart after being stopped
  - Starts when processing jobs exist
  - Stops when no processing jobs remain

---

### E2E Test Scenarios (`tests/e2e-scenarios.md`)

**Manual test scenarios documented:**

1. Complete upload workflow
2. Status updates in dashboard
3. Retry functionality
4. Model preview
5. Error handling (invalid dimensions, missing images, Blender not installed, timeout)
6. Concurrent uploads
7. Backward compatibility

---

## Test Execution

```bash
# Run all backend tests
cd backend
npm test

# Run backend unit tests only
npm run test:unit

# Run backend integration tests only
npm run test:integration

# Run frontend unit tests
cd frontend
node --test tests/unit.test.mjs
```

---

## Test Results

| Test Suite | Tests | Pass | Fail | Duration |
|------------|-------|------|------|----------|
| Backend Unit | 34 | 34 | 0 | ~120ms |
| Backend Integration | 7 | 7 | 0 | ~95ms |
| Frontend Unit | 30 | 30 | 0 | ~120ms |
| **Total** | **71** | **71** | **0** | **~335ms** |

---

## Coverage Summary

### Tested Components

✅ Database helpers (normaliseRecord, updateGenerationStatus, setGenerationTimestamps, getJobsByStatus)  
✅ Upload validation (dimension ranges, boundary values)  
✅ Status transitions (processing → generated/failed)  
✅ Retry logic (status reset, retryCount increment)  
✅ Concurrent job queue (max 3 active, overflow queued)  
✅ Frontend validation (dimension checks)  
✅ Frontend status rendering (icons, CSS classes)  
✅ Frontend polling mechanism (start/stop logic)

### Not Tested (Requires Manual/E2E)

⚠️ Actual Blender process spawning  
⚠️ File system operations (GLB creation, cleanup)  
⚠️ HTTP endpoints (requires running server)  
⚠️ Browser UI interactions (requires Playwright/Selenium)  
⚠️ Timeout enforcement (requires real 5-minute wait)

---

## Test Quality

- **Unit tests:** Fast, isolated, no external dependencies
- **Integration tests:** Mock Blender runner, test full workflows
- **Frontend tests:** Pure logic extraction, no DOM required
- **E2E scenarios:** Comprehensive manual test checklist

All tests use Node.js built-in `node:test` and `node:assert` — no external test frameworks required.
