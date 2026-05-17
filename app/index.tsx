import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/ScreenContainer';
import { BigButton } from '@/components/BigButton';
import { LocationOptInModal } from '@/components/LocationOptInModal';
import { RecentActivity } from '@/components/RecentActivity';
import {
  listRecentActivity,
  type RecentActivityEntry,
} from '@/repositories/recentActivityRepository';
import {
  acceptLocationPromptAndStart,
  declineLocationPrompt,
  hasSeenLocationPrompt,
} from '@/services/location/locationService';
import { colors, spacing, typography } from '@/theme/colors';

export default function HomeScreen() {
  const router = useRouter();
  const [activity, setActivity] = useState<RecentActivityEntry[]>([]);
  const [locationPromptVisible, setLocationPromptVisible] = useState(false);
  const [locationPromptBusy, setLocationPromptBusy] = useState(false);

  // One-shot opt-in: show on first launch only. Either button marks the
  // prompt seen so we never auto-show it again — the user can flip the
  // toggle from Settings if they change their mind.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const seen = await hasSeenLocationPrompt();
        if (!cancelled && !seen) setLocationPromptVisible(true);
      } catch (e) {
        console.warn('[dwhi] location prompt check failed:', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onAcceptLocation = useCallback(async () => {
    setLocationPromptBusy(true);
    try {
      await acceptLocationPromptAndStart();
    } catch (e) {
      console.warn('[dwhi] location accept failed:', e);
    } finally {
      setLocationPromptBusy(false);
      setLocationPromptVisible(false);
    }
  }, []);

  const onDeclineLocation = useCallback(async () => {
    try {
      await declineLocationPrompt();
    } catch (e) {
      console.warn('[dwhi] location decline failed:', e);
    } finally {
      setLocationPromptVisible(false);
    }
  }, []);

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
      <LocationOptInModal
        visible={locationPromptVisible}
        busy={locationPromptBusy}
        onAccept={onAcceptLocation}
        onDecline={onDeclineLocation}
      />
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
