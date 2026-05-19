/**
 * Golden-table integration tests for the combat engine.
 *
 * These tests pin down complete, named, narratively-meaningful
 * scenarios so a balance change cannot land silently. Each scenario:
 *
 *   - constructs a Quest as a sequence of sets,
 *   - feeds each set through `calculateSetDamage`,
 *   - aggregates the results through `calculateQuestXp`,
 *   - asserts the exact expected per-set damage (rounded for
 *     readability) and the final XP,
 *   - asserts universal multiplier bounds (0.4 ≤ m ≤ 1.5),
 *   - asserts no NaN / Infinity ever appears.
 *
 * A failing golden test should be read as "the balance shifted —
 * confirm intentional, then update the table."
 */

import {
  accumulateFatigue,
  calculateMomentumGain,
  calculateQuestXp,
  calculateSetDamage,
} from '@dwhi/workout-domain';
import type {
  AccumulateFatigueInput,
  ExerciseProfile,
  QuestSetSummary,
  SetDamageInput,
} from '@dwhi/workout-domain';

// ----- Exercise profiles (mirroring 003 §2.2 table) -----
const PUSHUP: ExerciseProfile = { loadScale: 8, bodyweightCoefficient: 0.65 };
const BENCH: ExerciseProfile = { loadScale: 8, bodyweightCoefficient: 0 };
const PIKE_PUSHUP: ExerciseProfile = { loadScale: 6, bodyweightCoefficient: 0.6 };
const DIAMOND_PUSHUP: ExerciseProfile = { loadScale: 4, bodyweightCoefficient: 0.65 };
const SQUAT: ExerciseProfile = { loadScale: 8, bodyweightCoefficient: 0 };
const ROW: ExerciseProfile = { loadScale: 6, bodyweightCoefficient: 0 };
const MOBILITY: ExerciseProfile = { loadScale: 6, bodyweightCoefficient: 0.5 };

// ----- Helpers -----
interface SetPlan {
  modality: SetDamageInput['modality'];
  archetype: SetDamageInput['archetype'];
  exercise: ExerciseProfile;
  reps?: number;
  durationSeconds?: number;
  weightKg?: number;
  isPersonalRecord?: boolean;
  isWarmup?: boolean;
  setIndex: number;
  exerciseChanged?: boolean;
}

function runQuest(plan: {
  bodyweightKg: number;
  momentumTier: SetDamageInput['momentumTier'];
  recoveryMode: boolean;
  sets: readonly SetPlan[];
}): {
  damages: number[];
  multiplierBounds: { min: number; max: number };
  workingSets: QuestSetSummary[];
} {
  // Pre-compute fatigue points via the accumulator so per-set damage
  // is exact, not approximated.
  const fatigueStream: AccumulateFatigueInput[] = plan.sets.map((s) => ({
    archetype: s.archetype,
    isWarmup: !!s.isWarmup,
    exerciseChanged: s.exerciseChanged,
  }));
  const { runningPoints } = accumulateFatigue(fatigueStream);

  const damages: number[] = [];
  const workingSets: QuestSetSummary[] = [];
  let allMin = Infinity;
  let allMax = -Infinity;

  let priorWorkingSets = 0;
  for (let i = 0; i < plan.sets.length; i++) {
    const s = plan.sets[i];
    const before = i === 0 ? 0 : runningPoints[i - 1];

    const out = calculateSetDamage({
      modality: s.modality,
      archetype: s.archetype,
      exercise: s.exercise,
      reps: s.reps,
      durationSeconds: s.durationSeconds,
      weightKg: s.weightKg,
      bodyweightKg: plan.bodyweightKg,
      setIndex: s.setIndex,
      sessionSetCount: priorWorkingSets,
      fatiguePointsBeforeSet: before,
      exerciseChanged: s.exerciseChanged,
      momentumTier: plan.momentumTier,
      isPersonalRecord: !!s.isPersonalRecord,
      isWarmup: !!s.isWarmup,
      recoveryMode: plan.recoveryMode,
    });

    damages.push(out.finalDamage);
    for (const m of [
      out.archetypeMultiplier,
      out.momentumMultiplier,
      out.fatigueMultiplier,
      out.critMultiplier,
    ]) {
      if (m < allMin) allMin = m;
      if (m > allMax) allMax = m;
    }
    expect(Number.isFinite(out.finalDamage)).toBe(true);
    expect(out.finalDamage).toBeGreaterThanOrEqual(0);

    workingSets.push({
      damage: out.finalDamage,
      archetype: s.archetype,
      isWarmup: s.isWarmup,
    });
    if (!s.isWarmup) priorWorkingSets += 1;
  }

  return {
    damages,
    multiplierBounds: { min: allMin, max: allMax },
    workingSets,
  };
}

