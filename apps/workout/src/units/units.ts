/**
 * Weight units — user-facing display + internal canonical storage.
 *
 * Design choices:
 *
 *   - Internal canonical unit is **kilograms** (kg). Every value
 *     stored in the database, every input to the orchestrator, and
 *     every `weightKg` field on a logged set is kg. This matches
 *     the existing schema (`weight_kg REAL`) and the orchestrator's
 *     exercise profiles.
 *
 *   - User-facing display is whatever the user selected. The
 *     default is **lb** (pounds), per the product brief — the
 *     North-American audience is the dominant first cohort.
 *
 *   - Conversion is lossless and round-trips at 6-digit precision.
 *     The `1 kg = 2.2046226218 lb` factor is the official NIST
 *     value; rounded display values do not feed back into the
 *     canonical kg value.
 *
 * No new dependencies. Pure functions. No I/O.
 *
 * See:
 *   docs/workout-rpg/021-expo-go-setup.md (setup)
 *   docs/workout-rpg/022-household-integration-plan.md (per-user
 *     preference scope)
 */

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

/** Display unit; canonical storage is always kg. */
export type WeightUnit = 'lb' | 'kg';

/** Default unit on a fresh install (no stored preference). */
export const DEFAULT_WEIGHT_UNIT: WeightUnit = 'lb';

/** NIST kg → lb conversion factor. */
export const LB_PER_KG = 2.2046226218;

// ---------------------------------------------------------------------------
// Conversion — pure, lossless at 6 decimals.
// ---------------------------------------------------------------------------

/** Convert a kilogram value to pounds. NaN / non-finite → 0. */
export function convertKgToLb(kg: number): number {
  if (!Number.isFinite(kg)) return 0;
  return kg * LB_PER_KG;
}

/** Convert a pound value to kilograms. NaN / non-finite → 0. */
export function convertLbToKg(lb: number): number {
  if (!Number.isFinite(lb)) return 0;
  return lb / LB_PER_KG;
}

// ---------------------------------------------------------------------------
// Display formatting.
// ---------------------------------------------------------------------------

/**
 * Round a kg value to a user-facing display in the requested unit.
 * The result is a number (not a string) — UIs can append " lb" /
 * " kg" with whatever spacing their layout needs.
 *
 * Rounding rules:
 *   - lb display rounds to nearest 1 lb (whole numbers — gym
 *     plates jump in 5/10/25 lb steps in the US; whole numbers
 *     are the right resolution).
 *   - kg display rounds to nearest 0.5 kg (matching the existing
 *     0.5-kg stepper in the Battle screen).
 *
 * Pure. No I/O.
 */
export function displayWeight(kg: number, unit: WeightUnit): number {
  if (!Number.isFinite(kg)) return 0;
  if (unit === 'kg') return Math.round(kg * 2) / 2;
  return Math.round(convertKgToLb(kg));
}

/**
 * Format `displayWeight` with the unit suffix appended. Useful for
 * the status row "WEIGHT" card. The unit is appended with one
 * space and is lowercase ("lb" / "kg") to match the existing UI
 * conventions.
 */
export function formatWeight(kg: number, unit: WeightUnit): string {
  return `${displayWeight(kg, unit)} ${unit}`;
}

// ---------------------------------------------------------------------------
// Input parsing — a stepper-friendly helper.
// ---------------------------------------------------------------------------

/**
 * Convert a user-facing draft value (in `unit`) back to canonical
 * kg, ready for the store / orchestrator. NaN / negative → 0.
 *
 * NB: this is the inverse of `displayWeight` only at the
 * rounding-grid level. A user who types "187 lb" gets back
 * `187 / 2.2046226218 ≈ 84.82 kg` exactly; rounding for display
 * happens downstream.
 */
export function draftToCanonicalKg(value: number, unit: WeightUnit): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return unit === 'kg' ? value : convertLbToKg(value);
}

/**
 * Step size used by the Battle screen's weight stepper in the
 * given unit. Returns the kilogram step for the stepper's `+/-`
 * buttons:
 *
 *   - 'kg' → 2.5 kg (the existing default)
 *   - 'lb' → 5 lb worth of kg (≈ 2.27 kg) — matches a common US
 *     plate change.
 *
 * Pure.
 */
export function stepSizeKg(unit: WeightUnit): number {
  return unit === 'kg' ? 2.5 : convertLbToKg(5);
}

// ---------------------------------------------------------------------------
// Safety helper used by hydration / settings.
// ---------------------------------------------------------------------------

/**
 * Narrow an arbitrary value to a WeightUnit. Anything other than
 * 'lb' / 'kg' (including null, undefined, mixed case, whitespace)
 * → DEFAULT_WEIGHT_UNIT.
 *
 * Same shape as `safeThemeId` in the theme registry.
 */
export function safeWeightUnit(value: unknown): WeightUnit {
  if (value === 'lb' || value === 'kg') return value;
  return DEFAULT_WEIGHT_UNIT;
}
