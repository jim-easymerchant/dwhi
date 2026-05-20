/**
 * Theme-pack architecture tests.
 *
 * Pure-data + grep-style regression. The component files
 * (SettingsScreen / ThemeCard / HomeScreen / BattleScreen) are
 * verified at compile time via `import type`; their runtime
 * behaviour is exercised by Jest only at the pure-data boundary
 * because the component bodies pull `react-native`.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import type { EnemyCategory } from '@dwhi/workout-domain';

import type { ThemeCard, ThemeCardProps } from '../components/ThemeCard';
import {
  ALL_THEME_IDS,
  FALLBACK_THEME_ID,
  THEME_REGISTRY,
  applyToneGates,
  comebackLine,
  enemyDefeatLine,
  failureLine,
  getTheme,
  ironQuestClassicTheme,
  listThemes,
  longAbsenceLine,
  momentumTheme,
  questStartLine,
  safeThemeId,
  type ThemeId,
  type ThemePack,
} from '../theme';
import type { SettingsScreen } from '../screens/SettingsScreen';
import { useWorkoutGameStore } from '../state/workoutGameStore';

// ===========================================================================
// 1. Registry validity
// ===========================================================================

describe('theme registry', () => {
  test('contains every documented theme id', () => {
    expect(ALL_THEME_IDS).toEqual(['momentum', 'ironquest-classic']);
    for (const id of ALL_THEME_IDS) {
      expect(THEME_REGISTRY[id]).toBeDefined();
      expect(THEME_REGISTRY[id].id).toBe(id);
    }
  });

  test('fallback id is in the registry', () => {
    expect(THEME_REGISTRY[FALLBACK_THEME_ID]).toBeDefined();
  });

  test('listThemes returns every registered theme in stable order', () => {
    const list = listThemes();
    expect(list.map((t) => t.id)).toEqual(ALL_THEME_IDS);
  });

  test('Momentum theme has anti-shame, quiet-mythic, hearth defaults', () => {
    expect(momentumTheme.id).toBe('momentum');
    expect(momentumTheme.tone).toBe('quiet-mythic');
    expect(momentumTheme.defaultCampStyle).toBe('hearth');
    expect(momentumTheme.motivational.style).toBe('anti-shame');
    expect(momentumTheme.narrationStyle.allowAllCaps).toBe(false);
    expect(momentumTheme.narrationStyle.allowExclamation).toBe(false);
  });

  test('Iron Quest Classic theme has arcade, tavern, taunting defaults', () => {
    expect(ironQuestClassicTheme.id).toBe('ironquest-classic');
    expect(ironQuestClassicTheme.tone).toBe('arcade-tavern');
    expect(ironQuestClassicTheme.defaultCampStyle).toBe('tavern');
    expect(ironQuestClassicTheme.motivational.style).toBe('arcade');
    expect(ironQuestClassicTheme.narrationStyle.allowAllCaps).toBe(true);
    expect(ironQuestClassicTheme.narrationStyle.allowExclamation).toBe(true);
  });

  test('each theme declares preferred sprite ids for every category', () => {
    const categories: readonly EnemyCategory[] = [
      'lesser_fragment',
      'hollow',
      'ward',
    ];
    for (const pack of listThemes()) {
      for (const c of categories) {
        expect(pack.preferredSpriteIds[c]).toBeDefined();
      }
    }
  });

  test('Momentum prefers Momentum-original sprites; Iron Quest Classic prefers IQ-derived', () => {
    expect(momentumTheme.preferredSpriteIds.lesser_fragment).toBe('fragment');
    expect(momentumTheme.preferredSpriteIds.hollow).toBe('hollow');
    expect(momentumTheme.preferredSpriteIds.ward).toBe('ward');
    expect(ironQuestClassicTheme.preferredSpriteIds.lesser_fragment).toBe(
      'ironquest-humanoid',
    );
    expect(ironQuestClassicTheme.preferredSpriteIds.hollow).toBe(
      'ironquest-beast',
    );
    expect(ironQuestClassicTheme.preferredSpriteIds.ward).toBe(
      'ironquest-construct',
    );
  });
});

// ===========================================================================
// 2. Fallback behaviour
// ===========================================================================

describe('getTheme / safeThemeId fallbacks', () => {
  test('known ids resolve to themselves', () => {
    expect(getTheme('momentum')).toBe(momentumTheme);
    expect(getTheme('ironquest-classic')).toBe(ironQuestClassicTheme);
  });

  test('unknown string falls back to Momentum', () => {
    expect(getTheme('does-not-exist')).toBe(momentumTheme);
    expect(safeThemeId('does-not-exist')).toBe('momentum');
  });

  test('non-string falls back to Momentum', () => {
    expect(getTheme(null)).toBe(momentumTheme);
    expect(getTheme(undefined)).toBe(momentumTheme);
    expect(getTheme(42)).toBe(momentumTheme);
    expect(getTheme({})).toBe(momentumTheme);
    expect(safeThemeId(null)).toBe('momentum');
    expect(safeThemeId(undefined)).toBe('momentum');
  });

  test('corrupted (mixed-case / whitespace) stored value falls back', () => {
    expect(safeThemeId('Momentum')).toBe('momentum'); // case-sensitive registry
    expect(safeThemeId(' momentum ')).toBe('momentum');
    expect(safeThemeId('')).toBe('momentum');
  });
});

// ===========================================================================
// 3. Tone gates — narration cannot exceed the theme's declared
//    loudness.
// ===========================================================================

describe('applyToneGates', () => {
  test('Momentum strips exclamation marks and demotes ALL CAPS runs', () => {
    // Each ALL-CAPS run of length ≥ 3 is title-cased independently
    // (so a multi-word shout no longer screams; single-word inputs
    // like 'USA' → 'Usa' rely on the same rule).
    expect(applyToneGates('THE TAVERN ROARS!', momentumTheme)).toBe(
      'The Tavern Roars.',
    );
    expect(applyToneGates('Good!', momentumTheme)).toBe('Good.');
  });

  test('Iron Quest Classic preserves both exclamation and ALL CAPS', () => {
    expect(applyToneGates('THE TAVERN ROARS!', ironQuestClassicTheme)).toBe(
      'THE TAVERN ROARS!',
    );
  });

  test('mixed-case acronyms ≤ 2 chars stay; ≥ 3 chars title-case', () => {
    expect(applyToneGates('OK', momentumTheme)).toBe('OK');
    expect(applyToneGates('USA', momentumTheme)).toBe('Usa');
  });
});

describe('narration hooks emit theme-appropriate copy', () => {
  test('Momentum onQuestStart is quiet', () => {
    const line = questStartLine(momentumTheme, { questId: 'q', tier: 'steady' });
    expect(line).toMatch(/^[A-Z][a-z]/); // sentence case
    expect(line).not.toMatch(/!/);
  });

  test('Iron Quest Classic onQuestStart is loud', () => {
    const line = questStartLine(ironQuestClassicTheme, { questId: 'q', tier: 'steady' });
    expect(line).toBe('THE TAVERN ROARS.');
  });

  test('Momentum onEnemyDefeat softens to "the room felt taller"', () => {
    const line = enemyDefeatLine(momentumTheme, {
      enemyName: 'Sluggard, Lord of Couches',
      enemyCategory: 'lesser_fragment',
      enemyMood: 'drift',
      defeatedPhaseCount: 1,
    });
    expect(line.toLowerCase()).toContain('room felt taller');
    expect(line).not.toMatch(/!/);
  });

  test('Iron Quest Classic onEnemyDefeat is theatrical', () => {
    const line = enemyDefeatLine(ironQuestClassicTheme, {
      enemyName: 'Sluggard, Lord of Couches',
      enemyCategory: 'lesser_fragment',
      enemyMood: 'drift',
      defeatedPhaseCount: 1,
    });
    expect(line).toContain('SLUGGARD');
  });

  test('comeback / failure / longAbsence hooks all return non-empty strings', () => {
    for (const theme of listThemes()) {
      expect(comebackLine(theme, { daysSinceLastQuest: 9, tier: 'steady' })).toBeTruthy();
      expect(failureLine(theme, { workingSetCount: 3, tier: 'steady' })).toBeTruthy();
      expect(longAbsenceLine(theme, { daysSinceLastQuest: 30 })).toBeTruthy();
    }
  });
});

// ===========================================================================
// 4. Store integration — setTheme, openSettings, hydration fallback
// ===========================================================================

describe('store — selectedThemeId + setTheme + openSettings', () => {
  beforeEach(() => {
    // Reset to a known state.
    useWorkoutGameStore.setState({
      selectedThemeId: 'momentum',
      phase: 'home',
    });
  });

  test('default selectedThemeId is momentum', () => {
    expect(useWorkoutGameStore.getState().selectedThemeId).toBe('momentum');
  });

  test('setTheme updates state for a known id', () => {
    useWorkoutGameStore.getState().setTheme('ironquest-classic');
    expect(useWorkoutGameStore.getState().selectedThemeId).toBe(
      'ironquest-classic',
    );
  });

  test('setTheme falls back to momentum on unknown id', () => {
    useWorkoutGameStore.getState().setTheme('not-a-theme');
    expect(useWorkoutGameStore.getState().selectedThemeId).toBe('momentum');
  });

  test('openSettings flips phase to settings', () => {
    useWorkoutGameStore.getState().openSettings();
    expect(useWorkoutGameStore.getState().phase).toBe('settings');
  });

  test('returnToCamp from settings goes back to home', () => {
    useWorkoutGameStore.setState({ phase: 'settings' });
    useWorkoutGameStore.getState().returnToCamp();
    expect(useWorkoutGameStore.getState().phase).toBe('home');
  });
});

// ===========================================================================
// 5. Memory-only mode supports themes
// ===========================================================================

describe('themes in memory-only persistence mode', () => {
  test('setTheme works even when persistence is disabled', () => {
    useWorkoutGameStore.setState({
      persistenceReady: true,
      persistenceDisabled: true,
      persistenceError: 'simulated',
      selectedThemeId: 'momentum',
    });
    useWorkoutGameStore.getState().setTheme('ironquest-classic');
    expect(useWorkoutGameStore.getState().selectedThemeId).toBe(
      'ironquest-classic',
    );
    // The persistence handler (if any) is fire-and-forget — the
    // store update has already taken effect.
  });
});

// ===========================================================================
// 6. Compile-time guards — Settings screen + ThemeCard export
// ===========================================================================

describe('component exports (compile-time)', () => {
  test('SettingsScreen + ThemeCard are exported with correct props', () => {
    type _Smoke = [
      typeof SettingsScreen,
      typeof ThemeCard,
      ThemeCardProps,
    ];
    const themeOk: ThemeCardProps = {
      theme: momentumTheme,
      selected: true,
      onSelect: () => undefined,
    };
    void themeOk;
    expect(true).toBe(true);
  });
});

// ===========================================================================
// 7. Regression — no runtime imports from reference/ironquest in any
//    theme / component / screen / state file.
// ===========================================================================

describe('theme layer — no forbidden imports', () => {
  const DIRS = [
    path.resolve(__dirname, '..', 'theme'),
    path.resolve(__dirname, '..', 'components'),
    path.resolve(__dirname, '..', 'screens'),
    path.resolve(__dirname, '..', 'state'),
  ];

  function walk(dir: string): string[] {
    const out: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
        out.push(path.join(dir, entry.name));
      }
    }
    return out;
  }

  const files = DIRS.flatMap(walk);

  test('discovered the theme / component / screen / state surface', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  test.each(files)(
    'no runtime imports of reference/ironquest, no Reanimated / Skia in %s',
    (file) => {
      const text = fs.readFileSync(file, 'utf8');
      expect(text).not.toMatch(/from\s+['"][^'"]*reference\/ironquest/);
      expect(text).not.toMatch(/require\(['"][^'"]*reference\/ironquest/);
      expect(text).not.toMatch(/from\s+['"]react-native-reanimated/);
      expect(text).not.toMatch(/from\s+['"]@shopify\/react-native-skia/);
    },
  );
});

// ===========================================================================
// Helper — make sure the union narrows cleanly.
// ===========================================================================

describe('ThemeId narrowing', () => {
  test('safeThemeId returns a ThemeId-compatible value', () => {
    const out: ThemeId = safeThemeId('ironquest-classic');
    expect(out).toBe('ironquest-classic');
  });

  test('every registry entry is a ThemePack', () => {
    for (const pack of listThemes()) {
      const t: ThemePack = pack;
      expect(typeof t.id).toBe('string');
      expect(typeof t.displayName).toBe('string');
      expect(typeof t.description).toBe('string');
      expect(typeof t.uiAccent.primary).toBe('string');
    }
  });
});
