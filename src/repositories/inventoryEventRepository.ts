import { getDb, nowIso } from '@/db/database';
import {
  getActiveDeviceId,
  getActiveHouseholdId,
  getActiveMemberId,
} from '@/services/householdContext';
import type { InventoryEvent, NewInventoryEvent } from '@/types/models';

interface EventRow {
  id: number;
  item_id: number;
  direction: 'IN' | 'OUT';
  quantity: number;
  image_uri: string | null;
  raw_ai_json: string | null;
  source: string;
  created_at: string;
}

function rowToEvent(row: EventRow): InventoryEvent {
  return {
    id: row.id,
    itemId: row.item_id,
    direction: row.direction,
    quantity: row.quantity,
    imageUri: row.image_uri,
    rawAiJson: row.raw_ai_json,
    source: row.source as InventoryEvent['source'],
    createdAt: row.created_at,
  };
}

export async function recordEvent(input: NewInventoryEvent): Promise<InventoryEvent> {
  const db = await getDb();
  const now = nowIso();
  const result = await db.runAsync(
    `INSERT INTO inventory_events
       (item_id, direction, quantity, image_uri, raw_ai_json, source, created_at,
        household_id, created_by_member_id, created_by_device_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    input.itemId,
    input.direction,
    input.quantity,
    input.imageUri,
    input.rawAiJson,
    input.source,
    now,
    getActiveHouseholdId(),
    getActiveMemberId(),
    getActiveDeviceId(),
  );
  return { ...input, id: result.lastInsertRowId, createdAt: now };
}

export async function listEventsForItem(
  itemId: number,
  limit = 50,
): Promise<InventoryEvent[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<EventRow>(
    `SELECT * FROM inventory_events
     WHERE household_id = ? AND item_id = ?
     ORDER BY created_at DESC
     LIMIT ?;`,
    getActiveHouseholdId(),
    itemId,
    limit,
  );
  return rows.map(rowToEvent);
}

export interface EstimatedBalance {
  totalIn: number;
  totalOut: number;
  net: number;
  lastInAt: string | null;
  lastOutAt: string | null;
}

export async function getEstimatedBalance(itemId: number): Promise<EstimatedBalance> {
  const db = await getDb();
  const row = await db.getFirstAsync<{
    total_in: number | null;
    total_out: number | null;
    last_in_at: string | null;
    last_out_at: string | null;
  }>(
    `SELECT
       COALESCE(SUM(CASE WHEN direction = 'IN'  THEN quantity END), 0) AS total_in,
       COALESCE(SUM(CASE WHEN direction = 'OUT' THEN quantity END), 0) AS total_out,
       MAX(CASE WHEN direction = 'IN'  THEN created_at END) AS last_in_at,
       MAX(CASE WHEN direction = 'OUT' THEN created_at END) AS last_out_at
     FROM inventory_events
     WHERE household_id = ? AND item_id = ?;`,
    getActiveHouseholdId(),
    itemId,
  );
  const totalIn = row?.total_in ?? 0;
  const totalOut = row?.total_out ?? 0;
  return {
    totalIn,
    totalOut,
    net: totalIn - totalOut,
    lastInAt: row?.last_in_at ?? null,
    lastOutAt: row?.last_out_at ?? null,
  };
}

export async function listRecentEvents(limit = 20): Promise<InventoryEvent[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<EventRow>(
    `SELECT * FROM inventory_events
     WHERE household_id = ?
     ORDER BY created_at DESC
     LIMIT ?;`,
    getActiveHouseholdId(),
    limit,
  );
  return rows.map(rowToEvent);
}
