/**
 * resolveMomentumAfterQuest — decay → gain → clamp → tier.
 */

import {
  momentumBalance,
  resolveMomentumAfterQuest,
} from '@dwhi/workout-domain';

describe('resolveMomentumAfterQuest — happy path', () => {
  test('no gap, full quest: gain only, tier potentially advances', () => {
    const out = resolveMomentumAfterQuest({
      priorMomentum: 35,
      daysSinceLastQuest: 1,
      questOutcome: 'full',
    });
    expect(out.before).toBe(35);
    expect(out.decayApplied).toBe(0);
    expect(out.afterDecay).toBe(35);
    expect(out.gainBreakdown.applied).toBe(6);
    expect(out.final).toBe(41);
    expect(out.tierBefore).toBe('steady');
    expect(out.tierAfter).toBe('driven');
    expect(out.tierChanged).toBe(true);
    expect(out.gentleModeActive).toBe(false);
  });

  test('return after 7 days: decay then gain w/ return bonus', () => {
    const out = resolveMomentumAfterQuest({
      priorMomentum: 60,
      daysSinceLastQuest: 7,
      questOutcome: 'full',
      isReturnQuest: true,
    });
    expect(out.decayApplied).toBeCloseTo(7.5, 5);
    expect(out.afterDecay).toBe(60 - 7.5);
    // gain uncapped = 6 + 8 = 14, applied = 10 (daily cap)
    expect(out.gainBreakdown.uncapped).toBe(14);
    expect(out.gainBreakdown.applied).toBe(10);
    expect(out.final).toBe(60 - 7.5 + 10);
    expect(out.gentleModeActive).toBe(true);
  });
});

describe('resolveMomentumAfterQuest — bounds & defenses', () => {
  test('momentum never falls below floor (5)', () => {
    const out = resolveMomentumAfterQuest({
      priorMomentum: 8,
      daysSinceLastQuest: 30,
      questOutcome: 'abandoned',
    });
    expect(out.afterDecay).toBe(momentumBalance.min);
    expect(out.final).toBe(momentumBalance.min);
  });

  test('momentum never exceeds ceiling (100)', () => {
    const out = resolveMomentumAfterQuest({
      priorMomentum: 99,
      daysSinceLastQuest: 0,
      questOutcome: 'full',
      isReturnQuest: false,
      disciplinedExit: true,
      varietyBonus: true,
      isFirstOfWeek: true,
    });
    expect(out.final).toBe(momentumBalance.max);
  });

  test('non-finite prior momentum falls back to startingValue', () => {
    const out = resolveMomentumAfterQuest({
      priorMomentum: Number.NaN,
      daysSinceLastQuest: 0,
      questOutcome: 'full',
    });
    expect(out.before).toBe(momentumBalance.startingValue);
  });

  test('gentleModeActive mirrors the isReturnQuest signal', () => {
    const a = resolveMomentumAfterQuest({
      priorMomentum: 30,
      daysSinceLastQuest: 5,
      questOutcome: 'full',
      isReturnQuest: true,
    });
    expect(a.gentleModeActive).toBe(true);

    const b = resolveMomentumAfterQuest({
      priorMomentum: 30,
      daysSinceLastQuest: 1,
      questOutcome: 'full',
      isReturnQuest: false,
    });
    expect(b.gentleModeActive).toBe(false);
  });
});

describe('resolveMomentumAfterQuest — daily cap', () => {
  test('gainedToday is honoured', () => {
    const out = resolveMomentumAfterQuest({
      priorMomentum: 50,
      daysSinceLastQuest: 0,
      questOutcome: 'full',
      disciplinedExit: true,
      varietyBonus: true,
      isFirstOfWeek: true,
      gainedToday: 7,
    });
    // uncapped = 6 + 1 + 1 + 1 = 9; remaining cap = 10 - 7 = 3 → applied 3
    expect(out.gainBreakdown.uncapped).toBe(9);
    expect(out.gainBreakdown.applied).toBe(3);
  });
});

describe('resolveMomentumAfterQuest — outcomes', () => {
  test('camp outcome', () => {
    const out = resolveMomentumAfterQuest({
      priorMomentum: 30,
      daysSinceLastQuest: 1,
      questOutcome: 'camp',
    });
    expect(out.gainBreakdown.applied).toBe(3);
  });

  test('partial outcome', () => {
    const out = resolveMomentumAfterQuest({
      priorMomentum: 30,
      daysSinceLastQuest: 1,
      questOutcome: 'partial',
    });
    expect(out.gainBreakdown.applied).toBe(3);
  });

  test('abandoned outcome grants 0 gain', () => {
    const out = resolveMomentumAfterQuest({
      priorMomentum: 30,
      daysSinceLastQuest: 1,
      questOutcome: 'abandoned',
    });
    expect(out.gainBreakdown.applied).toBe(0);
  });
});
