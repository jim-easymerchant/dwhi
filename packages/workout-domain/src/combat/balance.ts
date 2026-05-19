/**
 * Centralised, frozen tuning constants for the combat engine.
 *
 * Every number a balancing pass might want to adjust lives here.
 * Business-logic files (`damage.ts`, `fatigue.ts`, `crit.ts`,
 * `momentum.ts`, `questXp.ts`) MUST NOT define their own magic
 * numbers — they import from this file.
 *
 * Source of truth: docs/workout-rpg/003-combat-mechanics.md §9,
 * docs/workout-rpg/004-momentum-consistency.md §10,
 * docs/workout-rpg/007-exercise-archetypes.md §8,
 * docs/workout-rpg/011-progression-and-rewards.md §7.
 */

import type { ExerciseArchetype } from '../exercises';
import type { MomentumTier } from '../momentum';

// ---------------------------------------------------------------------------
// Universal bounds — applied as a safety net to every multiplier output
// regardless of what the per-system formula produced.
// ---------------------------------------------------------------------------

export const MULTIPLIER_FLOOR = 0.4;
export const MULTIPLIER_CEILING = 1.5;

// ---------------------------------------------------------------------------
// Combat balance — the core damage chain.
// ---------------------------------------------------------------------------

export const combatBalance = {
  xpRate: 0.1,
  fatigueFreeSets: 2,
  fatiguePointPerSet: 1.0,
  fatiguePerPointPenalty: 0.05,
  fatigueModifierFloor: 0.5,
  fatigueModifierGentleFloor: 0.6,
  fatigueExerciseChangeRefund: 1,
  warmupDamageScalar: 0.25,
  warmupFatigueCost: 0.5,
  critMultiplier: 1.5,
  defaultBodyweightKg: 70,
  defaultLoadScale: 6,
  defaultBodyweightCoefficient: 0.5,
  minBodyweightRepsForDamage: 3,
  minWeightedRepsForDamage: 1,
  timedRepsPerSecond: 1 / 5,
  varietyBonusPerArchetype: 0.05,
  varietyBonusCap: 0.25,
  disciplinedExitXpBonus: 1.1,
  comebackQuestXpBonus: 1.2,
  junkVolumeSetFloor: 12,
  junkVolumePenaltyPerSet: 5,
  questSoftCapTaperFractionMin: 0.5,
  questSoftCapTaperOvershootFraction: 0.3,
  enemyHpFactor: 1.15,
} as const;

// ---------------------------------------------------------------------------
// Momentum tier → damage multiplier table.
// ---------------------------------------------------------------------------

export const momentumMultipliers: Readonly<Record<MomentumTier, number>> = {
  rusted: 0.9,
  steady: 1.0,
  driven: 1.1,
  relentless: 1.2,
  ascendant: 1.25,
};

// ---------------------------------------------------------------------------
// Momentum trajectory — gain, decay, tier thresholds, daily cap.
// ---------------------------------------------------------------------------

export interface MomentumTierBand {
  readonly name: MomentumTier;
  readonly min: number;
  readonly max: number;
}

export const momentumBalance = {
  startingValue: 25,
  min: 5,
  max: 100,
  gainPerFullQuest: 6,
  gainPerPartialQuest: 3,
  gainPerCamp: 3,
  gainReturnBonus: 8,
  gainDisciplinedExit: 1,
  gainVarietyBonus: 1,
  gainFirstOfWeek: 1,
  gainDailyCap: 10,
  decayGraceDays: 2,
  decayPerDayBeyondGrace: 0.5,
  tiers: [
    { name: 'rusted', min: 0, max: 20 },
    { name: 'steady', min: 20, max: 40 },
    { name: 'driven', min: 40, max: 65 },
    { name: 'relentless', min: 65, max: 85 },
    { name: 'ascendant', min: 85, max: 100 },
  ] as const satisfies readonly MomentumTierBand[],
} as const;

// ---------------------------------------------------------------------------
// Per-archetype combat profile.
//
// `damageMultiplier`  — base archetype multiplier in the damage chain.
// `fatiguePerSet`     — fatigue points accrued by a single working set.
// `comboBonusPerSet`  — additive intra-battle bonus (pressure only).
// `comboCap`          — cap on the additive combo bonus.
// `firstSetBonus`     — additive bonus on the first working set of a
//                       battle (heavy only).
// `critAffinity`      — pre-clamp scalar applied to the crit multiplier
//                       (clamped back to ≤ MULTIPLIER_CEILING).
// `fatigueFloorOverride` — raises the fatigue floor when the active
//                       set's archetype is this (endurance only).
// `dealsDamage`       — false for recovery; the engine forces damage = 0.
//
// All values are tuned to keep the resulting `archetypeMultiplier`
// inside [MULTIPLIER_FLOOR, MULTIPLIER_CEILING] without an external
// clamp: pressure tops out at 1.0 + 0.15 = 1.15; heavy at 1.2 + 0.25 =
// 1.45. The safety clamp is still applied for belt-and-braces.
// ---------------------------------------------------------------------------

export interface ArchetypeCombatProfile {
  readonly damageMultiplier: number;
  readonly fatiguePerSet: number;
  readonly comboBonusPerSet: number;
  readonly comboCap: number;
  readonly firstSetBonus: number;
  readonly critAffinity: number;
  readonly fatigueFloorOverride: number | null;
  readonly dealsDamage: boolean;
}

export const archetypeBalance: Readonly<
  Record<ExerciseArchetype, ArchetypeCombatProfile>
> = {
  pressure: {
    damageMultiplier: 1.0,
    fatiguePerSet: 0.6,
    comboBonusPerSet: 0.03,
    comboCap: 0.15,
    firstSetBonus: 0,
    critAffinity: 1.0,
    fatigueFloorOverride: null,
    dealsDamage: true,
  },
  heavy: {
    damageMultiplier: 1.2,
    fatiguePerSet: 1.4,
    comboBonusPerSet: 0,
    comboCap: 0,
    firstSetBonus: 0.25,
    critAffinity: 1.0,
    fatigueFloorOverride: null,
    dealsDamage: true,
  },
  control: {
    damageMultiplier: 1.05,
    fatiguePerSet: 1.0,
    comboBonusPerSet: 0,
    comboCap: 0,
    firstSetBonus: 0,
    critAffinity: 1.05,
    fatigueFloorOverride: null,
    dealsDamage: true,
  },
  foundation: {
    damageMultiplier: 1.1,
    fatiguePerSet: 1.0,
    comboBonusPerSet: 0,
    comboCap: 0,
    firstSetBonus: 0,
    critAffinity: 1.0,
    fatigueFloorOverride: null,
    dealsDamage: true,
  },
  endurance: {
    damageMultiplier: 0.9,
    fatiguePerSet: 0.5,
    comboBonusPerSet: 0,
    comboCap: 0,
    firstSetBonus: 0,
    critAffinity: 0.95,
    fatigueFloorOverride: 0.7,
    dealsDamage: true,
  },
  recovery: {
    damageMultiplier: 1.0,
    fatiguePerSet: -1.0,
    comboBonusPerSet: 0,
    comboCap: 0,
    firstSetBonus: 0,
    critAffinity: 1.0,
    fatigueFloorOverride: null,
    dealsDamage: false,
  },
};
