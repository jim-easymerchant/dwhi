import type {
  SpeechRecognitionCallbacks,
  SpeechRecognitionSession,
  SpeechService,
} from './voiceTypes';

/**
 * Used when no native recognizer is available (Expo Go, simulator without
 * speech, web preview, or Jest). The mic button on the Ask screen falls back
 * to focusing the text input — the user types what they would have said and
 * the rest of the pipeline runs identically.
 *
 * `start()` rejects with `unsupported` so the screen can branch on `kind`
 * vs. attempting a real session.
 */
export const manualFallbackSpeechService: SpeechService = {
  kind: 'manual',
  isAvailable() {
    return true; // text entry always works
  },
  describeMode() {
    return 'Native speech recognition is unavailable in this build — type your command instead.';
  },
  async requestPermission() {
    return true;
  },
  async start(_callbacks: SpeechRecognitionCallbacks): Promise<SpeechRecognitionSession> {
    throw Object.assign(new Error('Manual fallback does not record audio.'), {
      code: 'unsupported' as const,
    });
  },
};
