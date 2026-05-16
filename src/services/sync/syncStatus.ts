/**
 * Read-only helpers the Settings card uses to render the Cloud Sync state.
 * Every function is local-only — no Supabase calls.
 */

import { columnExists, getDb } from '@/db/database';
import { isSupabaseConfigured } from '@/services/env';
import { getSupabaseClient } from '@/services/supabaseClient';
import type { PendingChangesCounts, SyncMode } from './syncTypes';

const TABLES_WITH_SYNC = [
  'items',
  'inventory_events',
  'receipts',
  'receipt_items',
  'ask_history',
  'ask_feedback',
] as const;

/**
 * Counts rows with `sync_status = 'pending'` across every scoped table.
 * Tables that don't yet have the sync_status column (e.g. an install where
 * the latest migration hasn't run) are silently treated as zero — better
 * than crashing the Settings card.
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
      `SELECT COUNT(*) AS c FROM ${table} WHERE sync_status = 'pending';`,
    );
    const n = row?.c ?? 0;
    byTable[table] = n;
    total += n;
  }
  return { total, byTable };
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
