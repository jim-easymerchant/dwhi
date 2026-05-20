/**
 * CampScene + camp-palette + Iron Quest sprite-port smoke tests.
 *
 * Component imports are type-only (the file uses react-native at
 * runtime; we never load the component in Node Jest), same
 * convention as the existing screens.smoke.test.ts and
 * monsterSprite.smoke.test.ts.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import type { MomentumTier } from '@dwhi/workout-domain';

// Type-only — verifies the components export and accept the
// documented props. Erased at runtime.
import type { CampScene, CampSceneProps } from '../render/CampScene';
import type { MonsterSprite, MonsterSpriteProps } from '../render/MonsterSprite';

// Runtime — pure-data modules only.
import {
  CAMP_SURFACES,
  CAMP_TIER_TINTS,
  FLAME_FRAMES,
  tintFor,
} from '../render/campPalettes';
import {
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
} from '../render/campSceneLayers';
import {
  CATEGORY_SPRITE_OPTIONS,
  SPRITE_HEIGHT,
  SPRITE_REGISTRY,
  SPRITE_WIDTH,
  ironquestAberration,
  ironquestBeast,
  ironquestConstruct,
  ironquestHumanoid,
  ironquestSwarm,
  spriteById,
  validateSpriteMap,
  type SpriteId,
} from '../render/spriteMaps';

const RENDER_DIR = path.resolve(__dirname, '..', 'render');

// ===========================================================================
// 1. CampScene compile-time guard
// ===========================================================================

describe('CampScene — compile-time export', () => {
  test('component + props types exist and accept every Momentum tier', () => {
    type _Smoke = [typeof CampScene, CampSceneProps];
    const _ok1: CampSceneProps = { tier: 'rusted' };
    const _ok2: CampSceneProps = { tier: 'steady', scale: 0.75 };
    const _ok3: CampSceneProps = { tier: 'driven', paused: true };
    const _ok4: CampSceneProps = { tier: 'relentless' };
    const _ok5: CampSceneProps = { tier: 'ascendant', testID: 't' };
    void _ok1; void _ok2; void _ok3; void _ok4; void _ok5;
    expect(true).toBe(true);
  });
});

// ===========================================================================
// 2. Camp palette tier mapping
// ===========================================================================

describe('CAMP_TIER_TINTS', () => {
  test('every Momentum tier has a defined tint', () => {
    const tiers: readonly MomentumTier[] = [
      'rusted',
      'steady',
      'driven',
      'relentless',
      'ascendant',
    ];
    for (const t of tiers) {
      expect(CAMP_TIER_TINTS[t]).toBeDefined();
    }
  });

  test('tints encode dim → bright direction via opacity + flameIntensity', () => {
    // Cold + low flame at Rusted, bright + high flame at Ascendant.
    expect(CAMP_TIER_TINTS.rusted.flameIntensity).toBeLessThan(
      CAMP_TIER_TINTS.steady.flameIntensity,
    );
    expect(CAMP_TIER_TINTS.steady.flameIntensity).toBeLessThan(
      CAMP_TIER_TINTS.driven.flameIntensity,
    );
    expect(CAMP_TIER_TINTS.driven.flameIntensity).toBeLessThan(
      CAMP_TIER_TINTS.relentless.flameIntensity,
    );
    expect(CAMP_TIER_TINTS.relentless.flameIntensity).toBeLessThan(
      CAMP_TIER_TINTS.ascendant.flameIntensity,
    );
    // Opacity decreases as the room brightens — there's less to hide.
    expect(CAMP_TIER_TINTS.rusted.opacity).toBeGreaterThan(
      CAMP_TIER_TINTS.ascendant.opacity,
    );
  });

  test('tintFor falls back to steady on unknown input', () => {
    expect(tintFor('not-a-tier' as unknown as MomentumTier)).toBe(
      CAMP_TIER_TINTS.steady,
    );
  });

  test('CAMP_SURFACES exposes the named surface keys', () => {
    expect(CAMP_SURFACES.wallDark).toMatch(/^#[0-9a-f]{6}$/i);
    expect(CAMP_SURFACES.floorMid).toMatch(/^#[0-9a-f]{6}$/i);
    expect(CAMP_SURFACES.hearthFrameDark).toMatch(/^#[0-9a-f]{6}$/i);
  });

  test('FLAME_FRAMES has three frames of three colours each', () => {
    expect(FLAME_FRAMES).toHaveLength(3);
    for (const frame of FLAME_FRAMES) {
      expect(frame).toHaveLength(3);
      for (const c of frame) {
        expect(c).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });

  test('paletteForFlameFrame wraps around frame index', () => {
    expect(paletteForFlameFrame(0)).toBe(FLAME_FRAMES[0]);
    expect(paletteForFlameFrame(3)).toBe(FLAME_FRAMES[0]);
    expect(paletteForFlameFrame(-1)).toBe(FLAME_FRAMES[1]); // |-1| % 3 = 1
  });
});

// ===========================================================================
// 3. Camp scene layer order is stable
// ===========================================================================

describe('CAMP_LAYER_ORDER', () => {
  test('stable bottom-up sequence with the mood-tint overlay last', () => {
    expect(CAMP_LAYER_ORDER).toEqual([
      'wall',
      'floor',
      'hearth-frame',
      'flame',
      'bench',
      'lantern-left',
      'lantern-right',
      'mood-tint-overlay',
    ]);
  });

  test('every layer map is a rectangular grid', () => {
    for (const map of [HEARTH_FRAME_MAP, FLAME_MAP, LANTERN_MAP, BENCH_MAP]) {
      expect(map.length).toBeGreaterThan(0);
      const cols = map[0].length;
      expect(cols).toBeGreaterThan(0);
      for (const row of map) {
        expect(row.length).toBe(cols);
        for (const cell of row) {
          expect(Number.isInteger(cell)).toBe(true);
          expect(cell).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  test('declared layer dimensions match the maps', () => {
    expect(HEARTH_FRAME_HEIGHT).toBe(HEARTH_FRAME_MAP.length);
    expect(HEARTH_FRAME_WIDTH).toBe(HEARTH_FRAME_MAP[0].length);
    expect(FLAME_HEIGHT).toBe(FLAME_MAP.length);
    expect(FLAME_WIDTH).toBe(FLAME_MAP[0].length);
    expect(LANTERN_HEIGHT).toBe(LANTERN_MAP.length);
    expect(LANTERN_WIDTH).toBe(LANTERN_MAP[0].length);
  });
});

// ===========================================================================
// 4. Iron Quest sprite ports
// ===========================================================================

describe('Iron-Quest-adapted sprite maps', () => {
  test('all five IQ sprites are 14×12 with cells 0..5', () => {
    const iqMaps = [
      ironquestHumanoid,
      ironquestBeast,
      ironquestAberration,
      ironquestConstruct,
      ironquestSwarm,
    ];
    for (const map of iqMaps) {
      expect(map.length).toBe(SPRITE_HEIGHT);
      expect(validateSpriteMap(map)).toEqual([]);
      for (const row of map) {
        expect(row.length).toBe(SPRITE_WIDTH);
      }
    }
  });

  test('SPRITE_REGISTRY contains every Momentum and Iron-Quest sprite id', () => {
    const expected: readonly SpriteId[] = [
      'fragment',
      'hollow',
      'ward',
      'veil',
      'ember',
      'ironquest-humanoid',
      'ironquest-beast',
      'ironquest-aberration',
      'ironquest-construct',
      'ironquest-swarm',
    ];
    for (const id of expected) {
      expect(SPRITE_REGISTRY[id]).toBeDefined();
      expect(validateSpriteMap(SPRITE_REGISTRY[id])).toEqual([]);
    }
  });

  test('spriteById resolves every registered id; falls back to fragment on unknown', () => {
    for (const id of Object.keys(SPRITE_REGISTRY) as SpriteId[]) {
      expect(spriteById(id)).toBe(SPRITE_REGISTRY[id]);
    }
    expect(spriteById('does-not-exist' as unknown as SpriteId)).toBe(
      SPRITE_REGISTRY.fragment,
    );
  });

  test('CATEGORY_SPRITE_OPTIONS maps every live category to ≥ 1 sprite id', () => {
    expect(CATEGORY_SPRITE_OPTIONS.lesser_fragment.length).toBeGreaterThanOrEqual(1);
    expect(CATEGORY_SPRITE_OPTIONS.hollow.length).toBeGreaterThanOrEqual(1);
    expect(CATEGORY_SPRITE_OPTIONS.ward.length).toBeGreaterThanOrEqual(1);
    // First entry is the default — Momentum's original silhouette.
    expect(CATEGORY_SPRITE_OPTIONS.lesser_fragment[0]).toBe('fragment');
    expect(CATEGORY_SPRITE_OPTIONS.hollow[0]).toBe('hollow');
    expect(CATEGORY_SPRITE_OPTIONS.ward[0]).toBe('ward');
    // The Iron Quest archetype most-thematically associated with a
    // category is present in that category's options.
    expect(CATEGORY_SPRITE_OPTIONS.lesser_fragment).toContain('ironquest-humanoid');
    expect(CATEGORY_SPRITE_OPTIONS.hollow).toContain('ironquest-beast');
    expect(CATEGORY_SPRITE_OPTIONS.ward).toContain('ironquest-construct');
  });

  test('MonsterSprite accepts the new spriteId prop (compile-time)', () => {
    type _Smoke = [typeof MonsterSprite, MonsterSpriteProps];
    const _withId: MonsterSpriteProps = {
      mood: 'drift',
      category: 'lesser_fragment',
      spriteId: 'ironquest-humanoid',
    };
    void _withId;
    expect(true).toBe(true);
  });
});

// ===========================================================================
// 5. Regression — no forbidden imports in the render layer
// ===========================================================================

describe('render layer — no forbidden imports', () => {
  const sourceFiles = (() => {
    const out: string[] = [];
    for (const entry of fs.readdirSync(RENDER_DIR, { withFileTypes: true })) {
      if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
        out.push(path.join(RENDER_DIR, entry.name));
      }
    }
    return out;
  })();

  test('discovered the render layer', () => {
    expect(sourceFiles.length).toBeGreaterThan(0);
  });

  test.each(sourceFiles)(
    'no Reanimated / Skia / reference-ironquest imports in %s',
    (file) => {
      const text = fs.readFileSync(file, 'utf8');
      expect(text).not.toMatch(/from\s+['"]react-native-reanimated['"]/);
      expect(text).not.toMatch(/from\s+['"]react-native-reanimated\//);
      expect(text).not.toMatch(/from\s+['"]@shopify\/react-native-skia['"]/);
      expect(text).not.toMatch(/from\s+['"]@shopify\/react-native-skia\//);
      // Imports of reference/ironquest are banned at runtime;
      // doc-comment mentions remain allowed and expected.
      expect(text).not.toMatch(/from\s+['"][^'"]*reference\/ironquest/);
      expect(text).not.toMatch(/require\(['"][^'"]*reference\/ironquest/);
      expect(text).not.toMatch(/from\s+['"]@dwhi\/domain/);
      expect(text).not.toMatch(/from\s+['"]@\//);
      expect(text).not.toMatch(/from\s+['"]expo-(?!constants$)/);
    },
  );

  test('CampScene.tsx is present and exports the named component', () => {
    const filePath = path.join(RENDER_DIR, 'CampScene.tsx');
    const text = fs.readFileSync(filePath, 'utf8');
    expect(text).toMatch(/export function CampScene/);
    // The file references Animated (built-in) and the layer
    // modules — no Reanimated, no Skia, no SVG.
    expect(text).toMatch(/from\s+['"]react-native['"]/);
    expect(text).not.toMatch(/from\s+['"]react-native-svg/);
  });
});
