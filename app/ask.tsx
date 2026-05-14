import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
import { answerQuestion, type ConfidenceResult, type ConfidenceLevel } from '@/services/confidence/confidenceEngine';
import { colors, spacing, typography } from '@/theme/colors';

const SUGGESTIONS = [
  'Do we have pickles?',
  'Do we have milk?',
  'Do we have ketchup?',
  'Do we have yogurt?',
];

const CONFIDENCE_COLOR: Record<ConfidenceLevel, string> = {
  Probably: colors.positive,
  Maybe: colors.warn,
  Unlikely: colors.warn,
  No: colors.danger,
  Unknown: colors.textSecondary,
};

export default function AskScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState<ConfidenceResult | null>(null);
  const [showSignals, setShowSignals] = useState(false);
  const [busy, setBusy] = useState(false);

  const ask = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setBusy(true);
    setAnswer(null);
    setShowSignals(false);
    try {
      const result = await answerQuestion(trimmed);
      setAnswer(result);
    } finally {
      setBusy(false);
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
          <Text style={styles.heading}>Ask about an item</Text>
          <Text style={styles.helper}>
            Type a question. No pressure on getting the wording right.
          </Text>

          <TextField
            placeholder="Do we have pickles?"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => ask(query)}
            returnKeyType="search"
            autoFocus
          />

          <BigButton
            label={busy ? 'Thinking…' : 'Ask'}
            onPress={() => ask(query)}
            disabled={busy || !query.trim()}
          />

          <View style={styles.suggestionsRow}>
            {SUGGESTIONS.map(s => (
              <Pressable
                key={s}
                style={styles.suggestion}
                onPress={() => {
                  setQuery(s);
                  ask(s);
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
