/**
 * Root layout for the Workout RPG / Momentum app.
 *
 * Hydrates local persistence (set memory + momentum + last-session
 * timestamp) on first mount, and wires the persistence bridge so
 * the store's fire-and-forget hooks save to SQLite.
 *
 * Crash-proofing — startup MUST always reach the Stack render even
 * when the persistence layer is missing, broken, or stuck:
 *
 *   - The top-level `setPersistenceHandlers({...})` call is wrapped
 *     in try/catch (defensive — the call should never throw, but a
 *     bundle-time wiring change shouldn't kill startup).
 *   - The on-mount `hydratePersistence()` is fully promise-safe
 *     (never throws; the bridge's try/catch chain swallows native
 *     failures and latches the store into memory-only mode).
 *   - The `useEffect` body itself is wrapped in try/catch so a
 *     synchronous misstep cannot bubble to the React error boundary.
 *
 * Uses expo-router with a single Stack screen — the home file
 * dispatches based on the game store's `phase`.
 */

import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import {
  hydratePersistence,
  persistLoggedSet,
  persistQuestCompletion,
} from '../src/state/persistenceBridge';
import { setPersistenceHandlers } from '../src/state/workoutGameStore';

// Wire persistence handlers at module load so the very first action
// the user takes after launch already saves. Hydration starts a
// microtask later — store hooks are no-ops until then, which is
// fine: no real reads happen before the user lands on Home.
//
// Defensive try/catch — setPersistenceHandlers is pure, and the
// arrow bodies are not invoked at registration time, but a future
// refactor that adds a side-effect here shouldn't be able to crash
// startup.
try {
  setPersistenceHandlers({
    onSetLogged: (input) => {
      // Fire-and-forget. persistLoggedSet has an internal try/catch
      // and ALWAYS resolves; .catch is belt-and-braces against a
      // future refactor.
      persistLoggedSet({
        exerciseId: input.exerciseId,
        modality: input.modality,
        variantId: input.variantId,
        setIndex: input.setIndex,
        reps: input.reps,
        weightKg: input.weightKg,
      }).catch((e) => {
        // eslint-disable-next-line no-console
        console.warn('[workout._layout] persistLoggedSet rejected:', e);
      });
    },
    onQuestCompleted: (input) => {
      persistQuestCompletion({
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
      }).catch((e) => {
        // eslint-disable-next-line no-console
        console.warn('[workout._layout] persistQuestCompletion rejected:', e);
      });
    },
  });
} catch (e) {
  // eslint-disable-next-line no-console
  console.warn('[workout._layout] setPersistenceHandlers threw:', e);
}

export default function RootLayout(): JSX.Element {
  React.useEffect(() => {
    try {
      // hydratePersistence is documented as never-throwing. The
      // .catch here is the second safety net — if a future change
      // ever makes it reject, the catch keeps the useEffect clean
      // and React's error boundary stays out of it.
      hydratePersistence().catch((e) => {
        // eslint-disable-next-line no-console
        console.warn('[workout._layout] hydratePersistence rejected:', e);
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[workout._layout] hydratePersistence threw sync:', e);
    }
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
