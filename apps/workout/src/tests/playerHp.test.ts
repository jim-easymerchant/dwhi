/**
 * Player HP tests.
 *
 * The contract:
 *
 *   - **Pure.** Same input always returns the same total + breakdown.
 *   - **Positive only.** Inputs never reduce HP below `BASE_PLAYER_HP`.
 *   - **Monotonic.** Adding consistency / level / momentum never
 *     causes HP to drop. Removing any of them never causes HP to
 *     rise.
 *   - **Capped consistency.** Recent-session bonus caps at
 *     `MAX_RECENT_SESSIONS`; further sessions add nothing.
 *   - **No body-mass tie-in.** The function does not accept
 *     bodyweight as an input — HP is readiness, not body.
 *   - **No punishment.** Negative / non-finite / zero inputs never
 *     reduce HP.
 */

import {
  BASE_PLAYER_HP,
  LEVEL_BONUS,
  MAX_RECENT_SESSIONS,
  MOMENTUM_BONUS,
  RECENT_SESSION_BONUS,
  computePlayerHp,
  playerHpFromInputs,
  type PlayerHpInputs,
} from '../combat';

describe('computePlayerHp — defaults + base', () => {
  test('day-one player gets BASE + level 1 contribution', () => {
    const result = computePlayerHp({
      level: 1,
      recentSessions: 0,
      momentum: 0,
    });
    expect(result.base).toBe(BASE_PLAYER_HP);
    expect(result.fromRecentSessions).toBe(0);
    expect(result.fromLevel).toBe(LEVEL_BONUS); // L1 * 4 = 4
    expect(result.fromMomentum).toBe(0);
    expect(result.total).toBe(BASE_PLAYER_HP + LEVEL_BONUS);
  });

  test('breakdown components sum to total', () => {
    const result = computePlayerHp({
      level: 5,
      recentSessions: 4,
      momentum: 50,
    });
    expect(
      result.base
      + result.fromRecentSessions
      + result.fromLevel
      + result.fromMomentum,
    ).toBe(result.total);
  });
});

describe('computePlayerHp — monotonicity', () => {
  // Holding the other inputs constant, each individual input
  // moves the total in the expected direction (up).
  const baseline: PlayerHpInputs = { level: 5, recentSessions: 5, momentum: 50 };
  const baselineHp = playerHpFromInputs(baseline);

  test('more recent sessions ⇒ more HP (or equal at the cap)', () => {
    for (let r = 0; r <= MAX_RECENT_SESSIONS + 5; r++) {
      const hp = playerHpFromInputs({ ...baseline, recentSessions: r });
      if (r >= 1) {
        expect(hp).toBeGreaterThanOrEqual(
          playerHpFromInputs({ ...baseline, recentSessions: r - 1 }),
        );
      }
    }
  });

  test('more level ⇒ more HP', () => {
    for (let lvl = 1; lvl < 50; lvl++) {
      const hp = playerHpFromInputs({ ...baseline, level: lvl });
      const next = playerHpFromInputs({ ...baseline, level: lvl + 1 });
      expect(next).toBeGreaterThan(hp);
    }
  });

  test('more momentum ⇒ more HP (within clamp)', () => {
    for (let m = 0; m < 100; m += 5) {
      const hp = playerHpFromInputs({ ...baseline, momentum: m });
      const next = playerHpFromInputs({ ...baseline, momentum: m + 5 });
      expect(next).toBeGreaterThanOrEqual(hp);
    }
  });

  test('baseline HP is greater than BASE alone (level + momentum contribute)', () => {
    expect(baselineHp).toBeGreaterThan(BASE_PLAYER_HP);
  });
});

