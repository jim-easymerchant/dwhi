import 'react-native-gesture-handler';
// Required by @supabase/supabase-js on React Native — gives us a working
// global URL implementation before any HTTP call. Side-effect import only.
import 'react-native-url-polyfill/auto';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initDatabase } from '@/db/database';
import { seedIfEmpty } from '@/seed/seedData';
import { bootstrapHousehold } from '@/services/householdBootstrap';

// Side-effect: registers the background location TaskManager handler at
// module load. Must happen before any startLocationUpdatesAsync call,
// which is why the import lives in the root layout file.
import '@/services/location/backgroundLocationTask';
import { resumeBackgroundLocationTrackingIfEnabled } from '@/services/location/locationService';

import { ensureRemoteHousehold } from '@/services/household/remoteHouseholdBootstrap';
import { colors } from '@/theme/colors';

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const bootstrap = useCallback(async () => {
    try {
      await initDatabase();
      // Ensure local household/member/device exist + publish them to the
      // active scope so every repo write/read knows where it belongs.
      // Backfills any pre-existing rows from earlier installs.
      await bootstrapHousehold();
      await seedIfEmpty();

      // Best-effort: if the user previously opted in to background
      // location, resume the native task. Permission revocation is
      // handled inside; never throws to the bootstrap.
      try {
        await resumeBackgroundLocationTrackingIfEnabled();
      } catch (e) {
        console.warn('[dwhi] location resume failed:', e);

      // If a Supabase session survived a cold start, converge the
      // local household state with the server. expectAuthenticated:
      // false means "local-only mode is fine if there's no session" —
      // never blocks startup. A real failure (network, RLS surprise)
      // is logged but not surfaced as a startup error.
      const remote = await ensureRemoteHousehold();
      if (!remote.ok) {
        console.warn(
          `[dwhi.household] cold-start remote bootstrap deferred: ${remote.message}`,
        );
      }
      setReady(true);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.warn('[dwhi] bootstrap failed:', message);
      setError(message);
    }
  }, []);

  useEffect(() => {
    setError(null);
    setReady(false);
    void bootstrap();
  }, [attempt, bootstrap]);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Could not get started</Text>
        <Text style={styles.errorBody}>{error}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => setAttempt(a => a + 1)}
          style={({ pressed }) => [styles.retry, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.retryLabel}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.textPrimary,
            headerTitleStyle: { color: colors.textPrimary },
            contentStyle: { backgroundColor: colors.background },
            headerShadowVisible: false,
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen
            name="ask"
            options={{ presentation: 'modal', title: 'Ask' }}
          />
          <Stack.Screen name="capture-receipt" options={{ title: 'Receipt' }} />
          <Stack.Screen name="confirm-receipt" options={{ title: 'Confirm Receipt' }} />
          <Stack.Screen name="capture-item" options={{ title: 'Add or Remove' }} />
          <Stack.Screen name="capture-item-barcode" options={{ title: 'Scan barcode' }} />
          <Stack.Screen name="capture-item-photo" options={{ title: 'Photo' }} />
          <Stack.Screen name="confirm-item" options={{ title: 'Confirm Item' }} />
          <Stack.Screen name="settings" options={{ title: 'Settings' }} />
          <Stack.Screen
            name="auth"
            options={{ presentation: 'modal', title: 'Sign in' }}
          />
          <Stack.Screen name="household" options={{ title: 'Household' }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: 24,
  },
  errorTitle: {
    color: colors.danger,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  errorBody: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  retry: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryLabel: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
});
