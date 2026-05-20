/**
 * apps/workout/src/leveling — displayed player level + curve.
 *
 * Pure functions. The displayed LEVEL is derived from cumulative
 * quest XP, NOT from current Momentum. Momentum stays in the
 * Ember bar; LEVEL is a history mirror.
 */

export {
  LEVEL_CURVE_BASE,
  LEVEL_CURVE_EXPONENT,
  MIN_LEVEL,
  describeLevelProgress,
  levelForCumulativeXp,
  xpForLevel,
} from './levelCurve';

export type { LevelProgress } from './levelCurve';
