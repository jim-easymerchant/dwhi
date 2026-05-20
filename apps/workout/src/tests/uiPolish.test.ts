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
  test('each theme has DIFFERENT labels for ambient vs world-state sections', () => {
    for (const theme of [momentumTheme, ironQuestClassicTheme]) {
      const ambient = theme.ambient.sectionLabel;
      const patrons = theme.worldState.patronSectionLabel;
      expect(ambient).not.toBe(patrons);
      // And neither is empty.
      expect(ambient.length).toBeGreaterThan(0);
      expect(patrons.length).toBeGreaterThan(0);
    }
  });

  test('Iron Quest patrons section is renamed away from "TONIGHT\'S PATRONS"', () => {
    expect(ironQuestClassicTheme.worldState.patronSectionLabel).not.toMatch(
      /tonight'?s patrons/i,
    );
    // It uses the explicit re-name from the brief.
    expect(ironQuestClassicTheme.worldState.patronSectionLabel).toBe(
      'THE REGULARS',
    );
  });

  test('Momentum patrons section keeps a quiet, distinct label', () => {
    expect(momentumTheme.worldState.patronSectionLabel).toBe(
      'Voices around the fire',
    );
  });

  test('the IQ ambient label is still "TONIGHT\'S PATRONS" (environmental section)', () => {
    expect(ironQuestClassicTheme.ambient.sectionLabel).toMatch(
      /tonight'?s patrons/i,
    );
  });
});

// ===========================================================================
// 2. TavernSceneFrame full-bleed
// ===========================================================================

describe('TavernSceneFrame full-bleed', () => {
  const text = read(SCENE_FRAME);

  test('uses Dimensions to bleed across the viewport width', () => {
    expect(text).toMatch(/Dimensions\.get\(['"]window['"]\)/);
    expect(text).toMatch(/VIEWPORT_WIDTH/);
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
    // Anchored: must declare `left:` and `top:`. Must NOT declare
    // `alignSelf: 'center'` (the previous centred sign).
    expect(block).toMatch(/left:\s*workoutSpacing/);
    expect(block).toMatch(/top:\s*workoutSpacing/);
    expect(block).not.toMatch(/alignSelf:\s*['"]center['"]/);
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

  test('player HP is computed via the pure combat module', () => {
    expect(text).toMatch(/from\s+['"]\.\.\/combat['"]/);
    expect(text).toMatch(/computePlayerHp/);
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
  const text = read(BATTLE);

  test('BattleScreen mounts the RestTimer component', () => {
    expect(text).toMatch(/<RestTimer\b/);
    expect(text).toMatch(/useRestTimer/);
  });

  test('offerWhenIdle only fires once the player has logged a set', () => {
    expect(text).toMatch(/offerWhenIdle=\{log\.length\s*>\s*0/);
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
