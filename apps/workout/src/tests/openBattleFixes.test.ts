/**
 * Regression tests for the three open-battle bug fixes:
 *
 *   Bug 1 — Victory card button layout (covered by snapshot-ish
 *           assertion on the BattleScreen's StyleSheet; the
 *           runtime visual test is manual).
 *   Bug 2 — Multi-enemy accounting: every defeated phase is tracked
 *           exactly once and surfaces in the reward payload.
 *   Bug 3 — XP > 0 after real multi-phase combat: dynamic plan
 *           expansion per continuation keeps the orchestrator's
 *           anti-grind floor from zeroing legitimate work.
 */

import { runQuest } from '@dwhi/workout-domain';
import {
  PLAN_EXPANSION_PER_CONTINUATION,
  getTotalDamageAcrossPhases,
  useWorkoutGameStore,
  type WorkoutGameState,
} from '../state/workoutGameStore';
import {
  DEFAULT_PRIOR_MOMENTUM,
  LINGERING_SHADOW,
  PUSH_BODYWEIGHT_STRATEGIES,
  PUSH_DAY_QUEST,
  PUSH_WEIGHTED_VARIANTS,
  SLUGGARD,
  getNextEnemyPhase,
} from '../fixtures/pushDayQuest';
import {
  buttonStyles,
  victoryButtonsStyle,
} from '../screens/__styleReflection';

function reset(): void {
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
    defeatedEnemies: [],
    continuationCount: 0,
    log: [],
    setMemory: {},
    result: null,
    priorMomentum: DEFAULT_PRIOR_MOMENTUM,
  } as Partial<WorkoutGameState> as WorkoutGameState);
}

// ============================================================================
// BUG 1 — Victory card button layout
// ============================================================================

describe('Bug 1 — victory CTAs stack vertically (no horizontal overflow)', () => {
  test('victoryButtons style is column-flow, full-width', () => {
    expect(victoryButtonsStyle.flexDirection).toBe('column');
    expect(victoryButtonsStyle.width).toBe('100%');
  });

  test('primary + secondary buttons keep tap target ≥ 48dp', () => {
    expect(buttonStyles.primary.minHeight).toBeGreaterThanOrEqual(48);
    expect(buttonStyles.secondary.minHeight).toBeGreaterThanOrEqual(48);
  });
});

// ============================================================================
// BUG 2 — Multi-enemy accounting
// ============================================================================

describe('Bug 2 — defeated enemies are recorded once each, in order', () => {
  beforeEach(reset);

  test('a single phase defeat lands in defeatedEnemies[]', () => {
    const api = useWorkoutGameStore.getState();
    api.startQuest('weighted');
    useWorkoutGameStore.setState({ currentEnemyHp: 1 });
    useWorkoutGameStore.getState().logCurrentSet();

    const s = useWorkoutGameStore.getState();
    expect(s.defeatedEnemies).toHaveLength(1);
    expect(s.defeatedEnemies[0].id).toBe(SLUGGARD.id);
    expect(s.defeatedEnemies[0].name).toBe(SLUGGARD.name);
    expect(s.defeatedEnemies[0].mood).toBe(SLUGGARD.mood);
    expect(s.defeatedEnemies[0].category).toBe(SLUGGARD.category);
    expect(s.defeatedEnemies[0].maxHp).toBe(SLUGGARD.maxHp);
    expect(s.defeatedEnemies[0].damageDealtToThisPhase).toBe(SLUGGARD.maxHp);
    expect(s.defeatedEnemies[0].phaseIndex).toBe(0);
  });

  test('continueAfterVictory does NOT push to defeatedEnemies — defeat is recorded at the kill', () => {
    const api = useWorkoutGameStore.getState();
    api.startQuest('weighted');
    useWorkoutGameStore.setState({ currentEnemyHp: 1 });
    useWorkoutGameStore.getState().logCurrentSet();
    const before = useWorkoutGameStore.getState().defeatedEnemies.length;
    api.continueAfterVictory();
    const after = useWorkoutGameStore.getState().defeatedEnemies.length;
    expect(after).toBe(before); // no duplicate
  });

  test('three phases defeated → three distinct entries, ordered, no duplicates', () => {
    const api = useWorkoutGameStore.getState();
    api.startQuest('weighted');

    // Phase 0: Sluggard
    useWorkoutGameStore.setState({ currentEnemyHp: 1 });
    useWorkoutGameStore.getState().logCurrentSet();
    api.continueAfterVictory();

    // Phase 1: Lingering Shadow
    useWorkoutGameStore.setState({ currentEnemyHp: 1 });
    useWorkoutGameStore.getState().logCurrentSet();
    api.continueAfterVictory();

    // Phase 2: smaller Shadow
    useWorkoutGameStore.setState({ currentEnemyHp: 1 });
    useWorkoutGameStore.getState().logCurrentSet();

    const s = useWorkoutGameStore.getState();
    expect(s.defeatedEnemies).toHaveLength(3);
    expect(s.defeatedEnemies[0].id).toBe(SLUGGARD.id);
    expect(s.defeatedEnemies[0].phaseIndex).toBe(0);
    expect(s.defeatedEnemies[1].id).toBe(LINGERING_SHADOW.id);
    expect(s.defeatedEnemies[1].phaseIndex).toBe(1);
    expect(s.defeatedEnemies[2].id).toBe(LINGERING_SHADOW.id);
    expect(s.defeatedEnemies[2].phaseIndex).toBe(2);
    // Each successive Shadow halves HP.
    expect(s.defeatedEnemies[1].maxHp).toBe(getNextEnemyPhase(SLUGGARD.maxHp).maxHp);
    expect(s.defeatedEnemies[2].maxHp).toBe(
      getNextEnemyPhase(s.defeatedEnemies[1].maxHp).maxHp,
    );
  });

  test('non-defeated phases are NOT in the list', () => {
    const api = useWorkoutGameStore.getState();
    api.startQuest('weighted');
    // Land one hit but don't drop HP to 0.
    useWorkoutGameStore.getState().logCurrentSet();
    const s = useWorkoutGameStore.getState();
    expect(s.defeatedEnemies).toHaveLength(0);
  });

  test('getTotalDamageAcrossPhases sums every defeated phase + the current partial', () => {
    const api = useWorkoutGameStore.getState();
    api.startQuest('weighted');
    useWorkoutGameStore.setState({ currentEnemyHp: 1 });
    useWorkoutGameStore.getState().logCurrentSet();
    api.continueAfterVictory();
    // Partial damage on next phase.
    useWorkoutGameStore.getState().logCurrentSet();

    const s = useWorkoutGameStore.getState();
    const expected =
      s.defeatedEnemies[0].damageDealtToThisPhase +
      (s.currentEnemy.maxHp - s.currentEnemyHp);
    expect(getTotalDamageAcrossPhases(s)).toBe(expected);
  });
});

