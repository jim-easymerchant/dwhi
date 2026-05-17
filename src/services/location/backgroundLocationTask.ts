/**
 * Background location task. The native TaskManager.defineTask call is a
 * top-level side effect — it must run before `Location.startLocationUpdatesAsync`
 * is invoked anywhere. Import this module once from the app entry so the
 * registration happens at app boot.
 *
 * The actual update logic lives in `handleLocationUpdate` and is exported
 * separately so tests can drive it directly without involving the native
 * TaskManager (which doesn't load in Jest).
 */

import * as TaskManager from 'expo-task-manager';
import {
  getLatestLocationEvent,
  insertLocationEvent,
} from '@/repositories/locationEventRepository';
import { shouldStoreLocation } from './shouldStoreLocation';

export const BACKGROUND_LOCATION_TASK_NAME = 'dwhi-background-location';

/** Shape of the events expo-location pushes into TaskManager. */
export interface NativeLocationPayload {
  locations?: Array<{
    coords?: {
      latitude?: number | null;
      longitude?: number | null;
      accuracy?: number | null;
      altitude?: number | null;
      heading?: number | null;
      speed?: number | null;
    };
    timestamp?: number;
  }>;
}

export interface TaskExecutorEvent {
  data?: unknown;
  error?: { message?: string } | null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Pure handler. Never throws — every failure mode is logged at warn
 * level (with no raw coordinates) and the call returns silently so the
 * native task runtime isn't crashed.
 */
export async function handleLocationUpdate(event: TaskExecutorEvent): Promise<void> {
  try {
    if (event.error) {
      console.warn(
        `[dwhi.location.task] platform error: ${asString(event.error.message) ?? 'unknown'}`,
      );
      return;
    }
    const data = event.data as NativeLocationPayload | null | undefined;
    if (!data || !Array.isArray(data.locations) || data.locations.length === 0) {
      return;
    }

    for (const rawLoc of data.locations) {
      const coords = rawLoc?.coords;
      const lat = coords?.latitude;
      const lon = coords?.longitude;
      if (!coords || typeof lat !== 'number' || typeof lon !== 'number') {
        console.warn('[dwhi.location.task] dropping sample: missing coords');
        continue;
      }
      const capturedAt =
        typeof rawLoc.timestamp === 'number' && Number.isFinite(rawLoc.timestamp)
          ? new Date(rawLoc.timestamp).toISOString()
          : new Date().toISOString();

      const sample = {
        latitude: lat,
        longitude: lon,
        accuracy: typeof coords.accuracy === 'number' ? coords.accuracy : null,
        capturedAt,
      };

      let previous = null;
      try {
        previous = await getLatestLocationEvent();
      } catch (e) {
        // Repository read failed; treat as "no previous" so first-point
        // logic stores something rather than silently dropping forever.
        console.warn('[dwhi.location.task] could not read latest event:', e);
      }

      const decision = shouldStoreLocation(previous, sample);
      console.log(
        `[dwhi.location.task] decision=${decision.reason} (store=${decision.store})`,
      );
      if (!decision.store) continue;

      try {
        await insertLocationEvent({
          latitude: lat,
          longitude: lon,
          accuracy: typeof coords.accuracy === 'number' ? coords.accuracy : null,
          altitude: typeof coords.altitude === 'number' ? coords.altitude : null,
          heading: typeof coords.heading === 'number' ? coords.heading : null,
          speed: typeof coords.speed === 'number' ? coords.speed : null,
          provider: null,
          source: 'background',
          capturedAt,
        });
      } catch (e) {
        console.warn('[dwhi.location.task] insert failed:', e);
      }
    }
  } catch (outer) {
    // Defence in depth — the task runtime is unforgiving; never let an
    // exception escape this function.
    console.warn('[dwhi.location.task] handler crashed:', outer);
  }
}

let registered = false;
/**
 * Ensures TaskManager has the task registered. Safe to call multiple
 * times; the second+ call is a no-op.
 */
export function ensureBackgroundLocationTaskRegistered(): void {
  if (registered) return;
  try {
    TaskManager.defineTask(BACKGROUND_LOCATION_TASK_NAME, handleLocationUpdate);
    registered = true;
  } catch (e) {
    // Likely already defined in a hot-reload scenario — that's fine.
    console.warn('[dwhi.location.task] defineTask failed:', e);
  }
}

// Side-effect: register at module load. The app entry imports this file
// from `app/_layout.tsx` so registration happens before any
// `startLocationUpdatesAsync` call.
ensureBackgroundLocationTaskRegistered();
