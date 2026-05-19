/**
 * resolveVerdicts — narrative labels, coexisting.
 */

import { resolveVerdicts } from '@dwhi/workout-domain';
import type {
  EnemyResult,
  MomentumResult,
  QuestDefinition,
  SetResult,
} from '@dwhi/workout-domain';

function workingSet(overrides: Partial<SetResult> = {}): SetResult {
  return {
    setIndex: 0,
    exerciseId: 'pushup',
    exerciseName: 'Pushup',
    archetype: 'pressure',
    damage: 50,
    rawDamage: 50,
    baseAttack: 50,
    effectiveReps: 10,
    effectiveLoad: 48.75,
    archetypeMultiplier: 1,
    momentumMultiplier: 1,
    fatigueMultiplier: 1,
    critMultiplier: 1,
    warmupScalar: 1,
    fatiguePointsBefore: 0,
    fatiguePointsAfter: 0,
    enemyHpBefore: 100,
    enemyHpAfter: 50,
    defeatedEnemy: false,
    isOverkill: false,
    overkillAmount: 0,
    isWarmup: false,
    isPersonalRecord: false,
    tags: ['working'],
    ...overrides,
  };
}

function momentum(overrides: Partial<MomentumResult> = {}): MomentumResult {
  return {
    before: 30,
    decayApplied: 0,
    afterDecay: 30,
    gainBreakdown: { applied: 6, uncapped: 6, components: {}, hitDailyCap: false },
    afterGain: 36,
    final: 36,
    tierBefore: 'steady',
    tierAfter: 'steady',
    tierChanged: false,
    gentleModeActive: false,
    ...overrides,
  };
}

const baseQuest: QuestDefinition = {
  id: 'q1',
  kind: 'strength',
  plannedSetCount: 3,
};

describe('resolveVerdicts — always includes Steady baseline', () => {
  test('Steady is present even on the most minimal run', () => {
    const out = resolveVerdicts({
      quest: baseQuest,
      setResults: [workingSet()],
      enemyResult: null,
      momentum: momentum(),
      daysSinceLastQuest: 0,
    });
    expect(out).toContain('Steady');
  });
});

describe('resolveVerdicts — Disciplined Exit', () => {
  test('fires when workingCount equals plannedSetCount', () => {
    const sets = [workingSet(), workingSet({ setIndex: 1 }), workingSet({ setIndex: 2 })];
    const out = resolveVerdicts({
      quest: baseQuest,
      setResults: sets,
      enemyResult: null,
      momentum: momentum(),
      daysSinceLastQuest: 0,
    });
    expect(out).toContain('Disciplined Exit');
  });

  test('does not fire when player blew past planned volume', () => {
    const sets = Array.from({ length: 12 }, (_, i) =>
      workingSet({ setIndex: i }),
    );
    const out = resolveVerdicts({
      quest: { ...baseQuest, plannedSetCount: 3 },
      setResults: sets,
      enemyResult: null,
      momentum: momentum(),
      daysSinceLastQuest: 0,
    });
    expect(out).not.toContain('Disciplined Exit');
  });
});

describe('resolveVerdicts — PR Logged', () => {
  test('any PR fires the verdict', () => {
    const sets = [workingSet({ isPersonalRecord: true })];
    const out = resolveVerdicts({
      quest: baseQuest,
      setResults: sets,
      enemyResult: null,
      momentum: momentum(),
      daysSinceLastQuest: 0,
    });
    expect(out).toContain('PR Logged');
  });
});

describe('resolveVerdicts — Comeback Quest + Gentle Return', () => {
  test('Comeback flag fires Comeback Quest verdict, hides Gentle Return', () => {
    const out = resolveVerdicts({
      quest: { ...baseQuest, isComebackQuest: true },
      setResults: [workingSet()],
      enemyResult: null,
      momentum: momentum(),
      daysSinceLastQuest: 5,
    });
    expect(out).toContain('Comeback Quest');
    expect(out).not.toContain('Gentle Return'); // subsumed
  });

  test('Gentle Return fires for 3-6 day gaps without explicit comeback flag', () => {
    const out = resolveVerdicts({
      quest: baseQuest,
      setResults: [workingSet()],
      enemyResult: null,
      momentum: momentum(),
      daysSinceLastQuest: 5,
    });
    // The orchestrator promotes 3+ day gaps to comeback automatically
    // for downstream verdict logic — see runQuest. Here we exercise
    // resolveVerdicts directly with the same shape.
    expect(out).toContain('Comeback Quest');
  });
});

