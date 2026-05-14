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
import { answerQuestion } from '@/services/confidenceEngine';
import type { AskAnswer, ConfidenceLevel } from '@/types/models';
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
  const [answer, setAnswer] = useState<AskAnswer | null>(null);
  const [busy, setBusy] = useState(false);

  const ask = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setBusy(true);
    setAnswer(null);
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
              <Text style={[styles.confidence, { color: CONFIDENCE_COLOR[answer.confidence] }]}>
                {answer.confidence}
              </Text>
              <Text style={styles.answerText}>{answer.message}</Text>
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
  close: {
    marginBottom: spacing.md,
  },
});
