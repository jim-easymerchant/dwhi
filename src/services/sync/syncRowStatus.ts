/**
 * Tiny helper: when the active local household is linked to a remote
 * counterpart, new/updated rows enter the sync pipeline. Otherwise
 * they stay strictly local — which is the "local-only" mode the rest
 * of the app preserves.
 *
 * Reads from `householdContext` synchronously, so callers don't need
 * to await — they just stamp the right status during INSERT/UPDATE.
 */

import { getActiveContextOrNull } from '@/services/householdContext';
import type { SyncRowStatus } from './syncTypes';

/**
 * The status to stamp on a freshly-created or freshly-modified row.
 *
 *   - Remote household present → 'pending_push' (sync will pick it up).
 *   - No remote household      → 'local_only' (data stays on device).
 */
export function nextSyncStatusForLocalWrite(): SyncRowStatus {
  const ctx = getActiveContextOrNull();
  return ctx?.household.remoteId ? 'pending_push' : 'local_only';
}

/** True iff the active local household is linked to a Supabase one. */
export function isHouseholdRemotelyLinked(): boolean {
  return !!getActiveContextOrNull()?.household.remoteId;
}
