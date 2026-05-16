/**
 * Inbound (Supabase → local) pull. Stubbed for this branch.
 *
 * The real implementation will:
 *   1. Read each household-scoped table on Supabase WHERE updated_at >
 *      max(local last_synced_at).
 *   2. INSERT OR REPLACE by remote_id locally.
 *   3. Track per-table cursors so partial failures resume cleanly.
 *
 * For now we just confirm the client exists and log.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface InboundResult {
  pulled: number;
  errors: string[];
}

export async function pullChanges(_client: SupabaseClient): Promise<InboundResult> {
  console.log('[dwhi.sync.inbound] would pull remote changes (stub)');
  return { pulled: 0, errors: [] };
}
