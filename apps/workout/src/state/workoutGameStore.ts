/**
 * In-memory game store for the Workout RPG shell — open-ended
 * encounter model.
 *
 * NO persistence. NO async. NO network. Set memory survives only
 * for the running process; the next branch
 * (claude/workout-rpg-local-persistence-<token>) lifts it to disk.
 *
 * Spec:
 *   docs/workout-rpg/014-open-ended-encounters-and-set-memory.md
 *   docs/workout-rpg/012-battle-ux-and-feel.md (battle screen tone)
 *
 * Zustand is already a project dependency — no new deps added.
 */

import { create } from 'zustand';
import { runQuest } from '@dwhi/workout-domain';
import type {
  EnemyInput,
  ExerciseArchetype,
  RunQuestResult,
  SetInput,
} from '@dwhi/workout-domain';

import {
  DEFAULT_BODYWEIGHT_KG,
  DEFAULT_PRIOR_MOMENTUM,
  PUSH_DAY_QUEST,
  PUSH_ENCOUNTER,
  SLUGGARD,
  findVariant,
  getNextEnemyPhase,
  variantsFor,
  type ExerciseVariant,
  type Variant,
} from '../fixtures/pushDayQuest';
import type {
  EnemyCategory,
  EnemyMood,
} from '@dwhi/workout-domain';

// ---------------------------------------------------------------------------
// Side-effect handler registry.
//
// The store stays sync. The persistence bridge (which uses
// expo-sqlite) registers fire-and-forget handlers here so that
// store actions can save without import-cycling against the bridge
// module.
// ---------------------------------------------------------------------------

export interface PersistenceHandlers {
  onSetLogged?: (input: {
    exerciseId: string;
    modality: Variant;
    variantId: string;
    setIndex: number;
    reps?: number;
    weightKg?: number;
  }) => void;
  onQuestCompleted?: (input: {
    questId: string;
    templateId?: string | null;
    kind: string;
    workingSetCount: number;
    totalDamage: number;
    xp: number;
    momentumDelta: number;
    defeatedEnemies: readonly DefeatedEnemyEntry[];
    primaryVerdict: string | null;
    finalMomentum: number;
    payload?: unknown;
  }) => void;
  /** Fired when the player selects a theme. Fire-and-forget. */
  onThemeChanged?: (themeId: string) => void;
  /** Fired when the player toggles their weight-unit preference. */
  onWeightUnitChanged?: (unit: 'lb' | 'kg') => void;
}

let handlers: PersistenceHandlers = {};
export function setPersistenceHandlers(h: PersistenceHandlers): void {
  handlers = { ...handlers, ...h };
}
export function __clearPersistenceHandlersForTests(): void {
  handlers = {};
}

// ---------------------------------------------------------------------------
// Tuning — local to this layer, not in the orchestrator balance.
//
// `PLAN_EXPANSION_PER_CONTINUATION` is the number of additional
// planned sets the orchestrator should expect when the player taps
// "Continue Sets" after a victory. Each continuation is an explicit
// commitment to more work, so the static plan grows to match — that
// way the orchestrator's anti-grind (soft-cap taper + junk-volume
// penalty) stays in place but no longer punishes legitimate
// multi-phase encounters with XP = 0.
//
// The orchestrator's balance constants are UNCHANGED.
// ---------------------------------------------------------------------------

export const PLAN_EXPANSION_PER_CONTINUATION = 3;

// ---------------------------------------------------------------------------
// Phase
// ---------------------------------------------------------------------------

export type GamePhase = 'home' | 'battle' | 'rest' | 'reward' | 'settings';

// ---------------------------------------------------------------------------
// Logged set + set memory
// ---------------------------------------------------------------------------

