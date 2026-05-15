import { getDb, nowIso } from '@/db/database';
import type { ConfidenceLevel } from '@/services/confidence/confidenceTypes';

const DAY_MS = 86_400_000;

export type AskFeedbackKind = 'have' | 'dont' | 'unsure';

export interface AskFeedbackRow {
  id: number;
  normalizedTerm: string;
  answerLevel: ConfidenceLevel;
  userFeedback: AskFeedbackKind;
  createdAt: string;
}

export async function recordFeedback(
  normalizedTerm: string,
  answerLevel: ConfidenceLevel,
  userFeedback: AskFeedbackKind,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO ask_feedback (normalized_term, answer_level, user_feedback, created_at)
     VALUES (?, ?, ?, ?);`,
    normalizedTerm,
    answerLevel,
    userFeedback,
    nowIso(),
  );
}

export async function countAll(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ c: number }>(
    'SELECT COUNT(*) AS c FROM ask_feedback;',
  );
  return row?.c ?? 0;
}

export interface FeedbackSummaryForTerm {
  /** Most recent feedback for this term, regardless of age. */
  latest: AskFeedbackKind | null;
  /** Timestamp of `latest`, or null. */
  latestAt: string | null;
  /** Counts within the last 7 days (rolling). */
  haveCount7d: number;
  dontCount7d: number;
  unsureCount7d: number;
}

/**
 * Aggregates the user's feedback on this exact normalized term. The confidence
 * engine reads this to nudge subsequent answers — "we just confirmed we have
 * it" should boost the next ask, etc.
 */
export async function summaryForTerm(
  normalizedTerm: string,
  now = Date.now(),
): Promise<FeedbackSummaryForTerm> {
  const db = await getDb();
  const sevenDaysAgo = new Date(now - 7 * DAY_MS).toISOString();

  const latestRow = await db.getFirstAsync<{
    user_feedback: AskFeedbackKind;
    created_at: string;
  }>(
    `SELECT user_feedback, created_at
       FROM ask_feedback
      WHERE normalized_term = ?
      ORDER BY created_at DESC
      LIMIT 1;`,
    normalizedTerm,
  );

  const counts = await db.getFirstAsync<{
    h: number;
    d: number;
    u: number;
  }>(
    `SELECT
       COUNT(CASE WHEN user_feedback = 'have'   THEN 1 END) AS h,
       COUNT(CASE WHEN user_feedback = 'dont'   THEN 1 END) AS d,
       COUNT(CASE WHEN user_feedback = 'unsure' THEN 1 END) AS u
       FROM ask_feedback
      WHERE normalized_term = ? AND created_at >= ?;`,
    normalizedTerm,
    sevenDaysAgo,
  );

  return {
    latest: latestRow?.user_feedback ?? null,
    latestAt: latestRow?.created_at ?? null,
    haveCount7d: counts?.h ?? 0,
    dontCount7d: counts?.d ?? 0,
    unsureCount7d: counts?.u ?? 0,
  };
}
