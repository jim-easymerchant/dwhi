/**
 * Momentum session resolution — wraps gain + decay + tier
 * progression into a single deterministic step.
 *
 * Spec: docs/workout-rpg/004-momentum-consistency.md
 *        docs/workout-rpg/011-progression-and-rewards.md §6, §8.
 */

import {
  calculateMomentumDecay,
  calculateMomentumGain,
  momentumBalance,
  resolveMomentumTier,
} from '../combat';
import type { MomentumResult, ResolveMomentumInput } from './types';

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

/**
 * Decay first, then apply gain, then clamp and resolve tier.
 *
 * Caller is responsible for telling us *why* the quest happened
 * (outcome, isReturn, etc.) — the orchestrator's runner derives
 * those from a real quest run and passes them through.
 *
 * gentleModeActive is the flag the *next* quest should consult.
 * It is true when this quest itself was a comeback (returning
 * after a >= 3-day gap). The 24-hour expiry is owned upstream of
 * this layer (the runner takes a daysSinceLastQuest value; this
 * helper does not consult a clock).
 */
export function resolveMomentumAfterQuest(
  input: ResolveMomentumInput,
): MomentumResult {
  const before = clamp(
    Number.isFinite(input.priorMomentum)
      ? input.priorMomentum
      : momentumBalance.startingValue,
    momentumBalance.min,
    momentumBalance.max,
  );

  const decayApplied = calculateMomentumDecay({
    daysSinceLastSession: input.daysSinceLastQuest,
  });
  const afterDecay = clamp(
    before - decayApplied,
    momentumBalance.min,
    momentumBalance.max,
  );

  const gainBreakdown = calculateMomentumGain({
    outcome: input.questOutcome,
    isReturnQuest: input.isReturnQuest,
    disciplinedExit: input.disciplinedExit,
    varietyBonus: input.varietyBonus,
    isFirstOfWeek: input.isFirstOfWeek,
    gainedToday: input.gainedToday,
  });
  const afterGain = clamp(
    afterDecay + gainBreakdown.applied,
    momentumBalance.min,
    momentumBalance.max,
  );

  const final = afterGain; // already clamped
  const tierBefore = resolveMomentumTier(before);
  const tierAfter = resolveMomentumTier(final);

  return {
    before,
    decayApplied,
    afterDecay,
    gainBreakdown,
    afterGain,
    final,
    tierBefore,
    tierAfter,
    tierChanged: tierBefore !== tierAfter,
    gentleModeActive: !!input.isReturnQuest,
  };
}
