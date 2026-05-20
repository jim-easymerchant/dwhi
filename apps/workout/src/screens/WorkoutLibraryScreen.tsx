/**
 * Workout library — view built-in templates, paste-import a new
 * template, save it locally (or keep in memory when persistence
 * is unavailable), and pick which template the home screen
 * highlights.
 *
 * This is the device-QA + workout-authoring branch's MVP: enough
 * to free the user from "Push Day is the only thing." A larger
 * drag-and-drop editor is intentionally out of scope.
 *
 * No new dependencies. View + plain React only.
 *
 * See: docs/workout-rpg/024-device-qa-and-workout-authoring.md §6
 */

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useWorkoutGameStore } from '../state/workoutGameStore';
import { getTheme } from '../theme';
import {
  workoutColors,
  workoutRadii,
  workoutSpacing,
  workoutType,
} from '../theme/workoutColors';
import {
  importWorkoutFromText,
  listAllTemplates,
  parseWorkoutText,
  type WorkoutImportResult,
  type WorkoutTemplate,
} from '../workouts';

const PLACEHOLDER = `Workout: My Push Day
Bench Press 3x10 @ 135 lb, rest 90s
Shoulder Press 3x8 @ 65 lb
Triceps Extension 3x12
Pushup 3xAMRAP
Plank 3x45s`;

