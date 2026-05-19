/**
 * Quest XP aggregator.
 *
 * Spec: docs/workout-rpg/003-combat-mechanics.md §6,
 *        docs/workout-rpg/007-exercise-archetypes.md §4
 *        (variety is archetype-aware),
 *        docs/workout-rpg/011-progression-and-rewards.md §6, §7.
 *
 *   questXp = round(
 *               sum(perSetDamage_after_soft_cap * xpRate)
 *               * varietyBonus
 *               * disciplinedExitBonus
 *               * comebackBonus
 *             )
 *             - junkVolumePenalty
 *
 * Soft cap (§7.1):
 *   - planned …………………………………………………… full xpRate
 *   - planned + 1 … planned + 30%  …………… xpRate tapers 1.0x → 0.5x linearly
 *   - beyond planned + 30%  ………………………… 0 (we stop rewarding; we never punish)
 *
 * Junk-volume penalty (§7.4):
 *   - applies above max(plannedSetCount, junkVolumeSetFloor)
 *   - per-set penalty: junkVolumePenaltyPerSet
 *   - suppressed in gentleMode / recovery
 *
 * Variety bonus is computed from *distinct archetypes*, not distinct
 * exercises (007 §4). Capped at +25%.
 */

import { combatBalance } from './balance';
import type { QuestSetSummary, QuestXpBreakdown, QuestXpInput } from './types';

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const safe = (value: number): number =>
  Number.isFinite(value) ? value : 0;

function countDistinctArchetypes(sets: readonly QuestSetSummary[]): number {
  const seen = new Set<string>();
  for (const set of sets) {
    seen.add(set.archetype);
  }
  return seen.size;
}

/** Per-set XP scalar in [0, 1] given that set's volume index. */
function softCapScalar(
  setIndexOneBased: number,
  plannedSetCount: number,
): number {
  if (plannedSetCount <= 0 || setIndexOneBased <= plannedSetCount) {
    return 1;
  }
  const overshoot = setIndexOneBased - plannedSetCount;
  const overshootLimit = Math.max(
    1,
    Math.ceil(plannedSetCount * combatBalance.questSoftCapTaperOvershootFraction),
  );
  if (overshoot > overshootLimit) {
    return 0;
  }
  // Linear taper 1.0 → 0.5 across the overshoot range.
  const min = combatBalance.questSoftCapTaperFractionMin;
  return clamp(1 - ((1 - min) * overshoot) / overshootLimit, min, 1);
}

export function calculateQuestXp(input: QuestXpInput): QuestXpBreakdown {
  const workingOnly = input.workingSets.filter((s) => !s.isWarmup);
  const workingCount = workingOnly.length;

  const rawDamage = workingOnly.reduce((acc, s) => acc + Math.max(0, s.damage), 0);

  let taperedDamage = 0;
  let setsBeyondSoftCap = 0;
  workingOnly.forEach((set, i) => {
    const scalar = softCapScalar(i + 1, input.plannedSetCount);
    if (scalar === 0) setsBeyondSoftCap += 1;
    taperedDamage += Math.max(0, set.damage) * scalar;
  });

  const distinctArchetypes = countDistinctArchetypes(workingOnly);
  const varietyBonus = clamp(
    1 +
      combatBalance.varietyBonusPerArchetype * Math.max(0, distinctArchetypes - 1),
    1,
    1 + combatBalance.varietyBonusCap,
  );

  const disciplinedExitBonus = input.exitedAtPlannedVolume
    ? combatBalance.disciplinedExitXpBonus
    : 1;

  const comebackBonus = input.isComebackQuest
    ? combatBalance.comebackQuestXpBonus
    : 1;

  const xpBeforePenalty =
    taperedDamage *
    combatBalance.xpRate *
    varietyBonus *
    disciplinedExitBonus *
    comebackBonus;

  // Junk-volume penalty floor: the larger of `planned` and
  // `junkVolumeSetFloor`. A Quest planned for 14 doesn't get
  // penalised at set 13.
  const penaltyFloor = Math.max(
    input.plannedSetCount,
    combatBalance.junkVolumeSetFloor,
  );
  const suppressed = input.suppressJunkPenalty || input.isRecoveryQuest;
  const penaltySetCount = suppressed
    ? 0
    : Math.max(0, workingCount - penaltyFloor);
  const junkVolumePenalty =
    penaltySetCount * combatBalance.junkVolumePenaltyPerSet;

  const xp = Math.max(0, Math.floor(safe(xpBeforePenalty) - junkVolumePenalty));

  return {
    xp,
    rawDamage,
    taperedDamage,
    distinctArchetypes,
    varietyBonus,
    disciplinedExitBonus,
    comebackBonus,
    junkVolumePenalty,
    setCountForVolume: workingCount,
    setsBeyondSoftCap,
  };
}
