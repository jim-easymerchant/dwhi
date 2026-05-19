/**
 * Enemy-state helpers: pure HP arithmetic + symbolic mood escalation.
 */

import {
  applyDamageToEnemy,
  calculateOverkill,
  isEnemyDefeated,
  maybeEscalateEnemyMood,
  moodRank,
} from '@dwhi/workout-domain';

describe('applyDamageToEnemy', () => {
  test('reduces HP and never drops below 0', () => {
    expect(applyDamageToEnemy(100, 40)).toEqual({
      hpBefore: 100,
      hpAfter: 60,
      damageApplied: 40,
      isDefeated: false,
      isOverkill: false,
      overkillAmount: 0,
    });
  });

  test('exact kill marks defeated, no overkill', () => {
    const step = applyDamageToEnemy(50, 50);
    expect(step.hpAfter).toBe(0);
    expect(step.isDefeated).toBe(true);
    expect(step.isOverkill).toBe(false);
    expect(step.overkillAmount).toBe(0);
  });

  test('overkill reports remainder and applied caps at HP', () => {
    const step = applyDamageToEnemy(30, 100);
    expect(step.hpAfter).toBe(0);
    expect(step.damageApplied).toBe(30);
    expect(step.isDefeated).toBe(true);
    expect(step.isOverkill).toBe(true);
    expect(step.overkillAmount).toBe(70);
  });

  test('damage on already-dead enemy is fully overkill but not "defeated again"', () => {
    const step = applyDamageToEnemy(0, 25);
    expect(step.isDefeated).toBe(false);
    expect(step.damageApplied).toBe(0);
    expect(step.overkillAmount).toBe(25);
    expect(step.isOverkill).toBe(false); // not "newly defeated"
  });

  test('negative inputs are clamped at 0', () => {
    const step = applyDamageToEnemy(-10, -5);
    expect(step.hpBefore).toBe(0);
    expect(step.hpAfter).toBe(0);
    expect(step.damageApplied).toBe(0);
  });
});

describe('isEnemyDefeated', () => {
  test.each([
    [0, true],
    [1, false],
    [-5, true], // clamped
    [Number.NaN, false], // Math.max(0, NaN) = NaN, not 0 — defensive
  ])('hp=%p → %p', (hp, expected) => {
    expect(isEnemyDefeated(hp)).toBe(expected);
  });
});

describe('calculateOverkill', () => {
  test.each([
    [50, 100, 0],
    [100, 100, 0],
    [120, 100, 20],
    [0, 0, 0],
    [-5, 100, 0],
  ])('damage=%i hp=%i → %i', (damage, hp, expected) => {
    expect(calculateOverkill(damage, hp)).toBe(expected);
  });
});

describe('maybeEscalateEnemyMood', () => {
  test('Drift → Hush on long grind', () => {
    expect(
      maybeEscalateEnemyMood({
        enemy: { mood: 'drift' },
        longGrind: true,
      }),
    ).toBe('hush');
  });

  test('Drift stays Drift without grind', () => {
    expect(
      maybeEscalateEnemyMood({
        enemy: { mood: 'drift' },
      }),
    ).toBe('drift');
  });

  test('Hush → Stone on comeback defeat', () => {
    expect(
      maybeEscalateEnemyMood({
        enemy: { mood: 'hush' },
        isComebackDefeat: true,
      }),
    ).toBe('stone');
  });

  test('Glare → Stone on comeback defeat', () => {
    expect(
      maybeEscalateEnemyMood({
        enemy: { mood: 'glare' },
        isComebackDefeat: true,
      }),
    ).toBe('stone');
  });

  test('Stone stays Stone — no further escalation', () => {
    expect(
      maybeEscalateEnemyMood({
        enemy: { mood: 'stone' },
        longGrind: true,
        isComebackDefeat: true,
      }),
    ).toBe('stone');
  });
});

describe('moodRank — stable index for ordering', () => {
  test('ordering matches the canonical tuple', () => {
    expect(moodRank('drift')).toBe(0);
    expect(moodRank('hush')).toBe(1);
    expect(moodRank('glare')).toBe(2);
    expect(moodRank('stone')).toBe(3);
  });
});
