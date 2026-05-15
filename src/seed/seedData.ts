import { getDb, nowIso } from '@/db/database';
import { toCanonicalKey } from '@/repositories/itemRepository';
import {
  getActiveDeviceId,
  getActiveHouseholdId,
  getActiveMemberId,
} from '@/services/householdContext';

const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(n: number): string {
  return new Date(Date.now() - n * DAY_MS).toISOString();
}

async function hasAnyItems(): Promise<boolean> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) AS c FROM items;');
  return (row?.c ?? 0) > 0;
}

interface SeedItem {
  manufacturer: string;
  name: string;
  category: string;
  containerType: string;
  size: string;
  events: Array<{ direction: 'IN' | 'OUT'; quantity: number; daysAgo: number }>;
}

const SEED_ITEMS: SeedItem[] = [
  {
    manufacturer: 'Vlasic',
    name: 'Baby Dill Pickles',
    category: 'Pickles',
    containerType: 'Jar',
    size: '12 oz',
    events: [{ direction: 'IN', quantity: 1, daysAgo: 4 }],
  },
  {
    manufacturer: 'Horizon',
    name: 'Organic Milk',
    category: 'Milk',
    containerType: 'Jug',
    size: '1 gal',
    events: [
      { direction: 'IN', quantity: 1, daysAgo: 10 },
      { direction: 'OUT', quantity: 1, daysAgo: 2 },
    ],
  },
  {
    manufacturer: 'Chobani',
    name: 'Plain Greek Yogurt',
    category: 'Yogurt',
    containerType: 'Tub',
    size: '32 oz',
    events: [{ direction: 'IN', quantity: 2, daysAgo: 8 }],
  },
  {
    manufacturer: 'Heinz',
    name: 'Tomato Ketchup',
    category: 'Condiments',
    containerType: 'Bottle',
    size: '20 oz',
    events: [{ direction: 'OUT', quantity: 1, daysAgo: 6 }],
  },
];

const SEED_RECEIPT = {
  storeName: 'Publix',
  daysAgo: 4,
  total: 18.42,
  items: [
    {
      rawName: 'VLASIC BABY DILL',
      canonicalName: 'Vlasic Baby Dill Pickles',
      quantity: 1,
      estimatedCategory: 'Pickles',
    },
    {
      rawName: 'CHOBANI PLAIN 32OZ',
      canonicalName: 'Chobani Plain Greek Yogurt 32 oz',
      quantity: 2,
      estimatedCategory: 'Yogurt',
    },
  ],
};

/**
 * Plants a small set of items, events, and a receipt so the Ask flow has
 * something believable to answer on a fresh install. Bails out if items
 * already exist so it can be called unconditionally on app start. All inserts
 * run in a single transaction so a partial failure rolls back cleanly and the
 * next launch can retry.
 */
export async function seedIfEmpty(): Promise<void> {
  if (await hasAnyItems()) return;

  const db = await getDb();
  const householdId = getActiveHouseholdId();
  const memberId = getActiveMemberId();
  const deviceId = getActiveDeviceId();
  await db.withTransactionAsync(async () => {
    // Items
    const itemIds: number[] = [];
    const now = nowIso();
    for (const it of SEED_ITEMS) {
      const result = await db.runAsync(
        `INSERT INTO items
           (manufacturer, name, category, container_type, size, canonical_key,
            created_at, updated_at, household_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        it.manufacturer,
        it.name,
        it.category,
        it.containerType,
        it.size,
        toCanonicalKey(it.name, it.manufacturer),
        now,
        now,
        householdId,
      );
      itemIds.push(result.lastInsertRowId);
    }

    // Events (backdated for believable recency).
    for (let i = 0; i < SEED_ITEMS.length; i++) {
      const item = SEED_ITEMS[i];
      const itemId = itemIds[i];
      for (const ev of item.events) {
        await db.runAsync(
          `INSERT INTO inventory_events
             (item_id, direction, quantity, image_uri, raw_ai_json, source, created_at,
              household_id, created_by_member_id, created_by_device_id)
           VALUES (?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?);`,
          itemId,
          ev.direction,
          ev.quantity,
          ev.direction === 'IN' ? 'receipt' : 'manual',
          daysAgo(ev.daysAgo),
          householdId,
          memberId,
          deviceId,
        );
      }
    }

    // Demo receipt
    const receiptResult = await db.runAsync(
      `INSERT INTO receipts
         (store_name, purchased_at, total, image_uri, created_at,
          household_id, created_by_member_id, created_by_device_id)
       VALUES (?, ?, ?, NULL, ?, ?, ?, ?);`,
      SEED_RECEIPT.storeName,
      daysAgo(SEED_RECEIPT.daysAgo),
      SEED_RECEIPT.total,
      now,
      householdId,
      memberId,
      deviceId,
    );
    const receiptId = receiptResult.lastInsertRowId;
    for (const ri of SEED_RECEIPT.items) {
      await db.runAsync(
        `INSERT INTO receipt_items
           (receipt_id, canonical_name, raw_name, quantity, estimated_category, household_id)
         VALUES (?, ?, ?, ?, ?, ?);`,
        receiptId,
        ri.canonicalName,
        ri.rawName,
        ri.quantity,
        ri.estimatedCategory,
        householdId,
      );
    }
  });
}
