/**
 * Workout-RPG colour palette.
 *
 * Extends `@dwhi/ui` base tokens with the named six-colour scheme
 * from docs/workout-rpg/012-battle-ux-and-feel.md §4. Each colour
 * has one job; no colour has two jobs.
 *
 *   Ember    — player presence, Momentum, attack flashes
 *   Stone    — the Hollow at rest, idle UI
 *   Ash      — Stillness, enemies, fog
 *   Hearth   — critical moments (PR, tier-up, crit)
 *   Moss     — recovery archetype, Camp
 *   Tideline — cardio, traversal
 *
 * No pure white (the world is warm). No saturated red as a warning
 * (Stillness is not alarming).
 */

export const workoutColors = {
  // Backgrounds & surfaces
  background: '#0B0B0F',
  surface: '#16161D',
  surfaceElevated: '#1F1F29',
  border: '#2A2A36',

  // Text
  textPrimary: '#F1E9DC', // off-white with an ember warmth
  textSecondary: '#9A9AA8',
  textMuted: '#6B6B78',

  // Named palette (each colour has one job)
  ember: '#E9A14B',
  emberDim: '#7A5021',
  stone: '#9A9AA8',
  ash: '#5E6473',
  hearth: '#D55E3F',
  moss: '#7DAE85',
  tideline: '#5DA9A1',

  // Functional
  overlay: 'rgba(11, 11, 15, 0.78)',
  divider: '#2A2A36',
} as const;

export const workoutSpacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const workoutRadii = {
  sm: 8,
  md: 14,
  lg: 22,
  pill: 999,
} as const;

export const workoutType = {
  title: { fontSize: 32, fontWeight: '700' as const, color: workoutColors.textPrimary },
  heading: { fontSize: 24, fontWeight: '600' as const, color: workoutColors.textPrimary },
  body: { fontSize: 17, fontWeight: '400' as const, color: workoutColors.textPrimary },
  label: { fontSize: 15, fontWeight: '500' as const, color: workoutColors.textSecondary },
  caption: { fontSize: 13, fontWeight: '400' as const, color: workoutColors.textMuted },
  verdict: { fontSize: 20, fontWeight: '600' as const, color: workoutColors.ember },
} as const;
