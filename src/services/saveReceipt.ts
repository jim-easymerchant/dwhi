import { getDb, nowIso } from '@/db/database';
import { toCanonicalKey } from '@/repositories/itemRepository';
import {
  getActiveDeviceId,
  getActiveHouseholdId,
  getActiveMemberId,
} from './householdContext';
import type { Receipt } from '@/types/models';

export interface SaveReceiptDraftItem {
  rawName: string;
  canonicalName: string;
  quantity: number;
  category: string | null;
}

export interface SaveReceiptInput {
  storeName: string | null;
  purchasedAt: string | null;
  total: number | null;
  imageUri: string | null;
  rawAiJson?: string | null;
  parseSource?: 'ai' | 'mock' | 'manual';
  items: SaveReceiptDraftItem[];
}

/**
 * One-shot persistence of a parsed receipt:
 *  - inserts the receipt row
 *  - inserts receipt_items
 *  - upserts each line into items
 *  - records an IN inventory_event per line
 *
 * Everything runs in a single SQLite transaction so a half-save can never
 * leave dangling rows. Every row is stamped with the active household /
 * member / device for sync-readiness.
 */
export async function saveReceiptWithEvents(input: SaveReceiptInput): Promise<Receipt> {
  const cleaned = input.items.filter(
    it => (it.canonicalName || it.rawName).trim().length > 0,
  );
  const householdId = getActiveHouseholdId();
  const memberId = getActiveMemberId();
  const deviceId = getActiveDeviceId();
  const db = await getDb();
  const now = nowIso();
  let receiptId = 0;

  await db.withTransactionAsync(async () => {
    const receiptInsert = await db.runAsync(
      `INSERT INTO receipts
         (store_name, purchased_at, total, image_uri, raw_ai_json, parse_source, created_at,
          household_id, created_by_member_id, created_by_device_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      input.storeName,
      input.purchasedAt,
      input.total,
      input.imageUri,
      input.rawAiJson ?? null,
      input.parseSource ?? null,
      now,
      householdId,
      memberId,
      deviceId,
    );
    receiptId = receiptInsert.lastInsertRowId;

    for (const ri of cleaned) {
      const displayName = (ri.canonicalName || ri.rawName).trim();
      const canonicalKey = toCanonicalKey(displayName);

      await db.runAsync(
        `INSERT INTO receipt_items
           (receipt_id, canonical_name, raw_name, quantity, estimated_category, household_id)
         VALUES (?, ?, ?, ?, ?, ?);`,
        receiptId,
        ri.canonicalName || null,
        ri.rawName || null,
        ri.quantity,
        ri.category,
        householdId,
      );

      const existing = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM items WHERE household_id = ? AND canonical_key = ? LIMIT 1;',
        householdId,
        canonicalKey,
      );

      let itemId: number;
      if (existing) {
        itemId = existing.id;
        await db.runAsync(
          `UPDATE items
              SET category = COALESCE(?, category),
                  updated_at = ?
            WHERE id = ? AND household_id = ?;`,
          ri.category,
          now,
          itemId,
          householdId,
        );
      } else {
        const itemInsert = await db.runAsync(
          `INSERT INTO items
             (manufacturer, name, category, container_type, size, canonical_key,
              created_at, updated_at, household_id)
           VALUES (NULL, ?, ?, NULL, NULL, ?, ?, ?, ?);`,
          displayName,
          ri.category,
          canonicalKey,
          now,
          now,
          householdId,
        );
        itemId = itemInsert.lastInsertRowId;
      }

      await db.runAsync(
        `INSERT INTO inventory_events
           (item_id, direction, quantity, image_uri, raw_ai_json, source, created_at,
            household_id, created_by_member_id, created_by_device_id)
         VALUES (?, 'IN', ?, ?, ?, 'receipt', ?, ?, ?, ?);`,
        itemId,
        ri.quantity,
        input.imageUri,
        JSON.stringify(ri),
        now,
        householdId,
        memberId,
        deviceId,
      );
    }
  });

  return {
    id: receiptId,
    storeName: input.storeName,
    purchasedAt: input.purchasedAt,
    total: input.total,
    imageUri: input.imageUri,
    createdAt: now,
  };
}
