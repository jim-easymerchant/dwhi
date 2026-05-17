import { getDb, nowIso } from '@/db/database';
import { getActiveHouseholdId } from '@/services/householdContext';
import { requestAutoSync } from '@/services/sync/autoSync';
import { nextSyncStatusForLocalWrite } from '@/services/sync/syncRowStatus';
import type { SyncRowStatus } from '@/services/sync/syncTypes';
import type { Item, NewItem } from '@/types/models';

interface ItemRow {
  id: number;
  manufacturer: string | null;
  name: string;
  category: string | null;
  container_type: string | null;
  size: string | null;
  canonical_key: string | null;
  barcode: string | null;
  source: string | null;
  raw_lookup_json: string | null;
  created_at: string;
  updated_at: string;
  household_id: number | null;
  remote_id: string | null;
  sync_status: string | null;
  remote_updated_at: string | null;
  last_synced_at: string | null;
  sync_error: string | null;
  deleted_at: string | null;
}

function rowToItem(row: ItemRow): Item {
  return {
    id: row.id,
    manufacturer: row.manufacturer,
    name: row.name,
    category: row.category,
    containerType: row.container_type,
    size: row.size,
    canonicalKey: row.canonical_key,
    barcode: row.barcode,
    source: row.source,
    rawLookupJson: row.raw_lookup_json,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    householdId: row.household_id,
  };
}

/**
 * Internal row shape including the sync columns. The sync layer needs
 * these; the rest of the app uses the slimmer `Item` shape via
 * `rowToItem`. Kept in this file so callers don't reach into raw SQL.
 */
export interface ItemWithSyncMeta extends Item {
  remoteId: string | null;
  syncStatus: SyncRowStatus | null;
  remoteUpdatedAt: string | null;
  lastSyncedAt: string | null;
  syncError: string | null;
  deletedAt: string | null;
}

function rowToItemWithSyncMeta(row: ItemRow): ItemWithSyncMeta {
  return {
    ...rowToItem(row),
    remoteId: row.remote_id,
    syncStatus: (row.sync_status as SyncRowStatus | null) ?? null,
    remoteUpdatedAt: row.remote_updated_at,
    lastSyncedAt: row.last_synced_at,
    syncError: row.sync_error,
    deletedAt: row.deleted_at,
  };
}

export function toCanonicalKey(name: string, manufacturer?: string | null): string {
  return [manufacturer ?? '', name]
    .join(' ')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function findByCanonicalKey(key: string): Promise<Item | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<ItemRow>(
    'SELECT * FROM items WHERE household_id = ? AND canonical_key = ? LIMIT 1;',
    getActiveHouseholdId(),
    key,
  );
  return row ? rowToItem(row) : null;
}

export async function findByBarcode(barcode: string): Promise<Item | null> {
  const db = await getDb();
  const trimmed = barcode.trim();
  if (!trimmed) return null;
  const row = await db.getFirstAsync<ItemRow>(
    'SELECT * FROM items WHERE household_id = ? AND barcode = ? LIMIT 1;',
    getActiveHouseholdId(),
    trimmed,
  );
  return row ? rowToItem(row) : null;
}

export async function searchByName(query: string, limit = 10): Promise<Item[]> {
  const db = await getDb();
  const like = `%${query.toLowerCase()}%`;
  const rows = await db.getAllAsync<ItemRow>(
    `SELECT * FROM items
     WHERE household_id = ?
       AND (LOWER(name) LIKE ? OR LOWER(canonical_key) LIKE ? OR LOWER(category) LIKE ?)
     ORDER BY updated_at DESC
     LIMIT ?;`,
    getActiveHouseholdId(),
    like,
    like,
    like,
    limit,
  );
  return rows.map(rowToItem);
}

export async function getById(id: number): Promise<Item | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<ItemRow>(
    'SELECT * FROM items WHERE id = ? AND household_id = ?;',
    id,
    getActiveHouseholdId(),
  );
  return row ? rowToItem(row) : null;
}

