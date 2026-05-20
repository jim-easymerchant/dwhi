/**
 * Workout-parser tests.
 *
 * Pure-data, no React. Covers:
 *   - weighted lb parses + converts to canonical kg
 *   - weighted kg parses
 *   - bodyweight parses
 *   - AMRAP / Max → inputKind 'amrap'
 *   - timed plank ("3x45s") → inputKind 'time'
 *   - rest seconds clause
 *   - malformed lines emit warnings (and the parser does not throw)
 *   - empty / header-only inputs collapse to an empty template + error
 *   - built-in templates exist and conform to the type
 */

import { LB_PER_KG } from '../units';
import {
  BUILTIN_FULL_BODY,
  BUILTIN_LEGS_DAY,
  BUILTIN_PULL_DAY,
  BUILTIN_PUSH_DAY,
  BUILTIN_RECOVERY,
  BUILTIN_TEMPLATES,
  findBuiltinTemplate,
  idFromName,
  parseExerciseLine,
  parseWorkoutText,
} from '../workouts';

describe('parseWorkoutText — overall pipeline', () => {
  test('happy-path: title + 3 exercises', () => {
    const result = parseWorkoutText(`
Workout: My Push Day
Bench Press 3x10 @ 135 lb, rest 90s
Shoulder Press 3x8 @ 65 lb
Triceps Extension 3x12
`);
    expect(result.errors).toEqual([]);
    expect(result.template.name).toBe('My Push Day');
    expect(result.template.exercises.length).toBe(3);
    expect(result.template.source).toBe('import');
  });

  test('empty input → no exercises + one error, no throw', () => {
    const out = parseWorkoutText('');
    expect(out.errors.length).toBeGreaterThan(0);
    expect(out.template.exercises.length).toBe(0);
    expect(out.template.name).toBe('Untitled Workout');
  });

  test('header-only input emits an error', () => {
    const out = parseWorkoutText('Workout: Just A Title');
    expect(out.errors.length).toBeGreaterThan(0);
    expect(out.template.name).toBe('Just A Title');
    expect(out.template.exercises.length).toBe(0);
  });

  test('parser never throws on malformed lines', () => {
    expect(() =>
      parseWorkoutText(`
Workout: Wild
This is not an exercise line at all
Bench Press 3x10
`),
    ).not.toThrow();
  });

  test('malformed lines surface as warnings (not errors), exercises still kept', () => {
    const out = parseWorkoutText(`
Workout: Wild
Just a sentence
Bench Press 3x10
`);
    expect(out.errors).toEqual([]);
    expect(out.warnings.length).toBeGreaterThanOrEqual(1);
    expect(out.template.exercises.length).toBe(1);
    expect(out.warnings[0].line).toBeGreaterThan(0);
  });

  test('comment lines and blanks are silently ignored', () => {
    const out = parseWorkoutText(`
# This is a comment
Workout: With Comments

// And another comment style
Pushup 3x10
`);
    expect(out.warnings).toEqual([]);
    expect(out.template.exercises.length).toBe(1);
  });

  test('duplicate Workout: header → warning, first wins', () => {
    const out = parseWorkoutText(`
Workout: First Name
Pushup 3x10
Workout: Second Name
`);
    expect(out.template.name).toBe('First Name');
    expect(out.warnings.some((w) => /duplicate/i.test(w.message))).toBe(true);
  });

  test('Description: header is captured', () => {
    const out = parseWorkoutText(`
Workout: Tag
Description: A push-day variation.
Pushup 3x10
`);
    expect(out.template.description).toBe('A push-day variation.');
  });
});

