import { feedbackSignals } from '../signalGenerators/feedbackSignals';
import type { SignalContext } from '../confidenceTypes';
import type { FeedbackSummaryForTerm } from '@/repositories/askFeedbackRepository';

const FIXED_NOW = new Date('2026-05-14T12:00:00Z').getTime();
const DAY_MS = 86_400_000;

function daysAgoIso(n: number): string {
  return new Date(FIXED_NOW - n * DAY_MS).toISOString();
}

function fakeSummary(overrides: Partial<FeedbackSummaryForTerm> = {}): FeedbackSummaryForTerm {
  return {
    latest: null,
    latestAt: null,
    haveCount7d: 0,
    dontCount7d: 0,
    unsureCount7d: 0,
    ...overrides,
  };
}

function ctx(overrides: Partial<SignalContext> = {}): SignalContext {
  return {
    query: 'milk',
    matchedItem: null,
    matchedReceipt: null,
    itemBehavior: null,
    categoryBehavior: null,
    feedback: null,
    now: FIXED_NOW,
    ...overrides,
  };
}

describe('feedbackSignals', () => {
  test('null feedback → no signal', async () => {
    expect(await feedbackSignals(ctx())).toEqual([]);
  });

  test('latest=null → no signal', async () => {
    expect(await feedbackSignals(ctx({ feedback: fakeSummary() }))).toEqual([]);
  });

  test('latest=have within 7d → small positive', async () => {
    const s = await feedbackSignals(
      ctx({ feedback: fakeSummary({ latest: 'have', latestAt: daysAgoIso(2) }) }),
    );
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({
      type: 'feedback.recent-have',
      polarity: 'positive',
      weight: 6,
    });
    expect(s[0].explanation.toLowerCase()).toContain('we do have');
  });

  test('latest=dont within 7d → small negative', async () => {
    const s = await feedbackSignals(
      ctx({ feedback: fakeSummary({ latest: 'dont', latestAt: daysAgoIso(3) }) }),
    );
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({
      type: 'feedback.recent-dont',
      polarity: 'negative',
      weight: -8,
    });
    expect(s[0].explanation.toLowerCase()).toContain("we're out");
  });

  test('latest=unsure → recorded but no signal', async () => {
    const s = await feedbackSignals(
      ctx({ feedback: fakeSummary({ latest: 'unsure', latestAt: daysAgoIso(1) }) }),
    );
    expect(s).toEqual([]);
  });

  test('feedback older than 7 days → no signal (decays out)', async () => {
    const s = await feedbackSignals(
      ctx({ feedback: fakeSummary({ latest: 'have', latestAt: daysAgoIso(10) }) }),
    );
    expect(s).toEqual([]);
  });

  test('uses matched-item name in explanation when available', async () => {
    const s = await feedbackSignals(
      ctx({
        matchedItem: {
          id: 1,
          manufacturer: null,
          name: 'Vlasic Baby Dill Pickles',
          category: null,
          containerType: null,
          size: null,
          canonicalKey: 'vlasic-baby-dill',
          barcode: null,
          source: null,
          rawLookupJson: null,
          createdAt: daysAgoIso(10),
          updatedAt: daysAgoIso(2),
        },
        feedback: fakeSummary({ latest: 'have', latestAt: daysAgoIso(1) }),
      }),
    );
    expect(s[0].explanation).toContain('Vlasic Baby Dill Pickles');
  });

  test('malformed latestAt → no signal, no throw', async () => {
    const s = await feedbackSignals(
      ctx({ feedback: fakeSummary({ latest: 'have', latestAt: 'not-a-date' }) }),
    );
    expect(s).toEqual([]);
  });
});
