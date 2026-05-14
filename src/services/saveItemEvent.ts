import { getDb, nowIso } from '@/db/database';
import { toCanonicalKey } from '@/repositories/itemRepository';
import type { Direction, ItemSource } from '@/types/models';

export interface SaveItemEventInput {
  manufacturer: string | null;
  name: string;
  category: string | null;
  containerType: string | null;
  size: string | null;
  direction: Direction;
  quantity: number;
  imageUri: string | null;
  rawAiJson: string | null;
  source: ItemSource;
}

export interface SaveItemEventResult {
  itemId: number;
  eventId: number;
}

/**
 * Upserts the item and records the inventory event in a single transaction.
 * Used by the IN/OUT confirm flow so a recordEvent failure can't orphan a
 * just-created item.
 */
export async function saveItemEvent(
  input: SaveItemEventInput,
): Promise<SaveItemEventResult> {
  const trimmedName = input.name.trim() || 'Unnamed item';
  const canonicalKey = toCanonicalKey(trimmedName, input.manufacturer ?? undefined);
  const db = await getDb();
  const now = nowIso();

  let itemId = 0;
  let eventId = 0;

  await db.withTransactionAsync(async () => {
    const existing = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM items WHERE canonical_key = ? LIMIT 1;',
      canonicalKey,
    );

    if (existing) {
      itemId = existing.id;
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
        itemId,
      );
    } else {
      const insert = await db.runAsync(
        `INSERT INTO items
           (manufacturer, name, category, container_type, size, canonical_key, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
        input.manufacturer,
        trimmedName,
        input.category,
        input.containerType,
        input.size,
        canonicalKey,
        now,
        now,
      );
      itemId = insert.lastInsertRowId;
    }

    const eventInsert = await db.runAsync(
      `INSERT INTO inventory_events
         (item_id, direction, quantity, image_uri, raw_ai_json, source, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
      itemId,
      input.direction,
      input.quantity,
      input.imageUri,
      input.rawAiJson,
      input.source,
      now,
    );
    eventId = eventInsert.lastInsertRowId;
  });

  return { itemId, eventId };
}
