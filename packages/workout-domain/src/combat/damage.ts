/**
 * Per-set damage computation.
 *
 * Spec: docs/workout-rpg/003-combat-mechanics.md §2 (formula),
 *        §8 (worked example),
 *        docs/workout-rpg/007-exercise-archetypes.md §6 (archetype
 *        damage profile).
 *
 * Formula (working sets):
 *
 *   baseAttack = (effectiveReps * effectiveLoad) / loadScale
 *   damage     = baseAttack
 *              * archetypeMultiplier
 *              * momentumMultiplier
 *              * fatigueMultiplier
 *              * critMultiplier
 *
 * Warmups bypass the multiplier chain entirely and contribute
 * `warmupDamageScalar * baseAttack` — they are scouting, not drama.
 *
 * Recovery archetype: `dealsDamage: false` → damage forced to 0 but
 * the rest of the breakdown is still populated for transparency.
 *
 * Universal multiplier safety net: every per-multiplier output is
 * clamped to [MULTIPLIER_FLOOR, MULTIPLIER_CEILING] before
 * composition. The crit multiplier is additionally clamped to its
 * own ≤ 1.5 cap inside `calculateCritMultiplier`.
 */

import {
  MULTIPLIER_CEILING,
  MULTIPLIER_FLOOR,
  archetypeBalance,
  combatBalance,
} from './balance';
import { calculateCritMultiplier } from './crit';
import { calculateFatigueMultiplier } from './fatigue';
import { calculateMomentumMultiplier } from './momentum';
import type {
  EffectiveLoadInput,
  EffectiveRepsInput,
  SetDamageBreakdown,
  SetDamageInput,
} from './types';

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const safe = (value: number): number =>
  Number.isFinite(value) ? value : 0;

// ---------------------------------------------------------------------------
// Effective reps — turns the modality + reps + duration into a unified
// "rep equivalent" number used by the damage chain.
// ---------------------------------------------------------------------------

export function calculateEffectiveReps(input: EffectiveRepsInput): number {
  if (input.modality === 'timed') {
    const seconds = Math.max(0, input.durationSeconds ?? 0);
    return Math.floor(seconds * combatBalance.timedRepsPerSecond);
  }
  return Math.max(0, Math.floor(input.reps ?? 0));
}

// ---------------------------------------------------------------------------
// Effective load — the unified "how heavy did the body have to move"
// scalar. Bodyweight contributes via the exercise's coefficient;
// external weight adds; assistance subtracts; floor at 0.
// ---------------------------------------------------------------------------

export function calculateEffectiveLoad(input: EffectiveLoadInput): number {
  const bodyweight = Math.max(
    0,
    input.bodyweightKg ?? combatBalance.defaultBodyweightKg,
  );
  const bodyContribution = bodyweight * input.exercise.bodyweightCoefficient;
  const weight = Math.max(0, input.weightKg ?? 0);
  const assistance = Math.max(0, input.assistanceKg ?? 0);

  let load: number;
  switch (input.modality) {
    case 'weighted':
      // External weight plus optional bodyweight contribution
      // (e.g., weighted pullups carry both).
      load = weight + bodyContribution;
      break;
    case 'bodyweight':
      load = bodyContribution + weight; // weighted pushup: add the vest.
      break;
    case 'timed':
      // Static holds scale to bodyweight only.
      load = bodyContribution;
      break;
    case 'cardio':
    case 'mobility':
      // Out of strength-damage scope. Caller should not pass these
      // to the damage function; return a benign zero rather than
      // throwing.
      load = 0;
      break;
  }

  return Math.max(0, load - assistance);
}

// ---------------------------------------------------------------------------
// Archetype multiplier — base profile + per-set additive bonuses
// (pressure combo, heavy first-set), clamped to the universal bound.
// ---------------------------------------------------------------------------

export function calculateArchetypeMultiplier(input: {
  archetype: SetDamageInput['archetype'];
  setIndex: number;
  isWarmup: boolean;
}): number {
  const profile = archetypeBalance[input.archetype];

  let m = profile.damageMultiplier;
  if (!input.isWarmup) {
    if (profile.comboBonusPerSet > 0) {
      const bonus = Math.min(
        profile.comboBonusPerSet * Math.max(0, input.setIndex),
        profile.comboCap,
      );
      m += bonus;
    }
    if (profile.firstSetBonus > 0 && input.setIndex === 0) {
      m += profile.firstSetBonus;
    }
  }
  return clamp(m, MULTIPLIER_FLOOR, MULTIPLIER_CEILING);
}

