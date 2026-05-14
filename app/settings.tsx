import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Card } from '@/components/Card';
import { BigButton } from '@/components/BigButton';
import { readDiagnostics, getKeyHint, type Diagnostics } from '@/services/diagnostics';
import { colors, spacing, typography } from '@/theme/colors';

export default function SettingsScreen() {
  const router = useRouter();
  const [diag, setDiag] = useState<Diagnostics | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      setDiag(await readDiagnostics());
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl tintColor={colors.accent} refreshing={refreshing} onRefresh={load} />
        }
      >
        <Text style={styles.heading}>Settings</Text>

        {diag ? (
          <>
            <Card>
              <Row label="OpenAI receipt parsing" value={diag.aiEnabled ? 'Enabled' : 'Disabled'} tone={diag.aiEnabled ? 'good' : 'muted'} />
              <Row label="OpenAI model" value={diag.aiModel} />
              <Row label="Key length" value={String(diag.aiKeyLength)} tone={diag.aiKeyLength > 0 ? 'good' : 'muted'} />
              {diag.aiEnabled ? (
                <Row label="Key" value={getKeyHint() ?? '—'} mono />
              ) : null}
            </Card>

            <Card>
              <Text style={styles.cardHeading}>Barcode lookup</Text>
              <Row label="Open Food Facts" value="Enabled" tone="good" />
              <Row label="API key" value="not required" tone="muted" />
              <Text style={styles.privacyBody}>
                Community-provided product data. May be incomplete or wrong; the
                confirm screen always lets you fix it before saving.
              </Text>
            </Card>

            <Card>
              <Text style={styles.cardHeading}>Config source</Text>
              <Row label="Resolved from" value={diag.configSource} tone={diag.configSource === 'none' ? 'warn' : 'good'} mono />
              <Row label="expoConfig.extra" value={diag.probeSnapshot.expoConfig ? 'present' : 'empty'} tone={diag.probeSnapshot.expoConfig ? 'good' : 'muted'} mono />
              <Row label="manifest2.extra.expoClient.extra" value={diag.probeSnapshot.manifest2 ? 'present' : 'empty'} tone={diag.probeSnapshot.manifest2 ? 'good' : 'muted'} mono />
              <Row label="manifest.extra" value={diag.probeSnapshot.manifest ? 'present' : 'empty'} tone={diag.probeSnapshot.manifest ? 'good' : 'muted'} mono />
              <Row label="process.env.EXPO_PUBLIC_*" value={diag.probeSnapshot['process.env'] ? 'present' : 'empty'} tone={diag.probeSnapshot['process.env'] ? 'good' : 'muted'} mono />
            </Card>

            <Card>
              <Row label="Database initialized" value={diag.dbReady ? 'Yes' : 'No'} tone={diag.dbReady ? 'good' : 'warn'} />
              <Row label="Seed data present" value={diag.seedPresent ? 'Yes' : 'No'} tone={diag.seedPresent ? 'good' : 'muted'} />
              <Row label="Items" value={String(diag.itemCount)} />
              <Row label="Receipts" value={String(diag.receiptCount)} />
              <Row label="Memory events" value={String(diag.eventCount)} />
            </Card>

            <Card>
              <Row label="App mode" value={diag.appMode} />
            </Card>

            <Card style={styles.privacyCard}>
              <Text style={styles.privacyTitle}>Privacy</Text>
              <Text style={styles.privacyBody}>
                This POC stores data locally on this device. If OpenAI parsing is enabled,
                receipt images are sent to OpenAI for parsing. No backend, no account, no sync.
              </Text>
            </Card>
          </>
        ) : (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.accent} />
          </View>
        )}

        <BigButton label="Back to home" variant="ghost" onPress={() => router.replace('/')} />
      </ScrollView>
    </ScreenContainer>
  );
}

interface RowProps {
  label: string;
  value: string;
  tone?: 'good' | 'warn' | 'muted' | 'default';
  mono?: boolean;
}

function Row({ label, value, tone = 'default', mono }: RowProps) {
  const valueColor =
    tone === 'good'
      ? colors.positive
      : tone === 'warn'
        ? colors.warn
        : tone === 'muted'
          ? colors.textMuted
          : colors.textPrimary;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, { color: valueColor }, mono && styles.mono]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  heading: {
    ...typography.heading,
    color: colors.textPrimary,
  },
  cardHeading: {
    ...typography.label,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  loading: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  rowLabel: {
    ...typography.label,
    color: colors.textSecondary,
  },
  rowValue: {
    ...typography.body,
    fontWeight: '600',
  },
  mono: {
    fontFamily: 'Courier',
  },
  privacyCard: {
    backgroundColor: colors.surfaceElevated,
  },
  privacyTitle: {
    ...typography.label,
    color: colors.warn,
    fontWeight: '600',
  },
  privacyBody: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
});
