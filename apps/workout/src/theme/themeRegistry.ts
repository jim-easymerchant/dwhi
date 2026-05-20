/**
 * Theme-pack registry.
 *
 * Source of truth for every shipped theme. Code that resolves a
 * theme from an id (the store, the screens, the bridge) routes
 * through `getTheme(id)` which guarantees a safe fallback when
 * the id is unknown or corrupted.
 */

import { ironQuestClassicTheme } from './ironQuestClassicTheme';
import { momentumTheme } from './momentumTheme';
import type { ThemeId, ThemePack } from './themeTypes';

/** Read-only map of every shipped theme. */
export const THEME_REGISTRY: Readonly<Record<ThemeId, ThemePack>> = {
  momentum: momentumTheme,
  'ironquest-classic': ironQuestClassicTheme,
} as const;

/** Stable list of theme ids in display order. */
export const ALL_THEME_IDS: readonly ThemeId[] = [
  'momentum',
  'ironquest-classic',
] as const;

/** The fallback theme — selected when an id is missing/unknown. */
export const FALLBACK_THEME_ID: ThemeId = 'momentum';

/**
 * Resolve a theme by id. Falls back to Momentum on any value that
 * is not a registered theme id. Pure — same input, same output.
 */
export function getTheme(id: unknown): ThemePack {
  if (typeof id !== 'string') return THEME_REGISTRY[FALLBACK_THEME_ID];
  if (Object.prototype.hasOwnProperty.call(THEME_REGISTRY, id)) {
    return THEME_REGISTRY[id as ThemeId];
  }
  return THEME_REGISTRY[FALLBACK_THEME_ID];
}

/**
 * Type-narrow an arbitrary value to a ThemeId. Returns the
 * fallback when the value is anything other than a registered id.
 */
export function safeThemeId(id: unknown): ThemeId {
  if (typeof id !== 'string') return FALLBACK_THEME_ID;
  return Object.prototype.hasOwnProperty.call(THEME_REGISTRY, id)
    ? (id as ThemeId)
    : FALLBACK_THEME_ID;
}

/** Every theme as an array, for iteration in tests + the
 *  Settings panel. */
export function listThemes(): readonly ThemePack[] {
  return ALL_THEME_IDS.map((id) => THEME_REGISTRY[id]);
}
