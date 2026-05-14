import { getDb, nowIso } from '@/db/database';
import type { Receipt, ReceiptItem } from '@/types/models';

interface ReceiptRow {
  id: number;
  store_name: string | null;
  purchased_at: string | null;
  total: number | null;
  image_uri: string | null;
  created_at: string;
}

interface ReceiptItemRow {
  id: number;
  receipt_id: number;
  canonical_name: string | null;
  raw_name: string | null;
  quantity: number | null;
  estimated_category: string | null;
}

function rowToReceipt(row: ReceiptRow): Receipt {
  return {
    id: row.id,
    storeName: row.store_name,
    purchasedAt: row.purchased_at,
    total: row.total,
    imageUri: row.image_uri,
    createdAt: row.created_at,
  };
}

function rowToReceiptItem(row: ReceiptItemRow): ReceiptItem {
  return {
    id: row.id,
    receiptId: row.receipt_id,
    canonicalName: row.canonical_name,
    rawName: row.raw_name,
    quantity: row.quantity,
    estimatedCategory: row.estimated_category,
  };
}

export interface CreateReceiptInput {
  storeName: string | null;
  purchasedAt: string | null;
  total: number | null;
  imageUri: string | null;
  items: Array<{
    canonicalName: string | null;
    rawName: string | null;
    quantity: number | null;
    estimatedCategory: string | null;
  }>;
}

export async function createReceipt(input: CreateReceiptInput): Promise<Receipt> {
  const db = await getDb();
  const now = nowIso();
  let receiptId = 0;
  await db.withTransactionAsync(async () => {
    const result = await db.runAsync(
      `INSERT INTO receipts (store_name, purchased_at, total, image_uri, created_at)
       VALUES (?, ?, ?, ?, ?);`,
      input.storeName,
      input.purchasedAt,
      input.total,
      input.imageUri,
      now,
    );
    receiptId = result.lastInsertRowId;
    for (const it of input.items) {
      await db.runAsync(
        `INSERT INTO receipt_items
           (receipt_id, canonical_name, raw_name, quantity, estimated_category)
         VALUES (?, ?, ?, ?, ?);`,
        receiptId,
        it.canonicalName,
        it.rawName,
        it.quantity,
        it.estimatedCategory,
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

export async function listReceipts(limit = 50): Promise<Receipt[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ReceiptRow>(
    'SELECT * FROM receipts ORDER BY created_at DESC LIMIT ?;',
    limit,
  );
  return rows.map(rowToReceipt);
}

export async function listReceiptItems(receiptId: number): Promise<ReceiptItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ReceiptItemRow>(
    'SELECT * FROM receipt_items WHERE receipt_id = ? ORDER BY id ASC;',
    receiptId,
  );
  return rows.map(rowToReceiptItem);
}

/**
 * Returns the most recent receipt that has a receipt_item whose canonical or
 * raw name matches the query. Used by the confidence engine to ground answers
 * like "you bought pickles 4 days ago".
 */
export async function findMostRecentReceiptForItem(
  query: string,
): Promise<{ receipt: Receipt; matchedName: string } | null> {
  const db = await getDb();
  const like = `%${query.toLowerCase()}%`;
  const row = await db.getFirstAsync<ReceiptRow & { matched_name: string }>(
    `SELECT r.*, COALESCE(ri.canonical_name, ri.raw_name) AS matched_name
       FROM receipts r
       JOIN receipt_items ri ON ri.receipt_id = r.id
      WHERE LOWER(COALESCE(ri.canonical_name, '')) LIKE ?
         OR LOWER(COALESCE(ri.raw_name, '')) LIKE ?
         OR LOWER(COALESCE(ri.estimated_category, '')) LIKE ?
      ORDER BY r.purchased_at DESC, r.created_at DESC
      LIMIT 1;`,
    like,
    like,
    like,
  );
  if (!row) return null;
  return {
    receipt: rowToReceipt(row),
    matchedName: row.matched_name,
  };
}
