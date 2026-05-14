/**
 * Integration tests for answerQuestion(). The four repository modules the
 * engine pulls from are mocked at the module boundary; this also keeps
 * `expo-sqlite` (the transitive dep) from being resolved in the Node
 * test environment.
 *
 * Each scenario constructs a small fake world (item + receipt + events),
 * mounts it on the mocks, then asserts on the resulting ConfidenceResult.
 */

import type { InventoryEvent, Item, Receipt } from '@/types/models';

const FIXED_NOW = new Date('2026-05-14T12:00:00Z').getTime();
const DAY_MS = 86_400_000;

function daysAgoIso(n: number): string {
  return new Date(FIXED_NOW - n * DAY_MS).toISOString();
}

// --- mocks ---------------------------------------------------------------

jest.mock('@/repositories/itemRepository', () => ({
  searchByName: jest.fn(),
  findByCanonicalKey: jest.fn(),
  findByBarcode: jest.fn(),
  toCanonicalKey: (n: string) => n.toLowerCase().trim(),
}));

jest.mock('@/repositories/receiptRepository', () => ({
  findMostRecentReceiptForItem: jest.fn(),
}));

jest.mock('@/repositories/inventoryEventRepository', () => ({
  getEstimatedBalance: jest.fn(),
  listEventsForItem: jest.fn(),
}));

jest.mock('@/repositories/askHistoryRepository', () => ({
  recordAsk: jest.fn(),
  countAll: jest.fn(),
  summaryForTerm: jest.fn(),
}));

jest.mock('@/services/behaviorStats', () => ({
  getItemBehaviorStats: jest.fn(),
  getCategoryBehaviorStats: jest.fn(),
  countLearnedPatterns: jest.fn(),
}));

import { answerQuestion, extractQueryTerm } from '../confidenceEngine';
import { searchByName } from '@/repositories/itemRepository';
import { findMostRecentReceiptForItem } from '@/repositories/receiptRepository';
import {
  getEstimatedBalance,
  listEventsForItem,
} from '@/repositories/inventoryEventRepository';
import { recordAsk } from '@/repositories/askHistoryRepository';
import {
  getItemBehaviorStats,
  getCategoryBehaviorStats,
} from '@/services/behaviorStats';

const mockSearch = searchByName as jest.MockedFunction<typeof searchByName>;
const mockFindReceipt =
  findMostRecentReceiptForItem as jest.MockedFunction<
    typeof findMostRecentReceiptForItem
  >;
const mockBalance = getEstimatedBalance as jest.MockedFunction<
  typeof getEstimatedBalance
>;
const mockList = listEventsForItem as jest.MockedFunction<typeof listEventsForItem>;
const mockRecordAsk = recordAsk as jest.MockedFunction<typeof recordAsk>;
const mockItemBehavior = getItemBehaviorStats as jest.MockedFunction<
  typeof getItemBehaviorStats
>;
const mockCategoryBehavior = getCategoryBehaviorStats as jest.MockedFunction<
  typeof getCategoryBehaviorStats
>;

// --- helpers -------------------------------------------------------------

function fakeItem(overrides: Partial<Item>): Item {
  return {
    id: 1,
    manufacturer: null,
    name: 'thing',
    category: null,
    containerType: null,
    size: null,
    canonicalKey: 'thing',
    barcode: null,
    source: null,
    rawLookupJson: null,
    createdAt: daysAgoIso(0),
    updatedAt: daysAgoIso(0),
    ...overrides,
  };
}

function fakeReceipt(overrides: Partial<Receipt>): Receipt {
  return {
    id: 1,
    storeName: 'Publix',
    purchasedAt: daysAgoIso(0),
    total: 10.0,
    imageUri: null,
    createdAt: daysAgoIso(0),
    ...overrides,
  };
}

