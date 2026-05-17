/**
 * Tests the post-sign-in household convergence service. Mocks at every
 * Supabase / repository boundary so the policy logic is the only thing
 * under test.
 */

import type { ActiveHouseholdContext } from '@/types/models';

const getCurrentSession = jest.fn();
const getActiveContextOrNull = jest.fn();
const setActiveHouseholdContext = jest.fn();
const listMembershipsForCurrentUser = jest.fn();
const getRemoteHouseholdById = jest.fn();
const createRemoteHousehold = jest.fn();
const findHouseholdByRemoteId = jest.fn();
const findMemberByRemoteUserId = jest.fn();
const setHouseholdRemoteId = jest.fn();
const setMemberRemoteIds = jest.fn();
const updateMemberRole = jest.fn();
const switchActiveHouseholdToRemote = jest.fn();

jest.mock('@/services/auth/authService', () => ({
  getCurrentSession: () => getCurrentSession(),
}));

jest.mock('@/services/householdContext', () => ({
  getActiveContextOrNull: () => getActiveContextOrNull(),
  setActiveHouseholdContext: (...args: unknown[]) =>
    setActiveHouseholdContext(...args),
}));

jest.mock('@/services/remote/householdsRemoteRepository', () => ({
  listMembershipsForCurrentUser: (...args: unknown[]) =>
    listMembershipsForCurrentUser(...args),
  getRemoteHouseholdById: (...args: unknown[]) =>
    getRemoteHouseholdById(...args),
  createRemoteHousehold: (...args: unknown[]) => createRemoteHousehold(...args),
}));

jest.mock('@/repositories/householdRepository', () => ({
  findHouseholdByRemoteId: (...args: unknown[]) =>
    findHouseholdByRemoteId(...args),
  findMemberByRemoteUserId: (...args: unknown[]) =>
    findMemberByRemoteUserId(...args),
  setHouseholdRemoteId: (...args: unknown[]) => setHouseholdRemoteId(...args),
  setMemberRemoteIds: (...args: unknown[]) => setMemberRemoteIds(...args),
  updateMemberRole: (...args: unknown[]) => updateMemberRole(...args),
}));

jest.mock('@/services/householdSwitch', () => ({
  switchActiveHouseholdToRemote: (...args: unknown[]) =>
    switchActiveHouseholdToRemote(...args),
}));

import { ensureRemoteHousehold } from '../remoteHouseholdBootstrap';

beforeEach(() => {
  jest.clearAllMocks();
});

function makeCtx(over: Partial<ActiveHouseholdContext> = {}): ActiveHouseholdContext {
  return {
    household: {
      id: 1,
      name: 'My Household',
      createdAt: '2026-05-01T00:00:00Z',
      updatedAt: '2026-05-01T00:00:00Z',
      remoteId: null,
      ...over.household,
    },
    member: {
      id: 10,
      householdId: 1,
      displayName: 'Me',
      role: 'owner',
      localDeviceId: 100,
      createdAt: '2026-05-01T00:00:00Z',
      remoteId: null,
      remoteUserId: null,
      ...over.member,
    },
    device: {
      id: 100,
      householdId: 1,
      deviceName: 'This device',
      deviceUuid: 'uuid-100',
      createdAt: '2026-05-01T00:00:00Z',
      lastSeenAt: '2026-05-01T00:00:00Z',
      ...over.device,
    },
  };
}

