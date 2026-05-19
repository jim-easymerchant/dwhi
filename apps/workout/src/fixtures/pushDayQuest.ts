/**
 * Push Day fixture — open-ended encounter model.
 *
 * One Encounter ("Push") with Sluggard as the primary enemy and
 * a Lingering Shadow as the optional follow-up fragment. Within
 * the Encounter, the player picks a Strategy (bodyweight) or
 * Equipment Variant (weighted) and adds sets at their own pace.
 *
 * See:
 *   docs/workout-rpg/014-open-ended-encounters-and-set-memory.md
 *   docs/workout-rpg/005-mvp-implementation-plan.md
 *   docs/workout-rpg/003-combat-mechanics.md §2.2 (profiles)
 */

import type {
  EnemyInput,
  ExerciseArchetype,
  ExerciseProfile,
  QuestDefinition,
} from '@dwhi/workout-domain';

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
  inclinePushup: { loadScale: 10, bodyweightCoefficient: 0.5 } satisfies ExerciseProfile,
  kneePushup: { loadScale: 10, bodyweightCoefficient: 0.5 } satisfies ExerciseProfile,
} as const;

// ---------------------------------------------------------------------------
// Quest definition.
//
// `plannedSetCount` here is the *suggested* set total for the entire
// Quest, used by the orchestrator's soft-cap taper and the
// disciplined-exit window. The player can stop earlier (Held the
// Line) or push past (with diminishing returns).
// ---------------------------------------------------------------------------

export const PUSH_DAY_QUEST: QuestDefinition = {
  id: 'push-day',
  kind: 'strength',
  templateId: 'push_day',
  plannedSetCount: 9,
};

// ---------------------------------------------------------------------------
// Enemies — Sluggard and the optional Lingering Shadow follow-up.
//
// Sluggard's HP is sized so that ~9 working sets at mid-effort
// thin it on schedule. Past that, the player can call victory or
// continue. The Shadow is intentionally smaller; further
// continuation phases halve the previous max, floored at a small
// constant so the math never crashes to zero.
// ---------------------------------------------------------------------------

export const SLUGGARD: EnemyInput = {
  id: 'sluggard',
  name: 'Sluggard, Lord of Couches',
  maxHp: 540,
  mood: 'drift',
  category: 'lesser_fragment',
};

export const LINGERING_SHADOW: EnemyInput = {
  id: 'sluggard-shadow',
  name: 'A Lingering Shadow',
  maxHp: 180,
  mood: 'hush',
  category: 'lesser_fragment',
};

/** Smallest HP a continuation phase will ever spawn with. */
export const MIN_CONTINUATION_HP = 40;

/**
 * Given the *previous* phase's enemy and its max HP, return the
 * next phase's enemy spec. Pure — same input, same output.
 *
 *   phase 0 (in store)       → Sluggard (max 540)
 *   first continuation       → Lingering Shadow (max 180)
 *   second continuation      → Lingering Shadow (max 90)
 *   third continuation       → Lingering Shadow (max 45)
 *   ...                      → floored at MIN_CONTINUATION_HP
 */
export function getNextEnemyPhase(prevMaxHp: number): EnemyInput {
  const nextMax = Math.max(
    MIN_CONTINUATION_HP,
    Math.floor(prevMaxHp / 2),
  );
  return { ...LINGERING_SHADOW, maxHp: nextMax };
}

// ---------------------------------------------------------------------------
// Variant catalogues for the Push encounter.
//
// A `Variant` is a single bodyweight strategy OR a single weighted
// equipment exercise. Each carries its archetype, exercise profile,
// and starting defaults; the store maps a variant → a SetInput when
// a set is logged.
// ---------------------------------------------------------------------------

export type Variant = 'bodyweight' | 'weighted';

export interface ExerciseVariant {
  id: string;
  name: string;
  archetype: ExerciseArchetype;
  profile: ExerciseProfile;
  defaultReps: number;
  defaultWeightKg: number; // 0 for bodyweight strategies
}

/** Bodyweight strategies the player can switch between mid-encounter. */
export const PUSH_BODYWEIGHT_STRATEGIES: readonly ExerciseVariant[] = [
  {
    id: 'pushup',
    name: 'Pushup',
    archetype: 'pressure',
    profile: EXERCISE_PROFILES.pushup,
    defaultReps: 10,
    defaultWeightKg: 0,
  },
  {
    id: 'pike-pushup',
    name: 'Pike Pushup',
    archetype: 'pressure',
    profile: EXERCISE_PROFILES.pikePushup,
    defaultReps: 8,
    defaultWeightKg: 0,
  },
  {
    id: 'diamond-pushup',
    name: 'Diamond Pushup',
    archetype: 'pressure',
    profile: EXERCISE_PROFILES.diamondPushup,
    defaultReps: 10,
    defaultWeightKg: 0,
  },
  {
    id: 'incline-pushup',
    name: 'Incline Pushup',
    archetype: 'pressure',
    profile: EXERCISE_PROFILES.inclinePushup,
    defaultReps: 12,
    defaultWeightKg: 0,
  },
  {
    id: 'knee-pushup',
    name: 'Knee Pushup',
    archetype: 'pressure',
    profile: EXERCISE_PROFILES.kneePushup,
    defaultReps: 12,
    defaultWeightKg: 0,
  },
] as const;

/** Weighted equipment variants for the same encounter. */
export const PUSH_WEIGHTED_VARIANTS: readonly ExerciseVariant[] = [
  {
    id: 'bench-press',
    name: 'Bench Press',
    archetype: 'heavy',
    profile: EXERCISE_PROFILES.bench,
    defaultReps: 8,
    defaultWeightKg: 40,
  },
  {
    id: 'shoulder-press',
    name: 'Shoulder Press',
    archetype: 'heavy',
    profile: EXERCISE_PROFILES.shoulderPress,
    defaultReps: 8,
    defaultWeightKg: 14,
  },
  {
    id: 'triceps-extension',
    name: 'Triceps Extension',
    archetype: 'pressure',
    profile: EXERCISE_PROFILES.tricepsExtension,
    defaultReps: 10,
    defaultWeightKg: 7.5,
  },
] as const;

export interface Encounter {
  id: string;
  name: string;
  primaryEnemy: EnemyInput;
  bodyweightStrategies: readonly ExerciseVariant[];
  weightedVariants: readonly ExerciseVariant[];
}

export const PUSH_ENCOUNTER: Encounter = {
  id: 'push',
  name: 'Push',
  primaryEnemy: SLUGGARD,
  bodyweightStrategies: PUSH_BODYWEIGHT_STRATEGIES,
  weightedVariants: PUSH_WEIGHTED_VARIANTS,
};

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

/** Default mock prior momentum for a fresh player (Steady tier). */
export const DEFAULT_PRIOR_MOMENTUM = 25;

/** Default player bodyweight when none is entered. */
export const DEFAULT_BODYWEIGHT_KG = 70;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Pick the variants array for a given modality. */
export function variantsFor(
  encounter: Encounter,
  modality: Variant,
): readonly ExerciseVariant[] {
  return modality === 'weighted'
    ? encounter.weightedVariants
    : encounter.bodyweightStrategies;
}

/** Find a variant by id, falling back to the first if missing. */
export function findVariant(
  encounter: Encounter,
  modality: Variant,
  variantId: string,
): ExerciseVariant {
  const list = variantsFor(encounter, modality);
  return list.find((v) => v.id === variantId) ?? list[0];
}
