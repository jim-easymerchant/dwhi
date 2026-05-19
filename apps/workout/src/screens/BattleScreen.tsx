/**
 * Battle — the open-ended encounter screen.
 *
 * Tone target: docs/workout-rpg/012-battle-ux-and-feel.md §7 +
 *               docs/workout-rpg/014-open-ended-encounters-and-set-memory.md.
 *
 * Differences from the original MVP shell:
 *
 *   - No auto-advance after N sets. The current variant stays
 *     active; the player switches by tapping a chooser button.
 *   - Visible HP bar with `current / max` and a "last hit" line.
 *   - Strategy / Equipment chooser horizontally below the entry.
 *   - On enemy defeat: "Continue Sets" or "Finish Encounter."
 *   - "Finish Quest" is always available once a set has been logged.
 */

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getAvailableVariants,
  getBattleProgress,
  getCurrentVariant,
  useWorkoutGameStore,
} from '../state/workoutGameStore';
import {
  workoutColors,
  workoutRadii,
  workoutSpacing,
  workoutType,
} from '../theme/workoutColors';
import { RestScreen } from './RestScreen';

export function BattleScreen(): JSX.Element {
  const phase = useWorkoutGameStore((s) => s.phase);
  const modality = useWorkoutGameStore((s) => s.modality);
  const currentVariantId = useWorkoutGameStore((s) => s.currentVariantId);
  const setIndexInVariant = useWorkoutGameStore((s) => s.currentSetIndexInVariant);
  const draftReps = useWorkoutGameStore((s) => s.draftReps);
  const draftWeightKg = useWorkoutGameStore((s) => s.draftWeightKg);
  const setReps = useWorkoutGameStore((s) => s.setReps);
  const setWeight = useWorkoutGameStore((s) => s.setWeight);
  const logCurrentSet = useWorkoutGameStore((s) => s.logCurrentSet);
  const enterRest = useWorkoutGameStore((s) => s.enterRest);
  const switchVariant = useWorkoutGameStore((s) => s.switchVariant);
  const continueAfterVictory = useWorkoutGameStore((s) => s.continueAfterVictory);
  const finishEncounter = useWorkoutGameStore((s) => s.finishEncounter);
  const finishQuest = useWorkoutGameStore((s) => s.finishQuest);
  const log = useWorkoutGameStore((s) => s.log);
  const currentEnemy = useWorkoutGameStore((s) => s.currentEnemy);
  const currentEnemyHp = useWorkoutGameStore((s) => s.currentEnemyHp);
  const lastSetDamage = useWorkoutGameStore((s) => s.lastSetDamage);
  const victoryAvailable = useWorkoutGameStore((s) => s.victoryAvailable);
  const enemyPhaseIndex = useWorkoutGameStore((s) => s.enemyPhaseIndex);

  if (phase === 'rest') {
    return <RestScreen />;
  }

  const state = useWorkoutGameStore.getState();
  const variant = getCurrentVariant(state);
  const variants = getAvailableVariants(state);
  const useWeighted = modality === 'weighted';
  const progress = getBattleProgress(state);
  const progressPct = Math.round(progress * 100);

  const onAttack = (): void => {
    if (draftReps <= 0) return;
    logCurrentSet();
    enterRest();
  };

  const canFinish = log.length > 0;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Enemy + HP */}
        <View style={styles.enemyBlock}>
          <Text style={styles.enemyLabel}>{currentEnemy.name.toUpperCase()}</Text>
          <View
            style={[
              styles.silhouette,
              victoryAvailable && styles.silhouetteThinned,
            ]}
          >
            <Text
              style={[
                styles.silhouetteGlyph,
                victoryAvailable && styles.silhouetteGlyphThinned,
              ]}
            >
              ◆
            </Text>
          </View>

          <View style={styles.hpBarTrack}>
            <View
              style={[
                styles.hpBarFill,
                { width: `${Math.max(0, Math.min(100, progressPct))}%` },
              ]}
            />
          </View>
          <Text style={styles.hpText}>
            {Math.round(currentEnemyHp)} / {currentEnemy.maxHp}  ·  {progressPct}%
          </Text>

          {lastSetDamage !== null && lastSetDamage > 0 && (
            <Text style={styles.lastDamage}>
              {currentEnemy.name.split(',')[0]} thinned by {Math.round(lastSetDamage)}
            </Text>
          )}
          {enemyPhaseIndex > 0 && (
            <Text style={styles.phaseHint}>
              Another fragment formed in the quiet.
            </Text>
          )}
        </View>

        {/* Victory CTAs */}
        {victoryAvailable && (
          <View style={styles.victoryBlock}>
            <Text style={styles.victoryHeading}>Victory available.</Text>
            <Text style={styles.victoryFlavor}>The {currentEnemy.name.split(',')[0]} thins.</Text>
            <View style={styles.victoryButtons}>
              <Pressable
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && styles.pressed,
                ]}
                onPress={continueAfterVictory}
              >
                <Text style={styles.secondaryText}>Continue Sets</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
                onPress={finishEncounter}
              >
                <Text style={styles.primaryText}>Finish Encounter</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Set entry */}
        {!victoryAvailable && (
          <View style={styles.entryBlock}>
            <Text style={styles.exerciseName}>{variant.name}</Text>
            <Text style={styles.setCaption}>
              Set {setIndexInVariant + 1} · this variant
            </Text>

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
              style={({ pressed }) => [styles.attackButton, pressed && styles.pressed]}
              onPress={onAttack}
            >
              <Text style={styles.attackText}>Attack</Text>
            </Pressable>
          </View>
        )}

        {/* Variant chooser */}
        <View style={styles.chooserBlock}>
          <Text style={styles.chooserLabel}>
            {useWeighted ? 'Change Plates / Switch Equipment' : 'Switch Strategy'}
          </Text>
          <View style={styles.chooserRow}>
            {variants.map((v) => {
              const active = v.id === currentVariantId;
              return (
                <Pressable
                  key={v.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={({ pressed }) => [
                    styles.chooserChip,
                    active && styles.chooserChipActive,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => switchVariant(v.id)}
                >
                  <Text
                    style={[
                      styles.chooserChipText,
                      active && styles.chooserChipTextActive,
                    ]}
                  >
                    {v.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Finish Quest */}
        {canFinish && (
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.finishQuestButton, pressed && styles.pressed]}
            onPress={finishQuest}
          >
            <Text style={styles.finishQuestText}>Finish Quest</Text>
          </Pressable>
        )}

        {/* Log (most-recent highlighted) */}
        {log.length > 0 && (
          <View style={styles.logBlock}>
            <Text style={styles.logLabel}>LOG</Text>
            {log
              .slice()
              .reverse()
              .map((row, i) => {
                const isLatest = i === 0;
                return (
                  <View
                    key={`${row.exerciseId}-${row.setIndexInQuest}`}
                    style={[styles.logRow, isLatest && styles.logRowLatest]}
                  >
                    <Text style={[styles.logRowText, isLatest && styles.logRowTextLatest]}>
                      {row.exerciseName} · {row.reps}
                      {row.weightKg ? ` × ${row.weightKg}kg` : ' reps'}
                      {row.isPersonalRecord ? '  ✦' : ''}
                      {row.finisher ? '  ◇' : ''}
                      {`  —  ${Math.round(row.damage)} dmg`}
                    </Text>
                  </View>
                );
              })}
          </View>
        )}

        <Text style={styles.footer}>The Ember holds.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const SILHOUETTE_SIZE = 140;

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
  silhouetteThinned: {
    borderColor: workoutColors.emberDim,
    opacity: 0.6,
  },
  silhouetteGlyph: {
    fontSize: 56,
    color: workoutColors.ash,
  },
  silhouetteGlyphThinned: {
    color: workoutColors.emberDim,
  },
  hpBarTrack: {
    width: '80%',
    height: 10,
    borderRadius: workoutRadii.pill,
    backgroundColor: workoutColors.surface,
    overflow: 'hidden',
    marginTop: workoutSpacing.sm,
  },
  hpBarFill: {
    height: '100%',
    backgroundColor: workoutColors.ember,
  },
  hpText: { ...workoutType.caption, color: workoutColors.textSecondary },
  lastDamage: {
    ...workoutType.body,
    color: workoutColors.ember,
    marginTop: workoutSpacing.xs,
  },
  phaseHint: {
    ...workoutType.caption,
    color: workoutColors.textMuted,
    fontStyle: 'italic',
  },

  victoryBlock: {
    backgroundColor: workoutColors.surface,
    borderRadius: workoutRadii.lg,
    padding: workoutSpacing.lg,
    gap: workoutSpacing.sm,
    borderWidth: 1,
    borderColor: workoutColors.ember,
    alignItems: 'center',
  },
  victoryHeading: {
    ...workoutType.heading,
    color: workoutColors.ember,
  },
  victoryFlavor: {
    ...workoutType.body,
    color: workoutColors.textSecondary,
    fontStyle: 'italic',
  },
  victoryButtons: {
    flexDirection: 'row',
    gap: workoutSpacing.md,
    marginTop: workoutSpacing.sm,
  },

  entryBlock: {
    backgroundColor: workoutColors.surface,
    borderRadius: workoutRadii.lg,
    padding: workoutSpacing.lg,
    gap: workoutSpacing.md,
    borderWidth: 1,
    borderColor: workoutColors.border,
  },
  exerciseName: { ...workoutType.heading },
  setCaption: { ...workoutType.caption, color: workoutColors.textMuted },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepperLabel: { ...workoutType.label },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: workoutSpacing.md },
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
  stepperButtonText: { fontSize: 22, color: workoutColors.textPrimary, fontWeight: '500' },
  stepperValue: { ...workoutType.heading, minWidth: 60, textAlign: 'center' },

  attackButton: {
    backgroundColor: workoutColors.ember,
    borderRadius: workoutRadii.md,
    paddingVertical: workoutSpacing.lg,
    alignItems: 'center',
    marginTop: workoutSpacing.md,
  },
  attackText: { fontSize: 17, fontWeight: '600', color: workoutColors.background },

  primaryButton: {
    backgroundColor: workoutColors.ember,
    borderRadius: workoutRadii.md,
    paddingVertical: workoutSpacing.md,
    paddingHorizontal: workoutSpacing.lg,
    alignItems: 'center',
  },
  primaryText: { fontSize: 15, fontWeight: '600', color: workoutColors.background },
  secondaryButton: {
    backgroundColor: workoutColors.surfaceElevated,
    borderRadius: workoutRadii.md,
    paddingVertical: workoutSpacing.md,
    paddingHorizontal: workoutSpacing.lg,
    borderWidth: 1,
    borderColor: workoutColors.border,
    alignItems: 'center',
  },
  secondaryText: { ...workoutType.body, color: workoutColors.textPrimary },

  chooserBlock: { gap: workoutSpacing.sm },
  chooserLabel: {
    ...workoutType.caption,
    color: workoutColors.textMuted,
    letterSpacing: 2,
  },
  chooserRow: { flexDirection: 'row', flexWrap: 'wrap', gap: workoutSpacing.sm },
  chooserChip: {
    paddingVertical: workoutSpacing.sm,
    paddingHorizontal: workoutSpacing.md,
    borderRadius: workoutRadii.pill,
    backgroundColor: workoutColors.surface,
    borderWidth: 1,
    borderColor: workoutColors.border,
  },
  chooserChipActive: {
    borderColor: workoutColors.ember,
    backgroundColor: workoutColors.surfaceElevated,
  },
  chooserChipText: { ...workoutType.caption, color: workoutColors.textSecondary },
  chooserChipTextActive: { color: workoutColors.ember },

  finishQuestButton: {
    borderRadius: workoutRadii.md,
    paddingVertical: workoutSpacing.md,
    borderWidth: 1,
    borderColor: workoutColors.border,
    alignItems: 'center',
  },
  finishQuestText: { ...workoutType.body, color: workoutColors.textSecondary },

  logBlock: { gap: workoutSpacing.xs, marginTop: workoutSpacing.sm },
  logLabel: {
    ...workoutType.caption,
    letterSpacing: 2,
    color: workoutColors.textMuted,
  },
  logRow: {
    paddingVertical: workoutSpacing.xs,
    paddingHorizontal: workoutSpacing.sm,
    borderRadius: workoutRadii.sm,
  },
  logRowLatest: {
    backgroundColor: workoutColors.surface,
    borderWidth: 1,
    borderColor: workoutColors.emberDim,
  },
  logRowText: { ...workoutType.caption, color: workoutColors.textSecondary },
  logRowTextLatest: { color: workoutColors.ember, fontWeight: '500' },

  footer: { ...workoutType.caption, textAlign: 'center', marginTop: 'auto' },
  pressed: { opacity: 0.85 },
});
