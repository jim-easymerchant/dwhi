import { getEstimatedBalance, listEventsForItem } from '@/repositories/inventoryEventRepository';
import { searchByName } from '@/repositories/itemRepository';
import { findMostRecentReceiptForItem } from '@/repositories/receiptRepository';
import type { AskAnswer, ConfidenceLevel } from '@/types/models';

const DAY_MS = 24 * 60 * 60 * 1000;

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.max(0, Math.floor((Date.now() - then) / DAY_MS));
}

function approx(d: number): string {
  if (d <= 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 14) return `${d} days ago`;
  if (d < 60) return `${Math.round(d / 7)} weeks ago`;
  return `${Math.round(d / 30)} months ago`;
}

function pickConfidence(signals: {
  net: number;
  daysSinceIn: number | null;
  daysSinceOut: number | null;
  hasReceipt: boolean;
}): ConfidenceLevel {
  const { net, daysSinceIn, daysSinceOut, hasReceipt } = signals;

  if (daysSinceIn === null && daysSinceOut === null && !hasReceipt) {
    return 'Unknown';
  }

  if (net > 0 && (daysSinceIn ?? 999) <= 14) return 'Probably';
  if (hasReceipt && (daysSinceIn ?? 999) <= 7) return 'Probably';

  if (net <= 0 && daysSinceOut !== null && daysSinceOut <= 7) return 'No';
  if (net <= 0 && daysSinceOut !== null) return 'Unlikely';

  if (hasReceipt) return 'Maybe';
  return 'Maybe';
}

/**
 * Pulls the user-typed query apart from filler ("do we have any pickles?")
 * down to a probable noun phrase the rest of the lookup can match on.
 */
export function extractQueryTerm(rawQuery: string): string {
  const cleaned = rawQuery
    .toLowerCase()
    .replace(/[?.!,]/g, ' ')
    .replace(/\b(do|we|have|any|some|got|is|are|there|the|a|an|left|still|in|stock)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.length > 0 ? cleaned : rawQuery.trim();
}

export async function answerQuestion(rawQuery: string): Promise<AskAnswer> {
  const term = extractQueryTerm(rawQuery);
  if (!term) {
    return {
      confidence: 'Unknown',
      message: "I didn't catch a specific item in that question.",
    };
  }

  const matches = await searchByName(term, 5);
  const receiptHit = await findMostRecentReceiptForItem(term);

  if (matches.length === 0 && !receiptHit) {
    return {
      confidence: 'Unknown',
      message: `I don't have any history for "${term}" yet. Scan a receipt or tap + In, and I'll remember next time.`,
    };
  }

  const item = matches[0] ?? null;

  let net = 0;
  let daysSinceIn: number | null = null;
  let daysSinceOut: number | null = null;
  let lastEventCount = 0;

  if (item) {
    const balance = await getEstimatedBalance(item.id);
    net = balance.net;
    daysSinceIn = daysSince(balance.lastInAt);
    daysSinceOut = daysSince(balance.lastOutAt);
    const recent = await listEventsForItem(item.id, 10);
    lastEventCount = recent.length;
  }

  const receiptDays = receiptHit
    ? daysSince(receiptHit.receipt.purchasedAt ?? receiptHit.receipt.createdAt)
    : null;

  // Prefer the most recent of the two signals when narrating "you bought it".
  const inDays = daysSinceIn !== null && receiptDays !== null
    ? Math.min(daysSinceIn, receiptDays)
    : daysSinceIn ?? receiptDays;

  const confidence = pickConfidence({
    net,
    daysSinceIn: inDays,
    daysSinceOut,
    hasReceipt: !!receiptHit,
  });

  const subject = item?.name ?? receiptHit?.matchedName ?? term;

  let message: string;
  switch (confidence) {
    case 'Probably':
      if (inDays !== null) {
        message = `Probably. You bought ${subject} ${approx(inDays)}.`;
      } else {
        message = `Probably. ${subject} has been coming in recently.`;
      }
      break;
    case 'Maybe':
      if (lastEventCount >= 2 && inDays !== null) {
        message = `Maybe. You usually pick up ${subject} every couple of weeks — last time ${approx(inDays)}.`;
      } else if (inDays !== null) {
        message = `Maybe. Last ${subject} was ${approx(inDays)}.`;
      } else {
        message = `Maybe. I have some history on ${subject} but nothing recent.`;
      }
      break;
    case 'Unlikely':
      if (daysSinceOut !== null) {
        message = `Unlikely. The last ${subject} was used ${approx(daysSinceOut)}.`;
      } else {
        message = `Unlikely. ${subject} has been out more than in.`;
      }
      break;
    case 'No':
      message = `No. The last ${subject} was scanned out ${approx(daysSinceOut ?? 0)}.`;
      break;
    case 'Unknown':
    default:
      message = `I don't have any history for "${term}" yet. Scan a receipt or tap + In, and I'll remember next time.`;
      break;
  }

  return {
    confidence,
    message,
    matchedItemId: item?.id,
  };
}
