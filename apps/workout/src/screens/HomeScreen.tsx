/**
 * Home — the Camp. Pre-Quest entry point.
 *
 * Tone target (012 §1): grounded, mythic, warm. No streak counter,
 * no calendar, no urgency. One CTA: *Start Quest*.
 */

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { resolveMomentumTier } from '@dwhi/workout-domain';

import { CampScene } from '../render';
import { useWorkoutGameStore } from '../state/workoutGameStore';
import { getTheme } from '../theme';
import { workoutColors, workoutRadii, workoutSpacing, workoutType } from '../theme/workoutColors';

export function HomeScreen(): JSX.Element {
  const startQuest = useWorkoutGameStore((s) => s.startQuest);
  const modality = useWorkoutGameStore((s) => s.modality);
  const priorMomentum = useWorkoutGameStore((s) => s.priorMomentum);
  const persistenceError = useWorkoutGameStore((s) => s.persistenceError);
  const persistenceDisabled = useWorkoutGameStore((s) => s.persistenceDisabled);
  const selectedThemeId = useWorkoutGameStore((s) => s.selectedThemeId);
  const openSettings = useWorkoutGameStore((s) => s.openSettings);

  // Dev-only diagnostic: in development builds, surface the
  // persistence failure as a small muted banner so we don't lose
  // the signal to console.warn alone. Production builds never see
  // this — `__DEV__` is false in release.
  const showDiag = __DEV__ && persistenceDisabled && persistenceError !== null;

  // Mood lighting in the Camp scene tracks the player's Momentum
  // tier — Rusted dims the room, Ascendant lights the hearth.
  const tier = resolveMomentumTier(priorMomentum);

  // The active theme drives copy + accent colour on this screen.
  const theme = getTheme(selectedThemeId);
  const enemyIntro = theme.enemyFlavor.introCopy('Sluggard, Lord of Couches');

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.topBar}>
          <View style={styles.topBarSpacer} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open settings"
            testID="home-open-settings"
            style={({ pressed }) => [styles.settingsBtn, pressed && styles.pressed]}
            onPress={openSettings}
          >
            <Text style={styles.settingsBtnText}>⚙</Text>
          </Pressable>
        </View>

        <Text style={styles.title}>The Hollow</Text>
        <Text style={styles.subtitle}>{theme.motivational.tagline}</Text>

        <View style={styles.campWrap}>
          <CampScene
            tier={tier}
            overlayColor={theme.paletteOverrides?.hearth}
            testID="home-camp-scene"
          />
        </View>

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
          <Text style={styles.questDesc}>{enemyIntro}</Text>
        </View>

        <View style={styles.variantRow}>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.variantButton,
              modality === 'bodyweight' && [
                styles.variantButtonActive,
                { borderColor: theme.uiAccent.primary },
              ],
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
              modality === 'weighted' && [
                styles.variantButtonActive,
                { borderColor: theme.uiAccent.primary },
              ],
              pressed && styles.pressed,
            ]}
            onPress={() => startQuest('weighted')}
          >
            <Text style={styles.variantText}>Begin · Weighted</Text>
          </Pressable>
        </View>

        <Text style={styles.vow}>
          {theme.tone === 'arcade-tavern' ? 'STEEL THE NERVE.' : 'The Vow holds.'}
        </Text>
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
  campWrap: { alignItems: 'center', marginTop: workoutSpacing.md },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topBarSpacer: { flex: 1 },
  settingsBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: workoutColors.surface,
    borderWidth: 1,
    borderColor: workoutColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsBtnText: {
    fontSize: 18,
    color: workoutColors.textSecondary,
  },
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
