/**
 * Personal-record repository — cross-Quest PR tracking.
 *
 * Spec: 003-combat-mechanics.md §2.6 (crit fires on rep / weight /
 * volume PR). Up to this branch, the shell only detected PRs WITHIN
 * the current Quest because there was no storage. With this layer,
 * the per-set damage path can ask: "is this set higher than any
 * previous set on the same (exercise, modality, variant) on this
 * `kind`?"
 *
 * `kind` ∈ 'rep' | 'weight' | 'volume':
 *   - rep:    most reps recorded at any weight (including 0).
 *   - weight: most weight recorded at any rep count.
 *   - volume: highest `reps * weight` recorded.
 */

import { getDb, nowIso } from './db';

export type PRKind = 'rep' | 'weight' | 'volume';

export interface PersonalRecord {
  exerciseId: string;
  modality: string;
  variantId: string;
  kind: PRKind;
  value: number;
  reps?: number;
  weightKg?: number;
  recordedAtIso: string;
}

export interface PRLookupKey {
  exerciseId: string;
  modality: string;
  variantId: string;
}

interface Row {
  exercise_id: string;
  modality: string;
  variant_id: string;
  kind: string;
  value: number;
  reps: number | null;
  weight_kg: number | null;
  recorded_at_iso: string;
}

function rowToRecord(row: Row): PersonalRecord {
  return {
    exerciseId: row.exercise_id,
    modality: row.modality,
    variantId: row.variant_id,
    kind: row.kind as PRKind,
    value: row.value,
    reps: row.reps ?? undefined,
    weightKg: row.weight_kg ?? undefined,
    recordedAtIso: row.recorded_at_iso,
  };
}

/** Read all PRs for a given (exercise, modality, variant). Empty array if none. */
export async function getPersonalRecords(
  k: PRLookupKey,
): Promise<PersonalRecord[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Row>(
    `SELECT exercise_id, modality, variant_id, kind, value, reps,
            weight_kg, recorded_at_iso
       FROM workout_personal_records
       WHERE exercise_id = ? AND modality = ? AND variant_id = ?;`,
    [k.exerciseId, k.modality, k.variantId],
  );
  return rows.map(rowToRecord);
}

/**
 * Compute candidate values from a logged set + the PR kinds it
 * triggers. Pure — does not consult the DB. Caller pairs it with
 * `getPersonalRecords` to decide whether to call `upsertPersonalRecord`.
 */
export function candidateValues(input: {
  reps?: number;
  weightKg?: number;
}): Partial<Record<PRKind, number>> {
  const reps = input.reps ?? 0;
  const weight = input.weightKg ?? 0;
  const out: Partial<Record<PRKind, number>> = {};
  if (reps > 0) out.rep = reps;
  if (weight > 0) out.weight = weight;
  if (reps > 0 && weight > 0) out.volume = reps * weight;
  return out;
}

/** Insert or update a single PR row. */
export async function upsertPersonalRecord(record: PersonalRecord): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO workout_personal_records
       (exercise_id, modality, variant_id, kind, value, reps,
        weight_kg, recorded_at_iso)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(exercise_id, modality, variant_id, kind) DO UPDATE SET
       value           = excluded.value,
       reps            = excluded.reps,
       weight_kg       = excluded.weight_kg,
       recorded_at_iso = excluded.recorded_at_iso;`,
    [
      record.exerciseId,
      record.modality,
      record.variantId,
      record.kind,
      record.value,
      record.reps ?? null,
      record.weightKg ?? null,
      record.recordedAtIso ?? nowIso(),
    ],
  );
}

/**
 * Resolve PRs in one transaction: read current bests, compute
 * candidates, write only the kinds that improved. Returns the kinds
 * that were upgraded (so the caller can flag the set as a crit).
 */
export async function recordIfPersonalRecord(input: {
  key: PRLookupKey;
  reps?: number;
  weightKg?: number;
  recordedAtIso?: string;
}): Promise<readonly PRKind[]> {
  const candidates = candidateValues(input);
  if (Object.keys(candidates).length === 0) return [];
  const existing = await getPersonalRecords(input.key);
  const existingByKind = new Map<PRKind, number>();
  for (const e of existing) existingByKind.set(e.kind, e.value);

  const upgraded: PRKind[] = [];
  for (const [kindStr, value] of Object.entries(candidates)) {
    const kind = kindStr as PRKind;
    const prev = existingByKind.get(kind);
    if (prev === undefined || value > prev) {
      await upsertPersonalRecord({
        ...input.key,
        kind,
        value,
        reps: input.reps,
        weightKg: input.weightKg,
        recordedAtIso: input.recordedAtIso ?? nowIso(),
      });
      upgraded.push(kind);
    }
  }
  return upgraded;
}

/** Test-only: wipe the table. */
export async function __wipePersonalRecordsForTests(): Promise<void> {
  const db = await getDb();
  await db.execAsync('DELETE FROM workout_personal_records;');
}
