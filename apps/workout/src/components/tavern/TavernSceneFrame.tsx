/**
 * TavernSceneFrame — full-bleed home-screen centerpiece.
 *
 * Wraps the existing `CampScene` in a horizontally full-bleed
 * panel. The panel reaches edge-to-edge so the room reads as the
 * *backdrop*, not a small card; the scene itself is centred
 * inside the panel and clipped by the dark background.
 *
 * Two overlays sit on top of the scene:
 *
 *   1. An optional theme **sign** (rendered top-centre when the
 *      theme provides one — Iron Quest Classic ships
 *      "THE WOUNDED GOBLIN"; Momentum opts out so the Hollow
 *      stays unannounced).
 *   2. A small **gear button** (top-right) that opens Settings.
 *
 * Below the scene, an italicised one-line flavour string is
 * rendered (theme + world-state phrasing).
 *
 * Pure presentational; the scene itself is unchanged — same
 * View-based pixel renderer, same mood-keyed lighting.
 *
 * See: docs/workout-rpg/021-expo-go-setup.md (visual notes)
 *      docs/workout-rpg/019-tavern-home-layout.md §3 (origin)
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
  /** Optional theme sign rendered top-centre (Iron Quest only). */
  signText?: string;
  /** Optional sign subtitle line under the sign. */
  signSubtitle?: string;
  /** Optional accent colour used by the sign border + glyph. */
  signColor?: string;
  /** Tap target for the gear button (top-right). */
  onOpenSettings?: () => void;
  /** One-line scene flavour shown below the scene. */
  flavorLine?: string;
  /** When true, suppress the scene's breathing animation (tests). */
  paused?: boolean;
  testID?: string;
}

export function TavernSceneFrame({
  tier,
  overlayColor,
  signText,
  signSubtitle,
  signColor,
  onOpenSettings,
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

        {signText ? (
          <View
            testID="tavern-sign"
            pointerEvents="none"
            style={[
              styles.signWrap,
              signColor ? { borderColor: signColor } : null,
            ]}
          >
            <Text
              testID="tavern-sign-title"
              style={[
                styles.signTitle,
                signColor ? { color: signColor } : null,
              ]}
              numberOfLines={1}
            >
              {signText}
            </Text>
            {signSubtitle ? (
              <Text
                testID="tavern-sign-subtitle"
                style={styles.signSubtitle}
                numberOfLines={1}
              >
                {signSubtitle}
              </Text>
            ) : null}
          </View>
        ) : null}

        {onOpenSettings ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open settings"
            testID="home-open-settings"
            style={({ pressed }) => [
              styles.gear,
              pressed && styles.pressed,
            ]}
            onPress={onOpenSettings}
          >
            <Text style={styles.gearGlyph}>⚙</Text>
          </Pressable>
        ) : null}
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
    // Full-bleed horizontally — the parent ScrollView's padding is
    // negated by the negative horizontal margin, so the panel
    // reaches edge-to-edge without removing the safe-area inset.
    marginHorizontal: -workoutSpacing.lg,
    paddingVertical: workoutSpacing.md,
    paddingHorizontal: workoutSpacing.lg,
    gap: workoutSpacing.sm,
    alignItems: 'center',
    // No border, no rounded card — the scene IS the chrome.
  },
  sceneWrap: {
    alignItems: 'center',
    position: 'relative',
  },
  signWrap: {
    position: 'absolute',
    top: workoutSpacing.sm,
    alignSelf: 'center',
    paddingHorizontal: workoutSpacing.md,
    paddingVertical: 4,
    backgroundColor: 'rgba(8, 8, 12, 0.78)',
    borderWidth: 1,
    borderColor: workoutColors.ember,
    borderRadius: workoutRadii.sm,
    alignItems: 'center',
    maxWidth: '92%',
  },
  signTitle: {
    ...workoutType.label,
    color: workoutColors.ember,
    letterSpacing: 3,
    fontWeight: '700',
  },
  signSubtitle: {
    ...workoutType.caption,
    color: workoutColors.textSecondary,
    fontStyle: 'italic',
  },
  gear: {
    position: 'absolute',
    top: workoutSpacing.sm,
    right: workoutSpacing.sm,
    width: 36,
    height: 36,
    borderRadius: workoutRadii.pill,
    backgroundColor: 'rgba(8, 8, 12, 0.65)',
    borderWidth: 1,
    borderColor: workoutColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gearGlyph: {
    fontSize: 18,
    color: workoutColors.textSecondary,
  },
  flavor: {
    ...workoutType.caption,
    color: workoutColors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
    paddingHorizontal: workoutSpacing.lg,
  },
  pressed: { opacity: 0.7 },
});
