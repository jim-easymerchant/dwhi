import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from './Card';
import { colors, spacing, typography } from '@/theme/colors';
import type { RecentActivityEntry } from '@/repositories/recentActivityRepository';

interface Props {
  entries: RecentActivityEntry[];
}

const DAY_MS = 86_400_000;

function relativeTime(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return '';
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) {
    const m = Math.round(diff / 60_000);
    return `${m}m ago`;
  }
  if (diff < DAY_MS) {
    const h = Math.round(diff / 3_600_000);
    return `${h}h ago`;
  }
  const d = Math.round(diff / DAY_MS);
  if (d === 1) return 'yesterday';
  if (d < 14) return `${d}d ago`;
  if (d < 60) return `${Math.round(d / 7)}w ago`;
  return `${Math.round(d / 30)}mo ago`;
}

function describe(entry: RecentActivityEntry): string {
  if (entry.kind === 'receipt') {
    const store = entry.storeName?.trim();
    const items = entry.itemCount === 1 ? 'item' : 'items';
    if (store) return `Receipt from ${store} · ${entry.itemCount} ${items}`;
    return `Receipt · ${entry.itemCount} ${items}`;
  }
  if (entry.direction === 'IN') {
    return `Added ${entry.itemName}`;
  }
  return `Used ${entry.itemName}`;
}

function dotColor(entry: RecentActivityEntry): string {
  if (entry.kind === 'receipt') return colors.accent;
  return entry.direction === 'IN' ? colors.positive : colors.warn;
}

export function RecentActivity({ entries }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Recent activity</Text>
      {entries.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyText}>No household memory yet.</Text>
        </Card>
      ) : (
        <Card>
          {entries.map((entry, idx) => (
            <View
              key={entry.id}
              style={[styles.row, idx > 0 && styles.rowDivider]}
            >
              <View style={[styles.dot, { backgroundColor: dotColor(entry) }]} />
              <Text style={styles.rowText} numberOfLines={1}>
                {describe(entry)}
              </Text>
              <Text style={styles.time}>{relativeTime(entry.createdAt)}</Text>
            </View>
          ))}
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
  },
  heading: {
    ...typography.label,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: spacing.xs,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  rowText: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
  },
  time: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
