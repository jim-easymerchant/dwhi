/**
 * Unit tests for the damage chain.
 *
 * Anchored to the canonical worked example in
 * docs/workout-rpg/003-combat-mechanics.md §8.
 */

import {
  calculateArchetypeMultiplier,
  calculateEffectiveLoad,
  calculateEffectiveReps,
  calculateSetDamage,
  combatBalance,
} from '@dwhi/workout-domain';
import type { SetDamageInput } from '@dwhi/workout-domain';

const PUSHUP = { loadScale: 8, bodyweightCoefficient: 0.65 };
const BENCH = { loadScale: 8, bodyweightCoefficient: 0 };
const PIKE_PUSHUP = { loadScale: 6, bodyweightCoefficient: 0.6 };
const PLANK = { loadScale: 6, bodyweightCoefficient: 0.5 };

const baseInput = (overrides: Partial<SetDamageInput>): SetDamageInput => ({
  modality: 'bodyweight',
  archetype: 'pressure',
  exercise: PUSHUP,
  reps: 10,
  bodyweightKg: 75,
  setIndex: 0,
  sessionSetCount: 0,
  momentumTier: 'steady',
  isPersonalRecord: false,
  isWarmup: false,
  recoveryMode: false,
  ...overrides,
});

describe('calculateEffectiveReps', () => {
  test('bodyweight uses reps directly', () => {
    expect(calculateEffectiveReps({ modality: 'bodyweight', reps: 10 })).toBe(10);
  });

  test('weighted uses reps directly', () => {
    expect(calculateEffectiveReps({ modality: 'weighted', reps: 5 })).toBe(5);
  });

  test('timed converts seconds to rep-equivalents at 1 per 5s', () => {
    expect(calculateEffectiveReps({ modality: 'timed', durationSeconds: 30 })).toBe(6);
    expect(calculateEffectiveReps({ modality: 'timed', durationSeconds: 4 })).toBe(0);
  });

  test('missing inputs floor at 0; never NaN', () => {
    expect(calculateEffectiveReps({ modality: 'bodyweight' })).toBe(0);
    expect(calculateEffectiveReps({ modality: 'weighted', reps: -5 })).toBe(0);
    expect(calculateEffectiveReps({ modality: 'timed' })).toBe(0);
  });
});

describe('calculateEffectiveLoad', () => {
  test('bodyweight = bw * bwCoef', () => {
    expect(
      calculateEffectiveLoad({
        modality: 'bodyweight',
        exercise: PUSHUP,
        bodyweightKg: 75,
      }),
    ).toBeCloseTo(48.75, 5);
  });

  test('weighted = external + body contribution', () => {
    expect(
      calculateEffectiveLoad({
        modality: 'weighted',
        exercise: BENCH,
        weightKg: 80,
        bodyweightKg: 75,
      }),
    ).toBe(80);
  });

  test('weighted pullup-like: external + body contribution add', () => {
    const weightedPullup = { loadScale: 4, bodyweightCoefficient: 1.0 };
    expect(
      calculateEffectiveLoad({
        modality: 'weighted',
        exercise: weightedPullup,
        weightKg: 10,
        bodyweightKg: 75,
      }),
    ).toBe(85);
  });

  test('assistance subtracts; floors at 0', () => {
    const assistedPullup = { loadScale: 4, bodyweightCoefficient: 1.0 };
    expect(
      calculateEffectiveLoad({
        modality: 'bodyweight',
        exercise: assistedPullup,
        bodyweightKg: 75,
        assistanceKg: 30,
      }),
    ).toBe(45);
    expect(
      calculateEffectiveLoad({
        modality: 'bodyweight',
        exercise: assistedPullup,
        bodyweightKg: 75,
        assistanceKg: 999,
      }),
    ).toBe(0);
  });

  test('timed scales to bodyweight', () => {
    expect(
      calculateEffectiveLoad({
        modality: 'timed',
        exercise: PLANK,
        bodyweightKg: 70,
      }),
    ).toBe(35);
  });

  test('missing bodyweight falls back to default', () => {
    expect(
      calculateEffectiveLoad({
        modality: 'bodyweight',
        exercise: PUSHUP,
      }),
    ).toBeCloseTo(combatBalance.defaultBodyweightKg * 0.65, 5);
  });

  test('cardio / mobility return 0 (not in damage scope)', () => {
    expect(
      calculateEffectiveLoad({
        modality: 'cardio',
        exercise: { loadScale: 1, bodyweightCoefficient: 0 },
        bodyweightKg: 75,
      }),
    ).toBe(0);
    expect(
      calculateEffectiveLoad({
        modality: 'mobility',
        exercise: { loadScale: 1, bodyweightCoefficient: 0 },
        bodyweightKg: 75,
      }),
    ).toBe(0);
  });
});

