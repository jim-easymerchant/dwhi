import { getDb, nowIso } from '@/db/database';
import {
  getActiveDeviceId,
  getActiveHouseholdId,
  getActiveMemberId,
} from '@/services/householdContext';
import { requestAutoSync } from '@/services/sync/autoSync';
import { nextSyncStatusForLocalWrite } from '@/services/sync/syncRowStatus';
import type { SyncRowStatus } from '@/services/sync/syncTypes';
import type { InventoryEvent, NewInventoryEvent } from '@/types/models';

interface EventRow {
  id: number;
  item_id: number;
  direction: 'IN' | 'OUT';
  quantity: number;
  image_uri: string | null;
  raw_ai_json: string | null;
  source: string;
  created_at: string;
  updated_at: string | null;
  remote_id: string | null;
  sync_status: string | null;
  remote_updated_at: string | null;
  last_synced_at: string | null;
  sync_error: string | null;
  deleted_at: string | null;
  remote_item_id: string | null;
}

function rowToEvent(row: EventRow): InventoryEvent {
  return {
    id: row.id,
    itemId: row.item_id,
    direction: row.direction,
    quantity: row.quantity,
    imageUri: row.image_uri,
    rawAiJson: row.raw_ai_json,
    source: row.source as InventoryEvent['source'],
    createdAt: row.created_at,
  };
}

export interface InventoryEventWithSyncMeta extends InventoryEvent {
  updatedAt: string;
  remoteId: string | null;
  syncStatus: SyncRowStatus | null;
  remoteUpdatedAt: string | null;
  lastSyncedAt: string | null;
  syncError: string | null;
  deletedAt: string | null;
  remoteItemId: string | null;
}

function rowToEventWithSyncMeta(row: EventRow): InventoryEventWithSyncMeta {
  return {
    ...rowToEvent(row),
    updatedAt: row.updated_at ?? row.created_at,
    remoteId: row.remote_id,
    syncStatus: (row.sync_status as SyncRowStatus | null) ?? null,
    remoteUpdatedAt: row.remote_updated_at,
    lastSyncedAt: row.last_synced_at,
    syncError: row.sync_error,
    deletedAt: row.deleted_at,
    remoteItemId: row.remote_item_id,
  };
}

