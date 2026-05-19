/**
 * Momentum: tier resolution, damage multiplier, gain on Quest
 * completion, decay during absence.
 *
 * Spec: docs/workout-rpg/004-momentum-consistency.md
 *        docs/workout-rpg/011-progression-and-rewards.md §6, §8.
 *
 * Philosophy: a fragile streak is a shame mechanic; we ship neither.
 * Decay is slow, has a 2-day grace, accelerates gently, and the floor
 * is 5 (never zero). Gain is bounded — +10 per calendar day — so a
 * marathon training day cannot be farmed into a tier jump.
 */

import { momentumBalance, momentumMultipliers } from './balance';
import { MOMENTUM_TIERS, type MomentumTier } from '../momentum';
import type {
  MomentumDecayInput,
  MomentumGainBreakdown,
  MomentumGainInput,
} from './types';

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

/**
 * Map a momentum value in [0, 100] to its tier name. Falls back to
 * 'rusted' for non-finite input and clamps out-of-range values into
 * the table without throwing.
 */
export function resolveMomentumTier(value: number): MomentumTier {
  if (!Number.isFinite(value)) {
    return 'rusted';
  }
  const clamped = clamp(value, momentumBalance.min, momentumBalance.max);
  for (const band of momentumBalance.tiers) {
    if (clamped >= band.min && clamped < band.max) {
      return band.name;
    }
  }
  // The closed upper bound (100) belongs to the top tier.
  return MOMENTUM_TIERS[MOMENTUM_TIERS.length - 1];
}

/** Damage chain multiplier for a given tier. Read-through to the table. */
export function calculateMomentumMultiplier(tier: MomentumTier): number {
  return momentumMultipliers[tier];
}

/**
 * Compute momentum gained by completing a Quest (or Camp). Returns
 * both the applied delta and a per-component breakdown so callers
 * can render an honest "you earned +3 (camp) + 1 (variety)" line in
 * the reward screen.
 *
 * Daily cap: 10 points across all events in a single calendar day.
 * Caller supplies `gainedToday` so this function stays pure.
 */
export function calculateMomentumGain(
  input: MomentumGainInput,
): MomentumGainBreakdown {
  const components: Record<string, number> = {};

  const addOutcome = (): void => {
    switch (input.outcome) {
      case 'full':
        components.fullQuest = momentumBalance.gainPerFullQuest;
        return;
      case 'partial':
        components.partialQuest = momentumBalance.gainPerPartialQuest;
        return;
      case 'recovery':
        // Recovery Quests count as a Camp for momentum purposes.
        components.recovery = momentumBalance.gainPerCamp;
        return;
      case 'camp':
        components.camp = momentumBalance.gainPerCamp;
        return;
      case 'abandoned':
        // Abandoned Quests grant zero — but never negative.
        return;
    }
  };

  addOutcome();

  if (input.isReturnQuest) {
    components.returnBonus = momentumBalance.gainReturnBonus;
  }
  if (input.disciplinedExit) {
    components.disciplinedExit = momentumBalance.gainDisciplinedExit;
  }
  if (input.varietyBonus) {
    components.variety = momentumBalance.gainVarietyBonus;
  }
  if (input.isFirstOfWeek) {
    components.firstOfWeek = momentumBalance.gainFirstOfWeek;
  }

  const uncapped = Object.values(components).reduce((a, b) => a + b, 0);

  const alreadyToday = Math.max(0, input.gainedToday ?? 0);
  const remaining = Math.max(0, momentumBalance.gainDailyCap - alreadyToday);
  const applied = Math.min(uncapped, remaining);

  return {
    applied,
    uncapped,
    components,
    hitDailyCap: uncapped > applied,
  };
}

/**
 * Total Momentum decay accrued over an absence.
 *
 * Per-day decay (relative to the gap):
 *   day n (n ≥ 3) → 0.5 * (n - 2)
 *   day 1..2     → 0 (grace period)
 *
 * Total over N days = sum_{k = 3..N} 0.5 * (k - 2).
 * The closed form is 0.25 * (N - 2) * (N - 1) for N ≥ 3, else 0.
 *
 * Reference table (matches the worked example in §3):
 *   N = 7  → 7.5
 *   N = 14 → 39
 *   N = 30 → 203  (caller floors momentum at 5 regardless)
 */
export function calculateMomentumDecay(input: MomentumDecayInput): number {
  const n = Math.floor(input.daysSinceLastSession);
  if (!Number.isFinite(n) || n <= momentumBalance.decayGraceDays) {
    return 0;
  }
  // Closed-form cumulative sum.
  const halfStep = momentumBalance.decayPerDayBeyondGrace / 2;
  return halfStep * (n - momentumBalance.decayGraceDays) * (n - 1);
}
