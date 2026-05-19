/**
 * Battle — log a set, attack the silhouette, advance.
 *
 * Tone target (012 §7): mythic, calm. The enemy is centred and
 * larger than the player UI. Damage numbers are narrative, not a
 * cumulative tally. The Attack button reads "Attack" — neutral,
 * not destructive verbs. No exclamation marks.
 */

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PUSH_DAY_BATTLES } from '../fixtures/pushDayQuest';
import {
  currentBattle,
  isLastSetOfQuest,
  useWorkoutGameStore,
} from '../state/workoutGameStore';
import { workoutColors, workoutRadii, workoutSpacing, workoutType } from '../theme/workoutColors';
import { RestScreen } from './RestScreen';

export function BattleScreen(): JSX.Element {
  const phase = useWorkoutGameStore((s) => s.phase);
  const variant = useWorkoutGameStore((s) => s.variant);
  const battleIndex = useWorkoutGameStore((s) => s.currentBattleIndex);
  const setIndexInBattle = useWorkoutGameStore((s) => s.currentSetIndexInBattle);
  const draftReps = useWorkoutGameStore((s) => s.draftReps);
  const draftWeightKg = useWorkoutGameStore((s) => s.draftWeightKg);
  const setReps = useWorkoutGameStore((s) => s.setReps);
  const setWeight = useWorkoutGameStore((s) => s.setWeight);
  const logCurrentSet = useWorkoutGameStore((s) => s.logCurrentSet);
  const enterRest = useWorkoutGameStore((s) => s.enterRest);
  const finishQuest = useWorkoutGameStore((s) => s.finishQuest);
  const log = useWorkoutGameStore((s) => s.log);

  const battle = currentBattle(useWorkoutGameStore.getState());
  const last = isLastSetOfQuest(useWorkoutGameStore.getState());
  const useWeighted = variant === 'weighted';
  const exerciseName = useWeighted
    ? battle.weightedExerciseName
    : battle.bodyweightExerciseName;

  const totalBattles = PUSH_DAY_BATTLES.length;

  const onAttack = (): void => {
    logCurrentSet();
    if (last) {
      finishQuest();
    } else {
      enterRest();
    }
  };

  if (phase === 'rest') {
    return <RestScreen />;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Enemy silhouette + HP */}
        <View style={styles.enemyBlock}>
          <Text style={styles.enemyLabel}>SLUGGARD, LORD OF COUCHES</Text>
          <View style={styles.silhouette}>
            <Text style={styles.silhouetteGlyph}>◆</Text>
          </View>
          <Text style={styles.battleProgress}>
            Battle {battleIndex + 1} of {totalBattles} · Set {setIndexInBattle + 1} of {battle.setsPerBattle}
          </Text>
        </View>

        {/* Set entry */}
        <View style={styles.entryBlock}>
          <Text style={styles.exerciseName}>{exerciseName}</Text>

          <View style={styles.stepperRow}>
            <Text style={styles.stepperLabel}>Reps</Text>
            <View style={styles.stepper}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Decrease reps"
                style={styles.stepperButton}
                onPress={() => setReps(Math.max(0, draftReps - 1))}
              >
                <Text style={styles.stepperButtonText}>−</Text>
              </Pressable>
              <Text style={styles.stepperValue}>{draftReps}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Increase reps"
                style={styles.stepperButton}
                onPress={() => setReps(draftReps + 1)}
              >
                <Text style={styles.stepperButtonText}>+</Text>
              </Pressable>
            </View>
          </View>

          {useWeighted && (
            <View style={styles.stepperRow}>
              <Text style={styles.stepperLabel}>Weight (kg)</Text>
              <View style={styles.stepper}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Decrease weight"
                  style={styles.stepperButton}
                  onPress={() => setWeight(Math.max(0, draftWeightKg - 2.5))}
                >
                  <Text style={styles.stepperButtonText}>−</Text>
                </Pressable>
                <Text style={styles.stepperValue}>{draftWeightKg}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Increase weight"
                  style={styles.stepperButton}
                  onPress={() => setWeight(draftWeightKg + 2.5)}
                >
                  <Text style={styles.stepperButtonText}>+</Text>
                </Pressable>
              </View>
            </View>
          )}

          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.attackButton,
              pressed && styles.pressed,
            ]}
            onPress={onAttack}
          >
            <Text style={styles.attackText}>
              {last ? 'Attack · Wrap it up' : 'Attack'}
            </Text>
          </Pressable>
        </View>

        {/* Logged history (light) */}
        {log.length > 0 && (
          <View style={styles.logBlock}>
            <Text style={styles.logLabel}>Log</Text>
            {log.map((row, i) => (
              <Text key={`${row.exerciseId}-${i}`} style={styles.logRow}>
                · {row.exerciseName}, {row.reps} reps
                {row.weightKg ? ` @ ${row.weightKg}kg` : ''}
                {row.isPersonalRecord ? '  ✦' : ''}
              </Text>
            ))}
          </View>
        )}

        <Text style={styles.footer}>The Ember holds.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const SILHOUETTE_SIZE = 160;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: workoutColors.background },
  scroll: {
    padding: workoutSpacing.lg,
    gap: workoutSpacing.lg,
    flexGrow: 1,
  },
  enemyBlock: {
    alignItems: 'center',
    gap: workoutSpacing.sm,
    paddingTop: workoutSpacing.md,
  },
  enemyLabel: {
    ...workoutType.caption,
    color: workoutColors.ash,
    letterSpacing: 3,
  },
  silhouette: {
    width: SILHOUETTE_SIZE,
    height: SILHOUETTE_SIZE,
    borderRadius: SILHOUETTE_SIZE / 2,
    backgroundColor: workoutColors.surface,
    borderWidth: 1,
    borderColor: workoutColors.ash,
    alignItems: 'center',
    justifyContent: 'center',
  },
  silhouetteGlyph: {
    fontSize: 64,
    color: workoutColors.ash,
  },
  battleProgress: {
    ...workoutType.caption,
    color: workoutColors.textMuted,
  },
  entryBlock: {
    backgroundColor: workoutColors.surface,
    borderRadius: workoutRadii.lg,
    padding: workoutSpacing.lg,
    gap: workoutSpacing.md,
    borderWidth: 1,
    borderColor: workoutColors.border,
  },
  exerciseName: {
    ...workoutType.heading,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepperLabel: { ...workoutType.label },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: workoutSpacing.md,
  },
  stepperButton: {
    width: 44,
    height: 44,
    borderRadius: workoutRadii.pill,
    backgroundColor: workoutColors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: workoutColors.border,
  },
  stepperButtonText: {
    fontSize: 22,
    color: workoutColors.textPrimary,
    fontWeight: '500',
  },
  stepperValue: {
    ...workoutType.heading,
    minWidth: 60,
    textAlign: 'center',
  },
  attackButton: {
    backgroundColor: workoutColors.ember,
    borderRadius: workoutRadii.md,
    paddingVertical: workoutSpacing.lg,
    alignItems: 'center',
    marginTop: workoutSpacing.md,
  },
  attackText: {
    fontSize: 17,
    fontWeight: '600',
    color: workoutColors.background,
  },
  logBlock: { gap: 2 },
  logLabel: {
    ...workoutType.caption,
    letterSpacing: 2,
    color: workoutColors.textMuted,
  },
  logRow: { ...workoutType.caption },
  footer: {
    ...workoutType.caption,
    textAlign: 'center',
    marginTop: 'auto',
  },
  pressed: { opacity: 0.85 },
});
