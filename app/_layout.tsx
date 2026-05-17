import 'react-native-gesture-handler';
import 'react-native-url-polyfill/auto';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, type AppStateStatus, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { initDatabase } from '@/db/database';
import { seedIfEmpty } from '@/seed/seedData';
import { bootstrapHousehold } from '@/services/householdBootstrap';
import '@/services/location/backgroundLocationTask';
import { resumeBackgroundLocationTrackingIfEnabled } from '@/services/location/locationService';
import { ensureRemoteHousehold } from '@/services/household/remoteHouseholdBootstrap';
import { requestAutoSync } from '@/services/sync/autoSync';
import { colors } from '@/theme/colors';

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const bootstrap = useCallback(async () => {
    try {
      await initDatabase();
      await bootstrapHousehold();
      await seedIfEmpty();

      try {
        await resumeBackgroundLocationTrackingIfEnabled();
      } catch (e) {
        console.warn('[dwhi] location resume failed:', e);
      }

      const remote = await ensureRemoteHousehold();
      if (!remote.ok) {
        console.warn(
          `[dwhi.household] cold-start remote bootstrap deferred: ${remote.message}`,
        );
      } else if (remote.context?.household.remoteId) {
        // We're signed in AND linked. Kick off a sync so the app
        // catches up on remote changes that arrived since the last
        // run. Debounced inside autoSync.
        requestAutoSync('cold-start');
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

  // Foreground listener: when the app returns from background, give
  // sync a nudge so the user sees fresh data on whichever screen they
  // land on. Debounced inside autoSync so a quick app-switch doesn't
  // queue redundant runs.
  useEffect(() => {
    if (!ready) return;
    const handler = (status: AppStateStatus) => {
      if (status === 'active') {
        requestAutoSync('foreground');
      }
    };
    const sub = AppState.addEventListener('change', handler);
    return () => sub.remove();
  }, [ready]);

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
          <Stack.Screen name="ask" options={{ presentation: 'modal', title: 'Ask' }} />
          <Stack.Screen name="capture-receipt" options={{ title: 'Receipt' }} />
          <Stack.Screen name="confirm-receipt" options={{ title: 'Confirm Receipt' }} />
          <Stack.Screen name="capture-item" options={{ title: 'Add or Remove' }} />
          <Stack.Screen name="capture-item-barcode" options={{ title: 'Scan barcode' }} />
          <Stack.Screen name="capture-item-photo" options={{ title: 'Photo' }} />
          <Stack.Screen name="confirm-item" options={{ title: 'Confirm Item' }} />
          <Stack.Screen name="settings" options={{ title: 'Settings' }} />
          <Stack.Screen name="auth" options={{ presentation: 'modal', title: 'Sign in' }} />
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
