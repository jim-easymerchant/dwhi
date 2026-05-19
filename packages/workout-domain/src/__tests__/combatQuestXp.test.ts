/**
 * Quest XP aggregator unit tests.
 *
 * docs/workout-rpg/003-combat-mechanics.md §6
 * docs/workout-rpg/011-progression-and-rewards.md §6, §7
 */

import { calculateQuestXp, combatBalance } from '@dwhi/workout-domain';
import type { QuestSetSummary } from '@dwhi/workout-domain';

const set = (
  damage: number,
  archetype: QuestSetSummary['archetype'] = 'pressure',
): QuestSetSummary => ({ damage, archetype });

describe('calculateQuestXp — base aggregation', () => {
  test('sum of damage * xpRate, no bonuses, no penalty', () => {
    const out = calculateQuestXp({
      workingSets: [set(100), set(100), set(100)],
      plannedSetCount: 3,
      exitedAtPlannedVolume: false,
    });
    // 300 damage * 0.1 = 30 XP
    expect(out.rawDamage).toBe(300);
    expect(out.taperedDamage).toBe(300);
    expect(out.xp).toBe(30);
    expect(out.varietyBonus).toBe(1.0);
    expect(out.disciplinedExitBonus).toBe(1.0);
    expect(out.comebackBonus).toBe(1.0);
    expect(out.junkVolumePenalty).toBe(0);
    expect(out.setsBeyondSoftCap).toBe(0);
  });

  test('warmup sets are excluded from XP totals', () => {
    const out = calculateQuestXp({
      workingSets: [
        { ...set(20), isWarmup: true },
        { ...set(20), isWarmup: true },
        set(100),
      ],
      plannedSetCount: 1,
      exitedAtPlannedVolume: true,
    });
    // Only 1 working set @ 100 damage. 100 * 0.1 * 1.1 = 11.
    expect(out.rawDamage).toBe(100);
    expect(out.xp).toBe(11);
    expect(out.setCountForVolume).toBe(1);
  });
});

describe('calculateQuestXp — variety bonus (archetype-aware)', () => {
  test('three pressure exercises count as 1 distinct archetype (no bonus beyond base)', () => {
    const out = calculateQuestXp({
      workingSets: [
        set(100, 'pressure'),
        set(100, 'pressure'),
        set(100, 'pressure'),
      ],
      plannedSetCount: 3,
      exitedAtPlannedVolume: false,
    });
    expect(out.distinctArchetypes).toBe(1);
    expect(out.varietyBonus).toBe(1.0);
  });

  test('three different archetypes grant +10% (2 distinct beyond the first × 0.05)', () => {
    const out = calculateQuestXp({
      workingSets: [
        set(100, 'pressure'),
        set(100, 'heavy'),
        set(100, 'control'),
      ],
      plannedSetCount: 3,
      exitedAtPlannedVolume: false,
    });
    expect(out.distinctArchetypes).toBe(3);
    expect(out.varietyBonus).toBeCloseTo(1.1, 5);
  });

  test('variety bonus caps at +25%', () => {
    const out = calculateQuestXp({
      workingSets: [
        set(50, 'pressure'),
        set(50, 'heavy'),
        set(50, 'control'),
        set(50, 'foundation'),
        set(50, 'endurance'),
        set(50, 'recovery'),
      ],
      plannedSetCount: 6,
      exitedAtPlannedVolume: false,
    });
    expect(out.distinctArchetypes).toBe(6);
    expect(out.varietyBonus).toBe(1.25);
  });
});

describe('calculateQuestXp — disciplined exit + comeback bonuses', () => {
  test('disciplined exit applies +10%', () => {
    const out = calculateQuestXp({
      workingSets: [set(100), set(100)],
      plannedSetCount: 2,
      exitedAtPlannedVolume: true,
    });
    // 200 * 0.1 * 1.1 = 22
    expect(out.disciplinedExitBonus).toBe(1.1);
    expect(out.xp).toBe(22);
  });

  test('comeback Quest applies +20% on top of base', () => {
    const out = calculateQuestXp({
      workingSets: [set(100)],
      plannedSetCount: 1,
      exitedAtPlannedVolume: false,
      isComebackQuest: true,
    });
    // 100 * 0.1 * 1.2 = 12
    expect(out.comebackBonus).toBe(1.2);
    expect(out.xp).toBe(12);
  });

  test('all bonuses compose: disciplined + comeback + variety', () => {
    const out = calculateQuestXp({
      workingSets: [
        set(100, 'pressure'),
        set(100, 'heavy'),
        set(100, 'control'),
      ],
      plannedSetCount: 3,
      exitedAtPlannedVolume: true,
      isComebackQuest: true,
    });
    // 300 * 0.1 * 1.1 (variety) * 1.1 (disciplined) * 1.2 (comeback) = 43.56
    expect(out.xp).toBe(43);
  });
});

