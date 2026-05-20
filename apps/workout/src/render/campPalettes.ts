/**
 * Mood-lighting palettes for the Camp scene, keyed to Momentum
 * tier (see `docs/workout-rpg/004-momentum-consistency.md`).
 *
 * Each entry describes the *overlay tint* drawn over the layered
 * pixel scene to convey the current Ember state. Tints are a
 * single `View` with a coloured background at sub-1.0 opacity —
 * no Skia, no Reanimated.
 *
 * The colour direction (dim → bright, cold → warm) follows the
 * tier ramp:
 *   - Rusted     dim, cool, muted          (the room is quiet)
 *   - Steady     quiet ember warmth        (the kettle's on)
 *   - Driven     visible ember glow        (the fire is up)
 *   - Relentless stronger fire             (the fire is roaring)
 *   - Ascendant  bright hearth             (the room is full of light)
 *
 * Adapted from `reference/ironquest/renderer/TavernScene.js`'s
 * MOOD_TINT — same overlay-View technique, different palette
 * intent: Momentum's tone is warm and quiet, never tense or
 * abandoned.
 */

import type { MomentumTier } from '@dwhi/workout-domain';

export interface CampTint {
  /** Overlay colour drawn full-bleed across the scene. */
  color: string;
  /** Overlay opacity in [0, 1]. */
  opacity: number;
  /** Flame brightness multiplier in [0, 1.5]. */
  flameIntensity: number;
}

export const CAMP_TIER_TINTS: Readonly<Record<MomentumTier, CampTint>> = {
  // Rusted — the room is quiet. The Ember is faint.
  rusted: { color: '#08101a', opacity: 0.45, flameIntensity: 0.4 },

  // Steady — quiet warm. Default tone.
  steady: { color: '#1a1208', opacity: 0.22, flameIntensity: 0.75 },

  // Driven — visible ember glow.
  driven: { color: '#3a1d08', opacity: 0.18, flameIntensity: 1.0 },

  // Relentless — stronger fire; the walls warm up.
  relentless: { color: '#5a2810', opacity: 0.14, flameIntensity: 1.2 },

  // Ascendant — bright hearth.
  ascendant: { color: '#a05818', opacity: 0.10, flameIntensity: 1.35 },
} as const;

export function tintFor(tier: MomentumTier): CampTint {
  return CAMP_TIER_TINTS[tier] ?? CAMP_TIER_TINTS.steady;
}

// ---------------------------------------------------------------------------
// Surface palettes — the colours of the camp's *unlit* materials.
// The tint overlay rides on top of these.
// ---------------------------------------------------------------------------

export const CAMP_SURFACES = {
  wallDark: '#15131a',
  wallLight: '#23202a',
  wallBrick: '#1c1820',
  floorDark: '#2a1f16',
  floorMid: '#3a2c20',
  floorLight: '#4a3a2a',
  floorPlankSeam: '#0e0a06',
  hearthFrameDark: '#16110b',
  hearthFrameMid: '#2a1f14',
  hearthInner: '#0a0604',
  benchDark: '#2c1d12',
  benchMid: '#4a3220',
  chainLink: '#2a2532',
  lanternFrame: '#3a2808',
  lanternGlassDim: '#a0641c',
  lanternGlassBright: '#ffcc40',
} as const;

// ---------------------------------------------------------------------------
// Flame palette frames — cycled by AnimatedFlame in CampScene.
// Three frames; cycle every ~220 ms.
// ---------------------------------------------------------------------------

export type FlamePalette = readonly [string, string, string];

export const FLAME_FRAMES: readonly FlamePalette[] = [
  ['#aa3010', '#e06820', '#ffb840'], // ember
  ['#bb4018', '#f08828', '#ffd060'], // brighten
  ['#883008', '#cc5818', '#ff9c30'], // settle
] as const;
