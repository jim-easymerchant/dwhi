/**
 * Built-in workout templates.
 *
 * These ship with the app and are read-only. User imports live
 * alongside them in the same list — they share the
 * `WorkoutTemplate` shape; the only distinguishing field is
 * `source`.
 *
 * Profiles come from the existing `EXERCISE_PROFILES` registry
 * so the orchestrator math is consistent across built-ins and
 * the original Push Day fixture.
 */

import { EXERCISE_PROFILES } from '../fixtures/pushDayQuest';
import type { WorkoutExercise, WorkoutTemplate } from './types';

// Stable-but-arbitrary createdAt for built-ins. The exact value
// is unimportant — it just has to be deterministic so tests can
// pin it.
const BUILTIN_CREATED_AT = '2026-05-19T00:00:00.000Z';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ex(
  partial: Omit<WorkoutExercise, 'id'> & { id?: string },
): WorkoutExercise {
  return {
    id:
      partial.id ??
      partial.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, ''),
    ...partial,
  };
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export const BUILTIN_PUSH_DAY: WorkoutTemplate = {
  id: 'push-day',
  name: 'Push Day',
  description: 'Bench, shoulders, triceps. The original encounter.',
  defaultModality: 'weighted',
  source: 'builtin',
  createdAtIso: BUILTIN_CREATED_AT,
  exercises: [
    ex({
      name: 'Bench Press',
      modality: 'weighted',
      archetype: 'heavy',
      profile: EXERCISE_PROFILES.bench,
      inputKind: 'reps',
      defaultSets: 3,
      defaultReps: 8,
      defaultWeightKg: 40,
      defaultRestSeconds: 120,
      equipmentLabel: 'Barbell, bench',
    }),
    ex({
      name: 'Shoulder Press',
      modality: 'weighted',
      archetype: 'heavy',
      profile: EXERCISE_PROFILES.shoulderPress,
      inputKind: 'reps',
      defaultSets: 3,
      defaultReps: 8,
      defaultWeightKg: 14,
      defaultRestSeconds: 90,
      equipmentLabel: 'Dumbbells',
    }),
    ex({
      name: 'Triceps Extension',
      modality: 'weighted',
      archetype: 'pressure',
      profile: EXERCISE_PROFILES.tricepsExtension,
      inputKind: 'reps',
      defaultSets: 3,
      defaultReps: 10,
      defaultWeightKg: 7.5,
      defaultRestSeconds: 60,
    }),
    ex({
      name: 'Pushup',
      modality: 'bodyweight',
      archetype: 'pressure',
      profile: EXERCISE_PROFILES.pushup,
      inputKind: 'reps',
      defaultSets: 3,
      defaultReps: 10,
      defaultRestSeconds: 60,
    }),
  ],
};

export const BUILTIN_PULL_DAY: WorkoutTemplate = {
  id: 'pull-day',
  name: 'Pull Day',
  description: 'Rows, pulldowns, curls. Build the back of the chain.',
  defaultModality: 'weighted',
  source: 'builtin',
  createdAtIso: BUILTIN_CREATED_AT,
  exercises: [
    ex({
      name: 'Barbell Row',
      modality: 'weighted',
      archetype: 'heavy',
      // No registered profile for rows yet; use bench's loadScale
      // (8) with no bodyweight coupling — a reasonable approximation
      // for a barbell pull.
      profile: { loadScale: 8, bodyweightCoefficient: 0 },
      inputKind: 'reps',
      defaultSets: 3,
      defaultReps: 8,
      defaultWeightKg: 40,
      defaultRestSeconds: 120,
      equipmentLabel: 'Barbell',
    }),
    ex({
      name: 'Lat Pulldown',
      modality: 'weighted',
      archetype: 'heavy',
      profile: { loadScale: 6, bodyweightCoefficient: 0 },
      inputKind: 'reps',
      defaultSets: 3,
      defaultReps: 10,
      defaultWeightKg: 30,
      defaultRestSeconds: 90,
      equipmentLabel: 'Cable stack',
    }),
    ex({
      name: 'Inverted Row',
      modality: 'bodyweight',
      archetype: 'pressure',
      profile: { loadScale: 6, bodyweightCoefficient: 0.55 },
      inputKind: 'reps',
      defaultSets: 3,
      defaultReps: 10,
      defaultRestSeconds: 60,
      equipmentLabel: 'Bar / rings',
    }),
    ex({
      name: 'Biceps Curl',
      modality: 'weighted',
      archetype: 'pressure',
      profile: { loadScale: 4, bodyweightCoefficient: 0 },
      inputKind: 'reps',
      defaultSets: 3,
      defaultReps: 10,
      defaultWeightKg: 8,
      defaultRestSeconds: 60,
      equipmentLabel: 'Dumbbells',
    }),
  ],
};

