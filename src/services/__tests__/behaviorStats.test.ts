/**
 * behaviorStats walks raw event rows and aggregates them. We mock the DB
 * boundary so we can hand it crafted event sequences and assert the math.
 */

const FIXED_NOW = new Date('2026-05-14T12:00:00Z').getTime();
const DAY_MS = 86_400_000;
function daysAgoIso(n: number): string {
  return new Date(FIXED_NOW - n * DAY_MS).toISOString();
}

const getAllAsync = jest.fn();
const getFirstAsync = jest.fn();

jest.mock('@/db/database', () => ({
  getDb: jest.fn(() => Promise.resolve({ getAllAsync, getFirstAsync })),
  nowIso: () => new Date(FIXED_NOW).toISOString(),
}));

jest.mock('@/repositories/askHistoryRepository', () => ({
  summaryForTerm: jest.fn(),
  recordAsk: jest.fn(),
  countAll: jest.fn(),
}));

import {
  getItemBehaviorStats,
  getCategoryBehaviorStats,
  countLearnedPatterns,
} from '../behaviorStats';
import { summaryForTerm } from '@/repositories/askHistoryRepository';

const mockSummary = summaryForTerm as jest.MockedFunction<typeof summaryForTerm>;

beforeEach(() => {
  jest.clearAllMocks();
  mockSummary.mockResolvedValue({ lastAskedAt: null, countLast7d: 0, countTotal: 0 });
});

describe('getItemBehaviorStats — repurchase rhythm', () => {
  test('< 2 IN events → no average', async () => {
    getAllAsync.mockResolvedValue([
      { item_id: 1, direction: 'IN', created_at: daysAgoIso(3) },
    ]);
    const s = await getItemBehaviorStats(1, 'milk', FIXED_NOW);
    expect(s.avgRepurchaseDays).toBeNull();
    expect(s.repurchaseSamples).toBe(0);
  });

  test('three IN events 5 days apart → avg 5 days', async () => {
    getAllAsync.mockResolvedValue([
      { item_id: 1, direction: 'IN', created_at: daysAgoIso(10) },
      { item_id: 1, direction: 'IN', direction_at: daysAgoIso(5), created_at: daysAgoIso(5) },
      { item_id: 1, direction: 'IN', created_at: daysAgoIso(0) },
    ]);
    const s = await getItemBehaviorStats(1, 'milk', FIXED_NOW);
    expect(s.avgRepurchaseDays).toBeCloseTo(5, 1);
    expect(s.repurchaseSamples).toBe(2);
  });

  test('IN/OUT pairing → burn time', async () => {
    getAllAsync.mockResolvedValue([
      { item_id: 1, direction: 'IN', created_at: daysAgoIso(10) },
      { item_id: 1, direction: 'OUT', created_at: daysAgoIso(7) },
      { item_id: 1, direction: 'IN', created_at: daysAgoIso(5) },
      { item_id: 1, direction: 'OUT', created_at: daysAgoIso(0) },
    ]);
    const s = await getItemBehaviorStats(1, 'milk', FIXED_NOW);
    // gaps: 3 days, 5 days → avg 4
    expect(s.avgInToOutDays).toBeCloseTo(4, 1);
    expect(s.inToOutSamples).toBe(2);
  });

  test('orphan OUT (before any IN) is ignored for burn time', async () => {
    getAllAsync.mockResolvedValue([
      { item_id: 1, direction: 'OUT', created_at: daysAgoIso(20) },
      { item_id: 1, direction: 'IN', created_at: daysAgoIso(10) },
      { item_id: 1, direction: 'OUT', created_at: daysAgoIso(6) },
    ]);
    const s = await getItemBehaviorStats(1, 'milk', FIXED_NOW);
    expect(s.inToOutSamples).toBe(1);
  });

  test('ask history threads through from the repo summary', async () => {
    getAllAsync.mockResolvedValue([]);
    mockSummary.mockResolvedValue({
      lastAskedAt: daysAgoIso(1),
      countLast7d: 4,
      countTotal: 12,
    });
    const s = await getItemBehaviorStats(1, 'milk', FIXED_NOW);
    expect(s.ask.countLast7d).toBe(4);
    expect(s.ask.countTotal).toBe(12);
  });
});

describe('getCategoryBehaviorStats', () => {
  test('null/empty category → null', async () => {
    expect(await getCategoryBehaviorStats(null)).toBeNull();
    expect(await getCategoryBehaviorStats('   ')).toBeNull();
  });

  test('averages burn time across items in the category', async () => {
    getAllAsync.mockResolvedValue([
      { item_id: 1, direction: 'IN', created_at: daysAgoIso(10) },
      { item_id: 1, direction: 'OUT', created_at: daysAgoIso(7) }, // 3d
      { item_id: 2, direction: 'IN', created_at: daysAgoIso(20) },
      { item_id: 2, direction: 'OUT', created_at: daysAgoIso(13) }, // 7d
    ]);
    const s = await getCategoryBehaviorStats('Milk');
    expect(s).not.toBeNull();
    expect(s!.avgInToOutDays).toBeCloseTo(5, 1);
    expect(s!.inToOutSamples).toBe(2);
  });

  test('different items do not pair across each other', async () => {
    getAllAsync.mockResolvedValue([
      { item_id: 1, direction: 'IN', created_at: daysAgoIso(20) },
      { item_id: 2, direction: 'OUT', created_at: daysAgoIso(15) }, // would be 5d if cross-paired
    ]);
    const s = await getCategoryBehaviorStats('Milk');
    expect(s!.inToOutSamples).toBe(0);
    expect(s!.avgInToOutDays).toBeNull();
  });
});

describe('countLearnedPatterns', () => {
  test('returns the row count from the union query', async () => {
    getFirstAsync.mockResolvedValue({ c: 7 });
    expect(await countLearnedPatterns()).toBe(7);
  });

  test('missing row → 0', async () => {
    getFirstAsync.mockResolvedValue(null);
    expect(await countLearnedPatterns()).toBe(0);
  });
});
