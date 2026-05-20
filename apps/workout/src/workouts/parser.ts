/**
 * Plain-text workout parser.
 *
 * Accepts a free-form text block like:
 *
 *   Workout: Push Day
 *   Bench Press 3x10 @ 135 lb, rest 90s
 *   Shoulder Press 3x8 @ 65 lb
 *   Triceps Extension 3x12
 *   Pushup 3xAMRAP
 *   Plank 3x45s
 *
 * Returns a `WorkoutImportResult { template, warnings, errors }`.
 *
 * Design rules:
 *   - **Pure.** No I/O, no exceptions. Errors are returned, not
 *     thrown.
 *   - **Tolerant.** Imperfect lines emit warnings; a malformed
 *     line becomes a warning + is dropped, never crashes the
 *     parser.
 *   - **Unit-aware.** Detects `lb` / `kg` per line; the result
 *     stores all weights in canonical kilograms (matching the
 *     rest of the app).
 *   - **Reps / AMRAP / time.** A trailing `Max` / `AMRAP` token
 *     becomes `inputKind: 'amrap'`; a trailing number+`s` becomes
 *     `inputKind: 'time'`; everything else is `inputKind: 'reps'`.
 *
 * The parser does NOT look up exercise profiles in any registry —
 * it assigns a sensible default profile based on detected
 * archetype + modality. Built-in templates use the canonical
 * `EXERCISE_PROFILES`; imports use the parser's defaults so
 * unknown exercises (e.g. "Zercher Squat") work cleanly.
 *
 * See: docs/workout-rpg/024-device-qa-and-workout-authoring.md
 */

import type {
  ExerciseArchetype,
  ExerciseProfile,
} from '@dwhi/workout-domain';

import { convertLbToKg } from '../units';
import type {
  ExerciseInputKind,
  WorkoutExercise,
  WorkoutImportIssue,
  WorkoutImportResult,
  WorkoutModality,
  WorkoutTemplate,
} from './types';

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

/** Used when the parser can't infer a more specific profile. */
const DEFAULT_BODYWEIGHT_PROFILE: ExerciseProfile = {
  loadScale: 4,
  bodyweightCoefficient: 0.5,
};
const DEFAULT_WEIGHTED_PROFILE: ExerciseProfile = {
  loadScale: 6,
  bodyweightCoefficient: 0,
};

/**
 * Tiny lookup of common exercise names → default archetype. We
 * keep this short on purpose — imports should "just work" for the
 * canonical ones; everything else falls back to 'pressure' (a
 * neutral default).
 */
const KNOWN_EXERCISE_ARCHETYPES: Readonly<
  Record<string, ExerciseArchetype>
> = {
  // heavy compounds
  squat: 'heavy',
  'back squat': 'heavy',
  'front squat': 'heavy',
  'goblet squat': 'heavy',
  deadlift: 'heavy',
  'romanian deadlift': 'heavy',
  'bench press': 'heavy',
  'shoulder press': 'heavy',
  'overhead press': 'heavy',
  'barbell row': 'heavy',
  'pendlay row': 'heavy',
  pullup: 'heavy',
  'pull up': 'heavy',
  'chin up': 'heavy',
  // pressure / push
  pushup: 'pressure',
  'push up': 'pressure',
  'pike pushup': 'pressure',
  'diamond pushup': 'pressure',
  'incline pushup': 'pressure',
  'knee pushup': 'pressure',
  'triceps extension': 'pressure',
  'biceps curl': 'pressure',
  curl: 'pressure',
  // endurance / lower-body bodyweight
  'walking lunge': 'endurance',
  lunge: 'endurance',
  'bodyweight squat': 'endurance',
  'calf raise': 'endurance',
  // foundation / isometrics
  plank: 'foundation',
  'side plank': 'foundation',
  'hollow hold': 'foundation',
  // recovery / mobility
  'cat-cow': 'recovery',
  'cat cow': 'recovery',
  'hip bridge': 'recovery',
  bridge: 'recovery',
  stretch: 'recovery',
};

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Parse a free-form workout text block. Pure; never throws.
 *
 * The returned `template` always exists, even on a totally
 * unparseable input — it'll just have zero exercises and a
 * placeholder name like "Untitled Workout."
 */
