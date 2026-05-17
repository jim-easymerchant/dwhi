// Smoke tests for the @dwhi/ui boundary.
//
// React Native components transitively import the `react-native`
// runtime (which has no Node target). For a Jest-in-Node smoke test
// we deliberately don't load the component modules at runtime —
// instead we:
//   1. Verify the theme tokens (pure data) at runtime via the
//      sub-barrel `@dwhi/ui/theme`, which has no RN dependency.
//   2. Reference the component re-exports as `import type`, so a
//      typo in `packages/ui/src/components.ts` still fails
//      `tsc --noEmit`.
//
// We intentionally do NOT `import * as ui from '@dwhi/ui'` here —
// that pulls in the components sub-barrel which then loads
// `react-native`. Apps render UI through their own entry; smoke
// tests don't need a runtime React Native bridge.

import type {
  BigButton,
  Card,
  ScreenContainer,
  TextField,
} from '@dwhi/ui/components';
import * as theme from '@dwhi/ui/theme';

describe('@dwhi/ui theme', () => {
  test('theme tokens are exported from the sub-barrel', () => {
    expect(typeof theme.colors).toBe('object');
    expect(typeof theme.spacing).toBe('object');
    expect(typeof theme.radii).toBe('object');
    expect(typeof theme.typography).toBe('object');
  });

  test('palette has the expected keys', () => {
    expect(theme.colors.background).toBeDefined();
    expect(theme.colors.textPrimary).toBeDefined();
    expect(theme.colors.accent).toBeDefined();
    expect(theme.colors.danger).toBeDefined();
  });

  test('spacing scale is monotonically increasing', () => {
    expect(theme.spacing.xs).toBeLessThan(theme.spacing.sm);
    expect(theme.spacing.sm).toBeLessThan(theme.spacing.md);
    expect(theme.spacing.md).toBeLessThan(theme.spacing.lg);
  });
});

describe('@dwhi/ui components (compile-time)', () => {
  // The type references below are erased at runtime but kept by
  // TypeScript — they exist so `tsc --noEmit` catches a missing
  // re-export in packages/ui/src/components.ts.
  test('component types are referenced (compile-time guard)', () => {
    type _Smoke = [
      typeof BigButton,
      typeof Card,
      typeof ScreenContainer,
      typeof TextField,
    ];
    expect(true).toBe(true);
  });
});
