/**
 * Settings — theme selection + diagnostics.
 *
 * No React Navigation involved; the panel renders when the
 * store's `phase === 'settings'` (set by HomeScreen's settings
 * tap) and exits via `returnToCamp()`.
 *
 * Sections shown:
 *
 *   1. Theme selection      — ThemeCard list, every registered theme
 *   2. Theme descriptions   — embedded in each card
 *   3. Preview card         — a small CampScene at the selected theme's
 *                             default tier
 *   4. Persistence status   — ready / disabled / error
 *   5. Version / build info — read from app.json + Constants
 *   6. Placeholder sections — voice packs / accessibility / haptics /
 *                             audio (post-MVP)
 */

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemeCard } from '../components/ThemeCard';
import { CampScene } from '../render';
import { listThemes, safeThemeId, type ThemePack } from '../theme';
import {
  workoutColors,
  workoutRadii,
  workoutSpacing,
  workoutType,
} from '../theme/workoutColors';
import { useWorkoutGameStore } from '../state/workoutGameStore';

export function SettingsScreen(): JSX.Element {
  const selectedThemeId = useWorkoutGameStore((s) => s.selectedThemeId);
  const setTheme = useWorkoutGameStore((s) => s.setTheme);
  const returnToCamp = useWorkoutGameStore((s) => s.returnToCamp);
  const persistenceReady = useWorkoutGameStore((s) => s.persistenceReady);
  const persistenceDisabled = useWorkoutGameStore((s) => s.persistenceDisabled);
  const persistenceError = useWorkoutGameStore((s) => s.persistenceError);

  const themes = listThemes();
  const safe = safeThemeId(selectedThemeId);
  const preview: ThemePack | undefined = themes.find((t) => t.id === safe);

  const buildInfo = readBuildInfo();

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Settings</Text>

        {/* ---- Theme selection ------------------------------------- */}
        <Section label="Theme">
          <Text style={styles.body}>
            Themes change how Momentum looks and speaks — not how it counts your work.
          </Text>
          <View style={styles.themeList}>
            {themes.map((theme) => (
              <ThemeCard
                key={theme.id}
                theme={theme}
                selected={theme.id === safe}
                onSelect={setTheme}
              />
            ))}
          </View>
        </Section>

        {/* ---- Preview --------------------------------------------- */}
        {preview && (
          <Section label="Preview">
            <View style={styles.previewWrap}>
              <CampScene tier="driven" scale={0.7} paused testID="settings-camp-preview" />
            </View>
            <Text style={styles.previewLabel}>
              {preview.displayName} · {preview.defaultCampStyle}
            </Text>
          </Section>
        )}

        {/* ---- Persistence status ---------------------------------- */}
        <Section label="Persistence">
          <Row label="Status" value={persistenceStatusLabel(persistenceReady, persistenceDisabled)} />
          {persistenceError && (
            <Row label="Reason" value={persistenceError} multiline />
          )}
          <Text style={styles.smallNote}>
            Themes work in memory-only mode. The selection just won't survive a restart.
          </Text>
        </Section>

        {/* ---- Version / build info -------------------------------- */}
        <Section label="Build">
          <Row label="App" value={buildInfo.name} />
          <Row label="Version" value={buildInfo.version} />
          <Row label="Channel" value={buildInfo.channel} />
        </Section>

        {/* ---- Placeholder future sections ------------------------- */}
        <Section label="Coming later">
          <PlaceholderLine label="Voice packs" />
          <PlaceholderLine label="Accessibility" />
          <PlaceholderLine label="Haptics" />
          <PlaceholderLine label="Audio" />
        </Section>

        {/* ---- Exit ------------------------------------------------ */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Return to Camp"
          testID="settings-return"
          style={({ pressed }) => [styles.returnButton, pressed && styles.pressed]}
          onPress={returnToCamp}
        >
          <Text style={styles.returnButtonText}>Return to Camp</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label.toUpperCase()}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Row({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}): JSX.Element {
  return (
    <View style={[styles.row, multiline && styles.rowMultiline]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text
        style={[styles.rowValue, multiline && styles.rowValueMultiline]}
        numberOfLines={multiline ? 4 : 1}
      >
        {value}
      </Text>
    </View>
  );
}

function PlaceholderLine({ label }: { label: string }): JSX.Element {
  return (
    <View style={styles.placeholderRow}>
      <Text style={styles.placeholderText}>{label}</Text>
      <Text style={styles.placeholderHint}>soon</Text>
    </View>
  );
}

function persistenceStatusLabel(
  ready: boolean,
  disabled: boolean,
): string {
  if (!ready) return 'loading…';
  if (disabled) return 'disabled — memory-only';
  return 'active';
}

interface BuildInfo {
  name: string;
  version: string;
  channel: string;
}

function readBuildInfo(): BuildInfo {
  const cfg = Constants.expoConfig ?? Constants.manifest2 ?? Constants.manifest ?? null;
  const name = (cfg && (cfg as { name?: string }).name) ?? 'Momentum';
  const version = (cfg && (cfg as { version?: string }).version) ?? 'dev';
  return { name, version, channel: __DEV__ ? 'dev' : 'release' };
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: workoutColors.background },
  scroll: {
    padding: workoutSpacing.lg,
    gap: workoutSpacing.xl,
    paddingBottom: workoutSpacing.xxl,
  },
  title: { ...workoutType.title, textAlign: 'center' },
  section: { gap: workoutSpacing.sm },
  sectionLabel: {
    ...workoutType.caption,
    color: workoutColors.textMuted,
    letterSpacing: 3,
  },
  sectionBody: { gap: workoutSpacing.sm },
  body: { ...workoutType.body, color: workoutColors.textSecondary },
  themeList: { gap: workoutSpacing.md, marginTop: workoutSpacing.sm },
  previewWrap: {
    alignItems: 'center',
    paddingVertical: workoutSpacing.md,
  },
  previewLabel: {
    ...workoutType.caption,
    color: workoutColors.textMuted,
    textAlign: 'center',
    letterSpacing: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: workoutSpacing.xs,
  },
  rowMultiline: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: workoutSpacing.xs,
  },
  rowLabel: { ...workoutType.label, color: workoutColors.textSecondary },
  rowValue: { ...workoutType.body, color: workoutColors.textPrimary },
  rowValueMultiline: { color: workoutColors.textSecondary },
  smallNote: {
    ...workoutType.caption,
    color: workoutColors.textMuted,
    fontStyle: 'italic',
    marginTop: workoutSpacing.xs,
  },
  placeholderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: workoutSpacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: workoutColors.divider,
  },
  placeholderText: { ...workoutType.body, color: workoutColors.textMuted },
  placeholderHint: { ...workoutType.caption, color: workoutColors.textMuted },
  returnButton: {
    backgroundColor: workoutColors.surfaceElevated,
    borderRadius: workoutRadii.md,
    paddingVertical: workoutSpacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: workoutColors.border,
    marginTop: workoutSpacing.md,
  },
  returnButtonText: { ...workoutType.body, color: workoutColors.textPrimary },
  pressed: { opacity: 0.85 },
});
