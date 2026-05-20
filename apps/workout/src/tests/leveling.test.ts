/**
 * Leveling-curve tests.
 *
 * Pins the curve formula and the anchor points described in the
 * brief:
 *   - 1 short workout should not jump more than 1-2 levels.
 *   - Level 10 should require multiple sessions.
 *   - Level 30 should represent sustained history, not 3 battles.
 *
 * Deterministic, monotonically increasing, non-punitive (no
 * decay), pure.
 */

import {
  LEVEL_CURVE_BASE,
  LEVEL_CURVE_EXPONENT,
  describeLevelProgress,
  levelForCumulativeXp,
  xpForLevel,
} from '../leveling';

describe('xpForLevel — anchors + monotonicity', () => {
  test('Level 1 requires 0 XP', () => {
    expect(xpForLevel(1)).toBe(0);
  });

  test('Level 2 is reachable after a single quest (≤80 XP)', () => {
    expect(xpForLevel(2)).toBeLessThanOrEqual(80);
    expect(xpForLevel(2)).toBeGreaterThan(0);
  });

  test('Level 10 sits between ~400 and ~1500 XP', () => {
    const x = xpForLevel(10);
    expect(x).toBeGreaterThanOrEqual(400);
    expect(x).toBeLessThanOrEqual(1500);
  });

  test('Level 30 sits between ~2,000 and ~8,000 XP (sustained history)', () => {
    const x = xpForLevel(30);
    expect(x).toBeGreaterThanOrEqual(2000);
    expect(x).toBeLessThanOrEqual(8000);
  });

  test('Curve is strictly increasing for the first 100 levels', () => {
    for (let n = 1; n < 100; n++) {
      expect(xpForLevel(n + 1)).toBeGreaterThan(xpForLevel(n));
    }
  });

  test('Constants stay in their published ranges', () => {
    expect(LEVEL_CURVE_BASE).toBeGreaterThan(0);
    expect(LEVEL_CURVE_EXPONENT).toBeGreaterThan(1);
    expect(LEVEL_CURVE_EXPONENT).toBeLessThan(2);
  });
});

describe('levelForCumulativeXp — inverse of xpForLevel', () => {
  test('0 XP → level 1', () => {
    expect(levelForCumulativeXp(0)).toBe(1);
    expect(levelForCumulativeXp(-100)).toBe(1);
    expect(levelForCumulativeXp(Number.NaN)).toBe(1);
  });

  test('round-trips xpForLevel(N) → N for every level 1..60', () => {
    for (let n = 1; n <= 60; n++) {
      expect(levelForCumulativeXp(xpForLevel(n))).toBe(n);
    }
  });

  test('one XP below the threshold still on the previous level', () => {
    for (let n = 2; n <= 30; n++) {
      const threshold = xpForLevel(n);
      expect(levelForCumulativeXp(threshold - 1)).toBe(n - 1);
      expect(levelForCumulativeXp(threshold)).toBe(n);
    }
  });

  test('monotonic non-decreasing on a dense XP sweep', () => {
    let last = 1;
    for (let xp = 0; xp <= 10_000; xp += 17) {
      const lvl = levelForCumulativeXp(xp);
      expect(lvl).toBeGreaterThanOrEqual(last);
      last = lvl;
    }
  });
});

describe('product brief — sane gain shape', () => {
  // The brief: ~3 short battles must NOT yield level 30. A short
  // battle earns roughly 30-80 XP in the current orchestrator.
  // We assert two anti-regression bounds at common XP totals.

  const SHORT_QUEST_XP = 60;

  test('three short battles total puts the player around L2-L5 (not L30)', () => {
    const after = levelForCumulativeXp(3 * SHORT_QUEST_XP);
    expect(after).toBeGreaterThanOrEqual(2);
    expect(after).toBeLessThan(10);
  });

  test('one short battle moves the player by at most 2 levels from L1', () => {
    const startLevel = levelForCumulativeXp(0);
    const afterLevel = levelForCumulativeXp(SHORT_QUEST_XP);
    expect(afterLevel - startLevel).toBeLessThanOrEqual(2);
    expect(afterLevel - startLevel).toBeGreaterThanOrEqual(1);
  });

  test('reaching level 10 takes at least ~5 short battles', () => {
    for (let q = 1; q <= 5; q++) {
      expect(levelForCumulativeXp(q * SHORT_QUEST_XP)).toBeLessThan(10);
    }
  });

  test('reaching level 30 takes at least ~30 short battles ("sustained history")', () => {
    expect(levelForCumulativeXp(20 * SHORT_QUEST_XP)).toBeLessThan(30);
  });
});

describe('describeLevelProgress', () => {
  test('progress is 0 at the floor of the level', () => {
    const p = describeLevelProgress(xpForLevel(5));
    expect(p.level).toBe(5);
    expect(p.progress).toBe(0);
    expect(p.xpIntoLevel).toBe(0);
  });

  test('progress approaches 1 just below the next level', () => {
    const p = describeLevelProgress(xpForLevel(6) - 1);
    expect(p.level).toBe(5);
    expect(p.progress).toBeGreaterThan(0.9);
    expect(p.progress).toBeLessThanOrEqual(1);
  });

  test('xpToNextLevel never goes negative', () => {
    for (const xp of [0, 1, 50, 100, 1000, 10_000]) {
      const p = describeLevelProgress(xp);
      expect(p.xpToNextLevel).toBeGreaterThanOrEqual(0);
    }
  });

  test('non-finite + negative inputs collapse to level 1, progress 0', () => {
    const p = describeLevelProgress(Number.NaN);
    expect(p.level).toBe(1);
    expect(p.progress).toBe(0);
  });
});
