/**
 * Locationservice integration. We mock `expo-location` and the
 * `appPrefsRepository` to avoid touching native modules or SQLite.
 */

const requestForegroundPermissionsAsync = jest.fn();
const requestBackgroundPermissionsAsync = jest.fn();
const getForegroundPermissionsAsync = jest.fn();
const getBackgroundPermissionsAsync = jest.fn();
const startLocationUpdatesAsync = jest.fn();
const stopLocationUpdatesAsync = jest.fn();
const hasStartedLocationUpdatesAsync = jest.fn();

jest.mock('expo-location', () => ({
  __esModule: true,
  requestForegroundPermissionsAsync,
  requestBackgroundPermissionsAsync,
  getForegroundPermissionsAsync,
  getBackgroundPermissionsAsync,
  startLocationUpdatesAsync,
  stopLocationUpdatesAsync,
  hasStartedLocationUpdatesAsync,
  Accuracy: { Balanced: 3 },
}));

jest.mock('expo-task-manager', () => ({
  defineTask: jest.fn(),
}));

// Mock the task module so we don't transitively pull in expo-sqlite via
// the repository import chain. The service only cares about the
// task-name constant and the registration call.
jest.mock('../backgroundLocationTask', () => ({
  BACKGROUND_LOCATION_TASK_NAME: 'dwhi-background-location',
  ensureBackgroundLocationTaskRegistered: jest.fn(),
  handleLocationUpdate: jest.fn(),
}));

const prefs: Record<string, string | null> = {};
jest.mock('@/repositories/appPrefsRepository', () => ({
  getPref: jest.fn(async (key: string) => prefs[key] ?? null),
  setPref: jest.fn(async (key: string, value: string | null) => {
    if (value === null) delete prefs[key];
    else prefs[key] = value;
  }),
}));

import {
  acceptLocationPromptAndStart,
  declineLocationPrompt,
  getLocationTrackingStatus,
  hasSeenLocationPrompt,
  isBackgroundLocationTrackingEnabled,
  requestLocationPermissions,
  resumeBackgroundLocationTrackingIfEnabled,
  startBackgroundLocationTracking,
  stopBackgroundLocationTracking,
  BACKGROUND_LOCATION_ENABLED_KEY,
  LOCATION_PROMPT_SEEN_KEY,
} from '../locationService';

beforeEach(() => {
  jest.clearAllMocks();
  for (const k of Object.keys(prefs)) delete prefs[k];
  hasStartedLocationUpdatesAsync.mockResolvedValue(false);
});

describe('requestLocationPermissions', () => {
  test('returns granted-background when both prompts succeed', async () => {
    requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
    requestBackgroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
    expect(await requestLocationPermissions()).toBe('granted-background');
  });

  test('returns granted-foreground-only when background is denied', async () => {
    requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
    requestBackgroundPermissionsAsync.mockResolvedValue({ status: 'denied' });
    expect(await requestLocationPermissions()).toBe('granted-foreground-only');
  });

  test('returns granted-foreground-only when background prompt throws', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
    requestBackgroundPermissionsAsync.mockRejectedValue(new Error('not allowed'));
    expect(await requestLocationPermissions()).toBe('granted-foreground-only');
    warn.mockRestore();
  });

  test('returns denied when foreground is denied', async () => {
    requestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });
    expect(await requestLocationPermissions()).toBe('denied');
    expect(requestBackgroundPermissionsAsync).not.toHaveBeenCalled();
  });

  test('returns denied when foreground throws', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    requestForegroundPermissionsAsync.mockRejectedValue(new Error('boom'));
    expect(await requestLocationPermissions()).toBe('denied');
    warn.mockRestore();
  });
});

describe('startBackgroundLocationTracking', () => {
  test('starts the native task and persists enabled flag', async () => {
    hasStartedLocationUpdatesAsync.mockResolvedValue(false);
    startLocationUpdatesAsync.mockResolvedValue(undefined);
    const ok = await startBackgroundLocationTracking();
    expect(ok).toBe(true);
    expect(startLocationUpdatesAsync).toHaveBeenCalledTimes(1);
    const [, options] = startLocationUpdatesAsync.mock.calls[0];
    expect(options).toMatchObject({
      distanceInterval: 100,
      foregroundService: {
        notificationTitle: 'Do We Have It? location is active',
      },
    });
    expect(prefs[BACKGROUND_LOCATION_ENABLED_KEY]).toBe('1');
  });

  test('does not re-start when already running but still flips the flag', async () => {
    hasStartedLocationUpdatesAsync.mockResolvedValue(true);
    const ok = await startBackgroundLocationTracking();
    expect(ok).toBe(true);
    expect(startLocationUpdatesAsync).not.toHaveBeenCalled();
    expect(prefs[BACKGROUND_LOCATION_ENABLED_KEY]).toBe('1');
  });

  test('returns false and never throws when the native call rejects', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    hasStartedLocationUpdatesAsync.mockResolvedValue(false);
    startLocationUpdatesAsync.mockRejectedValue(new Error('no perms'));
    expect(await startBackgroundLocationTracking()).toBe(false);
    expect(prefs[BACKGROUND_LOCATION_ENABLED_KEY]).toBeUndefined();
    warn.mockRestore();
  });
});

