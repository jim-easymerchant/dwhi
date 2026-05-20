/**
 * Workout-app SQLite handle + idempotent migration runner.
 *
 * Mirrors the patterns established in src/db/database.ts (the DWHI
 * pantry app's database module) — same column-existence guards,
 * same Phase-1-CREATE / Phase-2-ALTER / Phase-3-INDEX migration
 * shape — but opens a SEPARATE database file ("momentum.db") so the
 * two apps do not share storage.
 *
 * Defensive: once any path in this module fails (open, migrate, or
 * a runtime query), `persistenceDisabled` flips to true and every
 * subsequent `getDb()` rejects fast with a clean error instead of
 * hammering the native bridge. The bridge layer + store catch that
 * rejection and route the app into memory-only mode.
 *
 * No third-party dependencies. expo-sqlite is already a workspace
 * dep used by the pantry app.
 */

import * as SQLite from 'expo-sqlite';

import { WORKOUT_SCHEMA_STATEMENTS } from './schema';

const DB_NAME = 'momentum.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
let initPromise: Promise<void> | null = null;

// ---------------------------------------------------------------------------
// Disabled-mode latch.
//
// Once flipped, every getDb() call short-circuits with the captured
// reason. The latch is module-level (not per-call) so a failed init
// does not keep retrying the native bridge for every later write.
// ---------------------------------------------------------------------------

let persistenceDisabledReason: string | null = null;

export function isPersistenceDisabled(): boolean {
  return persistenceDisabledReason !== null;
}

export function getPersistenceDisabledReason(): string | null {
  return persistenceDisabledReason;
}

/**
 * Disable persistence for the rest of the process lifetime. Pure
 * function — does not touch the DB. Callers (init, repositories,
 * the bridge) flip this when they observe an unrecoverable error.
 */
export function disablePersistence(reason: string): void {
  if (persistenceDisabledReason === null) {
    persistenceDisabledReason = reason;
    // eslint-disable-next-line no-console
    console.warn('[workout.persistence] disabled:', reason);
  }
}

/** Test-only: lift the disabled latch. */
export function __clearDisabledForTests(): void {
  persistenceDisabledReason = null;
}

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------

/**
 * Shared connection. Opened lazily; cached for the process lifetime.
 *
 * If the open promise rejects, the cached entry is cleared AND
 * persistence is latched off. Subsequent callers reject quickly
 * with the captured reason instead of triggering another native
 * bridge call.
 */
export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (persistenceDisabledReason !== null) {
    return Promise.reject(
      new Error(`persistence disabled: ${persistenceDisabledReason}`),
    );
  }
  if (!dbPromise) {
    try {
      dbPromise = SQLite.openDatabaseAsync(DB_NAME).catch((err) => {
        dbPromise = null;
        const msg = err instanceof Error ? err.message : String(err);
        disablePersistence(`openDatabaseAsync failed: ${msg}`);
        throw err;
      });
    } catch (e) {
      // Defensive — openDatabaseAsync should always return a
      // Promise, but if the JS shim throws synchronously (e.g., on
      // a missing native module) we still want to latch off
      // cleanly.
      const msg = e instanceof Error ? e.message : String(e);
      disablePersistence(`openDatabaseAsync threw: ${msg}`);
      return Promise.reject(e instanceof Error ? e : new Error(msg));
    }
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
  // PRAGMA must run outside any transaction. expo-sqlite's
  // execAsync handles this fine.
  await db.execAsync('PRAGMA foreign_keys = ON;');

  await db.withTransactionAsync(async () => {
    for (const stmt of WORKOUT_SCHEMA_STATEMENTS) {
      await db.execAsync(stmt);
    }
  });

  // Additive indexes — kept outside Phase 1 so a partial old install
  // can't bring the whole CREATE TABLE block down with it. Each
  // helper guards against a missing column so a stale DB from an
  // earlier shape never breaks startup.
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

/**
 * Run the schema migrations. Concurrent callers share the same
 * promise so the schema only runs once even if multiple modules
 * fire it on mount. A failed init latches persistence off — every
 * later call resolves to a no-op rejected promise so the bridge can
 * branch cleanly.
 */
export function initDatabase(): Promise<void> {
  if (persistenceDisabledReason !== null) {
    return Promise.reject(
      new Error(`persistence disabled: ${persistenceDisabledReason}`),
    );
  }
  if (!initPromise) {
    initPromise = runInit().catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      disablePersistence(`initDatabase failed: ${msg}`);
      // Keep the cached rejection so concurrent awaiters get the
      // same answer.
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
  persistenceDisabledReason = null;
}
