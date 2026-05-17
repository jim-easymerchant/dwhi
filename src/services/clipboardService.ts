/**
 * Thin wrapper around `expo-clipboard`. The wrapper exists so:
 *
 *   1. UI code never imports the native module directly — clearer test
 *      seams + future-proof if we swap the underlying clipboard impl.
 *   2. We never log the value being copied. Logs include the byte
 *      length and a tag (e.g. 'invite-code'), nothing more.
 *   3. The function never throws — every failure mode is a returned
 *      `{ ok: false, message }` result so the UI can show an inline
 *      error instead of crashing.
 */

/**
 * Lazy require so Jest can run this module without dragging in the
 * native bridge. Tests can override with `jest.mock('expo-clipboard')`
 * to inject behaviour.
 */
function loadClipboard(): typeof import('expo-clipboard') | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-clipboard');
  } catch (e) {
    console.warn('[dwhi.clipboard] expo-clipboard unavailable:', e);
    return null;
  }
}

export interface CopyResult {
  ok: boolean;
  message: string;
}

/**
 * Copies the given string to the OS clipboard.
 *
 * @param value The string to copy. Never logged — only its length.
 * @param tag   A short identifier for the log line (e.g. 'invite-code').
 */
export async function copyToClipboard(
  value: string,
  tag: string,
): Promise<CopyResult> {
  if (typeof value !== 'string' || value.length === 0) {
    return { ok: false, message: 'Nothing to copy.' };
  }
  const clipboard = loadClipboard();
  if (!clipboard) {
    return {
      ok: false,
      message: 'Clipboard is not available on this build.',
    };
  }
  try {
    await clipboard.setStringAsync(value);
    console.log(
      `[dwhi.clipboard] copied ${tag} (length=${value.length})`,
    );
    return { ok: true, message: 'Copied.' };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Clipboard write failed.';
    console.warn(`[dwhi.clipboard] copy failed for ${tag}: ${message}`);
    return { ok: false, message };
  }
}
