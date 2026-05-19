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
  getMostRecentCompletedAtIso,
  initDatabase,
  loadAllSetMemory,
  loadPlayerMomentum,
  recordIfPersonalRecord,
  savePlayerMomentum,
  saveSetMemory,
  type PRKind,
  type PRLookupKey,
  type PersistedSetMemoryEntry,
  type QuestHistoryRecord,
} from '../persistence';

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
 * Failures are swallowed (the app stays usable with default state)
 * and surfaced through the return value so the UI can choose to
 * show a quiet "history not loaded yet" hint.
 */
export async function hydratePersistence(): Promise<HydrationResult> {
  try {
    await initDatabase();
    const [memoryMap, momentum, lastSessionAtIso] = await Promise.all([
      loadAllSetMemory(),
      loadPlayerMomentum(),
      getMostRecentCompletedAtIso(),
    ]);

    const setMemory: SetMemory = {};
    for (const [k, v] of Object.entries(memoryMap)) {
      setMemory[k] = persistedToStoreEntry(v);
    }

    useWorkoutGameStore.setState({
      setMemory,
      priorMomentum: momentum?.value ?? DEFAULT_PRIOR_MOMENTUM,
      lastSessionAtIso: lastSessionAtIso ?? momentum?.lastSessionAtIso ?? null,
      persistenceReady: true,
    });
    return { ok: true, error: null, setMemoryCount: Object.keys(setMemory).length };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // eslint-disable-next-line no-console
    console.warn('[workout.persistence] hydrate failed:', msg);
    useWorkoutGameStore.setState({ persistenceReady: true });
    return { ok: false, error: msg, setMemoryCount: 0 };
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
 */
export async function persistLoggedSet(
  input: PersistLoggedSetInput,
): Promise<readonly PRKind[]> {
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
 */
export async function persistQuestCompletion(
  input: PersistQuestCompletionInput,
): Promise<void> {
  try {
    const completedAt = clockNow();
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

    // Reflect the just-persisted state back into the store so the
    // home screen sees the new Momentum without needing a re-hydrate.
    useWorkoutGameStore.setState({
      priorMomentum: input.finalMomentum,
      lastSessionAtIso: completedAt,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // eslint-disable-next-line no-console
    console.warn('[workout.persistence] persistQuestCompletion failed:', msg);
  }
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
