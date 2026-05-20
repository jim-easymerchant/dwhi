/**
 * apps/workout/src/persistence
 *
 * Local SQLite persistence layer for the Workout RPG.
 *
 * Database file:    momentum.db   (separate from the DWHI pantry's dwhi.db)
 * Tables:           workout_set_memory, workout_player_momentum,
 *                   workout_quest_history, workout_personal_records
 * Cloud / sync:     NONE in this branch — no Supabase, no auth.
 *
 * The DWHI pantry app and this app deliberately use different
 * database files so storage lifecycles are independent.
 */

export {
  __clearDisabledForTests,
  __resetInitCacheForTests,
  __setSqliteModuleForTests,
  addColumnIfMissing,
  columnExists,
  createIndexIfColumnExists,
  disablePersistence,
  getDb,
  getPersistenceDisabledReason,
  initDatabase,
  isPersistenceDisabled,
  nowIso,
  resetDatabase,
} from './db';
export { WORKOUT_SCHEMA_STATEMENTS } from './schema';

export {
  __wipeSetMemoryForTests,
  loadAllSetMemory,
  saveSetMemory,
  type SetMemoryEntry as PersistedSetMemoryEntry,
  type SetMemoryRowKey,
} from './setMemoryRepository';

export {
  __wipePlayerMomentumForTests,
  loadPlayerMomentum,
  savePlayerMomentum,
  type PlayerMomentumRecord,
} from './playerMomentumRepository';

export {
  __wipeQuestHistoryForTests,
  appendQuestHistory,
  getMostRecentCompletedAtIso,
  listRecentQuests,
  loadTotalQuestXp,
  type QuestHistoryRecord,
} from './questHistoryRepository';

export {
  __wipePersonalRecordsForTests,
  candidateValues,
  getPersonalRecords,
  recordIfPersonalRecord,
  upsertPersonalRecord,
  type PRKind,
  type PRLookupKey,
  type PersonalRecord,
} from './personalRecordRepository';

export {
  __wipeThemeStoreForTests,
  loadStoredThemeId,
  loadStoredWeightUnit,
  saveStoredThemeId,
  saveStoredWeightUnit,
} from './themeRepository';