describe('parseExerciseLine — modality + units', () => {
  test('weighted lb converts to canonical kg', () => {
    const r = parseExerciseLine('Bench Press 3x10 @ 135 lb');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.exercise.modality).toBe('weighted');
    expect(r.exercise.defaultWeightKg).toBeCloseTo(135 / LB_PER_KG, 2);
    expect(r.exercise.defaultSets).toBe(3);
    expect(r.exercise.defaultReps).toBe(10);
    expect(r.exercise.inputKind).toBe('reps');
  });

  test('weighted kg passes through unchanged', () => {
    const r = parseExerciseLine('Bench Press 3x10 @ 60 kg');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.exercise.modality).toBe('weighted');
    expect(r.exercise.defaultWeightKg).toBe(60);
  });

  test('weighted "lbs" (plural) detection', () => {
    const r = parseExerciseLine('Bench Press 3x10 @ 135 lbs');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.exercise.defaultWeightKg).toBeCloseTo(135 / LB_PER_KG, 2);
  });

  test('bodyweight (no @) → modality bodyweight, no weightKg', () => {
    const r = parseExerciseLine('Pushup 3x10');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.exercise.modality).toBe('bodyweight');
    expect(r.exercise.defaultWeightKg).toBeUndefined();
  });

  test('"@ bodyweight" / "@ bw" → bodyweight modality', () => {
    const a = parseExerciseLine('Squat 3x15 @ bodyweight');
    const b = parseExerciseLine('Squat 3x15 @ bw');
    if (!a.ok || !b.ok) return;
    expect(a.exercise.modality).toBe('bodyweight');
    expect(b.exercise.modality).toBe('bodyweight');
    expect(a.exercise.defaultWeightKg).toBeUndefined();
  });
});

describe('parseExerciseLine — AMRAP / Max / time', () => {
  test('AMRAP token → inputKind "amrap" with no defaultReps', () => {
    const r = parseExerciseLine('Pushup 3xAMRAP');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.exercise.inputKind).toBe('amrap');
    expect(r.exercise.defaultReps).toBeUndefined();
    expect(r.exercise.defaultSets).toBe(3);
  });

  test('Max token (case-insensitive) → "amrap"', () => {
    const r = parseExerciseLine('Pullup 4xMax');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.exercise.inputKind).toBe('amrap');
  });

  test('Timed plank "3x45s" → inputKind "time" with defaultReps in seconds', () => {
    const r = parseExerciseLine('Plank 3x45s');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.exercise.inputKind).toBe('time');
    expect(r.exercise.defaultReps).toBe(45);
    expect(r.exercise.archetype).toBe('foundation');
  });

  test('Timed plank with weight clause "3x60s @ 5kg"', () => {
    const r = parseExerciseLine('Weighted Plank 3x60s @ 5 kg');
    if (!r.ok) return;
    expect(r.exercise.inputKind).toBe('time');
    expect(r.exercise.defaultReps).toBe(60);
    expect(r.exercise.defaultWeightKg).toBe(5);
  });
});

describe('parseExerciseLine — rest seconds', () => {
  test('comma-separated rest clause', () => {
    const r = parseExerciseLine('Bench Press 3x8 @ 60 kg, rest 90s');
    if (!r.ok) return;
    expect(r.exercise.defaultRestSeconds).toBe(90);
    expect(r.exercise.defaultWeightKg).toBe(60);
  });

  test('semicolon-separated rest clause', () => {
    const r = parseExerciseLine('Squat 3x8; rest 120s');
    if (!r.ok) return;
    expect(r.exercise.defaultRestSeconds).toBe(120);
  });

  test('"rest:" with seconds', () => {
    const r = parseExerciseLine('Squat 3x8, rest: 60s');
    if (!r.ok) return;
    expect(r.exercise.defaultRestSeconds).toBe(60);
  });

  test('no rest clause → undefined', () => {
    const r = parseExerciseLine('Pushup 3x10');
    if (!r.ok) return;
    expect(r.exercise.defaultRestSeconds).toBeUndefined();
  });
});

describe('parseExerciseLine — failure cases', () => {
  test('empty line → not ok', () => {
    expect(parseExerciseLine('').ok).toBe(false);
  });

  test('missing sets×reps → not ok', () => {
    expect(parseExerciseLine('Bench Press').ok).toBe(false);
  });

  test('zero sets → not ok', () => {
    expect(parseExerciseLine('Bench Press 0x10').ok).toBe(false);
  });

  test('a fragment with weight but no sets×reps → not ok', () => {
    expect(parseExerciseLine('Bench Press @ 60 kg').ok).toBe(false);
  });
});