export async function recordEvent(input: NewInventoryEvent): Promise<InventoryEvent> {
  const db = await getDb();
  const now = nowIso();
  const syncStatus = nextSyncStatusForLocalWrite();
  const result = await db.runAsync(
    `INSERT INTO inventory_events
       (item_id, direction, quantity, image_uri, raw_ai_json, source, created_at,
        updated_at, household_id, created_by_member_id, created_by_device_id,
        sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    input.itemId,
    input.direction,
    input.quantity,
    input.imageUri,
    input.rawAiJson,
    input.source,
    now,
    now,
    getActiveHouseholdId(),
    getActiveMemberId(),
    getActiveDeviceId(),
    syncStatus,
  );
  requestAutoSync('inventory-write');
  return { ...input, id: result.lastInsertRowId, createdAt: now };
}

export async function listEventsForItem(
  itemId: number,
  limit = 50,
): Promise<InventoryEvent[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<EventRow>(
    `SELECT * FROM inventory_events
     WHERE household_id = ? AND item_id = ?
     ORDER BY created_at DESC
     LIMIT ?;`,
    getActiveHouseholdId(),
    itemId,
    limit,
  );
  return rows.map(rowToEvent);
}

export interface EstimatedBalance {
  totalIn: number;
  totalOut: number;
  net: number;
  lastInAt: string | null;
  lastOutAt: string | null;
}

export async function getEstimatedBalance(itemId: number): Promise<EstimatedBalance> {
  const db = await getDb();
  const row = await db.getFirstAsync<{
    total_in: number | null;
    total_out: number | null;
    last_in_at: string | null;
    last_out_at: string | null;
  }>(
    `SELECT
       COALESCE(SUM(CASE WHEN direction = 'IN'  THEN quantity END), 0) AS total_in,
       COALESCE(SUM(CASE WHEN direction = 'OUT' THEN quantity END), 0) AS total_out,
       MAX(CASE WHEN direction = 'IN'  THEN created_at END) AS last_in_at,
       MAX(CASE WHEN direction = 'OUT' THEN created_at END) AS last_out_at
     FROM inventory_events
     WHERE household_id = ? AND item_id = ?;`,
    getActiveHouseholdId(),
    itemId,
  );
  const totalIn = row?.total_in ?? 0;
  const totalOut = row?.total_out ?? 0;
  return {
    totalIn,
    totalOut,
    net: totalIn - totalOut,
    lastInAt: row?.last_in_at ?? null,
    lastOutAt: row?.last_out_at ?? null,
  };
}

export async function listRecentEvents(limit = 20): Promise<InventoryEvent[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<EventRow>(
    `SELECT * FROM inventory_events
     WHERE household_id = ?
     ORDER BY created_at DESC
     LIMIT ?;`,
    getActiveHouseholdId(),
    limit,
  );
  return rows.map(rowToEvent);
}

// ---------------------------------------------------------------------------
// Sync support
// ---------------------------------------------------------------------------

/**
 * Returns events that need to be pushed to Supabase, scoped to the
 * active household. Includes both `pending_push` and `sync_failed`
 * (the retry path).
 */
export async function listEventsPendingPush(
  limit = 200,
): Promise<InventoryEventWithSyncMeta[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<EventRow>(
    `SELECT * FROM inventory_events
      WHERE household_id = ?
        AND sync_status IN ('pending_push', 'sync_failed')
      ORDER BY created_at ASC
      LIMIT ?;`,
    getActiveHouseholdId(),
    limit,
  );
  return rows.map(rowToEventWithSyncMeta);
}

/** Lookup by remote_id so inbound pull can detect existing rows. */
export async function findEventByRemoteId(
  remoteId: string,
): Promise<InventoryEventWithSyncMeta | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<EventRow>(
    `SELECT * FROM inventory_events
      WHERE household_id = ? AND remote_id = ? LIMIT 1;`,
    getActiveHouseholdId(),
    remoteId,
  );
  return row ? rowToEventWithSyncMeta(row) : null;
}

/**
 * Stamp the push outcome on a local event row.
 */
export async function markEventPushResult(input: {
  localId: number;
  status: SyncRowStatus;
  remoteId?: string | null;
  remoteUpdatedAt?: string | null;
  remoteItemId?: string | null;
  error?: string | null;
}): Promise<void> {
  const db = await getDb();
  const now = nowIso();
  if (input.status === 'synced') {
    await db.runAsync(
      `UPDATE inventory_events
          SET sync_status = 'synced',
              remote_id = COALESCE(?, remote_id),
              remote_updated_at = ?,
              remote_item_id = COALESCE(?, remote_item_id),
              last_synced_at = ?,
              sync_error = NULL
        WHERE id = ?;`,
      input.remoteId ?? null,
      input.remoteUpdatedAt ?? now,
      input.remoteItemId ?? null,
      now,
      input.localId,
    );
  } else {
    await db.runAsync(
      `UPDATE inventory_events
          SET sync_status = ?,
              sync_error = ?
        WHERE id = ?;`,
      input.status,
      truncateError(input.error ?? null),
      input.localId,
    );
  }
}

/**
 * INSERT a remote event that doesn't exist locally yet. Used by the
 * inbound pull. `localItemId` resolved by the caller via
 * `findItemByRemoteId(remoteItemId)`.
 */
export async function insertRemoteEventLocally(input: {
  remoteId: string;
  localItemId: number;
  remoteItemId: string | null;
  direction: 'IN' | 'OUT';
  quantity: number;
  source: string;
  createdAt: string;
  updatedAt: string;
  remoteUpdatedAt: string;
  deletedAt: string | null;
  remoteMemberId: number | null;
  remoteDeviceId: number | null;
}): Promise<number> {
  const db = await getDb();
  const householdId = getActiveHouseholdId();
  const result = await db.runAsync(
    `INSERT INTO inventory_events
       (item_id, direction, quantity, source, created_at, updated_at,
        household_id, created_by_member_id, created_by_device_id,
        remote_id, sync_status, remote_updated_at, remote_item_id,
        last_synced_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?, ?, ?, ?);`,
    input.localItemId,
    input.direction,
    input.quantity,
    input.source,
    input.createdAt,
    input.updatedAt,
    householdId,
    input.remoteMemberId,
    input.remoteDeviceId,
    input.remoteId,
    input.remoteUpdatedAt,
    input.remoteItemId,
    nowIso(),
    input.deletedAt,
  );
  return result.lastInsertRowId;
}

export async function applyRemoteEventUpdate(input: {
  localId: number;
  direction: 'IN' | 'OUT';
  quantity: number;
  source: string;
  updatedAt: string;
  remoteUpdatedAt: string;
  deletedAt: string | null;
}): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE inventory_events
        SET direction = ?,
            quantity = ?,
            source = ?,
            updated_at = ?,
            remote_updated_at = ?,
            sync_status = 'synced',
            last_synced_at = ?,
            sync_error = NULL,
            deleted_at = ?
      WHERE id = ?;`,
    input.direction,
    input.quantity,
    input.source,
    input.updatedAt,
    input.remoteUpdatedAt,
    nowIso(),
    input.deletedAt,
    input.localId,
  );
}

function truncateError(msg: string | null): string | null {
  if (!msg) return null;
  return msg.length > 240 ? `${msg.slice(0, 240)}…` : msg;
}
