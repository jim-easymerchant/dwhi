/**
 * runQuest — basic pipeline integration tests.
 *
 * Each test exercises one structural property; the named-scenario
 * golden tests live in orchestratorGoldenPath.test.ts.
 */

import { runQuest } from '@dwhi/workout-domain';
import type {
  EnemyInput,
  ExerciseProfile,
  RunQuestInput,
  SetInput,
} from '@dwhi/workout-domain';

const PUSHUP: ExerciseProfile = { loadScale: 8, bodyweightCoefficient: 0.65 };
const BENCH: ExerciseProfile = { loadScale: 8, bodyweightCoefficient: 0 };
const MOBILITY: ExerciseProfile = { loadScale: 6, bodyweightCoefficient: 0.5 };

function pushupSet(
  setIndex: number,
  overrides: Partial<SetInput> = {},
): SetInput {
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

function sluggard(maxHp: number): EnemyInput {
  return {
    id: 'sluggard',
    name: 'Sluggard, Lord of Couches',
    maxHp,
    mood: 'drift',
    category: 'lesser_fragment',
  };
}

function baseInput(overrides: Partial<RunQuestInput> = {}): RunQuestInput {
  return {
    quest: { id: 'q1', kind: 'strength', plannedSetCount: 3 },
    enemy: sluggard(350),
    sets: [pushupSet(0, { isPersonalRecord: true }), pushupSet(1), pushupSet(2)],
    priorMomentum: 25,
    daysSinceLastQuest: 1,
    nowIso: '2026-05-19T10:00:00Z',
    ...overrides,
  };
}

describe('runQuest — determinism', () => {
  test('same inputs → same outputs (byte-for-byte stable)', () => {
    const a = runQuest(baseInput());
    const b = runQuest(baseInput());
    expect(a).toEqual(b);
  });
});

describe('runQuest — structural invariants', () => {
  test('setResults length matches input.sets', () => {
    const out = runQuest(baseInput());
    expect(out.setResults).toHaveLength(3);
  });

  test('fatigueTimeline length matches input.sets', () => {
    const out = runQuest(baseInput());
    expect(out.fatigueTimeline).toHaveLength(3);
  });

  test('totalDamage equals sum of damages applied to the enemy', () => {
    const out = runQuest(baseInput());
    const expectedTotal = Math.min(
      out.setResults.reduce((acc, s) => acc + s.damage, 0),
      out.enemyResult?.maxHp ?? 0,
    );
    expect(out.totalDamage).toBeCloseTo(expectedTotal, 1);
  });

  test('telemetry stamps nowIso unchanged', () => {
    const out = runQuest(baseInput({ nowIso: '2030-01-01T00:00:00Z' }));
    expect(out.telemetry.nowIso).toBe('2030-01-01T00:00:00Z');
  });
});

describe('runQuest — recovery quests', () => {
  test('no enemy, zero damage, Warmth Returned', () => {
    const out = runQuest({
      quest: { id: 'q2', kind: 'recovery', plannedSetCount: 4 },
      sets: Array.from({ length: 4 }, (_, i) => ({
        exerciseId: 'mobility',
        exerciseName: 'Mobility Flow',
        modality: 'mobility',
        archetype: 'recovery',
        exercise: MOBILITY,
        durationSeconds: 60,
        setIndex: i,
      })),
      priorMomentum: 30,
      daysSinceLastQuest: 1,
      nowIso: '2026-05-19T20:00:00Z',
    });
    expect(out.enemyResult).toBeNull();
    expect(out.totalDamage).toBe(0);
    expect(out.verdicts).toContain('Warmth Returned');
    expect(out.questXp.xp).toBe(0);
    expect(out.momentum.gainBreakdown.applied).toBeGreaterThan(0);
  });
});

describe('runQuest — gentleMode signal flows through', () => {
  test('isComebackQuest sets gentleModeActive and suppresses junk penalty', () => {
    const out = runQuest(
      baseInput({
        quest: {
          id: 'q3',
          kind: 'strength',
          plannedSetCount: 3,
          isComebackQuest: true,
        },
        daysSinceLastQuest: 9,
        priorMomentum: 30,
      }),
    );
    expect(out.momentum.gentleModeActive).toBe(true);
    expect(out.verdicts).toContain('Comeback Quest');
    expect(out.questXp.junkVolumePenalty).toBe(0);
  });
});

describe('runQuest — enemy progression', () => {
  test('exact kill: last set drops enemy to 0; defeatedOnSetIndex matches', () => {
    const out = runQuest({
      quest: { id: 'q4', kind: 'strength', plannedSetCount: 2 },
      // Enemy carefully sized so 2 PR pushup sets defeat it.
      // Set 1 PR ≈ 91; set 2 PR ≈ 113; total ≈ 204.
      enemy: sluggard(200),
      sets: [
        pushupSet(0, { isPersonalRecord: true }),
        pushupSet(1, { reps: 12, isPersonalRecord: true }),
      ],
      priorMomentum: 25,
      daysSinceLastQuest: 1,
      nowIso: '2026-05-19T11:00:00Z',
    });
    expect(out.enemyResult?.defeated).toBe(true);
    expect(out.enemyResult?.defeatedOnSetIndex).toBe(1);
    expect(out.enemyResult?.finalHp).toBe(0);
  });

  test('partial run leaves enemy alive; verdict includes Held the Line', () => {
    const out = runQuest({
      quest: { id: 'q5', kind: 'strength', plannedSetCount: 6 },
      enemy: sluggard(10_000), // unkillable for the test
      sets: Array.from({ length: 4 }, (_, i) => pushupSet(i)),
      priorMomentum: 25,
      daysSinceLastQuest: 1,
      nowIso: '2026-05-19T11:00:00Z',
    });
    expect(out.enemyResult?.defeated).toBe(false);
    expect(out.verdicts).toContain('Held the Line');
  });
});

describe('runQuest — rewards & telemetry', () => {
  test('rewards.momentumDelta mirrors momentum.gainBreakdown.applied', () => {
    const out = runQuest(baseInput());
    expect(out.rewards.momentumDelta).toBe(out.momentum.gainBreakdown.applied);
  });

  test('rewards.xp mirrors questXp.xp', () => {
    const out = runQuest(baseInput());
    expect(out.rewards.xp).toBe(out.questXp.xp);
  });

  test('loreChance is in [0, 1]', () => {
    const out = runQuest(baseInput());
    expect(out.rewards.loreChance).toBeGreaterThanOrEqual(0);
    expect(out.rewards.loreChance).toBeLessThanOrEqual(1);
  });

  test('equipmentAffinity tallies working sets per archetype', () => {
    const out = runQuest(baseInput());
    expect(out.rewards.equipmentAffinity.pressure).toBe(3);
  });

  test('warmup sets do not count toward equipmentAffinity', () => {
    const out = runQuest({
      quest: { id: 'q6', kind: 'strength', plannedSetCount: 2 },
      enemy: sluggard(500),
      sets: [
        pushupSet(0, { isWarmup: true, reps: 6 }),
        pushupSet(0, { isPersonalRecord: true }),
        pushupSet(1),
      ],
      priorMomentum: 25,
      daysSinceLastQuest: 1,
      nowIso: '2026-05-19T11:00:00Z',
    });
    expect(out.rewards.equipmentAffinity.pressure).toBe(2);
  });

  test('telemetry counts are correct', () => {
    const out = runQuest({
      quest: { id: 'q7', kind: 'strength', plannedSetCount: 2 },
      enemy: sluggard(500),
      sets: [
        pushupSet(0, { isWarmup: true, reps: 6 }),
        pushupSet(0, { isPersonalRecord: true }),
        pushupSet(1),
      ],
      priorMomentum: 25,
      daysSinceLastQuest: 1,
      nowIso: '2026-05-19T11:00:00Z',
    });
    expect(out.telemetry.totalSets).toBe(3);
    expect(out.telemetry.warmupSets).toBe(1);
    expect(out.telemetry.workingSets).toBe(2);
    expect(out.telemetry.recoverySets).toBe(0);
    expect(out.telemetry.prSets).toBe(1);
    expect(out.telemetry.enemyDefeated).toBe(false);
  });
});

describe('runQuest — no side effects (purity)', () => {
  test('input arrays are not mutated', () => {
    const input = baseInput();
    const setsRef = input.sets;
    const snapshot = JSON.stringify(input);
    runQuest(input);
    expect(input.sets).toBe(setsRef);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  test('output is JSON-serialisable (no functions, no symbols)', () => {
    const out = runQuest(baseInput());
    expect(() => JSON.stringify(out)).not.toThrow();
    expect(JSON.parse(JSON.stringify(out))).toEqual(JSON.parse(JSON.stringify(out)));
  });

  test('result is completely finite — no NaN / Infinity anywhere', () => {
    const out = runQuest(baseInput());
    const flat = JSON.stringify(out);
    expect(flat).not.toMatch(/NaN/);
    expect(flat).not.toMatch(/Infinity/);
  });
});

describe('runQuest — bench scenario (weighted)', () => {
  test('weighted heavy quest with PR top set runs cleanly', () => {
    const out = runQuest({
      quest: { id: 'q8', kind: 'strength', plannedSetCount: 3 },
      enemy: sluggard(400),
      sets: [
        {
          exerciseId: 'bench',
          exerciseName: 'Bench Press',
          modality: 'weighted',
          archetype: 'heavy',
          exercise: BENCH,
          reps: 5,
          weightKg: 80,
          bodyweightKg: 80,
          setIndex: 0,
        },
        {
          exerciseId: 'bench',
          exerciseName: 'Bench Press',
          modality: 'weighted',
          archetype: 'heavy',
          exercise: BENCH,
          reps: 5,
          weightKg: 80,
          bodyweightKg: 80,
          setIndex: 1,
        },
        {
          exerciseId: 'bench',
          exerciseName: 'Bench Press',
          modality: 'weighted',
          archetype: 'heavy',
          exercise: BENCH,
          reps: 5,
          weightKg: 85,
          bodyweightKg: 80,
          setIndex: 2,
          isPersonalRecord: true,
        },
      ],
      priorMomentum: 35,
      daysSinceLastQuest: 1,
      nowIso: '2026-05-19T07:00:00Z',
    });
    expect(out.setResults).toHaveLength(3);
    expect(out.totalDamage).toBeGreaterThan(0);
    expect(out.questXp.xp).toBeGreaterThan(0);
  });
});
