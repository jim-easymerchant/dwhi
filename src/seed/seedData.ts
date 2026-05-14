import { getDb } from '@/db/database';
import { createItem, toCanonicalKey } from '@/repositories/itemRepository';
import { createReceipt } from '@/repositories/receiptRepository';

const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(n: number): string {
  return new Date(Date.now() - n * DAY_MS).toISOString();
}

async function isEmpty(): Promise<boolean> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) AS c FROM items;');
  return (row?.c ?? 0) === 0;
}

/**
 * Plants a small set of items, events, and a receipt so the Ask flow has
 * something believable to answer on a fresh install. Bails out if items
 * already exist so it can be called unconditionally on app start.
 */
export async function seedIfEmpty(): Promise<void> {
  if (!(await isEmpty())) return;

  const pickles = await createItem({
    manufacturer: 'Vlasic',
    name: 'Baby Dill Pickles',
    category: 'Pickles',
    containerType: 'Jar',
    size: '12 oz',
    canonicalKey: toCanonicalKey('Baby Dill Pickles', 'Vlasic'),
  });

  const milk = await createItem({
    manufacturer: 'Horizon',
    name: 'Organic Milk',
    category: 'Milk',
    containerType: 'Jug',
    size: '1 gal',
    canonicalKey: toCanonicalKey('Organic Milk', 'Horizon'),
  });

  const yogurt = await createItem({
    manufacturer: 'Chobani',
    name: 'Plain Greek Yogurt',
    category: 'Yogurt',
    containerType: 'Tub',
    size: '32 oz',
    canonicalKey: toCanonicalKey('Plain Greek Yogurt', 'Chobani'),
  });

  const ketchup = await createItem({
    manufacturer: 'Heinz',
    name: 'Tomato Ketchup',
    category: 'Condiments',
    containerType: 'Bottle',
    size: '20 oz',
    canonicalKey: toCanonicalKey('Tomato Ketchup', 'Heinz'),
  });

  const db = await getDb();
  // Backdated events for a believable history.
  await db.runAsync(
    `INSERT INTO inventory_events (item_id, direction, quantity, image_uri, raw_ai_json, source, created_at)
     VALUES (?, 'IN', 1, NULL, NULL, 'receipt', ?);`,
    pickles.id,
    daysAgo(4),
  );
  await db.runAsync(
    `INSERT INTO inventory_events (item_id, direction, quantity, image_uri, raw_ai_json, source, created_at)
     VALUES (?, 'IN', 1, NULL, NULL, 'receipt', ?);`,
    milk.id,
    daysAgo(10),
  );
  await db.runAsync(
    `INSERT INTO inventory_events (item_id, direction, quantity, image_uri, raw_ai_json, source, created_at)
     VALUES (?, 'OUT', 1, NULL, NULL, 'manual', ?);`,
    milk.id,
    daysAgo(2),
  );
  await db.runAsync(
    `INSERT INTO inventory_events (item_id, direction, quantity, image_uri, raw_ai_json, source, created_at)
     VALUES (?, 'IN', 2, NULL, NULL, 'receipt', ?);`,
    yogurt.id,
    daysAgo(8),
  );
  await db.runAsync(
    `INSERT INTO inventory_events (item_id, direction, quantity, image_uri, raw_ai_json, source, created_at)
     VALUES (?, 'OUT', 1, NULL, NULL, 'manual', ?);`,
    ketchup.id,
    daysAgo(6),
  );

  // Demo receipt
  await createReceipt({
    storeName: 'Publix',
    purchasedAt: daysAgo(4),
    total: 18.42,
    imageUri: null,
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
  });

}
