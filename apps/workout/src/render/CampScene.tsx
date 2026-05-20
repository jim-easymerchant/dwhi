/**
 * CampScene — the layered pixel-art "place you return to."
 *
 * Adapted from `reference/ironquest/renderer/TavernScene.js`:
 *
 *   - Same layered View-based pixel-art technique (nested Views,
 *     one per pixel, no Skia, no Reanimated, no SVG library).
 *   - Same animated-flame primitive (frame-cycling palette via
 *     `setInterval` cleaned up on unmount).
 *   - Same mood-tint overlay (a full-bleed coloured `View` at
 *     sub-1.0 opacity).
 *
 * Adapted differences:
 *
 *   - "Tavern" → "Camp" everywhere. No DCC / RisingKB naming, no
 *     hostile defaults, no NPCs with opinions.
 *   - Mood lighting is keyed to Momentum tier (Rusted → Ascendant),
 *     not IQ's narrative moods (normal / abandoned / festive).
 *   - Restricted layer count: a wall, a floor, a hearth with
 *     animated flame, a low bench, two hanging lanterns, and a
 *     mood-tint overlay. Enough to read as "a place"; quiet
 *     enough not to compete with the Quest CTA.
 *   - Built in TypeScript and tested for layer-order parity and
 *     mood-mapping correctness — see
 *     `apps/workout/src/tests/campScene.smoke.test.ts`.
 */

import React from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import type { MomentumTier } from '@dwhi/workout-domain';

import { CAMP_SURFACES, tintFor, type CampTint } from './campPalettes';
import {
  BENCH_MAP,
  CAMP_LAYER_ORDER,
  FLAME_HEIGHT,
  FLAME_MAP,
  FLAME_WIDTH,
  HEARTH_FRAME_HEIGHT,
  HEARTH_FRAME_MAP,
  HEARTH_FRAME_WIDTH,
  LANTERN_HEIGHT,
  LANTERN_MAP,
  LANTERN_WIDTH,
  paletteForFlameFrame,
  type LayerMap,
} from './campSceneLayers';

// ---------------------------------------------------------------------------
// Tuning — single point for sizing the scene.
// ---------------------------------------------------------------------------

const PIXEL_SIZE = 3; // logical px → display px
const SCENE_WIDTH_PX = 96; // logical pixels
const SCENE_HEIGHT_PX = 56; // logical pixels
const FLAME_FRAME_MS = 220;
const BREATHING_LOW = 0.94;
const BREATHING_HIGH = 1.0;
const BREATHING_HALF_PERIOD_MS = 3000;

const SCENE_WIDTH = SCENE_WIDTH_PX * PIXEL_SIZE;
const SCENE_HEIGHT = SCENE_HEIGHT_PX * PIXEL_SIZE;

// ---------------------------------------------------------------------------
// Helper — render a sprite map as nested Views.
// ---------------------------------------------------------------------------

interface PixelSpriteProps {
  map: LayerMap;
  palette: readonly string[];
  pixelSize?: number;
}

