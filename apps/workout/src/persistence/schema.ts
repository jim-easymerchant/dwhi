/**
 * Workout RPG / Momentum — local SQLite schema (Phase 1 statements).
 *
 * Every statement is idempotent (`CREATE TABLE IF NOT EXISTS`,
 * `CREATE INDEX IF NOT EXISTS`). New columns added in later branches
 * must use `addColumnIfMissing()` from db.ts — DO NOT add them here,
 * or existing installs will fail to upgrade.
 *
 * Tables intentionally prefixed `workout_` to keep a clean namespace
 * even though this database is workout-only — leaves room for a
 * future "shared household" layer to land alongside without
 * collisions.
 */

export const WORKOUT_SCHEMA_STATEMENTS = [
  // -----------------------------------------------------------------------
  // workout_set_memory
  //
  // Per-(exercise, modality, variant, setIndex) snapshot of the last
  // logged values. Drives the open-ended Battle screen's draft
  // prefill — see docs/workout-rpg/014-open-ended-encounters-and-set-memory.md.
  //
  // Composite primary key collapses the four-tuple into a single row;
  // any new log for the same tuple OVERWRITES the previous value.
  // -----------------------------------------------------------------------
  `CREATE TABLE IF NOT EXISTS workout_set_memory (
    exercise_id      TEXT NOT NULL,
    modality         TEXT NOT NULL,
    variant_id       TEXT NOT NULL,
    set_index        INTEGER NOT NULL,
    reps             INTEGER,
    weight_kg        REAL,
    duration_seconds INTEGER,
    recorded_at_iso  TEXT NOT NULL,
    PRIMARY KEY (exercise_id, modality, variant_id, set_index)
  );`,

  // -----------------------------------------------------------------------
  // workout_player_momentum
  //
  // Single-row table (id = 'default'). Holds the Momentum value the
  // shell hydrates on launch, the timestamp of the most recent
  // completed Quest (drives "days since last quest"), and the
  // gentle-mode window if any.
  //
  // The orchestrator owns the formulas (decay, gain). The shell
  // persists the *result*; on next launch it loads → recomputes
  // decay since `last_session_at_iso` → seeds priorMomentum.
  // -----------------------------------------------------------------------
  `CREATE TABLE IF NOT EXISTS workout_player_momentum (
    id                       TEXT PRIMARY KEY,
    value                    REAL NOT NULL,
    last_session_at_iso      TEXT,
    last_return_bonus_at_iso TEXT,
    gentle_mode_until_iso    TEXT,
    updated_at_iso           TEXT NOT NULL
  );`,

  // -----------------------------------------------------------------------
  // workout_quest_history
  //
  // One row per *completed* Quest. The full orchestrator result is
  // stored as JSON in `payload_json` for the (future) journal screen;
  // the denormalised summary columns above it are what the home
  // screen and "days since last quest" computation need.
  // -----------------------------------------------------------------------
  `CREATE TABLE IF NOT EXISTS workout_quest_history (
    id                  TEXT PRIMARY KEY,
    template_id         TEXT,
    kind                TEXT NOT NULL,
    started_at_iso      TEXT,
    completed_at_iso    TEXT NOT NULL,
    working_set_count   INTEGER NOT NULL,
    total_damage        REAL NOT NULL,
    xp                  INTEGER NOT NULL,
    momentum_delta      REAL NOT NULL,
    defeated_count      INTEGER NOT NULL,
    primary_verdict     TEXT,
    payload_json        TEXT
  );`,

  // -----------------------------------------------------------------------
  // workout_personal_records
  //
  // Cross-Quest PR tracking. Keyed by (exercise, modality, variant,
  // kind). `kind` is 'rep' | 'weight' | 'volume'. The shell's
  // PR-detection code reads this table at attack time to decide
  // whether the current set is a true PR.
  // -----------------------------------------------------------------------
  `CREATE TABLE IF NOT EXISTS workout_personal_records (
    exercise_id      TEXT NOT NULL,
    modality         TEXT NOT NULL,
    variant_id       TEXT NOT NULL,
    kind             TEXT NOT NULL,
    value            REAL NOT NULL,
    reps             INTEGER,
    weight_kg        REAL,
    recorded_at_iso  TEXT NOT NULL,
    PRIMARY KEY (exercise_id, modality, variant_id, kind)
  );`,
] as const;
