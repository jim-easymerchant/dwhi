/**
 * Voice stub. The POC uses typed text input via the Ask modal; this module
 * exists so the home screen and ask flow can already be wired up against a
 * stable interface. Swap in expo-speech-recognition or similar later.
 */

export interface VoiceService {
  isAvailable(): boolean;
  transcribe(): Promise<string>;
}

export const voiceServiceStub: VoiceService = {
  isAvailable() {
    return false;
  },
  async transcribe() {
    throw new Error('Voice transcription is not implemented in the POC.');
  },
};

export const voiceService: VoiceService = voiceServiceStub;
