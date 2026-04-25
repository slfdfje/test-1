/**
 * Backend Unit Tests
 * Uses Node.js built-in `node:test` and `node:assert` modules.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// ── Import helpers under test ─────────────────────────────────────────────────
import {
  normaliseRecord,
  normaliseDatabase,
  getJobsByStatus,
  updateGenerationStatus,
  setGenerationTimestamps,
} from '../db-helpers.mjs';

// ─────────────────────────────────────────────────────────────────────────────
// normaliseRecord
// ─────────────────────────────────────────────────────────────────────────────

describe('normaliseRecord', () => {
  test('adds default fields to a legacy record with no generation fields', () => {
    const record = {
      id: 'abc',
      brand: 'Ray-Ban',
      model: 'Aviator',
      status: 'approved',
      modelUrl: '/output/abc.glb',
    };

    normaliseRecord(record);

    assert.equal(record.generationStatus, 'generated', 'should default to generated when modelUrl is set');
    assert.equal(record.generationError, null);
    assert.equal(record.generationStartedAt, null);
    assert.equal(record.generationCompletedAt, null);
    assert.deepEqual(record.sourceImages, []);
  });

  test('defaults generationStatus to pending when no modelUrl', () => {
    const record = { id: 'xyz', brand: 'Test', model: 'Frame' };
    normaliseRecord(record);
    assert.equal(record.generationStatus, 'pending');
  });

  test('preserves existing generationStatus when already set', () => {
    const record = {
      id: 'def',
      generationStatus: 'failed',
      generationError: 'Blender not found',
      generationStartedAt: '2026-01-01T00:00:00.000Z',
      generationCompletedAt: '2026-01-01T00:05:00.000Z',
      sourceImages: ['/thumbnails/def_0.jpg'],
    };

    normaliseRecord(record);

    assert.equal(record.generationStatus, 'failed', 'should not overwrite existing generationStatus');
    assert.equal(record.generationError, 'Blender not found', 'should not overwrite existing generationError');
    assert.equal(record.generationStartedAt, '2026-01-01T00:00:00.000Z');
    assert.equal(record.generationCompletedAt, '2026-01-01T00:05:00.000Z');
    assert.deepEqual(record.sourceImages, ['/thumbnails/def_0.jpg']);
  });

  test('reconstructs dimensions from legacy measurements field', () => {
    const record = {
      id: 'ghi',
      measurements: { width: '140', bridge: '20', temple: '145' },
    };

    normaliseRecord(record);

    assert.deepEqual(record.dimensions, {
      frameWidth: 140,
      bridgeWidth: 20,
      templeLength: 145,
    });
  });

  test('sets dimensions to null when no measurements and no dimensions', () => {
    const record = { id: 'jkl' };
    normaliseRecord(record);
    assert.equal(record.dimensions, null);
  });

  test('preserves existing dimensions field', () => {
    const dims = { frameWidth: 130, bridgeWidth: 18, templeLength: 140 };
    const record = { id: 'mno', dimensions: dims };
    normaliseRecord(record);
    assert.deepEqual(record.dimensions, dims);
  });

  test('normaliseDatabase normalises all records in array', () => {
    const db = [
      { id: '1', modelUrl: '/output/1.glb' },
      { id: '2' },
    ];
    normaliseDatabase(db);
    assert.equal(db[0].generationStatus, 'generated');
    assert.equal(db[1].generationStatus, 'pending');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getJobsByStatus
// ─────────────────────────────────────────────────────────────────────────────

describe('getJobsByStatus', () => {
  const db = [
    { id: '1', generationStatus: 'processing' },
    { id: '2', generationStatus: 'generated' },
    { id: '3', generationStatus: 'failed' },
    { id: '4', generationStatus: 'processing' },
    { id: '5', generationStatus: 'generated' },
  ];

  test('returns only records matching the given status', () => {
    const processing = getJobsByStatus(db, 'processing');
    assert.equal(processing.length, 2);
    assert.ok(processing.every(r => r.generationStatus === 'processing'));
  });

  test('returns empty array when no records match', () => {
    const pending = getJobsByStatus(db, 'pending');
    assert.deepEqual(pending, []);
  });

  test('returns all generated records', () => {
    const generated = getJobsByStatus(db, 'generated');
    assert.equal(generated.length, 2);
  });

  test('does not mutate the original database array', () => {
    const original = db.map(r => ({ ...r }));
    getJobsByStatus(db, 'processing');
    assert.deepEqual(db, original);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// updateGenerationStatus
// ─────────────────────────────────────────────────────────────────────────────

describe('updateGenerationStatus', () => {
  function makeDb(overrides = {}) {
    return [{ id: 'test-id', generationStatus: 'processing', status: 'processing', ...overrides }];
  }

  test('valid transition: processing → generated', async () => {
    const db = makeDb();
    let saved = false;
    const save = () => { saved = true; };

    const result = await updateGenerationStatus(db, 'test-id', 'generated', null, save);

    assert.equal(result.generationStatus, 'generated');
    assert.equal(result.status, 'generated');
    assert.equal(result.generationError, null);
    assert.ok(saved, 'saveDatabase should have been called');
  });

  test('valid transition: processing → failed with error message', async () => {
    const db = makeDb();
    const save = () => {};

    const result = await updateGenerationStatus(db, 'test-id', 'failed', 'Blender not found', save);

    assert.equal(result.generationStatus, 'failed');
    assert.equal(result.generationError, 'Blender not found');
  });

  test('invalid transition logs warning but still updates', async () => {
    const db = makeDb({ generationStatus: 'generated' });
    const warnings = [];
    const origWarn = console.warn;
    console.warn = (...args) => warnings.push(args.join(' '));

    const result = await updateGenerationStatus(db, 'test-id', 'processing', null, () => {});

    console.warn = origWarn;

    // Should still update despite invalid transition
    assert.equal(result.generationStatus, 'processing');
    // Should have logged a warning
    assert.ok(warnings.some(w => w.includes('Invalid status transition')), 'should log a warning for invalid transition');
  });

  test('returns null when record not found', async () => {
    const db = makeDb();
    const result = await updateGenerationStatus(db, 'nonexistent', 'generated', null, () => {});
    assert.equal(result, null);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// setGenerationTimestamps
// ─────────────────────────────────────────────────────────────────────────────

describe('setGenerationTimestamps', () => {
  function makeDb(overrides = {}) {
    return [{
      id: 'ts-id',
      generationStartedAt: null,
      generationCompletedAt: null,
      ...overrides,
    }];
  }

  test('sets generationStartedAt when started is provided', async () => {
    const db = makeDb();
    const ts = '2026-01-01T10:00:00.000Z';
    const result = await setGenerationTimestamps(db, 'ts-id', ts, null, () => {});
    assert.equal(result.generationStartedAt, ts);
    assert.equal(result.generationCompletedAt, null);
  });

  test('sets generationCompletedAt when completed is provided', async () => {
    const db = makeDb({ generationStartedAt: '2026-01-01T10:00:00.000Z' });
    const ts = '2026-01-01T10:05:00.000Z';
    const result = await setGenerationTimestamps(db, 'ts-id', null, ts, () => {});
    assert.equal(result.generationStartedAt, '2026-01-01T10:00:00.000Z', 'started should be unchanged');
    assert.equal(result.generationCompletedAt, ts);
  });

  test('sets both timestamps when both are provided', async () => {
    const db = makeDb();
    const started = '2026-01-01T10:00:00.000Z';
    const completed = '2026-01-01T10:05:00.000Z';
    const result = await setGenerationTimestamps(db, 'ts-id', started, completed, () => {});
    assert.equal(result.generationStartedAt, started);
    assert.equal(result.generationCompletedAt, completed);
  });

  test('does not change timestamps when both are null', async () => {
    const db = makeDb({
      generationStartedAt: '2026-01-01T10:00:00.000Z',
      generationCompletedAt: '2026-01-01T10:05:00.000Z',
    });
    const result = await setGenerationTimestamps(db, 'ts-id', null, null, () => {});
    assert.equal(result.generationStartedAt, '2026-01-01T10:00:00.000Z');
    assert.equal(result.generationCompletedAt, '2026-01-01T10:05:00.000Z');
  });

  test('returns null when record not found', async () => {
    const db = makeDb();
    const result = await setGenerationTimestamps(db, 'missing', '2026-01-01T10:00:00.000Z', null, () => {});
    assert.equal(result, null);
  });

  test('calls saveDatabase after update', async () => {
    const db = makeDb();
    let saved = false;
    await setGenerationTimestamps(db, 'ts-id', '2026-01-01T10:00:00.000Z', null, () => { saved = true; });
    assert.ok(saved);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Upload endpoint validation logic (dimension range checks)
// ─────────────────────────────────────────────────────────────────────────────

describe('Upload validation logic', () => {
  /**
   * Mirrors the validation logic from admin-workflow-server.mjs
   * without requiring HTTP.
   */
  function validateDimensions({ frameWidth, bridgeWidth, templeLength }) {
    const width = parseFloat(frameWidth);
    const bridge = parseFloat(bridgeWidth);
    const temple = parseFloat(templeLength);
    const errors = [];

    if (!frameWidth || isNaN(width) || width < 100 || width > 180) {
      errors.push('Frame width must be between 100mm and 180mm');
    }
    if (!bridgeWidth || isNaN(bridge) || bridge < 10 || bridge > 30) {
      errors.push('Bridge width must be between 10mm and 30mm');
    }
    if (!templeLength || isNaN(temple) || temple < 120 || temple > 160) {
      errors.push('Temple length must be between 120mm and 160mm');
    }

    return errors;
  }

  test('valid dimensions produce no errors', () => {
    const errors = validateDimensions({ frameWidth: '140', bridgeWidth: '20', templeLength: '145' });
    assert.deepEqual(errors, []);
  });

  test('frameWidth below minimum (100) is rejected', () => {
    const errors = validateDimensions({ frameWidth: '99', bridgeWidth: '20', templeLength: '145' });
    assert.ok(errors.some(e => e.includes('Frame width')));
  });

  test('frameWidth above maximum (180) is rejected', () => {
    const errors = validateDimensions({ frameWidth: '181', bridgeWidth: '20', templeLength: '145' });
    assert.ok(errors.some(e => e.includes('Frame width')));
  });

  test('frameWidth at boundary values (100 and 180) is accepted', () => {
    assert.deepEqual(validateDimensions({ frameWidth: '100', bridgeWidth: '20', templeLength: '145' }), []);
    assert.deepEqual(validateDimensions({ frameWidth: '180', bridgeWidth: '20', templeLength: '145' }), []);
  });

  test('bridgeWidth below minimum (10) is rejected', () => {
    const errors = validateDimensions({ frameWidth: '140', bridgeWidth: '9', templeLength: '145' });
    assert.ok(errors.some(e => e.includes('Bridge width')));
  });

  test('bridgeWidth above maximum (30) is rejected', () => {
    const errors = validateDimensions({ frameWidth: '140', bridgeWidth: '31', templeLength: '145' });
    assert.ok(errors.some(e => e.includes('Bridge width')));
  });

  test('bridgeWidth at boundary values (10 and 30) is accepted', () => {
    assert.deepEqual(validateDimensions({ frameWidth: '140', bridgeWidth: '10', templeLength: '145' }), []);
    assert.deepEqual(validateDimensions({ frameWidth: '140', bridgeWidth: '30', templeLength: '145' }), []);
  });

  test('templeLength below minimum (120) is rejected', () => {
    const errors = validateDimensions({ frameWidth: '140', bridgeWidth: '20', templeLength: '119' });
    assert.ok(errors.some(e => e.includes('Temple length')));
  });

  test('templeLength above maximum (160) is rejected', () => {
    const errors = validateDimensions({ frameWidth: '140', bridgeWidth: '20', templeLength: '161' });
    assert.ok(errors.some(e => e.includes('Temple length')));
  });

  test('templeLength at boundary values (120 and 160) is accepted', () => {
    assert.deepEqual(validateDimensions({ frameWidth: '140', bridgeWidth: '20', templeLength: '120' }), []);
    assert.deepEqual(validateDimensions({ frameWidth: '140', bridgeWidth: '20', templeLength: '160' }), []);
  });

  test('missing dimensions produce errors', () => {
    const errors = validateDimensions({ frameWidth: '', bridgeWidth: '', templeLength: '' });
    assert.equal(errors.length, 3);
  });

  test('non-numeric dimensions produce errors', () => {
    const errors = validateDimensions({ frameWidth: 'abc', bridgeWidth: 'xyz', templeLength: 'foo' });
    assert.equal(errors.length, 3);
  });

  test('multiple invalid dimensions report all errors', () => {
    const errors = validateDimensions({ frameWidth: '50', bridgeWidth: '5', templeLength: '200' });
    assert.equal(errors.length, 3);
  });
});
