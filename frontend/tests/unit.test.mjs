/**
 * Frontend Unit Tests
 * Uses Node.js built-in `node:test` and `node:assert` modules.
 *
 * Tests the logic extracted from admin-workflow-automated.html:
 *  - Form validation (dimension range checks)
 *  - Status badge rendering (correct icons per status)
 *  - Polling mechanism (managePoll starts/stops correctly)
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// ─────────────────────────────────────────────────────────────────────────────
// Logic extracted from admin-workflow-automated.html
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates dimension inputs — mirrors the frontend validation in the submit
 * handler and the backend validation in admin-workflow-server.mjs.
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

/**
 * Returns the status icon for a given status — mirrors the statusIcons map
 * in buildGlassesCard() in admin-workflow-automated.html.
 */
function getStatusIcon(status) {
  const statusIcons = {
    processing: '\u23F3',   // ⏳
    generated:  '\u2713',   // ✓
    approved:   '\u2705',   // ✅
    failed:     '\u2717',   // ✗
  };
  return statusIcons[status] || '';
}

/**
 * Returns the CSS class for a status badge — mirrors the class names used in
 * buildGlassesCard().
 */
function getStatusClass(status) {
  const classes = {
    processing: 'status-processing',
    generated:  'status-generated',
    approved:   'status-approved',
    failed:     'status-failed',
  };
  return classes[status] || '';
}

/**
 * Minimal managePoll implementation that mirrors the logic in
 * admin-workflow-automated.html without requiring a real browser.
 */
function createPollManager() {
  let pollInterval = null;
  const log = [];

  function managePoll(shouldPoll) {
    if (shouldPoll && !pollInterval) {
      log.push('started');
      pollInterval = 'active'; // sentinel value (no real setInterval in tests)
    } else if (!shouldPoll && pollInterval) {
      log.push('stopped');
      pollInterval = null;
    }
  }

  return { managePoll, getLog: () => log, isPolling: () => pollInterval !== null };
}

// ─────────────────────────────────────────────────────────────────────────────
// Form validation
// ─────────────────────────────────────────────────────────────────────────────