function fakeEvent(overrides: Partial<InventoryEvent>): InventoryEvent {
  return {
    id: 1,
    itemId: 1,
    direction: 'IN',
    quantity: 1,
    imageUri: null,
    rawAiJson: null,
    source: 'manual',
    createdAt: daysAgoIso(0),
    ...overrides,
  };
}

beforeAll(() => {
  jest.useFakeTimers({ now: FIXED_NOW });
});
afterAll(() => {
  jest.useRealTimers();
});
beforeEach(() => {
  jest.clearAllMocks();
  // Sensible defaults; individual tests override.
  mockSearch.mockResolvedValue([]);
  mockFindReceipt.mockResolvedValue(null);
  mockBalance.mockResolvedValue({
    totalIn: 0,
    totalOut: 0,
    net: 0,
    lastInAt: null,
    lastOutAt: null,
  });
  mockList.mockResolvedValue([]);
  mockRecordAsk.mockResolvedValue(undefined);
  // By default, no learned patterns — keeps existing scenario expectations
  // stable. Individual tests override these to exercise behavior signals.
  mockItemBehavior.mockResolvedValue({
    itemId: 0,
    avgRepurchaseDays: null,
    repurchaseSamples: 0,
    avgInToOutDays: null,
    inToOutSamples: 0,
    ask: { lastAskedAt: null, countLast7d: 0, countTotal: 0 },
  });
  mockCategoryBehavior.mockResolvedValue(null);
});

// --- tests ---------------------------------------------------------------

describe('extractQueryTerm', () => {
  test.each([
    ['Do we have pickles?', 'pickles'],
    ['do we have any milk left?', 'milk'],
    ['Got ketchup?', 'ketchup'],
    ['', ''],
  ])('%s → %s', (input, expected) => {
    expect(extractQueryTerm(input)).toBe(expected);
  });

  test('punctuation-only query falls back to the raw string (no false-empty)', () => {
    // The cleaner eats "?"; the function then falls back to the raw text so
    // downstream code can still produce a sensible (likely Unknown) answer
    // instead of a "didn't catch" branch.
    expect(extractQueryTerm('???')).toBe('???');
  });
});

