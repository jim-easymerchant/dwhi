import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/ScreenContainer';
import { TextField } from '@/components/TextField';
import { BigButton } from '@/components/BigButton';
import { Card } from '@/components/Card';
import { answerQuestion, type ConfidenceResult, type ConfidenceLevel } from '@/services/confidence/confidenceEngine';
import {
  recordFeedback,
  type AskFeedbackKind,
} from '@/repositories/askFeedbackRepository';
import { parseVoiceCommand } from '@/services/voice/voiceIntentParser';
import { chooseAskDispatch } from '@/services/voice/askDispatch';
import { speechService } from '@/services/voice/speechService';
import type {
  SpeechError,
  SpeechRecognitionSession,
} from '@/services/voice/voiceTypes';
import { useCaptureStore } from '@/services/captureStore';
import { colors, spacing, typography } from '@/theme/colors';

const SUGGESTIONS = [
  'Do we have pickles?',
  'Add milk',
  'We\'re out of ketchup',
  'Remove two yogurts',
];

const CONFIDENCE_COLOR: Record<ConfidenceLevel, string> = {
  Probably: colors.positive,
  Maybe: colors.warn,
  Unlikely: colors.warn,
  No: colors.danger,
  Unknown: colors.textSecondary,
};

interface FeedbackChipProps {
  label: string;
  kind: AskFeedbackKind;
  tone: string;
  onPress: () => void;
}

function FeedbackChip({ label, tone, onPress }: FeedbackChipProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.feedbackChip,
        { borderColor: tone },
        pressed && { opacity: 0.6 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={[styles.feedbackChipText, { color: tone }]}>{label}</Text>
    </Pressable>
  );
}

