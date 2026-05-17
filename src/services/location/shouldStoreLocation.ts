/**
 * Pure decision: given the last stored point and a fresh one, should we
 * persist this fresh point? Lives outside the repository + the task so
 * it's trivially testable with no native mocks.
 *
 * Default policy (every value overridable for tests + future tuning):
 *   - First point ever → always store.
 *   - Reject if accuracy is poor (>250m) unless this is the first point.
 *   - Store if the previous point is stale (≥30 min old).
 *   - Store if moved ≥100m since the previous point.
 *   - Otherwise drop the sample.
 */

import { haversineMeters } from './distance';

export interface LocationSample {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  capturedAt: string; // ISO
}

export interface ShouldStoreOptions {
  /** Minimum movement since previous point, metres. */
  minDistanceMeters?: number;
  /** Force-store if previous point is older than this many ms. */
  staleAfterMs?: number;
  /** Reject when accuracy is worse than this (metres). First point ignores. */
  maxAccuracyMeters?: number;
}

const DEFAULTS = {
  minDistanceMeters: 100,
  staleAfterMs: 30 * 60 * 1000,
  maxAccuracyMeters: 250,
};

export interface ShouldStoreDecision {
  store: boolean;
  reason:
    | 'first-point'
    | 'stale-previous'
    | 'moved-enough'
    | 'too-close'
    | 'poor-accuracy'
    | 'malformed';
}

function isValidLatLon(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isValidSample(s: LocationSample | null | undefined): s is LocationSample {
  if (!s) return false;
  if (!isValidLatLon(s.latitude) || !isValidLatLon(s.longitude)) return false;
  if (s.latitude < -90 || s.latitude > 90) return false;
  if (s.longitude < -180 || s.longitude > 180) return false;
  if (!s.capturedAt || Number.isNaN(Date.parse(s.capturedAt))) return false;
  return true;
}

export function shouldStoreLocation(
  previous: LocationSample | null | undefined,
  next: LocationSample,
  options: ShouldStoreOptions = {},
): ShouldStoreDecision {
  const opts = { ...DEFAULTS, ...options };

  if (!isValidSample(next)) {
    return { store: false, reason: 'malformed' };
  }

  if (!isValidSample(previous)) {
    return { store: true, reason: 'first-point' };
  }

  if (
    typeof next.accuracy === 'number' &&
    Number.isFinite(next.accuracy) &&
    next.accuracy > opts.maxAccuracyMeters
  ) {
    return { store: false, reason: 'poor-accuracy' };
  }

  const ageMs = Date.parse(next.capturedAt) - Date.parse(previous.capturedAt);
  if (ageMs >= opts.staleAfterMs) {
    return { store: true, reason: 'stale-previous' };
  }

  const meters = haversineMeters(
    previous.latitude,
    previous.longitude,
    next.latitude,
    next.longitude,
  );
  if (meters >= opts.minDistanceMeters) {
    return { store: true, reason: 'moved-enough' };
  }

  return { store: false, reason: 'too-close' };
}
