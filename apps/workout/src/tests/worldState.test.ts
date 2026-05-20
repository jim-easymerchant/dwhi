/**
 * World-state + patron-system tests.
 *
 * Pure-data tests against the world module. Components are
 * smoke-tested via `import type` (consistent with the rest of the
 * workout test suite — RN modules don't load under Node Jest).
 *
 * Coverage:
 *   1. Patron roster shape — every patron carries dialogue for
 *      every theme; ids are unique.
 *   2. Patron selection — deterministic, respects density / filters.
 *   3. Theme-aware dialogue — Momentum and Iron Quest pools never
 *      collide; same seed always returns the same line.
 *   4. World generator — deterministic; varies per seed; observation
 *      pool comes from the right theme; falls back to Momentum on
 *      unknown ids.
 *   5. Hostile-language regression — neither theme's patron pool
 *      nor observation pool nor activity hint contains shaming /
 *      disordered-eating / body-commentary vocabulary.
 *   6. No runtime imports from `reference/ironquest/` — grep the
 *      whole world module + the home screen.
 *   7. Smoke: PatronsPanel + HomeScreen export symbols still
 *      resolve via `import type`.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import type { MomentumTier } from '@dwhi/workout-domain';

import {
  PATRON_ROSTER,
  defaultDaySeed,
  findPatron,
  generateNightlyWorld,
  pickDialogue,
  selectPatronsForNight,
} from '../world';
import type {
  Patron,
  PatronPresence,
  WorldNight,
} from '../world';
import type { PatronsPanel } from '../components/tavern';
import type { HomeScreen } from '../screens/HomeScreen';
import {
  getTheme,
  ironQuestClassicTheme,
  listThemes,
  momentumTheme,
} from '../theme';

const ALL_TIERS: readonly MomentumTier[] = [
  'rusted',
  'steady',
  'driven',
  'relentless',
  'ascendant',
];

// ===========================================================================
// 1. Patron roster shape
// ===========================================================================

describe('PATRON_ROSTER', () => {
  test('has at least 8 patrons (the room has to feel inhabited)', () => {
    expect(PATRON_ROSTER.length).toBeGreaterThanOrEqual(8);
  });

  test('every patron id is unique', () => {
    const ids = PATRON_ROSTER.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every patron has a title and a philosophy', () => {
    for (const p of PATRON_ROSTER) {
      expect(p.title.length).toBeGreaterThan(0);
      expect(p.philosophy.length).toBeGreaterThan(0);
    }
  });

  test('every patron carries ≥2 dialogue lines for EVERY theme', () => {
    for (const p of PATRON_ROSTER) {
      for (const theme of listThemes()) {
        const pool = p.dialoguePools[theme.id];
        expect(pool).toBeDefined();
        expect(pool!.length).toBeGreaterThanOrEqual(2);
        for (const line of pool!) {
          expect(typeof line).toBe('string');
          expect(line.length).toBeGreaterThan(0);
        }
      }
    }
  });

  test('findPatron round-trips every roster id', () => {
    for (const p of PATRON_ROSTER) {
      expect(findPatron(p.id)).toBe(p);
    }
    expect(findPatron('not-a-real-id')).toBeUndefined();
  });
});

// ===========================================================================
// 2. Patron selection
// ===========================================================================

describe('selectPatronsForNight', () => {
  test('returns the expected count per ambient density', () => {
    const cases = [
      { theme: momentumTheme, expected: 2 }, // sparse
      { theme: ironQuestClassicTheme, expected: 4 }, // dense
    ];
    for (const { theme, expected } of cases) {
      const out = selectPatronsForNight({
        themeId: theme.id,
        theme,
        tier: 'steady',
        roomEnergy: 'settled',
        seed: 42,
      });
      expect(out.length).toBe(expected);
    }
  });

  test('same seed + same input = same patrons (deterministic)', () => {
    const a = selectPatronsForNight({
      themeId: 'momentum',
      theme: momentumTheme,
      tier: 'steady',
      roomEnergy: 'settled',
      seed: 1234,
    });
    const b = selectPatronsForNight({
      themeId: 'momentum',
      theme: momentumTheme,
      tier: 'steady',
      roomEnergy: 'settled',
      seed: 1234,
    });
    expect(a.map((p) => p.patron.id)).toEqual(b.map((p) => p.patron.id));
    expect(a.map((p) => p.line)).toEqual(b.map((p) => p.line));
  });

  test('different seeds produce at least one different patron over enough tries', () => {
    const seeds = [1, 2, 3, 4, 5, 6, 7];
    const idSets = seeds.map((seed) =>
      selectPatronsForNight({
        themeId: 'ironquest-classic',
        theme: ironQuestClassicTheme,
        tier: 'steady',
        roomEnergy: 'lively',
        seed,
      }).map((p) => p.patron.id).join('|'),
    );
    expect(new Set(idSets).size).toBeGreaterThan(1);
  });

  test('respects appearsWhen — Challenger never shows up in a quiet room', () => {
    const out = selectPatronsForNight({
      themeId: 'momentum',
      theme: momentumTheme,
      tier: 'steady',
      roomEnergy: 'quiet',
      seed: 1,
    });
    expect(out.find((p) => p.patron.id === 'the-challenger')).toBeUndefined();
  });

  test('respects appearsWhen.minTier — Old Soldier needs at least Driven', () => {
    const rustedOut = selectPatronsForNight({
      themeId: 'momentum',
      theme: momentumTheme,
      tier: 'rusted',
      roomEnergy: 'lively',
      seed: 99,
    });
    expect(
      rustedOut.find((p) => p.patron.id === 'the-old-soldier'),
    ).toBeUndefined();
  });
});

// ===========================================================================
// 3. Theme-aware dialogue selection
// ===========================================================================

describe('pickDialogue', () => {
  test('returns a line from the requested theme', () => {
    const spotter = findPatron('the-spotter')!;
    const momentum = pickDialogue(spotter, 'momentum', 7);
    const iq = pickDialogue(spotter, 'ironquest-classic', 7);
    expect(spotter.dialoguePools.momentum).toContain(momentum);
    expect(spotter.dialoguePools['ironquest-classic']).toContain(iq);
  });

  test('same seed + same patron = same line', () => {
    const spotter = findPatron('the-spotter')!;
    expect(pickDialogue(spotter, 'momentum', 1234)).toBe(
      pickDialogue(spotter, 'momentum', 1234),
    );
  });

  test('unknown theme id falls back to Momentum lines', () => {
    const spotter = findPatron('the-spotter')!;
    const fallback = pickDialogue(spotter, 'not-a-theme', 1234);
    expect(spotter.dialoguePools.momentum).toContain(fallback);
  });

  test('different patrons sharing one seed get distinct picks (mixed seed)', () => {
    const spotter = findPatron('the-spotter')!;
    const archivist = findPatron('the-archivist')!;
    const sLine = pickDialogue(spotter, 'momentum', 9);
    const aLine = pickDialogue(archivist, 'momentum', 9);
    expect(spotter.dialoguePools.momentum).toContain(sLine);
    expect(archivist.dialoguePools.momentum).toContain(aLine);
    expect(sLine).not.toBe(aLine);
  });
});

// ===========================================================================
// 4. World generator
// ===========================================================================

describe('generateNightlyWorld', () => {
  test('is fully deterministic on (themeId, tier, daysSince, daySeed)', () => {
    const a = generateNightlyWorld({
      themeId: 'momentum',
      tier: 'steady',
      daysSinceLastQuest: 2,
      daySeed: 555,
    });
    const b = generateNightlyWorld({
      themeId: 'momentum',
      tier: 'steady',
      daysSinceLastQuest: 2,
      daySeed: 555,
    });
    expect(b.patrons.map((p) => p.patron.id)).toEqual(
      a.patrons.map((p) => p.patron.id),
    );
    expect(b.observations.map((o) => o.id)).toEqual(
      a.observations.map((o) => o.id),
    );
    expect(b.weather).toBe(a.weather);
    expect(b.hearthState).toBe(a.hearthState);
  });

  test('respects ambient density (sparse vs dense)', () => {
    const sparse = generateNightlyWorld({
      themeId: 'momentum',
      tier: 'steady',
      daysSinceLastQuest: 0,
      daySeed: 1,
    });
    const dense = generateNightlyWorld({
      themeId: 'ironquest-classic',
      tier: 'steady',
      daysSinceLastQuest: 0,
      daySeed: 1,
    });
    expect(sparse.patrons.length).toBe(2);
    expect(sparse.observations.length).toBe(2);
    expect(dense.patrons.length).toBe(4);
    expect(dense.observations.length).toBe(3);
  });

  test('observations are drawn from the correct theme pool', () => {
    const m = generateNightlyWorld({
      themeId: 'momentum',
      tier: 'steady',
      daysSinceLastQuest: 0,
      daySeed: 13,
    });
    const iq = generateNightlyWorld({
      themeId: 'ironquest-classic',
      tier: 'steady',
      daysSinceLastQuest: 0,
      daySeed: 13,
    });
    // No id from the Momentum pool is in the IQ pool and vice versa.
    const mIds = new Set(m.observations.map((o) => o.id));
    const iqIds = new Set(iq.observations.map((o) => o.id));
    for (const id of mIds) expect(iqIds.has(id)).toBe(false);
  });

  test('unknown theme id falls back to Momentum patrons + pool', () => {
    const known = generateNightlyWorld({
      themeId: 'momentum',
      tier: 'steady',
      daysSinceLastQuest: 0,
      daySeed: 7,
    });
    const unknown = generateNightlyWorld({
      themeId: 'not-a-theme',
      tier: 'steady',
      daysSinceLastQuest: 0,
      daySeed: 7,
    });
    expect(unknown.patronSectionLabel).toBe(known.patronSectionLabel);
    expect(unknown.observations.map((o) => o.id)).toEqual(
      known.observations.map((o) => o.id),
    );
  });

  test('hearth state maps deterministically from tier + daysSince', () => {
    const cases: ReadonlyArray<{
      tier: MomentumTier;
      days: number;
      expected: WorldNight['hearthState'];
    }> = [
      { tier: 'rusted', days: 10, expected: 'cold' },
      { tier: 'rusted', days: 0, expected: 'low' },
      { tier: 'steady', days: 1, expected: 'warm' },
      { tier: 'driven', days: 0, expected: 'bright' },
      { tier: 'relentless', days: 0, expected: 'bright' },
      { tier: 'ascendant', days: 0, expected: 'roaring' },
    ];
    for (const c of cases) {
      const w = generateNightlyWorld({
        themeId: 'momentum',
        tier: c.tier,
        daysSinceLastQuest: c.days,
        daySeed: 1,
      });
      expect(w.hearthState).toBe(c.expected);
    }
  });

  test('every (theme × tier) seed produces a populated WorldNight', () => {
    for (const theme of listThemes()) {
      for (const tier of ALL_TIERS) {
        const w = generateNightlyWorld({
          themeId: theme.id,
          tier,
          daysSinceLastQuest: 1,
          daySeed: 42,
        });
        expect(w.patrons.length).toBeGreaterThanOrEqual(2);
        expect(w.observations.length).toBeGreaterThanOrEqual(2);
        expect(typeof w.weatherLine).toBe('string');
        expect(w.weatherLine.length).toBeGreaterThan(0);
      }
    }
  });

  test('default daySeed is one stable value per calendar day', () => {
    const a = defaultDaySeed(0);
    const b = defaultDaySeed(86_400_000 - 1); // same UTC day
    const c = defaultDaySeed(86_400_000); // next day
    expect(a).toBe(b);
    expect(c).toBe(a + 1);
  });

  test('weather line is per-theme', () => {
    const m = generateNightlyWorld({
      themeId: 'momentum',
      tier: 'steady',
      daysSinceLastQuest: 0,
      daySeed: 9,
    });
    const iq = generateNightlyWorld({
      themeId: 'ironquest-classic',
      tier: 'steady',
      daysSinceLastQuest: 0,
      daySeed: 9,
    });
    expect(m.weather).toBe(iq.weather); // same seed → same bucket
    expect(m.weatherLine).not.toBe(iq.weatherLine); // different phrasing
  });
});

// ===========================================================================
// 5. Anti-shame / hostile-language regression
// ===========================================================================

describe('anti-shame regression — every patron + observation pool', () => {
  const SHAMING = [
    /\blazy\b/,
    /\bweak\b/,
    /\bquitter\b/,
    /\bfailure\b/,
    /\bworthless\b/,
    /\buseless\b/,
    /\bcalorie/,
    /\bcalories/,
    /\bbmi\b/,
    /\bdiet\b/,
    /\bfat\b/,
    /\bskinny\b/,
    /\bugly\b/,
    /\bpathetic\b/,
    /\bdisappointing\b/,
    /\bworthless\b/,
  ];

  test('every patron dialogue line passes the shaming-vocabulary check, in every theme', () => {
    for (const p of PATRON_ROSTER) {
      for (const theme of listThemes()) {
        const pool = p.dialoguePools[theme.id];
        for (const line of pool!) {
          const lower = line.toLowerCase();
          for (const re of SHAMING) {
            expect(lower).not.toMatch(re);
          }
        }
      }
    }
  });

  test('every observation in every theme pool passes the shaming check', () => {
    for (const theme of listThemes()) {
      const world = generateNightlyWorld({
        themeId: theme.id,
        tier: 'steady',
        daysSinceLastQuest: 0,
        daySeed: 9999,
      });
      // We can only assert on what the generator emits at this
      // seed. Run a small sweep of seeds to exercise more of the
      // pool.
      for (let s = 0; s < 50; s++) {
        const w = generateNightlyWorld({
          themeId: theme.id,
          tier: 'steady',
          daysSinceLastQuest: 0,
          daySeed: s,
        });
        for (const obs of w.observations) {
          const lower = obs.text.toLowerCase();
          for (const re of SHAMING) {
            expect(lower).not.toMatch(re);
          }
        }
        for (const presence of w.patrons) {
          const lower = presence.line.toLowerCase();
          for (const re of SHAMING) {
            expect(lower).not.toMatch(re);
          }
        }
        const hint = w.activityHint.toLowerCase();
        for (const re of SHAMING) {
          expect(hint).not.toMatch(re);
        }
      }
      // Touch the fixed-seed world so unused variable lint stays quiet.
      expect(world.patrons.length).toBeGreaterThan(0);
    }
  });

  test('no observation or patron line references absence / missed days', () => {
    const NEGATIVE = [
      /\bmissed\b/,
      /\bskipped\b/,
      /\bgone too long\b/,
      /\bwhere have you been\b/,
    ];
    for (const p of PATRON_ROSTER) {
      for (const theme of listThemes()) {
        for (const line of p.dialoguePools[theme.id]!) {
          const lower = line.toLowerCase();
          for (const re of NEGATIVE) {
            expect(lower).not.toMatch(re);
          }
        }
      }
    }
  });
});

// ===========================================================================
// 6. No runtime imports from reference/ironquest
// ===========================================================================

describe('reference/ironquest import boundary', () => {
  const WORLD_DIR = path.resolve(__dirname, '..', 'world');
  const HOME_FILE = path.resolve(
    __dirname,
    '..',
    'screens',
    'HomeScreen.tsx',
  );

  function readAll(dir: string): string {
    const out: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isFile()) out.push(fs.readFileSync(p, 'utf8'));
    }
    return out.join('\n');
  }

  // Match only ACTUAL import-from / require-call statements that
  // reach into reference/ironquest. Comments referencing the
  // concept source are allowed (and audited).
  const STATIC_IMPORT = /\bfrom\s+['"][^'"]*reference\/ironquest[^'"]*['"]/;
  const DYNAMIC_REQUIRE = /\brequire\s*\(\s*['"][^'"]*reference\/ironquest[^'"]*['"]\s*\)/;
  const DYNAMIC_IMPORT = /\bimport\s*\(\s*['"][^'"]*reference\/ironquest[^'"]*['"]\s*\)/;

  function assertNoIqRuntimeImport(text: string): void {
    expect(text).not.toMatch(STATIC_IMPORT);
    expect(text).not.toMatch(DYNAMIC_REQUIRE);
    expect(text).not.toMatch(DYNAMIC_IMPORT);
  }

  test('no source file in src/world imports from reference/ironquest', () => {
    assertNoIqRuntimeImport(readAll(WORLD_DIR));
  });

  test('HomeScreen does not import from reference/ironquest', () => {
    assertNoIqRuntimeImport(fs.readFileSync(HOME_FILE, 'utf8'));
  });

  test('PatronsPanel component file does not import from reference/ironquest', () => {
    const pp = path.resolve(
      __dirname,
      '..',
      'components',
      'tavern',
      'PatronsPanel.tsx',
    );
    assertNoIqRuntimeImport(fs.readFileSync(pp, 'utf8'));
  });
});

// ===========================================================================
// 7. Smoke — PatronsPanel + HomeScreen exports
// ===========================================================================

describe('Tavern PatronsPanel + HomeScreen export smoke', () => {
  test('PatronsPanel and HomeScreen still export expected symbols', () => {
    type _Smoke = [typeof PatronsPanel, typeof HomeScreen];
    expect(true).toBe(true);
  });

  test('a PatronPresence has the expected shape', () => {
    const world = generateNightlyWorld({
      themeId: 'momentum',
      tier: 'steady',
      daysSinceLastQuest: 0,
      daySeed: 1,
    });
    const first: PatronPresence = world.patrons[0];
    expect(typeof first.patron.title).toBe('string');
    expect(typeof first.line).toBe('string');
  });

  test('the theme barrel exposes worldState metadata for both shipped themes', () => {
    for (const theme of [momentumTheme, ironQuestClassicTheme]) {
      expect(theme.worldState).toBeDefined();
      expect(theme.worldState.patronSectionLabel.length).toBeGreaterThan(0);
      expect(['sparse', 'medium', 'dense']).toContain(
        theme.worldState.ambientDensity,
      );
      expect(theme.worldState.weatherCopy.rain.length).toBeGreaterThan(0);
    }
  });

  test('getTheme(unknown) returns a theme that still has worldState', () => {
    const t = getTheme('not-a-theme');
    expect(t.worldState).toBeDefined();
  });
});
