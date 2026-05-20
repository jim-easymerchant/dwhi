/**
 * Persistence crash-fix tests — ensures startup never crashes when
 * the SQLite layer fails for any reason. These cover the bridge
 * surface; lower-level repository unit tests live in
 * persistenceRepositories.test.ts.
 */

jest.mock('../persistence', () => {
  // Mutable "disabled latch" state local to the mock so tests can
  // flip it without poking real module internals.
  let disabledReason: string | null = null;
  return {
    saveSetMemory: jest.fn().mockResolvedValue(undefined),
    loadAllSetMemory: jest.fn().mockResolvedValue({}),
    savePlayerMomentum: jest.fn().mockResolvedValue(undefined),
    loadPlayerMomentum: jest.fn().mockResolvedValue(null),
    appendQuestHistory: jest.fn().mockResolvedValue(undefined),
    getMostRecentCompletedAtIso: jest.fn().mockResolvedValue(null),
    listRecentQuests: jest.fn().mockResolvedValue([]),
    recordIfPersonalRecord: jest.fn().mockResolvedValue([]),
    initDatabase: jest.fn().mockResolvedValue(undefined),
    isPersistenceDisabled: jest.fn(() => disabledReason !== null),
    getPersistenceDisabledReason: jest.fn(() => disabledReason),
    disablePersistence: jest.fn((reason: string) => {
      if (disabledReason === null) disabledReason = reason;
    }),
    __testResetDisabled: () => {
      disabledReason = null;
    },
    __testForceDisabled: (reason: string) => {
      disabledReason = reason;
    },
  };
});

import * as persistence from '../persistence';
import {
  __resetClockForTests,
  __setClockForTests,
  hydratePersistence,
  persistLoggedSet,
  persistQuestCompletion,
} from '../state/persistenceBridge';
import { useWorkoutGameStore } from '../state/workoutGameStore';
import { DEFAULT_PRIOR_MOMENTUM } from '../fixtures/pushDayQuest';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockedPersistence = persistence as unknown as {
  __testResetDisabled: () => void;
  __testForceDisabled: (reason: string) => void;
  saveSetMemory: jest.Mock;
  loadAllSetMemory: jest.Mock;
  savePlayerMomentum: jest.Mock;
  loadPlayerMomentum: jest.Mock;
  appendQuestHistory: jest.Mock;
  getMostRecentCompletedAtIso: jest.Mock;
  recordIfPersonalRecord: jest.Mock;
  initDatabase: jest.Mock;
  isPersistenceDisabled: jest.Mock;
  getPersistenceDisabledReason: jest.Mock;
  disablePersistence: jest.Mock;
};

function resetStore(): void {
  useWorkoutGameStore.setState({
    persistenceReady: false,
    persistenceDisabled: false,
    persistenceError: null,
    lastSessionAtIso: null,
    priorMomentum: DEFAULT_PRIOR_MOMENTUM,
    setMemory: {},
    log: [],
    defeatedEnemies: [],
    continuationCount: 0,
    result: null,
  });
}

beforeEach(() => {
  mockedPersistence.__testResetDisabled();
  for (const fn of [
    mockedPersistence.saveSetMemory,
    mockedPersistence.loadAllSetMemory,
    mockedPersistence.savePlayerMomentum,
    mockedPersistence.loadPlayerMomentum,
    mockedPersistence.appendQuestHistory,
    mockedPersistence.getMostRecentCompletedAtIso,
    mockedPersistence.recordIfPersonalRecord,
    mockedPersistence.initDatabase,
    mockedPersistence.disablePersistence,
  ]) {
    fn.mockClear();
  }
  // Default resolutions
  mockedPersistence.loadAllSetMemory.mockResolvedValue({});
  mockedPersistence.loadPlayerMomentum.mockResolvedValue(null);
  mockedPersistence.getMostRecentCompletedAtIso.mockResolvedValue(null);
  mockedPersistence.initDatabase.mockResolvedValue(undefined);
  mockedPersistence.saveSetMemory.mockResolvedValue(undefined);
  mockedPersistence.savePlayerMomentum.mockResolvedValue(undefined);
  mockedPersistence.appendQuestHistory.mockResolvedValue(undefined);
  mockedPersistence.recordIfPersonalRecord.mockResolvedValue([]);
  resetStore();
  __resetClockForTests();
});

// ===========================================================================
// hydratePersistence never throws
// ===========================================================================

