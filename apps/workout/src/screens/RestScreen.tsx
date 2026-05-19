/**
 * Rest — the enemy's turn.
 *
 * Tone target (012 §9): not a countdown that escalates. Numbers
 * are large and slow; tips rotate; "I'm ready" carries no reward
 * and no penalty. Tapping outside dismisses to the Battle screen
 * while time keeps running — that's a planned post-MVP polish; in
 * the shell, the overlay is full-screen.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useWorkoutGameStore } from '../state/workoutGameStore';
import { workoutColors, workoutRadii, workoutSpacing, workoutType } from '../theme/workoutColors';

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
  const battleIndex = useWorkoutGameStore((s) => s.currentBattleIndex);
  const setIndex = useWorkoutGameStore((s) => s.currentSetIndexInBattle);
  const tip = pickTip(battleIndex * 7 + setIndex);

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
          style={({ pressed }) => [
            styles.readyButton,
            pressed && styles.pressed,
          ]}
          onPress={endRest}
        >
          <Text style={styles.readyButtonText}>I'm ready</Text>
        </Pressable>
        <Text style={styles.noPenalty}>(no penalty)</Text>
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
  pressed: { opacity: 0.7 },
});
