/**
 * Persistence bridge — connects the in-memory workout store to the
 * SQLite layer at `apps/workout/src/persistence/`.
 *
 * Three responsibilities:
 *
 *   1. hydratePersistence()    — load on app start
 *   2. persistLoggedSet()      — save set memory + PR after each
 *                                attack
 *   3. persistQuestCompletion()— save momentum + append history
 *                                after each Quest finishes
 *
 * All write paths are fire-and-forget from the UI's perspective —
 * the store mutates synchronously, persistence happens in the
 * background, and persistence failures do not crash the player out
 * of their session (they are logged via console.warn).
 *
 * No new dependencies. expo-sqlite is already the workspace's
 * canonical local storage.
 */

import {
  appendQuestHistory,
  disablePersistence,
  getMostRecentCompletedAtIso,
  getPersistenceDisabledReason,
  initDatabase,
  isPersistenceDisabled,
  loadAllSetMemory,
  loadAllWorkoutTemplates,
  loadPlayerMomentum,
  loadSessionCountSince,
  loadStoredThemeId,
  loadStoredWeightUnit,
  loadStoredWorkoutTemplateId,
  loadTotalQuestXp,
  recordIfPersonalRecord,
  savePlayerMomentum,
  saveSetMemory,
  saveStoredThemeId,
  saveStoredWeightUnit,
  saveStoredWorkoutTemplateId,
  saveWorkoutTemplate,
  type PRKind,
  type PRLookupKey,
  type PersistedSetMemoryEntry,
  type QuestHistoryRecord,
} from '../persistence';
import { safeThemeId } from '../theme/themeRegistry';
import { safeWeightUnit } from '../units';
import {
  setImportedTemplatesForHydration,
  type WorkoutTemplate,
} from '../workouts';

import {
  type DefeatedEnemyEntry,
  type SetMemory,
  type SetMemoryEntry,
  useWorkoutGameStore,
} from './workoutGameStore';
import { DEFAULT_PRIOR_MOMENTUM } from '../fixtures/pushDayQuest';

// ---------------------------------------------------------------------------
// Injectable clock — tests override; production uses Date.
// ---------------------------------------------------------------------------

