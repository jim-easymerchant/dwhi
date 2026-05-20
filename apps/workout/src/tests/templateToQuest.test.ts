/**
 * Adapter unit tests — `templateToRuntimeEncounter`.
 *
 * Pure data, no React. Verifies:
 *   - Determinism: same template → same RuntimeEncounter.
 *   - Variants split correctly by modality.
 *   - Empty-bucket fallback: an all-bodyweight workout still has
 *     a non-empty `weightedVariants` (mirrors bodyweight) so the
 *     BattleScreen's variant chooser is never empty.
 *   - `quest.plannedSetCount` is the sum of defaultSets, capped.
 *   - `primaryEnemy.maxHp` is proportional to plannedSetCount.
 *   - Enemy name + category come from the dominant archetype.
 *   - `enemyOverride` and `nextPhaseEnemyOverride` are honoured.
 *   - `nextPhaseEnemy` halves HP and floors at MIN_CONTINUATION_HP.
 *   - Set-memory keys stay compatible (variant.id == exercise.id).
 *   - Imported (parsed) templates also round-trip through the
 *     adapter cleanly.
 */

import {
  BUILTIN_FULL_BODY,
  BUILTIN_LEGS_DAY,
  BUILTIN_PULL_DAY,
  BUILTIN_PUSH_DAY,
  BUILTIN_RECOVERY,
  __templateToQuestTestExports,
  parseWorkoutText,
  templateToRuntimeEncounter,
  type WorkoutTemplate,
} from '../workouts';
import { SLUGGARD } from '../fixtures/pushDayQuest';

const T = __templateToQuestTestExports;

describe('templateToRuntimeEncounter — determinism', () => {
  test('same template produces identical RuntimeEncounter', () => {
    const a = templateToRuntimeEncounter(BUILTIN_PULL_DAY);
    const b = templateToRuntimeEncounter(BUILTIN_PULL_DAY);
    expect(a.workoutName).toBe(b.workoutName);
    expect(a.templateId).toBe(b.templateId);
    expect(a.primaryEnemy.id).toBe(b.primaryEnemy.id);
    expect(a.primaryEnemy.maxHp).toBe(b.primaryEnemy.maxHp);
    expect(a.quest.plannedSetCount).toBe(b.quest.plannedSetCount);
    expect(a.encounter.bodyweightStrategies.map((v) => v.id)).toEqual(
      b.encounter.bodyweightStrategies.map((v) => v.id),
    );
  });
});

describe('templateToRuntimeEncounter — variant splitting', () => {
  test('Pull Day splits into bodyweight + weighted buckets', () => {
    const r = templateToRuntimeEncounter(BUILTIN_PULL_DAY);
    const bwIds = r.encounter.bodyweightStrategies.map((v) => v.id);
    const wIds = r.encounter.weightedVariants.map((v) => v.id);
    expect(bwIds).toContain('inverted-row');
    expect(wIds).toContain('barbell-row');
    expect(wIds).toContain('biceps-curl');
  });

  test('all-bodyweight template mirrors variants into the weighted bucket', () => {
    // Full Body has a single weighted-free design — but its
    // `defaultModality` is bodyweight and 4/4 exercises are
    // bodyweight. Adapter must still populate `weightedVariants`
    // with the bodyweight list so the chooser is never empty.
    const r = templateToRuntimeEncounter(BUILTIN_FULL_BODY);
    expect(r.encounter.bodyweightStrategies.length).toBeGreaterThan(0);
    expect(r.encounter.weightedVariants.length).toBeGreaterThan(0);
  });
});

describe('templateToRuntimeEncounter — quest sizing', () => {
  test('plannedSetCount = sum of defaultSets', () => {
    const r = templateToRuntimeEncounter(BUILTIN_PULL_DAY);
    const expected = BUILTIN_PULL_DAY.exercises.reduce(
      (acc, ex) => acc + (ex.defaultSets ?? 3),
      0,
    );
    expect(r.quest.plannedSetCount).toBe(Math.min(40, expected));
  });

  test('plannedSetCount is capped at 40', () => {
    const huge = {
      ...BUILTIN_FULL_BODY,
      exercises: Array.from({ length: 30 }, (_, i) => ({
        ...BUILTIN_FULL_BODY.exercises[i % BUILTIN_FULL_BODY.exercises.length],
        id: `ex-${i}`,
        defaultSets: 5,
      })),
    } as WorkoutTemplate;
    expect(T.computePlannedSetCount(huge.exercises)).toBe(40);
  });

  test('empty template defaults to a sane plannedSetCount', () => {
    expect(T.computePlannedSetCount([])).toBeGreaterThan(0);
  });

  test('primary enemy HP scales with plannedSetCount', () => {
    const r = templateToRuntimeEncounter(BUILTIN_LEGS_DAY);
    const setCount = r.quest.plannedSetCount;
    expect(r.primaryEnemy.maxHp).toBeGreaterThanOrEqual(
      Math.min(setCount * T.HP_PER_PLANNED_SET, T.MIN_PRIMARY_HP),
    );
  });
});