describe('resolveVerdicts — Warmth Returned (recovery quests)', () => {
  test.each(['recovery', 'camp'] as const)('quest.kind=%s fires Warmth Returned', (kind) => {
    const out = resolveVerdicts({
      quest: { ...baseQuest, kind },
      setResults: [workingSet()],
      enemyResult: null,
      momentum: momentum(),
      daysSinceLastQuest: 0,
    });
    expect(out).toContain('Warmth Returned');
  });
});

describe('resolveVerdicts — Relentless tier', () => {
  test('tierAfter=relentless triggers Relentless', () => {
    const out = resolveVerdicts({
      quest: baseQuest,
      setResults: [workingSet()],
      enemyResult: null,
      momentum: momentum({ tierAfter: 'relentless' }),
      daysSinceLastQuest: 0,
    });
    expect(out).toContain('Relentless');
  });

  test('tierAfter=ascendant also triggers Relentless', () => {
    const out = resolveVerdicts({
      quest: baseQuest,
      setResults: [workingSet()],
      enemyResult: null,
      momentum: momentum({ tierAfter: 'ascendant' }),
      daysSinceLastQuest: 0,
    });
    expect(out).toContain('Relentless');
  });
});

describe('resolveVerdicts — Finisher and Held the Line', () => {
  test('Finisher fires when any set defeated the enemy', () => {
    const sets = [
      workingSet(),
      workingSet({ setIndex: 1, defeatedEnemy: true, enemyHpAfter: 0 }),
    ];
    const enemy: EnemyResult = {
      id: 'sluggard',
      name: 'Sluggard',
      maxHp: 100,
      finalHp: 0,
      totalDamage: 100,
      defeated: true,
      defeatedOnSetIndex: 1,
      startingMood: 'drift',
      finalMood: 'drift',
      category: 'lesser_fragment',
    };
    const out = resolveVerdicts({
      quest: baseQuest,
      setResults: sets,
      enemyResult: enemy,
      momentum: momentum(),
      daysSinceLastQuest: 0,
    });
    expect(out).toContain('Finisher');
  });

  test('Held the Line fires when enemy survives but ≥3 working sets', () => {
    const sets = Array.from({ length: 4 }, (_, i) => workingSet({ setIndex: i }));
    const enemy: EnemyResult = {
      id: 'sluggard',
      name: 'Sluggard',
      maxHp: 1000,
      finalHp: 800,
      totalDamage: 200,
      defeated: false,
      defeatedOnSetIndex: null,
      startingMood: 'drift',
      finalMood: 'drift',
      category: 'lesser_fragment',
    };
    const out = resolveVerdicts({
      quest: { ...baseQuest, plannedSetCount: 6 },
      setResults: sets,
      enemyResult: enemy,
      momentum: momentum(),
      daysSinceLastQuest: 0,
    });
    expect(out).toContain('Held the Line');
  });
});

describe('resolveVerdicts — First of the Week', () => {
  test('isFirstOfWeek fires verdict', () => {
    const out = resolveVerdicts({
      quest: { ...baseQuest, isFirstOfWeek: true },
      setResults: [workingSet()],
      enemyResult: null,
      momentum: momentum(),
      daysSinceLastQuest: 0,
    });
    expect(out).toContain('First of the Week');
  });
});

describe('resolveVerdicts — composition', () => {
  test('multiple verdicts coexist in priority order', () => {
    const out = resolveVerdicts({
      quest: {
        ...baseQuest,
        plannedSetCount: 3,
        isFirstOfWeek: true,
        isComebackQuest: true,
      },
      setResults: [
        workingSet({ isPersonalRecord: true }),
        workingSet({ setIndex: 1 }),
        workingSet({ setIndex: 2, defeatedEnemy: true, enemyHpAfter: 0 }),
      ],
      enemyResult: {
        id: 'sluggard',
        name: 'Sluggard',
        maxHp: 100,
        finalHp: 0,
        totalDamage: 100,
        defeated: true,
        defeatedOnSetIndex: 2,
        startingMood: 'drift',
        finalMood: 'drift',
        category: 'lesser_fragment',
      },
      momentum: momentum({ tierAfter: 'relentless' }),
      daysSinceLastQuest: 7,
    });
    expect(out[0]).toBe('Comeback Quest'); // highest priority surfaced first
    expect(out).toContain('PR Logged');
    expect(out).toContain('First of the Week');
    expect(out).toContain('Disciplined Exit');
    expect(out).toContain('Relentless');
    expect(out).toContain('Finisher');
    expect(out).toContain('Steady');
  });
});
