// [IQ] src/engine/combat.js — damage calculation and turn resolution

// === EXPERIMENTAL CARDIO CONSTANTS ===
// Framework for defining cardio mapping to damage engine (ENG-FEAT-05)
export const EXPERIMENTAL_CARDIO_HOLD_WEIGHT = 1; // used for timed holds/planks
export const EXPERIMENTAL_CARDIO_CAL_PER_REP = 1.0; // placeholder for rowing/cycling
export const EXPERIMENTAL_CARDIO_SPEED_MULT = 1.0; // placeholder for running

/**
 * Estimated one-rep max (Epley formula).
 * Normalizes any weight+reps combo to a comparable single number.
 *
 * @param {number} weight
 * @param {number} reps
 * @returns {number}
 */
export function calcE1RM(weight, reps) {
  return weight * (1 + reps / 30);
}

/**
 * Calculate damage dealt by a player's set.
 *
 * Intensity is currentE1RM / bestE1RM — relative effort, not absolute weight.
 * A beginner at 80% of their e1RM deals the same damage as an advanced lifter
 * at 80% of theirs. If bestE1RM is 0 (no history), falls back to flat 0.5.
 *
 * PRs naturally hit harder: if currentE1RM > bestE1RM, intensity > 1.0.
 * This is intentional — no clamping.
 *
 * @param {object} params
 * @param {number} params.weight       - Weight used for this set
 * @param {number} params.reps         - Reps completed
 * @param {number} params.bestE1RM     - Highest e1RM ever logged for this exercise (0 = unknown)
 * @param {'beginner'|'intermediate'|'advanced'} params.userTier
 * @param {number} params.targetReps   - Programmed rep target for this set
 * @returns {number} damage (minimum 1)
 */
export function calculateDamage({ weight, reps, bestE1RM, userTier, targetReps }) {
  // userTier is intentionally unused here.
  // Tier scales MONSTER HP and difficulty (harder monsters for higher tiers),
  // not player damage output. A beginner at 80% effort == advanced at 80% effort.
  void userTier;

  const currentE1RM = calcE1RM(weight, reps);

  // Intensity: how hard are they pushing relative to their best?
  const intensity = bestE1RM > 0 ? (currentE1RM / bestE1RM) : 0.5;

  // Volume: reps completed vs target
  const volumeRatio = reps / targetReps;

  // Base effort score
  const effortScore = (intensity * 0.6) + (volumeRatio * 0.4);

  // Base damage scales to monster HP pool
  const baseDamage = Math.round(effortScore * 25);

  // Small random variance (±10%) keeps it interesting
  const variance = 0.9 + (Math.random() * 0.2);

  return Math.max(1, Math.round(baseDamage * variance));
}

/**
 * Resolve a monster counter-attack.
 * Returns the damage dealt to the player.
 *
 * @param {number} baseAttackDamage
 * @param {boolean} enraged - if true, +40% damage
 * @returns {number}
 */
export function resolveMonsterAttack(baseAttackDamage, enraged) {
  const multiplier = enraged ? 1.4 : 1.0;
  const variance = 0.9 + (Math.random() * 0.2);
  return Math.max(1, Math.round(baseAttackDamage * multiplier * variance));
}

/**
 * Build a combat log entry.
 *
 * @param {'player'|'monster'|'system'} actor
 * @param {number} damage
 * @param {string} text  - announcer line
 * @param {number} turn
 * @returns {{ turn: number, actor: string, damage: number, text: string }}
 */
export function makeCombatLogEntry(actor, damage, text, turn) {
  return { turn, actor, damage, text };
}

/**
 * Scan the workout log and return the highest e1RM ever achieved for an exercise.
 * Returns 0 if no history exists — calculateDamage handles this with flat 0.5 intensity.
 *
 * @param {string} exerciseId
 * @param {Array} workoutLog - array of session entries from AsyncStorage (rkb_workout_log_v2)
 * @returns {number}
 */
