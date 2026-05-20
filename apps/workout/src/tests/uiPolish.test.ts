/**
 * UI-polish branch regression tests.
 *
 * Five buckets, all grep-style against the source files:
 *
 *   1. No duplicate "TONIGHT'S PATRONS" — the coach-archetype
 *      section (PatronsPanel, fed by `worldState.patronSectionLabel`)
 *      and the environmental-blurb section (AmbientPanel, fed by
 *      `ambient.sectionLabel`) MUST use distinct labels per theme.
 *   2. TavernSceneFrame is full-bleed (viewport-pinned width,
 *      negative horizontal margin, no rounded card chrome).
 *   3. Iron Quest sign is anchored top-left (not centred) and is
 *      visibly smaller than the previous centred sign (max width
 *      <= 200px so it doesn't dominate the scene).
 *   4. BattleScreen has a player-HP block separate from the
 *      enemy-HP block, with its own testIDs.
 *   5. No new runtime imports from `reference/ironquest`.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { ironQuestClassicTheme, momentumTheme } from '../theme';

const SCENE_FRAME = path.resolve(
  __dirname,
  '..',
  'components',
  'tavern',
  'TavernSceneFrame.tsx',
);
const HOME = path.resolve(__dirname, '..', 'screens', 'HomeScreen.tsx');
const BATTLE = path.resolve(__dirname, '..', 'screens', 'BattleScreen.tsx');
const PATRONS_PANEL = path.resolve(
  __dirname,
  '..',
  'components',
  'tavern',
  'PatronsPanel.tsx',
);
const REST_TIMER = path.resolve(
  __dirname,
  '..',
  'components',
  'battle',
  'RestTimer.tsx',
);
const PLAYER_HP = path.resolve(__dirname, '..', 'combat', 'playerHp.ts');
const REST_TIMER_HOOK = path.resolve(
  __dirname,
  '..',
  'hooks',
  'useRestTimer.ts',
);

function read(file: string): string {
  return fs.readFileSync(file, 'utf8');
}

// ===========================================================================
// 1. Distinct section labels — no duplicate "TONIGHT'S PATRONS"
// ===========================================================================

describe('no duplicate patrons heading', () => {
  // Branch 024 device-QA: the duplicate "TONIGHT'S PATRONS"
  // section was caused by HomeScreen mounting BOTH the
  // PatronsPanel (coach archetypes) and the AmbientPanel
  // (environmental blurbs) with confusingly-similar headings.
  // The fix removed AmbientPanel from HomeScreen and let
  // PatronsPanel be the single character/presence block. The
  // theme labels themselves CAN now be identical because only
  // one panel renders.
  test('HomeScreen mounts exactly one patron / character panel', () => {
    const home = read(HOME);
    // PatronsPanel is mounted.
    expect(home).toMatch(/<PatronsPanel\b/);
    // AmbientPanel is NOT mounted (was the second duplicate).
    expect(home).not.toMatch(/<AmbientPanel\b/);
  });

  test('IQ keeps "TONIGHT\'S PATRONS" as the patrons heading', () => {
    expect(ironQuestClassicTheme.worldState.patronSectionLabel).toBe(
      "TONIGHT'S PATRONS",
    );
  });

  test('Momentum keeps a quiet, distinct patrons heading', () => {
    expect(momentumTheme.worldState.patronSectionLabel).toBe(
      'Voices around the fire',
    );
  });
});

// ===========================================================================
// 2. TavernSceneFrame full-bleed
// ===========================================================================

describe('TavernSceneFrame full-bleed', () => {
  const text = read(SCENE_FRAME);

  test('uses useWindowDimensions to bleed across the live viewport width', () => {
    // Branch 024 switched from the captured-at-load
    // `Dimensions.get('window').width` to the live
    // `useWindowDimensions()` hook so the scene responds to
    // rotation + variable phone widths on real devices.
    expect(text).toMatch(/useWindowDimensions/);
    expect(text).toMatch(/from\s+['"]react-native['"]/);
  });

  test('cancels parent horizontal padding via negative margin', () => {
    expect(text).toMatch(/marginHorizontal:\s*-workoutSpacing\.lg/);
  });

  test('canvas has no border / no rounded-card chrome', () => {
    // Match the `canvas:` style declaration and the line(s) that
    // follow it. The canvas key must NOT carry a borderWidth or
    // borderRadius — those are explicitly removed in the redesign.
    const canvasIdx = text.indexOf('canvas: {');
    expect(canvasIdx).toBeGreaterThan(-1);
    const canvasBlockEnd = text.indexOf('},', canvasIdx);
    const block = text.slice(canvasIdx, canvasBlockEnd);
    expect(block).not.toMatch(/borderWidth/);
    expect(block).not.toMatch(/borderRadius/);
  });

  test('renders a bottom vignette fading into the app background', () => {
    expect(text).toContain('testID="tavern-vignette"');
    expect(text).toMatch(/vignetteBand[123]/);
  });
});

// ===========================================================================
// 3. Iron Quest sign — small, top-left, translucent
// ===========================================================================

describe('Iron Quest sign positioning', () => {
  const text = read(SCENE_FRAME);

  test('sign is anchored to the upper-left corner, not centred', () => {
    // Find the signWrap style block.
    const idx = text.indexOf('signWrap: {');
    expect(idx).toBeGreaterThan(-1);
    const block = text.slice(idx, text.indexOf('},', idx));
    // Anchored: must declare `left:`. `top:` is set DYNAMICALLY
    // from `insets.top + sm` in branch 024 so it sits below the
    // safe-area top edge — so we look for that pattern in the
    // file body, not the style block.
    expect(block).toMatch(/left:\s*workoutSpacing/);
    expect(block).not.toMatch(/alignSelf:\s*['"]center['"]/);
    expect(text).toMatch(/useSafeAreaInsets/);
    expect(text).toMatch(/insets\.top\s*\+\s*workoutSpacing\.sm/);
  });

  test('sign max width keeps it from dominating the scene (≤ 200)', () => {
    const idx = text.indexOf('signWrap: {');
    const block = text.slice(idx, text.indexOf('},', idx));
    const m = block.match(/maxWidth:\s*(\d+)/);
    expect(m).not.toBeNull();
    const maxWidth = Number(m![1]);
    expect(maxWidth).toBeLessThanOrEqual(200);
  });

  test('sign uses a translucent background (rgba alpha < 1)', () => {
    const idx = text.indexOf('signWrap: {');
    const block = text.slice(idx, text.indexOf('},', idx));
    expect(block).toMatch(/rgba\(\s*8\s*,\s*8\s*,\s*12\s*,\s*0\.\d+\s*\)/);
  });

  test('Momentum theme still passes no signText to the frame', () => {
    const home = read(HOME);
    // The HomeScreen branches on theme id for the sign — Momentum
    // gets `undefined`.
    expect(home).toMatch(/signText=\{[\s\S]*ironquest-classic/);
  });
});

// ===========================================================================
// 4. Battle screen — separate player HP block
// ===========================================================================

describe('Battle player HP', () => {
  const text = read(BATTLE);

  test('mounts a dedicated player-HP block', () => {
    expect(text).toContain('testID="battle-player-hp-block"');
    expect(text).toContain('testID="battle-player-hp-track"');
    expect(text).toContain('testID="battle-player-hp-fill"');
    expect(text).toContain('testID="battle-player-hp-text"');
    expect(text).toContain('testID="battle-player-hp-level"');
  });

  test('player HP is sourced from the store (current/max model)', () => {
    // Branch 024 moved the HP derivation into the store at
    // quest-start; the BattleScreen now reads `playerCurrentHp`
    // and `playerMaxHp` directly. The pure formula still lives
    // in apps/workout/src/combat — see playerHp.test.ts — but
    // it's invoked from `startQuest`, not the screen.
    expect(text).toMatch(/playerCurrentHp/);
    expect(text).toMatch(/playerMaxHp/);
  });

  test('player HP fill is themed ember (uiAccent.primary), distinct from enemy red', () => {
    // Find the playerHpBlock styles
    const accentLines = text.match(/backgroundColor:\s*theme\.uiAccent\.primary/g);
    expect(accentLines).not.toBeNull();
    // And the enemy fill still uses danger.
    expect(text).toMatch(/backgroundColor:\s*theme\.uiAccent\.danger/);
  });

  test('label is "YOU" — clear identity for the player bar', () => {
    expect(text).toMatch(/style=\{styles\.hpHeaderLabel\}\s*>\s*YOU/);
  });

  test('player HP does not depend on bodyweight', () => {
    expect(text).not.toMatch(/bodyweight.*computePlayerHp/);
  });
});

// ===========================================================================
// 5. Player HP module — body-mass independence (compile-time guard)
// ===========================================================================

describe('playerHp module body-mass independence', () => {
  const text = read(PLAYER_HP);

  test('PlayerHpInputs has no bodyweight field in the type definition', () => {
    const idx = text.indexOf('export interface PlayerHpInputs');
    expect(idx).toBeGreaterThan(-1);
    const block = text.slice(idx, text.indexOf('}', idx));
    expect(block).not.toMatch(/bodyweight/i);
    expect(block).not.toMatch(/body_mass/i);
  });
});

// ===========================================================================
// 6. Rest timer integration into BattleScreen
// ===========================================================================

describe('Rest timer integration', () => {
  // Branch 024 device-QA moved the RestTimer off BattleScreen
  // (where it was unreachable — the early-return to RestScreen
  // ate it) and onto the RestScreen itself, where it actually
  // appears AFTER the player logs an attack.
  const battle = read(BATTLE);
  const REST = path.resolve(__dirname, '..', 'screens', 'RestScreen.tsx');
  const rest = fs.readFileSync(REST, 'utf8');

  test('BattleScreen no longer mounts RestTimer (it lives on RestScreen)', () => {
    expect(battle).not.toMatch(/<RestTimer\b/);
  });

  test('RestScreen mounts the RestTimer and creates the hook', () => {
    expect(rest).toMatch(/<RestTimer\b/);
    expect(rest).toMatch(/useRestTimer\(\)/);
  });

  test('RestScreen offers the timer chips unconditionally (after-attack screen)', () => {
    // The component prop is `offerWhenIdle`. On RestScreen we
    // either pass `offerWhenIdle` (no value) or
    // `offerWhenIdle={true}`. Either form is fine.
    expect(rest).toMatch(/offerWhenIdle(\s|$|}|=)/);
  });
});

// ===========================================================================
// 7. No runtime imports from reference/ironquest in changed files
// ===========================================================================

describe('no runtime imports from reference/ironquest', () => {
  const STATIC = /\bfrom\s+['"][^'"]*reference\/ironquest[^'"]*['"]/;
  const REQ = /\brequire\s*\(\s*['"][^'"]*reference\/ironquest[^'"]*['"]\s*\)/;
  const DYN = /\bimport\s*\(\s*['"][^'"]*reference\/ironquest[^'"]*['"]\s*\)/;

  for (const file of [
    SCENE_FRAME,
    HOME,
    BATTLE,
    PATRONS_PANEL,
    REST_TIMER,
    PLAYER_HP,
    REST_TIMER_HOOK,
  ]) {
    test(`${path.basename(file)} has no IQ runtime imports`, () => {
      const text = read(file);
      expect(text).not.toMatch(STATIC);
      expect(text).not.toMatch(REQ);
      expect(text).not.toMatch(DYN);
    });
  }
});
