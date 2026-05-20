/**
 * apps/workout/src/units — weight unit conversion + display.
 *
 * Internal canonical unit is kilograms. User-facing unit is
 * either 'lb' (default) or 'kg', toggled from the Settings panel.
 */

export {
  DEFAULT_WEIGHT_UNIT,
  LB_PER_KG,
  convertKgToLb,
  convertLbToKg,
  displayWeight,
  draftToCanonicalKg,
  formatWeight,
  safeWeightUnit,
  stepSizeKg,
} from './units';

export type { WeightUnit } from './units';
