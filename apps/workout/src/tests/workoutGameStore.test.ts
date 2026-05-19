/**
 * Workout game store — open-ended encounter behaviour.
 *
 * We exercise the Zustand store directly through getState() /
 * setState(); no React rendering needed.
 */

import {
  __test__,
  lookupSetMemory,
  memoryKey,
  useWorkoutGameStore,
  type WorkoutGameState,
} from '../state/workoutGameStore';
import {
  DEFAULT_PRIOR_MOMENTUM,
  PUSH_BODYWEIGHT_STRATEGIES,
  PUSH_WEIGHTED_VARIANTS,
  SLUGGARD,
  LINGERING_SHADOW,
} from '../fixtures/pushDayQuest';

function reset(): void {
  // Full reset between tests — including the setMemory accumulator.
  useWorkoutGameStore.setState({
    phase: 'home',
    modality: 'bodyweight',
    currentVariantId: PUSH_BODYWEIGHT_STRATEGIES[0].id,
    currentSetIndexInVariant: 0,
    draftReps: PUSH_BODYWEIGHT_STRATEGIES[0].defaultReps,
    draftWeightKg: 0,
    currentEnemy: SLUGGARD,
    currentEnemyHp: SLUGGARD.maxHp,
    enemyPhaseIndex: 0,
    lastSetDamage: null,
    victoryAvailable: false,
    log: [],
    setMemory: {},
    result: null,
    priorMomentum: DEFAULT_PRIOR_MOMENTUM,
  } as Partial<WorkoutGameState> as WorkoutGameState);
}

describe('store — initial state', () => {
  beforeEach(reset);

  test('starts at home with the first bodyweight strategy', () => {
    const s = useWorkoutGameStore.getState();
    expect(s.phase).toBe('home');
    expect(s.modality).toBe('bodyweight');
    expect(s.currentVariantId).toBe(PUSH_BODYWEIGHT_STRATEGIES[0].id);
    expect(s.currentEnemyHp).toBe(SLUGGARD.maxHp);
    expect(s.victoryAvailable).toBe(false);
    expect(s.setMemory).toEqual({});
    expect(s.log).toEqual([]);
  });
});

describe('store — startQuest', () => {
  beforeEach(reset);

  test('bodyweight: phase → battle, first strategy preselected', () => {
    useWorkoutGameStore.getState().startQuest('bodyweight');
    const s = useWorkoutGameStore.getState();
    expect(s.phase).toBe('battle');
    expect(s.modality).toBe('bodyweight');
    expect(s.currentVariantId).toBe(PUSH_BODYWEIGHT_STRATEGIES[0].id);
    expect(s.draftReps).toBe(PUSH_BODYWEIGHT_STRATEGIES[0].defaultReps);
    expect(s.draftWeightKg).toBe(0);
  });

  test('weighted: first equipment variant preselected with its weight', () => {
    useWorkoutGameStore.getState().startQuest('weighted');
    const s = useWorkoutGameStore.getState();
    expect(s.modality).toBe('weighted');
    expect(s.currentVariantId).toBe(PUSH_WEIGHTED_VARIANTS[0].id);
    expect(s.draftWeightKg).toBe(PUSH_WEIGHTED_VARIANTS[0].defaultWeightKg);
  });
});

describe('store — open-ended sets (no forced advance)', () => {
  beforeEach(reset);

  test('logging 10 sets on the same variant does NOT switch exercise', () => {
    const api = useWorkoutGameStore.getState();
    api.startQuest('bodyweight');
    const initialVariant = useWorkoutGameStore.getState().currentVariantId;

    for (let i = 0; i < 10; i++) {
      const cur = useWorkoutGameStore.getState();
      cur.setReps(cur.draftReps); // honour the prefilled value
      cur.logCurrentSet();
    }

    const s = useWorkoutGameStore.getState();
    expect(s.currentVariantId).toBe(initialVariant); // never switched
    expect(s.log).toHaveLength(10);
    // All 10 sets are against the same exerciseId.
    const distinct = new Set(s.log.map((row) => row.exerciseId));
    expect(distinct.size).toBe(1);
    // setIndexInVariant ticks up monotonically.
    expect(s.log[0].setIndexInVariant).toBe(0);
    expect(s.log[9].setIndexInVariant).toBe(9);
    expect(s.currentSetIndexInVariant).toBe(10);
  });
});

