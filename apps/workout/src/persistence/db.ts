/**
 * Workout-app SQLite handle + idempotent migration runner.
 *
 * Mirrors the patterns established in src/db/database.ts (the DWHI
 * pantry app's database module) — same column-existence guards,
 * same Phase-1-CREATE / Phase-2-ALTER / Phase-3-INDEX migration
 * shape — but opens a SEPARATE database file ("momentum.db") so the
 * two apps do not share storage.
 *
 * STARTUP-CRASH HARDENING
 * =======================
 *
 * `expo-sqlite` is NOT imported statically anywhere in this file.
 * The native module is loaded the FIRST time `getDb()` is called,
 * via `require('expo-sqlite')` wrapped in try/catch + feature
 * detection. Reasons:
 *
 *   1. A static `import * as SQLite from 'expo-sqlite'` at the top
 *      of this module pulls the native bridge into every consumer
 *      via Metro's static analysis. Even though the persistence
 *      bridge is now lazy-required from `_layout.tsx`, the bridge
 *      module's own top-level `import` of `'../persistence'` would
 *      transitively still evaluate `expo-sqlite` synchronously at
 *      load time — which crashed on devices where the native
 *      bridge / API surface didn't match.
 *
 *   2. Newer Expo SDKs ship `openDatabaseAsync`; some prebuild
 *      configurations expose only the legacy `openDatabase`. We
 *      feature-detect the API surface and call
 *      `disablePersistence(reason)` cleanly when anything we need
 *      is missing.
 *
 *   3. If `require('expo-sqlite')` itself throws (native module
 *      unavailable, Hermes vs JSC mismatch, …), we catch and
 *      degrade gracefully — never crash.
 *
 * Once any path fails, `persistenceDisabled` flips true and every
 * subsequent `getDb()` rejects fast with the captured reason. The
 * bridge layer + store catch that rejection and route the app into
 * memory-only mode. The dev-only Home-screen banner surfaces the
 * exact reason for the failure.
 */

import { WORKOUT_SCHEMA_STATEMENTS } from './schema';

const DB_NAME = 'momentum.db';

// ---------------------------------------------------------------------------
// Structural types — the small subset of expo-sqlite's API we use.
// Declared inline (not imported) so this module has zero static
// `expo-sqlite` dependency.
// ---------------------------------------------------------------------------

interface SQLiteDatabaseHandle {
  execAsync(sql: string): Promise<void>;
  runAsync(
    sql: string,
    params?: readonly unknown[],
  ): Promise<{ lastInsertRowId: number; changes: number }>;
  getFirstAsync<T = unknown>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<T | null>;
  getAllAsync<T = unknown>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<T[]>;
  withTransactionAsync(fn: () => Promise<void>): Promise<void>;
}

interface SQLiteModuleShape {
  openDatabaseAsync(name: string): Promise<SQLiteDatabaseHandle>;
}

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

let dbPromise: Promise<SQLiteDatabaseHandle> | null = null;
let initPromise: Promise<void> | null = null;
let persistenceDisabledReason: string | null = null;

// Test-injection seam — see __setSqliteModuleForTests below.
let injectedSqliteModule: SQLiteModuleShape | null = null;

// ---------------------------------------------------------------------------
// Disabled-mode latch.
// ---------------------------------------------------------------------------

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

/**
 * Test-only: inject a fake expo-sqlite module so the lazy require
 * doesn't actually call into the native bridge under Jest. Setting
 * to `null` restores the real-require path.
 */
export function __setSqliteModuleForTests(
  mod: SQLiteModuleShape | null,
): void {
  injectedSqliteModule = mod;
}

// ---------------------------------------------------------------------------
// Lazy require + feature detection
// ---------------------------------------------------------------------------

/**
 * Lazily load `expo-sqlite` the first time we need it. Returns a
 * minimal shape so the rest of this module never types against
 * `expo-sqlite`'s public exports.
 *
 * Returns `{ ok: false, reason }` when the module is unavailable
 * or its API surface doesn't include what we need; the caller
 * (getDb) translates that into `disablePersistence(reason)` + a
 * rejected Promise.
 */
