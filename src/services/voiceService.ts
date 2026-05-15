/**
 * Compatibility re-export. The real voice surface lives at
 * `@/services/voice/`. This module stays so older imports keep compiling.
 */

export { speechService, manualEntryStub } from './voice/speechService';
export type { SpeechService } from './voice/voiceTypes';
