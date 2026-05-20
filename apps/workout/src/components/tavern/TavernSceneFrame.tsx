/**
 * TavernSceneFrame — framed centerpiece for the home screen.
 *
 * Wraps the existing `CampScene` in a bordered, slightly elevated
 * card and renders an optional one-line scene flavour underneath
 * the scene ("The fire crackles. Mugs clink." / "Warm light spills
 * from the hearth.").
 *
 * Pure presentational. The scene itself is unchanged; the frame
 * only adds chrome.
 *
 * See: docs/workout-rpg/019-tavern-home-layout.md §3 (scene frame).
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { MomentumTier } from '@dwhi/workout-domain';

import { CampScene } from '../../render';
import {
  workoutColors,
  workoutRadii,
  workoutSpacing,
  workoutType,
} from '../../theme/workoutColors';

export interface TavernSceneFrameProps {
  tier: MomentumTier;
  /** Optional theme tint overlay forwarded to CampScene. */
  overlayColor?: string;
  /** One-line scene flavour shown below the scene. */
  flavorLine?: string;
  /** When true, suppress the scene's breathing animation (tests). */
  paused?: boolean;
  testID?: string;
}

export function TavernSceneFrame({
  tier,
  overlayColor,
  flavorLine,
  paused,
  testID,
}: TavernSceneFrameProps): JSX.Element {
  return (
    <View testID={testID} style={styles.frame}>
      <View style={styles.sceneWrap}>
        <CampScene
          tier={tier}
          overlayColor={overlayColor}
          paused={paused}
          testID="home-camp-scene"
        />
      </View>
      {flavorLine ? (
        <Text testID="tavern-scene-flavor" style={styles.flavor}>
          {flavorLine}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: workoutColors.surface,
    borderRadius: workoutRadii.lg,
    borderWidth: 1,
    borderColor: workoutColors.border,
    padding: workoutSpacing.md,
    gap: workoutSpacing.sm,
    alignItems: 'center',
  },
  sceneWrap: {
    alignItems: 'center',
  },
  flavor: {
    ...workoutType.caption,
    color: workoutColors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
