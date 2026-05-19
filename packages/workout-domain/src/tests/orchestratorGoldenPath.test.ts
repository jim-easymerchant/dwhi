/**
 * Golden-path orchestrator scenarios.
 *
 * Eight named scenarios from the orchestrator spec. Each scenario
 * asserts the most important structural facts about the run; we
 * deliberately do NOT pin every floating-point value (that's what
 * `combatGoldenTables.test.ts` is for), instead the focus is on
 * what the *pipeline* does end-to-end:
 *
 *   - which verdicts surface,
 *   - whether the enemy is defeated and when,
 *   - the shape of the reward packet,
 *   - whether momentum tier shifted,
 *   - that gentleMode signals propagate,
 *   - that nothing produces NaN / Infinity / silent zero.
 */

import { runQuest } from '@dwhi/workout-domain';
import type {
  EnemyInput,
  ExerciseProfile,
  RunQuestInput,
  SetInput,
} from '@dwhi/workout-domain';

const PUSHUP: ExerciseProfile = { loadScale: 8, bodyweightCoefficient: 0.65 };
const PIKE_PUSHUP: ExerciseProfile = { loadScale: 6, bodyweightCoefficient: 0.6 };
const DIAMOND_PUSHUP: ExerciseProfile = { loadScale: 4, bodyweightCoefficient: 0.65 };
const BENCH: ExerciseProfile = { loadScale: 8, bodyweightCoefficient: 0 };
const SQUAT: ExerciseProfile = { loadScale: 8, bodyweightCoefficient: 0 };
const ROW: ExerciseProfile = { loadScale: 6, bodyweightCoefficient: 0 };
const MOBILITY: ExerciseProfile = { loadScale: 6, bodyweightCoefficient: 0.5 };

function sluggard(maxHp: number, mood: EnemyInput['mood'] = 'drift'): EnemyInput {
  return {
    id: 'sluggard',
    name: 'Sluggard, Lord of Couches',
    maxHp,
    mood,
    category: 'lesser_fragment',
  };
}

function pushup(setIndex: number, overrides: Partial<SetInput> = {}): SetInput {
  return {
    exerciseId: 'pushup',
    exerciseName: 'Pushup',
    modality: 'bodyweight',
    archetype: 'pressure',
    exercise: PUSHUP,
    bodyweightKg: 75,
    setIndex,
    reps: 10,
    ...overrides,
  };
}

function expectBoundedAndFinite(out: ReturnType<typeof runQuest>): void {
  for (const s of out.setResults) {
    for (const m of [
      s.archetypeMultiplier,
      s.momentumMultiplier,
      s.fatigueMultiplier,
      s.critMultiplier,
    ]) {
      expect(m).toBeGreaterThanOrEqual(0.4);
      expect(m).toBeLessThanOrEqual(1.5);
    }
    expect(Number.isFinite(s.damage)).toBe(true);
    expect(s.damage).toBeGreaterThanOrEqual(0);
  }
  expect(Number.isFinite(out.totalDamage)).toBe(true);
  expect(Number.isFinite(out.questXp.xp)).toBe(true);
  expect(out.questXp.xp).toBeGreaterThanOrEqual(0);
}

// =========================================================================
// 1 — Normal beginner session
// =========================================================================

describe('GOLDEN PATH 1: Normal Beginner Session', () => {
  test('3 pushup sets, Steady, enemy falls, disciplined exit', () => {
    // Total damage on these inputs is ~269 (see worked-example
    // tests). 250 HP guarantees the second PR set finishes the
    // enemy.
    const input: RunQuestInput = {
      quest: { id: 'q', kind: 'strength', plannedSetCount: 3 },
      enemy: sluggard(250),
      sets: [
        pushup(0, { isPersonalRecord: true }),
        pushup(1, { reps: 12, isPersonalRecord: true }),
        pushup(2),
      ],
      priorMomentum: 25,
      daysSinceLastQuest: 1,
      nowIso: '2026-05-19T10:00:00Z',
    };
    const out = runQuest(input);

    expectBoundedAndFinite(out);
    expect(out.enemyResult?.defeated).toBe(true);
    expect(out.verdicts).toContain('Disciplined Exit');
    expect(out.verdicts).toContain('PR Logged');
    expect(out.verdicts).toContain('Finisher');
    expect(out.verdicts).toContain('Steady');
    expect(out.momentum.gainBreakdown.applied).toBeGreaterThan(0);
    expect(out.momentum.gentleModeActive).toBe(false);
  });
});

