/**
 * Fatigue accumulator + multiplier.
 *
 * Spec: docs/workout-rpg/003-combat-mechanics.md §2.5,
 *        docs/workout-rpg/007-exercise-archetypes.md §6.
 *
 * Philosophy: anti-grind. The first `fatigueFreeSets` (2) working sets
 * of a Quest are free. Beyond that, each set adds points (weighted by
 * archetype). The damage multiplier degrades linearly with points,
 * floored at 0.5 (0.6 in gentleMode, 0.7 if the active set is
 * endurance). Recovery sets *reduce* fatigue. Warmups cost half a
 * point. An exercise change refunds one point.
 */

import { combatBalance, archetypeBalance } from './balance';
import type {
  AccumulateFatigueInput,
  FatigueMultiplierInput,
} from './types';

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

/**
 * Accumulate fatigue points from a sequence of sets in order.
 *
 * Returns the *running* total after each set, plus the *final* total.
 * Tests and higher-level orchestration use the running totals to
 * audit how fatigue ramped during a Quest.
 *
 * The first `fatigueFreeSets` working sets of the Quest contribute
 * zero. Subsequent working sets contribute their archetype's
 * `fatiguePerSet`. Warmups contribute `warmupFatigueCost` regardless
 * of position. Recovery sets contribute the (negative) archetype
 * value, reducing the pool. An exercise change refunds
 * `fatigueExerciseChangeRefund` from the *current* pool before this
 * set's cost lands.
 *
 * Pool is floored at 0 — negative fatigue makes no sense in the
 * model.
 */
export function accumulateFatigue(
  sets: readonly AccumulateFatigueInput[],
): { runningPoints: number[]; finalPoints: number } {
  const free = combatBalance.fatigueFreeSets;
  const refund = combatBalance.fatigueExerciseChangeRefund;

  let pool = 0;
  let workingIndex = 0;
  const running: number[] = [];

  for (const set of sets) {
    if (set.exerciseChanged) {
      pool = Math.max(0, pool - refund);
    }

    const profile = archetypeBalance[set.archetype];

    let cost: number;
    if (set.isWarmup) {
      cost = combatBalance.warmupFatigueCost;
    } else if (workingIndex < free) {
      cost = 0;
    } else {
      cost = profile.fatiguePerSet;
    }

    pool = Math.max(0, pool + cost);

    if (!set.isWarmup) {
      workingIndex += 1;
    }

    running.push(pool);
  }

  return { runningPoints: running, finalPoints: pool };
}

/**
 * Pure fatigue → multiplier mapping.
 *
 *   modifier = 1.0 - fatiguePerPointPenalty * fatiguePoints
 *
 * Clamped between the floor and 1.0. The floor is:
 *   - 0.6 in gentleMode (recovery after a ≥ 3-day Return)
 *   - 0.7 if the active set's archetype is endurance
 *   - 0.5 otherwise
 *
 * Note: the gentle and endurance floors are NOT additive. The
 * highest applicable floor wins (most forgiving).
 */
export function calculateFatigueMultiplier(
  input: FatigueMultiplierInput,
): number {
  const profile = archetypeBalance[input.archetype];

  let floor: number = combatBalance.fatigueModifierFloor;
  if (input.gentleMode) {
    floor = Math.max(floor, combatBalance.fatigueModifierGentleFloor);
  }
  if (profile.fatigueFloorOverride !== null) {
    floor = Math.max(floor, profile.fatigueFloorOverride);
  }

  const points = Math.max(0, input.fatiguePoints);
  const raw = 1 - combatBalance.fatiguePerPointPenalty * points;

  return clamp(raw, floor, 1);
}
