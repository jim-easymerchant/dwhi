import type { ConfidenceLevel, ConfidenceSignal } from './confidenceTypes';

/** Score bands. Tuned empirically — see the manual traces in the PR body. */
const PROBABLY_MIN = 70;
const MAYBE_MIN = 40;
const UNLIKELY_MIN = 15;
const RECENT_OUT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export interface ScoringResult {
  /** Raw additive sum of signal weights (may be negative or > 100). */
  raw: number;
  /** Display-ready 0..100. */
  score: number;
  level: ConfidenceLevel;
}

/**
 * Reduces signals to a score and picks a level. Pure — no side effects.
 *
 * Rules summary:
 *   raw = Σ signal.weight
 *   score = clamp(raw, 0, 100)
 *   level:
 *     raw >= PROBABLY_MIN -> Probably
 *     raw >= MAYBE_MIN    -> Maybe
 *     raw >= UNLIKELY_MIN -> Unlikely
 *     raw >  0            -> Unlikely OR No, depending on recent OUT signal
 *     raw <= 0 with signals -> No (if a recent OUT was the dominant negative)
 *                              else Unlikely
 *     no signals          -> Unknown
 */
export function scoreSignals(
  signals: ConfidenceSignal[],
  options: { now: number } = { now: Date.now() },
): ScoringResult {
  if (signals.length === 0) {
    return { raw: 0, score: 0, level: 'Unknown' };
  }

  const raw = signals.reduce((acc, s) => acc + s.weight, 0);
  const score = Math.max(0, Math.min(100, Math.round(raw)));

  let level: ConfidenceLevel;
  if (raw >= PROBABLY_MIN) {
    level = 'Probably';
  } else if (raw >= MAYBE_MIN) {
    level = 'Maybe';
  } else if (raw >= UNLIKELY_MIN) {
    level = 'Unlikely';
  } else if (raw > 0) {
    level = hasRecentOut(signals, options.now) ? 'No' : 'Unlikely';
  } else {
    // raw <= 0 but we have signals → evidence points the other way.
    level = hasRecentOut(signals, options.now) ? 'No' : 'Unlikely';
  }

  return { raw, score, level };
}

function hasRecentOut(signals: ConfidenceSignal[], now: number): boolean {
  return signals.some(s => {
    if (s.type !== 'event.last-out') return false;
    if (!s.createdAt) return true;
    const ts = Date.parse(s.createdAt);
    if (Number.isNaN(ts)) return false;
    return now - ts <= RECENT_OUT_WINDOW_MS;
  });
}
