import {
  clearActiveHouseholdContext,
  getActiveContextOrNull,
  getActiveDeviceId,
  getActiveHouseholdId,
  getActiveMemberId,
  setActiveHouseholdContext,
  setActiveHouseholdContextForTests,
} from '../householdContext';

beforeEach(() => {
  clearActiveHouseholdContext();
});

describe('householdContext', () => {
  test('returns fallback (1, 1, 1) when not initialized', () => {
    expect(getActiveHouseholdId()).toBe(1);
    expect(getActiveMemberId()).toBe(1);
    expect(getActiveDeviceId()).toBe(1);
    expect(getActiveContextOrNull()).toBeNull();
  });

  test('setActiveHouseholdContext publishes the IDs to every getter', () => {
    setActiveHouseholdContext({
      household: {
        id: 9,
        name: 'Shared House',
        createdAt: '2026-05-01T00:00:00Z',
        updatedAt: '2026-05-01T00:00:00Z',
        remoteId: null,
      },
      member: {
        id: 42,
        householdId: 9,
        displayName: 'Jordan',
        role: 'owner',
        localDeviceId: 7,
        createdAt: '2026-05-01T00:00:00Z',
        remoteId: null,
        remoteUserId: null,
      },
      device: {
        id: 7,
        householdId: 9,
        deviceName: 'Pixel 8',
        deviceUuid: 'abc-def',
        createdAt: '2026-05-01T00:00:00Z',
        lastSeenAt: '2026-05-14T00:00:00Z',
      },
    });
    expect(getActiveHouseholdId()).toBe(9);
    expect(getActiveMemberId()).toBe(42);
    expect(getActiveDeviceId()).toBe(7);
    expect(getActiveContextOrNull()?.member.displayName).toBe('Jordan');
  });

  test('setActiveHouseholdContextForTests overrides without a full context', () => {
    setActiveHouseholdContextForTests({ householdId: 5 });
    expect(getActiveHouseholdId()).toBe(5);
    // Defaults fill the rest.
    expect(getActiveMemberId()).toBe(1);
    expect(getActiveDeviceId()).toBe(1);
  });

  test('clearActiveHouseholdContext returns getters to fallback', () => {
    setActiveHouseholdContextForTests({ householdId: 11 });
    clearActiveHouseholdContext();
    expect(getActiveHouseholdId()).toBe(1);
  });
});
