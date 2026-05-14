import { scoreSignals } from '../weightedScorer';
import type { ConfidenceSignal } from '../confidenceTypes';

const FIXED_NOW = new Date('2026-05-14T12:00:00Z').getTime();

function sig(overrides: Partial<ConfidenceSignal>): ConfidenceSignal {
  return {
    type: 'test',
    weight: 0,
    polarity: 'neutral',
    explanation: 'test',
    ...overrides,
  };
}

describe('scoreSignals', () => {
  test('no signals → Unknown / score 0', () => {
    expect(scoreSignals([])).toEqual({ raw: 0, score: 0, level: 'Unknown' });
  });

  test('raw >= 70 → Probably', () => {
    const r = scoreSignals([sig({ weight: 75, polarity: 'positive' })]);
    expect(r.level).toBe('Probably');
    expect(r.score).toBe(75);
  });

  test('raw in [40, 69] → Maybe', () => {
    expect(scoreSignals([sig({ weight: 40, polarity: 'positive' })]).level).toBe('Maybe');
    expect(scoreSignals([sig({ weight: 69, polarity: 'positive' })]).level).toBe('Maybe');
  });

  test('raw in [15, 39] → Unlikely', () => {
    expect(scoreSignals([sig({ weight: 15, polarity: 'positive' })]).level).toBe('Unlikely');
    expect(scoreSignals([sig({ weight: 39, polarity: 'positive' })]).level).toBe('Unlikely');
  });

  test('raw in (0, 14] with a recent OUT → No', () => {
    const out = sig({
      type: 'event.last-out',
      weight: -5,
      polarity: 'negative',
      createdAt: new Date(FIXED_NOW - 1000).toISOString(),
    });
    const positive = sig({ weight: 12, polarity: 'positive' });
    const r = scoreSignals([positive, out], { now: FIXED_NOW });
    expect(r.raw).toBe(7);
    expect(r.level).toBe('No');
  });

  test('raw in (0, 14] without OUT → Unlikely', () => {
    expect(scoreSignals([sig({ weight: 8, polarity: 'positive' })]).level).toBe('Unlikely');
  });

  test('raw <= 0 with non-OUT negatives → Unlikely', () => {
    const r = scoreSignals([
      sig({ type: 'event.net-negative', weight: -10, polarity: 'negative' }),
    ]);
    expect(r.level).toBe('Unlikely');
    expect(r.score).toBe(0);
  });

  test('raw <= 0 with recent OUT → No', () => {
    const out = sig({
      type: 'event.last-out',
      weight: -30,
      polarity: 'negative',
      createdAt: new Date(FIXED_NOW - 1000).toISOString(),
    });
    expect(scoreSignals([out], { now: FIXED_NOW }).level).toBe('No');
  });

  test('OUT older than 7d is not treated as recent → falls back to Unlikely', () => {
    const out = sig({
      type: 'event.last-out',
      weight: -3,
      polarity: 'negative',
      createdAt: new Date(FIXED_NOW - 30 * 86_400_000).toISOString(),
    });
    expect(scoreSignals([out], { now: FIXED_NOW }).level).toBe('Unlikely');
  });

  test('display score clamps to [0, 100]', () => {
    expect(scoreSignals([sig({ weight: 200, polarity: 'positive' })]).score).toBe(100);
    expect(scoreSignals([sig({ weight: -200, polarity: 'negative' })]).score).toBe(0);
  });

  test('raw can be negative; display still 0', () => {
    const r = scoreSignals([sig({ weight: -50, polarity: 'negative' })]);
    expect(r.raw).toBe(-50);
    expect(r.score).toBe(0);
  });
});
