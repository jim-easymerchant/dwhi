import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '@/theme/colors';

interface Props {
  visible: boolean;
  busy?: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

/**
 * One-shot opt-in modal. Copy and structure are intentionally short and
 * non-alarming — the spec calls this a "calm" prompt, not a wall of
 * legalese. The "Not now" path still marks the prompt seen so the user
 * isn't badgered every launch.
 */
export function LocationOptInModal({ visible, busy, onAccept, onDecline }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDecline}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Use location context?</Text>
          <Text style={styles.body}>
            This helps future household features understand when items may
            have been bought or used. Location stays on this device for now.
          </Text>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={onDecline}
              disabled={busy}
              style={({ pressed }) => [
                styles.button,
                styles.secondary,
                pressed && styles.pressed,
                busy && styles.disabled,
              ]}
            >
              <Text style={styles.secondaryLabel}>Not now</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={onAccept}
              disabled={busy}
              style={({ pressed }) => [
                styles.button,
                styles.primary,
                pressed && styles.pressed,
                busy && styles.disabled,
              ]}
            >
              <Text style={styles.primaryLabel}>
                {busy ? 'Please wait…' : 'Continue'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    ...typography.heading,
    color: colors.textPrimary,
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  button: {
    flex: 1,
    minHeight: 48,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  primary: {
    backgroundColor: colors.accent,
  },
  secondary: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderWidth: 1,
  },
  primaryLabel: {
    color: colors.background,
    fontWeight: '700',
    fontSize: 16,
  },
  secondaryLabel: {
    color: colors.textPrimary,
    fontWeight: '600',
    fontSize: 16,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.5,
  },
});
