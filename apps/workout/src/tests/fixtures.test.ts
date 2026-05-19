/**
 * Push Day fixture shape tests — open-ended encounter model.
 */

import {
  DEFAULT_BODYWEIGHT_KG,
  DEFAULT_PRIOR_MOMENTUM,
  EXERCISE_PROFILES,
  LINGERING_SHADOW,
  MIN_CONTINUATION_HP,
  PUSH_BODYWEIGHT_STRATEGIES,
  PUSH_DAY_QUEST,
  PUSH_ENCOUNTER,
  PUSH_WEIGHTED_VARIANTS,
  SLUGGARD,
  findVariant,
  getNextEnemyPhase,
  variantsFor,
} from '../fixtures/pushDayQuest';

describe('PUSH_DAY_QUEST', () => {
  test('shape', () => {
    expect(PUSH_DAY_QUEST.id).toBe('push-day');
    expect(PUSH_DAY_QUEST.kind).toBe('strength');
    expect(PUSH_DAY_QUEST.plannedSetCount).toBeGreaterThan(0);
  });
});

describe('Enemies', () => {
  test('Sluggard is the primary enemy', () => {
    expect(SLUGGARD.id).toBe('sluggard');
    expect(SLUGGARD.name).toMatch(/Sluggard/);
    expect(SLUGGARD.mood).toBe('drift');
    expect(SLUGGARD.category).toBe('lesser_fragment');
    expect(SLUGGARD.maxHp).toBeGreaterThan(0);
  });

  test('Lingering Shadow is the continuation fragment', () => {
    expect(LINGERING_SHADOW.id).toBe('sluggard-shadow');
    expect(LINGERING_SHADOW.mood).toBe('hush');
    expect(LINGERING_SHADOW.maxHp).toBeLessThan(SLUGGARD.maxHp);
  });

  test('getNextEnemyPhase halves max HP, floored at MIN_CONTINUATION_HP', () => {
    const a = getNextEnemyPhase(SLUGGARD.maxHp);
    expect(a.maxHp).toBe(Math.floor(SLUGGARD.maxHp / 2));
    const b = getNextEnemyPhase(a.maxHp);
    expect(b.maxHp).toBe(Math.floor(a.maxHp / 2));
    // Long chain: floor kicks in.
    let cur = 1000;
    for (let i = 0; i < 20; i++) {
      cur = getNextEnemyPhase(cur).maxHp;
    }
    expect(cur).toBe(MIN_CONTINUATION_HP);
  });
});

describe('PUSH_ENCOUNTER', () => {
  test('has both strategy and equipment lists, plus the primary enemy', () => {
    expect(PUSH_ENCOUNTER.id).toBe('push');
    expect(PUSH_ENCOUNTER.primaryEnemy.id).toBe('sluggard');
    expect(PUSH_ENCOUNTER.bodyweightStrategies.length).toBeGreaterThanOrEqual(3);
    expect(PUSH_ENCOUNTER.weightedVariants.length).toBeGreaterThanOrEqual(3);
  });

  test('each bodyweight strategy has a positive bodyweight coefficient', () => {
    for (const v of PUSH_BODYWEIGHT_STRATEGIES) {
      expect(v.profile.bodyweightCoefficient).toBeGreaterThan(0);
      expect(v.defaultWeightKg).toBe(0);
    }
  });

  test('each weighted variant has a positive defaultWeightKg', () => {
    for (const v of PUSH_WEIGHTED_VARIANTS) {
      expect(v.defaultWeightKg).toBeGreaterThan(0);
    }
  });

  test('strategy ids include the canonical MVP set', () => {
    const ids = PUSH_BODYWEIGHT_STRATEGIES.map((v) => v.id);
    expect(ids).toContain('pushup');
    expect(ids).toContain('pike-pushup');
    expect(ids).toContain('diamond-pushup');
  });
});

describe('EXERCISE_PROFILES', () => {
  test.each([
    ['bench', 8, 0],
    ['pushup', 8, 0.65],
    ['shoulderPress', 6, 0],
    ['pikePushup', 6, 0.6],
    ['tricepsExtension', 4, 0],
    ['diamondPushup', 4, 0.65],
  ] as const)('%s profile matches docs 003 §2.2', (name, loadScale, bwCoef) => {
    const p = EXERCISE_PROFILES[name];
    expect(p.loadScale).toBe(loadScale);
    expect(p.bodyweightCoefficient).toBe(bwCoef);
  });
});

describe('variantsFor / findVariant', () => {
  test('variantsFor picks the right list per modality', () => {
    expect(variantsFor(PUSH_ENCOUNTER, 'bodyweight')).toBe(
      PUSH_ENCOUNTER.bodyweightStrategies,
    );
    expect(variantsFor(PUSH_ENCOUNTER, 'weighted')).toBe(
      PUSH_ENCOUNTER.weightedVariants,
    );
  });

  test('findVariant resolves a known id', () => {
    expect(findVariant(PUSH_ENCOUNTER, 'bodyweight', 'diamond-pushup').name).toBe(
      'Diamond Pushup',
    );
  });

  test('findVariant falls back to the first variant on unknown id', () => {
    const fallback = findVariant(PUSH_ENCOUNTER, 'weighted', 'no-such-variant');
    expect(fallback).toBe(PUSH_ENCOUNTER.weightedVariants[0]);
  });
});

describe('defaults', () => {
  test('starting momentum sits in Steady', () => {
    expect(DEFAULT_PRIOR_MOMENTUM).toBeGreaterThanOrEqual(20);
    expect(DEFAULT_PRIOR_MOMENTUM).toBeLessThan(40);
  });

  test('default bodyweight matches the combat balance default', () => {
    expect(DEFAULT_BODYWEIGHT_KG).toBe(70);
  });
});
