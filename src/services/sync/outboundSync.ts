/**
 * Outbound (local → Supabase) push. Stubbed for this branch — the data
 * model and sync metadata are ready, but no rows are sent yet.
 *
 * The real implementation will:
 *   1. Read all rows where sync_status = 'pending' (capped per table).
 *   2. UPSERT them to Supabase keyed by remote_id (filled if missing).
 *   3. On success: set sync_status='synced', last_synced_at=now,
 *      remote_id = whatever Supabase echoes back.
 *   4. On failure: set sync_status='error' and surface the count.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { countPendingChanges } from './syncStatus';

export interface OutboundResult {
  pushed: number;
  errors: string[];
}

export async function pushPending(_client: SupabaseClient): Promise<OutboundResult> {
  const pending = await countPendingChanges();
  // Intentional no-op while the sync foundation is being shipped. Logging
  // the count gives us a smoke-test signal once auth is wired up.
  console.log(
    `[dwhi.sync.outbound] would push ${pending.total} pending row(s) (stub)`,
  );
  return { pushed: 0, errors: [] };
}
