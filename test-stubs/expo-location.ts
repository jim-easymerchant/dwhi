// Jest stub for expo-location. Real package needs the native module.
export const Accuracy = { Balanced: 3, High: 4, Highest: 5, Lowest: 1, Low: 2 };

export const PermissionStatus = {
  GRANTED: 'granted',
  DENIED: 'denied',
  UNDETERMINED: 'undetermined',
} as const;

type PermissionResponse = { status: 'granted' | 'denied' | 'undetermined' };

const denied: PermissionResponse = { status: 'denied' };

export async function getForegroundPermissionsAsync(): Promise<PermissionResponse> {
  return denied;
}
export async function getBackgroundPermissionsAsync(): Promise<PermissionResponse> {
  return denied;
}
export async function requestForegroundPermissionsAsync(): Promise<PermissionResponse> {
  return denied;
}
export async function requestBackgroundPermissionsAsync(): Promise<PermissionResponse> {
  return denied;
}
export async function startLocationUpdatesAsync(): Promise<void> {
  return;
}
export async function stopLocationUpdatesAsync(): Promise<void> {
  return;
}
export async function hasStartedLocationUpdatesAsync(): Promise<boolean> {
  return false;
}
