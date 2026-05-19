/**
 * Workout game store — pure transition tests.
 *
 * We exercise the store's reducer-like API directly. No React
 * rendering needed; Zustand exposes `getState()` / `setState()`
 * for exactly this kind of test.
 */

import { useWorkoutGameStore, __test__ } from '../state/workoutGameStore';
import {
  DEFAULT_PRIOR_MOMENTUM,
  PUSH_DAY_BATTLES,
} from '../fixtures/pushDayQuest';

function reset(): void {
  // Fresh store between tests — phase back to home, log empty.
  useWorkoutGameStore.getState().returnToCamp();
}

describe('workoutGameStore — initial state', () => {
  beforeEach(reset);

  test('starts at home with the Push Day defaults', () => {
    const s = useWorkoutGameStore.getState();
    expect(s.phase).toBe('home');
    expect(s.variant).toBe('bodyweight');
    expect(s.priorMomentum).toBe(DEFAULT_PRIOR_MOMENTUM);
    expect(s.currentBattleIndex).toBe(0);
    expect(s.currentSetIndexInBattle).toBe(0);
    expect(s.log).toEqual([]);
    expect(s.result).toBeNull();
  });
});

describe('workoutGameStore — startQuest', () => {
  beforeEach(reset);

  test('startQuest(bodyweight) flips phase and seeds default reps', () => {
    useWorkoutGameStore.getState().startQuest('bodyweight');
    const s = useWorkoutGameStore.getState();
    expect(s.phase).toBe('battle');
    expect(s.variant).toBe('bodyweight');
    expect(s.draftReps).toBe(PUSH_DAY_BATTLES[0].defaultReps);
    expect(s.draftWeightKg).toBe(0); // bodyweight has no external weight
  });

  test('startQuest(weighted) seeds default weight', () => {
    useWorkoutGameStore.getState().startQuest('weighted');
    const s = useWorkoutGameStore.getState();
    expect(s.variant).toBe('weighted');
    expect(s.draftWeightKg).toBe(PUSH_DAY_BATTLES[0].defaultWeightKg);
  });
});

describe('workoutGameStore — logging sets + PR detection', () => {
  beforeEach(reset);

  test('logging the first set does NOT mark it as a PR (no prior)', () => {
    const api = useWorkoutGameStore.getState();
    api.startQuest('bodyweight');
    api.setReps(10);
    api.logCurrentSet();
    const log = useWorkoutGameStore.getState().log;
    expect(log).toHaveLength(1);
    expect(log[0].isPersonalRecord).toBe(false);
  });

  test('a higher-reps set on the same exercise marks PR', () => {
    const api = useWorkoutGameStore.getState();
    api.startQuest('bodyweight');
    api.setReps(8);
    api.logCurrentSet();
    api.setReps(12);
    api.logCurrentSet();
    const log = useWorkoutGameStore.getState().log;
    expect(log[0].isPersonalRecord).toBe(false);
    expect(log[1].isPersonalRecord).toBe(true);
  });

  test('a lower-reps set is NOT a PR', () => {
    const api = useWorkoutGameStore.getState();
    api.startQuest('bodyweight');
    api.setReps(12);
    api.logCurrentSet();
    api.setReps(8);
    api.logCurrentSet();
    const log = useWorkoutGameStore.getState().log;
    expect(log[1].isPersonalRecord).toBe(false);
  });
});

describe('workoutGameStore — rest flow', () => {
  beforeEach(reset);

  test('endRest advances within a battle', () => {
    const api = useWorkoutGameStore.getState();
    api.startQuest('bodyweight');
    api.enterRest();
    expect(useWorkoutGameStore.getState().phase).toBe('rest');
    api.endRest();
    const s = useWorkoutGameStore.getState();
    expect(s.phase).toBe('battle');
    expect(s.currentBattleIndex).toBe(0);
    expect(s.currentSetIndexInBattle).toBe(1);
  });

  test('endRest at end of battle advances to next battle and resets the index', () => {
    const api = useWorkoutGameStore.getState();
    api.startQuest('bodyweight');
    // Fast-forward to last set of battle 0.
    useWorkoutGameStore.setState({
      currentBattleIndex: 0,
      currentSetIndexInBattle: PUSH_DAY_BATTLES[0].setsPerBattle - 1,
      phase: 'rest',
    });
    api.endRest();
    const s = useWorkoutGameStore.getState();
    expect(s.phase).toBe('battle');
    expect(s.currentBattleIndex).toBe(1);
    expect(s.currentSetIndexInBattle).toBe(0);
    // Defaults for battle 1.
    expect(s.draftReps).toBe(PUSH_DAY_BATTLES[1].defaultReps);
  });
});

