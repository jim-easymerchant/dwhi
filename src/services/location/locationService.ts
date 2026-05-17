/**
 * Public service surface for background location tracking.
 *
 * Wraps `expo-location` so the rest of the app never imports the native
 * module directly. Side-effects live here; pure logic lives in
 * `shouldStoreLocation`, `distance`, and the handler exported from
 * `backgroundLocationTask`.
 *
 * Auto-start policy: as soon as the user grants both foreground and
 * background permissions we start the native task and persist
 * `background_location_enabled = '1'`. We never re-prompt automatically
 * after a denial — the user has to flip it on from Settings.
 *
 * Storage policy for this branch: local-only. No network IO. Logs never
 * include raw coordinates.
 */

import { getPref, setPref } from '@/repositories/appPrefsRepository';
import {
  BACKGROUND_LOCATION_TASK_NAME,
  ensureBackgroundLocationTaskRegistered,
} from './backgroundLocationTask';

// expo-location pulls in a native module that Jest can't load. Wrap the
// require so unit tests can mock the module without the bare import
// crashing at module-evaluation time.
function loadExpoLocation(): typeof import('expo-location') | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-location');
  } catch (e) {
    console.warn('[dwhi.location.service] expo-location unavailable:', e);
    return null;
  }
}

export const LOCATION_PROMPT_SEEN_KEY = 'location_prompt_seen';
export const BACKGROUND_LOCATION_ENABLED_KEY = 'background_location_enabled';

export type LocationPermissionStatus =
  | 'granted-background'
  | 'granted-foreground-only'
  | 'denied'
  | 'unavailable';

export interface LocationTrackingStatus {
  enabled: boolean;
  permission: LocationPermissionStatus;
  taskRunning: boolean;
}

const FOREGROUND_NOTIFICATION = {
  notificationTitle: 'Do We Have It? location is active',
  notificationBody:
    'Location context is enabled for household intelligence features.',
};

/**
 * Asks for foreground location first, then background. Returns the most
 * useful status we managed to obtain. Never throws.
 */
export async function requestLocationPermissions(): Promise<LocationPermissionStatus> {
  const Location = loadExpoLocation();
  if (!Location) return 'unavailable';
  try {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== 'granted') {
      return 'denied';
    }
    try {
      const bg = await Location.requestBackgroundPermissionsAsync();
      if (bg.status === 'granted') return 'granted-background';
      return 'granted-foreground-only';
    } catch (e) {
      // Some Android variants refuse the background prompt without the
      // user having opened settings. Treat as fg-only — the user can flip
      // the toggle from settings later.
      console.warn(
        '[dwhi.location.service] background permission request failed:',
        e,
      );
      return 'granted-foreground-only';
    }
  } catch (e) {
    console.warn('[dwhi.location.service] permission request failed:', e);
    return 'denied';
  }
}

async function getCurrentPermissionStatus(
  Location: NonNullable<ReturnType<typeof loadExpoLocation>>,
): Promise<LocationPermissionStatus> {
  try {
    const fg = await Location.getForegroundPermissionsAsync();
    if (fg.status !== 'granted') return 'denied';
    try {
      const bg = await Location.getBackgroundPermissionsAsync();
      return bg.status === 'granted'
        ? 'granted-background'
        : 'granted-foreground-only';
    } catch {
      return 'granted-foreground-only';
    }
  } catch {
    return 'denied';
  }
}

/**
 * Boots the native location task if it isn't already running. Persists
 * the enabled flag so `resumeBackgroundLocationTrackingIfEnabled` knows
 * to restart it after a cold launch.
 */
export async function startBackgroundLocationTracking(): Promise<boolean> {
  const Location = loadExpoLocation();
  if (!Location) return false;
  ensureBackgroundLocationTaskRegistered();
  try {
    const already = await Location.hasStartedLocationUpdatesAsync(
      BACKGROUND_LOCATION_TASK_NAME,
    );
    if (already) {
      await setPref(BACKGROUND_LOCATION_ENABLED_KEY, '1');
      return true;
    }
    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: 100,
      deferredUpdatesInterval: 60_000,
      deferredUpdatesDistance: 100,
      pausesUpdatesAutomatically: true,
      showsBackgroundLocationIndicator: false,
      foregroundService: FOREGROUND_NOTIFICATION,
    });
    await setPref(BACKGROUND_LOCATION_ENABLED_KEY, '1');
    console.log('[dwhi.location.service] tracking started');
    return true;
  } catch (e) {
    console.warn('[dwhi.location.service] start failed:', e);
    return false;
  }
}