describe('answerQuestion — manual scenarios', () => {
  test('pickles 4 days ago, no OUT, barcode → Probably', async () => {
    const item = fakeItem({
      id: 7,
      name: 'Vlasic Baby Dill Pickles',
      category: 'Pickles',
      barcode: '5000159484695',
      source: 'openfoodfacts',
      updatedAt: daysAgoIso(4),
    });
    mockSearch.mockResolvedValue([item]);
    mockFindReceipt.mockResolvedValue({
      receipt: fakeReceipt({
        id: 9,
        storeName: 'Publix',
        purchasedAt: daysAgoIso(4),
        createdAt: daysAgoIso(4),
      }),
      matchedName: 'Vlasic Baby Dill Pickles',
    });
    mockBalance.mockResolvedValue({
      totalIn: 1,
      totalOut: 0,
      net: 1,
      lastInAt: daysAgoIso(4),
      lastOutAt: null,
    });
    mockList.mockResolvedValue([
      fakeEvent({ direction: 'IN', createdAt: daysAgoIso(4), source: 'receipt' }),
    ]);

    const result = await answerQuestion('Do we have pickles?');
    expect(result.level).toBe('Probably');
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.answer.startsWith('Probably.')).toBe(true);
    expect(result.matchedItem?.barcode).toBe('5000159484695');
    expect(result.signals.map(s => s.type)).toEqual(
      expect.arrayContaining([
        'receipt.recent',
        'event.last-in',
        'event.no-out-since-restock',
        'barcode.identity-known',
      ]),
    );
  });

  test('milk IN 1 day ago, OUT today → No', async () => {
    const item = fakeItem({
      id: 8,
      name: 'Organic Milk',
      category: 'Milk',
      barcode: '0123456789012',
      source: 'openfoodfacts',
      updatedAt: daysAgoIso(0),
    });
    mockSearch.mockResolvedValue([item]);
    mockFindReceipt.mockResolvedValue({
      receipt: fakeReceipt({
        id: 10,
        purchasedAt: daysAgoIso(1),
        createdAt: daysAgoIso(1),
      }),
      matchedName: 'Organic Milk',
    });
    mockBalance.mockResolvedValue({
      totalIn: 1,
      totalOut: 1,
      net: 0,
      lastInAt: daysAgoIso(1),
      lastOutAt: daysAgoIso(0),
    });
    mockList.mockResolvedValue([
      fakeEvent({ direction: 'OUT', createdAt: daysAgoIso(0) }),
      fakeEvent({ direction: 'IN', createdAt: daysAgoIso(1), source: 'receipt' }),
    ]);

    const result = await answerQuestion('Do we have milk?');
    expect(result.level).toBe('No');
    expect(result.answer.startsWith('No.')).toBe(true);
    expect(result.answer).toMatch(/scanned out/);
    expect(result.signals.map(s => s.type)).toEqual(
      expect.arrayContaining(['event.last-out', 'event.out-after-restock']),
    );
  });

  test('yogurt 8 days ago, no OUT, fast decay → Unlikely', async () => {
    const item = fakeItem({
      id: 9,
      name: 'Plain Greek Yogurt',
      category: 'Yogurt',
      updatedAt: daysAgoIso(8),
    });
    mockSearch.mockResolvedValue([item]);
    mockFindReceipt.mockResolvedValue({
      receipt: fakeReceipt({
        id: 11,
        purchasedAt: daysAgoIso(8),
        createdAt: daysAgoIso(8),
      }),
      matchedName: 'Plain Greek Yogurt',
    });
    mockBalance.mockResolvedValue({
      totalIn: 2,
      totalOut: 0,
      net: 2,
      lastInAt: daysAgoIso(8),
      lastOutAt: null,
    });
    mockList.mockResolvedValue([
      fakeEvent({ direction: 'IN', quantity: 2, createdAt: daysAgoIso(8) }),
    ]);

    const result = await answerQuestion('Do we have yogurt?');
    // Fast decay over 8 days is heavy; the answer should land Unlikely.
    expect(result.level).toBe('Unlikely');
    expect(result.signals.find(s => s.type === 'temporal.fast')).toBeDefined();
  });

  test('paper towels 20 days ago, no OUT → Maybe', async () => {
    const item = fakeItem({
      id: 10,
      name: 'Bounty Paper Towels',
      category: 'Paper towels',
      updatedAt: daysAgoIso(20),
    });
    mockSearch.mockResolvedValue([item]);
    mockFindReceipt.mockResolvedValue({
      receipt: fakeReceipt({
        id: 12,
        purchasedAt: daysAgoIso(20),
        createdAt: daysAgoIso(20),
      }),
      matchedName: 'Bounty Paper Towels',
    });
    mockBalance.mockResolvedValue({
      totalIn: 1,
      totalOut: 0,
      net: 1,
      lastInAt: daysAgoIso(20),
      lastOutAt: null,
    });
    mockList.mockResolvedValue([
      fakeEvent({ direction: 'IN', createdAt: daysAgoIso(20) }),
    ]);

    const result = await answerQuestion('Do we have paper towels?');
    expect(result.level).toBe('Maybe');
    expect(result.signals.find(s => s.type === 'temporal.very_slow')).toBeDefined();
  });

  test('unknown item → Unknown with onboarding answer', async () => {
    mockSearch.mockResolvedValue([]);
    mockFindReceipt.mockResolvedValue(null);

    const result = await answerQuestion('Do we have caviar?');
    expect(result.level).toBe('Unknown');
    expect(result.score).toBe(0);
    expect(result.signals).toEqual([]);
    expect(result.matchedItem).toBeUndefined();
    expect(result.answer).toMatch(/I don't have any history for "caviar"/);
    expect(result.answer).toMatch(/Scan a receipt or tap \+ In/);
  });

  test('blank query → graceful "didn\'t catch" answer, no repo lookups', async () => {
    const result = await answerQuestion('   ');
    expect(result.level).toBe('Unknown');
    expect(result.signals).toEqual([]);
    expect(mockSearch).not.toHaveBeenCalled();
    expect(mockFindReceipt).not.toHaveBeenCalled();
  });
});

