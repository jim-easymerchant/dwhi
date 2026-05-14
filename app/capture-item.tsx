import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/ScreenContainer';
import { BigButton } from '@/components/BigButton';
import { useCaptureStore } from '@/services/captureStore';
import { colors, spacing, typography } from '@/theme/colors';
import type { Direction } from '@/types/models';

export default function CaptureItemMethodScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ direction?: string }>();
  const direction: Direction = params.direction === 'OUT' ? 'OUT' : 'IN';
  const stageItemDraft = useCaptureStore(s => s.stageItemDraft);

  const title = direction === 'IN' ? 'Add to home' : 'Take from home';
  const hint =
    direction === 'IN'
      ? 'How would you like to identify what you brought in?'
      : 'How would you like to identify what you used?';

  const startBarcode = () =>
    router.push({ pathname: '/capture-item-barcode', params: { direction } });

  const startPhoto = () =>
    router.push({ pathname: '/capture-item-photo', params: { direction } });

  const startManual = () => {
    stageItemDraft({
      imageUri: null,
      direction,
      source: 'manual',
      parsed: {
        manufacturer: null,
        name: '',
        category: null,
        containerType: null,
        size: null,
      },
    });
    router.replace('/confirm-item');
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.directionLabel}>
            {direction === 'IN' ? '+ In' : '− Out'}
          </Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.hint}>{hint}</Text>
        </View>

        <View style={styles.choices}>
          <BigButton
            icon="📸"
            label="Scan barcode"
            large
            variant="primary"
            onPress={startBarcode}
            style={styles.primaryChoice}
          />
          <Text style={styles.choiceHint}>
            Looks up the product in Open Food Facts. No account needed.
          </Text>

          <BigButton
            icon="🖼️"
            label="Take a photo"
            variant="secondary"
            onPress={startPhoto}
          />
          <BigButton
            icon="✏️"
            label="Enter manually"
            variant="ghost"
            onPress={startManual}
          />
        </View>

        <BigButton
          label="Cancel"
          variant="ghost"
          onPress={() => router.replace('/')}
        />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingVertical: spacing.lg,
    gap: spacing.lg,
  },
  header: {
    gap: spacing.xs,
  },
  directionLabel: {
    ...typography.label,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    ...typography.title,
    color: colors.textPrimary,
  },
  hint: {
    ...typography.body,
    color: colors.textMuted,
  },
  choices: {
    gap: spacing.md,
  },
  primaryChoice: {
    minHeight: 140,
  },
  choiceHint: {
    ...typography.caption,
    color: colors.textMuted,
    paddingHorizontal: spacing.sm,
    marginTop: -spacing.xs,
  },
});
