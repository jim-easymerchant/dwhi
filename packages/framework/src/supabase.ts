/**
 * Lazy Supabase client + status description. The client returns null
 * when env vars are missing, so consumers always handle the "running
 * offline" case explicitly.
 */
export {
  __resetSupabaseClientForTests,
  describeSupabaseStatus,
  getSupabaseClient,
} from '@/services/supabaseClient';
