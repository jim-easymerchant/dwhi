import React, { useRef, useState } from 'react';
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
  /** Brief hint shown when the mic is tapped (v1 = text fallback). */
  const [micHintVisible, setMicHintVisible] = useState(false);
  /**
   * Tracks which feedback option was tapped for the current answer. Reset
   * every time a new answer arrives. Keeps the flow one-tap: once you've
   * said "we have it", we don't keep asking.
   */
  const [submittedFeedback, setSubmittedFeedback] = useState<AskFeedbackKind | null>(null);

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

  const onMicPress = () => {
    // v1: no live recogniser yet — make the mic a real affordance by
    // focusing the question field and showing a one-line hint about the
    // current speech mode.
    setMicHintVisible(true);
    inputRef.current?.focus();
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
              accessibilityLabel="Voice"
              style={({ pressed }) => [
                styles.micButton,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.micGlyph}>🎙</Text>
            </Pressable>
          </View>

          {micHintVisible ? (
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
  micGlyph: {
    fontSize: 22,
  },
  micHint: {
    ...typography.caption,
    color: colors.textMuted,
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
