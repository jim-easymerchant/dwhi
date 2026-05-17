/**
 * Background location foundation. Pure decision helpers
 * (shouldStoreLocation, haversineMeters) sit alongside the TaskManager
 * registration + permission/start/stop service. Re-usable as-is by any
 * app that wants opt-in location context — the storage layer accepts
 * any household_id and never references DWHI-specific tables outside
 * its own `location_events` table.
 */
export {
  BACKGROUND_LOCATION_TASK_NAME,
  ensureBackgroundLocationTaskRegistered,
  handleLocationUpdate,
  type NativeLocationPayload,
  type TaskExecutorEvent,
} from '@/services/location/backgroundLocationTask';
export {
  haversineMeters,
} from '@/services/location/distance';
export {
  shouldStoreLocation,
  type LocationSample,
  type ShouldStoreDecision,
  type ShouldStoreOptions,
} from '@/services/location/shouldStoreLocation';
export {
  BACKGROUND_LOCATION_ENABLED_KEY,
  LOCATION_PROMPT_SEEN_KEY,
  acceptLocationPromptAndStart,
  declineLocationPrompt,
  getLocationTrackingStatus,
  hasSeenLocationPrompt,
  isBackgroundLocationTrackingEnabled,
  markLocationPromptSeen,
  requestLocationPermissions,
  resumeBackgroundLocationTrackingIfEnabled,
  startBackgroundLocationTracking,
  stopBackgroundLocationTracking,
  type LocationPermissionStatus,
  type LocationTrackingStatus,
  type MaybePromptResult,
} from '@/services/location/locationService';
export {
  countLocationEvents,
  getLatestLocationEvent,
  insertLocationEvent,
  listRecentLocationEvents,
  type LocationEvent,
  type NewLocationEvent,
} from '@/repositories/locationEventRepository';
