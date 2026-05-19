/**
 * Orchestrator I/O types.
 *
 * Pure. Serialisable. Deterministic. The orchestrator never reads
 * a global clock — every time-like input is injected.
 *
 * See:
 *   docs/workout-rpg/002-core-loop.md (the loop this layer
 *     simulates)
 *   docs/workout-rpg/010-enemy-design-bible.md (enemy moods,
 *     categories, escalation)
 *   docs/workout-rpg/011-progression-and-rewards.md (verdict
 *     vocabulary, reward shape)
 *   docs/workout-rpg/012-battle-ux-and-feel.md (tags drive UX
 *     decisions downstream)
 */

import type { EnemyCategory, EnemyMood } from '../enemies';
import type { ExerciseArchetype, ExerciseModality } from '../exercises';
import type { MomentumTier } from '../momentum';
import type { QuestKind } from '../types';
import type {
  ExerciseProfile,
  MomentumGainBreakdown,
  QuestXpBreakdown,
} from '../combat';

// ---------------------------------------------------------------------------
// Quest definition — the "what the player set out to do" envelope.
// ---------------------------------------------------------------------------

export interface QuestDefinition {
  id: string;
  kind: QuestKind;
  /** Optional template id, e.g. `push_day`. Purely informational. */
  templateId?: string;
  /** Sets the player planned to do; drives soft-cap + disciplined-exit. */
  plannedSetCount: number;
  /** First quest of the player's calendar week. */
  isFirstOfWeek?: boolean;
  /** First quest after a >= 3-day gap. Caller computes this. */
  isComebackQuest?: boolean;
}

// ---------------------------------------------------------------------------
// Per-set input. One entry per logged set, including warmups.
// ---------------------------------------------------------------------------

export interface SetInput {
  exerciseId: string;
  exerciseName: string;
  modality: ExerciseModality;
  archetype: ExerciseArchetype;
  exercise: ExerciseProfile;
  /** Position of this *working* set within its battle (0-based). */
  setIndex: number;

  reps?: number;
  durationSeconds?: number;
  weightKg?: number;
  assistanceKg?: number;
  bodyweightKg?: number;

  isWarmup?: boolean;
  isPersonalRecord?: boolean;

  /** True if this set opens a new battle within the quest. */
  exerciseChanged?: boolean;
}

// ---------------------------------------------------------------------------
// Enemy input — optional (recovery / camp quests have none).
// ---------------------------------------------------------------------------

export interface EnemyInput {
  id: string;
  name: string;
  maxHp: number;
  mood: EnemyMood;
  category: EnemyCategory;
}

// ---------------------------------------------------------------------------
// runQuest input envelope.
// ---------------------------------------------------------------------------

export interface RunQuestInput {
  quest: QuestDefinition;
  enemy?: EnemyInput;
  sets: readonly SetInput[];
  /** Player momentum value (0..100) BEFORE this quest is applied. */
  priorMomentum: number;
  /** Days since the player's last completed quest. >= 0. */
  daysSinceLastQuest: number;
  /** Momentum already gained from earlier events today (cap is 10). */
  gainedToday?: number;
  /** ISO timestamp stamped into telemetry. Never used arithmetically. */
  nowIso: string;
}

// ---------------------------------------------------------------------------
// Per-set output.
// ---------------------------------------------------------------------------

/**
 * Narrative tags the UX layer reads to choose icons, copy, and
 * animations. Tag strings are stable identifiers, not localised
 * labels.
 */
export type SetTag =
  | 'warmup'
  | 'working'
  | 'recovery'
  | 'pr'
  | 'crit'
  | 'fatigue-floor'
  | 'junk-volume'
  | 'finisher'
  | 'overkill'
  | 'below-threshold';

export interface SetResult {
  setIndex: number;
  exerciseId: string;
  exerciseName: string;
  archetype: ExerciseArchetype;
  damage: number;
  rawDamage: number;
  baseAttack: number;
  effectiveReps: number;
  effectiveLoad: number;
  archetypeMultiplier: number;
  momentumMultiplier: number;
  fatigueMultiplier: number;
  critMultiplier: number;
  warmupScalar: number;
  fatiguePointsBefore: number;
  fatiguePointsAfter: number;
  enemyHpBefore: number;
  enemyHpAfter: number;
  defeatedEnemy: boolean;
  isOverkill: boolean;
  overkillAmount: number;
  isWarmup: boolean;
  isPersonalRecord: boolean;
  tags: readonly SetTag[];
}

