/**
 * Hand-redrawn sprite maps for the Workout RPG monster renderer.
 *
 * Each map is a 14-row × 12-column 2D grid. Cell values index the
 * five-entry palette returned by `paletteFor(mood)`:
 *
 *   0   transparent (no View rendered for that cell)
 *   1-5 palette colour (dim → bright)
 *
 * **Design constraints:**
 *
 *   - All silhouettes were drawn from scratch for Momentum. NONE of
 *     the Iron Quest sprite arrays were copied. See
 *     `docs/workout-rpg/015-ironquest-port-plan.md` §3 and §7.
 *   - No "cute" pixel monsters. No goblin / slime / orc / dragon
 *     tropes. The Hollow's enemies are abstract symbolic forms
 *     (`docs/workout-rpg/010-enemy-design-bible.md` §11).
 *   - Each map's silhouette is *narratively legible* under any
 *     palette — a fragment reads as a settled form whether it is
 *     tinted drift-grey or glare-amber.
 *
 * Category → primary map:
 *   lesser_fragment → fragmentMap     (the room-resident slump)
 *   hollow          → hollowMap       (a scattered mass)
 *   ward            → wardMap         (a tall sentinel)
 *
 * Reserved (no `EnemyCategory` mapping yet; available for future
 * variants without a schema change):
 *   veilMap   — a hanging drape; potential for tidal-ruin Wards
 *   emberMap  — a radiant orb; potential for Ascendant-tier moments
 */

/** A row in a sprite grid. Cell value 0..5. */
export type SpriteRow = readonly number[];

/** A 14×12 sprite map. Fixed dimensions; the renderer assumes them. */
export type SpriteMap = readonly SpriteRow[];

export const SPRITE_HEIGHT = 14;
export const SPRITE_WIDTH = 12;

// ---------------------------------------------------------------------------
// fragmentMap — Lesser Fragment.
// A settled, slumped silhouette. Reads as "the thing that gathered in
// the room while you were away." No face; no posture; just weight.
// ---------------------------------------------------------------------------

