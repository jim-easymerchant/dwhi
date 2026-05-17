/**
 * Tests the createRemoteHousehold + listMembershipsForCurrentUser
 * surface that the post-sign-in bootstrap depends on. The Supabase
 * client is mocked at the boundary — no network IO, no RLS, no SQL.
 */

const mockSupabase = {
  from: jest.fn(),
  auth: { getSession: jest.fn() },
};

jest.mock('@/services/supabaseClient', () => ({
  getSupabaseClient: jest.fn(() => mockSupabase),
}));

import {
  createRemoteHousehold,
  getRemoteHouseholdById,
  listMembershipsForCurrentUser,
} from '../householdsRemoteRepository';

beforeEach(() => {
  jest.clearAllMocks();
});

function householdSelectChain(maybeRow: Record<string, unknown> | null) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: maybeRow, error: null }),
  };
}

function membershipsListChain(rows: Record<string, unknown>[]) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    returns: jest.fn().mockResolvedValue({ data: rows, error: null }),
  };
}

function membershipsErrorChain(message: string) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    returns: jest
      .fn()
      .mockResolvedValue({ data: null, error: { message } }),
  };
}

describe('listMembershipsForCurrentUser', () => {
  test('returns ok:false when no session', async () => {
    mockSupabase.auth.getSession.mockResolvedValue({ data: { session: null } });
    const r = await listMembershipsForCurrentUser();
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/sign in/i);
  });

  test('queries household_members scoped to the auth user', async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'user-1' } } },
    });
    const chain = membershipsListChain([
      {
        id: 'm1',
        household_id: 'h1',
        user_id: 'user-1',
        display_name: 'Alice',
        role: 'owner',
        created_at: '2026-05-01T00:00:00Z',
        deleted_at: null,
      },
    ]);
    mockSupabase.from.mockReturnValue(chain);
    const r = await listMembershipsForCurrentUser();
    expect(r.ok).toBe(true);
    expect(mockSupabase.from).toHaveBeenCalledWith('household_members');
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(chain.is).toHaveBeenCalledWith('deleted_at', null);
    expect(r.data).toHaveLength(1);
    expect(r.data?.[0]).toEqual({
      id: 'm1',
      householdId: 'h1',
      userId: 'user-1',
      displayName: 'Alice',
      role: 'owner',
      createdAt: '2026-05-01T00:00:00Z',
    });
  });

  test('surfaces Supabase errors verbatim', async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'user-1' } } },
    });
    mockSupabase.from.mockReturnValue(
      membershipsErrorChain('permission denied for table household_members'),
    );
    const r = await listMembershipsForCurrentUser();
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/permission denied/);
  });
});

describe('getRemoteHouseholdById', () => {
  test('returns ok:true with data:null when RLS hides the row', async () => {
    mockSupabase.from.mockReturnValue(householdSelectChain(null));
    const r = await getRemoteHouseholdById('h1');
    expect(r.ok).toBe(true);
    expect(r.data).toBeNull();
  });

  test('maps the row when present', async () => {
    mockSupabase.from.mockReturnValue(
      householdSelectChain({
        id: 'h1',
        name: 'My Household',
        created_at: '2026-05-01T00:00:00Z',
        updated_at: '2026-05-01T00:00:00Z',
        deleted_at: null,
      }),
    );
    const r = await getRemoteHouseholdById('h1');
    expect(r.ok).toBe(true);
    expect(r.data?.name).toBe('My Household');
  });

  test('rejects empty id without a network call', async () => {
    const r = await getRemoteHouseholdById('');
    expect(r.ok).toBe(false);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });
});

describe('createRemoteHousehold', () => {
  test('fails fast when no session', async () => {
    mockSupabase.auth.getSession.mockResolvedValue({ data: { session: null } });
    const r = await createRemoteHousehold({
      remoteHouseholdId: 'h1',
      name: 'My Household',
      ownerDisplayName: 'me',
    });
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/sign in/i);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  test('happy path: inserts household, inserts membership, refetches household', async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'user-1' } } },
    });

    const householdsInsertChain = {
      insert: jest.fn().mockResolvedValue({ error: null }),
    };
    const membersInsertChain = {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          id: 'mem-1',
          household_id: 'h1',
          user_id: 'user-1',
          display_name: 'alice',
          role: 'owner',
          created_at: '2026-05-17T00:00:00Z',
          deleted_at: null,
        },
        error: null,
      }),
    };
    const householdsSelectChain = householdSelectChain({
      id: 'h1',
      name: 'My Household',
      created_at: '2026-05-17T00:00:00Z',
      updated_at: '2026-05-17T00:00:00Z',
      deleted_at: null,
    });

    mockSupabase.from
      .mockReturnValueOnce(householdsInsertChain) // step 1
      .mockReturnValueOnce(membersInsertChain) // step 2
      .mockReturnValueOnce(householdsSelectChain); // step 3

    const r = await createRemoteHousehold({
      remoteHouseholdId: 'h1',
      name: 'My Household',
      ownerDisplayName: 'alice',
    });

    expect(r.ok).toBe(true);
    expect(r.data?.household.id).toBe('h1');
    expect(r.data?.ownerMembership.role).toBe('owner');

    // Step 1: household insert with our chosen id.
    expect(householdsInsertChain.insert).toHaveBeenCalledWith({
      id: 'h1',
      name: 'My Household',
    });
    // Step 2: membership insert with role 'owner' + the auth user id.
    expect(membersInsertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        household_id: 'h1',
        user_id: 'user-1',
        role: 'owner',
      }),
    );
  });

  test('surfaces household INSERT error and does not call membership INSERT', async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'user-1' } } },
    });
    const householdsInsertChain = {
      insert: jest
        .fn()
        .mockResolvedValue({ error: { message: 'duplicate id' } }),
    };
    mockSupabase.from.mockReturnValueOnce(householdsInsertChain);

    const r = await createRemoteHousehold({
      remoteHouseholdId: 'h1',
      name: 'X',
      ownerDisplayName: 'me',
    });
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/duplicate/i);
    expect(mockSupabase.from).toHaveBeenCalledTimes(1);
  });

  test('surfaces membership INSERT error after a successful household INSERT', async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'user-1' } } },
    });
    const householdsInsertChain = {
      insert: jest.fn().mockResolvedValue({ error: null }),
    };
    const membersInsertChain = {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest
        .fn()
        .mockResolvedValue({ data: null, error: { message: 'RLS denied' } }),
    };
    mockSupabase.from
      .mockReturnValueOnce(householdsInsertChain)
      .mockReturnValueOnce(membersInsertChain);

    const r = await createRemoteHousehold({
      remoteHouseholdId: 'h1',
      name: 'X',
      ownerDisplayName: 'me',
    });
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/RLS denied/);
  });
});
