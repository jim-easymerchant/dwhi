/**
 * Sprite maps for the individual pixel layers that compose the
 * Camp scene.
 *
 * Each map is a 2D grid; cell 0 is transparent, 1..N indexes the
 * accompanying palette. The same technique used by MonsterSprite —
 * nested Views, one per pixel, no Skia, no Reanimated.
 *
 * Adapted from `reference/ironquest/renderer/TavernScene.js`'s
 * LANTERN_MAP / FLAME_MAP / SHELF_MAP / NPC_MAP — same encoding,
 * fresh shapes for Momentum's quieter / mythic tone. Copied into
 * Momentum render data intentionally as owned project reference;
 * the runtime never imports from `reference/ironquest`.
 */

import { FLAME_FRAMES, type FlamePalette } from './campPalettes';

export type LayerRow = readonly number[];
export type LayerMap = readonly LayerRow[];

// ---------------------------------------------------------------------------
// Flame — 10×7 grid. Frame palette cycles for the animated flicker.
// ---------------------------------------------------------------------------

export const FLAME_MAP: LayerMap = [
  [0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
  [0, 1, 2, 1, 0, 1, 2, 1, 0, 0],
  [1, 2, 2, 2, 1, 2, 2, 2, 1, 0],
  [1, 2, 3, 2, 2, 2, 3, 2, 1, 0],
  [1, 2, 2, 3, 2, 3, 2, 2, 1, 0],
  [0, 1, 2, 2, 2, 2, 2, 1, 0, 0],
  [0, 0, 1, 1, 1, 1, 1, 0, 0, 0],
] as const;

export const FLAME_HEIGHT = FLAME_MAP.length;
export const FLAME_WIDTH = FLAME_MAP[0].length;

export function paletteForFlameFrame(frame: number): FlamePalette {
  return FLAME_FRAMES[Math.abs(frame) % FLAME_FRAMES.length];
}

// ---------------------------------------------------------------------------
// Hearth frame — 14×11 stone arch surrounding the flame.
// ---------------------------------------------------------------------------

export const HEARTH_FRAME_MAP: LayerMap = [
  [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
  [0, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 0],
  [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1],
  [1, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 1],
  [1, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 1],
  [1, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 1],
  [1, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 1],
  [1, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 1],
  [1, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 1],
  [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
] as const;

export const HEARTH_FRAME_HEIGHT = HEARTH_FRAME_MAP.length;
export const HEARTH_FRAME_WIDTH = HEARTH_FRAME_MAP[0].length;

// ---------------------------------------------------------------------------
// Hanging lantern — 5×7. Lit when the camp tier is Driven+.
// ---------------------------------------------------------------------------

export const LANTERN_MAP: LayerMap = [
  [0, 0, 1, 0, 0],
  [0, 1, 1, 1, 0],
  [1, 2, 3, 2, 1],
  [1, 2, 3, 2, 1],
  [1, 2, 2, 2, 1],
  [0, 1, 1, 1, 0],
  [0, 0, 1, 0, 0],
] as const;

export const LANTERN_HEIGHT = LANTERN_MAP.length;
export const LANTERN_WIDTH = LANTERN_MAP[0].length;

// ---------------------------------------------------------------------------
// Bench — 9×3. A low log seat in front of the hearth.
// ---------------------------------------------------------------------------

export const BENCH_MAP: LayerMap = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 2, 2, 2, 2, 2, 2, 2, 1],
  [0, 1, 0, 0, 0, 0, 0, 1, 0],
] as const;

// ---------------------------------------------------------------------------
// Floor plank seam — 1×N thin horizontal divider line.
// Used to draw plank gaps without authoring a giant grid.
// ---------------------------------------------------------------------------

export const FLOOR_PLANK_SEAM_HEIGHT = 1;

// ---------------------------------------------------------------------------
// Layer order — fixed bottom-up sequence. Tests pin this so a
// future refactor cannot silently re-order layers and have the
// hearth render behind the wall.
// ---------------------------------------------------------------------------

export const CAMP_LAYER_ORDER = [
  'wall',
  'floor',
  'hearth-frame',
  'flame',
  'bench',
  'lantern-left',
  'lantern-right',
  'mood-tint-overlay',
] as const;

export type CampLayerName = (typeof CAMP_LAYER_ORDER)[number];
