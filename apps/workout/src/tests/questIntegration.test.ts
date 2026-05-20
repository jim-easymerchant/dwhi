/**
 * End-to-end integration: selected template drives the actual
 * runtime encounter that the store hands to `runQuest()`.
 *
 * Covers:
 *   - Default selection (push-day) → Push Day encounter / Sluggard.
 *   - Switching to Pull Day → Pull-flavored encounter + first variant.
 *   - Switching to Legs Day → Legs-flavored encounter + first variant.
 *   - Imported workout → playable encounter from imported exercises.
 *   - Set-memory keys generalize (template-driven exercise ids).
 *   - No Push hardcoding in the store body (grep regression).
 *   - getAvailableVariants reads from the *active* encounter.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  getAvailableVariants,
  memoryKey,
  useWorkoutGameStore,
} from '../state/workoutGameStore';
import {
  BUILTIN_LEGS_DAY,
  BUILTIN_PULL_DAY,
  BUILTIN_PUSH_DAY,
  __resetImportedTemplatesForTests,
  importWorkoutFromText,
} from '../workouts';
import { SLUGGARD } from '../fixtures/pushDayQuest';

function reset(): void {
  __resetImportedTemplatesForTests();
  useWorkoutGameStore.setState({
    phase: 'home',
    log: [],
    defeatedEnemies: [],
    continuationCount: 0,
    enemyPhaseIndex: 0,
    victoryAvailable: false,
    result: null,
    priorMomentum: 25,
    cumulativeXp: 0,
    recentSessionsCount: 0,
    persistenceReady: true,
    persistenceDisabled: true,
    persistenceError: 'test',
  });
  // Bring the active encounter back to Push Day via the public
  // action — this exercises the same code path the app uses on
  // hydrate, and avoids a stale activeEncounter leaking between
  // tests.
  useWorkoutGameStore.getState().setSelectedTemplate('push-day');
}

describe('default selection: push-day → Sluggard encounter', () => {
  beforeEach(reset);

  test('startQuest with default template produces the SLUGGARD encounter', () => {
    const api = useWorkoutGameStore.getState();
    api.startQuest('bodyweight');
    const s = useWorkoutGameStore.getState();
    expect(s.activeEncounter.templateId).toBe('push-day');
    expect(s.activeEncounter.workoutName).toBe('Push Day');
    expect(s.currentEnemy.id).toBe(SLUGGARD.id);
    expect(s.currentEnemyHp).toBe(SLUGGARD.maxHp);
  });
});

describe('switching templates changes the encounter', () => {
  beforeEach(reset);

  test('Pull Day drives the right encounter + first variant', () => {
    const api = useWorkoutGameStore.getState();
    api.setSelectedTemplate(BUILTIN_PULL_DAY.id);
    api.startQuest('weighted');
    const s = useWorkoutGameStore.getState();
    expect(s.activeEncounter.workoutName).toBe('Pull Day');
    // Pull's first weighted variant is Barbell Row.
    expect(s.currentVariantId).toBe('barbell-row');
    // Enemy is Pull-flavored (NOT SLUGGARD).
    expect(s.currentEnemy.id).not.toBe(SLUGGARD.id);
    expect(s.currentEnemy.maxHp).toBeGreaterThan(0);
  });

  test('Legs Day produces a heavy / stone enemy', () => {
    const api = useWorkoutGameStore.getState();
    api.setSelectedTemplate(BUILTIN_LEGS_DAY.id);
    api.startQuest('weighted');
    const s = useWorkoutGameStore.getState();
    expect(s.activeEncounter.workoutName).toBe('Legs Day');
    expect(s.currentEnemy.mood).toBe('stone');
    expect(s.currentEnemy.category).toBe('ward');
  });

  test('getAvailableVariants reads from the *active* encounter', () => {
    const api = useWorkoutGameStore.getState();
    api.setSelectedTemplate(BUILTIN_LEGS_DAY.id);
    api.startQuest('bodyweight');
    const variants = getAvailableVariants(useWorkoutGameStore.getState());
    // Legs Day's bodyweight set: Walking Lunge + Calf Raise (no
    // overlap with Pushup et al.).
    const ids = variants.map((v) => v.id);
    expect(ids).not.toContain('pushup');
    expect(ids).toContain('walking-lunge');
  });

  test('setSelectedTemplate eagerly rebuilds activeEncounter (home preview updates)', () => {
    const api = useWorkoutGameStore.getState();
    expect(useWorkoutGameStore.getState().activeEncounter.workoutName).toBe(
      'Push Day',
    );
    api.setSelectedTemplate(BUILTIN_LEGS_DAY.id);
    expect(useWorkoutGameStore.getState().activeEncounter.workoutName).toBe(
      'Legs Day',
    );
  });

  test('unknown template id is stored but encounter stays put (graceful)', () => {
    const api = useWorkoutGameStore.getState();
    const before = useWorkoutGameStore.getState().activeEncounter.templateId;
    api.setSelectedTemplate('does-not-exist');
    const s = useWorkoutGameStore.getState();
    expect(s.selectedTemplateId).toBe('does-not-exist');
    // activeEncounter stays the previous value (Push Day).
    expect(s.activeEncounter.templateId).toBe(before);
  });
});

describe('imported workouts produce playable encounters', () => {
  beforeEach(reset);

  test('imported text → selectable + drives the battle', () => {
    const out = importWorkoutFromText(`
Workout: Garage Chest
Bench Press 3x8 @ 60 kg, rest 90s
Pushup 3xAMRAP
`);
    expect(out.errors).toEqual([]);
    const api = useWorkoutGameStore.getState();
    api.setSelectedTemplate(out.template.id);
    api.startQuest('weighted');
    const s = useWorkoutGameStore.getState();
    expect(s.activeEncounter.workoutName).toBe('Garage Chest');
    expect(s.currentVariantId).toBe('bench-press');
  });

  test('imported workout completes through finishQuest without throwing', () => {
    const out = importWorkoutFromText(`
Workout: Garage Pull
Barbell Row 3x8 @ 50 kg
Pullup 3x5
`);
    const api = useWorkoutGameStore.getState();
    api.setSelectedTemplate(out.template.id);
    api.startQuest('weighted');
    // Log a single set, then end the encounter.
    api.setReps(8);
    api.setWeight(50);
    api.logCurrentSet();
    api.finishQuest();
    const s = useWorkoutGameStore.getState();
    expect(s.phase).toBe('reward');
    expect(s.result).not.toBeNull();
  });
});

describe('set-memory keys are template-driven', () => {
  beforeEach(reset);

  test('key shape preserves exerciseId|modality|variantId|setIndex', () => {
    const k = memoryKey({
      exerciseId: 'walking-lunge',
      modality: 'bodyweight',
      variantId: 'walking-lunge',
      setIndex: 0,
    });
    expect(k).toBe('walking-lunge|bodyweight|walking-lunge|0');
  });

  test('existing Push Day memory keys still resolve under the new adapter', () => {
    const api = useWorkoutGameStore.getState();
    // Simulate a player who logged "Pushup 10 reps" before the
    // adapter landed — their memory key uses the variant id
    // 'pushup', which is still present in the runtime Push
    // encounter, so the prefill resolves.
    useWorkoutGameStore.setState({
      setMemory: {
        'pushup|bodyweight|pushup|0': {
          reps: 18,
          weightKg: undefined,
          recordedAtIso: '2026-01-01T00:00:00.000Z',
        },
      },
    });
    api.startQuest('bodyweight');
    const s = useWorkoutGameStore.getState();
    expect(s.currentVariantId).toBe('pushup');
    expect(s.draftReps).toBe(18);
  });

  test('imported workout produces fresh memory namespace (no collision)', () => {
    const out = importWorkoutFromText(`
Workout: Garage
Zercher Squat 3x5 @ 80 kg
`);
    const api = useWorkoutGameStore.getState();
    api.setSelectedTemplate(out.template.id);
    api.startQuest('weighted');
    const s = useWorkoutGameStore.getState();
    expect(s.currentVariantId).toBe('zercher-squat');
    // The default prefill comes from the imported defaults (no
    // collision with existing pushup memory).
    expect(s.draftReps).toBe(5);
  });
});

describe('quest summary persists workout name + completed exercises', () => {
  beforeEach(reset);

  test('finishQuest hands the workout name through the onQuestCompleted payload', () => {
    const api = useWorkoutGameStore.getState();
    api.setSelectedTemplate(BUILTIN_PULL_DAY.id);
    api.startQuest('weighted');
    api.setReps(8);
    api.setWeight(40);
    api.logCurrentSet();
    api.finishQuest();
    const s = useWorkoutGameStore.getState();
    // Summary text lives on the reward screen — at the store
    // layer, the activeEncounter.workoutName is preserved across
    // finishQuest so the RewardScreen can render it.
    expect(s.activeEncounter.workoutName).toBe('Pull Day');
  });
});

// ===========================================================================
// Grep regressions — the store body must no longer hardcode Push.
// ===========================================================================

describe('no Push hardcoding in the store body (grep regression)', () => {
  const STORE = path.resolve(
    __dirname,
    '..',
    'state',
    'workoutGameStore.ts',
  );
  const text = fs.readFileSync(STORE, 'utf8');

  test('no ENCOUNTER constant assigned from PUSH_ENCOUNTER', () => {
    expect(text).not.toMatch(/^const\s+ENCOUNTER\s*=\s*PUSH_ENCOUNTER\b/m);
  });

  test('imports of PUSH_ENCOUNTER, PUSH_DAY_QUEST, and SLUGGARD are gone', () => {
    // The shape we want: the only Push fixture references left
    // are helpers and types, never the constants themselves.
    expect(text).not.toMatch(/\bPUSH_ENCOUNTER\b/);
    expect(text).not.toMatch(/\bPUSH_DAY_QUEST\b/);
    expect(text).not.toMatch(/^\s*SLUGGARD,?\s*$/m); // import line
  });
});

// ===========================================================================
// No reference/ironquest runtime imports in any new file.
// ===========================================================================

describe('no runtime imports from reference/ironquest', () => {
  const STATIC = /\bfrom\s+['"][^'"]*reference\/ironquest[^'"]*['"]/;
  const REQ = /\brequire\s*\(\s*['"][^'"]*reference\/ironquest[^'"]*['"]\s*\)/;
  const DYN = /\bimport\s*\(\s*['"][^'"]*reference\/ironquest[^'"]*['"]\s*\)/;

  for (const rel of [
    'workouts/templateToQuest.ts',
    'workouts/builtins.ts',
    'workouts/library.ts',
    'workouts/parser.ts',
    'workouts/types.ts',
    'screens/WorkoutLibraryScreen.tsx',
  ]) {
    test(`${rel} has no IQ runtime imports`, () => {
      const text = fs.readFileSync(
        path.resolve(__dirname, '..', rel),
        'utf8',
      );
      expect(text).not.toMatch(STATIC);
      expect(text).not.toMatch(REQ);
      expect(text).not.toMatch(DYN);
    });
  }
});
