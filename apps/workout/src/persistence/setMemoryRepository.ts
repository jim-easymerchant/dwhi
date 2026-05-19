/**
 * Set-memory repository — persists the per-set draft snapshot keyed
 * by (exerciseId, modality, variantId, setIndex).
 *
 * Spec: docs/workout-rpg/014-open-ended-encounters-and-set-memory.md §2.
 *
 * All writes are upserts (INSERT … ON CONFLICT DO UPDATE) so the
 * latest log for a tuple is always the source of truth. Reads return
 * the full table as a `Record<key, SetMemoryEntry>` so the store can
 * `setMemory: { ...state.setMemory, ...persisted }` on hydrate.
 */

import { getDb, nowIso } from './db';

export interface SetMemoryEntry {
  reps?: number;
  weightKg?: number;
  durationSeconds?: number;
  recordedAtIso: string;
}

export interface SetMemoryRowKey {
  exerciseId: string;
  modality: string;
  variantId: string;
  setIndex: number;
}

interface Row {
  exercise_id: string;
  modality: string;
  variant_id: string;
  set_index: number;
  reps: number | null;
  weight_kg: number | null;
  duration_seconds: number | null;
  recorded_at_iso: string;
}

function key(k: SetMemoryRowKey): string {
  return `${k.exerciseId}|${k.modality}|${k.variantId}|${k.setIndex}`;
}

function rowToEntry(row: Row): SetMemoryEntry {
  return {
    reps: row.reps ?? undefined,
    weightKg: row.weight_kg ?? undefined,
    durationSeconds: row.duration_seconds ?? undefined,
    recordedAtIso: row.recorded_at_iso,
  };
}

/** Insert or update a single set-memory row. */
export async function saveSetMemory(
  k: SetMemoryRowKey,
  entry: SetMemoryEntry,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO workout_set_memory
       (exercise_id, modality, variant_id, set_index,
        reps, weight_kg, duration_seconds, recorded_at_iso)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(exercise_id, modality, variant_id, set_index)
     DO UPDATE SET
       reps             = excluded.reps,
       weight_kg        = excluded.weight_kg,
       duration_seconds = excluded.duration_seconds,
       recorded_at_iso  = excluded.recorded_at_iso;`,
    [
      k.exerciseId,
      k.modality,
      k.variantId,
      k.setIndex,
      entry.reps ?? null,
      entry.weightKg ?? null,
      entry.durationSeconds ?? null,
      entry.recordedAtIso ?? nowIso(),
    ],
  );
}

/** Load the entire memory table. Returns a `key → entry` map. */
export async function loadAllSetMemory(): Promise<Record<string, SetMemoryEntry>> {
  const db = await getDb();
  const rows = await db.getAllAsync<Row>(
    `SELECT exercise_id, modality, variant_id, set_index,
            reps, weight_kg, duration_seconds, recorded_at_iso
       FROM workout_set_memory;`,
  );
  const out: Record<string, SetMemoryEntry> = {};
  for (const row of rows) {
    out[
      key({
        exerciseId: row.exercise_id,
        modality: row.modality,
        variantId: row.variant_id,
        setIndex: row.set_index,
      })
    ] = rowToEntry(row);
  }
  return out;
}

/** Test-only: wipe the table. */
export async function __wipeSetMemoryForTests(): Promise<void> {
  const db = await getDb();
  await db.execAsync('DELETE FROM workout_set_memory;');
}