export const fragmentMap: SpriteMap = [
  [0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0],
  [0, 0, 0, 1, 2, 3, 3, 2, 1, 0, 0, 0],
  [0, 0, 0, 1, 2, 3, 3, 2, 1, 0, 0, 0],
  [0, 0, 1, 2, 3, 4, 4, 3, 2, 1, 0, 0],
  [0, 1, 2, 3, 4, 4, 4, 4, 3, 2, 1, 0],
  [0, 1, 2, 3, 4, 4, 4, 4, 3, 2, 1, 0],
  [1, 2, 3, 4, 4, 4, 4, 4, 4, 3, 2, 1],
  [1, 2, 3, 4, 4, 4, 4, 4, 4, 3, 2, 1],
  [1, 2, 3, 4, 4, 4, 4, 4, 4, 3, 2, 1],
  [1, 2, 3, 3, 3, 3, 3, 3, 3, 3, 2, 1],
  [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1],
  [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
] as const;

// ---------------------------------------------------------------------------
// hollowMap — a Quest-spanning mood made visible.
// A scattered, cloud-like mass with small floaters above + below.
// Reads as "many things at once," not a single creature.
// ---------------------------------------------------------------------------

export const hollowMap: SpriteMap = [
  [0, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0],
  [1, 2, 1, 1, 2, 2, 1, 1, 2, 2, 1, 0],
  [1, 2, 2, 1, 2, 3, 2, 1, 2, 3, 2, 1],
  [0, 1, 2, 2, 1, 2, 2, 2, 1, 2, 3, 1],
  [0, 0, 1, 2, 2, 2, 3, 2, 2, 1, 2, 1],
  [0, 0, 0, 1, 2, 3, 4, 3, 2, 2, 1, 0],
  [0, 0, 1, 2, 3, 4, 4, 4, 3, 2, 2, 1],
  [0, 1, 2, 3, 4, 4, 4, 4, 4, 3, 2, 1],
  [0, 1, 2, 3, 4, 4, 4, 4, 4, 3, 2, 1],
  [0, 0, 1, 2, 3, 3, 3, 3, 3, 2, 1, 0],
  [0, 0, 0, 1, 2, 2, 2, 2, 2, 1, 0, 0],
  [0, 1, 1, 0, 1, 1, 0, 0, 1, 1, 1, 0],
  [0, 1, 2, 1, 0, 0, 1, 2, 2, 1, 2, 1],
  [0, 0, 1, 0, 0, 0, 0, 1, 1, 0, 1, 0],
] as const;

// ---------------------------------------------------------------------------
// wardMap — boss-tier sentinel.
// Tall, monolithic, narrow shoulders. A single point of intent
// (index 5) at the head — the only sprite that surfaces palette
// index 5 in its idle state.
// ---------------------------------------------------------------------------

export const wardMap: SpriteMap = [
  [0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0],
  [0, 0, 1, 2, 3, 3, 3, 3, 1, 0, 0, 0],
  [0, 0, 1, 2, 3, 5, 5, 3, 1, 0, 0, 0],
  [0, 0, 1, 2, 3, 3, 3, 3, 1, 0, 0, 0],
  [0, 1, 1, 2, 3, 3, 3, 3, 1, 1, 0, 0],
  [1, 2, 2, 2, 3, 4, 4, 3, 2, 2, 1, 0],
  [1, 2, 3, 3, 4, 4, 4, 4, 3, 2, 1, 0],
  [1, 2, 3, 4, 4, 4, 4, 4, 4, 3, 1, 0],
  [1, 2, 3, 4, 4, 4, 4, 4, 4, 3, 1, 0],
  [1, 2, 3, 4, 4, 4, 4, 4, 4, 3, 1, 0],
  [1, 2, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0],
  [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 0],
  [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
  [0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0],
] as const;

// ---------------------------------------------------------------------------
// veilMap — RESERVED (no current EnemyCategory binding).
// A hanging drape with two faint eyes near the top. Designed for
// tidal-ruin / aberration-aligned future enemies — "watchers behind
// a curtain."
// ---------------------------------------------------------------------------

export const veilMap: SpriteMap = [
  [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
  [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1],
  [1, 2, 3, 3, 2, 2, 2, 2, 3, 3, 2, 1],
  [1, 2, 3, 4, 3, 2, 2, 3, 4, 3, 2, 1],
  [1, 2, 2, 3, 3, 2, 2, 3, 3, 2, 2, 1],
  [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1],
  [1, 2, 3, 2, 2, 2, 2, 2, 2, 3, 2, 1],
  [1, 2, 2, 3, 2, 2, 2, 2, 3, 2, 2, 1],
  [1, 2, 2, 2, 3, 2, 2, 3, 2, 2, 2, 1],
  [1, 2, 2, 2, 2, 3, 3, 2, 2, 2, 2, 1],
  [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1],
  [0, 1, 2, 2, 2, 2, 2, 2, 2, 2, 1, 0],
  [0, 0, 1, 2, 2, 2, 2, 2, 2, 1, 0, 0],
  [0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0],
] as const;

// ---------------------------------------------------------------------------
// emberMap — RESERVED (no current EnemyCategory binding).
// A radiant centre-bright form. Designed for Ascendant-tier moments
// (a tier-up beat where the Hollow itself flickers warm) and for
// future symbolic boss encounters.
// ---------------------------------------------------------------------------

export const emberMap: SpriteMap = [
  [0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 1, 2, 2, 1, 0, 0, 0, 0],
  [0, 0, 0, 1, 2, 3, 3, 2, 1, 0, 0, 0],
  [0, 0, 1, 2, 3, 4, 4, 3, 2, 1, 0, 0],
  [0, 1, 2, 3, 4, 5, 5, 4, 3, 2, 1, 0],
  [1, 2, 3, 4, 5, 5, 5, 5, 4, 3, 2, 1],
  [1, 2, 3, 4, 5, 5, 5, 5, 4, 3, 2, 1],
  [1, 2, 3, 4, 5, 5, 5, 5, 4, 3, 2, 1],
  [0, 1, 2, 3, 4, 5, 5, 4, 3, 2, 1, 0],
  [0, 1, 2, 3, 4, 4, 4, 4, 3, 2, 1, 0],
  [0, 0, 1, 2, 3, 3, 3, 3, 2, 1, 0, 0],
  [0, 0, 0, 1, 2, 2, 2, 2, 1, 0, 0, 0],
  [0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0],
] as const;

// ---------------------------------------------------------------------------
// Category → primary map lookup.
//
// Only the three live EnemyCategory values are wired. The two
// reserved maps are exported above so they're available the moment
// a future schema change widens the union.
// ---------------------------------------------------------------------------

import type { EnemyCategory } from '@dwhi/workout-domain';

export const CATEGORY_TO_MAP: Readonly<Record<EnemyCategory, SpriteMap>> = {
  lesser_fragment: fragmentMap,
  hollow: hollowMap,
  ward: wardMap,
} as const;

/** Look up the primary silhouette for a category. Safe fallback. */
export function mapForCategory(category: EnemyCategory): SpriteMap {
  return CATEGORY_TO_MAP[category] ?? fragmentMap;
}

/**
 * Validates a sprite map's shape. Pure; returns a list of issues —
 * empty array means clean.
 */
export function validateSpriteMap(map: SpriteMap): string[] {
  const issues: string[] = [];
  if (map.length !== SPRITE_HEIGHT) {
    issues.push(`expected ${SPRITE_HEIGHT} rows, got ${map.length}`);
  }
  map.forEach((row, y) => {
    if (row.length !== SPRITE_WIDTH) {
      issues.push(`row ${y}: expected ${SPRITE_WIDTH} cols, got ${row.length}`);
    }
    row.forEach((cell, x) => {
      if (!Number.isInteger(cell) || cell < 0 || cell > 5) {
        issues.push(`cell (${x}, ${y}): expected 0..5 integer, got ${cell}`);
      }
    });
  });
  return issues;
}
