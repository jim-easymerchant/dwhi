/**
 * Supabase-side household member operations: list the people in a
 * household, and remove a non-owner member (soft-delete via deleted_at).
 *
 * The local schema mirrors household_members but only stores the rows for
 * the active local household. The "Manage Household" screen reads from
 * the remote source of truth so newly-added members on another device
 * show up after a manual refresh.
 */

import { getSupabaseClient } from '../supabaseClient';
import type { HouseholdRole } from '@/types/models';

export interface RemoteMember {
  id: string;
  householdId: string;
  userId: string | null;
  displayName: string;
  role: HouseholdRole;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  /** True iff the row's user_id matches the signed-in auth user. */
  isMe: boolean;
}

export interface RemoteMemberOpResult<T = void> {
  ok: boolean;
  message: string;
  data?: T;
}

interface MemberRow {
  id: string;
  household_id: string;
  user_id: string | null;
  display_name: string;
  role: HouseholdRole;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

function unconfigured<T = void>(): RemoteMemberOpResult<T> {
  return { ok: false, message: 'Supabase is not configured.' };
}

function rowToMember(row: MemberRow, currentUserId: string | null): RemoteMember {
  return {
    id: row.id,
    householdId: row.household_id,
    userId: row.user_id,
    displayName: row.display_name,
    role: row.role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    isMe: !!row.user_id && row.user_id === currentUserId,
  };
}

export async function listMembersForHousehold(
  remoteHouseholdId: string,
): Promise<RemoteMemberOpResult<RemoteMember[]>> {
  const client = getSupabaseClient();
  if (!client) return unconfigured<RemoteMember[]>();
  const { data: sessionRes } = await client.auth.getSession();
  const userId = sessionRes?.session?.user?.id ?? null;

  const { data, error } = await client
    .from('household_members')
    .select('*')
    .eq('household_id', remoteHouseholdId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .returns<MemberRow[]>();
  if (error) return { ok: false, message: error.message };
  return {
    ok: true,
    message: 'ok',
    data: data.map(r => rowToMember(r, userId)),
  };
}

/**
 * Soft-delete a member by stamping deleted_at. RLS guards the operation:
 *   - The owner can remove any non-owner member.
 *   - A member can remove themselves (used for "leave household").
 *   - Neither can remove the last owner; we also guard client-side.
 */
export async function removeMember(
  member: RemoteMember,
  allMembers: RemoteMember[],
): Promise<RemoteMemberOpResult> {
  const client = getSupabaseClient();
  if (!client) return unconfigured();
  if (member.role === 'owner') {
    const otherOwners = allMembers.filter(
      m => m.role === 'owner' && m.id !== member.id && !m.deletedAt,
    );
    if (otherOwners.length === 0) {
      return {
        ok: false,
        message:
          "Can't remove the last owner. Promote another member to owner first.",
      };
    }
  }
  const { error } = await client
    .from('household_members')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', member.id);
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: `${member.displayName} removed.` };
}