function loadSqlite(): { ok: true; mod: SQLiteModuleShape } | { ok: false; reason: string } {
  if (injectedSqliteModule !== null) {
    return featureDetect(injectedSqliteModule);
  }
  let mod: unknown;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
    mod = require('expo-sqlite');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, reason: `expo-sqlite require failed: ${msg}` };
  }
  if (mod === null || typeof mod !== 'object') {
    return { ok: false, reason: 'expo-sqlite exported a non-object' };
  }
  return featureDetect(mod as SQLiteModuleShape);
}

function featureDetect(
  candidate: unknown,
): { ok: true; mod: SQLiteModuleShape } | { ok: false; reason: string } {
  if (candidate === null || typeof candidate !== 'object') {
    return { ok: false, reason: 'expo-sqlite module is not an object' };
  }
  const m = candidate as Record<string, unknown>;
  if (typeof m.openDatabaseAsync !== 'function') {
    return {
      ok: false,
      reason:
        'expo-sqlite.openDatabaseAsync is not a function in this build — ' +
        'this SDK / native bridge does not expose the async API we need',
    };
  }
  return { ok: true, mod: m as unknown as SQLiteModuleShape };
}

function featureDetectDb(
  candidate: unknown,
): { ok: true; db: SQLiteDatabaseHandle } | { ok: false; reason: string } {
  if (candidate === null || typeof candidate !== 'object') {
    return { ok: false, reason: 'openDatabaseAsync did not return an object' };
  }
  const d = candidate as Record<string, unknown>;
  for (const method of [
    'execAsync',
    'runAsync',
    'getFirstAsync',
    'getAllAsync',
    'withTransactionAsync',
  ] as const) {
    if (typeof d[method] !== 'function') {
      return {
        ok: false,
        reason: `SQLiteDatabase.${method} is not a function in this build`,
      };
    }
  }
  return { ok: true, db: d as unknown as SQLiteDatabaseHandle };
}

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------

/**
 * Shared connection. Opened lazily on first call; cached for the
 * process lifetime.
 *
 * Every failure mode here flips `persistenceDisabled` so subsequent
 * calls reject fast with the captured reason — we never hammer the
 * native bridge after a known-bad open.
 */
export function getDb(): Promise<SQLiteDatabaseHandle> {
  if (persistenceDisabledReason !== null) {
    return Promise.reject(
      new Error(`persistence disabled: ${persistenceDisabledReason}`),
    );
  }
  if (!dbPromise) {
    const loaded = loadSqlite();
    if (!loaded.ok) {
      disablePersistence(loaded.reason);
      return Promise.reject(new Error(loaded.reason));
    }
    try {
      dbPromise = loaded.mod
        .openDatabaseAsync(DB_NAME)
        .then((rawDb): SQLiteDatabaseHandle => {
          const detected = featureDetectDb(rawDb);
          if (!detected.ok) {
            disablePersistence(detected.reason);
            throw new Error(detected.reason);
          }
          return detected.db;
        })
        .catch((err) => {
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
  await db.execAsync('PRAGMA foreign_keys = ON;');

  await db.withTransactionAsync(async () => {
    for (const stmt of WORKOUT_SCHEMA_STATEMENTS) {
      await db.execAsync(stmt);
    }
  });

  // Additive column: weight_unit on workout_settings. Added in the
  // product-parity branch (021). Older installs that already have
  // the workout_settings row carry it forward without breakage.
  await addColumnIfMissing('workout_settings', 'weight_unit', 'TEXT');
  // Additive column: workout_template_id (branch 025). Older
  // installs default to NULL → bridge falls back to 'push-day'.
  await addColumnIfMissing('workout_settings', 'workout_template_id', 'TEXT');

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
  injectedSqliteModule = null;
}
