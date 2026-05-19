/**
 * runQuest — the orchestrator entry point.
 *
 * Pure transaction pipeline:
 *
 *   Quest definition
 *   → set sequence
 *   → fatigue accumulation        (Quest-wide, archetype-weighted)
 *   → per-set damage resolution   (with precomputed fatigue points)
 *   → enemy HP progression        (overkill / exact-kill / partial)
 *   → quest XP                    (soft cap + variety + bonuses)
 *   → momentum                    (decay then gain then clamp)
 *   → verdicts                    (narrative labels)
 *   → rewards                     (deterministic packet)
 *   → telemetry                   (counts; nowIso stamp only)
 *
 * The function is deterministic: given the same inputs (including
 * nowIso) it returns byte-for-byte identical output. It does not
 * call Date.now(), Math.random(), or any I/O.
 */

import {
  accumulateFatigue,
  calculateQuestXp,
  calculateSetDamage,
  combatBalance,
} from '../combat';
import type { QuestSetSummary } from '../combat';

import {
  applyDamageToEnemy,
  maybeEscalateEnemyMood,
} from './enemyState';
import { resolveMomentumAfterQuest } from './momentumSession';
import { buildRewardPacket, resolveVerdicts } from './questSummary';
import type {
  EnemyInput,
  EnemyResult,
  RunQuestInput,
  RunQuestResult,
  SetInput,
  SetResult,
  SetTag,
} from './types';

const FLOOR_EPS = 1e-9;

function shouldUseGentleMode(
  input: RunQuestInput,
): boolean {
  if (input.quest.isComebackQuest) return true;
  return input.daysSinceLastQuest >= 3;
}

function isFloor(mult: number, floor: number): boolean {
  return Math.abs(mult - floor) <= FLOOR_EPS;
}

function tagsFor(args: {
  set: SetInput;
  damage: number;
  fatigueMultiplier: number;
  critMultiplier: number;
  fatigueFloorActive: number;
  defeatedEnemy: boolean;
  isOverkill: boolean;
  isJunkVolume: boolean;
  belowThreshold: boolean;
}): SetTag[] {
  const out: SetTag[] = [];
  if (args.set.isWarmup) out.push('warmup');
  else if (args.set.archetype === 'recovery') out.push('recovery');
  else out.push('working');

  if (!args.set.isWarmup && args.set.isPersonalRecord) {
    out.push('pr');
    if (args.critMultiplier > 1) out.push('crit');
  }
  if (isFloor(args.fatigueMultiplier, args.fatigueFloorActive)) {
    out.push('fatigue-floor');
  }
  if (args.isJunkVolume) out.push('junk-volume');
  if (args.belowThreshold) out.push('below-threshold');
  if (args.defeatedEnemy) out.push('finisher');
  if (args.isOverkill) out.push('overkill');
  return out;
}

function activeFatigueFloor(
  archetype: SetInput['archetype'],
  gentleMode: boolean,
): number {
  let floor: number = combatBalance.fatigueModifierFloor;
  if (gentleMode) {
    floor = Math.max(floor, combatBalance.fatigueModifierGentleFloor);
  }
  if (archetype === 'endurance') {
    floor = Math.max(floor, 0.7);
  }
  return floor;
}

function questOutcomeForXp(args: {
  enemyDefeated: boolean;
  enemyExisted: boolean;
  workingCount: number;
  quest: RunQuestInput['quest'];
}): 'full' | 'partial' | 'camp' | 'recovery' | 'abandoned' {
  if (args.quest.kind === 'camp') return 'camp';
  if (args.quest.kind === 'recovery') return 'recovery';
  if (!args.enemyExisted) {
    return args.workingCount >= 3 ? 'full' : 'partial';
  }
  if (args.enemyDefeated) return 'full';
  if (args.workingCount >= 3) return 'partial';
  return 'abandoned';
}

function defeatedOnSetIndex(setResults: readonly SetResult[]): number | null {
  const i = setResults.findIndex((s) => s.defeatedEnemy);
  return i === -1 ? null : i;
}

