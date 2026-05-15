/**
 * Voice command pipeline types. Kept tiny on purpose — the parser is
 * regex-driven, not a chat model, and the UI only ever shows one parsed
 * intent at a time.
 */

export type VoiceIntentType = 'ASK' | 'IN' | 'OUT' | 'UNKNOWN';

export interface ParsedVoiceCommand {
  type: VoiceIntentType;
  /** Best-effort item name extracted from the residual phrase. */
  itemName: string | null;
  /** Always ≥1 for IN/OUT; defaults to 1 when none was spoken. */
  quantity: number;
  /** What the user said (or typed in the fallback). */
  rawTranscript: string;
  /** Normalized form (filler stripped, lowercased). */
  normalizedTranscript: string;
  /**
   * Heuristic 0..1. Strong intent keyword + clean item → ~0.9.
   * No intent match → ≤0.3 (UNKNOWN).
   */
  confidence: number;
  /** Internal trace; useful for the diagnostics panel. */
  matchedPattern?: string;
}

/**
 * Abstract speech-to-text contract. v1 ships a manual-text-entry "stub"
 * implementation; swapping in a real on-device recognizer (e.g. via
 * @jamsch/expo-speech-recognition) is a single import change.
 */
export interface SpeechService {
  /** Whether the platform/runtime can do speech-to-text at all. */
  isAvailable(): boolean;
  /**
   * Human-readable note for the diagnostics panel — what the user should
   * know about how transcripts are produced on this device.
   */
  describeMode(): string;
}