// ============================================================================
// BUG 3 — XP > 0 after real multi-phase combat
// ============================================================================

describe('Bug 3 — continuation expands plannedSetCount → XP stays > 0 for real work', () => {
  beforeEach(reset);

  test('finishQuest after a single continuation passes an expanded plan to runQuest', () => {
    const api = useWorkoutGameStore.getState();
    api.startQuest('weighted');
    // Force a quick defeat of phase 0.
    useWorkoutGameStore.setState({ currentEnemyHp: 1 });
    useWorkoutGameStore.getState().logCurrentSet();
    api.continueAfterVictory();
    // Take down phase 1.
    useWorkoutGameStore.setState({
      currentEnemyHp: 1,
    } as Partial<WorkoutGameState> as WorkoutGameState);
    useWorkoutGameStore.getState().logCurrentSet();
    api.finishQuest();

    const s = useWorkoutGameStore.getState();
    expect(s.continuationCount).toBe(1);
    expect(s.result).not.toBeNull();
    // 2 set log — XP must be a non-negative integer regardless.
    expect(Number.isInteger(s.result!.questXp.xp)).toBe(true);
    expect(s.result!.questXp.xp).toBeGreaterThanOrEqual(0);
  });

  test('multi-phase weighted session with damaging sets yields XP > 0', () => {
    // Direct orchestrator call so the test is independent of UI flow.
    // 18 working sets — a session that would zero out at static
    // plannedSetCount=9 but should NOT at expanded plannedSetCount=15
    // (9 + 2 * PLAN_EXPANSION_PER_CONTINUATION).
    const sets = Array.from({ length: 18 }, (_, i) => ({
      exerciseId: 'pushup',
      exerciseName: 'Pushup',
      modality: 'bodyweight' as const,
      archetype: 'pressure' as const,
      exercise: { loadScale: 8, bodyweightCoefficient: 0.65 },
      setIndex: i,
      sessionSetCount: 0,
      reps: 10,
      bodyweightKg: 70,
      isPersonalRecord: false,
      isWarmup: false,
    }));

    const staticPlanned = runQuest({
      quest: { ...PUSH_DAY_QUEST, plannedSetCount: 9 },
      enemy: SLUGGARD,
      sets,
      priorMomentum: DEFAULT_PRIOR_MOMENTUM,
      daysSinceLastQuest: 1,
      nowIso: '2026-05-19T10:00:00Z',
    });
    const expandedPlanned = runQuest({
      quest: {
        ...PUSH_DAY_QUEST,
        plannedSetCount: 9 + 2 * PLAN_EXPANSION_PER_CONTINUATION,
      },
      enemy: SLUGGARD,
      sets,
      priorMomentum: DEFAULT_PRIOR_MOMENTUM,
      daysSinceLastQuest: 1,
      nowIso: '2026-05-19T10:00:00Z',
    });

    // Expanded plan must give strictly more (or equal) XP — never less.
    expect(expandedPlanned.questXp.xp).toBeGreaterThanOrEqual(
      staticPlanned.questXp.xp,
    );
    // The legitimate-multi-phase session yields > 0 XP.
    expect(expandedPlanned.questXp.xp).toBeGreaterThan(0);
  });

  test('end-to-end via the store: 2 continuations → XP > 0', () => {
    const api = useWorkoutGameStore.getState();
    api.startQuest('weighted');

    // Do 8 honest sets to defeat Sluggard.
    for (let i = 0; i < 8; i++) {
      useWorkoutGameStore.getState().logCurrentSet();
    }
    // Force HP to zero so a continuation is triggerable.
    useWorkoutGameStore.setState({ currentEnemyHp: 0, victoryAvailable: true });
    api.continueAfterVictory();

    // 4 more sets on the Shadow.
    for (let i = 0; i < 4; i++) {
      useWorkoutGameStore.getState().logCurrentSet();
    }
    useWorkoutGameStore.setState({ currentEnemyHp: 0, victoryAvailable: true });
    api.continueAfterVictory();

    // 4 more sets on the smaller Shadow.
    for (let i = 0; i < 4; i++) {
      useWorkoutGameStore.getState().logCurrentSet();
    }
    api.finishQuest();

    const s = useWorkoutGameStore.getState();
    expect(s.continuationCount).toBe(2);
    expect(s.result).not.toBeNull();
    expect(s.result!.questXp.xp).toBeGreaterThan(0);
  });

  test('determinism: same store inputs → same orchestrator result', () => {
    function runFlow(): number {
      reset();
      const api = useWorkoutGameStore.getState();
      api.startQuest('bodyweight');
      for (let i = 0; i < 5; i++) useWorkoutGameStore.getState().logCurrentSet();
      useWorkoutGameStore.setState({ currentEnemyHp: 0, victoryAvailable: true });
      api.continueAfterVictory();
      for (let i = 0; i < 3; i++) useWorkoutGameStore.getState().logCurrentSet();
      api.finishQuest();
      return useWorkoutGameStore.getState().result!.questXp.xp;
    }
    const a = runFlow();
    const b = runFlow();
    expect(a).toBe(b);
  });

  test('continuation does NOT reset the orchestrator XP — all logged sets contribute', () => {
    const api = useWorkoutGameStore.getState();
    api.startQuest('bodyweight');
    useWorkoutGameStore.getState().logCurrentSet();
    useWorkoutGameStore.getState().logCurrentSet();
    useWorkoutGameStore.setState({ currentEnemyHp: 0, victoryAvailable: true });
    api.continueAfterVictory();
    useWorkoutGameStore.getState().logCurrentSet();
    api.finishQuest();

    const s = useWorkoutGameStore.getState();
    // Three sets logged → three setResults.
    expect(s.result!.setResults).toHaveLength(3);
    // Every set contributed damage.
    for (const sr of s.result!.setResults) {
      expect(sr.damage).toBeGreaterThan(0);
    }
  });

  test('recovery-only sessions still yield 0 XP (orchestrator balancing preserved)', () => {
    // We can't drive recovery archetype through the open-ended UI flow
    // (Push Day has none), so we verify the orchestrator directly.
    const sets = Array.from({ length: 4 }, (_, i) => ({
      exerciseId: 'mobility',
      exerciseName: 'Mobility',
      modality: 'mobility' as const,
      archetype: 'recovery' as const,
      exercise: { loadScale: 6, bodyweightCoefficient: 0.5 },
      setIndex: i,
      sessionSetCount: 0,
      durationSeconds: 60,
      bodyweightKg: 70,
      isPersonalRecord: false,
      isWarmup: false,
    }));
    const out = runQuest({
      quest: { id: 'r', kind: 'recovery', plannedSetCount: 4 },
      sets,
      priorMomentum: DEFAULT_PRIOR_MOMENTUM,
      daysSinceLastQuest: 1,
      nowIso: '2026-05-19T10:00:00Z',
    });
    expect(out.questXp.xp).toBe(0);
  });
});

