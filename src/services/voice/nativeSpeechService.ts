/**
 * Native speech-to-text via `expo-speech-recognition`. Loaded lazily so:
 *
 *   1. The Jest test runner doesn't try to bind a native module that doesn't
 *      exist outside an Android/iOS build.
 *   2. Expo Go silently falls through to the manual-text fallback instead of
 *      crashing on startup with "ExpoSpeechRecognition module not found".
 *
 * All native interactions are wrapped in try/catch and mapped onto the
 * SpeechService surface so the UI never has to special-case the platform.
 */

import type {
  SpeechError,
  SpeechRecognitionCallbacks,
  SpeechRecognitionSession,
  SpeechService,
} from './voiceTypes';

// ---------------------------------------------------------------------------
// Lazy loader
// ---------------------------------------------------------------------------

type EventSubscription = { remove(): void };

interface ExpoSRModule {
  start(options: Record<string, unknown>): void;
  stop(): void;
  abort(): void;
  requestPermissionsAsync(): Promise<{ granted: boolean }>;
  getPermissionsAsync(): Promise<{ granted: boolean }>;
  addListener(event: string, handler: (e: unknown) => void): EventSubscription;
}

interface NativeApi {
  ExpoSpeechRecognitionModule: ExpoSRModule;
  isRecognitionAvailable: () => boolean;
}

// `undefined` = not tried yet. `null` = tried and the require/binding failed,
// so the platform doesn't have native speech available (or we're in Jest).
let cachedNative: NativeApi | null | undefined;

function loadNative(): NativeApi | null {
  if (cachedNative !== undefined) return cachedNative;
  try {
    // Dynamic require so the import never resolves at module-load time. If the
    // native binary isn't present this throws and we permanently note null.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-speech-recognition');
    if (!mod?.ExpoSpeechRecognitionModule) {
      cachedNative = null;
      return null;
    }
    cachedNative = mod as NativeApi;
    return cachedNative;
  } catch {
    cachedNative = null;
    return null;
  }
}

// ---------------------------------------------------------------------------
// Error mapping
// ---------------------------------------------------------------------------

const ERROR_CODE_MAP: Record<string, SpeechError['code']> = {
  'not-allowed': 'not-allowed',
  'no-speech': 'no-speech',
  'audio-capture': 'audio-capture',
  'speech-timeout': 'no-speech',
  network: 'network',
  busy: 'busy',
  aborted: 'aborted',
  'language-not-supported': 'language-not-supported',
  'service-not-allowed': 'service-not-allowed',
};

function mapError(raw: unknown): SpeechError {
  const event = (raw ?? {}) as { error?: string; message?: string };
  const code = ERROR_CODE_MAP[event.error ?? ''] ?? 'unknown';
  return {
    code,
    message: event.message?.trim() || `Speech recognition failed (${event.error ?? 'unknown'}).`,
  };
}

// ---------------------------------------------------------------------------
// SpeechService implementation
// ---------------------------------------------------------------------------

export const nativeSpeechService: SpeechService = {
  kind: 'native',

  isAvailable() {
    const native = loadNative();
    if (!native) return false;
    try {
      return native.isRecognitionAvailable() === true;
    } catch {
      return false;
    }
  },

  describeMode() {
    const native = loadNative();
    if (!native) {
      return 'Native speech recognition module is installed but not available on this device.';
    }
    return "Tap and speak. Recognition runs through your device's built-in speech service.";
  },

  async requestPermission() {
    const native = loadNative();
    if (!native) return false;
    try {
      const result = await native.ExpoSpeechRecognitionModule.requestPermissionsAsync();
      return !!result?.granted;
    } catch {
      return false;
    }
  },

  async start(callbacks: SpeechRecognitionCallbacks): Promise<SpeechRecognitionSession> {
    const native = loadNative();
    if (!native) {
      throw Object.assign(new Error('Native speech recognition is not loaded.'), {
        code: 'unsupported' as const,
      });
    }

    const module = native.ExpoSpeechRecognitionModule;
    const subs: EventSubscription[] = [];
    let settled = false;

    const safeRemove = () => {
      for (const sub of subs) {
        try {
          sub.remove();
        } catch {
          // best-effort cleanup
        }
      }
      subs.length = 0;
    };

    subs.push(
      module.addListener('result', (e: unknown) => {
        const event = e as {
          isFinal?: boolean;
          results?: Array<{ transcript?: string }>;
        };
        const transcript = event?.results?.[0]?.transcript?.trim() ?? '';
        if (event?.isFinal) {
          if (settled) return;
          settled = true;
          callbacks.onFinal(transcript);
        } else if (transcript && callbacks.onPartial) {
          callbacks.onPartial(transcript);
        }
      }),
    );

    subs.push(
      module.addListener('error', (e: unknown) => {
        if (settled) return;
        settled = true;
        callbacks.onError(mapError(e));
      }),
    );

    subs.push(
      module.addListener('end', () => {
        // `end` always arrives last, even after `result` with isFinal. Tear
        // down listeners here so re-starting cleanly subscribes fresh.
        safeRemove();
        callbacks.onEnd?.();
      }),
    );

    try {
      module.start({
        lang: 'en-US',
        interimResults: true,
        continuous: false,
        addsPunctuation: false,
        requiresOnDeviceRecognition: false,
      });
    } catch (err) {
      safeRemove();
      throw err;
    }

    return {
      stop() {
        try {
          module.stop();
        } catch {
          // module may already have ended
        }
      },
      cancel() {
        settled = true;
        try {
          module.abort();
        } catch {
          // best-effort
        }
        safeRemove();
      },
    };
  },
};

// Exported for tests so we can reset cached probe state.
export function __resetNativeCacheForTests(): void {
  cachedNative = undefined;
}
