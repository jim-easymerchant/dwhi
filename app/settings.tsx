import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Card } from '@/components/Card';
import { BigButton } from '@/components/BigButton';
import { readDiagnostics, getKeyHint, type Diagnostics } from '@/services/diagnostics';
import { syncNow } from '@/services/sync/syncNow';
import type { SyncResult } from '@/services/sync/syncTypes';
import { colors, spacing, typography } from '@/theme/colors';

const SYNC_MODE_LABEL: Record<Diagnostics['cloudSync']['mode'], string> = {
  'local-only': 'Local only',
  'configured-signed-out': 'Configured · Signed out',
  'configured-signed-in': 'Sync ready',
};

export default function SettingsScreen() {
  const router = useRouter();
  const [diag, setDiag] = useState<Diagnostics | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<SyncResult | null>(null);

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

  const handleSyncNow = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const result = await syncNow();
      setLastSync(result);
    } finally {
      setSyncing(false);
      void load(); // refresh pending counts
    }
  }, [load, syncing]);

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
              <Text style={styles.cardHeading}>Build</Text>
              <Row label="App version" value={diag.build.appVersion} mono />
              <Row label="Build commit" value={diag.build.buildCommit} mono tone={diag.build.buildCommit === 'local' ? 'muted' : 'good'} />
              <Row label="Build run" value={diag.build.buildRun} mono />
              <Row label="Build time" value={diag.build.buildTime} />
            </Card>

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
              <Text style={styles.cardHeading}>Learned behavior</Text>
              <Row label="Ask history" value={String(diag.askHistoryCount)} />
              <Row label="Feedback recorded" value={String(diag.feedbackCount)} tone={diag.feedbackCount > 0 ? 'good' : 'muted'} />
              <Row label="Items with patterns" value={String(diag.learnedPatternsCount)} tone={diag.learnedPatternsCount > 0 ? 'good' : 'muted'} />
            </Card>

            <Card>
              <Text style={styles.cardHeading}>Voice command</Text>
              <Row
                label="Mode"
                value={diag.voice.kind === 'native' ? 'Native' : 'Manual fallback'}
                tone={diag.voice.kind === 'native' ? 'good' : 'muted'}
                mono
              />
              <Row
                label="Recognition available"
                value={diag.voice.available ? 'Yes' : 'No'}
                tone={diag.voice.available ? 'good' : 'muted'}
              />
              <Text style={styles.privacyBody}>{diag.voice.mode}</Text>
            </Card>

            {diag.household ? (
              <Card>
                <Text style={styles.cardHeading}>Household</Text>
                <Row label="Name" value={diag.household.name} />
                <Row
                  label="Member"
                  value={`${diag.household.memberDisplayName} (${diag.household.memberRole})`}
                />
                <Row label="Device" value={diag.household.deviceName} />
                <Row label="Device UUID" value={diag.household.deviceUuidShort} mono />
                <Row
                  label="Sync status"
                  value={diag.household.syncStatus}
                  tone="muted"
                />
              </Card>
            ) : null}

            <Card>
              <Text style={styles.cardHeading}>Cloud sync</Text>
              <Row
                label="Mode"
                value={SYNC_MODE_LABEL[diag.cloudSync.mode]}
                tone={
                  diag.cloudSync.mode === 'configured-signed-in'
                    ? 'good'
                    : diag.cloudSync.mode === 'configured-signed-out'
                      ? 'warn'
                      : 'muted'
                }
              />
              <Row
                label="Pending changes"
                value={String(diag.cloudSync.pendingChangesTotal)}
                tone={diag.cloudSync.pendingChangesTotal > 0 ? 'warn' : 'muted'}
              />
              {lastSync ? (
                <Row
                  label="Last sync"
                  value={`${lastSync.message} (${new Date(lastSync.finishedAt).toLocaleTimeString()})`}
                  tone={lastSync.ok ? 'good' : 'warn'}
                />
              ) : (
                <Row label="Last sync" value="—" tone="muted" />
              )}
              <Text style={styles.privacyBody}>{diag.cloudSync.description}</Text>

              {diag.cloudSync.mode === 'configured-signed-out' ? (
                <BigButton
                  label="Sign in"
                  variant="primary"
                  onPress={() => router.push('/auth')}
                />
              ) : null}
              {diag.cloudSync.mode === 'configured-signed-in' ? (
                <BigButton
                  label="Manage household"
                  variant="secondary"
                  onPress={() => router.push('/household')}
                />
              ) : null}

              <BigButton
                label={syncing ? 'Syncing…' : 'Sync now'}
                variant="secondary"
                disabled={
                  syncing ||
                  diag.cloudSync.mode !== 'configured-signed-in'
                }
                onPress={() => void handleSyncNow()}
              />
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
