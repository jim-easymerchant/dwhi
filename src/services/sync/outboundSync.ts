/**
 * Outbound (local → Supabase) push for Phase 1: items + inventory_events.
 *
 * Sequence per run:
 *   1. Items first. An event referencing a freshly-created item needs
 *      that item to have a remote_id before its event payload makes
 *      sense.
 *   2. Inventory events second. Each event resolves its remote_item_id
 *      from the item's local row. If the parent item is still unsynced
 *      (item push failed earlier this run, or the event references an
 *      item that no longer exists locally), the event is left pending
 *      and the next sync run will retry.
 *
 * Per-row outcome:
 *   - Push ok  → markRowSynced(remote_id, remote_updated_at, last_synced_at).
 *                Pre-existing remote_id is preserved on conflict.
 *   - Push err → markRowFailed(error message, truncated). The next run
 *                picks the row up via the `sync_failed` retry path.
 *
 * Never throws to the caller. Every per-row failure is captured and
 * accumulated into the result so syncNow can render an aggregate.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getActiveContextOrNull } from '@/services/householdContext';
import {
  findItemByRemoteId,
  listItemsPendingPush,
  markItemPushResult,
  type ItemWithSyncMeta,
} from '@/repositories/itemRepository';
import {
  listEventsPendingPush,
  markEventPushResult,
  type InventoryEventWithSyncMeta,
} from '@/repositories/inventoryEventRepository';
import { getDb } from '@/db/database';
import {
  upsertItems,
  type RemoteItemUpsertInput,
} from '@/services/remote/itemsRemoteRepository';
import {
  upsertInventoryEvents,
  type RemoteInventoryEventUpsertInput,
} from '@/services/remote/inventoryEventsRemoteRepository';

export interface OutboundResult {
  pushed: number;
  errors: string[];
}

/** RFC4122 v4 UUID without an extra native dep. POC-grade. */
function randomUuidV4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, ch => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function ctxOrNull() {
  return getActiveContextOrNull();
}

export async function pushPending(
  _client: SupabaseClient,
): Promise<OutboundResult> {
  const ctx = ctxOrNull();
  const remoteHouseholdId = ctx?.household.remoteId ?? null;
  if (!remoteHouseholdId) {
    // Either local-only mode, or signed in but not yet linked to a
    // remote household. ensureRemoteHousehold should fix the latter
    // before sync runs; either way, push is a no-op.
    return { pushed: 0, errors: [] };
  }

  const errors: string[] = [];
  let pushed = 0;

  // -------------------------------------------------------------------------
  // 1. Items
  // -------------------------------------------------------------------------
  const pendingItems = await listItemsPendingPush();
  if (pendingItems.length > 0) {
    const inputs: RemoteItemUpsertInput[] = pendingItems.map(item =>
      itemToUpsertInput(item, remoteHouseholdId, ctx),
    );
    const r = await upsertItems(inputs);
    if (r.ok) {
      const byId = new Map<string, { id: string; updatedAt: string }>();
      for (const remote of r.data ?? []) {
        byId.set(remote.id, { id: remote.id, updatedAt: remote.updatedAt });
      }
      for (const [i, item] of pendingItems.entries()) {
        const wanted = inputs[i].id;
        const echoed = byId.get(wanted);
        if (echoed) {
          await markItemPushResult({
            localId: item.id,
            status: 'synced',
            remoteId: echoed.id,
            remoteUpdatedAt: echoed.updatedAt,
          });
          pushed += 1;
        } else {
          await markItemPushResult({
            localId: item.id,
            status: 'sync_failed',
            error: 'Upsert returned no row for this id (RLS?).',
          });
          errors.push(`items[${item.id}]: server returned no echo`);
        }
      }
    } else {
      // Whole batch failed (network / RLS). Mark every row sync_failed
      // so the count stays accurate and the retry path picks them up.
      for (const item of pendingItems) {
        await markItemPushResult({
          localId: item.id,
          status: 'sync_failed',
          error: r.message,
        });
      }
      errors.push(`items batch: ${r.message}`);
    }
  }

  // -------------------------------------------------------------------------
  // 2. Inventory events
  // -------------------------------------------------------------------------
  const pendingEvents = await listEventsPendingPush();
  if (pendingEvents.length > 0) {
    // Resolve each event's local item → remote_id mapping. Events
    // whose parent item is still unsynced get deferred to the next
    // run; the local row stays pending_push.
    const inputs: Array<{
      event: InventoryEventWithSyncMeta;
      input: RemoteInventoryEventUpsertInput;
    }> = [];
    for (const event of pendingEvents) {
      const remoteItemId = await resolveRemoteItemIdForLocalItem(event.itemId);
      if (!remoteItemId) {
        // Leave it as pending_push so the next run retries once the
        // parent item is synced.
        continue;
      }
      inputs.push({
        event,
        input: eventToUpsertInput(event, remoteHouseholdId, remoteItemId, ctx),
      });
    }
    if (inputs.length > 0) {
      const r = await upsertInventoryEvents(inputs.map(x => x.input));
      if (r.ok) {
        const byId = new Map<string, { id: string; updatedAt: string }>();
        for (const remote of r.data ?? []) {
          byId.set(remote.id, { id: remote.id, updatedAt: remote.updatedAt });
        }
        for (const { event, input } of inputs) {
          const echoed = byId.get(input.id);
          if (echoed) {
            await markEventPushResult({
              localId: event.id,
              status: 'synced',
              remoteId: echoed.id,
              remoteUpdatedAt: echoed.updatedAt,
              remoteItemId: input.itemId,
            });
            pushed += 1;
          } else {
            await markEventPushResult({
              localId: event.id,
              status: 'sync_failed',
              error: 'Upsert returned no row for this id (RLS?).',
            });
            errors.push(`events[${event.id}]: server returned no echo`);
          }
        }
      } else {
        for (const { event } of inputs) {
          await markEventPushResult({
            localId: event.id,
            status: 'sync_failed',
            error: r.message,
          });
        }
        errors.push(`inventory_events batch: ${r.message}`);
      }
    }
  }

  return { pushed, errors };
}

