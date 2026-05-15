import { behaviorSignals } from '../signalGenerators/behaviorSignals';
import type { SignalContext } from '../confidenceTypes';
import type { Item } from '@/types/models';
import type { ItemBehaviorStats, CategoryBehaviorStats } from '@/services/behaviorStats';

const FIXED_NOW = new Date('2026-05-14T12:00:00Z').getTime();

function daysAgoIso(n: number): string {
  return new Date(FIXED_NOW - n * 86_400_000).toISOString();
}

function fakeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 1,
    manufacturer: null,
    name: 'milk',
    category: 'Milk',
    containerType: null,
    size: null,
    canonicalKey: 'milk',
    barcode: null,
    source: null,
    rawLookupJson: null,
    householdId: 1,
    createdAt: daysAgoIso(0),
    updatedAt: daysAgoIso(0),
    ...overrides,
  };
}

function fakeStats(overrides: Partial<ItemBehaviorStats> = {}): ItemBehaviorStats {
  return {
    itemId: 1,
    avgRepurchaseDays: null,
    repurchaseSamples: 0,
    avgInToOutDays: null,
    inToOutSamples: 0,
    ask: { lastAskedAt: null, countLast7d: 0, countTotal: 0 },
    ...overrides,
  };
}

function fakeCategoryStats(overrides: Partial<CategoryBehaviorStats> = {}): CategoryBehaviorStats {
  return { category: 'Milk', avgInToOutDays: null, inToOutSamples: 0, ...overrides };
}

function ctx(overrides: Partial<SignalContext> = {}): SignalContext {
  return {
    query: 'milk',
    matchedItem: fakeItem(),
    matchedReceipt: null,
    itemBehavior: null,
    categoryBehavior: null,
    feedback: null,
    now: FIXED_NOW,
    ...overrides,
  };
}

function receiptCtx(daysAgo: number, overrides: Partial<SignalContext> = {}): SignalContext {
  return ctx({
    matchedReceipt: {
      receiptId: 1,
      purchasedAt: daysAgoIso(daysAgo),
      createdAt: daysAgoIso(daysAgo),
      matchedName: 'milk',
      storeName: null,
    },
    ...overrides,
  });
}

describe('behaviorSignals', () => {
  test('no reference timestamp → no signal', async () => {
    const s = await behaviorSignals(ctx({ matchedItem: null }));
    expect(s).toEqual([]);
  });

  test('repurchase overdue (8d vs 5d cycle) → negative', async () => {
    const s = await behaviorSignals(
      receiptCtx(8, {
        itemBehavior: fakeStats({ avgRepurchaseDays: 5, repurchaseSamples: 4 }),
      }),
    );
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({
      type: 'behavior.repurchase-overdue',
      polarity: 'negative',
      weight: -10,
    });
    expect(s[0].explanation.toLowerCase()).toContain('every 5 day');
  });

  test('repurchase fresh (1d vs 6d cycle) → small positive', async () => {
    const s = await behaviorSignals(
      receiptCtx(1, {
        itemBehavior: fakeStats({ avgRepurchaseDays: 6, repurchaseSamples: 3 }),
      }),
    );
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({
      type: 'behavior.repurchase-fresh',
      polarity: 'positive',
      weight: 5,
    });
  });

  test('repurchase mid-cycle (4d vs 5d) → no signal', async () => {
    const s = await behaviorSignals(
      receiptCtx(4, {
        itemBehavior: fakeStats({ avgRepurchaseDays: 5, repurchaseSamples: 3 }),
      }),
    );
    expect(s).toEqual([]);
  });

  test('burn-time overdue (8d vs 4d burn) → negative when repurchase data is thin', async () => {
    const s = await behaviorSignals(
      receiptCtx(8, {
        itemBehavior: fakeStats({
          avgRepurchaseDays: null, // not enough samples
          repurchaseSamples: 1,
          avgInToOutDays: 4,
          inToOutSamples: 2,
        }),
      }),
    );
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({
      type: 'behavior.in-to-out-overdue',
      polarity: 'negative',
      weight: -8,
    });
  });

  test('burn-time fresh (1d vs 10d burn) → tiny positive', async () => {
    const s = await behaviorSignals(
      receiptCtx(1, {
        itemBehavior: fakeStats({ avgInToOutDays: 10, inToOutSamples: 3 }),
      }),
    );
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({
      type: 'behavior.in-to-out-fresh',
      polarity: 'positive',
      weight: 3,
    });
  });

  test('category fallback when item has no per-item history', async () => {
    const s = await behaviorSignals(
      receiptCtx(7, {
        itemBehavior: fakeStats(), // empty
        categoryBehavior: fakeCategoryStats({ avgInToOutDays: 3, inToOutSamples: 4 }),
      }),
    );
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({
      type: 'behavior.category-overdue',
      polarity: 'negative',
      weight: -5,
    });
  });

  test('repurchase signal wins over burn signal — only one fires per direction', async () => {
    const s = await behaviorSignals(
      receiptCtx(8, {
        itemBehavior: fakeStats({
          avgRepurchaseDays: 5,
          repurchaseSamples: 4,
          avgInToOutDays: 4,
          inToOutSamples: 2,
        }),
      }),
    );
    expect(s).toHaveLength(1);
    expect(s[0].type).toBe('behavior.repurchase-overdue');
  });

  test('no patterns + no category fallback → no signal (engine still works)', async () => {
    const s = await behaviorSignals(receiptCtx(7));
    expect(s).toEqual([]);
  });

  test('category fallback ignored when item has its own burn data', async () => {
    const s = await behaviorSignals(
      receiptCtx(1, {
        itemBehavior: fakeStats({ avgInToOutDays: 10, inToOutSamples: 2 }),
        categoryBehavior: fakeCategoryStats({ avgInToOutDays: 1, inToOutSamples: 5 }),
      }),
    );
    expect(s).toHaveLength(1);
    expect(s[0].type).toBe('behavior.in-to-out-fresh');
  });
});
