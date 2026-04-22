# Blender Upload Automation Design

Date: 2026-04-23
Topic: Automatic image-plus-dimensions to Blender to dashboard pipeline
Status: Approved design, pending implementation plan

## Goal

Automate the existing admin workflow so that when an admin uploads product images and enters manual dimensions, the system immediately starts Blender-based 3D generation, stores the generated GLB, and updates the dashboard item with live status and final model availability.

This design explicitly targets:

- Image upload plus manual dimensions
- Immediate generation after upload
- Dashboard-visible `processing`, `generated`, and `failed` states
- Retry support for failed jobs

This design does not attempt full photogrammetry or automatic 3D reconstruction from photos alone. The 3D model is generated from manual dimensions through a Blender Python script.

## Scope

In scope:

- Frontend upload flow updates
- Backend upload endpoint updates
- Background Blender job execution from the backend
- Persistent generation status on each dashboard item
- Generated model persistence and dashboard linkage
- Error reporting and retry behavior

Out of scope:

- Full photogrammetry pipeline
- Automatic dimension extraction from images
- Distributed worker queue
- Multi-tenant job orchestration
- Approval workflow before generation

## Existing Context

The current repository already contains the right starting points:

- Admin upload workflow in the frontend
- Backend workflow server with Blender-oriented scripts and docs
- GLB output storage under backend-controlled directories
- Dashboard data persisted in a JSON database

This design keeps that architecture and upgrades it from manual model generation to immediate automated generation.

## Recommended Approach

Use a single backend process with an in-process asynchronous job runner.

Why this approach:

- Fits the existing Node/Express backend structure
- Requires the fewest moving parts
- Supports fast implementation with current repo patterns
- Preserves a clean upgrade path to a dedicated worker later

Alternative approaches considered:

1. Separate worker process
   Better for scale and restart isolation, but unnecessary for first delivery.

2. External queue/orchestration service
   Better for large-scale job control, but adds operational complexity too early.

## User Flow

### Upload and Generate

1. Admin opens the dashboard upload screen.
2. Admin uploads one or more product images.
3. Admin enters required dimensions:
   - `frameWidth`
   - `bridgeWidth`
   - `templeLength`
4. Admin submits the form once.
5. Frontend sends a multipart request to the backend with images, metadata, and dimensions.
6. Backend creates a new glasses record with status `processing`.
7. Backend immediately launches Blender in background mode.
8. Blender generates and exports a GLB using the supplied dimensions.
9. Backend updates the record to:
   - `generated` if successful
   - `failed` if generation errors or times out
10. Dashboard shows the updated state and model link automatically.

### Failed Job Retry

1. Admin sees a dashboard item with status `failed`.
2. Admin clicks `Retry`.
3. Backend reuses the existing record, images, and dimensions unless the user edits them first.
4. Backend resets status to `processing` and relaunches Blender.
5. Dashboard updates when the retry succeeds or fails.

## Functional Requirements

### Frontend

The upload form must:

- Require at least one image
- Require dimensions before submission
- Submit all inputs in a single request
- Show the new item in the dashboard immediately after upload
- Display current generation state for each item
- Show failure reason when available
- Show retry action for failed items
- Show generated model preview or link when ready

### Backend

The backend must:

- Accept multipart uploads for images plus text fields
- Validate numeric dimensions before job creation
- Save uploaded images and thumbnails
- Create a database record immediately
- Launch Blender asynchronously without blocking the HTTP response
- Capture Blender exit code, stdout, and stderr
- Verify that the GLB file exists after Blender exits
- Persist status changes and error messages
- Expose generated files back to the dashboard
- Support retry for failed jobs

### Blender Runner

The generation command should follow the current script pattern:

```bash
blender --background --python scripts/glasses_parametric.py -- <frameWidth> <bridgeWidth> <templeLength> <itemId>
```

The runner must:

- Resolve Blender binary path
- Pass validated dimension arguments
- Enforce a timeout
- Mark the record failed if Blender is missing, exits non-zero, times out, or does not export the expected file

## Architecture

### Components

1. Upload endpoint
   Receives images, product metadata, and dimensions. Creates the initial item record.

2. Record persistence module
   Reads and writes the glasses database consistently. Owns status transitions and error field updates.

3. Blender job runner
   Spawns Blender, captures logs, enforces timeout, and resolves success or failure.

4. Generated asset storage
   Stores `output/<itemId>.glb` and any related preview assets. Makes the file available to the dashboard.

5. Dashboard status view
   Displays record state and allows retry for failed jobs.

### Status Model

The item lifecycle is:

- `processing`
- `generated`
- `failed`

Optional future states such as `queued`, `approved`, or `published` are intentionally excluded from this first version.

### Data Flow

