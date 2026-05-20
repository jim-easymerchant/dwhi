/**
 * Player HP — readiness / capacity / recovery, NOT body mass.
 *
 * Design intent
 * =============
 *
 * Enemy HP and Player HP are the two halves of the battle screen's
 * "you vs. resistance" framing. Their meanings are deliberately
 * different:
 *
 *   - Enemy HP   = the resistance / endurance of the encounter.
 *   - Player HP  = the readiness / capacity the player walks in
 *                  with. It is a *positive* number that grows as
 *                  the player builds consistency, momentum, and
 *                  cumulative training history.
 *
 * Design rules (non-negotiable, see brief)
 * ========================================
 *
 *   - **No punishment mechanics.** Player HP never decays during a
 *     session, never punishes missed days, never goes negative.
 *   - **No body-weight tie-in.** Body mass is an honest input to
 *     the orchestrator's damage math; it is NOT a measure of
 *     "how much HP a person has." This module deliberately
 *     ignores `bodyweightKg`.
 *   - **Monotonic positive progression.** Consistency, momentum
 *     and level only *add* to player HP. Two callers with the
 *     same inputs ALWAYS get the same HP — pure function.
 *   - **Readable scaling.** A new player on day one starts at
 *     `BASE_PLAYER_HP` (100). Sustained progress visibly grows
 *     the bar without exploding.
 *
 * v1 formula
 * ==========
 *
 *   readiness = 100
 *             + recentSessions * RECENT_SESSION_BONUS    // up to a cap
 *             + level * LEVEL_BONUS
 *             + clampedMomentum * MOMENTUM_BONUS         // momentum 0..100
 *
 *   where:
 *     RECENT_SESSION_BONUS  = 3       (cap at MAX_RECENT_SESSIONS = 14)
 *     LEVEL_BONUS           = 4
 *     MOMENTUM_BONUS        = 0.2     (so momentum 100 → +20 HP)
 *
 * Round numbers for intuition (with BASE = 100):
 *   - Day 1, L1, momentum 25, 0 recent sessions  →  ~109 HP
 *   - One-week-in, L3, momentum 30, 3 recent     →  ~127 HP
 *   - First month, L7, momentum 45, 8 recent     →  ~161 HP
 *   - Year one, L30, momentum 70, 14 recent      →  ~276 HP
 *
 * Pure. No I/O. No side effects.
 *
 * See: docs/workout-rpg/023-ui-polish-hp-and-timers.md
 */

// ---------------------------------------------------------------------------
// Tunable constants — exported so the test suite can pin them.
// ---------------------------------------------------------------------------

/** HP every player walks in with on day one. */
export const BASE_PLAYER_HP = 100;

/** HP added per logged session in the recent window. */
export const RECENT_SESSION_BONUS = 3;

/** Cap on `recentSessions` — beyond this, more sessions do not
 *  add HP. Prevents "grind 100 sessions for an absurd bar." */
export const MAX_RECENT_SESSIONS = 14;

/** HP added per displayed player level. */
export const LEVEL_BONUS = 4;

/** HP added per unit of momentum (momentum is 0..100). */
export const MOMENTUM_BONUS = 0.2;

// ---------------------------------------------------------------------------
// Input + output types
// ---------------------------------------------------------------------------

/**
 * Inputs to `computePlayerHp`. Every field is required so the
 * function is total — callers cannot accidentally pass `undefined`
 * for a value that would silently zero out a bonus.
 */
export interface PlayerHpInputs {
  /**
   * Number of completed quests within a recent window (the
   * caller decides "recent" — typically the last 14 days). This
   * tracks **consistency**, not history.
   */
  recentSessions: number;
  /** Displayed player level (from `levelForCumulativeXp`). */
  level: number;
  /** Current momentum value (0..100, clamped here). */
  momentum: number;
}

/**
 * Breakdown of how each input contributed to the final HP. UIs
 * can render this for a "what's making my HP what it is?" tooltip;
 * tests assert each contribution independently.
 */
export interface PlayerHpBreakdown {
  base: number;
  fromRecentSessions: number;
  fromLevel: number;
  fromMomentum: number;
  /** Sum of base + the three positive contributions. */
  total: number;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

function safeNumber(value: unknown, fallback = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return value;
}

/**
 * Pure function returning the player's current "readiness" HP and
 * a breakdown of how it was assembled.
 *
 * Behaviour:
 *   - Inputs are clamped to non-negative finite numbers; negative
 *     / non-finite inputs contribute zero (never reduce HP).
 *   - `recentSessions` is capped at `MAX_RECENT_SESSIONS` to avoid
 *     a runaway bar for unusually intense weeks.
 *   - `momentum` is clamped to `[0, 100]` — values outside that
 *     range are folded back inside.
 *   - All four contributions are rounded to integers before
 *     summing, so the displayed HP value is an integer.
 */
export function computePlayerHp(
  inputs: PlayerHpInputs,
): PlayerHpBreakdown {
  const recent = Math.max(
    0,
    Math.min(MAX_RECENT_SESSIONS, Math.floor(safeNumber(inputs.recentSessions, 0))),
  );
  const level = Math.max(1, Math.floor(safeNumber(inputs.level, 1)));
  const momentum = Math.max(0, Math.min(100, safeNumber(inputs.momentum, 0)));

  const fromRecentSessions = Math.round(recent * RECENT_SESSION_BONUS);
  const fromLevel = Math.round(level * LEVEL_BONUS);
  const fromMomentum = Math.round(momentum * MOMENTUM_BONUS);

  const total =
    BASE_PLAYER_HP + fromRecentSessions + fromLevel + fromMomentum;

  return {
    base: BASE_PLAYER_HP,
    fromRecentSessions,
    fromLevel,
    fromMomentum,
    total,
  };
}

/**
 * Convenience helper — just the integer total. Useful when the
 * caller (e.g. the BattleScreen) only needs the HP value to feed
 * into a progress bar.
 */
export function playerHpFromInputs(inputs: PlayerHpInputs): number {
  return computePlayerHp(inputs).total;
}
