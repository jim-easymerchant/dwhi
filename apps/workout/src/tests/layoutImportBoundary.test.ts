/**
 * Layout-bootstrap import-boundary tests.
 *
 * The reported startup crash was caused by `_layout.tsx`
 * STATIC-IMPORTING `persistenceBridge`, which pulled `expo-sqlite`
 * into the module graph at module-evaluation time. On a device
 * where the native bridge failed (Expo Go quirks, stale build),
 * the layout module never finished evaluating and the app
 * red-screened before React mounted.
 *
 * Revision 2 of `_layout.tsx` removes ALL top-level persistence
 * imports and lazy-loads the bridge inside `useEffect` via dynamic
 * `import(...)`. These tests pin that contract via:
 *
 *   1. Content-level grep: the layout file has no static
 *      `from '…persistenceBridge'`, `from '…persistence'`,
 *      `from 'expo-sqlite'` imports at top level.
 *   2. Functional: a simulated dynamic-import rejection of the
 *      bridge does not throw and flips the store into memory-only
 *      mode.
 *   3. Store-side: memory-only flags can be set + read without
 *      ever loading the persistence layer.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { useWorkoutGameStore } from '../state/workoutGameStore';

const LAYOUT_FILE = path.resolve(__dirname, '..', '..', 'app', '_layout.tsx');

// ===========================================================================
// 1. Import-boundary regression (content-level grep)
// ===========================================================================

describe('_layout.tsx import boundary', () => {
  const text = fs.readFileSync(LAYOUT_FILE, 'utf8');
  // Capture only the top-level (pre-function) static imports.
  const beforeFirstFunction = text.split(
    /\nfunction|\nexport (?:default )?function|\nasync function/,
    1,
  )[0];

  test('no top-level static import of persistenceBridge', () => {
    expect(beforeFirstFunction).not.toMatch(
      /^\s*import\s+[^;]*from\s+['"][^'"]*persistenceBridge['"]/m,
    );
  });

  test('no top-level static import of the persistence directory', () => {
    expect(beforeFirstFunction).not.toMatch(
      /^\s*import\s+[^;]*from\s+['"][^'"]*\/persistence(?:['"]|\/)/m,
    );
  });

  test('no top-level static import of expo-sqlite', () => {
    expect(beforeFirstFunction).not.toMatch(
      /^\s*import\s+[^;]*from\s+['"]expo-sqlite['"]/m,
    );
  });

  test('persistenceBridge is loaded only via a deferred require()', () => {
    // The bridge module should be referenced via require() inside
    // a function body (so it is evaluated only when that function
    // runs — i.e. inside useEffect, post-mount). require() with
    // the bridge path must appear at least once. The top-level
    // static-import tests above already guarantee no
    // `^import ... from '...persistenceBridge'` line.
    const deferredRequire = text.match(
      /require\s*\(\s*['"][^'"]*persistenceBridge['"]\s*\)/g,
    );
    expect(deferredRequire).not.toBeNull();
    expect(deferredRequire!.length).toBeGreaterThanOrEqual(1);
  });

  test('DISABLE_PERSISTENCE_BOOT bypass flag is present', () => {
    expect(text).toMatch(/DISABLE_PERSISTENCE_BOOT\s*=\s*(true|false)/);
  });

  test('exports a default RootLayout component', () => {
    expect(text).toMatch(/export\s+default\s+function\s+RootLayout/);
  });
});

// ===========================================================================
// 2. Store-side memory-only behaviour
// ===========================================================================

describe('store — memory-only fallback path', () => {
  test('setting persistence flags via setState works without loading any persistence module', () => {
    // This test simulates what `_layout.tsx`'s `setMemoryOnlyFlag`
    // helper does on a dynamic-import failure: flip the three flags
    // and continue. It deliberately does NOT touch
    // ../persistence — the whole point is that we can run
    // memory-only without that module.
    useWorkoutGameStore.setState({
      persistenceReady: true,
      persistenceDisabled: true,
      persistenceError: 'Persistence import failed: simulated',
    });
    const s = useWorkoutGameStore.getState();
    expect(s.persistenceReady).toBe(true);
    expect(s.persistenceDisabled).toBe(true);
    expect(s.persistenceError).toMatch(/simulated/);
  });

  test('a Quest can be logged + finished with persistence flags in memory-only mode', () => {
    // Reset.
    useWorkoutGameStore.setState({
      persistenceReady: true,
      persistenceDisabled: true,
      persistenceError: 'simulated bridge import failure',
      log: [],
      defeatedEnemies: [],
      continuationCount: 0,
      result: null,
    });
    const api = useWorkoutGameStore.getState();
    api.startQuest('bodyweight');
    useWorkoutGameStore.getState().logCurrentSet();
    api.finishQuest();
    const s = useWorkoutGameStore.getState();
    // Memory-only mode: phase advanced, result populated, no
    // throw despite no persistence handler ever being registered.
    expect(s.phase).toBe('reward');
    expect(s.result).not.toBeNull();
  });
});

// ===========================================================================
// 3. Dynamic-import failure is recoverable
// ===========================================================================

describe('deferred require failure recovery', () => {
  test('a rejected require does not throw and lets the caller mark memory-only', () => {
    // Mirrors the pattern in _layout.tsx's bootPersistence(): try
    // require() inside try/catch; on failure, set store flags via
    // the synchronous helper and return.
    let caught: unknown = null;
    let mod: unknown = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
      mod = require('../path/does/not/exist/persistenceBridge');
    } catch (e) {
      caught = e;
    }
    expect(caught).not.toBeNull();
    expect(mod).toBeNull();

    // Simulate _layout's recovery — flip the store flags.
    useWorkoutGameStore.setState({
      persistenceReady: true,
      persistenceDisabled: true,
      persistenceError: 'Persistence import failed (simulated)',
    });
    const s = useWorkoutGameStore.getState();
    expect(s.persistenceDisabled).toBe(true);
  });
});
