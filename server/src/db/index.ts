import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const DB_PATH = path.join(dataDir, 'pos_coffee.db');

export let db = new DatabaseSync(DB_PATH);

// Configure SQLite for high performance and durability
export function initDbPragmas(database: DatabaseSync = db) {
  database.exec('PRAGMA journal_mode = WAL;');
  database.exec('PRAGMA foreign_keys = ON;');
  database.exec('PRAGMA busy_timeout = 5000;');
  database.exec('PRAGMA synchronous = NORMAL;');
}

initDbPragmas();

/**
 * Execute a function within a strict database transaction.
 * If an error occurs, automatically rolls back and rethrows.
 */
export function runTransaction<T>(fn: () => T): T {
  db.exec('BEGIN IMMEDIATE TRANSACTION;');
  try {
    const result = fn();
    db.exec('COMMIT;');
    return result;
  } catch (err) {
    try {
      db.exec('ROLLBACK;');
    } catch (rbErr) {
      console.error('Error during rollback:', rbErr);
    }
    throw err;
  }
}

/**
 * Helper to reload DB instance (e.g. after a restore)
 */
export function reloadDatabase(newPath?: string) {
  try {
    db.close();
  } catch (e) {
    // ignore
  }
  db = new DatabaseSync(newPath || DB_PATH);
  initDbPragmas(db);
}

