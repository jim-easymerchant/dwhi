/**
 * TavernSceneFrame — true full-bleed home-screen header.
 *
 * Branch 023 redesign:
 *
 *   - Edge-to-edge width via a viewport-pinned width from
 *     `Dimensions.get('window')`. The panel ignores the parent
 *     ScrollView's horizontal padding and reaches all the way
 *     across the screen.
 *   - No card chrome — no border, no rounded corners, no surface
 *     background. The scene IS the chrome.
 *   - Two small overlays in opposite corners:
 *       • Upper-left: an environmental theme sign (Iron Quest
 *         only — Momentum opts out). Small / translucent / does
 *         NOT obscure the scene.
 *       • Upper-right: the settings gear (small / translucent).
 *   - A subtle bottom vignette: a thin layered gradient-style
 *     overlay that fades the scene into the app background, so
 *     the scene visually continues *behind* the content scrolling
 *     below.
 *
 * The CampScene itself is unchanged — same View-based pixel
 * renderer, same mood-keyed lighting. Only the framing around it
 * is new.
 *
 * Pure presentational; no new dependencies.
 *
 * See: docs/workout-rpg/023-ui-polish-hp-and-timers.md §1, §2
 */

import React from 'react';
import {
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { MomentumTier } from '@dwhi/workout-domain';

import { CampScene } from '../../render';
import {
  workoutColors,
  workoutSpacing,
  workoutType,
} from '../../theme/workoutColors';

// ---------------------------------------------------------------------------
// Viewport math — the scene reaches edge-to-edge.
//
// We pull the device width via `Dimensions.get('window')`. The
// scene canvas itself is fixed-size (96 × 56 logical pixels at
// pixelSize=3 → ~288px wide), so the wrapper is wider than the
// canvas; the canvas centres inside it. The dark wall colour
// behind the canvas matches the scene's wall tone, so the bleed
// reads as "the wall continues."
// ---------------------------------------------------------------------------

const VIEWPORT_WIDTH = Dimensions.get('window').width;

// Reserved height for the header; the scene + overlays sit inside.
// ~32% of a 700px viewport ≈ 224px — within the brief's 28-35%
// dominant-header target. The canvas itself is ~168px tall, so
// the wrapper has a touch of vertical breathing room for the
// vignette and overlays.
const HEADER_HEIGHT = 220;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface TavernSceneFrameProps {
  tier: MomentumTier;
  /** Optional theme tint overlay forwarded to CampScene. */
  overlayColor?: string;
  /** Optional theme sign (top-left). Iron Quest opts in; Momentum
   *  passes `undefined` to stay unannounced. */
  signText?: string;
  /** Optional sign subtitle. */
  signSubtitle?: string;
  /** Optional sign accent colour. */
  signColor?: string;
  /** Tap target for the gear (top-right). */
  onOpenSettings?: () => void;
  /** Optional one-line scene flavour shown beneath the scene. */
  flavorLine?: string;
  /** Pause the breathing animation (tests). */
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
      <View style={styles.canvas}>
        {/* The scene itself — centred horizontally inside the
            full-bleed wrapper. */}
        <View style={styles.sceneCenter}>
          <CampScene
            tier={tier}
            overlayColor={overlayColor}
            paused={paused}
            testID="home-camp-scene"
          />
        </View>

        {/* Top-left environmental sign — small, translucent, does
            NOT dominate. Iron Quest only. */}
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

        {/* Top-right gear button — small, translucent. */}
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

        {/* Bottom vignette — three thin opacity bands fade the
            scene into the app background. View-only, no Skia. */}
        <View pointerEvents="none" style={styles.vignetteBand1} />
        <View pointerEvents="none" style={styles.vignetteBand2} />
        <View
          pointerEvents="none"
          testID="tavern-vignette"
          style={styles.vignetteBand3}
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

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  frame: {
    // Cancel the parent ScrollView's horizontal padding so the
    // scene reaches the screen edges. The wrapper itself is
    // pinned to viewport width.
    marginHorizontal: -workoutSpacing.lg,
    width: VIEWPORT_WIDTH,
    alignItems: 'stretch',
    gap: workoutSpacing.sm,
  },
  canvas: {
    width: VIEWPORT_WIDTH,
    height: HEADER_HEIGHT,
    // Match the scene's back wall so the bleed reads continuous.
    backgroundColor: '#181018',
    overflow: 'hidden',
    position: 'relative',
  },
  sceneCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Small, translucent corner sign. ~140 wide vs the previous
  // centred sign that spanned up to 92% of the scene width — a
  // ~40% reduction. Anchored top-left with breathing room.
  signWrap: {
    position: 'absolute',
    top: workoutSpacing.sm,
    left: workoutSpacing.sm,
    paddingHorizontal: workoutSpacing.sm,
    paddingVertical: 3,
    backgroundColor: 'rgba(8, 8, 12, 0.55)',
    borderWidth: 1,
    borderColor: workoutColors.ember,
    borderRadius: 4,
    maxWidth: 160,
    opacity: 0.92,
  },
  signTitle: {
    ...workoutType.caption,
    color: workoutColors.ember,
    letterSpacing: 2,
    fontWeight: '700',
    fontSize: 11,
  },
  signSubtitle: {
    ...workoutType.caption,
    color: workoutColors.textSecondary,
    fontStyle: 'italic',
    fontSize: 9,
  },
  gear: {
    position: 'absolute',
    top: workoutSpacing.sm,
    right: workoutSpacing.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(8, 8, 12, 0.55)',
    borderWidth: 1,
    borderColor: workoutColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gearGlyph: {
    fontSize: 16,
    color: workoutColors.textSecondary,
  },
  // Three thin overlay bands at the bottom approximate a soft
  // vignette without Skia / SVG. Each band uses the app's
  // background colour at increasing opacity — the scene visually
  // fades into the page below.
  vignetteBand1: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 24,
    height: 20,
    backgroundColor: workoutColors.background,
    opacity: 0.18,
  },
  vignetteBand2: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 8,
    height: 18,
    backgroundColor: workoutColors.background,
    opacity: 0.36,
  },
  vignetteBand3: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 10,
    backgroundColor: workoutColors.background,
    opacity: 0.7,
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
