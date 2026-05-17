/**
 * Read-only helpers the Settings card uses to render the Cloud Sync state.
 * Every function is local-only — no Supabase calls.
 */

import { columnExists, getDb } from '@/db/database';
import { isSupabaseConfigured } from '@/services/env';
import { getSupabaseClient } from '@/services/supabaseClient';
import { getPref } from '@/repositories/appPrefsRepository';
import type { PendingChangesCounts, SyncMode } from './syncTypes';
import { LAST_SYNC_AT_KEY, LAST_SYNC_ERROR_KEY } from './syncTypes';

const TABLES_WITH_SYNC = [
  'items',
  'inventory_events',
  'receipts',
  'receipt_items',
  'ask_history',
  'ask_feedback',
] as const;

/**
 * Counts rows that need attention from the sync layer across every
 * scoped table. "Pending" here means either `pending_push` (changes
 * waiting to be sent) OR `sync_failed` (changes whose last attempt
 * errored and need a retry). Tables that don't yet have the
 * `sync_status` column are silently treated as zero — better than
 * crashing the Settings card on an old install.
 */
export async function countPendingChanges(): Promise<PendingChangesCounts> {
  const db = await getDb();
  const byTable: Record<string, number> = {};
  let total = 0;

  for (const table of TABLES_WITH_SYNC) {
    if (!(await columnExists(table, 'sync_status'))) {
      byTable[table] = 0;
      continue;
    }
    const row = await db.getFirstAsync<{ c: number }>(
      `SELECT COUNT(*) AS c FROM ${table}
        WHERE sync_status IN ('pending_push', 'sync_failed', 'pending')
          AND (deleted_at IS NULL OR sync_status IN ('pending_push', 'sync_failed'));`,
    );
    const n = row?.c ?? 0;
    byTable[table] = n;
    total += n;
  }
  return { total, byTable };
}

/**
 * Last-sync metadata for the Settings card. Both values are persisted
 * via `app_prefs` so they survive cold starts.
 */
export interface LastSyncInfo {
  /** ISO timestamp of the last syncNow() that returned, success or not. */
  at: string | null;
  /** Most recent error message (any source). Null when last run was ok. */
  error: string | null;
}

export async function getLastSyncInfo(): Promise<LastSyncInfo> {
  const [at, error] = await Promise.all([
    getPref(LAST_SYNC_AT_KEY),
    getPref(LAST_SYNC_ERROR_KEY),
  ]);
  return { at, error };
}

/**
 * Synchronous-ish; resolves the current high-level mode without doing any
 * Supabase round-trip. "Signed in" is best-effort: we ask the client for
 * its current in-memory session; persistent sessions land with the auth UI
 * branch.
 */
export async function getSyncMode(): Promise<SyncMode> {
  if (!isSupabaseConfigured()) return 'local-only';
  const client = getSupabaseClient();
  if (!client) return 'local-only';
  try {
    const { data } = await client.auth.getSession();
    return data?.session ? 'configured-signed-in' : 'configured-signed-out';
  } catch {
    return 'configured-signed-out';
  }
}
