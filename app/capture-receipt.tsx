import React, { useState } from 'react';
import { Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/ScreenContainer';
import { CapturePicker } from '@/components/CapturePicker';
import { aiService } from '@/services/aiService';
import { persistImage } from '@/services/imageStorage';
import { useCaptureStore } from '@/services/captureStore';
import { spacing } from '@/theme/colors';

export default function CaptureReceiptScreen() {
  const router = useRouter();
  const setReceiptDraft = useCaptureStore(s => s.setReceiptDraft);
  const [busy, setBusy] = useState(false);

  const handleCaptured = async (uri: string) => {
    setBusy(true);
    try {
      const stored = await persistImage(uri, 'receipt');
      const parsed = await aiService.parseReceipt(stored);
      setReceiptDraft({ imageUri: stored, parsed });
      router.replace('/confirm-receipt');
    } catch (e) {
      Alert.alert('Could not read receipt', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ paddingVertical: spacing.lg }}>
        <CapturePicker
          title="Snap the receipt"
          hint="Get the whole thing in frame if you can. Blurry is fine."
          onCaptured={handleCaptured}
          busy={busy}
          busyLabel="Reading receipt…"
        />
      </ScrollView>
    </ScreenContainer>
  );
}
