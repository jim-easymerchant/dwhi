/**
 * Player-momentum repository — single-row persistence for the
 * across-launch Momentum value.
 *
 * The orchestrator owns the decay / gain formulas. This repo only
 * persists the *resolved* state after each Quest, plus the timestamp
 * of the most recent session so the next launch can recompute decay
 * since then.
 *
 * Schema: `workout_player_momentum (id, value, last_session_at_iso, …)`.
 */

import { momentumBalance } from '@dwhi/workout-domain';

import { getDb, nowIso } from './db';

const SINGLETON_ID = 'default';

export interface PlayerMomentumRecord {
  value: number;
  lastSessionAtIso: string | null;
  lastReturnBonusAtIso: string | null;
  gentleModeUntilIso: string | null;
}

interface Row {
  id: string;
  value: number;
  last_session_at_iso: string | null;
  last_return_bonus_at_iso: string | null;
  gentle_mode_until_iso: string | null;
}

/** Load the singleton. Returns null if no row has been persisted yet. */
export async function loadPlayerMomentum(): Promise<PlayerMomentumRecord | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<Row>(
    `SELECT id, value, last_session_at_iso, last_return_bonus_at_iso,
            gentle_mode_until_iso
       FROM workout_player_momentum
       WHERE id = ?;`,
    [SINGLETON_ID],
  );
  if (!row) return null;
  return {
    value: row.value,
    lastSessionAtIso: row.last_session_at_iso,
    lastReturnBonusAtIso: row.last_return_bonus_at_iso,
    gentleModeUntilIso: row.gentle_mode_until_iso,
  };
}

/** Upsert the singleton. Caller passes the resolved post-Quest state. */
export async function savePlayerMomentum(
  record: PlayerMomentumRecord,
): Promise<void> {
  const db = await getDb();
  const clamped = Math.max(
    momentumBalance.min,
    Math.min(momentumBalance.max, record.value),
  );
  await db.runAsync(
    `INSERT INTO workout_player_momentum
       (id, value, last_session_at_iso, last_return_bonus_at_iso,
        gentle_mode_until_iso, updated_at_iso)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       value                    = excluded.value,
       last_session_at_iso      = excluded.last_session_at_iso,
       last_return_bonus_at_iso = excluded.last_return_bonus_at_iso,
       gentle_mode_until_iso    = excluded.gentle_mode_until_iso,
       updated_at_iso           = excluded.updated_at_iso;`,
    [
      SINGLETON_ID,
      clamped,
      record.lastSessionAtIso,
      record.lastReturnBonusAtIso,
      record.gentleModeUntilIso,
      nowIso(),
    ],
  );
}

/** Test-only: drop the singleton. */
export async function __wipePlayerMomentumForTests(): Promise<void> {
  const db = await getDb();
  await db.execAsync('DELETE FROM workout_player_momentum;');
}
