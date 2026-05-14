import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/ScreenContainer';
import { BigButton } from '@/components/BigButton';
import { colors, spacing, typography } from '@/theme/colors';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={styles.title}>Do We Have It?</Text>
        <Text style={styles.subtitle}>A calmer way to remember what's at home.</Text>
      </View>

      <View style={styles.center}>
        <BigButton
          icon="🎤"
          label="Ask"
          large
          variant="primary"
          onPress={() => router.push('/ask')}
          style={styles.askButton}
        />

        <BigButton
          icon="🧾"
          label="Receipt"
          large
          variant="secondary"
          onPress={() => router.push('/capture-receipt')}
          style={styles.receiptButton}
        />
      </View>

      <View style={styles.bottomRow}>
        <BigButton
          icon="+"
          label="In"
          variant="positive"
          style={styles.bottomBtn}
          onPress={() => router.push({ pathname: '/capture-item', params: { direction: 'IN' } })}
        />
        <BigButton
          icon="−"
          label="Out"
          variant="danger"
          style={styles.bottomBtn}
          onPress={() => router.push({ pathname: '/capture-item', params: { direction: 'OUT' } })}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    marginTop: spacing.xl,
    alignItems: 'center',
    gap: spacing.xs,
  },
  title: {
    ...typography.title,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.lg,
  },
  askButton: {
    minHeight: 180,
  },
  receiptButton: {
    minHeight: 140,
  },
  bottomRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  bottomBtn: {
    flex: 1,
    minHeight: 88,
  },
});
