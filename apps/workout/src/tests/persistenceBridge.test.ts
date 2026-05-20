/**
 * Persistence bridge tests — hydrate + store-action wiring.
 *
 * Mocks the persistence repository functions directly so we can
 * assert the bridge's behaviour without touching SQL.
 */

jest.mock('../persistence', () => {
  const saveSetMemory = jest.fn().mockResolvedValue(undefined);
  const loadAllSetMemory = jest.fn().mockResolvedValue({});
  const savePlayerMomentum = jest.fn().mockResolvedValue(undefined);
  const loadPlayerMomentum = jest.fn().mockResolvedValue(null);
  const appendQuestHistory = jest.fn().mockResolvedValue(undefined);
  const getMostRecentCompletedAtIso = jest.fn().mockResolvedValue(null);
  const listRecentQuests = jest.fn().mockResolvedValue([]);
  const recordIfPersonalRecord = jest.fn().mockResolvedValue([]);
  const initDatabase = jest.fn().mockResolvedValue(undefined);
  // The bridge consults isPersistenceDisabled() before every call;
  // default it to false so the existing tests behave the same as
  // before the disabled-latch landed.
  const isPersistenceDisabled = jest.fn(() => false);
  const getPersistenceDisabledReason = jest.fn(() => null);
  const disablePersistence = jest.fn();
  return {
    saveSetMemory,
    loadAllSetMemory,
    savePlayerMomentum,
    loadPlayerMomentum,
    appendQuestHistory,
    getMostRecentCompletedAtIso,
    listRecentQuests,
    recordIfPersonalRecord,
    initDatabase,
    isPersistenceDisabled,
    getPersistenceDisabledReason,
    disablePersistence,
  };
});

import * as persistence from '../persistence';
import {
  __resetClockForTests,
  __setClockForTests,
  daysSinceLastQuest,
  hydratePersistence,
  persistLoggedSet,
  persistQuestCompletion,
} from '../state/persistenceBridge';
import { useWorkoutGameStore } from '../state/workoutGameStore';
import { DEFAULT_PRIOR_MOMENTUM } from '../fixtures/pushDayQuest';

function resetStoreSpec(): void {
  useWorkoutGameStore.setState({
    persistenceReady: false,
    lastSessionAtIso: null,
    priorMomentum: DEFAULT_PRIOR_MOMENTUM,
    setMemory: {},
    defeatedEnemies: [],
    log: [],
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  resetStoreSpec();
  __resetClockForTests();
});

describe('hydratePersistence', () => {
  test('marks persistenceReady true even when no rows exist', async () => {
    const out = await hydratePersistence();
    expect(out.ok).toBe(true);
    expect(out.setMemoryCount).toBe(0);
    expect(useWorkoutGameStore.getState().persistenceReady).toBe(true);
    expect(useWorkoutGameStore.getState().priorMomentum).toBe(DEFAULT_PRIOR_MOMENTUM);
    expect(useWorkoutGameStore.getState().lastSessionAtIso).toBeNull();
  });

  test('seeds priorMomentum, lastSessionAtIso, and setMemory from persistence', async () => {
    (persistence.loadPlayerMomentum as jest.Mock).mockResolvedValueOnce({
      value: 62,
      lastSessionAtIso: '2026-05-18T08:00:00.000Z',
      lastReturnBonusAtIso: null,
      gentleModeUntilIso: null,
    });
    (persistence.getMostRecentCompletedAtIso as jest.Mock).mockResolvedValueOnce(
      '2026-05-18T08:00:00.000Z',
    );
    (persistence.loadAllSetMemory as jest.Mock).mockResolvedValueOnce({
      'pushup|bodyweight|pushup|0': {
        reps: 10,
        weightKg: undefined,
        durationSeconds: undefined,
        recordedAtIso: '2026-05-18T08:00:00.000Z',
      },
    });

    const out = await hydratePersistence();
    expect(out.ok).toBe(true);
    expect(out.setMemoryCount).toBe(1);
    const s = useWorkoutGameStore.getState();
    expect(s.priorMomentum).toBe(62);
    expect(s.lastSessionAtIso).toBe('2026-05-18T08:00:00.000Z');
    expect(s.setMemory['pushup|bodyweight|pushup|0']).toEqual({
      reps: 10,
      weightKg: undefined,
      durationSeconds: undefined,
      recordedAtIso: '2026-05-18T08:00:00.000Z',
    });
  });

  test('init failure is surfaced but the store still becomes ready (fallback to defaults)', async () => {
    (persistence.initDatabase as jest.Mock).mockRejectedValueOnce(
      new Error('disk full'),
    );
    const out = await hydratePersistence();
    expect(out.ok).toBe(false);
    expect(out.error).toMatch(/disk full/);
    expect(useWorkoutGameStore.getState().persistenceReady).toBe(true);
    expect(useWorkoutGameStore.getState().priorMomentum).toBe(DEFAULT_PRIOR_MOMENTUM);
  });
});

describe('persistLoggedSet', () => {
  test('calls saveSetMemory + recordIfPersonalRecord with the right inputs', async () => {
    __setClockForTests(() => '2026-05-19T11:00:00.000Z');
    (persistence.recordIfPersonalRecord as jest.Mock).mockResolvedValueOnce(['rep']);

    const upgraded = await persistLoggedSet({
      exerciseId: 'bench',
      modality: 'weighted',
      variantId: 'bench-press',
      setIndex: 2,
      reps: 8,
      weightKg: 80,
    });

    expect(upgraded).toEqual(['rep']);
    expect(persistence.saveSetMemory).toHaveBeenCalledWith(
      {
        exerciseId: 'bench',
        modality: 'weighted',
        variantId: 'bench-press',
        setIndex: 2,
      },
      expect.objectContaining({
        reps: 8,
        weightKg: 80,
        recordedAtIso: '2026-05-19T11:00:00.000Z',
      }),
    );
    expect(persistence.recordIfPersonalRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        key: {
          exerciseId: 'bench',
          modality: 'weighted',
          variantId: 'bench-press',
        },
        reps: 8,
        weightKg: 80,
        recordedAtIso: '2026-05-19T11:00:00.000Z',
      }),
    );
  });

  test('write failures do not throw', async () => {
    (persistence.saveSetMemory as jest.Mock).mockRejectedValueOnce(
      new Error('write blocked'),
    );
    const upgraded = await persistLoggedSet({
      exerciseId: 'pushup',
      modality: 'bodyweight',
      variantId: 'pushup',
      setIndex: 0,
      reps: 10,
    });
    expect(upgraded).toEqual([]);
  });
});

