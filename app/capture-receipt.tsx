import React, { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/ScreenContainer';
import { CapturePicker } from '@/components/CapturePicker';
import { BigButton } from '@/components/BigButton';
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

export default function CaptureReceiptScreen() {
  const router = useRouter();
  const stageReceiptDraft = useCaptureStore(s => s.stageReceiptDraft);
  const [busy, setBusy] = useState(false);
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

  const handleAiFailure = (storedUri: string, message: string) => {
    if (!aliveRef.current) return;
    // Soft failure: never block the user, always give a manual path forward.
    Alert.alert(
      "Couldn't read the receipt",
      `${message}\n\nWhat would you like to do?`,
      [
        {
          text: 'Enter manually',
          onPress: () => {
            const outcome = emptyReceiptOutcome();
            outcome.parsed.purchasedAt = new Date().toISOString();
            stageAndGo(storedUri, outcome);
          },
        },
        {
          text: 'Use sample data',
          onPress: async () => {
            try {
              const outcome = await parseReceiptMock(storedUri);
              stageAndGo(storedUri, outcome);
            } catch (err) {
              if (aliveRef.current) {
                Alert.alert('Mock parser failed', String(err));
              }
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  const handleCaptured = async (uri: string) => {
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
      handleAiFailure(stored, message);
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
        {!busy ? (
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
});
