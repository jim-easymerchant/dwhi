/**
 * Workout library — the merged view of built-in + user-imported
 * templates.
 *
 * Memory-only mode: if persistence is unavailable (Expo Go without
 * expo-sqlite, hydration failed, etc.) the library still works —
 * imports live for the running session only. The bridge layer
 * never throws into the UI; this module mirrors that contract.
 *
 * Pure logic; the only side effect is the (optional) save through
 * the persistence repository, which itself is fire-and-forget.
 */

import { BUILTIN_TEMPLATES } from './builtins';
import { parseWorkoutText } from './parser';
import type {
  WorkoutImportResult,
  WorkoutTemplate,
} from './types';

// ---------------------------------------------------------------------------
// In-memory registry of imported templates.
//
// Persistence layer hydrates this at boot; subsequent imports
// append. The bridge fires-and-forgets writes; this module never
// awaits them — UI updates immediately.
// ---------------------------------------------------------------------------

const importedTemplates: Map<string, WorkoutTemplate> = new Map();

/**
 * Replace the imported-template cache wholesale. Used by the
 * persistence bridge on hydrate.
 */
export function setImportedTemplatesForHydration(
  templates: readonly WorkoutTemplate[],
): void {
  importedTemplates.clear();
  for (const t of templates) {
    if (t && typeof t.id === 'string' && t.id.length > 0) {
      importedTemplates.set(t.id, t);
    }
  }
}

/**
 * Add (or overwrite) one imported template. Returns the stored
 * value (with stamps applied).
 */
export function addImportedTemplate(template: WorkoutTemplate): WorkoutTemplate {
  const stamped: WorkoutTemplate = {
    ...template,
    source: 'import',
    createdAtIso:
      template.createdAtIso && template.createdAtIso !== new Date(0).toISOString()
        ? template.createdAtIso
        : new Date().toISOString(),
  };
  importedTemplates.set(stamped.id, stamped);
  return stamped;
}

/** Remove an imported template by id. No-op for built-ins. */
export function removeImportedTemplate(id: string): void {
  importedTemplates.delete(id);
}

// ---------------------------------------------------------------------------
// Read API
// ---------------------------------------------------------------------------

/**
 * Every template the user can pick today: built-ins followed by
 * imports (most-recently-imported first).
 */
export function listAllTemplates(): readonly WorkoutTemplate[] {
  // Stable order: built-ins first (they have curated descriptions),
  // imports after. Imports are returned in insertion order, which
  // — for the hydration call — comes from
  // `loadAllWorkoutTemplates()` sorted by updated_at_iso DESC.
  return [...BUILTIN_TEMPLATES, ...importedTemplates.values()];
}

/** Look up a single template by id (either built-in or imported). */
export function findTemplate(id: string): WorkoutTemplate | undefined {
  for (const t of BUILTIN_TEMPLATES) {
    if (t.id === id) return t;
  }
  return importedTemplates.get(id);
}

// ---------------------------------------------------------------------------
// Import pipeline
// ---------------------------------------------------------------------------

/**
 * Parse the given text and, if the parse succeeded with at least
 * one exercise, add the resulting template to the in-memory
 * library. Returns the parser result (callers can read
 * `warnings` / `errors` to render preview UI).
 */
export function importWorkoutFromText(input: string): WorkoutImportResult {
  const result = parseWorkoutText(input);
  if (result.errors.length === 0 && result.template.exercises.length > 0) {
    const stored = addImportedTemplate(result.template);
    return {
      template: stored,
      warnings: result.warnings,
      errors: result.errors,
    };
  }
  return result;
}

/** Test-only: clear the imported-template cache. */
export function __resetImportedTemplatesForTests(): void {
  importedTemplates.clear();
}
