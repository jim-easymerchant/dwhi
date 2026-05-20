/**
 * Tiny deterministic RNG + tier comparison helpers used by the
 * world-state generator.
 *
 * Kept out of `worldState.ts` so the generator's body stays
 * focused on flavour decisions. Pure — no I/O.
 */

import { MOMENTUM_TIERS, type MomentumTier } from '@dwhi/workout-domain';

/**
 * Linear-congruential RNG. Same numbers as Iron Quest's
 * `seededRNG` — kept locally so we don't import the reference
 * source at runtime.
 */
export function seededRng(seed: number): () => number {
  let s = (seed | 0) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return ((s >>> 0) / 0xffffffff);
  };
}

/** Pick one entry from a list using a single RNG draw. */
export function pickFrom<T>(items: readonly T[], rng: () => number): T {
  if (items.length === 0) {
    throw new Error('pickFrom called with an empty list');
  }
  const idx = Math.floor(rng() * items.length) % items.length;
  return items[idx];
}

/**
 * Tier comparison — returns true when `actual` is at or warmer
 * than `floor`. Used by `appearsWhen.minTier`.
 */
export function tierIsAtLeast(
  actual: MomentumTier,
  floor: MomentumTier,
): boolean {
  return MOMENTUM_TIERS.indexOf(actual) >= MOMENTUM_TIERS.indexOf(floor);
}
