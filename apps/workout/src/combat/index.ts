/**
 * apps/workout/src/combat — local-side combat helpers.
 *
 * The orchestrator math lives in `@dwhi/workout-domain`. This
 * folder is for app-side concepts that aren't part of the
 * orchestrator contract — currently only Player HP (readiness /
 * capacity, decoupled from any orchestrator value).
 */

export {
  BASE_PLAYER_HP,
  LEVEL_BONUS,
  MAX_RECENT_SESSIONS,
  MOMENTUM_BONUS,
  RECENT_SESSION_BONUS,
  computePlayerHp,
  playerHpFromInputs,
} from './playerHp';

export type { PlayerHpBreakdown, PlayerHpInputs } from './playerHp';
