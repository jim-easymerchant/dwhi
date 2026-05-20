/**
 * apps/workout/src/render
 *
 * The View-based pixel renderer for Momentum's enemy silhouettes.
 *
 *   MonsterSprite       — the React component (uses react-native + Animated)
 *   spriteMaps.ts       — five hand-redrawn 14×12 grids
 *   spritePalettes.ts   — mood-indexed 5-colour palettes + tint helpers
 *
 * Pure View + built-in Animated. No Reanimated. No Skia. No SVG
 * library. No third-party deps beyond what's already in the
 * workspace.
 *
 * See:
 *   docs/workout-rpg/015-ironquest-port-plan.md (why we ported)
 *   docs/workout-rpg/016-monster-renderer-port.md (what we changed)
 *   docs/workout-rpg/010-enemy-design-bible.md (mood + category spec)
 */

export { MonsterSprite, type MonsterSpriteProps } from './MonsterSprite';
export { CampScene, type CampSceneProps } from './CampScene';
export {
  CATEGORY_SPRITE_OPTIONS,
  CATEGORY_TO_MAP,
  SPRITE_HEIGHT,
  SPRITE_REGISTRY,
  SPRITE_WIDTH,
  emberMap,
  fragmentMap,
  hollowMap,
  ironquestAberration,
  ironquestBeast,
  ironquestConstruct,
  ironquestHumanoid,
  ironquestSwarm,
  mapForCategory,
  spriteById,
  validateSpriteMap,
  veilMap,
  wardMap,
  type SpriteId,
  type SpriteMap,
  type SpriteRow,
} from './spriteMaps';
export {
  MOOD_PALETTES,
  desaturate,
  paletteFor,
  parseHex,
  tintHearth,
  type SpritePalette,
} from './spritePalettes';
export {
  CAMP_SURFACES,
  CAMP_TIER_TINTS,
  FLAME_FRAMES,
  tintFor,
  type CampTint,
  type FlamePalette,
} from './campPalettes';
export {
  BENCH_MAP,
  CAMP_LAYER_ORDER,
  FLAME_HEIGHT,
  FLAME_MAP,
  FLAME_WIDTH,
  HEARTH_FRAME_HEIGHT,
  HEARTH_FRAME_MAP,
  HEARTH_FRAME_WIDTH,
  LANTERN_HEIGHT,
  LANTERN_MAP,
  LANTERN_WIDTH,
  paletteForFlameFrame,
  type CampLayerName,
  type LayerMap,
  type LayerRow,
} from './campSceneLayers';
