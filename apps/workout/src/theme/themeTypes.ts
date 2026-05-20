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
// Tavern / Home-screen flavour surface
// ---------------------------------------------------------------------------

/**
 * Text shown in the Tavern header strip (top-left of the home
 * screen). The same component renders both themes; only the
 * strings change.
 */
export interface ThemeHeaderCopy {
  /** Location name, e.g. "THE HOLLOW" / "THE WOUNDED GOBLIN". */
  title: string;
  /** Short subtitle under the title. */
  subtitle: string;
}

/** One row in the AmbientPanel ("Tonight's Patrons" / "Tonight in the Hollow"). */
export interface AmbientLine {
  /** Bold heading, e.g. "The Bartender" / "A quiet ember". */
  heading: string;
  /** Muted mood line under the heading. */
  mood: string;
}

/**
 * Theme-driven ambient flavour. The label is the section header
 * ("Tonight's Patrons" vs "Tonight in the Hollow"); the lines
 * function returns 2-4 short atmospheric blurbs. Pure
 * presentational — never affects mechanics.
 *
 * The function is passed the current Momentum tier so a theme can
 * vary its flavour as the Ember warms (e.g., Iron Quest Classic
 * Tavern fills up at higher tiers).
 */
export interface ThemeAmbient {
  /** Section label. */
  sectionLabel: string;
  /** Generator — return 2-4 ambient lines for the current tier. */
  lines(tier: MomentumTier): readonly AmbientLine[];
  /** One-line scene flavour shown inside the Tavern scene frame. */
  sceneFlavor(tier: MomentumTier): string;
}

/** Per-quest-card threat / flavour copy. */
export interface ThemeQuestCard {
  /** Section header above the cards. */
  sectionLabel: string;
  /**
   * One-line threat / framing for the named enemy. Drives the
   * "X is in the room" copy on each quest card.
   */
  threatLine(enemyName: string): string;
  /** Label for the bodyweight quest button. */
  bodyweightLabel: string;
  /** Label for the weighted quest button. */
  weightedLabel: string;
}

/** Labels for the lower expandable panels. */
export interface ThemePanelLabels {
  echoLog: string;
  weightLog: string;
  sessionHistory: string;
  /** Empty-state line used when no data has accrued yet. */
  emptyHint: string;
}

/** Footer line shown at the very bottom of Home. */
export interface ThemeFooter {
  /** Short reassurance/punchline line. */
  reassurance: string;
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
  /** Home-screen header copy (location title + subtitle). */
  headerCopy: ThemeHeaderCopy;
  /** Ambient flavour panel (section label + per-tier lines). */
  ambient: ThemeAmbient;
  /** Quest-selection card copy (section header, threat line, labels). */
  questCard: ThemeQuestCard;
  /** Labels for the lower expandable panels. */
  panelLabels: ThemePanelLabels;
  /** Footer reassurance line. */
  footer: ThemeFooter;
}
