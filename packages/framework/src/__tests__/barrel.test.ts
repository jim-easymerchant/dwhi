/**
 * Smoke tests for the @dwhi/framework package boundary.
 *
 * These don't exercise behaviour — they just verify the public import
 * surface is intact and the right names resolve via both the root
 * barrel and the sub-module barrels. If the physical file move happens
 * later, these tests are what guarantees consumers keep working.
 */

import * as framework from '@dwhi/framework';
import * as auth from '@dwhi/framework/auth';
import * as households from '@dwhi/framework/households';
import * as invites from '@dwhi/framework/invites';
import * as storage from '@dwhi/framework/storage';
import * as supabase from '@dwhi/framework/supabase';
import * as sync from '@dwhi/framework/sync';
import * as location from '@dwhi/framework/location';
import * as db from '@dwhi/framework/db';
import * as env from '@dwhi/framework/env';

describe('@dwhi/framework barrel', () => {
  test('auth surface', () => {
    expect(typeof auth.verifyEmailOtp).toBe('function');
    expect(typeof auth.requestEmailOtp).toBe('function');
    expect(typeof auth.normalizeOtpCode).toBe('function');
    expect(typeof auth.isOtpCodeLengthValid).toBe('function');
    expect(typeof auth.getCurrentSession).toBe('function');
    expect(typeof auth.signOut).toBe('function');
    expect(typeof auth.OTP_CODE_MIN_LENGTH).toBe('number');
    expect(typeof auth.OTP_CODE_MAX_LENGTH).toBe('number');
  });

  test('households surface', () => {
    expect(typeof households.bootstrapHousehold).toBe('function');
    expect(typeof households.getActiveHouseholdId).toBe('function');
    expect(typeof households.setActiveHouseholdContext).toBe('function');
    expect(typeof households.switchActiveHouseholdToRemote).toBe('function');
    expect(typeof households.createHousehold).toBe('function');
    expect(typeof households.findHouseholdByRemoteId).toBe('function');
  });

  test('invites surface', () => {
    expect(typeof invites.createInvite).toBe('function');
    expect(typeof invites.findInviteByCode).toBe('function');
    expect(typeof invites.acceptInvite).toBe('function');
    expect(typeof invites.revokeInvite).toBe('function');
    expect(typeof invites.normalizeInviteCode).toBe('function');
    expect(typeof invites.validateInvite).toBe('function');
    expect(typeof invites.listMembersForHousehold).toBe('function');
    expect(typeof invites.removeMember).toBe('function');
  });

  test('storage surface', () => {
    expect(typeof storage.getPref).toBe('function');
    expect(typeof storage.setPref).toBe('function');
    expect(typeof storage.getActiveHouseholdPref).toBe('function');
    expect(typeof storage.setActiveHouseholdPref).toBe('function');
  });

  test('supabase surface', () => {
    expect(typeof supabase.getSupabaseClient).toBe('function');
    expect(typeof supabase.describeSupabaseStatus).toBe('function');
  });

  test('sync surface', () => {
    expect(typeof sync.syncNow).toBe('function');
    expect(typeof sync.getSyncMode).toBe('function');
    expect(typeof sync.countPendingChanges).toBe('function');
  });

  test('location surface', () => {
    expect(typeof location.haversineMeters).toBe('function');
    expect(typeof location.shouldStoreLocation).toBe('function');
    expect(typeof location.requestLocationPermissions).toBe('function');
    expect(typeof location.startBackgroundLocationTracking).toBe('function');
    expect(typeof location.stopBackgroundLocationTracking).toBe('function');
    expect(typeof location.BACKGROUND_LOCATION_TASK_NAME).toBe('string');
  });

  test('db surface', () => {
    expect(typeof db.getDb).toBe('function');
    expect(typeof db.initDatabase).toBe('function');
    expect(typeof db.addColumnIfMissing).toBe('function');
    expect(typeof db.columnExists).toBe('function');
    expect(typeof db.nowIso).toBe('function');
  });

  test('env surface (framework-only — OpenAI getters NOT exposed)', () => {
    expect(typeof env.getSupabaseUrl).toBe('function');
    expect(typeof env.getSupabaseAnonKey).toBe('function');
    expect(typeof env.isSupabaseConfigured).toBe('function');
    expect(typeof env.getBuildInfo).toBe('function');
    expect(typeof env.getConfigSource).toBe('function');
    // Pantry-specific keys must not be promoted into framework.
    expect((env as Record<string, unknown>).getOpenAIKey).toBeUndefined();
    expect((env as Record<string, unknown>).getOpenAIModel).toBeUndefined();
  });

  test('root barrel re-exports every sub-module surface', () => {
    expect(framework.verifyEmailOtp).toBe(auth.verifyEmailOtp);
    expect(framework.getActiveHouseholdId).toBe(households.getActiveHouseholdId);
    expect(framework.createInvite).toBe(invites.createInvite);
    expect(framework.getPref).toBe(storage.getPref);
    expect(framework.getSupabaseClient).toBe(supabase.getSupabaseClient);
    expect(framework.syncNow).toBe(sync.syncNow);
    expect(framework.haversineMeters).toBe(location.haversineMeters);
    expect(framework.getDb).toBe(db.getDb);
    expect(framework.isSupabaseConfigured).toBe(env.isSupabaseConfigured);
  });
});
