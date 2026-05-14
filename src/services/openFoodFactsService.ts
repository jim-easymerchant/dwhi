/**
 * Open Food Facts barcode lookup. v2 API, community-provided data — never
 * trusted blindly. Output flows into the existing item confirmation screen
 * where the user reviews + edits before saving.
 *
 * Docs: https://wiki.openfoodfacts.org/API
 * Endpoint: GET /api/v2/product/{barcode}.json
 *
 * No API key, no auth, no backend involvement. Lookup is direct device →
 * Open Food Facts.
 */

import type { ItemRecognitionResult } from './aiService';
import type { ItemLookupSource } from '@/types/models';

const OFF_URL = 'https://world.openfoodfacts.org/api/v2/product';
const REQUEST_TIMEOUT_MS = 10_000;
// We trim the raw response before persisting so we don't bloat the DB with
// the entire ~50KB OFF payload.
const MAX_RAW_JSON_BYTES = 8_000;

export interface RecognizedItemOutcome {
  parsed: ItemRecognitionResult;
  source: ItemLookupSource;
  barcode?: string;
  rawLookupJson?: string;
}

export class OpenFoodFactsError extends Error {
  constructor(
    message: string,
    public kind: 'not_found' | 'network' | 'timeout' | 'malformed' | 'empty' | 'http',
    public status?: number,
  ) {
    super(message);
    this.name = 'OpenFoodFactsError';
  }
}

interface OffProduct {
  product_name?: string;
  product_name_en?: string;
  generic_name?: string;
  abbreviated_product_name?: string;
  brands?: string;
  brand_owner?: string;
  categories?: string;
  categories_tags?: string[];
  packaging?: string;
  packaging_tags?: string[];
  quantity?: string;
  product_quantity?: string;
}

interface OffEnvelope {
  status?: number;
  status_verbose?: string;
  code?: string;
  product?: OffProduct;
}

function takeFirstNonEmpty(values: Array<string | null | undefined>): string | null {
  for (const v of values) {
    if (typeof v !== 'string') continue;
    const trimmed = v.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return null;
}

function firstFromCsv(value: string | undefined | null): string | null {
  if (!value) return null;
  const first = value.split(',')[0]?.trim();
  return first && first.length > 0 ? first : null;
}

function pickBestCategory(product: OffProduct): string | null {
  // categories_tags entries look like "en:chocolate-bars". Take the most
  // specific (last) and strip the language prefix.
  const tags = product.categories_tags;
  if (Array.isArray(tags) && tags.length > 0) {
    const last = tags[tags.length - 1];
    if (typeof last === 'string') {
      const cleaned = last.replace(/^[a-z]{2}:/, '').replace(/-/g, ' ').trim();
      if (cleaned.length > 0) return capitalize(cleaned);
    }
  }
  return firstFromCsv(product.categories);
}

function pickPackaging(product: OffProduct): string | null {
  const first = firstFromCsv(product.packaging);
  if (first) return capitalize(first);
  const tags = product.packaging_tags;
  if (Array.isArray(tags)) {
    for (const t of tags) {
      if (typeof t === 'string' && t.trim()) {
        return capitalize(t.replace(/^[a-z]{2}:/, '').replace(/-/g, ' ').trim());
      }
    }
  }
  return null;
}

function capitalize(s: string): string {
  return s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s;
}

function mapToRecognition(product: OffProduct): ItemRecognitionResult | null {
  const name = takeFirstNonEmpty([
    product.product_name,
    product.product_name_en,
    product.generic_name,
    product.abbreviated_product_name,
  ]);
  if (!name) return null;

  return {
    manufacturer: firstFromCsv(product.brands) ?? firstFromCsv(product.brand_owner ?? null),
    name,
    category: pickBestCategory(product),
    containerType: pickPackaging(product),
    size: takeFirstNonEmpty([product.quantity, product.product_quantity]),
  };
}

function isLikelyBarcode(input: string): boolean {
  return /^[0-9]{6,14}$/.test(input);
}

function trimRawJson(payload: unknown): string | undefined {
  try {
    const text = JSON.stringify(payload);
    if (text.length <= MAX_RAW_JSON_BYTES) return text;
    // Falls back to a sentinel rather than a half-truncated JSON string so a
    // future reader doesn't try to JSON.parse a broken value.
    return JSON.stringify({ note: 'raw response truncated', size: text.length });
  } catch {
    return undefined;
  }
}

/**
 * Looks a barcode up against Open Food Facts and maps the response into the
 * item confirmation shape. Throws OpenFoodFactsError on every failure mode so
 * the caller can branch on `.kind`.
 */
export async function lookupBarcode(barcode: string): Promise<RecognizedItemOutcome> {
  const cleaned = barcode.trim();
  if (!isLikelyBarcode(cleaned)) {
    throw new OpenFoodFactsError(
      `"${cleaned}" doesn't look like a product barcode.`,
      'malformed',
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${OFF_URL}/${encodeURIComponent(cleaned)}.json`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        // Per OFF guidelines: identify the client.
        'User-Agent': 'DoWeHaveIt-POC/0.1 (https://expo.dev)',
      },
      signal: controller.signal,
    });
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new OpenFoodFactsError('Lookup timed out.', 'timeout');
    }
    throw new OpenFoodFactsError(
      `Network error reaching Open Food Facts: ${e instanceof Error ? e.message : String(e)}`,
      'network',
    );
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 404) {
    throw new OpenFoodFactsError(
      `Barcode ${cleaned} is not in Open Food Facts.`,
      'not_found',
      404,
    );
  }
  if (!response.ok) {
    throw new OpenFoodFactsError(
      `Open Food Facts returned ${response.status} ${response.statusText}.`,
      'http',
      response.status,
    );
  }

  let envelope: OffEnvelope;
  try {
    envelope = (await response.json()) as OffEnvelope;
  } catch (e) {
    throw new OpenFoodFactsError(
      `Open Food Facts response was not valid JSON: ${e instanceof Error ? e.message : String(e)}`,
      'malformed',
    );
  }

  if (envelope.status === 0 || !envelope.product) {
    throw new OpenFoodFactsError(
      `Barcode ${cleaned} is not in Open Food Facts.`,
      'not_found',
    );
  }

  const recognition = mapToRecognition(envelope.product);
  if (!recognition) {
    throw new OpenFoodFactsError(
      'Open Food Facts has this barcode but no usable product name.',
      'empty',
    );
  }

  return {
    parsed: recognition,
    source: 'barcode',
    barcode: cleaned,
    rawLookupJson: trimRawJson(envelope),
  };
}