describe('answerQuestion — behavior + ask history', () => {
  test('records the ask before answering', async () => {
    await answerQuestion('Do we have milk?');
    expect(mockRecordAsk).toHaveBeenCalledWith('Do we have milk?', 'milk');
  });

  test('3+ repeat asks add a weak negative ask-history signal', async () => {
    const item = fakeItem({ id: 1, name: 'Organic Milk', category: 'Milk' });
    mockSearch.mockResolvedValue([item]);
    mockFindReceipt.mockResolvedValue({
      receipt: fakeReceipt({ purchasedAt: daysAgoIso(2), createdAt: daysAgoIso(2) }),
      matchedName: 'Organic Milk',
    });
    mockBalance.mockResolvedValue({
      totalIn: 1,
      totalOut: 0,
      net: 1,
      lastInAt: daysAgoIso(2),
      lastOutAt: null,
    });
    mockList.mockResolvedValue([fakeEvent({ direction: 'IN', createdAt: daysAgoIso(2) })]);
    mockItemBehavior.mockResolvedValue({
      itemId: 1,
      avgRepurchaseDays: null,
      repurchaseSamples: 0,
      avgInToOutDays: null,
      inToOutSamples: 0,
      ask: { lastAskedAt: daysAgoIso(0), countLast7d: 4, countTotal: 4 },
    });

    const result = await answerQuestion('Do we have milk?');
    const askSignal = result.signals.find(s => s.type === 'ask-history.repeated');
    expect(askSignal).toBeDefined();
    expect(askSignal?.weight).toBe(-4);
  });

  test('overdue repurchase pattern drops Probably into Maybe-or-lower', async () => {
    const item = fakeItem({ id: 1, name: 'Organic Milk', category: 'Milk' });
    mockSearch.mockResolvedValue([item]);
    mockFindReceipt.mockResolvedValue({
      receipt: fakeReceipt({ purchasedAt: daysAgoIso(8), createdAt: daysAgoIso(8) }),
      matchedName: 'Organic Milk',
    });
    mockBalance.mockResolvedValue({
      totalIn: 4,
      totalOut: 3,
      net: 1,
      lastInAt: daysAgoIso(8),
      lastOutAt: daysAgoIso(11),
    });
    mockList.mockResolvedValue([
      fakeEvent({ direction: 'IN', createdAt: daysAgoIso(8) }),
    ]);
    mockItemBehavior.mockResolvedValue({
      itemId: 1,
      avgRepurchaseDays: 5, // household usually replaces every 5 days
      repurchaseSamples: 4,
      avgInToOutDays: 4,
      inToOutSamples: 3,
      ask: { lastAskedAt: null, countLast7d: 0, countTotal: 0 },
    });

    const result = await answerQuestion('Do we have milk?');
    const behaviorSignal = result.signals.find(
      s => s.type === 'behavior.repurchase-overdue',
    );
    expect(behaviorSignal).toBeDefined();
    expect(behaviorSignal?.weight).toBe(-10);
    expect(behaviorSignal?.explanation.toLowerCase()).toContain('every 5 day');
    // Without the overdue signal the score would have been comfortably in
    // Maybe (50ish); the -10 nudge pulls it firmly off Probably.
    expect(result.level).not.toBe('Probably');
    expect(result.score).toBeLessThan(60);
  });

  test('fresh repurchase pattern nudges score upward', async () => {
    const item = fakeItem({ id: 1, name: 'Organic Milk', category: 'Milk' });
    mockSearch.mockResolvedValue([item]);
    mockFindReceipt.mockResolvedValue({
      receipt: fakeReceipt({ purchasedAt: daysAgoIso(1), createdAt: daysAgoIso(1) }),
      matchedName: 'Organic Milk',
    });
    mockBalance.mockResolvedValue({
      totalIn: 1,
      totalOut: 0,
      net: 1,
      lastInAt: daysAgoIso(1),
      lastOutAt: null,
    });
    mockList.mockResolvedValue([fakeEvent({ direction: 'IN', createdAt: daysAgoIso(1) })]);
    mockItemBehavior.mockResolvedValue({
      itemId: 1,
      avgRepurchaseDays: 6,
      repurchaseSamples: 4,
      avgInToOutDays: null,
      inToOutSamples: 0,
      ask: { lastAskedAt: null, countLast7d: 0, countTotal: 0 },
    });

    const result = await answerQuestion('Do we have milk?');
    const sig = result.signals.find(s => s.type === 'behavior.repurchase-fresh');
    expect(sig).toBeDefined();
    expect(sig?.weight).toBe(5);
    expect(result.level).toBe('Probably');
  });

  test('paper towels with slow category fallback survives 20-day gap', async () => {
    const item = fakeItem({
      id: 1,
      name: 'Bounty Paper Towels',
      category: 'Paper towels',
      updatedAt: daysAgoIso(20),
    });
    mockSearch.mockResolvedValue([item]);
    mockFindReceipt.mockResolvedValue({
      receipt: fakeReceipt({ purchasedAt: daysAgoIso(20), createdAt: daysAgoIso(20) }),
      matchedName: 'Bounty Paper Towels',
    });
    mockBalance.mockResolvedValue({
      totalIn: 1,
      totalOut: 0,
      net: 1,
      lastInAt: daysAgoIso(20),
      lastOutAt: null,
    });
    mockList.mockResolvedValue([fakeEvent({ direction: 'IN', createdAt: daysAgoIso(20) })]);
    // A category that usually lasts ~90 days — 20d in is well under the
    // 0.3× fresh threshold (27d) so the category-fresh signal fires.
    mockCategoryBehavior.mockResolvedValue({
      category: 'Paper towels',
      avgInToOutDays: 90,
      inToOutSamples: 3,
    });

    const result = await answerQuestion('Do we have paper towels?');
    expect(['Maybe', 'Probably']).toContain(result.level);
    expect(result.signals.find(s => s.type === 'behavior.category-fresh')).toBeDefined();
  });

  test('no learned history → engine still works (no behavior signals emitted)', async () => {
    const item = fakeItem({ id: 1, name: 'Pickles', category: 'Pickles' });
    mockSearch.mockResolvedValue([item]);
    mockFindReceipt.mockResolvedValue({
      receipt: fakeReceipt({ purchasedAt: daysAgoIso(4), createdAt: daysAgoIso(4) }),
      matchedName: 'Pickles',
    });
    mockBalance.mockResolvedValue({
      totalIn: 1,
      totalOut: 0,
      net: 1,
      lastInAt: daysAgoIso(4),
      lastOutAt: null,
    });
    mockList.mockResolvedValue([fakeEvent({ direction: 'IN', createdAt: daysAgoIso(4) })]);
    // Default mocks: zero patterns, zero asks.

    const result = await answerQuestion('Do we have pickles?');
    expect(result.level).toBe('Probably');
    expect(
      result.signals.find(s => s.type.startsWith('behavior.') || s.type.startsWith('ask-history.')),
    ).toBeUndefined();
  });

  test('unknown item still resolves to Unknown even with the new generators wired up', async () => {
    mockSearch.mockResolvedValue([]);
    mockFindReceipt.mockResolvedValue(null);

    const result = await answerQuestion('Do we have caviar?');
    expect(result.level).toBe('Unknown');
    expect(result.signals).toEqual([]);
  });
});
