import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/ScreenContainer';
import { BigButton } from '@/components/BigButton';
import { RecentActivity } from '@/components/RecentActivity';
import {
  listRecentActivity,
  type RecentActivityEntry,
} from '@/repositories/recentActivityRepository';
import { colors, spacing, typography } from '@/theme/colors';

export default function HomeScreen() {
  const router = useRouter();
  const [activity, setActivity] = useState<RecentActivityEntry[]>([]);

  // Refresh on every focus so an item just added/used shows up immediately.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const rows = await listRecentActivity(3);
          if (!cancelled) setActivity(rows);
        } catch (e) {
          console.warn('[dwhi] recent activity failed:', e);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Do We Have It?</Text>
            <Text style={styles.subtitle}>A calmer way to remember what's at home.</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Settings"
            onPress={() => router.push('/settings')}
            style={({ pressed }) => [styles.gear, pressed && styles.gearPressed]}
            hitSlop={12}
          >
            <Text style={styles.gearGlyph}>⚙</Text>
          </Pressable>
        </View>

        <View style={styles.primary}>
          <BigButton
            icon="🎤"
            label="Ask"
            large
            variant="primary"
            onPress={() => router.push('/ask')}
            style={styles.askButton}
          />

          <BigButton
            icon="🧾"
            label="Receipt"
            large
            variant="secondary"
            onPress={() => router.push('/capture-receipt')}
            style={styles.receiptButton}
          />
        </View>

        <View style={styles.bottomRow}>
          <BigButton
            icon="+"
            label="In"
            variant="positive"
            style={styles.bottomBtn}
            onPress={() =>
              router.push({ pathname: '/capture-item', params: { direction: 'IN' } })
            }
          />
          <BigButton
            icon="−"
            label="Out"
            variant="danger"
            style={styles.bottomBtn}
            onPress={() =>
              router.push({ pathname: '/capture-item', params: { direction: 'OUT' } })
            }
          />
        </View>

        <RecentActivity entries={activity} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerText: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    ...typography.title,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
  },
  gear: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gearPressed: {
    opacity: 0.7,
  },
  gearGlyph: {
    color: colors.textSecondary,
    fontSize: 20,
  },
  primary: {
    gap: spacing.md,
  },
  askButton: {
    minHeight: 180,
  },
  receiptButton: {
    minHeight: 140,
  },
  bottomRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  bottomBtn: {
    flex: 1,
    minHeight: 88,
  },
});
