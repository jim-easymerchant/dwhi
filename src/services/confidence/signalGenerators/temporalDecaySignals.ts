import type { ConfidenceSignal, SignalContext } from '../confidenceTypes';

/**
 * Models household consumption over time. The further past the last
 * in-event/receipt we go, the less likely the item is still around — but
 * how fast that decay happens depends on the kind of product.
 *
 * Profiles are matched first against the item's category, then against the
 * item's name (and the raw query as a last resort). The mapping is
 * intentionally small and tweakable rather than per-item hardcoded.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export type DecayProfile = 'fast' | 'medium' | 'slow' | 'very_slow' | 'unknown';

/** Per-day weight + max-negative cap per profile. */
const DECAY_TABLE: Record<DecayProfile, { perDay: number; cap: number; phrase: string }> = {
  fast: {
    perDay: -2.5,
    cap: -50,
    phrase: 'usually gets used quickly',
  },
  medium: {
    perDay: -1.0,
    cap: -25,
    phrase: 'usually lasts a couple of weeks',
  },
  slow: {
    perDay: -0.3,
    cap: -12,
    phrase: 'usually keeps for weeks',
  },
  very_slow: {
    perDay: -0.08,
    cap: -5,
    phrase: 'usually lasts months',
  },
  unknown: {
    perDay: -1.0,
    cap: -25,
    phrase: 'might already be used',
  },
};

/**
 * Keyword → decay profile. Matched as case-insensitive substring against:
 *   1. items.category
 *   2. items.name
 *   3. the query string
 */
const KEYWORD_PROFILES: Array<{ keywords: string[]; profile: DecayProfile }> = [
  {
    profile: 'fast',
    keywords: [
      'milk', 'yogurt', 'cream', 'fresh', 'produce', 'bread', 'meat', 'fish',
      'chicken', 'beef', 'pork', 'salad', 'lettuce', 'tomato', 'banana',
      'berr', 'egg', 'avocado', 'tofu', 'hummus',
    ],
  },
  {
    profile: 'medium',
    keywords: [
      'cheese', 'juice', 'condiment', 'sauce', 'butter', 'tortilla',
      'deli', 'pasta cooked',
    ],
  },
  {
    profile: 'slow',
    keywords: [
      'canned', 'jar', 'pickle', 'spice', 'pasta', 'noodle', 'rice', 'bean',
      'cereal', 'cracker', 'snack', 'chocolate', 'coffee', 'tea', 'flour',
      'sugar', 'salt', 'vinegar', 'oil', 'honey', 'jam', 'condiments',
    ],
  },
  {
    profile: 'very_slow',
    keywords: [
      'paper towel', 'toilet paper', 'paper', 'batter', 'battery',
      'cleaning', 'detergent', 'soap', 'shampoo', 'toothpaste', 'foil',
      'wrap', 'bag', 'sponge', 'lightbulb',
    ],
  },
];

export function decayProfileFor(
  category: string | null | undefined,
  name: string | null | undefined,
  query: string,
): DecayProfile {
  const haystacks = [category, name, query]
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .map(v => v.toLowerCase());
  if (haystacks.length === 0) return 'unknown';
  for (const { keywords, profile } of KEYWORD_PROFILES) {
    for (const haystack of haystacks) {
      for (const kw of keywords) {
        if (haystack.includes(kw)) return profile;
      }
    }
  }
  return 'unknown';
}

function daysSince(now: number, iso: string): number {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.floor((now - t) / DAY_MS));
}

export async function temporalDecaySignals(
  ctx: SignalContext,
): Promise<ConfidenceSignal[]> {
  // We need a "since when" reference. Use the most recent of:
  //   item.updated_at, matched receipt date.
  const refIso =
    ctx.matchedItem?.updatedAt ??
    ctx.matchedReceipt?.purchasedAt ??
    ctx.matchedReceipt?.createdAt ??
    null;
  if (!refIso) return [];

  const days = daysSince(ctx.now, refIso);
  if (days <= 0) return []; // bought today: no decay yet

  const profile = decayProfileFor(
    ctx.matchedItem?.category ?? null,
    ctx.matchedItem?.name ?? null,
    ctx.query,
  );
  const { perDay, cap, phrase } = DECAY_TABLE[profile];
  const raw = days * perDay;
  const weight = Math.max(cap, raw);

  // Tiny decays (a day or two of slow items) aren't worth narrating — they
  // also barely move the score. Skip them so the explainer stays focused.
  if (weight > -1.5) {
    return [];
  }

  const subject = ctx.matchedItem?.name ?? ctx.query;
  return [
    {
      type: `temporal.${profile}`,
      weight,
      polarity: 'negative',
      explanation: `${subject} ${phrase}.`,
      metadata: { profile, days, perDay, cap },
    },
  ];
}
