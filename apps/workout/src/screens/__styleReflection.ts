/**
 * Pure-data reflection of style decisions that exist *to be tested*.
 *
 * React Native StyleSheet objects are pure data at runtime, but
 * importing a screen file from a Node-side Jest run pulls in the
 * `react-native` module — which has no Node target. This module
 * carries the layout invariants we care about in tests as
 * standalone constants, then the screen file consumes them.
 *
 * Keep this file dependency-free.
 */

import type { FlexStyle, ViewStyle } from 'react-native';

/**
 * Bug 1 — the victory-CTA panel stacks vertically on narrow
 * screens. Tests assert these fields directly.
 */
export const victoryButtonsStyle: ViewStyle = {
  flexDirection: 'column',
  gap: 8,
  marginTop: 8,
  width: '100%',
};

/**
 * Minimum tap-target heights for the victory-card buttons. 48dp is
 * the Material Design accessibility minimum; we keep both buttons
 * above that bar even on small phones.
 */
export const buttonStyles: {
  primary: { minHeight: number } & FlexStyle;
  secondary: { minHeight: number } & FlexStyle;
} = {
  primary: { minHeight: 48, justifyContent: 'center', alignItems: 'center' },
  secondary: { minHeight: 48, justifyContent: 'center', alignItems: 'center' },
};
