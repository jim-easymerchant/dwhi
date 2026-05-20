/**
 * EchoLogPanel — collapsible journal-style panel.
 *
 * Three of these stack at the bottom of the home screen: Echo Log
 * (defeated fragments), Weight Log (recent PR sets), and Session
 * History (completed quests). They are all the same shape: a
 * header with a count + chevron, a tap to expand, and a short
 * empty-state hint when nothing has accrued yet.
 *
 * The labels (header, empty hint) come from `ThemePack.panelLabels`
 * so the same component renders "Echoes" / "KILL LOG" depending on
 * the active theme.
 *
 * See: docs/workout-rpg/019-tavern-home-layout.md §7 (lower panels).
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  workoutColors,
  workoutRadii,
  workoutSpacing,
  workoutType,
} from '../../theme/workoutColors';

export interface EchoLogPanelProps {
  label: string;
  /** Numeric counter shown in the header — e.g. KILL LOG (3). */
  count: number;
  /** Empty-state hint shown when expanded with no rows. */
  emptyHint: string;
  /** Optional rows to render under the header when expanded. */
  rows?: readonly string[];
  /** Optional initial open state (defaults to collapsed). */
  initialOpen?: boolean;
  testID?: string;
}

export function EchoLogPanel({
  label,
  count,
  emptyHint,
  rows,
  initialOpen = false,
  testID,
}: EchoLogPanelProps): JSX.Element {
  const [open, setOpen] = React.useState(initialOpen);
  const toggle = React.useCallback(() => setOpen((v) => !v), []);

  return (
    <View testID={testID} style={styles.panel}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${count} entries`}
        testID={`${testID ?? 'echo-log'}-toggle`}
        onPress={toggle}
        style={({ pressed }) => [styles.header, pressed && styles.pressed]}
      >
        <Text style={styles.label}>
          {label} ({count})
        </Text>
        <Text style={styles.chevron}>{open ? '▾' : '▸'}</Text>
      </Pressable>
      {open ? (
        <View testID={`${testID ?? 'echo-log'}-body`} style={styles.body}>
          {rows && rows.length > 0 ? (
            rows.map((row, i) => (
              <Text
                key={`${row}-${i}`}
                style={styles.row}
                numberOfLines={2}
              >
                • {row}
              </Text>
            ))
          ) : (
            <Text style={styles.empty}>{emptyHint}</Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: workoutColors.surface,
    borderRadius: workoutRadii.md,
    borderWidth: 1,
    borderColor: workoutColors.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: workoutSpacing.sm,
    paddingHorizontal: workoutSpacing.md,
  },
  label: {
    ...workoutType.label,
    letterSpacing: 1,
    color: workoutColors.textPrimary,
  },
  chevron: {
    ...workoutType.body,
    color: workoutColors.textMuted,
  },
  body: {
    paddingHorizontal: workoutSpacing.md,
    paddingBottom: workoutSpacing.sm,
    gap: workoutSpacing.xs,
  },
  row: {
    ...workoutType.caption,
    color: workoutColors.textSecondary,
  },
  empty: {
    ...workoutType.caption,
    color: workoutColors.textMuted,
    fontStyle: 'italic',
  },
  pressed: { opacity: 0.7 },
});
