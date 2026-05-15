import type { ConfidenceSignal, SignalContext } from '../confidenceTypes';

/**
 * Corrections the user gave on previous answers for the same term. Only the
 * most recent feedback fires — newer overrides older, so flipping the user's
 * answer cleanly replaces the signal on the next ask.
 *
 * Weights are deliberately modest: feedback nudges Maybe/Unlikely, never
 * overrules a strong receipt or out-event.
 *
 *   feedback.recent-have  +6  (last feedback in 7d was "we have it")
 *   feedback.recent-dont  -8  ("we don't")
 *   feedback.recent-unsure  no scoring impact — recorded for diagnostics
 *
 * Older than 7d → no signal (we don't trust stale corrections on perishables).
 */

const FRESH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const HAVE_WEIGHT = 6;
const DONT_WEIGHT = -8;

export async function feedbackSignals(
  ctx: SignalContext,
): Promise<ConfidenceSignal[]> {
  const fb = ctx.feedback;
  if (!fb || !fb.latest || !fb.latestAt) return [];

  const ts = Date.parse(fb.latestAt);
  if (Number.isNaN(ts)) return [];
  if (ctx.now - ts > FRESH_WINDOW_MS) return [];

  const subject = ctx.matchedItem?.name ?? ctx.query;

  if (fb.latest === 'have') {
    return [
      {
        type: 'feedback.recent-have',
        weight: HAVE_WEIGHT,
        polarity: 'positive',
        explanation: `You told me recently that we do have ${subject}.`,
        createdAt: fb.latestAt,
        metadata: { ...fb },
      },
    ];
  }

  if (fb.latest === 'dont') {
    return [
      {
        type: 'feedback.recent-dont',
        weight: DONT_WEIGHT,
        polarity: 'negative',
        explanation: `You told me recently that we're out of ${subject}.`,
        createdAt: fb.latestAt,
        metadata: { ...fb },
      },
    ];
  }

  // 'unsure' — explicitly no scoring impact, but record diagnostically so the
  // explainer or future signals could surface it. For now we keep silent.
  return [];
}
