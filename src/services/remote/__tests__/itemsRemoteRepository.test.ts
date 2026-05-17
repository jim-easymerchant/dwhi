/**
 * Verifies the Supabase items repo: upsert shape, RLS error surfacing,
 * pull cursor, and that user content is mapped without ever appearing
 * in log lines.
 */

const mockSupabase = { from: jest.fn() };
jest.mock('@/services/supabaseClient', () => ({
  getSupabaseClient: jest.fn(() => mockSupabase),
}));

import {
  listItemsForHouseholdSince,
  upsertItems,
} from '../itemsRemoteRepository';

function upsertChain(result: { data?: unknown; error?: { message: string } | null }) {
  return {
    upsert: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    returns: jest.fn().mockResolvedValue(result),
  };
}

function selectChain(result: { data?: unknown; error?: { message: string } | null }) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    returns: jest.fn().mockResolvedValue(result),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('upsertItems', () => {
  test('passes mapped rows to .upsert with onConflict:id', async () => {
    const chain = upsertChain({
      data: [
        {
          id: 'rid-1',
          household_id: 'hh-1',
          local_id: '7',
          name: 'Milk',
          normalized_name: 'milk',
          category: null,
          barcode: null,
          photo_uri: null,
          notes: null,
          quantity: null,
          unit: null,
          confidence: null,
          created_by_member_id: null,
          created_by_device_id: 'duuid',
          created_at: '2026-05-17T11:00:00Z',
          updated_at: '2026-05-17T11:00:00Z',
          deleted_at: null,
        },
      ],
      error: null,
    });
    mockSupabase.from.mockReturnValue(chain);

    const r = await upsertItems([
      {
        id: 'rid-1',
        householdId: 'hh-1',
        localId: '7',
        name: 'Milk',
        normalizedName: 'milk',
        category: null,
        barcode: null,
        createdByMemberId: null,
        createdByDeviceId: 'duuid',
        createdAt: '2026-05-17T11:00:00Z',
        updatedAt: '2026-05-17T11:00:00Z',
        deletedAt: null,
      },
    ]);

    expect(r.ok).toBe(true);
    expect(r.data?.[0].id).toBe('rid-1');
    const upsertCall = chain.upsert.mock.calls[0];
    expect(upsertCall[1]).toEqual({ onConflict: 'id' });
    expect(upsertCall[0][0]).toMatchObject({
      id: 'rid-1',
      household_id: 'hh-1',
      local_id: '7',
      name: 'Milk',
    });
  });

  test('returns ok with no remote round-trip on empty input', async () => {
    const r = await upsertItems([]);
    expect(r.ok).toBe(true);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  test('surfaces RLS / network error message', async () => {
    const chain = upsertChain({
      data: null,
      error: { message: 'permission denied for table items' },
    });
    mockSupabase.from.mockReturnValue(chain);

    const r = await upsertItems([
      {
        id: 'rid-1',
        householdId: 'hh-1',
        localId: null,
        name: 'X',
        normalizedName: 'x',
        category: null,
        barcode: null,
        createdByMemberId: null,
        createdByDeviceId: null,
        createdAt: 'x',
        updatedAt: 'x',
        deletedAt: null,
      },
    ]);
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/permission denied/);
  });

  test('logs never include user content (name)', async () => {
    const logs: string[] = [];
    const log = jest.spyOn(console, 'log').mockImplementation((...a) => {
      logs.push(a.map(String).join(' '));
    });
    const warn = jest.spyOn(console, 'warn').mockImplementation((...a) => {
      logs.push(a.map(String).join(' '));
    });
    const chain = upsertChain({
      data: [{ id: 'rid-1', name: 'TOPSECRETPRODUCT', updated_at: 'x', created_at: 'x' }],
      error: null,
    });
    mockSupabase.from.mockReturnValue(chain);
    await upsertItems([
      {
        id: 'rid-1',
        householdId: 'hh-1',
        localId: null,
        name: 'TOPSECRETPRODUCT',
        normalizedName: null,
        category: null,
        barcode: null,
        createdByMemberId: null,
        createdByDeviceId: null,
        createdAt: 'x',
        updatedAt: 'x',
        deletedAt: null,
      },
    ]);
    for (const line of logs) {
      expect(line).not.toContain('TOPSECRETPRODUCT');
    }
    log.mockRestore();
    warn.mockRestore();
  });
});

describe('listItemsForHouseholdSince', () => {
  test('full backfill when cursor is null (no gt() filter)', async () => {
    const chain = selectChain({ data: [], error: null });
    mockSupabase.from.mockReturnValue(chain);
    const r = await listItemsForHouseholdSince('hh-1', null);
    expect(r.ok).toBe(true);
    expect(chain.gt).not.toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith('household_id', 'hh-1');
  });

  test('applies gt(updated_at, cursor) when cursor is set', async () => {
    const chain = selectChain({ data: [], error: null });
    mockSupabase.from.mockReturnValue(chain);
    await listItemsForHouseholdSince('hh-1', '2026-05-17T10:00:00Z');
    expect(chain.gt).toHaveBeenCalledWith('updated_at', '2026-05-17T10:00:00Z');
  });
});