export const BUILTIN_LEGS_DAY: WorkoutTemplate = {
  id: 'legs-day',
  name: 'Legs Day',
  description: 'Squat, hinge, lunge. The slow burn that pays for everything.',
  defaultModality: 'weighted',
  source: 'builtin',
  createdAtIso: BUILTIN_CREATED_AT,
  exercises: [
    ex({
      name: 'Goblet Squat',
      modality: 'weighted',
      archetype: 'heavy',
      profile: { loadScale: 8, bodyweightCoefficient: 0.3 },
      inputKind: 'reps',
      defaultSets: 3,
      defaultReps: 8,
      defaultWeightKg: 16,
      defaultRestSeconds: 120,
      equipmentLabel: 'Kettlebell / dumbbell',
    }),
    ex({
      name: 'Romanian Deadlift',
      modality: 'weighted',
      archetype: 'heavy',
      profile: { loadScale: 10, bodyweightCoefficient: 0 },
      inputKind: 'reps',
      defaultSets: 3,
      defaultReps: 8,
      defaultWeightKg: 40,
      defaultRestSeconds: 120,
      equipmentLabel: 'Barbell',
    }),
    ex({
      name: 'Walking Lunge',
      modality: 'bodyweight',
      archetype: 'endurance',
      profile: { loadScale: 4, bodyweightCoefficient: 0.5 },
      inputKind: 'reps',
      defaultSets: 3,
      defaultReps: 16,
      defaultRestSeconds: 60,
    }),
    ex({
      name: 'Calf Raise',
      modality: 'bodyweight',
      archetype: 'endurance',
      profile: { loadScale: 3, bodyweightCoefficient: 0.4 },
      inputKind: 'reps',
      defaultSets: 3,
      defaultReps: 20,
      defaultRestSeconds: 45,
    }),
  ],
};

export const BUILTIN_FULL_BODY: WorkoutTemplate = {
  id: 'full-body',
  name: 'Full Body',
  description: 'One of each: squat, push, pull, carry. Forty minutes of honest work.',
  defaultModality: 'bodyweight',
  source: 'builtin',
  createdAtIso: BUILTIN_CREATED_AT,
  exercises: [
    ex({
      name: 'Bodyweight Squat',
      modality: 'bodyweight',
      archetype: 'endurance',
      profile: { loadScale: 4, bodyweightCoefficient: 0.5 },
      inputKind: 'reps',
      defaultSets: 3,
      defaultReps: 15,
      defaultRestSeconds: 60,
    }),
    ex({
      name: 'Pushup',
      modality: 'bodyweight',
      archetype: 'pressure',
      profile: EXERCISE_PROFILES.pushup,
      inputKind: 'reps',
      defaultSets: 3,
      defaultReps: 10,
      defaultRestSeconds: 60,
    }),
    ex({
      name: 'Inverted Row',
      modality: 'bodyweight',
      archetype: 'pressure',
      profile: { loadScale: 6, bodyweightCoefficient: 0.55 },
      inputKind: 'reps',
      defaultSets: 3,
      defaultReps: 10,
      defaultRestSeconds: 60,
      equipmentLabel: 'Bar / rings',
    }),
    ex({
      name: 'Plank',
      modality: 'bodyweight',
      archetype: 'foundation',
      profile: { loadScale: 2, bodyweightCoefficient: 0.4 },
      inputKind: 'time',
      defaultSets: 3,
      defaultReps: 45, // seconds
      defaultRestSeconds: 45,
    }),
  ],
};

export const BUILTIN_RECOVERY: WorkoutTemplate = {
  id: 'recovery-mobility',
  name: 'Recovery / Mobility',
  description: 'Movement without effort score. Hold position; breathe.',
  defaultModality: 'bodyweight',
  source: 'builtin',
  createdAtIso: BUILTIN_CREATED_AT,
  exercises: [
    ex({
      name: 'Cat-Cow',
      modality: 'bodyweight',
      archetype: 'recovery',
      profile: { loadScale: 1, bodyweightCoefficient: 0.1 },
      inputKind: 'reps',
      defaultSets: 2,
      defaultReps: 10,
      defaultRestSeconds: 30,
    }),
    ex({
      name: "World's Greatest Stretch",
      modality: 'bodyweight',
      archetype: 'recovery',
      profile: { loadScale: 1, bodyweightCoefficient: 0.1 },
      inputKind: 'reps',
      defaultSets: 2,
      defaultReps: 6,
      defaultRestSeconds: 30,
    }),
    ex({
      name: 'Hip Bridge',
      modality: 'bodyweight',
      archetype: 'recovery',
      profile: { loadScale: 2, bodyweightCoefficient: 0.3 },
      inputKind: 'reps',
      defaultSets: 2,
      defaultReps: 12,
      defaultRestSeconds: 30,
    }),
    ex({
      name: 'Box Breathing',
      modality: 'bodyweight',
      archetype: 'recovery',
      profile: { loadScale: 1, bodyweightCoefficient: 0 },
      inputKind: 'time',
      defaultSets: 1,
      defaultReps: 120, // seconds
      defaultRestSeconds: 0,
    }),
  ],
};

/** Read-only ordered list of every shipped built-in. */
export const BUILTIN_TEMPLATES: readonly WorkoutTemplate[] = [
  BUILTIN_PUSH_DAY,
  BUILTIN_PULL_DAY,
  BUILTIN_LEGS_DAY,
  BUILTIN_FULL_BODY,
  BUILTIN_RECOVERY,
];

/** Look up a built-in by id. Returns undefined for unknown ids. */
export function findBuiltinTemplate(id: string): WorkoutTemplate | undefined {
  return BUILTIN_TEMPLATES.find((t) => t.id === id);
}
