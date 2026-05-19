/**
 * MVP Push Day fixture.
 *
 * One Quest definition, one Enemy (Sluggard, Lord of Couches), and
 * the bodyweight + weighted variants for the three Push-Day
 * exercises. Used by the in-memory game store to drive the first
 * playable flow.
 *
 * Source of truth for shape: docs/workout-rpg/005-mvp-implementation-plan.md.
 */

import type { EnemyInput, ExerciseProfile, QuestDefinition, SetInput } from '@dwhi/workout-domain';

// ---------------------------------------------------------------------------
// Exercise profiles (from 003-combat-mechanics.md §2.2).
// ---------------------------------------------------------------------------

export const EXERCISE_PROFILES = {
  bench: { loadScale: 8, bodyweightCoefficient: 0 } satisfies ExerciseProfile,
  pushup: { loadScale: 8, bodyweightCoefficient: 0.65 } satisfies ExerciseProfile,
  shoulderPress: { loadScale: 6, bodyweightCoefficient: 0 } satisfies ExerciseProfile,
  pikePushup: { loadScale: 6, bodyweightCoefficient: 0.6 } satisfies ExerciseProfile,
  tricepsExtension: { loadScale: 4, bodyweightCoefficient: 0 } satisfies ExerciseProfile,
  diamondPushup: { loadScale: 4, bodyweightCoefficient: 0.65 } satisfies ExerciseProfile,
} as const;

// ---------------------------------------------------------------------------
// Quest definition.
// ---------------------------------------------------------------------------

export const PUSH_DAY_QUEST: QuestDefinition = {
  id: 'push-day',
  kind: 'strength',
  templateId: 'push_day',
  plannedSetCount: 9, // 3 exercises × 3 working sets
};

// ---------------------------------------------------------------------------
// Sluggard, Lord of Couches.
//
// HP is set to roughly match 9 working sets of mid-effort push work
// (≈ 60 dmg per set at Steady momentum). Tuned by the worked
// example: ~540 lets the third exercise's final set be the kill.
// ---------------------------------------------------------------------------

export const SLUGGARD: EnemyInput = {
  id: 'sluggard',
  name: 'Sluggard, Lord of Couches',
  maxHp: 540,
  mood: 'drift',
  category: 'lesser_fragment',
};

// ---------------------------------------------------------------------------
// The three Battles, each with its bodyweight and weighted variants.
//
// A `BattlePlan` describes what the player is about to do; the
// store turns it into `SetInput[]` once reps / weight are chosen.
// ---------------------------------------------------------------------------

export type Variant = 'bodyweight' | 'weighted';

export interface BattlePlan {
  battleIndex: number;
  weightedExerciseId: string;
  weightedExerciseName: string;
  weightedProfile: ExerciseProfile;
  bodyweightExerciseId: string;
  bodyweightExerciseName: string;
  bodyweightProfile: ExerciseProfile;
  archetype: SetInput['archetype'];
  defaultReps: number;
  defaultWeightKg: number;
  setsPerBattle: number;
}

export const PUSH_DAY_BATTLES: readonly BattlePlan[] = [
  {
    battleIndex: 0,
    weightedExerciseId: 'bench',
    weightedExerciseName: 'Bench Press',
    weightedProfile: EXERCISE_PROFILES.bench,
    bodyweightExerciseId: 'pushup',
    bodyweightExerciseName: 'Pushup',
    bodyweightProfile: EXERCISE_PROFILES.pushup,
    archetype: 'heavy',
    defaultReps: 8,
    defaultWeightKg: 40,
    setsPerBattle: 3,
  },
  {
    battleIndex: 1,
    weightedExerciseId: 'shoulder-press',
    weightedExerciseName: 'Shoulder Press',
    weightedProfile: EXERCISE_PROFILES.shoulderPress,
    bodyweightExerciseId: 'pike-pushup',
    bodyweightExerciseName: 'Pike Pushup',
    bodyweightProfile: EXERCISE_PROFILES.pikePushup,
    archetype: 'heavy',
    defaultReps: 8,
    defaultWeightKg: 14,
    setsPerBattle: 3,
  },
  {
    battleIndex: 2,
    weightedExerciseId: 'triceps-extension',
    weightedExerciseName: 'Triceps Extension',
    weightedProfile: EXERCISE_PROFILES.tricepsExtension,
    bodyweightExerciseId: 'diamond-pushup',
    bodyweightExerciseName: 'Diamond Pushup',
    bodyweightProfile: EXERCISE_PROFILES.diamondPushup,
    archetype: 'pressure',
    defaultReps: 10,
    defaultWeightKg: 7.5,
    setsPerBattle: 3,
  },
] as const;

/**
 * Default mock prior momentum for a fresh player. Sits comfortably
 * inside the Steady tier so the worked-example numbers reproduce.
 */
export const DEFAULT_PRIOR_MOMENTUM = 25;

/**
 * Default player bodyweight when the player hasn't entered theirs.
 * Mirrors `combatBalance.defaultBodyweightKg`.
 */
export const DEFAULT_BODYWEIGHT_KG = 70;
