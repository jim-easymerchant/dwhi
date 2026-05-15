import { getDb, nowIso } from '@/db/database';
import type {
  Device,
  Household,
  HouseholdMember,
  HouseholdRole,
} from '@/types/models';

// ---------------------------------------------------------------------------
// households
// ---------------------------------------------------------------------------

interface HouseholdRow {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

function rowToHousehold(row: HouseholdRow): Household {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getFirstHousehold(): Promise<Household | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<HouseholdRow>(
    'SELECT * FROM households ORDER BY id ASC LIMIT 1;',
  );
  return row ? rowToHousehold(row) : null;
}

export async function createHousehold(name: string): Promise<Household> {
  const db = await getDb();
  const now = nowIso();
  const result = await db.runAsync(
    'INSERT INTO households (name, created_at, updated_at) VALUES (?, ?, ?);',
    name,
    now,
    now,
  );
  return {
    id: result.lastInsertRowId,
    name,
    createdAt: now,
    updatedAt: now,
  };
}

// ---------------------------------------------------------------------------
// devices
// ---------------------------------------------------------------------------

interface DeviceRow {
  id: number;
  household_id: number;
  device_name: string;
  device_uuid: string;
  created_at: string;
  last_seen_at: string;
}

function rowToDevice(row: DeviceRow): Device {
  return {
    id: row.id,
    householdId: row.household_id,
    deviceName: row.device_name,
    deviceUuid: row.device_uuid,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
  };
}

export async function getFirstDeviceForHousehold(
  householdId: number,
): Promise<Device | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<DeviceRow>(
    'SELECT * FROM devices WHERE household_id = ? ORDER BY id ASC LIMIT 1;',
    householdId,
  );
  return row ? rowToDevice(row) : null;
}

export async function createDevice(
  householdId: number,
  deviceName: string,
  deviceUuid: string,
): Promise<Device> {
  const db = await getDb();
  const now = nowIso();
  const result = await db.runAsync(
    `INSERT INTO devices (household_id, device_name, device_uuid, created_at, last_seen_at)
     VALUES (?, ?, ?, ?, ?);`,
    householdId,
    deviceName,
    deviceUuid,
    now,
    now,
  );
  return {
    id: result.lastInsertRowId,
    householdId,
    deviceName,
    deviceUuid,
    createdAt: now,
    lastSeenAt: now,
  };
}

export async function touchDeviceLastSeen(deviceId: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE devices SET last_seen_at = ? WHERE id = ?;', nowIso(), deviceId);
}

// ---------------------------------------------------------------------------
// household_members
// ---------------------------------------------------------------------------

interface MemberRow {
  id: number;
  household_id: number;
  display_name: string;
  role: HouseholdRole;
  local_device_id: number | null;
  created_at: string;
}

function rowToMember(row: MemberRow): HouseholdMember {
  return {
    id: row.id,
    householdId: row.household_id,
    displayName: row.display_name,
    role: row.role,
    localDeviceId: row.local_device_id,
    createdAt: row.created_at,
  };
}

export async function getFirstMemberForHousehold(
  householdId: number,
): Promise<HouseholdMember | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<MemberRow>(
    'SELECT * FROM household_members WHERE household_id = ? ORDER BY id ASC LIMIT 1;',
    householdId,
  );
  return row ? rowToMember(row) : null;
}

export async function createMember(
  householdId: number,
  displayName: string,
  role: HouseholdRole,
  localDeviceId: number | null,
): Promise<HouseholdMember> {
  const db = await getDb();
  const now = nowIso();
  const result = await db.runAsync(
    `INSERT INTO household_members (household_id, display_name, role, local_device_id, created_at)
     VALUES (?, ?, ?, ?, ?);`,
    householdId,
    displayName,
    role,
    localDeviceId,
    now,
  );
  return {
    id: result.lastInsertRowId,
    householdId,
    displayName,
    role,
    localDeviceId,
    createdAt: now,
  };
}