describe('calculateArchetypeMultiplier', () => {
  test('pressure combo grows then caps at 1.0 + 0.15', () => {
    const m0 = calculateArchetypeMultiplier({
      archetype: 'pressure',
      setIndex: 0,
      isWarmup: false,
    });
    const m5 = calculateArchetypeMultiplier({
      archetype: 'pressure',
      setIndex: 5,
      isWarmup: false,
    });
    const m10 = calculateArchetypeMultiplier({
      archetype: 'pressure',
      setIndex: 10,
      isWarmup: false,
    });
    expect(m0).toBeCloseTo(1.0, 5);
    expect(m5).toBeCloseTo(1.15, 5);
    expect(m10).toBeCloseTo(1.15, 5); // capped
  });

  test('heavy first-set bonus applies only at setIndex 0 working', () => {
    expect(
      calculateArchetypeMultiplier({ archetype: 'heavy', setIndex: 0, isWarmup: false }),
    ).toBeCloseTo(1.45, 5);
    expect(
      calculateArchetypeMultiplier({ archetype: 'heavy', setIndex: 1, isWarmup: false }),
    ).toBeCloseTo(1.2, 5);
  });

  test('warmup suppresses combo / first-set bonuses', () => {
    expect(
      calculateArchetypeMultiplier({ archetype: 'heavy', setIndex: 0, isWarmup: true }),
    ).toBeCloseTo(1.2, 5);
    expect(
      calculateArchetypeMultiplier({ archetype: 'pressure', setIndex: 4, isWarmup: true }),
    ).toBeCloseTo(1.0, 5);
  });

  test('every archetype multiplier sits within the universal bounds', () => {
    for (const archetype of [
      'pressure',
      'heavy',
      'control',
      'foundation',
      'endurance',
      'recovery',
    ] as const) {
      for (let i = 0; i < 12; i++) {
        const m = calculateArchetypeMultiplier({ archetype, setIndex: i, isWarmup: false });
        expect(m).toBeGreaterThanOrEqual(0.4);
        expect(m).toBeLessThanOrEqual(1.5);
      }
    }
  });
});