export function WorkoutLibraryScreen(): JSX.Element {
  const selectedThemeId = useWorkoutGameStore((s) => s.selectedThemeId);
  const selectedTemplateId = useWorkoutGameStore((s) => s.selectedTemplateId);
  const setSelectedTemplate = useWorkoutGameStore((s) => s.setSelectedTemplate);
  const returnToCamp = useWorkoutGameStore((s) => s.returnToCamp);
  const persistenceDisabled = useWorkoutGameStore((s) => s.persistenceDisabled);

  const theme = getTheme(selectedThemeId);
  const [text, setText] = React.useState('');
  const [preview, setPreview] = React.useState<WorkoutImportResult | null>(null);
  const [savedToast, setSavedToast] = React.useState<string | null>(null);

  // Re-read the template list on every render — built-ins are
  // static and imports live in a module-level Map, so this is
  // cheap. `version` is a cheap re-render bump after a save.
  const [version, setVersion] = React.useState(0);
  const templates = React.useMemo(
    () => listAllTemplates(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  );

  const onPreview = React.useCallback(() => {
    setPreview(parseWorkoutText(text));
  }, [text]);

  const onSave = React.useCallback(() => {
    const result = importWorkoutFromText(text);
    setPreview(result);
    if (result.errors.length === 0 && result.template.exercises.length > 0) {
      // Fire-and-forget the bridge save; the library is already
      // updated in memory by `importWorkoutFromText`. Memory-only
      // mode keeps the import for this session.
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
        const bridge = require('../state/persistenceBridge') as typeof import('../state/persistenceBridge');
        void bridge
          .persistImportedWorkoutTemplate(result.template)
          .catch(() => undefined);
      } catch {
        // Bridge unavailable — memory-only is fine.
      }
      setSavedToast(`Saved "${result.template.name}".`);
      setVersion((v) => v + 1);
      // Auto-select the just-saved template so it's the next quest.
      setSelectedTemplate(result.template.id);
    } else {
      setSavedToast(null);
    }
  }, [text, setSelectedTemplate]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Workouts</Text>
        <Text style={styles.subtitle}>
          Pick a template, or paste a new one.
        </Text>

        {persistenceDisabled ? (
          <Text testID="workouts-memory-only" style={styles.memoryOnly}>
            Memory-only mode — imports live for this session.
          </Text>
        ) : null}

        {/* ---------- Library list ---------- */}
        <Text style={styles.sectionLabel}>LIBRARY</Text>
        <View style={styles.list}>
          {templates.map((t) => (
            <TemplateRow
              key={t.id}
              template={t}
              selected={t.id === selectedTemplateId}
              accentColor={theme.uiAccent.primary}
              onSelect={() => setSelectedTemplate(t.id)}
            />
          ))}
        </View>

        {/* ---------- Import box ---------- */}
        <Text style={styles.sectionLabel}>IMPORT</Text>
        <Text style={styles.helpBody}>
          Paste a plain-text workout. Sets×reps, optional @ weight (lb / kg),
          optional rest seconds. AMRAP / Max / 45s are all valid for reps.
        </Text>
        <TextInput
          testID="workouts-import-input"
          value={text}
          onChangeText={setText}
          placeholder={PLACEHOLDER}
          placeholderTextColor={workoutColors.textMuted}
          multiline
          textAlignVertical="top"
          style={styles.textArea}
        />
        <View style={styles.importButtons}>
          <Pressable
            accessibilityRole="button"
            testID="workouts-import-preview"
            onPress={onPreview}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.secondaryButtonText}>Preview</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            testID="workouts-import-save"
            onPress={onSave}
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: theme.uiAccent.primary },
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>Save Workout</Text>
          </Pressable>
        </View>

        {/* ---------- Preview ---------- */}
        {preview ? (
          <View testID="workouts-preview" style={styles.previewBlock}>
            <Text style={styles.sectionLabel}>PREVIEW</Text>
            <Text style={styles.previewTitle}>{preview.template.name}</Text>
            {preview.template.exercises.length === 0 ? (
              <Text style={styles.previewEmpty}>No exercises parsed.</Text>
            ) : (
              preview.template.exercises.map((ex) => (
                <Text key={ex.id} style={styles.previewLine}>
                  • {ex.name} — {ex.defaultSets ?? '?'}×
                  {ex.inputKind === 'amrap'
                    ? 'AMRAP'
                    : ex.inputKind === 'time'
                      ? `${ex.defaultReps ?? '?'}s`
                      : (ex.defaultReps ?? '?')}
                  {ex.defaultWeightKg
                    ? `  @ ${ex.defaultWeightKg.toFixed(1)} kg`
                    : ''}
                  {ex.defaultRestSeconds
                    ? `, rest ${ex.defaultRestSeconds}s`
                    : ''}
                </Text>
              ))
            )}
            {preview.warnings.length > 0 ? (
              <View style={styles.warningsBlock}>
                {preview.warnings.map((w, i) => (
                  <Text
                    key={`w-${i}`}
                    testID={`workouts-warning-${i}`}
                    style={styles.warningLine}
                  >
                    line {w.line}: {w.message}
                  </Text>
                ))}
              </View>
            ) : null}
            {preview.errors.length > 0 ? (
              <View style={styles.errorsBlock}>
                {preview.errors.map((e, i) => (
                  <Text
                    key={`e-${i}`}
                    testID={`workouts-error-${i}`}
                    style={styles.errorLine}
                  >
                    error: {e.message}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {savedToast ? (
          <Text testID="workouts-toast" style={styles.toast}>
            {savedToast}
          </Text>
        ) : null}

        {/* ---------- Return ---------- */}
        <Pressable
          accessibilityRole="button"
          testID="workouts-return"
          onPress={returnToCamp}
          style={({ pressed }) => [
            styles.returnButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.returnButtonText}>Return to Camp</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

interface TemplateRowProps {
  template: WorkoutTemplate;
  selected: boolean;
  accentColor: string;
  onSelect: () => void;
}

function TemplateRow({
  template,
  selected,
  accentColor,
  onSelect,
}: TemplateRowProps): JSX.Element {
  const previewNames = template.exercises.slice(0, 4).map((e) => e.name);
  const extra = template.exercises.length - previewNames.length;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      testID={`workouts-template-${template.id}`}
      onPress={onSelect}
      style={({ pressed }) => [
        styles.row,
        selected && { borderColor: accentColor },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.rowHeader}>
        <Text style={styles.rowName}>{template.name}</Text>
        <Text style={styles.rowSource}>
          {template.source === 'builtin' ? 'BUILT-IN' : 'IMPORTED'}
        </Text>
      </View>
      {template.description ? (
        <Text style={styles.rowDescription}>{template.description}</Text>
      ) : null}
      <Text style={styles.rowExercises}>
        {previewNames.join(' · ')}
        {extra > 0 ? `  + ${extra} more` : ''}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: workoutColors.background },
  scroll: {
    padding: workoutSpacing.lg,
    gap: workoutSpacing.md,
    paddingBottom: workoutSpacing.xxl,
  },
  title: { ...workoutType.title, textAlign: 'center' },
  subtitle: {
    ...workoutType.label,
    textAlign: 'center',
    color: workoutColors.textSecondary,
  },
  memoryOnly: {
    ...workoutType.caption,
    color: workoutColors.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  sectionLabel: {
    ...workoutType.caption,
    letterSpacing: 3,
    color: workoutColors.textMuted,
    marginTop: workoutSpacing.md,
  },
  list: { gap: workoutSpacing.sm },
  row: {
    backgroundColor: workoutColors.surface,
    borderRadius: workoutRadii.md,
    borderWidth: 1,
    borderColor: workoutColors.border,
    padding: workoutSpacing.md,
    gap: workoutSpacing.xs,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  rowName: { ...workoutType.heading, fontSize: 18 },
  rowSource: {
    ...workoutType.caption,
    color: workoutColors.textMuted,
    letterSpacing: 2,
  },
  rowDescription: {
    ...workoutType.caption,
    color: workoutColors.textSecondary,
    fontStyle: 'italic',
  },
  rowExercises: {
    ...workoutType.caption,
    color: workoutColors.textSecondary,
  },
  helpBody: {
    ...workoutType.caption,
    color: workoutColors.textSecondary,
  },
  textArea: {
    backgroundColor: workoutColors.surface,
    borderRadius: workoutRadii.md,
    borderWidth: 1,
    borderColor: workoutColors.border,
    color: workoutColors.textPrimary,
    minHeight: 140,
    padding: workoutSpacing.md,
    fontFamily: 'monospace',
  },
  importButtons: {
    flexDirection: 'row',
    gap: workoutSpacing.sm,
  },
  primaryButton: {
    flex: 1,
    paddingVertical: workoutSpacing.md,
    borderRadius: workoutRadii.md,
    alignItems: 'center',
  },
  primaryButtonText: {
    ...workoutType.body,
    color: workoutColors.background,
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: workoutSpacing.md,
    borderRadius: workoutRadii.md,
    borderWidth: 1,
    borderColor: workoutColors.border,
    alignItems: 'center',
  },
  secondaryButtonText: {
    ...workoutType.body,
    color: workoutColors.textPrimary,
  },
  previewBlock: {
    backgroundColor: workoutColors.surface,
    borderRadius: workoutRadii.md,
    borderWidth: 1,
    borderColor: workoutColors.border,
    padding: workoutSpacing.md,
    gap: workoutSpacing.xs,
  },
  previewTitle: { ...workoutType.heading, fontSize: 18 },
  previewEmpty: {
    ...workoutType.caption,
    color: workoutColors.textMuted,
    fontStyle: 'italic',
  },
  previewLine: {
    ...workoutType.caption,
    color: workoutColors.textSecondary,
  },
  warningsBlock: {
    marginTop: workoutSpacing.sm,
    gap: 2,
  },
  warningLine: {
    ...workoutType.caption,
    color: workoutColors.ember,
  },
  errorsBlock: {
    marginTop: workoutSpacing.sm,
    gap: 2,
  },
  errorLine: {
    ...workoutType.caption,
    color: workoutColors.hearth,
  },
  toast: {
    ...workoutType.caption,
    color: workoutColors.textPrimary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  returnButton: {
    backgroundColor: workoutColors.surfaceElevated,
    borderRadius: workoutRadii.md,
    paddingVertical: workoutSpacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: workoutColors.border,
    marginTop: workoutSpacing.lg,
  },
  returnButtonText: { ...workoutType.body, color: workoutColors.textPrimary },
  pressed: { opacity: 0.7 },
});
