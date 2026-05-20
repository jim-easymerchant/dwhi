/**
 * TavernSceneFrame — true full-bleed home-screen header.
 *
 * Branch 024 device-QA pass:
 *
 *   - Width is read via `useWindowDimensions()` so the scene
 *     responds correctly to rotation + variable phone widths.
 *     The previous static module-load capture of the window
 *     width was captured at module-load time on some devices,
 *     which contributed to the "still feels constrained" report.
 *   - The canvas itself reaches behind the system status bar
 *     (the HomeScreen's SafeAreaView only insets the bottom).
 *     But the two interactive overlays — the Iron Quest sign
 *     (top-left) and the settings gear (top-right) — apply the
 *     safe-area TOP inset so they sit *below* the status icons,
 *     readable and tappable.
 *   - No card chrome on the canvas: no border, no rounded
 *     corners, no surface background. The scene IS the chrome.
 *   - A thin bottom vignette (three layered Views at increasing
 *     opacity of the app background) fades the scene into the
 *     page so home content scrolling beneath feels like it lifts
 *     the scene up rather than pushing it away.
 *
 * Pure presentational; no new dependencies.
 *
 * See: docs/workout-rpg/024-device-qa-and-workout-authoring.md
 */

import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { MomentumTier } from '@dwhi/workout-domain';

import { CampScene } from '../../render';
import {
  workoutColors,
  workoutSpacing,
  workoutType,
} from '../../theme/workoutColors';

// Header reserved height — ~30% of a typical 720px viewport.
// The CampScene canvas (~168px tall at the default pixelSize)
// sits vertically centred inside; the vignette eats the bottom
// strip.
const HEADER_HEIGHT = 230;

export interface TavernSceneFrameProps {
  tier: MomentumTier;
  /** Optional theme tint overlay forwarded to CampScene. */
  overlayColor?: string;
  /** Optional theme sign (top-left). Iron Quest opts in. */
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
  const { width: viewportWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // Overlays start `insets.top + sm` from the top — clears the
  // status bar / notch reliably across Android and iOS. The
  // CampScene canvas itself ignores the inset and reaches behind
  // the status bar, so the room visually "owns" the top.
  const overlayTop = insets.top + workoutSpacing.sm;

  return (
    <View testID={testID} style={[styles.frame, { width: viewportWidth }]}>
      <View
        testID="tavern-canvas"
        style={[styles.canvas, { width: viewportWidth }]}
      >
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

        {/* Top-left environmental sign — small, translucent.
            Sits below the safe-area top inset so status bar icons
            never overlap it. Iron Quest only. */}
        {signText ? (
          <View
            testID="tavern-sign"
            pointerEvents="none"
            style={[
              styles.signWrap,
              { top: overlayTop },
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

        {/* Top-right gear button — small, translucent. Same
            safe-area top inset so it remains tappable below the
            status bar. */}
        {onOpenSettings ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open settings"
            testID="home-open-settings"
            style={({ pressed }) => [
              styles.gear,
              { top: overlayTop },
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

const styles = StyleSheet.create({
  frame: {
    // Cancel the parent ScrollView's horizontal padding so the
    // scene reaches the screen edges. The wrapper width is set
    // inline (live, via useWindowDimensions).
    marginHorizontal: -workoutSpacing.lg,
    alignItems: 'stretch',
    gap: workoutSpacing.sm,
  },
  canvas: {
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
  // Small, translucent corner sign. Anchored upper-left with
  // breathing room. `top` is set dynamically from safe-area insets.
  signWrap: {
    position: 'absolute',
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
    right: workoutSpacing.sm,
    width: 36,
    height: 36,
    borderRadius: 18,
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
