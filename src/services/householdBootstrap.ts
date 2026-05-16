/**
 * One-shot bootstrap that guarantees the local household scope is wired up
 * after schema migrations. Idempotent — safe to call on every app start.
 *
 *   1. Ensure exactly one "My Household" exists.
 *   2. Ensure this device has a row in `devices`; if so, touch last_seen_at.
 *   3. Ensure the household has at least one member (the local user).
 *   4. Backfill any pre-existing rows (created before this branch) with the
 *      default household / member / device IDs so they don't disappear when
 *      repos start scoping their SELECTs.
 *   5. Publish the scope to `householdContext` so subsequent repo calls see
 *      the right IDs without any caller wiring.
 *
 * No network, no auth, no sync — only the local SQLite store is touched.
 */

import { columnExists, getDb } from '@/db/database';
import {
  createDevice,
  createHousehold,
  createMember,
  getFirstDeviceForHousehold,
  getFirstHousehold,
  getFirstMemberForHousehold,
  touchDeviceLastSeen,
} from '@/repositories/householdRepository';
import { setActiveHouseholdContext } from './householdContext';
import type { ActiveHouseholdContext } from '@/types/models';

const DEFAULT_HOUSEHOLD_NAME = 'My Household';
const DEFAULT_MEMBER_NAME = 'Me';
const DEFAULT_DEVICE_NAME = 'This device';

/** RFC4122 v4 UUID without an extra native dep. POC-grade, not cryptographic. */
function randomUuidV4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, ch => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function bootstrapHousehold(): Promise<ActiveHouseholdContext> {
  // 1. Default household
  let household = await getFirstHousehold();
  if (!household) {
    household = await createHousehold(DEFAULT_HOUSEHOLD_NAME);
  }

  // 2. Default device. The DB is per-install so "first device row" == this one.
  let device = await getFirstDeviceForHousehold(household.id);
  if (!device) {
    device = await createDevice(household.id, DEFAULT_DEVICE_NAME, randomUuidV4());
  } else {
    await touchDeviceLastSeen(device.id);
    device = { ...device, lastSeenAt: new Date().toISOString() };
  }

  // 3. Default member
  let member = await getFirstMemberForHousehold(household.id);
  if (!member) {
    member = await createMember(household.id, DEFAULT_MEMBER_NAME, 'owner', device.id);
  }

  // 4. Backfill any pre-existing rows that don't yet carry household scope.
  //    Each statement is conditional on household_id IS NULL so re-runs are
  //    no-ops on a clean DB.
  await backfillHouseholdScope(household.id, member.id, device.id);

  // 5. Publish to the runtime singleton the repositories read from.
  const ctx: ActiveHouseholdContext = { household, member, device };
  setActiveHouseholdContext(ctx);
  return ctx;
}

async function backfillHouseholdScope(
  householdId: number,
  memberId: number,
  deviceId: number,
): Promise<void> {
  // Belt-and-braces: every UPDATE references a column the migration was
  // supposed to add. If migration ran successfully the columns exist, but
  // we PRAGMA-check anyway so a partial migration doesn't crash the whole
  // bootstrap.
  await runIfColumn('items', 'household_id', async db => {
    await db.runAsync(
      'UPDATE items SET household_id = ? WHERE household_id IS NULL;',
      householdId,
    );
  });

  await runIfColumn('inventory_events', 'household_id', async db => {
    await db.runAsync(
      `UPDATE inventory_events
          SET household_id = ?,
              created_by_member_id = COALESCE(created_by_member_id, ?),
              created_by_device_id = COALESCE(created_by_device_id, ?)
        WHERE household_id IS NULL;`,
      householdId,
      memberId,
      deviceId,
    );
  });

  await runIfColumn('receipts', 'household_id', async db => {
    await db.runAsync(
      `UPDATE receipts
          SET household_id = ?,
              created_by_member_id = COALESCE(created_by_member_id, ?),
              created_by_device_id = COALESCE(created_by_device_id, ?)
        WHERE household_id IS NULL;`,
      householdId,
      memberId,
      deviceId,
    );
  });

  await runIfColumn('receipt_items', 'household_id', async db => {
    await db.runAsync(
      'UPDATE receipt_items SET household_id = ? WHERE household_id IS NULL;',
      householdId,
    );
  });

  await runIfColumn('ask_history', 'household_id', async db => {
    await db.runAsync(
      `UPDATE ask_history
          SET household_id = ?,
              created_by_member_id = COALESCE(created_by_member_id, ?),
              created_by_device_id = COALESCE(created_by_device_id, ?)
        WHERE household_id IS NULL;`,
      householdId,
      memberId,
      deviceId,
    );
  });

  await runIfColumn('ask_feedback', 'household_id', async db => {
    await db.runAsync(
      `UPDATE ask_feedback
          SET household_id = ?,
              created_by_member_id = COALESCE(created_by_member_id, ?),
              created_by_device_id = COALESCE(created_by_device_id, ?)
        WHERE household_id IS NULL;`,
      householdId,
      memberId,
      deviceId,
    );
  });
}

async function runIfColumn(
  table: string,
  column: string,
  fn: (db: Awaited<ReturnType<typeof getDb>>) => Promise<void>,
): Promise<void> {
  if (!(await columnExists(table, column))) {
    console.warn(
      `[dwhi] backfill skipped: ${table}.${column} missing — migration may have been incomplete.`,
    );
    return;
  }
  const db = await getDb();
  await fn(db);
}
