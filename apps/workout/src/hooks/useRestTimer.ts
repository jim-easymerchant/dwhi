/**
 * useRestTimer — optional, supportive rest countdown.
 *
 * The whole point of this hook is "you can rest, but you don't
 * *have* to." It NEVER blocks progression. The player can:
 *   - start the timer at any common preset
 *   - dismiss it any time
 *   - keep working through the battle while the timer ticks
 *   - ignore it entirely
 *
 * Architecture
 * ============
 *
 * The state machine is a pure reducer (`restTimerReducer` below)
 * so its transitions can be unit-tested *without* React. The hook
 * is a thin wrapper that drives the reducer with `useReducer` and
 * a self-ticking `setInterval`.
 *
 * Side effects:
 *   - one `setInterval(_, 1000)` while the timer is running
 *   - cleaned up on unmount, on cancel, and on completion
 *
 * No external timer libraries. No new dependencies.
 *
 * See: docs/workout-rpg/023-ui-polish-hp-and-timers.md §6
 */

import * as React from 'react';

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

/** Common rest-period presets (in seconds). */
export const REST_PRESETS = [60, 90, 120] as const;
export type RestPresetSeconds = (typeof REST_PRESETS)[number];

/** A rest-timer session's lifecycle phase. */
export type RestTimerPhase = 'idle' | 'running' | 'complete';

/** Maximum seconds the start helper will honour. Defensive: a
 *  future custom-duration entry might pass arbitrary integers. */
export const MAX_TIMER_SECONDS = 60 * 60; // 1 hour

// ---------------------------------------------------------------------------
// Pure reducer — testable without React.
// ---------------------------------------------------------------------------

/** Internal reducer state. Exported for test use only. */
export interface RestTimerState {
  phase: RestTimerPhase;
  remainingSeconds: number;
  presetSeconds: number | null;
}

export const REST_TIMER_INITIAL_STATE: RestTimerState = {
  phase: 'idle',
  remainingSeconds: 0,
  presetSeconds: null,
};

export type RestTimerAction =
  | { type: 'START'; seconds: number }
  | { type: 'TICK' }
  | { type: 'CANCEL' }
  | { type: 'ACKNOWLEDGE_COMPLETE' };

/**
 * Pure state-machine. Same input + state → same output, every time.
 *
 * Transitions:
 *
 *   idle      --START-->    running   (seconds clamped to [1, MAX])
 *   running   --TICK-->     running (n-1)  OR  complete (when n==1)
 *   running   --CANCEL-->   idle
 *   complete  --ACK-->      idle
 *   *         --START-->    running   (replaces prior, no stacking)
 *
 * Unknown actions are no-ops.
 */
export function restTimerReducer(
  state: RestTimerState,
  action: RestTimerAction,
): RestTimerState {
  switch (action.type) {
    case 'START': {
      const safe = Math.max(
        1,
        Math.min(MAX_TIMER_SECONDS, Math.floor(action.seconds)),
      );
      return {
        phase: 'running',
        remainingSeconds: safe,
        presetSeconds: safe,
      };
    }
    case 'TICK': {
      if (state.phase !== 'running') return state;
      if (state.remainingSeconds <= 1) {
        return {
          phase: 'complete',
          remainingSeconds: 0,
          presetSeconds: state.presetSeconds,
        };
      }
      return {
        ...state,
        remainingSeconds: state.remainingSeconds - 1,
      };
    }
    case 'CANCEL':
      return { ...REST_TIMER_INITIAL_STATE };
    case 'ACKNOWLEDGE_COMPLETE':
      if (state.phase !== 'complete') return state;
      return { ...REST_TIMER_INITIAL_STATE };
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/** The shape returned by the hook. */
export interface RestTimerApi {
  phase: RestTimerPhase;
  remainingSeconds: number;
  presetSeconds: number | null;
  start: (seconds: number) => void;
  cancel: () => void;
  acknowledgeComplete: () => void;
}

/**
 * The hook. Drives the pure reducer with a 1-second ticker while
 * the phase is "running". The interval is cleaned up on phase
 * change and unmount.
 */
export function useRestTimer(): RestTimerApi {
  const [state, dispatch] = React.useReducer(
    restTimerReducer,
    REST_TIMER_INITIAL_STATE,
  );

  // Self-ticking effect — runs only while the timer is "running".
  React.useEffect(() => {
    if (state.phase !== 'running') return undefined;
    const id = setInterval(() => dispatch({ type: 'TICK' }), 1000);
    return () => clearInterval(id);
  }, [state.phase]);

  const start = React.useCallback((seconds: number) => {
    dispatch({ type: 'START', seconds });
  }, []);
  const cancel = React.useCallback(() => dispatch({ type: 'CANCEL' }), []);
  const acknowledgeComplete = React.useCallback(
    () => dispatch({ type: 'ACKNOWLEDGE_COMPLETE' }),
    [],
  );

  return {
    phase: state.phase,
    remainingSeconds: state.remainingSeconds,
    presetSeconds: state.presetSeconds,
    start,
    cancel,
    acknowledgeComplete,
  };
}

/**
 * Format a remaining-seconds value as `mm:ss`. Pure helper.
 */
export function formatRestTime(seconds: number): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const minutes = Math.floor(safe / 60);
  const sec = safe % 60;
  return `${minutes}:${sec.toString().padStart(2, '0')}`;
}
