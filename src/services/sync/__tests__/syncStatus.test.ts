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

const isSupabaseConfigured = jest.fn(() => false);
jest.mock('@/services/env', () => ({
  isSupabaseConfigured: () => isSupabaseConfigured(),
}));

const getSupabaseClient = jest.fn(() => null);
jest.mock('@/services/supabaseClient', () => ({
  getSupabaseClient: () => getSupabaseClient(),
}));

const getPref: jest.Mock<Promise<string | null>, [string]> = jest.fn(
  async (_key: string) => null,
);
jest.mock('@/repositories/appPrefsRepository', () => ({
  getPref: (key: string) => getPref(key),
}));

import { countPendingChanges, getLastSyncInfo, getSyncMode } from '../syncStatus';

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

  test('counts pending_push AND sync_failed (so retry rows surface)', async () => {
    columnExists.mockResolvedValue(true);
    getFirstAsync.mockResolvedValue({ c: 0 });
    await countPendingChanges();
    // Every per-table SELECT should mention both statuses.
    for (const call of getFirstAsync.mock.calls) {
      const sql = String(call[0]);
      expect(sql).toContain("'pending_push'");
      expect(sql).toContain("'sync_failed'");
    }
  });
});

describe('getLastSyncInfo', () => {
  test('reads both prefs and returns them', async () => {
    getPref.mockImplementation(async (key: string) => {
      if (key === 'sync.last_run_at') return '2026-05-17T12:00:00Z';
      if (key === 'sync.last_error') return 'permission denied';
      return null;
    });
    const r = await getLastSyncInfo();
    expect(r.at).toBe('2026-05-17T12:00:00Z');
    expect(r.error).toBe('permission denied');
  });

  test('returns nulls when no run has happened yet', async () => {
    getPref.mockResolvedValue(null);
    const r = await getLastSyncInfo();
    expect(r).toEqual({ at: null, error: null });
  });
});

describe('getSyncMode', () => {
  test('returns local-only when Supabase is not configured', async () => {
    isSupabaseConfigured.mockReturnValue(false);
    getSupabaseClient.mockReturnValue(null);
    expect(await getSyncMode()).toBe('local-only');
  });

  test('returns configured-signed-out when env is set but no session yet', async () => {
    isSupabaseConfigured.mockReturnValue(true);
    getSupabaseClient.mockReturnValue({
      auth: {
        getSession: jest.fn(async () => ({ data: { session: null } })),
      },
    } as unknown as null);
    expect(await getSyncMode()).toBe('configured-signed-out');
  });

  test('flips to configured-signed-in once auth.getSession returns a session', async () => {
    isSupabaseConfigured.mockReturnValue(true);
    getSupabaseClient.mockReturnValue({
      auth: {
        getSession: jest.fn(async () => ({
          data: { session: { user: { id: 'u1' } } },
        })),
      },
    } as unknown as null);
    expect(await getSyncMode()).toBe('configured-signed-in');
  });

  test('falls back to configured-signed-out when getSession throws', async () => {
    isSupabaseConfigured.mockReturnValue(true);
    getSupabaseClient.mockReturnValue({
      auth: {
        getSession: jest.fn(async () => {
          throw new Error('offline');
        }),
      },
    } as unknown as null);
    expect(await getSyncMode()).toBe('configured-signed-out');
  });
});