describe('calculateSetDamage — canonical worked example (003 §8)', () => {
  // 75 kg, Steady, Push Day, bodyweight pushups (pressure archetype).
  //
  // NOTE: 003 §8 was written before the archetype system in 007
  // landed. Pushups are now `pressure`, which adds a +3%/set combo
  // bonus from setIndex 1 onward (capped at +15%) and reduces the
  // fatigue cost per set from 1.0 → 0.6. The base case (set 1)
  // matches the doc exactly (91); sets 2 and 3 land a few points
  // higher than the pre-archetype example.
  //
  // The engine is the source of truth; the doc example demonstrates
  // the *shape* of the formula, not the post-archetype magnitude.

  test('set 1: 10 reps + first-ever PR ≈ 91 (matches 003 §8)', () => {
    const out = calculateSetDamage(
      baseInput({
        reps: 10,
        setIndex: 0,
        sessionSetCount: 0,
        isPersonalRecord: true,
      }),
    );
    expect(out.effectiveLoad).toBeCloseTo(48.75, 5);
    expect(out.baseAttack).toBeCloseTo(60.9375, 5);
    expect(out.archetypeMultiplier).toBeCloseTo(1.0, 5);
    expect(out.momentumMultiplier).toBeCloseTo(1.0, 5);
    expect(out.fatigueMultiplier).toBeCloseTo(1.0, 5);
    expect(out.critMultiplier).toBeCloseTo(1.5, 5);
    expect(Math.round(out.finalDamage)).toBe(91);
  });

  test('set 2: 12 reps + PR, with pressure +3% combo → 113', () => {
    const out = calculateSetDamage(
      baseInput({
        reps: 12,
        setIndex: 1,
        sessionSetCount: 1,
        isPersonalRecord: true,
      }),
    );
    expect(out.baseAttack).toBeCloseTo(73.125, 5);
    expect(out.archetypeMultiplier).toBeCloseTo(1.03, 5);
    expect(out.fatigueMultiplier).toBeCloseTo(1.0, 5);
    expect(out.critMultiplier).toBeCloseTo(1.5, 5);
    // 73.125 * 1.03 * 1 * 1 * 1.5 = 112.978...
    expect(Math.round(out.finalDamage)).toBe(113);
  });

  test('set 3: 10 reps, no PR, pressure +6% combo, fatigue still free → 65', () => {
    const out = calculateSetDamage(
      baseInput({
        reps: 10,
        setIndex: 2,
        sessionSetCount: 2,
        isPersonalRecord: false,
      }),
    );
    expect(out.baseAttack).toBeCloseTo(60.9375, 5);
    expect(out.archetypeMultiplier).toBeCloseTo(1.06, 5);
    // sessionSetCount = 2: prior working sets within the free window
    // (pressure cost 0.6 per set after free) → priorPoints = 0.
    expect(out.fatigueMultiplier).toBeCloseTo(1.0, 5);
    expect(out.critMultiplier).toBeCloseTo(1.0, 5);
    // 60.9375 * 1.06 * 1 * 1 * 1 = 64.59
    expect(Math.round(out.finalDamage)).toBe(65);
  });
});

describe('calculateSetDamage — warmup behaviour', () => {
  test('warmup contributes 0.25 * baseAttack and ignores multipliers', () => {
    const out = calculateSetDamage(
      baseInput({
        reps: 10,
        setIndex: 0,
        sessionSetCount: 0,
        isWarmup: true,
        isPersonalRecord: true,
        archetype: 'heavy',
        momentumTier: 'ascendant',
      }),
    );
    expect(out.warmupScalar).toBe(0.25);
    expect(out.critMultiplier).toBe(1.0); // warmups don't crit
    expect(out.finalDamage).toBeCloseTo(out.baseAttack * 0.25, 5);
  });
});

describe('calculateSetDamage — recovery archetype deals zero damage', () => {
  test('finalDamage = 0 for recovery archetype', () => {
    const out = calculateSetDamage(
      baseInput({
        archetype: 'recovery',
        reps: 10,
        isPersonalRecord: true,
      }),
    );
    expect(out.isRecoverySet).toBe(true);
    expect(out.finalDamage).toBe(0);
    // breakdown is still populated for transparency
    expect(out.baseAttack).toBeGreaterThan(0);
  });
});

describe('calculateSetDamage — below-threshold guards', () => {
  test('bodyweight < 3 reps scores 0', () => {
    const out = calculateSetDamage(
      baseInput({ reps: 2, isPersonalRecord: true }),
    );
    expect(out.finalDamage).toBe(0);
  });

  test('weighted with 0 reps scores 0', () => {
    const out = calculateSetDamage(
      baseInput({
        modality: 'weighted',
        exercise: BENCH,
        weightKg: 80,
        reps: 0,
      }),
    );
    expect(out.finalDamage).toBe(0);
  });
});