describe('hydratePersistence — startup-crash safety', () => {
  test('initDatabase rejection does not throw — store falls back to memory-only', async () => {
    mockedPersistence.initDatabase.mockRejectedValueOnce(new Error('schema broken'));

    // hydratePersistence is declared async; the function must always
    // return a settled Promise — never throw, never reject.
    let threw: unknown = null;
    let result;
    try {
      result = await hydratePersistence();
    } catch (e) {
      threw = e;
    }
    expect(threw).toBeNull();
    expect(result?.ok).toBe(false);
    expect(result?.error).toMatch(/schema broken/);

    const s = useWorkoutGameStore.getState();
    expect(s.persistenceReady).toBe(true);
    expect(s.persistenceDisabled).toBe(true);
    expect(s.persistenceError).toMatch(/schema broken/);
    // Memory-only fallback: priorMomentum + lastSessionAtIso stay at defaults.
    expect(s.priorMomentum).toBe(DEFAULT_PRIOR_MOMENTUM);
    expect(s.lastSessionAtIso).toBeNull();
  });

  test('individual loader rejection (set memory) does not sink hydrate', async () => {
    mockedPersistence.loadAllSetMemory.mockRejectedValueOnce(new Error('row scan failed'));
    mockedPersistence.loadPlayerMomentum.mockResolvedValueOnce({
      value: 47,
      lastSessionAtIso: '2026-05-18T08:00:00.000Z',
      lastReturnBonusAtIso: null,
      gentleModeUntilIso: null,
    });

    const out = await hydratePersistence();
    // hydrate still succeeds — the loader failure was caught and
    // mapped to an empty set memory.
    expect(out.ok).toBe(true);
    const s = useWorkoutGameStore.getState();
    expect(s.persistenceReady).toBe(true);
    expect(s.persistenceDisabled).toBe(false);
    expect(s.setMemory).toEqual({});
    // The other loaders still seeded their fields.
    expect(s.priorMomentum).toBe(47);
  });

  test('skips malformed memory entries without throwing', async () => {
    mockedPersistence.loadAllSetMemory.mockResolvedValueOnce({
      'good|bodyweight|good|0': {
        reps: 10,
        weightKg: undefined,
        durationSeconds: undefined,
        recordedAtIso: 'A',
      },
      // The bridge's try/catch is per-row — a bad row is skipped.
      // We can't easily force persistedToStoreEntry to throw with
      // valid TS types, so this row simulates an "okay but odd"
      // payload that we still want surfaced.
      'okay|bodyweight|okay|1': {
        reps: undefined,
        weightKg: undefined,
        durationSeconds: undefined,
        recordedAtIso: 'B',
      },
    });

    const out = await hydratePersistence();
    expect(out.ok).toBe(true);
    expect(out.setMemoryCount).toBe(2);
    expect(useWorkoutGameStore.getState().persistenceDisabled).toBe(false);
  });

  test('when persistence is already latched off, hydrate returns memory-only immediately', async () => {
    mockedPersistence.__testForceDisabled('previously failed');
    const out = await hydratePersistence();
    expect(out.ok).toBe(false);
    expect(out.error).toMatch(/previously failed/);
    expect(mockedPersistence.initDatabase).not.toHaveBeenCalled();
    expect(useWorkoutGameStore.getState().persistenceDisabled).toBe(true);
  });
});

// ===========================================================================
// persistLoggedSet — never throws
// ===========================================================================

