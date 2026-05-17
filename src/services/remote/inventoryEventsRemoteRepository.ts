/**
 * Supabase-side inventory_events table. Phase 1 of automatic sync.
 *
 * Logging contract: NEVER log user content (no notes, no source URI).
 * The narrow log lines here include counts and household id prefix only.
 */

import { getSupabaseClient } from '../supabaseClient';

export interface RemoteInventoryEvent {
  id: string;
  householdId: string;
  itemId: string | null;
  localId: string | null;
  localItemId: string | null;
  eventType: string;
  quantityDelta: number | null;
  quantityAfter: number | null;
  source: string | null;
  occurredAt: string;
  createdByMemberId: string | null;
  createdByDeviceId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface RemoteInventoryEventUpsertInput {
  id: string;
  householdId: string;
  itemId: string | null;
  localId: string | null;
  localItemId: string | null;
  eventType: string;
  quantityDelta: number | null;
  source: string | null;
  occurredAt: string;
  createdByMemberId: string | null;
  createdByDeviceId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface RemoteResult<T = void> {
  ok: boolean;
  message: string;
  data?: T;
}

interface EventRow {
  id: string;
  household_id: string;
  item_id: string | null;
  local_id: string | null;
  local_item_id: string | null;
  event_type: string;
  quantity_delta: number | null;
  quantity_after: number | null;
  source: string | null;
  note: string | null;
  occurred_at: string;
  created_by_member_id: string | null;
  created_by_device_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

function rowToRemote(row: EventRow): RemoteInventoryEvent {
  return {
    id: row.id,
    householdId: row.household_id,
    itemId: row.item_id,
    localId: row.local_id,
    localItemId: row.local_item_id,
    eventType: row.event_type,
    quantityDelta: row.quantity_delta,
    quantityAfter: row.quantity_after,
    source: row.source,
    occurredAt: row.occurred_at,
    createdByMemberId: row.created_by_member_id,
    createdByDeviceId: row.created_by_device_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function shortHh(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

function unconfigured<T = void>(): RemoteResult<T> {
  return { ok: false, message: 'Supabase is not configured.' };
}

export async function upsertInventoryEvents(
  inputs: RemoteInventoryEventUpsertInput[],
): Promise<RemoteResult<RemoteInventoryEvent[]>> {
  const client = getSupabaseClient();
  if (!client) return unconfigured<RemoteInventoryEvent[]>();
  if (inputs.length === 0) {
    return { ok: true, message: 'Nothing to push.', data: [] };
  }
  const rows = inputs.map(input => ({
    id: input.id,
    household_id: input.householdId,
    item_id: input.itemId,
    local_id: input.localId,
    local_item_id: input.localItemId,
    event_type: input.eventType,
    quantity_delta: input.quantityDelta,
    source: input.source,
    occurred_at: input.occurredAt,
    created_by_member_id: input.createdByMemberId,
    created_by_device_id: input.createdByDeviceId,
    created_at: input.createdAt,
    updated_at: input.updatedAt,
    deleted_at: input.deletedAt,
  }));
  const { data, error } = await client
    .from('inventory_events')
    .upsert(rows, { onConflict: 'id' })
    .select('*')
    .returns<EventRow[]>();
  if (error) {
    console.warn(
      `[dwhi.sync] inventory_events upsert failed (${rows.length}): ${error.message}`,
    );
    return { ok: false, message: error.message };
  }
  console.log(
    `[dwhi.sync] inventory_events upsert ok (${data.length} row${data.length === 1 ? '' : 's'})`,
  );
  return { ok: true, message: 'ok', data: data.map(rowToRemote) };
}

export async function listInventoryEventsForHouseholdSince(
  remoteHouseholdId: string,
  since: string | null,
): Promise<RemoteResult<RemoteInventoryEvent[]>> {
  const client = getSupabaseClient();
  if (!client) return unconfigured<RemoteInventoryEvent[]>();
  let q = client
    .from('inventory_events')
    .select('*')
    .eq('household_id', remoteHouseholdId)
    .order('updated_at', { ascending: true });
  if (since) q = q.gt('updated_at', since);
  const { data, error } = await q.returns<EventRow[]>();
  if (error) {
    console.warn(
      `[dwhi.sync] inventory_events pull failed for ${shortHh(remoteHouseholdId)}: ${error.message}`,
    );
    return { ok: false, message: error.message };
  }
  console.log(
    `[dwhi.sync] inventory_events pulled ${data.length} for ${shortHh(remoteHouseholdId)}` +
      (since ? ` (since ${since})` : ' (full)'),
  );
  return { ok: true, message: 'ok', data: data.map(rowToRemote) };
}
