// Smoke tests for the @dwhi/workout-domain boundary.
//
// This package ships *vocabulary only* — no runtime systems yet.
// These tests verify:
//   1. The runtime constant tuples are present at the root barrel
//      and via each sub-barrel.
//   2. Type names referenced by the docs are exported (compile-time
//      guard — references erased at runtime, kept by tsc).
//   3. The package has no side effects: re-loading the root barrel
//      yields the *same* tuple references.
//   4. The package does not import from React, React Native, the
//      DWHI app's `@/` source tree, or `@dwhi/domain`. This is a
//      content-level grep against every .ts file in src/.
//   5. The package does not leak into `@dwhi/framework` or
//      `@dwhi/domain` — the other barrels stay workout-clean.

import * as fs from 'node:fs';
import * as path from 'node:path';

import * as workout from '@dwhi/workout-domain';
import * as battle from '@dwhi/workout-domain/battle';
import * as cardio from '@dwhi/workout-domain/cardio';
import * as enemies from '@dwhi/workout-domain/enemies';
import * as equipment from '@dwhi/workout-domain/equipment';
import * as exercises from '@dwhi/workout-domain/exercises';
import * as momentum from '@dwhi/workout-domain/momentum';
import * as progression from '@dwhi/workout-domain/progression';
import * as types from '@dwhi/workout-domain/types';

import type {
  ArmorSet,
  BattleKind,
  CardioModality,
  EnemyCategory,
  EnemyMood,
  EquipmentKind,
  ExerciseArchetype,
  ExerciseModality,
  MomentumTier,
  QuestKind,
  WeaponFamily,
} from '@dwhi/workout-domain';

describe('@dwhi/workout-domain exercises surface', () => {
  test('archetypes tuple matches the six combat disciplines', () => {
    expect(exercises.EXERCISE_ARCHETYPES).toEqual([
      'pressure',
      'heavy',
      'control',
      'foundation',
      'endurance',
      'recovery',
    ]);
  });

  test('modalities tuple is exposed', () => {
    expect(exercises.EXERCISE_MODALITIES).toEqual([
      'weighted',
      'bodyweight',
      'timed',
      'cardio',
      'mobility',
    ]);
  });
});

describe('@dwhi/workout-domain enemies surface', () => {
  test('moods tuple matches the writer-room categories', () => {
    expect(enemies.ENEMY_MOODS).toEqual(['drift', 'hush', 'glare', 'stone']);
  });

  test('categories tuple matches the combat structural roles', () => {
    expect(enemies.ENEMY_CATEGORIES).toEqual([
      'lesser_fragment',
      'hollow',
      'ward',
    ]);
  });
});

describe('@dwhi/workout-domain momentum surface', () => {
  test('tiers tuple is ordered coldest → warmest', () => {
    expect(momentum.MOMENTUM_TIERS).toEqual([
      'rusted',
      'steady',
      'driven',
      'relentless',
      'ascendant',
    ]);
  });
});

describe('@dwhi/workout-domain cardio surface', () => {
  test('modalities tuple is exposed', () => {
    expect(cardio.CARDIO_MODALITIES).toEqual([
      'walk',
      'hike',
      'run',
      'cycle',
      'swim',
    ]);
  });
});

describe('@dwhi/workout-domain equipment surface', () => {
  test('kinds tuple is the weapon/armor split', () => {
    expect(equipment.EQUIPMENT_KINDS).toEqual(['weapon', 'armor']);
  });

  test('weapon families include the four design-bible examples', () => {
    expect(equipment.WEAPON_FAMILIES).toEqual([
      'titan_hammer',
      'twin_ash_blades',
      'travelers_spear',
      'ember_staff',
    ]);
  });

  test('armor sets include the three design-bible examples', () => {
    expect(equipment.ARMOR_SETS).toEqual([
      'stonebound_plate',
      'ashwalker_garb',
      'emberweave',
    ]);
  });
});

describe('@dwhi/workout-domain session-shape surface', () => {
  test('QuestKind tuple is exposed via types and progression barrels', () => {
    expect(types.QUEST_KINDS).toEqual(['strength', 'recovery', 'cardio', 'camp']);
    expect(progression.QUEST_KINDS).toBe(types.QUEST_KINDS);
  });

  test('BattleKind tuple is exposed via types and battle barrels', () => {
    expect(types.BATTLE_KINDS).toEqual(['standard', 'settle', 'ward']);
    expect(battle.BATTLE_KINDS).toBe(types.BATTLE_KINDS);
  });
});

