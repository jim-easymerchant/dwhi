/**
 * RestTimer — optional, supportive, never-blocking rest countdown UI.
 *
 * Two visual states the BattleScreen toggles between:
 *
 *   1. **Choice strip** — three small chips offering 60s / 90s / 120s.
 *      Rendered only when `phase === 'idle'` AND `offerWhenIdle` is
 *      true (e.g. right after an attack). Tapping a chip starts
 *      the timer.
 *   2. **Running / complete strip** — a single row with the remaining
 *      time (or "Ready when you are.") and a Dismiss button.
 *
 * Anti-shame copy contract:
 *   - never uses alarmist or coercive verbs (see the regression
 *     grep in `tests/restTimer.test.ts`)
 *   - allowed phrasing: "Rest a moment?", "Ready when you are.",
 *     "Timer complete."
 *
 * Pure-presentational. The hook (`useRestTimer`) is created by the
 * parent (BattleScreen) so timer state survives the chip-tap
 * → first-tick render cycle.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  REST_PRESETS,
  formatRestTime,
  type RestTimerApi,
} from '../../hooks/useRestTimer';
import {
  workoutColors,
  workoutRadii,
  workoutSpacing,
  workoutType,
} from '../../theme/workoutColors';

export interface RestTimerProps {
  /** API returned by `useRestTimer()`. */
  timer: RestTimerApi;
  /** When false, the idle chip row hides itself (e.g. on first
   *  render before any set is logged). Default: true. */
  offerWhenIdle?: boolean;
  /** Theme accent — used for the active chip border. */
  accentColor: string;
  testID?: string;
}

export function RestTimer({
  timer,
  offerWhenIdle = true,
  accentColor,
  testID,
}: RestTimerProps): JSX.Element | null {
  if (timer.phase === 'idle') {
    if (!offerWhenIdle) return null;
    return (
      <View testID={testID ?? 'rest-timer'} style={styles.row}>
        <Text style={styles.prompt}>Rest a moment?</Text>
        <View style={styles.chipsRow}>
          {REST_PRESETS.map((seconds) => (
            <Pressable
              key={seconds}
              accessibilityRole="button"
              accessibilityLabel={`Rest for ${seconds} seconds`}
              testID={`rest-timer-preset-${seconds}`}
              onPress={() => timer.start(seconds)}
              style={({ pressed }) => [
                styles.chip,
                { borderColor: pressed ? accentColor : workoutColors.border },
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.chipText}>{seconds}s</Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  }

  if (timer.phase === 'running') {
    return (
      <View testID={testID ?? 'rest-timer'} style={styles.runningRow}>
        <View style={styles.runningTextBlock}>
          <Text testID="rest-timer-remaining" style={styles.runningTime}>
            {formatRestTime(timer.remainingSeconds)}
          </Text>
          <Text style={styles.runningHint}>Resting · ready when you are.</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss rest timer"
          testID="rest-timer-dismiss"
          onPress={timer.cancel}
          style={({ pressed }) => [
            styles.dismiss,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.dismissText}>Dismiss</Text>
        </Pressable>
      </View>
    );
  }

  // phase === 'complete'
  return (
    <View testID={testID ?? 'rest-timer'} style={styles.completeRow}>
      <Text testID="rest-timer-complete" style={styles.completeText}>
        Timer complete.
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Acknowledge timer"
        testID="rest-timer-acknowledge"
        onPress={timer.acknowledgeComplete}
        style={({ pressed }) => [
          styles.acknowledge,
          { borderColor: accentColor },
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.acknowledgeText}>Got it</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: workoutSpacing.sm,
    paddingVertical: workoutSpacing.sm,
  },
  prompt: {
    ...workoutType.caption,
    color: workoutColors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  chipsRow: {
    flexDirection: 'row',
    gap: workoutSpacing.sm,
    justifyContent: 'center',
  },
  chip: {
    paddingHorizontal: workoutSpacing.md,
    paddingVertical: workoutSpacing.sm,
    borderRadius: workoutRadii.pill,
    backgroundColor: workoutColors.surface,
    borderWidth: 1,
    borderColor: workoutColors.border,
    minWidth: 60,
    alignItems: 'center',
  },
  chipText: {
    ...workoutType.label,
    color: workoutColors.textSecondary,
  },
  runningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: workoutSpacing.md,
    paddingVertical: workoutSpacing.sm,
    backgroundColor: workoutColors.surface,
    borderRadius: workoutRadii.md,
    borderWidth: 1,
    borderColor: workoutColors.border,
  },
  runningTextBlock: { gap: 2 },
  runningTime: {
    ...workoutType.heading,
    fontSize: 22,
    color: workoutColors.ember,
    fontVariant: ['tabular-nums'],
  },
  runningHint: {
    ...workoutType.caption,
    color: workoutColors.textMuted,
    fontStyle: 'italic',
  },
  dismiss: {
    paddingHorizontal: workoutSpacing.md,
    paddingVertical: workoutSpacing.sm,
    borderRadius: workoutRadii.sm,
  },
  dismissText: {
    ...workoutType.caption,
    color: workoutColors.textSecondary,
    letterSpacing: 1,
  },
  completeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: workoutSpacing.md,
    paddingVertical: workoutSpacing.sm,
    backgroundColor: workoutColors.surfaceElevated,
    borderRadius: workoutRadii.md,
    borderWidth: 1,
    borderColor: workoutColors.emberDim ?? workoutColors.border,
  },
  completeText: {
    ...workoutType.body,
    color: workoutColors.ember,
  },
  acknowledge: {
    paddingHorizontal: workoutSpacing.md,
    paddingVertical: workoutSpacing.sm,
    borderRadius: workoutRadii.sm,
    borderWidth: 1,
  },
  acknowledgeText: {
    ...workoutType.caption,
    color: workoutColors.textPrimary,
    letterSpacing: 1,
  },
  pressed: { opacity: 0.7 },
});
