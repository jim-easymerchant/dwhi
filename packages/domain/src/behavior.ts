/**
 * Per-item / per-category behaviour stats derived from inventory
 * events. Feeds the confidence engine's behaviour signal generator.
 */
export {
  countLearnedPatterns,
  getCategoryBehaviorStats,
  getItemBehaviorStats,
  type CategoryBehaviorStats,
  type ItemBehaviorStats,
} from '@/services/behaviorStats';
