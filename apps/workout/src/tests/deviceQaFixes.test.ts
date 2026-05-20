/**
 * Device-QA regression tests (branch 024).
 *
 * Coverage:
 *   1. Player HP current/max model — bar visibly moves during
 *      rest transitions; clamped at a floor; resets on
 *      returnToCamp; never below the floor.
 *   2. Rest timer 60/90/120 — each preset works.
 *   3. Rest timer placement — chips appear AFTER an attack (on
 *      the RestScreen, not before).
 *   4. Single patron block — HomeScreen mounts exactly one
 *      (`PatronsPanel`); the formerly-duplicate `AmbientPanel`
 *      is no longer rendered.
 *   5. Full-bleed + safe-area — TavernSceneFrame reads
 *      `useWindowDimensions` and `useSafeAreaInsets`, applies
 *      the insets to the overlays (not the canvas).
 *   6. No new runtime imports from reference/ironquest.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  computeDaysSinceLastQuest,
  useWorkoutGameStore,
} from '../state/workoutGameStore';
import {
  REST_PRESETS,
  REST_TIMER_INITIAL_STATE,
  restTimerReducer,
} from '../hooks/useRestTimer';

const HOME = path.resolve(__dirname, '..', 'screens', 'HomeScreen.tsx');
const BATTLE = path.resolve(__dirname, '..', 'screens', 'BattleScreen.tsx');
const REST = path.resolve(__dirname, '..', 'screens', 'RestScreen.tsx');
const SCENE = path.resolve(
  __dirname,
  '..',
  'components',
  'tavern',
  'TavernSceneFrame.tsx',
);
const WORKOUTS_DIR = path.resolve(__dirname, '..', 'workouts');
const WORKOUT_LIB_SCREEN = path.resolve(
  __dirname,
  '..',
  'screens',
  'WorkoutLibraryScreen.tsx',
);

function read(file: string): string {
  return fs.readFileSync(file, 'utf8');
}

// ===========================================================================
// 1. Player HP current/max model
// ===========================================================================

describe('player HP current/max model', () => {
  // The persistence bridge tests already mock '../persistence'.
  // For these unit tests we exercise the store via its public
  // actions; no persistence is involved.
  beforeEach(() => {
    // Reset the store to a known shape so each test starts fresh.
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
      // Memory-only mode so no persistence handlers run.
      persistenceReady: true,
      persistenceDisabled: true,
      persistenceError: 'test',
    });
  });

  test('startQuest seeds playerCurrentHp + playerMaxHp from the pure formula', () => {
    const api = useWorkoutGameStore.getState();
    api.startQuest('bodyweight');
    const s = useWorkoutGameStore.getState();
    expect(s.playerMaxHp).toBeGreaterThan(0);
    expect(s.playerCurrentHp).toBe(s.playerMaxHp);
  });

  test('enterRest shaves a small, deterministic amount off currentHp', () => {
    const api = useWorkoutGameStore.getState();
    api.startQuest('bodyweight');
    const maxHp = useWorkoutGameStore.getState().playerMaxHp;
    api.enterRest();
    const afterFirst = useWorkoutGameStore.getState().playerCurrentHp;
    expect(afterFirst).toBeLessThan(maxHp);
    // Repeated rest transitions continue to shave.
    api.endRest();
    api.enterRest();
    const afterSecond = useWorkoutGameStore.getState().playerCurrentHp;
    expect(afterSecond).toBeLessThan(afterFirst);
  });

  test('player HP never drops below the floor of 1', () => {
    const api = useWorkoutGameStore.getState();
    api.startQuest('bodyweight');
    // Hammer the rest cycle 200 times.
    for (let i = 0; i < 200; i++) {
      api.enterRest();
      api.endRest();
    }
    expect(useWorkoutGameStore.getState().playerCurrentHp).toBeGreaterThanOrEqual(1);
  });

  test('returnToCamp resets currentHp back to max', () => {
    const api = useWorkoutGameStore.getState();
    api.startQuest('bodyweight');
    api.enterRest();
    api.endRest();
    api.enterRest();
    const damaged = useWorkoutGameStore.getState().playerCurrentHp;
    const max = useWorkoutGameStore.getState().playerMaxHp;
    expect(damaged).toBeLessThan(max);
    api.returnToCamp();
    expect(useWorkoutGameStore.getState().playerCurrentHp).toBe(max);
  });

  test('phase-2 pressure is HEAVIER than phase-1 pressure', () => {
    const api = useWorkoutGameStore.getState();
    api.startQuest('bodyweight');
    const max = useWorkoutGameStore.getState().playerMaxHp;
    api.enterRest();
    const after1 = useWorkoutGameStore.getState().playerCurrentHp;
    const drop1 = max - after1;
    // Advance the enemy phase index manually (simulates the
    // "Continue Sets" path without needing a defeat).
    useWorkoutGameStore.setState({
      playerCurrentHp: max,
      enemyPhaseIndex: 2,
    });
    api.enterRest();
    const after2 = useWorkoutGameStore.getState().playerCurrentHp;
    const drop2 = max - after2;
    expect(drop2).toBeGreaterThan(drop1);
  });

  test('computeDaysSinceLastQuest still works (sanity, unaffected)', () => {
    expect(computeDaysSinceLastQuest(null)).toBe(999);
  });
});

// ===========================================================================
// 2. Rest timer — 60 / 90 / 120 presets all work
// ===========================================================================

describe('rest timer presets', () => {
  test('REST_PRESETS contains 60, 90, 120 in that order', () => {
    expect(REST_PRESETS).toEqual([60, 90, 120]);
  });

  for (const preset of [60, 90, 120] as const) {
    test(`START with preset=${preset} → running with remainingSeconds=${preset}`, () => {
      const state = restTimerReducer(REST_TIMER_INITIAL_STATE, {
        type: 'START',
        seconds: preset,
      });
      expect(state.phase).toBe('running');
      expect(state.remainingSeconds).toBe(preset);
      expect(state.presetSeconds).toBe(preset);
    });

    test(`preset=${preset} decrements correctly across the full duration`, () => {
      let state = restTimerReducer(REST_TIMER_INITIAL_STATE, {
        type: 'START',
        seconds: preset,
      });
      for (let i = 0; i < preset - 1; i++) {
        state = restTimerReducer(state, { type: 'TICK' });
      }
      expect(state.phase).toBe('running');
      expect(state.remainingSeconds).toBe(1);
      // Final tick → complete.
      state = restTimerReducer(state, { type: 'TICK' });
      expect(state.phase).toBe('complete');
    });
  }
});

// ===========================================================================
// 3. Rest timer placement — chips appear on the RestScreen, not before
// ===========================================================================

describe('rest timer placement', () => {
  const rest = read(REST);
  const battle = read(BATTLE);

  test('RestScreen imports + mounts the RestTimer + the useRestTimer hook', () => {
    expect(rest).toMatch(/from\s+['"]\.\.\/components\/battle\/RestTimer['"]/);
    expect(rest).toMatch(/from\s+['"]\.\.\/hooks\/useRestTimer['"]/);
    expect(rest).toMatch(/useRestTimer\(\)/);
    expect(rest).toMatch(/<RestTimer\b/);
  });

  test('BattleScreen NO LONGER mounts the RestTimer (avoids the early-return ghost)', () => {
    expect(battle).not.toMatch(/<RestTimer\b/);
  });

  test('RestScreen still exposes the I\'m-ready button (timer is optional)', () => {
    expect(rest).toContain('testID="rest-ready"');
  });
});

// ===========================================================================
// 4. Single patron block
// ===========================================================================

describe('single patron block', () => {
  const home = read(HOME);

  test('PatronsPanel is mounted exactly once', () => {
    const matches = home.match(/<PatronsPanel\b/g) ?? [];
    expect(matches.length).toBe(1);
  });

  test('AmbientPanel is NOT mounted (collapsed into single block)', () => {
    expect(home).not.toMatch(/<AmbientPanel\b/);
  });

  test('AmbientPanel is also not imported (clean dead-code removal)', () => {
    expect(home).not.toMatch(/AmbientPanel,?\s*}/);
  });
});

// ===========================================================================
// 5. Full-bleed + safe-area
// ===========================================================================

describe('full-bleed + safe-area handling', () => {
  const scene = read(SCENE);

  test('uses useWindowDimensions (live viewport width)', () => {
    expect(scene).toMatch(/useWindowDimensions/);
  });

  test('uses useSafeAreaInsets from react-native-safe-area-context', () => {
    expect(scene).toMatch(/useSafeAreaInsets/);
    expect(scene).toMatch(/from\s+['"]react-native-safe-area-context['"]/);
  });

  test('applies the safe-area top inset to the overlays (sign + gear)', () => {
    // The component derives `overlayTop = insets.top + sm` and
    // applies it to both the sign and the gear via inline style.
    expect(scene).toMatch(/insets\.top\s*\+\s*workoutSpacing\.sm/);
    expect(scene).toMatch(/top:\s*overlayTop/);
  });

  test('canvas width is wired through the live viewport (not a captured constant)', () => {
    expect(scene).toMatch(/viewportWidth/);
    expect(scene).not.toMatch(/Dimensions\.get\(['"]window['"]\)/);
  });
});

// ===========================================================================
// 6. Reference/ironquest import boundary in new code
// ===========================================================================

describe('no reference/ironquest runtime imports in new files', () => {
  const STATIC = /\bfrom\s+['"][^'"]*reference\/ironquest[^'"]*['"]/;
  const REQ = /\brequire\s*\(\s*['"][^'"]*reference\/ironquest[^'"]*['"]\s*\)/;
  const DYN = /\bimport\s*\(\s*['"][^'"]*reference\/ironquest[^'"]*['"]\s*\)/;

  function assertClean(text: string): void {
    expect(text).not.toMatch(STATIC);
    expect(text).not.toMatch(REQ);
    expect(text).not.toMatch(DYN);
  }

  test('every file in src/workouts/', () => {
    for (const entry of fs.readdirSync(WORKOUTS_DIR, { withFileTypes: true })) {
      if (entry.isFile()) {
        assertClean(fs.readFileSync(path.join(WORKOUTS_DIR, entry.name), 'utf8'));
      }
    }
  });

  test('WorkoutLibraryScreen.tsx', () => {
    assertClean(read(WORKOUT_LIB_SCREEN));
  });
});
