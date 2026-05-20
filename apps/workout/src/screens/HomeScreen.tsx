/**
 * Home — the Camp / Tavern. Pre-Quest entry point.
 *
 * Composition shell: this screen does NOT contain UI primitives. It
 * resolves the active theme + Momentum tier, pulls flavour copy
 * from `ThemePack`, and lays out the eight tavern components in a
 * single scroll view.
 *
 * Tone target (012 §1): grounded, mythic, warm. Same anti-shame
 * rules regardless of theme.
 *
 * See: docs/workout-rpg/019-tavern-home-layout.md
 */

import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { resolveMomentumTier } from '@dwhi/workout-domain';

import {
  AmbientPanel,
  EchoLogPanel,
  QuestSelectionPanel,
  TavernFooterActions,
  TavernHeader,
  TavernSceneFrame,
  TavernStatusRow,
} from '../components/tavern';
import {
  PUSH_BODYWEIGHT_STRATEGIES,
  PUSH_WEIGHTED_VARIANTS,
  SLUGGARD,
} from '../fixtures/pushDayQuest';
import {
  computeDaysSinceLastQuest,
  useWorkoutGameStore,
} from '../state/workoutGameStore';
import {
  getAmbientLines,
  getAmbientSceneFlavor,
  getTheme,
} from '../theme';
import {
  workoutColors,
  workoutRadii,
  workoutSpacing,
  workoutType,
} from '../theme/workoutColors';

export function HomeScreen(): JSX.Element {
  const startQuest = useWorkoutGameStore((s) => s.startQuest);
  const modality = useWorkoutGameStore((s) => s.modality);
  const priorMomentum = useWorkoutGameStore((s) => s.priorMomentum);
  const bodyweightKg = useWorkoutGameStore((s) => s.bodyweightKg);
  const lastSessionAtIso = useWorkoutGameStore((s) => s.lastSessionAtIso);
  const defeatedEnemies = useWorkoutGameStore((s) => s.defeatedEnemies);
  const persistenceError = useWorkoutGameStore((s) => s.persistenceError);
  const persistenceDisabled = useWorkoutGameStore((s) => s.persistenceDisabled);
  const selectedThemeId = useWorkoutGameStore((s) => s.selectedThemeId);
  const openSettings = useWorkoutGameStore((s) => s.openSettings);

  // Dev-only diagnostic: surface persistence failures as a small
  // muted banner. Production builds never see this — __DEV__ is
  // false in release.
  const showDiag = __DEV__ && persistenceDisabled && persistenceError !== null;

  const tier = resolveMomentumTier(priorMomentum);
  const theme = getTheme(selectedThemeId);
  const ambientLines = getAmbientLines(selectedThemeId, tier);
  const sceneFlavor = getAmbientSceneFlavor(selectedThemeId, tier);
  const daysSince = computeDaysSinceLastQuest(lastSessionAtIso);

  // Exercise previews — read from the static encounter fixtures.
  // The home screen never starts a Quest with these names; it only
  // shows them as a preview so the player knows what they're
  // signing up for.
  const bodyweightNames = React.useMemo(
    () => PUSH_BODYWEIGHT_STRATEGIES.map((v) => v.name),
    [],
  );
  const weightedNames = React.useMemo(
    () => PUSH_WEIGHTED_VARIANTS.map((v) => v.name),
    [],
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <TavernHeader
          testID="home-header"
          title={theme.headerCopy.title}
          subtitle={theme.headerCopy.subtitle}
          onOpenSettings={openSettings}
        />

        <TavernSceneFrame
          testID="home-scene-frame"
          tier={tier}
          overlayColor={theme.paletteOverrides?.hearth}
          flavorLine={sceneFlavor}
        />

        <TavernStatusRow
          testID="home-status-row"
          momentum={priorMomentum}
          daysSinceLastQuest={daysSince}
          bodyweightKg={bodyweightKg}
          accentColor={theme.uiAccent.primary}
        />

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

        <AmbientPanel
          testID="home-ambient-panel"
          sectionLabel={theme.ambient.sectionLabel}
          lines={ambientLines}
        />

        <QuestSelectionPanel
          testID="home-quest-panel"
          sectionLabel={theme.questCard.sectionLabel}
          threatLine={theme.questCard.threatLine(SLUGGARD.name)}
          bodyweightActionLabel={theme.questCard.bodyweightLabel}
          weightedActionLabel={theme.questCard.weightedLabel}
          bodyweightExercises={bodyweightNames}
          weightedExercises={weightedNames}
          activeModality={modality}
          accentColor={theme.uiAccent.primary}
          onSelectBodyweight={() => startQuest('bodyweight')}
          onSelectWeighted={() => startQuest('weighted')}
        />

        <View style={styles.panels}>
          <EchoLogPanel
            testID="home-echo-log"
            label={theme.panelLabels.echoLog}
            count={defeatedEnemies.length}
            emptyHint={theme.panelLabels.emptyHint}
          />
          <EchoLogPanel
            testID="home-weight-log"
            label={theme.panelLabels.weightLog}
            count={0}
            emptyHint={theme.panelLabels.emptyHint}
          />
          <EchoLogPanel
            testID="home-session-history"
            label={theme.panelLabels.sessionHistory}
            count={0}
            emptyHint={theme.panelLabels.emptyHint}
          />
        </View>

        <TavernFooterActions
          testID="home-footer"
          reassurance={theme.footer.reassurance}
          momentum={priorMomentum}
          emberColor={theme.uiAccent.primary}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: workoutColors.background },
  scroll: {
    padding: workoutSpacing.lg,
    gap: workoutSpacing.md,
    flexGrow: 1,
  },
  panels: {
    gap: workoutSpacing.sm,
  },
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
