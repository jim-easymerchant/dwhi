/**
 * ThemeCard — one selectable theme option in the Settings panel.
 *
 * A `Pressable` card showing the theme's display name, short
 * description, tagline, and a small selection indicator. The card
 * uses the theme's own UI accent for the active border so the
 * preview also reads as "this is what the colour will look like
 * after you tap." No animations beyond the press-state opacity.
 *
 * Tone-neutral: the card itself does not lean Momentum vs Iron
 * Quest. The descriptive copy comes from the theme pack.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  workoutColors,
  workoutRadii,
  workoutSpacing,
  workoutType,
} from '../theme/workoutColors';
import type { ThemePack } from '../theme';

export interface ThemeCardProps {
  theme: ThemePack;
  selected: boolean;
  onSelect: (themeId: string) => void;
  testID?: string;
}

export function ThemeCard({
  theme,
  selected,
  onSelect,
  testID,
}: ThemeCardProps): JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${theme.displayName} theme${selected ? ', selected' : ''}`}
      testID={testID ?? `theme-card-${theme.id}`}
      style={({ pressed }) => [
        styles.card,
        selected && [styles.cardSelected, { borderColor: theme.uiAccent.primary }],
        pressed && styles.pressed,
      ]}
      onPress={() => onSelect(theme.id)}
    >
      <View style={styles.row}>
        <Text style={styles.name}>{theme.displayName}</Text>
        <View
          style={[
            styles.dot,
            { backgroundColor: theme.uiAccent.primary },
            !selected && styles.dotDim,
          ]}
        />
      </View>
      <Text style={styles.description}>{theme.description}</Text>
      <Text style={[styles.tagline, { color: theme.uiAccent.primary }]}>
        {theme.motivational.tagline}
      </Text>
      <Text style={styles.tone}>{toneLabel(theme.tone)}</Text>
    </Pressable>
  );
}

function toneLabel(tone: ThemePack['tone']): string {
  switch (tone) {
    case 'quiet-mythic':
      return 'tone — quiet, mythic, warm';
    case 'arcade-tavern':
      return 'tone — arcade, taunting, loud';
  }
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: workoutColors.surface,
    borderRadius: workoutRadii.lg,
    padding: workoutSpacing.lg,
    gap: workoutSpacing.xs,
    borderWidth: 1,
    borderColor: workoutColors.border,
  },
  cardSelected: {
    backgroundColor: workoutColors.surfaceElevated,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  name: { ...workoutType.heading, color: workoutColors.textPrimary },
  description: {
    ...workoutType.body,
    color: workoutColors.textSecondary,
    marginTop: workoutSpacing.xs,
  },
  tagline: {
    ...workoutType.label,
    marginTop: workoutSpacing.sm,
    fontStyle: 'italic',
  },
  tone: {
    ...workoutType.caption,
    color: workoutColors.textMuted,
    marginTop: workoutSpacing.xs,
    letterSpacing: 1,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  dotDim: { opacity: 0.3 },
  pressed: { opacity: 0.85 },
});
