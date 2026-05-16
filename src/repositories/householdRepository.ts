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
  remote_id: string | null;
}

function rowToHousehold(row: HouseholdRow): Household {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    remoteId: row.remote_id,
  };
}

export async function getFirstHousehold(): Promise<Household | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<HouseholdRow>(
    'SELECT * FROM households ORDER BY id ASC LIMIT 1;',
  );
  return row ? rowToHousehold(row) : null;
}

export async function getHouseholdById(id: number): Promise<Household | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<HouseholdRow>(
    'SELECT * FROM households WHERE id = ? LIMIT 1;',
    id,
  );
  return row ? rowToHousehold(row) : null;
}

export async function findHouseholdByRemoteId(
  remoteId: string,
): Promise<Household | null> {
  if (!remoteId) return null;
  const db = await getDb();
  const row = await db.getFirstAsync<HouseholdRow>(
    'SELECT * FROM households WHERE remote_id = ? LIMIT 1;',
    remoteId,
  );
  return row ? rowToHousehold(row) : null;
}

export async function createHousehold(
  name: string,
  remoteId: string | null = null,
): Promise<Household> {
  const db = await getDb();
  const now = nowIso();
  const result = await db.runAsync(
    'INSERT INTO households (name, created_at, updated_at, remote_id) VALUES (?, ?, ?, ?);',
    name,
    now,
    now,
    remoteId,
  );
  return {
    id: result.lastInsertRowId,
    name,
    createdAt: now,
    updatedAt: now,
    remoteId,
  };
}

export async function setHouseholdRemoteId(
  localId: number,
  remoteId: string,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE households SET remote_id = ?, updated_at = ? WHERE id = ?;',
    remoteId,
    nowIso(),
    localId,
  );
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
  remote_id: string | null;
  remote_user_id: string | null;
}

function rowToMember(row: MemberRow): HouseholdMember {
  return {
    id: row.id,
    householdId: row.household_id,
    displayName: row.display_name,
    role: row.role,
    localDeviceId: row.local_device_id,
    createdAt: row.created_at,
    remoteId: row.remote_id,
    remoteUserId: row.remote_user_id,
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
  remoteId: string | null = null,
  remoteUserId: string | null = null,
): Promise<HouseholdMember> {
  const db = await getDb();
  const now = nowIso();
  const result = await db.runAsync(
    `INSERT INTO household_members
       (household_id, display_name, role, local_device_id, created_at, remote_id, remote_user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?);`,
    householdId,
    displayName,
    role,
    localDeviceId,
    now,
    remoteId,
    remoteUserId,
  );
  return {
    id: result.lastInsertRowId,
    householdId,
    displayName,
    role,
    localDeviceId,
    createdAt: now,
    remoteId,
    remoteUserId,
  };
}
