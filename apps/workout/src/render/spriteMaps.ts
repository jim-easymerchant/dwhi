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

// ===========================================================================
// IRON-QUEST-ADAPTED SPRITE MAPS
//
// Adapted from `reference/ironquest/renderer/MonsterSprite.js`;
// copied into Momentum render data intentionally as owned project
// reference. The runtime NEVER imports from `reference/ironquest`.
//
// All five Iron Quest archetypes (humanoid, beast, aberration,
// construct, swarm) are ported here so the render layer can offer
// the Iron Quest sprite shapes alongside Momentum's original ones.
// In Iron Quest these sprites map to rarity-keyed palettes; in
// Momentum we deliberately do NOT surface rarity to the player
// (see docs/workout-rpg/010-enemy-design-bible.md §6) — the same
// sprite renders against any of the four Momentum moods (drift /
// hush / glare / stone).
//
// Mapping into Momentum's category space:
//
//   common / basic monster      → fragment    (humanoid, aberration)
//   larger / brute monster      → hollow      (beast, swarm)
//   defensive / sentinel monster → ward       (construct)
//
// The bodies are unchanged from Iron Quest. Naming uses
// Momentum-neutral identifiers (`ironquestHumanoid`, etc.) for
// traceability — none of Iron Quest's DCC / RisingKB-flavoured
// monster names are surfaced; the player never sees the word
// "Iron Quest" or the original archetype labels.
// ===========================================================================

/** IQ archetype: humanoid. Momentum category role: fragment. */
export const ironquestHumanoid: SpriteMap = [
  [0, 0, 0, 1, 3, 3, 1, 0, 0, 0, 0, 0],
  [0, 0, 1, 3, 2, 2, 3, 1, 0, 0, 0, 0],
  [0, 0, 1, 2, 4, 4, 2, 1, 0, 0, 0, 0],
  [0, 0, 0, 1, 2, 2, 1, 0, 0, 0, 0, 0],
  [0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
  [0, 1, 2, 2, 2, 2, 2, 2, 1, 5, 5, 0],
  [1, 2, 1, 2, 2, 2, 2, 1, 2, 1, 5, 0],
  [0, 1, 2, 2, 2, 2, 2, 2, 1, 0, 0, 0],
  [0, 0, 1, 2, 2, 2, 2, 1, 0, 0, 0, 0],
  [0, 1, 2, 1, 0, 0, 1, 2, 1, 0, 0, 0],
  [0, 1, 2, 1, 0, 0, 1, 2, 1, 0, 0, 0],
  [0, 1, 2, 1, 0, 0, 1, 2, 1, 0, 0, 0],
  [0, 1, 1, 2, 0, 0, 2, 1, 1, 0, 0, 0],
  [0, 2, 1, 0, 0, 0, 0, 1, 2, 0, 0, 0],
] as const;

/** IQ archetype: beast. Momentum category role: hollow. */
export const ironquestBeast: SpriteMap = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0],
  [1, 2, 2, 1, 0, 0, 1, 2, 2, 1, 0, 0],
  [1, 2, 4, 2, 1, 1, 2, 4, 2, 1, 0, 0],
  [0, 1, 2, 2, 2, 2, 2, 2, 1, 0, 0, 0],
  [0, 0, 1, 2, 2, 2, 2, 1, 0, 0, 0, 0],
  [1, 1, 1, 2, 2, 2, 2, 1, 1, 1, 0, 0],
  [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 0],
  [1, 1, 2, 2, 2, 2, 2, 2, 1, 1, 0, 0],
  [1, 2, 1, 0, 0, 0, 0, 1, 2, 1, 0, 0],
  [1, 2, 1, 0, 0, 0, 0, 1, 2, 1, 0, 0],
  [2, 1, 0, 0, 0, 0, 0, 0, 1, 2, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
] as const;

