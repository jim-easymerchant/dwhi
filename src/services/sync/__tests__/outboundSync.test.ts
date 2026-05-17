/**
 * Outbound-sync orchestration tests. Mocks the repositories +
 * remote-Supabase upsert functions so we can assert:
 *   - No-op cases (no remote household).
 *   - Items pushed before inventory events.
 *   - Per-row success marks rows synced.
 *   - Per-row failure marks rows sync_failed without crashing.
 *   - Events whose parent item is unsynced get deferred (not lost).
 *   - Local item id → remote item id mapping when pushing events.
 */

const getActiveContextOrNull = jest.fn();
jest.mock('@/services/householdContext', () => ({
  getActiveContextOrNull: () => getActiveContextOrNull(),
}));

const listItemsPendingPush = jest.fn();
const markItemPushResult = jest.fn();
const findItemByRemoteId = jest.fn();
jest.mock('@/repositories/itemRepository', () => ({
  listItemsPendingPush: (...a: unknown[]) => listItemsPendingPush(...a),
  markItemPushResult: (...a: unknown[]) => markItemPushResult(...a),
  findItemByRemoteId: (...a: unknown[]) => findItemByRemoteId(...a),
}));

const listEventsPendingPush = jest.fn();
const markEventPushResult = jest.fn();
jest.mock('@/repositories/inventoryEventRepository', () => ({
  listEventsPendingPush: (...a: unknown[]) => listEventsPendingPush(...a),
  markEventPushResult: (...a: unknown[]) => markEventPushResult(...a),
}));

const getFirstAsync = jest.fn();
jest.mock('@/db/database', () => ({
  getDb: jest.fn(() => Promise.resolve({ getFirstAsync })),
  nowIso: () => '2026-05-17T12:00:00Z',
}));

const upsertItems = jest.fn();
jest.mock('@/services/remote/itemsRemoteRepository', () => ({
  upsertItems: (...a: unknown[]) => upsertItems(...a),
}));

const upsertInventoryEvents = jest.fn();
jest.mock('@/services/remote/inventoryEventsRemoteRepository', () => ({
  upsertInventoryEvents: (...a: unknown[]) => upsertInventoryEvents(...a),
}));

import { pushPending } from '../outboundSync';
import type { SupabaseClient } from '@supabase/supabase-js';

const fakeClient = {} as SupabaseClient;

const linkedCtx = {
  household: { id: 1, remoteId: 'remote-1', name: 'H' },
  member: { id: 10, remoteId: 'mem-1', remoteUserId: 'u1' },
  device: { id: 100, deviceUuid: 'duuid' },
};
const unlinkedCtx = { ...linkedCtx, household: { ...linkedCtx.household, remoteId: null } };

beforeEach(() => {
  jest.clearAllMocks();
  listItemsPendingPush.mockResolvedValue([]);
  listEventsPendingPush.mockResolvedValue([]);
});

describe('pushPending — no-op cases', () => {
  test('returns 0 pushed when no active context', async () => {
    getActiveContextOrNull.mockReturnValue(null);
    const r = await pushPending(fakeClient);
    expect(r).toEqual({ pushed: 0, errors: [] });
    expect(listItemsPendingPush).not.toHaveBeenCalled();
  });

  test('returns 0 pushed when household has no remoteId', async () => {
    getActiveContextOrNull.mockReturnValue(unlinkedCtx);
    const r = await pushPending(fakeClient);
    expect(r).toEqual({ pushed: 0, errors: [] });
    expect(listItemsPendingPush).not.toHaveBeenCalled();
  });

  test('returns 0 pushed when nothing is pending', async () => {
    getActiveContextOrNull.mockReturnValue(linkedCtx);
    const r = await pushPending(fakeClient);
    expect(r.pushed).toBe(0);
    expect(r.errors).toEqual([]);
    expect(upsertItems).not.toHaveBeenCalled();
    expect(upsertInventoryEvents).not.toHaveBeenCalled();
  });
});

describe('pushPending — order', () => {
  test('pushes items before inventory_events', async () => {
    getActiveContextOrNull.mockReturnValue(linkedCtx);
    listItemsPendingPush.mockResolvedValue([
      makeItem(1, null, 'pending_push'),
    ]);
    listEventsPendingPush.mockResolvedValue([
      makeEvent(11, 1, null, 'pending_push'),
    ]);
    // Item upsert echoes back whatever id the caller supplied.
    upsertItems.mockImplementation(async (inputs: unknown[]) => ({
      ok: true,
      data: (inputs as Array<{ id: string }>).map(i => ({
        id: i.id,
        updatedAt: '2026-05-17T12:00:00Z',
      })),
    }));
    findItemByRemoteId.mockImplementation(async (rid: string) => ({
      id: 1,
      remoteId: rid,
    }));
    getFirstAsync.mockImplementation(async () => ({ remote_id: 'remote-item-from-db' }));
    upsertInventoryEvents.mockImplementation(async (inputs: unknown[]) => ({
      ok: true,
      data: (inputs as Array<{ id: string }>).map(i => ({
        id: i.id,
        updatedAt: '2026-05-17T12:00:01Z',
      })),
    }));

    const r = await pushPending(fakeClient);

    expect(r.pushed).toBe(2);
    expect(r.errors).toEqual([]);

    // Verify ordering: items called before events.
    const itemsOrder = upsertItems.mock.invocationCallOrder[0];
    const eventsOrder = upsertInventoryEvents.mock.invocationCallOrder[0];
    expect(itemsOrder).toBeLessThan(eventsOrder);
  });
});

