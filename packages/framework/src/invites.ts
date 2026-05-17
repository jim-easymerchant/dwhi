/**
 * Remote household membership + invite operations. Codes are 12-char
 * base32-ish strings; invite acceptance produces the membership row
 * the active-context plumbing then mirrors locally.
 */
export {
  acceptInvite,
  createInvite,
  findInviteByCode,
  generateInviteCode,
  listInvitesForHousehold,
  normalizeInviteCode,
  revokeInvite,
  validateInvite,
  type AcceptInviteResult,
  type CreateInviteInput,
  type InviteOpResult,
  type InviteValidationError,
  type RemoteInvite,
} from '@/services/remote/householdInvitesRemoteRepository';
export {
  listMembersForHousehold,
  removeMember,
  type RemoteMember,
  type RemoteMemberOpResult,
} from '@/services/remote/householdMembersRemoteRepository';
