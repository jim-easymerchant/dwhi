import {
  getEstimatedBalance,
  listEventsForItem,
} from '@/repositories/inventoryEventRepository';
import type { ConfidenceSignal, SignalContext } from '../confidenceTypes';

/**
 * Reasons about IN vs OUT history: who scanned what, when, and in which order.
 *
 * Emits up to four signals:
 *   - event.last-in   when the most recent event for this item is IN
 *   - event.last-out  when the most recent event is OUT
 *   - event.net       net inventory delta (positive / negative / zero)
 *   - event.alignment "OUT after most-recent IN/receipt" (negative) or
 *                     "no OUT since most-recent IN/receipt" (positive)
 */

const DAY_MS = 24 * 60 * 60 * 1000;

type Bucket = { withinDays: number; weight: number };

const LAST_IN_BUCKETS: Bucket[] = [
  { withinDays: 1, weight: 25 },
  { withinDays: 7, weight: 18 },
  { withinDays: 14, weight: 8 },
  { withinDays: Number.POSITIVE_INFINITY, weight: 3 },
];

const LAST_OUT_BUCKETS: Bucket[] = [
  { withinDays: 1, weight: -35 },
  { withinDays: 7, weight: -22 },
  { withinDays: 14, weight: -12 },
  { withinDays: Number.POSITIVE_INFINITY, weight: -5 },
];

function approxPhrase(days: number): string {
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  if (days < 60) {
    const w = Math.round(days / 7);
    return w === 1 ? 'a week ago' : `${w} weeks ago`;
  }
  const m = Math.round(days / 30);
  return m === 1 ? 'a month ago' : `${m} months ago`;
}

function pickBucket(buckets: Bucket[], days: number): Bucket {
  return buckets.find(b => days <= b.withinDays) ?? buckets[buckets.length - 1];
}

function daysSince(now: number, iso: string): number {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.floor((now - t) / DAY_MS));
}

export async function inventoryEventSignals(
  ctx: SignalContext,
): Promise<ConfidenceSignal[]> {
  const item = ctx.matchedItem;
  if (!item) return [];

  const balance = await getEstimatedBalance(item.id);
  const recent = await listEventsForItem(item.id, 25);
  const out: ConfidenceSignal[] = [];

  const subject = item.name;

  // Latest event (IN vs OUT) — strongest day-to-day signal.
  if (recent.length > 0) {
    const latest = recent[0];
    const days = daysSince(ctx.now, latest.createdAt);
    if (latest.direction === 'IN') {
      const b = pickBucket(LAST_IN_BUCKETS, days);
      out.push({
        type: 'event.last-in',
        weight: b.weight,
        polarity: 'positive',
        explanation: `Your last ${subject} entry was scanned in ${approxPhrase(days)}.`,
        createdAt: latest.createdAt,
        metadata: { days, quantity: latest.quantity },
      });
    } else {
      const b = pickBucket(LAST_OUT_BUCKETS, days);
      out.push({
        type: 'event.last-out',
        weight: b.weight,
        polarity: 'negative',
        explanation: `The last ${subject} was scanned out ${approxPhrase(days)}.`,
        createdAt: latest.createdAt,
        metadata: { days, quantity: latest.quantity },
      });
    }
  }

  // Net balance — small additional nudge.
  if (balance.totalIn > 0 || balance.totalOut > 0) {
    if (balance.net > 0) {
      out.push({
        type: 'event.net-positive',
        weight: 5,
        polarity: 'positive',
        explanation: `Net IN/OUT for ${subject} sits at +${balance.net}.`,
        metadata: { ...balance },
      });
    } else if (balance.net < 0) {
      out.push({
        type: 'event.net-negative',
        weight: -5,
        polarity: 'negative',
        explanation: `More ${subject} has gone out than in.`,
        metadata: { ...balance },
      });
    }
  }

  // Alignment with the most-recent IN/receipt: did an OUT happen after?
  const newestIn = mostRecent(
    [
      balance.lastInAt,
      ctx.matchedReceipt?.purchasedAt ?? ctx.matchedReceipt?.createdAt ?? null,
    ].filter((v): v is string => typeof v === 'string'),
  );
  if (newestIn) {
    const inMs = Date.parse(newestIn);
    if (!Number.isNaN(inMs)) {
      if (balance.lastOutAt) {
        const outMs = Date.parse(balance.lastOutAt);
        if (!Number.isNaN(outMs) && outMs > inMs) {
          out.push({
            type: 'event.out-after-restock',
            weight: -18,
            polarity: 'negative',
            explanation: `It was used after the last time you brought it in.`,
            createdAt: balance.lastOutAt,
          });
        } else {
          out.push({
            type: 'event.no-out-since-restock',
            weight: 15,
            polarity: 'positive',
            explanation: `There's no scan-out since then.`,
          });
        }
      } else {
        out.push({
          type: 'event.no-out-since-restock',
          weight: 15,
          polarity: 'positive',
          explanation: `There's no scan-out since then.`,
        });
      }
    }
  }

  return out;
}

function mostRecent(isoTimestamps: string[]): string | null {
  let best: { iso: string; t: number } | null = null;
  for (const iso of isoTimestamps) {
    const t = Date.parse(iso);
    if (Number.isNaN(t)) continue;
    if (!best || t > best.t) best = { iso, t };
  }
  return best?.iso ?? null;
}
