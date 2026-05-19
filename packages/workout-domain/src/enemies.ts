/**
 * Enemy vocabulary — moods, categories.
 *
 * Placeholder types only. Named enemies (Sluggard, The Pale Hours,
 * The Brittle Crown, …) and their archetype affinities will be
 * seeded in a later branch.
 *
 * See:
 *   docs/workout-rpg/010-enemy-design-bible.md §4 (categories)
 *   docs/workout-rpg/010-enemy-design-bible.md §5 (moods)
 */

/**
 * Aesthetic groupings used by the writer's room and the
 * illustrator. Not a combat tag — see archetype affinity for
 * mechanical resonance.
 */
export const ENEMY_MOODS = ['drift', 'hush', 'glare', 'stone'] as const;
export type EnemyMood = (typeof ENEMY_MOODS)[number];

/**
 * Structural combat category. Single-Battle, Quest-spanning, and
 * boss-tier respectively.
 */
export const ENEMY_CATEGORIES = [
  'lesser_fragment',
  'hollow',
  'ward',
] as const;
export type EnemyCategory = (typeof ENEMY_CATEGORIES)[number];
