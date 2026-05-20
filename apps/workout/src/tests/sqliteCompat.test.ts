/**
 * SQLite-compatibility regression tests.
 *
 * Pins the contract from the hard-startup-crash fix: no static
 * `import 'expo-sqlite'` anywhere in the persistence layer, and
 * every failure mode (missing module, missing API surface, open
 * rejection) latches persistence off without throwing.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  __clearDisabledForTests,
  __resetInitCacheForTests,
  __setSqliteModuleForTests,
  disablePersistence,
  getDb,
  getPersistenceDisabledReason,
  initDatabase,
  isPersistenceDisabled,
} from '../persistence/db';

const PERSIST_DIR = path.resolve(__dirname, '..', 'persistence');

function fresh(): void {
  __resetInitCacheForTests();
  __clearDisabledForTests();
  __setSqliteModuleForTests(null);
}

beforeEach(fresh);
afterAll(fresh);

// ===========================================================================
// 1. No static expo-sqlite import in db.ts
// ===========================================================================

describe('db.ts — no static expo-sqlite import', () => {
  const dbFile = path.join(PERSIST_DIR, 'db.ts');
  const text = fs.readFileSync(dbFile, 'utf8');
  const beforeFirstFunction = text.split(
    /\nfunction|\nexport (?:default )?function|\nasync function/,
    1,
  )[0];

  test('no top-level `import ... from "expo-sqlite"` in db.ts', () => {
    expect(beforeFirstFunction).not.toMatch(
      /^\s*import\s+[^;]*from\s+['"]expo-sqlite['"]/m,
    );
  });

  test('expo-sqlite is loaded only via a deferred require()', () => {
    const deferred = text.match(/require\s*\(\s*['"]expo-sqlite['"]\s*\)/g);
    expect(deferred).not.toBeNull();
    expect(deferred!.length).toBeGreaterThanOrEqual(1);
  });

  test('no other persistence file static-imports expo-sqlite', () => {
    for (const entry of fs.readdirSync(PERSIST_DIR)) {
      if (!/\.ts$/.test(entry)) continue;
      if (entry === 'db.ts') continue;
      const src = fs.readFileSync(path.join(PERSIST_DIR, entry), 'utf8');
      expect(src).not.toMatch(/from\s+['"]expo-sqlite/);
      expect(src).not.toMatch(/require\(\s*['"]expo-sqlite/);
    }
  });
});

// ===========================================================================
// 2. Missing expo-sqlite module disables persistence (does not crash)
// ===========================================================================

describe('SQLite require() failure', () => {
  test('when injected module is null and require throws, getDb rejects + disables persistence', async () => {
    // Simulate require failure by injecting an object that fails
    // feature detection. Using __setSqliteModuleForTests is the
    // supported test seam.
    __setSqliteModuleForTests({} as unknown as Parameters<typeof __setSqliteModuleForTests>[0] & object);
    let caught: unknown = null;
    try {
      await getDb();
    } catch (e) {
      caught = e;
    }
    expect(caught).not.toBeNull();
    expect(isPersistenceDisabled()).toBe(true);
    expect(getPersistenceDisabledReason()).toMatch(/openDatabaseAsync is not a function/);
  });
});

// ===========================================================================
// 3. Missing openDatabaseAsync disables persistence
// ===========================================================================

describe('missing openDatabaseAsync API', () => {
  test('module exists but openDatabaseAsync is not a function → disables persistence', async () => {
    __setSqliteModuleForTests({
      // openDatabaseAsync is missing — simulates an SDK with only
      // the legacy sync openDatabase API.
      openDatabase: () => ({}),
    } as unknown as Parameters<typeof __setSqliteModuleForTests>[0] & object);

    let caught: unknown = null;
    try {
      await getDb();
    } catch (e) {
      caught = e;
    }
    expect(caught).not.toBeNull();
    expect(isPersistenceDisabled()).toBe(true);
    expect(getPersistenceDisabledReason()).toMatch(/openDatabaseAsync is not a function/);
  });
});

// ===========================================================================
// 4. openDatabaseAsync rejection disables persistence
// ===========================================================================

describe('openDatabaseAsync rejection', () => {
  test('rejected open promise disables persistence cleanly', async () => {
    __setSqliteModuleForTests({
      openDatabaseAsync: () =>
        Promise.reject(new Error('native bridge missing')),
    });

    let caught: unknown = null;
    try {
      await getDb();
    } catch (e) {
      caught = e;
    }
    expect(caught).not.toBeNull();
    expect(isPersistenceDisabled()).toBe(true);
    expect(getPersistenceDisabledReason()).toMatch(/native bridge missing/);
  });

  test('openDatabaseAsync resolves to a non-object → disables persistence', async () => {
    // Cast through unknown — we are deliberately injecting a
    // malformed module so the feature-detection path is exercised.
    __setSqliteModuleForTests({
      openDatabaseAsync: () => Promise.resolve(null),
    } as unknown as Parameters<typeof __setSqliteModuleForTests>[0]);

    let caught: unknown = null;
    try {
      await getDb();
    } catch (e) {
      caught = e;
    }
    expect(caught).not.toBeNull();
    expect(isPersistenceDisabled()).toBe(true);
    expect(getPersistenceDisabledReason()).toMatch(
      /openDatabaseAsync did not return an object/,
    );
  });

  test('opened DB missing execAsync → disables persistence', async () => {
    __setSqliteModuleForTests({
      // Missing every async method — simulates a legacy DB handle.
      openDatabaseAsync: () => Promise.resolve({ transaction: () => undefined }),
    } as unknown as Parameters<typeof __setSqliteModuleForTests>[0]);

    let caught: unknown = null;
    try {
      await getDb();
    } catch (e) {
      caught = e;
    }
    expect(caught).not.toBeNull();
    expect(isPersistenceDisabled()).toBe(true);
    expect(getPersistenceDisabledReason()).toMatch(
      /SQLiteDatabase\.execAsync is not a function/,
    );
  });
});

// ===========================================================================
// 5. Once disabled, subsequent calls reject fast without hitting the bridge
// ===========================================================================

describe('disabled latch — short-circuit behaviour', () => {
  test('subsequent getDb() calls reject with the captured reason; no new bridge calls', async () => {
    const openSpy = jest.fn(() =>
      Promise.reject(new Error('boom')),
    );
    __setSqliteModuleForTests({ openDatabaseAsync: openSpy });

    try { await getDb(); } catch { /* expected */ }
    expect(openSpy).toHaveBeenCalledTimes(1);

    // Second call short-circuits — no second openDatabaseAsync invocation.
    try { await getDb(); } catch { /* expected */ }
    expect(openSpy).toHaveBeenCalledTimes(1);
  });

  test('initDatabase rejects fast when persistence is already disabled', async () => {
    disablePersistence('forced for test');
    let caught: unknown = null;
    try { await initDatabase(); } catch (e) { caught = e; }
    expect(caught).not.toBeNull();
    expect(String(caught)).toMatch(/persistence disabled/);
  });
});

