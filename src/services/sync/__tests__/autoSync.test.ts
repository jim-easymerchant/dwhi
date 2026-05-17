/**
 * Verifies autoSync's three guarantees:
 *   1. Debounce — multiple requestAutoSync() calls in quick succession
 *      collapse into one run.
 *   2. No-overlap — a second request while a run is in flight just
 *      queues a follow-up.
 *   3. Short-circuit — requests without a linked remote household do
 *      not schedule anything.
 */

jest.useFakeTimers();

const getActiveContextOrNull = jest.fn();
const getSyncMode = jest.fn(async () => 'configured-signed-in');
jest.mock('@/services/householdContext', () => ({
  getActiveContextOrNull: () => getActiveContextOrNull(),
}));
jest.mock('../syncStatus', () => ({
  getSyncMode: () => getSyncMode(),
}));

import {
  __configureAutoSyncForTests,
  requestAutoSync,
  runSyncImmediately,
} from '../autoSync';
import type { SyncResult } from '../syncTypes';

const linkedCtx = {
  household: { id: 1, remoteId: 'remote-1' } as never,
  member: {} as never,
  device: {} as never,
};

const unlinkedCtx = {
  household: { id: 1, remoteId: null } as never,
  member: {} as never,
  device: {} as never,
};

function fakeOkResult(): SyncResult {
  return {
    ok: true,
    message: 'ok',
    pushed: 0,
    pulled: 0,
    errors: [],
    finishedAt: '2026-05-17T12:00:00Z',
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.clearAllTimers();
  getActiveContextOrNull.mockReturnValue(linkedCtx);
  getSyncMode.mockResolvedValue('configured-signed-in');
});

describe('requestAutoSync — debounce', () => {
  test('multiple back-to-back requests collapse into a single run', async () => {
    const runner = jest.fn().mockResolvedValue(fakeOkResult());
    __configureAutoSyncForTests({ runner, debounceMs: 200 });

    requestAutoSync('write-1');
    requestAutoSync('write-2');
    requestAutoSync('write-3');

    expect(runner).not.toHaveBeenCalled();
    jest.advanceTimersByTime(200);
    // The runner kicks off after the debounce; await microtasks.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(runner).toHaveBeenCalledTimes(1);
  });
});

describe('requestAutoSync — no overlap', () => {
  test('a request issued while a run is in flight queues exactly one follow-up', async () => {
    let resolveRunner: (v: SyncResult) => void = () => {};
    const runner = jest.fn().mockImplementation(
      () =>
        new Promise<SyncResult>(res => {
          resolveRunner = res;
        }),
    );
    __configureAutoSyncForTests({ runner, debounceMs: 0 });

    // First request → kicks runner.
    requestAutoSync('first');
    jest.advanceTimersByTime(0);
    await Promise.resolve();
    expect(runner).toHaveBeenCalledTimes(1);

    // Second + third requests while the first is in flight.
    requestAutoSync('second');
    requestAutoSync('third');
    jest.advanceTimersByTime(0);
    await Promise.resolve();
    // Still only one runner call so far — the second/third are queued.
    expect(runner).toHaveBeenCalledTimes(1);

    // Now finish the first run.
    resolveRunner(fakeOkResult());
    await Promise.resolve();
    await Promise.resolve();
    // The chained re-run debounces; advance and flush microtasks.
    jest.advanceTimersByTime(0);
    await Promise.resolve();
    await Promise.resolve();
    expect(runner).toHaveBeenCalledTimes(2);
  });
});

describe('requestAutoSync — short-circuit', () => {
  test('no schedule when active household has no remoteId', () => {
    getActiveContextOrNull.mockReturnValue(unlinkedCtx);
    const runner = jest.fn();
    __configureAutoSyncForTests({ runner, debounceMs: 50 });

    requestAutoSync('write');
    jest.advanceTimersByTime(1000);
    expect(runner).not.toHaveBeenCalled();
  });
});

describe('runSyncImmediately', () => {
  test('bypasses the debounce', async () => {
    const runner = jest.fn().mockResolvedValue(fakeOkResult());
    __configureAutoSyncForTests({ runner, debounceMs: 5_000 });

    const p = runSyncImmediately('button-tap');
    await p;
    expect(runner).toHaveBeenCalledTimes(1);
  });

  test('returns a SyncResult when sync mode is not signed-in', async () => {
    getSyncMode.mockResolvedValue('configured-signed-out' as never);
    const runner = jest.fn().mockResolvedValue(fakeOkResult());
    __configureAutoSyncForTests({ runner, debounceMs: 0 });

    const r = await runSyncImmediately('manual');
    expect(r.ok).toBe(false);
    expect(runner).not.toHaveBeenCalled();
  });
});