function itemToUpsertInput(
  item: ItemWithSyncMeta,
  remoteHouseholdId: string,
  ctx: ReturnType<typeof ctxOrNull>,
): RemoteItemUpsertInput {
  return {
    id: item.remoteId ?? randomUuidV4(),
    householdId: remoteHouseholdId,
    localId: String(item.id),
    name: item.name,
    normalizedName: item.canonicalKey,
    category: item.category,
    barcode: item.barcode,
    createdByMemberId: ctx?.member.remoteId ?? null,
    createdByDeviceId: ctx?.device.deviceUuid ?? null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    deletedAt: item.deletedAt,
  };
}

function eventToUpsertInput(
  event: InventoryEventWithSyncMeta,
  remoteHouseholdId: string,
  remoteItemId: string,
  ctx: ReturnType<typeof ctxOrNull>,
): RemoteInventoryEventUpsertInput {
  const delta =
    event.direction === 'IN' ? event.quantity : -event.quantity;
  return {
    id: event.remoteId ?? randomUuidV4(),
    householdId: remoteHouseholdId,
    itemId: remoteItemId,
    localId: String(event.id),
    localItemId: String(event.itemId),
    eventType: event.direction, // 'IN' | 'OUT' map directly today
    quantityDelta: delta,
    source: event.source,
    occurredAt: event.createdAt,
    createdByMemberId: ctx?.member.remoteId ?? null,
    createdByDeviceId: ctx?.device.deviceUuid ?? null,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
    deletedAt: event.deletedAt,
  };
}

/**
 * Look up the remote_id of the parent item. Returns null if the local
 * item row is missing or not yet synced — in which case the event has
 * nothing to point at and is deferred to a later sync run.
 */
async function resolveRemoteItemIdForLocalItem(
  localItemId: number,
): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ remote_id: string | null }>(
    `SELECT remote_id FROM items WHERE id = ? LIMIT 1;`,
    localItemId,
  );
  if (!row?.remote_id) return null;
  // Belt + braces: confirm the local row is actually synced / has a
  // remote anchor. findItemByRemoteId scopes by household so a stale
  // remote_id from a previous household won't be reused by accident.
  const synced = await findItemByRemoteId(row.remote_id);
  return synced ? synced.remoteId : null;
}