describe('workoutGameStore — finishQuest calls runQuest', () => {
  beforeEach(reset);

  test('end-to-end: 3 battles × 3 sets, finishQuest populates result', () => {
    const api = useWorkoutGameStore.getState();
    api.startQuest('bodyweight');

    for (let b = 0; b < PUSH_DAY_BATTLES.length; b++) {
      for (let i = 0; i < PUSH_DAY_BATTLES[b].setsPerBattle; i++) {
        const cur = useWorkoutGameStore.getState();
        cur.setReps(PUSH_DAY_BATTLES[b].defaultReps);
        cur.logCurrentSet();
        // simulate rest end without going through phase
        useWorkoutGameStore.setState((s) => ({
          currentBattleIndex:
            i === PUSH_DAY_BATTLES[b].setsPerBattle - 1 ? b + 1 : b,
          currentSetIndexInBattle:
            i === PUSH_DAY_BATTLES[b].setsPerBattle - 1 ? 0 : s.currentSetIndexInBattle + 1,
        }));
      }
    }
    api.finishQuest();
    const s = useWorkoutGameStore.getState();
    expect(s.phase).toBe('reward');
    expect(s.result).not.toBeNull();
    expect(s.result!.setResults.length).toBe(9);
    // Bounded multipliers
    for (const set of s.result!.setResults) {
      expect(set.fatigueMultiplier).toBeGreaterThanOrEqual(0.4);
      expect(set.fatigueMultiplier).toBeLessThanOrEqual(1.5);
    }
    // Quest XP is a non-negative integer
    expect(Number.isInteger(s.result!.questXp.xp)).toBe(true);
    expect(s.result!.questXp.xp).toBeGreaterThanOrEqual(0);
  });
});

describe('workoutGameStore — returnToCamp resets', () => {
  beforeEach(reset);

  test('clears log, result, indexes, and goes back to home', () => {
    const api = useWorkoutGameStore.getState();
    api.startQuest('bodyweight');
    api.setReps(8);
    api.logCurrentSet();
    api.returnToCamp();
    const s = useWorkoutGameStore.getState();
    expect(s.phase).toBe('home');
    expect(s.log).toEqual([]);
    expect(s.result).toBeNull();
    expect(s.currentBattleIndex).toBe(0);
    expect(s.currentSetIndexInBattle).toBe(0);
  });
});

describe('__test__.buildSetInputsFromLog (pure helper)', () => {
  test('translates log rows into orchestrator SetInputs', () => {
    const inputs = __test__.buildSetInputsFromLog(
      [
        {
          battleIndex: 0,
          exerciseId: 'pushup',
          exerciseName: 'Pushup',
          archetype: 'heavy',
          setIndexInBattle: 0,
          reps: 10,
          weightKg: 0,
          isWarmup: false,
          isPersonalRecord: true,
        },
        {
          battleIndex: 1,
          exerciseId: 'pike-pushup',
          exerciseName: 'Pike Pushup',
          archetype: 'heavy',
          setIndexInBattle: 0,
          reps: 8,
          weightKg: 0,
          isWarmup: false,
          isPersonalRecord: false,
        },
      ],
      'bodyweight',
      75,
    );
    expect(inputs).toHaveLength(2);
    expect(inputs[0].modality).toBe('bodyweight');
    expect(inputs[0].isPersonalRecord).toBe(true);
    expect(inputs[0].exerciseChanged).toBe(false);
    expect(inputs[1].exerciseChanged).toBe(true);
    expect(inputs[1].bodyweightKg).toBe(75);
  });
});
