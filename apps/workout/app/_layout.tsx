/**
 * Root layout for the Workout RPG / Momentum app.
 *
 * Hydrates local persistence (set memory + momentum + last-session
 * timestamp) on first mount, and wires the persistence bridge so
 * the store's fire-and-forget hooks save to SQLite.
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
setPersistenceHandlers({
  onSetLogged: (input) => {
    void persistLoggedSet({
      exerciseId: input.exerciseId,
      modality: input.modality,
      variantId: input.variantId,
      setIndex: input.setIndex,
      reps: input.reps,
      weightKg: input.weightKg,
    });
  },
  onQuestCompleted: (input) => {
    void persistQuestCompletion({
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
    });
  },
});

export default function RootLayout(): JSX.Element {
  React.useEffect(() => {
    void hydratePersistence();
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
