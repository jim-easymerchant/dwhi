/**
 * On-device behavior learning: derives household patterns from existing
 * inventory_events. No ML, no remote calls. Pure aggregation over the local
 * SQLite store.
 *
 * Two flavours of stats:
 *   - per-item: how often this exact thing gets restocked / used up.
 *   - per-category: a fallback when the per-item history is too thin.
 *
 * The numbers feed `behaviorSignals` which contributes nudges to the
 * confidence score — never enough to dominate stronger receipt/event signals.
 */

import { getDb } from '@/db/database';
import { summaryForTerm, type AskSummaryForTerm } from '@/repositories/askHistoryRepository';
import { getActiveHouseholdId } from './householdContext';

const DAY_MS = 86_400_000;

export interface ItemBehaviorStats {
  itemId: number;
  /** Average days between consecutive IN events (≥2 samples). */
  avgRepurchaseDays: number | null;
  repurchaseSamples: number;
  /** Average days from an IN to the next OUT on the same item. */
  avgInToOutDays: number | null;
  inToOutSamples: number;
  ask: AskSummaryForTerm;
}

export interface CategoryBehaviorStats {
  category: string;
  avgInToOutDays: number | null;
  inToOutSamples: number;
}

interface EventRow {
  item_id: number;
  direction: 'IN' | 'OUT';
  created_at: string;
}

/**
 * Pulls every event for the given item, then walks it twice — once for IN→IN
 * gaps (repurchase rhythm) and once for IN→next-OUT spans (burn time). Pure
 * JS so it stays testable without SQL.
 */
export async function getItemBehaviorStats(
  itemId: number,
  normalizedTerm: string,
  now = Date.now(),
): Promise<ItemBehaviorStats> {
  const db = await getDb();
  const rows = await db.getAllAsync<EventRow>(
    `SELECT item_id, direction, created_at
       FROM inventory_events
      WHERE household_id = ? AND item_id = ?
      ORDER BY created_at ASC;`,
    getActiveHouseholdId(),
    itemId,
  );

  const { repurchase, burn } = analyseEvents(rows);
  const ask = await summaryForTerm(normalizedTerm, now);

  return {
    itemId,
    avgRepurchaseDays: repurchase.avgDays,
    repurchaseSamples: repurchase.samples,
    avgInToOutDays: burn.avgDays,
    inToOutSamples: burn.samples,
    ask,
  };
}

/**
 * Aggregates burn-time across every item in the category, so a new item gets
 * a reasonable depletion estimate from its peers.
 */
export async function getCategoryBehaviorStats(
  category: string | null | undefined,
): Promise<CategoryBehaviorStats | null> {
  const trimmed = category?.trim();
  if (!trimmed) return null;
  const db = await getDb();
  const rows = await db.getAllAsync<EventRow>(
    `SELECT e.item_id AS item_id, e.direction AS direction, e.created_at AS created_at
       FROM inventory_events e
       JOIN items i ON i.id = e.item_id
      WHERE e.household_id = ? AND LOWER(i.category) = LOWER(?)
      ORDER BY e.item_id ASC, e.created_at ASC;`,
    getActiveHouseholdId(),
    trimmed,
  );
  const { burn } = analyseEvents(rows);
  return { category: trimmed, avgInToOutDays: burn.avgDays, inToOutSamples: burn.samples };
}

/**
 * Diagnostics-only count of items the engine has enough history on to make
 * a real behavior signal. "Learned" here means: at least 2 IN events
 * (repurchase rhythm) OR at least 1 IN-then-OUT pair (burn time).
 */
export async function countLearnedPatterns(): Promise<number> {
  const db = await getDb();
  const householdId = getActiveHouseholdId();
  const row = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) AS c FROM (
       SELECT item_id
         FROM inventory_events
        WHERE household_id = ? AND direction = 'IN'
        GROUP BY item_id
       HAVING COUNT(*) >= 2
       UNION
       SELECT DISTINCT i.item_id AS item_id
         FROM inventory_events i
         JOIN inventory_events o ON o.item_id = i.item_id
                                  AND o.direction = 'OUT'
                                  AND o.created_at > i.created_at
                                  AND o.household_id = i.household_id
        WHERE i.household_id = ? AND i.direction = 'IN'
     );`,
    householdId,
    householdId,
  );
  return row?.c ?? 0;
}

// ---------------------------------------------------------------------------
// internals
// ---------------------------------------------------------------------------

interface Avg {
  avgDays: number | null;
  samples: number;
}

interface EventAnalysis {
  repurchase: Avg;
  burn: Avg;
}

function analyseEvents(rows: EventRow[]): EventAnalysis {
  // Bucket by item so cross-item rows in a category query don't contaminate
  // each other's pairing.
  const byItem = new Map<number, EventRow[]>();
  for (const row of rows) {
    const list = byItem.get(row.item_id);
    if (list) list.push(row);
    else byItem.set(row.item_id, [row]);
  }

  let repurchaseMs = 0;
  let repurchaseSamples = 0;
  let burnMs = 0;
  let burnSamples = 0;

  for (const events of byItem.values()) {
    // Already sorted asc by created_at thanks to the caller's ORDER BY.
    const ins = events
      .filter(e => e.direction === 'IN')
      .map(e => Date.parse(e.created_at))
      .filter(t => !Number.isNaN(t));

    for (let i = 1; i < ins.length; i++) {
      const gap = ins[i] - ins[i - 1];
      if (gap > 0) {
        repurchaseMs += gap;
        repurchaseSamples++;
      }
    }

    // Walk through events in order and pair every IN with the next OUT.
    let lastInTs: number | null = null;
    for (const e of events) {
      const ts = Date.parse(e.created_at);
      if (Number.isNaN(ts)) continue;
      if (e.direction === 'IN') {
        lastInTs = ts;
      } else if (e.direction === 'OUT' && lastInTs !== null) {
        if (ts > lastInTs) {
          burnMs += ts - lastInTs;
          burnSamples++;
        }
        lastInTs = null; // each IN pairs with at most one OUT
      }
    }
  }

  return {
    repurchase: {
      avgDays: repurchaseSamples > 0 ? repurchaseMs / repurchaseSamples / DAY_MS : null,
      samples: repurchaseSamples,
    },
    burn: {
      avgDays: burnSamples > 0 ? burnMs / burnSamples / DAY_MS : null,
      samples: burnSamples,
    },
  };
}
