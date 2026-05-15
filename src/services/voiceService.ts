/**
 * Compatibility re-export. The real voice surface lives at
 * `@/services/voice/`. This module stays so older imports keep compiling.
 */

export {
  speechService,
  manualFallbackSpeechService,
  nativeSpeechService,
} from './voice/speechService';
export type {
  SpeechService,
  SpeechServiceKind,
  SpeechError,
  SpeechRecognitionSession,
  SpeechRecognitionCallbacks,
} from './voice/voiceTypes';