1. Frontend posts upload request with images, metadata, and dimensions.
2. Backend validates input.
3. Backend saves files and creates record:
   - `status: processing`
   - stored dimensions
   - image paths
   - timestamps
4. Backend returns the new record to the frontend immediately.
5. Backend launches Blender in the background.
6. Blender exports `output/<itemId>.glb`.
7. Backend verifies export and updates the record:
   - on success: `status: generated`, `modelUrl`
   - on failure: `status: failed`, `generationError`
8. Frontend refreshes or polls for the latest record state.

## Data Model

The existing glasses record should be extended to include generation-specific fields:

```json
{
  "id": "abc-123",
  "brand": "Ray-Ban",
  "model": "Aviator",
  "status": "processing",
  "thumbnailUrl": "/thumbnails/abc-123.jpg",
  "sourceImages": [
    "/uploads/abc-123/front.jpg",
    "/uploads/abc-123/side.jpg"
  ],
  "dimensions": {
    "frameWidth": 140,
    "bridgeWidth": 20,
    "templeLength": 145
  },
  "modelUrl": null,
  "generationError": null,
  "uploadedAt": "2026-04-23T00:00:00.000Z",
  "generationStartedAt": "2026-04-23T00:00:01.000Z",
  "generationFinishedAt": null
}
```

On success:

- `status` becomes `generated`
- `modelUrl` is populated
- `generationError` is cleared
- `generationFinishedAt` is set

On failure:

- `status` becomes `failed`
- `generationError` stores a short admin-visible error message
- `generationFinishedAt` is set

## API Changes

### Upload Endpoint

The existing upload endpoint should be expanded so that one request handles:

- images
- product metadata
- dimensions

Expected behavior:

- returns the created record immediately
- does not wait for Blender completion before responding

Example response:

```json
{
  "success": true,
  "item": {
    "id": "abc-123",
    "status": "processing",
    "dimensions": {
      "frameWidth": 140,
      "bridgeWidth": 20,
      "templeLength": 145
    }
  }
}
```

### Retry Endpoint

Add a retry endpoint for failed items:

`POST /admin/retry-model/:id`

Expected behavior:

- only allowed when item status is `failed`
- resets relevant generation fields
- restarts Blender using stored dimensions and images

### Record Query

The dashboard needs a way to fetch current item state, either by:

- polling item detail endpoint
- reloading the list endpoint

For first implementation, reusing the existing list/detail fetch pattern is preferred.

## Error Handling

Validation failures should stop before record creation when the request is malformed.

Examples:

- missing images
- missing dimensions
- non-numeric dimensions
- out-of-range dimensions

Execution failures should create or preserve the item and mark it `failed`.

Examples:

- Blender binary not found
- Blender process exits non-zero
- timeout exceeded
- expected GLB file missing after exit
- filesystem write failure

Each failed item should retain:

- dimensions submitted
- original images
- short error message for admin display
- detailed server log output for debugging

## Non-Functional Requirements

### Reliability

- The HTTP request must return quickly after record creation.
- Generation work must continue asynchronously after response.
- Item status must always represent the last known job outcome.

### Maintainability

- Keep Blender execution isolated in a dedicated module.
- Keep database writes centralized to avoid inconsistent record state.
- Avoid coupling frontend upload code to Blender process details.

### Performance

- First version may process one job at a time or a small number concurrently.
- Long-running Blender jobs must not block other API requests.

### Security

- Validate uploaded file types and sizes.
- Sanitize file paths.
- Do not allow arbitrary script or command injection through dimensions or metadata.

## Testing Strategy

Minimum implementation verification:

1. Backend test: valid upload creates record with `processing`
2. Backend test: successful Blender run transitions `processing -> generated`
3. Backend test: failed Blender run transitions `processing -> failed`
4. Backend test: retry endpoint relaunches a failed job
5. Frontend verification: uploaded item appears immediately with `processing`
6. Frontend verification: generated item later shows model access
7. Frontend verification: failed item later shows retry control and error text

For local development, Blender execution should be mockable so status transitions can be tested without requiring real generation in every automated test run.

## Rollout Plan

Phase 1:

- Add required dimensions to upload form
- Extend backend record creation
- Integrate asynchronous Blender runner
- Update dashboard to show status and model links

Phase 2:

- Add retry flow
- Improve error visibility
- Add timeout and log capture polish

Phase 3:

- Optional queue extraction into a separate worker if concurrency or stability demands it

## Open Decisions Resolved

The following choices have already been fixed for this design:

- Input model: images plus manual dimensions
- Trigger timing: immediate generation after upload
- Failure handling: keep item visible with `processing` or `failed` status

## Implementation Boundary

This design is intentionally small enough for one implementation plan. It focuses on automating the existing upload-to-generation loop without redesigning the full product lifecycle.
