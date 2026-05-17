/**
 * Inventory events: IN / OUT directional log against `items`, with an
 * estimated balance derived from the event tail.
 */
export {
  getEstimatedBalance,
  listEventsForItem,
  listRecentEvents,
  recordEvent,
  type EstimatedBalance,
} from '@/repositories/inventoryEventRepository';
