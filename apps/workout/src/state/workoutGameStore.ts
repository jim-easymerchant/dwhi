/**
 * In-memory game store for the Workout RPG shell — open-ended
 * encounter model.
 *
 * NO persistence. NO async. NO network. Set memory survives only
 * for the running process; the next branch
 * (claude/workout-rpg-local-persistence-<token>) lifts it to disk.
 *
 * Spec:
 *   docs/workout-rpg/014-open-ended-encounters-and-set-memory.md
 *   docs/workout-rpg/012-battle-ux-and-feel.md (battle screen tone)
 *
 * Zustand is already a project dependency — no new deps added.
 */

import { create } from 'zustand';
import { runQuest } from '@dwhi/workout-domain';
import type {
  EnemyInput,
  ExerciseArchetype,
  RunQuestResult,
  SetInput,
} from '@dwhi/workout-domain';

import {
  DEFAULT_BODYWEIGHT_KG,
  DEFAULT_PRIOR_MOMENTUM,
  PUSH_DAY_QUEST,
  PUSH_ENCOUNTER,
  SLUGGARD,
  findVariant,
  getNextEnemyPhase,
  variantsFor,
  type ExerciseVariant,
  type Variant,
} from '../fixtures/pushDayQuest';

// ---------------------------------------------------------------------------
// Phase
// ---------------------------------------------------------------------------

export type GamePhase = 'home' | 'battle' | 'rest' | 'reward';

// ---------------------------------------------------------------------------
// Logged set + set memory
// ---------------------------------------------------------------------------

/** One row in the running log of logged sets within this Quest. */
export interface LoggedSet {
  exerciseId: string;
  exerciseName: string;
  archetype: ExerciseArchetype;
  modality: Variant;
  /** 0-based index *within the current variant* — drives orchestrator setIndex. */
  setIndexInVariant: number;
  /** 0-based index across the entire Quest — for display only. */
  setIndexInQuest: number;
  reps: number;
  weightKg: number;
  isWarmup: boolean;
  isPersonalRecord: boolean;
  /** Damage computed for this set by `runQuest()`. */
  damage: number;
  /** True if this set was the killing blow of a phase. */
  finisher: boolean;
  /** Enemy phase index at the time this set was logged. */
  enemyPhaseIndex: number;
}

/** A pre-fillable snapshot keyed by exercise + modality + variant + setIndex. */
export interface SetMemoryEntry {
  reps?: number;
  weightKg?: number;
  durationSeconds?: number;
  recordedAtIso: string;
}

export type SetMemory = Record<string, SetMemoryEntry>;

/** Stable memory key for a set position. */
export function memoryKey(input: {
  exerciseId: string;
  modality: Variant;
  variantId: string;
  setIndex: number;
}): string {
  return `${input.exerciseId}|${input.modality}|${input.variantId}|${input.setIndex}`;
}

/**
 * Look up a pre-fill for `(exerciseId, modality, variantId, setIndex)`.
 * Falls back to the most recent prior `setIndex` for the same key
 * before returning undefined.
 */
