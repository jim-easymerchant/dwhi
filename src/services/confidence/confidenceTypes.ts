import type { Item } from '@/types/models';

export type SignalPolarity = 'positive' | 'negative' | 'neutral';

export type ConfidenceLevel = 'Probably' | 'Maybe' | 'Unlikely' | 'No' | 'Unknown';

/**
 * The atomic unit of evidence the engine reasons over. Each generator emits
 * zero or more of these. The scorer reduces them to a score; the explainer
 * picks the strongest few to weave into a human answer.
 */
export interface ConfidenceSignal {
  /** Short stable identifier, e.g. "receipt.recent", "event.last-out". */
  type: string;
  /** Signed contribution. Positive raises the score; negative lowers it. */
  weight: number;
  /** Sign hint for the explainer + UI grouping. */
  polarity: SignalPolarity;
  /** Single-clause natural-language sentence; the explainer stitches these. */
  explanation: string;
  /** ISO timestamp the underlying evidence was created (if applicable). */
  createdAt?: string;
  metadata?: Record<string, unknown>;
}

export interface MatchedItem {
  id?: number;
  name?: string;
  barcode?: string;
  category?: string;
}

export interface ConfidenceResult {
  level: ConfidenceLevel;
  /** Clamped 0..100 for display. */
  score: number;
  /** Conversational answer suitable for the Ask card. */
  answer: string;
  /** Every signal that fired, in emission order. */
  signals: ConfidenceSignal[];
  matchedItem?: MatchedItem;
}

/**
 * Shared input every signal generator gets. Generators stay pure: they don't
 * mutate the context, they just emit signals derived from it.
 */
export interface SignalContext {
  /** Cleaned noun phrase the user asked about. */
  query: string;
  /** Best item match (by name) if one was found, else null. */
  matchedItem: Item | null;
  /** Most recent receipt that mentions the query, if any. */
  matchedReceipt: {
    receiptId: number;
    purchasedAt: string | null;
    createdAt: string;
    matchedName: string;
    storeName: string | null;
  } | null;
  /** Wall clock at engine entry, ms since epoch. Pinned for determinism. */
  now: number;
}

/** Shape every signal generator implements. */
export type SignalGenerator = (ctx: SignalContext) => Promise<ConfidenceSignal[]>;
