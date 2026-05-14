import React, { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/ScreenContainer';
import { CapturePicker } from '@/components/CapturePicker';
import { BigButton } from '@/components/BigButton';
import { aiService } from '@/services/aiService';
import { persistImage } from '@/services/imageStorage';
import { useCaptureStore } from '@/services/captureStore';
import { spacing } from '@/theme/colors';

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

  const handleCaptured = async (uri: string) => {
    setBusy(true);
    try {
      const stored = await persistImage(uri, 'receipt');
      const parsed = await aiService.parseReceipt(stored);
      // If the user has already left the screen, skip the navigation. The
      // draft would otherwise pop confirm-receipt back into existence under a
      // different navigator state.
      if (!aliveRef.current) return;
      stageReceiptDraft({ imageUri: stored, parsed });
      router.replace('/confirm-receipt');
    } catch (e) {
      if (aliveRef.current) {
        Alert.alert('Could not read receipt', e instanceof Error ? e.message : String(e));
      }
    } finally {
      if (aliveRef.current) setBusy(false);
    }
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ paddingVertical: spacing.lg, gap: spacing.md }}>
        <CapturePicker
          title="Snap the receipt"
          hint="Get the whole thing in frame if you can. Blurry is fine."
          onCaptured={handleCaptured}
          busy={busy}
          busyLabel="Reading receipt…"
        />
        {!busy ? (
          <BigButton label="Cancel" variant="ghost" onPress={() => router.replace('/')} />
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}