describe('parseExerciseLine — exercise-name detection', () => {
  test('known names map to expected archetypes', () => {
    const cases: Array<[string, string]> = [
      ['Bench Press 3x8 @ 60kg', 'heavy'],
      ['Pushup 3x10', 'pressure'],
      ['Walking Lunge 3x16', 'endurance'],
      ['Plank 3x45s', 'foundation'],
      ['Cat-Cow 2x10', 'recovery'],
    ];
    for (const [line, expectedArchetype] of cases) {
      const r = parseExerciseLine(line);
      if (!r.ok) throw new Error(`line failed: ${line}`);
      expect(r.exercise.archetype).toBe(expectedArchetype);
    }
  });

  test('unknown exercise name falls back to "pressure"', () => {
    const r = parseExerciseLine('Some Made Up Move 3x10');
    if (!r.ok) return;
    expect(r.exercise.archetype).toBe('pressure');
  });

  test('id slugifies the name predictably', () => {
    expect(idFromName('Bench Press')).toBe('bench-press');
    expect(idFromName('Cat-Cow')).toBe('cat-cow');
    expect(idFromName('!!!')).toBe('untitled');
  });
});

describe('default modality detection on the template', () => {
  test('all-bodyweight exercises → defaultModality bodyweight', () => {
    const out = parseWorkoutText(`
Workout: BW
Pushup 3x10
Squat 3x15
Plank 3x45s
`);
    expect(out.template.defaultModality).toBe('bodyweight');
  });

  test('mixed → defaultModality weighted', () => {
    const out = parseWorkoutText(`
Workout: Mixed
Bench Press 3x8 @ 60 kg
Pushup 3x10
`);
    expect(out.template.defaultModality).toBe('weighted');
  });
});

describe('built-in templates', () => {
  test('the five required built-ins ship and have stable ids', () => {
    const ids = BUILTIN_TEMPLATES.map((t) => t.id);
    expect(ids).toEqual([
      'push-day',
      'pull-day',
      'legs-day',
      'full-body',
      'recovery-mobility',
    ]);
  });

  test('every built-in has at least 3 exercises and a description', () => {
    for (const t of BUILTIN_TEMPLATES) {
      expect(t.exercises.length).toBeGreaterThanOrEqual(3);
      expect(typeof t.description).toBe('string');
      expect((t.description ?? '').length).toBeGreaterThan(0);
      expect(t.source).toBe('builtin');
    }
  });

  test('every built-in exercise has the orchestrator-required profile fields', () => {
    for (const t of BUILTIN_TEMPLATES) {
      for (const ex of t.exercises) {
        expect(typeof ex.profile.loadScale).toBe('number');
        expect(typeof ex.profile.bodyweightCoefficient).toBe('number');
        expect(ex.profile.loadScale).toBeGreaterThan(0);
      }
    }
  });

  test('findBuiltinTemplate round-trips every id', () => {
    for (const t of BUILTIN_TEMPLATES) {
      expect(findBuiltinTemplate(t.id)).toBe(t);
    }
    expect(findBuiltinTemplate('not-a-template')).toBeUndefined();
  });

  test('Push Day still ships (back-compat with the encounter fixture)', () => {
    expect(BUILTIN_PUSH_DAY).toBeDefined();
    expect(BUILTIN_PUSH_DAY.name).toBe('Push Day');
  });

  test('Pull / Legs / Full Body / Recovery all ship', () => {
    expect(BUILTIN_PULL_DAY.name).toBe('Pull Day');
    expect(BUILTIN_LEGS_DAY.name).toBe('Legs Day');
    expect(BUILTIN_FULL_BODY.name).toBe('Full Body');
    expect(BUILTIN_RECOVERY.name).toBe('Recovery / Mobility');
  });
});
