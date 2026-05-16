import { getDb, nowIso } from '@/db/database';

/**
 * Single-row-per-key local preference store. Used for things that must
 * survive cold starts but don't justify their own table — e.g. the
 * "active household id" choice the user makes after accepting an invite.
 *
 * Intentionally NOT scoped by household — these are device-wide
 * preferences. Cloud sync ignores this table.
 */

const ACTIVE_HOUSEHOLD_KEY = 'active_household_id';

export async function getPref(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string | null }>(
    'SELECT value FROM app_prefs WHERE key = ? LIMIT 1;',
    key,
  );
  return row?.value ?? null;
}

export async function setPref(key: string, value: string | null): Promise<void> {
  const db = await getDb();
  if (value === null) {
    await db.runAsync('DELETE FROM app_prefs WHERE key = ?;', key);
    return;
  }
  await db.runAsync(
    `INSERT INTO app_prefs (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;`,
    key,
    value,
    nowIso(),
  );
}

export async function getActiveHouseholdPref(): Promise<number | null> {
  const raw = await getPref(ACTIVE_HOUSEHOLD_KEY);
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export async function setActiveHouseholdPref(localHouseholdId: number): Promise<void> {
  await setPref(ACTIVE_HOUSEHOLD_KEY, String(localHouseholdId));
}

export async function clearActiveHouseholdPref(): Promise<void> {
  await setPref(ACTIVE_HOUSEHOLD_KEY, null);
}
