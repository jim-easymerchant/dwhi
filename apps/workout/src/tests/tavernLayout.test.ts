/**
 * Tavern-home-layout tests.
 *
 * The components under test live in
 * `apps/workout/src/components/tavern/`. Like the rest of the
 * Workout tests, we do NOT runtime-import the .tsx files (they
 * pull `react-native`, which the Node Jest env has no bridge for).
 * Instead we exercise:
 *
 *   1. Type-only smoke (`import type`) — guarantees every public
 *      symbol exists at compile time. Missing exports fail
 *      `tsc --noEmit`.
 *   2. Pure-data theme assertions — the `headerCopy`, `ambient`,
 *      `questCard`, `panelLabels`, and `footer` sub-shapes return
 *      tone-appropriate values for every theme.
 *   3. `getAmbientLines` / `getAmbientSceneFlavor` / fallback
 *      behaviour for unknown ids.
 *   4. Grep-style anti-shame regression: neither theme's ambient
 *      panel nor footer references "missed", "skipped", "fail",
 *      or "lazy".
 *   5. Content boundary: HomeScreen does NOT inline raw quest /
 *      ambient strings — they must route through the theme pack
 *      (so a future theme addition can override them).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import type {
  AmbientLine,
  ThemeAmbient,
  ThemeFooter,
  ThemeHeaderCopy,
  ThemePanelLabels,
  ThemeQuestCard,
} from '../theme';
import {
  getAmbientLines,
  getAmbientSceneFlavor,
  getAmbientSectionLabel,
  getTheme,
  ironQuestClassicTheme,
  listThemes,
  momentumTheme,
} from '../theme';
import type {
  AmbientPanel,
  EchoLogPanel,
  QuestCard,
  QuestSelectionPanel,
  TavernFooterActions,
  TavernHeader,
  TavernSceneFrame,
  TavernStatusRow,
} from '../components/tavern';
import type { HomeScreen } from '../screens/HomeScreen';

// ===========================================================================
// 1. Type-only smoke — every export still exists.
// ===========================================================================

describe('Tavern components — exports exist (compile-time guard)', () => {
  test('each tavern component is exported from the barrel', () => {
    type _Smoke = [
      typeof TavernHeader,
      typeof TavernSceneFrame,
      typeof TavernStatusRow,
      typeof AmbientPanel,
      typeof QuestCard,
      typeof QuestSelectionPanel,
      typeof EchoLogPanel,
      typeof TavernFooterActions,
      typeof HomeScreen,
    ];
    expect(true).toBe(true);
  });
});

// ===========================================================================
// 2. Pure-data theme assertions.
// ===========================================================================

describe('ThemePack tavern surface — Momentum', () => {
  test('headerCopy is quiet-mythic', () => {
    const h: ThemeHeaderCopy = momentumTheme.headerCopy;
    expect(h.title).toBe('The Hollow');
    expect(h.subtitle).toMatch(/Stillness|edge|quiet|camp/i);
    // No shouting in the quiet theme.
    expect(h.title).not.toMatch(/!/);
    expect(h.subtitle).not.toMatch(/!/);
  });

  test('ambient section + lines vary by tier and stay quiet', () => {
    const a: ThemeAmbient = momentumTheme.ambient;
    expect(a.sectionLabel).toMatch(/Hollow/);
    for (const tier of ['rusted', 'steady', 'ascendant'] as const) {
      const lines: readonly AmbientLine[] = a.lines(tier);
      expect(lines.length).toBeGreaterThanOrEqual(2);
      expect(lines.length).toBeLessThanOrEqual(6);
      for (const line of lines) {
        expect(line.heading.length).toBeGreaterThan(0);
        expect(line.mood.length).toBeGreaterThan(0);
        expect(line.heading).not.toMatch(/!/);
        expect(line.mood).not.toMatch(/!/);
      }
    }
  });

  test('questCard copy is sentence-case and non-shouty', () => {
    const q: ThemeQuestCard = momentumTheme.questCard;
    expect(q.sectionLabel).not.toMatch(/!/);
    expect(q.bodyweightLabel).toMatch(/Bodyweight/);
    expect(q.weightedLabel).toMatch(/Weighted/);
    expect(q.threatLine('Sluggard, Lord of Couches')).toContain('Sluggard');
    expect(q.threatLine('Sluggard, Lord of Couches')).not.toMatch(/!/);
  });

  test('panelLabels exist for all three lower panels', () => {
    const p: ThemePanelLabels = momentumTheme.panelLabels;
    expect(p.echoLog.length).toBeGreaterThan(0);
    expect(p.weightLog.length).toBeGreaterThan(0);
    expect(p.sessionHistory.length).toBeGreaterThan(0);
    expect(p.emptyHint.length).toBeGreaterThan(0);
  });

  test('footer reassurance is anti-shame', () => {
    const f: ThemeFooter = momentumTheme.footer;
    expect(f.reassurance).not.toMatch(/!/);
    expect(f.reassurance.toLowerCase()).not.toMatch(/lazy|skip|miss|fail/);
  });
});

describe('ThemePack tavern surface — Iron Quest Classic', () => {
  test('headerCopy uses tavern shouting', () => {
    const h: ThemeHeaderCopy = ironQuestClassicTheme.headerCopy;
    expect(h.title).toBe('THE WOUNDED GOBLIN');
    expect(h.subtitle.length).toBeGreaterThan(0);
  });

  test('ambient lines + section label use tavern voice', () => {
    const a: ThemeAmbient = ironQuestClassicTheme.ambient;
    expect(a.sectionLabel).toMatch(/PATRONS|TAVERN|GOBLIN/i);
    for (const tier of ['rusted', 'steady', 'ascendant'] as const) {
      const lines = a.lines(tier);
      expect(lines.length).toBeGreaterThanOrEqual(2);
      // Tavern populates with more bodies as the Ember warms.
      if (tier === 'ascendant') {
        expect(lines.length).toBeGreaterThanOrEqual(
          ironQuestClassicTheme.ambient.lines('rusted').length,
        );
      }
    }
  });

  test('questCard uses arcade SHOUT labels', () => {
    const q: ThemeQuestCard = ironQuestClassicTheme.questCard;
    expect(q.sectionLabel).toMatch(/FATE|SESSION|CHOOSE/);
    expect(q.bodyweightLabel.toUpperCase()).toBe(q.bodyweightLabel);
    expect(q.weightedLabel.toUpperCase()).toBe(q.weightedLabel);
  });

  test('panelLabels use Iron Quest journal language', () => {
    const p: ThemePanelLabels = ironQuestClassicTheme.panelLabels;
    expect(p.echoLog).toMatch(/KILL LOG/);
    expect(p.weightLog).toMatch(/WEIGHT LOG/);
    expect(p.sessionHistory).toMatch(/SESSION HISTORY/);
  });

  test('footer reassurance stays anti-shame even at arcade volume', () => {
    const f: ThemeFooter = ironQuestClassicTheme.footer;
    expect(f.reassurance.toLowerCase()).not.toMatch(/lazy|skipped|missed/);
    // Dark humour is allowed — the line must still affirm showing up.
    expect(f.reassurance.toLowerCase()).toMatch(/show up|rule|whole|minimum/);
  });
});

// ===========================================================================
// 3. Ambient helper + fallbacks
// ===========================================================================

describe('getAmbientLines / getAmbientSceneFlavor', () => {
  test('known theme returns its own lines', () => {
    const m = getAmbientLines('momentum', 'steady');
    const iq = getAmbientLines('ironquest-classic', 'steady');
    expect(m).not.toBe(iq);
    expect(m.length).toBeGreaterThan(0);
    expect(iq.length).toBeGreaterThan(0);
  });

  test('unknown theme falls back to Momentum lines', () => {
    const m = getAmbientLines('momentum', 'steady');
    const fallback = getAmbientLines('not-a-theme', 'steady');
    expect(fallback).toEqual(m);
  });

  test('non-string id falls back to Momentum', () => {
    expect(getAmbientLines(undefined, 'steady')).toEqual(
      getAmbientLines('momentum', 'steady'),
    );
    expect(getAmbientLines(null, 'steady')).toEqual(
      getAmbientLines('momentum', 'steady'),
    );
    expect(getAmbientLines(42, 'steady')).toEqual(
      getAmbientLines('momentum', 'steady'),
    );
  });

  test('sceneFlavor is a non-empty string for every theme + tier', () => {
    for (const theme of listThemes()) {
      for (const tier of ['rusted', 'steady', 'ascendant'] as const) {
        const flavor = getAmbientSceneFlavor(theme.id, tier);
        expect(typeof flavor).toBe('string');
        expect(flavor.length).toBeGreaterThan(0);
      }
    }
  });

  test('sectionLabel routes through getTheme', () => {
    expect(getAmbientSectionLabel('momentum')).toBe(
      getTheme('momentum').ambient.sectionLabel,
    );
    expect(getAmbientSectionLabel('ironquest-classic')).toBe(
      getTheme('ironquest-classic').ambient.sectionLabel,
    );
  });
});

// ===========================================================================
// 4. Anti-shame / tone regression — applies to BOTH themes.
// ===========================================================================

describe('anti-shame regression — every theme tavern surface', () => {
  // Build the full grep corpus once per theme.
  const tiers = ['rusted', 'steady', 'ascendant'] as const;

  function corpusFor(themeId: string): string {
    const theme = getTheme(themeId);
    const parts: string[] = [
      theme.headerCopy.title,
      theme.headerCopy.subtitle,
      theme.ambient.sectionLabel,
      theme.questCard.sectionLabel,
      theme.questCard.bodyweightLabel,
      theme.questCard.weightedLabel,
      theme.questCard.threatLine('Sluggard, Lord of Couches'),
      theme.panelLabels.echoLog,
      theme.panelLabels.weightLog,
      theme.panelLabels.sessionHistory,
      theme.panelLabels.emptyHint,
      theme.footer.reassurance,
    ];
    for (const tier of tiers) {
      parts.push(theme.ambient.sceneFlavor(tier));
      for (const line of theme.ambient.lines(tier)) {
        parts.push(line.heading, line.mood);
      }
    }
    return parts.join('\n').toLowerCase();
  }

  const SHAMING_WORDS = [
    /\blazy\b/,
    /\bskipped\b/,
    /\bmissed (it|workouts|days)\b/,
    /\bfailed (you|us|me)\b/,
    /\bweak\b/,
    /\bquitter\b/,
    /\bdisappointed\b/,
    /\bdiet\b/,
    /\bcalorie/,
    /\bbmi\b/,
    /\bfat\b/,
  ];

  for (const themeId of ['momentum', 'ironquest-classic'] as const) {
    test(`${themeId} has no shaming vocabulary anywhere on the home surface`, () => {
      const corpus = corpusFor(themeId);
      for (const re of SHAMING_WORDS) {
        expect(corpus).not.toMatch(re);
      }
    });
  }
});

// ===========================================================================
// 5. Layout boundary — HomeScreen does NOT inline Iron Quest strings.
// ===========================================================================

describe('HomeScreen content boundary', () => {
  const HOME_FILE = path.resolve(
    __dirname,
    '..',
    'screens',
    'HomeScreen.tsx',
  );
  const text = fs.readFileSync(HOME_FILE, 'utf8');

  test('HomeScreen does not inline tavern flavour copy (must route through theme)', () => {
    // Specific strings that belong to a theme — they must come from
    // `theme.*`, never be hardcoded in the screen.
    const FORBIDDEN_LITERALS = [
      'THE WOUNDED GOBLIN',
      "TONIGHT'S PATRONS",
      'Tonight in the Hollow',
      'KILL LOG',
      'CHOOSE YOUR FATE',
      "Minimum viable dungeon run",
    ];
    for (const lit of FORBIDDEN_LITERALS) {
      expect(text).not.toContain(lit);
    }
  });

  test('HomeScreen composes tavern components, not raw layout primitives for sections', () => {
    // We expect tavern barrel imports.
    expect(text).toMatch(/from\s+['"][^'"]*components\/tavern['"]/);
    // The tavern component names that the HomeScreen composes
    // should each appear at least once. (`TavernHeader` is no
    // longer composed here — the product-parity branch absorbed
    // the gear button + theme sign into `TavernSceneFrame` to
    // free the header strip for the full-bleed scene.)
    for (const name of [
      'TavernSceneFrame',
      'TavernStatusRow',
      'AmbientPanel',
      'QuestSelectionPanel',
      'EchoLogPanel',
      'TavernFooterActions',
    ]) {
      expect(text).toContain(name);
    }
  });

  test('HomeScreen still imports getTheme for theme resolution', () => {
    expect(text).toMatch(/\bgetTheme\b/);
  });
});
