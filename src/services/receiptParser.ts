import { stubAIService, type ReceiptParseResult } from './aiService';
import { isOpenAIConfigured } from './env';
import { parseReceiptWithOpenAI } from './openaiReceiptService';

export type ParseSource = 'ai' | 'mock' | 'manual';

export interface ReceiptParseOutcome {
  parsed: ReceiptParseResult;
  source: ParseSource;
  rawAiJson?: string;
  model?: string;
}

/**
 * Primary entry point for "turn a receipt image into a draft we can show on
 * confirm-receipt." Routes to OpenAI when an API key is configured and to
 * the mock parser otherwise. Throws on AI failures so the caller can decide
 * how to surface the fallback options.
 */
export async function parseReceiptImage(imageUri: string): Promise<ReceiptParseOutcome> {
  if (isOpenAIConfigured()) {
    const { parsed, rawJson, model } = await parseReceiptWithOpenAI(imageUri);
    return { parsed, source: 'ai', rawAiJson: rawJson, model };
  }
  const parsed = await stubAIService.parseReceipt(imageUri);
  return { parsed, source: 'mock' };
}

/** Forced mock parse, used as the "Use sample data" fallback button. */
export async function parseReceiptMock(imageUri: string): Promise<ReceiptParseOutcome> {
  const parsed = await stubAIService.parseReceipt(imageUri);
  return { parsed, source: 'mock' };
}

/** Empty-but-valid outcome for the "Enter manually" fallback button. */
export function emptyReceiptOutcome(): ReceiptParseOutcome {
  return {
    parsed: {
      storeName: null,
      purchasedAt: new Date().toISOString(),
      total: null,
      items: [],
    },
    source: 'manual',
  };
}
