/**
 * Theme-pack types for the Workout RPG.
 *
 * A *theme pack* is a typed declarative description of how the
 * Momentum engine should *present* itself for a player who has
 * opted into a particular presentation style. Shared mechanics
 * (combat math, momentum decay, persistence, the orchestrator)
 * are untouched by themes — themes only change the *surface*:
 *
 *   - sprite preferences        (which silhouette renders)
 *   - palette overrides         (camp lighting, accent colours)
 *   - narration tone            (warm / loud, all-caps allowed?)
 *   - enemy flavour copy        (intro line, name prefix)
 *   - UI accent + camp style    (hearth / tavern framing)
 *   - motivational tagline      (anti-shame / arcade)
 *
 * Design rule: a theme pack NEVER changes the underlying
 * combat / persistence / orchestrator contracts. If a feature
 * would diverge mechanically between themes, it doesn't belong in
 * a theme — it belongs in a separate setting, mode, or feature.
 *
 * See:
 *   docs/workout-rpg/018-theme-packs-and-settings.md
 *   docs/workout-rpg/015-ironquest-port-plan.md
 *   docs/workout-rpg/017-camp-scene-and-ironquest-sprites.md
 */

import type {
  EnemyCategory,
  EnemyMood,
  MomentumTier,
} from '@dwhi/workout-domain';

import type { SpriteId } from '../render';

// ---------------------------------------------------------------------------
// Identifier union
// ---------------------------------------------------------------------------

/**
 * The set of theme ids shipped today. New themes that land later
 * extend this union. The store treats unknown stored ids as the
 * fallback theme.
 */
export type ThemeId = 'momentum' | 'ironquest-classic';

// ---------------------------------------------------------------------------
// Sub-shapes
// ---------------------------------------------------------------------------

/**
 * Coarse-grained presentation tone. Drives UI affordances (e.g.
 * whether the Battle screen can shout, whether the Reward screen
 * uses exclamation marks).
 */
export type ThemeTone = 'quiet-mythic' | 'arcade-tavern';

/** Which Camp-scene styling the theme prefers. */
export type CampStyle = 'hearth' | 'tavern';

/**
 * Per-category sprite preferences. The runtime walks
 * `preferredSpriteIds[category]` — if the value is missing or
 * unknown, the renderer falls back to the Momentum default.
 */
export interface PreferredSpriteIds {
  lesser_fragment: SpriteId;
  hollow: SpriteId;
  ward: SpriteId;
}

/**
 * UI accent colours surfaced to buttons, banners, and HP bars.
 * `primary` is the main action colour; `danger` is the
 * enemy/HP-bar colour. Both are required.
 */
export interface ThemeUiAccent {
  primary: string;
  danger: string;
  textOnAccent: string;
}

/**
 * Optional Momentum-palette overrides. When unset, the theme
 * inherits the default tokens from `workoutColors.ts`.
 */
export interface ThemePaletteOverrides {
  ember?: string;
  hearth?: string;
  ash?: string;
  moss?: string;
  tideline?: string;
}

/**
 * Narration-tone metadata. The narration hook implementation
 * (`narration.ts`) consults these flags before composing a
 * line — themes can never shout louder than the metadata says.
 */
export interface ThemeNarrationStyle {
  /** Coarse tone. */
  tone: 'warm' | 'taunting';
  /** When false, narration must not use ALL-CAPS verbs. */
  allowAllCaps: boolean;
  /** When false, narration must not end on an exclamation mark. */
  allowExclamation: boolean;
  /** Identifier the voice-pack branch (post-MVP) will read. */
  voicePackId: string;
}

/** Default enemy flavour text + name prefix used at intro. */
export interface ThemeEnemyFlavor {
  /** Optional prefix to prepend to the enemy name when introduced. */
  namePrefix?: string;
  /** Default intro line shown when an encounter begins. */
  introCopy(enemyName: string): string;
}

/** Motivational style + tagline shown on the Home screen. */
export interface ThemeMotivational {
  style: 'anti-shame' | 'arcade';
  /** Short tagline displayed under the title on Home. */
  tagline: string;
}

// ---------------------------------------------------------------------------
// Narration hooks
// ---------------------------------------------------------------------------

/**
 * Per-event narration hooks. Themes declare these as plain
 * functions that map an event context to a single short line.
 *
 * NB: this branch ships the architecture only. The full announcer
 * system (rotating pools, deterministic picker, voice packs) is
 * deferred to a later branch — see
 * `docs/workout-rpg/018-theme-packs-and-settings.md`.
 */
export interface QuestStartContext {
  questId: string;
  tier: MomentumTier;
}
export interface EnemyDefeatContext {
  enemyName: string;
  enemyCategory: EnemyCategory;
  enemyMood: EnemyMood;
  defeatedPhaseCount: number;
}
export interface ComebackContext {
  daysSinceLastQuest: number;
  tier: MomentumTier;
}
export interface FailureContext {
  workingSetCount: number;
  tier: MomentumTier;
}
export interface LongAbsenceContext {
  daysSinceLastQuest: number;
}

export interface ThemeNarration {
  onQuestStart(ctx: QuestStartContext): string;
  onEnemyDefeat(ctx: EnemyDefeatContext): string;
  onComeback(ctx: ComebackContext): string;
  onFailure(ctx: FailureContext): string;
  onLongAbsence(ctx: LongAbsenceContext): string;
}

// ---------------------------------------------------------------------------
// The pack itself
// ---------------------------------------------------------------------------

export interface ThemePack {
  /** Stable id used in storage + the registry. */
  id: ThemeId;
  /** Short human-friendly name shown in the Settings panel. */
  displayName: string;
  /** A one-line description used on the theme card. */
  description: string;
  /** Coarse tone — drives UI affordance gates. */
  tone: ThemeTone;
  /** Which camp-scene styling to render. */
  defaultCampStyle: CampStyle;
  /** Per-category sprite preferences. */
  preferredSpriteIds: PreferredSpriteIds;
  /** Optional palette overrides; unset entries inherit defaults. */
  paletteOverrides?: ThemePaletteOverrides;
  /** UI accent colours. */
  uiAccent: ThemeUiAccent;
  /** Narration metadata. */
  narrationStyle: ThemeNarrationStyle;
  /** Per-theme narration hook implementations. */
  narration: ThemeNarration;
  /** Default enemy flavoring (intro copy + optional prefix). */
  enemyFlavor: ThemeEnemyFlavor;
  /** Motivational style + tagline. */
  motivational: ThemeMotivational;
}
