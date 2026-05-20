/**
 * Product-parity branch regression tests.
 *
 * Five buckets, all grep-style against the source files (the
 * components themselves can't be runtime-imported under Node Jest
 * because of react-native):
 *
 *   1. HomeScreen renders a full-bleed scene (no TavernHeader at
 *      the top; no text header strip above the image).
 *   2. Iron Quest Classic gets a sign; Momentum does not.
 *   3. Battle screen has a clear, prominent enemy HP bar that
 *      shows current/max + percent and works with multi-phase.
 *   4. Settings panel exposes the unit toggle.
 *   5. No new runtime imports from reference/ironquest.
 *   6. Compile-time smoke — the units module + leveling module
 *      are exported and the WeightUnit type narrows correctly.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import type { WeightUnit } from '../units';
import type { LevelProgress } from '../leveling';
import { ironQuestClassicTheme, momentumTheme } from '../theme';

const HOME_FILE = path.resolve(
  __dirname,
  '..',
  'screens',
  'HomeScreen.tsx',
);
const BATTLE_FILE = path.resolve(
  __dirname,
  '..',
  'screens',
  'BattleScreen.tsx',
);
const SETTINGS_FILE = path.resolve(
  __dirname,
  '..',
  'screens',
  'SettingsScreen.tsx',
);
const SCENE_FRAME_FILE = path.resolve(
  __dirname,
  '..',
  'components',
  'tavern',
  'TavernSceneFrame.tsx',
);

function read(file: string): string {
  return fs.readFileSync(file, 'utf8');
}

// ===========================================================================
// 1. HomeScreen full-bleed scene + no text header
// ===========================================================================

describe('HomeScreen full-bleed scene redesign', () => {
  const text = read(HOME_FILE);

  test('HomeScreen no longer mounts TavernHeader (header text removed)', () => {
    expect(text).not.toMatch(/<TavernHeader\b/);
  });

  test('HomeScreen still mounts TavernSceneFrame', () => {
    expect(text).toMatch(/<TavernSceneFrame\b/);
  });

  test('HomeScreen wires the settings gear through the scene frame', () => {
    expect(text).toMatch(/onOpenSettings=\{openSettings\}/);
  });
});

describe('TavernSceneFrame full-bleed styling', () => {
  const text = read(SCENE_FRAME_FILE);

  test('uses negative horizontal margin to bleed past the parent padding', () => {
    expect(text).toMatch(/marginHorizontal:\s*-workoutSpacing\.lg/);
  });

  test('renders an Iron Quest sign block guarded by signText', () => {
    expect(text).toMatch(/signText \?/);
    expect(text).toMatch(/testID="tavern-sign"/);
  });

  test('renders a settings gear guarded by onOpenSettings', () => {
    expect(text).toMatch(/onOpenSettings \?/);
    expect(text).toMatch(/testID="home-open-settings"/);
  });
});

// ===========================================================================
// 2. Theme-specific sign
// ===========================================================================

describe('Iron Quest sign vs Momentum quiet header', () => {
  const text = read(HOME_FILE);

  test('HomeScreen passes a signText for the IQ theme only', () => {
    // Branch on `theme.id === 'ironquest-classic'` for the sign
    // props — Momentum gets `undefined`.
    expect(text).toMatch(/theme\.id\s*===\s*'ironquest-classic'/);
    expect(text).toMatch(/signText=/);
  });

  test('Momentum theme headerCopy.title is still "The Hollow" (used in non-sign contexts)', () => {
    expect(momentumTheme.headerCopy.title).toBe('The Hollow');
  });

  test('Iron Quest Classic theme headerCopy.title is "THE WOUNDED GOBLIN"', () => {
    expect(ironQuestClassicTheme.headerCopy.title).toBe('THE WOUNDED GOBLIN');
  });
});

// ===========================================================================
// 3. Battle HP bar visibility + multi-phase
// ===========================================================================

describe('Battle screen HP bar', () => {
  const text = read(BATTLE_FILE);

  test('HP block is tagged with testID="battle-hp-block"', () => {
    expect(text).toContain('testID="battle-hp-block"');
  });

  test('HP track + fill are each tagged for runtime inspection', () => {
    expect(text).toContain('testID="battle-hp-track"');
    expect(text).toContain('testID="battle-hp-fill"');
  });

  test('HP text shows current/max plus a percent', () => {
    expect(text).toMatch(/currentEnemyHp/);
    expect(text).toMatch(/currentEnemy\.maxHp/);
    expect(text).toMatch(/progressPct/);
    expect(text).toContain('testID="battle-hp-text"');
  });

  test('Multi-phase indicator gates on enemyPhaseIndex > 0', () => {
    expect(text).toContain('testID="battle-hp-phase"');
    expect(text).toMatch(/enemyPhaseIndex\s*>\s*0/);
  });

  test('HP fill width uses (100 - progressPct) so it shrinks as damage is dealt', () => {
    expect(text).toMatch(/100\s*-\s*progressPct/);
  });

  test('HP fill is themed with theme.uiAccent.danger (not a static colour)', () => {
    expect(text).toMatch(/theme\.uiAccent\.danger/);
  });

  test('accessibilityRole="progressbar" announces HP state to screen readers', () => {
    expect(text).toMatch(/accessibilityRole=["']progressbar["']/);
  });
});

// ===========================================================================
// 4. Settings panel unit toggle
// ===========================================================================

describe('Settings panel weight-unit toggle', () => {
  const text = read(SETTINGS_FILE);

  test('Settings imports and uses the units helper', () => {
    expect(text).toMatch(/from '\.\.\/units'/);
    expect(text).toMatch(/safeWeightUnit/);
  });

  test('Settings exposes lb and kg testIDs', () => {
    expect(text).toContain('testID={`settings-unit-${label}`}');
  });

  test('Settings wires setWeightUnit from the store', () => {
    expect(text).toMatch(/setWeightUnit\s*=\s*useWorkoutGameStore/);
    expect(text).toMatch(/setWeightUnit\('lb'\)/);
    expect(text).toMatch(/setWeightUnit\('kg'\)/);
  });
});

// ===========================================================================
// 5. No reference/ironquest runtime imports
// ===========================================================================

describe('no runtime imports from reference/ironquest', () => {
  const STATIC = /\bfrom\s+['"][^'"]*reference\/ironquest[^'"]*['"]/;
  const REQ = /\brequire\s*\(\s*['"][^'"]*reference\/ironquest[^'"]*['"]\s*\)/;
  const DYN = /\bimport\s*\(\s*['"][^'"]*reference\/ironquest[^'"]*['"]\s*\)/;

  for (const file of [HOME_FILE, BATTLE_FILE, SETTINGS_FILE, SCENE_FRAME_FILE]) {
    test(`${path.basename(file)} has no IQ runtime imports`, () => {
      const text = read(file);
      expect(text).not.toMatch(STATIC);
      expect(text).not.toMatch(REQ);
      expect(text).not.toMatch(DYN);
    });
  }
});

// ===========================================================================
// 6. Compile-time smoke
// ===========================================================================

describe('units + leveling exports', () => {
  test('WeightUnit narrows to "lb" | "kg"', () => {
    const u: WeightUnit = 'lb';
    expect(['lb', 'kg']).toContain(u);
  });

  test('LevelProgress shape exists for the home-screen progress bar', () => {
    const p: LevelProgress = {
      level: 1,
      xpIntoLevel: 0,
      xpToNextLevel: 0,
      progress: 0,
    };
    expect(p.level).toBe(1);
  });
});
