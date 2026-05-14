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
       (manufacturer, name, category, container_type, size, canonical_key, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
    input.manufacturer,
    input.name,
    input.category,
    input.containerType,
    input.size,
    canonicalKey,
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
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Returns an existing item with the same canonical_key or inserts a new one.
 * Updates `updated_at` so freshly-touched items bubble to the top of lists.
 */
export async function upsertItem(input: NewItem): Promise<Item> {
  const canonicalKey =
    input.canonicalKey ?? toCanonicalKey(input.name, input.manufacturer ?? undefined);
  const existing = await findByCanonicalKey(canonicalKey);
  if (existing) {
    const db = await getDb();
    const now = nowIso();
    await db.runAsync(
      `UPDATE items
         SET manufacturer = COALESCE(?, manufacturer),
             category = COALESCE(?, category),
             container_type = COALESCE(?, container_type),
             size = COALESCE(?, size),
             updated_at = ?
       WHERE id = ?;`,
      input.manufacturer,
      input.category,
      input.containerType,
      input.size,
      now,
      existing.id,
    );
    return { ...existing, ...input, canonicalKey, updatedAt: now };
  }
  return createItem({ ...input, canonicalKey });
}
