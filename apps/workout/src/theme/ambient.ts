/**
 * Ambient flavour generators.
 *
 * Thin wrappers around each `ThemePack.ambient` block — the runtime
 * always routes through these helpers rather than reaching into the
 * theme pack directly. This keeps the call site (the tavern
 * AmbientPanel + the SceneFrame flavour strip) decoupled from the
 * theme's internal shape, so a future theme can ship richer
 * generators without changing the panel.
 *
 * Pure presentational: never affects mechanics.
 */

import type { MomentumTier } from '@dwhi/workout-domain';

import { getTheme } from './themeRegistry';
import type { AmbientLine } from './themeTypes';

/**
 * Return the ambient lines the panel should render for the given
 * theme + momentum tier. Falls back to Momentum lines when the id
 * is unknown.
 */
export function getAmbientLines(
  themeId: unknown,
  tier: MomentumTier,
): readonly AmbientLine[] {
  return getTheme(themeId).ambient.lines(tier);
}

/**
 * Return the one-line scene flavour shown inside the scene frame
 * ("The fire crackles. Mugs clink." / "Warm light spills..."). The
 * theme can vary the copy by tier; the panel never reaches into
 * the registry directly.
 */
export function getAmbientSceneFlavor(
  themeId: unknown,
  tier: MomentumTier,
): string {
  return getTheme(themeId).ambient.sceneFlavor(tier);
}

/**
 * Section label rendered above the ambient panel ("Tonight in the
 * Hollow" / "TONIGHT'S PATRONS"). Theme-driven.
 */
export function getAmbientSectionLabel(themeId: unknown): string {
  return getTheme(themeId).ambient.sectionLabel;
}
