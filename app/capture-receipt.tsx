import React, { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/ScreenContainer';
import { CapturePicker } from '@/components/CapturePicker';
import { BigButton } from '@/components/BigButton';
import { Card } from '@/components/Card';
import { persistImage } from '@/services/imageStorage';
import { useCaptureStore } from '@/services/captureStore';
import { isOpenAIConfigured } from '@/services/env';
import {
  parseReceiptImage,
  parseReceiptMock,
  emptyReceiptOutcome,
  type ReceiptParseOutcome,
} from '@/services/receiptParser';
import { colors, spacing, typography } from '@/theme/colors';

interface FailureState {
  message: string;
  storedUri: string;
}

export default function CaptureReceiptScreen() {
  const router = useRouter();
  const stageReceiptDraft = useCaptureStore(s => s.stageReceiptDraft);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<FailureState | null>(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const stageAndGo = (storedUri: string, outcome: ReceiptParseOutcome) => {
    if (!aliveRef.current) return;
    stageReceiptDraft({
      imageUri: storedUri,
      parsed: outcome.parsed,
      source: outcome.source,
      rawAiJson: outcome.rawAiJson,
      model: outcome.model,
    });
    router.replace('/confirm-receipt');
  };

  const useSampleData = async (storedUri: string) => {
    try {
      const outcome = await parseReceiptMock(storedUri);
      stageAndGo(storedUri, outcome);
    } catch (e) {
      if (aliveRef.current) {
        Alert.alert('Mock parser failed', e instanceof Error ? e.message : String(e));
      }
    }
  };

  const enterManually = (storedUri: string) => {
    stageAndGo(storedUri, emptyReceiptOutcome());
  };

  const handleCaptured = async (uri: string) => {
    setFailure(null);
    setBusy(true);
    let stored = '';
    try {
      stored = await persistImage(uri, 'receipt');
    } catch (e) {
      if (aliveRef.current) {
        Alert.alert(
          "Couldn't save the photo",
          e instanceof Error ? e.message : String(e),
        );
        setBusy(false);
      }
      return;
    }

    try {
      const outcome = await parseReceiptImage(stored);
      stageAndGo(stored, outcome);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.warn('[dwhi] parseReceiptImage failed:', message);
      if (aliveRef.current) setFailure({ message, storedUri: stored });
    } finally {
      if (aliveRef.current) setBusy(false);
    }
  };

  const aiOn = isOpenAIConfigured();

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ paddingVertical: spacing.lg, gap: spacing.md }}>
        <View style={styles.modeBadge}>
          <View style={[styles.dot, aiOn ? styles.dotAi : styles.dotMock]} />
          <Text style={styles.modeText}>
            {aiOn ? 'AI parsing on' : 'Mock parser (no API key configured)'}
          </Text>
        </View>

        <CapturePicker
          title="Snap the receipt"
          hint="Get the whole thing in frame if you can. Blurry is fine."
          onCaptured={handleCaptured}
          busy={busy}
          busyLabel={aiOn ? 'Asking AI…' : 'Reading receipt…'}
        />

        {failure ? (
          <Card style={styles.failureCard}>
            <Text style={styles.failureTitle}>Couldn't read the receipt</Text>
            <Text style={styles.failureBody}>{failure.message}</Text>
            <Text style={styles.failureHint}>
              No worries — pick what works for you:
            </Text>
            <BigButton
              label="Try another photo"
              variant="primary"
              onPress={() => setFailure(null)}
            />
            <BigButton
              label="Enter manually"
              variant="ghost"
              onPress={() => enterManually(failure.storedUri)}
            />
            <BigButton
              label="Use sample data"
              variant="ghost"
              onPress={() => useSampleData(failure.storedUri)}
            />
          </Card>
        ) : null}

        {!busy && !failure ? (
          <BigButton label="Cancel" variant="ghost" onPress={() => router.replace('/')} />
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  modeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotAi: {
    backgroundColor: colors.accent,
  },
  dotMock: {
    backgroundColor: colors.textMuted,
  },
  modeText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  failureCard: {
    borderColor: colors.warn,
    backgroundColor: '#2A2418',
    gap: spacing.sm,
  },
  failureTitle: {
    ...typography.heading,
    color: colors.warn,
  },
  failureBody: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  failureHint: {
    ...typography.label,
    color: colors.textPrimary,
    paddingTop: spacing.xs,
  },
});