describe('calculateSetDamage — momentum tier scaling', () => {
  test.each([
    ['rusted', 0.9],
    ['steady', 1.0],
    ['driven', 1.1],
    ['relentless', 1.2],
    ['ascendant', 1.25],
  ] as const)('tier %s applies %fx', (tier, mult) => {
    const out = calculateSetDamage(
      baseInput({ reps: 10, momentumTier: tier, isPersonalRecord: false }),
    );
    expect(out.momentumMultiplier).toBeCloseTo(mult, 5);
  });
});

describe('calculateSetDamage — multiplier bounds & finite output', () => {
  test('no multiplier in the breakdown ever exceeds 1.5 or falls below 0.4', () => {
    for (const tier of ['rusted', 'steady', 'driven', 'relentless', 'ascendant'] as const) {
      for (const archetype of ['pressure', 'heavy', 'control', 'foundation', 'endurance'] as const) {
        for (let setIndex = 0; setIndex < 8; setIndex++) {
          for (const isWarmup of [false, true]) {
            for (const isPersonalRecord of [false, true]) {
              const out = calculateSetDamage(
                baseInput({
                  archetype,
                  momentumTier: tier,
                  setIndex,
                  sessionSetCount: setIndex,
                  isPersonalRecord,
                  isWarmup,
                  reps: 10,
                }),
              );
              for (const m of [
                out.archetypeMultiplier,
                out.momentumMultiplier,
                out.fatigueMultiplier,
                out.critMultiplier,
              ]) {
                expect(m).toBeGreaterThanOrEqual(0.4);
                expect(m).toBeLessThanOrEqual(1.5);
              }
              expect(Number.isFinite(out.finalDamage)).toBe(true);
              expect(out.finalDamage).toBeGreaterThanOrEqual(0);
            }
          }
        }
      }
    }
  });

  test('extreme inputs do not overflow', () => {
    const out = calculateSetDamage(
      baseInput({
        modality: 'weighted',
        exercise: BENCH,
        reps: 9999,
        weightKg: 9999,
        bodyweightKg: 9999,
        isPersonalRecord: true,
        momentumTier: 'ascendant',
      }),
    );
    expect(Number.isFinite(out.finalDamage)).toBe(true);
    expect(out.finalDamage).toBeGreaterThan(0);
  });
});

describe('calculateSetDamage — junk volume marker', () => {
  test('flag fires at and above the floor; suppressed in gentleMode', () => {
    const normal = calculateSetDamage(
      baseInput({ reps: 10, sessionSetCount: 12 }),
    );
    expect(normal.junkVolumePenaltyApplied).toBe(true);

    const gentle = calculateSetDamage(
      baseInput({ reps: 10, sessionSetCount: 12, recoveryMode: true }),
    );
    expect(gentle.junkVolumePenaltyApplied).toBe(false);

    const below = calculateSetDamage(
      baseInput({ reps: 10, sessionSetCount: 5 }),
    );
    expect(below.junkVolumePenaltyApplied).toBe(false);
  });
});

describe('calculateSetDamage — heavy + pike pushup spot check (003 §8 follow-on)', () => {
  // After 3 sets of pushups defeating ~260 damage of Sluggard,
  // a single pike pushup set should still produce sensible numbers.
  test('pike pushup, 10 reps, steady, after 3 prior sets in the Quest', () => {
    const out = calculateSetDamage(
      baseInput({
        exercise: PIKE_PUSHUP,
        reps: 10,
        setIndex: 0,           // first working set of a NEW battle
        sessionSetCount: 3,
        exerciseChanged: true, // refunds 1 fatigue point
        momentumTier: 'steady',
        archetype: 'pressure',
      }),
    );
    expect(out.effectiveLoad).toBeCloseTo(45, 5); // 75 * 0.6
    expect(out.baseAttack).toBeCloseTo(75, 5);    // 10 * 45 / 6
    // After refund, fatigue is ~0 → modifier 1.0
    expect(out.fatigueMultiplier).toBe(1.0);
    expect(out.finalDamage).toBeGreaterThan(0);
  });
});
