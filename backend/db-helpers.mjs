/**
 * Database helper functions for glasses generation status management.
 *
 * All functions accept the live database array and a saveDatabase callback
 * so they can be used from any server module without tight coupling.
 */

// ---------------------------------------------------------------------------
// Write-lock (simple async mutex / serial queue)
// ---------------------------------------------------------------------------

/**
 * A minimal async mutex that serialises concurrent write operations so that
 * two async callbacks cannot interleave their read-modify-write cycles on the
 * shared database array.
 */
class AsyncMutex {
  constructor() {
    this._queue = [];
    this._locked = false;
  }

  /**
   * Acquire the lock, run `fn`, then release.
   * @param {() => Promise<any>} fn
   * @returns {Promise<any>}
   */
  async run(fn) {
    return new Promise((resolve, reject) => {
      this._queue.push({ fn, resolve, reject });
      this._drain();
    });
  }

  async _drain() {
    if (this._locked || this._queue.length === 0) return;
    this._locked = true;
    const { fn, resolve, reject } = this._queue.shift();
    try {
      resolve(await fn());
    } catch (err) {
      reject(err);
    } finally {
      this._locked = false;
      this._drain();
    }
  }
}

/** Shared write lock – one instance per process. */
export const dbMutex = new AsyncMutex();

// ---------------------------------------------------------------------------
// Valid status transitions
// ---------------------------------------------------------------------------

/**
 * Only these transitions are considered valid.
 * Anything else is logged as a warning but NOT thrown.
 */
const VALID_TRANSITIONS = new Map([
  ['processing', new Set(['generated', 'failed'])],
]);

/**
 * Returns true when the transition from `from` → `to` is allowed.
 * Records that have no prior generationStatus (e.g. legacy records) are
 * treated as if they were in 'generated' state and any update is allowed.
 */
function isValidTransition(from, to) {
  if (!from) return true; // legacy / no prior status
  const allowed = VALID_TRANSITIONS.get(from);
  return allowed ? allowed.has(to) : false;
}

// ---------------------------------------------------------------------------
// Helper: find record by id
// ---------------------------------------------------------------------------

function findRecord(database, id) {
  return database.find((g) => g.id === id) || null;
}

// ---------------------------------------------------------------------------
// Exported helper functions
// ---------------------------------------------------------------------------

/**
 * Update the generationStatus (and optionally generationError) of a record.
 *
 * Only the transitions processing→generated and processing→failed are
 * considered valid.  Invalid transitions are logged as warnings but the
 * update is still applied so callers are never silently blocked.
 *
 * @param {object[]} database   - Live database array (mutated in place)
 * @param {string}   id         - Record id
 * @param {string}   status     - New generationStatus value
 * @param {string|null} [error] - Error message (set to null to clear)
 * @param {() => void} saveDatabase - Callback that persists the database
 * @returns {Promise<object|null>} Updated record, or null if not found
 */
export async function updateGenerationStatus(database, id, status, error = null, saveDatabase) {
  return dbMutex.run(async () => {
    const item = findRecord(database, id);
    if (!item) {
      console.warn(`[db-helpers] updateGenerationStatus: record ${id} not found`);
      return null;
    }

    const from = item.generationStatus;
    if (!isValidTransition(from, status)) {
      console.warn(
        `[db-helpers] Invalid status transition for ${id}: ${from} → ${status}. ` +
        `Allowed transitions from '${from}': ${[...(VALID_TRANSITIONS.get(from) || [])].join(', ') || 'none'}`
      );
    }

    item.generationStatus = status;
    item.generationError = error;

    // Keep the top-level `status` field in sync for backward compatibility
    if (status === 'generated' || status === 'failed' || status === 'processing') {
      item.status = status;
    }

    saveDatabase();
    return item;
  });
}

/**
 * Return all records whose generationStatus matches `status`.
 *
 * This is a pure read – no lock needed.
 *
 * @param {object[]} database
 * @param {string}   status
 * @returns {object[]}
 */
export function getJobsByStatus(database, status) {
  return database.filter((g) => g.generationStatus === status);
}

/**
 * Set generationStartedAt and/or generationCompletedAt on a record.
 *
 * Pass `null` to leave a field unchanged; pass an ISO string (or
 * `new Date().toISOString()`) to set it.
 *
 * @param {object[]} database
 * @param {string}   id
 * @param {string|null} [started]   - ISO timestamp or null
 * @param {string|null} [completed] - ISO timestamp or null
 * @param {() => void} saveDatabase
 * @returns {Promise<object|null>}
 */
export async function setGenerationTimestamps(database, id, started = null, completed = null, saveDatabase) {
  return dbMutex.run(async () => {
    const item = findRecord(database, id);
    if (!item) {
      console.warn(`[db-helpers] setGenerationTimestamps: record ${id} not found`);
      return null;
    }

    if (started !== null) item.generationStartedAt = started;
    if (completed !== null) item.generationCompletedAt = completed;

    saveDatabase();
    return item;
  });
}

// ---------------------------------------------------------------------------
// Backward-compatibility normalisation
// ---------------------------------------------------------------------------

/**
 * Normalise a single legacy record so it always has the new generation fields.
 *
 * Rules:
 *  - If the record already has `generationStatus`, leave it alone.
 *  - If `modelUrl` is set, default generationStatus to 'generated'.
 *  - Otherwise default to 'pending' (uploaded but no model yet).
 *  - All other new fields default to null if absent.
 *
 * @param {object} record - Mutated in place
 * @returns {object} The same record (for chaining)
 */
export function normaliseRecord(record) {
  if (!('generationStatus' in record)) {
    record.generationStatus = record.modelUrl ? 'generated' : 'pending';
  }
  if (!('generationError' in record)) {
    record.generationError = null;
  }
  if (!('generationStartedAt' in record)) {
    record.generationStartedAt = null;
  }
  if (!('generationCompletedAt' in record)) {
    record.generationCompletedAt = null;
  }
  if (!('dimensions' in record)) {
    // Try to reconstruct from legacy `measurements` field if present
    if (record.measurements) {
      const m = record.measurements;
      record.dimensions = {
        frameWidth: parseFloat(m.width || m.frameWidth) || null,
        bridgeWidth: parseFloat(m.bridge || m.bridgeWidth) || null,
        templeLength: parseFloat(m.temple || m.templeLength) || null,
      };
    } else {
      record.dimensions = null;
    }
  }
  if (!('sourceImages' in record)) {
    record.sourceImages = [];
  }
  return record;
}

/**
 * Normalise every record in the database array in place.
 *
 * Call this once after loading the JSON file so the rest of the server can
 * assume all records have the full schema.
 *
 * @param {object[]} database - Mutated in place
 * @returns {object[]} The same array (for chaining)
 */
export function normaliseDatabase(database) {
  database.forEach(normaliseRecord);
  return database;
}