/** One row in the running log of logged sets within this Quest. */
export interface LoggedSet {
  exerciseId: string;
  exerciseName: string;
  archetype: ExerciseArchetype;
  modality: Variant;
  /** 0-based index *within the current variant* — drives orchestrator setIndex. */
  setIndexInVariant: number;
  /** 0-based index across the entire Quest — for display only. */
  setIndexInQuest: number;
  reps: number;
  weightKg: number;
  isWarmup: boolean;
  isPersonalRecord: boolean;
  /** Damage computed for this set by `runQuest()`. */
  damage: number;
  /** True if this set was the killing blow of a phase. */
  finisher: boolean;
  /** Enemy phase index at the time this set was logged. */
  enemyPhaseIndex: number;
}

/** A pre-fillable snapshot keyed by exercise + modality + variant + setIndex. */
export interface SetMemoryEntry {
  reps?: number;
  weightKg?: number;
  durationSeconds?: number;
  recordedAtIso: string;
}

export type SetMemory = Record<string, SetMemoryEntry>;

// ---------------------------------------------------------------------------
// Defeated-enemy tracking — Bug 2.
//
// The orchestrator only sees the single enemy passed via runQuest().
// In open-ended play the player can defeat several phases (Sluggard,
// then a Lingering Shadow, then a smaller Shadow, ...). We record each
// phase here so the Reward screen can summarise them honestly.
// ---------------------------------------------------------------------------

export interface DefeatedEnemyEntry {
  id: string;
  name: string;
  mood: EnemyMood;
  category: EnemyCategory;
  maxHp: number;
  /** Damage applied to this specific phase (capped at maxHp). */
  damageDealtToThisPhase: number;
  /** 0 for the primary, 1+ for continuation fragments. */
  phaseIndex: number;
  /** setIndexInQuest of the killing blow. */
  defeatedOnSetIndexInQuest: number;
}

/** Stable memory key for a set position. */
export function memoryKey(input: {
  exerciseId: string;
  modality: Variant;
  variantId: string;
  setIndex: number;
}): string {
  return `${input.exerciseId}|${input.modality}|${input.variantId}|${input.setIndex}`;
}

/**
 * Look up a pre-fill for `(exerciseId, modality, variantId, setIndex)`.
 * Falls back to the most recent prior `setIndex` for the same key
 * before returning undefined.
 */
