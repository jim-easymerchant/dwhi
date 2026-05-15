import { askHistorySignals } from '../signalGenerators/askHistorySignals';
import type { SignalContext } from '../confidenceTypes';

const FIXED_NOW = new Date('2026-05-14T12:00:00Z').getTime();

function ctx(
  countLast7d: number,
  overrides: Partial<SignalContext> = {},
): SignalContext {
  return {
    query: 'milk',
    matchedItem: null,
    matchedReceipt: null,
    itemBehavior: {
      itemId: 1,
      avgRepurchaseDays: null,
      repurchaseSamples: 0,
      avgInToOutDays: null,
      inToOutSamples: 0,
      ask: {
        lastAskedAt: new Date(FIXED_NOW - 60_000).toISOString(),
        countLast7d,
        countTotal: countLast7d,
      },
    },
    categoryBehavior: null,
    feedback: null,
    now: FIXED_NOW,
    ...overrides,
  };
}

describe('askHistorySignals', () => {
  test('no item behavior → no signal', async () => {
    const s = await askHistorySignals(ctx(0, { itemBehavior: null }));
    expect(s).toEqual([]);
  });

  test('< 3 asks in 7 days → no signal', async () => {
    expect(await askHistorySignals(ctx(0))).toEqual([]);
    expect(await askHistorySignals(ctx(1))).toEqual([]);
    expect(await askHistorySignals(ctx(2))).toEqual([]);
  });

  test('3 asks in 7 days → weak negative', async () => {
    const s = await askHistorySignals(ctx(3));
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({
      type: 'ask-history.repeated',
      polarity: 'negative',
      weight: -4,
    });
    expect(s[0].explanation.toLowerCase()).toContain('a few times');
  });

  test('many asks → still capped at -4 (single signal)', async () => {
    const s = await askHistorySignals(ctx(20));
    expect(s).toHaveLength(1);
    expect(s[0].weight).toBe(-4);
  });
});
