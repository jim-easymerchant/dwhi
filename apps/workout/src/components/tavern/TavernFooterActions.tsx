/**
 * TavernFooterActions — bottom-of-home reassurance line + Ember bar.
 *
 * The Ember bar is the slim Momentum indicator that used to live in
 * the middle of the home screen. Moving it to the footer keeps the
 * scene + quest cards as the visual centre of gravity while still
 * giving the player a small, persistent mirror of their Momentum.
 *
 * The reassurance line is theme-driven (`ThemePack.footer.reassurance`).
 * Anti-shame: neither theme is allowed to call out absence or
 * compare to others here. The line either celebrates showing up
 * or refuses to moralise — never both.
 *
 * See: docs/workout-rpg/019-tavern-home-layout.md §8 (footer).
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  workoutColors,
  workoutRadii,
  workoutSpacing,
  workoutType,
} from '../../theme/workoutColors';

export interface TavernFooterActionsProps {
  /** Reassurance line drawn at the very bottom. */
  reassurance: string;
  /** Current momentum value (0-100) used to size the Ember fill. */
  momentum: number;
  /** Accent colour used for the Ember bar fill. */
  emberColor: string;
  testID?: string;
}

export function TavernFooterActions({
  reassurance,
  momentum,
  emberColor,
  testID,
}: TavernFooterActionsProps): JSX.Element {
  const pct = Math.max(0, Math.min(100, momentum));
  return (
    <View testID={testID} style={styles.footer}>
      <View style={styles.emberTrack}>
        <View
          testID="footer-ember-fill"
          style={[
            styles.emberFill,
            { width: `${pct}%`, backgroundColor: emberColor },
          ]}
        />
      </View>
      <Text testID="footer-reassurance" style={styles.reassurance}>
        {reassurance}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    gap: workoutSpacing.sm,
    alignItems: 'center',
    paddingTop: workoutSpacing.md,
  },
  emberTrack: {
    width: '80%',
    height: 6,
    borderRadius: workoutRadii.pill,
    backgroundColor: workoutColors.surface,
    overflow: 'hidden',
  },
  emberFill: {
    height: '100%',
  },
  reassurance: {
    ...workoutType.caption,
    color: workoutColors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
