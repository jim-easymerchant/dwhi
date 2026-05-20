/**
 * apps/workout/src/theme
 *
 * Theme-pack system + canonical colour tokens.
 *
 * Two layers:
 *
 *   1. `workoutColors` etc. — the raw colour / spacing / radii /
 *      typography tokens shared by every theme. Themes can
 *      override individual entries but they all build on this
 *      base.
 *
 *   2. `momentumTheme` / `ironQuestClassicTheme` etc. — the typed
 *      `ThemePack` definitions that describe presentation choices
 *      (sprite preferences, narration tone, UI accent, motivational
 *      style). Routed through `getTheme(id)` with a safe
 *      Momentum fallback.
 *
 * See:
 *   docs/workout-rpg/018-theme-packs-and-settings.md
 */

export {
  workoutColors,
  workoutRadii,
  workoutSpacing,
  workoutType,
} from './workoutColors';

export {
  ALL_THEME_IDS,
  FALLBACK_THEME_ID,
  THEME_REGISTRY,
  getTheme,
  listThemes,
  safeThemeId,
} from './themeRegistry';

export { momentumTheme } from './momentumTheme';
export { ironQuestClassicTheme } from './ironQuestClassicTheme';

export {
  applyToneGates,
  comebackLine,
  enemyDefeatLine,
  failureLine,
  longAbsenceLine,
  questStartLine,
} from './narration';

export type {
  CampStyle,
  ComebackContext,
  EnemyDefeatContext,
  FailureContext,
  LongAbsenceContext,
  PreferredSpriteIds,
  QuestStartContext,
  ThemeEnemyFlavor,
  ThemeId,
  ThemeMotivational,
  ThemeNarration,
  ThemeNarrationStyle,
  ThemePack,
  ThemePaletteOverrides,
  ThemeTone,
  ThemeUiAccent,
} from './themeTypes';