describe('calculateQuestXp — soft cap taper', () => {
  test('XP at planned: full rate', () => {
    const out = calculateQuestXp({
      workingSets: Array.from({ length: 10 }, () => set(100)),
      plannedSetCount: 10,
      exitedAtPlannedVolume: true,
    });
    expect(out.taperedDamage).toBe(1000);
    expect(out.setsBeyondSoftCap).toBe(0);
  });

  test('XP tapers linearly across the overshoot window', () => {
    // Planned 10, overshoot range = ceil(10 * 0.3) = 3.
    // Set 11 scalar: 1 - 0.5/3 * 1 = 0.833...
    // Set 12 scalar: 1 - 0.5/3 * 2 = 0.666...
    // Set 13 scalar: 0.5
    // Set 14+ scalar: 0
    const out = calculateQuestXp({
      workingSets: Array.from({ length: 15 }, () => set(100)),
      plannedSetCount: 10,
      exitedAtPlannedVolume: false,
    });
    expect(out.setsBeyondSoftCap).toBe(2); // sets 14 and 15
    // tapered damage = 10 * 100 + 100 * (0.833+0.666+0.5) + 2 * 0 = 1200
    expect(out.taperedDamage).toBeCloseTo(1200, 5);
  });
});

describe('calculateQuestXp — junk volume penalty', () => {
  test('no penalty up to junk-volume floor', () => {
    const out = calculateQuestXp({
      workingSets: Array.from({ length: 12 }, () => set(100)),
      plannedSetCount: 12,
      exitedAtPlannedVolume: true,
    });
    expect(out.junkVolumePenalty).toBe(0);
  });

  test('penalty kicks in at planned-or-junk-floor, whichever is larger', () => {
    // Planned 14, junk floor 12 → penalty floor = 14.
    // 15 working sets → 1 penalty set → -5 XP.
    const out = calculateQuestXp({
      workingSets: Array.from({ length: 15 }, () => set(100)),
      plannedSetCount: 14,
      exitedAtPlannedVolume: false,
    });
    expect(out.junkVolumePenalty).toBe(5);
  });

  test('gentleMode (suppressJunkPenalty) zeroes the penalty', () => {
    const out = calculateQuestXp({
      workingSets: Array.from({ length: 20 }, () => set(100)),
      plannedSetCount: 10,
      exitedAtPlannedVolume: false,
      suppressJunkPenalty: true,
    });
    expect(out.junkVolumePenalty).toBe(0);
  });

  test('recovery Quest suppresses penalty implicitly', () => {
    const out = calculateQuestXp({
      workingSets: Array.from({ length: 20 }, () => set(0, 'recovery')),
      plannedSetCount: 5,
      exitedAtPlannedVolume: false,
      isRecoveryQuest: true,
    });
    expect(out.junkVolumePenalty).toBe(0);
    expect(out.xp).toBe(0);
  });
});

describe('calculateQuestXp — safety', () => {
  test('zero working sets returns 0 XP', () => {
    const out = calculateQuestXp({
      workingSets: [],
      plannedSetCount: 0,
      exitedAtPlannedVolume: false,
    });
    expect(out.xp).toBe(0);
    expect(out.rawDamage).toBe(0);
  });

  test('XP is always a non-negative integer', () => {
    const out = calculateQuestXp({
      workingSets: [set(13.7), set(11.3)],
      plannedSetCount: 2,
      exitedAtPlannedVolume: false,
    });
    expect(Number.isInteger(out.xp)).toBe(true);
    expect(out.xp).toBeGreaterThanOrEqual(0);
  });

  test('balance constants are accessible alongside xp output', () => {
    expect(combatBalance.xpRate).toBe(0.1);
    expect(combatBalance.junkVolumeSetFloor).toBe(12);
  });
});
