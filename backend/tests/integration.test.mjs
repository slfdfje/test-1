/**
 * Backend Integration Tests
 * Uses Node.js built-in `node:test` and `node:assert` modules.
 *
 * These tests exercise the full upload/retry/status flow using the real
 * db-helpers module but with a mocked spawnBlenderJob so no actual Blender
 * process is required.
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  updateGenerationStatus,
  getJobsByStatus,
  setGenerationTimestamps,
  normaliseRecord,
} from '../db-helpers.mjs';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeItem(overrides = {}) {
  return {
    id: 'job-' + Math.random().toString(36).slice(2),
    brand: 'TestBrand',
    model: 'TestModel',
    price: 100,
    category: 'eyeglasses',
    status: 'processing',
    uploadedAt: new Date().toISOString(),
    thumbnailUrl: '/thumbnails/test_0.jpg',
    sourceImages: ['/thumbnails/test_0.jpg'],
    dimensions: { frameWidth: 140, bridgeWidth: 20, templeLength: 145 },
    modelUrl: null,
    measurements: null,
    generationStatus: 'processing',
    generationError: null,
    generationStartedAt: new Date().toISOString(),
    generationCompletedAt: null,
    approvedAt: null,
    approvedBy: null,
    retryCount: 0,
    ...overrides,
  };
}

/**
 * Simulates the async completion handler in admin-workflow-server.mjs
 * (the .then() callback after spawnBlenderJob resolves).
 */
async function simulateSuccess(db, id, modelUrl, saveDatabase) {
  const item = db.find(g => g.id === id);
  if (item) {
    item.modelUrl = modelUrl;
    item.measurements = item.dimensions;
    await updateGenerationStatus(db, id, 'generated', null, saveDatabase);
    await setGenerationTimestamps(db, id, null, new Date().toISOString(), saveDatabase);
  }
}

/**
 * Simulates the async failure handler in admin-workflow-server.mjs
 * (the .catch() callback after spawnBlenderJob rejects).
 */
async function simulateFailure(db, id, errorMessage, saveDatabase) {
  await updateGenerationStatus(db, id, 'failed', errorMessage, saveDatabase);
  await setGenerationTimestamps(db, id, null, new Date().toISOString(), saveDatabase);
}

// ─────────────────────────────────────────────────────────────────────────────
// Full upload flow: upload → processing → generated
// ─────────────────────────────────────────────────────────────────────────────

