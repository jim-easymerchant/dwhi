/**
 * Scheduler for automatic sync runs. The repository write paths and
 * the app lifecycle hooks call `requestAutoSync(reason)` rather than
 * `syncNow()` directly so we can:
 *
 *   - Debounce a burst of writes (e.g. importing a receipt fires many
 *     events back-to-back) into one push.
 *   - Prevent overlapping runs — if a sync is in flight and another is
 *     requested, we just remember to re-run when the current one ends.
 *   - Stay silent when there's nothing to sync (local-only / signed
 *     out / not yet linked). syncNow already short-circuits in those
 *     cases; we don't want to spam its log lines either.
 *
 * Logs are tagged `[dwhi.sync.auto]` and only mention the reason +
 * outcome counts. No user content.
 */

import { syncNow } from './syncNow';
import { getSyncMode } from './syncStatus';
import { getActiveContextOrNull } from '@/services/householdContext';
import type { SyncResult } from './syncTypes';

const DEFAULT_DEBOUNCE_MS = 1_500;

interface SchedulerState {
  /** A run is in flight. */
  inFlight: boolean;
  /** A subsequent run was requested while inFlight. */
  pendingRerun: boolean;
  /** Reason of the most recent request (for the log line). */
  lastReason: string | null;
  /** setTimeout handle for the debounced kick. */
  debounceTimer: ReturnType<typeof setTimeout> | null;
  /** Tunable; default 1.5s. Tests can override via __configureForTests. */
  debounceMs: number;
  /** Test seam: actually performs the sync round. */
  runner: () => Promise<SyncResult>;
}

const state: SchedulerState = {
  inFlight: false,
  pendingRerun: false,
  lastReason: null,
  debounceTimer: null,
  debounceMs: DEFAULT_DEBOUNCE_MS,
  runner: syncNow,
};

/**
 * Ask the scheduler to run sync as soon as the debounce window passes.
 * Callers don't await — sync is fire-and-forget. The reason string is
 * a free-form tag like 'item-write' / 'cold-start' / 'foreground'.
 *
 * No-ops when there's nothing the sync layer could actually do:
 *   - Supabase unconfigured.
 *   - User signed out.
 *   - Local household not yet linked.
 *
 * The first two are also checked again inside syncNow; doing the
 * short-circuit here avoids scheduling a timer just to wake up and
 * discover we have nothing to do.
 */
export function requestAutoSync(reason: string): void {
  state.lastReason = reason;

  // Cheap synchronous gate: skip if the active household has no
  // remote_id. The async gate (sign-in check) happens inside syncNow.
  const ctx = getActiveContextOrNull();
  if (!ctx?.household.remoteId) {
    return;
  }

  if (state.debounceTimer) {
    clearTimeout(state.debounceTimer);
    state.debounceTimer = null;
  }
  state.debounceTimer = setTimeout(() => {
    state.debounceTimer = null;
    void kickSync();
  }, state.debounceMs);
}

/**
 * Run sync immediately, bypassing the debounce. The "Sync now" button
 * and the post-sign-in hook use this directly so the user gets
 * feedback without waiting.
 */
export async function runSyncImmediately(reason: string): Promise<SyncResult> {
  state.lastReason = reason;
  if (state.debounceTimer) {
    clearTimeout(state.debounceTimer);
    state.debounceTimer = null;
  }
  return kickSync();
}

async function kickSync(): Promise<SyncResult> {
  if (state.inFlight) {
    // Another run is happening right now. Mark a re-run so we go again
    // after it finishes, then no-op this call.
    state.pendingRerun = true;
    return {
      ok: true,
      message: 'Sync already in flight; queued a follow-up.',
      pushed: 0,
      pulled: 0,
      errors: [],
      finishedAt: new Date().toISOString(),
    };
  }

  // Last gate: short-circuit if the env / session say "no can do".
  // We still publish a SyncResult so callers (Settings) can read
  // something coherent.
  const mode = await getSyncMode();
  if (mode !== 'configured-signed-in') {
    return {
      ok: false,
      message: 'Sync not available in current mode.',
      pushed: 0,
      pulled: 0,
      errors: [],
      finishedAt: new Date().toISOString(),
    };
  }

  state.inFlight = true;
  console.log(
    `[dwhi.sync.auto] starting (reason=${state.lastReason ?? 'unknown'})`,
  );
  let result: SyncResult;
  try {
    result = await state.runner();
    console.log(
      `[dwhi.sync.auto] finished pushed=${result.pushed} pulled=${result.pulled} errors=${result.errors.length}`,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[dwhi.sync.auto] threw: ${msg}`);
    result = {
      ok: false,
      message: msg,
      pushed: 0,
      pulled: 0,
      errors: [msg],
      finishedAt: new Date().toISOString(),
    };
  } finally {
    state.inFlight = false;
  }
  if (state.pendingRerun) {
    state.pendingRerun = false;
    // The pending re-run was requested while we were in flight — most
    // likely because of writes that landed during the sync. Re-arm a
    // debounced run so they get picked up.
    requestAutoSync('chained-rerun');
  }
  return result;
}

/**
 * Test seam. Resets internal state and lets tests swap in a fake
 * runner so the scheduler logic can be exercised without going near
 * Supabase. NEVER call from app code.
 */
export function __configureAutoSyncForTests(opts: {
  runner?: () => Promise<SyncResult>;
  debounceMs?: number;
}): void {
  state.runner = opts.runner ?? syncNow;
  state.debounceMs = opts.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  state.inFlight = false;
  state.pendingRerun = false;
  state.lastReason = null;
  if (state.debounceTimer) {
    clearTimeout(state.debounceTimer);
    state.debounceTimer = null;
  }
}
