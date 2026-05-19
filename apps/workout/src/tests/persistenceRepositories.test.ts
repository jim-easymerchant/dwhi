/**
 * Persistence repository tests — set memory, momentum, history, PRs.
 *
 * The expo-sqlite import is stubbed via the workspace test stub at
 * test-stubs/expo-sqlite.ts (which throws on openDatabaseAsync).
 * We then jest.mock the *workout-app's* db.ts module to swap in an
 * in-memory SQLite-like backend, mirroring the pantry app's
 * convention of mocking the database module rather than the
 * expo-sqlite import.
 */

import { InMemoryDb } from './__sqliteMemoryStub';

let fixedNow = '2026-05-19T10:00:00.000Z';

// Shared, resettable state for the db mock. `currentDb` is replaced
// in beforeEach so each test gets a clean slate.
let currentDb = new InMemoryDb();

jest.mock('../persistence/db', () => {
  return {
    getDb: () => Promise.resolve(currentDb),
    nowIso: () => fixedNow,
    addColumnIfMissing: jest.fn().mockResolvedValue(undefined),
    columnExists: jest.fn().mockResolvedValue(true),
    createIndexIfColumnExists: jest.fn().mockResolvedValue(undefined),
    initDatabase: async () => {
      const { WORKOUT_SCHEMA_STATEMENTS } = jest.requireActual(
        '../persistence/schema',
      );
      for (const s of WORKOUT_SCHEMA_STATEMENTS) {
        await currentDb.execAsync(s);
      }
    },
    resetDatabase: jest.fn().mockResolvedValue(undefined),
    __resetInitCacheForTests: jest.fn(),
  };
});

import {
  appendQuestHistory,
  getMostRecentCompletedAtIso,
  initDatabase,
  listRecentQuests,
  loadAllSetMemory,
  loadPlayerMomentum,
  recordIfPersonalRecord,
  savePlayerMomentum,
  saveSetMemory,
  upsertPersonalRecord,
} from '../persistence';

async function freshDb(): Promise<void> {
  currentDb = new InMemoryDb();
  await initDatabase();
}

beforeEach(async () => {
  await freshDb();
});

// ===========================================================================
// set memory
// ===========================================================================

describe('setMemoryRepository', () => {
  test('round-trip: save → loadAll returns the row keyed by tuple', async () => {
    fixedNow = '2026-05-19T11:00:00.000Z';
    await saveSetMemory(
      {
        exerciseId: 'pushup',
        modality: 'bodyweight',
        variantId: 'pushup',
        setIndex: 0,
      },
      { reps: 12, recordedAtIso: fixedNow },
    );
    const all = await loadAllSetMemory();
    expect(all['pushup|bodyweight|pushup|0']).toEqual({
      reps: 12,
      weightKg: undefined,
      durationSeconds: undefined,
      recordedAtIso: fixedNow,
    });
  });

  test('upsert: second save for the same tuple overwrites the first', async () => {
    const k = {
      exerciseId: 'bench',
      modality: 'weighted',
      variantId: 'bench-press',
      setIndex: 2,
    };
    await saveSetMemory(k, { reps: 8, weightKg: 60, recordedAtIso: '2026-05-19T10:00:00.000Z' });
    await saveSetMemory(k, { reps: 10, weightKg: 65, recordedAtIso: '2026-05-19T10:05:00.000Z' });

    const all = await loadAllSetMemory();
    expect(all['bench|weighted|bench-press|2']).toEqual({
      reps: 10,
      weightKg: 65,
      durationSeconds: undefined,
      recordedAtIso: '2026-05-19T10:05:00.000Z',
    });
  });

  test('multiple tuples coexist independently', async () => {
    await saveSetMemory(
      { exerciseId: 'pushup', modality: 'bodyweight', variantId: 'pushup', setIndex: 0 },
      { reps: 10, recordedAtIso: 'x' },
    );
    await saveSetMemory(
      { exerciseId: 'pushup', modality: 'bodyweight', variantId: 'pushup', setIndex: 1 },
      { reps: 8, recordedAtIso: 'x' },
    );
    await saveSetMemory(
      {
        exerciseId: 'pike-pushup',
        modality: 'bodyweight',
        variantId: 'pike-pushup',
        setIndex: 0,
      },
      { reps: 6, recordedAtIso: 'x' },
    );
    const all = await loadAllSetMemory();
    expect(Object.keys(all).sort()).toEqual([
      'pike-pushup|bodyweight|pike-pushup|0',
      'pushup|bodyweight|pushup|0',
      'pushup|bodyweight|pushup|1',
    ]);
  });
});

// ===========================================================================
// player momentum
// ===========================================================================

describe('playerMomentumRepository', () => {
  test('loadPlayerMomentum returns null on a fresh install', async () => {
    expect(await loadPlayerMomentum()).toBeNull();
  });

  test('save + load round-trip preserves value + last_session', async () => {
    await savePlayerMomentum({
      value: 47.5,
      lastSessionAtIso: '2026-05-19T12:00:00.000Z',
      lastReturnBonusAtIso: null,
      gentleModeUntilIso: null,
    });
    const out = await loadPlayerMomentum();
    expect(out).toEqual({
      value: 47.5,
      lastSessionAtIso: '2026-05-19T12:00:00.000Z',
      lastReturnBonusAtIso: null,
      gentleModeUntilIso: null,
    });
  });

  test('value is clamped to [min, max] on save', async () => {
    await savePlayerMomentum({
      value: 200,
      lastSessionAtIso: null,
      lastReturnBonusAtIso: null,
      gentleModeUntilIso: null,
    });
    expect((await loadPlayerMomentum())!.value).toBeLessThanOrEqual(100);
    await savePlayerMomentum({
      value: -50,
      lastSessionAtIso: null,
      lastReturnBonusAtIso: null,
      gentleModeUntilIso: null,
    });
    expect((await loadPlayerMomentum())!.value).toBeGreaterThanOrEqual(5);
  });

  test('upsert: a second save updates the singleton in place', async () => {
    await savePlayerMomentum({
      value: 30,
      lastSessionAtIso: 'A',
      lastReturnBonusAtIso: null,
      gentleModeUntilIso: null,
    });
    await savePlayerMomentum({
      value: 35,
      lastSessionAtIso: 'B',
      lastReturnBonusAtIso: null,
      gentleModeUntilIso: null,
    });
    const out = await loadPlayerMomentum();
    expect(out!.value).toBe(35);
    expect(out!.lastSessionAtIso).toBe('B');
  });
});

