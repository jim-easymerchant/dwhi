/**
 * Equipment vocabulary — kinds, weapon families, armor sets.
 *
 * Placeholder types only. Unlock pipelines (consistency, return,
 * disciplined-exit) and the visual-evolution stages will arrive in
 * a later branch. Equipment is autobiographical, not stat soup —
 * see the philosophy doc.
 *
 * See:
 *   docs/workout-rpg/008-equipment-philosophy.md
 */

/**
 * Top-level partitioning. Weapons express attack identity; armor
 * expresses recovery / discipline identity.
 */
export const EQUIPMENT_KINDS = ['weapon', 'armor'] as const;
export type EquipmentKind = (typeof EQUIPMENT_KINDS)[number];

/**
 * Initial weapon families. These are examples seeded by the design
 * bible; the catalogue may grow, but each addition must satisfy
 * the "no stat soup" rule.
 */
export const WEAPON_FAMILIES = [
  'titan_hammer',
  'twin_ash_blades',
  'travelers_spear',
  'ember_staff',
] as const;
export type WeaponFamily = (typeof WEAPON_FAMILIES)[number];

/**
 * Initial armor sets. Each set reinforces a real-world behavior
 * pattern (consistency, returning, disciplined exit / recovery).
 */
export const ARMOR_SETS = [
  'stonebound_plate',
  'ashwalker_garb',
  'emberweave',
] as const;
export type ArmorSet = (typeof ARMOR_SETS)[number];
