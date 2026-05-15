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

// ---------------------------------------------------------------------------
// Speech-to-text contract
// ---------------------------------------------------------------------------

export type SpeechServiceKind = 'native' | 'manual';

export interface SpeechRecognitionCallbacks {
  /** Interim transcript hint while the user is still speaking. */
  onPartial?(transcript: string): void;
  /**
   * Final recognized transcript. The service will also call `onEnd` after
   * this; callers shouldn't issue another `start` until they get that.
   */
  onFinal(transcript: string): void;
  /** Recognition failed for one of the reasons in SpeechError.code. */
  onError(error: SpeechError): void;
  /** Session terminated (cleanly or otherwise). Last callback to fire. */
  onEnd?(): void;
}

export interface SpeechError {
  /** Free-form short code so the UI can branch on common cases. */
  code:
    | 'not-allowed'
    | 'no-speech'
    | 'audio-capture'
    | 'network'
    | 'busy'
    | 'service-not-allowed'
    | 'language-not-supported'
    | 'aborted'
    | 'unsupported'
    | 'unknown';
  message: string;
}

export interface SpeechRecognitionSession {
  /** Ask the recognizer to wrap up — final transcript fires via onFinal. */
  stop(): void;
  /** Bail out immediately; no further callbacks should arrive. */
  cancel(): void;
}

/**
 * Push-to-talk speech contract. Implementations are picked at app start:
 * NativeSpeechRecognitionService when the native module is loadable,
 * ManualFallbackSpeechService otherwise.
 */
export interface SpeechService {
  kind: SpeechServiceKind;
  /** True when this implementation can actually transcribe audio. */
  isAvailable(): boolean;
  /** Human-readable label for the Settings → Voice card. */
  describeMode(): string;
  /** Triggers the OS permission prompt (no-op for manual). */
  requestPermission(): Promise<boolean>;
  /**
   * Begin a recognition session. Manual returns a rejected promise so the
   * caller knows to fall back to a typed input.
   */
  start(callbacks: SpeechRecognitionCallbacks): Promise<SpeechRecognitionSession>;
}
