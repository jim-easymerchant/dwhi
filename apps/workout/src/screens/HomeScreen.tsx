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
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { resolveMomentumTier } from '@dwhi/workout-domain';

import {
  EchoLogPanel,
  PatronsPanel,
  QuestSelectionPanel,
  TavernFooterActions,
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
import { getAmbientSceneFlavor, getTheme } from '../theme';
import { generateNightlyWorld } from '../world';
import { findTemplate, listAllTemplates } from '../workouts';
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
  const openWorkouts = useWorkoutGameStore((s) => s.openWorkouts);
  const selectedTemplateId = useWorkoutGameStore((s) => s.selectedTemplateId);
  const weightUnit = useWorkoutGameStore((s) => s.weightUnit);
  const cumulativeXp = useWorkoutGameStore((s) => s.cumulativeXp);

  // Dev-only diagnostic: surface persistence failures as a small
  // muted banner. Production builds never see this — __DEV__ is
  // false in release.
  const showDiag = __DEV__ && persistenceDisabled && persistenceError !== null;

  const tier = resolveMomentumTier(priorMomentum);
  const theme = getTheme(selectedThemeId);
  const sceneFlavor = getAmbientSceneFlavor(selectedThemeId, tier);
  const daysSince = computeDaysSinceLastQuest(lastSessionAtIso);

  // Generate the nightly world once per render. The generator is
  // deterministic — same input gives the same output — so memoising
  // is fine; the only reason to recompute is when the player's
  // theme / tier / days-since changes.
  const world = React.useMemo(
    () =>
      generateNightlyWorld({
        themeId: selectedThemeId,
        tier,
        daysSinceLastQuest: daysSince,
      }),
    [selectedThemeId, tier, daysSince],
  );

  // The scene-frame flavour line gets the world's weather (varies
  // daily) glued to the static theme/tier flavor.
  const sceneFlavorLine = `${sceneFlavor} ${world.weatherLine}`.trim();

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

  // The selected workout template — currently only used for
  // labelling the "active workout" hint. The orchestrator
  // encounter is still the Push Day fixture in v1; the next
  // branch will route the template into `runQuest` directly.
  const selectedTemplate = findTemplate(selectedTemplateId);
  const totalTemplates = listAllTemplates().length;

  return (
    // edges="bottom" so the SafeAreaView does NOT inset the top —
    // the tavern scene reaches behind the status bar for a true
    // edge-to-edge dominant header.
    <SafeAreaView edges={['bottom']} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <TavernSceneFrame
          testID="home-scene-frame"
          tier={tier}
          overlayColor={theme.paletteOverrides?.hearth}
          flavorLine={sceneFlavorLine}
          signText={
            theme.id === 'ironquest-classic'
              ? theme.headerCopy.title
              : undefined
          }
          signSubtitle={
            theme.id === 'ironquest-classic'
              ? theme.headerCopy.subtitle
              : undefined
          }
          signColor={theme.uiAccent.primary}
          onOpenSettings={openSettings}
        />

        <TavernStatusRow
          testID="home-status-row"
          cumulativeXp={cumulativeXp}
          daysSinceLastQuest={daysSince}
          bodyweightKg={bodyweightKg}
          weightUnit={weightUnit}
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

        {/* Single character / presence block. Device-QA
            feedback (024) collapsed the previous two-panel
            layout into one — the heading is theme-driven via
            `worldState.patronSectionLabel`. */}
        <PatronsPanel
          testID="home-patrons-panel"
          sectionLabel={world.patronSectionLabel}
          patrons={world.patrons}
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

        {/* Workouts panel — surfaces the active template + a
            Manage button. The library screen lets the player
            pick a different template or import a new one. The
            orchestrator's encounter mapping is still the Push
            Day fixture in v1 — documented limitation. */}
        <View testID="home-workouts-panel" style={styles.workoutsPanel}>
          <View style={styles.workoutsHeader}>
            <View style={styles.workoutsHeaderText}>
              <Text style={styles.workoutsLabel}>ACTIVE WORKOUT</Text>
              <Text testID="home-workouts-active" style={styles.workoutsName}>
                {selectedTemplate?.name ?? 'Push Day'}
              </Text>
              <Text style={styles.workoutsHint}>
                {totalTemplates} in your library · tap Manage to add more.
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Manage workouts"
              testID="home-open-workouts"
              onPress={openWorkouts}
              style={({ pressed }) => [
                styles.workoutsManage,
                { borderColor: theme.uiAccent.primary },
                pressed && styles.pressedSoft,
              ]}
            >
              <Text style={styles.workoutsManageText}>Manage</Text>
            </Pressable>
          </View>
        </View>

        {world.activityHint.length > 0 ? (
          <Text testID="home-activity-hint" style={styles.activityHint}>
            {world.activityHint}
          </Text>
        ) : null}

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
    // No top padding — the tavern scene reaches the top of the
    // screen for the dominant header feel. Horizontal padding
    // is what the scene's negative margin cancels.
    paddingTop: 0,
    paddingHorizontal: workoutSpacing.lg,
    paddingBottom: workoutSpacing.lg,
    gap: workoutSpacing.md,
    flexGrow: 1,
  },
  panels: {
    gap: workoutSpacing.sm,
  },
  activityHint: {
    ...workoutType.caption,
    color: workoutColors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  workoutsPanel: {
    backgroundColor: workoutColors.surface,
    borderRadius: workoutRadii.md,
    borderWidth: 1,
    borderColor: workoutColors.border,
    padding: workoutSpacing.md,
  },
  workoutsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: workoutSpacing.md,
  },
  workoutsHeaderText: { flex: 1, gap: 2 },
  workoutsLabel: {
    ...workoutType.caption,
    letterSpacing: 2,
    color: workoutColors.textMuted,
  },
  workoutsName: { ...workoutType.heading, fontSize: 18 },
  workoutsHint: {
    ...workoutType.caption,
    color: workoutColors.textSecondary,
  },
  workoutsManage: {
    paddingHorizontal: workoutSpacing.md,
    paddingVertical: workoutSpacing.sm,
    borderRadius: workoutRadii.sm,
    borderWidth: 1,
  },
  workoutsManageText: { ...workoutType.body, color: workoutColors.textPrimary },
  pressedSoft: { opacity: 0.75 },
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
