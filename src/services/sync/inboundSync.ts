/**
 * Inbound (Supabase → local) pull for Phase 1: items + inventory_events.
 *
 * For each remote row:
 *   1. Look up the local row by `remote_id` first. If found, apply the
 *      remote values when the local has no unsynced changes OR the
 *      remote is newer than the local (last-write-wins).
 *   2. If no local match, INSERT a fresh local row stamped as synced.
 *      This is the "appeared on second device after reinstall" path.
 *
 * Soft delete: `deleted_at` flows through as-is. Local rows that were
 * soft-deleted remotely become soft-deleted locally.
 *
 * Conflict policy:
 *   - Local pending_push / sync_failed wins over remote unless remote
 *     `updated_at` is strictly newer than local `updated_at`. This is
 *     deliberate: an offline edit you haven't yet pushed should not be
 *     clobbered by a slightly older remote row.
 *   - Otherwise the inbound row applies and the local row is marked
 *     `synced`.
 *
 * Cursors: Phase 1 keeps it simple — every pull is "since the last
 * successful pull timestamp" stored in `app_prefs`. Cold-start passes
 * `null` which pulls everything. Idempotent because upsert keys on
 * remote_id.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getActiveContextOrNull } from '@/services/householdContext';
import { getPref, setPref } from '@/repositories/appPrefsRepository';
import {
  applyRemoteItemUpdate,
  findItemByRemoteId,
  insertRemoteItemLocally,
} from '@/repositories/itemRepository';
import {
  applyRemoteEventUpdate,
  findEventByRemoteId,
  insertRemoteEventLocally,
} from '@/repositories/inventoryEventRepository';
import {
  listItemsForHouseholdSince,
  type RemoteItem,
} from '@/services/remote/itemsRemoteRepository';
import {
  listInventoryEventsForHouseholdSince,
  type RemoteInventoryEvent,
} from '@/services/remote/inventoryEventsRemoteRepository';

export interface InboundResult {
  pulled: number;
  errors: string[];
}

const PULL_CURSOR_ITEMS_KEY = 'sync.pull_cursor.items';
const PULL_CURSOR_EVENTS_KEY = 'sync.pull_cursor.inventory_events';

export async function pullChanges(
  _client: SupabaseClient,
): Promise<InboundResult> {
  const ctx = getActiveContextOrNull();
  const remoteHouseholdId = ctx?.household.remoteId ?? null;
  if (!remoteHouseholdId) {
    return { pulled: 0, errors: [] };
  }

  const errors: string[] = [];
  let pulled = 0;

  // -------------------------------------------------------------------------
  // Items
  // -------------------------------------------------------------------------
  const itemsCursor = await getPref(PULL_CURSOR_ITEMS_KEY);
  const itemsRes = await listItemsForHouseholdSince(
    remoteHouseholdId,
    itemsCursor,
  );
  if (!itemsRes.ok) {
    errors.push(`items pull: ${itemsRes.message}`);
  } else {
    const remoteItems = itemsRes.data ?? [];
    let maxItemUpdated = itemsCursor;
    for (const remote of remoteItems) {
      try {
        const did = await applyRemoteItem(remote);
        if (did) pulled += 1;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn(`[dwhi.sync] inbound item apply failed: ${msg}`);
        errors.push(`items[${remote.id.slice(0, 8)}…]: ${msg}`);
      }
      if (!maxItemUpdated || remote.updatedAt > maxItemUpdated) {
        maxItemUpdated = remote.updatedAt;
      }
    }
    if (maxItemUpdated) await setPref(PULL_CURSOR_ITEMS_KEY, maxItemUpdated);
  }

  // -------------------------------------------------------------------------
  // Inventory events. Items must run first so the event's parent local
  // item exists by remote_id when we go to attach.
  // -------------------------------------------------------------------------
  const eventsCursor = await getPref(PULL_CURSOR_EVENTS_KEY);
  const eventsRes = await listInventoryEventsForHouseholdSince(
    remoteHouseholdId,
    eventsCursor,
  );
  if (!eventsRes.ok) {
    errors.push(`inventory_events pull: ${eventsRes.message}`);
  } else {
    const remoteEvents = eventsRes.data ?? [];
    let maxEventUpdated = eventsCursor;
    for (const remote of remoteEvents) {
      try {
        const did = await applyRemoteEvent(remote);
        if (did) pulled += 1;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn(`[dwhi.sync] inbound event apply failed: ${msg}`);
        errors.push(`events[${remote.id.slice(0, 8)}…]: ${msg}`);
      }
      if (!maxEventUpdated || remote.updatedAt > maxEventUpdated) {
        maxEventUpdated = remote.updatedAt;
      }
    }
    if (maxEventUpdated) await setPref(PULL_CURSOR_EVENTS_KEY, maxEventUpdated);
  }

  return { pulled, errors };
}

/**
 * Test-only: drop the pull cursors so the next pull is a full
 * backfill. Useful for migration tests; never called from app code.
 */
