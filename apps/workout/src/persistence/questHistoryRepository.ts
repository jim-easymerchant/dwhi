/**
 * Quest-history repository — one row per completed Quest.
 *
 * Stores a denormalised summary (xp / damage / momentum / defeated
 * count / primary verdict) plus the full orchestrator result JSON
 * for the future journal screen. The summary columns are what the
 * home screen reads to compute "days since last quest" and to show
 * a quiet recent-activity list.
 */

import { getDb, nowIso } from './db';

export interface QuestHistoryRecord {
  id: string;
  kind: string;
  templateId?: string | null;
  startedAtIso?: string | null;
  completedAtIso: string;
  workingSetCount: number;
  totalDamage: number;
  xp: number;
  momentumDelta: number;
  defeatedCount: number;
  primaryVerdict: string | null;
  payloadJson: string | null;
}

interface Row {
  id: string;
  kind: string;
  template_id: string | null;
  started_at_iso: string | null;
  completed_at_iso: string;
  working_set_count: number;
  total_damage: number;
  xp: number;
  momentum_delta: number;
  defeated_count: number;
  primary_verdict: string | null;
  payload_json: string | null;
}

function rowToRecord(row: Row): QuestHistoryRecord {
  return {
    id: row.id,
    kind: row.kind,
    templateId: row.template_id,
    startedAtIso: row.started_at_iso,
    completedAtIso: row.completed_at_iso,
    workingSetCount: row.working_set_count,
    totalDamage: row.total_damage,
    xp: row.xp,
    momentumDelta: row.momentum_delta,
    defeatedCount: row.defeated_count,
    primaryVerdict: row.primary_verdict,
    payloadJson: row.payload_json,
  };
}

/** Append a completed Quest to the history table. */
export async function appendQuestHistory(record: QuestHistoryRecord): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO workout_quest_history
       (id, kind, template_id, started_at_iso, completed_at_iso,
        working_set_count, total_damage, xp, momentum_delta,
        defeated_count, primary_verdict, payload_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      record.id,
      record.kind,
      record.templateId ?? null,
      record.startedAtIso ?? null,
      record.completedAtIso ?? nowIso(),
      record.workingSetCount,
      record.totalDamage,
      record.xp,
      record.momentumDelta,
      record.defeatedCount,
      record.primaryVerdict ?? null,
      record.payloadJson ?? null,
    ],
  );
}

/** The most recent completed-Quest timestamp, or null if none yet. */
export async function getMostRecentCompletedAtIso(): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ completed_at_iso: string }>(
    `SELECT completed_at_iso
       FROM workout_quest_history
       ORDER BY completed_at_iso DESC
       LIMIT 1;`,
  );
  return row?.completed_at_iso ?? null;
}

/** Read recent history (most-recent first, optional limit).
 * Malformed rows are skipped (not fatal) — a single bad write
 * from a future schema-change race never sinks the journal screen. */
export async function listRecentQuests(limit = 20): Promise<QuestHistoryRecord[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Row>(
    `SELECT id, kind, template_id, started_at_iso, completed_at_iso,
            working_set_count, total_damage, xp, momentum_delta,
            defeated_count, primary_verdict, payload_json
       FROM workout_quest_history
       ORDER BY completed_at_iso DESC
       LIMIT ?;`,
    [Math.max(1, Math.floor(limit))],
  );
  const out: QuestHistoryRecord[] = [];
  for (const row of rows) {
    try {
      // Minimal required-field guards before we trust the row.
      if (!row || typeof row.id !== 'string' || typeof row.completed_at_iso !== 'string') {
        // eslint-disable-next-line no-console
        console.warn('[workout.persistence] skipping malformed quest history row');
        continue;
      }
      out.push(rowToRecord(row));
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[workout.persistence] quest history row mapping failed:', e);
    }
  }
  return out;
}

/**
 * Count completed quests since the given ISO timestamp. Used by
 * the player-HP system to read "how many sessions in the recent
 * window?" — typically the last 14 days.
 *
 * Returns 0 on missing table, no rows, or any error.
 */
export async function loadSessionCountSince(sinceIso: string): Promise<number> {
  try {
    const db = await getDb();
    const row = await db.getFirstAsync<{ count: number | null }>(
      `SELECT COUNT(*) AS count
         FROM workout_quest_history
        WHERE completed_at_iso >= ?;`,
      [sinceIso],
    );
    const count = row?.count ?? 0;
    return Number.isFinite(count) && count > 0 ? count : 0;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[workout.persistence] loadSessionCountSince failed:', e);
    return 0;
  }
}

/**
 * Sum every recorded quest's xp into a single total. Used by the
 * hydration path to seed the displayed level from the player's
 * actual quest history.
 *
 * Returns 0 when there are no rows yet, on any DB error, or when
 * the sum is non-finite. Pure read.
 */
export async function loadTotalQuestXp(): Promise<number> {
  try {
    const db = await getDb();
    const row = await db.getFirstAsync<{ total: number | null }>(
      `SELECT COALESCE(SUM(xp), 0) AS total FROM workout_quest_history;`,
    );
    const total = row?.total ?? 0;
    return Number.isFinite(total) && total > 0 ? total : 0;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[workout.persistence] loadTotalQuestXp failed:', e);
    return 0;
  }
}

/** Test-only: wipe the table. */
export async function __wipeQuestHistoryForTests(): Promise<void> {
  const db = await getDb();
  await db.execAsync('DELETE FROM workout_quest_history;');
}