export function runQuest(input: RunQuestInput): RunQuestResult {
  const gentleMode = shouldUseGentleMode(input);

  // ---- 1. Fatigue accumulation up front --------------------------------
  const fatigueStream = input.sets.map((s) => ({
    archetype: s.archetype,
    isWarmup: !!s.isWarmup,
    exerciseChanged: s.exerciseChanged,
  }));
  const { runningPoints } = accumulateFatigue(fatigueStream);

  // ---- 2. Per-set damage + enemy progression --------------------------
  // Damage is a function of *prior* momentum — the tier the player
  // walked in with. Gain happens AFTER the quest, so we resolve the
  // tier once from priorMomentum and feed it to every set.
  const startingTier = resolveMomentumTierFromValue(input.priorMomentum);

  const enemy: EnemyInput | undefined = input.enemy;
  const setResults: SetResult[] = [];
  let enemyHp = enemy?.maxHp ?? 0;
  let priorWorkingSets = 0;
  let totalDamage = 0;

  for (let i = 0; i < input.sets.length; i++) {
    const set = input.sets[i];
    const before = i === 0 ? 0 : runningPoints[i - 1];

    const breakdown = calculateSetDamage({
      modality: set.modality,
      archetype: set.archetype,
      exercise: set.exercise,
      reps: set.reps,
      durationSeconds: set.durationSeconds,
      weightKg: set.weightKg,
      assistanceKg: set.assistanceKg,
      bodyweightKg: set.bodyweightKg,
      setIndex: set.setIndex,
      sessionSetCount: priorWorkingSets,
      fatiguePointsBeforeSet: before,
      exerciseChanged: set.exerciseChanged,
      momentumTier: startingTier,
      isPersonalRecord: !!set.isPersonalRecord,
      isWarmup: !!set.isWarmup,
      recoveryMode: gentleMode,
    });

    const damage = breakdown.finalDamage;
    const hpBefore = enemyHp;
    const step = enemy
      ? applyDamageToEnemy(hpBefore, damage)
      : {
          hpBefore: 0,
          hpAfter: 0,
          damageApplied: 0,
          isDefeated: false,
          isOverkill: false,
          overkillAmount: 0,
        };

    if (enemy) {
      enemyHp = step.hpAfter;
      totalDamage += step.damageApplied;
    }

    const floor = activeFatigueFloor(set.archetype, gentleMode);
    const isJunkVolume = breakdown.junkVolumePenaltyApplied;
    const belowThreshold =
      breakdown.finalDamage === 0 &&
      !set.isWarmup &&
      set.archetype !== 'recovery';

    setResults.push({
      setIndex: i,
      exerciseId: set.exerciseId,
      exerciseName: set.exerciseName,
      archetype: set.archetype,
      damage,
      rawDamage: breakdown.finalDamage,
      baseAttack: breakdown.baseAttack,
      effectiveReps: breakdown.effectiveReps,
      effectiveLoad: breakdown.effectiveLoad,
      archetypeMultiplier: breakdown.archetypeMultiplier,
      momentumMultiplier: breakdown.momentumMultiplier,
      fatigueMultiplier: breakdown.fatigueMultiplier,
      critMultiplier: breakdown.critMultiplier,
      warmupScalar: breakdown.warmupScalar,
      fatiguePointsBefore: before,
      fatiguePointsAfter: runningPoints[i],
      enemyHpBefore: hpBefore,
      enemyHpAfter: step.hpAfter,
      defeatedEnemy: step.isDefeated,
      isOverkill: step.isOverkill,
      overkillAmount: step.overkillAmount,
      isWarmup: !!set.isWarmup,
      isPersonalRecord: !!set.isPersonalRecord,
      tags: tagsFor({
        set,
        damage,
        fatigueMultiplier: breakdown.fatigueMultiplier,
        critMultiplier: breakdown.critMultiplier,
        fatigueFloorActive: floor,
        defeatedEnemy: step.isDefeated,
        isOverkill: step.isOverkill,
        isJunkVolume,
        belowThreshold,
      }),
    });

    if (!set.isWarmup) priorWorkingSets += 1;
  }

  // ---- 3. Quest XP -----------------------------------------------------
  const workingSets: QuestSetSummary[] = setResults
    .filter((s) => !s.isWarmup)
    .map((s) => ({
      damage: s.damage,
      archetype: s.archetype,
      isWarmup: false,
    }));

  const enemyDefeated = !!enemy && enemyHp === 0 && (enemy.maxHp ?? 0) > 0;
  const workingCount = workingSets.length;

  const disciplinedExitForXp =
    input.quest.plannedSetCount > 0 &&
    Math.abs(workingCount - input.quest.plannedSetCount) <=
      Math.max(1, Math.ceil(input.quest.plannedSetCount * 0.1));

  const questXp = calculateQuestXp({
    workingSets,
    plannedSetCount: input.quest.plannedSetCount,
    exitedAtPlannedVolume: disciplinedExitForXp,
    isRecoveryQuest:
      input.quest.kind === 'recovery' || input.quest.kind === 'camp',
    isComebackQuest: !!input.quest.isComebackQuest,
    suppressJunkPenalty: gentleMode,
  });

  // ---- 4. Momentum -----------------------------------------------------
  const outcome = questOutcomeForXp({
    enemyDefeated,
    enemyExisted: !!enemy,
    workingCount,
    quest: input.quest,
  });

  const varietyBonusEligible = questXp.distinctArchetypes >= 3;
  const momentum = resolveMomentumAfterQuest({
    priorMomentum: input.priorMomentum,
    daysSinceLastQuest: input.daysSinceLastQuest,
    questOutcome: outcome,
    isReturnQuest: input.quest.isComebackQuest || input.daysSinceLastQuest >= 3,
    disciplinedExit: disciplinedExitForXp,
    varietyBonus: varietyBonusEligible,
    isFirstOfWeek: input.quest.isFirstOfWeek,
    gainedToday: input.gainedToday,
  });

  // ---- 5. Enemy result (with optional mood escalation) ----------------
  let enemyResult: EnemyResult | null = null;
  if (enemy) {
    const longGrind =
      workingCount > input.quest.plannedSetCount + Math.ceil(input.quest.plannedSetCount * 0.3);
    const finalMood = maybeEscalateEnemyMood({
      enemy,
      longGrind,
      isComebackDefeat: !!input.quest.isComebackQuest && enemyDefeated,
    });
    enemyResult = {
      id: enemy.id,
      name: enemy.name,
      maxHp: enemy.maxHp,
      finalHp: enemyHp,
      totalDamage,
      defeated: enemyDefeated,
      defeatedOnSetIndex: defeatedOnSetIndex(setResults),
      startingMood: enemy.mood,
      finalMood,
      category: enemy.category,
    };
  }

  // ---- 6. Verdicts -----------------------------------------------------
  const verdicts = resolveVerdicts({
    quest: input.quest,
    setResults,
    enemyResult,
    momentum,
    daysSinceLastQuest: input.daysSinceLastQuest,
  });

  // ---- 7. Reward packet -----------------------------------------------
  const rewards = buildRewardPacket({
    quest: input.quest,
    setResults,
    enemyResult,
    questXp,
    momentum,
    verdicts,
    daysSinceLastQuest: input.daysSinceLastQuest,
  });

  // ---- 8. Telemetry ----------------------------------------------------
  const distinctExercises = new Set(
    setResults.filter((s) => !s.isWarmup).map((s) => s.exerciseId),
  ).size;
  const warmupSets = setResults.filter((s) => s.isWarmup).length;
  const recoverySets = setResults.filter(
    (s) => s.archetype === 'recovery' && !s.isWarmup,
  ).length;
  const prSets = setResults.filter((s) => s.isPersonalRecord && !s.isWarmup).length;
  const totalDurationSecondsLogged = setResults.reduce(
    (acc, s) => acc + Math.max(0, input.sets[s.setIndex].durationSeconds ?? 0),
    0,
  );

  const telemetry = {
    nowIso: input.nowIso,
    questId: input.quest.id,
    questKind: input.quest.kind,
    totalSets: setResults.length,
    workingSets: workingCount,
    warmupSets,
    recoverySets,
    prSets,
    distinctArchetypes: questXp.distinctArchetypes,
    distinctExercises,
    totalDurationSecondsLogged,
    enemyDefeated,
  };

  return {
    enemyResult,
    setResults,
    fatigueTimeline: runningPoints,
    totalDamage,
    questXp,
    momentum,
    verdicts,
    rewards,
    telemetry,
  };
}

// ---- helpers (kept private; not exported) ---------------------------------

function resolveMomentumTierFromValue(value: number): import('../momentum').MomentumTier {
  // Local copy of the tier lookup to avoid an extra cross-module
  // import cycle. Mirrors momentum.ts/combat/momentum.ts.
  if (!Number.isFinite(value)) return 'rusted';
  const v = Math.min(Math.max(value, 0), 100);
  if (v < 20) return 'rusted';
  if (v < 40) return 'steady';
  if (v < 65) return 'driven';
  if (v < 85) return 'relentless';
  return 'ascendant';
}
