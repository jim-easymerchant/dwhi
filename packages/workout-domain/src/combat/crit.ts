/**
 * Crit multiplier.
 *
 * Spec: docs/workout-rpg/003-combat-mechanics.md §2.6.
 *
 * A crit fires when any of the three PR kinds (rep / weight / volume)
 * triggers on the current set. Stacking is explicitly disallowed —
 * a triple PR is still a single 1.5x crit. We celebrate it visually,
 * not arithmetically.
 *
 * Per-archetype `critAffinity` may tilt the crit, but the final
 * multiplier is hard-clamped to `combatBalance.critMultiplier` (1.5).
 * Non-crit sets return 1.0.
 */

import { MULTIPLIER_CEILING, archetypeBalance, combatBalance } from './balance';
import type { CritMultiplierInput } from './types';

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

export function calculateCritMultiplier(input: CritMultiplierInput): number {
  if (!input.isPersonalRecord) {
    return 1;
  }
  const affinity = archetypeBalance[input.archetype].critAffinity;
  const raw = combatBalance.critMultiplier * affinity;
  return clamp(raw, 1, Math.min(MULTIPLIER_CEILING, combatBalance.critMultiplier));
}