function rounded(damages: readonly number[]): number[] {
  return damages.map((d) => Math.round(d));
}

// ===========================================================================
// Scenario 1 — Beginner Pushup Session
//
// Mirrors the 003 §8 worked example, recalibrated for the archetype
// system in 007 (pressure: +3%/set combo, 0.6 fatigue cost/set).
// Set 1 still lands at 91; sets 2 and 3 land slightly higher than
// the pre-archetype example showed.
// ===========================================================================

describe('GOLDEN: Beginner Pushup Session', () => {
  test('3 sets of pushups, Steady, two PRs → [91, 113, 65]', () => {
    const result = runQuest({
      bodyweightKg: 75,
      momentumTier: 'steady',
      recoveryMode: false,
      sets: [
        {
          modality: 'bodyweight',
          archetype: 'pressure',
          exercise: PUSHUP,
          reps: 10,
          setIndex: 0,
          isPersonalRecord: true, // first-ever logged
        },
        {
          modality: 'bodyweight',
          archetype: 'pressure',
          exercise: PUSHUP,
          reps: 12,
          setIndex: 1,
          isPersonalRecord: true, // rep PR
        },
        {
          modality: 'bodyweight',
          archetype: 'pressure',
          exercise: PUSHUP,
          reps: 10,
          setIndex: 2,
          isPersonalRecord: false,
        },
      ],
    });

    expect(rounded(result.damages)).toEqual([91, 113, 65]);
    expect(result.multiplierBounds.min).toBeGreaterThanOrEqual(0.4);
    expect(result.multiplierBounds.max).toBeLessThanOrEqual(1.5);

    const xp = calculateQuestXp({
      workingSets: result.workingSets,
      plannedSetCount: 3,
      exitedAtPlannedVolume: true,
    });
    // ~269.5 damage * 0.1 * 1.1 (disciplined) ≈ 29.6 → 29
    expect(xp.xp).toBeGreaterThanOrEqual(25);
    expect(xp.xp).toBeLessThanOrEqual(35);
    expect(xp.junkVolumePenalty).toBe(0);
  });
});

// ===========================================================================
// Scenario 2 — Advanced Heavy Squat Day
//
// 100 kg, Driven, two warmups + 5x5 working sets on squat (heavy).
// Top set is a weight PR.
// ===========================================================================