describe('ensureRemoteHousehold', () => {
  test('returns ok:true with unauthenticated action when no session and not expectAuthenticated', async () => {
    getCurrentSession.mockResolvedValue(null);
    getActiveContextOrNull.mockReturnValue(makeCtx());
    const r = await ensureRemoteHousehold();
    expect(r.ok).toBe(true);
    expect(r.action).toBe('unauthenticated');
  });

  test('returns ok:false when expectAuthenticated and no session', async () => {
    getCurrentSession.mockResolvedValue(null);
    getActiveContextOrNull.mockReturnValue(makeCtx());
    const r = await ensureRemoteHousehold({ expectAuthenticated: true });
    expect(r.ok).toBe(false);
    expect(r.action).toBe('unauthenticated');
  });

  test('returns ok:false when no local context exists (pre-bootstrap)', async () => {
    getCurrentSession.mockResolvedValue({ user: { id: 'u1', email: 'a@b.co' } });
    getActiveContextOrNull.mockReturnValue(null);
    const r = await ensureRemoteHousehold({ expectAuthenticated: true });
    expect(r.ok).toBe(false);
  });

  test('first-time user: creates remote household and stamps local IDs', async () => {
    getCurrentSession.mockResolvedValue({
      user: { id: 'u1', email: 'alice@example.com' },
    });
    getActiveContextOrNull.mockReturnValue(makeCtx());
    listMembershipsForCurrentUser.mockResolvedValue({ ok: true, data: [] });
    createRemoteHousehold.mockResolvedValue({
      ok: true,
      message: 'ok',
      data: {
        household: {
          id: 'remote-uuid-1',
          name: 'My Household',
          createdAt: '2026-05-17T00:00:00Z',
          updatedAt: '2026-05-17T00:00:00Z',
          deletedAt: null,
        },
        ownerMembership: {
          id: 'remote-mem-1',
          householdId: 'remote-uuid-1',
          userId: 'u1',
          displayName: 'alice',
          role: 'owner',
          createdAt: '2026-05-17T00:00:00Z',
        },
      },
    });

    const r = await ensureRemoteHousehold({ expectAuthenticated: true });

    expect(r.ok).toBe(true);
    expect(r.action).toBe('created-new');
    expect(r.createdRemoteHouseholdId).toBe('remote-uuid-1');
    // Local household stamped with remote id.
    expect(setHouseholdRemoteId).toHaveBeenCalledWith(1, 'remote-uuid-1');
    // Local member stamped with both remote ids.
    expect(setMemberRemoteIds).toHaveBeenCalledWith(10, 'remote-mem-1', 'u1');
    // Local role was already 'owner', so no role update.
    expect(updateMemberRole).not.toHaveBeenCalled();
    // The context was republished with the new remote ids.
    expect(setActiveHouseholdContext).toHaveBeenCalledTimes(1);
    const ctxArg = setActiveHouseholdContext.mock.calls[0][0];
    expect(ctxArg.household.remoteId).toBe('remote-uuid-1');
    expect(ctxArg.member.remoteId).toBe('remote-mem-1');
    expect(ctxArg.member.remoteUserId).toBe('u1');
  });

  test('first-time user: derives owner display name from email local-part', async () => {
    getCurrentSession.mockResolvedValue({
      user: { id: 'u1', email: 'bob.test@example.com' },
    });
    getActiveContextOrNull.mockReturnValue(makeCtx());
    listMembershipsForCurrentUser.mockResolvedValue({ ok: true, data: [] });
    createRemoteHousehold.mockResolvedValue({
      ok: true,
      data: {
        household: { id: 'h', name: 'My Household', createdAt: 'x', updatedAt: 'x', deletedAt: null },
        ownerMembership: { id: 'm', householdId: 'h', userId: 'u1', displayName: 'bob.test', role: 'owner', createdAt: 'x' },
      },
    });

    await ensureRemoteHousehold({ expectAuthenticated: true });

    const callArg = createRemoteHousehold.mock.calls[0][0];
    expect(callArg.ownerDisplayName).toBe('bob.test');
  });

  test('returns failure verbatim when remote household creation fails', async () => {
    getCurrentSession.mockResolvedValue({ user: { id: 'u1', email: 'a@b.co' } });
    getActiveContextOrNull.mockReturnValue(makeCtx());
    listMembershipsForCurrentUser.mockResolvedValue({ ok: true, data: [] });
    createRemoteHousehold.mockResolvedValue({
      ok: false,
      message: 'permission denied',
    });
    const r = await ensureRemoteHousehold({ expectAuthenticated: true });
    expect(r.ok).toBe(false);
    expect(r.action).toBe('created-new');
    expect(r.message).toBe('permission denied');
    expect(setHouseholdRemoteId).not.toHaveBeenCalled();
    expect(setMemberRemoteIds).not.toHaveBeenCalled();
  });

  test('returning user (one remote owner-membership): links existing local household', async () => {
    getCurrentSession.mockResolvedValue({ user: { id: 'u1', email: 'a@b.co' } });
    getActiveContextOrNull.mockReturnValue(makeCtx());
    listMembershipsForCurrentUser.mockResolvedValue({
      ok: true,
      data: [
        {
          id: 'mem-1',
          householdId: 'remote-1',
          userId: 'u1',
          displayName: 'a',
          role: 'owner',
          createdAt: '2026-05-10T00:00:00Z',
        },
      ],
    });
    findHouseholdByRemoteId.mockResolvedValue(null);
    findMemberByRemoteUserId.mockResolvedValue(null);

    const r = await ensureRemoteHousehold({ expectAuthenticated: true });

    expect(r.ok).toBe(true);
    expect(r.action).toBe('linked-existing');
    expect(setHouseholdRemoteId).toHaveBeenCalledWith(1, 'remote-1');
    expect(setMemberRemoteIds).toHaveBeenCalledWith(10, 'mem-1', 'u1');
    expect(createRemoteHousehold).not.toHaveBeenCalled();
  });

  test('returning user with existing local shadow: switches to it instead of double-stamping', async () => {
    getCurrentSession.mockResolvedValue({ user: { id: 'u1', email: 'a@b.co' } });
    getActiveContextOrNull.mockReturnValue(makeCtx());
    listMembershipsForCurrentUser.mockResolvedValue({
      ok: true,
      data: [
        {
          id: 'mem-2',
          householdId: 'remote-2',
          userId: 'u1',
          displayName: 'a',
          role: 'member',
          createdAt: '2026-05-10T00:00:00Z',
        },
      ],
    });
    findHouseholdByRemoteId.mockResolvedValue({
      id: 2,
      name: 'Shared',
      createdAt: 'x',
      updatedAt: 'x',
      remoteId: 'remote-2',
    });
    switchActiveHouseholdToRemote.mockResolvedValue(
      makeCtx({
        household: {
          id: 2,
          name: 'Shared',
          createdAt: 'x',
          updatedAt: 'x',
          remoteId: 'remote-2',
        },
      }),
    );

    const r = await ensureRemoteHousehold({ expectAuthenticated: true });

    expect(r.ok).toBe(true);
    expect(r.action).toBe('switched-to-existing');
    expect(switchActiveHouseholdToRemote).toHaveBeenCalledWith(
      expect.objectContaining({
        remoteHouseholdId: 'remote-2',
        remoteUserId: 'u1',
        remoteMemberId: 'mem-2',
      }),
    );
    expect(setHouseholdRemoteId).not.toHaveBeenCalled();
  });

  test('multiple memberships: prefers an owner role over membership', async () => {
    getCurrentSession.mockResolvedValue({ user: { id: 'u1', email: 'a@b.co' } });
    getActiveContextOrNull.mockReturnValue(makeCtx());
    listMembershipsForCurrentUser.mockResolvedValue({
      ok: true,
      data: [
        {
          id: 'mem-member',
          householdId: 'remote-member',
          userId: 'u1',
          displayName: 'a',
          role: 'member',
          createdAt: '2026-05-01T00:00:00Z',
        },
        {
          id: 'mem-owner',
          householdId: 'remote-owner',
          userId: 'u1',
          displayName: 'a',
          role: 'owner',
          createdAt: '2026-05-15T00:00:00Z',
        },
      ],
    });
    findHouseholdByRemoteId.mockResolvedValue(null);
    findMemberByRemoteUserId.mockResolvedValue(null);

    const r = await ensureRemoteHousehold({ expectAuthenticated: true });

    expect(r.ok).toBe(true);
    expect(setHouseholdRemoteId).toHaveBeenCalledWith(1, 'remote-owner');
  });

  test('already linked: no-op, just refreshes', async () => {
    getCurrentSession.mockResolvedValue({ user: { id: 'u1', email: 'a@b.co' } });
    getActiveContextOrNull.mockReturnValue(
      makeCtx({
        household: {
          id: 1,
          name: 'X',
          createdAt: 'x',
          updatedAt: 'x',
          remoteId: 'remote-1',
        },
        member: {
          id: 10,
          householdId: 1,
          displayName: 'Me',
          role: 'owner',
          localDeviceId: null,
          createdAt: 'x',
          remoteId: 'mem-1',
          remoteUserId: 'u1',
        },
      }),
    );
    getRemoteHouseholdById.mockResolvedValue({
      ok: true,
      data: {
        id: 'remote-1',
        name: 'X',
        createdAt: 'x',
        updatedAt: 'x',
        deletedAt: null,
      },
    });

    const r = await ensureRemoteHousehold({ expectAuthenticated: true });
    expect(r.ok).toBe(true);
    expect(r.action).toBe('noop-already-linked');
    expect(createRemoteHousehold).not.toHaveBeenCalled();
    expect(setHouseholdRemoteId).not.toHaveBeenCalled();
  });

  test('already linked but remote row vanished: returns failure with explanation', async () => {
    getCurrentSession.mockResolvedValue({ user: { id: 'u1', email: 'a@b.co' } });
    getActiveContextOrNull.mockReturnValue(
      makeCtx({
        household: {
          id: 1,
          name: 'X',
          createdAt: 'x',
          updatedAt: 'x',
          remoteId: 'remote-zombie',
        },
      }),
    );
    getRemoteHouseholdById.mockResolvedValue({ ok: true, data: null });

    const r = await ensureRemoteHousehold({ expectAuthenticated: true });
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/no longer visible/i);
  });
});
