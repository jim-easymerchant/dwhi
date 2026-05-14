import * as FileSystem from 'expo-file-system';

/**
 * Persists a captured image into the app's document directory so the URI
 * stays valid across sessions. expo-camera/expo-image-picker return cache
 * URIs by default which the OS can prune.
 */
export async function persistImage(sourceUri: string, prefix: string): Promise<string> {
  const dir = `${FileSystem.documentDirectory}dwhi-images/`;
  const dirInfo = await FileSystem.getInfoAsync(dir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  const ext = sourceUri.split('.').pop()?.split('?')[0] ?? 'jpg';
  const dest = `${dir}${prefix}-${Date.now()}.${ext}`;
  await FileSystem.copyAsync({ from: sourceUri, to: dest });
  return dest;
}
