/**
 * Verifies the last-owner guard and remove-member call shape. The
 * Supabase client is mocked entirely.
 */

const mockSupabase = {
  from: jest.fn(),
  auth: { getSession: jest.fn() },
};

jest.mock('@/services/supabaseClient', () => ({
  getSupabaseClient: jest.fn(() => mockSupabase),
}));

import {
  listMembersForHousehold,
  removeMember,
  type RemoteMember,
} from '../householdMembersRemoteRepository';

beforeEach(() => {
  jest.clearAllMocks();
});

const baseMember: RemoteMember = {
  id: 'm1',
  householdId: 'h1',
  userId: 'u1',
  displayName: 'Alice',
  role: 'owner',
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-05-01T00:00:00Z',
  deletedAt: null,
  isMe: false,
};

describe('listMembersForHousehold', () => {
  test('marks the current user as isMe', async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'u2' } } },
    });
    const chain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      returns: jest.fn().mockResolvedValue({
        data: [
          { ...rowFromMember(baseMember), user_id: 'u1' },
          { ...rowFromMember(baseMember), id: 'm2', user_id: 'u2' },
        ],
        error: null,
      }),
    };
    mockSupabase.from.mockReturnValue(chain);

    const r = await listMembersForHousehold('h1');

    expect(r.ok).toBe(true);
    expect(r.data?.[0].isMe).toBe(false);
    expect(r.data?.[1].isMe).toBe(true);
  });
});

describe('removeMember', () => {
  test('refuses to remove the only owner', async () => {
    const r = await removeMember(baseMember, [baseMember]);
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/last owner/i);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  test('allows removing an owner when at least one other owner remains', async () => {
    const chain = {
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ error: null }),
    };
    mockSupabase.from.mockReturnValue(chain);
    const other = { ...baseMember, id: 'm2' };
    const r = await removeMember(baseMember, [baseMember, other]);
    expect(r.ok).toBe(true);
    expect(chain.update).toHaveBeenCalledTimes(1);
    const arg = (chain.update as jest.Mock).mock.calls[0][0];
    expect(arg).toHaveProperty('deleted_at');
  });

  test('soft-deletes (sets deleted_at, not DELETE FROM)', async () => {
    const chain = {
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ error: null }),
    };
    mockSupabase.from.mockReturnValue(chain);
    const memberToRemove: RemoteMember = { ...baseMember, role: 'member' };
    await removeMember(memberToRemove, [baseMember, memberToRemove]);
    expect(chain.update).toHaveBeenCalledTimes(1);
    expect(chain.eq).toHaveBeenCalledWith('id', memberToRemove.id);
  });

  test('surfaces RLS denial as a friendly error', async () => {
    const chain = {
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({
        error: { message: 'permission denied for table household_members' },
      }),
    };
    mockSupabase.from.mockReturnValue(chain);
    const memberToRemove: RemoteMember = { ...baseMember, role: 'member' };
    const r = await removeMember(memberToRemove, [baseMember, memberToRemove]);
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/permission denied/);
  });
});

function rowFromMember(m: RemoteMember) {
  return {
    id: m.id,
    household_id: m.householdId,
    user_id: m.userId,
    display_name: m.displayName,
    role: m.role,
    created_at: m.createdAt,
    updated_at: m.updatedAt,
    deleted_at: m.deletedAt,
  };
}
