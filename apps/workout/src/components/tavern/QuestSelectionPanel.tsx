/**
 * QuestSelectionPanel — section that hosts the quest cards.
 *
 * Owns: the section header, the threat / "X is in the room" line,
 * and the two side-by-side QuestCards. The cards themselves are
 * theme-agnostic; this panel forwards theme copy down to them.
 *
 * See: docs/workout-rpg/019-tavern-home-layout.md §6 (quest cards).
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  workoutColors,
  workoutSpacing,
  workoutType,
} from '../../theme/workoutColors';

import { QuestCard } from './QuestCard';

export interface QuestSelectionPanelProps {
  sectionLabel: string;
  threatLine: string;
  bodyweightActionLabel: string;
  weightedActionLabel: string;
  bodyweightExercises: readonly string[];
  weightedExercises: readonly string[];
  activeModality: 'bodyweight' | 'weighted';
  accentColor: string;
  onSelectBodyweight: () => void;
  onSelectWeighted: () => void;
  testID?: string;
}

export function QuestSelectionPanel({
  sectionLabel,
  threatLine,
  bodyweightActionLabel,
  weightedActionLabel,
  bodyweightExercises,
  weightedExercises,
  activeModality,
  accentColor,
  onSelectBodyweight,
  onSelectWeighted,
  testID,
}: QuestSelectionPanelProps): JSX.Element {
  return (
    <View testID={testID} style={styles.section}>
      <View style={styles.headerBlock}>
        <Text testID="quest-section-label" style={styles.sectionLabel}>
          {sectionLabel}
        </Text>
        <Text testID="quest-threat-line" style={styles.threat}>
          {threatLine}
        </Text>
      </View>
      <View style={styles.cardRow}>
        <QuestCard
          testID="quest-card-bodyweight"
          modalityLabel="BODYWEIGHT"
          exerciseNames={bodyweightExercises}
          actionLabel={bodyweightActionLabel}
          accentColor={accentColor}
          active={activeModality === 'bodyweight'}
          onPress={onSelectBodyweight}
        />
        <QuestCard
          testID="quest-card-weighted"
          modalityLabel="WEIGHTED"
          exerciseNames={weightedExercises}
          actionLabel={weightedActionLabel}
          accentColor={accentColor}
          active={activeModality === 'weighted'}
          onPress={onSelectWeighted}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: workoutSpacing.sm,
  },
  headerBlock: {
    gap: 2,
  },
  sectionLabel: {
    ...workoutType.caption,
    letterSpacing: 2,
    color: workoutColors.textMuted,
  },
  threat: {
    ...workoutType.body,
    color: workoutColors.textSecondary,
  },
  cardRow: {
    flexDirection: 'row',
    gap: workoutSpacing.sm,
  },
});
