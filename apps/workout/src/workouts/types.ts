/**
 * Workout authoring vocabulary.
 *
 * Pure types only — no React, no I/O. The Workout RPG used to
 * hardcode a single encounter (Push Day) in
 * `fixtures/pushDayQuest.ts`. The authoring branch (024) adds:
 *
 *   - A canonical `WorkoutTemplate` shape that both built-in
 *     templates AND user-imported templates conform to.
 *   - A parser pipeline (`parser.ts`) that turns plain text into
 *     `WorkoutImportResult { template, warnings, errors }`.
 *   - A persistence repository (`workoutTemplateRepository.ts`)
 *     for saving imported templates to local SQLite, with a
 *     memory-only fallback when persistence is unavailable.
 *
 * The existing `Encounter` / `ExerciseVariant` shapes in the
 * push-day fixture continue to work — we deliberately reuse
 * `ExerciseProfile` from the workout-domain package so templates
 * can drive the same orchestrator math.
 *
 * Design rule: a template is *data*. The orchestrator never
 * runs through `WorkoutTemplate`; the store maps the chosen
 * template into the existing `Encounter` shape at quest start.
 *
 * See: docs/workout-rpg/024-device-qa-and-workout-authoring.md
 */

import type {
  ExerciseArchetype,
  ExerciseProfile,
} from '@dwhi/workout-domain';

// ---------------------------------------------------------------------------
// Modality + exercise kind
// ---------------------------------------------------------------------------

/** The same vocabulary the existing store uses. */
export type WorkoutModality = 'bodyweight' | 'weighted';

/**
 * What the player will be entering at the rep stepper:
 *   - `reps`    → a count (e.g. "10 reps")
 *   - `amrap`   → "as many reps as possible" / "Max"
 *   - `time`    → a duration in seconds (e.g. "45s plank")
 */
export type ExerciseInputKind = 'reps' | 'amrap' | 'time';

// ---------------------------------------------------------------------------
// Exercise + template
// ---------------------------------------------------------------------------

/**
 * One exercise inside a template. Pure data.
 *
 * `profile` is required so the orchestrator can compute damage.
 * Built-in templates use `EXERCISE_PROFILES` from the push-day
 * fixture; imported templates use a per-exercise fallback when
 * the parser can't match a known exercise name.
 */
export interface WorkoutExercise {
  /** Stable id (slugified name, suffixed for uniqueness). */
  id: string;
  /** Human-friendly name. */
  name: string;
  /** Combat archetype — drives orchestrator math. */
  archetype: ExerciseArchetype;
  /** Profile used by the orchestrator's damage formula. */
  profile: ExerciseProfile;
  /** Which modality this exercise belongs to. */
  modality: WorkoutModality;
  /** What the player enters (reps / amrap / time-in-seconds). */
  inputKind: ExerciseInputKind;
  /** Default number of working sets. Optional; 3 is a sane fallback. */
  defaultSets?: number;
  /** Default reps per set (or seconds when inputKind === 'time'). */
  defaultReps?: number;
  /** Default working weight in kilograms (omit for bodyweight). */
  defaultWeightKg?: number;
  /** Suggested rest period (seconds) between sets. */
  defaultRestSeconds?: number;
  /** Optional human-readable equipment label, e.g. "Barbell, plates". */
  equipmentLabel?: string;
}

/**
 * A complete workout template — the unit users import / select.
 * Built-ins and user-imported templates share this shape.
 */
export interface WorkoutTemplate {
  /** Stable id; built-ins use friendly slugs ("push-day"); user
   *  imports use uuid-style strings. */
  id: string;
  /** Display name, e.g. "Push Day" / "Heavy Leg Friday". */
  name: string;
  /** Short description shown in the library. */
  description?: string;
  /** Coarse modality the template is designed around. The
   *  bodyweight / weighted card on the home screen will still
   *  honour both per-exercise modality flags. */
  defaultModality: WorkoutModality;
  /** Ordered list of exercises. */
  exercises: readonly WorkoutExercise[];
  /** Marks where the template came from — built-ins are
   *  read-only; imported are user-owned. */
  source: 'builtin' | 'import';
  /** When the template was created (ISO string). Stable for
   *  built-ins; the parser stamps imports at parse time. */
  createdAtIso: string;
}

// ---------------------------------------------------------------------------
// Import-pipeline result
// ---------------------------------------------------------------------------

/** One parser problem — non-fatal warnings or fatal errors. */
export interface WorkoutImportIssue {
  /** Line number in the source text (1-indexed). 0 for
   *  document-level issues like a missing "Workout:" header. */
  line: number;
  /** Severity. Warnings still keep the line in the template;
   *  errors drop the line. */
  severity: 'warning' | 'error';
  /** Human-readable message. */
  message: string;
}

/**
 * Output of `parseWorkoutText`. The template is always present
 * (even for an empty / unparseable input — it'll just have zero
 * exercises). Callers should look at `errors.length === 0` to
 * decide whether to offer the "Save" action.
 */
export interface WorkoutImportResult {
  template: WorkoutTemplate;
  warnings: readonly WorkoutImportIssue[];
  errors: readonly WorkoutImportIssue[];
}
