/**
 * In-memory holder for the active household / member / device IDs. Set once
 * at app start by `householdBootstrap` and read by every repository when it
 * scopes SELECTs / stamps INSERTs.
 *
 * Why a module-level singleton rather than React context?
 *   - Repositories live outside the React tree.
 *   - Tests can override via `setActiveHouseholdContextForTests` without
 *     mounting a provider.
 *   - The fallback values (1, 1, 1) line up with what the bootstrap
 *     creates on a fresh install, so tests that don't initialize the
 *     context see consistent IDs.
 *
 * The cloud-sync story (NOT IMPLEMENTED): this same shape is the
 * authoritative "current scope" — a sync layer would simply call
 * `setActiveHouseholdContext` when the user switches households on a
 * shared device.
 */

import type { ActiveHouseholdContext } from '@/types/models';

interface ActiveScope {
  householdId: number;
  memberId: number;
  deviceId: number;
}

const DEFAULT_FALLBACK: ActiveScope = {
  householdId: 1,
  memberId: 1,
  deviceId: 1,
};

let active: ActiveScope | null = null;
let activeContext: ActiveHouseholdContext | null = null;

export function setActiveHouseholdContext(ctx: ActiveHouseholdContext): void {
  activeContext = ctx;
  active = {
    householdId: ctx.household.id,
    memberId: ctx.member.id,
    deviceId: ctx.device.id,
  };
}

export function clearActiveHouseholdContext(): void {
  active = null;
  activeContext = null;
}

/** Last set rich context for diagnostics; null until bootstrap finishes. */
export function getActiveContextOrNull(): ActiveHouseholdContext | null {
  return activeContext;
}

export function getActiveScope(): ActiveScope {
  return active ?? DEFAULT_FALLBACK;
}

export function getActiveHouseholdId(): number {
  return getActiveScope().householdId;
}

export function getActiveMemberId(): number {
  return getActiveScope().memberId;
}

export function getActiveDeviceId(): number {
  return getActiveScope().deviceId;
}

// Test-friendly seam (deliberately named so it stands out in grep).
export function setActiveHouseholdContextForTests(scope: Partial<ActiveScope>): void {
  active = { ...DEFAULT_FALLBACK, ...scope };
}