describe('persistQuestCompletion', () => {
  test('saves momentum + appends history; updates the store afterwards', async () => {
    __setClockForTests(() => '2026-05-19T11:30:00.000Z');
    await persistQuestCompletion({
      questId: 'quest-123',
      kind: 'strength',
      templateId: 'push_day',
      workingSetCount: 9,
      totalDamage: 540,
      xp: 60,
      momentumDelta: 6,
      defeatedEnemies: [
        {
          id: 'sluggard',
          name: 'Sluggard, Lord of Couches',
          mood: 'drift',
          category: 'lesser_fragment',
          maxHp: 540,
          damageDealtToThisPhase: 540,
          phaseIndex: 0,
          defeatedOnSetIndexInQuest: 8,
        },
      ],
      primaryVerdict: 'Finisher',
      finalMomentum: 33,
      payload: { foo: 'bar' },
    });
    expect(persistence.savePlayerMomentum).toHaveBeenCalledWith(
      expect.objectContaining({
        value: 33,
        lastSessionAtIso: '2026-05-19T11:30:00.000Z',
      }),
    );
    expect(persistence.appendQuestHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'quest-123',
        kind: 'strength',
        templateId: 'push_day',
        completedAtIso: '2026-05-19T11:30:00.000Z',
        workingSetCount: 9,
        totalDamage: 540,
        xp: 60,
        momentumDelta: 6,
        defeatedCount: 1,
        primaryVerdict: 'Finisher',
      }),
    );
    const s = useWorkoutGameStore.getState();
    expect(s.priorMomentum).toBe(33);
    expect(s.lastSessionAtIso).toBe('2026-05-19T11:30:00.000Z');
  });

  test('payload_json is valid JSON containing defeatedEnemies', async () => {
    __setClockForTests(() => '2026-05-19T11:30:00.000Z');
    await persistQuestCompletion({
      questId: 'q',
      kind: 'strength',
      workingSetCount: 1,
      totalDamage: 50,
      xp: 5,
      momentumDelta: 6,
      defeatedEnemies: [
        {
          id: 'sluggard',
          name: 'Sluggard',
          mood: 'drift',
          category: 'lesser_fragment',
          maxHp: 540,
          damageDealtToThisPhase: 540,
          phaseIndex: 0,
          defeatedOnSetIndexInQuest: 0,
        },
      ],
      primaryVerdict: 'Steady',
      finalMomentum: 31,
      payload: { ok: true },
    });
    const call = (persistence.appendQuestHistory as jest.Mock).mock.calls[0][0];
    const parsed = JSON.parse(call.payloadJson);
    expect(parsed.defeatedEnemies).toHaveLength(1);
    expect(parsed.defeatedEnemies[0].id).toBe('sluggard');
    expect(parsed.summary).toEqual({ ok: true });
  });
});

describe('daysSinceLastQuest', () => {
  test('returns 999 when no prior session', () => {
    expect(daysSinceLastQuest(null)).toBe(999);
  });

  test('returns whole-day gap based on the injected clock', () => {
    __setClockForTests(() => '2026-05-26T12:00:00.000Z');
    expect(daysSinceLastQuest('2026-05-19T12:00:00.000Z')).toBe(7);
    expect(daysSinceLastQuest('2026-05-25T12:00:00.000Z')).toBe(1);
    expect(daysSinceLastQuest('2026-05-26T11:00:00.000Z')).toBe(0);
  });

  test('returns 999 on non-parseable input', () => {
    expect(daysSinceLastQuest('not an ISO string')).toBe(999);
  });
});
