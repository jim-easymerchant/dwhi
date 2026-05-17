/**
 * Local household state: bootstrap, active-context singleton, switching
 * to a remote household, and the local CRUD repo. Designed to be the
 * one piece of scope plumbing every app in the monorepo shares.
 */
export {
  bootstrapHousehold,
} from '@/services/householdBootstrap';
export {
  clearActiveHouseholdContext,
  getActiveContextOrNull,
  getActiveDeviceId,
  getActiveHouseholdId,
  getActiveMemberId,
  getActiveScope,
  setActiveHouseholdContext,
  setActiveHouseholdContextForTests,
} from '@/services/householdContext';
export {
  switchActiveHouseholdToRemote,
  type SwitchInput,
} from '@/services/householdSwitch';
export {
  createDevice,
  createHousehold,
  createMember,
  findHouseholdByRemoteId,
  getFirstDeviceForHousehold,
  getFirstHousehold,
  getFirstMemberForHousehold,
  getHouseholdById,
  setHouseholdRemoteId,
  touchDeviceLastSeen,
} from '@/repositories/householdRepository';