describe('Form validation logic', () => {
  test('valid default dimensions produce no errors', () => {
    const errors = validateDimensions({ frameWidth: '140', bridgeWidth: '20', templeLength: '145' });
    assert.deepEqual(errors, []);
  });

  test('frameWidth below 100 is invalid', () => {
    const errors = validateDimensions({ frameWidth: '99', bridgeWidth: '20', templeLength: '145' });
    assert.ok(errors.some(e => e.includes('Frame width')));
  });

  test('frameWidth above 180 is invalid', () => {
    const errors = validateDimensions({ frameWidth: '181', bridgeWidth: '20', templeLength: '145' });
    assert.ok(errors.some(e => e.includes('Frame width')));
  });

  test('frameWidth at exact boundaries (100, 180) is valid', () => {
    assert.deepEqual(validateDimensions({ frameWidth: '100', bridgeWidth: '20', templeLength: '145' }), []);
    assert.deepEqual(validateDimensions({ frameWidth: '180', bridgeWidth: '20', templeLength: '145' }), []);
  });

  test('bridgeWidth below 10 is invalid', () => {
    const errors = validateDimensions({ frameWidth: '140', bridgeWidth: '9', templeLength: '145' });
    assert.ok(errors.some(e => e.includes('Bridge width')));
  });

  test('bridgeWidth above 30 is invalid', () => {
    const errors = validateDimensions({ frameWidth: '140', bridgeWidth: '31', templeLength: '145' });
    assert.ok(errors.some(e => e.includes('Bridge width')));
  });

  test('bridgeWidth at exact boundaries (10, 30) is valid', () => {
    assert.deepEqual(validateDimensions({ frameWidth: '140', bridgeWidth: '10', templeLength: '145' }), []);
    assert.deepEqual(validateDimensions({ frameWidth: '140', bridgeWidth: '30', templeLength: '145' }), []);
  });

  test('templeLength below 120 is invalid', () => {
    const errors = validateDimensions({ frameWidth: '140', bridgeWidth: '20', templeLength: '119' });
    assert.ok(errors.some(e => e.includes('Temple length')));
  });

  test('templeLength above 160 is invalid', () => {
    const errors = validateDimensions({ frameWidth: '140', bridgeWidth: '20', templeLength: '161' });
    assert.ok(errors.some(e => e.includes('Temple length')));
  });

  test('templeLength at exact boundaries (120, 160) is valid', () => {
    assert.deepEqual(validateDimensions({ frameWidth: '140', bridgeWidth: '20', templeLength: '120' }), []);
    assert.deepEqual(validateDimensions({ frameWidth: '140', bridgeWidth: '20', templeLength: '160' }), []);
  });

  test('all three dimensions invalid returns three errors', () => {
    const errors = validateDimensions({ frameWidth: '50', bridgeWidth: '5', templeLength: '200' });
    assert.equal(errors.length, 3);
  });

  test('empty strings are invalid', () => {
    const errors = validateDimensions({ frameWidth: '', bridgeWidth: '', templeLength: '' });
    assert.equal(errors.length, 3);
  });

  test('non-numeric values are invalid', () => {
    const errors = validateDimensions({ frameWidth: 'abc', bridgeWidth: 'xyz', templeLength: 'foo' });
    assert.equal(errors.length, 3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Status badge rendering
// ─────────────────────────────────────────────────────────────────────────────

describe('Status badge rendering', () => {
  test('processing status uses hourglass icon', () => {
    assert.equal(getStatusIcon('processing'), '\u23F3');
  });

  test('generated status uses checkmark icon', () => {
    assert.equal(getStatusIcon('generated'), '\u2713');
  });

  test('approved status uses green checkmark icon', () => {
    assert.equal(getStatusIcon('approved'), '\u2705');
  });

  test('failed status uses cross icon', () => {
    assert.equal(getStatusIcon('failed'), '\u2717');
  });

  test('unknown status returns empty string', () => {
    assert.equal(getStatusIcon('unknown'), '');
    assert.equal(getStatusIcon(''), '');
  });

  test('processing status uses status-processing CSS class', () => {
    assert.equal(getStatusClass('processing'), 'status-processing');
  });

  test('generated status uses status-generated CSS class', () => {
    assert.equal(getStatusClass('generated'), 'status-generated');
  });

  test('approved status uses status-approved CSS class', () => {
    assert.equal(getStatusClass('approved'), 'status-approved');
  });

  test('failed status uses status-failed CSS class', () => {
    assert.equal(getStatusClass('failed'), 'status-failed');
  });

  test('unknown status returns empty CSS class', () => {
    assert.equal(getStatusClass('unknown'), '');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Polling mechanism
// ─────────────────────────────────────────────────────────────────────────────

describe('Polling mechanism (managePoll)', () => {
  test('managePoll starts polling when shouldPoll is true and not already polling', () => {
    const { managePoll, isPolling, getLog } = createPollManager();
    managePoll(true);
    assert.ok(isPolling(), 'should be polling');
    assert.deepEqual(getLog(), ['started']);
  });

  test('managePoll does not start a second interval when already polling', () => {
    const { managePoll, getLog } = createPollManager();
    managePoll(true);
    managePoll(true); // second call should be a no-op
    assert.deepEqual(getLog(), ['started'], 'should only start once');
  });

  test('managePoll stops polling when shouldPoll is false and currently polling', () => {
    const { managePoll, isPolling, getLog } = createPollManager();
    managePoll(true);
    managePoll(false);
    assert.ok(!isPolling(), 'should not be polling');
    assert.deepEqual(getLog(), ['started', 'stopped']);
  });

  test('managePoll does nothing when shouldPoll is false and not polling', () => {
    const { managePoll, getLog } = createPollManager();
    managePoll(false); // no-op: not polling, told to stop
    assert.deepEqual(getLog(), []);
  });

  test('managePoll can restart after being stopped', () => {
    const { managePoll, isPolling, getLog } = createPollManager();
    managePoll(true);
    managePoll(false);
    managePoll(true);
    assert.ok(isPolling());
    assert.deepEqual(getLog(), ['started', 'stopped', 'started']);
  });

  test('polling starts when processing jobs exist', () => {
    const { managePoll, isPolling } = createPollManager();
    const glasses = [
      { status: 'generated' },
      { status: 'processing' },
    ];
    const hasProcessing = glasses.some(g => g.status === 'processing');
    managePoll(hasProcessing);
    assert.ok(isPolling());
  });

  test('polling stops when no processing jobs remain', () => {
    const { managePoll, isPolling } = createPollManager();
    managePoll(true); // start

    const glasses = [
      { status: 'generated' },
      { status: 'failed' },
    ];
    const hasProcessing = glasses.some(g => g.status === 'processing');
    managePoll(hasProcessing); // should stop
    assert.ok(!isPolling());
  });
});