// ---------------------------------------------------------------------------
// Enemy result snapshot.
// ---------------------------------------------------------------------------

export interface EnemyResult {
  id: string;
  name: string;
  maxHp: number;
  finalHp: number;
  totalDamage: number;
  defeated: boolean;
  /** Index into the input sets array; null if never defeated. */
  defeatedOnSetIndex: number | null;
  startingMood: EnemyMood;
  finalMood: EnemyMood;
  category: EnemyCategory;
}

// ---------------------------------------------------------------------------
// Momentum result.
// ---------------------------------------------------------------------------

export interface MomentumResult {
  before: number;
  decayApplied: number;
  afterDecay: number;
  gainBreakdown: MomentumGainBreakdown;
  afterGain: number;
  final: number;
  tierBefore: MomentumTier;
  tierAfter: MomentumTier;
  tierChanged: boolean;
  /**
   * True if the next quest should run with gentleMode (raised
   * fatigue floor + suppressed junk-volume penalty). Derived from
   * the comeback signal.
   */
  gentleModeActive: boolean;
}

// ---------------------------------------------------------------------------
// Reward packet (cosmetic + signalling — no items, no loot tables).
// ---------------------------------------------------------------------------

/**
 * `loreChance` is a deterministic 0..1 score derived from quest
 * characteristics. The orchestrator does not roll; a downstream
 * consumer with a seeded RNG decides whether a fragment unlocks.
 */
export interface QuestRewards {
  xp: number;
  momentumDelta: number;
  loreChance: number;
  equipmentAffinity: Readonly<Partial<Record<ExerciseArchetype, number>>>;
  /**
   * Bonus applied to the *next* quest's fatigue floor when > 0.
   * Earned by recovery / camp / disciplined-exit sessions.
   */
  recoveryBonus: number;
}

// ---------------------------------------------------------------------------
// Verdict — narrative labels, not ranks. Multiple coexist.
// ---------------------------------------------------------------------------

export type QuestVerdict =
  | 'Steady'
  | 'Disciplined Exit'
  | 'Held the Line'
  | 'PR Logged'
  | 'First of the Week'
  | 'Comeback Quest'
  | 'Warmth Returned'
  | 'Relentless'
  | 'Gentle Return'
  | 'Finisher';

// ---------------------------------------------------------------------------
// Telemetry — non-PII, derived counts. Used by the UX layer and
// (eventually) by the journal screen.
// ---------------------------------------------------------------------------

export interface QuestTelemetry {
  nowIso: string;
  questId: string;
  questKind: QuestKind;
  totalSets: number;
  workingSets: number;
  warmupSets: number;
  recoverySets: number;
  prSets: number;
  distinctArchetypes: number;
  distinctExercises: number;
  totalDurationSecondsLogged: number;
  enemyDefeated: boolean;
}

// ---------------------------------------------------------------------------
// runQuest output.
// ---------------------------------------------------------------------------

export interface RunQuestResult {
  enemyResult: EnemyResult | null;
  setResults: readonly SetResult[];
  /** Pool of fatigue points AFTER each set, in input order. */
  fatigueTimeline: readonly number[];
  totalDamage: number;
  questXp: QuestXpBreakdown;
  momentum: MomentumResult;
  verdicts: readonly QuestVerdict[];
  rewards: QuestRewards;
  telemetry: QuestTelemetry;
}

// ---------------------------------------------------------------------------
// momentumSession helper input/output (smaller surface used by
// callers that don't want the full runQuest pipeline).
// ---------------------------------------------------------------------------

export interface ResolveMomentumInput {
  priorMomentum: number;
  daysSinceLastQuest: number;
  questOutcome: 'full' | 'partial' | 'camp' | 'recovery' | 'abandoned';
  isReturnQuest?: boolean;
  disciplinedExit?: boolean;
  varietyBonus?: boolean;
  isFirstOfWeek?: boolean;
  gainedToday?: number;
}
