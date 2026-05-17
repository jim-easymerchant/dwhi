/**
 * @dwhi/framework
 *
 * The cross-app reusable surface. Anything that another app in this
 * monorepo (e.g. the future workout/RPG app) should be able to pick up
 * without copying lives here.
 *
 * Today the implementation files are still rooted at the repo's `src/`
 * directory; this package is a barrel layer that fixes the public
 * import shape so the physical move can happen in a follow-up branch
 * without breaking consumers. See MONOREPO.md for the migration plan.
 *
 * Each sub-module is also re-exportable directly so consumers can keep
 * imports narrow:
 *
 *   import { verifyEmailOtp } from '@dwhi/framework/auth';
 *   import { getActiveHouseholdId } from '@dwhi/framework/households';
 *
 * The root barrel re-exports everything for the "I just want one
 * import" case.
 */
export * from './auth';
export * from './db';
export * from './env';
export * from './households';
export * from './invites';
export * from './location';
export * from './storage';
export * from './supabase';
export * from './sync';
export * from './types';