let clockNow: () => string = () => new Date().toISOString();
export function __setClockForTests(fn: () => string): void {
  clockNow = fn;
}
export function __resetClockForTests(): void {
  clockNow = () => new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Hydration
// ---------------------------------------------------------------------------

interface HydrationResult {
  /** True if the hydration succeeded (or "no rows yet" — both are healthy). */
  ok: boolean;
  /** The error message if hydration failed; null on success. */
  error: string | null;
  /** Number of set-memory rows loaded. */
  setMemoryCount: number;
}

/**
 * Load persisted state into the store. Safe to call multiple times —
 * later calls are still cheap because the DB connection is cached.
 *
 * Guarantees:
 *   - never throws (the async function always resolves)
 *   - on success, sets persistenceReady=true and seeds the store
 *   - on failure, sets persistenceReady=true,
 *     persistenceDisabled=true, persistenceError=message
 *   - the store flags are the contract the UI reads to surface
 *     the "memory-only" diagnostic
 */
export async function hydratePersistence(): Promise<HydrationResult> {
  // Defensive belt: even if a future caller manages to invoke us
  // after persistence has been disabled (e.g. by a repo writing
  // before hydrate ran), don't pretend the DB is healthy.
  if (isPersistenceDisabled()) {
    const reason = getPersistenceDisabledReason() ?? 'unknown';
    setStoreToMemoryOnly(reason);
    return { ok: false, error: reason, setMemoryCount: 0 };
  }

  try {
    await initDatabase();
    const RECENT_WINDOW_DAYS = 14;
    const recentWindowIso = new Date(
      Date.now() - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();

    const [
      memoryMap,
      momentum,
      lastSessionAtIso,
      storedThemeId,
      storedWeightUnit,
      totalQuestXp,
      recentSessionsCount,
      persistedTemplates,
      storedWorkoutTemplateId,
    ] = await Promise.all([
      loadAllSetMemory().catch((e) => {
        // eslint-disable-next-line no-console
        console.warn('[workout.persistence] loadAllSetMemory failed:', e);
        return {} as Record<string, PersistedSetMemoryEntry>;
      }),
      loadPlayerMomentum().catch((e) => {
        // eslint-disable-next-line no-console
        console.warn('[workout.persistence] loadPlayerMomentum failed:', e);
        return null;
      }),
      getMostRecentCompletedAtIso().catch((e) => {
        // eslint-disable-next-line no-console
        console.warn('[workout.persistence] last-completed-at failed:', e);
        return null;
      }),
      loadStoredThemeId().catch((e) => {
        // eslint-disable-next-line no-console
        console.warn('[workout.persistence] loadStoredThemeId failed:', e);
        return null;
      }),
      loadStoredWeightUnit().catch((e) => {
        // eslint-disable-next-line no-console
        console.warn('[workout.persistence] loadStoredWeightUnit failed:', e);
        return null;
      }),
      loadTotalQuestXp().catch((e) => {
        // eslint-disable-next-line no-console
        console.warn('[workout.persistence] loadTotalQuestXp failed:', e);
        return 0;
      }),
      loadSessionCountSince(recentWindowIso).catch((e) => {
        // eslint-disable-next-line no-console
        console.warn('[workout.persistence] loadSessionCountSince failed:', e);
        return 0;
      }),
      loadAllWorkoutTemplates().catch((e) => {
        // eslint-disable-next-line no-console
        console.warn(
          '[workout.persistence] loadAllWorkoutTemplates failed:',
          e,
        );
        return [];
      }),
      loadStoredWorkoutTemplateId().catch((e) => {
        // eslint-disable-next-line no-console
        console.warn(
          '[workout.persistence] loadStoredWorkoutTemplateId failed:',
          e,
        );
        return null;
      }),
    ]);

    // Seed the in-memory workout library from persisted rows.
    // `persistedTemplates[].payload` is the JSON-deserialised
    // WorkoutTemplate. Bad/missing payloads are silently dropped.
    const importedTemplates: WorkoutTemplate[] = [];
    for (const row of persistedTemplates ?? []) {
      const p = row.payload as Partial<WorkoutTemplate> | null;
      if (
        p &&
        typeof p.id === 'string' &&
        typeof p.name === 'string' &&
        Array.isArray(p.exercises)
      ) {
        importedTemplates.push(p as WorkoutTemplate);
      }
    }
    setImportedTemplatesForHydration(importedTemplates);

    // Resolve the persisted workout-template-id to a runtime
    // encounter. Unknown ids (deleted template, stale row) fall
    // back to Push Day. The store will rebuild the runtime
    // encounter at the next `startQuest()`, but we seed
    // `activeEncounter` here too so the home screen reflects the
    // right workout *before* the first quest.
    // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
    const wk = require('../workouts') as typeof import('../workouts');
    const resolvedTemplateId =
      typeof storedWorkoutTemplateId === 'string' &&
      wk.findTemplate(storedWorkoutTemplateId) !== undefined
        ? storedWorkoutTemplateId
        : 'push-day';
    const resolvedTemplate = wk.findTemplate(resolvedTemplateId);
    const resolvedRuntime = resolvedTemplate
      ? wk.templateToRuntimeEncounter(resolvedTemplate)
      : null;

    const setMemory: SetMemory = {};
    for (const [k, v] of Object.entries(memoryMap)) {
      try {
        setMemory[k] = persistedToStoreEntry(v);
      } catch (e) {
        // Skip malformed rows; never let one bad row sink hydrate.
        // eslint-disable-next-line no-console
        console.warn(`[workout.persistence] skipping malformed row ${k}:`, e);
      }
    }

    useWorkoutGameStore.setState({
      setMemory,
      priorMomentum: momentum?.value ?? DEFAULT_PRIOR_MOMENTUM,
      lastSessionAtIso: lastSessionAtIso ?? momentum?.lastSessionAtIso ?? null,
      selectedThemeId: safeThemeId(storedThemeId),
      weightUnit: safeWeightUnit(storedWeightUnit),
      cumulativeXp: Math.max(0, totalQuestXp ?? 0),
      recentSessionsCount: Math.max(0, recentSessionsCount ?? 0),
      selectedTemplateId: resolvedTemplateId,
      ...(resolvedRuntime ? { activeEncounter: resolvedRuntime } : {}),
      persistenceReady: true,
      persistenceDisabled: false,
      persistenceError: null,
    });
    return { ok: true, error: null, setMemoryCount: Object.keys(setMemory).length };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // eslint-disable-next-line no-console
    console.warn('[workout.persistence] hydrate failed:', msg);
    // Make sure the DB layer is latched off — even if the failure
    // came from somewhere init() didn't already mark.
    disablePersistence(msg);
    setStoreToMemoryOnly(msg);
    return { ok: false, error: msg, setMemoryCount: 0 };
  }
}

/** Single point of truth for the "fall back to memory-only" flip. */
function setStoreToMemoryOnly(message: string): void {
  try {
    useWorkoutGameStore.setState({
      persistenceReady: true,
      persistenceDisabled: true,
      persistenceError: message,
    });
  } catch (e) {
    // Zustand's setState shouldn't throw, but if it does we still
    // want startup to survive.
    // eslint-disable-next-line no-console
    console.warn('[workout.persistence] setStoreToMemoryOnly failed:', e);
  }
}

function persistedToStoreEntry(e: PersistedSetMemoryEntry): SetMemoryEntry {
  return {
    reps: e.reps,
    weightKg: e.weightKg,
    durationSeconds: e.durationSeconds,
    recordedAtIso: e.recordedAtIso,
  };
}

// ---------------------------------------------------------------------------
// Persist a single logged set
// ---------------------------------------------------------------------------

export interface PersistLoggedSetInput {
  exerciseId: string;
  modality: string;
  variantId: string;
  setIndex: number;
  reps?: number;
  weightKg?: number;
  durationSeconds?: number;
}

/**
 * Save set memory + check for a cross-Quest PR upgrade. Returns the
 * list of PR kinds that were upgraded (the caller can use this to
 * decorate the log entry; the store can opt to refresh the PR cache
 * if it carries one).
 *
 * Guarantees: never throws. Short-circuits when persistence is
 * disabled — repeated calls after a failed init do not keep hitting
 * the native bridge.
 */
export async function persistLoggedSet(
  input: PersistLoggedSetInput,
): Promise<readonly PRKind[]> {
  if (isPersistenceDisabled()) return [];
  try {
    const now = clockNow();
    await saveSetMemory(
      {
        exerciseId: input.exerciseId,
        modality: input.modality,
        variantId: input.variantId,
        setIndex: input.setIndex,
      },
      {
        reps: input.reps,
        weightKg: input.weightKg,
        durationSeconds: input.durationSeconds,
        recordedAtIso: now,
      },
    );
    const upgraded = await recordIfPersonalRecord({
      key: lookupKey(input),
      reps: input.reps,
      weightKg: input.weightKg,
      recordedAtIso: now,
    });
    return upgraded;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // eslint-disable-next-line no-console
    console.warn('[workout.persistence] persistLoggedSet failed:', msg);
    // If this looks like a structural failure (anything beyond an
    // ad-hoc write conflict), latch persistence off so we stop
    // logging the same stack every set.
    if (looksStructural(msg)) {
      disablePersistence(`persistLoggedSet: ${msg}`);
      setStoreToMemoryOnly(`persistLoggedSet: ${msg}`);
    }
    return [];
  }
}

function lookupKey(k: {
  exerciseId: string;
  modality: string;
  variantId: string;
}): PRLookupKey {
  return {
    exerciseId: k.exerciseId,
    modality: k.modality,
    variantId: k.variantId,
  };
}

// ---------------------------------------------------------------------------
// Persist a completed Quest
// ---------------------------------------------------------------------------

export interface PersistQuestCompletionInput {
  questId: string;
  templateId?: string | null;
  kind: string;
  startedAtIso?: string | null;
  workingSetCount: number;
  totalDamage: number;
  xp: number;
  momentumDelta: number;
  defeatedEnemies: readonly DefeatedEnemyEntry[];
  primaryVerdict: string | null;
  finalMomentum: number;
  payload?: unknown;
}

/**
 * After `runQuest` returns, persist:
 *   - the new resolved Momentum value + last_session_at_iso
 *   - one row in workout_quest_history with denormalised summary
 *     plus the full orchestrator result JSON
 *
 * Always reflects the new momentum + lastSessionAtIso into the
 * store, even if the persistence write fails — the in-memory state
 * is what the Reward screen reads.
 *
 * Guarantees: never throws. Short-circuits when persistence is
 * disabled.
 */
export async function persistQuestCompletion(
  input: PersistQuestCompletionInput,
): Promise<void> {
  const completedAt = clockNow();

  // Update the store first so the Reward screen always reflects the
  // just-completed Quest regardless of disk write outcome.
  try {
    useWorkoutGameStore.setState({
      priorMomentum: input.finalMomentum,
      lastSessionAtIso: completedAt,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[workout.persistence] store reflect failed:', e);
  }

  if (isPersistenceDisabled()) return;

  try {
    await savePlayerMomentum({
      value: input.finalMomentum,
      lastSessionAtIso: completedAt,
      lastReturnBonusAtIso: null, // not tracked yet
      gentleModeUntilIso: null,   // not tracked yet
    });
    const record: QuestHistoryRecord = {
      id: input.questId,
      kind: input.kind,
      templateId: input.templateId ?? null,
      startedAtIso: input.startedAtIso ?? null,
      completedAtIso: completedAt,
      workingSetCount: input.workingSetCount,
      totalDamage: input.totalDamage,
      xp: input.xp,
      momentumDelta: input.momentumDelta,
      defeatedCount: input.defeatedEnemies.length,
      primaryVerdict: input.primaryVerdict,
      payloadJson: input.payload
        ? safeStringify({
            defeatedEnemies: input.defeatedEnemies,
            summary: input.payload,
          })
        : null,
    };
    await appendQuestHistory(record);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // eslint-disable-next-line no-console
    console.warn('[workout.persistence] persistQuestCompletion failed:', msg);
    if (looksStructural(msg)) {
      disablePersistence(`persistQuestCompletion: ${msg}`);
      setStoreToMemoryOnly(`persistQuestCompletion: ${msg}`);
    }
  }
}

/**
 * Save the user's selected theme. Fire-and-forget. Resolves (never
 * rejects) regardless of outcome — failures are logged. Short-
 * circuits when persistence is disabled.
 */
export async function persistThemeSelection(themeId: string): Promise<void> {
  if (isPersistenceDisabled()) return;
  try {
    await saveStoredThemeId(themeId);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[workout.persistence] persistThemeSelection failed:', e);
  }
}

/**
 * Save the user's weight-unit preference. Fire-and-forget; resolves
 * regardless of outcome. Short-circuits when persistence is
 * disabled (memory-only mode keeps the chosen unit for the running
 * session via the store, but cannot survive a restart).
 */
export async function persistWeightUnit(unit: string): Promise<void> {
  if (isPersistenceDisabled()) return;
  try {
    await saveStoredWeightUnit(unit);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[workout.persistence] persistWeightUnit failed:', e);
  }
}

/**
 * Save the player's selected workout-template id. Fire-and-forget;
 * resolves regardless of outcome.
 */
export async function persistSelectedWorkoutTemplate(
  templateId: string,
): Promise<void> {
  if (isPersistenceDisabled()) return;
  try {
    await saveStoredWorkoutTemplateId(templateId);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(
      '[workout.persistence] persistSelectedWorkoutTemplate failed:',
      e,
    );
  }
}

/**
 * Persist a user-imported workout template. Fire-and-forget;
 * resolves regardless of outcome. Returns false on failure so
 * the UI can choose to surface "memory-only" status, but the
 * in-memory library is always updated by the caller
 * (`importWorkoutFromText` does that synchronously).
 */
export async function persistImportedWorkoutTemplate(
  template: WorkoutTemplate,
): Promise<boolean> {
  if (isPersistenceDisabled()) return false;
  try {
    return await saveWorkoutTemplate({
      id: template.id,
      name: template.name,
      template,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(
      '[workout.persistence] persistImportedWorkoutTemplate failed:',
      e,
    );
    return false;
  }
}

/**
 * Recognise messages from the DB layer that signal "the persistence
 * pipeline is fundamentally broken, stop trying." Open / migration /
 * native-bridge failures latch persistence off. Per-row violations
 * (foreign-key, unique conflict, etc.) do not.
 */
function looksStructural(message: string): boolean {
  return (
    /persistence disabled/i.test(message) ||
    /open.*async/i.test(message) ||
    /initDatabase/i.test(message) ||
    /database is locked/i.test(message) ||
    /no such table/i.test(message) ||
    /no such column/i.test(message) ||
    /not a database/i.test(message)
  );
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return '{}';
  }
}

// ---------------------------------------------------------------------------
// Days-since-last-quest helper — derived from the persisted timestamp.
// ---------------------------------------------------------------------------

/**
 * Whole-day count between `lastSessionAtIso` and the injectable
 * clock. Returns a large number (999) when no prior session exists.
 * Returns 0 when the gap is < 24h.
 */
export function daysSinceLastQuest(
  lastSessionAtIso: string | null,
): number {
  if (!lastSessionAtIso) return 999;
  const last = Date.parse(lastSessionAtIso);
  if (!Number.isFinite(last)) return 999;
  const now = Date.parse(clockNow());
  if (!Number.isFinite(now) || now < last) return 0;
  const ms = now - last;
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}
