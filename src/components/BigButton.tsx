import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, radii, spacing, typography } from '@/theme/colors';

type Variant = 'primary' | 'secondary' | 'positive' | 'danger' | 'ghost';

interface Props {
  label: string;
  icon?: string;
  onPress: () => void;
  variant?: Variant;
  style?: ViewStyle;
  large?: boolean;
  disabled?: boolean;
}

const variantStyles: Record<Variant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: colors.surfaceElevated, fg: colors.textPrimary, border: colors.border },
  secondary: { bg: colors.surface, fg: colors.textPrimary, border: colors.border },
  positive: { bg: '#1C3A29', fg: colors.positive, border: '#2A5A40' },
  danger: { bg: '#3A1C1C', fg: colors.danger, border: '#5A2A2A' },
  ghost: { bg: 'transparent', fg: colors.textSecondary, border: colors.border },
};

export function BigButton({
  label,
  icon,
  onPress,
  variant = 'primary',
  style,
  large,
  disabled,
}: Props) {
  const v = variantStyles[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      android_ripple={{ color: colors.border }}
      style={({ pressed }) => [
        styles.base,
        large && styles.large,
        {
          backgroundColor: v.bg,
          borderColor: v.border ?? 'transparent',
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      <View style={styles.row}>
        {icon ? <Text style={[styles.icon, { color: v.fg }]}>{icon}</Text> : null}
        <Text style={[styles.label, large && styles.labelLarge, { color: v.fg }]}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 64,
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  large: {
    minHeight: 140,
    borderRadius: radii.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  icon: {
    fontSize: 32,
  },
  label: {
    ...typography.body,
    fontWeight: '600',
  },
  labelLarge: {
    ...typography.heading,
  },
});
