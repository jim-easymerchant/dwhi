/**
 * @dwhi/workout-domain
 *
 * Workout RPG domain surface. Owns the vocabulary the future
 * `apps/workout` consumer needs to talk about exercises, archetypes,
 * enemies, momentum, progression, battle shape, cardio, and
 * equipment.
 *
 * Strict rules (mirrored as test guards in `__tests__/barrel.test.ts`):
 *
 *   - No React, no React Native imports anywhere in this package.
 *   - No imports from `@/...` (the DWHI app's source tree).
 *   - No imports from `@dwhi/domain` (pantry-specific).
 *   - No side effects: every export is a pure type or a frozen
 *     literal tuple of strings.
 *
 * This branch is *scaffold only*. Combat math, momentum decay,
 * progression bonuses, cardio formulas, and equipment unlock
 * pipelines live in follow-up branches:
 *
 *   - claude/workout-rpg-combat-core-<token>
 *   - claude/workout-rpg-momentum-<token>
 *   - claude/workout-rpg-mvp-ui-<token>
 *
 * See `docs/workout-rpg/006-monorepo-integration-plan.md` for the
 * full branch sequence.
 */
export * from './types';
export * from './exercises';
export * from './enemies';
export * from './momentum';
export * from './cardio';
export * from './equipment';
export * from './combat';
// `battle` and `progression` re-export from `./types`; importing them
// again at the root would produce duplicate-export errors. The
// sub-barrels exist so consumers can write
//   import { BattleKind } from '@dwhi/workout-domain/battle';
// without pulling the full surface.