// ---------------------------------------------------------------------------
// Core: calculateSetDamage
// ---------------------------------------------------------------------------

export function calculateSetDamage(input: SetDamageInput): SetDamageBreakdown {
  const effectiveReps = calculateEffectiveReps(input);
  const effectiveLoad = calculateEffectiveLoad(input);

  const loadScale =
    input.exercise.loadScale > 0
      ? input.exercise.loadScale
      : combatBalance.defaultLoadScale;

  const rawBaseAttack = safe((effectiveReps * effectiveLoad) / loadScale);
  const baseAttack = Math.max(0, rawBaseAttack);

  const profile = archetypeBalance[input.archetype];
  const isRecoverySet = !profile.dealsDamage;

  // Below-threshold sets ("log a 1-rep set 30 times" exploit guard).
  const belowThreshold =
    !input.isWarmup &&
    ((input.modality === 'bodyweight' &&
      effectiveReps < combatBalance.minBodyweightRepsForDamage) ||
      (input.modality === 'weighted' &&
        effectiveReps < combatBalance.minWeightedRepsForDamage));

  // Common multipliers (computed regardless so the breakdown is
  // honest even on warmup / recovery / sub-threshold paths).
  const archetypeMultiplier = calculateArchetypeMultiplier({
    archetype: input.archetype,
    setIndex: input.setIndex,
    isWarmup: input.isWarmup,
  });

  const momentumMultiplier = clamp(
    calculateMomentumMultiplier(input.momentumTier),
    MULTIPLIER_FLOOR,
    MULTIPLIER_CEILING,
  );

  // Fatigue points before this set. If the orchestrator supplied a
  // precomputed value, trust it. Otherwise approximate from
  // sessionSetCount using the current archetype's per-set cost — a
  // safe simplification that becomes exact when the whole Quest
  // shares an archetype.
  const priorPoints =
    input.fatiguePointsBeforeSet !== undefined
      ? Math.max(0, input.fatiguePointsBeforeSet)
      : Math.max(
          0,
          (input.sessionSetCount - combatBalance.fatigueFreeSets) *
            profile.fatiguePerSet,
        );

  const adjustedPoints = input.exerciseChanged
    ? Math.max(0, priorPoints - combatBalance.fatigueExerciseChangeRefund)
    : priorPoints;

  const fatigueMultiplier = clamp(
    calculateFatigueMultiplier({
      fatiguePoints: adjustedPoints,
      archetype: input.archetype,
      gentleMode: input.recoveryMode,
    }),
    MULTIPLIER_FLOOR,
    MULTIPLIER_CEILING,
  );

  const critMultiplier = clamp(
    calculateCritMultiplier({
      isPersonalRecord: input.isPersonalRecord && !input.isWarmup,
      archetype: input.archetype,
    }),
    1,
    MULTIPLIER_CEILING,
  );

  const warmupScalar = input.isWarmup
    ? combatBalance.warmupDamageScalar
    : 1;

  // Junk-volume marker — informational, surfaces in the breakdown
  // so the XP layer can act on it. The damage layer itself does NOT
  // subtract XP; that's questXp.ts's job. gentleMode suppresses.
  const junkVolumePenaltyApplied =
    !input.recoveryMode &&
    !input.isWarmup &&
    input.sessionSetCount >= combatBalance.junkVolumeSetFloor;

  let finalDamage: number;
  if (isRecoverySet || belowThreshold) {
    finalDamage = 0;
  } else if (input.isWarmup) {
    finalDamage = baseAttack * warmupScalar;
  } else {
    finalDamage =
      baseAttack *
      archetypeMultiplier *
      momentumMultiplier *
      fatigueMultiplier *
      critMultiplier;
  }

  // Final safety: no NaN, no Infinity, no negative damage out the door.
  finalDamage = Math.max(0, safe(finalDamage));

  return {
    finalDamage,
    effectiveReps,
    effectiveLoad,
    baseAttack,
    archetypeMultiplier,
    momentumMultiplier,
    fatigueMultiplier,
    critMultiplier,
    warmupScalar,
    junkVolumePenaltyApplied,
    isRecoverySet,
  };
}
