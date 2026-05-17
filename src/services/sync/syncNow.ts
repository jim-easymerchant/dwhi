/**
 * Orchestrator for "Sync now" — both the manual button and the
 * auto-sync scheduler call this. Pushes pending items + inventory
 * events first, then pulls remote changes.
 *
 * Always returns a SyncResult and persists last-run metadata to
 * app_prefs so the Settings card can render "last sync at X" /
 * "last sync error: Y" across cold starts.
 */

import { getSupabaseClient } from '@/services/supabaseClient';
import { setPref } from '@/repositories/appPrefsRepository';
import { pullChanges } from './inboundSync';
import { pushPending } from './outboundSync';
import { getSyncMode } from './syncStatus';
import { LAST_SYNC_AT_KEY, LAST_SYNC_ERROR_KEY, type SyncResult } from './syncTypes';

export async function syncNow(): Promise<SyncResult> {
  const startedAt = Date.now();
  const finishedAt = () => new Date().toISOString();

  const mode = await getSyncMode();
  if (mode === 'local-only') {
    return persist({
      ok: false,
      message: 'Sync not configured — set Supabase env vars to enable.',
      pushed: 0,
      pulled: 0,
      errors: [],
      finishedAt: finishedAt(),
    });
  }
  if (mode === 'configured-signed-out') {
    return persist({
      ok: false,
      message: 'Sign in to enable Sync.',
      pushed: 0,
      pulled: 0,
      errors: [],
      finishedAt: finishedAt(),
    });
  }

  const client = getSupabaseClient();
  if (!client) {
    return persist({
      ok: false,
      message: 'Supabase client missing — Local only.',
      pushed: 0,
      pulled: 0,
      errors: [],
      finishedAt: finishedAt(),
    });
  }

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

  const elapsedMs = Date.now() - startedAt;
  console.log(
    `[dwhi.sync] syncNow finished in ${elapsedMs}ms pushed=${pushed} pulled=${pulled} errors=${errors.length}`,
  );

  return persist({
    ok: errors.length === 0,
    message:
      errors.length === 0
        ? `Pushed ${pushed}, pulled ${pulled}.`
        : `Sync finished with ${errors.length} error(s).`,
    pushed,
    pulled,
    errors,
    finishedAt: finishedAt(),
  });
}

async function persist(result: SyncResult): Promise<SyncResult> {
  try {
    await setPref(LAST_SYNC_AT_KEY, result.finishedAt);
    await setPref(
      LAST_SYNC_ERROR_KEY,
      result.errors.length > 0 ? result.errors.join(' · ') : null,
    );
  } catch (e) {
    // Persistence failure here is not worth swallowing the result —
    // the in-memory result is what the caller cares about. Just log.
    console.warn(
      `[dwhi.sync] could not persist last-sync metadata: ${e instanceof Error ? e.message : e}`,
    );
  }
  return result;
}
