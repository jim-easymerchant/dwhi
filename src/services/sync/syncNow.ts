/**
 * Orchestrator for a manual "Sync now" tap. Never auto-runs.
 *
 * Today returns a safe no-op everywhere except the configured-signed-in
 * case (which itself currently logs only — see outboundSync / inboundSync).
 * Settings keeps the button disabled until the user is signed in, so this
 * function shouldn't be reachable from a Local only or signed-out app.
 */

import { getSupabaseClient } from '@/services/supabaseClient';
import { pullChanges } from './inboundSync';
import { pushPending } from './outboundSync';
import { getSyncMode } from './syncStatus';
import type { SyncResult } from './syncTypes';

export async function syncNow(): Promise<SyncResult> {
  const finishedAt = () => new Date().toISOString();

  const mode = await getSyncMode();
  if (mode === 'local-only') {
    return {
      ok: false,
      message: 'Sync not configured — set Supabase env vars to enable.',
      pushed: 0,
      pulled: 0,
      errors: [],
      finishedAt: finishedAt(),
    };
  }
  if (mode === 'configured-signed-out') {
    return {
      ok: false,
      message: 'Sign in to enable Sync.',
      pushed: 0,
      pulled: 0,
      errors: [],
      finishedAt: finishedAt(),
    };
  }

  const client = getSupabaseClient();
  if (!client) {
    return {
      ok: false,
      message: 'Supabase client missing — Local only.',
      pushed: 0,
      pulled: 0,
      errors: [],
      finishedAt: finishedAt(),
    };
  }

  // Real signed-in user with a configured client. Run the (still-stub)
  // outbound + inbound. They log and return zeros.
  const errors: string[] = [];
  let pushed = 0;
  let pulled = 0;

  try {
    const out = await pushPending(client);
    pushed = out.pushed;
    errors.push(...out.errors);
  } catch (e) {
    errors.push(`outbound: ${e instanceof Error ? e.message : String(e)}`);
  }

  try {
    const inb = await pullChanges(client);
    pulled = inb.pulled;
    errors.push(...inb.errors);
  } catch (e) {
    errors.push(`inbound: ${e instanceof Error ? e.message : String(e)}`);
  }

  return {
    ok: errors.length === 0,
    message:
      errors.length === 0
        ? `Pushed ${pushed}, pulled ${pulled}.`
        : `Sync finished with ${errors.length} error(s).`,
    pushed,
    pulled,
    errors,
    finishedAt: finishedAt(),
  };
}