export function parseWorkoutText(input: string): WorkoutImportResult {
  const warnings: WorkoutImportIssue[] = [];
  const errors: WorkoutImportIssue[] = [];
  const exercises: WorkoutExercise[] = [];

  const text = typeof input === 'string' ? input : '';
  const rawLines = text.split(/\r?\n/);
  let templateName = '';
  let templateDescription = '';

  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i];
    const line = raw.trim();
    const lineNumber = i + 1;
    if (line.length === 0) continue;
    if (line.startsWith('#') || line.startsWith('//')) continue;

    // Workout: <name>  — the document header. First match wins.
    const headerMatch = line.match(/^workout\s*:\s*(.+)$/i);
    if (headerMatch) {
      if (templateName.length === 0) {
        templateName = headerMatch[1].trim();
      } else {
        warnings.push({
          line: lineNumber,
          severity: 'warning',
          message: 'duplicate "Workout:" header — ignored.',
        });
      }
      continue;
    }

    // Description: <text>
    const descMatch = line.match(/^description\s*:\s*(.+)$/i);
    if (descMatch) {
      templateDescription = descMatch[1].trim();
      continue;
    }

    const parsed = parseExerciseLine(line);
    if (!parsed.ok) {
      warnings.push({
        line: lineNumber,
        severity: 'warning',
        message: parsed.message,
      });
      continue;
    }
    exercises.push(parsed.exercise);
  }

  if (exercises.length === 0) {
    errors.push({
      line: 0,
      severity: 'error',
      message:
        'No exercises found. Expected at least one line like "Bench Press 3x8 @ 60 kg".',
    });
  }
  if (templateName.length === 0) {
    templateName = 'Untitled Workout';
  }

  const defaultModality: WorkoutModality = exercises.every(
    (e) => e.modality === 'bodyweight',
  )
    ? 'bodyweight'
    : 'weighted';

  const template: WorkoutTemplate = {
    id: idFromName(templateName),
    name: templateName,
    description:
      templateDescription.length > 0 ? templateDescription : undefined,
    defaultModality,
    source: 'import',
    createdAtIso: new Date(0).toISOString(),
    exercises,
  };

  return { template, warnings, errors };
}

// ---------------------------------------------------------------------------
// Exercise-line parser
// ---------------------------------------------------------------------------

interface OkParse {
  ok: true;
  exercise: WorkoutExercise;
}
interface FailParse {
  ok: false;
  message: string;
}

/**
 * Parse one exercise line. Examples handled:
 *
 *   "Bench Press 3x8 @ 60 kg, rest 90s"
 *   "Pushup 3x10"
 *   "Plank 3x45s"
 *   "Pullup 3xAMRAP"
 *   "Bodyweight Squat 4 x 12 @ bodyweight"
 *   "Triceps Extension 3x12, rest 60s"
 *
 * Returns `{ ok: false, message }` for lines the parser cannot
 * make sense of (e.g. "Just a line of prose").
 */