export function lookupSetMemory(
  memory: SetMemory,
  base: { exerciseId: string; modality: Variant; variantId: string; setIndex: number },
): SetMemoryEntry | undefined {
  const exact = memory[memoryKey(base)];
  if (exact) return exact;
  for (let i = base.setIndex - 1; i >= 0; i--) {
    const fallback = memory[memoryKey({ ...base, setIndex: i })];
    if (fallback) return fallback;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

const ENCOUNTER = PUSH_ENCOUNTER;
const STATIC_NOW_ISO = '2026-05-19T10:00:00Z';

export interface WorkoutGameState {
  // --- top-level navigation ---
  phase: GamePhase;

  // --- player profile (mocked) ---
  bodyweightKg: number;
  priorMomentum: number;

  // --- modality + variant ---
  modality: Variant;
  currentVariantId: string;
  currentSetIndexInVariant: number;

  // --- draft set inputs ---
  draftReps: number;
  draftWeightKg: number;

  // --- enemy state (UX side; orchestrator is canonical for rewards) ---
  currentEnemy: EnemyInput;
  currentEnemyHp: number;
  enemyPhaseIndex: number;
  lastSetDamage: number | null;
  victoryAvailable: boolean;

  // --- quest record ---
  log: LoggedSet[];
  setMemory: SetMemory;
  result: RunQuestResult | null;

  // --- transitions ---
  startQuest: (modality: Variant) => void;
  setReps: (reps: number) => void;
  setWeight: (weightKg: number) => void;
  logCurrentSet: () => void;
  enterRest: () => void;
  endRest: () => void;
  switchVariant: (variantId: string) => void;
  continueAfterVictory: () => void;
  finishEncounter: () => void;
  finishQuest: () => void;
  returnToCamp: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function variantFor(state: Pick<WorkoutGameState, 'modality' | 'currentVariantId'>): ExerciseVariant {
  return findVariant(ENCOUNTER, state.modality, state.currentVariantId);
}

function defaultsFor(
  modality: Variant,
  variantId: string,
  setIndex: number,
  memory: SetMemory,
): { reps: number; weightKg: number } {
  const variant = findVariant(ENCOUNTER, modality, variantId);
  const memoryHit = lookupSetMemory(memory, {
    exerciseId: variant.id,
    modality,
    variantId,
    setIndex,
  });
  return {
    reps: memoryHit?.reps ?? variant.defaultReps,
    weightKg:
      modality === 'weighted'
        ? memoryHit?.weightKg ?? variant.defaultWeightKg
        : 0,
  };
}

function buildSetInputsFromLog(
  log: readonly LoggedSet[],
  bodyweightKg: number,
): SetInput[] {
  // The first set after a variant change carries `exerciseChanged: true`
  // for fatigue refund + heavy first-set bonus eligibility.
  return log.map((row, i) => {
    const prior = i > 0 ? log[i - 1] : null;
    const exerciseChanged = prior !== null && prior.exerciseId !== row.exerciseId;
    const variant = ENCOUNTER.bodyweightStrategies.concat(
      ENCOUNTER.weightedVariants,
    ).find((v) => v.id === row.exerciseId);
    return {
      exerciseId: row.exerciseId,
      exerciseName: row.exerciseName,
      modality: row.modality,
      archetype: row.archetype,
      exercise: variant?.profile ?? { loadScale: 6, bodyweightCoefficient: 0.5 },
      setIndex: row.setIndexInVariant,
      sessionSetCount: 0, // orchestrator's accumulator computes precise points
      reps: row.reps,
      weightKg: row.weightKg || undefined,
      bodyweightKg,
      isWarmup: row.isWarmup,
      isPersonalRecord: row.isPersonalRecord,
      exerciseChanged,
    };
  });
}

/** A huge enemy used only as a *projection* target so set damage is
 * not capped at remaining HP. The shell tracks phase HP manually. */
const PROJECTION_ENEMY: EnemyInput = {
  ...SLUGGARD,
  maxHp: 1_000_000,
};

function projectFinalSetDamage(
  log: readonly LoggedSet[],
  bodyweightKg: number,
  priorMomentum: number,
): number {
  if (log.length === 0) return 0;
  const sets = buildSetInputsFromLog(log, bodyweightKg);
  const projection = runQuest({
    quest: PUSH_DAY_QUEST,
    enemy: PROJECTION_ENEMY,
    sets,
    priorMomentum,
    daysSinceLastQuest: 1,
    nowIso: STATIC_NOW_ISO,
  });
  return projection.setResults[projection.setResults.length - 1]?.damage ?? 0;
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const INITIAL_VARIANT = ENCOUNTER.bodyweightStrategies[0];

const initialDefaults = defaultsFor('bodyweight', INITIAL_VARIANT.id, 0, {});

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useWorkoutGameStore = create<WorkoutGameState>((set, get) => ({
  phase: 'home',
  bodyweightKg: DEFAULT_BODYWEIGHT_KG,
  priorMomentum: DEFAULT_PRIOR_MOMENTUM,

  modality: 'bodyweight',
  currentVariantId: INITIAL_VARIANT.id,
  currentSetIndexInVariant: 0,

  draftReps: initialDefaults.reps,
  draftWeightKg: initialDefaults.weightKg,

  currentEnemy: SLUGGARD,
  currentEnemyHp: SLUGGARD.maxHp,
  enemyPhaseIndex: 0,
  lastSetDamage: null,
  victoryAvailable: false,

  log: [],
  setMemory: {},
  result: null,

  // -------------------------------------------------------------------
  startQuest: (modality) => {
    const list = variantsFor(ENCOUNTER, modality);
    const firstVariant = list[0];
    const draft = defaultsFor(modality, firstVariant.id, 0, get().setMemory);
    set(() => ({
      phase: 'battle',
      modality,
      currentVariantId: firstVariant.id,
      currentSetIndexInVariant: 0,
      draftReps: draft.reps,
      draftWeightKg: draft.weightKg,
      currentEnemy: SLUGGARD,
      currentEnemyHp: SLUGGARD.maxHp,
      enemyPhaseIndex: 0,
      lastSetDamage: null,
      victoryAvailable: false,
      log: [],
      result: null,
    }));
  },

  // -------------------------------------------------------------------
  setReps: (reps) => set(() => ({ draftReps: Math.max(0, Math.floor(reps)) })),

  setWeight: (weightKg) =>
    set(() => ({ draftWeightKg: Math.max(0, Math.round(weightKg * 2) / 2) })),

  // -------------------------------------------------------------------
  logCurrentSet: () => {
    const s = get();
    if (s.draftReps <= 0) return;

    const variant = variantFor(s);

    // Auto-detect a PR within this Quest only.
    const sameExercisePrior = s.log.filter(
      (l) => l.exerciseId === variant.id && !l.isWarmup,
    );
    const isPr =
      sameExercisePrior.length > 0 &&
      sameExercisePrior.every((l) => {
        if (s.modality === 'weighted') {
          return s.draftReps * s.draftWeightKg > l.reps * l.weightKg;
        }
        return s.draftReps > l.reps;
      });

    const provisionalRow: LoggedSet = {
      exerciseId: variant.id,
      exerciseName: variant.name,
      archetype: variant.archetype,
      modality: s.modality,
      setIndexInVariant: s.currentSetIndexInVariant,
      setIndexInQuest: s.log.length,
      reps: s.draftReps,
      weightKg: s.draftWeightKg,
      isWarmup: false,
      isPersonalRecord: isPr,
      damage: 0, // populated below
      finisher: false,
      enemyPhaseIndex: s.enemyPhaseIndex,
    };

    const probeLog = [...s.log, provisionalRow];
    const damage = projectFinalSetDamage(probeLog, s.bodyweightKg, s.priorMomentum);
    provisionalRow.damage = damage;

    const newPhaseHp = Math.max(0, s.currentEnemyHp - damage);
    const finisher = newPhaseHp === 0 && s.currentEnemyHp > 0;
    provisionalRow.finisher = finisher;

    const memKey = memoryKey({
      exerciseId: variant.id,
      modality: s.modality,
      variantId: variant.id,
      setIndex: s.currentSetIndexInVariant,
    });
    const memoryEntry: SetMemoryEntry = {
      reps: s.draftReps,
      weightKg: s.modality === 'weighted' ? s.draftWeightKg : undefined,
      recordedAtIso: STATIC_NOW_ISO,
    };

    // Pre-fill next set's draft from memory (the just-recorded entry
    // sets up the NEXT setIndex via the same-as-previous fallback).
    const nextSetIndex = s.currentSetIndexInVariant + 1;
    const nextMemory = { ...s.setMemory, [memKey]: memoryEntry };
    const nextDraft = defaultsFor(
      s.modality,
      variant.id,
      nextSetIndex,
      nextMemory,
    );

    set(() => ({
      log: [...s.log, provisionalRow],
      setMemory: nextMemory,
      currentSetIndexInVariant: nextSetIndex,
      currentEnemyHp: newPhaseHp,
      lastSetDamage: damage,
      victoryAvailable: newPhaseHp === 0,
      draftReps: nextDraft.reps,
      draftWeightKg: nextDraft.weightKg,
    }));
  },

  // -------------------------------------------------------------------
  enterRest: () => set(() => ({ phase: 'rest' })),

  endRest: () => set(() => ({ phase: 'battle' })),

  // -------------------------------------------------------------------
  switchVariant: (variantId) => {
    const s = get();
    const list = variantsFor(ENCOUNTER, s.modality);
    const found = list.find((v) => v.id === variantId);
    if (!found) return;
    const draft = defaultsFor(s.modality, found.id, 0, s.setMemory);
    set(() => ({
      currentVariantId: found.id,
      currentSetIndexInVariant: 0,
      draftReps: draft.reps,
      draftWeightKg: draft.weightKg,
    }));
  },

  // -------------------------------------------------------------------
  continueAfterVictory: () => {
    const s = get();
    if (!s.victoryAvailable) return;
    const nextEnemy = getNextEnemyPhase(s.currentEnemy.maxHp);
    set(() => ({
      enemyPhaseIndex: s.enemyPhaseIndex + 1,
      currentEnemy: nextEnemy,
      currentEnemyHp: nextEnemy.maxHp,
      victoryAvailable: false,
      lastSetDamage: null,
    }));
  },

  // -------------------------------------------------------------------
  finishEncounter: () => {
    // For MVP, an encounter is the whole quest. Hand off to
    // finishQuest so the orchestrator computes the reward packet.
    get().finishQuest();
  },

  // -------------------------------------------------------------------
  finishQuest: () => {
    const s = get();
    if (s.log.length === 0) return;
    const sets = buildSetInputsFromLog(s.log, s.bodyweightKg);
    const result = runQuest({
      quest: PUSH_DAY_QUEST,
      enemy: SLUGGARD,
      sets,
      priorMomentum: s.priorMomentum,
      daysSinceLastQuest: 1,
      nowIso: STATIC_NOW_ISO,
    });
    set(() => ({ phase: 'reward', result }));
  },

  // -------------------------------------------------------------------
  returnToCamp: () => {
    const s = get();
    const draft = defaultsFor('bodyweight', INITIAL_VARIANT.id, 0, s.setMemory);
    set(() => ({
      phase: 'home',
      modality: 'bodyweight',
      currentVariantId: INITIAL_VARIANT.id,
      currentSetIndexInVariant: 0,
      draftReps: draft.reps,
      draftWeightKg: draft.weightKg,
      currentEnemy: SLUGGARD,
      currentEnemyHp: SLUGGARD.maxHp,
      enemyPhaseIndex: 0,
      lastSetDamage: null,
      victoryAvailable: false,
      log: [],
      result: null,
      // setMemory is intentionally preserved across return-to-camp.
    }));
  },
}));

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export function getCurrentVariant(state: WorkoutGameState): ExerciseVariant {
  return variantFor(state);
}

export function getAvailableVariants(
  state: Pick<WorkoutGameState, 'modality'>,
): readonly ExerciseVariant[] {
  return variantsFor(ENCOUNTER, state.modality);
}

export function getBattleProgress(state: WorkoutGameState): number {
  const max = state.currentEnemy.maxHp;
  if (max <= 0) return 1;
  return Math.min(1, Math.max(0, 1 - state.currentEnemyHp / max));
}

// ---------------------------------------------------------------------------
// Test helpers (pure)
// ---------------------------------------------------------------------------

export const __test__ = {
  buildSetInputsFromLog,
  defaultsFor,
  projectFinalSetDamage,
  memoryKey,
  lookupSetMemory,
};
