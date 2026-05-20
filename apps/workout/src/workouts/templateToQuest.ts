/**
 * Template → Quest adapter.
 *
 * Converts a `WorkoutTemplate` into the runtime shapes the
 * existing battle pipeline already understands:
 *
 *   - an `Encounter` for the variant chooser
 *     (`findVariant` / `variantsFor`)
 *   - a `QuestDefinition` for the orchestrator (`runQuest`)
 *   - a primary `EnemyInput` for the BattleScreen
 *   - a `nextPhaseEnemy(prevMaxHp)` callback for "Continue Sets"
 *
 * The adapter is **pure**. Same input always returns the same
 * output — call it once at `startQuest()` time and stash the
 * result in the store as `activeEncounter`.
 *
 * No combat-math changes. The orchestrator continues to score
 * sets the same way; only the *source* of the encounter is now a
 * template instead of the hardwired Push Day fixture.
 *
 * Architectural rule:
 *   - The adapter NEVER mutates the template.
 *   - The adapter NEVER reads from the store.
 *   - The adapter NEVER touches persistence.
 *
 * See: docs/workout-rpg/025-template-to-quest-integration.md
 */

import type {
  EnemyCategory,
  EnemyInput,
  EnemyMood,
  ExerciseArchetype,
  QuestDefinition,
} from '@dwhi/workout-domain';

import type {
  Encounter,
  ExerciseVariant,
  Variant,
} from '../fixtures/pushDayQuest';
import type { WorkoutExercise, WorkoutTemplate } from './types';

// ---------------------------------------------------------------------------
// Tuning — kept in this file so the adapter's behaviour is auditable
// without grepping the rest of the app.
// ---------------------------------------------------------------------------

/** HP per planned working set. Used to size the primary enemy so
 *  the encounter resolves in roughly the right number of sets. */
const HP_PER_PLANNED_SET = 60;
/** Lower bound on the primary enemy's HP. */
const MIN_PRIMARY_HP = 120;
/** Continuation phases halve the previous HP, floored at this. */
const MIN_CONTINUATION_HP = 40;
/** Sane fallback when a template has no exercises (shouldn't happen
 *  in practice — the parser refuses empty templates with an error). */
const DEFAULT_PLANNED_SET_COUNT = 6;

// ---------------------------------------------------------------------------
// Public runtime shape stored on the workout store.
// ---------------------------------------------------------------------------

/**
 * Everything the battle pipeline needs to play one workout.
 *
 * The shape is deliberately small: the existing helpers
 * (`findVariant`, `variantsFor`, `getNextEnemyPhase`-equivalent)
 * accept the same object types they always have. Only the
 * *source* shifted from a static fixture to this adapter.
 */
