/**
 * countPendingChanges scans every sync-aware table and tolerates older
 * installs whose migration hasn't added the sync_status column yet. The
 * DB layer is mocked at getDb / columnExists.
 */

const getFirstAsync = jest.fn();
const runAsync = jest.fn();
const getAllAsync = jest.fn();
const columnExists = jest.fn();

jest.mock('@/db/database', () => ({
  getDb: jest.fn(() => Promise.resolve({ getFirstAsync, runAsync, getAllAsync })),
  columnExists: (...args: unknown[]) => columnExists(...args),
}));

jest.mock('@/services/env', () => ({
  isSupabaseConfigured: jest.fn(() => false),
}));

jest.mock('@/services/supabaseClient', () => ({
  getSupabaseClient: jest.fn(() => null),
}));

import { countPendingChanges, getSyncMode } from '../syncStatus';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('countPendingChanges', () => {
  test('returns zero for every table when sync_status column is missing', async () => {
    columnExists.mockResolvedValue(false);
    const result = await countPendingChanges();
    expect(result.total).toBe(0);
    for (const v of Object.values(result.byTable)) {
      expect(v).toBe(0);
    }
    expect(getFirstAsync).not.toHaveBeenCalled();
  });

  test('sums per-table counts when the column exists', async () => {
    columnExists.mockResolvedValue(true);
    // Each getFirstAsync call returns the count for one table, in order.
    const counts = [3, 1, 0, 2, 5, 0];
    let i = 0;
    getFirstAsync.mockImplementation(async () => ({ c: counts[i++] }));

    const result = await countPendingChanges();

    expect(result.total).toBe(11);
    expect(getFirstAsync).toHaveBeenCalledTimes(6);
  });

  test('missing PRAGMA on one table doesn\'t poison the rest', async () => {
    // First table missing, rest present.
    let call = 0;
    columnExists.mockImplementation(async () => (call++ === 0 ? false : true));
    getFirstAsync.mockResolvedValue({ c: 2 });

    const result = await countPendingChanges();

    // 5 tables × 2 pending each
    expect(result.total).toBe(10);
    expect(getFirstAsync).toHaveBeenCalledTimes(5);
  });
});

describe('getSyncMode', () => {
  test('returns local-only when Supabase is not configured', async () => {
    expect(await getSyncMode()).toBe('local-only');
  });
});
