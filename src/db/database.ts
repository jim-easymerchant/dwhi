import * as SQLite from 'expo-sqlite';
import { SCHEMA_STATEMENTS } from './schema';

const DB_NAME = 'dwhi.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
let initialized = false;

/**
 * Returns a shared database connection. The connection is opened lazily on
 * first call and reused for the lifetime of the app process.
 */
export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME);
  }
  return dbPromise;
}

/**
 * Runs the schema migrations. Safe to call multiple times — actual work only
 * happens on the first invocation in this process.
 */
export async function initDatabase(): Promise<void> {
  if (initialized) return;
  const db = await getDb();
  await db.execAsync('PRAGMA foreign_keys = ON;');
  for (const stmt of SCHEMA_STATEMENTS) {
    await db.execAsync(stmt);
  }
  initialized = true;
}

/**
 * Drops every table. Useful for the "Reset" affordance during the POC; not
 * used in production. Calling this also clears the cached init flag so a
 * subsequent initDatabase() call recreates the schema.
 */
export async function resetDatabase(): Promise<void> {
  const db = await getDb();
  await db.execAsync(`
    DROP TABLE IF EXISTS receipt_items;
    DROP TABLE IF EXISTS receipts;
    DROP TABLE IF EXISTS inventory_events;
    DROP TABLE IF EXISTS items;
  `);
  initialized = false;
  await initDatabase();
}

export function nowIso(): string {
  return new Date().toISOString();
}
