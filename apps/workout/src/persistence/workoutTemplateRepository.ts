/**
 * Workout-template repository — user-imported templates only.
 *
 * Built-in templates live in code (`src/workouts/builtins.ts`)
 * and are never stored in this table. This repo persists
 * `WorkoutTemplate` objects whose `source === 'import'`.
 *
 * Storage shape: one row per template; `payload_json` carries
 * the full `WorkoutTemplate` shape so additive type changes do
 * not require a schema migration.
 *
 * Every function is wrapped in safe defaults: a missing table, a
 * corrupted row, or any DB error → returns null/[] on read,
 * false on write. The bridge layer routes the failure into
 * memory-only mode.
 */

import { getDb, nowIso } from './db';

interface Row {
  id: string;
  name: string;
  payload_json: string;
  created_at_iso: string;
  updated_at_iso: string;
}

/** The payload shape this repo persists. Kept structurally close
 *  to `WorkoutTemplate` but typed as `unknown` here so this file
 *  has no dependency on the workouts module (avoids a runtime
 *  cycle through the parser). */
export interface PersistedWorkoutTemplate {
  id: string;
  name: string;
  payload: unknown;
  createdAtIso: string;
  updatedAtIso: string;
}

function rowToRecord(row: Row): PersistedWorkoutTemplate {
  let payload: unknown = null;
  try {
    payload = JSON.parse(row.payload_json);
  } catch {
    payload = null;
  }
  return {
    id: row.id,
    name: row.name,
    payload,
    createdAtIso: row.created_at_iso,
    updatedAtIso: row.updated_at_iso,
  };
}

/**
 * Load every user-imported template, newest-first by
 * `updated_at_iso`. Returns [] on any DB error.
 */
export async function loadAllWorkoutTemplates(): Promise<
  PersistedWorkoutTemplate[]
> {
  try {
    const db = await getDb();
    const rows = await db.getAllAsync<Row>(
      `SELECT id, name, payload_json, created_at_iso, updated_at_iso
         FROM workout_templates
        ORDER BY updated_at_iso DESC;`,
    );
    const out: PersistedWorkoutTemplate[] = [];
    for (const row of rows) {
      if (
        !row ||
        typeof row.id !== 'string' ||
        typeof row.payload_json !== 'string'
      ) {
        // eslint-disable-next-line no-console
        console.warn(
          '[workout.persistence] skipping malformed workout_templates row',
        );
        continue;
      }
      out.push(rowToRecord(row));
    }
    return out;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[workout.persistence] loadAllWorkoutTemplates failed:', e);
    return [];
  }
}

/**
 * Upsert a single template. Returns true on success.
 *
 * The caller is responsible for passing the JSON-serialisable
 * payload as `template`; this repo serialises with `JSON.stringify`.
 */
export async function saveWorkoutTemplate(input: {
  id: string;
  name: string;
  template: unknown;
}): Promise<boolean> {
  if (
    typeof input.id !== 'string' ||
    input.id.length === 0 ||
    typeof input.name !== 'string' ||
    input.name.length === 0
  ) {
    return false;
  }
  let payloadJson: string;
  try {
    payloadJson = JSON.stringify(input.template ?? {});
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(
      '[workout.persistence] saveWorkoutTemplate JSON.stringify failed:',
      e,
    );
    return false;
  }
  try {
    const db = await getDb();
    const now = nowIso();
    await db.runAsync(
      `INSERT INTO workout_templates (id, name, payload_json, created_at_iso, updated_at_iso)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name           = excluded.name,
         payload_json   = excluded.payload_json,
         updated_at_iso = excluded.updated_at_iso;`,
      [input.id, input.name, payloadJson, now, now],
    );
    return true;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[workout.persistence] saveWorkoutTemplate failed:', e);
    return false;
  }
}

/** Delete a single template by id. Returns true on success. */
export async function deleteWorkoutTemplate(id: string): Promise<boolean> {
  if (typeof id !== 'string' || id.length === 0) return false;
  try {
    const db = await getDb();
    await db.runAsync(`DELETE FROM workout_templates WHERE id = ?;`, [id]);
    return true;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[workout.persistence] deleteWorkoutTemplate failed:', e);
    return false;
  }
}

/** Test-only: wipe the table. */
export async function __wipeWorkoutTemplatesForTests(): Promise<void> {
  try {
    const db = await getDb();
    await db.execAsync('DELETE FROM workout_templates;');
  } catch {
    // ignore — table may not exist in some test setups
  }
}