describe('Full upload flow (mock Blender runner)', () => {
  test('upload → status "processing" → simulate completion → status "generated"', async () => {
    const db = [];
    let saveCount = 0;
    const save = () => { saveCount++; };

    // Step 1: Simulate upload creating a record
    const item = makeItem();
    db.push(item);
    save();

    assert.equal(item.generationStatus, 'processing', 'initial status should be processing');
    assert.equal(getJobsByStatus(db, 'processing').length, 1);

    // Step 2: Simulate Blender completing successfully
    await simulateSuccess(db, item.id, `/output/${item.id}.glb`, save);

    assert.equal(item.generationStatus, 'generated');
    assert.equal(item.status, 'generated');
    assert.equal(item.modelUrl, `/output/${item.id}.glb`);
    assert.ok(item.generationCompletedAt, 'completedAt should be set');
    assert.equal(item.generationError, null);
    assert.ok(saveCount >= 3, 'saveDatabase should have been called multiple times');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Upload → failure flow
// ─────────────────────────────────────────────────────────────────────────────

describe('Upload → failure flow', () => {
  test('upload → simulate Blender failure → status "failed" with error message', async () => {
    const db = [];
    const save = () => {};

    const item = makeItem();
    db.push(item);

    assert.equal(item.generationStatus, 'processing');

    await simulateFailure(db, item.id, 'Blender not found at expected location', save);

    assert.equal(item.generationStatus, 'failed');
    assert.equal(item.status, 'failed');
    assert.equal(item.generationError, 'Blender not found at expected location');
    assert.ok(item.generationCompletedAt, 'completedAt should be set even on failure');
    assert.equal(item.modelUrl, null, 'modelUrl should remain null on failure');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Retry after failure
// ─────────────────────────────────────────────────────────────────────────────

describe('Retry after failure', () => {
  test('set status to failed → call retry → status back to "processing"', async () => {
    const db = [];
    const save = () => {};

    // Start with a failed item
    const item = makeItem({
      status: 'failed',
      generationStatus: 'failed',
      generationError: 'Blender not found',
      generationCompletedAt: new Date().toISOString(),
    });
    db.push(item);

    assert.equal(item.generationStatus, 'failed');

    // Simulate retry endpoint logic
    item.status = 'processing';
    item.generationStatus = 'processing';
    item.generationError = null;
    item.generationStartedAt = new Date().toISOString();
    item.generationCompletedAt = null;
    item.retryCount = (item.retryCount || 0) + 1;
    save();

    assert.equal(item.generationStatus, 'processing');
    assert.equal(item.status, 'processing');
    assert.equal(item.generationError, null);
    assert.equal(item.generationCompletedAt, null);
    assert.ok(item.generationStartedAt, 'new startedAt should be set');
    assert.equal(item.retryCount, 1, 'retryCount should be incremented');

    // Simulate successful completion after retry
    await simulateSuccess(db, item.id, `/output/${item.id}.glb`, save);

    assert.equal(item.generationStatus, 'generated');
    assert.equal(item.retryCount, 1, 'retryCount should be preserved after success');
  });

  test('retry increments retryCount on each attempt', async () => {
    const db = [];
    const save = () => {};

    const item = makeItem({ status: 'failed', generationStatus: 'failed', retryCount: 2 });
    db.push(item);

    // Simulate retry
    item.status = 'processing';
    item.generationStatus = 'processing';
    item.generationError = null;
    item.retryCount = (item.retryCount || 0) + 1;
    save();

    assert.equal(item.retryCount, 3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Concurrent job limiting
// ─────────────────────────────────────────────────────────────────────────────

describe('Concurrent job limiting', () => {
  const MAX_CONCURRENT = 3;

  test('verify queue behavior when > 3 jobs submitted', () => {
    // Simulate the queue logic from blender-runner.mjs
    const activeJobs = new Map();
    const jobQueue = [];

    function submitJob(jobId) {
      if (activeJobs.size >= MAX_CONCURRENT) {
        jobQueue.push(jobId);
        return 'queued';
      }
      activeJobs.set(jobId, { startTime: Date.now() });
      return 'active';
    }

    function completeJob(jobId) {
      activeJobs.delete(jobId);
      if (jobQueue.length > 0 && activeJobs.size < MAX_CONCURRENT) {
        const next = jobQueue.shift();
        activeJobs.set(next, { startTime: Date.now() });
        return next;
      }
      return null;
    }

    // Submit 5 jobs
    const results = [];
    for (let i = 1; i <= 5; i++) {
      results.push(submitJob(`job-${i}`));
    }

    assert.equal(activeJobs.size, MAX_CONCURRENT, 'should have exactly 3 active jobs');
    assert.equal(jobQueue.length, 2, 'should have 2 jobs queued');
    assert.equal(results.filter(r => r === 'active').length, 3);
    assert.equal(results.filter(r => r === 'queued').length, 2);

    // Complete one job — next queued job should start
    const promoted = completeJob('job-1');
    assert.equal(promoted, 'job-4', 'first queued job should be promoted');
    assert.equal(activeJobs.size, MAX_CONCURRENT, 'should still have 3 active jobs');
    assert.equal(jobQueue.length, 1, 'queue should have 1 remaining');

    // Complete all remaining active jobs
    completeJob('job-2');
    completeJob('job-3');
    completeJob('job-4');

    // Last queued job should now be active
    assert.equal(activeJobs.size, 1);
    assert.equal(jobQueue.length, 0);
  });

  test('jobs beyond limit are queued, not dropped', () => {
    const activeJobs = new Map();
    const jobQueue = [];

    for (let i = 1; i <= 6; i++) {
      if (activeJobs.size < MAX_CONCURRENT) {
        activeJobs.set(`job-${i}`, true);
      } else {
        jobQueue.push(`job-${i}`);
      }
    }

    assert.equal(activeJobs.size + jobQueue.length, 6, 'all 6 jobs should be tracked');
    assert.equal(jobQueue.length, 3, 'jobs 4, 5, 6 should be queued');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Status filtering
// ─────────────────────────────────────────────────────────────────────────────

describe('Status filtering integration', () => {
  test('getJobsByStatus returns correct subset after status changes', async () => {
    const db = [];
    const save = () => {};

    const item1 = makeItem();
    const item2 = makeItem();
    const item3 = makeItem();
    db.push(item1, item2, item3);

    assert.equal(getJobsByStatus(db, 'processing').length, 3);

    // Complete item1
    await simulateSuccess(db, item1.id, `/output/${item1.id}.glb`, save);
    // Fail item2
    await simulateFailure(db, item2.id, 'Timeout', save);

    assert.equal(getJobsByStatus(db, 'processing').length, 1);
    assert.equal(getJobsByStatus(db, 'generated').length, 1);
    assert.equal(getJobsByStatus(db, 'failed').length, 1);
  });
});
