import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/ScreenContainer';
import { TextField } from '@/components/TextField';
import { BigButton } from '@/components/BigButton';
import { Card } from '@/components/Card';
import { speechService } from '@/services/voice/speechService';
import { parseVoiceCommand } from '@/services/voice/voiceIntentParser';
import type {
  ParsedVoiceCommand,
  VoiceIntentType,
} from '@/services/voice/voiceTypes';
import { useCaptureStore } from '@/services/captureStore';
import { answerQuestion } from '@/services/confidence/confidenceEngine';
import type { ConfidenceResult } from '@/services/confidence/confidenceEngine';
import { colors, spacing, typography } from '@/theme/colors';
import type { Direction } from '@/types/models';

type Phase = 'idle' | 'listening' | 'parsed' | 'edit' | 'answered';

const INTENT_LABEL: Record<VoiceIntentType, string> = {
  ASK: 'ASK',
  IN: 'IN',
  OUT: 'OUT',
  UNKNOWN: '?',
};

const INTENT_TONE: Record<VoiceIntentType, string> = {
  ASK: colors.accent,
  IN: colors.positive,
  OUT: colors.danger,
  UNKNOWN: colors.warn,
};

export default function VoiceScreen() {
  const router = useRouter();
  const stageItemDraft = useCaptureStore(s => s.stageItemDraft);

  const [phase, setPhase] = useState<Phase>('idle');
  const [transcript, setTranscript] = useState('');
  const [parsed, setParsed] = useState<ParsedVoiceCommand | null>(null);
  const [askResult, setAskResult] = useState<ConfidenceResult | null>(null);
  const [busy, setBusy] = useState(false);

  const speechMode = speechService.describeMode();

  const startListening = () => {
    // v1: the "listening" state surfaces a text field so the user can type
    // what they would have said. A real on-device recognizer plugs in here
    // by writing into the same transcript state.
    setPhase('listening');
    setTranscript('');
    setParsed(null);
    setAskResult(null);
  };

  const submitTranscript = () => {
    const result = parseVoiceCommand(transcript);
    setParsed(result);
    if (result.type === 'UNKNOWN') {
      setPhase('edit');
    } else {
      setPhase('parsed');
    }
  };

  const confirmDispatch = async () => {
    if (!parsed) return;
    if (parsed.type === 'ASK') {
      // Run the existing confidence engine, show its answer inline. Avoid
      // navigating away — the user is already in a "quick check" context.
      setBusy(true);
      try {
        const query = parsed.itemName ?? parsed.rawTranscript;
        const result = await answerQuestion(`do we have ${query}?`);
        setAskResult(result);
        setPhase('answered');
      } finally {
        setBusy(false);
      }
      return;
    }

    if (parsed.type === 'IN' || parsed.type === 'OUT') {
      const direction: Direction = parsed.type;
      stageItemDraft({
        imageUri: null,
        direction,
        source: 'manual',
        parsed: {
          manufacturer: null,
          name: parsed.itemName ?? '',
          category: null,
          containerType: null,
          size: null,
        },
        lookupNote: `Heard: "${parsed.rawTranscript}"`,
      });
      router.replace('/confirm-item');
      return;
    }
  };

  const reset = () => {
    setPhase('idle');
    setTranscript('');
    setParsed(null);
    setAskResult(null);
  };

  const editTranscript = () => {
    setPhase('edit');
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
          <View style={styles.header}>
            <Text style={styles.title}>Voice command</Text>
            <Text style={styles.subtitle}>{speechMode}</Text>
          </View>

          {phase === 'idle' ? (
            <>
              <BigButton
                icon="🎙"
                label="Push to speak"
                large
                variant="primary"
                onPress={startListening}
              />
              <Text style={styles.helper}>
                Try: "Do we have eggs?" · "Add milk" · "We're out of ketchup" ·
                "Remove two apples"
              </Text>
            </>
          ) : null}

          {phase === 'listening' || phase === 'edit' ? (
            <>
              <TextField
                label="What did you say?"
                value={transcript}
                onChangeText={setTranscript}
                placeholder='e.g. "Add milk"'
                autoFocus
                onSubmitEditing={submitTranscript}
                returnKeyType="done"
              />
              <BigButton
                label="Hear me out"
                variant="primary"
                onPress={submitTranscript}
                disabled={!transcript.trim()}
              />
            </>
          ) : null}

          {phase === 'parsed' && parsed ? (
            <Card style={styles.parsedCard}>
              <View style={styles.parsedHeaderRow}>
                <View style={[styles.intentChip, { borderColor: INTENT_TONE[parsed.type] }]}>
                  <Text style={[styles.intentChipText, { color: INTENT_TONE[parsed.type] }]}>
                    {INTENT_LABEL[parsed.type]}
                  </Text>
                </View>
                <Text style={styles.parsedItem}>
                  {parsed.itemName ?? '(no item)'}
                  {parsed.type !== 'ASK' && parsed.quantity > 1
                    ? `   ×${parsed.quantity}`
                    : ''}
                </Text>
              </View>
              <Text style={styles.parsedHeard}>
                Heard: "{parsed.rawTranscript}"
              </Text>
              {parsed.confidence < 0.7 ? (
                <Text style={styles.parsedLowConfidence}>
                  Not totally sure I caught that — feel free to edit before
                  confirming.
                </Text>
              ) : null}
              <View style={styles.actionRow}>
                <BigButton
                  label={busy ? '...' : 'Confirm'}
                  variant={parsed.type === 'OUT' ? 'danger' : 'positive'}
                  style={{ flex: 1 }}
                  onPress={confirmDispatch}
                  disabled={busy || !parsed.itemName}
                />
                <BigButton
                  label="Edit"
                  variant="ghost"
                  style={{ flex: 1 }}
                  onPress={editTranscript}
                />
              </View>
            </Card>
          ) : null}

          {phase === 'answered' && askResult ? (
            <Card style={styles.answerCard}>
              <Text style={[styles.answerLevel, { color: INTENT_TONE.ASK }]}>
                {askResult.level}
              </Text>
              <Text style={styles.answerText}>{askResult.answer}</Text>
              <BigButton label="Ask another" variant="ghost" onPress={reset} />
            </Card>
          ) : null}

          {busy ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={colors.accent} />
            </View>
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
  header: {
    gap: spacing.xs,
  },
  title: {
    ...typography.heading,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
  },
  helper: {
    ...typography.caption,
    color: colors.textMuted,
  },
  parsedCard: {
    gap: spacing.sm,
  },
  parsedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  intentChip: {
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
  },
  intentChipText: {
    ...typography.label,
    fontWeight: '700',
  },
  parsedItem: {
    ...typography.heading,
    color: colors.textPrimary,
    flex: 1,
  },
  parsedHeard: {
    ...typography.caption,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  parsedLowConfidence: {
    ...typography.caption,
    color: colors.warn,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  answerCard: {
    gap: spacing.sm,
  },
  answerLevel: {
    ...typography.heading,
  },
  answerText: {
    ...typography.body,
    color: colors.textPrimary,
  },
  loadingWrap: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  close: {
    marginBottom: spacing.md,
  },
});