describe('store — set memory + prefill', () => {
  beforeEach(reset);

  test('each logged set updates memory keyed by exercise+modality+variant+setIndex', () => {
    const api = useWorkoutGameStore.getState();
    api.startQuest('weighted');
    const variantId = useWorkoutGameStore.getState().currentVariantId;

    useWorkoutGameStore.getState().setReps(10);
    useWorkoutGameStore.getState().setWeight(40);
    useWorkoutGameStore.getState().logCurrentSet();

    useWorkoutGameStore.getState().setReps(10);
    useWorkoutGameStore.getState().setWeight(30);
    useWorkoutGameStore.getState().logCurrentSet();

    useWorkoutGameStore.getState().setReps(10);
    useWorkoutGameStore.getState().setWeight(20);
    useWorkoutGameStore.getState().logCurrentSet();

    const memory = useWorkoutGameStore.getState().setMemory;
    expect(memory[memoryKey({ exerciseId: variantId, modality: 'weighted', variantId, setIndex: 0 })]).toMatchObject({
      reps: 10, weightKg: 40,
    });
    expect(memory[memoryKey({ exerciseId: variantId, modality: 'weighted', variantId, setIndex: 1 })]).toMatchObject({
      reps: 10, weightKg: 30,
    });
    expect(memory[memoryKey({ exerciseId: variantId, modality: 'weighted', variantId, setIndex: 2 })]).toMatchObject({
      reps: 10, weightKg: 20,
    });
  });

  test('next set draft is prefilled from memory of the previous setIndex', () => {
    const api = useWorkoutGameStore.getState();
    api.startQuest('weighted');
    useWorkoutGameStore.getState().setReps(8);
    useWorkoutGameStore.getState().setWeight(45);
    useWorkoutGameStore.getState().logCurrentSet();

    // After log, set 1 is the new index. Draft should fall back to
    // set 0's memory (no exact set-1 history yet).
    const after = useWorkoutGameStore.getState();
    expect(after.currentSetIndexInVariant).toBe(1);
    expect(after.draftReps).toBe(8);
    expect(after.draftWeightKg).toBe(45);
  });

  test('memory persists across returnToCamp (within-session memory only)', () => {
    const api = useWorkoutGameStore.getState();
    api.startQuest('weighted');
    useWorkoutGameStore.getState().setReps(7);
    useWorkoutGameStore.getState().setWeight(35);
    useWorkoutGameStore.getState().logCurrentSet();
    const memoryBefore = useWorkoutGameStore.getState().setMemory;
    api.returnToCamp();
    const memoryAfter = useWorkoutGameStore.getState().setMemory;
    expect(memoryAfter).toEqual(memoryBefore);
  });

  test('lookupSetMemory falls back to most recent prior setIndex', () => {
    const memory = {
      'pushup|bodyweight|pushup|0': { reps: 10, recordedAtIso: 'x' },
      'pushup|bodyweight|pushup|2': { reps: 8, recordedAtIso: 'x' },
    };
    // setIndex 5 → fall back to 2 (most recent below).
    const hit = lookupSetMemory(memory, {
      exerciseId: 'pushup',
      modality: 'bodyweight',
      variantId: 'pushup',
      setIndex: 5,
    });
    expect(hit?.reps).toBe(8);

    // setIndex 1 → fall back to 0.
    const fallback = lookupSetMemory(memory, {
      exerciseId: 'pushup',
      modality: 'bodyweight',
      variantId: 'pushup',
      setIndex: 1,
    });
    expect(fallback?.reps).toBe(10);
  });
});

