/**
 * In-memory game store for the MVP Workout RPG shell.
 *
 * NO persistence. NO async. NO network. The store holds the current
 * Quest's draft state; on `finishQuest()` it calls the pure
 * `runQuest()` orchestrator from `@dwhi/workout-domain` and stashes
 * the result for the reward screen to read.
 *
 * Zustand is already a project dependency — no new deps added.
 */

import { create } from 'zustand';
import { runQuest } from '@dwhi/workout-domain';
import type {
  ExerciseArchetype,
  RunQuestResult,
  SetInput,
} from '@dwhi/workout-domain';

import {
  DEFAULT_BODYWEIGHT_KG,
  DEFAULT_PRIOR_MOMENTUM,
  PUSH_DAY_BATTLES,
  PUSH_DAY_QUEST,
  SLUGGARD,
  type BattlePlan,
  type Variant,
} from '../fixtures/pushDayQuest';

// ---------------------------------------------------------------------------
// Public store shape
// ---------------------------------------------------------------------------

export type GamePhase =
  | 'home'
  | 'battle'
  | 'rest'
  | 'reward';

/** One row in the running log of logged sets. */
export interface LoggedSet {
  battleIndex: number;
  exerciseId: string;
  exerciseName: string;
  archetype: ExerciseArchetype;
  setIndexInBattle: number;
  reps: number;
  weightKg: number;
  isWarmup: boolean;
  isPersonalRecord: boolean;
}

export interface WorkoutGameState {
  phase: GamePhase;
  variant: Variant;
  bodyweightKg: number;
  priorMomentum: number;

  currentBattleIndex: number;
  currentSetIndexInBattle: number;
  draftReps: number;
  draftWeightKg: number;

  log: LoggedSet[];
  result: RunQuestResult | null;

  // -------- transitions --------
  startQuest: (variant: Variant) => void;
  setReps: (reps: number) => void;
  setWeight: (weightKg: number) => void;
  logCurrentSet: () => void;
  enterRest: () => void;
  endRest: () => void;
  finishQuest: () => void;
  returnToCamp: () => void;
}

// ---------------------------------------------------------------------------
// Selectors / derived
// ---------------------------------------------------------------------------

export function currentBattle(state: WorkoutGameState): BattlePlan {
  return PUSH_DAY_BATTLES[state.currentBattleIndex] ?? PUSH_DAY_BATTLES[0];
}

