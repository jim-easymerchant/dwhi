/**
 * Root layout for the Workout RPG / Momentum app.
 *
 * Uses expo-router with a single Stack screen — the home file
 * dispatches based on the game store's `phase`. This keeps the
 * router footprint minimal for the MVP shell; deep-linking and
 * named routes arrive in a later branch.
 */

import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout(): JSX.Element {
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
