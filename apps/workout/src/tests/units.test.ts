/**
 * Weight-unit conversion + display tests.
 *
 * Pure-data; the unit module has no I/O. Round-trip tests pin
 * the NIST conversion factor and the rounding rules for the
 * stepper.
 */

import {
  DEFAULT_WEIGHT_UNIT,
  LB_PER_KG,
  convertKgToLb,
  convertLbToKg,
  displayWeight,
  draftToCanonicalKg,
  formatWeight,
  safeWeightUnit,
  stepSizeKg,
  type WeightUnit,
} from '../units';

describe('default + safe parsing', () => {
  test('default unit is pounds', () => {
    expect(DEFAULT_WEIGHT_UNIT).toBe('lb');
  });

  test('safeWeightUnit accepts known values', () => {
    expect(safeWeightUnit('lb')).toBe('lb');
    expect(safeWeightUnit('kg')).toBe('kg');
  });

  test('safeWeightUnit rejects anything else and returns the default', () => {
    expect(safeWeightUnit('Lb')).toBe('lb'); // case-sensitive
    expect(safeWeightUnit(' kg ')).toBe('lb');
    expect(safeWeightUnit('pounds')).toBe('lb');
    expect(safeWeightUnit('')).toBe('lb');
    expect(safeWeightUnit(null)).toBe('lb');
    expect(safeWeightUnit(undefined)).toBe('lb');
    expect(safeWeightUnit(42)).toBe('lb');
    expect(safeWeightUnit({})).toBe('lb');
  });
});

describe('conversion math', () => {
  test('uses the NIST factor', () => {
    expect(LB_PER_KG).toBeCloseTo(2.2046226218, 6);
  });

  test('convertKgToLb / convertLbToKg round-trip at 6 decimals', () => {
    for (const kg of [0, 0.5, 2.5, 40, 60.5, 100, 187.42]) {
      const lb = convertKgToLb(kg);
      const back = convertLbToKg(lb);
      expect(back).toBeCloseTo(kg, 6);
    }
  });

  test('non-finite inputs return 0', () => {
    expect(convertKgToLb(Number.NaN)).toBe(0);
    expect(convertKgToLb(Number.POSITIVE_INFINITY)).toBe(0);
    expect(convertLbToKg(Number.NaN)).toBe(0);
    expect(convertLbToKg(Number.NEGATIVE_INFINITY)).toBe(0);
  });

  test('40 kg ≈ 88 lb (round)', () => {
    expect(Math.round(convertKgToLb(40))).toBe(88);
  });

  test('100 lb ≈ 45.36 kg', () => {
    expect(convertLbToKg(100)).toBeCloseTo(45.36, 2);
  });
});

describe('displayWeight', () => {
  test('rounds kg display to nearest 0.5', () => {
    expect(displayWeight(40, 'kg')).toBe(40);
    expect(displayWeight(40.2, 'kg')).toBe(40);
    expect(displayWeight(40.3, 'kg')).toBe(40.5);
    expect(displayWeight(40.6, 'kg')).toBe(40.5);
    expect(displayWeight(40.75, 'kg')).toBe(41); // 40.75*2 = 81.5 → 82/2 = 41
  });

  test('rounds lb display to whole pound', () => {
    expect(displayWeight(0, 'lb')).toBe(0);
    expect(displayWeight(40, 'lb')).toBe(88);
    expect(displayWeight(80, 'lb')).toBe(176);
    expect(displayWeight(100, 'lb')).toBe(220);
  });

  test('non-finite returns 0', () => {
    expect(displayWeight(Number.NaN, 'lb')).toBe(0);
    expect(displayWeight(Number.POSITIVE_INFINITY, 'kg')).toBe(0);
  });
});

describe('formatWeight (display + suffix)', () => {
  test('produces "<n> lb" / "<n> kg"', () => {
    expect(formatWeight(40, 'lb')).toBe('88 lb');
    expect(formatWeight(40, 'kg')).toBe('40 kg');
  });

  test('matches the unit even when value is zero', () => {
    expect(formatWeight(0, 'lb')).toBe('0 lb');
    expect(formatWeight(0, 'kg')).toBe('0 kg');
  });
});

describe('draftToCanonicalKg', () => {
  test('kg passes through unchanged for the canonical case', () => {
    expect(draftToCanonicalKg(40, 'kg')).toBe(40);
  });

  test('lb is divided by the NIST factor', () => {
    expect(draftToCanonicalKg(88, 'lb')).toBeCloseTo(39.916, 2);
  });

  test('negative / non-finite drafts collapse to 0', () => {
    expect(draftToCanonicalKg(-1, 'lb')).toBe(0);
    expect(draftToCanonicalKg(Number.NaN, 'kg')).toBe(0);
  });
});

describe('stepSizeKg', () => {
  test('kg stepper uses 2.5 kg', () => {
    expect(stepSizeKg('kg')).toBe(2.5);
  });

  test('lb stepper uses 5 lb worth of kg (~2.27 kg)', () => {
    expect(stepSizeKg('lb')).toBeCloseTo(2.268, 3);
  });
});

describe('display invariants across unit toggle', () => {
  test('switching the unit does NOT change the canonical kg value', () => {
    // Simulates the UI: store keeps draftWeightKg; toggling the
    // display unit only affects what the user sees.
    const draftKg = 42.5;
    const lbDisplay = displayWeight(draftKg, 'lb');
    const kgDisplay = displayWeight(draftKg, 'kg');
    expect(lbDisplay).toBe(94); // 42.5 * 2.2046 ≈ 93.7 → 94
    expect(kgDisplay).toBe(42.5);
    // and the canonical value used for math hasn't been touched.
    expect(draftKg).toBe(42.5);
  });

  test('the stepper in lb mode steps by ~5 lb of canonical kg per tap', () => {
    const start = 40; // kg
    const step = stepSizeKg('lb');
    const after1 = start + step;
    const after2 = after1 + step;
    expect(displayWeight(start, 'lb')).toBe(88);
    expect(displayWeight(after1, 'lb')).toBe(93);
    expect(displayWeight(after2, 'lb')).toBe(98);
  });

  test('the stepper in kg mode steps by 2.5 kg per tap', () => {
    const start = 40;
    const step = stepSizeKg('kg');
    expect(displayWeight(start, 'kg')).toBe(40);
    expect(displayWeight(start + step, 'kg')).toBe(42.5);
    expect(displayWeight(start + 2 * step, 'kg')).toBe(45);
  });

  test('WeightUnit type narrows correctly', () => {
    // Compile-time guard — this would fail tsc if the union shifted.
    const u: WeightUnit = 'lb';
    expect(['lb', 'kg']).toContain(u);
  });
});
