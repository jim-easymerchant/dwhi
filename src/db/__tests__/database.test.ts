/**
 * Verifies the migration introspection helpers and the runInit phase
 * ordering. Reproduces the original "no such column: household_id" crash
 * by simulating an old DB whose tables exist without the new columns.
 */

const execAsync = jest.fn();
const runAsync = jest.fn();
const getAllAsync = jest.fn();
const getFirstAsync = jest.fn();
const withTransactionAsync = jest.fn(async (fn: () => Promise<void>) => {
  await fn();
});

const mockDb = { execAsync, runAsync, getAllAsync, getFirstAsync, withTransactionAsync };

const openDatabaseAsync = jest.fn(() => Promise.resolve(mockDb));

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: () => openDatabaseAsync(),
}));

import {
  __resetInitCacheForTests,
  addColumnIfMissing,
  columnExists,
  createIndexIfColumnExists,
  initDatabase,
} from '../database';

beforeEach(() => {
  jest.clearAllMocks();
  __resetInitCacheForTests();
});

describe('columnExists', () => {
  test('returns true when PRAGMA table_info lists the column', async () => {
    getAllAsync.mockResolvedValueOnce([
      { name: 'id' },
      { name: 'household_id' },
    ]);
    expect(await columnExists('items', 'household_id')).toBe(true);
    expect(getAllAsync).toHaveBeenCalledWith('PRAGMA table_info(items);');
  });

  test('returns false when the column is missing', async () => {
    getAllAsync.mockResolvedValueOnce([{ name: 'id' }, { name: 'name' }]);
    expect(await columnExists('items', 'household_id')).toBe(false);
  });

  test('returns false when the table itself is missing (PRAGMA returns [])', async () => {
    getAllAsync.mockResolvedValueOnce([]);
    expect(await columnExists('nonexistent', 'household_id')).toBe(false);
  });

  test('rejects unsafe identifiers to prevent SQL injection', async () => {
    await expect(columnExists('items; DROP TABLE x', 'foo')).rejects.toThrow(
      /Unsafe table/,
    );
    await expect(columnExists('items', 'evil-col')).rejects.toThrow(
      /Unsafe column/,
    );
  });
});

describe('addColumnIfMissing', () => {
  test('skips the ALTER when the column already exists', async () => {
    getAllAsync.mockResolvedValueOnce([{ name: 'household_id' }]);
    await addColumnIfMissing('items', 'household_id', 'INTEGER');
    expect(execAsync).not.toHaveBeenCalled();
  });

  test('issues ALTER TABLE when the column is missing', async () => {
    getAllAsync.mockResolvedValueOnce([{ name: 'id' }]);
    await addColumnIfMissing('items', 'household_id', 'INTEGER');
    expect(execAsync).toHaveBeenCalledWith(
      'ALTER TABLE items ADD COLUMN household_id INTEGER;',
    );
  });
});

describe('createIndexIfColumnExists', () => {
  test('skips silently when the column does not exist (the original crash)', async () => {
    getAllAsync.mockResolvedValueOnce([{ name: 'id' }]); // no household_id
    await createIndexIfColumnExists(
      'idx_items_household_id',
      'items',
      'household_id',
    );
    expect(execAsync).not.toHaveBeenCalled();
  });

  test('creates the index when the column is present', async () => {
    getAllAsync.mockResolvedValueOnce([
      { name: 'id' },
      { name: 'household_id' },
    ]);
    await createIndexIfColumnExists(
      'idx_items_household_id',
      'items',
      'household_id',
    );
    expect(execAsync).toHaveBeenCalledWith(
      'CREATE INDEX IF NOT EXISTS idx_items_household_id ON items(household_id);',
    );
  });
});

describe('runInit (ordering on an "old DB")', () => {
  test('schema phase contains no household_id index references', async () => {
    // Simulate an old install: every PRAGMA call answers "no such column"
    // (we control this per call below). Schema CREATE TABLE statements are
    // no-ops on existing tables. The original bug was a CREATE INDEX in the
    // schema array referencing a not-yet-added column.
    getAllAsync.mockResolvedValue([]); // every column check → missing → ALTER fires

    await initDatabase();

    // 1) The CREATE INDEX statements for household_id must NOT appear in
    //    the schema phase (i.e. no execAsync call carrying that text fires
    //    before the corresponding ALTER TABLE).
    const calls = execAsync.mock.calls.map(([sql]) => sql as string);
    const householdIndexCalls = calls
      .map((sql, i) => ({ sql, i }))
      .filter(({ sql }) => sql.includes('idx_items_household_id'));
    const householdAlterIdx = calls.findIndex(sql =>
      sql.includes('ALTER TABLE items ADD COLUMN household_id'),
    );
    expect(householdAlterIdx).toBeGreaterThan(-1);
    for (const { i } of householdIndexCalls) {
      expect(i).toBeGreaterThan(householdAlterIdx);
    }
  });

  test('ALTER TABLE fires for every household_id column on an old DB', async () => {
    getAllAsync.mockResolvedValue([]); // missing for every PRAGMA check

    await initDatabase();

    const altered = execAsync.mock.calls
      .map(([sql]) => sql as string)
      .filter(sql => sql.startsWith('ALTER TABLE'));
    // 14 additive columns total: 5 pre-history + 6 household + 3 audit
    // Specifically every household_id ALTER must appear:
    for (const table of [
      'items',
      'inventory_events',
      'receipts',
      'receipt_items',
      'ask_history',
      'ask_feedback',
    ]) {
      expect(
        altered.some(sql =>
          sql.includes(`ALTER TABLE ${table} ADD COLUMN household_id`),
        ),
      ).toBe(true);
    }
  });

  test('CREATE INDEX household_id fires when the column is present after migration', async () => {
    // Simulate the post-migration state: every PRAGMA reports the
    // household_id column as present. (The transitions through "missing"
    // are covered by the schema-ordering test above and by the
    // addColumnIfMissing unit tests.)
    getAllAsync.mockResolvedValue([
      { name: 'id' },
      { name: 'household_id' },
      { name: 'created_by_member_id' },
      { name: 'created_by_device_id' },
      { name: 'barcode' },
    ]);

    await initDatabase();

    const calls = execAsync.mock.calls.map(([sql]) => sql as string);
    for (const idx of [
      'idx_items_household_id',
      'idx_inventory_events_household_id',
      'idx_receipts_household_id',
      'idx_ask_history_household_id',
      'idx_ask_feedback_household_id',
    ]) {
      expect(
        calls.some(sql => sql.includes(`CREATE INDEX IF NOT EXISTS ${idx}`)),
      ).toBe(true);
    }
  });
});
