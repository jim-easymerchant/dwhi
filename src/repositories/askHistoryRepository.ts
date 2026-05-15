import { getDb, nowIso } from '@/db/database';
import {
  getActiveDeviceId,
  getActiveHouseholdId,
  getActiveMemberId,
} from '@/services/householdContext';

const DAY_MS = 86_400_000;

export interface AskHistoryRow {
  id: number;
  queryText: string;
  normalizedTerm: string;
  createdAt: string;
}

/**
 * Persists the user's question. The normalized term is what the confidence
 * engine matched on, so repeated lookups for "milk" / "do we have milk"
 * collapse to the same bucket for behavior reasoning.
 */
export async function recordAsk(
  queryText: string,
  normalizedTerm: string,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO ask_history
       (query_text, normalized_term, created_at,
        household_id, created_by_member_id, created_by_device_id)
     VALUES (?, ?, ?, ?, ?, ?);`,
    queryText,
    normalizedTerm,
    nowIso(),
    getActiveHouseholdId(),
    getActiveMemberId(),
    getActiveDeviceId(),
  );
}

export async function countAll(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ c: number }>(
    'SELECT COUNT(*) AS c FROM ask_history WHERE household_id = ?;',
    getActiveHouseholdId(),
  );
  return row?.c ?? 0;
}

export interface AskSummaryForTerm {
  lastAskedAt: string | null;
  countLast7d: number;
  countTotal: number;
}

export async function summaryForTerm(
  normalizedTerm: string,
  now = Date.now(),
): Promise<AskSummaryForTerm> {
  const db = await getDb();
  const sevenDaysAgo = new Date(now - 7 * DAY_MS).toISOString();
  const row = await db.getFirstAsync<{
    last_at: string | null;
    count_7d: number;
    count_total: number;
  }>(
    `SELECT MAX(created_at) AS last_at,
            COUNT(CASE WHEN created_at >= ? THEN 1 END) AS count_7d,
            COUNT(*) AS count_total
       FROM ask_history
      WHERE household_id = ? AND normalized_term = ?;`,
    sevenDaysAgo,
    getActiveHouseholdId(),
    normalizedTerm,
  );
  return {
    lastAskedAt: row?.last_at ?? null,
    countLast7d: row?.count_7d ?? 0,
    countTotal: row?.count_total ?? 0,
  };
}
