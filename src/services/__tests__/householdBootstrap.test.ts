/**
 * Tests the idempotent bootstrap path. The DB layer is mocked at the
 * `getDb()` boundary so we can return canned rows for the household /
 * member / device discovery queries.
 */

const FIXED_NOW = new Date('2026-05-14T12:00:00Z').getTime();

const runAsync = jest.fn();
const getFirstAsync = jest.fn();
const getAllAsync = jest.fn();

jest.mock('@/db/database', () => ({
  getDb: jest.fn(() => Promise.resolve({ runAsync, getFirstAsync, getAllAsync })),
  nowIso: () => new Date(FIXED_NOW).toISOString(),
  // The real `columnExists` would PRAGMA the DB; for these bootstrap
  // tests we assume the migration ran successfully and every household_id
  // column is present.
  columnExists: jest.fn(() => Promise.resolve(true)),
}));

import { bootstrapHousehold } from '../householdBootstrap';
import {
  clearActiveHouseholdContext,
  getActiveContextOrNull,
} from '../householdContext';

beforeEach(() => {
  jest.clearAllMocks();
  clearActiveHouseholdContext();
});

describe('bootstrapHousehold', () => {
  test('fresh install: creates household, device, member, and publishes context', async () => {
    // Every "SELECT first row" probe returns null → create path.
    getFirstAsync.mockResolvedValue(null);
    // Each INSERT in turn gets an auto-incrementing id.
    runAsync
      .mockResolvedValueOnce({ lastInsertRowId: 1 }) // INSERT INTO households
      .mockResolvedValueOnce({ lastInsertRowId: 1 }) // INSERT INTO devices
      .mockResolvedValueOnce({ lastInsertRowId: 1 }) // INSERT INTO household_members
      // Backfill statements — return anything; the bootstrap doesn't read it.
      .mockResolvedValue({ lastInsertRowId: 0 });

    const ctx = await bootstrapHousehold();

    expect(ctx.household.name).toBe('My Household');
    expect(ctx.member.displayName).toBe('Me');
    expect(ctx.member.role).toBe('owner');
    expect(ctx.device.deviceName).toBe('This device');
    expect(ctx.device.deviceUuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(getActiveContextOrNull()).not.toBeNull();
  });

  test('re-run on existing install: reuses existing rows + still backfills', async () => {
    getFirstAsync
      .mockResolvedValueOnce({
        id: 7,
        name: 'My Household',
        created_at: '2026-04-01T00:00:00Z',
        updated_at: '2026-04-01T00:00:00Z',
      })
      .mockResolvedValueOnce({
        id: 3,
        household_id: 7,
        device_name: 'This device',
        device_uuid: 'abcd-1234-existing',
        created_at: '2026-04-01T00:00:00Z',
        last_seen_at: '2026-04-01T00:00:00Z',
      })
      .mockResolvedValueOnce({
        id: 2,
        household_id: 7,
        display_name: 'Me',
        role: 'owner',
        local_device_id: 3,
        created_at: '2026-04-01T00:00:00Z',
      });
    runAsync.mockResolvedValue({ lastInsertRowId: 0 });

    const ctx = await bootstrapHousehold();

    expect(ctx.household.id).toBe(7);
    expect(ctx.device.id).toBe(3);
    expect(ctx.member.id).toBe(2);
    // No CREATE INSERTs should fire for household/device/member; only the
    // last_seen_at UPDATE + the 6 backfill UPDATEs (one per scoped table) = 7.
    expect(runAsync).toHaveBeenCalledTimes(7);
  });

  test('backfill statements scope by household_id IS NULL (idempotent)', async () => {
    getFirstAsync.mockResolvedValue(null);
    runAsync.mockResolvedValue({ lastInsertRowId: 1 });

    await bootstrapHousehold();

    const backfillSql = runAsync.mock.calls
      .map(call => call[0] as string)
      .filter(sql => sql.includes('UPDATE') && sql.includes('household_id IS NULL'));
    // 5 domain tables get backfilled: items, inventory_events, receipts,
    // receipt_items, ask_history, ask_feedback — 6 total UPDATE statements.
    expect(backfillSql.length).toBe(6);
    expect(backfillSql.some(sql => sql.includes('UPDATE items'))).toBe(true);
    expect(backfillSql.some(sql => sql.includes('UPDATE inventory_events'))).toBe(true);
    expect(backfillSql.some(sql => sql.includes('UPDATE receipts'))).toBe(true);
    expect(backfillSql.some(sql => sql.includes('UPDATE receipt_items'))).toBe(true);
    expect(backfillSql.some(sql => sql.includes('UPDATE ask_history'))).toBe(true);
    expect(backfillSql.some(sql => sql.includes('UPDATE ask_feedback'))).toBe(true);
  });
});
