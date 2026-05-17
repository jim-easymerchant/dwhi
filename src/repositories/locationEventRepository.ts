import { getDb, nowIso } from '@/db/database';
import {
  getActiveDeviceId,
  getActiveHouseholdId,
  getActiveMemberId,
} from '@/services/householdContext';

export interface NewLocationEvent {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  altitude?: number | null;
  heading?: number | null;
  speed?: number | null;
  provider?: string | null;
  source?: 'background' | 'foreground' | 'manual';
  capturedAt: string; // ISO
}

export interface LocationEvent extends NewLocationEvent {
  id: number;
  householdId: number;
  createdByMemberId: number | null;
  createdByDeviceId: number | null;
  source: 'background' | 'foreground' | 'manual';
  createdAt: string;
  syncStatus: string | null;
  remoteId: string | null;
  deletedAt: string | null;
}

interface Row {
  id: number;
  household_id: number;
  created_by_member_id: number | null;
  created_by_device_id: number | null;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  altitude: number | null;
  heading: number | null;
  speed: number | null;
  provider: string | null;
  source: string;
  captured_at: string;
  created_at: string;
  sync_status: string | null;
  remote_id: string | null;
  deleted_at: string | null;
}

function rowToEvent(row: Row): LocationEvent {
  return {
    id: row.id,
    householdId: row.household_id,
    createdByMemberId: row.created_by_member_id,
    createdByDeviceId: row.created_by_device_id,
    latitude: row.latitude,
    longitude: row.longitude,
    accuracy: row.accuracy,
    altitude: row.altitude,
    heading: row.heading,
    speed: row.speed,
    provider: row.provider,
    source: (row.source as LocationEvent['source']) ?? 'background',
    capturedAt: row.captured_at,
    createdAt: row.created_at,
    syncStatus: row.sync_status,
    remoteId: row.remote_id,
    deletedAt: row.deleted_at,
  };
}

export async function insertLocationEvent(
  input: NewLocationEvent,
): Promise<LocationEvent> {
  const db = await getDb();
  const now = nowIso();
  const householdId = getActiveHouseholdId();
  const memberId = getActiveMemberId();
  const deviceId = getActiveDeviceId();
  const source = input.source ?? 'background';
  const result = await db.runAsync(
    `INSERT INTO location_events
       (household_id, created_by_member_id, created_by_device_id,
        latitude, longitude, accuracy, altitude, heading, speed,
        provider, source, captured_at, created_at, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'local_only');`,
    householdId,
    memberId,
    deviceId,
    input.latitude,
    input.longitude,
    input.accuracy ?? null,
    input.altitude ?? null,
    input.heading ?? null,
    input.speed ?? null,
    input.provider ?? null,
    source,
    input.capturedAt,
    now,
  );
  return {
    ...input,
    id: result.lastInsertRowId,
    householdId,
    createdByMemberId: memberId,
    createdByDeviceId: deviceId,
    source,
    accuracy: input.accuracy ?? null,
    altitude: input.altitude ?? null,
    heading: input.heading ?? null,
    speed: input.speed ?? null,
    provider: input.provider ?? null,
    createdAt: now,
    syncStatus: 'local_only',
    remoteId: null,
    deletedAt: null,
  };
}

export async function getLatestLocationEvent(): Promise<LocationEvent | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<Row>(
    `SELECT * FROM location_events
      WHERE household_id = ? AND deleted_at IS NULL
      ORDER BY captured_at DESC
      LIMIT 1;`,
    getActiveHouseholdId(),
  );
  return row ? rowToEvent(row) : null;
}

export async function listRecentLocationEvents(
  limit = 20,
): Promise<LocationEvent[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Row>(
    `SELECT * FROM location_events
      WHERE household_id = ? AND deleted_at IS NULL
      ORDER BY captured_at DESC
      LIMIT ?;`,
    getActiveHouseholdId(),
    limit,
  );
  return rows.map(rowToEvent);
}

export async function countLocationEvents(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) AS c FROM location_events
      WHERE household_id = ? AND deleted_at IS NULL;`,
    getActiveHouseholdId(),
  );
  return row?.c ?? 0;
}
