import type { ConfidenceSignal, SignalContext } from '../confidenceTypes';

/**
 * Weak uncertainty hint when the user keeps re-asking the same question:
 * they're probably not sure, which suggests we shouldn't be either.
 *
 * Threshold: 3+ asks for the same normalized term in the last 7 days.
 * Weight is intentionally small (-4) — enough to nudge a Maybe toward
 * Unlikely on the boundary, never enough to overturn a strong receipt.
 */
const ASK_REPEAT_THRESHOLD = 3;
const ASK_REPEAT_WEIGHT = -4;

export async function askHistorySignals(
  ctx: SignalContext,
): Promise<ConfidenceSignal[]> {
  const ask = ctx.itemBehavior?.ask;
  if (!ask) return [];
  if (ask.countLast7d < ASK_REPEAT_THRESHOLD) return [];

  return [
    {
      type: 'ask-history.repeated',
      weight: ASK_REPEAT_WEIGHT,
      polarity: 'negative',
      explanation: "You've checked this a few times recently.",
      metadata: {
        countLast7d: ask.countLast7d,
        lastAskedAt: ask.lastAskedAt,
      },
    },
  ];
}
