import type { ConfidenceSignal, SignalContext } from '../confidenceTypes';

/**
 * Receipt evidence: did the user buy this thing recently?
 *
 * Recency is bucketed rather than continuous so the explanations stay
 * legible — "you bought X yesterday" is a real human sentence; a fractional
 * day count is not.
 *
 * Receipts only contribute *evidence of purchase*. They never directly say
 * "we have it" — inventory events and decay are responsible for the rest of
 * the story.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

type Bucket = {
  withinDays: number;
  weight: number;
  phrase: (days: number) => string;
};

const RECEIPT_BUCKETS: Bucket[] = [
  { withinDays: 1, weight: 45, phrase: () => 'today' },
  { withinDays: 3, weight: 38, phrase: days => `${days} days ago` },
  { withinDays: 7, weight: 35, phrase: days => `${days} days ago` },
  { withinDays: 14, weight: 22, phrase: days => approxWeeks(days) },
  { withinDays: 30, weight: 22, phrase: days => approxWeeks(days) },
  { withinDays: 90, weight: 6, phrase: days => approxMonths(days) },
  { withinDays: Number.POSITIVE_INFINITY, weight: 2, phrase: days => approxMonths(days) },
];

function approxWeeks(days: number): string {
  const w = Math.max(1, Math.round(days / 7));
  return w === 1 ? 'a week ago' : `${w} weeks ago`;
}

function approxMonths(days: number): string {
  const m = Math.max(1, Math.round(days / 30));
  return m === 1 ? 'a month ago' : `${m} months ago`;
}

function daysBetween(now: number, iso: string): number {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.floor((now - t) / DAY_MS));
}

export async function receiptSignals(
  ctx: SignalContext,
): Promise<ConfidenceSignal[]> {
  const receipt = ctx.matchedReceipt;
  if (!receipt) return [];

  const evidenceIso = receipt.purchasedAt ?? receipt.createdAt;
  const days = daysBetween(ctx.now, evidenceIso);
  const bucket = RECEIPT_BUCKETS.find(b => days <= b.withinDays) ?? RECEIPT_BUCKETS[RECEIPT_BUCKETS.length - 1];

  const subject = receipt.matchedName || ctx.matchedItem?.name || ctx.query;
  const store = receipt.storeName ? ` at ${receipt.storeName}` : '';
  const phrase = bucket.phrase(days);
  const tense = days <= 1 ? 'You bought' : 'You bought';

  return [
    {
      type: days <= 7 ? 'receipt.recent' : 'receipt.older',
      weight: bucket.weight,
      polarity: 'positive',
      explanation: `${tense} ${subject}${store} ${phrase}.`,
      createdAt: evidenceIso,
      metadata: { days, receiptId: receipt.receiptId, store: receipt.storeName },
    },
  ];
}
