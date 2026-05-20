/**
 * AmbientPanel — "Tonight in the Hollow" / "TONIGHT'S PATRONS".
 *
 * Theme-driven flavour panel that lists 2-5 atmospheric blurbs.
 * The structure is shared across themes; only the section label
 * and the line content differ. The parent screen resolves the
 * lines via `getAmbientLines(themeId, tier)` from the theme module
 * — this component is a dumb renderer.
 *
 * Anti-shame guardrails (see docs/workout-rpg/001-design-bible.md):
 *   - Never references absence, missed days, or comparison.
 *   - Tone is set by the theme; the panel does not amplify it.
 *
 * See: docs/workout-rpg/019-tavern-home-layout.md §5 (ambient panel).
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { AmbientLine } from '../../theme';
import {
  workoutColors,
  workoutRadii,
  workoutSpacing,
  workoutType,
} from '../../theme/workoutColors';

export interface AmbientPanelProps {
  sectionLabel: string;
  lines: readonly AmbientLine[];
  testID?: string;
}

export function AmbientPanel({
  sectionLabel,
  lines,
  testID,
}: AmbientPanelProps): JSX.Element {
  return (
    <View testID={testID} style={styles.card}>
      <Text testID="ambient-section-label" style={styles.section}>
        {sectionLabel}
      </Text>
      <View style={styles.list}>
        {lines.map((line, i) => (
          <View
            key={`${line.heading}-${i}`}
            testID={`ambient-line-${i}`}
            style={styles.lineRow}
          >
            <Text style={styles.heading}>{line.heading}</Text>
            <Text style={styles.mood}>{line.mood}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: workoutColors.surface,
    borderRadius: workoutRadii.lg,
    borderWidth: 1,
    borderColor: workoutColors.border,
    padding: workoutSpacing.md,
    gap: workoutSpacing.sm,
  },
  section: {
    ...workoutType.caption,
    letterSpacing: 2,
    color: workoutColors.textMuted,
  },
  list: {
    gap: workoutSpacing.xs,
  },
  lineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: workoutSpacing.md,
    alignItems: 'baseline',
  },
  heading: {
    ...workoutType.body,
    color: workoutColors.textPrimary,
    flexShrink: 1,
  },
  mood: {
    ...workoutType.caption,
    color: workoutColors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'right',
    flexShrink: 1,
  },
});
