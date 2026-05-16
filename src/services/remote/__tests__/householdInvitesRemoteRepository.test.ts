/**
 * Tests the pure parts of the invite-code logic + the orchestration of
 * acceptInvite. The Supabase client is mocked entirely; we only assert
 * the shape of calls and the branching.
 */

const mockSupabase = {
  from: jest.fn(),
  auth: { getSession: jest.fn() },
};

jest.mock('@/services/supabaseClient', () => ({
  getSupabaseClient: jest.fn(() => mockSupabase),
}));

import {
  acceptInvite,
  createInvite,
  findInviteByCode,
  generateInviteCode,
  normalizeInviteCode,
  revokeInvite,
  validateInvite,
  type RemoteInvite,
} from '../householdInvitesRemoteRepository';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('generateInviteCode', () => {
  test('returns 12 chars from the unambiguous alphabet (no 0/O/1/I)', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateInviteCode();
      expect(code).toHaveLength(12);
      // Alphabet = A-H, J-N, P-Z, 2-9 (no 0/1/I/O to avoid visual ambiguity).
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]+$/);
    }
  });

  test('codes are not all identical across many calls', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 100; i++) codes.add(generateInviteCode());
    expect(codes.size).toBeGreaterThan(95);
  });
});

describe('normalizeInviteCode', () => {
  test.each([
    ['abc def 123', 'ABCDEF123'],
    ['  ab-cd_ef  ', 'ABCDEF'],
    ['', ''],
    ['ABC123', 'ABC123'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeInviteCode(input)).toBe(expected);
  });
});

describe('validateInvite', () => {
  const base: RemoteInvite = {
    id: 'i1',
    householdId: 'h1',
    inviteCode: 'CODE',
    createdByMemberId: null,
    acceptedByUserId: null,
    acceptedAt: null,
    expiresAt: null,
    revokedAt: null,
    createdAt: '2026-05-01T00:00:00Z',
    updatedAt: '2026-05-01T00:00:00Z',
  };

  test('null invite → not_found', () => {
    expect(validateInvite(null)).toBe('not_found');
  });
  test('already accepted → already_accepted', () => {
    expect(validateInvite({ ...base, acceptedByUserId: 'u1' })).toBe(
      'already_accepted',
    );
  });
  test('revoked → revoked', () => {
    expect(validateInvite({ ...base, revokedAt: '2026-05-02T00:00:00Z' })).toBe(
      'revoked',
    );
  });
  test('expired → expired', () => {
    const now = Date.parse('2026-05-10T00:00:00Z');
    expect(
      validateInvite({ ...base, expiresAt: '2026-05-09T00:00:00Z' }, now),
    ).toBe('expired');
  });
  test('still-valid invite → null', () => {
    const now = Date.parse('2026-05-10T00:00:00Z');
    expect(
      validateInvite({ ...base, expiresAt: '2026-06-01T00:00:00Z' }, now),
    ).toBeNull();
  });
});

describe('createInvite', () => {
  test('happy path: inserts a row + returns the generated code', async () => {
    const insertChain = {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          id: 'i1',
          household_id: 'h1',
          invite_code: 'ABCDEFGHJKMN',
          created_by_member_id: null,
          accepted_by_user_id: null,
          accepted_at: null,
          expires_at: null,
          revoked_at: null,
          created_at: '2026-05-01T00:00:00Z',
          updated_at: '2026-05-01T00:00:00Z',
        },
        error: null,
      }),
    };
    mockSupabase.from.mockReturnValue(insertChain);

    const r = await createInvite({ remoteHouseholdId: 'h1' });

    expect(r.ok).toBe(true);
    expect(r.data?.inviteCode).toBe('ABCDEFGHJKMN');
    expect(insertChain.insert).toHaveBeenCalledTimes(1);
    const arg = (insertChain.insert as jest.Mock).mock.calls[0][0];
    expect(arg.household_id).toBe('h1');
    expect(arg.invite_code).toHaveLength(12);
  });

  test('returns the error message on RLS denial', async () => {
    mockSupabase.from.mockReturnValue({
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'new row violates row-level security policy' },
      }),
    });

    const r = await createInvite({ remoteHouseholdId: 'h1' });

    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/row-level security/);
  });
});

