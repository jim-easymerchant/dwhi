/**
 * Framework-level config probes. Only the cross-app pieces — Supabase
 * env vars, build metadata, config-source diagnostics — are re-exported
 * here. App-specific keys (OpenAI, etc.) intentionally stay in the
 * app's own env module until they have a reusable home.
 */
export {
  getBuildInfo,
  getConfigSource,
  getProbeSnapshot,
  getSupabaseAnonKey,
  getSupabaseUrl,
  isSupabaseConfigured,
  type BuildInfo,
  type ConfigSource,
} from '@/services/env';
