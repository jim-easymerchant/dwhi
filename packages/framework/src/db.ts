/**
 * Database connection + idempotent-migration helpers.
 *
 * NOTE: The actual SCHEMA_STATEMENTS that database.ts currently runs
 * still live in src/db/schema.ts and mix framework tables (households,
 * household_members, devices, app_prefs, location_events) with DWHI
 * tables (items, inventory_events, receipts, …). Splitting the schema
 * into framework + per-app contributions is a follow-up — see
 * MONOREPO.md "Known follow-ups".
 *
 * For now `getDb()`, `initDatabase()`, and the column/index helpers
 * are exported as-is because they are genuinely reusable.
 */
export {
  __resetInitCacheForTests,
  addColumnIfMissing,
  columnExists,
  createIndexIfColumnExists,
  getDb,
  initDatabase,
  nowIso,
  resetDatabase,
} from '@/db/database';
