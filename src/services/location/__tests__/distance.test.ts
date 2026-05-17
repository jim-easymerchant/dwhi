import { haversineMeters } from '../distance';

describe('haversineMeters', () => {
  test('returns 0 for identical points', () => {
    expect(haversineMeters(40.7128, -74.006, 40.7128, -74.006)).toBe(0);
  });

  test('approximately matches a known short distance (~100m)', () => {
    // Two points roughly 100m apart in latitude (0.0009° ≈ 100m).
    const d = haversineMeters(40.7128, -74.006, 40.7128 + 0.0009, -74.006);
    expect(d).toBeGreaterThan(95);
    expect(d).toBeLessThan(110);
  });

  test('approximately matches a known longer distance (NYC → LA ≈ 3,940km)', () => {
    const d = haversineMeters(40.7128, -74.006, 34.0522, -118.2437);
    // Allow a generous slack — haversine is a sphere approximation.
    expect(d).toBeGreaterThan(3_900_000);
    expect(d).toBeLessThan(4_000_000);
  });

  test('symmetric: order of arguments does not change the result', () => {
    const a = haversineMeters(51.5074, -0.1278, 48.8566, 2.3522);
    const b = haversineMeters(48.8566, 2.3522, 51.5074, -0.1278);
    expect(a).toBeCloseTo(b, 6);
  });
});