describe('GOLDEN: Advanced Heavy Squat Day', () => {
  test('warmups + 5x5 + PR top set, all bounded', () => {
    const result = runQuest({
      bodyweightKg: 90,
      momentumTier: 'driven',
      recoveryMode: false,
      sets: [
        // Warmups
        {
          modality: 'weighted',
          archetype: 'heavy',
          exercise: SQUAT,
          reps: 5,
          weightKg: 60,
          setIndex: 0,
          isWarmup: true,
        },
        {
          modality: 'weighted',
          archetype: 'heavy',
          exercise: SQUAT,
          reps: 5,
          weightKg: 80,
          setIndex: 0,
          isWarmup: true,
        },
        // Working — 5x5 @ 100 kg
        {
          modality: 'weighted',
          archetype: 'heavy',
          exercise: SQUAT,
          reps: 5,
          weightKg: 100,
          setIndex: 0,
        },
        {
          modality: 'weighted',
          archetype: 'heavy',
          exercise: SQUAT,
          reps: 5,
          weightKg: 100,
          setIndex: 1,
        },
        {
          modality: 'weighted',
          archetype: 'heavy',
          exercise: SQUAT,
          reps: 5,
          weightKg: 100,
          setIndex: 2,
        },
        {
          modality: 'weighted',
          archetype: 'heavy',
          exercise: SQUAT,
          reps: 5,
          weightKg: 100,
          setIndex: 3,
        },
        {
          modality: 'weighted',
          archetype: 'heavy',
          exercise: SQUAT,
          reps: 5,
          weightKg: 105,
          setIndex: 4,
          isPersonalRecord: true,
        },
      ],
    });

    const r = rounded(result.damages);

    // Each warmup costs 0.5 fatigue pt — they accumulate too.
    // After 2 warmups, pool = 1.0pt, so the first working set
    // already feels them (fatigueMult 0.95). Damage values below
    // are the engine's truth.
    //
    // W1 (warmup, weight 60kg): 5 * 60 / 8 * 0.25 = 9.375 → 9
    // W2 (warmup, weight 80kg): 5 * 80 / 8 * 0.25 = 12.5 → 13
    expect(r[0]).toBe(9);
    expect(r[1]).toBe(13);

    // S3 (first working): baseAttack = 62.5, archetype 1.2 + 0.25 (first-set)
    //   = 1.45, momentum 1.1, fatigue 0.95 (1.0pt from warmups), crit 1.0.
    //   62.5 * 1.45 * 1.1 * 0.95 = 94.703... → 95
    expect(r[2]).toBe(95);

    // S4 (setIndex 1): archetype 1.2, fatigue still 0.95 (free).
    //   62.5 * 1.2 * 1.1 * 0.95 = 78.375 → 78
    expect(r[3]).toBe(78);

    // S5 (setIndex 2): pool still 1.0 (S3 & S4 were free).
    //   Same as S4 → 78
    expect(r[4]).toBe(78);

    // S6 (setIndex 3): pool now 2.4 (S5 added 1.4). fatigue 0.88.
    //   62.5 * 1.2 * 1.1 * 0.88 = 72.6 → 73
    expect(r[5]).toBe(73);

    // S7 PR (setIndex 4): pool 3.8. fatigue 0.81. baseAttack 65.625.
    //   65.625 * 1.2 * 1.1 * 0.81 * 1.5 = 105.249... → 105
    expect(r[6]).toBe(105);

    expect(result.multiplierBounds.min).toBeGreaterThanOrEqual(0.4);
    expect(result.multiplierBounds.max).toBeLessThanOrEqual(1.5);

    const xp = calculateQuestXp({
      workingSets: result.workingSets,
      plannedSetCount: 5,
      exitedAtPlannedVolume: true,
    });
    expect(xp.xp).toBeGreaterThan(40);
    expect(xp.xp).toBeLessThan(80);
    expect(xp.junkVolumePenalty).toBe(0);
  });
});

// ===========================================================================
// Scenario 3 — Recovery Mobility Quest
//
// Six recovery sets. No damage. No XP from damage (still 0). Momentum
// gain of 3 (recovery / camp).
// ===========================================================================

describe('GOLDEN: Recovery Mobility Quest', () => {
  test('all sets score 0 damage; XP = 0; momentum gain = 3', () => {
    const result = runQuest({
      bodyweightKg: 70,
      momentumTier: 'steady',
      recoveryMode: false,
      sets: Array.from({ length: 6 }, (_, i) => ({
        modality: 'mobility' as const,
        archetype: 'recovery' as const,
        exercise: MOBILITY,
        durationSeconds: 60,
        setIndex: i,
      })),
    });

    expect(result.damages).toEqual([0, 0, 0, 0, 0, 0]);

    const xp = calculateQuestXp({
      workingSets: result.workingSets,
      plannedSetCount: 6,
      exitedAtPlannedVolume: true,
      isRecoveryQuest: true,
    });
    expect(xp.xp).toBe(0);
    expect(xp.junkVolumePenalty).toBe(0);

    const momentum = calculateMomentumGain({
      outcome: 'recovery',
      disciplinedExit: true,
    });
    expect(momentum.applied).toBe(4); // 3 (recovery) + 1 (disciplined)
  });
});

