/**
 * QuestCard — a single quest-selection card.
 *
 * Layout (shared across themes):
 *   - Top: modality label ("BODYWEIGHT" / "WEIGHTED")
 *   - Middle: 2-5 exercise preview rows
 *   - Bottom: call-to-action button with theme-driven label
 *
 * The card itself does NOT decide its label — the parent passes
 * `actionLabel` resolved from `ThemePack.questCard`. The exercise
 * preview list is bounded to a max of 5 lines so the card stays a
 * reasonable height on small phones.
 *
 * See: docs/workout-rpg/019-tavern-home-layout.md §6 (quest cards).
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  workoutColors,
  workoutRadii,
  workoutSpacing,
  workoutType,
} from '../../theme/workoutColors';

const MAX_PREVIEW_LINES = 5;

export interface QuestCardProps {
  /** Coarse modality label drawn on the card head (e.g. BODYWEIGHT). */
  modalityLabel: string;
  /** Names of the exercises the player will see when they begin. */
  exerciseNames: readonly string[];
  /** Full CTA label resolved from the theme (e.g. "Begin · Bodyweight"). */
  actionLabel: string;
  /** Accent colour used on the active border + CTA glow. */
  accentColor: string;
  /** When true, render the active border (selected modality). */
  active: boolean;
  onPress: () => void;
  testID?: string;
}

export function QuestCard({
  modalityLabel,
  exerciseNames,
  actionLabel,
  accentColor,
  active,
  onPress,
  testID,
}: QuestCardProps): JSX.Element {
  const preview = exerciseNames.slice(0, MAX_PREVIEW_LINES);
  const extra = exerciseNames.length - preview.length;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={actionLabel}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        active && { borderColor: accentColor },
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.label}>{modalityLabel}</Text>
      <View style={styles.previewList}>
        {preview.map((name) => (
          <Text key={name} style={styles.previewRow} numberOfLines={1}>
            • {name}
          </Text>
        ))}
        {extra > 0 ? (
          <Text style={styles.previewMore}>+ {extra} more</Text>
        ) : null}
      </View>
      <View style={[styles.cta, { backgroundColor: accentColor }]}>
        <Text style={styles.ctaText}>{actionLabel}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: workoutColors.surfaceElevated,
    borderRadius: workoutRadii.md,
    padding: workoutSpacing.md,
    borderWidth: 1,
    borderColor: workoutColors.border,
    gap: workoutSpacing.sm,
  },
  label: {
    ...workoutType.caption,
    letterSpacing: 2,
    color: workoutColors.textMuted,
  },
  previewList: {
    gap: 2,
  },
  previewRow: {
    ...workoutType.caption,
    color: workoutColors.textSecondary,
  },
  previewMore: {
    ...workoutType.caption,
    color: workoutColors.textMuted,
    fontStyle: 'italic',
  },
  cta: {
    marginTop: workoutSpacing.xs,
    borderRadius: workoutRadii.sm,
    paddingVertical: workoutSpacing.sm,
    alignItems: 'center',
  },
  ctaText: {
    ...workoutType.body,
    color: workoutColors.background,
    fontWeight: '600',
  },
  pressed: { opacity: 0.75 },
});
