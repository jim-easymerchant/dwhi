import type { ConfidenceSignal, SignalContext } from '../confidenceTypes';

/**
 * Barcode evidence boosts *identity* confidence — we're sure which SKU the
 * user is asking about — not inventory certainty. We add a small positive
 * weight when the matched item has a stored barcode (i.e. someone has
 * actually scanned this product into the household before).
 *
 * Intentionally a modest weight: a known barcode doesn't mean the item is
 * present, just that we recognise it.
 */
export async function barcodeSignals(
  ctx: SignalContext,
): Promise<ConfidenceSignal[]> {
  const item = ctx.matchedItem;
  if (!item || !item.barcode) return [];

  return [
    {
      type: 'barcode.identity-known',
      weight: 5,
      polarity: 'positive',
      explanation: `${item.name} is linked to a barcode we've seen before.`,
      metadata: { barcode: item.barcode, source: item.source },
    },
  ];
}
