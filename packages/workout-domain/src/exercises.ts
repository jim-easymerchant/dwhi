/**
 * Exercise vocabulary — archetypes and modalities.
 *
 * Placeholder types only. Real exercise data (catalogue rows,
 * loadScale, bodyweightCoefficient, …) will arrive in a later
 * branch alongside `combatBalance.ts`.
 *
 * See:
 *   docs/workout-rpg/007-exercise-archetypes.md
 *   docs/workout-rpg/003-combat-mechanics.md §2 (modality math)
 */

/**
 * The six combat disciplines. An exercise is not a damage source —
 * it is a battle style.
 */
export const EXERCISE_ARCHETYPES = [
  'pressure',
  'heavy',
  'control',
  'foundation',
  'endurance',
  'recovery',
] as const;
export type ExerciseArchetype = (typeof EXERCISE_ARCHETYPES)[number];

/**
 * How an exercise is measured. Mixed-modality exercises are
 * represented as separate catalogue entries, not as a tuple of
 * modalities.
 */
export const EXERCISE_MODALITIES = [
  'weighted',
  'bodyweight',
  'timed',
  'cardio',
  'mobility',
] as const;
export type ExerciseModality = (typeof EXERCISE_MODALITIES)[number];