export default function AskScreen() {
  const router = useRouter();
  const stageItemDraft = useCaptureStore(s => s.stageItemDraft);
  const inputRef = useRef<TextInput>(null);

  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState<ConfidenceResult | null>(null);
  const [showSignals, setShowSignals] = useState(false);
  const [busy, setBusy] = useState(false);
  /** Brief hint shown when the mic is tapped on the manual fallback. */
  const [micHintVisible, setMicHintVisible] = useState(false);
  /** Push-to-talk lifecycle. */
  const [micState, setMicState] = useState<'idle' | 'listening' | 'error'>('idle');
  const [micError, setMicError] = useState<string | null>(null);
  const sessionRef = useRef<SpeechRecognitionSession | null>(null);
  /**
   * Tracks which feedback option was tapped for the current answer. Reset
   * every time a new answer arrives. Keeps the flow one-tap: once you've
   * said "we have it", we don't keep asking.
   */
  const [submittedFeedback, setSubmittedFeedback] = useState<AskFeedbackKind | null>(null);

  // Clean up any in-flight recognition session when the screen unmounts so
  // a native module never holds a stale callback.
  useEffect(() => {
    return () => {
      sessionRef.current?.cancel();
      sessionRef.current = null;
    };
  }, []);

  /**
   * Single entry point for both typed questions and "voice" transcripts.
   * Pipes the input through the voice intent parser first; if it's a
   * recognisable IN/OUT command we stage and bounce to confirm-item.
   * Otherwise — including pure ASK questions and UNKNOWN gibberish — we
   * hand off to the existing confidence engine and render its answer.
   */
  const submit = async (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;

    const parsed = parseVoiceCommand(trimmed);
    const dispatch = chooseAskDispatch(parsed);

    if (dispatch.kind === 'staged') {
      stageItemDraft({
        imageUri: null,
        direction: dispatch.direction,
        source: 'manual',
        parsed: {
          manufacturer: null,
          name: dispatch.itemName,
          category: null,
          containerType: null,
          size: null,
        },
        lookupNote: `Heard: "${dispatch.rawTranscript}" · qty ${dispatch.quantity}`,
      });
      router.replace('/confirm-item');
      return;
    }

    setBusy(true);
    setAnswer(null);
    setShowSignals(false);
    setSubmittedFeedback(null);
    try {
      const result = await answerQuestion(dispatch.query);
      setAnswer(result);
    } finally {
      setBusy(false);
    }
  };

  const errorMessageFor = (error: SpeechError): string => {
    switch (error.code) {
      case 'not-allowed':
      case 'service-not-allowed':
        return 'Microphone permission denied — you can still type your command.';
      case 'no-speech':
        return "Didn't catch anything — try again or type it.";
      case 'audio-capture':
        return "Couldn't access the microphone. Try typing instead.";
      case 'network':
        return 'Speech service network error. Try again or type it.';
      case 'busy':
        return 'Speech recognizer is busy. Try again in a moment.';
      case 'language-not-supported':
        return 'Your device speech service does not support this language.';
      case 'aborted':
        return 'Recording stopped.';
      case 'unsupported':
        return 'Speech recognition is not available on this device.';
      default:
        return error.message || 'Speech recognition failed — type your command instead.';
    }
  };

  const stopSession = () => {
    sessionRef.current?.stop();
  };

  const startListening = async () => {
    if (speechService.kind !== 'native') {
      // Manual fallback: surface a hint + focus the input. No audio path.
      setMicHintVisible(true);
      inputRef.current?.focus();
      return;
    }

    setMicError(null);

    const granted = await speechService.requestPermission();
    if (!granted) {
      setMicState('error');
      setMicError('Microphone permission denied — you can still type your command.');
      return;
    }

    try {
      const session = await speechService.start({
        onPartial: (transcript: string) => {
          // Live-update the visible input but don't submit until final.
          setQuery(transcript);
        },
        onFinal: (transcript: string) => {
          setQuery(transcript);
          // Auto-submit after a final transcript so the user doesn't have to
          // tap Ask separately. The submit flow handles routing to ASK vs
          // IN/OUT identically to the typed path.
          void submit(transcript);
        },
        onError: (error: SpeechError) => {
          setMicState('error');
          setMicError(errorMessageFor(error));
        },
        onEnd: () => {
          sessionRef.current = null;
          setMicState(prev => (prev === 'error' ? prev : 'idle'));
        },
      });
      sessionRef.current = session;
      setMicState('listening');
    } catch (e) {
      setMicState('error');
      setMicError(
        e instanceof Error ? e.message : 'Could not start speech recognition.',
      );
    }
  };

  const onMicPress = () => {
    if (micState === 'listening') {
      stopSession();
      return;
    }
    if (micState === 'error') {
      setMicState('idle');
      setMicError(null);
      return;
    }
    void startListening();
  };

  const submitFeedback = async (kind: AskFeedbackKind) => {
    if (!answer || submittedFeedback) return;
    setSubmittedFeedback(kind);
    try {
      await recordFeedback(answer.normalizedTerm, answer.level, kind);
    } catch (e) {
      console.warn('[ask] recordFeedback failed:', e);
      setSubmittedFeedback(null);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenContainer>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.heading}>Ask</Text>
          <Text style={styles.helper}>
            Ask, add, or remove. Try a question or a quick command.
          </Text>

          <View style={styles.inputRow}>
            <View style={{ flex: 1 }}>
              <TextField
                ref={inputRef}
                placeholder="Do we have pickles? · Add milk"
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={() => submit(query)}
                returnKeyType="search"
                autoFocus
              />
            </View>
            <Pressable
              onPress={onMicPress}
              accessibilityRole="button"
              accessibilityLabel={
                micState === 'listening' ? 'Stop listening' : 'Voice'
              }
              style={({ pressed }) => [
                styles.micButton,
                micState === 'listening' && styles.micButtonListening,
                micState === 'error' && styles.micButtonError,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.micGlyph}>
                {micState === 'listening' ? '⏹' : '🎙'}
              </Text>
            </Pressable>
          </View>

          {micState === 'listening' ? (
            <Text style={styles.micListening}>Listening… tap the square to stop.</Text>
          ) : micState === 'error' && micError ? (
            <Text style={styles.micError}>{micError}</Text>
          ) : micHintVisible ? (
            <Text style={styles.micHint}>{speechService.describeMode()}</Text>
          ) : null}

          <BigButton
            label={busy ? 'Thinking…' : 'Ask'}
            onPress={() => submit(query)}
            disabled={busy || !query.trim()}
          />

          <View style={styles.suggestionsRow}>
            {SUGGESTIONS.map(s => (
              <Pressable
                key={s}
                style={styles.suggestion}
                onPress={() => {
                  setQuery(s);
                  void submit(s);
                }}
              >
                <Text style={styles.suggestionText}>{s}</Text>
              </Pressable>
            ))}
          </View>

          {busy ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : null}

          {answer ? (
            <Card style={styles.answerCard}>
              <Text style={[styles.confidence, { color: CONFIDENCE_COLOR[answer.level] }]}>
                {answer.level}
              </Text>
              <Text style={styles.answerText}>{answer.answer}</Text>

              {answer.level !== 'Unknown' ? (
                submittedFeedback ? (
                  <Text style={styles.feedbackThanks}>
                    Thanks — I'll remember that.
                  </Text>
                ) : (
                  <View style={styles.feedbackWrap}>
                    <Text style={styles.feedbackPrompt}>Was this right?</Text>
                    <View style={styles.feedbackRow}>
                      <FeedbackChip
                        label="We have it"
                        kind="have"
                        tone={colors.positive}
                        onPress={() => void submitFeedback('have')}
                      />
                      <FeedbackChip
                        label="We don't"
                        kind="dont"
                        tone={colors.danger}
                        onPress={() => void submitFeedback('dont')}
                      />
                      <FeedbackChip
                        label="Not sure"
                        kind="unsure"
                        tone={colors.textSecondary}
                        onPress={() => void submitFeedback('unsure')}
                      />
                    </View>
                  </View>
                )
              ) : null}

              {__DEV__ && answer.signals.length > 0 ? (
                <View style={styles.signalsWrap}>
                  <Pressable onPress={() => setShowSignals(v => !v)} style={styles.signalsToggle}>
                    <Text style={styles.signalsToggleText}>
                      {showSignals ? 'Hide' : 'Show'} signals ({answer.signals.length}) · score {answer.score}
                    </Text>
                  </Pressable>
                  {showSignals ? (
                    <View style={styles.signalsList}>
                      {answer.signals.map((s, idx) => (
                        <View key={`${s.type}-${idx}`} style={styles.signalRow}>
                          <Text style={styles.signalWeight}>
                            {s.weight >= 0 ? '+' : ''}
                            {s.weight.toFixed(1)}
                          </Text>
                          <View style={styles.signalText}>
                            <Text style={styles.signalType}>{s.type}</Text>
                            <Text style={styles.signalExplain}>{s.explanation}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              ) : null}
            </Card>
          ) : null}
        </ScrollView>

        <BigButton
          label="Close"
          variant="ghost"
          onPress={() => router.back()}
          style={styles.close}
        />
      </ScreenContainer>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  heading: {
    ...typography.heading,
    color: colors.textPrimary,
  },
  helper: {
    ...typography.caption,
    color: colors.textMuted,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  micButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButtonListening: {
    backgroundColor: '#3A1C1C',
    borderColor: colors.danger,
  },
  micButtonError: {
    borderColor: colors.warn,
  },
  micGlyph: {
    fontSize: 22,
  },
  micHint: {
    ...typography.caption,
    color: colors.textMuted,
    paddingHorizontal: spacing.xs,
  },
  micListening: {
    ...typography.caption,
    color: colors.danger,
    paddingHorizontal: spacing.xs,
  },
  micError: {
    ...typography.caption,
    color: colors.warn,
    paddingHorizontal: spacing.xs,
  },
  suggestionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  suggestion: {
    borderColor: colors.border,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.surface,
  },
  suggestionText: {
    color: colors.textSecondary,
    ...typography.label,
  },
  loadingWrap: {
    paddingVertical: spacing.lg,
  },
  answerCard: {
    gap: spacing.sm,
  },
  confidence: {
    ...typography.heading,
  },
  answerText: {
    ...typography.body,
    color: colors.textPrimary,
  },
  feedbackWrap: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  feedbackPrompt: {
    ...typography.caption,
    color: colors.textMuted,
  },
  feedbackRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  feedbackChip: {
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'transparent',
  },
  feedbackChipText: {
    ...typography.label,
    fontWeight: '600',
  },
  feedbackThanks: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  signalsWrap: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  signalsToggle: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
  },
  signalsToggleText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  signalsList: {
    gap: spacing.xs,
    paddingTop: spacing.xs,
  },
  signalRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  signalWeight: {
    ...typography.caption,
    color: colors.textSecondary,
    fontFamily: 'Courier',
    minWidth: 48,
  },
  signalText: {
    flex: 1,
  },
  signalType: {
    ...typography.caption,
    color: colors.textMuted,
    fontFamily: 'Courier',
  },
  signalExplain: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  close: {
    marginBottom: spacing.md,
  },
});
