/**
 * Inbound-sync tests: verifies the conflict-resolution rules and the
 * "appears on second device" path. Repositories + remote-fetch
 * functions are mocked.
 */

const getActiveContextOrNull = jest.fn();
jest.mock('@/services/householdContext', () => ({
  getActiveContextOrNull: () => getActiveContextOrNull(),
}));

const findItemByRemoteId = jest.fn();
const insertRemoteItemLocally = jest.fn();
const applyRemoteItemUpdate = jest.fn();
jest.mock('@/repositories/itemRepository', () => ({
  findItemByRemoteId: (...a: unknown[]) => findItemByRemoteId(...a),
  insertRemoteItemLocally: (...a: unknown[]) => insertRemoteItemLocally(...a),
  applyRemoteItemUpdate: (...a: unknown[]) => applyRemoteItemUpdate(...a),
}));

const findEventByRemoteId = jest.fn();
const insertRemoteEventLocally = jest.fn();
const applyRemoteEventUpdate = jest.fn();
jest.mock('@/repositories/inventoryEventRepository', () => ({
  findEventByRemoteId: (...a: unknown[]) => findEventByRemoteId(...a),
  insertRemoteEventLocally: (...a: unknown[]) => insertRemoteEventLocally(...a),
  applyRemoteEventUpdate: (...a: unknown[]) => applyRemoteEventUpdate(...a),
}));

const listItemsForHouseholdSince = jest.fn();
jest.mock('@/services/remote/itemsRemoteRepository', () => ({
  listItemsForHouseholdSince: (...a: unknown[]) => listItemsForHouseholdSince(...a),
}));

const listInventoryEventsForHouseholdSince = jest.fn();
jest.mock('@/services/remote/inventoryEventsRemoteRepository', () => ({
  listInventoryEventsForHouseholdSince: (...a: unknown[]) =>
    listInventoryEventsForHouseholdSince(...a),
}));

const prefStore: Record<string, string | null> = {};
jest.mock('@/repositories/appPrefsRepository', () => ({
  getPref: jest.fn(async (key: string) => prefStore[key] ?? null),
  setPref: jest.fn(async (key: string, value: string | null) => {
    if (value === null) delete prefStore[key];
    else prefStore[key] = value;
  }),
}));

import { pullChanges } from '../inboundSync';
import type { SupabaseClient } from '@supabase/supabase-js';

const fakeClient = {} as SupabaseClient;
const linkedCtx = {
  household: { id: 1, remoteId: 'remote-1' },
  member: {},
  device: {},
};

beforeEach(() => {
  jest.clearAllMocks();
  for (const k of Object.keys(prefStore)) delete prefStore[k];
  getActiveContextOrNull.mockReturnValue(linkedCtx);
  listItemsForHouseholdSince.mockResolvedValue({ ok: true, data: [] });
  listInventoryEventsForHouseholdSince.mockResolvedValue({ ok: true, data: [] });
});

describe('pullChanges — no-op', () => {
  test('returns 0 pulled when household has no remoteId', async () => {
    getActiveContextOrNull.mockReturnValue({
      ...linkedCtx,
      household: { id: 1, remoteId: null },
    });
    const r = await pullChanges(fakeClient);
    expect(r).toEqual({ pulled: 0, errors: [] });
    expect(listItemsForHouseholdSince).not.toHaveBeenCalled();
  });
});

describe('pullChanges — fresh install', () => {
  test('INSERTs items that have no local counterpart', async () => {
    listItemsForHouseholdSince.mockResolvedValue({
      ok: true,
      data: [
        remoteItem('remote-item-1', 'Milk'),
        remoteItem('remote-item-2', 'Eggs'),
      ],
    });
    findItemByRemoteId.mockResolvedValue(null);

    const r = await pullChanges(fakeClient);

    expect(r.pulled).toBe(2);
    expect(insertRemoteItemLocally).toHaveBeenCalledTimes(2);
    expect(insertRemoteItemLocally).toHaveBeenCalledWith(
      expect.objectContaining({ remoteId: 'remote-item-1', name: 'Milk' }),
    );
  });

  test('attaches inbound events to existing local items via remote_id', async () => {
    listInventoryEventsForHouseholdSince.mockResolvedValue({
      ok: true,
      data: [remoteEvent('remote-event-1', 'remote-item-1', 'IN', 1)],
    });
    findItemByRemoteId.mockResolvedValue({ id: 42 }); // local item id
    findEventByRemoteId.mockResolvedValue(null);

    const r = await pullChanges(fakeClient);

    expect(r.pulled).toBe(1);
    expect(insertRemoteEventLocally).toHaveBeenCalledWith(
      expect.objectContaining({
        remoteId: 'remote-event-1',
        localItemId: 42,
        direction: 'IN',
        quantity: 1,
      }),
    );
  });

  test('skips events whose parent item is missing locally', async () => {
    listInventoryEventsForHouseholdSince.mockResolvedValue({
      ok: true,
      data: [remoteEvent('remote-event-1', 'remote-item-missing', 'IN', 1)],
    });
    findItemByRemoteId.mockResolvedValue(null);

    const r = await pullChanges(fakeClient);

    expect(r.pulled).toBe(0);
    expect(insertRemoteEventLocally).not.toHaveBeenCalled();
  });
});

