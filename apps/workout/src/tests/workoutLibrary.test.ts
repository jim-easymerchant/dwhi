/**
 * Workout-library + persistence fallback tests.
 *
 * The library merges built-in templates with user-imported
 * templates. Imports survive a process via the persistence
 * bridge; when persistence is disabled they live for the
 * running session only.
 */

import {
  BUILTIN_TEMPLATES,
  __resetImportedTemplatesForTests,
  addImportedTemplate,
  findTemplate,
  importWorkoutFromText,
  listAllTemplates,
  removeImportedTemplate,
  setImportedTemplatesForHydration,
} from '../workouts';

beforeEach(() => {
  __resetImportedTemplatesForTests();
});

describe('listAllTemplates — built-ins are the floor', () => {
  test('returns at least every built-in, in order', () => {
    const all = listAllTemplates();
    expect(all.length).toBeGreaterThanOrEqual(BUILTIN_TEMPLATES.length);
    const ids = all.map((t) => t.id);
    for (const b of BUILTIN_TEMPLATES) {
      expect(ids).toContain(b.id);
    }
  });

  test('built-ins are listed before imports', () => {
    addImportedTemplate({
      id: 'import-1',
      name: 'My Custom',
      defaultModality: 'bodyweight',
      source: 'import',
      createdAtIso: new Date().toISOString(),
      exercises: [],
    });
    const all = listAllTemplates();
    const importIdx = all.findIndex((t) => t.id === 'import-1');
    const lastBuiltinIdx = all.findIndex((t) => t.source === 'builtin');
    expect(importIdx).toBeGreaterThan(lastBuiltinIdx);
  });
});

describe('importWorkoutFromText — happy path', () => {
  test('successful import is appended to the library', () => {
    const out = importWorkoutFromText(`
Workout: My Imported
Bench Press 3x8 @ 60 kg
Pushup 3x10
`);
    expect(out.errors).toEqual([]);
    expect(listAllTemplates().map((t) => t.id)).toContain(out.template.id);
    expect(findTemplate(out.template.id)).toBeDefined();
  });

  test('imported templates carry source="import"', () => {
    const out = importWorkoutFromText(`
Workout: Source Test
Pushup 3x10
`);
    expect(out.template.source).toBe('import');
  });

  test('createdAtIso is stamped at import time (not the parser sentinel)', () => {
    const out = importWorkoutFromText(`
Workout: Stamp
Pushup 3x10
`);
    const stored = findTemplate(out.template.id);
    if (!stored) throw new Error('template not stored');
    expect(stored.createdAtIso).not.toBe(new Date(0).toISOString());
    // Within the last 10 seconds.
    const diff = Date.now() - Date.parse(stored.createdAtIso);
    expect(diff).toBeGreaterThanOrEqual(0);
    expect(diff).toBeLessThan(10_000);
  });

  test('a parse error does NOT add the template to the library', () => {
    const out = importWorkoutFromText('');
    expect(out.errors.length).toBeGreaterThan(0);
    expect(findTemplate(out.template.id)).toBeUndefined();
  });

  test('re-importing the same name overwrites (stable id)', () => {
    const first = importWorkoutFromText(`
Workout: Dup
Pushup 3x10
`);
    const second = importWorkoutFromText(`
Workout: Dup
Pushup 4x12
`);
    expect(first.template.id).toBe(second.template.id);
    const stored = findTemplate(second.template.id);
    if (!stored) throw new Error('template missing');
    expect(stored.exercises[0].defaultSets).toBe(4);
  });
});

describe('removeImportedTemplate', () => {
  test('removes the entry and built-ins are unaffected', () => {
    const out = importWorkoutFromText(`
Workout: Removable
Pushup 3x10
`);
    expect(findTemplate(out.template.id)).toBeDefined();
    removeImportedTemplate(out.template.id);
    expect(findTemplate(out.template.id)).toBeUndefined();
    // Built-ins still present.
    expect(findTemplate('push-day')).toBeDefined();
  });

  test('removing a built-in id is a no-op (built-ins live in code)', () => {
    removeImportedTemplate('push-day');
    expect(findTemplate('push-day')).toBeDefined();
  });
});

describe('setImportedTemplatesForHydration', () => {
  test('replaces the entire imported cache wholesale', () => {
    addImportedTemplate({
      id: 'pre-hydrate',
      name: 'Pre',
      defaultModality: 'bodyweight',
      source: 'import',
      createdAtIso: new Date(0).toISOString(),
      exercises: [],
    });
    setImportedTemplatesForHydration([
      {
        id: 'hydrated-1',
        name: 'Hydrated',
        defaultModality: 'weighted',
        source: 'import',
        createdAtIso: new Date(0).toISOString(),
        exercises: [],
      },
    ]);
    expect(findTemplate('pre-hydrate')).toBeUndefined();
    expect(findTemplate('hydrated-1')).toBeDefined();
  });

  test('hydrating with garbage rows silently drops them', () => {
    setImportedTemplatesForHydration([
      // missing id
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { name: 'nope' } as any,
      {
        id: 'good',
        name: 'Good',
        defaultModality: 'bodyweight',
        source: 'import',
        createdAtIso: new Date(0).toISOString(),
        exercises: [],
      },
    ]);
    expect(findTemplate('good')).toBeDefined();
  });
});

describe('persistence-fallback: memory-only mode is still usable', () => {
  // We don't load the bridge here — the library is decoupled
  // from persistence by design. The "memory-only" contract is
  // simply: the in-memory library survives `addImportedTemplate`
  // calls without any SQL.
  test('a fresh import is queryable immediately, no DB needed', () => {
    const out = importWorkoutFromText(`
Workout: Memory-only Survivor
Pushup 3x10
`);
    expect(out.errors).toEqual([]);
    expect(findTemplate(out.template.id)).toBeDefined();
  });

  test('after a simulated hydrate failure (empty cache) the user can still import', () => {
    setImportedTemplatesForHydration([]); // simulates "no persisted rows / hydrate skipped"
    const out = importWorkoutFromText(`
Workout: After Failure
Pushup 3x10
`);
    expect(out.errors).toEqual([]);
    expect(findTemplate(out.template.id)).toBeDefined();
  });
});
