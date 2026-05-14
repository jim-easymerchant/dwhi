import type { ConfidenceSignal, SignalContext } from '../confidenceTypes';

/**
 * Passive household behavior signals. The engine uses on-device aggregates
 * (repurchase rhythm + IN→OUT burn time, per-item then per-category) to
 * nudge confidence when the user's pattern suggests the item is either
 * just-restocked or already used up.
 *
 * Three tiers, in priority order:
 *   1. Per-item repurchase rhythm  (needs ≥2 IN events)
 *   2. Per-item burn time          (needs ≥1 IN→OUT pair)
 *   3. Category burn-time fallback (needs ≥2 IN→OUT pairs in category)
 *
 * Only the strongest tier fires per direction, so we don't double-count.
 * Weights are deliberately small — these are nudges, not verdicts.
 */

const DAY_MS = 86_400_000;

const REPURCHASE_MIN_SAMPLES = 2;
const REPURCHASE_OVERDUE_RATIO = 1.2;
const REPURCHASE_FRESH_RATIO = 0.5;
const REPURCHASE_OVERDUE_WEIGHT = -10;
const REPURCHASE_FRESH_WEIGHT = 5;

const BURN_MIN_SAMPLES = 1;
const BURN_OVERDUE_RATIO = 1.0;
const BURN_FRESH_RATIO = 0.3;
const BURN_OVERDUE_WEIGHT = -8;
const BURN_FRESH_WEIGHT = 3;

const CATEGORY_MIN_SAMPLES = 2;
const CATEGORY_OVERDUE_WEIGHT = -5;
const CATEGORY_FRESH_WEIGHT = 2;

function daysSinceIso(now: number, iso: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, (now - t) / DAY_MS);
}

function roundDays(n: number): number {
  return Math.max(1, Math.round(n));
}

/**
 * Picks the freshest "this came in" reference for the matched item.
 * Prefers `itemBehavior.ask` data later; here we lean on the matched
 * receipt's purchased-at and (as a softer signal) the item's updated_at.
 */
function lastInIso(ctx: SignalContext): string | null {
  const ask = ctx.itemBehavior;
  const item = ctx.matchedItem;
  const receipt = ctx.matchedReceipt;
  // Honour receipt purchase date first — it's the user-anchored "this came home".
  if (receipt?.purchasedAt) return receipt.purchasedAt;
  if (receipt?.createdAt) return receipt.createdAt;
  if (item?.updatedAt) return item.updatedAt;
  // Avoid an unused-var lint warning when ask is otherwise unread here.
  void ask;
  return null;
}

export async function behaviorSignals(
  ctx: SignalContext,
): Promise<ConfidenceSignal[]> {
  const stats = ctx.itemBehavior;
  if (!stats) {
    // Without per-item stats we can still try category fallback below, but
    // we also need a last-IN reference; bail unless we have one.
  }

  const reference = lastInIso(ctx);
  const days = daysSinceIso(ctx.now, reference);
  if (days === null) return [];

  const out: ConfidenceSignal[] = [];
  const subject = ctx.matchedItem?.name ?? ctx.query;

  // ---- Tier 1: repurchase rhythm ----
  let repurchaseFired = false;
  if (
    stats &&
    stats.avgRepurchaseDays !== null &&
    stats.repurchaseSamples >= REPURCHASE_MIN_SAMPLES
  ) {
    const cycle = stats.avgRepurchaseDays;
    const cycleRounded = roundDays(cycle);
    if (days > cycle * REPURCHASE_OVERDUE_RATIO) {
      out.push({
        type: 'behavior.repurchase-overdue',
        weight: REPURCHASE_OVERDUE_WEIGHT,
        polarity: 'negative',
        explanation: `You usually replace ${subject} every ${cycleRounded} day${cycleRounded === 1 ? '' : 's'} or so, and it's been longer than that.`,
        metadata: { cycleDays: cycle, daysSinceLastIn: days, samples: stats.repurchaseSamples },
      });
      repurchaseFired = true;
    } else if (days < cycle * REPURCHASE_FRESH_RATIO) {
      out.push({
        type: 'behavior.repurchase-fresh',
        weight: REPURCHASE_FRESH_WEIGHT,
        polarity: 'positive',
        explanation: `You usually restock ${subject} every ${cycleRounded} day${cycleRounded === 1 ? '' : 's'}, and you just did.`,
        metadata: { cycleDays: cycle, daysSinceLastIn: days, samples: stats.repurchaseSamples },
      });
      repurchaseFired = true;
    }
  }

  // ---- Tier 2: per-item IN→OUT burn time ----
  let burnFired = false;
  if (
    !repurchaseFired &&
    stats &&
    stats.avgInToOutDays !== null &&
    stats.inToOutSamples >= BURN_MIN_SAMPLES
  ) {
    const cycle = stats.avgInToOutDays;
    const cycleRounded = roundDays(cycle);
    if (days > cycle * BURN_OVERDUE_RATIO) {
      out.push({
        type: 'behavior.in-to-out-overdue',
        weight: BURN_OVERDUE_WEIGHT,
        polarity: 'negative',
        explanation: `${subject} usually gets used within ${cycleRounded} day${cycleRounded === 1 ? '' : 's'} of being brought home.`,
        metadata: { cycleDays: cycle, daysSinceLastIn: days, samples: stats.inToOutSamples },
      });
      burnFired = true;
    } else if (days < cycle * BURN_FRESH_RATIO) {
      out.push({
        type: 'behavior.in-to-out-fresh',
        weight: BURN_FRESH_WEIGHT,
        polarity: 'positive',
        explanation: `${subject} usually lasts at least ${cycleRounded} day${cycleRounded === 1 ? '' : 's'}, and this one is fresher than that.`,
        metadata: { cycleDays: cycle, daysSinceLastIn: days, samples: stats.inToOutSamples },
      });
      burnFired = true;
    }
  }

  // ---- Tier 3: category fallback burn time ----
  if (
    !repurchaseFired &&
    !burnFired &&
    ctx.categoryBehavior &&
    ctx.categoryBehavior.avgInToOutDays !== null &&
    ctx.categoryBehavior.inToOutSamples >= CATEGORY_MIN_SAMPLES
  ) {
    const cycle = ctx.categoryBehavior.avgInToOutDays;
    const cycleRounded = roundDays(cycle);
    if (days > cycle * BURN_OVERDUE_RATIO) {
      out.push({
        type: 'behavior.category-overdue',
        weight: CATEGORY_OVERDUE_WEIGHT,
        polarity: 'negative',
        explanation: `${subject}-type items usually last around ${cycleRounded} day${cycleRounded === 1 ? '' : 's'} in this house.`,
        metadata: {
          cycleDays: cycle,
          daysSinceLastIn: days,
          samples: ctx.categoryBehavior.inToOutSamples,
          source: 'category',
        },
      });
    } else if (days < cycle * BURN_FRESH_RATIO) {
      out.push({
        type: 'behavior.category-fresh',
        weight: CATEGORY_FRESH_WEIGHT,
        polarity: 'positive',
        explanation: `${subject}-type items usually last a while in this house.`,
        metadata: {
          cycleDays: cycle,
          daysSinceLastIn: days,
          samples: ctx.categoryBehavior.inToOutSamples,
          source: 'category',
        },
      });
    }
  }

  return out;
}