describe('pullChanges — idempotency and conflicts', () => {
  test('does not duplicate when the same remote row arrives twice', async () => {
    listItemsForHouseholdSince.mockResolvedValue({
      ok: true,
      data: [remoteItem('remote-item-1', 'Milk')],
    });
    findItemByRemoteId.mockResolvedValue({
      id: 5,
      syncStatus: 'synced',
      updatedAt: '2025-01-01T00:00:00Z',
    });

    const r = await pullChanges(fakeClient);

    // applyRemoteItemUpdate is called (synced row, remote applied) but
    // NO insert happens — that's the idempotency guarantee.
    expect(insertRemoteItemLocally).not.toHaveBeenCalled();
    expect(applyRemoteItemUpdate).toHaveBeenCalledTimes(1);
    expect(r.pulled).toBe(1);
  });

  test('does NOT overwrite a pending_push local row with an older remote', async () => {
    listItemsForHouseholdSince.mockResolvedValue({
      ok: true,
      data: [
        {
          ...remoteItem('remote-item-1', 'Milk'),
          updatedAt: '2026-05-17T10:00:00Z',
        },
      ],
    });
    findItemByRemoteId.mockResolvedValue({
      id: 5,
      syncStatus: 'pending_push',
      updatedAt: '2026-05-17T12:00:00Z', // newer local change
    });

    const r = await pullChanges(fakeClient);

    expect(applyRemoteItemUpdate).not.toHaveBeenCalled();
    expect(r.pulled).toBe(0);
  });

  test('DOES overwrite a pending_push row when remote is strictly newer', async () => {
    listItemsForHouseholdSince.mockResolvedValue({
      ok: true,
      data: [
        {
          ...remoteItem('remote-item-1', 'Milk Premium'),
          updatedAt: '2026-05-17T13:00:00Z',
        },
      ],
    });
    findItemByRemoteId.mockResolvedValue({
      id: 5,
      syncStatus: 'pending_push',
      updatedAt: '2026-05-17T12:00:00Z',
    });

    const r = await pullChanges(fakeClient);

    expect(applyRemoteItemUpdate).toHaveBeenCalledTimes(1);
    expect(r.pulled).toBe(1);
  });

  test('uses the highest updated_at as the cursor on the next call', async () => {
    listItemsForHouseholdSince.mockResolvedValue({
      ok: true,
      data: [
        { ...remoteItem('a', 'A'), updatedAt: '2026-05-17T10:00:00Z' },
        { ...remoteItem('b', 'B'), updatedAt: '2026-05-17T11:00:00Z' },
      ],
    });
    findItemByRemoteId.mockResolvedValue(null);

    await pullChanges(fakeClient);
    await pullChanges(fakeClient);

    expect(listItemsForHouseholdSince).toHaveBeenNthCalledWith(1, 'remote-1', null);
    expect(listItemsForHouseholdSince).toHaveBeenNthCalledWith(
      2,
      'remote-1',
      '2026-05-17T11:00:00Z',
    );
  });
});

describe('pullChanges — errors are surfaced, not thrown', () => {
  test('aggregates remote fetch errors', async () => {
    listItemsForHouseholdSince.mockResolvedValue({
      ok: false,
      message: 'permission denied',
    });
    const r = await pullChanges(fakeClient);
    expect(r.errors[0]).toMatch(/permission denied/);
  });
});

function remoteItem(id: string, name: string) {
  return {
    id,
    householdId: 'remote-1',
    localId: null,
    name,
    normalizedName: name.toLowerCase(),
    category: null,
    barcode: null,
    createdByMemberId: null,
    createdByDeviceId: null,
    createdAt: '2026-05-17T10:00:00Z',
    updatedAt: '2026-05-17T10:00:00Z',
    deletedAt: null,
  };
}

function remoteEvent(
  id: string,
  itemId: string,
  eventType: 'IN' | 'OUT',
  qty: number,
) {
  return {
    id,
    householdId: 'remote-1',
    itemId,
    localId: null,
    localItemId: null,
    eventType,
    quantityDelta: eventType === 'IN' ? qty : -qty,
    quantityAfter: null,
    source: 'manual',
    occurredAt: '2026-05-17T10:00:00Z',
    createdByMemberId: null,
    createdByDeviceId: null,
    createdAt: '2026-05-17T10:00:00Z',
    updatedAt: '2026-05-17T10:00:00Z',
    deletedAt: null,
  };
}
