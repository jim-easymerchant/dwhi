/**
 * Recent-activity feed shown on the DWHI home screen — merges the last
 * inventory events and receipts into a single chronological list.
 */
export {
  listRecentActivity,
  type EventActivityEntry,
  type RecentActivityEntry,
  type RecentActivityKind,
  type ReceiptActivityEntry,
} from '@/repositories/recentActivityRepository';
