/**
 * Supabase-side invite operations. The local schema doesn't mirror the
 * invites table — they're a remote-only concept — so this module talks
 * directly to Supabase.
 *
 * Every function returns `null` / a friendly error when the client isn't
 * configured, so the rest of the app keeps working in Local-only mode.
 */

import { getSupabaseClient } from '../supabaseClient';

export interface RemoteInvite {
  id: string;
  householdId: string;
  inviteCode: string;
  createdByMemberId: string | null;
  acceptedByUserId: string | null;
  acceptedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InviteOpResult<T = void> {
  ok: boolean;
  message: string;
  data?: T;
}

// ---------------------------------------------------------------------------
// Invite code generation
// ---------------------------------------------------------------------------

/**
 * 12-char base32-ish code (excludes confusable chars like 0/O, 1/I).
 * Generated client-side; the UNIQUE constraint in Postgres catches the
 * astronomically rare collision.
 */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 12;

export function generateInviteCode(): string {
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

/** Normalize a user-typed code: trim, uppercase, drop separators. */
export function normalizeInviteCode(input: string): string {
  return (input || '').toUpperCase().replace(/[\s\-_]+/g, '');
}

// ---------------------------------------------------------------------------
// Row mapping
// ---------------------------------------------------------------------------

interface InviteRow {
  id: string;
  household_id: string;
  invite_code: string;
  created_by_member_id: string | null;
  accepted_by_user_id: string | null;
  accepted_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
}

function rowToInvite(row: InviteRow): RemoteInvite {
  return {
    id: row.id,
    householdId: row.household_id,
    inviteCode: row.invite_code,
    createdByMemberId: row.created_by_member_id,
    acceptedByUserId: row.accepted_by_user_id,
    acceptedAt: row.accepted_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function unconfigured<T = void>(): InviteOpResult<T> {
  return { ok: false, message: 'Supabase is not configured.' };
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export interface CreateInviteInput {
  remoteHouseholdId: string;
  remoteCreatorMemberId?: string | null;
  /** Optional ISO timestamp. Null = never expires (until revoked). */
  expiresAt?: string | null;
}

export async function createInvite(
  input: CreateInviteInput,
): Promise<InviteOpResult<RemoteInvite>> {
  const client = getSupabaseClient();
  if (!client) return unconfigured<RemoteInvite>();
  const code = generateInviteCode();
  const { data, error } = await client
    .from('household_invites')
    .insert({
      household_id: input.remoteHouseholdId,
      invite_code: code,
      created_by_member_id: input.remoteCreatorMemberId ?? null,
      expires_at: input.expiresAt ?? null,
    })
    .select('*')
    .single<InviteRow>();
  if (error) return { ok: false, message: error.message };
  return {
    ok: true,
    message: `Invite created: ${code}`,
    data: rowToInvite(data),
  };
}

export async function listInvitesForHousehold(
  remoteHouseholdId: string,
): Promise<InviteOpResult<RemoteInvite[]>> {
  const client = getSupabaseClient();
  if (!client) return unconfigured<RemoteInvite[]>();
  const { data, error } = await client
    .from('household_invites')
    .select('*')
    .eq('household_id', remoteHouseholdId)
    .order('created_at', { ascending: false })
    .returns<InviteRow[]>();
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: 'ok', data: data.map(rowToInvite) };
}

/**
 * Fetch a single invite by user-typed code. Used by the Join Household
 * flow to look up the household before accepting.
 */
export async function findInviteByCode(
  rawCode: string,
): Promise<InviteOpResult<RemoteInvite | null>> {
  const client = getSupabaseClient();
  if (!client) return unconfigured<RemoteInvite | null>();
  const code = normalizeInviteCode(rawCode);
  if (!code) return { ok: false, message: 'Invite code is required.' };
  const { data, error } = await client
    .from('household_invites')
    .select('*')
    .eq('invite_code', code)
    .maybeSingle<InviteRow>();
  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: true, message: 'No invite matches that code.', data: null };
  return { ok: true, message: 'ok', data: rowToInvite(data) };
}

/**
 * Validates an invite client-side. The remote RLS policy enforces the same
 * predicates as a defence in depth, but failing fast here gives the user
 * a useful error.
 */
export type InviteValidationError =
  | 'not_found'
  | 'already_accepted'
  | 'revoked'
  | 'expired';

export function validateInvite(
  invite: RemoteInvite | null,
  now = Date.now(),
): InviteValidationError | null {
  if (!invite) return 'not_found';
  if (invite.acceptedByUserId) return 'already_accepted';
  if (invite.revokedAt) return 'revoked';
  if (invite.expiresAt) {
    const exp = Date.parse(invite.expiresAt);
    if (!Number.isNaN(exp) && exp < now) return 'expired';
  }
  return null;
}

export interface AcceptInviteResult {
  invite: RemoteInvite;
  /** The household_members.id created for this user, if RLS allowed it. */
  newMemberId: string | null;
}

/**
 * Accepts an invite. Performs:
 *   1. validate (client-side guard)
 *   2. INSERT household_members for auth.uid()
 *   3. UPDATE the invite (accepted_by_user_id, accepted_at)
 * Each step is wrapped: a failure at (2) doesn't leave a stale accepted
 * invite, and a failure at (3) still leaves the user as a member.
 */
export async function acceptInvite(
  invite: RemoteInvite,
  displayName: string,
): Promise<InviteOpResult<AcceptInviteResult>> {
  const client = getSupabaseClient();
  if (!client) return unconfigured<AcceptInviteResult>();

  const validation = validateInvite(invite);
  if (validation) {
    return { ok: false, message: invalidInviteMessage(validation) };
  }

  const { data: sessionRes } = await client.auth.getSession();
  const userId = sessionRes?.session?.user?.id;
  if (!userId) return { ok: false, message: 'Sign in before accepting an invite.' };

  // 2. INSERT a household_members row for this user. RLS only lets the
  //    user insert their own membership.
  const { data: memberRow, error: memberErr } = await client
    .from('household_members')
    .insert({
      household_id: invite.householdId,
      user_id: userId,
      display_name: displayName.trim() || 'Member',
      role: 'member',
    })
    .select('id')
    .single<{ id: string }>();
  if (memberErr) {
    // 23505 = unique violation — already a member; treat as success-ish.
    const alreadyMember = memberErr.code === '23505';
    if (!alreadyMember) return { ok: false, message: memberErr.message };
  }

  // 3. Mark the invite accepted. RLS allows the invitee to do this iff the
  //    invite is still unaccepted/unrevoked/unexpired.
  const { data: updated, error: updateErr } = await client
    .from('household_invites')
    .update({ accepted_by_user_id: userId, accepted_at: new Date().toISOString() })
    .eq('id', invite.id)
    .select('*')
    .single<InviteRow>();
  if (updateErr) {
    return { ok: false, message: `Joined, but couldn't mark invite accepted: ${updateErr.message}` };
  }

  return {
    ok: true,
    message: 'Joined household.',
    data: { invite: rowToInvite(updated), newMemberId: memberRow?.id ?? null },
  };
}

export async function revokeInvite(
  remoteInviteId: string,
): Promise<InviteOpResult<RemoteInvite>> {
  const client = getSupabaseClient();
  if (!client) return unconfigured<RemoteInvite>();
  const { data, error } = await client
    .from('household_invites')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', remoteInviteId)
    .select('*')
    .single<InviteRow>();
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: 'Invite revoked.', data: rowToInvite(data) };
}

function invalidInviteMessage(kind: InviteValidationError): string {
  switch (kind) {
    case 'not_found':
      return 'No invite matches that code.';
    case 'already_accepted':
      return 'That invite has already been used.';
    case 'revoked':
      return 'That invite was revoked by the household owner.';
    case 'expired':
      return 'That invite has expired.';
  }
}
