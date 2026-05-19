/**
 * Mood-indexed pixel palettes for the Workout RPG monster renderer.
 *
 * Each palette is a 5-entry array: indices 1..5 in the sprite map
 * resolve to these colours (0 in the map = transparent).
 *
 * Mood mapping (see `docs/workout-rpg/010-enemy-design-bible.md` §5):
 *   drift  — dusty / faded greys with a faint warm undertone
 *   hush   — cool blue-grey, the colour of distance at dusk
 *   glare  — ember / orange / red; the only "warm" mood
 *   stone  — muted heavy slate; weight, not aggression
 *
 * The palettes are tuned against the Momentum core tokens in
 * `apps/workout/src/theme/workoutColors.ts`. Brighter inner pixels
 * (index 5) read as silhouette highlights; darker outer pixels
 * (index 1) read as edge fade against the dark background.
 *
 * NO Iron Quest rarity palettes are copied. Different intent
 * (mood-driven, not rarity-driven) and different palette content.
 */

import type { EnemyMood } from '@dwhi/workout-domain';

import { workoutColors } from '../theme/workoutColors';

/** Fixed-width palette: exactly five colours, ordered dim → bright. */
export type SpritePalette = readonly [string, string, string, string, string];

/** A frozen lookup keyed by every defined `EnemyMood`. */
export const MOOD_PALETTES: Readonly<Record<EnemyMood, SpritePalette>> = {
  // ── drift ─────────────────────────────────────────────────────────────
  // Settled. Dusty. The colour of a room left unswept.
  drift: ['#3a3540', '#52515c', '#6c6b75', '#88808a', '#a89a92'],

  // ── hush ──────────────────────────────────────────────────────────────
  // Distance at dusk. Cool blue-grey threaded with Tideline.
  hush: ['#1a2330', '#2c3a4a', '#445466', '#5e6473', '#7a8a95'],

  // ── glare ─────────────────────────────────────────────────────────────
  // The only warm mood. Ember → Hearth gradient.
  glare: ['#3a1810', '#7a3018', '#a04020', '#d55e3f', '#e9a14b'],

  // ── stone ─────────────────────────────────────────────────────────────
  // Weight, not aggression. Slate that does not move.
  stone: ['#1e1e26', '#34343e', '#4c4c5a', '#6a6a78', '#86869a'],
} as const;

/** Look up a palette by mood; falls back to `drift` for safety. */
export function paletteFor(mood: EnemyMood): SpritePalette {
  return MOOD_PALETTES[mood] ?? MOOD_PALETTES.drift;
}

// ---------------------------------------------------------------------------
// Tinting helpers
// ---------------------------------------------------------------------------

/** Parse a `#rrggbb` hex string into `[r, g, b]` integers. */
export function parseHex(hex: string): [number, number, number] {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return [0, 0, 0];
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

const clamp255 = (v: number): number => Math.max(0, Math.min(255, Math.round(v)));

function toRgbString(r: number, g: number, b: number): string {
  return `rgb(${clamp255(r)},${clamp255(g)},${clamp255(b)})`;
}

/**
 * Blend a colour toward the Hearth (crit / victory-available) tint.
 *
 *   amount = 0    → original colour unchanged
 *   amount = 1    → fully Hearth colour
 *   amount ~ 0.3  → "thinned" silhouette, the Battle screen's
 *                   victory-available default
 */
export function tintHearth(hex: string, amount = 0.3): string {
  const [r, g, b] = parseHex(hex);
  const [hr, hg, hb] = parseHex(workoutColors.hearth);
  const m = Math.max(0, Math.min(1, amount));
  return toRgbString(
    r + (hr - r) * m,
    g + (hg - g) * m,
    b + (hb - b) * m,
  );
}

/** Same shape as `tintHearth` but desaturates toward grey. */
export function desaturate(hex: string, amount = 0.3): string {
  const [r, g, b] = parseHex(hex);
  const avg = (r + g + b) / 3;
  const m = Math.max(0, Math.min(1, amount));
  return toRgbString(
    r + (avg - r) * m,
    g + (avg - g) * m,
    b + (avg - b) * m,
  );
}
