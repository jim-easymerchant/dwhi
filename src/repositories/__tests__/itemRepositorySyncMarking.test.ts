/**
 * Verifies the items repository stamps the right sync_status on
 * insert/update depending on whether the active household is linked
 * to a remote one, and emits an auto-sync request afterwards.
 */

const runAsync = jest.fn();
const getFirstAsync = jest.fn();
const getAllAsync = jest.fn();

jest.mock('@/db/database', () => ({
  getDb: jest.fn(() => Promise.resolve({ runAsync, getFirstAsync, getAllAsync })),
  nowIso: () => '2026-05-17T12:00:00Z',
}));

const requestAutoSync = jest.fn();
jest.mock('@/services/sync/autoSync', () => ({
  requestAutoSync: (...args: unknown[]) => requestAutoSync(...args),
}));

import { createItem, upsertItem } from '../itemRepository';
import {
  clearActiveHouseholdContext,
  setActiveHouseholdContextForTests,
} from '@/services/householdContext';
import { setActiveHouseholdContext } from '@/services/householdContext';

beforeEach(() => {
  jest.clearAllMocks();
});
afterEach(() => {
  clearActiveHouseholdContext();
});

describe('createItem sync_status', () => {
  test('marks local_only when active household has no remoteId', async () => {
    setActiveHouseholdContextForTests({ householdId: 7, memberId: 1, deviceId: 1 });
    runAsync.mockResolvedValue({ lastInsertRowId: 1 });
    await createItem({
      manufacturer: null,
      name: 'Milk',
      category: null,
      containerType: null,
      size: null,
      canonicalKey: 'milk',
      barcode: null,
      source: null,
      rawLookupJson: null,
    });
    const args = runAsync.mock.calls[0];
    expect(args[args.length - 1]).toBe('local_only');
    expect(requestAutoSync).toHaveBeenCalledWith('item-write');
  });

  test('marks pending_push when active household has a remoteId', async () => {
    setActiveHouseholdContext({
      household: {
        id: 7,
        name: 'X',
        createdAt: 'x',
        updatedAt: 'x',
        remoteId: 'remote-1',
      },
      member: {
        id: 1,
        householdId: 7,
        displayName: 'Me',
        role: 'owner',
        localDeviceId: 1,
        createdAt: 'x',
        remoteId: 'mem-1',
        remoteUserId: 'u1',
      },
      device: {
        id: 1,
        householdId: 7,
        deviceName: 'dev',
        deviceUuid: 'duuid',
        createdAt: 'x',
        lastSeenAt: 'x',
      },
    });
    runAsync.mockResolvedValue({ lastInsertRowId: 1 });
    await createItem({
      manufacturer: null,
      name: 'Eggs',
      category: null,
      containerType: null,
      size: null,
      canonicalKey: 'eggs',
      barcode: null,
      source: null,
      rawLookupJson: null,
    });
    const args = runAsync.mock.calls[0];
    expect(args[args.length - 1]).toBe('pending_push');
  });
});

describe('upsertItem sync_status', () => {
  test('UPDATE path also stamps pending_push when linked', async () => {
    setActiveHouseholdContext({
      household: {
        id: 7, name: 'X', createdAt: 'x', updatedAt: 'x', remoteId: 'remote-1',
      },
      member: {
        id: 1, householdId: 7, displayName: 'Me', role: 'owner',
        localDeviceId: 1, createdAt: 'x', remoteId: 'mem-1', remoteUserId: 'u1',
      },
      device: {
        id: 1, householdId: 7, deviceName: 'dev', deviceUuid: 'duuid',
        createdAt: 'x', lastSeenAt: 'x',
      },
    });
    // Only findByCanonicalKey runs (barcode is null → findByBarcode is
    // skipped before it reaches the DB).
    getFirstAsync.mockResolvedValue({
      id: 5,
      manufacturer: null,
      name: 'Milk',
      category: null,
      container_type: null,
      size: null,
      canonical_key: 'milk',
      barcode: null,
      source: null,
      raw_lookup_json: null,
      created_at: 'x',
      updated_at: 'x',
      household_id: 7,
    });
    runAsync.mockResolvedValue({ lastInsertRowId: 5 });
    await upsertItem({
      manufacturer: null,
      name: 'Milk',
      category: null,
      containerType: null,
      size: null,
      canonicalKey: 'milk',
      barcode: null,
      source: null,
      rawLookupJson: null,
    });
    const updateCall = runAsync.mock.calls[0];
    expect(updateCall[0]).toContain('UPDATE items');
    expect(updateCall[0]).toContain('sync_status = ?');
    // sync_status is the second-to-last arg before WHERE binds (id, household_id).
    // Easier: just assert pending_push is somewhere in the args.
    expect(updateCall).toContain('pending_push');
    expect(requestAutoSync).toHaveBeenCalledWith('item-write');
  });
});
