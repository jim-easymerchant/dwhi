/**
 * Level curve — cumulative XP → displayed player level.
 *
 * Why this module exists:
 *
 *   The first build shipped the home screen's LEVEL card showing
 *   `Math.round(priorMomentum)`. That meant a player who hit the
 *   relentless tier (momentum ≈ 80) saw "LEVEL 80"; three
 *   workouts could put a fresh player at "LEVEL 30" purely
 *   because momentum gains compound quickly across return-bonus
 *   nights.
 *
 *   The displayed level should be a **history** metric, not a
 *   tier mirror. This module derives the level from cumulative
 *   quest XP — which only grows when the player actually
 *   completes work. Momentum stays where it belongs: the Ember
 *   bar at the footer.
 *
 * Curve choice (rebalanced in branch 023 after device feedback that
 * "L5 after one gym visit is excessive"):
 *
 *   `xpForLevel(N) = floor(100 * (N - 1) ^ 1.7)`
 *
 *   Anchors (assuming a typical workout earns ~150-250 XP):
 *     - L2  ≈     100 XP → reachable by the first workout, never
 *                          jumped past (a beefy 200 XP workout
 *                          still only lands at L2, not L3).
 *     - L3  ≈     324 XP → reachable after the first week's
 *                          consistency (~3 sessions).
 *     - L4  ≈     647 XP
 *     - L5  ≈   1,055 XP
 *     - L8  ≈   2,733 XP → "first month" target (~12 sessions).
 *     - L10 ≈   4,189 XP
 *     - L15 ≈   8,880 XP → "3 months consistent" target.
 *     - L20 ≈  14,923 XP
 *     - L30 ≈  30,625 XP → "1 year of consistency" target.
 *     - L50 ≈  74,702 XP
 *
 *   The curve is monotonically increasing, deterministic, and
 *   has no hard cap. No decay, no punishment systems — LEVEL is
 *   long-term identity, not short-term emotional state (that's
 *   what Momentum/Ember does).
 *
 * Pure. No I/O. No state. Same input → same output.
 *
 * See:
 *   docs/workout-rpg/023-ui-polish-hp-and-timers.md (rebalance)
 *   docs/workout-rpg/020-world-state-and-patrons.md (prior round)
 */

/** Lowest level value the curve can return. */
export const MIN_LEVEL = 1;

/** Curve base — the multiplier in front of `(N-1) ^ EXPONENT`. */
export const LEVEL_CURVE_BASE = 100;

/** Curve exponent — controls how fast XP requirements grow. */
export const LEVEL_CURVE_EXPONENT = 1.7;

/**
 * Cumulative XP threshold for `level`. Pure.
 *
 *   xpForLevel(1) = 0
 *   xpForLevel(2) = 30
 *   xpForLevel(N) = floor(30 * (N - 1) ^ 1.4)
 *
 * Negative / non-finite / sub-1 inputs return 0.
 */
export function xpForLevel(level: number): number {
  if (!Number.isFinite(level) || level <= MIN_LEVEL) return 0;
  const n = Math.floor(level);
  return Math.floor(LEVEL_CURVE_BASE * Math.pow(n - 1, LEVEL_CURVE_EXPONENT));
}

/**
 * Given a cumulative XP total, return the highest level the
 * player has earned. Pure, monotonically non-decreasing in xp.
 *
 *   levelForCumulativeXp(0)    = 1
 *   levelForCumulativeXp(29)   = 1   (just below L2)
 *   levelForCumulativeXp(30)   = 2
 *   levelForCumulativeXp(588)  = 10
 *
 * Negative / non-finite → 1.
 */
export function levelForCumulativeXp(xp: number): number {
  if (!Number.isFinite(xp) || xp <= 0) return MIN_LEVEL;
  // Walk upward from L1 until the next threshold would exceed xp.
  // The curve grows fast enough that this loop is bounded by ~200
  // iterations in any realistic input range (10M XP → L~190).
  // Tests pin both correctness and bound.
  let level = MIN_LEVEL;
  while (xpForLevel(level + 1) <= xp) {
    level++;
    if (level > 10_000) break; // safety net
  }
  return level;
}

/**
 * Helper for progress bars — how far the player has progressed
 * from their current level threshold toward the next.
 *
 * Returns:
 *   - level
 *   - xpIntoLevel   — xp accrued past `xpForLevel(level)`
 *   - xpToNextLevel — xp still needed to reach `level + 1`
 *   - progress      — 0..1 fraction of the bar
 */
export interface LevelProgress {
  level: number;
  xpIntoLevel: number;
  xpToNextLevel: number;
  progress: number;
}

export function describeLevelProgress(xp: number): LevelProgress {
  const safeXp = !Number.isFinite(xp) || xp < 0 ? 0 : xp;
  const level = levelForCumulativeXp(safeXp);
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const span = Math.max(1, next - base);
  const into = Math.max(0, safeXp - base);
  return {
    level,
    xpIntoLevel: into,
    xpToNextLevel: Math.max(0, next - safeXp),
    progress: Math.max(0, Math.min(1, into / span)),
  };
}
