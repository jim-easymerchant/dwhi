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
  updated_at_iso: string | null;
}

/** Read the stored theme id. Returns null on no-row / any error. */
export async function loadStoredThemeId(): Promise<string | null> {
  try {
    const db = await getDb();
    const row = await db.getFirstAsync<Row>(
      `SELECT id, theme_id, updated_at_iso
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

/** Test-only: wipe the table. */
export async function __wipeThemeStoreForTests(): Promise<void> {
  try {
    const db = await getDb();
    await db.execAsync('DELETE FROM workout_settings;');
  } catch {
    // ignore — table may not exist in some test setups
  }
}
