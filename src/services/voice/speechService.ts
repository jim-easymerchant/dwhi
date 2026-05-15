/**
 * Picks the live SpeechService at app start: native recognizer when the
 * `expo-speech-recognition` module loads and reports availability, manual
 * text fallback otherwise. The Ask screen and the Settings diagnostics
 * card both read from the same `speechService` export — there's no
 * branching elsewhere.
 */

import { manualFallbackSpeechService } from './manualFallbackSpeechService';
import { nativeSpeechService } from './nativeSpeechService';
import type { SpeechService } from './voiceTypes';

export function selectSpeechService(): SpeechService {
  return nativeSpeechService.isAvailable()
    ? nativeSpeechService
    : manualFallbackSpeechService;
}

// Evaluated once at module load. Re-importing in different surfaces yields
// the same instance, so subscription state stays sane.
export const speechService: SpeechService = selectSpeechService();

// Re-export the two implementations for tests and Settings diagnostics that
// want to inspect both, not just the active one.
export { manualFallbackSpeechService, nativeSpeechService };