export async function listAll(limit = 100): Promise<Item[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ItemRow>(
    'SELECT * FROM items WHERE household_id = ? ORDER BY updated_at DESC LIMIT ?;',
    getActiveHouseholdId(),
    limit,
  );
  return rows.map(rowToItem);
}

export async function createItem(input: NewItem): Promise<Item> {
  const db = await getDb();
  const now = nowIso();
  const canonicalKey =
    input.canonicalKey ?? toCanonicalKey(input.name, input.manufacturer ?? undefined);
  const householdId = getActiveHouseholdId();
  const syncStatus = nextSyncStatusForLocalWrite();
  const result = await db.runAsync(
    `INSERT INTO items
       (manufacturer, name, category, container_type, size, canonical_key,
        barcode, source, raw_lookup_json, created_at, updated_at, household_id,
        sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    input.manufacturer,
    input.name,
    input.category,
    input.containerType,
    input.size,
    canonicalKey,
    input.barcode ?? null,
    input.source ?? null,
    input.rawLookupJson ?? null,
    now,
    now,
    householdId,
    syncStatus,
  );
  // Fire-and-forget sync request; debounced + de-duped inside autoSync
  // so back-to-back writes don't stack push attempts.
  requestAutoSync('item-write');
  return {
    id: result.lastInsertRowId,
    manufacturer: input.manufacturer,
    name: input.name,
    category: input.category,
    containerType: input.containerType,
    size: input.size,
    canonicalKey,
    barcode: input.barcode ?? null,
    source: input.source ?? null,
    rawLookupJson: input.rawLookupJson ?? null,
    createdAt: now,
    updatedAt: now,
    householdId,
  };
}

/**
 * Returns an existing item (barcode match wins; canonical_key as fallback)
 * or inserts a new one. Updates `updated_at` so freshly-touched items bubble
 * to the top of lists. Barcode / source / raw_lookup_json are added when
 * supplied via COALESCE so a barcode scan can enrich an existing item.
 */
export async function upsertItem(input: NewItem): Promise<Item> {
  const canonicalKey =
    input.canonicalKey ?? toCanonicalKey(input.name, input.manufacturer ?? undefined);

  let existing: Item | null = null;
  if (input.barcode) {
    existing = await findByBarcode(input.barcode);
  }
  if (!existing) {
    existing = await findByCanonicalKey(canonicalKey);
  }

  if (existing) {
    const db = await getDb();
    const now = nowIso();
    const syncStatus = nextSyncStatusForLocalWrite();
    await db.runAsync(
      `UPDATE items
         SET manufacturer = COALESCE(?, manufacturer),
             category = COALESCE(?, category),
             container_type = COALESCE(?, container_type),
             size = COALESCE(?, size),
             barcode = COALESCE(?, barcode),
             source = COALESCE(?, source),
             raw_lookup_json = COALESCE(?, raw_lookup_json),
             updated_at = ?,
             sync_status = ?
       WHERE id = ? AND household_id = ?;`,
      input.manufacturer,
      input.category,
      input.containerType,
      input.size,
      input.barcode ?? null,
      input.source ?? null,
      input.rawLookupJson ?? null,
      now,
      syncStatus,
      existing.id,
      getActiveHouseholdId(),
    );
    requestAutoSync('item-write');
    return {
      ...existing,
      manufacturer: input.manufacturer ?? existing.manufacturer,
      category: input.category ?? existing.category,
      containerType: input.containerType ?? existing.containerType,
      size: input.size ?? existing.size,
      barcode: input.barcode ?? existing.barcode,
      source: input.source ?? existing.source,
      rawLookupJson: input.rawLookupJson ?? existing.rawLookupJson,
      canonicalKey,
      updatedAt: now,
    };
  }
  return createItem({ ...input, canonicalKey });
}

// ---------------------------------------------------------------------------
// Sync support: the outbound/inbound sync layer reaches in through these
// dedicated functions rather than building SQL directly, so the schema
// shape stays encapsulated in this repository.
// ---------------------------------------------------------------------------

/**
 * Returns items that need to be pushed to Supabase: anything currently
 * `pending_push` or `sync_failed` (retry path), scoped to the active
 * household. Includes soft-deleted rows so the server learns about
 * tombstones too.
 */
export async function listItemsPendingPush(
  limit = 200,
): Promise<ItemWithSyncMeta[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ItemRow>(
    `SELECT * FROM items
      WHERE household_id = ?
        AND sync_status IN ('pending_push', 'sync_failed')
      ORDER BY updated_at ASC
      LIMIT ?;`,
    getActiveHouseholdId(),
    limit,
  );
  return rows.map(rowToItemWithSyncMeta);
}

/** Looks up the item with the given remote_id, regardless of soft-delete. */
export async function findItemByRemoteId(
  remoteId: string,
): Promise<ItemWithSyncMeta | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<ItemRow>(
    `SELECT * FROM items WHERE household_id = ? AND remote_id = ? LIMIT 1;`,
    getActiveHouseholdId(),
    remoteId,
  );
  return row ? rowToItemWithSyncMeta(row) : null;
}

/**
 * Stamp the push outcome on a local item row. `remoteId`/`remoteUpdatedAt`
 * are set on success; `error` only when status is sync_failed.
 */
export async function markItemPushResult(input: {
  localId: number;
  status: SyncRowStatus;
  remoteId?: string | null;
  remoteUpdatedAt?: string | null;
  error?: string | null;
}): Promise<void> {
  const db = await getDb();
  const now = nowIso();
  if (input.status === 'synced') {
    await db.runAsync(
      `UPDATE items
          SET sync_status = 'synced',
              remote_id = COALESCE(?, remote_id),
              remote_updated_at = ?,
              last_synced_at = ?,
              sync_error = NULL
        WHERE id = ?;`,
      input.remoteId ?? null,
      input.remoteUpdatedAt ?? now,
      now,
      input.localId,
    );
  } else {
    await db.runAsync(
      `UPDATE items
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
 * INSERT a remote row that doesn't exist locally yet. Used by the
 * inbound pull when a brand-new item shows up from another device.
 * Returns the new local id.
 */
export async function insertRemoteItemLocally(input: {
  remoteId: string;
  localIdHint: string | null;
  name: string;
  category: string | null;
  barcode: string | null;
  createdAt: string;
  updatedAt: string;
  remoteUpdatedAt: string;
  deletedAt: string | null;
}): Promise<number> {
  const db = await getDb();
  const householdId = getActiveHouseholdId();
  const canonicalKey = toCanonicalKey(input.name);
  const result = await db.runAsync(
    `INSERT INTO items
       (name, category, barcode, canonical_key, created_at, updated_at,
        household_id, remote_id, sync_status, remote_updated_at,
        last_synced_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?, ?, ?);`,
    input.name,
    input.category,
    input.barcode,
    canonicalKey,
    input.createdAt,
    input.updatedAt,
    householdId,
    input.remoteId,
    input.remoteUpdatedAt,
    nowIso(),
    input.deletedAt,
  );
  return result.lastInsertRowId;
}

/**
 * UPDATE an existing local row with values from the remote. Skipped by
 * the inbound pull when the local row has unsynced changes.
 */
export async function applyRemoteItemUpdate(input: {
  localId: number;
  name: string;
  category: string | null;
  barcode: string | null;
  updatedAt: string;
  remoteUpdatedAt: string;
  deletedAt: string | null;
}): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE items
        SET name = ?,
            category = ?,
            barcode = ?,
            canonical_key = ?,
            updated_at = ?,
            remote_updated_at = ?,
            sync_status = 'synced',
            last_synced_at = ?,
            sync_error = NULL,
            deleted_at = ?
      WHERE id = ?;`,
    input.name,
    input.category,
    input.barcode,
    toCanonicalKey(input.name),
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
