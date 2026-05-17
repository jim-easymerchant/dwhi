/**
 * Shared types for the cloud-sync foundation. Today these are mostly
 * consumed by the Settings → Cloud Sync card and by syncNow's stub
 * implementation; the outbound/inbound modules will use the full surface
 * when the real sync logic lands.
 */

/**
 * Per-row sync state machine for items + inventory_events:
 *   local_only    — no remote household linked yet (or sync disabled).
 *                   Row lives entirely on this device.
 *   pending_push  — row has local changes that need to be pushed.
 *   synced        — row is in sync with the remote.
 *   sync_failed   — last push attempt failed; sync_error is set.
 */
export type SyncRowStatus =
  | 'local_only'
  | 'pending_push'
  | 'synced'
  | 'sync_failed';

/**
 * What mode the sync subsystem is in, end-to-end. Order matches the
 * Settings card's escalating capability:
 *   local-only             → env vars missing; nothing to sync against
 *   configured-signed-out  → env vars present, but no Supabase session
 *   configured-signed-in   → env vars present + signed in (sync usable)
 */
export type SyncMode =
  | 'local-only'
  | 'configured-signed-out'
  | 'configured-signed-in';

export interface PendingChangesCounts {
  /** Total rows across every scoped table with `sync_status = 'pending'`. */
  total: number;
  byTable: Record<string, number>;
}

export interface SyncResult {
  ok: boolean;
  /** Short human-readable summary suitable for an inline UI line. */
  message: string;
  pushed: number;
  pulled: number;
  errors: string[];
  /** When this run finished (ISO). */
  finishedAt: string;
}

/**
 * Persisted in `app_prefs` so Settings can show "last sync ran at X"
 * across app restarts without a separate database table.
 */
export const LAST_SYNC_AT_KEY = 'sync.last_run_at';
export const LAST_SYNC_ERROR_KEY = 'sync.last_error';
