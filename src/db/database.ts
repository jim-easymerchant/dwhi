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

// ---------------------------------------------------------------------------
// Introspection helpers
// ---------------------------------------------------------------------------

/** Single-identifier guard so we can safely interpolate table/column names. */
const SAFE_IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

function assertSafeIdent(name: string, kind: 'table' | 'column' | 'index'): void {
  if (!SAFE_IDENT.test(name)) {
    throw new Error(`Unsafe ${kind} identifier: ${name}`);
  }
}

/**
 * Reads `PRAGMA table_info(table)` and reports whether the column exists.
 * Returns false if the table itself doesn't exist (PRAGMA returns no rows).
 */
export async function columnExists(
  table: string,
  column: string,
): Promise<boolean> {
  assertSafeIdent(table, 'table');
  assertSafeIdent(column, 'column');
  const db = await getDb();
  const rows = await db.getAllAsync<{ name: string }>(
    `PRAGMA table_info(${table});`,
  );
  return rows.some(r => r.name === column);
}

/**
 * Idempotent ALTER TABLE ADD COLUMN that PRAGMA-checks first instead of
 * relying on catching SQLite's "duplicate column" error string. Cleaner than
 * tryAddColumn and friendlier to whatever error formatting future SQLite
 * versions might pick.
 */
