/**
 * Verdict resolution + reward packet generation.
 *
 * Spec: docs/workout-rpg/011-progression-and-rewards.md §5
 *        (verdict vocabulary, priority hint),
 *        docs/workout-rpg/008-equipment-philosophy.md
 *        (equipmentAffinity feeds the autobiographical pipeline).
 *
 * Verdicts are *labels*, not ranks; the priority ordering only
 * informs which one the UX layer surfaces as the primary banner.
 */

import type { ExerciseArchetype } from '../exercises';
import type {
  EnemyResult,
  MomentumResult,
  QuestDefinition,
  QuestRewards,
  QuestVerdict,
  SetResult,
} from './types';
import type { QuestXpBreakdown } from '../combat';

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

/**
 * Resolve every verdict that applies to a finished quest. Order is
 * meaningful to UX (first item is the primary banner), but all
 * coexist in the data.
 *
 * Priority:
 *   Comeback Quest > PR Logged > First of the Week > Gentle Return
 *   > Disciplined Exit > Warmth Returned > Relentless > Finisher
 *   > Held the Line > Steady
 *
 * "Steady" is the always-true baseline — never absent unless the
 * quest produced zero results.
 */
export function resolveVerdicts(input: {
  quest: QuestDefinition;
  setResults: readonly SetResult[];
  enemyResult: EnemyResult | null;
  momentum: MomentumResult;
  daysSinceLastQuest: number;
}): QuestVerdict[] {
  const { quest, setResults, enemyResult, momentum, daysSinceLastQuest } = input;
  const working = setResults.filter((s) => !s.isWarmup && s.archetype !== 'recovery');
  const workingCount = working.length;
  const planned = Math.max(0, quest.plannedSetCount);
  const anyPr = working.some((s) => s.isPersonalRecord);
  const finisher = setResults.some((s) => s.defeatedEnemy);
  const isRecoveryQuest = quest.kind === 'recovery' || quest.kind === 'camp';
  const isComeback = !!quest.isComebackQuest || daysSinceLastQuest >= 3;
  const gentleReturn = daysSinceLastQuest >= 3 && daysSinceLastQuest < 7;

  // ±10% window for disciplined exit. Always honour 0 when planned == 0.
  const disciplinedTolerance = Math.max(1, Math.ceil(planned * 0.1));
  const disciplinedExit =
    planned > 0 && Math.abs(workingCount - planned) <= disciplinedTolerance;

  const heldTheLine =
    enemyResult !== null &&
    !enemyResult.defeated &&
    workingCount >= 3;

  const isRelentless =
    momentum.tierAfter === 'relentless' || momentum.tierAfter === 'ascendant';

  const out: QuestVerdict[] = [];
  if (isComeback) out.push('Comeback Quest');
  if (anyPr) out.push('PR Logged');
  if (quest.isFirstOfWeek) out.push('First of the Week');
  if (gentleReturn && !out.includes('Comeback Quest')) out.push('Gentle Return');
  if (disciplinedExit) out.push('Disciplined Exit');
  if (isRecoveryQuest) out.push('Warmth Returned');
  if (isRelentless) out.push('Relentless');
  if (finisher) out.push('Finisher');
  if (heldTheLine) out.push('Held the Line');
  out.push('Steady');

  return out;
}

/**
 * Counts of *working* sets per archetype. Drives the future
 * autobiographical-equipment unlock pipeline; warmups and pure
 * recovery sets are excluded.
 */
function tallyEquipmentAffinity(
  setResults: readonly SetResult[],
): Partial<Record<ExerciseArchetype, number>> {
  const out: Partial<Record<ExerciseArchetype, number>> = {};
  for (const s of setResults) {
    if (s.isWarmup) continue;
    if (s.archetype === 'recovery') continue;
    out[s.archetype] = (out[s.archetype] ?? 0) + 1;
  }
  return out;
}

/**
 * Deterministic lore-fragment score in [0, 1]. The orchestrator
 * never rolls — a downstream consumer with a seeded RNG decides
 * whether to grant a fragment. This score blends:
 *
 *   +0.40  comeback quest
 *   +0.30  any PR
 *   +0.15  tier-up
 *   +0.10  3+ distinct archetypes (variety quest)
 *   +0.10  disciplined-exit verdict
 *   +0.05  enemy defeated
 */
function computeLoreChance(input: {
  isComeback: boolean;
  anyPr: boolean;
  tierChanged: boolean;
  distinctArchetypes: number;
  disciplinedExit: boolean;
  enemyDefeated: boolean;
}): number {
  let score = 0;
  if (input.isComeback) score += 0.4;
  if (input.anyPr) score += 0.3;
  if (input.tierChanged) score += 0.15;
  if (input.distinctArchetypes >= 3) score += 0.1;
  if (input.disciplinedExit) score += 0.1;
  if (input.enemyDefeated) score += 0.05;
  return clamp(score, 0, 1);
}

/**
 * Build the reward packet. No items, no loot tables, no random
 * draws. Everything is a deterministic function of the inputs.
 */
export function buildRewardPacket(input: {
  quest: QuestDefinition;
  setResults: readonly SetResult[];
  enemyResult: EnemyResult | null;
  questXp: QuestXpBreakdown;
  momentum: MomentumResult;
  verdicts: readonly QuestVerdict[];
  daysSinceLastQuest: number;
}): QuestRewards {
  const { quest, setResults, enemyResult, questXp, momentum, verdicts } = input;
  const anyPr = setResults.some((s) => s.isPersonalRecord && !s.isWarmup);
  const isComeback =
    !!quest.isComebackQuest || input.daysSinceLastQuest >= 3;

  // recoveryBonus carries small positive value when the player
  // *invested* in recovery — used by the next quest's fatigue floor
  // logic. Capped at 0.15 by design (we never make it free).
  let recoveryBonus = 0;
  if (quest.kind === 'recovery' || quest.kind === 'camp') recoveryBonus += 0.1;
  if (verdicts.includes('Disciplined Exit')) recoveryBonus += 0.05;
  recoveryBonus = clamp(recoveryBonus, 0, 0.15);

  const loreChance = computeLoreChance({
    isComeback,
    anyPr,
    tierChanged: momentum.tierChanged,
    distinctArchetypes: questXp.distinctArchetypes,
    disciplinedExit: verdicts.includes('Disciplined Exit'),
    enemyDefeated: !!enemyResult?.defeated,
  });

  return {
    xp: questXp.xp,
    momentumDelta: momentum.gainBreakdown.applied,
    loreChance,
    equipmentAffinity: tallyEquipmentAffinity(setResults),
    recoveryBonus,
  };
}
