/**
 * Supabase-side household + ownership operations.
 *
 * `householdMembersRemoteRepository` already handles "list members for a
 * household" and "remove a member". This module covers the missing
 * ground: actually creating a remote household, finding the one(s) the
 * signed-in user owns or belongs to, and provisioning the owner
 * membership row in the same round-trip-ish flow.
 *
 * Every function short-circuits to a clear `unconfigured` failure when
 * the Supabase client is null so the rest of the app stays usable in
 * Local-only mode.
 */

import type { HouseholdRole } from '@/types/models';
import { getSupabaseClient } from '../supabaseClient';

export interface RemoteHouseholdOpResult<T = void> {
  ok: boolean;
  message: string;
  data?: T;
}

export interface RemoteHousehold {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface RemoteMembership {
  /** household_members.id */
  id: string;
  householdId: string;
  /** The auth user this row belongs to. */
  userId: string | null;
  displayName: string;
  role: HouseholdRole;
  createdAt: string;
}

interface HouseholdRow {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface MembershipRow {
  id: string;
  household_id: string;
  user_id: string | null;
  display_name: string;
  role: HouseholdRole;
  created_at: string;
  deleted_at: string | null;
}

function unconfigured<T = void>(): RemoteHouseholdOpResult<T> {
  return { ok: false, message: 'Supabase is not configured.' };
}

function rowToHousehold(row: HouseholdRow): RemoteHousehold {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function rowToMembership(row: MembershipRow): RemoteMembership {
  return {
    id: row.id,
    householdId: row.household_id,
    userId: row.user_id,
    displayName: row.display_name,
    role: row.role,
    createdAt: row.created_at,
  };
}

/**
 * Lists every household the signed-in user is an active member of.
 * Returns memberships rather than households because the role is what
 * the bootstrap actually needs.
 */
export async function listMembershipsForCurrentUser(): Promise<
  RemoteHouseholdOpResult<RemoteMembership[]>
> {
  const client = getSupabaseClient();
  if (!client) return unconfigured<RemoteMembership[]>();
  const { data: sessionRes } = await client.auth.getSession();
  const userId = sessionRes?.session?.user?.id;
  if (!userId) {
    return { ok: false, message: 'Sign in before reading memberships.' };
  }
  const { data, error } = await client
    .from('household_members')
    .select('id, household_id, user_id, display_name, role, created_at, deleted_at')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .returns<MembershipRow[]>();
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: 'ok', data: data.map(rowToMembership) };
}

/**
 * Fetches a single remote household by UUID. Returns `data: null` when
 * the row exists but is invisible under RLS — the caller should treat
 * "ok with null data" as "doesn't exist for you" rather than an error.
 */
export async function getRemoteHouseholdById(
  remoteId: string,
): Promise<RemoteHouseholdOpResult<RemoteHousehold | null>> {
  const client = getSupabaseClient();
  if (!client) return unconfigured<RemoteHousehold | null>();
  if (!remoteId) {
    return { ok: false, message: 'Remote household id is required.' };
  }
  const { data, error } = await client
    .from('households')
    .select('*')
    .eq('id', remoteId)
    .is('deleted_at', null)
    .maybeSingle<HouseholdRow>();
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: 'ok', data: data ? rowToHousehold(data) : null };
}

export interface CreateRemoteHouseholdInput {
  /**
   * Pre-generated UUID supplied by the caller. We do this client-side
   * because the household INSERT can't be combined with `.select('*')`
   * — the user isn't a member yet at that exact moment, so SELECT under
   * RLS would return nothing. Knowing the id ahead of time lets us
   * INSERT the membership row and *then* fetch the household.
   */
  remoteHouseholdId: string;
  /** Display name to show in the UI. */
  name: string;
  /** Display name to stamp on the owner's `household_members` row. */
  ownerDisplayName: string;
}

export interface CreateRemoteHouseholdResult {
  household: RemoteHousehold;
  ownerMembership: RemoteMembership;
}

/**
 * Creates a remote household and the auth user's owner membership row.
 *
 *   1. INSERT households(id, name) — allowed for any authenticated user
 *      by `households_insert` policy (auth.uid() IS NOT NULL).
 *   2. INSERT household_members(household_id, user_id, role='owner').
 *      The `household_members_insert` policy permits a user to insert
 *      their own membership.
 *   3. SELECT the household — now visible under RLS because the user is
 *      a member.
 *
 * If step 2 fails we don't try to roll back step 1: the orphan row is
 * invisible to everyone (no membership = no RLS read access) and a
 * future operator-side cleanup can drop it. Surfacing the failure to
 * the caller is more important than perfect transactionality at this
 * stage.
 */
export async function createRemoteHousehold(
  input: CreateRemoteHouseholdInput,
): Promise<RemoteHouseholdOpResult<CreateRemoteHouseholdResult>> {
  const client = getSupabaseClient();
  if (!client) return unconfigured<CreateRemoteHouseholdResult>();
  const { data: sessionRes } = await client.auth.getSession();
  const userId = sessionRes?.session?.user?.id;
  if (!userId) {
    return {
      ok: false,
      message: 'Sign in before creating a household.',
    };
  }
  const trimmedName = input.name.trim() || 'My Household';
  const trimmedOwner = input.ownerDisplayName.trim() || 'Me';

  console.log(
    `[dwhi.household] creating remote household (name-len=${trimmedName.length}, owner-len=${trimmedOwner.length})`,
  );

  // 1. Insert the household row. We do not .select() here — RLS would
  //    refuse the implicit read because we're not yet a member.
  const { error: hhErr } = await client.from('households').insert({
    id: input.remoteHouseholdId,
    name: trimmedName,
  });
  if (hhErr) {
    console.warn(
      `[dwhi.household] households INSERT failed: ${hhErr.message}`,
    );
    return { ok: false, message: hhErr.message };
  }

  // 2. Insert the owner membership row for this user.
  const { data: memberRow, error: memberErr } = await client
    .from('household_members')
    .insert({
      household_id: input.remoteHouseholdId,
      user_id: userId,
      display_name: trimmedOwner,
      role: 'owner' satisfies HouseholdRole,
    })
    .select('id, household_id, user_id, display_name, role, created_at, deleted_at')
    .single<MembershipRow>();
  if (memberErr || !memberRow) {
    console.warn(
      `[dwhi.household] owner membership INSERT failed: ${memberErr?.message ?? 'no row returned'}`,
    );
    return {
      ok: false,
      message: memberErr?.message ?? 'Could not create owner membership.',
    };
  }

  // 3. Fetch the household back now that RLS will let us see it.
  const fetched = await getRemoteHouseholdById(input.remoteHouseholdId);
  if (!fetched.ok || !fetched.data) {
    console.warn(
      `[dwhi.household] post-create household fetch failed: ${fetched.message}`,
    );
    return {
      ok: false,
      message: fetched.message || 'Household created but not visible yet.',
    };
  }
  console.log(
    `[dwhi.household] remote household created (membership=${memberRow.id})`,
  );
  return {
    ok: true,
    message: 'Remote household created.',
    data: {
      household: fetched.data,
      ownerMembership: rowToMembership(memberRow),
    },
  };
}
