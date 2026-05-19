// [IQ] src/engine/timer.js — turn timer
// Pure logic only. No store imports, no UI. One-time timeout card enforcement
// lives in combatStore.js — this module only provides pause/resume primitives.

let intervalId = null;
let remaining = 0;
let phase = 'idle'; // 'active' | 'idle'
let callbacks = {};

function tick() {
  remaining -= 1;
  callbacks.onTick?.(remaining);
  if (remaining <= 0) {
    const onEnd = callbacks.onEnd;
    CombatTimer.clear();
    onEnd?.();
  }
}

export const CombatTimer = {
  /**
   * Start a countdown timer.
   * Clears any existing interval before starting.
   *
   * @param {number} seconds - countdown duration
   * @param {object} cbs
   * @param {function} cbs.onTick - (remaining: number) => void
   * @param {function} cbs.onEnd  - () => void, fires when timer reaches 0
   */
  start(seconds, cbs) {
    CombatTimer.clear();
    callbacks = cbs ?? {};
    remaining = seconds;
    phase = 'active';
    // Fire immediately so the UI shows the starting value before the first tick
    callbacks.onTick?.(remaining);
    intervalId = setInterval(tick, 1000);
    console.log(`[IQ] Timer started: ${seconds}s`);
  },

  /**
   * Pause the timer. Preserves remaining so resume() picks up exactly
   * where it left off. No-op if already paused or idle.
   */
  pause() {
    if (intervalId === null) return;
    clearInterval(intervalId);
    intervalId = null;
    console.log(`[IQ] Timer paused at ${remaining}s`);
  },

  /**
   * Resume a paused timer. No-op if already running or phase is idle.
   */
  resume() {
    if (intervalId !== null || phase === 'idle') return;
    intervalId = setInterval(tick, 1000);
    console.log(`[IQ] Timer resumed at ${remaining}s`);
  },

  /**
   * Clear the timer completely. Call on victory, defeat, session cancel,
   * or navigate away. Safe to call multiple times.
   */
  clear() {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
    remaining = 0;
    phase = 'idle';
    callbacks = {};
    console.log('[IQ] Timer cleared');
  },

  /** Read-only accessors for the store or tests */
  getRemaining() { return remaining; },
  isRunning() { return intervalId !== null; },
};