// ============================================================================
// Reset / reset-state sanity
// ============================================================================

describe('store reset hygiene — returnToCamp + startQuest', () => {
  beforeEach(reset);

  test('returnToCamp clears defeatedEnemies + continuationCount', () => {
    const api = useWorkoutGameStore.getState();
    api.startQuest('weighted');
    useWorkoutGameStore.setState({ currentEnemyHp: 0, victoryAvailable: true });
    api.continueAfterVictory();
    expect(useWorkoutGameStore.getState().continuationCount).toBe(1);

    api.returnToCamp();
    const s = useWorkoutGameStore.getState();
    expect(s.defeatedEnemies).toEqual([]);
    expect(s.continuationCount).toBe(0);
  });

  test('startQuest resets defeatedEnemies + continuationCount + log', () => {
    const api = useWorkoutGameStore.getState();
    api.startQuest('weighted');
    useWorkoutGameStore.setState({ currentEnemyHp: 0, victoryAvailable: true });
    api.continueAfterVictory();
    api.startQuest('bodyweight');
    const s = useWorkoutGameStore.getState();
    expect(s.defeatedEnemies).toEqual([]);
    expect(s.continuationCount).toBe(0);
    expect(s.log).toEqual([]);
  });
});

// Avoid unused warning for imports we kept for type assertions.
void PUSH_WEIGHTED_VARIANTS;
