/**
 * After a successful Supabase sign-in we need to converge local
 * household state with whatever the user already has on the server:
 *
 *   - First-time sign-in (no remote household anywhere): create a
 *     remote household, create the owner membership, stamp the local
 *     `households.remote_id` and the local owner member's `remote_id`
 *     + `remote_user_id`.
 *   - Returning user (remote household already exists): hydrate. If
 *     the local household lacks `remote_id`, link the active local
 *     household to the existing remote one (no fresh "Shared
 *     household" shadow — we don't want to leave the user's local
 *     data on an orphan).
 *
 * The function is idempotent: re-running after a converged state is a
 * no-op that returns the existing context.
 *
 * Pure failures are surfaced as `{ ok: false, message }` results — the
 * caller (auth.tsx, app/_layout.tsx) decides whether to show an error
 * banner. Network/Supabase errors are logged with `[dwhi.household]`
 * but never bury behind a silent catch.
 */

import {
  findHouseholdByRemoteId,
  findMemberByRemoteUserId,
  setHouseholdRemoteId,
  setMemberRemoteIds,
  updateMemberRole,
} from '@/repositories/householdRepository';
import {
  getActiveContextOrNull,
  setActiveHouseholdContext,
} from '@/services/householdContext';
import { getCurrentSession } from '@/services/auth/authService';
import {
  createRemoteHousehold,
  getRemoteHouseholdById,
  listMembershipsForCurrentUser,
  type RemoteMembership,
} from '@/services/remote/householdsRemoteRepository';
import { switchActiveHouseholdToRemote } from '@/services/householdSwitch';
import type { ActiveHouseholdContext } from '@/types/models';

export type RemoteBootstrapAction =
  | 'noop-already-linked'
  | 'linked-existing'
  | 'created-new'
  | 'switched-to-existing'
  | 'unauthenticated'
  | 'unconfigured';

export interface RemoteBootstrapResult {
  ok: boolean;
  message: string;
  action: RemoteBootstrapAction;
  context?: ActiveHouseholdContext;
  /** Filled when we created a brand-new household this call. */
  createdRemoteHouseholdId?: string;
}

/** RFC4122 v4-ish UUID; matches the pattern used elsewhere in the app. */
function randomUuidV4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, ch => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function ownerDisplayNameForEmail(email: string | null | undefined): string {
  if (!email) return 'Me';
  const at = email.indexOf('@');
  if (at <= 0) return email;
  return email.slice(0, at);
}

/**
 * The main entry point. Safe to call any number of times.
 *
 * `expectAuthenticated`:
 *   - true  → returns `unauthenticated` (ok:false) if no session.
 *     Use this from the post-OTP-verify path where a session is
 *     mandatory.
 *   - false → returns `unauthenticated` (ok:true) if no session.
 *     Use this from cold-start bootstrap where local-only mode is fine.
 */
export async function ensureRemoteHousehold(
  options: { expectAuthenticated?: boolean } = {},
): Promise<RemoteBootstrapResult> {
  const session = await getCurrentSession();
  if (!session?.user?.id) {
    const ok = options.expectAuthenticated !== true;
    return {
      ok,
      message: ok
        ? 'Local-only: no Supabase session present.'
        : 'Sign in before linking a remote household.',
      action: 'unauthenticated',
    };
  }

  const ctx = getActiveContextOrNull();
  if (!ctx) {
    return {
      ok: false,
      message: 'Local household has not been bootstrapped yet.',
      action: 'unauthenticated',
    };
  }

  const userId = session.user.id;
  const ownerDisplayName = ownerDisplayNameForEmail(session.user.email);

  // Branch 1: the active local household is already linked to a remote
  // counterpart — just verify it still exists and refresh the local
  // shadow.
  if (ctx.household.remoteId) {
    console.log(
      `[dwhi.household] active household already linked (remoteId=${ctx.household.remoteId.slice(0, 8)}…)`,
    );
    const fetched = await getRemoteHouseholdById(ctx.household.remoteId);
    if (!fetched.ok) {
      return {
        ok: false,
        message: fetched.message,
        action: 'noop-already-linked',
      };
    }
    if (!fetched.data) {
      // The remote row disappeared (deleted, lost membership). Drop
      // the link so a re-run can either find a different household or
      // create a fresh one.
      console.warn(
        '[dwhi.household] linked remote_id is invisible — clearing local link',
      );
      // We don't actively scrub the local remote_id here — that's a
      // destructive operation on uncertain state. The caller can offer
      // a "create new" CTA from the Manage Household screen.
      return {
        ok: false,
        message:
          'Linked household is no longer visible. Create a new one or accept an invite.',
        action: 'noop-already-linked',
      };
    }
    await refreshLocalOwnerStamp(ctx, userId, ownerDisplayName);
    return {
      ok: true,
      message: 'Household already linked.',
      action: 'noop-already-linked',
      context: getActiveContextOrNull() ?? ctx,
    };
  }

  // Branch 2: not linked yet. See whether the user is already a member
  // of any household (e.g. they signed in on a second device, or
  // previously linked then re-installed).
  const memberships = await listMembershipsForCurrentUser();
  if (!memberships.ok) {
    return { ok: false, message: memberships.message, action: 'unauthenticated' };
  }
  const existing = pickMembership(memberships.data ?? []);

  if (existing) {
    console.log(
      `[dwhi.household] found existing membership (role=${existing.role}, household=${existing.householdId.slice(0, 8)}…)`,
    );
    return await linkOrSwitchToExistingHousehold(ctx, existing, userId);
  }

  // Branch 3: brand-new user. Create the remote household and link it
  // to the active local household.
  console.log('[dwhi.household] no existing memberships — creating remote household');
  const remoteHouseholdId = randomUuidV4();
  const created = await createRemoteHousehold({
    remoteHouseholdId,
    name: ctx.household.name,
    ownerDisplayName,
  });
  if (!created.ok || !created.data) {
    return {
      ok: false,
      message: created.message,
      action: 'created-new',
    };
  }
  await setHouseholdRemoteId(ctx.household.id, created.data.household.id);
  await setMemberRemoteIds(
    ctx.member.id,
    created.data.ownerMembership.id,
    userId,
  );
  if (ctx.member.role !== 'owner') {
    await updateMemberRole(ctx.member.id, 'owner');
  }
  const newCtx: ActiveHouseholdContext = {
    household: {
      ...ctx.household,
      remoteId: created.data.household.id,
    },
    member: {
      ...ctx.member,
      role: 'owner',
      remoteId: created.data.ownerMembership.id,
      remoteUserId: userId,
    },
    device: ctx.device,
  };
  setActiveHouseholdContext(newCtx);
  return {
    ok: true,
    message: 'Created and linked a new household.',
    action: 'created-new',
    context: newCtx,
    createdRemoteHouseholdId: created.data.household.id,
  };
}

