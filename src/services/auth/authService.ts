/**
 * Wraps Supabase's auth surface for the household-invite flow. Uses email
 * OTP (one-time code) — avoids deep-link / universal-link plumbing that
 * magic-links would require on Android.
 *
 * IMPORTANT:
 *   The email-OTP flow depends on the Supabase project's email templates
 *   actually showing the `{{ .Token }}` variable. Default templates
 *   include only `{{ .ConfirmationURL }}` (a magic link). On mobile,
 *   that link redirects to Site URL (which defaults to `localhost:3000`)
 *   and is useless. See supabase/README.md for the exact dashboard
 *   settings.
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
 * Mask an email for safe logging: keeps the first character and the
 * domain, so a typo is recognisable but the address isn't fully exposed.
 *   "alice@example.com" → "a***@example.com"
 */
function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) return '***';
  return `${email[0]}***${email.slice(at)}`;
}

/**
 * Triggers Supabase to email a 6-digit code to the given address. Creates
 * the auth user if they don't exist yet (shouldCreateUser=true).
 *
 * We deliberately do NOT pass `emailRedirectTo` — on mobile we never want
 * the user clicking a link; we want them reading the code out of the email
 * and pasting it into the app. The token shows up in the email iff the
 * Supabase email template includes `{{ .Token }}` (see supabase/README.md).
 */
export async function requestEmailOtp(email: string): Promise<AuthResult> {
  const client = getSupabaseClient();
  if (!client) return unconfigured();
  const trimmed = email.trim();
  if (!trimmed) return { ok: false, message: 'Email is required.' };

  console.log(`[dwhi.auth] requesting OTP for ${maskEmail(trimmed)}`);
  const { error } = await client.auth.signInWithOtp({
    email: trimmed,
    options: {
      // Sign up the user if they don't exist. Avoids a separate signUp()
      // call which would trigger Supabase's "Confirm signup" template
      // (also a link, not an OTP code) on projects with email
      // confirmation enabled.
      shouldCreateUser: true,
      // IMPORTANT: do NOT set emailRedirectTo. Setting it would make
      // Supabase render the magic-link variant of the email pointed at
      // a URL — which, in a mobile-only app, has nowhere useful to go.
    },
  });
  if (error) {
    console.warn(`[dwhi.auth] signInWithOtp failed: ${error.message}`);
    return { ok: false, message: error.message };
  }
  console.log('[dwhi.auth] OTP email queued');
  return {
    ok: true,
    message:
      'We sent a 6-digit code to your email. Open the email and copy the code (not the link).',
  };
}

/**
 * Verifies the 6-digit code via `verifyOtp({ type: 'email' })`. On
 * success the Supabase client persists the session via AsyncStorage so
 * subsequent app launches stay signed in.
 *
 * `type: 'email'` is the OTP-code path; `type: 'magiclink'` is for the
 * link-redirect path (which we don't use). Mixing the two would cause
 * "Invalid OTP" errors on otherwise-valid codes.
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

  console.log(
    `[dwhi.auth] verifying OTP for ${maskEmail(trimmedEmail)} (code length ${trimmedCode.length})`,
  );
  const { data, error } = await client.auth.verifyOtp({
    email: trimmedEmail,
    token: trimmedCode,
    type: 'email',
  });
  if (error) {
    console.warn(`[dwhi.auth] verifyOtp failed: ${error.message}`);
    return { ok: false, message: error.message };
  }
  if (!data?.session) {
    console.warn('[dwhi.auth] verifyOtp returned no session');
    return {
      ok: false,
      message: 'Verification returned no session. Try requesting a new code.',
    };
  }
  console.log('[dwhi.auth] OTP verified, session received');
  return { ok: true, message: `Signed in as ${trimmedEmail}.`, data: data.session };
}

export async function signOut(): Promise<AuthResult> {
  const client = getSupabaseClient();
  if (!client) return unconfigured();
  const { error } = await client.auth.signOut();
  if (error) {
    console.warn(`[dwhi.auth] signOut failed: ${error.message}`);
    return { ok: false, message: error.message };
  }
  console.log('[dwhi.auth] signed out');
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