export function isLastSetOfQuest(state: WorkoutGameState): boolean {
  const battle = currentBattle(state);
  const lastBattle = state.currentBattleIndex === PUSH_DAY_BATTLES.length - 1;
  const lastSet = state.currentSetIndexInBattle === battle.setsPerBattle - 1;
  return lastBattle && lastSet;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function defaultDraftForBattle(battle: BattlePlan, variant: Variant): {
  reps: number;
  weightKg: number;
} {
  return {
    reps: battle.defaultReps,
    weightKg: variant === 'weighted' ? battle.defaultWeightKg : 0,
  };
}

function buildSetInputsFromLog(
  log: readonly LoggedSet[],
  variant: Variant,
  bodyweightKg: number,
): SetInput[] {
  return log.map((row) => {
    const battle = PUSH_DAY_BATTLES[row.battleIndex];
    const useWeighted = variant === 'weighted';
    return {
      exerciseId: row.exerciseId,
      exerciseName: row.exerciseName,
      modality: useWeighted ? 'weighted' : 'bodyweight',
      archetype: row.archetype,
      exercise: useWeighted ? battle.weightedProfile : battle.bodyweightProfile,
      setIndex: row.setIndexInBattle,
      sessionSetCount: 0, // overridden by orchestrator's accumulator
      reps: row.reps,
      weightKg: row.weightKg || undefined,
      bodyweightKg,
      isWarmup: row.isWarmup,
      isPersonalRecord: row.isPersonalRecord,
      exerciseChanged: row.setIndexInBattle === 0 && row.battleIndex > 0,
    };
  });
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const initialBattle = PUSH_DAY_BATTLES[0];
const initialDraft = defaultDraftForBattle(initialBattle, 'bodyweight');

export const useWorkoutGameStore = create<WorkoutGameState>((set, get) => ({
  phase: 'home',
  variant: 'bodyweight',
  bodyweightKg: DEFAULT_BODYWEIGHT_KG,
  priorMomentum: DEFAULT_PRIOR_MOMENTUM,

  currentBattleIndex: 0,
  currentSetIndexInBattle: 0,
  draftReps: initialDraft.reps,
  draftWeightKg: initialDraft.weightKg,

  log: [],
  result: null,

  startQuest: (variant) =>
    set(() => {
      const draft = defaultDraftForBattle(PUSH_DAY_BATTLES[0], variant);
      return {
        phase: 'battle',
        variant,
        currentBattleIndex: 0,
        currentSetIndexInBattle: 0,
        draftReps: draft.reps,
        draftWeightKg: draft.weightKg,
        log: [],
        result: null,
      };
    }),

  setReps: (reps) => set(() => ({ draftReps: Math.max(0, Math.floor(reps)) })),
  setWeight: (weightKg) =>
    set(() => ({ draftWeightKg: Math.max(0, Math.round(weightKg * 2) / 2) })),

  logCurrentSet: () => {
    const s = get();
    const battle = currentBattle(s);
    const useWeighted = s.variant === 'weighted';
    const exerciseId = useWeighted ? battle.weightedExerciseId : battle.bodyweightExerciseId;
    const exerciseName = useWeighted ? battle.weightedExerciseName : battle.bodyweightExerciseName;

    // Auto-detect a PR within this Quest only: the new set beats
    // every previously-logged set for the same exercise on rep
    // count (or, for weighted, on tonnage). Cross-Quest PRs would
    // need persistence; we explicitly do not have that yet.
    const sameExercisePrior = s.log.filter(
      (l) => l.exerciseId === exerciseId && !l.isWarmup,
    );
    const isPr = sameExercisePrior.every((l) => {
      if (useWeighted) {
        return s.draftReps * s.draftWeightKg > l.reps * l.weightKg;
      }
      return s.draftReps > l.reps;
    }) && sameExercisePrior.length > 0;

    set(() => ({
      log: [
        ...s.log,
        {
          battleIndex: s.currentBattleIndex,
          exerciseId,
          exerciseName,
          archetype: battle.archetype,
          setIndexInBattle: s.currentSetIndexInBattle,
          reps: s.draftReps,
          weightKg: s.draftWeightKg,
          isWarmup: false,
          isPersonalRecord: isPr,
        },
      ],
    }));
  },

  enterRest: () => set(() => ({ phase: 'rest' })),

  endRest: () => {
    const s = get();
    const battle = currentBattle(s);
    const wasLastSetInBattle = s.currentSetIndexInBattle >= battle.setsPerBattle - 1;
    const lastBattle = s.currentBattleIndex >= PUSH_DAY_BATTLES.length - 1;

    if (wasLastSetInBattle && lastBattle) {
      // Done — caller flips to reward via finishQuest().
      set(() => ({ phase: 'battle' }));
      return;
    }

    if (wasLastSetInBattle) {
      const nextBattle = PUSH_DAY_BATTLES[s.currentBattleIndex + 1];
      const draft = defaultDraftForBattle(nextBattle, s.variant);
      set(() => ({
        phase: 'battle',
        currentBattleIndex: s.currentBattleIndex + 1,
        currentSetIndexInBattle: 0,
        draftReps: draft.reps,
        draftWeightKg: draft.weightKg,
      }));
      return;
    }

    set(() => ({
      phase: 'battle',
      currentSetIndexInBattle: s.currentSetIndexInBattle + 1,
    }));
  },

  finishQuest: () => {
    const s = get();
    const sets = buildSetInputsFromLog(s.log, s.variant, s.bodyweightKg);
    const result = runQuest({
      quest: PUSH_DAY_QUEST,
      enemy: SLUGGARD,
      sets,
      priorMomentum: s.priorMomentum,
      daysSinceLastQuest: 1, // mock — no clock in the shell
      nowIso: '2026-05-19T10:00:00Z',
    });
    set(() => ({ phase: 'reward', result }));
  },

  returnToCamp: () =>
    set(() => ({
      phase: 'home',
      currentBattleIndex: 0,
      currentSetIndexInBattle: 0,
      log: [],
      result: null,
    })),
}));

// ---------------------------------------------------------------------------
// Pure helpers exported for tests + screens
// ---------------------------------------------------------------------------

export const __test__ = {
  buildSetInputsFromLog,
  defaultDraftForBattle,
};