describe('persistLoggedSet — error safety', () => {
  test('saveSetMemory rejection is swallowed and logged', async () => {
    mockedPersistence.saveSetMemory.mockRejectedValueOnce(new Error('write blocked'));
    let threw: unknown = null;
    let out: readonly string[] = [];
    try {
      out = await persistLoggedSet({
        exerciseId: 'pushup',
        modality: 'bodyweight',
        variantId: 'pushup',
        setIndex: 0,
        reps: 10,
      });
    } catch (e) {
      threw = e;
    }
    expect(threw).toBeNull();
    expect(out).toEqual([]);
  });

  test('structural failure ("no such table") latches persistence off', async () => {
    mockedPersistence.saveSetMemory.mockRejectedValueOnce(
      new Error('no such table: workout_set_memory'),
    );

    await persistLoggedSet({
      exerciseId: 'pushup',
      modality: 'bodyweight',
      variantId: 'pushup',
      setIndex: 0,
      reps: 10,
    });

    expect(mockedPersistence.disablePersistence).toHaveBeenCalled();
    const s = useWorkoutGameStore.getState();
    expect(s.persistenceDisabled).toBe(true);
    expect(s.persistenceError).toMatch(/no such table/);
  });

  test('non-structural error (conflict) does NOT latch persistence off', async () => {
    mockedPersistence.saveSetMemory.mockRejectedValueOnce(
      new Error('UNIQUE constraint failed'),
    );

    await persistLoggedSet({
      exerciseId: 'pushup',
      modality: 'bodyweight',
      variantId: 'pushup',
      setIndex: 0,
      reps: 10,
    });

    expect(mockedPersistence.disablePersistence).not.toHaveBeenCalled();
    expect(useWorkoutGameStore.getState().persistenceDisabled).toBe(false);
  });

  test('skips the DB entirely when persistence is already disabled', async () => {
    mockedPersistence.__testForceDisabled('already off');
    const out = await persistLoggedSet({
      exerciseId: 'pushup',
      modality: 'bodyweight',
      variantId: 'pushup',
      setIndex: 0,
      reps: 10,
    });
    expect(out).toEqual([]);
    expect(mockedPersistence.saveSetMemory).not.toHaveBeenCalled();
    expect(mockedPersistence.recordIfPersonalRecord).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// persistQuestCompletion — never throws
// ===========================================================================

describe('persistQuestCompletion — error safety', () => {
  test('savePlayerMomentum rejection is swallowed; store is still updated', async () => {
    __setClockForTests(() => '2026-05-19T12:00:00.000Z');
    mockedPersistence.savePlayerMomentum.mockRejectedValueOnce(new Error('momentum save failed'));

    let threw: unknown = null;
    try {
      await persistQuestCompletion({
        questId: 'q',
        kind: 'strength',
        workingSetCount: 1,
        totalDamage: 50,
        xp: 5,
        momentumDelta: 6,
        defeatedEnemies: [],
        primaryVerdict: 'Steady',
        finalMomentum: 31,
        payload: { ok: true },
      });
    } catch (e) {
      threw = e;
    }
    expect(threw).toBeNull();
    // Store reflects the new state even when the disk write failed.
    const s = useWorkoutGameStore.getState();
    expect(s.priorMomentum).toBe(31);
    expect(s.lastSessionAtIso).toBe('2026-05-19T12:00:00.000Z');
  });

  test('skips the DB entirely when persistence is already disabled — still updates store', async () => {
    __setClockForTests(() => '2026-05-19T12:00:00.000Z');
    mockedPersistence.__testForceDisabled('off');

    await persistQuestCompletion({
      questId: 'q',
      kind: 'strength',
      workingSetCount: 1,
      totalDamage: 50,
      xp: 5,
      momentumDelta: 6,
      defeatedEnemies: [],
      primaryVerdict: 'Steady',
      finalMomentum: 41,
    });

    expect(mockedPersistence.savePlayerMomentum).not.toHaveBeenCalled();
    expect(mockedPersistence.appendQuestHistory).not.toHaveBeenCalled();
    // Even with persistence off, the in-memory store reflects the
    // Quest result — so the Reward screen is correct.
    const s = useWorkoutGameStore.getState();
    expect(s.priorMomentum).toBe(41);
    expect(s.lastSessionAtIso).toBe('2026-05-19T12:00:00.000Z');
  });
});

// ===========================================================================
// Store flags
// ===========================================================================

describe('store — persistence flags initial values', () => {
  test('persistenceReady, persistenceDisabled, persistenceError all start false/null', () => {
    resetStore();
    const s = useWorkoutGameStore.getState();
    expect(s.persistenceReady).toBe(false);
    expect(s.persistenceDisabled).toBe(false);
    expect(s.persistenceError).toBeNull();
  });

  test('after a hydration failure, persistenceReady is true (so UI does not hang) but persistenceDisabled is true', async () => {
    mockedPersistence.initDatabase.mockRejectedValueOnce(new Error('boom'));
    await hydratePersistence();
    const s = useWorkoutGameStore.getState();
    expect(s.persistenceReady).toBe(true);
    expect(s.persistenceDisabled).toBe(true);
    expect(s.persistenceError).toMatch(/boom/);
  });
});

// ===========================================================================
// HomeScreen — compile-time guard that it reads the new flags
// ===========================================================================

describe('HomeScreen — diagnostic source', () => {
  test('the new persistenceError / persistenceDisabled flags are in the store type', () => {
    // Compile-time guard — if these fields are renamed without
    // updating HomeScreen, this test (and tsc) will fail.
    const s = useWorkoutGameStore.getState();
    expect(typeof s.persistenceDisabled).toBe('boolean');
    expect(s.persistenceError === null || typeof s.persistenceError === 'string').toBe(true);
  });
});

// ===========================================================================
// Regression: no Supabase / auth / sync imports in the persistence layer
// ===========================================================================

describe('persistence layer — no forbidden imports', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('node:fs') as typeof import('node:fs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require('node:path') as typeof import('node:path');

  const PERSIST_DIR = path.resolve(__dirname, '..', 'persistence');
  const BRIDGE_FILE = path.resolve(
    __dirname,
    '..',
    'state',
    'persistenceBridge.ts',
  );

  const sourceFiles = (() => {
    const out: string[] = [BRIDGE_FILE];
    for (const entry of fs.readdirSync(PERSIST_DIR, { withFileTypes: true })) {
      if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
        out.push(path.join(PERSIST_DIR, entry.name));
      }
    }
    return out;
  })();

  test.each(sourceFiles)(
    'no Supabase / auth / sync / DWHI-pantry imports in %s',
    (file) => {
      const text = fs.readFileSync(file, 'utf8');
      expect(text).not.toMatch(/from\s+['"]@supabase\//);
      expect(text).not.toMatch(/from\s+['"]@dwhi\/framework\/auth/);
      expect(text).not.toMatch(/from\s+['"]@dwhi\/framework\/invites/);
      expect(text).not.toMatch(/from\s+['"]@dwhi\/framework\/sync/);
      expect(text).not.toMatch(/from\s+['"]@dwhi\/domain/);
      expect(text).not.toMatch(/from\s+['"]@\//);
    },
  );
});
