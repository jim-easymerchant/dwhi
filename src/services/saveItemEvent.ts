import { getDb, nowIso } from '@/db/database';
import { toCanonicalKey } from '@/repositories/itemRepository';
import {
  getActiveDeviceId,
  getActiveHouseholdId,
  getActiveMemberId,
} from './householdContext';
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
  /**
   * Optional product barcode (EAN/UPC). If set, matching the existing item
   * prefers this column over canonical_key — so the same physical product
   * doesn't get duplicated when its printed name varies slightly.
   */
  barcode?: string | null;
  /** Source label for the items row (e.g. "openfoodfacts"). */
  itemSource?: string | null;
  /** Raw external-lookup payload to keep alongside the item row. */
  rawLookupJson?: string | null;
}

export interface SaveItemEventResult {
  itemId: number;
  eventId: number;
}

/**
 * Upserts the item and records the inventory event in a single transaction.
 * Used by the IN/OUT confirm flow so a recordEvent failure can't orphan a
 * just-created item.
 *
 * Match priority for existing item:
 *   1. items.barcode == input.barcode  (most reliable — same physical SKU)
 *   2. items.canonical_key == lower(manufacturer + name)  (name fallback)
 *
 * Every read + write is scoped to the active household; the event row is
 * stamped with the active member + device for future audit / sync.
 */
export async function saveItemEvent(
  input: SaveItemEventInput,
): Promise<SaveItemEventResult> {
  const trimmedName = input.name.trim() || 'Unnamed item';
  const canonicalKey = toCanonicalKey(trimmedName, input.manufacturer ?? undefined);
  const trimmedBarcode = input.barcode?.trim() || null;
  const householdId = getActiveHouseholdId();
  const memberId = getActiveMemberId();
  const deviceId = getActiveDeviceId();
  const db = await getDb();
  const now = nowIso();

  let itemId = 0;
  let eventId = 0;

  await db.withTransactionAsync(async () => {
    let existing: { id: number } | null = null;

    if (trimmedBarcode) {
      existing = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM items WHERE household_id = ? AND barcode = ? LIMIT 1;',
        householdId,
        trimmedBarcode,
      );
    }
    if (!existing) {
      existing = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM items WHERE household_id = ? AND canonical_key = ? LIMIT 1;',
        householdId,
        canonicalKey,
      );
    }

    if (existing) {
      itemId = existing.id;
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
          WHERE id = ? AND household_id = ?;`,
        input.manufacturer,
        input.category,
        input.containerType,
        input.size,
        trimmedBarcode,
        input.itemSource ?? null,
        input.rawLookupJson ?? null,
        now,
        itemId,
        householdId,
      );
    } else {
      const insert = await db.runAsync(
        `INSERT INTO items
           (manufacturer, name, category, container_type, size, canonical_key,
            barcode, source, raw_lookup_json, created_at, updated_at, household_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        input.manufacturer,
        trimmedName,
        input.category,
        input.containerType,
        input.size,
        canonicalKey,
        trimmedBarcode,
        input.itemSource ?? null,
        input.rawLookupJson ?? null,
        now,
        now,
        householdId,
      );
      itemId = insert.lastInsertRowId;
    }

    const eventInsert = await db.runAsync(
      `INSERT INTO inventory_events
         (item_id, direction, quantity, image_uri, raw_ai_json, source, created_at,
          household_id, created_by_member_id, created_by_device_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      itemId,
      input.direction,
      input.quantity,
      input.imageUri,
      input.rawAiJson,
      input.source,
      now,
      householdId,
      memberId,
      deviceId,
    );
    eventId = eventInsert.lastInsertRowId;
  });

  return { itemId, eventId };
}
