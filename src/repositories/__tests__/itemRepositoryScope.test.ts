/**
 * Verifies every household-scoped query in itemRepository actually carries
 * `household_id = ?` and that INSERTs stamp the active household id.
 * Database is mocked at the getDb() boundary.
 */

const runAsync = jest.fn();
const getFirstAsync = jest.fn();
const getAllAsync = jest.fn();

jest.mock('@/db/database', () => ({
  getDb: jest.fn(() => Promise.resolve({ runAsync, getFirstAsync, getAllAsync })),
  nowIso: () => '2026-05-14T12:00:00Z',
}));

import {
  createItem,
  findByCanonicalKey,
  findByBarcode,
  listAll,
  searchByName,
} from '../itemRepository';
import {
  clearActiveHouseholdContext,
  setActiveHouseholdContextForTests,
} from '@/services/householdContext';

beforeEach(() => {
  jest.clearAllMocks();
  setActiveHouseholdContextForTests({ householdId: 42 });
});
afterAll(() => {
  clearActiveHouseholdContext();
});

describe('itemRepository scoping', () => {
  test('searchByName WHERE clause leads with household_id', async () => {
    getAllAsync.mockResolvedValue([]);
    await searchByName('milk');
    const [sql, householdArg] = getAllAsync.mock.calls[0];
    expect(sql).toContain('household_id = ?');
    expect(householdArg).toBe(42);
  });

  test('findByCanonicalKey scopes to household', async () => {
    getFirstAsync.mockResolvedValue(null);
    await findByCanonicalKey('milk');
    const [sql, hh] = getFirstAsync.mock.calls[0];
    expect(sql).toContain('household_id = ?');
    expect(hh).toBe(42);
  });

  test('findByBarcode scopes to household', async () => {
    getFirstAsync.mockResolvedValue(null);
    await findByBarcode('5000159484695');
    const [sql, hh] = getFirstAsync.mock.calls[0];
    expect(sql).toContain('household_id = ?');
    expect(hh).toBe(42);
  });

  test('findByBarcode returns null for empty barcode without hitting DB', async () => {
    await findByBarcode('   ');
    expect(getFirstAsync).not.toHaveBeenCalled();
  });

  test('listAll scopes to household', async () => {
    getAllAsync.mockResolvedValue([]);
    await listAll();
    const [sql, hh] = getAllAsync.mock.calls[0];
    expect(sql).toContain('household_id = ?');
    expect(hh).toBe(42);
  });

  test('createItem stamps the active household id as the last arg', async () => {
    runAsync.mockResolvedValue({ lastInsertRowId: 99 });
    await createItem({
      manufacturer: null,
      name: 'Pickles',
      category: null,
      containerType: null,
      size: null,
      canonicalKey: 'pickles',
      barcode: null,
      source: null,
      rawLookupJson: null,
    });
    const args = runAsync.mock.calls[0];
    // INSERT signature: ..., now, now, household_id (last)
    expect(args[args.length - 1]).toBe(42);
    expect(args[0]).toContain('household_id');
  });
});
