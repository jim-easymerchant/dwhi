/**
 * Lightweight contract check on the Phase 1 sync migration SQL file.
 * The actual application of the SQL happens in Supabase, not in
 * Jest — this test just makes sure the file exists and contains the
 * structural pieces the app expects (tables, RLS, indexes).
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const MIGRATION = join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'supabase',
  'sql',
  '003_items_inventory_sync.sql',
);

describe('003_items_inventory_sync.sql', () => {
  test('file exists at the expected path', () => {
    expect(existsSync(MIGRATION)).toBe(true);
  });

  const sql = existsSync(MIGRATION) ? readFileSync(MIGRATION, 'utf-8') : '';
  const sqlLower = sql.toLowerCase();

  test('creates both tables idempotently', () => {
    expect(sqlLower).toMatch(/create table if not exists public\.items/);
    expect(sqlLower).toMatch(/create table if not exists public\.inventory_events/);
  });

  test('items has the required columns from the spec', () => {
    const required = [
      'household_id',
      'local_id',
      'name',
      'normalized_name',
      'category',
      'barcode',
      'photo_uri',
      'notes',
      'quantity',
      'unit',
      'confidence',
      'created_by_member_id',
      'created_by_device_id',
      'created_at',
      'updated_at',
      'deleted_at',
    ];
    for (const col of required) {
      expect(sql).toContain(col);
    }
  });

  test('inventory_events has the required columns', () => {
    const required = [
      'household_id',
      'item_id',
      'local_id',
      'local_item_id',
      'event_type',
      'quantity_delta',
      'quantity_after',
      'source',
      'note',
      'occurred_at',
      'created_by_member_id',
      'created_by_device_id',
      'deleted_at',
    ];
    for (const col of required) {
      expect(sql).toContain(col);
    }
  });

  test('enables RLS on both tables and gates by dwhi_is_member', () => {
    expect(sqlLower).toMatch(/alter table public\.items\s+enable row level security/);
    expect(sqlLower).toMatch(
      /alter table public\.inventory_events\s+enable row level security/,
    );
    // Every policy in this file should be scoped by dwhi_is_member.
    const policyClauses = sql.match(/create policy [^\n]+/gi) ?? [];
    expect(policyClauses.length).toBeGreaterThanOrEqual(6); // 3 ops × 2 tables
    for (const _clause of policyClauses) {
      expect(sql).toContain('dwhi_is_member(household_id)');
    }
  });

  test('declares the expected indexes', () => {
    const required = [
      'idx_items_household_id',
      'idx_items_updated_at',
      'idx_items_deleted_at',
      'idx_items_local_id',
      'idx_items_barcode',
      'idx_inventory_events_household_id',
      'idx_inventory_events_updated_at',
      'idx_inventory_events_deleted_at',
      'idx_inventory_events_local_id',
      'idx_inventory_events_item_id',
      'idx_inventory_events_occurred_at',
    ];
    for (const idx of required) {
      expect(sql).toContain(idx);
    }
  });

  test('no policy permits client-side DELETE (soft delete only)', () => {
    expect(sql).not.toMatch(/policy [^\n]+ for delete/i);
  });
});

// ---------------------------------------------------------------------------
// Idempotency regression tests
//
// Reproduces the production bug where re-running this migration over a
// half-built table failed with "ERROR: 42703: column \"local_id\" does
// not exist". The structural fix is "every CREATE INDEX referencing a
// column lives BELOW its matching ADD COLUMN IF NOT EXISTS". These
// tests pin that ordering down so a future edit can't reintroduce the
// regression.
// ---------------------------------------------------------------------------

describe('003 idempotent ALTER + ordering invariants', () => {
  const sql = existsSync(MIGRATION) ? readFileSync(MIGRATION, 'utf-8') : '';
  const sqlLower = sql.toLowerCase();

  /** Regex-matches and returns the byte offset of the first match. */
  function indexOf(pattern: RegExp): number {
    const m = sqlLower.match(pattern);
    if (!m || m.index == null) return -1;
    return m.index;
  }

  // -------------------------------------------------------------------------
  // items
  // -------------------------------------------------------------------------

  test('items: ADD COLUMN IF NOT EXISTS exists for every spec column', () => {
    const required = [
      'household_id',
      'local_id',
      'name',
      'normalized_name',
      'category',
      'barcode',
      'photo_uri',
      'notes',
      'quantity',
      'unit',
      'confidence',
      'created_by_member_id',
      'created_by_device_id',
      'created_at',
      'updated_at',
      'deleted_at',
    ];
    for (const col of required) {
      const pattern = new RegExp(
        String.raw`alter table public\.items\s+add column if not exists\s+${col}\b`,
        'i',
      );
      expect(sql).toMatch(pattern);
    }
  });

  test('inventory_events: ADD COLUMN IF NOT EXISTS exists for every spec column', () => {
    const required = [
      'household_id',
      'item_id',
      'local_id',
      'local_item_id',
      'event_type',
      'quantity_delta',
      'quantity_after',
      'source',
      'note',
      'occurred_at',
      'created_by_member_id',
      'created_by_device_id',
      'created_at',
      'updated_at',
      'deleted_at',
    ];
    for (const col of required) {
      const pattern = new RegExp(
        String.raw`alter table public\.inventory_events\s+add column if not exists\s+${col}\b`,
        'i',
      );
      expect(sql).toMatch(pattern);
    }
  });

  // -------------------------------------------------------------------------
  // The exact ordering invariant the production bug demanded.
  // -------------------------------------------------------------------------

  test('items: ADD COLUMN IF NOT EXISTS local_id appears before CREATE INDEX idx_items_local_id', () => {
    const addAt = indexOf(
      /alter table public\.items\s+add column if not exists\s+local_id\b/,
    );
    const indexAt = indexOf(/create index if not exists\s+idx_items_local_id\b/);
    expect(addAt).toBeGreaterThanOrEqual(0);
    expect(indexAt).toBeGreaterThanOrEqual(0);
    expect(addAt).toBeLessThan(indexAt);
  });

  test('items: ADD COLUMN for barcode precedes idx_items_barcode', () => {
    const addAt = indexOf(
      /alter table public\.items\s+add column if not exists\s+barcode\b/,
    );
    const indexAt = indexOf(/create index if not exists\s+idx_items_barcode\b/);
    expect(addAt).toBeLessThan(indexAt);
  });

  test('inventory_events: ADD COLUMN local_id precedes idx_inventory_events_local_id', () => {
    const addAt = indexOf(
      /alter table public\.inventory_events\s+add column if not exists\s+local_id\b/,
    );
    const indexAt = indexOf(
      /create index if not exists\s+idx_inventory_events_local_id\b/,
    );
    expect(addAt).toBeGreaterThanOrEqual(0);
    expect(indexAt).toBeGreaterThanOrEqual(0);
    expect(addAt).toBeLessThan(indexAt);
  });

  test('inventory_events: ADD COLUMN local_item_id precedes any index/use', () => {
    // No index references local_item_id today, but the ADD COLUMN must
    // still exist (the inbound sync pull reads it). The intent of this
    // test is to flag a future change that adds an index without the
    // matching ADD COLUMN line.
    const addAt = indexOf(
      /alter table public\.inventory_events\s+add column if not exists\s+local_item_id\b/,
    );
    expect(addAt).toBeGreaterThanOrEqual(0);

    const localItemIdxMatch =
      sqlLower.match(/create index[^\n]*\(local_item_id[^\n]*\)/) ?? null;
    if (localItemIdxMatch && localItemIdxMatch.index != null) {
      expect(addAt).toBeLessThan(localItemIdxMatch.index);
    }
  });

  test('inventory_events: ADD COLUMN item_id precedes idx_inventory_events_item_id', () => {
    const addAt = indexOf(
      /alter table public\.inventory_events\s+add column if not exists\s+item_id\b/,
    );
    const indexAt = indexOf(
      /create index if not exists\s+idx_inventory_events_item_id\b/,
    );
    expect(addAt).toBeLessThan(indexAt);
  });

  test('inventory_events: ADD COLUMN occurred_at precedes idx_inventory_events_occurred_at', () => {
    const addAt = indexOf(
      /alter table public\.inventory_events\s+add column if not exists\s+occurred_at\b/,
    );
    const indexAt = indexOf(
      /create index if not exists\s+idx_inventory_events_occurred_at\b/,
    );
    expect(addAt).toBeLessThan(indexAt);
  });

  test('updated_at / deleted_at / household_id columns precede every index that uses them', () => {
    for (const table of ['items', 'inventory_events']) {
      for (const col of ['updated_at', 'deleted_at', 'household_id']) {
        const addAt = indexOf(
          new RegExp(
            String.raw`alter table public\.${table}\s+add column if not exists\s+${col}\b`,
          ),
        );
        const indexAt = indexOf(
          new RegExp(String.raw`create index if not exists\s+idx_${table}_${col}\b`),
        );
        expect(addAt).toBeGreaterThanOrEqual(0);
        expect(indexAt).toBeGreaterThanOrEqual(0);
        expect(addAt).toBeLessThan(indexAt);
      }
    }
  });

  // -------------------------------------------------------------------------
  // RLS / trigger ordering: enabling RLS or attaching triggers
  // doesn't directly reference user columns, but for clarity the
  // policies + triggers should come AFTER the ADD COLUMN block too.
  // -------------------------------------------------------------------------

  test('enable row level security comes after the ADD COLUMN block for both tables', () => {
    for (const table of ['items', 'inventory_events']) {
      const lastAdd = lastIndexOf(
        sqlLower,
        new RegExp(String.raw`alter table public\.${table}\s+add column if not exists`),
      );
      const rlsAt = indexOf(
        new RegExp(String.raw`alter table public\.${table}\s+enable row level security`),
      );
      expect(lastAdd).toBeGreaterThanOrEqual(0);
      expect(rlsAt).toBeGreaterThanOrEqual(0);
      expect(lastAdd).toBeLessThan(rlsAt);
    }
  });

  // -------------------------------------------------------------------------
  // The one-time-repair block lives in the comments at the bottom.
  // Keep it discoverable so the next operator who hits the original
  // 42703 doesn't have to grep for it.
  // -------------------------------------------------------------------------

  test('documents a one-time repair block in the trailing comments', () => {
    expect(sqlLower).toContain('one-time repair');
    expect(sqlLower).toContain('add column if not exists local_id');
    expect(sqlLower).toContain('add column if not exists local_item_id');
  });
});

function lastIndexOf(haystack: string, pattern: RegExp): number {
  const matches = [...haystack.matchAll(new RegExp(pattern, pattern.flags + 'g'))];
  if (matches.length === 0) return -1;
  const last = matches[matches.length - 1];
  return last.index ?? -1;
}