describe('store — switchVariant', () => {
  beforeEach(reset);

  test('switching strategy resets setIndexInVariant to 0', () => {
    const api = useWorkoutGameStore.getState();
    api.startQuest('bodyweight');
    useWorkoutGameStore.getState().setReps(10);
    useWorkoutGameStore.getState().logCurrentSet();
    useWorkoutGameStore.getState().logCurrentSet();
    expect(useWorkoutGameStore.getState().currentSetIndexInVariant).toBe(2);
    api.switchVariant('diamond-pushup');
    const s = useWorkoutGameStore.getState();
    expect(s.currentVariantId).toBe('diamond-pushup');
    expect(s.currentSetIndexInVariant).toBe(0);
    // Defaults come from diamond-pushup's defaultReps when there's no memory.
    expect(s.draftReps).toBe(10);
  });

  test('switching to an unknown variant is a no-op (silent fallback)', () => {
    const api = useWorkoutGameStore.getState();
    api.startQuest('bodyweight');
    const before = useWorkoutGameStore.getState().currentVariantId;
    api.switchVariant('does-not-exist');
    expect(useWorkoutGameStore.getState().currentVariantId).toBe(before);
  });
});

describe('store — visible damage & HP progress', () => {
  beforeEach(reset);

  test('logCurrentSet decrements currentEnemyHp by the projected damage', () => {
    const api = useWorkoutGameStore.getState();
    api.startQuest('weighted');
    const initialHp = useWorkoutGameStore.getState().currentEnemyHp;
    useWorkoutGameStore.getState().logCurrentSet();
    const s = useWorkoutGameStore.getState();
    expect(s.lastSetDamage).not.toBeNull();
    expect(s.lastSetDamage!).toBeGreaterThan(0);
    expect(s.currentEnemyHp).toBeCloseTo(initialHp - s.lastSetDamage!, 5);
  });

  test('zero-rep set is rejected (no damage, no log entry)', () => {
    const api = useWorkoutGameStore.getState();
    api.startQuest('bodyweight');
    useWorkoutGameStore.getState().setReps(0);
    useWorkoutGameStore.getState().logCurrentSet();
    const s = useWorkoutGameStore.getState();
    expect(s.log).toHaveLength(0);
    expect(s.currentEnemyHp).toBe(SLUGGARD.maxHp);
  });
});

describe('store — enemy defeat & continuation', () => {
  beforeEach(reset);

  test('enough damage flips victoryAvailable to true', () => {
    const api = useWorkoutGameStore.getState();
    api.startQuest('weighted');
    // Force HP very low so a single set tips it.
    useWorkoutGameStore.setState({ currentEnemyHp: 1 });
    useWorkoutGameStore.getState().logCurrentSet();
    const s = useWorkoutGameStore.getState();
    expect(s.victoryAvailable).toBe(true);
    expect(s.currentEnemyHp).toBe(0);
    expect(s.log[s.log.length - 1].finisher).toBe(true);
  });

  test('continueAfterVictory spawns a Lingering Shadow phase', () => {
    const api = useWorkoutGameStore.getState();
    api.startQuest('weighted');
    useWorkoutGameStore.setState({ currentEnemyHp: 1 });
    useWorkoutGameStore.getState().logCurrentSet();
    api.continueAfterVictory();
    const s = useWorkoutGameStore.getState();
    expect(s.enemyPhaseIndex).toBe(1);
    expect(s.currentEnemy.id).toBe(LINGERING_SHADOW.id);
    expect(s.currentEnemyHp).toBe(s.currentEnemy.maxHp);
    expect(s.victoryAvailable).toBe(false);
  });

  test('continueAfterVictory is a no-op when no victory is available', () => {
    const api = useWorkoutGameStore.getState();
    api.startQuest('weighted');
    const before = useWorkoutGameStore.getState();
    api.continueAfterVictory();
    const after = useWorkoutGameStore.getState();
    expect(after.enemyPhaseIndex).toBe(before.enemyPhaseIndex);
    expect(after.currentEnemy.id).toBe(before.currentEnemy.id);
  });

  test('finishEncounter routes through finishQuest and reaches reward phase', () => {
    const api = useWorkoutGameStore.getState();
    api.startQuest('weighted');
    useWorkoutGameStore.getState().logCurrentSet();
    api.finishEncounter();
    const s = useWorkoutGameStore.getState();
    expect(s.phase).toBe('reward');
    expect(s.result).not.toBeNull();
  });
});

