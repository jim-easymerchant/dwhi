import { shouldStoreLocation } from '../shouldStoreLocation';

const T = (iso: string) => iso;

describe('shouldStoreLocation', () => {
  test('first point ever is always stored', () => {
    const decision = shouldStoreLocation(null, {
      latitude: 40,
      longitude: -74,
      accuracy: 50,
      capturedAt: T('2026-05-17T12:00:00Z'),
    });
    expect(decision).toEqual({ store: true, reason: 'first-point' });
  });

  test('malformed coords are rejected', () => {
    const decision = shouldStoreLocation(null, {
      latitude: Number.NaN,
      longitude: -74,
      capturedAt: T('2026-05-17T12:00:00Z'),
    });
    expect(decision.store).toBe(false);
    expect(decision.reason).toBe('malformed');
  });

  test('out-of-range lat/lon rejected as malformed', () => {
    const decision = shouldStoreLocation(null, {
      latitude: 200,
      longitude: -74,
      capturedAt: T('2026-05-17T12:00:00Z'),
    });
    expect(decision.reason).toBe('malformed');
  });

  test('poor-accuracy rejected when there is a previous point', () => {
    const decision = shouldStoreLocation(
      {
        latitude: 40,
        longitude: -74,
        accuracy: 30,
        capturedAt: T('2026-05-17T11:55:00Z'),
      },
      {
        latitude: 40.01,
        longitude: -74,
        accuracy: 500,
        capturedAt: T('2026-05-17T12:00:00Z'),
      },
    );
    expect(decision).toEqual({ store: false, reason: 'poor-accuracy' });
  });

  test('first point ignores accuracy ceiling', () => {
    const decision = shouldStoreLocation(null, {
      latitude: 40,
      longitude: -74,
      accuracy: 999,
      capturedAt: T('2026-05-17T12:00:00Z'),
    });
    expect(decision.store).toBe(true);
    expect(decision.reason).toBe('first-point');
  });

  test('stale-previous forces a store even with no movement', () => {
    const previousAt = T('2026-05-17T10:00:00Z');
    const nextAt = T('2026-05-17T12:00:00Z'); // 2 hours later
    const decision = shouldStoreLocation(
      { latitude: 40, longitude: -74, accuracy: 20, capturedAt: previousAt },
      { latitude: 40, longitude: -74, accuracy: 20, capturedAt: nextAt },
    );
    expect(decision).toEqual({ store: true, reason: 'stale-previous' });
  });

  test('movement above threshold stores with reason moved-enough', () => {
    const decision = shouldStoreLocation(
      {
        latitude: 40,
        longitude: -74,
        accuracy: 20,
        capturedAt: T('2026-05-17T11:59:00Z'),
      },
      {
        // ~150m north
        latitude: 40 + 0.00135,
        longitude: -74,
        accuracy: 20,
        capturedAt: T('2026-05-17T12:00:00Z'),
      },
    );
    expect(decision.store).toBe(true);
    expect(decision.reason).toBe('moved-enough');
  });

  test('below distance threshold and fresh is dropped as too-close', () => {
    const decision = shouldStoreLocation(
      {
        latitude: 40,
        longitude: -74,
        accuracy: 20,
        capturedAt: T('2026-05-17T11:59:30Z'),
      },
      {
        // ~10m north
        latitude: 40 + 0.00009,
        longitude: -74,
        accuracy: 20,
        capturedAt: T('2026-05-17T12:00:00Z'),
      },
    );
    expect(decision).toEqual({ store: false, reason: 'too-close' });
  });

  test('respects overridden minDistanceMeters', () => {
    const decision = shouldStoreLocation(
      {
        latitude: 40,
        longitude: -74,
        accuracy: 20,
        capturedAt: T('2026-05-17T11:59:30Z'),
      },
      {
        latitude: 40 + 0.00009,
        longitude: -74,
        accuracy: 20,
        capturedAt: T('2026-05-17T12:00:00Z'),
      },
      { minDistanceMeters: 5 },
    );
    expect(decision.reason).toBe('moved-enough');
  });
});