/** IQ archetype: aberration. Momentum category role: fragment. */
export const ironquestAberration: SpriteMap = [
  [0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0],
  [0, 1, 2, 2, 1, 1, 2, 2, 1, 0, 0, 0],
  [1, 2, 3, 2, 2, 2, 2, 3, 2, 1, 0, 0],
  [1, 2, 2, 2, 2, 2, 2, 2, 2, 1, 0, 0],
  [0, 1, 2, 4, 2, 2, 4, 2, 1, 0, 1, 0],
  [0, 0, 1, 2, 2, 2, 2, 1, 0, 1, 2, 1],
  [0, 1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 1],
  [1, 2, 2, 3, 2, 2, 3, 2, 2, 2, 1, 0],
  [1, 2, 2, 2, 2, 2, 2, 2, 2, 1, 0, 0],
  [0, 1, 2, 2, 1, 1, 2, 2, 1, 0, 0, 0],
  [0, 0, 1, 1, 2, 2, 1, 1, 0, 0, 0, 0],
  [0, 1, 2, 0, 1, 1, 0, 2, 1, 0, 0, 0],
  [1, 2, 0, 0, 0, 0, 0, 0, 2, 1, 0, 0],
  [0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
] as const;

/** IQ archetype: construct. Momentum category role: ward. */
export const ironquestConstruct: SpriteMap = [
  [0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
  [0, 1, 5, 5, 5, 5, 5, 5, 1, 0, 0, 0],
  [0, 1, 5, 4, 0, 0, 4, 5, 1, 0, 0, 0],
  [0, 1, 5, 5, 5, 5, 5, 5, 1, 0, 0, 0],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
  [1, 2, 2, 2, 2, 2, 2, 2, 2, 1, 0, 0],
  [1, 2, 1, 2, 2, 2, 2, 1, 2, 1, 0, 0],
  [1, 2, 2, 2, 2, 2, 2, 2, 2, 1, 0, 0],
  [0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
  [0, 1, 2, 1, 0, 0, 1, 2, 1, 0, 0, 0],
  [0, 1, 2, 1, 0, 0, 1, 2, 1, 0, 0, 0],
  [0, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0, 0],
  [0, 2, 1, 0, 0, 0, 0, 1, 2, 0, 0, 0],
  [0, 1, 2, 0, 0, 0, 0, 2, 1, 0, 0, 0],
] as const;

/** IQ archetype: swarm. Momentum category role: hollow. */
export const ironquestSwarm: SpriteMap = [
  [0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0],
  [1, 2, 1, 0, 1, 2, 1, 1, 2, 1, 0, 0],
  [0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0],
  [0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0],
  [0, 0, 1, 2, 1, 0, 1, 0, 1, 2, 1, 0],
  [0, 0, 0, 1, 0, 1, 2, 1, 0, 1, 0, 0],
  [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0],
  [2, 1, 0, 1, 0, 0, 0, 0, 1, 0, 2, 1],
  [1, 0, 1, 2, 1, 0, 0, 1, 2, 1, 0, 0],
  [0, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 0],
  [0, 1, 0, 0, 0, 2, 1, 0, 0, 1, 0, 0],
  [1, 2, 1, 0, 1, 1, 2, 1, 1, 2, 1, 0],
  [0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
] as const;

// ---------------------------------------------------------------------------
// Sprite registry — string-keyed catalogue every renderer can pull
// from. Includes every public sprite map.
// ---------------------------------------------------------------------------

export type SpriteId =
  | 'fragment'
  | 'hollow'
  | 'ward'
  | 'veil'
  | 'ember'
  | 'ironquest-humanoid'
  | 'ironquest-beast'
  | 'ironquest-aberration'
  | 'ironquest-construct'
  | 'ironquest-swarm';

export const SPRITE_REGISTRY: Readonly<Record<SpriteId, SpriteMap>> = {
  fragment: fragmentMap,
  hollow: hollowMap,
  ward: wardMap,
  veil: veilMap,
  ember: emberMap,
  'ironquest-humanoid': ironquestHumanoid,
  'ironquest-beast': ironquestBeast,
  'ironquest-aberration': ironquestAberration,
  'ironquest-construct': ironquestConstruct,
  'ironquest-swarm': ironquestSwarm,
} as const;

export function spriteById(id: SpriteId): SpriteMap {
  return SPRITE_REGISTRY[id] ?? fragmentMap;
}

/**
 * Category → list of sprite ids that *can* represent this category.
 * The first entry is the default (Momentum's original silhouette);
 * additional entries are the Iron-Quest-derived alternates a future
 * fragment generator can rotate through for variety.
 */
export const CATEGORY_SPRITE_OPTIONS: Readonly<
  Record<EnemyCategory, readonly SpriteId[]>
> = {
  lesser_fragment: ['fragment', 'ironquest-humanoid', 'ironquest-aberration'],
  hollow: ['hollow', 'ironquest-beast', 'ironquest-swarm'],
  ward: ['ward', 'ironquest-construct'],
} as const;

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