export function getExerciseMax(exerciseId, workoutLog) {
  if (!workoutLog || workoutLog.length === 0) return 0;

  let max = 0;
  for (const entry of workoutLog) {
    const sets = entry?.sets?.[exerciseId];
    if (!sets) continue;
    for (const set of sets) {
      if (!set.done || !set.weight || !set.reps) continue;
      const w = parseFloat(set.weight);
      const r = parseFloat(set.reps);
      if (isNaN(w) || isNaN(r)) continue;
      const e1rm = calcE1RM(w, r);
      if (e1rm > max) max = e1rm;
    }
  }
  return max;
}

/**
 * Returns true if the current set's e1RM is a new personal record for this exercise.
 * Strict greater-than: matching a previous best does not trigger the callout.
 *
 * @param {string} exerciseId
 * @param {number} weight
 * @param {number} reps
 * @param {Array} workoutLog
 * @returns {boolean}
 */
export function checkPersonalRecord(exerciseId, weight, reps, workoutLog) {
  if (!weight || weight <= 0 || !reps || reps <= 0) return false;
  return calcE1RM(weight, reps) > getExerciseMax(exerciseId, workoutLog);
}

// --- Smoke test ---
// Run (PowerShell): Get-Content src/engine/combat.js | node --input-type=module
// Run (bash):       node --input-type=module < src/engine/combat.js
// Remove before shipping.

const scenarios = [
  {
    label: 'Low effort — beginner (e1RM=60, bestE1RM=100 → intensity=0.60, vol=0.60)',
    params: { weight: 50, reps: 6, bestE1RM: 100, userTier: 'beginner', targetReps: 10 },
    // currentE1RM=50*(1+6/30)=60, intensity=60/100=0.60
    // effortScore=0.60*0.6 + 0.60*0.4=0.60 → base=15 → expected ~13-17
  },
  {
    label: 'Low effort — advanced, same relative effort (e1RM=180, bestE1RM=300 → intensity=0.60, vol=0.60)',
    params: { weight: 150, reps: 6, bestE1RM: 300, userTier: 'advanced', targetReps: 10 },
    // currentE1RM=150*(1+6/30)=180, intensity=180/300=0.60 — SAME as above
    // effortScore=0.60 → base=15 → expected ~13-17 (identical to beginner scenario)
  },
  {
    label: 'Unknown max — fallback (bestE1RM=0, flat 0.5 intensity, full volume)',
    params: { weight: 95, reps: 10, bestE1RM: 0, userTier: 'beginner', targetReps: 10 },
    // intensity=0.50 (fallback), volumeRatio=1.0
    // effortScore=0.50*0.6 + 1.0*0.4=0.70 → base=18 → expected ~16-20
  },
  {
    label: 'Solid effort (e1RM≈93, bestE1RM=120 → intensity≈0.78, vol=0.50)',
    params: { weight: 80, reps: 5, bestE1RM: 120, userTier: 'intermediate', targetReps: 10 },
    // currentE1RM=80*(1+5/30)≈93.3, intensity≈0.78
    // effortScore=0.78*0.6 + 0.50*0.4=0.67 → base=17 → expected ~15-19
  },
  {
    label: 'PR hit — intensity > 1.0 (e1RM=130 beats bestE1RM=120)',
    params: { weight: 100, reps: 9, bestE1RM: 120, userTier: 'advanced', targetReps: 10 },
    // currentE1RM=100*(1+9/30)=130, intensity=130/120≈1.08
    // effortScore=1.08*0.6 + 0.90*0.4=1.01 → base=25 → expected ~22-28
    // Higher than any non-PR scenario — PRs hit harder by design
  },
];

console.log('[IQ] === calculateDamage smoke test (e1RM) ===');
scenarios.forEach(({ label, params }) => {
  const results = [1, 2, 3].map(() => calculateDamage(params));
  console.log(`[IQ] ${label}`);
  console.log(`[IQ]   params: ${JSON.stringify(params)}`);
  console.log(`[IQ]   damage (3 rolls): ${results.join(', ')}`);
});
console.log('[IQ] === end smoke test ===');