// ===========================================================================
// 6. End-to-end: hydratePersistence resolves cleanly when SQLite is unavailable
// ===========================================================================

describe('hydratePersistence — SQLite unavailable end-to-end', () => {
  // We mock the persistence module (so the bridge does not see the
  // real require), then verify hydratePersistence resolves to
  // ok=false without throwing.
  jest.isolateModules(() => {
    jest.doMock('../persistence', () => ({
      saveSetMemory: jest.fn().mockResolvedValue(undefined),
      loadAllSetMemory: jest.fn().mockResolvedValue({}),
      savePlayerMomentum: jest.fn().mockResolvedValue(undefined),
      loadPlayerMomentum: jest.fn().mockResolvedValue(null),
      appendQuestHistory: jest.fn().mockResolvedValue(undefined),
      getMostRecentCompletedAtIso: jest.fn().mockResolvedValue(null),
      listRecentQuests: jest.fn().mockResolvedValue([]),
      recordIfPersonalRecord: jest.fn().mockResolvedValue([]),
      initDatabase: jest
        .fn()
        .mockRejectedValue(new Error('expo-sqlite require failed: not bundled')),
      isPersistenceDisabled: jest.fn(() => false),
      getPersistenceDisabledReason: jest.fn(() => null),
      disablePersistence: jest.fn(),
    }));

    test('hydratePersistence resolves cleanly even when initDatabase rejects', async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const bridge = require('../state/persistenceBridge') as typeof import('../state/persistenceBridge');
      let threw: unknown = null;
      let result;
      try {
        result = await bridge.hydratePersistence();
      } catch (e) {
        threw = e;
      }
      expect(threw).toBeNull();
      expect(result?.ok).toBe(false);
      expect(result?.error).toMatch(/expo-sqlite require failed/);
    });
  });
});
