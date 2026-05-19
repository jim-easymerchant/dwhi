/**
 * @dwhi/workout-domain/combat
 *
 * Pure deterministic combat engine. No async, no I/O, no React, no
 * Expo, no SQLite, no Supabase. Every public function takes a
 * serialisable input and returns a serialisable output; given the
 * same input it returns the same output.
 *
 * Tunable constants are centralised in `./balance.ts`. Business
 * logic lives in:
 *
 *   damage.ts    — calculateSetDamage, calculateEffectiveLoad,
 *                  calculateEffectiveReps, calculateArchetypeMultiplier
 *   fatigue.ts   — calculateFatigueMultiplier, accumulateFatigue
 *   crit.ts      — calculateCritMultiplier
 *   momentum.ts  — resolveMomentumTier, calculateMomentumMultiplier,
 *                  calculateMomentumGain, calculateMomentumDecay
 *   questXp.ts   — calculateQuestXp
 *
 * See docs/workout-rpg/003-combat-mechanics.md for the formula
 * spec and §8 for the canonical worked example that the golden
 * tests pin down.
 */

export * from './balance';
export * from './crit';
export * from './damage';
export * from './fatigue';
export * from './momentum';
export * from './questXp';
export * from './types';
