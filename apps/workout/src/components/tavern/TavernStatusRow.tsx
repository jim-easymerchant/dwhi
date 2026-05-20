/**
 * TavernStatusRow — compact horizontal 3-card status strip.
 *
 * Displays three small at-a-glance cards under the scene:
 *   LEVEL  — Momentum value (numeric mirror of the Ember bar)
 *   LAST   — relative time since the last completed Quest
 *   WEIGHT — current bodyweight (kg)
 *
 * Theme-agnostic. The labels are static (LEVEL/LAST/WEIGHT) because
 * they describe canonical Momentum state, not theme flavour. A
 * future theme that wants to relabel them can opt into a
 * `statusLabels` sub-shape; this branch keeps the labels stable.
 *
 * See: docs/workout-rpg/019-tavern-home-layout.md §4 (status row).
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  workoutColors,
  workoutRadii,
  workoutSpacing,
  workoutType,
} from '../../theme/workoutColors';

export interface TavernStatusRowProps {
  momentum: number;
  daysSinceLastQuest: number;
  bodyweightKg: number;
  /** Accent colour used for the LEVEL value (theme.uiAccent.primary). */
  accentColor: string;
  testID?: string;
}

/** Friendly relative-day formatter used by the LAST card. */
function formatDaysSince(days: number): string {
  if (days >= 999) return 'never';
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days <= 7) return `${days}d ago`;
  if (days <= 30) return `${Math.round(days / 7)}w ago`;
  return 'a while';
}

export function TavernStatusRow({
  momentum,
  daysSinceLastQuest,
  bodyweightKg,
  accentColor,
  testID,
}: TavernStatusRowProps): JSX.Element {
  return (
    <View testID={testID} style={styles.row}>
      <View testID="status-card-level" style={styles.card}>
        <Text style={styles.label}>LEVEL</Text>
        <Text style={[styles.value, { color: accentColor }]}>
          {Math.round(momentum)}
        </Text>
      </View>
      <View testID="status-card-last" style={styles.card}>
        <Text style={styles.label}>LAST</Text>
        <Text style={styles.value}>{formatDaysSince(daysSinceLastQuest)}</Text>
      </View>
      <View testID="status-card-weight" style={styles.card}>
        <Text style={styles.label}>WEIGHT</Text>
        <Text style={styles.value}>{Math.round(bodyweightKg)} kg</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: workoutSpacing.sm,
  },
  card: {
    flex: 1,
    backgroundColor: workoutColors.surface,
    borderRadius: workoutRadii.md,
    borderWidth: 1,
    borderColor: workoutColors.border,
    paddingVertical: workoutSpacing.sm,
    paddingHorizontal: workoutSpacing.md,
    alignItems: 'center',
    gap: 2,
  },
  label: {
    ...workoutType.caption,
    letterSpacing: 2,
    color: workoutColors.textMuted,
  },
  value: {
    ...workoutType.heading,
    fontSize: 18,
  },
});
