const FIXED_NOW = new Date('2026-05-14T12:00:00Z').getTime();
const DAY_MS = 86_400_000;
function daysAgoIso(n: number): string {
  return new Date(FIXED_NOW - n * DAY_MS).toISOString();
}

const runAsync = jest.fn();
const getFirstAsync = jest.fn();
const getAllAsync = jest.fn();

jest.mock('@/db/database', () => ({
  getDb: jest.fn(() => Promise.resolve({ runAsync, getFirstAsync, getAllAsync })),
  nowIso: () => new Date(FIXED_NOW).toISOString(),
}));

import {
  recordFeedback,
  summaryForTerm,
  countAll,
} from '../askFeedbackRepository';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('recordFeedback', () => {
  test('inserts a row with the normalized term + answer level + kind', async () => {
    await recordFeedback('milk', 'Probably', 'have');
    expect(runAsync).toHaveBeenCalledTimes(1);
    const args = runAsync.mock.calls[0];
    expect(args[1]).toBe('milk');
    expect(args[2]).toBe('Probably');
    expect(args[3]).toBe('have');
    expect(args[4]).toBe(new Date(FIXED_NOW).toISOString());
  });
});

describe('summaryForTerm', () => {
  test('returns null/zeros when there is no feedback for the term', async () => {
    getFirstAsync
      .mockResolvedValueOnce(null) // latest row
      .mockResolvedValueOnce({ h: 0, d: 0, u: 0 }); // counts
    const s = await summaryForTerm('milk', FIXED_NOW);
    expect(s).toEqual({
      latest: null,
      latestAt: null,
      haveCount7d: 0,
      dontCount7d: 0,
      unsureCount7d: 0,
    });
  });

  test('returns the most-recent feedback + 7d counts', async () => {
    getFirstAsync
      .mockResolvedValueOnce({
        user_feedback: 'have',
        created_at: daysAgoIso(1),
      })
      .mockResolvedValueOnce({ h: 2, d: 1, u: 0 });
    const s = await summaryForTerm('milk', FIXED_NOW);
    expect(s.latest).toBe('have');
    expect(s.latestAt).toBe(daysAgoIso(1));
    expect(s.haveCount7d).toBe(2);
    expect(s.dontCount7d).toBe(1);
    expect(s.unsureCount7d).toBe(0);
  });
});

describe('countAll', () => {
  test('returns the row count', async () => {
    getFirstAsync.mockResolvedValue({ c: 5 });
    expect(await countAll()).toBe(5);
  });

  test('missing row → 0', async () => {
    getFirstAsync.mockResolvedValue(null);
    expect(await countAll()).toBe(0);
  });
});
