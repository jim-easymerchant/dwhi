/**
 * World-state vocabulary.
 *
 * The world layer answers one question: "what does the room
 * feel like tonight?" It is *purely presentational* — no
 * mechanics, no XP, no rewards, no persistence. Same input
 * (themeId, tier, daysSinceLastQuest, daySeed) always produces
 * the same output.
 *
 * The whole layer is deterministic on purpose: the player should
 * see the same patrons / weather / hearth state for the whole day,
 * and a fresh roster the next day. Identical to Iron Quest's
 * day-seeded approach, but the *content* is reimagined as
 * coaching / emotional archetypes instead of DCC stand-ins.
 *
 * See:
 *   docs/workout-rpg/020-world-state-and-patrons.md
 *   reference/ironquest/src/data/npcs.js (concept source, NOT
 *     imported — copy stays in this codebase)
 */

import type { MomentumTier } from '@dwhi/workout-domain';

import type { ThemeId } from '../theme';

// ---------------------------------------------------------------------------
// Patron archetypes
// ---------------------------------------------------------------------------

/**
 * The coaching / emotional archetypes a patron can embody. These
 * are stable across themes — themes only change how each
 * archetype *speaks*, not who is in the room.
 *
 * Anti-shame note: every archetype below is allowed to apply
 * *pressure* (challenge, witness, observation). None of them is
 * allowed to wield *cruelty* (mockery, identity attack, body
 * commentary). See the test suite's regression grep.
 */
export type PatronArchetype =
  | 'spotter'           // safety-with-effort coaching
  | 'quietRunner'       // pace / endurance philosophy
  | 'hearthkeeper'      // tends the room, warm presence
  | 'archivist'         // remembers effort kindly
  | 'challenger'        // pushes — never shames
  | 'cook'              // provisioning / fuel without policing
  | 'nightJanitor'      // humble, observes, sweeps
  | 'traveler'          // returns from elsewhere with perspective
  | 'oneWhoStretches'   // mobility / patient careful presence
  | 'oldSoldier'        // recovery wisdom; knows when to stop
  | 'newcomer';         // mirrors the player's first steps

/** Tone bucket — only used to log "this line sounds like X". */
export type PatronTone = 'quiet' | 'steady' | 'warm' | 'wry' | 'firm';

/**
 * One patron entry in the roster. Dialogue is themed; the
 * identity (id, title, archetype, philosophy) is shared.
 */
export interface Patron {
  /** Stable id used in tests + future persistence (e.g. greeting
   *  the player by name on return). */
  id: string;
  /** Short label, e.g. "The Spotter" / "The Hearthkeeper". */
  title: string;
  archetype: PatronArchetype;
  /** One-line description of why this archetype is in the room. */
  philosophy: string;
  /**
   * Per-theme dialogue pools. The world generator picks one line
   * from the active theme's pool, seeded by the day. Every theme
   * is required to have at least 2 lines so the player sees
   * variety across days.
   */
  dialoguePools: Readonly<Record<ThemeId, readonly string[]>>;
  /**
   * Optional cap on appearance frequency — e.g. the Challenger
   * only shows up on certain energy levels. Defaults to "any".
   */
  appearsWhen?: PatronAppearanceFilter;
  /** Default tone label for this patron's lines. */
  tone: PatronTone;
}

export interface PatronAppearanceFilter {
  /** Patron only appears when room energy is at least this level. */
  minEnergy?: RoomEnergy;
  /** Patron only appears when room energy is at most this level. */
  maxEnergy?: RoomEnergy;
  /** Patron only appears when the Ember is at this tier or warmer. */
  minTier?: MomentumTier;
}

// ---------------------------------------------------------------------------
// World-state primitives
// ---------------------------------------------------------------------------

/**
 * Coarse time-of-day. We do NOT read the device clock — the
 * value is derived from `daySeed` so the room feels consistent
 * for whoever opens the app today. (A future branch may switch
 * to wall-clock time; the type stays.)
 */
