/**
 * Wraps Supabase's auth surface for the household-invite flow. Uses email
 * OTP (one-time code) — avoids deep-link / universal-link plumbing that
 * magic-links would require on Android.
 *
 * Every function short-circuits to a clear failure when the Supabase
 * client is not configured, so the rest of the app keeps working in
 * Local-only mode.
 */

import type { Session } from '@supabase/supabase-js';
import { getSupabaseClient } from '../supabaseClient';

export interface AuthResult<T = void> {
  ok: boolean;
  message: string;
  data?: T;
}

function unconfigured<T = void>(): AuthResult<T> {
  return {
    ok: false,
    message: 'Supabase is not configured on this build.',
  };
}

/**
 * Triggers Supabase to email a 6-digit code to the given address. Creates
 * the auth user if they don't exist yet (shouldCreateUser default true).
 */
export async function requestEmailOtp(email: string): Promise<AuthResult> {
  const client = getSupabaseClient();
  if (!client) return unconfigured();
  const trimmed = email.trim();
  if (!trimmed) return { ok: false, message: 'Email is required.' };
  const { error } = await client.auth.signInWithOtp({
    email: trimmed,
    options: { shouldCreateUser: true },
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: 'We sent a 6-digit code to your email.' };
}

/**
 * Verifies the 6-digit code. On success the Supabase client persists the
 * session via AsyncStorage, so subsequent app launches stay signed in.
 */
export async function verifyEmailOtp(
  email: string,
  code: string,
): Promise<AuthResult<Session>> {
  const client = getSupabaseClient();
  if (!client) return unconfigured<Session>();
  const trimmedEmail = email.trim();
  const trimmedCode = code.trim();
  if (!trimmedEmail || !trimmedCode) {
    return { ok: false, message: 'Email and code are required.' };
  }
  const { data, error } = await client.auth.verifyOtp({
    email: trimmedEmail,
    token: trimmedCode,
    type: 'email',
  });
  if (error) return { ok: false, message: error.message };
  if (!data?.session) return { ok: false, message: 'Verification returned no session.' };
  return { ok: true, message: `Signed in as ${trimmedEmail}.`, data: data.session };
}

export async function signOut(): Promise<AuthResult> {
  const client = getSupabaseClient();
  if (!client) return unconfigured();
  const { error } = await client.auth.signOut();
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: 'Signed out.' };
}

/**
 * Best-effort session readout. Returns null when offline / unconfigured /
 * never signed in.
 */
export async function getCurrentSession(): Promise<Session | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const { data } = await client.auth.getSession();
    return data?.session ?? null;
  } catch {
    return null;
  }
}

export async function getCurrentEmail(): Promise<string | null> {
  const session = await getCurrentSession();
  return session?.user?.email ?? null;
}
