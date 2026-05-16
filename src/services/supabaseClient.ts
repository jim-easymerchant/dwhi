/**
 * Supabase client for the cloud-sync foundation. Lazy + env-driven:
 *
 *   - If `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are
 *     both present (via app.config.js → expoConfig.extra), we create a
 *     real client on first use and cache it.
 *   - If either is missing, `getSupabaseClient()` returns null and every
 *     downstream sync surface treats the app as Local only.
 *
 * No backend, no service-role key in the bundle, no realtime, no background
 * jobs. RLS on the Supabase side does the per-household scoping; the anon
 * key embedded in the APK can only see rows the signed-in user is a member
 * of.
 *
 * Session storage uses Supabase's default in-memory adapter for now —
 * sessions don't persist across cold starts. AsyncStorage will replace this
 * when the real auth UI lands. Manual "Sync now" is the only entry point.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAnonKey, getSupabaseUrl, isSupabaseConfigured } from './env';

let cached: SupabaseClient | null | undefined;

export function getSupabaseClient(): SupabaseClient | null {
  if (cached !== undefined) return cached;

  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  if (!url || !anonKey) {
    cached = null;
    return null;
  }

  try {
    cached = createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  } catch (err) {
    console.warn('[dwhi] Supabase client init failed:', err);
    cached = null;
  }
  return cached;
}

export function describeSupabaseStatus(): string {
  if (!isSupabaseConfigured()) {
    return 'Supabase env vars not set — running Local only.';
  }
  if (!getSupabaseClient()) {
    return 'Supabase env vars set but client failed to initialize.';
  }
  return 'Supabase client ready. Sign-in is required for the next branch to enable Sync now.';
}

/** Test-only reset; never call from app code. */
export function __resetSupabaseClientForTests(): void {
  cached = undefined;
}
