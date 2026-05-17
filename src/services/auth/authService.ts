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

import type { AuthError, Session } from '@supabase/supabase-js';
import { getSupabaseClient } from '../supabaseClient';

export interface AuthResult<T = void> {
  ok: boolean;
  message: string;
  data?: T;
  /**
   * Surface details from Supabase when present so callers (and tests)
   * can branch on real conditions instead of brittle message text.
   */
  details?: {
    code?: string;
    status?: number;
    /** Which token type the verify call actually used. */
    verifiedAs?: 'email' | 'signup';
    /** True iff a fallback verify (e.g. signup) was attempted. */
    triedFallback?: boolean;
  };
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
 * Pulls `code` / `status` off a Supabase AuthError without assuming a
 * specific shape — older versions don't expose all three. Safe to log;
 * never includes the user's email or token.
 */
function describeAuthError(err: AuthError | { message?: string } | null | undefined): {
  message: string;
  code?: string;
  status?: number;
} {
  if (!err) return { message: 'unknown error' };
  const anyErr = err as AuthError & { code?: string; status?: number };
  return {
    message: anyErr.message ?? 'unknown error',
    code: typeof anyErr.code === 'string' ? anyErr.code : undefined,
    status: typeof anyErr.status === 'number' ? anyErr.status : undefined,
  };
}

/**
 * True when the error looks like "Invalid OTP" — the symptom we expect
 * if the user is verifying a token that came from the Confirm Signup
 * template (which needs `type: 'signup'`) rather than the Magic Link
 * template (`type: 'email'`).
 */
function looksLikeInvalidToken(messageOrCode: {
  message?: string;
  code?: string;
}): boolean {
  const m = (messageOrCode.message ?? '').toLowerCase();
  const c = (messageOrCode.code ?? '').toLowerCase();
  return (
    c.includes('otp_expired') ||
    c.includes('invalid_otp') ||
    m.includes('invalid otp') ||
    m.includes('token has expired') ||
    m.includes('token is invalid') ||
    m.includes('expired or is invalid')
  );
}

/**
 * Triggers Supabase to email a numeric sign-in code to the given address.
 * Creates the auth user if they don't exist yet (shouldCreateUser=true).
 *
 * We deliberately do NOT pass `emailRedirectTo` — on mobile we never want
 * the user clicking a link; we want them reading the code out of the email
 * and pasting it into the app. The token shows up in the email iff the
 * Supabase email template includes `{{ .Token }}` (see supabase/README.md).
 *
 * Token length is project-dependent: Supabase historically emitted 6
 * digits, but newer projects can be configured for 8 (or more). The app
 * deliberately does not assume a specific length — see
 * OTP_CODE_MIN_LENGTH / OTP_CODE_MAX_LENGTH below.
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
      'We sent a sign-in code to your email. Open the email and copy the code (not the link).',
  };
}

/**
 * Accept any reasonable numeric token length. Supabase emits 6 or 8
 * digits depending on project configuration, and the dashboard lets
 * operators set it as wide as 10. We cap at 12 to bound the input
 * field without rejecting realistic codes.
 */
export const OTP_CODE_MIN_LENGTH = 4;
export const OTP_CODE_MAX_LENGTH = 12;

/**
 * Normalize a user-typed code: drop everything that isn't a digit so a
 * paste like `"4087-7161"` or `"4087 7161"` arrives at Supabase as the
 * intended `"40877161"`. Never truncates — the full digit run is sent.
 */
export function normalizeOtpCode(raw: string): string {
  return raw.replace(/\D+/g, '');
}

/** True iff the normalized code length is within the accepted range. */
export function isOtpCodeLengthValid(normalized: string): boolean {
  return (
    normalized.length >= OTP_CODE_MIN_LENGTH &&
    normalized.length <= OTP_CODE_MAX_LENGTH
  );
}

/**
 * Verifies the sign-in code. Three phases:
 *
 *   1. Validate locally first: empty, length out of range → short-circuit
 *      with a friendly message; never hit Supabase with obvious garbage.
 *   2. Call `verifyOtp({ type: 'email' })`. If that fails with what
 *      looks like an Invalid/Expired token error, do ONE retry with
 *      `type: 'signup'` to cover the first-sign-in case where the
 *      Supabase project has "Confirm email" enabled and the user got
 *      the Confirm Signup template instead of Magic Link.
 *   3. On success, confirm a session is actually established via
 *      `getSession()` before reporting `ok: true`. The Supabase SDK
 *      writes through AsyncStorage on verify, so a missing session at
 *      this point is a real failure, not a race.
 *
 * The exact normalized digit run is passed to `verifyOtp` — no
 * truncation, no slicing. That's the bug this function specifically
 * guards against.
 */
export async function verifyEmailOtp(
  email: string,
  code: string,
): Promise<AuthResult<Session>> {
  const client = getSupabaseClient();
  if (!client) return unconfigured<Session>();
  const trimmedEmail = email.trim();
  const normalizedCode = normalizeOtpCode(code);
  if (!trimmedEmail) {
    return { ok: false, message: 'Email is required.' };
  }
  if (!normalizedCode) {
    return {
      ok: false,
      message: 'Enter the sign-in code from your email.',
    };
  }
  // Safe diagnostic: length only, never the token itself.
  console.log(`[dwhi.auth] normalized OTP length: ${normalizedCode.length}`);
  if (!isOtpCodeLengthValid(normalizedCode)) {
    return {
      ok: false,
      message: 'Enter the sign-in code from your email.',
    };
  }

  console.log(
    `[dwhi.auth] verifying OTP for ${maskEmail(trimmedEmail)} (length=${normalizedCode.length}, type=email)`,
  );
  const first = await client.auth.verifyOtp({
    email: trimmedEmail,
    token: normalizedCode,
    type: 'email',
  });
  let data = first.data;
  let verifiedAs: 'email' | 'signup' = 'email';
  let triedFallback = false;

  if (first.error) {
    const desc = describeAuthError(first.error);
    console.warn(
      `[dwhi.auth] verifyOtp(type=email) failed: message=${desc.message} code=${desc.code ?? '—'} status=${desc.status ?? '—'}`,
    );
    if (looksLikeInvalidToken(desc)) {
      // Controlled fallback. We log loudly so it's obvious in the
      // device logs which template the token actually came from.
      console.log(
        '[dwhi.auth] retrying verifyOtp with type=signup (fallback for Confirm-Signup template)',
      );
      triedFallback = true;
      const second = await client.auth.verifyOtp({
        email: trimmedEmail,
        token: normalizedCode,
        type: 'signup',
      });
      if (second.error) {
        const desc2 = describeAuthError(second.error);
        console.warn(
          `[dwhi.auth] verifyOtp(type=signup) also failed: message=${desc2.message} code=${desc2.code ?? '—'} status=${desc2.status ?? '—'}`,
        );
        return {
          ok: false,
          message: desc.message,
          details: {
            code: desc.code,
            status: desc.status,
            triedFallback: true,
          },
        };
      }
      data = second.data;
      verifiedAs = 'signup';
      console.log('[dwhi.auth] verifyOtp(type=signup) succeeded');
    } else {
      return {
        ok: false,
        message: desc.message,
        details: { code: desc.code, status: desc.status },
      };
    }
  }

  if (!data?.session) {
    console.warn(
      `[dwhi.auth] verifyOtp(type=${verifiedAs}) returned no session in response`,
    );
    return {
      ok: false,
      message:
        'Verification returned no session. Try requesting a new code.',
      details: { verifiedAs, triedFallback },
    };
  }

  // Belt-and-braces: confirm the SDK has actually persisted the
  // session. The verifyOtp response told us "yes"; if getSession
  // disagrees, the SDK never wrote the session to storage and the
  // user is not really signed in. Treat that as failure.
  let confirmed: Session | null = null;
  try {
    const { data: sessionData, error: sessionError } =
      await client.auth.getSession();
    if (sessionError) {
      console.warn(
        `[dwhi.auth] getSession after verify errored: ${sessionError.message}`,
      );
    }
    confirmed = sessionData?.session ?? null;
  } catch (e) {
    console.warn('[dwhi.auth] getSession after verify threw:', e);
  }
  if (!confirmed) {
    console.warn(
      `[dwhi.auth] verifyOtp(type=${verifiedAs}) reported success but getSession returned no session`,
    );
    return {
      ok: false,
      message:
        'Signed in but the session did not persist. Please try again.',
      details: { verifiedAs, triedFallback },
    };
  }
  console.log(
    `[dwhi.auth] OTP verified (verifiedAs=${verifiedAs}, sessionPresent=true)`,
  );
  return {
    ok: true,
    message: `Signed in as ${trimmedEmail}.`,
    data: confirmed,
    details: { verifiedAs, triedFallback },
  };
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