export async function stopBackgroundLocationTracking(): Promise<void> {
  const Location = loadExpoLocation();
  await setPref(BACKGROUND_LOCATION_ENABLED_KEY, null);
  if (!Location) return;
  try {
    const running = await Location.hasStartedLocationUpdatesAsync(
      BACKGROUND_LOCATION_TASK_NAME,
    );
    if (running) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK_NAME);
      console.log('[dwhi.location.service] tracking stopped');
    }
  } catch (e) {
    console.warn('[dwhi.location.service] stop failed:', e);
  }
}

export async function getLocationTrackingStatus(): Promise<LocationTrackingStatus> {
  const Location = loadExpoLocation();
  if (!Location) {
    return { enabled: false, permission: 'unavailable', taskRunning: false };
  }
  const permission = await getCurrentPermissionStatus(Location);
  let taskRunning = false;
  try {
    taskRunning = await Location.hasStartedLocationUpdatesAsync(
      BACKGROUND_LOCATION_TASK_NAME,
    );
  } catch {
    taskRunning = false;
  }
  const enabled = (await getPref(BACKGROUND_LOCATION_ENABLED_KEY)) === '1';
  return { enabled, permission, taskRunning };
}

export async function isBackgroundLocationTrackingEnabled(): Promise<boolean> {
  return (await getPref(BACKGROUND_LOCATION_ENABLED_KEY)) === '1';
}

/**
 * Called from the bootstrap. If the user previously enabled tracking,
 * silently re-arm the task on this launch. Never prompts.
 */
export async function resumeBackgroundLocationTrackingIfEnabled(): Promise<void> {
  const enabled = await isBackgroundLocationTrackingEnabled();
  if (!enabled) return;
  const Location = loadExpoLocation();
  if (!Location) return;
  const permission = await getCurrentPermissionStatus(Location);
  if (permission === 'denied' || permission === 'unavailable') {
    // The user revoked permission since last launch; drop the enabled
    // flag so we don't fight the OS on every cold start.
    await setPref(BACKGROUND_LOCATION_ENABLED_KEY, null);
    console.warn(
      '[dwhi.location.service] tracking was enabled but permission revoked',
    );
    return;
  }
  await startBackgroundLocationTracking();
}

export interface MaybePromptResult {
  promptShown: boolean;
  permission: LocationPermissionStatus | null;
  tracking: boolean;
}

/**
 * One-shot opt-in flow. Returns shouldShow=false if the user has already
 * answered the prompt — even if the answer was "no". Caller renders the
 * UI; this helper only encapsulates the "did we ask yet?" bookkeeping.
 */
export async function hasSeenLocationPrompt(): Promise<boolean> {
  return (await getPref(LOCATION_PROMPT_SEEN_KEY)) === '1';
}

export async function markLocationPromptSeen(): Promise<void> {
  await setPref(LOCATION_PROMPT_SEEN_KEY, '1');
}

/**
 * Convenience for the modal "Continue" button: marks the prompt seen,
 * requests permissions, and starts tracking if granted. Returns a
 * summary the UI can use to display success/failure.
 */
export async function acceptLocationPromptAndStart(): Promise<MaybePromptResult> {
  await markLocationPromptSeen();
  const permission = await requestLocationPermissions();
  if (permission === 'granted-background' || permission === 'granted-foreground-only') {
    const started = await startBackgroundLocationTracking();
    return { promptShown: true, permission, tracking: started };
  }
  return { promptShown: true, permission, tracking: false };
}

/**
 * Convenience for the modal "Not now" button: records that we asked so
 * we don't re-prompt automatically. The user can still flip the toggle
 * from Settings.
 */
export async function declineLocationPrompt(): Promise<void> {
  await markLocationPromptSeen();
}