function PixelSprite({ map, palette, pixelSize = PIXEL_SIZE }: PixelSpriteProps): JSX.Element {
  return (
    <View style={{ flexDirection: 'column' }}>
      {map.map((row, y) => (
        <View key={y} style={{ flexDirection: 'row' }}>
          {row.map((idx, x) => {
            if (idx === 0) {
              return <View key={x} style={{ width: pixelSize, height: pixelSize }} />;
            }
            const color = palette[idx - 1] ?? palette[0];
            return (
              <View
                key={x}
                style={{
                  width: pixelSize,
                  height: pixelSize,
                  backgroundColor: color,
                }}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// AnimatedFlame — frame-cycles through the three FLAME_FRAMES at
// FLAME_FRAME_MS intervals. Built-in setInterval (cleaned up on
// unmount). Brightness scales with the tier's flameIntensity.
// ---------------------------------------------------------------------------

function AnimatedFlame({ tint, pixelSize }: { tint: CampTint; pixelSize: number }): JSX.Element | null {
  const [frame, setFrame] = React.useState(0);
  React.useEffect(() => {
    if (tint.flameIntensity <= 0.05) return undefined;
    const id = setInterval(() => setFrame((f) => (f + 1) % 3), FLAME_FRAME_MS);
    return () => clearInterval(id);
  }, [tint.flameIntensity]);

  if (tint.flameIntensity <= 0.05) {
    // Effectively no fire — render the cold hearth.
    return null;
  }
  const palette = paletteForFlameFrame(frame);
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="The hearth"
      style={{ opacity: Math.min(1, tint.flameIntensity) }}
    >
      <PixelSprite map={FLAME_MAP} palette={palette} pixelSize={pixelSize} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Public component.
// ---------------------------------------------------------------------------

export interface CampSceneProps {
  /** Drives mood lighting + flame brightness. */
  tier: MomentumTier;
  /** Display scale multiplier (e.g. 0.75 for a smaller home-screen panel). */
  scale?: number;
  /** When true, suppress the breathing animation (e.g., during tests). */
  paused?: boolean;
  testID?: string;
}

export function CampScene({
  tier,
  scale = 1,
  paused = false,
  testID,
}: CampSceneProps): JSX.Element {
  const tint = tintFor(tier);

  const breath = React.useRef(new Animated.Value(BREATHING_HIGH)).current;
  React.useEffect(() => {
    if (paused) {
      breath.stopAnimation();
      breath.setValue(BREATHING_HIGH);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: BREATHING_LOW,
          duration: BREATHING_HALF_PERIOD_MS,
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          toValue: BREATHING_HIGH,
          duration: BREATHING_HALF_PERIOD_MS,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [paused, breath]);

  const w = SCENE_WIDTH * scale;
  const h = SCENE_HEIGHT * scale;

  return (
    <Animated.View
      accessibilityRole="image"
      accessibilityLabel={`Camp — ember tier: ${tier}`}
      testID={testID}
      style={[
        styles.scene,
        {
          width: w,
          height: h,
          opacity: breath,
        },
      ]}
    >
      {/* 1. Wall (back band) */}
      <View
        testID="camp-layer-wall"
        style={[
          styles.layer,
          {
            top: 0,
            height: h * 0.55,
            backgroundColor: CAMP_SURFACES.wallDark,
          },
        ]}
      />
      <View
        style={[
          styles.layer,
          {
            top: 0,
            height: h * 0.05,
            backgroundColor: CAMP_SURFACES.wallBrick,
          },
        ]}
      />

      {/* 2. Floor */}
      <View
        testID="camp-layer-floor"
        style={[
          styles.layer,
          {
            bottom: 0,
            height: h * 0.45,
            backgroundColor: CAMP_SURFACES.floorMid,
          },
        ]}
      />
      <View
        style={[
          styles.layer,
          {
            bottom: 0,
            height: 2,
            backgroundColor: CAMP_SURFACES.floorPlankSeam,
          },
        ]}
      />
      <View
        style={[
          styles.layer,
          {
            bottom: h * 0.15,
            height: 1,
            backgroundColor: CAMP_SURFACES.floorPlankSeam,
          },
        ]}
      />

      {/* 3. Hearth frame (centre) */}
      <View
        testID="camp-layer-hearth-frame"
        style={[
          styles.absolute,
          {
            left: w / 2 - (HEARTH_FRAME_WIDTH * PIXEL_SIZE) / 2,
            top: h * 0.18,
          },
        ]}
      >
        <PixelSprite
          map={HEARTH_FRAME_MAP}
          palette={[CAMP_SURFACES.hearthFrameDark, CAMP_SURFACES.hearthFrameMid]}
        />
      </View>

      {/* 4. Animated flame */}
      <View
        testID="camp-layer-flame"
        style={[
          styles.absolute,
          {
            left: w / 2 - (FLAME_WIDTH * PIXEL_SIZE) / 2,
            top: h * 0.18 + (HEARTH_FRAME_HEIGHT - FLAME_HEIGHT - 1) * PIXEL_SIZE,
          },
        ]}
      >
        <AnimatedFlame tint={tint} pixelSize={PIXEL_SIZE} />
      </View>

      {/* 5. Bench */}
      <View
        testID="camp-layer-bench"
        style={[
          styles.absolute,
          {
            left: w / 2 - (BENCH_MAP[0].length * PIXEL_SIZE) / 2,
            bottom: h * 0.08,
          },
        ]}
      >
        <PixelSprite
          map={BENCH_MAP}
          palette={[CAMP_SURFACES.benchDark, CAMP_SURFACES.benchMid]}
        />
      </View>

      {/* 6-7. Lanterns (left + right). Lit colour scales with tier. */}
      <View
        testID="camp-layer-lantern-left"
        style={[
          styles.absolute,
          {
            left: PIXEL_SIZE * 4,
            top: PIXEL_SIZE * 3,
          },
        ]}
      >
        <PixelSprite
          map={LANTERN_MAP}
          palette={[
            CAMP_SURFACES.lanternFrame,
            CAMP_SURFACES.lanternGlassDim,
            tint.flameIntensity > 0.6
              ? CAMP_SURFACES.lanternGlassBright
              : CAMP_SURFACES.lanternGlassDim,
          ]}
        />
      </View>
      <View
        testID="camp-layer-lantern-right"
        style={[
          styles.absolute,
          {
            right: PIXEL_SIZE * 4,
            top: PIXEL_SIZE * 3,
          },
        ]}
      >
        <PixelSprite
          map={LANTERN_MAP}
          palette={[
            CAMP_SURFACES.lanternFrame,
            CAMP_SURFACES.lanternGlassDim,
            tint.flameIntensity > 0.6
              ? CAMP_SURFACES.lanternGlassBright
              : CAMP_SURFACES.lanternGlassDim,
          ]}
        />
      </View>

      {/* 8. Mood-tint overlay — full bleed, top-most. */}
      <View
        testID="camp-layer-mood-tint-overlay"
        pointerEvents="none"
        style={[
          styles.absolute,
          {
            left: 0,
            top: 0,
            width: w,
            height: h,
            backgroundColor: tint.color,
            opacity: tint.opacity,
          },
        ]}
      />
    </Animated.View>
  );
}

// Re-export the layer order so consumers can introspect it
// (tests, future plug-ins).
export { CAMP_LAYER_ORDER, LANTERN_HEIGHT, LANTERN_WIDTH };

const styles = StyleSheet.create({
  scene: {
    backgroundColor: CAMP_SURFACES.wallDark,
    overflow: 'hidden',
    position: 'relative',
    alignSelf: 'center',
  },
  layer: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  absolute: {
    position: 'absolute',
  },
});
