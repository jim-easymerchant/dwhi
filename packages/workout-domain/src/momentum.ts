/**
 * Momentum vocabulary — the five tiers.
 *
 * Placeholder types only. Decay math, return-bonus math, tier
 * thresholds, and the `recomputeMomentum()` function will arrive
 * in a later branch.
 *
 * See:
 *   docs/workout-rpg/004-momentum-consistency.md §4 (tiers)
 *   docs/workout-rpg/004-momentum-consistency.md §10 (impl hooks)
 */

/**
 * The five tiers, ordered from coldest to warmest. The order is
 * meaningful: future code can rely on index for comparisons.
 */
export const MOMENTUM_TIERS = [
  'rusted',
  'steady',
  'driven',
  'relentless',
  'ascendant',
] as const;
export type MomentumTier = (typeof MOMENTUM_TIERS)[number];