export async function addColumnIfMissing(
  table: string,
  column: string,
  type: string,
): Promise<void> {
  if (await columnExists(table, column)) return;
  assertSafeIdent(table, 'table');
  assertSafeIdent(column, 'column');
  const db = await getDb();
  // `type` is constrained at call sites to a small literal set (TEXT /
  // INTEGER / REAL); no untrusted input ever reaches here.
  await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${type};`);
}

/**
 * Creates an index only after confirming the underlying column exists. This
 * is the safety net the original migration was missing — a CREATE INDEX
 * fired in the same transaction as the schema, so an old DB without the
 * column rolled the whole thing back.
 */
export async function createIndexIfColumnExists(
  indexName: string,
  table: string,
  column: string,
): Promise<void> {
  if (!(await columnExists(table, column))) return;
  assertSafeIdent(indexName, 'index');
  assertSafeIdent(table, 'table');
  assertSafeIdent(column, 'column');
  const db = await getDb();
  await db.execAsync(
    `CREATE INDEX IF NOT EXISTS ${indexName} ON ${table}(${column});`,
  );
}

// ---------------------------------------------------------------------------
// Migration entry point
// ---------------------------------------------------------------------------

async function runInit(): Promise<void> {
  const db = await getDb();
  await db.execAsync('PRAGMA foreign_keys = ON;');

  // Phase 1: base CREATE TABLE / safe CREATE INDEX statements only.
  // No statement here may reference a column that an existing install lacks.
  await db.withTransactionAsync(async () => {
    for (const stmt of SCHEMA_STATEMENTS) {
      await db.execAsync(stmt);
    }
  });

  // Phase 2: additive column upgrades. Pre-history columns first; household
  // scope last. Each call is a no-op when the column already exists.
  await addColumnIfMissing('receipts', 'raw_ai_json', 'TEXT');
  await addColumnIfMissing('receipts', 'parse_source', 'TEXT');
  await addColumnIfMissing('items', 'barcode', 'TEXT');
  await addColumnIfMissing('items', 'source', 'TEXT');
  await addColumnIfMissing('items', 'raw_lookup_json', 'TEXT');

  await addColumnIfMissing('items', 'household_id', 'INTEGER');
  await addColumnIfMissing('inventory_events', 'household_id', 'INTEGER');
  await addColumnIfMissing('inventory_events', 'created_by_member_id', 'INTEGER');
  await addColumnIfMissing('inventory_events', 'created_by_device_id', 'INTEGER');
  await addColumnIfMissing('receipts', 'household_id', 'INTEGER');
  await addColumnIfMissing('receipts', 'created_by_member_id', 'INTEGER');
  await addColumnIfMissing('receipts', 'created_by_device_id', 'INTEGER');
  await addColumnIfMissing('receipt_items', 'household_id', 'INTEGER');
  await addColumnIfMissing('ask_history', 'household_id', 'INTEGER');
  await addColumnIfMissing('ask_history', 'created_by_member_id', 'INTEGER');
  await addColumnIfMissing('ask_history', 'created_by_device_id', 'INTEGER');
  await addColumnIfMissing('ask_feedback', 'household_id', 'INTEGER');
  await addColumnIfMissing('ask_feedback', 'created_by_member_id', 'INTEGER');
  await addColumnIfMissing('ask_feedback', 'created_by_device_id', 'INTEGER');

  // Remote-ID columns so a local household / member row can be associated
  // with its Supabase counterpart after an invite is accepted.
  await addColumnIfMissing('households', 'remote_id', 'TEXT');
  await addColumnIfMissing('household_members', 'remote_id', 'TEXT');
  await addColumnIfMissing('household_members', 'remote_user_id', 'TEXT');

  // Sync metadata. Strictly local-only today; populated by the cloud-sync
  // service in a future branch. The columns exist now so the schema is
  // stable across the local↔cloud transition.
  //
  //   remote_id       — UUID-shaped string assigned by Supabase
  //   sync_status     — 'pending' | 'synced' | 'error' (always 'pending'
  //                     locally until syncNow flips it)
  //   last_synced_at  — ISO timestamp of the last successful push/pull
  //   updated_at      — ISO timestamp; bumped on every local write
  //   deleted_at      — soft-delete tombstone for sync; null otherwise
  for (const table of [
    'items',
    'inventory_events',
    'receipts',
    'receipt_items',
    'ask_history',
    'ask_feedback',
  ]) {
    await addColumnIfMissing(table, 'remote_id', 'TEXT');
    await addColumnIfMissing(table, 'sync_status', 'TEXT');
    await addColumnIfMissing(table, 'last_synced_at', 'TEXT');
    await addColumnIfMissing(table, 'deleted_at', 'TEXT');
  }
  // `updated_at` already exists on items; add to the rest for parity.
  for (const table of [
    'inventory_events',
    'receipts',
    'receipt_items',
    'ask_history',
    'ask_feedback',
  ]) {
    await addColumnIfMissing(table, 'updated_at', 'TEXT');
  }

  // Phase 3: indexes that depend on the above columns. These were the
  // landmines on existing installs — see schema.ts header comment.
  await createIndexIfColumnExists('idx_items_barcode', 'items', 'barcode');
  await createIndexIfColumnExists(
    'idx_items_household_id',
    'items',
    'household_id',
  );
  await createIndexIfColumnExists(
    'idx_inventory_events_household_id',
    'inventory_events',
    'household_id',
  );
  await createIndexIfColumnExists(
    'idx_receipts_household_id',
    'receipts',
    'household_id',
  );
  await createIndexIfColumnExists(
    'idx_ask_history_household_id',
    'ask_history',
    'household_id',
  );
  await createIndexIfColumnExists(
    'idx_ask_feedback_household_id',
    'ask_feedback',
    'household_id',
  );
  // Sync-status indexes so "count pending" scans stay cheap once the table
  // has thousands of rows.
  for (const table of [
    'items',
    'inventory_events',
    'receipts',
    'receipt_items',
    'ask_history',
    'ask_feedback',
  ]) {
    await createIndexIfColumnExists(
      `idx_${table}_sync_status`,
      table,
      'sync_status',
    );
  }

  // location_events lives outside the additive ALTER TABLE list because
  // it's a brand-new table — CREATE TABLE IF NOT EXISTS in Phase 1 handles
  // both fresh + upgrade installs. Indexes still go via the helper so the
  // column-existence guard catches a half-created table cleanly.
  await createIndexIfColumnExists(
    'idx_location_events_household_id',
    'location_events',
    'household_id',
  );
  await createIndexIfColumnExists(
    'idx_location_events_captured_at',
    'location_events',
    'captured_at',
  );
  await createIndexIfColumnExists(
    'idx_location_events_sync_status',
    'location_events',
    'sync_status',
  );
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

/**
 * Test-only seam. Lets jest re-run `initDatabase()` from a clean slate
 * between test cases. NEVER call this from app code.
 */
export function __resetInitCacheForTests(): void {
  initPromise = null;
  dbPromise = null;
}
