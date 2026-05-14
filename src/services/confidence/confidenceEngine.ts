/**
 * Public entry point: answerQuestion(query) → ConfidenceResult.
 *
 * Orchestration:
 *   1. Normalize the query into a noun phrase.
 *   2. Pull the matched item (by name) and most-recent matching receipt.
 *   3. Run every signal generator in parallel against the shared context.
 *   4. Score + level via weightedScorer.
 *   5. Compose answer via confidenceExplainer.
 *   6. In __DEV__, log the breakdown so the engine is auditable from the
 *      debugger — nothing in prod logs.
 *
 * The engine is local-first and synchronous-feeling: every dependency is the
 * existing on-device SQLite repository layer. The whole thing is portable —
 * if a server-side version is ever wanted, the only contract that needs to
 * change is how the context is hydrated.
 */

import { searchByName } from '@/repositories/itemRepository';
import { findMostRecentReceiptForItem } from '@/repositories/receiptRepository';
import type { ConfidenceResult, SignalContext, SignalGenerator } from './confidenceTypes';
import { scoreSignals } from './weightedScorer';
import { explain } from './confidenceExplainer';
import { receiptSignals } from './signalGenerators/receiptSignals';
import { inventoryEventSignals } from './signalGenerators/inventoryEventSignals';
import { barcodeSignals } from './signalGenerators/barcodeSignals';
import { temporalDecaySignals } from './signalGenerators/temporalDecaySignals';

const GENERATORS: SignalGenerator[] = [
  receiptSignals,
  inventoryEventSignals,
  barcodeSignals,
  temporalDecaySignals,
];

/**
 * Strips filler words ("do we have any …") down to a probable noun phrase the
 * rest of the lookup can match on. Falls back to the raw query if cleaning
 * eats everything.
 */
export function extractQueryTerm(rawQuery: string): string {
  const cleaned = rawQuery
    .toLowerCase()
    .replace(/[?.!,]/g, ' ')
    .replace(
      /\b(do|we|have|any|some|got|is|are|there|the|a|an|left|still|in|stock)\b/g,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.length > 0 ? cleaned : rawQuery.trim();
}

export async function answerQuestion(rawQuery: string): Promise<ConfidenceResult> {
  const query = extractQueryTerm(rawQuery);
  if (!query) {
    return emptyResult(rawQuery);
  }

  const now = Date.now();
  const [items, receiptHit] = await Promise.all([
    searchByName(query, 5),
    findMostRecentReceiptForItem(query),
  ]);
  const matchedItem = items[0] ?? null;

  const ctx: SignalContext = {
    query,
    matchedItem,
    matchedReceipt: receiptHit
      ? {
          receiptId: receiptHit.receipt.id,
          purchasedAt: receiptHit.receipt.purchasedAt,
          createdAt: receiptHit.receipt.createdAt,
          matchedName: receiptHit.matchedName,
          storeName: receiptHit.receipt.storeName,
        }
      : null,
    now,
  };

  const signalGroups = await Promise.all(GENERATORS.map(g => g(ctx)));
  const signals = signalGroups.flat();

  const { score, level } = scoreSignals(signals, { now });
  const answer = explain(level, signals, ctx);

  const result: ConfidenceResult = {
    level,
    score,
    answer,
    signals,
    matchedItem: matchedItem
      ? {
          id: matchedItem.id,
          name: matchedItem.name,
          barcode: matchedItem.barcode ?? undefined,
          category: matchedItem.category ?? undefined,
        }
      : undefined,
  };

  if (__DEV__) {
    debugTrace(rawQuery, query, result);
  }

  return result;
}

function emptyResult(rawQuery: string): ConfidenceResult {
  return {
    level: 'Unknown',
    score: 0,
    answer: `I didn't catch a specific item in that question.`,
    signals: [],
    matchedItem: undefined,
  };
}

function debugTrace(
  rawQuery: string,
  query: string,
  result: ConfidenceResult,
): void {
  // eslint-disable-next-line no-console
  console.debug(
    `[confidence] "${rawQuery}" → "${query}" → ${result.level} (score ${result.score})`,
  );
  for (const s of result.signals) {
    // eslint-disable-next-line no-console
    console.debug(
      `[confidence]   ${s.weight >= 0 ? '+' : ''}${s.weight.toFixed(1).padStart(6)}  ${s.type.padEnd(28)}  ${s.explanation}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Re-exports so other call sites (Ask screen, tests, future debug UI) can
// import the public surface from this single module.
// ---------------------------------------------------------------------------

export type {
  ConfidenceLevel,
  ConfidenceResult,
  ConfidenceSignal,
  MatchedItem,
  SignalContext,
  SignalGenerator,
  SignalPolarity,
} from './confidenceTypes';
