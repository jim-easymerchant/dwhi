/**
 * Core type vocabulary for the Workout RPG.
 *
 * Placeholders only — every union here is locked by a `const` tuple
 * so callers can iterate the legal values at runtime. No business
 * logic, no formulas, no side effects.
 *
 * See:
 *   docs/workout-rpg/001-design-bible.md
 *   docs/workout-rpg/006-monorepo-integration-plan.md
 *   docs/workout-rpg/011-progression-and-rewards.md
 *   docs/workout-rpg/012-battle-ux-and-feel.md
 */

// ---------------------------------------------------------------------------
// Session shape
// ---------------------------------------------------------------------------

/**
 * What kind of session a Quest represents.
 *
 * - `strength` — the combat surface (see 003-combat-mechanics.md).
 * - `recovery` — the Hearth, the Settle (see 012-battle-ux-and-feel.md §12).
 * - `cardio`   — the Long Road and traversal (see 009-cardio-world-systems.md).
 * - `camp`     — the one-tap recovery action (see 004-momentum-consistency.md §6).
 */
export const QUEST_KINDS = [
  'strength',
  'recovery',
  'cardio',
  'camp',
] as const;
export type QuestKind = (typeof QUEST_KINDS)[number];

/**
 * The structural role of a single Battle within a Quest.
 *
 * - `standard` — a Lesser Fragment (see 010-enemy-design-bible.md §4.1).
 * - `settle`   — a recovery Quest's per-segment shape (the Hearth replaces
 *                the enemy; "Settle" replaces "Attack").
 * - `ward`     — a boss-tier presence; one per region; post-MVP
 *                (see 010-enemy-design-bible.md §4.3).
 */
export const BATTLE_KINDS = ['standard', 'settle', 'ward'] as const;
export type BattleKind = (typeof BATTLE_KINDS)[number];
