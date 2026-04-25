/**
 * Database Migration Script
 *
 * Reads glasses-database.json, runs normaliseDatabase() on all records to add
 * any missing generation fields, then writes the normalised data back to disk.
 *
 * Usage:
 *   node backend/scripts/migrate-database.mjs
 *   # or from the backend directory:
 *   node scripts/migrate-database.mjs
 *
 * The script is idempotent — running it multiple times is safe.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { normaliseRecord } from '../db-helpers.mjs';

// Resolve the database path relative to the backend directory regardless of
// where the script is invoked from.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, '..', 'glasses-database.json');

// ─────────────────────────────────────────────────────────────────────────────

function main() {
  if (!fs.existsSync(DB_PATH)) {
    console.error(`[migrate] Database file not found: ${DB_PATH}`);
    process.exit(1);
  }

  let database;
  try {
    database = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch (err) {
    console.error(`[migrate] Failed to parse database: ${err.message}`);
    process.exit(1);
  }

  if (!Array.isArray(database)) {
    console.error('[migrate] Database is not an array — aborting.');
    process.exit(1);
  }

  console.log(`[migrate] Loaded ${database.length} record(s) from ${DB_PATH}`);

  let migratedCount = 0;

  database.forEach((record, index) => {
    const before = JSON.stringify(record);
    normaliseRecord(record);
    const after = JSON.stringify(record);

    if (before !== after) {
      migratedCount++;
      console.log(`[migrate]   Record ${index + 1} (${record.id}): fields added/updated`);
    }
  });

  // Write back
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(database, null, 2));
  } catch (err) {
    console.error(`[migrate] Failed to write database: ${err.message}`);
    process.exit(1);
  }

  if (migratedCount === 0) {
    console.log('[migrate] All records already up to date — no changes needed.');
  } else {
    console.log(`[migrate] Migration complete: ${migratedCount} record(s) updated.`);
  }
}

main();
