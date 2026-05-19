/**
 * Screen smoke tests — type-only.
 *
 * We deliberately do NOT runtime-import the screen modules (they
 * pull `react-native`, which the Node Jest environment has no
 * bridge for). The references below are erased at runtime but
 * preserved by TypeScript, so a missing export fails
 * `tsc --noEmit`.
 *
 * This mirrors the convention used by `packages/ui/src/__tests__/barrel.test.ts`.
 */

import type { BattleScreen } from '../screens/BattleScreen';
import type { HomeScreen } from '../screens/HomeScreen';
import type { RestScreen } from '../screens/RestScreen';
import type { RewardScreen } from '../screens/RewardScreen';

describe('Workout screens — exports exist (compile-time guard)', () => {
  test('each screen module exports the expected symbol', () => {
    type _Smoke = [
      typeof HomeScreen,
      typeof BattleScreen,
      typeof RestScreen,
      typeof RewardScreen,
    ];
    expect(true).toBe(true);
  });
});
