/**
 * Root layout for the Workout RPG / Momentum app.
 *
 * STARTUP-CRASH HARDENING (revision 2)
 * =====================================
 *
 * Previous revision still crashed on some devices because the
 * top-level `import { … } from '../src/state/persistenceBridge'`
 * pulled `expo-sqlite` into the module graph at *module-evaluation
 * time*, BEFORE React even mounted. If the native module failed
 * to load (Expo Go quirks, stale build, missing native bridge),
 * the layout module never finished evaluating and the entire app
 * red-screened.
 *
 * This file therefore:
 *
 *   1. Has ZERO top-level imports of `persistenceBridge`,
 *      `'../src/persistence'`, `expo-sqlite`, or anything that
 *      transitively pulls them in.
 *   2. Imports `workoutGameStore` at the top — that store does NOT
 *      touch expo-sqlite, so its evaluation is safe.
 *   3. Defers ALL persistence work to a `useEffect` callback that
 *      uses dynamic `await import(...)` for the bridge — so if the
 *      bridge's module graph fails (expo-sqlite missing, schema
 *      module throwing, etc.), the layout still renders and the
 *      store flips into memory-only mode.
 *   4. Exposes a manual emergency bypass: `DISABLE_PERSISTENCE_BOOT`.
 *      When `true`, persistence is never even attempted — the app
 *      runs in pure-memory mode. Use this to confirm a persistence-
 *      side root cause; leave it `false` for production.
 *
 * The Stack always renders — every error path here is a swallow +
 * console.warn + (optional) store flag set. No throw escapes the
 * boundary.
 */

import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Importing the store is safe — it does not transitively pull
// expo-sqlite or anything else native. The store is the same
// module the screens import, so this is no extra cost.
import {
  setPersistenceHandlers,
  useWorkoutGameStore,
} from '../src/state/workoutGameStore';

// ---------------------------------------------------------------------------
// Emergency bypass.
//
// When `true`, persistence is NEVER imported. The bridge module
// stays unloaded, expo-sqlite is never touched. The app runs in
// pure-memory mode. The HomeScreen dev diagnostic still surfaces
// the reason.
//
// FLIP THIS TO TRUE if you are debugging a startup crash on a
// real device and want to confirm the persistence import is the
// culprit. Leave FALSE for production.
// ---------------------------------------------------------------------------

const DISABLE_PERSISTENCE_BOOT = false;

// ---------------------------------------------------------------------------
// bootPersistence — fully async, fully defensive.
//
// Returns a Promise that always resolves (never rejects).
// ---------------------------------------------------------------------------

function setMemoryOnlyFlag(reason: string): void {
  try {
    useWorkoutGameStore.setState({
      persistenceReady: true,
      persistenceDisabled: true,
      persistenceError: reason,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[workout._layout] memory-only flag set failed:', e);
  }
}

async function bootPersistence(): Promise<void> {
  if (DISABLE_PERSISTENCE_BOOT) {
    // eslint-disable-next-line no-console
    console.warn(
      '[workout._layout] persistence boot bypassed (DISABLE_PERSISTENCE_BOOT=true)',
    );
    setMemoryOnlyFlag('Persistence boot bypassed (DISABLE_PERSISTENCE_BOOT=true).');
    return;
  }

  // ---- 1. Lazy-load the bridge --------------------------------------------
  //
  // require() (rather than `await import(...)`) is deliberate:
  //
  //   - Metro / RN's bundler statically discovers BOTH require() and
  //     dynamic import() calls when building the JS bundle, so this
  //     module ships in the same bundle either way.
  //   - The MODULE IS NOT EVALUATED until this line runs. Since this
  //     function only runs from inside a useEffect (post-mount), the
  //     expo-sqlite native bridge is touched AFTER React has already
  //     rendered the Stack. A failure here cannot crash startup.
  //   - require() avoids a TypeScript `--module` flag dependency that
  //     `await import(...)` introduces.
  //
  // The try/catch is the load-time safety net.
  let bridge: typeof import('../src/state/persistenceBridge');
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
    bridge = require('../src/state/persistenceBridge') as typeof import('../src/state/persistenceBridge');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // eslint-disable-next-line no-console
    console.warn(
      '[workout._layout] lazy load of persistenceBridge failed — falling back to memory-only:',
      msg,
    );
    setMemoryOnlyFlag(`Persistence import failed: ${msg}`);
    return;
  }

  // ---- 2. Register the store's persistence handlers -----------------------
  try {
    setPersistenceHandlers({
      onSetLogged: (input) => {
        // Fire-and-forget. The bridge function has an internal
        // try/catch; .catch is belt-and-braces.
        bridge
          .persistLoggedSet({
            exerciseId: input.exerciseId,
            modality: input.modality,
            variantId: input.variantId,
            setIndex: input.setIndex,
            reps: input.reps,
            weightKg: input.weightKg,
          })
          .catch((e) => {
            // eslint-disable-next-line no-console
            console.warn('[workout._layout] persistLoggedSet rejected:', e);
          });
      },
      onQuestCompleted: (input) => {
        bridge
          .persistQuestCompletion({
            questId: input.questId,
            templateId: input.templateId,
            kind: input.kind,
            workingSetCount: input.workingSetCount,
            totalDamage: input.totalDamage,
            xp: input.xp,
            momentumDelta: input.momentumDelta,
            defeatedEnemies: input.defeatedEnemies,
            primaryVerdict: input.primaryVerdict,
            finalMomentum: input.finalMomentum,
            payload: input.payload,
          })
          .catch((e) => {
            // eslint-disable-next-line no-console
            console.warn('[workout._layout] persistQuestCompletion rejected:', e);
          });
      },
      onThemeChanged: (themeId) => {
        bridge.persistThemeSelection(themeId).catch((e) => {
          // eslint-disable-next-line no-console
          console.warn('[workout._layout] persistThemeSelection rejected:', e);
        });
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // eslint-disable-next-line no-console
    console.warn(
      '[workout._layout] setPersistenceHandlers failed — memory-only mode:',
      msg,
    );
    setMemoryOnlyFlag(`Handler registration failed: ${msg}`);
    return;
  }

  // ---- 3. Hydrate ---------------------------------------------------------
  try {
    await bridge.hydratePersistence();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // eslint-disable-next-line no-console
    console.warn(
      '[workout._layout] hydratePersistence threw (should never happen):',
      msg,
    );
    setMemoryOnlyFlag(`Hydration threw: ${msg}`);
  }
}

// ---------------------------------------------------------------------------
// RootLayout
// ---------------------------------------------------------------------------

export default function RootLayout(): JSX.Element {
  React.useEffect(() => {
    // bootPersistence resolves a Promise (never throws). .catch is
    // an extra safety net for the impossible case.
    bootPersistence().catch((e) => {
      // eslint-disable-next-line no-console
      console.warn('[workout._layout] bootPersistence rejected (impossible):', e);
    });
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#0B0B0F' },
        }}
      />
    </SafeAreaProvider>
  );
}