export async function __resetPullCursorsForTests(): Promise<void> {
  await setPref(PULL_CURSOR_ITEMS_KEY, null);
  await setPref(PULL_CURSOR_EVENTS_KEY, null);
}

async function applyRemoteItem(remote: RemoteItem): Promise<boolean> {
  const existing = await findItemByRemoteId(remote.id);
  if (!existing) {
    await insertRemoteItemLocally({
      remoteId: remote.id,
      localIdHint: remote.localId,
      name: remote.name,
      category: remote.category,
      barcode: remote.barcode,
      createdAt: remote.createdAt,
      updatedAt: remote.updatedAt,
      remoteUpdatedAt: remote.updatedAt,
      deletedAt: remote.deletedAt,
    });
    return true;
  }
  if (shouldOverrideLocal(existing.syncStatus, existing.updatedAt, remote.updatedAt)) {
    await applyRemoteItemUpdate({
      localId: existing.id,
      name: remote.name,
      category: remote.category,
      barcode: remote.barcode,
      updatedAt: remote.updatedAt,
      remoteUpdatedAt: remote.updatedAt,
      deletedAt: remote.deletedAt,
    });
    return true;
  }
  return false;
}

async function applyRemoteEvent(remote: RemoteInventoryEvent): Promise<boolean> {
  // Resolve the local item this event belongs to. The remote payload
  // carries item_id (UUID); we find the local row that mirrors it.
  if (!remote.itemId) return false;
  const localItem = await findItemByRemoteId(remote.itemId);
  if (!localItem) {
    // The parent item hasn't been pulled yet (or was never in this
    // household). Skip — the next pull cycle will catch up once items
    // catch up.
    return false;
  }

  const existing = await findEventByRemoteId(remote.id);
  const direction = eventTypeToDirection(remote.eventType, remote.quantityDelta);
  const quantity = Math.abs(remote.quantityDelta ?? 1);

  if (!existing) {
    await insertRemoteEventLocally({
      remoteId: remote.id,
      localItemId: localItem.id,
      remoteItemId: remote.itemId,
      direction,
      quantity,
      source: remote.source ?? 'sync',
      createdAt: remote.createdAt,
      updatedAt: remote.updatedAt,
      remoteUpdatedAt: remote.updatedAt,
      deletedAt: remote.deletedAt,
      remoteMemberId: null,
      remoteDeviceId: null,
    });
    return true;
  }
  if (shouldOverrideLocal(existing.syncStatus, existing.updatedAt, remote.updatedAt)) {
    await applyRemoteEventUpdate({
      localId: existing.id,
      direction,
      quantity,
      source: remote.source ?? existing.source,
      updatedAt: remote.updatedAt,
      remoteUpdatedAt: remote.updatedAt,
      deletedAt: remote.deletedAt,
    });
    return true;
  }
  return false;
}

/**
 * Conflict resolution policy. Returns true iff the remote update
 * should overwrite the local row.
 *
 *   - synced / local_only / null     → always apply remote.
 *   - pending_push / sync_failed     → keep local unless remote is
 *                                       strictly newer (last-write-wins).
 */
function shouldOverrideLocal(
  localStatus: string | null,
  localUpdatedAt: string,
  remoteUpdatedAt: string,
): boolean {
  if (localStatus === 'pending_push' || localStatus === 'sync_failed') {
    return remoteUpdatedAt > localUpdatedAt;
  }
  return true;
}

function eventTypeToDirection(
  type: string,
  delta: number | null,
): 'IN' | 'OUT' {
  if (type === 'IN' || type === 'OUT') return type;
  // Fall back to the sign of quantity_delta when another client emits a
  // different vocabulary. This keeps Phase 1 forgiving of future
  // event_type values without bouncing valid rows.
  if (delta == null) return 'IN';
  return delta < 0 ? 'OUT' : 'IN';
}
