/**
 * apps/workout/src/workouts — workout-authoring foundation.
 *
 * Built-in templates + plain-text parser + library + a thin
 * memory/persistence-aware service. No new dependencies.
 *
 * See: docs/workout-rpg/024-device-qa-and-workout-authoring.md
 */

export {
  BUILTIN_FULL_BODY,
  BUILTIN_LEGS_DAY,
  BUILTIN_PULL_DAY,
  BUILTIN_PUSH_DAY,
  BUILTIN_RECOVERY,
  BUILTIN_TEMPLATES,
  findBuiltinTemplate,
} from './builtins';

export { parseWorkoutText, parseExerciseLine, idFromName } from './parser';

export {
  __resetImportedTemplatesForTests,
  addImportedTemplate,
  findTemplate,
  importWorkoutFromText,
  listAllTemplates,
  removeImportedTemplate,
  setImportedTemplatesForHydration,
} from './library';

export type {
  ExerciseInputKind,
  WorkoutExercise,
  WorkoutImportIssue,
  WorkoutImportResult,
  WorkoutModality,
  WorkoutTemplate,
} from './types';

export {
  __testExports as __templateToQuestTestExports,
  templateToRuntimeEncounter,
  type RuntimeEncounter,
} from './templateToQuest';