// =========================================================================
// 2 — Comeback after 2 weeks
// =========================================================================

describe('GOLDEN PATH 2: Comeback After 2 Weeks', () => {
  test('long absence, gentleMode active, return bonus, momentum capped', () => {
    // Enemy sized so 3 light sets of pushups at driven momentum
    // (1.1x) just defeat it — the comeback succeeds. With pressure
    // archetype + 8 reps each: ~55 dmg/set × 3 ≈ 165. HP 150
    // guarantees a full-quest outcome (6 + 8 return + 1 disciplined
    // = 15 uncapped, capped at 10).
    const input: RunQuestInput = {
      quest: {
        id: 'q',
        kind: 'strength',
        plannedSetCount: 3,
        isComebackQuest: true,
      },
      enemy: sluggard(150),
      sets: [
        pushup(0, { reps: 8 }),
        pushup(1, { reps: 8 }),
        pushup(2, { reps: 8 }),
      ],
      priorMomentum: 60,
      daysSinceLastQuest: 14,
      nowIso: '2026-06-02T10:00:00Z',
    };
    const out = runQuest(input);

    expectBoundedAndFinite(out);
    expect(out.verdicts).toContain('Comeback Quest');
    expect(out.momentum.gentleModeActive).toBe(true);
    expect(out.momentum.decayApplied).toBeGreaterThan(0);
    expect(out.enemyResult?.defeated).toBe(true);
    // Full quest + return bonus + disciplined exit = 6 + 8 + 1 = 15
    // uncapped; the daily cap of 10 applies.
    expect(out.momentum.gainBreakdown.uncapped).toBeGreaterThanOrEqual(14);
    expect(out.momentum.gainBreakdown.applied).toBe(10);
    expect(out.momentum.gainBreakdown.hitDailyCap).toBe(true);
    expect(out.questXp.junkVolumePenalty).toBe(0);
  });
});

// =========================================================================
// 3 — Recovery quest
// =========================================================================

describe('GOLDEN PATH 3: Recovery Quest', () => {
  test('no enemy, zero damage, Warmth Returned, recoveryBonus > 0', () => {
    const input: RunQuestInput = {
      quest: { id: 'q', kind: 'recovery', plannedSetCount: 6 },
      sets: Array.from({ length: 6 }, (_, i) => ({
        exerciseId: 'mobility',
        exerciseName: 'Mobility Flow',
        modality: 'mobility',
        archetype: 'recovery',
        exercise: MOBILITY,
        durationSeconds: 90,
        setIndex: i,
      })),
      priorMomentum: 30,
      daysSinceLastQuest: 1,
      nowIso: '2026-05-19T20:00:00Z',
    };
    const out = runQuest(input);

    expect(out.enemyResult).toBeNull();
    expect(out.totalDamage).toBe(0);
    expect(out.questXp.xp).toBe(0);
    expect(out.verdicts).toContain('Warmth Returned');
    expect(out.rewards.recoveryBonus).toBeGreaterThan(0);
    expect(out.rewards.recoveryBonus).toBeLessThanOrEqual(0.15);
    expect(out.momentum.gainBreakdown.applied).toBeGreaterThan(0);
  });
});

// =========================================================================
// 4 — Junk-volume spam attempt
// =========================================================================

