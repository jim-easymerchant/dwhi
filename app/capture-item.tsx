import React, { useState } from 'react';
import { Alert, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/ScreenContainer';
import { CapturePicker } from '@/components/CapturePicker';
import { aiService } from '@/services/aiService';
import { persistImage } from '@/services/imageStorage';
import { useCaptureStore } from '@/services/captureStore';
import { spacing } from '@/theme/colors';
import type { Direction } from '@/types/models';

export default function CaptureItemScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ direction?: string }>();
  const direction: Direction = params.direction === 'OUT' ? 'OUT' : 'IN';
  const setItemDraft = useCaptureStore(s => s.setItemDraft);
  const [busy, setBusy] = useState(false);

  const handleCaptured = async (uri: string) => {
    setBusy(true);
    try {
      const stored = await persistImage(uri, 'item');
      const parsed = await aiService.recognizeItem(stored);
      setItemDraft({ imageUri: stored, parsed, direction });
      router.replace('/confirm-item');
    } catch (e) {
      Alert.alert('Could not read item', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const title = direction === 'IN' ? 'Add to home' : 'Take from home';
  const hint =
    direction === 'IN'
      ? 'Snap whatever you just brought in. Label-facing helps but is not required.'
      : 'Snap what you used up or threw out. Imperfect photos are fine.';

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ paddingVertical: spacing.lg }}>
        <CapturePicker
          title={title}
          hint={hint}
          onCaptured={handleCaptured}
          busy={busy}
          busyLabel="Identifying item…"
        />
      </ScrollView>
    </ScreenContainer>
  );
}
