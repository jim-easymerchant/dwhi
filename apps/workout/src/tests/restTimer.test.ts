/**
 * useRestTimer + RestTimer tests.
 *
 * The hook is built on a pure reducer (`restTimerReducer`) so the
 * state-machine can be unit-tested without React. The component
 * file is grep-tested for the anti-punishment copy contract.
 *
 * Coverage:
 *   1. Reducer transitions: idle → running → complete → idle.
 *   2. Cancel from running returns to idle.
 *   3. Each TICK decrements; the last TICK flips to "complete".
 *   4. START replaces an in-flight timer (no stacking).
 *   5. START clamps absurd values to a safe range.
 *   6. Unknown action shapes are no-ops (defensive).
 *   7. Anti-punishment copy regression on RestTimer.tsx.
 *   8. `formatRestTime` formatting + edge cases.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  MAX_TIMER_SECONDS,
  REST_PRESETS,
  REST_TIMER_INITIAL_STATE,
  formatRestTime,
  restTimerReducer,
  type RestTimerAction,
  type RestTimerState,
} from '../hooks/useRestTimer';

describe('restTimerReducer — initial state + presets', () => {
  test('initial state is idle / 0 / null', () => {
    expect(REST_TIMER_INITIAL_STATE.phase).toBe('idle');
    expect(REST_TIMER_INITIAL_STATE.remainingSeconds).toBe(0);
    expect(REST_TIMER_INITIAL_STATE.presetSeconds).toBeNull();
  });

  test('preset list matches the spec (60 / 90 / 120 seconds)', () => {
    expect(REST_PRESETS).toEqual([60, 90, 120]);
  });
});

describe('restTimerReducer — START transitions', () => {
  test('idle → running with the requested countdown', () => {
    const next = restTimerReducer(REST_TIMER_INITIAL_STATE, {
      type: 'START',
      seconds: 90,
    });
    expect(next.phase).toBe('running');
    expect(next.remainingSeconds).toBe(90);
    expect(next.presetSeconds).toBe(90);
  });

  test('START during running replaces the prior timer (no stacking)', () => {
    const a = restTimerReducer(REST_TIMER_INITIAL_STATE, { type: 'START', seconds: 60 });
    const b = restTimerReducer(a, { type: 'TICK' });
    expect(b.remainingSeconds).toBe(59);
    const c = restTimerReducer(b, { type: 'START', seconds: 120 });
    expect(c.remainingSeconds).toBe(120);
    expect(c.presetSeconds).toBe(120);
  });

  test('START during complete also replaces with a fresh run', () => {
    let s: RestTimerState = restTimerReducer(REST_TIMER_INITIAL_STATE, {
      type: 'START',
      seconds: 1,
    });
    s = restTimerReducer(s, { type: 'TICK' });
    expect(s.phase).toBe('complete');
    const next = restTimerReducer(s, { type: 'START', seconds: 30 });
    expect(next.phase).toBe('running');
    expect(next.remainingSeconds).toBe(30);
  });

  test('START clamps non-positive durations to ≥ 1 second', () => {
    expect(
      restTimerReducer(REST_TIMER_INITIAL_STATE, { type: 'START', seconds: 0 })
        .remainingSeconds,
    ).toBe(1);
    expect(
      restTimerReducer(REST_TIMER_INITIAL_STATE, { type: 'START', seconds: -5 })
        .remainingSeconds,
    ).toBe(1);
  });

  test('START clamps absurd durations to MAX_TIMER_SECONDS', () => {
    const out = restTimerReducer(REST_TIMER_INITIAL_STATE, {
      type: 'START',
      seconds: 99_999,
    });
    expect(out.remainingSeconds).toBe(MAX_TIMER_SECONDS);
  });
});

describe('restTimerReducer — TICK transitions', () => {
  test('a TICK while idle is a no-op', () => {
    const next = restTimerReducer(REST_TIMER_INITIAL_STATE, { type: 'TICK' });
    expect(next).toEqual(REST_TIMER_INITIAL_STATE);
  });

  test('a TICK while running decrements remainingSeconds', () => {
    const running = restTimerReducer(REST_TIMER_INITIAL_STATE, {
      type: 'START',
      seconds: 5,
    });
    const after1 = restTimerReducer(running, { type: 'TICK' });
    const after2 = restTimerReducer(after1, { type: 'TICK' });
    expect(after1.remainingSeconds).toBe(4);
    expect(after2.remainingSeconds).toBe(3);
    expect(after2.phase).toBe('running');
  });

  test('the final TICK transitions to "complete"', () => {
    let s: RestTimerState = restTimerReducer(REST_TIMER_INITIAL_STATE, {
      type: 'START',
      seconds: 2,
    });
    s = restTimerReducer(s, { type: 'TICK' });
    expect(s.phase).toBe('running');
    expect(s.remainingSeconds).toBe(1);
    s = restTimerReducer(s, { type: 'TICK' });
    expect(s.phase).toBe('complete');
    expect(s.remainingSeconds).toBe(0);
  });

  test('a TICK in the "complete" phase is a no-op', () => {
    let s: RestTimerState = restTimerReducer(REST_TIMER_INITIAL_STATE, {
      type: 'START',
      seconds: 1,
    });
    s = restTimerReducer(s, { type: 'TICK' });
    expect(s.phase).toBe('complete');
    const after = restTimerReducer(s, { type: 'TICK' });
    expect(after).toEqual(s);
  });
});

describe('restTimerReducer — CANCEL + ACKNOWLEDGE_COMPLETE', () => {
  test('CANCEL from running returns to idle', () => {
    const running = restTimerReducer(REST_TIMER_INITIAL_STATE, {
      type: 'START',
      seconds: 60,
    });
    const cancelled = restTimerReducer(running, { type: 'CANCEL' });
    expect(cancelled).toEqual(REST_TIMER_INITIAL_STATE);
  });

  test('CANCEL from idle stays idle', () => {
    expect(
      restTimerReducer(REST_TIMER_INITIAL_STATE, { type: 'CANCEL' }),
    ).toEqual(REST_TIMER_INITIAL_STATE);
  });

  test('ACKNOWLEDGE_COMPLETE only fires when phase is complete', () => {
    // Idle / running both no-op.
    expect(
      restTimerReducer(REST_TIMER_INITIAL_STATE, { type: 'ACKNOWLEDGE_COMPLETE' }),
    ).toEqual(REST_TIMER_INITIAL_STATE);
    const running = restTimerReducer(REST_TIMER_INITIAL_STATE, {
      type: 'START',
      seconds: 60,
    });
    expect(
      restTimerReducer(running, { type: 'ACKNOWLEDGE_COMPLETE' }),
    ).toEqual(running);

    // Complete → idle.
    let s: RestTimerState = restTimerReducer(REST_TIMER_INITIAL_STATE, {
      type: 'START',
      seconds: 1,
    });
    s = restTimerReducer(s, { type: 'TICK' });
    const ack = restTimerReducer(s, { type: 'ACKNOWLEDGE_COMPLETE' });
    expect(ack).toEqual(REST_TIMER_INITIAL_STATE);
  });
});

describe('restTimerReducer — defensive shape', () => {
  test('unknown action types are no-ops (the reducer returns the same state ref)', () => {
    const running = restTimerReducer(REST_TIMER_INITIAL_STATE, {
      type: 'START',
      seconds: 30,
    });
    const next = restTimerReducer(running, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type: 'NOT_A_REAL_ACTION',
    } as unknown as RestTimerAction);
    expect(next).toEqual(running);
  });
});

describe('formatRestTime', () => {
  test('formats whole minutes', () => {
    expect(formatRestTime(60)).toBe('1:00');
    expect(formatRestTime(120)).toBe('2:00');
  });

  test('pads single-digit seconds', () => {
    expect(formatRestTime(63)).toBe('1:03');
    expect(formatRestTime(7)).toBe('0:07');
  });

  test('handles 0 / negative / non-finite gracefully', () => {
    expect(formatRestTime(0)).toBe('0:00');
    expect(formatRestTime(-5)).toBe('0:00');
    expect(formatRestTime(Number.NaN)).toBe('0:00');
    expect(formatRestTime(Number.POSITIVE_INFINITY)).toBe('0:00');
  });
});

describe('RestTimer component — anti-punishment copy', () => {
  const COMPONENT_PATH = path.resolve(
    __dirname,
    '..',
    'components',
    'battle',
    'RestTimer.tsx',
  );
  const text = fs.readFileSync(COMPONENT_PATH, 'utf8');

  test('does NOT contain alarmist / blocking copy', () => {
    const BANNED = [
      /\bWAIT\b/,
      /RECOVERY REQUIRED/i,
      /DO NOT SKIP/i,
      /\bMUST REST\b/i,
      /\bFORCED\b/i,
    ];
    for (const re of BANNED) {
      expect(text).not.toMatch(re);
    }
  });

  test('contains the supportive phrasing prescribed by the brief', () => {
    expect(text).toContain('Rest a moment?');
    expect(text).toContain('Ready when you are');
    expect(text).toContain('Timer complete.');
  });
});
