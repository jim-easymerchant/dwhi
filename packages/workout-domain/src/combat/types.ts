/**
 * Combat I/O types. Every public combat function takes a serialisable
 * input object and returns a serialisable output object — no class
 * instances, no closures, no dates, no functions inside the payload.
 *
 * Source of truth:
 *   docs/workout-rpg/003-combat-mechanics.md
 *   docs/workout-rpg/007-exercise-archetypes.md
 *   docs/workout-rpg/011-progression-and-rewards.md
 */

import type { ExerciseArchetype, ExerciseModality } from '../exercises';
import type { MomentumTier } from '../momentum';

// ---------------------------------------------------------------------------
// Exercise tuning constants (per-row from the catalogue).
// ---------------------------------------------------------------------------

export interface ExerciseProfile {
  /** Damage normaliser; higher = smaller damage numbers. */
  loadScale: number;
  /** Fraction of bodyweight contributing to effectiveLoad. */
  bodyweightCoefficient: number;
}

// ---------------------------------------------------------------------------
// Effective load / reps helpers.
// ---------------------------------------------------------------------------

export interface EffectiveLoadInput {
  modality: ExerciseModality;
  exercise: ExerciseProfile;
  /** External weight in kg, e.g. on a barbell. */
  weightKg?: number;
  /** Assistance in kg, e.g. on an assisted-pullup machine. Subtracted. */
  assistanceKg?: number;
  /** Player bodyweight in kg. Defaults to balance.defaultBodyweightKg. */
  bodyweightKg?: number;
}

export interface EffectiveRepsInput {
  modality: ExerciseModality;
  reps?: number;
  durationSeconds?: number;
}

// ---------------------------------------------------------------------------
// Damage computation.
// ---------------------------------------------------------------------------

export interface SetDamageInput {
  modality: ExerciseModality;
  archetype: ExerciseArchetype;
  exercise: ExerciseProfile;

  /** Rep-count for rep-based modalities. */
  reps?: number;
  /** Duration in seconds for timed modalities. */
  durationSeconds?: number;
  /** External weight in kg. Optional. */
  weightKg?: number;
  /** Assistance in kg. Optional. */
  assistanceKg?: number;
  /** Player bodyweight in kg. Optional; falls back to default. */
  bodyweightKg?: number;

  /**
   * 0-indexed position of this *working* set inside the current
   * Battle. Warmups do not consume the index — set 0 means "the
   * first working set of this Battle." Drives pressure combo and
   * heavy first-set bonuses.
   */
  setIndex: number;

  /**
   * Total number of working sets logged *before* this one across the
   * whole Quest. Drives the fatigue approximation when
   * `fatiguePointsBeforeSet` is not supplied, and the junk-volume
   * marker. The set under computation is itself excluded.
   */
  sessionSetCount: number;

  /**
   * Optional: the exact accumulated fatigue points *before* this
   * set. When omitted, fatigue is approximated from
   * `sessionSetCount` using the current archetype's per-set cost.
   * Production callers (a Quest orchestrator) will pre-run
   * `accumulateFatigue()` and supply this value for precision.
   */
  fatiguePointsBeforeSet?: number;

  /**
   * True if the immediately preceding logged set was for a different
   * exercise (i.e., this set opens a new Battle). Yields a small
   * fatigue refund (`combatBalance.fatigueExerciseChangeRefund`).
   */
  exerciseChanged?: boolean;

  momentumTier: MomentumTier;
  isPersonalRecord: boolean;
  isWarmup: boolean;

  /**
   * gentleMode flag — set after a ≥ 3-day Return. Raises the
   * fatigue floor (see balance.combatBalance.fatigueModifierGentleFloor)
   * and lifts the junk-volume marker for the Quest.
   */
  recoveryMode: boolean;
}

export interface SetDamageBreakdown {
  finalDamage: number;

  // Intermediate values, all surfaced for testability / future
  // debug overlay. Every multiplier is bounded; baseAttack and
  // finalDamage are non-negative and finite.
  effectiveReps: number;
  effectiveLoad: number;
  baseAttack: number;
  archetypeMultiplier: number;
  momentumMultiplier: number;
  fatigueMultiplier: number;
  critMultiplier: number;
  warmupScalar: number;
  /** True if this set sits beyond the Quest's junk-volume threshold. */
  junkVolumePenaltyApplied: boolean;
  /** True if this set's archetype is recovery and dealsDamage = false. */
  isRecoverySet: boolean;
}

// ---------------------------------------------------------------------------
// Fatigue.
// ---------------------------------------------------------------------------

export interface FatigueMultiplierInput {
  /** Accumulated fatigue points BEFORE this set. */
  fatiguePoints: number;
  /** Active archetype for this set (drives fatigueFloorOverride). */
  archetype: ExerciseArchetype;
  /** Raises the floor from 0.5 → 0.6 when true. */
  gentleMode?: boolean;
}

export interface AccumulateFatigueInput {
  archetype: ExerciseArchetype;
  isWarmup: boolean;
  /** True if this set opens a new Battle. Refunds 1 point. */
  exerciseChanged?: boolean;
}

// ---------------------------------------------------------------------------
// Crit.
// ---------------------------------------------------------------------------

export type PersonalRecordKind = 'rep' | 'weight' | 'volume';

export interface CritMultiplierInput {
  isPersonalRecord: boolean;
  archetype: ExerciseArchetype;
  /** Optional: which PR kinds triggered. Informational only; the
   * crit multiplier does not stack. */
  prKinds?: readonly PersonalRecordKind[];
}

// ---------------------------------------------------------------------------
// Momentum.
// ---------------------------------------------------------------------------

export type QuestOutcome =
  | 'full'
  | 'partial'
  | 'camp'
  | 'recovery'
  | 'abandoned';

export interface MomentumGainInput {
  outcome: QuestOutcome;
  isReturnQuest?: boolean;
  disciplinedExit?: boolean;
  varietyBonus?: boolean;
  isFirstOfWeek?: boolean;
  /** Momentum already earned from prior events today (caps at 10/day). */
  gainedToday?: number;
}

export interface MomentumGainBreakdown {
  applied: number;
  uncapped: number;
  components: Readonly<Record<string, number>>;
  hitDailyCap: boolean;
}

export interface MomentumDecayInput {
  daysSinceLastSession: number;
}

// ---------------------------------------------------------------------------
// Quest XP.
// ---------------------------------------------------------------------------

export interface QuestSetSummary {
  damage: number;
  archetype: ExerciseArchetype;
  isWarmup?: boolean;
}

export interface QuestXpInput {
  workingSets: readonly QuestSetSummary[];
  plannedSetCount: number;
  exitedAtPlannedVolume: boolean;
  isRecoveryQuest?: boolean;
  isComebackQuest?: boolean;
  /** Set true to silence the junk-volume penalty (e.g., gentleMode). */
  suppressJunkPenalty?: boolean;
}

export interface QuestXpBreakdown {
  /** Final XP rounded down to a non-negative integer. */
  xp: number;
  rawDamage: number;
  taperedDamage: number;
  distinctArchetypes: number;
  varietyBonus: number;
  disciplinedExitBonus: number;
  comebackBonus: number;
  junkVolumePenalty: number;
  setCountForVolume: number;
  /**
   * Number of working sets at or past the soft cap (planned + 30%)
   * whose XP contribution was zeroed out.
   */
  setsBeyondSoftCap: number;
}
