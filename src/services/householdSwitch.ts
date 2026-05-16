/**
 * After an invite is accepted on the remote side, we still need to make
 * the joined household the *active* local scope so subsequent local-only
 * writes go to the right place. This service handles the local shadow:
 *
 *   1. Find or create a local `households` row carrying the joined
 *      remote_id.
 *   2. Find or create a local `household_members` row for the signed-in
 *      user (so the engine can stamp created_by_member_id with a real
 *      local id).
 *   3. Reuse the existing local device (this branch supports one device
 *      per install).
 *   4. Persist the choice via app_prefs so the next cold start picks the
 *      joined household.
 *   5. Publish the new scope to `householdContext`.
 *
 * Existing local data attached to the previous household is NOT touched —
 * the spec says "switch active household only; do not merge local data
 * yet."
 */

import {
  createHousehold,
  createMember,
  findHouseholdByRemoteId,
  getFirstDeviceForHousehold,
  setHouseholdRemoteId,
} from '@/repositories/householdRepository';
import { setActiveHouseholdPref } from '@/repositories/appPrefsRepository';
import { setActiveHouseholdContext } from './householdContext';
import { getDb } from '@/db/database';
import type {
  ActiveHouseholdContext,
  HouseholdMember,
} from '@/types/models';

export interface SwitchInput {
  remoteHouseholdId: string;
  /** Name to show in the local UI. Defaults to "Shared household". */
  remoteHouseholdName?: string | null;
  /** Display name for the new local member row. */
  memberDisplayName: string;
  /** Supabase auth user id to stamp on the local member row. */
  remoteUserId: string;
  /** Supabase household_members.id, if known yet. */
  remoteMemberId?: string | null;
}

export async function switchActiveHouseholdToRemote(
  input: SwitchInput,
): Promise<ActiveHouseholdContext> {
  // 1. Local household row mirroring the remote.
  let household = await findHouseholdByRemoteId(input.remoteHouseholdId);
  if (!household) {
    household = await createHousehold(
      input.remoteHouseholdName?.trim() || 'Shared household',
      input.remoteHouseholdId,
    );
  } else if (!household.remoteId) {
    await setHouseholdRemoteId(household.id, input.remoteHouseholdId);
    household = { ...household, remoteId: input.remoteHouseholdId };
  }

  // 2. Local member row for this user in this household.
  let member = await findLocalMemberByRemoteUserId(
    household.id,
    input.remoteUserId,
  );
  if (!member) {
    member = await createMember(
      household.id,
      input.memberDisplayName.trim() || 'Me',
      'member',
      null,
      input.remoteMemberId ?? null,
      input.remoteUserId,
    );
  }

  // 3. Reuse / create a local device row for this household.
  let device = await getFirstDeviceForHousehold(household.id);
  if (!device) {
    // Borrow the existing device row from the previous household so we
    // don't accumulate one ghost device row per join. The bootstrap will
    // re-touch last_seen_at on next launch.
    const db = await getDb();
    const anyDevice = await db.getFirstAsync<{
      id: number;
      household_id: number;
      device_name: string;
      device_uuid: string;
      created_at: string;
      last_seen_at: string;
    }>('SELECT * FROM devices ORDER BY id ASC LIMIT 1;');
    if (anyDevice) {
      device = {
        id: anyDevice.id,
        householdId: anyDevice.household_id,
        deviceName: anyDevice.device_name,
        deviceUuid: anyDevice.device_uuid,
        createdAt: anyDevice.created_at,
        lastSeenAt: anyDevice.last_seen_at,
      };
    } else {
      // Should never happen — householdBootstrap creates this on first
      // launch — but stay safe.
      throw new Error('No local device row exists yet; bootstrap must run first.');
    }
  }

  // 4. Persist the choice so the next bootstrap picks this household.
  await setActiveHouseholdPref(household.id);

  // 5. Publish to the runtime singleton.
  const ctx: ActiveHouseholdContext = { household, member, device };
  setActiveHouseholdContext(ctx);
  return ctx;
}

async function findLocalMemberByRemoteUserId(
  householdId: number,
  remoteUserId: string,
): Promise<HouseholdMember | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{
    id: number;
    household_id: number;
    display_name: string;
    role: 'owner' | 'member';
    local_device_id: number | null;
    created_at: string;
    remote_id: string | null;
    remote_user_id: string | null;
  }>(
    `SELECT * FROM household_members
      WHERE household_id = ? AND remote_user_id = ?
      LIMIT 1;`,
    householdId,
    remoteUserId,
  );
  if (!row) return null;
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
