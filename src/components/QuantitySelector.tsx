import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '@/theme/colors';

interface Props {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
}

export function QuantitySelector({ value, onChange, min = 0, max = 999 }: Props) {
  const dec = () => onChange(Math.max(min, value - 1));
  const inc = () => onChange(Math.min(max, value + 1));

  return (
    <View style={styles.row}>
      <Pressable
        onPress={dec}
        style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
        android_ripple={{ color: colors.border, borderless: true }}
      >
        <Text style={styles.btnLabel}>−</Text>
      </Pressable>
      <View style={styles.valueWrap}>
        <Text style={styles.value}>{value}</Text>
      </View>
      <Pressable
        onPress={inc}
        style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
        android_ripple={{ color: colors.border, borderless: true }}
      >
        <Text style={styles.btnLabel}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  btn: {
    width: 56,
    height: 56,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  btnLabel: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '600',
    lineHeight: 30,
  },
  valueWrap: {
    minWidth: 64,
    alignItems: 'center',
  },
  value: {
    ...typography.title,
    color: colors.textPrimary,
  },
});
