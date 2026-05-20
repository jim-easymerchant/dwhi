/**
 * Narration entry points — typed hooks the rest of the app calls
 * to ask "what line should we render right now?" The answer is
 * always determined by the active theme pack.
 *
 * This branch ships the ARCHITECTURE only. There is no rotating
 * line-pool, no deterministic picker, no voice-pack tier — those
 * land in a later branch. For now each hook simply calls the
 * theme's matching function, returns the string, and lets the
 * theme decide how loud it wants to be.
 *
 * Why this lives behind hooks rather than inline string literals
 * in the screens: it lets a future voice-pack feature swap line
 * pools without touching any screen file, and it keeps the
 * narration-tone gates (allowAllCaps / allowExclamation) in one
 * inspectable place.
 *
 * See:
 *   docs/workout-rpg/018-theme-packs-and-settings.md
 *   docs/workout-rpg/012-battle-ux-and-feel.md (the Mythic Vow
 *     line library that informs Momentum's hooks)
 */

import type {
  ComebackContext,
  EnemyDefeatContext,
  FailureContext,
  LongAbsenceContext,
  QuestStartContext,
  ThemePack,
} from './themeTypes';

// ---------------------------------------------------------------------------
// Tone-gate helpers — defensive checks so a theme cannot
// accidentally violate its declared narrationStyle.
// ---------------------------------------------------------------------------

/**
 * Strip exclamation marks and lower-case shouted runs when the
 * theme has opted out of those affordances. Pure; no allocation
 * when the line already satisfies the gates.
 */
export function applyToneGates(
  line: string,
  theme: ThemePack,
): string {
  let out = line;
  if (!theme.narrationStyle.allowExclamation) {
    out = out.replace(/!/g, '.');
  }
  if (!theme.narrationStyle.allowAllCaps) {
    // Lower-case any 3+ char run of A-Z that's also a "word"
    // (preserves acronyms in mixed-case lines: "OK" stays "OK").
    out = out.replace(/\b[A-Z]{3,}\b/g, (m) => m[0] + m.slice(1).toLowerCase());
  }
  return out;
}

// ---------------------------------------------------------------------------
// Public hook surface — every screen calls these by name.
// ---------------------------------------------------------------------------

export function questStartLine(theme: ThemePack, ctx: QuestStartContext): string {
  return applyToneGates(theme.narration.onQuestStart(ctx), theme);
}

export function enemyDefeatLine(
  theme: ThemePack,
  ctx: EnemyDefeatContext,
): string {
  return applyToneGates(theme.narration.onEnemyDefeat(ctx), theme);
}

export function comebackLine(theme: ThemePack, ctx: ComebackContext): string {
  return applyToneGates(theme.narration.onComeback(ctx), theme);
}

export function failureLine(theme: ThemePack, ctx: FailureContext): string {
  return applyToneGates(theme.narration.onFailure(ctx), theme);
}

export function longAbsenceLine(
  theme: ThemePack,
  ctx: LongAbsenceContext,
): string {
  return applyToneGates(theme.narration.onLongAbsence(ctx), theme);
}
