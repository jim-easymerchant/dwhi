/**
 * Sync skeleton. The current implementation is a stub — pendingChanges
 * counts work, push/pull are no-ops with logs. The shape is here so a
 * second app gets the same SyncResult / SyncMode contract once the
 * inbound/outbound pipes are real.
 */
export {
  countPendingChanges,
  getSyncMode,
} from '@/services/sync/syncStatus';
export {
  syncNow,
} from '@/services/sync/syncNow';
export type {
  PendingChangesCounts,
  SyncMode,
  SyncResult,
} from '@/services/sync/syncTypes';