// ===========================================================================
// quest history
// ===========================================================================

describe('questHistoryRepository', () => {
  test('append + getMostRecentCompletedAtIso returns the latest', async () => {
    await appendQuestHistory({
      id: 'q1',
      kind: 'strength',
      templateId: 'push_day',
      startedAtIso: '2026-05-19T10:00:00.000Z',
      completedAtIso: '2026-05-19T10:30:00.000Z',
      workingSetCount: 9,
      totalDamage: 540,
      xp: 60,
      momentumDelta: 6,
      defeatedCount: 1,
      primaryVerdict: 'Finisher',
      payloadJson: '{}',
    });
    await appendQuestHistory({
      id: 'q2',
      kind: 'strength',
      templateId: 'push_day',
      startedAtIso: '2026-05-20T08:00:00.000Z',
      completedAtIso: '2026-05-20T08:25:00.000Z',
      workingSetCount: 8,
      totalDamage: 420,
      xp: 45,
      momentumDelta: 5,
      defeatedCount: 1,
      primaryVerdict: 'Disciplined Exit',
      payloadJson: '{}',
    });
    expect(await getMostRecentCompletedAtIso()).toBe('2026-05-20T08:25:00.000Z');

    const recent = await listRecentQuests(5);
    expect(recent).toHaveLength(2);
    expect(recent[0].id).toBe('q2');
    expect(recent[1].id).toBe('q1');
  });

  test('getMostRecentCompletedAtIso is null on a fresh install', async () => {
    expect(await getMostRecentCompletedAtIso()).toBeNull();
  });
});

// ===========================================================================
// personal records
// ===========================================================================

describe('personalRecordRepository', () => {
  test('recordIfPersonalRecord upgrades all three kinds on a brand-new exercise', async () => {
    const upgraded = await recordIfPersonalRecord({
      key: { exerciseId: 'bench', modality: 'weighted', variantId: 'bench-press' },
      reps: 5,
      weightKg: 80,
      recordedAtIso: 'A',
    });
    expect([...upgraded].sort()).toEqual(['rep', 'volume', 'weight']);
  });

  test('recordIfPersonalRecord does NOT upgrade if all candidates ≤ existing', async () => {
    await upsertPersonalRecord({
      exerciseId: 'bench',
      modality: 'weighted',
      variantId: 'bench-press',
      kind: 'rep',
      value: 10,
      recordedAtIso: 'A',
    });
    await upsertPersonalRecord({
      exerciseId: 'bench',
      modality: 'weighted',
      variantId: 'bench-press',
      kind: 'weight',
      value: 100,
      recordedAtIso: 'A',
    });
    await upsertPersonalRecord({
      exerciseId: 'bench',
      modality: 'weighted',
      variantId: 'bench-press',
      kind: 'volume',
      value: 1000,
      recordedAtIso: 'A',
    });
    const upgraded = await recordIfPersonalRecord({
      key: { exerciseId: 'bench', modality: 'weighted', variantId: 'bench-press' },
      reps: 8,
      weightKg: 80,
      recordedAtIso: 'B',
    });
    // reps 8 < 10 → no rep PR; weight 80 < 100 → no weight PR;
    // volume 8 * 80 = 640 < 1000 → no volume PR.
    expect(upgraded).toEqual([]);
  });

  test('only the kinds that actually improved are upgraded', async () => {
    await upsertPersonalRecord({
      exerciseId: 'bench',
      modality: 'weighted',
      variantId: 'bench-press',
      kind: 'rep',
      value: 10,
      recordedAtIso: 'A',
    });
    await upsertPersonalRecord({
      exerciseId: 'bench',
      modality: 'weighted',
      variantId: 'bench-press',
      kind: 'weight',
      value: 50,
      recordedAtIso: 'A',
    });
    await upsertPersonalRecord({
      exerciseId: 'bench',
      modality: 'weighted',
      variantId: 'bench-press',
      kind: 'volume',
      value: 500,
      recordedAtIso: 'A',
    });
    // 8 reps @ 80kg → weight beats 50; volume 640 beats 500; rep does NOT beat 10.
    const upgraded = await recordIfPersonalRecord({
      key: { exerciseId: 'bench', modality: 'weighted', variantId: 'bench-press' },
      reps: 8,
      weightKg: 80,
      recordedAtIso: 'B',
    });
    expect([...upgraded].sort()).toEqual(['volume', 'weight']);
  });

  test('bodyweight set (no weight): only rep PR is in play', async () => {
    const upgraded = await recordIfPersonalRecord({
      key: { exerciseId: 'pushup', modality: 'bodyweight', variantId: 'pushup' },
      reps: 12,
      weightKg: 0,
      recordedAtIso: 'A',
    });
    expect(upgraded).toEqual(['rep']);
  });
});
