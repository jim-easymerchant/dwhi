/**
 * Crit multiplier unit tests.
 *
 * docs/workout-rpg/003-combat-mechanics.md §2.6
 */

import { calculateCritMultiplier } from '@dwhi/workout-domain';

describe('calculateCritMultiplier', () => {
  test('non-PR sets return 1.0 exactly', () => {
    for (const archetype of [
      'pressure',
      'heavy',
      'control',
      'foundation',
      'endurance',
      'recovery',
    ] as const) {
      expect(
        calculateCritMultiplier({ isPersonalRecord: false, archetype }),
      ).toBe(1);
    }
  });

  test('PR sets cap at 1.5 regardless of affinity', () => {
    for (const archetype of [
      'pressure',
      'heavy',
      'control',
      'foundation',
      'endurance',
      'recovery',
    ] as const) {
      const m = calculateCritMultiplier({
        isPersonalRecord: true,
        archetype,
      });
      expect(m).toBeLessThanOrEqual(1.5);
      expect(m).toBeGreaterThanOrEqual(1);
    }
  });

  test('control PR lands at the 1.5 cap (1.5 * 1.05 clamped)', () => {
    expect(
      calculateCritMultiplier({
        isPersonalRecord: true,
        archetype: 'control',
      }),
    ).toBe(1.5);
  });

  test('endurance PR lands below cap due to 0.95 affinity', () => {
    expect(
      calculateCritMultiplier({
        isPersonalRecord: true,
        archetype: 'endurance',
      }),
    ).toBeCloseTo(1.425, 5);
  });

  test('triple PR does not stack — single 1.5x cap holds', () => {
    const m = calculateCritMultiplier({
      isPersonalRecord: true,
      archetype: 'heavy',
      prKinds: ['rep', 'weight', 'volume'],
    });
    expect(m).toBe(1.5);
  });
});
