/**
 * Voice intent layer. The transcript normalizer + intent parser
 * recognize ASK / IN / OUT phrasings keyed against pantry items, so
 * this lives in the pantry domain. The speech-service abstraction is
 * generic, but the parser keeps it tied to pantry semantics until a
 * second app shows up with its own command set.
 */
export {
  chooseAskDispatch,
  type AskDispatch,
} from '@/services/voice/askDispatch';
export {
  normalizeTranscript,
} from '@/services/voice/transcriptNormalizer';
export { parseVoiceCommand } from '@/services/voice/voiceIntentParser';
export {
  selectSpeechService,
  speechService,
} from '@/services/voice/speechService';
export type {
  ParsedVoiceCommand,
  SpeechError,
  SpeechRecognitionCallbacks,
  SpeechRecognitionSession,
  SpeechService,
  SpeechServiceKind,
  VoiceIntentType,
} from '@/services/voice/voiceTypes';