describe('GOLDEN PATH 4: Junk-Volume Spam Attempt', () => {
  test('30 sets planned for 5; tapers, penalises, never crashes', () => {
    const input: RunQuestInput = {
      quest: { id: 'q', kind: 'strength', plannedSetCount: 5 },
      enemy: sluggard(2000),
      sets: Array.from({ length: 30 }, (_, i) => pushup(i)),
      priorMomentum: 25,
      daysSinceLastQuest: 1,
      nowIso: '2026-05-19T18:00:00Z',
    };
    const out = runQuest(input);

    expectBoundedAndFinite(out);
    // Late sets should hit the fatigue floor.
    const lateSet = out.setResults[out.setResults.length - 1];
    expect(lateSet.fatigueMultiplier).toBeLessThanOrEqual(0.5 + 1e-9);
    // XP should reflect the junk-volume penalty.
    expect(out.questXp.junkVolumePenalty).toBeGreaterThan(0);
    // setsBeyondSoftCap kicks in past planned + 30% = 5 + 2 = 7 → 23 sets zeroed.
    expect(out.questXp.setsBeyondSoftCap).toBeGreaterThan(0);
    // Verdict should NOT include Disciplined Exit (player blew past planned).
    expect(out.verdicts).not.toContain('Disciplined Exit');
  });
});

// =========================================================================
// 5 — Disciplined balanced session (push / pull / legs)
// =========================================================================

describe('GOLDEN PATH 5: Disciplined Balanced Session', () => {
  test('3 archetypes, full variety bonus, disciplined exit, finisher', () => {
    const input: RunQuestInput = {
      quest: { id: 'q', kind: 'strength', plannedSetCount: 9 },
      enemy: sluggard(800),
      sets: [
        // Bench (heavy) x 3
        ...[0, 1, 2].map((i) => ({
          exerciseId: 'bench',
          exerciseName: 'Bench Press',
          modality: 'weighted' as const,
          archetype: 'heavy' as const,
          exercise: BENCH,
          reps: 5,
          weightKg: 80,
          bodyweightKg: 80,
          setIndex: i,
        })),
        // Rows (control) x 3
        ...[0, 1, 2].map((i) => ({
          exerciseId: 'row',
          exerciseName: 'Barbell Row',
          modality: 'weighted' as const,
          archetype: 'control' as const,
          exercise: ROW,
          reps: 8,
          weightKg: 60,
          bodyweightKg: 80,
          setIndex: i,
          exerciseChanged: i === 0,
        })),
        // Squats-as-foundation (diamond pushup profile for damage range) x 3
        ...[0, 1, 2].map((i) => ({
          exerciseId: 'squat',
          exerciseName: 'Bodyweight Squat',
          modality: 'bodyweight' as const,
          archetype: 'foundation' as const,
          exercise: DIAMOND_PUSHUP,
          reps: 12,
          bodyweightKg: 80,
          setIndex: i,
          exerciseChanged: i === 0,
        })),
      ],
      priorMomentum: 40,
      daysSinceLastQuest: 2,
      nowIso: '2026-05-19T08:00:00Z',
    };
    const out = runQuest(input);

    expectBoundedAndFinite(out);
    expect(out.questXp.distinctArchetypes).toBe(3);
    expect(out.questXp.varietyBonus).toBeCloseTo(1.1, 5);
    expect(out.verdicts).toContain('Disciplined Exit');
    expect(out.verdicts).toContain('Steady');
    // 6 + 1 (disciplined) + 1 (variety) = 8 momentum
    expect(out.momentum.gainBreakdown.uncapped).toBe(8);
  });
});

// =========================================================================
// 6 — Failed Quest (enemy survives)
// =========================================================================