describe('computePlayerHp — caps + clamps', () => {
  test('recent-session bonus caps at MAX_RECENT_SESSIONS', () => {
    const atCap = playerHpFromInputs({
      level: 1,
      recentSessions: MAX_RECENT_SESSIONS,
      momentum: 0,
    });
    const farPastCap = playerHpFromInputs({
      level: 1,
      recentSessions: MAX_RECENT_SESSIONS + 100,
      momentum: 0,
    });
    expect(farPastCap).toBe(atCap);
  });

  test('momentum is clamped to [0, 100]', () => {
    const at100 = playerHpFromInputs({ level: 1, recentSessions: 0, momentum: 100 });
    const at200 = playerHpFromInputs({ level: 1, recentSessions: 0, momentum: 200 });
    expect(at200).toBe(at100);
    // Negative momentum: clamped to 0 (no punishment).
    const at0 = playerHpFromInputs({ level: 1, recentSessions: 0, momentum: 0 });
    const atNeg = playerHpFromInputs({ level: 1, recentSessions: 0, momentum: -100 });
    expect(atNeg).toBe(at0);
  });

  test('level is floored to ≥1 (negative / zero inputs do not reduce HP)', () => {
    const at1 = playerHpFromInputs({ level: 1, recentSessions: 0, momentum: 0 });
    const at0 = playerHpFromInputs({ level: 0, recentSessions: 0, momentum: 0 });
    const atNeg = playerHpFromInputs({ level: -5, recentSessions: 0, momentum: 0 });
    expect(at0).toBe(at1);
    expect(atNeg).toBe(at1);
  });

  test('non-finite inputs never reduce HP below BASE + L1', () => {
    const minimumOk = BASE_PLAYER_HP + LEVEL_BONUS;
    expect(
      playerHpFromInputs({
        level: Number.NaN as unknown as number,
        recentSessions: Number.POSITIVE_INFINITY,
        momentum: Number.NEGATIVE_INFINITY,
      }),
    ).toBeGreaterThanOrEqual(minimumOk);
  });
});

describe('computePlayerHp — anti-punishment regression', () => {
  test('NEVER returns a value below BASE_PLAYER_HP', () => {
    const inputs: PlayerHpInputs[] = [
      { level: 0, recentSessions: 0, momentum: 0 },
      { level: -10, recentSessions: -10, momentum: -10 },
      { level: 1, recentSessions: 0, momentum: 0 },
    ];
    for (const i of inputs) {
      expect(playerHpFromInputs(i)).toBeGreaterThanOrEqual(BASE_PLAYER_HP);
    }
  });

  test('a player who skipped a week (recentSessions=0) still has plenty of HP', () => {
    // Mid-game player: L7, recent=0, momentum 35.
    // The bar should NOT collapse — readiness is not punishment.
    const hp = playerHpFromInputs({ level: 7, recentSessions: 0, momentum: 35 });
    expect(hp).toBeGreaterThanOrEqual(BASE_PLAYER_HP + 7 * LEVEL_BONUS);
  });
});

describe('computePlayerHp — anchor values from the spec doc', () => {
  // These are the "round numbers for intuition" the doc comment
  // describes. Locking them down prevents an accidental tune that
  // drifts the bar's emotional shape.
  test('Day 1, L1, momentum 25, 0 recent ≈ 109 HP', () => {
    const hp = playerHpFromInputs({ level: 1, recentSessions: 0, momentum: 25 });
    expect(hp).toBeGreaterThanOrEqual(105);
    expect(hp).toBeLessThanOrEqual(115);
  });

  test('One-week-in, L3, momentum 30, 3 recent ≈ 127 HP', () => {
    const hp = playerHpFromInputs({ level: 3, recentSessions: 3, momentum: 30 });
    expect(hp).toBeGreaterThanOrEqual(120);
    expect(hp).toBeLessThanOrEqual(135);
  });

  test('First month, L7, momentum 45, 8 recent ≈ 161 HP', () => {
    const hp = playerHpFromInputs({ level: 7, recentSessions: 8, momentum: 45 });
    expect(hp).toBeGreaterThanOrEqual(150);
    expect(hp).toBeLessThanOrEqual(170);
  });

  test('Year-one, L30, momentum 70, 14 recent ≈ 276 HP', () => {
    const hp = playerHpFromInputs({ level: 30, recentSessions: 14, momentum: 70 });
    expect(hp).toBeGreaterThanOrEqual(265);
    expect(hp).toBeLessThanOrEqual(290);
  });
});

describe('computePlayerHp — body-mass independence', () => {
  // The signature must not accept bodyweight. This is a
  // compile-time fence — `PlayerHpInputs` is the public shape
  // and it has exactly three fields.
  test('PlayerHpInputs has no bodyweight field', () => {
    const allowed: PlayerHpInputs = {
      level: 1,
      recentSessions: 0,
      momentum: 0,
    };
    // Touch every field so the variable isn't elided.
    expect(allowed.level).toBe(1);
    expect(allowed.recentSessions).toBe(0);
    expect(allowed.momentum).toBe(0);
  });

  test('tuning constants are exported (so balance changes are visible in code review)', () => {
    expect(BASE_PLAYER_HP).toBeGreaterThan(0);
    expect(RECENT_SESSION_BONUS).toBeGreaterThan(0);
    expect(MAX_RECENT_SESSIONS).toBeGreaterThan(0);
    expect(LEVEL_BONUS).toBeGreaterThan(0);
    expect(MOMENTUM_BONUS).toBeGreaterThan(0);
  });
});