describe('stopBackgroundLocationTracking', () => {
  test('stops the running task and clears the flag', async () => {
    prefs[BACKGROUND_LOCATION_ENABLED_KEY] = '1';
    hasStartedLocationUpdatesAsync.mockResolvedValue(true);
    stopLocationUpdatesAsync.mockResolvedValue(undefined);
    await stopBackgroundLocationTracking();
    expect(stopLocationUpdatesAsync).toHaveBeenCalledTimes(1);
    expect(prefs[BACKGROUND_LOCATION_ENABLED_KEY]).toBeUndefined();
  });

  test('clears the flag even when the task was not running', async () => {
    prefs[BACKGROUND_LOCATION_ENABLED_KEY] = '1';
    hasStartedLocationUpdatesAsync.mockResolvedValue(false);
    await stopBackgroundLocationTracking();
    expect(stopLocationUpdatesAsync).not.toHaveBeenCalled();
    expect(prefs[BACKGROUND_LOCATION_ENABLED_KEY]).toBeUndefined();
  });
});

describe('getLocationTrackingStatus', () => {
  test('reports unavailable when both permission probes throw', async () => {
    getForegroundPermissionsAsync.mockRejectedValue(new Error('x'));
    hasStartedLocationUpdatesAsync.mockResolvedValue(false);
    const status = await getLocationTrackingStatus();
    expect(status.permission).toBe('denied');
    expect(status.enabled).toBe(false);
    expect(status.taskRunning).toBe(false);
  });

  test('reflects granted-background, enabled, running', async () => {
    prefs[BACKGROUND_LOCATION_ENABLED_KEY] = '1';
    getForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
    getBackgroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
    hasStartedLocationUpdatesAsync.mockResolvedValue(true);
    const status = await getLocationTrackingStatus();
    expect(status).toEqual({
      enabled: true,
      permission: 'granted-background',
      taskRunning: true,
    });
  });
});

describe('isBackgroundLocationTrackingEnabled', () => {
  test('mirrors the pref', async () => {
    expect(await isBackgroundLocationTrackingEnabled()).toBe(false);
    prefs[BACKGROUND_LOCATION_ENABLED_KEY] = '1';
    expect(await isBackgroundLocationTrackingEnabled()).toBe(true);
  });
});

describe('resumeBackgroundLocationTrackingIfEnabled', () => {
  test('no-op when the flag is not set', async () => {
    await resumeBackgroundLocationTrackingIfEnabled();
    expect(startLocationUpdatesAsync).not.toHaveBeenCalled();
  });

  test('drops the flag when permission was revoked between launches', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    prefs[BACKGROUND_LOCATION_ENABLED_KEY] = '1';
    getForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });
    await resumeBackgroundLocationTrackingIfEnabled();
    expect(startLocationUpdatesAsync).not.toHaveBeenCalled();
    expect(prefs[BACKGROUND_LOCATION_ENABLED_KEY]).toBeUndefined();
    warn.mockRestore();
  });

  test('starts tracking when flag is set and permission is still granted', async () => {
    prefs[BACKGROUND_LOCATION_ENABLED_KEY] = '1';
    getForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
    getBackgroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
    hasStartedLocationUpdatesAsync.mockResolvedValue(false);
    startLocationUpdatesAsync.mockResolvedValue(undefined);
    await resumeBackgroundLocationTrackingIfEnabled();
    expect(startLocationUpdatesAsync).toHaveBeenCalledTimes(1);
  });
});

describe('opt-in prompt helpers', () => {
  test('hasSeenLocationPrompt + markLocationPromptSeen via decline', async () => {
    expect(await hasSeenLocationPrompt()).toBe(false);
    await declineLocationPrompt();
    expect(await hasSeenLocationPrompt()).toBe(true);
    expect(prefs[LOCATION_PROMPT_SEEN_KEY]).toBe('1');
  });

  test('acceptLocationPromptAndStart starts tracking when granted', async () => {
    requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
    requestBackgroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
    hasStartedLocationUpdatesAsync.mockResolvedValue(false);
    startLocationUpdatesAsync.mockResolvedValue(undefined);
    const result = await acceptLocationPromptAndStart();
    expect(result.permission).toBe('granted-background');
    expect(result.tracking).toBe(true);
    expect(prefs[LOCATION_PROMPT_SEEN_KEY]).toBe('1');
    expect(prefs[BACKGROUND_LOCATION_ENABLED_KEY]).toBe('1');
  });

  test('acceptLocationPromptAndStart reports failure when denied, still marks seen', async () => {
    requestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });
    const result = await acceptLocationPromptAndStart();
    expect(result.permission).toBe('denied');
    expect(result.tracking).toBe(false);
    expect(prefs[LOCATION_PROMPT_SEEN_KEY]).toBe('1');
    expect(prefs[BACKGROUND_LOCATION_ENABLED_KEY]).toBeUndefined();
  });
});
