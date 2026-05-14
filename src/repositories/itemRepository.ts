import { getDb, nowIso } from '@/db/database';
import type { Item, NewItem } from '@/types/models';

interface ItemRow {
  id: number;
  manufacturer: string | null;
  name: string;
  category: string | null;
  container_type: string | null;
  size: string | null;
  canonical_key: string | null;
  barcode: string | null;
  source: string | null;
  raw_lookup_json: string | null;
  created_at: string;
  updated_at: string;
}

function rowToItem(row: ItemRow): Item {
  return {
    id: row.id,
    manufacturer: row.manufacturer,
    name: row.name,
    category: row.category,
    containerType: row.container_type,
    size: row.size,
    canonicalKey: row.canonical_key,
    barcode: row.barcode,
    source: row.source,
    rawLookupJson: row.raw_lookup_json,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toCanonicalKey(name: string, manufacturer?: string | null): string {
  return [manufacturer ?? '', name]
    .join(' ')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function findByCanonicalKey(key: string): Promise<Item | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<ItemRow>(
    'SELECT * FROM items WHERE canonical_key = ? LIMIT 1;',
    key,
  );
  return row ? rowToItem(row) : null;
}

export async function findByBarcode(barcode: string): Promise<Item | null> {
  const db = await getDb();
  const trimmed = barcode.trim();
  if (!trimmed) return null;
  const row = await db.getFirstAsync<ItemRow>(
    'SELECT * FROM items WHERE barcode = ? LIMIT 1;',
    trimmed,
  );
  return row ? rowToItem(row) : null;
}

export async function searchByName(query: string, limit = 10): Promise<Item[]> {
  const db = await getDb();
  const like = `%${query.toLowerCase()}%`;
  const rows = await db.getAllAsync<ItemRow>(
    `SELECT * FROM items
     WHERE LOWER(name) LIKE ? OR LOWER(canonical_key) LIKE ? OR LOWER(category) LIKE ?
     ORDER BY updated_at DESC
     LIMIT ?;`,
    like,
    like,
    like,
    limit,
  );
  return rows.map(rowToItem);
}

export async function getById(id: number): Promise<Item | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<ItemRow>('SELECT * FROM items WHERE id = ?;', id);
  return row ? rowToItem(row) : null;
}

export async function listAll(limit = 100): Promise<Item[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ItemRow>(
    'SELECT * FROM items ORDER BY updated_at DESC LIMIT ?;',
    limit,
  );
  return rows.map(rowToItem);
}

export async function createItem(input: NewItem): Promise<Item> {
  const db = await getDb();
  const now = nowIso();
  const canonicalKey =
    input.canonicalKey ?? toCanonicalKey(input.name, input.manufacturer ?? undefined);
  const result = await db.runAsync(
    `INSERT INTO items
       (manufacturer, name, category, container_type, size, canonical_key,
        barcode, source, raw_lookup_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    input.manufacturer,
    input.name,
    input.category,
    input.containerType,
    input.size,
    canonicalKey,
    input.barcode ?? null,
    input.source ?? null,
    input.rawLookupJson ?? null,
    now,
    now,
  );
  return {
    id: result.lastInsertRowId,
    manufacturer: input.manufacturer,
    name: input.name,
    category: input.category,
    containerType: input.containerType,
    size: input.size,
    canonicalKey,
    barcode: input.barcode ?? null,
    source: input.source ?? null,
    rawLookupJson: input.rawLookupJson ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Returns an existing item (barcode match wins; canonical_key as fallback)
 * or inserts a new one. Updates `updated_at` so freshly-touched items bubble
 * to the top of lists. Barcode / source / raw_lookup_json are added when
 * supplied via COALESCE so a barcode scan can enrich an existing item.
 */
export async function upsertItem(input: NewItem): Promise<Item> {
  const canonicalKey =
    input.canonicalKey ?? toCanonicalKey(input.name, input.manufacturer ?? undefined);

  let existing: Item | null = null;
  if (input.barcode) {
    existing = await findByBarcode(input.barcode);
  }
  if (!existing) {
    existing = await findByCanonicalKey(canonicalKey);
  }

  if (existing) {
    const db = await getDb();
    const now = nowIso();
    await db.runAsync(
      `UPDATE items
         SET manufacturer = COALESCE(?, manufacturer),
             category = COALESCE(?, category),
             container_type = COALESCE(?, container_type),
             size = COALESCE(?, size),
             barcode = COALESCE(?, barcode),
             source = COALESCE(?, source),
             raw_lookup_json = COALESCE(?, raw_lookup_json),
             updated_at = ?
       WHERE id = ?;`,
      input.manufacturer,
      input.category,
      input.containerType,
      input.size,
      input.barcode ?? null,
      input.source ?? null,
      input.rawLookupJson ?? null,
      now,
      existing.id,
    );
    return {
      ...existing,
      manufacturer: input.manufacturer ?? existing.manufacturer,
      category: input.category ?? existing.category,
      containerType: input.containerType ?? existing.containerType,
      size: input.size ?? existing.size,
      barcode: input.barcode ?? existing.barcode,
      source: input.source ?? existing.source,
      rawLookupJson: input.rawLookupJson ?? existing.rawLookupJson,
      canonicalKey,
      updatedAt: now,
    };
  }
  return createItem({ ...input, canonicalKey });
}
