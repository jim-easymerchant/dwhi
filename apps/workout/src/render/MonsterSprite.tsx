/**
 * MonsterSprite — View-based pixel sprite renderer.
 *
 * Pure React Native: each "pixel" is a tiny `View` with a
 * `backgroundColor`. Zero native dependencies — no
 * `react-native-reanimated`, no `@shopify/react-native-skia`,
 * no SVG library, no Canvas. Renders identically on iOS,
 * Android, and Expo Go without setup.
 *
 * Animation budget:
 *   - One `Animated.loop` per mounted sprite, modulating opacity
 *     between 1.0 and 0.88 over ~4.8s using the native driver.
 *     "Quiet mythic pressure," per
 *     `docs/workout-rpg/012-battle-ux-and-feel.md` §3.
 *   - Nothing else. No bounce. No flash. No particles. No floating
 *     damage numbers.
 *
 * Tinting:
 *   - `victoryAvailable` blends every coloured pixel toward
 *     Hearth (the crit / tier-up colour) at 30% — the silhouette
 *     reads as *thinned*, not *destroyed*. Pairs with the
 *     `silhouetteThinned` style in BattleScreen.
 *
 * Architecture notes:
 *   - Pattern adapted (not copied) from `reference/ironquest/renderer/MonsterSprite.js`.
 *     See `docs/workout-rpg/015-ironquest-port-plan.md` §4 #1 and
 *     `docs/workout-rpg/016-monster-renderer-port.md`.
 *   - Iron Quest rarity palettes are NOT used. Momentum keys on
 *     `EnemyMood` (drift / hush / glare / stone).
 *   - Iron Quest sprite arrays were NOT copied. All five maps in
 *     `spriteMaps.ts` are original.
 *   - Iron Quest's HP-percent injury logic, blood-pixel injection,
 *     and red-tint flicker are NOT ported. Those tone choices
 *     conflict with Momentum's design bible.
 */

import React from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import type { EnemyCategory, EnemyMood } from '@dwhi/workout-domain';

import {
  mapForCategory,
  spriteById,
  type SpriteId,
  type SpriteMap,
} from './spriteMaps';
import { paletteFor, tintHearth } from './spritePalettes';

// ---------------------------------------------------------------------------
// Tuning — all constants live here so a future polish pass can adjust
// the breathing tempo without touching component code.
// ---------------------------------------------------------------------------

const BREATHING_LOW = 0.88;
const BREATHING_HIGH = 1;
const BREATHING_HALF_PERIOD_MS = 2400;
const VICTORY_TINT_AMOUNT = 0.3;
const DEFAULT_PIXEL_SIZE = 8;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface MonsterSpriteProps {
  mood: EnemyMood;
  category: EnemyCategory;
  /** Display size of each pixel in points. Defaults to 8 (= 96×112). */
  pixelSize?: number;
  /** When true, blend every coloured pixel toward Hearth at 30%. */
  victoryAvailable?: boolean;
  /** When true, suppress the breathing animation entirely. */
  paused?: boolean;
  /**
   * Optional explicit sprite-registry id. When set, takes
   * precedence over `category` for picking the silhouette — used
   * by the future fragment generator to surface Iron-Quest-derived
   * variants without changing the enemy's category contract.
   */
  spriteId?: SpriteId;
  /** Optional raw sprite override (highest precedence; for tests + tier-up cameos). */
  spriteMap?: SpriteMap;
  /** Optional test ID for the outer Animated.View. */
  testID?: string;
}

export function MonsterSprite({
  mood,
  category,
  pixelSize = DEFAULT_PIXEL_SIZE,
  victoryAvailable = false,
  paused = false,
  spriteId,
  spriteMap,
  testID,
}: MonsterSpriteProps): JSX.Element {
  const palette = paletteFor(mood);
  const map: SpriteMap =
    spriteMap ??
    (spriteId !== undefined ? spriteById(spriteId) : mapForCategory(category));

  // Breathing — one Animated.Value per mount, looped with the
  // native driver so the JS thread stays idle. Stops cleanly on
  // unmount or when `paused` flips true.
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

  // Pre-resolve the per-index colour table once per render so the
  // inner loop is a single array lookup, not a function call.
  const colourTable: readonly string[] = palette.map((c) =>
    victoryAvailable ? tintHearth(c, VICTORY_TINT_AMOUNT) : c,
  );

  return (
    <Animated.View
      accessibilityRole="image"
      accessibilityLabel={`A ${mood} ${category.replace('_', ' ')} silhouette`}
      style={[styles.root, { opacity: breath }]}
      testID={testID}
    >
      {map.map((row, y) => (
        <View key={y} style={styles.row}>
          {row.map((idx, x) => {
            if (idx === 0) {
              return (
                <View
                  key={x}
                  style={{ width: pixelSize, height: pixelSize }}
                />
              );
            }
            const colour = colourTable[idx - 1] ?? colourTable[0];
            return (
              <View
                key={x}
                style={{
                  width: pixelSize,
                  height: pixelSize,
                  backgroundColor: colour,
                }}
              />
            );
          })}
        </View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'column' },
  row: { flexDirection: 'row' },
});
