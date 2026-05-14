import * as FileSystem from 'expo-file-system';

const KNOWN_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif']);

function extractExtension(uri: string): string {
  // Strip query string, then grab the last path segment, then anything after
  // the final '.' — but only trust short, alphanumeric, known image
  // extensions; otherwise default to 'jpg'.
  const noQuery = uri.split('?')[0];
  const lastSegment = noQuery.split('/').pop() ?? '';
  const dotIdx = lastSegment.lastIndexOf('.');
  if (dotIdx === -1) return 'jpg';
  const candidate = lastSegment.slice(dotIdx + 1).toLowerCase();
  if (!candidate || candidate.length > 5) return 'jpg';
  if (!/^[a-z0-9]+$/.test(candidate)) return 'jpg';
  if (!KNOWN_EXTENSIONS.has(candidate)) return 'jpg';
  return candidate;
}

/**
 * Persists a captured image into the app's document directory so the URI
 * stays valid across sessions. expo-image-picker returns cache URIs by
 * default which the OS can prune.
 */
export async function persistImage(sourceUri: string, prefix: string): Promise<string> {
  const dir = `${FileSystem.documentDirectory}dwhi-images/`;
  const dirInfo = await FileSystem.getInfoAsync(dir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  const ext = extractExtension(sourceUri);
  const dest = `${dir}${prefix}-${Date.now()}.${ext}`;
  await FileSystem.copyAsync({ from: sourceUri, to: dest });
  return dest;
}
