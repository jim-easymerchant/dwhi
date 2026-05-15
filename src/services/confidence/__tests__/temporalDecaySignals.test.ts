import {
  decayProfileFor,
  temporalDecaySignals,
} from '../signalGenerators/temporalDecaySignals';
import type { SignalContext } from '../confidenceTypes';
import type { Item } from '@/types/models';

const FIXED_NOW = new Date('2026-05-14T12:00:00Z').getTime();

function daysAgoIso(n: number): string {
  return new Date(FIXED_NOW - n * 86_400_000).toISOString();
}

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
    householdId: 1,
    createdAt: daysAgoIso(0),
    updatedAt: daysAgoIso(0),
    ...overrides,
  };
}

function ctx(overrides: Partial<SignalContext>): SignalContext {
  return {
    query: 'thing',
    matchedItem: null,
    matchedReceipt: null,
    itemBehavior: null,
    categoryBehavior: null,
    feedback: null,
    now: FIXED_NOW,
    ...overrides,
  };
}

describe('decayProfileFor', () => {
  test('matches fast keywords via category', () => {
    expect(decayProfileFor('Milk', null, 'milk')).toBe('fast');
    expect(decayProfileFor('Produce', null, 'apples')).toBe('fast');
  });
  test('matches slow keywords via name when category empty', () => {
    expect(decayProfileFor(null, 'Vlasic Baby Dill Pickles', 'pickles')).toBe('slow');
    expect(decayProfileFor(null, 'Heinz Tomato Ketchup', 'ketchup')).toBe('slow');
  });
  test('matches very_slow keywords (paper towels, batteries)', () => {
    expect(decayProfileFor(null, 'Bounty Paper Towels', 'paper towels')).toBe('very_slow');
    expect(decayProfileFor('Cleaning', 'Detergent', 'soap')).toBe('very_slow');
    expect(decayProfileFor(null, 'AA Batteries', 'batteries')).toBe('very_slow');
  });
  test('unknown fields → unknown profile', () => {
    expect(decayProfileFor(null, null, '')).toBe('unknown');
    expect(decayProfileFor('Misc', 'Mystery Item', 'mystery')).toBe('unknown');
  });
  test('first-match wins when both category and name are present', () => {
    // category "Milk" already matches fast; the name shouldn't override it.
    expect(decayProfileFor('Milk', 'Heinz Tomato Ketchup', 'milk')).toBe('fast');
  });
});

describe('temporalDecaySignals', () => {
  test('no reference timestamp → no signal', async () => {
    const signals = await temporalDecaySignals(ctx({}));
    expect(signals).toEqual([]);
  });

  test('today (0 days) → no signal', async () => {
    const signals = await temporalDecaySignals(
      ctx({ matchedItem: fakeItem({ name: 'Milk', category: 'Milk', updatedAt: daysAgoIso(0) }) }),
    );
    expect(signals).toEqual([]);
  });

  test('fast decay 8d → big negative', async () => {
    const signals = await temporalDecaySignals(
      ctx({
        matchedItem: fakeItem({
          name: 'Organic Milk',
          category: 'Milk',
          updatedAt: daysAgoIso(8),
        }),
      }),
    );
    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({
      type: 'temporal.fast',
      polarity: 'negative',
    });
    expect(signals[0].weight).toBeCloseTo(-20, 5);
  });

  test('slow decay 8d → very small negative, filtered out below threshold', async () => {
    const signals = await temporalDecaySignals(
      ctx({
        matchedItem: fakeItem({
          name: 'Vlasic Baby Dill Pickles',
          category: 'Pickles',
          updatedAt: daysAgoIso(8),
        }),
      }),
    );
    // 8 × -0.3 = -2.4, which exceeds the -1.5 emission threshold → emitted
    expect(signals).toHaveLength(1);
    expect(signals[0].type).toBe('temporal.slow');
    expect(signals[0].weight).toBeCloseTo(-2.4, 5);
  });

  test('very_slow 20d → tiny negative, still emitted', async () => {
    const signals = await temporalDecaySignals(
      ctx({
        matchedItem: fakeItem({
          name: 'Bounty Paper Towels',
          category: 'Paper towels',
          updatedAt: daysAgoIso(20),
        }),
      }),
    );
    expect(signals).toHaveLength(1);
    expect(signals[0].type).toBe('temporal.very_slow');
    expect(signals[0].weight).toBeCloseTo(-1.6, 5);
  });

  test('decay caps at the profile maximum', async () => {
    const signals = await temporalDecaySignals(
      ctx({
        matchedItem: fakeItem({
          name: 'Organic Milk',
          category: 'Milk',
          updatedAt: daysAgoIso(60),
        }),
      }),
    );
    // 60 × -2.5 = -150 but cap is -50
    expect(signals[0].weight).toBe(-50);
  });

  test('tiny decay (1d slow) → filtered out', async () => {
    const signals = await temporalDecaySignals(
      ctx({
        matchedItem: fakeItem({
          name: 'Pickles',
          category: 'Pickles',
          updatedAt: daysAgoIso(1),
        }),
      }),
    );
    expect(signals).toEqual([]);
  });

  test('uses receipt date when matched item has no timestamp drift', async () => {
    const signals = await temporalDecaySignals(
      ctx({
        matchedItem: null,
        matchedReceipt: {
          receiptId: 1,
          purchasedAt: daysAgoIso(8),
          createdAt: daysAgoIso(8),
          matchedName: 'milk',
          storeName: 'Publix',
        },
        query: 'milk',
      }),
    );
    expect(signals).toHaveLength(1);
    expect(signals[0].type).toBe('temporal.fast');
  });
});
