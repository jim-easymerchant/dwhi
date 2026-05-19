/**
 * Push Day fixture shape tests. These are quiet smoke checks —
 * if a constant changes in a future tuning pass, the tests should
 * fail loud and obvious.
 */

import {
  DEFAULT_BODYWEIGHT_KG,
  DEFAULT_PRIOR_MOMENTUM,
  EXERCISE_PROFILES,
  PUSH_DAY_BATTLES,
  PUSH_DAY_QUEST,
  SLUGGARD,
} from '../fixtures/pushDayQuest';

describe('PUSH_DAY_QUEST', () => {
  test('shape', () => {
    expect(PUSH_DAY_QUEST.id).toBe('push-day');
    expect(PUSH_DAY_QUEST.kind).toBe('strength');
    expect(PUSH_DAY_QUEST.plannedSetCount).toBe(9);
  });
});

describe('SLUGGARD', () => {
  test('shape', () => {
    expect(SLUGGARD.id).toBe('sluggard');
    expect(SLUGGARD.name).toMatch(/Sluggard/);
    expect(SLUGGARD.mood).toBe('drift');
    expect(SLUGGARD.category).toBe('lesser_fragment');
    expect(SLUGGARD.maxHp).toBeGreaterThan(0);
  });
});

describe('PUSH_DAY_BATTLES', () => {
  test('three battles, each three sets', () => {
    expect(PUSH_DAY_BATTLES).toHaveLength(3);
    for (const b of PUSH_DAY_BATTLES) {
      expect(b.setsPerBattle).toBe(3);
      expect(b.weightedProfile.loadScale).toBeGreaterThan(0);
      expect(b.bodyweightProfile.bodyweightCoefficient).toBeGreaterThan(0);
    }
  });

  test('battle indexes ascend from zero', () => {
    PUSH_DAY_BATTLES.forEach((b, i) => {
      expect(b.battleIndex).toBe(i);
    });
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

describe('defaults', () => {
  test('starting momentum sits in Steady', () => {
    expect(DEFAULT_PRIOR_MOMENTUM).toBeGreaterThanOrEqual(20);
    expect(DEFAULT_PRIOR_MOMENTUM).toBeLessThan(40);
  });

  test('default bodyweight matches the combat balance default', () => {
    expect(DEFAULT_BODYWEIGHT_KG).toBe(70);
  });
});