export interface RuntimeEncounter {
  /** Source template id (also used as the encounter id). */
  templateId: string;
  /** Human-readable workout name (battle screen header). */
  workoutName: string;
  /** Optional description for reward / library surfaces. */
  workoutDescription?: string;
  /** `Encounter` shape for findVariant / variantsFor. */
  encounter: Encounter;
  /** Quest definition for `runQuest(...)`. `plannedSetCount` is
   *  derived from the template's exercises (sum of defaultSets). */
  quest: QuestDefinition;
  /** Initial enemy when the quest opens. */
  primaryEnemy: EnemyInput;
  /** "Continue Sets" returns the next phase's enemy. Pure. */
  nextPhaseEnemy(prevMaxHp: number): EnemyInput;
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

/**
 * Pure conversion: WorkoutTemplate → RuntimeEncounter.
 *
 * Behaviour:
 *   - Each `template.exercises[]` entry becomes an
 *     `ExerciseVariant`. Bodyweight exercises land in
 *     `encounter.bodyweightStrategies`; weighted in
 *     `encounter.weightedVariants`.
 *   - If one modality is empty (e.g. an all-bodyweight workout
 *     has no weighted variants), the *other* modality's
 *     variants are mirrored into the empty bucket so the
 *     BattleScreen's variant chooser is never empty.
 *   - `quest.plannedSetCount = sum(defaultSets) || DEFAULT`.
 *   - `quest.kind` is fixed to `'strength'` (the only kind the
 *     orchestrator's balance is tuned for today).
 *   - The primary enemy's name / mood / category are derived
 *     from the template's dominant archetype.
 *   - `primaryEnemy.maxHp = max(MIN_PRIMARY_HP, plannedSets * HP_PER_PLANNED_SET)`.
 *   - `nextPhaseEnemy(prev) = halve, floored at MIN_CONTINUATION_HP`.
 */
export function templateToRuntimeEncounter(
  template: WorkoutTemplate,
): RuntimeEncounter {
  const variants = template.exercises.map(exerciseToVariant);

  const bodyweightVariants = variants.filter((v) => v.modality === 'bodyweight');
  const weightedVariants = variants.filter((v) => v.modality === 'weighted');

  // Empty-bucket fallback: if there are no weighted variants,
  // mirror the bodyweight list (and vice versa) so the
  // BattleScreen's variant chooser always has at least one entry.
  // We strip the modality info from the mirrored entries because
  // the variant chooser reads `encounter.<bucket>` directly.
  const bodyweightForEncounter =
    bodyweightVariants.length > 0
      ? bodyweightVariants.map(stripModality)
      : weightedVariants.map(stripModality);
  const weightedForEncounter =
    weightedVariants.length > 0
      ? weightedVariants.map(stripModality)
      : bodyweightVariants.map(stripModality);

  const plannedSetCount = computePlannedSetCount(template.exercises);
  const dominantArchetype = pickDominantArchetype(template.exercises);
  // Honour the template's enemy override (built-ins like Push Day
  // ship a handcrafted Sluggard so the canonical encounter looks
  // and feels exactly as it did before the adapter landed). User
  // imports always go through the auto-derivation path.
  const primaryEnemy =
    template.enemyOverride ??
    deriveEnemyForTemplate(template, dominantArchetype, plannedSetCount);

  const encounter: Encounter = {
    id: template.id,
    name: template.name,
    primaryEnemy,
    bodyweightStrategies: bodyweightForEncounter,
    weightedVariants: weightedForEncounter,
  };

  const quest: QuestDefinition = {
    id: template.id,
    kind: 'strength',
    templateId: template.id,
    plannedSetCount,
  };

  return {
    templateId: template.id,
    workoutName: template.name,
    workoutDescription: template.description,
    encounter,
    quest,
    primaryEnemy,
    nextPhaseEnemy:
      template.nextPhaseEnemyOverride ??
      ((prevMaxHp: number) => ({
        ...primaryEnemy,
        // Continuation enemy is a faded echo of the primary —
        // distinct id so the store's `defeatedEnemies` accounting
        // doesn't double-count.
        id: `${primaryEnemy.id}-shadow`,
        name: `A Lingering ${primaryEnemy.name.split(',')[0]}`,
        maxHp: Math.max(MIN_CONTINUATION_HP, Math.floor(prevMaxHp / 2)),
      })),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function exerciseToVariant(ex: WorkoutExercise): ExerciseVariant & {
  modality: Variant;
} {
  return {
    id: ex.id,
    name: ex.name,
    archetype: ex.archetype,
    profile: ex.profile,
    defaultReps: ex.defaultReps ?? 10,
    defaultWeightKg: ex.defaultWeightKg ?? 0,
    modality: ex.modality,
  };
}

function stripModality(
  v: ExerciseVariant & { modality?: Variant },
): ExerciseVariant {
  const { modality: _m, ...rest } = v;
  return rest;
}

function computePlannedSetCount(
  exercises: readonly WorkoutExercise[],
): number {
  if (exercises.length === 0) return DEFAULT_PLANNED_SET_COUNT;
  let total = 0;
  for (const ex of exercises) {
    total += Math.max(1, Math.floor(ex.defaultSets ?? 3));
  }
  // Defensive cap: a 30-exercise import shouldn't make the
  // orchestrator's soft-cap math degenerate.
  return Math.min(40, total);
}

// ---------------------------------------------------------------------------
// Enemy generation — atmospheric, archetype-driven.
//
// The vocabulary is small on purpose. Each archetype maps to a
// `(category, mood, name pool)` triple; the template's id is hashed
// into a stable pick from the pool so the same workout always
// faces the same opponent. No silly randomness.
// ---------------------------------------------------------------------------

interface EnemyVibe {
  category: EnemyCategory;
  mood: EnemyMood;
  names: readonly string[];
}

const ENEMY_VIBES: Readonly<Record<ExerciseArchetype, EnemyVibe>> = {
  heavy: {
    category: 'ward',
    mood: 'stone',
    names: ['Burden of Iron', 'The Sinking Stone', 'The Weighted Hush'],
  },
  pressure: {
    category: 'lesser_fragment',
    mood: 'drift',
    names: [
      'Sluggard, Lord of Couches',
      'The Drifting Weight',
      'The Long Press',
    ],
  },
  control: {
    category: 'lesser_fragment',
    mood: 'glare',
    names: ['The Watchful Doubt', 'The Held Frame', 'The Bright Stare'],
  },
  foundation: {
    category: 'hollow',
    mood: 'hush',
    names: ['The Held Breath', 'Stillness', 'The Quiet Hour'],
  },
  endurance: {
    category: 'lesser_fragment',
    mood: 'drift',
    names: ['The Long Burn', 'The Slow Tide', 'The Heavy Mile'],
  },
  recovery: {
    category: 'hollow',
    mood: 'hush',
    names: ['Knotted Drift', 'The Tangle', 'The Held Knot'],
  },
};

function pickDominantArchetype(
  exercises: readonly WorkoutExercise[],
): ExerciseArchetype {
  if (exercises.length === 0) return 'pressure';
  // Count occurrences; ties broken by first appearance.
  const counts: Partial<Record<ExerciseArchetype, number>> = {};
  for (const ex of exercises) {
    counts[ex.archetype] = (counts[ex.archetype] ?? 0) + 1;
  }
  let best: ExerciseArchetype = exercises[0].archetype;
  let bestCount = 0;
  for (const a of Object.keys(counts) as ExerciseArchetype[]) {
    const c = counts[a] ?? 0;
    if (c > bestCount) {
      best = a;
      bestCount = c;
    }
  }
  return best;
}

/**
 * Lightweight string hash (djb2 variant). Pure. Used to pick the
 * same enemy name for the same template across runs.
 */
function stableHash(input: string): number {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function deriveEnemyForTemplate(
  template: WorkoutTemplate,
  dominantArchetype: ExerciseArchetype,
  plannedSetCount: number,
): EnemyInput {
  const vibe = ENEMY_VIBES[dominantArchetype] ?? ENEMY_VIBES.pressure;
  const name = vibe.names[stableHash(template.id) % vibe.names.length];
  const maxHp = Math.max(
    MIN_PRIMARY_HP,
    plannedSetCount * HP_PER_PLANNED_SET,
  );
  return {
    id: `enemy-${template.id}`,
    name,
    maxHp,
    mood: vibe.mood,
    category: vibe.category,
  };
}

// ---------------------------------------------------------------------------
// Test-friendly exports.
// ---------------------------------------------------------------------------

export const __testExports = {
  computePlannedSetCount,
  deriveEnemyForTemplate,
  pickDominantArchetype,
  stableHash,
  ENEMY_VIBES,
  MIN_CONTINUATION_HP,
  HP_PER_PLANNED_SET,
  MIN_PRIMARY_HP,
};
