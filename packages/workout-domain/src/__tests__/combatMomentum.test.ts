/**
 * Momentum unit tests.
 *
 * docs/workout-rpg/004-momentum-consistency.md
 * docs/workout-rpg/011-progression-and-rewards.md §6 / §8
 */

import {
  calculateMomentumDecay,
  calculateMomentumGain,
  calculateMomentumMultiplier,
  momentumBalance,
  resolveMomentumTier,
} from '@dwhi/workout-domain';

describe('resolveMomentumTier', () => {
  test.each([
    [0, 'rusted'],
    [4.9, 'rusted'],
    [5, 'rusted'],
    [19.99, 'rusted'],
    [20, 'steady'],
    [25, 'steady'],
    [39.99, 'steady'],
    [40, 'driven'],
    [64.99, 'driven'],
    [65, 'relentless'],
    [84.99, 'relentless'],
    [85, 'ascendant'],
    [100, 'ascendant'],
    [101, 'ascendant'],
    [-5, 'rusted'],
  ] as const)('value=%f → %s', (value, tier) => {
    expect(resolveMomentumTier(value)).toBe(tier);
  });

  test('NaN falls back to rusted', () => {
    expect(resolveMomentumTier(Number.NaN)).toBe('rusted');
  });

  test('Infinity is treated as non-finite → falls back to rusted', () => {
    // Defensive contract: any non-finite input falls back to the
    // safest tier rather than propagating NaN/Infinity into the
    // damage chain.
    expect(resolveMomentumTier(Number.POSITIVE_INFINITY)).toBe('rusted');
    expect(resolveMomentumTier(Number.NEGATIVE_INFINITY)).toBe('rusted');
  });
});

describe('calculateMomentumMultiplier', () => {
  test('matches the published table', () => {
    expect(calculateMomentumMultiplier('rusted')).toBe(0.9);
    expect(calculateMomentumMultiplier('steady')).toBe(1.0);
    expect(calculateMomentumMultiplier('driven')).toBe(1.1);
    expect(calculateMomentumMultiplier('relentless')).toBe(1.2);
    expect(calculateMomentumMultiplier('ascendant')).toBe(1.25);
  });
});

describe('calculateMomentumGain', () => {
  test('full Quest awards 6', () => {
    const out = calculateMomentumGain({ outcome: 'full' });
    expect(out.applied).toBe(6);
    expect(out.uncapped).toBe(6);
    expect(out.components).toEqual({ fullQuest: 6 });
    expect(out.hitDailyCap).toBe(false);
  });

  test('partial Quest awards 3', () => {
    const out = calculateMomentumGain({ outcome: 'partial' });
    expect(out.applied).toBe(3);
  });

  test('camp awards 3', () => {
    const out = calculateMomentumGain({ outcome: 'camp' });
    expect(out.applied).toBe(3);
  });

  test('recovery Quest counts as a camp', () => {
    const out = calculateMomentumGain({ outcome: 'recovery' });
    expect(out.applied).toBe(3);
  });

  test('abandoned awards 0', () => {
    const out = calculateMomentumGain({ outcome: 'abandoned' });
    expect(out.applied).toBe(0);
  });

  test('all bonuses stack and components are itemised', () => {
    const out = calculateMomentumGain({
      outcome: 'full',
      isReturnQuest: true,
      disciplinedExit: true,
      varietyBonus: true,
      isFirstOfWeek: true,
    });
    // 6 + 8 + 1 + 1 + 1 = 17 (uncapped) → 10 (cap)
    expect(out.uncapped).toBe(17);
    expect(out.applied).toBe(10);
    expect(out.hitDailyCap).toBe(true);
    expect(out.components).toEqual({
      fullQuest: 6,
      returnBonus: 8,
      disciplinedExit: 1,
      variety: 1,
      firstOfWeek: 1,
    });
  });

  test('daily cap respects already-gained today', () => {
    const out = calculateMomentumGain({
      outcome: 'full',
      gainedToday: 8,
    });
    // uncapped 6, remaining cap 10-8=2 → applied 2
    expect(out.applied).toBe(2);
    expect(out.uncapped).toBe(6);
    expect(out.hitDailyCap).toBe(true);
  });

  test('overshooting prior day-cap awards 0', () => {
    const out = calculateMomentumGain({
      outcome: 'full',
      gainedToday: 99,
    });
    expect(out.applied).toBe(0);
  });
});

describe('calculateMomentumDecay', () => {
  test.each([
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0.5],
    [4, 1.5],   // sum 0.5 + 1.0
    [5, 3.0],   // + 1.5
    [6, 5.0],   // + 2.0
    [7, 7.5],   // + 2.5 — canonical worked example from 004 §3
  ])('gap=%i days → total decay %f', (gap, expected) => {
    expect(calculateMomentumDecay({ daysSinceLastSession: gap })).toBeCloseTo(
      expected,
      5,
    );
  });

  test('long absence (30 days) accumulates beyond the floor — caller clamps', () => {
    const decay = calculateMomentumDecay({ daysSinceLastSession: 30 });
    // closed form: 0.25 * 28 * 29 = 203
    expect(decay).toBeCloseTo(203, 5);
  });

  test('non-finite input → 0 decay (no NaN propagation)', () => {
    expect(calculateMomentumDecay({ daysSinceLastSession: Number.NaN })).toBe(0);
    expect(
      calculateMomentumDecay({ daysSinceLastSession: Number.POSITIVE_INFINITY }),
    ).toBe(0);
  });

  test('floor honouring: starting at 100, never falls below 5 after clamp', () => {
    // The decay function itself returns the raw decay; caller does the clamp.
    // We sanity-check the contract: a starting value of 100 minus the
    // decay over a long absence yields a value ≤ momentumBalance.min.
    const decay = calculateMomentumDecay({ daysSinceLastSession: 60 });
    const after = Math.max(momentumBalance.min, 100 - decay);
    expect(after).toBe(momentumBalance.min);
  });
});