describe('findInviteByCode', () => {
  test('normalizes the code before querying', async () => {
    const chain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    };
    mockSupabase.from.mockReturnValue(chain);

    await findInviteByCode(' ab-cd  ef ');

    expect(chain.eq).toHaveBeenCalledWith('invite_code', 'ABCDEF');
  });

  test('empty code short-circuits', async () => {
    const chain = { select: jest.fn(), eq: jest.fn(), maybeSingle: jest.fn() };
    mockSupabase.from.mockReturnValue(chain);
    const r = await findInviteByCode('  ');
    expect(r.ok).toBe(false);
    expect(chain.select).not.toHaveBeenCalled();
  });
});

describe('acceptInvite', () => {
  test('rejects already-accepted invites without touching Supabase', async () => {
    const r = await acceptInvite(
      {
        id: 'i1',
        householdId: 'h1',
        inviteCode: 'CODE',
        createdByMemberId: null,
        acceptedByUserId: 'someone-else',
        acceptedAt: '2026-05-01T00:00:00Z',
        expiresAt: null,
        revokedAt: null,
        createdAt: '2026-05-01T00:00:00Z',
        updatedAt: '2026-05-01T00:00:00Z',
      },
      'Member Name',
    );
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/already been used/);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  test('signed-out user → asks to sign in', async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    const invite: RemoteInvite = {
      id: 'i1',
      householdId: 'h1',
      inviteCode: 'CODE',
      createdByMemberId: null,
      acceptedByUserId: null,
      acceptedAt: null,
      expiresAt: null,
      revokedAt: null,
      createdAt: '2026-05-01T00:00:00Z',
      updatedAt: '2026-05-01T00:00:00Z',
    };

    const r = await acceptInvite(invite, 'Member Name');

    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/sign in/i);
  });

  test('happy path inserts a member, flips the invite, returns ok', async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'u1' } } },
      error: null,
    });
    const memberInsert = {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest
        .fn()
        .mockResolvedValue({ data: { id: 'm1' }, error: null }),
    };
    const inviteUpdate = {
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          id: 'i1',
          household_id: 'h1',
          invite_code: 'CODE',
          created_by_member_id: null,
          accepted_by_user_id: 'u1',
          accepted_at: '2026-05-10T00:00:00Z',
          expires_at: null,
          revoked_at: null,
          created_at: '2026-05-01T00:00:00Z',
          updated_at: '2026-05-10T00:00:00Z',
        },
        error: null,
      }),
    };
    mockSupabase.from
      .mockReturnValueOnce(memberInsert)
      .mockReturnValueOnce(inviteUpdate);

    const r = await acceptInvite(
      {
        id: 'i1',
        householdId: 'h1',
        inviteCode: 'CODE',
        createdByMemberId: null,
        acceptedByUserId: null,
        acceptedAt: null,
        expiresAt: null,
        revokedAt: null,
        createdAt: '2026-05-01T00:00:00Z',
        updatedAt: '2026-05-01T00:00:00Z',
      },
      'Member Name',
    );

    expect(r.ok).toBe(true);
    expect(r.data?.newMemberId).toBe('m1');
    expect(memberInsert.insert).toHaveBeenCalledTimes(1);
    const insertedMember = (memberInsert.insert as jest.Mock).mock.calls[0][0];
    expect(insertedMember).toEqual(
      expect.objectContaining({
        household_id: 'h1',
        user_id: 'u1',
        role: 'member',
      }),
    );
  });
});

describe('revokeInvite', () => {
  test('soft-deletes via revoked_at = now', async () => {
    const chain = {
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          id: 'i1',
          household_id: 'h1',
          invite_code: 'CODE',
          created_by_member_id: null,
          accepted_by_user_id: null,
          accepted_at: null,
          expires_at: null,
          revoked_at: '2026-05-10T00:00:00Z',
          created_at: '2026-05-01T00:00:00Z',
          updated_at: '2026-05-10T00:00:00Z',
        },
        error: null,
      }),
    };
    mockSupabase.from.mockReturnValue(chain);

    const r = await revokeInvite('i1');

    expect(r.ok).toBe(true);
    const arg = (chain.update as jest.Mock).mock.calls[0][0];
    expect(arg).toHaveProperty('revoked_at');
    expect(typeof arg.revoked_at).toBe('string');
  });
});
