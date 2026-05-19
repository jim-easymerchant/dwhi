/**
 * Unit tests for the fatigue accumulator + multiplier.
 *
 * Anchored to docs/workout-rpg/003-combat-mechanics.md §2.5
 * reference table:
 *
 *   set 1 → 1.00
 *   set 2 → 1.00 (free)
 *   set 3 → 0.95
 *   set 4 → 0.90
 *   set 6 → 0.80
 *   set 8 → 0.70
 *   set 12 → 0.50 (floor)
 */

import {
  accumulateFatigue,
  calculateFatigueMultiplier,
  combatBalance,
} from '@dwhi/workout-domain';

describe('calculateFatigueMultiplier — reference table', () => {
  test.each([
    [0, 1.0], // set 1: 0 prior points
    [0, 1.0], // set 2: still in free window
    [1, 0.95], // set 3: 1 point
    [2, 0.9], // set 4
    [4, 0.8], // set 6
    [6, 0.7], // set 8
    [10, 0.5], // set 12
  ])('priorPoints=%i → multiplier %f', (priorPoints, expected) => {
    const m = calculateFatigueMultiplier({
      fatiguePoints: priorPoints,
      archetype: 'pressure',
    });
    expect(m).toBeCloseTo(expected, 5);
  });

  test('floor never falls below 0.5 (or 0.6 in gentleMode)', () => {
    expect(
      calculateFatigueMultiplier({ fatiguePoints: 100, archetype: 'heavy' }),
    ).toBe(0.5);
    expect(
      calculateFatigueMultiplier({
        fatiguePoints: 100,
        archetype: 'heavy',
        gentleMode: true,
      }),
    ).toBe(0.6);
  });

  test('endurance archetype raises the floor to 0.7', () => {
    expect(
      calculateFatigueMultiplier({ fatiguePoints: 100, archetype: 'endurance' }),
    ).toBe(0.7);
  });

  test('endurance floor wins over gentleMode (most forgiving)', () => {
    expect(
      calculateFatigueMultiplier({
        fatiguePoints: 100,
        archetype: 'endurance',
        gentleMode: true,
      }),
    ).toBe(0.7);
  });

  test('negative fatiguePoints clamp at 0, never above 1.0', () => {
    expect(
      calculateFatigueMultiplier({ fatiguePoints: -5, archetype: 'pressure' }),
    ).toBe(1.0);
  });
});

describe('accumulateFatigue — Quest-wide accumulator', () => {
  test('a default pressure Quest follows the expected per-set ramp', () => {
    const sets = Array.from({ length: 12 }, () => ({
      archetype: 'pressure' as const,
      isWarmup: false,
    }));
    // pressure costs 0.6 / set after the free window of 2
    const expected = [0, 0, 0.6, 1.2, 1.8, 2.4, 3.0, 3.6, 4.2, 4.8, 5.4, 6.0];
    const { runningPoints } = accumulateFatigue(sets);
    expect(runningPoints).toHaveLength(expected.length);
    runningPoints.forEach((value, i) => {
      expect(value).toBeCloseTo(expected[i], 5);
    });
  });

  test('warmups cost a fraction of a point regardless of position', () => {
    const sets = [
      { archetype: 'heavy' as const, isWarmup: true },
      { archetype: 'heavy' as const, isWarmup: true },
      { archetype: 'heavy' as const, isWarmup: false },
      { archetype: 'heavy' as const, isWarmup: false },
    ];
    const { runningPoints } = accumulateFatigue(sets);
    expect(runningPoints[0]).toBe(combatBalance.warmupFatigueCost);
    expect(runningPoints[1]).toBe(combatBalance.warmupFatigueCost * 2);
    // sets 3 & 4 are the first two WORKING sets → free
    expect(runningPoints[2]).toBe(combatBalance.warmupFatigueCost * 2);
    expect(runningPoints[3]).toBe(combatBalance.warmupFatigueCost * 2);
  });

  test('recovery archetype reduces the pool', () => {
    const sets = [
      { archetype: 'heavy' as const, isWarmup: false },
      { archetype: 'heavy' as const, isWarmup: false },
      { archetype: 'heavy' as const, isWarmup: false }, // pool: 1.4
      { archetype: 'recovery' as const, isWarmup: false }, // pool: 1.4 - 1.0 = 0.4
    ];
    const { runningPoints } = accumulateFatigue(sets);
    expect(runningPoints[2]).toBeCloseTo(1.4, 5);
    expect(runningPoints[3]).toBeCloseTo(0.4, 5);
  });

  test('pool never goes negative', () => {
    const sets = [
      { archetype: 'recovery' as const, isWarmup: false },
      { archetype: 'recovery' as const, isWarmup: false },
      { archetype: 'recovery' as const, isWarmup: false },
    ];
    const { finalPoints } = accumulateFatigue(sets);
    expect(finalPoints).toBe(0);
  });

  test('exercise change refunds 1 point', () => {
    const sets = [
      { archetype: 'heavy' as const, isWarmup: false }, // free
      { archetype: 'heavy' as const, isWarmup: false }, // free
      { archetype: 'heavy' as const, isWarmup: false }, // +1.4 → 1.4
      { archetype: 'heavy' as const, isWarmup: false, exerciseChanged: true }, // -1 +1.4 → 1.8
    ];
    const { runningPoints } = accumulateFatigue(sets);
    expect(runningPoints[2]).toBeCloseTo(1.4, 5);
    expect(runningPoints[3]).toBeCloseTo(1.8, 5);
  });

  test('exercise change cannot push pool below 0', () => {
    const sets = [
      { archetype: 'pressure' as const, isWarmup: false }, // free
      { archetype: 'pressure' as const, isWarmup: false, exerciseChanged: true },
      // free + 0 cost refund → still 0
    ];
    const { runningPoints } = accumulateFatigue(sets);
    expect(runningPoints[1]).toBe(0);
  });
});
