/**
 * @dwhi/workout-domain/orchestrator
 *
 * The Quest transaction pipeline. Pure. Deterministic. No I/O, no
 * clock, no random.
 *
 *   runQuest                      — top-level entry; full pipeline
 *   resolveMomentumAfterQuest     — decay → gain → tier, in one
 *                                   atomic step
 *   resolveVerdicts               — narrative labels for a completed
 *                                   Quest (multiple coexist)
 *   buildRewardPacket             — deterministic reward shape (no
 *                                   loot tables, no RNG)
 *   applyDamageToEnemy            — pure HP step with overkill +
 *                                   defeated flags
 *   maybeEscalateEnemyMood        — lightweight symbolic mood shift
 *
 * See docs/workout-rpg/002-core-loop.md, §003 §006 §010 §011 §012
 * for the system shape this layer realises.
 */

export * from './enemyState';
export * from './momentumSession';
export * from './questRunner';
export * from './questSummary';
export * from './types';
