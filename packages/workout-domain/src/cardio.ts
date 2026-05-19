/**
 * Cardio vocabulary — the traversal modalities.
 *
 * Placeholder types only. Trail Energy math, region restoration,
 * and Health-API ingestion will arrive in a later branch.
 *
 * See:
 *   docs/workout-rpg/009-cardio-world-systems.md §3 (Trail Energy)
 *   docs/workout-rpg/009-cardio-world-systems.md §8 (affinities)
 */

/**
 * The five cardio modalities the game recognises. Each carries a
 * regional affinity (settlements / mountains / wildlands / trade
 * roads / tidal ruins) — that mapping is documented but not yet
 * encoded.
 */
export const CARDIO_MODALITIES = [
  'walk',
  'hike',
  'run',
  'cycle',
  'swim',
] as const;
export type CardioModality = (typeof CARDIO_MODALITIES)[number];