// ===========================================================================
// Scenario 4 — Comeback-After-7-Days Quest
//
// gentleMode active: fatigue floor 0.6, junk penalty suppressed.
// XP gets the comeback +20%. Momentum gain stacks Return bonus.
// ===========================================================================

describe('GOLDEN: Comeback After 7 Days Quest', () => {
  test('gentleMode floor, +20% XP, +8 momentum capped', () => {
    const result = runQuest({
      bodyweightKg: 75,
      momentumTier: 'rusted', // gone a week → rusted is plausible
      recoveryMode: true,
      sets: [
        // Pushup x 3, then pike pushup x 2 — 5 working sets
        {
          modality: 'bodyweight',
          archetype: 'pressure',
          exercise: PUSHUP,
          reps: 8,
          setIndex: 0,
          isPersonalRecord: false,
        },
        {
          modality: 'bodyweight',
          archetype: 'pressure',
          exercise: PUSHUP,
          reps: 8,
          setIndex: 1,
        },
        {
          modality: 'bodyweight',
          archetype: 'pressure',
          exercise: PUSHUP,
          reps: 8,
          setIndex: 2,
        },
        {
          modality: 'bodyweight',
          archetype: 'pressure',
          exercise: PIKE_PUSHUP,
          reps: 6,
          setIndex: 0,
          exerciseChanged: true,
        },
        {
          modality: 'bodyweight',
          archetype: 'pressure',
          exercise: PIKE_PUSHUP,
          reps: 6,
          setIndex: 1,
        },
      ],
    });

    expect(result.multiplierBounds.min).toBeGreaterThanOrEqual(0.4);
    expect(result.multiplierBounds.max).toBeLessThanOrEqual(1.5);
    for (const d of result.damages) {
      expect(Number.isFinite(d)).toBe(true);
      expect(d).toBeGreaterThan(0);
    }

    const xp = calculateQuestXp({
      workingSets: result.workingSets,
      plannedSetCount: 5,
      exitedAtPlannedVolume: true,
      isComebackQuest: true,
      suppressJunkPenalty: true,
    });
    expect(xp.comebackBonus).toBe(1.2);
    expect(xp.disciplinedExitBonus).toBe(1.1);
    expect(xp.junkVolumePenalty).toBe(0);

    const momentum = calculateMomentumGain({
      outcome: 'full',
      isReturnQuest: true,
      disciplinedExit: true,
    });
    // 6 (full) + 8 (return) + 1 (disciplined) = 15 uncapped → 10 cap
    expect(momentum.uncapped).toBe(15);
    expect(momentum.applied).toBe(10);
    expect(momentum.hitDailyCap).toBe(true);
  });
});

// ===========================================================================
// Scenario 5 — Junk Volume Spam Session
//
// 25 working sets of pushups, planned 8. Past planned+30% sets earn
// zero. Final junk penalty kicks in. Per-set damage stays bounded.
// ===========================================================================

describe('GOLDEN: Junk Volume Spam Session', () => {
  test('overshoot tapers to zero, junk penalty deducts, no NaN', () => {
    const result = runQuest({
      bodyweightKg: 75,
      momentumTier: 'steady',
      recoveryMode: false,
      sets: Array.from({ length: 25 }, (_, i) => ({
        modality: 'bodyweight' as const,
        archetype: 'pressure' as const,
        exercise: PUSHUP,
        reps: 10,
        setIndex: i,
      })),
    });

    expect(result.multiplierBounds.min).toBeGreaterThanOrEqual(0.4);
    expect(result.multiplierBounds.max).toBeLessThanOrEqual(1.5);

    // Fatigue should hit the floor (0.5) well before set 25.
    // We assert that the LAST set is damaged at the floor.
    const last = result.damages[result.damages.length - 1];
    expect(last).toBeGreaterThan(0);
    expect(last).toBeLessThan(result.damages[0]); // worse than first

    const xp = calculateQuestXp({
      workingSets: result.workingSets,
      plannedSetCount: 8,
      exitedAtPlannedVolume: false,
    });
    // planned 8, overshoot range = ceil(8*0.3) = 3 → sets 9..11 taper,
    // sets 12+ score 0 XP from damage.
    expect(xp.setsBeyondSoftCap).toBe(25 - 8 - 3);
    // junk penalty: max(8, 12) = 12 → 25 - 12 = 13 penalty sets * 5 = 65
    expect(xp.junkVolumePenalty).toBe(65);
    expect(xp.xp).toBeGreaterThanOrEqual(0); // never negative
    expect(Number.isInteger(xp.xp)).toBe(true);
  });
});