describe('templateToRuntimeEncounter — enemy generation', () => {
  test('heavy workouts get the ward / stone vibe', () => {
    const r = templateToRuntimeEncounter(BUILTIN_LEGS_DAY);
    expect(r.primaryEnemy.category).toBe('ward');
    expect(r.primaryEnemy.mood).toBe('stone');
  });

  test('recovery workouts get the hollow / hush vibe', () => {
    const r = templateToRuntimeEncounter(BUILTIN_RECOVERY);
    expect(r.primaryEnemy.category).toBe('hollow');
    expect(r.primaryEnemy.mood).toBe('hush');
  });

  test('Push Day honours the SLUGGARD enemyOverride (back-compat)', () => {
    const r = templateToRuntimeEncounter(BUILTIN_PUSH_DAY);
    expect(r.primaryEnemy.id).toBe(SLUGGARD.id);
    expect(r.primaryEnemy.name).toBe(SLUGGARD.name);
    expect(r.primaryEnemy.maxHp).toBe(SLUGGARD.maxHp);
  });

  test('Push Day honours the nextPhaseEnemyOverride → Lingering Shadow', () => {
    const r = templateToRuntimeEncounter(BUILTIN_PUSH_DAY);
    const next = r.nextPhaseEnemy(540);
    // Per pushDayQuest.getNextEnemyPhase: id 'sluggard-shadow',
    // name 'A Lingering Shadow', halved HP.
    expect(next.id).toBe('sluggard-shadow');
    expect(next.name).toBe('A Lingering Shadow');
    expect(next.maxHp).toBe(270);
  });

  test('non-Push templates derive a continuation enemy from the primary', () => {
    const r = templateToRuntimeEncounter(BUILTIN_LEGS_DAY);
    const next = r.nextPhaseEnemy(r.primaryEnemy.maxHp);
    expect(next.id).toBe(`${r.primaryEnemy.id}-shadow`);
    expect(next.maxHp).toBe(Math.floor(r.primaryEnemy.maxHp / 2));
  });

  test('nextPhaseEnemy floors at MIN_CONTINUATION_HP', () => {
    const r = templateToRuntimeEncounter(BUILTIN_LEGS_DAY);
    expect(r.nextPhaseEnemy(2).maxHp).toBe(T.MIN_CONTINUATION_HP);
  });

  test('dominant archetype is the most frequent across exercises', () => {
    expect(T.pickDominantArchetype(BUILTIN_PUSH_DAY.exercises)).toBe(
      // 5x pressure (pushups) vs 2x heavy (bench/OHP) vs 1x pressure (triceps).
      'pressure',
    );
    expect(T.pickDominantArchetype(BUILTIN_LEGS_DAY.exercises)).toBe('heavy');
  });
});

describe('set memory key compatibility', () => {
  test('runtime variant ids match the original exercise ids — set memory survives', () => {
    const r = templateToRuntimeEncounter(BUILTIN_PUSH_DAY);
    const allVariantIds = r.encounter.bodyweightStrategies
      .map((v) => v.id)
      .concat(r.encounter.weightedVariants.map((v) => v.id));
    // The legacy fixture used these exact variant ids; they
    // form the prefix of every memory key on existing installs.
    expect(allVariantIds).toEqual(
      expect.arrayContaining([
        'pushup',
        'pike-pushup',
        'diamond-pushup',
        'incline-pushup',
        'knee-pushup',
        'bench-press',
        'shoulder-press',
        'triceps-extension',
      ]),
    );
  });
});

describe('imported templates also round-trip through the adapter', () => {
  test('parsed text → template → runtime encounter is fully formed', () => {
    const parsed = parseWorkoutText(`
Workout: Garage Pull
Barbell Row 3x8 @ 60 kg, rest 90s
Lat Pulldown 3x10 @ 30 kg
Biceps Curl 3x10 @ 12 kg
Inverted Row 3x8
`);
    expect(parsed.errors).toEqual([]);
    const r = templateToRuntimeEncounter(parsed.template);
    expect(r.workoutName).toBe('Garage Pull');
    expect(r.encounter.bodyweightStrategies.length).toBeGreaterThan(0);
    expect(r.encounter.weightedVariants.length).toBeGreaterThan(0);
    expect(r.primaryEnemy.maxHp).toBeGreaterThan(0);
  });

  test('imports never accidentally inherit the SLUGGARD override', () => {
    const parsed = parseWorkoutText(`
Workout: Garage Push
Bench Press 3x8 @ 60 kg
`);
    const r = templateToRuntimeEncounter(parsed.template);
    expect(r.primaryEnemy.id).not.toBe(SLUGGARD.id);
  });
});

describe('stableHash', () => {
  test('is deterministic + non-negative', () => {
    const a = T.stableHash('push-day');
    const b = T.stableHash('push-day');
    const c = T.stableHash('pull-day');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toBeGreaterThanOrEqual(0);
  });
});