describe('store — finishQuest calls runQuest', () => {
  beforeEach(reset);

  test('end-to-end mixed strategies, finishQuest populates result', () => {
    const api = useWorkoutGameStore.getState();
    api.startQuest('bodyweight');
    // 4 pushup sets
    for (let i = 0; i < 4; i++) useWorkoutGameStore.getState().logCurrentSet();
    api.switchVariant('pike-pushup');
    // 3 pike sets
    for (let i = 0; i < 3; i++) useWorkoutGameStore.getState().logCurrentSet();
    api.switchVariant('diamond-pushup');
    // 3 diamond sets
    for (let i = 0; i < 3; i++) useWorkoutGameStore.getState().logCurrentSet();
    api.finishQuest();

    const s = useWorkoutGameStore.getState();
    expect(s.phase).toBe('reward');
    expect(s.result).not.toBeNull();
    expect(s.result!.setResults).toHaveLength(10);
    // First set of each variant should carry exerciseChanged after the switch.
    expect(s.result!.setResults[4].exerciseId).toBe('pike-pushup');
    expect(s.result!.setResults[7].exerciseId).toBe('diamond-pushup');
    // Bounded multipliers.
    for (const sr of s.result!.setResults) {
      expect(sr.fatigueMultiplier).toBeGreaterThanOrEqual(0.4);
      expect(sr.fatigueMultiplier).toBeLessThanOrEqual(1.5);
    }
  });

  test('finishQuest with empty log is a no-op (does not crash)', () => {
    const api = useWorkoutGameStore.getState();
    api.startQuest('bodyweight');
    api.finishQuest();
    const s = useWorkoutGameStore.getState();
    expect(s.phase).toBe('battle'); // no-op — stayed in battle
    expect(s.result).toBeNull();
  });
});

describe('store — rest flow', () => {
  beforeEach(reset);

  test('enterRest / endRest just toggle phase', () => {
    const api = useWorkoutGameStore.getState();
    api.startQuest('bodyweight');
    api.enterRest();
    expect(useWorkoutGameStore.getState().phase).toBe('rest');
    api.endRest();
    expect(useWorkoutGameStore.getState().phase).toBe('battle');
  });
});

describe('__test__.buildSetInputsFromLog', () => {
  test('exerciseChanged fires on the first set after a variant switch', () => {
    const inputs = __test__.buildSetInputsFromLog(
      [
        {
          exerciseId: 'pushup',
          exerciseName: 'Pushup',
          archetype: 'pressure',
          modality: 'bodyweight',
          setIndexInVariant: 0,
          setIndexInQuest: 0,
          reps: 10,
          weightKg: 0,
          isWarmup: false,
          isPersonalRecord: false,
          damage: 0,
          finisher: false,
          enemyPhaseIndex: 0,
        },
        {
          exerciseId: 'pushup',
          exerciseName: 'Pushup',
          archetype: 'pressure',
          modality: 'bodyweight',
          setIndexInVariant: 1,
          setIndexInQuest: 1,
          reps: 10,
          weightKg: 0,
          isWarmup: false,
          isPersonalRecord: false,
          damage: 0,
          finisher: false,
          enemyPhaseIndex: 0,
        },
        {
          exerciseId: 'pike-pushup',
          exerciseName: 'Pike Pushup',
          archetype: 'pressure',
          modality: 'bodyweight',
          setIndexInVariant: 0,
          setIndexInQuest: 2,
          reps: 8,
          weightKg: 0,
          isWarmup: false,
          isPersonalRecord: false,
          damage: 0,
          finisher: false,
          enemyPhaseIndex: 0,
        },
      ],
      75,
    );
    expect(inputs[0].exerciseChanged).toBe(false);
    expect(inputs[1].exerciseChanged).toBe(false);
    expect(inputs[2].exerciseChanged).toBe(true);
  });
});
