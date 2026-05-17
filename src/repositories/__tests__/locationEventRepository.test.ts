/**
 * Validates that every location_events query scopes to the active
 * household and that INSERT stamps the right scope columns. Mocks the
 * DB at the getDb() boundary — no SQLite involvement.
 */

const runAsync = jest.fn();
const getFirstAsync = jest.fn();
const getAllAsync = jest.fn();

jest.mock('@/db/database', () => ({
  getDb: jest.fn(() => Promise.resolve({ runAsync, getFirstAsync, getAllAsync })),
  nowIso: () => '2026-05-17T12:00:00Z',
}));

import {
  countLocationEvents,
  getLatestLocationEvent,
  insertLocationEvent,
  listRecentLocationEvents,
} from '../locationEventRepository';
import {
  clearActiveHouseholdContext,
  setActiveHouseholdContextForTests,
} from '@/services/householdContext';

beforeEach(() => {
  jest.clearAllMocks();
  setActiveHouseholdContextForTests({
    householdId: 7,
    memberId: 3,
    deviceId: 5,
  });
});

afterAll(() => {
  clearActiveHouseholdContext();
});

describe('locationEventRepository scoping', () => {
  test('insertLocationEvent stamps the active scope and defaults source to background', async () => {
    runAsync.mockResolvedValue({ lastInsertRowId: 11 });
    const event = await insertLocationEvent({
      latitude: 40,
      longitude: -74,
      accuracy: 30,
      capturedAt: '2026-05-17T12:00:00Z',
    });
    expect(event.id).toBe(11);
    expect(event.householdId).toBe(7);
    expect(event.createdByMemberId).toBe(3);
    expect(event.createdByDeviceId).toBe(5);
    expect(event.source).toBe('background');

    const args = runAsync.mock.calls[0];
    expect(args[0]).toContain('INSERT INTO location_events');
    // First three positional values are the scope ids.
    expect(args[1]).toBe(7);
    expect(args[2]).toBe(3);
    expect(args[3]).toBe(5);
  });

  test('getLatestLocationEvent scopes by household and filters tombstones', async () => {
    getFirstAsync.mockResolvedValue(null);
    await getLatestLocationEvent();
    const [sql, hh] = getFirstAsync.mock.calls[0];
    expect(sql).toContain('household_id = ?');
    expect(sql).toContain('deleted_at IS NULL');
    expect(hh).toBe(7);
  });

  test('listRecentLocationEvents scopes and applies the limit', async () => {
    getAllAsync.mockResolvedValue([]);
    await listRecentLocationEvents(5);
    const [sql, hh, limit] = getAllAsync.mock.calls[0];
    expect(sql).toContain('household_id = ?');
    expect(sql).toContain('LIMIT');
    expect(hh).toBe(7);
    expect(limit).toBe(5);
  });

  test('countLocationEvents returns 0 when the row is missing', async () => {
    getFirstAsync.mockResolvedValue(null);
    expect(await countLocationEvents()).toBe(0);
  });

  test('countLocationEvents reads the c column', async () => {
    getFirstAsync.mockResolvedValue({ c: 42 });
    expect(await countLocationEvents()).toBe(42);
  });
});
