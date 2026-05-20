/**
 * Home — the Camp. Pre-Quest entry point.
 *
 * Tone target (012 §1): grounded, mythic, warm. No streak counter,
 * no calendar, no urgency. One CTA: *Start Quest*.
 */

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useWorkoutGameStore } from '../state/workoutGameStore';
import { workoutColors, workoutRadii, workoutSpacing, workoutType } from '../theme/workoutColors';

export function HomeScreen(): JSX.Element {
  const startQuest = useWorkoutGameStore((s) => s.startQuest);
  const modality = useWorkoutGameStore((s) => s.modality);
  const priorMomentum = useWorkoutGameStore((s) => s.priorMomentum);
  const persistenceError = useWorkoutGameStore((s) => s.persistenceError);
  const persistenceDisabled = useWorkoutGameStore((s) => s.persistenceDisabled);

  // Dev-only diagnostic: in development builds, surface the
  // persistence failure as a small muted banner so we don't lose
  // the signal to console.warn alone. Production builds never see
  // this — `__DEV__` is false in release.
  const showDiag = __DEV__ && persistenceDisabled && persistenceError !== null;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>The Hollow</Text>
        <Text style={styles.subtitle}>Steady. The Ember glows.</Text>

        {showDiag && (
          <View
            accessibilityRole="text"
            accessibilityLabel={`Persistence disabled: ${persistenceError}`}
            style={styles.diag}
          >
            <Text style={styles.diagLabel}>PERSISTENCE DISABLED</Text>
            <Text style={styles.diagMessage} numberOfLines={3}>
              {persistenceError}
            </Text>
            <Text style={styles.diagHint}>
              Memory-only mode. Set memory + momentum will not survive a
              restart.
            </Text>
          </View>
        )}

        <View style={styles.emberRow}>
          <View style={styles.emberBarTrack}>
            <View style={[styles.emberBarFill, { width: `${priorMomentum}%` }]} />
          </View>
        </View>

        <View style={styles.questCard}>
          <Text style={styles.questLabel}>Quest</Text>
          <Text style={styles.questName}>Push Day</Text>
          <Text style={styles.questDesc}>
            Sluggard, Lord of Couches has settled in the room.
          </Text>
        </View>

        <View style={styles.variantRow}>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.variantButton,
              modality === 'bodyweight' && styles.variantButtonActive,
              pressed && styles.pressed,
            ]}
            onPress={() => startQuest('bodyweight')}
          >
            <Text style={styles.variantText}>Begin · Bodyweight</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.variantButton,
              modality === 'weighted' && styles.variantButtonActive,
              pressed && styles.pressed,
            ]}
            onPress={() => startQuest('weighted')}
          >
            <Text style={styles.variantText}>Begin · Weighted</Text>
          </Pressable>
        </View>

        <Text style={styles.vow}>The Vow holds.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: workoutColors.background },
  scroll: {
    padding: workoutSpacing.lg,
    gap: workoutSpacing.lg,
    flexGrow: 1,
    justifyContent: 'center',
  },
  title: { ...workoutType.title, textAlign: 'center' },
  subtitle: { ...workoutType.label, textAlign: 'center' },
  emberRow: { alignItems: 'center', marginVertical: workoutSpacing.md },
  emberBarTrack: {
    width: '80%',
    height: 10,
    borderRadius: workoutRadii.pill,
    backgroundColor: workoutColors.surface,
    overflow: 'hidden',
  },
  emberBarFill: {
    height: '100%',
    backgroundColor: workoutColors.ember,
  },
  questCard: {
    backgroundColor: workoutColors.surface,
    borderRadius: workoutRadii.lg,
    padding: workoutSpacing.lg,
    gap: workoutSpacing.xs,
    borderWidth: 1,
    borderColor: workoutColors.border,
  },
  questLabel: { ...workoutType.caption, letterSpacing: 2 },
  questName: { ...workoutType.heading },
  questDesc: { ...workoutType.body, color: workoutColors.textSecondary },
  variantRow: { gap: workoutSpacing.sm },
  variantButton: {
    backgroundColor: workoutColors.surfaceElevated,
    borderRadius: workoutRadii.md,
    padding: workoutSpacing.lg,
    borderWidth: 1,
    borderColor: workoutColors.border,
    alignItems: 'center',
  },
  variantButtonActive: {
    borderColor: workoutColors.ember,
  },
  variantText: { ...workoutType.body, color: workoutColors.textPrimary },
  vow: { ...workoutType.caption, textAlign: 'center', marginTop: workoutSpacing.lg },
  pressed: { opacity: 0.7 },
  // Dev-only persistence-disabled diagnostic. Muted so it never
  // becomes shame-coded; functional, not alarmist.
  diag: {
    backgroundColor: workoutColors.surfaceElevated,
    borderRadius: workoutRadii.md,
    padding: workoutSpacing.md,
    borderWidth: 1,
    borderColor: workoutColors.border,
    gap: workoutSpacing.xs,
  },
  diagLabel: {
    ...workoutType.caption,
    color: workoutColors.textMuted,
    letterSpacing: 2,
  },
  diagMessage: {
    ...workoutType.caption,
    color: workoutColors.textSecondary,
  },
  diagHint: {
    ...workoutType.caption,
    color: workoutColors.textMuted,
    fontStyle: 'italic',
  },
});