describe('@dwhi/workout-domain root barrel re-exports every sub-barrel', () => {
  test('exercises', () => {
    expect(workout.EXERCISE_ARCHETYPES).toBe(exercises.EXERCISE_ARCHETYPES);
    expect(workout.EXERCISE_MODALITIES).toBe(exercises.EXERCISE_MODALITIES);
  });

  test('enemies', () => {
    expect(workout.ENEMY_MOODS).toBe(enemies.ENEMY_MOODS);
    expect(workout.ENEMY_CATEGORIES).toBe(enemies.ENEMY_CATEGORIES);
  });

  test('momentum', () => {
    expect(workout.MOMENTUM_TIERS).toBe(momentum.MOMENTUM_TIERS);
  });

  test('cardio', () => {
    expect(workout.CARDIO_MODALITIES).toBe(cardio.CARDIO_MODALITIES);
  });

  test('equipment', () => {
    expect(workout.EQUIPMENT_KINDS).toBe(equipment.EQUIPMENT_KINDS);
    expect(workout.WEAPON_FAMILIES).toBe(equipment.WEAPON_FAMILIES);
    expect(workout.ARMOR_SETS).toBe(equipment.ARMOR_SETS);
  });

  test('session shape', () => {
    expect(workout.QUEST_KINDS).toBe(types.QUEST_KINDS);
    expect(workout.BATTLE_KINDS).toBe(types.BATTLE_KINDS);
  });
});

describe('@dwhi/workout-domain type names exist (compile-time guard)', () => {
  // Type references below are erased at runtime; they exist so a
  // missing or renamed type export fails `tsc --noEmit`.
  test('every documented type name is referenced', () => {
    type _Smoke = [
      ExerciseArchetype,
      ExerciseModality,
      EnemyMood,
      EnemyCategory,
      MomentumTier,
      CardioModality,
      EquipmentKind,
      WeaponFamily,
      ArmorSet,
      QuestKind,
      BattleKind,
    ];
    expect(true).toBe(true);
  });
});

describe('@dwhi/workout-domain is side-effect free', () => {
  test('re-importing the root barrel yields the same tuple references', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const again = require('@dwhi/workout-domain') as typeof workout;
    expect(again.EXERCISE_ARCHETYPES).toBe(workout.EXERCISE_ARCHETYPES);
    expect(again.MOMENTUM_TIERS).toBe(workout.MOMENTUM_TIERS);
    expect(again.ARMOR_SETS).toBe(workout.ARMOR_SETS);
  });
});

describe('@dwhi/workout-domain has no forbidden imports', () => {
  const SRC_DIR = path.resolve(__dirname, '..');

  const sourceFiles = (() => {
    const out: string[] = [];
    const visit = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === '__tests__') continue;
          visit(full);
        } else if (entry.isFile() && /\.tsx?$/.test(entry.name)) {
          out.push(full);
        }
      }
    };
    visit(SRC_DIR);
    return out;
  })();

  test('source tree was discovered', () => {
    expect(sourceFiles.length).toBeGreaterThan(0);
  });

  test.each(sourceFiles)('no React / RN / app / pantry imports in %s', (file) => {
    const text = fs.readFileSync(file, 'utf8');
    expect(text).not.toMatch(/from\s+['"]react['"]/);
    expect(text).not.toMatch(/from\s+['"]react-native['"]/);
    expect(text).not.toMatch(/from\s+['"]@\//);
    expect(text).not.toMatch(/from\s+['"]@dwhi\/domain/);
    expect(text).not.toMatch(/from\s+['"]@dwhi\/ui/);
    expect(text).not.toMatch(/from\s+['"]expo[-/]/);
  });
});

describe('@dwhi/workout-domain does not leak into framework or domain barrels', () => {
  test('framework barrel does not export workout vocabulary', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const framework = require('@dwhi/framework') as Record<string, unknown>;
    expect(framework.EXERCISE_ARCHETYPES).toBeUndefined();
    expect(framework.MOMENTUM_TIERS).toBeUndefined();
    expect(framework.ENEMY_MOODS).toBeUndefined();
    expect(framework.WEAPON_FAMILIES).toBeUndefined();
  });

  test('domain (pantry) barrel does not export workout vocabulary', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const domain = require('@dwhi/domain') as Record<string, unknown>;
    expect(domain.EXERCISE_ARCHETYPES).toBeUndefined();
    expect(domain.MOMENTUM_TIERS).toBeUndefined();
    expect(domain.ENEMY_MOODS).toBeUndefined();
    expect(domain.WEAPON_FAMILIES).toBeUndefined();
  });
});
