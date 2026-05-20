/**
 * Theme-preference repository.
 *
 * Single-row settings table (`workout_settings`, id = 'default').
 * For now it stores only the selected theme id; future settings
 * (haptics, audio, accessibility) can grow the table additively.
 *
 * Every function is wrapped in safe defaults: a missing table, a
 * corrupted row, or any DB error → returns null on read, false on
 * write. The bridge layer treats "no row" identically to "the
 * user has not picked a theme yet" → falls back to Momentum.
 */

import { getDb, nowIso } from './db';

const SINGLETON_ID = 'default';

interface Row {
  id: string;
  theme_id: string | null;
  weight_unit: string | null;
  workout_template_id: string | null;
  updated_at_iso: string | null;
}

/** Read the stored theme id. Returns null on no-row / any error. */
export async function loadStoredThemeId(): Promise<string | null> {
  try {
    const db = await getDb();
    const row = await db.getFirstAsync<Row>(
      `SELECT id, theme_id, weight_unit, workout_template_id, updated_at_iso
         FROM workout_settings
         WHERE id = ?;`,
      [SINGLETON_ID],
    );
    if (!row) return null;
    if (typeof row.theme_id !== 'string' || row.theme_id.length === 0) {
      return null;
    }
    return row.theme_id;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[workout.persistence] loadStoredThemeId failed:', e);
    return null;
  }
}

/** Save the user's selected theme id. Returns true on success. */
export async function saveStoredThemeId(themeId: string): Promise<boolean> {
  if (typeof themeId !== 'string' || themeId.length === 0) return false;
  try {
    const db = await getDb();
    await db.runAsync(
      `INSERT INTO workout_settings (id, theme_id, updated_at_iso)
       VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         theme_id       = excluded.theme_id,
         updated_at_iso = excluded.updated_at_iso;`,
      [SINGLETON_ID, themeId, nowIso()],
    );
    return true;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[workout.persistence] saveStoredThemeId failed:', e);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Weight-unit preference — same singleton row.
// ---------------------------------------------------------------------------

/**
 * Read the stored weight-unit preference ('lb' / 'kg'). Returns
 * null on missing row, malformed value, or any error — the bridge
 * routes null to the default ('lb').
 */
export async function loadStoredWeightUnit(): Promise<string | null> {
  try {
    const db = await getDb();
    const row = await db.getFirstAsync<Row>(
      `SELECT id, theme_id, weight_unit, workout_template_id, updated_at_iso
         FROM workout_settings
         WHERE id = ?;`,
      [SINGLETON_ID],
    );
    if (!row) return null;
    if (typeof row.weight_unit !== 'string' || row.weight_unit.length === 0) {
      return null;
    }
    return row.weight_unit;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[workout.persistence] loadStoredWeightUnit failed:', e);
    return null;
  }
}

/**
 * Save the user's weight-unit preference. Returns true on success.
 * The settings row is upserted; `theme_id` is preserved when
 * already set.
 */
export async function saveStoredWeightUnit(unit: string): Promise<boolean> {
  if (typeof unit !== 'string' || unit.length === 0) return false;
  try {
    const db = await getDb();
    await db.runAsync(
      `INSERT INTO workout_settings (id, weight_unit, updated_at_iso)
       VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         weight_unit    = excluded.weight_unit,
         updated_at_iso = excluded.updated_at_iso;`,
      [SINGLETON_ID, unit, nowIso()],
    );
    return true;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[workout.persistence] saveStoredWeightUnit failed:', e);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Workout-template selection — same singleton row.
// ---------------------------------------------------------------------------

/**
 * Read the stored selected-workout-template id. Returns null on
 * missing row, malformed value, or any error — the bridge routes
 * null to the 'push-day' default.
 */
export async function loadStoredWorkoutTemplateId(): Promise<string | null> {
  try {
    const db = await getDb();
    const row = await db.getFirstAsync<Row>(
      `SELECT id, theme_id, weight_unit, workout_template_id, updated_at_iso
         FROM workout_settings
         WHERE id = ?;`,
      [SINGLETON_ID],
    );
    if (!row) return null;
    if (
      typeof row.workout_template_id !== 'string' ||
      row.workout_template_id.length === 0
    ) {
      return null;
    }
    return row.workout_template_id;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(
      '[workout.persistence] loadStoredWorkoutTemplateId failed:',
      e,
    );
    return null;
  }
}

/**
 * Save the selected workout template id. Upserts the settings
 * singleton; preserves theme_id / weight_unit. Returns true on
 * success.
 */
export async function saveStoredWorkoutTemplateId(
  templateId: string,
): Promise<boolean> {
  if (typeof templateId !== 'string' || templateId.length === 0) return false;
  try {
    const db = await getDb();
    await db.runAsync(
      `INSERT INTO workout_settings (id, workout_template_id, updated_at_iso)
       VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         workout_template_id = excluded.workout_template_id,
         updated_at_iso      = excluded.updated_at_iso;`,
      [SINGLETON_ID, templateId, nowIso()],
    );
    return true;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(
      '[workout.persistence] saveStoredWorkoutTemplateId failed:',
      e,
    );
    return false;
  }
}

/** Test-only: wipe the table. */
export async function __wipeThemeStoreForTests(): Promise<void> {
  try {
    const db = await getDb();
    await db.execAsync('DELETE FROM workout_settings;');
  } catch {
    // ignore — table may not exist in some test setups
  }
}