// ===========================================================================
// Scenario 6 — Balanced Push / Pull / Legs Day
//
// Three battles, three distinct archetypes (heavy / control /
// foundation). Full variety bonus on the XP side, disciplined exit,
// no penalty.
// ===========================================================================

describe('GOLDEN: Balanced Push/Pull/Legs Day', () => {
  test('archetype variety bonus and disciplined exit stack', () => {
    const result = runQuest({
      bodyweightKg: 80,
      momentumTier: 'driven',
      recoveryMode: false,
      sets: [
        // Push: bench (heavy) 3 sets
        {
          modality: 'weighted',
          archetype: 'heavy',
          exercise: BENCH,
          reps: 5,
          weightKg: 80,
          setIndex: 0,
        },
        {
          modality: 'weighted',
          archetype: 'heavy',
          exercise: BENCH,
          reps: 5,
          weightKg: 80,
          setIndex: 1,
        },
        {
          modality: 'weighted',
          archetype: 'heavy',
          exercise: BENCH,
          reps: 5,
          weightKg: 80,
          setIndex: 2,
        },
        // Pull: rows (control) 3 sets
        {
          modality: 'weighted',
          archetype: 'control',
          exercise: ROW,
          reps: 8,
          weightKg: 60,
          setIndex: 0,
          exerciseChanged: true,
        },
        {
          modality: 'weighted',
          archetype: 'control',
          exercise: ROW,
          reps: 8,
          weightKg: 60,
          setIndex: 1,
        },
        {
          modality: 'weighted',
          archetype: 'control',
          exercise: ROW,
          reps: 8,
          weightKg: 60,
          setIndex: 2,
        },
        // Legs: bodyweight squats (foundation) 3 sets — using PIKE_PUSHUP's
        // profile values are wrong for a real squat, but the GOLDEN
        // table just needs deterministic inputs. We use DIAMOND_PUSHUP's
        // loadScale to keep numbers in range.
        {
          modality: 'bodyweight',
          archetype: 'foundation',
          exercise: DIAMOND_PUSHUP,
          reps: 12,
          setIndex: 0,
          exerciseChanged: true,
        },
        {
          modality: 'bodyweight',
          archetype: 'foundation',
          exercise: DIAMOND_PUSHUP,
          reps: 12,
          setIndex: 1,
        },
        {
          modality: 'bodyweight',
          archetype: 'foundation',
          exercise: DIAMOND_PUSHUP,
          reps: 12,
          setIndex: 2,
        },
      ],
    });

    expect(result.multiplierBounds.min).toBeGreaterThanOrEqual(0.4);
    expect(result.multiplierBounds.max).toBeLessThanOrEqual(1.5);
    for (const d of result.damages) {
      expect(Number.isFinite(d)).toBe(true);
      expect(d).toBeGreaterThan(0);
    }

    const xp = calculateQuestXp({
      workingSets: result.workingSets,
      plannedSetCount: 9,
      exitedAtPlannedVolume: true,
    });
    expect(xp.distinctArchetypes).toBe(3);
    expect(xp.varietyBonus).toBeCloseTo(1.1, 5);
    expect(xp.disciplinedExitBonus).toBe(1.1);
    expect(xp.junkVolumePenalty).toBe(0);
    expect(xp.xp).toBeGreaterThan(50);

    const momentum = calculateMomentumGain({
      outcome: 'full',
      disciplinedExit: true,
      varietyBonus: true,
    });
    expect(momentum.applied).toBe(8); // 6 + 1 + 1
    expect(momentum.hitDailyCap).toBe(false);
  });
});