describe('pushPending — per-row outcomes', () => {
  test('whole-batch error marks every pending row sync_failed', async () => {
    getActiveContextOrNull.mockReturnValue(linkedCtx);
    listItemsPendingPush.mockResolvedValue([
      makeItem(1, null, 'pending_push'),
      makeItem(2, 'remote-existing', 'sync_failed'),
    ]);
    upsertItems.mockResolvedValue({ ok: false, message: 'RLS denied' });

    const r = await pushPending(fakeClient);

    expect(r.pushed).toBe(0);
    expect(r.errors[0]).toMatch(/RLS denied/);
    expect(markItemPushResult).toHaveBeenCalledTimes(2);
    expect(markItemPushResult).toHaveBeenCalledWith(
      expect.objectContaining({
        localId: 1,
        status: 'sync_failed',
        error: 'RLS denied',
      }),
    );
    expect(markItemPushResult).toHaveBeenCalledWith(
      expect.objectContaining({
        localId: 2,
        status: 'sync_failed',
        error: 'RLS denied',
      }),
    );
  });

  test('event whose parent item is not yet synced is deferred, not failed', async () => {
    getActiveContextOrNull.mockReturnValue(linkedCtx);
    listItemsPendingPush.mockResolvedValue([]);
    listEventsPendingPush.mockResolvedValue([
      makeEvent(11, 1, null, 'pending_push'),
    ]);
    // Parent item has no remote_id locally yet.
    getFirstAsync.mockResolvedValue({ remote_id: null });

    const r = await pushPending(fakeClient);

    expect(r.pushed).toBe(0);
    expect(r.errors).toEqual([]);
    expect(upsertInventoryEvents).not.toHaveBeenCalled();
    expect(markEventPushResult).not.toHaveBeenCalled();
  });

  test('per-event success marks each event with its remote_id + parent remote_item_id', async () => {
    getActiveContextOrNull.mockReturnValue(linkedCtx);
    listItemsPendingPush.mockResolvedValue([]);
    listEventsPendingPush.mockResolvedValue([
      makeEvent(11, 1, null, 'pending_push'),
    ]);
    getFirstAsync.mockResolvedValue({ remote_id: 'remote-item-1' });
    findItemByRemoteId.mockResolvedValue({
      id: 1,
      remoteId: 'remote-item-1',
    });
    // Echo the input id back so the synced-row marker can match it.
    upsertInventoryEvents.mockImplementation(async (inputs: unknown[]) => ({
      ok: true,
      data: (inputs as Array<{ id: string }>).map(i => ({
        id: i.id,
        updatedAt: '2026-05-17T12:00:01Z',
      })),
    }));

    const r = await pushPending(fakeClient);

    expect(r.pushed).toBe(1);
    const markCall = (markEventPushResult.mock.calls[0] ?? [])[0] as {
      localId: number;
      status: string;
      remoteId: string;
      remoteItemId: string;
    };
    expect(markCall.localId).toBe(11);
    expect(markCall.status).toBe('synced');
    expect(markCall.remoteItemId).toBe('remote-item-1');
    // remoteId is a freshly-generated UUID we didn't predetermine; just
    // confirm it's a non-empty string of the right shape.
    expect(markCall.remoteId).toMatch(/[0-9a-f]{4}/);
  });
});

function makeItem(id: number, remoteId: string | null, status: string) {
  return {
    id,
    name: 'X',
    canonicalKey: 'x',
    category: null,
    barcode: null,
    manufacturer: null,
    containerType: null,
    size: null,
    source: null,
    rawLookupJson: null,
    createdAt: '2026-05-17T11:00:00Z',
    updatedAt: '2026-05-17T11:30:00Z',
    householdId: 1,
    remoteId,
    syncStatus: status,
    remoteUpdatedAt: null,
    lastSyncedAt: null,
    syncError: null,
    deletedAt: null,
  };
}

function makeEvent(id: number, itemId: number, remoteId: string | null, status: string) {
  return {
    id,
    itemId,
    direction: 'IN' as const,
    quantity: 1,
    imageUri: null,
    rawAiJson: null,
    source: 'manual',
    createdAt: '2026-05-17T11:45:00Z',
    updatedAt: '2026-05-17T11:45:00Z',
    remoteId,
    syncStatus: status,
    remoteUpdatedAt: null,
    lastSyncedAt: null,
    syncError: null,
    deletedAt: null,
    remoteItemId: null,
  };
}
