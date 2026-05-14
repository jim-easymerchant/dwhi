import { getDb } from '@/db/database';

export type RecentActivityKind = 'event' | 'receipt';

interface BaseEntry {
  id: string;
  kind: RecentActivityKind;
  createdAt: string;
}

export interface EventActivityEntry extends BaseEntry {
  kind: 'event';
  direction: 'IN' | 'OUT';
  itemName: string;
  quantity: number;
}

export interface ReceiptActivityEntry extends BaseEntry {
  kind: 'receipt';
  storeName: string | null;
  itemCount: number;
}

export type RecentActivityEntry = EventActivityEntry | ReceiptActivityEntry;

interface UnionRow {
  kind: RecentActivityKind;
  id: number;
  created_at: string;
  direction: 'IN' | 'OUT' | null;
  item_name: string | null;
  quantity: number | null;
  store_name: string | null;
  item_count: number | null;
}

/**
 * Returns the N most recent memory entries across receipts and inventory
 * events, sorted newest-first. Used by the home screen's Recent Activity
 * strip.
 */
export async function listRecentActivity(limit = 3): Promise<RecentActivityEntry[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<UnionRow>(
    `SELECT 'event' AS kind, e.id AS id, e.created_at AS created_at,
            e.direction AS direction, i.name AS item_name, e.quantity AS quantity,
            NULL AS store_name, NULL AS item_count
       FROM inventory_events e
       JOIN items i ON i.id = e.item_id
     UNION ALL
     SELECT 'receipt' AS kind, r.id AS id, r.created_at AS created_at,
            NULL AS direction, NULL AS item_name, NULL AS quantity,
            r.store_name AS store_name,
            (SELECT COUNT(*) FROM receipt_items WHERE receipt_id = r.id) AS item_count
       FROM receipts r
     ORDER BY created_at DESC
     LIMIT ?;`,
    limit,
  );

  return rows.map(row => {
    if (row.kind === 'receipt') {
      return {
        kind: 'receipt',
        id: `receipt-${row.id}`,
        createdAt: row.created_at,
        storeName: row.store_name,
        itemCount: row.item_count ?? 0,
      } satisfies ReceiptActivityEntry;
    }
    return {
      kind: 'event',
      id: `event-${row.id}`,
      createdAt: row.created_at,
      direction: row.direction === 'OUT' ? 'OUT' : 'IN',
      itemName: row.item_name ?? 'Unnamed item',
      quantity: row.quantity ?? 1,
    } satisfies EventActivityEntry;
  });
}
