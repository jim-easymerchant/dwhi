/**
 * Rest — the enemy's turn.
 *
 * Tone target (012 §9): not a countdown that escalates. Numbers
 * are large and slow; tips rotate; "I'm ready" carries no reward
 * and no penalty.
 *
 * Branch 024 device-QA fix:
 *   - The optional rest timer used to live on the BattleScreen,
 *     where it was unreachable — the moment a player attacked,
 *     the BattleScreen returned <RestScreen /> early and the
 *     chip strip was never visible. The timer now lives where it
 *     semantically belongs: on this screen, AFTER the attack.
 *   - "I'm ready" still ends the rest without waiting for the
 *     timer. The timer never blocks.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useWorkoutGameStore } from '../state/workoutGameStore';
import { workoutColors, workoutRadii, workoutSpacing, workoutType } from '../theme/workoutColors';
import { RestTimer } from '../components/battle/RestTimer';
import { useRestTimer } from '../hooks/useRestTimer';
import { getTheme } from '../theme';

const TIPS: readonly string[] = [
  'Breathe out longer than you breathe in.',
  'Soft knees on the next set.',
  'The Long Heath is quieter today.',
  "It's okay to call this enough.",
  'Rest is a move.',
  'The next set is not owed.',
];

function pickTip(seed: number): string {
  return TIPS[Math.abs(seed) % TIPS.length];
}

export function RestScreen(): JSX.Element {
  const endRest = useWorkoutGameStore((s) => s.endRest);
  const setIndex = useWorkoutGameStore((s) => s.currentSetIndexInVariant);
  const phaseIndex = useWorkoutGameStore((s) => s.enemyPhaseIndex);
  const selectedThemeId = useWorkoutGameStore((s) => s.selectedThemeId);
  const tip = pickTip(phaseIndex * 7 + setIndex);
  const theme = getTheme(selectedThemeId);

  // The optional countdown timer. Created once, lives for the
  // life of this RestScreen mount — switching back to the
  // BattleScreen tears it down (correct behaviour — the timer is
  // a "this rest" widget, not a persistent one).
  const restTimer = useRestTimer();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.caption}>The enemy winds up.</Text>

        <View style={styles.windupArcOuter}>
          <View style={styles.windupArcInner} />
        </View>

        <Text style={styles.countdown}>—</Text>
        <Text style={styles.label}>rest until next set</Text>

        <View style={styles.tipBlock}>
          <Text style={styles.tip}>{tip}</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          testID="rest-ready"
          style={({ pressed }) => [
            styles.readyButton,
            pressed && styles.pressed,
          ]}
          onPress={endRest}
        >
          <Text style={styles.readyButtonText}>I&apos;m ready</Text>
        </Pressable>
        <Text style={styles.noPenalty}>(no penalty)</Text>

        {/* Optional rest timer. Always offered on this screen
            (the player has just logged an attack — this is the
            moment a "rest a moment?" prompt is most useful).
            Tapping I'm ready ends the rest regardless of the
            timer's state — the timer never blocks. */}
        <View style={styles.timerSlot}>
          <RestTimer
            testID="rest-timer"
            timer={restTimer}
            offerWhenIdle
            accentColor={theme.uiAccent.primary}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: workoutColors.background },
  container: {
    flex: 1,
    padding: workoutSpacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: workoutSpacing.lg,
  },
  caption: {
    ...workoutType.caption,
    color: workoutColors.ash,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  windupArcOuter: {
    width: 220,
    height: 8,
    borderRadius: workoutRadii.pill,
    backgroundColor: workoutColors.surface,
    overflow: 'hidden',
    marginVertical: workoutSpacing.md,
  },
  windupArcInner: {
    width: '40%',
    height: '100%',
    backgroundColor: workoutColors.ash,
  },
  countdown: {
    fontSize: 96,
    fontWeight: '300',
    color: workoutColors.textPrimary,
  },
  label: {
    ...workoutType.body,
    color: workoutColors.textSecondary,
  },
  tipBlock: {
    marginVertical: workoutSpacing.xl,
    paddingHorizontal: workoutSpacing.lg,
  },
  tip: {
    ...workoutType.body,
    color: workoutColors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  readyButton: {
    backgroundColor: workoutColors.surfaceElevated,
    borderRadius: workoutRadii.md,
    paddingVertical: workoutSpacing.lg,
    paddingHorizontal: workoutSpacing.xxl,
    borderWidth: 1,
    borderColor: workoutColors.border,
    marginTop: workoutSpacing.lg,
  },
  readyButtonText: {
    ...workoutType.body,
    color: workoutColors.textPrimary,
  },
  noPenalty: {
    ...workoutType.caption,
    color: workoutColors.textMuted,
  },
  timerSlot: {
    width: '100%',
    paddingHorizontal: workoutSpacing.md,
    marginTop: workoutSpacing.md,
  },
  pressed: { opacity: 0.7 },
});
