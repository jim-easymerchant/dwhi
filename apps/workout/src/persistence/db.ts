/**
 * Workout-app SQLite handle + idempotent migration runner.
 *
 * Mirrors the patterns established in src/db/database.ts (the DWHI
 * pantry app's database module) — same column-existence guards,
 * same Phase-1-CREATE / Phase-2-ALTER / Phase-3-INDEX migration
 * shape — but opens a SEPARATE database file ("momentum.db") so the
 * two apps do not share storage.
 *
 * No third-party dependencies. expo-sqlite is already a workspace
 * dep used by the pantry app.
 */

import * as SQLite from 'expo-sqlite';

import { WORKOUT_SCHEMA_STATEMENTS } from './schema';

const DB_NAME = 'momentum.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
let initPromise: Promise<void> | null = null;

/** Shared connection. Opened lazily; cached for the process lifetime. */
export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME).catch((err) => {
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}

// ---------------------------------------------------------------------------
// Introspection helpers — identical to framework/db, duplicated here so the
// workout app stays decoupled from the pantry app's database lifecycle.
// ---------------------------------------------------------------------------

const SAFE_IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
function assertSafeIdent(name: string, kind: 'table' | 'column' | 'index'): void {
  if (!SAFE_IDENT.test(name)) {
    throw new Error(`Unsafe ${kind} identifier: ${name}`);
  }
}

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
  return rows.some((r) => r.name === column);
}

export async function addColumnIfMissing(
  table: string,
  column: string,
  type: string,
): Promise<void> {
  if (await columnExists(table, column)) return;
  assertSafeIdent(table, 'table');
  assertSafeIdent(column, 'column');
  const db = await getDb();
  await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${type};`);
}

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

  await db.withTransactionAsync(async () => {
    for (const stmt of WORKOUT_SCHEMA_STATEMENTS) {
      await db.execAsync(stmt);
    }
  });

  // Additive indexes — kept outside Phase 1 so a partial old install
  // can't bring the whole CREATE TABLE block down with it.
  await createIndexIfColumnExists(
    'idx_workout_set_memory_exercise',
    'workout_set_memory',
    'exercise_id',
  );
  await createIndexIfColumnExists(
    'idx_workout_quest_history_completed',
    'workout_quest_history',
    'completed_at_iso',
  );
  await createIndexIfColumnExists(
    'idx_workout_personal_records_exercise',
    'workout_personal_records',
    'exercise_id',
  );
}

export function initDatabase(): Promise<void> {
  if (!initPromise) {
    initPromise = runInit().catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}

export async function resetDatabase(): Promise<void> {
  const db = await getDb();
  await db.execAsync(`
    DROP TABLE IF EXISTS workout_set_memory;
    DROP TABLE IF EXISTS workout_player_momentum;
    DROP TABLE IF EXISTS workout_quest_history;
    DROP TABLE IF EXISTS workout_personal_records;
  `);
  initPromise = null;
  await initDatabase();
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Test-only: drop the cached init promise so a fresh test starts cleanly. */
export function __resetInitCacheForTests(): void {
  initPromise = null;
  dbPromise = null;
}