describe('GOLDEN PATH 6: Failed Quest (Enemy Survives)', () => {
  test('enemy too tough, partial credit, Held the Line', () => {
    const input: RunQuestInput = {
      quest: { id: 'q', kind: 'strength', plannedSetCount: 6 },
      enemy: sluggard(50_000),
      sets: Array.from({ length: 4 }, (_, i) => pushup(i)),
      priorMomentum: 25,
      daysSinceLastQuest: 1,
      nowIso: '2026-05-19T10:00:00Z',
    };
    const out = runQuest(input);

    expectBoundedAndFinite(out);
    expect(out.enemyResult?.defeated).toBe(false);
    expect(out.enemyResult?.defeatedOnSetIndex).toBeNull();
    expect(out.verdicts).toContain('Held the Line');
    expect(out.verdicts).not.toContain('Finisher');
    // Partial Quest momentum = +3
    expect(out.momentum.gainBreakdown.components.partialQuest).toBe(3);
  });
});

// =========================================================================
// 7 — Exact final-set kill
// =========================================================================

describe('GOLDEN PATH 7: Exact Final-Set Kill', () => {
  test('enemy HP sized to the run; final set is the kill', () => {
    // Calibrate against a huge enemy, then size the real enemy so
    // the final set lands the killing blow. We use the *floored*
    // total so the final blow is at-or-just-past the remaining HP;
    // floating-point intermediates make a literal "0 overkill"
    // assertion brittle, so we instead pin the structural facts:
    // - enemy is defeated
    // - the kill happened on the last set
    // - any overkill is small (< 1 damage)
    const sets: SetInput[] = [
      pushup(0, { isPersonalRecord: true }),
      pushup(1, { reps: 12, isPersonalRecord: true }),
      pushup(2),
    ];
    const calibration = runQuest({
      quest: { id: 'cal', kind: 'strength', plannedSetCount: 3 },
      enemy: sluggard(1_000_000),
      sets,
      priorMomentum: 25,
      daysSinceLastQuest: 1,
      nowIso: '2026-05-19T10:00:00Z',
    });
    const totalDealt = calibration.setResults.reduce(
      (acc, s) => acc + s.damage,
      0,
    );
    const exactHp = Math.floor(totalDealt);

    const out = runQuest({
      quest: { id: 'q', kind: 'strength', plannedSetCount: 3 },
      enemy: sluggard(exactHp),
      sets,
      priorMomentum: 25,
      daysSinceLastQuest: 1,
      nowIso: '2026-05-19T10:00:00Z',
    });

    expect(out.enemyResult?.defeated).toBe(true);
    expect(out.enemyResult?.finalHp).toBe(0);
    expect(out.enemyResult?.defeatedOnSetIndex).toBe(2);
    const lastSet = out.setResults[2];
    expect(lastSet.defeatedEnemy).toBe(true);
    expect(lastSet.overkillAmount).toBeLessThan(1);
    expect(out.verdicts).toContain('Finisher');
  });
});

// =========================================================================
// 8 — Overkill PR finisher
// =========================================================================

describe('GOLDEN PATH 8: Overkill PR Finisher', () => {
  test('finishing set deals more than remaining HP; overkill reported', () => {
    const input: RunQuestInput = {
      quest: { id: 'q', kind: 'strength', plannedSetCount: 3 },
      // Enemy intentionally low so the final PR pushup overkills.
      enemy: sluggard(120),
      sets: [
        pushup(0, { reps: 6 }),
        pushup(1, { reps: 6 }),
        pushup(2, { reps: 15, isPersonalRecord: true }),
      ],
      priorMomentum: 25,
      daysSinceLastQuest: 1,
      nowIso: '2026-05-19T10:00:00Z',
    };
    const out = runQuest(input);

    expectBoundedAndFinite(out);
    const finisher = out.setResults.find((s) => s.defeatedEnemy);
    expect(finisher).toBeDefined();
    expect(finisher!.isOverkill).toBe(true);
    expect(finisher!.overkillAmount).toBeGreaterThan(0);
    expect(finisher!.tags).toContain('overkill');
    expect(finisher!.tags).toContain('finisher');
    expect(finisher!.tags).toContain('pr');
    expect(out.verdicts).toContain('Finisher');
    expect(out.verdicts).toContain('PR Logged');
  });
});
