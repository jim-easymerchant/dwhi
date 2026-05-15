/**
 * Speech-to-text service.
 *
 * v1 ships a "manual text entry" stub: the mic button opens a small modal
 * with a text input. This is the most honest path until a native on-device
 * recognizer (e.g. @jamsch/expo-speech-recognition) is wired in and verified
 * on a real device build — the same `SpeechService` contract slots straight
 * in when that happens.
 *
 * The rest of the voice pipeline (normalizer, parser, confirm UI) runs
 * unchanged for either implementation.
 */

import type { SpeechService } from './voiceTypes';

export const manualEntryStub: SpeechService = {
  isAvailable() {
    return true; // text-entry fallback is always available
  },
  describeMode() {
    return 'Type what you would say (push-to-talk speech is wired up but using a manual-text fallback in this build).';
  },
};

/**
 * The runtime-selected service. To swap in a real recognizer, change this
 * binding and add a small startListening/stopListening surface — every UI
 * caller already routes through this single export.
 */
export const speechService: SpeechService = manualEntryStub;
