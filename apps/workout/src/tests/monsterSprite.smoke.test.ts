/**
 * MonsterSprite — pure-data + compile-time smoke tests.
 *
 * The renderer component itself imports `react-native`, which has
 * no Node target. We follow the existing convention from
 * `screens.smoke.test.ts` / `packages/ui`'s barrel test: keep
 * runtime imports limited to pure-data modules, and pull the
 * component's type via `import type` so a typo still fails
 * `tsc --noEmit`.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import type { EnemyCategory, EnemyMood } from '@dwhi/workout-domain';

// Type-only — erased at runtime; verifies the export still exists.
// We import from the .tsx file path directly so `tsc --noEmit`
// surfaces a renamed/missing export, but the file is never
// runtime-required (react-native has no Node target).
import type {
  MonsterSprite,
  MonsterSpriteProps,
} from '../render/MonsterSprite';

// Runtime — import the pure-data modules DIRECTLY (not through the
// barrel) so the .tsx renderer is never pulled into Node Jest.
// Same convention as the existing screens.smoke.test.ts.
import {
  CATEGORY_TO_MAP,
  SPRITE_HEIGHT,
  SPRITE_WIDTH,
  emberMap,
  fragmentMap,
  hollowMap,
  mapForCategory,
  validateSpriteMap,
  veilMap,
  wardMap,
} from '../render/spriteMaps';
import {
  MOOD_PALETTES,
  desaturate,
  paletteFor,
  parseHex,
  tintHearth,
} from '../render/spritePalettes';

// ===========================================================================
// Palette tests
// ===========================================================================

describe('MOOD_PALETTES', () => {
  test('every defined mood has a palette', () => {
    const moods: readonly EnemyMood[] = ['drift', 'hush', 'glare', 'stone'];
    for (const m of moods) {
      expect(MOOD_PALETTES[m]).toBeDefined();
    }
  });

  test('each palette has exactly five entries', () => {
    for (const [name, palette] of Object.entries(MOOD_PALETTES)) {
      expect(palette.length).toBe(5);
      // Lint check: palette is dim → bright, so spot-check ordering is
      // not enforced (some palettes legitimately compress) — but every
      // value must look like a hex colour.
      for (const c of palette) {
        expect(typeof c).toBe('string');
        expect(c).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(parseHex(c).every((n) => Number.isFinite(n))).toBe(true);
      }
      void name;
    }
  });

  test('paletteFor returns the named palette and falls back to drift', () => {
    expect(paletteFor('drift')).toBe(MOOD_PALETTES.drift);
    expect(paletteFor('hush')).toBe(MOOD_PALETTES.hush);
    expect(paletteFor('glare')).toBe(MOOD_PALETTES.glare);
    expect(paletteFor('stone')).toBe(MOOD_PALETTES.stone);
    // Defensive: a non-mood string falls back without throwing.
    // We cast through unknown so the bad input is shaped like the
    // signature (the runtime fallback is the point).
    expect(paletteFor('not-a-mood' as unknown as EnemyMood)).toBe(
      MOOD_PALETTES.drift,
    );
  });
});

// ===========================================================================
// Sprite-map shape tests
// ===========================================================================

describe('sprite maps — shape', () => {
  test.each([
    ['fragmentMap', fragmentMap],
    ['hollowMap', hollowMap],
    ['wardMap', wardMap],
    ['veilMap', veilMap],
    ['emberMap', emberMap],
  ] as const)('%s is %ix%i with cells in 0..5', (name, map) => {
    expect(map.length).toBe(SPRITE_HEIGHT);
    const issues = validateSpriteMap(map);
    expect(issues).toEqual([]);
    void name;
  });

  test('SPRITE_WIDTH / SPRITE_HEIGHT match the documented contract', () => {
    expect(SPRITE_WIDTH).toBe(12);
    expect(SPRITE_HEIGHT).toBe(14);
  });

  test('every sprite map renders within the declared bounds', () => {
    for (const map of [fragmentMap, hollowMap, wardMap, veilMap, emberMap]) {
      for (const row of map) {
        expect(row.length).toBe(SPRITE_WIDTH);
        for (const cell of row) {
          expect(cell).toBeGreaterThanOrEqual(0);
          expect(cell).toBeLessThanOrEqual(5);
        }
      }
    }
  });

  test('validateSpriteMap surfaces shape errors', () => {
    const bad: readonly (readonly number[])[] = [[1, 2, 3]];
    const issues = validateSpriteMap(bad);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]).toMatch(/expected 14 rows/);
  });

  test('validateSpriteMap rejects out-of-range cells', () => {
    const bad = Array.from({ length: SPRITE_HEIGHT }, () =>
      Array.from({ length: SPRITE_WIDTH }, () => 0),
    );
    bad[0][0] = 6;
    const issues = validateSpriteMap(bad);
    expect(issues.some((i) => /expected 0..5 integer/.test(i))).toBe(true);
  });
});

// ===========================================================================
// Category → map binding
// ===========================================================================

describe('CATEGORY_TO_MAP', () => {
  test.each(['lesser_fragment', 'hollow', 'ward'] as const)(
    'category %s maps to a present, shape-valid sprite',
    (cat) => {
      const map = mapForCategory(cat);
      expect(map).toBeDefined();
      expect(validateSpriteMap(map)).toEqual([]);
    },
  );

  test('all live EnemyCategory values are mapped', () => {
    const live: readonly EnemyCategory[] = ['lesser_fragment', 'hollow', 'ward'];
    for (const c of live) {
      expect(CATEGORY_TO_MAP[c]).toBeDefined();
    }
  });

  test('mapForCategory falls back to fragmentMap for unknown input', () => {
    expect(mapForCategory('not-a-category' as unknown as EnemyCategory)).toBe(
      fragmentMap,
    );
  });
});

// ===========================================================================
// Tint helpers
// ===========================================================================

describe('tintHearth / desaturate', () => {
  test('parseHex round-trips valid input', () => {
    expect(parseHex('#000000')).toEqual([0, 0, 0]);
    expect(parseHex('#ffffff')).toEqual([255, 255, 255]);
    expect(parseHex('#1a2330')).toEqual([26, 35, 48]);
  });

  test('parseHex returns black on malformed input', () => {
    expect(parseHex('not a colour')).toEqual([0, 0, 0]);
    expect(parseHex('#abc')).toEqual([0, 0, 0]);
  });

  test('tintHearth at amount=0 returns an rgb string equivalent to input', () => {
    const out = tintHearth('#1a2330', 0);
    expect(out).toBe('rgb(26,35,48)');
  });

  test('tintHearth at amount=1 returns full Hearth colour', () => {
    const out = tintHearth('#1a2330', 1);
    expect(out).toBe('rgb(213,94,63)');
  });

  test('tintHearth clamps amount to [0, 1]', () => {
    expect(tintHearth('#000000', -5)).toBe(tintHearth('#000000', 0));
    expect(tintHearth('#000000', 5)).toBe(tintHearth('#000000', 1));
  });

  test('desaturate pulls every channel toward the average', () => {
    // 100 / 50 / 0 → avg ~ 50 — channels converge as amount → 1.
    expect(desaturate('#643200', 1)).toBe('rgb(50,50,50)');
    expect(desaturate('#643200', 0)).toBe('rgb(100,50,0)');
  });
});

// ===========================================================================
// Renderer type guard (compile-time)
// ===========================================================================

describe('MonsterSprite (compile-time)', () => {
  test('component + props types exist and accept every mood + category', () => {
    type _Smoke = [
      typeof MonsterSprite,
      MonsterSpriteProps,
    ];
    // Spot-check the shape statically via const objects (erased).
    const _ok1: MonsterSpriteProps = {
      mood: 'drift',
      category: 'lesser_fragment',
    };
    const _ok2: MonsterSpriteProps = {
      mood: 'glare',
      category: 'ward',
      victoryAvailable: true,
      paused: false,
      pixelSize: 6,
    };
    void _ok1;
    void _ok2;
    expect(true).toBe(true);
  });
});

// ===========================================================================
// Regression: no forbidden imports in the render layer
// ===========================================================================

describe('render layer — no forbidden imports', () => {
  const RENDER_DIR = path.resolve(__dirname, '..', 'render');

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
      // The regression guard targets *imports* — doc-comment mentions
      // of "reference/ironquest" are fine and expected (the docs
      // describe what we ported and why).
      expect(text).not.toMatch(/from\s+['"][^'"]*reference\/ironquest/);
      expect(text).not.toMatch(/require\(['"][^'"]*reference\/ironquest/);
      // Also guard against pulling pantry/domain or expo-* by mistake.
      expect(text).not.toMatch(/from\s+['"]@dwhi\/domain/);
      expect(text).not.toMatch(/from\s+['"]@\//);
      expect(text).not.toMatch(/from\s+['"]expo-(?!constants$)/); // expo-constants is ok if ever needed
    },
  );
});