export function parseExerciseLine(line: string): OkParse | FailParse {
  if (line.length === 0) {
    return { ok: false, message: 'empty line' };
  }

  // Split off optional ", rest <n>s" clause (or "rest: <n>s").
  let restSeconds: number | undefined;
  const restMatch = line.match(
    /[,;]?\s*rest\s*:?\s*(\d+)\s*s?\s*(?:ec(?:ond)?s?)?\b/i,
  );
  let working = line;
  if (restMatch) {
    restSeconds = parseInt(restMatch[1], 10);
    working = (line.slice(0, restMatch.index) + line.slice((restMatch.index ?? 0) + restMatch[0].length))
      .replace(/[,;]\s*$/, '')
      .trim();
  }

  // Optional weight clause: "@ 135 lb" or "@ 60kg" or "@ bodyweight".
  let weightKg: number | undefined;
  let modality: WorkoutModality = 'bodyweight';
  const weightMatch = working.match(
    /@\s*(bodyweight|bw|\d+(?:\.\d+)?)\s*(lb|lbs|kg|kgs)?/i,
  );
  if (weightMatch) {
    const valueRaw = weightMatch[1].toLowerCase();
    const unit = (weightMatch[2] ?? 'kg').toLowerCase();
    if (valueRaw === 'bodyweight' || valueRaw === 'bw') {
      modality = 'bodyweight';
    } else {
      const value = parseFloat(valueRaw);
      if (Number.isFinite(value) && value > 0) {
        modality = 'weighted';
        weightKg = unit.startsWith('lb') ? convertLbToKg(value) : value;
      }
    }
    working = working
      .slice(0, weightMatch.index)
      .replace(/[,;]\s*$/, '')
      .trim();
  }

  // Find "N x M" / "N×M". M can be a number, "AMRAP", "Max", or
  // "<digits>s" for a timed set.
  const setsMatch = working.match(
    /(\d+)\s*[x×]\s*(amrap|max|\d+\s*s|\d+)/i,
  );
  if (!setsMatch) {
    return {
      ok: false,
      message: `couldn't read sets×reps on "${line}". Try "Pushup 3x10".`,
    };
  }
  const sets = parseInt(setsMatch[1], 10);
  if (!Number.isFinite(sets) || sets <= 0) {
    return { ok: false, message: `invalid set count on "${line}".` };
  }
  const repsToken = setsMatch[2].toLowerCase().trim();

  let inputKind: ExerciseInputKind = 'reps';
  let defaultReps: number | undefined;
  if (repsToken === 'amrap' || repsToken === 'max') {
    inputKind = 'amrap';
    // No defaultReps — the UI prompts the player.
  } else if (/^\d+\s*s$/i.test(repsToken)) {
    inputKind = 'time';
    defaultReps = parseInt(repsToken, 10);
  } else {
    const repsNum = parseInt(repsToken, 10);
    if (!Number.isFinite(repsNum) || repsNum <= 0) {
      return { ok: false, message: `invalid reps on "${line}".` };
    }
    defaultReps = repsNum;
  }

  // What's left is the exercise name.
  const name = working
    .slice(0, setsMatch.index)
    .replace(/[,;]\s*$/, '')
    .trim();
  if (name.length === 0) {
    return { ok: false, message: `missing exercise name on "${line}".` };
  }

  const archetype = archetypeFor(name);
  const profile: ExerciseProfile =
    modality === 'weighted'
      ? DEFAULT_WEIGHTED_PROFILE
      : DEFAULT_BODYWEIGHT_PROFILE;

  return {
    ok: true,
    exercise: {
      id: idFromName(name),
      name,
      modality,
      archetype,
      profile,
      inputKind,
      defaultSets: sets,
      defaultReps,
      defaultWeightKg: modality === 'weighted' ? weightKg : undefined,
      defaultRestSeconds: restSeconds,
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function archetypeFor(name: string): ExerciseArchetype {
  const key = name.toLowerCase().trim();
  if (key in KNOWN_EXERCISE_ARCHETYPES) {
    return KNOWN_EXERCISE_ARCHETYPES[key];
  }
  // Fuzzy: try common substrings before falling back.
  if (/\bplank\b/.test(key)) return 'foundation';
  if (/\bstretch\b|\bbridge\b/.test(key)) return 'recovery';
  if (/\bsquat\b|\bdeadlift\b|\bpress\b|\brow\b|\bpull\s*up\b/.test(key)) {
    return 'heavy';
  }
  if (/\blunge\b|\bcalf\b/.test(key)) return 'endurance';
  return 'pressure';
}

export function idFromName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.length > 0 ? slug : 'untitled';
}