/**
 * Multiple memberships are possible (the user joined several
 * households). Prefer one they own; fall back to the oldest member
 * row. The deterministic pick stops cold-start from oscillating
 * between households on re-runs.
 */
function pickMembership(memberships: RemoteMembership[]): RemoteMembership | null {
  if (memberships.length === 0) return null;
  const owners = memberships.filter(m => m.role === 'owner');
  const pool = owners.length > 0 ? owners : memberships;
  return [...pool].sort((a, b) =>
    a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0,
  )[0];
}

/**
 * Re-stamps the local owner's `remote_id` / `remote_user_id` if they're
 * still missing — protects against a half-completed earlier run where
 * the household got stamped but the member row didn't.
 */
async function refreshLocalOwnerStamp(
  ctx: ActiveHouseholdContext,
  userId: string,
  ownerDisplayName: string,
): Promise<void> {
  if (ctx.member.remoteUserId && ctx.member.remoteId) return;
  if (ctx.member.remoteUserId !== userId) {
    // Different user is now signed in on the same install. Don't
    // overwrite the existing local member row; the membership-driven
    // path will handle it on the next bootstrap call.
    console.warn(
      '[dwhi.household] active member.remoteUserId does not match session; leaving as-is',
    );
    return;
  }
  await setMemberRemoteIds(ctx.member.id, ctx.member.remoteId, userId);
  // Keep the display name only if the local one is the default "Me".
  if (ctx.member.displayName === 'Me' && ownerDisplayName !== 'Me') {
    // Display-name update is intentionally separate from the IDs
    // function so we don't accidentally overwrite a user-chosen name.
    // Out of scope for this branch; tracked for the next iteration.
  }
}

/**
 * Convert "active local household with no remote_id" + "existing remote
 * membership for this user" into a converged state. If the local
 * household has never been remote-linked, we attach it; otherwise we
 * fall back to creating a fresh shadow via the existing
 * `switchActiveHouseholdToRemote` helper (same path invites use).
 */
async function linkOrSwitchToExistingHousehold(
  ctx: ActiveHouseholdContext,
  membership: RemoteMembership,
  userId: string,
): Promise<RemoteBootstrapResult> {
  // First, see whether the active local household is already a shadow
  // (some past partial bootstrap left it linked). If so, the
  // remoteId-is-null branch above shouldn't have run — but cover it.
  const existingShadow = await findHouseholdByRemoteId(membership.householdId);

  // Case A: the active local household has no remote link, AND no
  // shadow exists for this remote. Adopt it: stamp the existing local
  // household with the remote_id so the user's local-only data carries
  // over.
  if (!existingShadow) {
    await setHouseholdRemoteId(ctx.household.id, membership.householdId);
    // Ensure the local member row carries remote ids + role.
    const existingMember = await findMemberByRemoteUserId(
      ctx.household.id,
      userId,
    );
    if (existingMember) {
      await setMemberRemoteIds(
        existingMember.id,
        membership.id,
        userId,
      );
      if (existingMember.role !== membership.role) {
        await updateMemberRole(existingMember.id, membership.role);
      }
    } else {
      // The local "Me" member predates remote linking; stamp it.
      await setMemberRemoteIds(ctx.member.id, membership.id, userId);
      if (ctx.member.role !== membership.role) {
        await updateMemberRole(ctx.member.id, membership.role);
      }
    }
    const newCtx: ActiveHouseholdContext = {
      household: {
        ...ctx.household,
        remoteId: membership.householdId,
      },
      member: {
        ...ctx.member,
        role: membership.role,
        remoteId: membership.id,
        remoteUserId: userId,
      },
      device: ctx.device,
    };
    setActiveHouseholdContext(newCtx);
    console.log('[dwhi.household] linked existing local household to remote');
    return {
      ok: true,
      message: 'Linked to existing remote household.',
      action: 'linked-existing',
      context: newCtx,
    };
  }

  // Case B: a shadow already exists locally for this remote household
  // (the user previously joined via invite, then somehow lost focus).
  // Switch to it; do not silently merge.
  console.log(
    '[dwhi.household] existing local shadow found — switching active household',
  );
  const switched = await switchActiveHouseholdToRemote({
    remoteHouseholdId: membership.householdId,
    memberDisplayName: membership.displayName,
    remoteUserId: userId,
    remoteMemberId: membership.id,
  });
  return {
    ok: true,
    message: 'Switched to existing household.',
    action: 'switched-to-existing',
    context: switched,
  };
}