export type TimeOfDay = 'dusk' | 'evening' | 'lateNight' | 'predawn';

/** How alive the hearth feels — a presentational mirror of tier. */
export type HearthState =
  | 'cold'    // tier rusted, low days-since
  | 'low'     // tier rusted, recent activity
  | 'warm'    // tier steady
  | 'bright'  // tier driven / relentless
  | 'roaring'; // tier ascendant

/** How busy / quiet the room feels tonight. */
export type RoomEnergy = 'quiet' | 'settled' | 'lively' | 'crowded';

/**
 * Implied weather outside the room. Theme drives the *phrasing*;
 * the bucket is shared so tests can pin the variety distribution.
 */
export type Weather = 'rain' | 'wind' | 'still' | 'snow' | 'fog' | 'clear';

// ---------------------------------------------------------------------------
// Per-theme world-state metadata
// ---------------------------------------------------------------------------

/**
 * Sub-shape on `ThemePack` that controls how the world generator
 * presents itself in this theme.
 */
export interface ThemeWorldState {
  /** Section label for the patrons panel. */
  patronSectionLabel: string;
  /**
   * Ambient density — biases the patron count + the number of
   * observations the generator emits.
   *
   *   sparse  → 2 patrons,   2 observations
   *   medium  → 3 patrons,   3 observations
   *   dense   → 4 patrons,   3 observations  (cap at 4 — anything
   *             more clutters the screen on small phones)
   */
  ambientDensity: 'sparse' | 'medium' | 'dense';
  /**
   * Biases the room-energy roll. Quiet themes step `crowded` →
   * `lively` etc.; loud themes step `quiet` → `settled` etc.
   * Range -1..+1; 0 = neutral.
   */
  tavernEnergyBias: number;
  /**
   * Per-bucket weather copy. Each theme provides one short
   * sentence per Weather bucket; the generator picks the bucket,
   * the theme picks the words.
   */
  weatherCopy: Readonly<Record<Weather, string>>;
}

// ---------------------------------------------------------------------------
// World-state output
// ---------------------------------------------------------------------------

/**
 * One patron's presence tonight: the patron object + the line
 * they're delivering for this seed.
 */
export interface PatronPresence {
  patron: Patron;
  /** Dialogue line for tonight — drawn from the active theme's pool. */
  line: string;
}

/**
 * A single short atmospheric observation ("Rain taps softly
 * against the stone." / "The kettle still steams near the
 * fire."). Pure flavour.
 */
export interface AmbientObservation {
  /** Stable id used in tests to assert deterministic output. */
  id: string;
  /** Short sentence rendered as italicised muted text. */
  text: string;
}

/**
 * Full description of "what the room feels like tonight."
 */
export interface WorldNight {
  /** Section label drawn from `ThemePack.worldState.patronSectionLabel`. */
  patronSectionLabel: string;
  /** Patrons in the room tonight, 2-4 deep. */
  patrons: readonly PatronPresence[];
  /** Atmospheric observations, 2-3 deep. */
  observations: readonly AmbientObservation[];
  /** Bucketed time-of-day for any consumer that cares. */
  timeOfDay: TimeOfDay;
  /** Mood-light bucket for the hearth. */
  hearthState: HearthState;
  /** Crowding bucket. */
  roomEnergy: RoomEnergy;
  /** Weather bucket. */
  weather: Weather;
  /** Pre-rendered weather sentence for the scene flavour line. */
  weatherLine: string;
  /**
   * Recent-activity hint. Empty string when there is no
   * meaningful activity to report. NEVER references absence —
   * the world layer is not allowed to count missed days.
   */
  activityHint: string;
}

// ---------------------------------------------------------------------------
// Input shape — the only public way to call the generator.
// ---------------------------------------------------------------------------

export interface GenerateWorldInput {
  themeId: unknown;
  tier: MomentumTier;
  daysSinceLastQuest: number;
  /**
   * Stable seed; defaults to a calendar-day seed when omitted.
   * Tests pass an explicit number so output is fully pinned.
   */
  daySeed?: number;
}
