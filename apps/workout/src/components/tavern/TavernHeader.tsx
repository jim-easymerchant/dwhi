/**
 * TavernHeader — top strip of the home screen.
 *
 * Pure presentational composite of a left-aligned location title
 * + subtitle and a right-aligned settings button. The component is
 * theme-agnostic; the strings are drawn from `ThemePack.headerCopy`
 * so the same component renders both the Hollow header and the
 * Wounded Goblin tavern header.
 *
 * See: docs/workout-rpg/019-tavern-home-layout.md §2 (header strip).
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  workoutColors,
  workoutRadii,
  workoutSpacing,
  workoutType,
} from '../../theme/workoutColors';

export interface TavernHeaderProps {
  title: string;
  subtitle: string;
  /** Tap target for the gear button (top-right). */
  onOpenSettings: () => void;
  testID?: string;
}

export function TavernHeader({
  title,
  subtitle,
  onOpenSettings,
  testID,
}: TavernHeaderProps): JSX.Element {
  return (
    <View testID={testID} style={styles.row}>
      <View style={styles.titleBlock}>
        <Text testID="tavern-header-title" style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text testID="tavern-header-subtitle" style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open settings"
        testID="home-open-settings"
        style={({ pressed }) => [styles.gear, pressed && styles.pressed]}
        onPress={onOpenSettings}
      >
        <Text style={styles.gearGlyph}>⚙</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: workoutSpacing.md,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    ...workoutType.heading,
    letterSpacing: 1,
  },
  subtitle: {
    ...workoutType.label,
    color: workoutColors.textSecondary,
    marginTop: 2,
  },
  gear: {
    width: 40,
    height: 40,
    borderRadius: workoutRadii.pill,
    backgroundColor: workoutColors.surface,
    borderWidth: 1,
    borderColor: workoutColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gearGlyph: {
    fontSize: 18,
    color: workoutColors.textSecondary,
  },
  pressed: { opacity: 0.7 },
});
