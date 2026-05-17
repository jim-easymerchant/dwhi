/**
 * Verifies the local UPDATE helpers that stamp remote ids/role on the
 * existing local household + member rows. DB mocked at the getDb()
 * boundary so no SQLite is involved.
 */

const runAsync = jest.fn();
const getFirstAsync = jest.fn();
const getAllAsync = jest.fn();

jest.mock('@/db/database', () => ({
  getDb: jest.fn(() => Promise.resolve({ runAsync, getFirstAsync, getAllAsync })),
  nowIso: () => '2026-05-17T12:00:00Z',
}));

import {
  findMemberByRemoteUserId,
  setHouseholdRemoteId,
  setMemberRemoteIds,
  updateMemberRole,
} from '../householdRepository';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('setHouseholdRemoteId', () => {
  test('UPDATEs households with the remote_id and bumps updated_at', async () => {
    await setHouseholdRemoteId(1, 'remote-abc');
    const [sql, remoteId, updatedAt, localId] = runAsync.mock.calls[0];
    expect(sql).toContain('UPDATE households');
    expect(sql).toContain('remote_id = ?');
    expect(sql).toContain('updated_at = ?');
    expect(remoteId).toBe('remote-abc');
    expect(typeof updatedAt).toBe('string');
    expect(localId).toBe(1);
  });
});

describe('setMemberRemoteIds', () => {
  test('UPDATEs household_members with both remote ids', async () => {
    await setMemberRemoteIds(10, 'mem-1', 'user-1');
    const [sql, remoteId, remoteUserId, id] = runAsync.mock.calls[0];
    expect(sql).toContain('UPDATE household_members');
    expect(remoteId).toBe('mem-1');
    expect(remoteUserId).toBe('user-1');
    expect(id).toBe(10);
  });

  test('accepts null values (clearing the link)', async () => {
    await setMemberRemoteIds(10, null, null);
    const args = runAsync.mock.calls[0];
    expect(args[1]).toBeNull();
    expect(args[2]).toBeNull();
  });
});

describe('updateMemberRole', () => {
  test('UPDATEs the role column', async () => {
    await updateMemberRole(10, 'owner');
    const [sql, role, id] = runAsync.mock.calls[0];
    expect(sql).toContain('UPDATE household_members');
    expect(sql).toContain('role = ?');
    expect(role).toBe('owner');
    expect(id).toBe(10);
  });
});

describe('findMemberByRemoteUserId', () => {
  test('queries scoped by both household and remote_user_id', async () => {
    getFirstAsync.mockResolvedValue(null);
    await findMemberByRemoteUserId(1, 'user-1');
    const [sql, hh, uid] = getFirstAsync.mock.calls[0];
    expect(sql).toContain('household_id = ?');
    expect(sql).toContain('remote_user_id = ?');
    expect(hh).toBe(1);
    expect(uid).toBe('user-1');
  });

  test('returns the mapped row when present', async () => {
    getFirstAsync.mockResolvedValue({
      id: 99,
      household_id: 1,
      display_name: 'Me',
      role: 'owner',
      local_device_id: null,
      created_at: '2026-05-01T00:00:00Z',
      remote_id: 'mem-1',
      remote_user_id: 'user-1',
    });
    const row = await findMemberByRemoteUserId(1, 'user-1');
    expect(row).toEqual({
      id: 99,
      householdId: 1,
      displayName: 'Me',
      role: 'owner',
      localDeviceId: null,
      createdAt: '2026-05-01T00:00:00Z',
      remoteId: 'mem-1',
      remoteUserId: 'user-1',
    });
  });
});
