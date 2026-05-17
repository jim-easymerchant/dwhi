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

  test('creates both tables idempotently', () => {
    expect(sql).toMatch(/create table if not exists items/i);
    expect(sql).toMatch(/create table if not exists inventory_events/i);
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
    expect(sql).toMatch(/alter table items enable row level security/i);
    expect(sql).toMatch(/alter table inventory_events enable row level security/i);
    // Every policy in this file should be scoped by dwhi_is_member.
    const policyClauses = sql.match(/create policy [^\n]+/gi) ?? [];
    expect(policyClauses.length).toBeGreaterThanOrEqual(6); // 3 ops × 2 tables
    for (const clause of policyClauses) {
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
