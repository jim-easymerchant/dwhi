/**
 * Enemy state — pure progression helpers.
 *
 * Spec: docs/workout-rpg/010-enemy-design-bible.md
 *
 * The orchestrator owns the HP arithmetic; enemies do not "act"
 * on their own. Mood escalation is *symbolic only* — a soft hint
 * the next session may carry forward. There is no AI.
 */

import type { EnemyInput } from './types';
import { ENEMY_MOODS, type EnemyMood } from '../enemies';

/**
 * In-progress enemy mutation snapshot. Returned by `applyDamageToEnemy`
 * so the caller can compose without mutating any shared object.
 */
export interface EnemyDamageStep {
  hpBefore: number;
  hpAfter: number;
  damageApplied: number;
  isDefeated: boolean;
  isOverkill: boolean;
  overkillAmount: number;
}

/**
 * Apply `damage` to a running HP value. Returns the new HP and
 * descriptive flags. HP floors at 0 — never negative. Damage that
 * would have driven HP below 0 is preserved as `overkillAmount`.
 *
 * Pure. Idempotent at HP = 0 (further damage is fully overkill).
 */
export function applyDamageToEnemy(
  currentHp: number,
  damage: number,
): EnemyDamageStep {
  const hpBefore = Math.max(0, currentHp);
  const d = Math.max(0, damage);
  const hpAfter = Math.max(0, hpBefore - d);
  const isDefeated = hpAfter === 0 && hpBefore > 0;
  const overkillAmount = d > hpBefore ? d - hpBefore : 0;
  return {
    hpBefore,
    hpAfter,
    damageApplied: Math.min(d, hpBefore),
    isDefeated,
    isOverkill: isDefeated && overkillAmount > 0,
    overkillAmount,
  };
}

/** True when an enemy's HP has reached 0. */
export function isEnemyDefeated(currentHp: number): boolean {
  return Math.max(0, currentHp) === 0;
}

/**
 * Calculate raw overkill — useful for narrative beats. Returns 0
 * when the hit was at-or-under the remaining HP.
 */
export function calculateOverkill(
  damage: number,
  remainingHp: number,
): number {
  const d = Math.max(0, damage);
  const hp = Math.max(0, remainingHp);
  return d > hp ? d - hp : 0;
}

/**
 * Symbolic mood escalation. Lightweight, deterministic, optional.
 *
 * Transitions:
 *   - Drift → Hush  on long grind  (working sets past planned+30%)
 *   - Hush  → Stone on comeback defeat
 *   - Glare → Stone on comeback defeat
 *   - Stone stays Stone (already-set tier)
 *
 * Any other input returns the original mood unchanged.
 */
export function maybeEscalateEnemyMood(input: {
  enemy: Pick<EnemyInput, 'mood'>;
  longGrind?: boolean;
  isComebackDefeat?: boolean;
}): EnemyMood {
  const { mood } = input.enemy;
  if (input.longGrind && mood === 'drift') return 'hush';
  if (input.isComebackDefeat) {
    if (mood === 'hush' || mood === 'glare') return 'stone';
  }
  return mood;
}

/** Tiny utility for tests / callers that want to reason about ordering. */
export function moodRank(mood: EnemyMood): number {
  return ENEMY_MOODS.indexOf(mood);
}
