import * as SQLite from 'expo-sqlite';
import { SCHEMA_STATEMENTS } from './schema';

const DB_NAME = 'dwhi.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
let initPromise: Promise<void> | null = null;

/**
 * Returns a shared database connection. The connection is opened lazily on
 * first call and reused for the lifetime of the app process.
 */
export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME).catch(err => {
      // Reset the cache so the next caller can retry from scratch.
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}

async function runInit(): Promise<void> {
  const db = await getDb();
  await db.execAsync('PRAGMA foreign_keys = ON;');
  // Run the schema in a transaction so a partial failure leaves the DB
  // exactly as it was instead of in a half-migrated state.
  await db.withTransactionAsync(async () => {
    for (const stmt of SCHEMA_STATEMENTS) {
      await db.execAsync(stmt);
    }
  });
  // Additive column upgrades for installs created against an older schema.
  // SQLite has no "ADD COLUMN IF NOT EXISTS", so we attempt and swallow the
  // "duplicate column" error.
  await tryAddColumn('receipts', 'raw_ai_json', 'TEXT');
  await tryAddColumn('receipts', 'parse_source', 'TEXT');
  await tryAddColumn('items', 'barcode', 'TEXT');
  await tryAddColumn('items', 'source', 'TEXT');
  await tryAddColumn('items', 'raw_lookup_json', 'TEXT');
  // Index is idempotent via IF NOT EXISTS — safe to re-run.
  await db.execAsync(
    'CREATE INDEX IF NOT EXISTS idx_items_barcode ON items(barcode);',
  );
}

async function tryAddColumn(table: string, column: string, type: string): Promise<void> {
  const db = await getDb();
  try {
    await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${type};`);
  } catch (err) {
    const message = err instanceof Error ? err.message.toLowerCase() : String(err);
    if (message.includes('duplicate column')) return;
    throw err;
  }
}

/**
 * Runs the schema migrations. Concurrent callers share the same promise so
 * the schema only runs once even if multiple screens fire it on mount.
 */
export function initDatabase(): Promise<void> {
  if (!initPromise) {
    initPromise = runInit().catch(err => {
      // Drop the cached promise so a retry can rerun cleanly.
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}

/**
 * Drops every table. Useful for the "Reset" affordance during the POC; not
 * used in production. Also clears the cached init promise so a subsequent
 * initDatabase() call recreates the schema.
 */
export async function resetDatabase(): Promise<void> {
  const db = await getDb();
  await db.execAsync(`
    DROP TABLE IF EXISTS receipt_items;
    DROP TABLE IF EXISTS receipts;
    DROP TABLE IF EXISTS inventory_events;
    DROP TABLE IF EXISTS items;
  `);
  initPromise = null;
  await initDatabase();
}

export function nowIso(): string {
  return new Date().toISOString();
}