export function lookupSetMemory(
  memory: SetMemory,
  base: { exerciseId: string; modality: Variant; variantId: string; setIndex: number },
): SetMemoryEntry | undefined {
  const exact = memory[memoryKey(base)];
  if (exact) return exact;
  for (let i = base.setIndex - 1; i >= 0; i--) {
    const fallback = memory[memoryKey({ ...base, setIndex: i })];
    if (fallback) return fallback;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

const ENCOUNTER = PUSH_ENCOUNTER;
const STATIC_NOW_ISO = '2026-05-19T10:00:00Z';

export interface WorkoutGameState {
  // --- top-level navigation ---
  phase: GamePhase;

  // --- player profile (mocked) ---
  bodyweightKg: number;
  priorMomentum: number;

  // --- persistence-hydrated state ---
  /** Set true once hydratePersistence() has populated the store (or
   * failed gracefully). UI may use this to defer history panels. */
  persistenceReady: boolean;
  /** When true, persistence is latched off for the rest of the
   * session — the app continues in memory-only mode. Writes are
   * no-ops; reads return whatever the running session has accrued. */
  persistenceDisabled: boolean;
  /** Human-readable explanation of why persistence is disabled,
   * surfaced as a small dev-only diagnostic on the Home screen. */
  persistenceError: string | null;
  /** ISO timestamp of the most recently completed Quest. Drives the
   * `daysSinceLastQuest` value passed to runQuest. */
  lastSessionAtIso: string | null;

  /** Currently selected theme pack id ('momentum' or 'ironquest-classic'). */
  selectedThemeId: string;
  /** User-facing weight unit ('lb' default; 'kg' alternative). */
  weightUnit: 'lb' | 'kg';
  /** Cumulative XP across every persisted completed Quest. Drives
   *  the displayed LEVEL on the home screen. Decoupled from
   *  momentum so the LEVEL grows with *history*, not with the
   *  Ember warming up. */
  cumulativeXp: number;

  // --- modality + variant ---
  modality: Variant;
  currentVariantId: string;
  currentSetIndexInVariant: number;

  // --- draft set inputs ---
  draftReps: number;
  draftWeightKg: number;

  // --- enemy state (UX side; orchestrator is canonical for rewards) ---
  currentEnemy: EnemyInput;
  currentEnemyHp: number;
  enemyPhaseIndex: number;
  lastSetDamage: number | null;
  victoryAvailable: boolean;

  // --- multi-phase accounting (Bug 2) ---
  defeatedEnemies: DefeatedEnemyEntry[];
  /** How many times "Continue Sets" was tapped in this Quest. */
  continuationCount: number;

  // --- quest record ---
  log: LoggedSet[];
  setMemory: SetMemory;
  result: RunQuestResult | null;

  // --- transitions ---
  startQuest: (modality: Variant) => void;
  /** Open the Settings panel from anywhere. */
  openSettings: () => void;
  /** Set the active theme pack. Unknown ids fall back silently. */
  setTheme: (themeId: string) => void;
  /** Set the user's weight-unit preference. Unknown values fall
   *  back to 'lb' via `safeWeightUnit`. */
  setWeightUnit: (unit: string) => void;
  setReps: (reps: number) => void;
  setWeight: (weightKg: number) => void;
  logCurrentSet: () => void;
  enterRest: () => void;
  endRest: () => void;
  switchVariant: (variantId: string) => void;
  continueAfterVictory: () => void;
  finishEncounter: () => void;
  finishQuest: () => void;
  returnToCamp: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function variantFor(state: Pick<WorkoutGameState, 'modality' | 'currentVariantId'>): ExerciseVariant {
  return findVariant(ENCOUNTER, state.modality, state.currentVariantId);
}

function defaultsFor(
  modality: Variant,
  variantId: string,
  setIndex: number,
  memory: SetMemory,
): { reps: number; weightKg: number } {
  const variant = findVariant(ENCOUNTER, modality, variantId);
  const memoryHit = lookupSetMemory(memory, {
    exerciseId: variant.id,
    modality,
    variantId,
    setIndex,
  });
  return {
    reps: memoryHit?.reps ?? variant.defaultReps,
    weightKg:
      modality === 'weighted'
        ? memoryHit?.weightKg ?? variant.defaultWeightKg
        : 0,
  };
}

function buildSetInputsFromLog(
  log: readonly LoggedSet[],
  bodyweightKg: number,
): SetInput[] {
  // The first set after a variant change carries `exerciseChanged: true`
  // for fatigue refund + heavy first-set bonus eligibility.
  return log.map((row, i) => {
    const prior = i > 0 ? log[i - 1] : null;
    const exerciseChanged = prior !== null && prior.exerciseId !== row.exerciseId;
    const variant = ENCOUNTER.bodyweightStrategies.concat(
      ENCOUNTER.weightedVariants,
    ).find((v) => v.id === row.exerciseId);
    return {
      exerciseId: row.exerciseId,
      exerciseName: row.exerciseName,
      modality: row.modality,
      archetype: row.archetype,
      exercise: variant?.profile ?? { loadScale: 6, bodyweightCoefficient: 0.5 },
      setIndex: row.setIndexInVariant,
      sessionSetCount: 0, // orchestrator's accumulator computes precise points
      reps: row.reps,
      weightKg: row.weightKg || undefined,
      bodyweightKg,
      isWarmup: row.isWarmup,
      isPersonalRecord: row.isPersonalRecord,
      exerciseChanged,
    };
  });
}

/** A huge enemy used only as a *projection* target so set damage is
 * not capped at remaining HP. The shell tracks phase HP manually. */
const PROJECTION_ENEMY: EnemyInput = {
  ...SLUGGARD,
  maxHp: 1_000_000,
};

/**
 * Whole-day count between the persisted last-session timestamp and
 * now. Returns 999 when no prior session is on record (signals a
 * brand-new install). Returns 0 when the gap is < 24h. Pure.
 */
export function computeDaysSinceLastQuest(
  lastSessionAtIso: string | null,
  nowMs: number = Date.now(),
): number {
  if (!lastSessionAtIso) return 999;
  const last = Date.parse(lastSessionAtIso);
  if (!Number.isFinite(last)) return 999;
  if (nowMs < last) return 0;
  return Math.floor((nowMs - last) / (24 * 60 * 60 * 1000));
}

function projectFinalSetDamage(
  log: readonly LoggedSet[],
  bodyweightKg: number,
  priorMomentum: number,
): number {
  if (log.length === 0) return 0;
  const sets = buildSetInputsFromLog(log, bodyweightKg);
  const projection = runQuest({
    quest: PUSH_DAY_QUEST,
    enemy: PROJECTION_ENEMY,
    sets,
    priorMomentum,
    daysSinceLastQuest: 1,
    nowIso: STATIC_NOW_ISO,
  });
  return projection.setResults[projection.setResults.length - 1]?.damage ?? 0;
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const INITIAL_VARIANT = ENCOUNTER.bodyweightStrategies[0];

const initialDefaults = defaultsFor('bodyweight', INITIAL_VARIANT.id, 0, {});

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useWorkoutGameStore = create<WorkoutGameState>((set, get) => ({
  phase: 'home',
  bodyweightKg: DEFAULT_BODYWEIGHT_KG,
  priorMomentum: DEFAULT_PRIOR_MOMENTUM,

  persistenceReady: false,
  persistenceDisabled: false,
  persistenceError: null,
  lastSessionAtIso: null,

  // The active theme pack. Hydration may overwrite this from the
  // persisted preference; an unknown stored id falls back to
  // 'momentum' via the theme registry's safeThemeId helper.
  selectedThemeId: 'momentum',

  // Weight-unit display preference. Defaults to pounds; hydration
  // overrides from the persisted preference if any.
  weightUnit: 'lb',

  // Cumulative XP — seeded by hydration from SUM(quest_history.xp).
  // Memory-only mode starts at 0 and grows with each finishQuest.
  cumulativeXp: 0,

  modality: 'bodyweight',
  currentVariantId: INITIAL_VARIANT.id,
  currentSetIndexInVariant: 0,

  draftReps: initialDefaults.reps,
  draftWeightKg: initialDefaults.weightKg,

  currentEnemy: SLUGGARD,
  currentEnemyHp: SLUGGARD.maxHp,
  enemyPhaseIndex: 0,
  lastSetDamage: null,
  victoryAvailable: false,

  defeatedEnemies: [],
  continuationCount: 0,

  log: [],
  setMemory: {},
  result: null,

  // -------------------------------------------------------------------
  startQuest: (modality) => {
    const list = variantsFor(ENCOUNTER, modality);
    const firstVariant = list[0];
    const draft = defaultsFor(modality, firstVariant.id, 0, get().setMemory);
    set(() => ({
      phase: 'battle',
      modality,
      currentVariantId: firstVariant.id,
      currentSetIndexInVariant: 0,
      draftReps: draft.reps,
      draftWeightKg: draft.weightKg,
      currentEnemy: SLUGGARD,
      currentEnemyHp: SLUGGARD.maxHp,
      enemyPhaseIndex: 0,
      lastSetDamage: null,
      victoryAvailable: false,
      defeatedEnemies: [],
      continuationCount: 0,
      log: [],
      result: null,
    }));
  },

  // -------------------------------------------------------------------
  // -------------------------------------------------------------------
  openSettings: () => set(() => ({ phase: 'settings' })),

  // -------------------------------------------------------------------
  setTheme: (themeId) => {
    // The registry-aware validation lives in `safeThemeId`. We
    // import lazily here (a require inside the function body) to
    // keep the store module's static graph free of theme code —
    // the screens importing the store get exactly the same bundle
    // they got before the theme system landed. The theme module
    // is pure TypeScript with no native dependencies, so the
    // require is cheap and safe.
    let safe: string = themeId;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
      const { safeThemeId } = require('../theme/themeRegistry') as typeof import('../theme/themeRegistry');
      safe = safeThemeId(themeId);
    } catch {
      // If theme module fails to load (it shouldn't — pure TS),
      // accept the raw id and let downstream getTheme() guard.
    }
    set(() => ({ selectedThemeId: safe }));
    // Fire-and-forget persistence.
    handlers.onThemeChanged?.(safe);
  },

  // -------------------------------------------------------------------
  setWeightUnit: (unit) => {
    // Validate via the units helper; unknown values reset to the
    // default ('lb'). Loaded lazily for the same reason as the
    // theme registry — keeps the store module's static graph
    // independent of unrelated TS modules.
    let safe: 'lb' | 'kg' = 'lb';
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
      const { safeWeightUnit } = require('../units') as typeof import('../units');
      safe = safeWeightUnit(unit);
    } catch {
      // ignore — accept the default
    }
    set(() => ({ weightUnit: safe }));
    handlers.onWeightUnitChanged?.(safe);
  },

  setReps: (reps) => set(() => ({ draftReps: Math.max(0, Math.floor(reps)) })),

  setWeight: (weightKg) =>
    set(() => ({ draftWeightKg: Math.max(0, Math.round(weightKg * 2) / 2) })),

  // -------------------------------------------------------------------
  logCurrentSet: () => {
    const s = get();
    if (s.draftReps <= 0) return;

    const variant = variantFor(s);

    // Auto-detect a PR within this Quest only.
    const sameExercisePrior = s.log.filter(
      (l) => l.exerciseId === variant.id && !l.isWarmup,
    );
    const isPr =
      sameExercisePrior.length > 0 &&
      sameExercisePrior.every((l) => {
        if (s.modality === 'weighted') {
          return s.draftReps * s.draftWeightKg > l.reps * l.weightKg;
        }
        return s.draftReps > l.reps;
      });

    const provisionalRow: LoggedSet = {
      exerciseId: variant.id,
      exerciseName: variant.name,
      archetype: variant.archetype,
      modality: s.modality,
      setIndexInVariant: s.currentSetIndexInVariant,
      setIndexInQuest: s.log.length,
      reps: s.draftReps,
      weightKg: s.draftWeightKg,
      isWarmup: false,
      isPersonalRecord: isPr,
      damage: 0, // populated below
      finisher: false,
      enemyPhaseIndex: s.enemyPhaseIndex,
    };

    const probeLog = [...s.log, provisionalRow];
    const damage = projectFinalSetDamage(probeLog, s.bodyweightKg, s.priorMomentum);
    provisionalRow.damage = damage;

    const newPhaseHp = Math.max(0, s.currentEnemyHp - damage);
    const finisher = newPhaseHp === 0 && s.currentEnemyHp > 0;
    provisionalRow.finisher = finisher;

    // Track defeated phases at the moment HP hits zero. This is the
    // single point of truth: a defeat is recorded once, when it
    // happens. continueAfterVictory does NOT push to this list — that
    // would risk double-counting on edge cases.
    const newDefeated: DefeatedEnemyEntry[] = finisher
      ? [
          ...s.defeatedEnemies,
          {
            id: s.currentEnemy.id,
            name: s.currentEnemy.name,
            mood: s.currentEnemy.mood,
            category: s.currentEnemy.category,
            maxHp: s.currentEnemy.maxHp,
            damageDealtToThisPhase: s.currentEnemy.maxHp,
            phaseIndex: s.enemyPhaseIndex,
            defeatedOnSetIndexInQuest: provisionalRow.setIndexInQuest,
          },
        ]
      : s.defeatedEnemies;

    const memKey = memoryKey({
      exerciseId: variant.id,
      modality: s.modality,
      variantId: variant.id,
      setIndex: s.currentSetIndexInVariant,
    });
    const memoryEntry: SetMemoryEntry = {
      reps: s.draftReps,
      weightKg: s.modality === 'weighted' ? s.draftWeightKg : undefined,
      recordedAtIso: STATIC_NOW_ISO,
    };

    // Pre-fill next set's draft from memory (the just-recorded entry
    // sets up the NEXT setIndex via the same-as-previous fallback).
    const nextSetIndex = s.currentSetIndexInVariant + 1;
    const nextMemory = { ...s.setMemory, [memKey]: memoryEntry };
    const nextDraft = defaultsFor(
      s.modality,
      variant.id,
      nextSetIndex,
      nextMemory,
    );

    set(() => ({
      log: [...s.log, provisionalRow],
      setMemory: nextMemory,
      currentSetIndexInVariant: nextSetIndex,
      currentEnemyHp: newPhaseHp,
      lastSetDamage: damage,
      victoryAvailable: newPhaseHp === 0,
      defeatedEnemies: newDefeated,
      draftReps: nextDraft.reps,
      draftWeightKg: nextDraft.weightKg,
    }));

    // Fire-and-forget persistence — the UI does not await.
    handlers.onSetLogged?.({
      exerciseId: variant.id,
      modality: s.modality,
      variantId: variant.id,
      setIndex: s.currentSetIndexInVariant,
      reps: s.draftReps,
      weightKg: s.modality === 'weighted' ? s.draftWeightKg : undefined,
    });
  },

  // -------------------------------------------------------------------
  enterRest: () => set(() => ({ phase: 'rest' })),

  endRest: () => set(() => ({ phase: 'battle' })),

  // -------------------------------------------------------------------
  switchVariant: (variantId) => {
    const s = get();
    const list = variantsFor(ENCOUNTER, s.modality);
    const found = list.find((v) => v.id === variantId);
    if (!found) return;
    const draft = defaultsFor(s.modality, found.id, 0, s.setMemory);
    set(() => ({
      currentVariantId: found.id,
      currentSetIndexInVariant: 0,
      draftReps: draft.reps,
      draftWeightKg: draft.weightKg,
    }));
  },

  // -------------------------------------------------------------------
  continueAfterVictory: () => {
    const s = get();
    if (!s.victoryAvailable) return;
    const nextEnemy = getNextEnemyPhase(s.currentEnemy.maxHp);
    set(() => ({
      enemyPhaseIndex: s.enemyPhaseIndex + 1,
      currentEnemy: nextEnemy,
      currentEnemyHp: nextEnemy.maxHp,
      victoryAvailable: false,
      lastSetDamage: null,
      // Bump the plan-expansion counter — the player has explicitly
      // committed to more work. finishQuest reads this when sizing
      // the orchestrator's plannedSetCount.
      continuationCount: s.continuationCount + 1,
    }));
  },

  // -------------------------------------------------------------------
  finishEncounter: () => {
    // For MVP, an encounter is the whole quest. Hand off to
    // finishQuest so the orchestrator computes the reward packet.
    get().finishQuest();
  },

  // -------------------------------------------------------------------
  finishQuest: () => {
    const s = get();
    if (s.log.length === 0) return;
    const sets = buildSetInputsFromLog(s.log, s.bodyweightKg);

    // Bug 3 (open-battle-fixes) — Expand plannedSetCount by the
    // number of continuation phases the player explicitly committed
    // to. Orchestrator anti-grind stays intact; the plan reflects
    // what the player chose to do.
    const expandedPlannedSetCount =
      PUSH_DAY_QUEST.plannedSetCount +
      s.continuationCount * PLAN_EXPANSION_PER_CONTINUATION;

    // Days since last quest is now real (persisted across launches),
    // computed by the persistence bridge from `lastSessionAtIso`. We
    // store the derived value as the input to runQuest.
    const days = computeDaysSinceLastQuest(s.lastSessionAtIso);

    const result = runQuest({
      quest: { ...PUSH_DAY_QUEST, plannedSetCount: expandedPlannedSetCount },
      enemy: SLUGGARD,
      sets,
      priorMomentum: s.priorMomentum,
      daysSinceLastQuest: days,
      nowIso: STATIC_NOW_ISO,
    });
    set(() => ({
      phase: 'reward',
      result,
      // Accumulate quest XP so the displayed LEVEL grows with the
      // player's history. The persistence bridge separately
      // appends a row to workout_quest_history; hydration on a
      // fresh launch re-seeds this same value from SUM(xp).
      cumulativeXp: s.cumulativeXp + Math.max(0, result.questXp.xp),
    }));

    // Fire-and-forget — saves momentum + appends history.
    handlers.onQuestCompleted?.({
      questId: `quest-${Date.now()}`,
      templateId: PUSH_DAY_QUEST.templateId ?? null,
      kind: PUSH_DAY_QUEST.kind,
      workingSetCount: result.questXp.setCountForVolume,
      totalDamage: result.totalDamage,
      xp: result.questXp.xp,
      momentumDelta: result.momentum.gainBreakdown.applied,
      defeatedEnemies: s.defeatedEnemies,
      primaryVerdict: result.verdicts[0] ?? null,
      finalMomentum: result.momentum.final,
      payload: {
        verdicts: result.verdicts,
        rewards: result.rewards,
        momentum: result.momentum,
      },
    });
  },

  // -------------------------------------------------------------------
  returnToCamp: () => {
    const s = get();
    const draft = defaultsFor('bodyweight', INITIAL_VARIANT.id, 0, s.setMemory);
    set(() => ({
      phase: 'home',
      modality: 'bodyweight',
      currentVariantId: INITIAL_VARIANT.id,
      currentSetIndexInVariant: 0,
      draftReps: draft.reps,
      draftWeightKg: draft.weightKg,
      currentEnemy: SLUGGARD,
      currentEnemyHp: SLUGGARD.maxHp,
      enemyPhaseIndex: 0,
      lastSetDamage: null,
      victoryAvailable: false,
      defeatedEnemies: [],
      continuationCount: 0,
      log: [],
      result: null,
      // setMemory, priorMomentum, lastSessionAtIso, and
      // persistenceReady are intentionally preserved.
    }));
  },
}));

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export function getCurrentVariant(state: WorkoutGameState): ExerciseVariant {
  return variantFor(state);
}

export function getAvailableVariants(
  state: Pick<WorkoutGameState, 'modality'>,
): readonly ExerciseVariant[] {
  return variantsFor(ENCOUNTER, state.modality);
}

export function getBattleProgress(state: WorkoutGameState): number {
  const max = state.currentEnemy.maxHp;
  if (max <= 0) return 1;
  return Math.min(1, Math.max(0, 1 - state.currentEnemyHp / max));
}

/**
 * Total damage dealt across every phase of the encounter, capped
 * per phase at that phase's maxHp. Bug-2 helper for the Reward
 * screen — the orchestrator's `enemyResult.totalDamage` only sees
 * the original (Sluggard) phase.
 */
export function getTotalDamageAcrossPhases(state: WorkoutGameState): number {
  const fromDefeated = state.defeatedEnemies.reduce(
    (acc, e) => acc + e.damageDealtToThisPhase,
    0,
  );
  // The currently-active phase may have partial damage applied.
  const currentApplied = Math.max(
    0,
    state.currentEnemy.maxHp - state.currentEnemyHp,
  );
  // If the current phase was just defeated, it's already counted in
  // `defeatedEnemies` — currentApplied == maxHp and currentEnemyHp == 0
  // would double-count. Guard against it.
  const alreadyDefeated = state.defeatedEnemies.some(
    (e) =>
      e.id === state.currentEnemy.id &&
      e.phaseIndex === state.enemyPhaseIndex,
  );
  return fromDefeated + (alreadyDefeated ? 0 : currentApplied);
}

// ---------------------------------------------------------------------------
// Test helpers (pure)
// ---------------------------------------------------------------------------

export const __test__ = {
  buildSetInputsFromLog,
  defaultsFor,
  projectFinalSetDamage,
  memoryKey,
  lookupSetMemory,
};
