/**
 * Resolves OpenAI env values at app runtime.
 *
 * Why this is so defensive:
 *
 *   `Constants.expoConfig` (the modern API) can be null in production EAS
 *   builds that don't use expo-updates. The same build-time `extra` block
 *   may instead surface under:
 *
 *     - Constants.manifest2.extra.expoClient.extra   (EAS Update / new manifest)
 *     - Constants.manifest.extra                     (legacy classic manifest)
 *
 *   We probe all three in order, then fall back to process.env for local
 *   `npx expo start` (where Expo CLI auto-loads .env). The first probe that
 *   yields a non-empty string wins, and `getConfigSource()` reports which
 *   path it was — surfaced in Settings so we can diagnose future builds
 *   without another round trip.
 */

import Constants from 'expo-constants';

export type ConfigSource =
  | 'expoConfig'
  | 'manifest2'
  | 'manifest'
  | 'process.env'
  | 'none';

interface Resolved {
  source: ConfigSource;
  apiKey: string | null;
  model: string | null;
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function probe(extra: Record<string, unknown> | null | undefined): {
  apiKey: string | null;
  model: string | null;
} {
  if (!extra) return { apiKey: null, model: null };
  return {
    apiKey: asNonEmptyString(extra.openaiApiKey),
    model: asNonEmptyString(extra.openaiModel),
  };
}

function resolve(): Resolved {
  // `Constants` has different shapes across SDKs; cast to any once so each
  // probe stays terse and we tolerate missing fields gracefully.
  const c = Constants as unknown as Record<string, any>;

  const candidates: Array<{ source: ConfigSource; extra: any }> = [
    { source: 'expoConfig', extra: c.expoConfig?.extra },
    { source: 'manifest2', extra: c.manifest2?.extra?.expoClient?.extra },
    { source: 'manifest', extra: c.manifest?.extra },
  ];

  for (const candidate of candidates) {
    const { apiKey, model } = probe(candidate.extra);
    if (apiKey || model) {
      return { source: candidate.source, apiKey, model };
    }
  }

  // Local dev fallback. In production APKs `process.env.EXPO_PUBLIC_*` is
  // either inlined by Metro (which is the path that's been unreliable) or
  // absent entirely; either way an `extra` hit above takes precedence.
  const envApiKey = asNonEmptyString(
    (process.env as Record<string, string | undefined>).EXPO_PUBLIC_OPENAI_API_KEY,
  );
  const envModel = asNonEmptyString(
    (process.env as Record<string, string | undefined>).EXPO_PUBLIC_OPENAI_MODEL,
  );
  if (envApiKey || envModel) {
    return { source: 'process.env', apiKey: envApiKey, model: envModel };
  }

  return { source: 'none', apiKey: null, model: null };
}

let cached: Resolved | null = null;
function get(): Resolved {
  if (!cached) cached = resolve();
  return cached;
}

export function getOpenAIKey(): string | null {
  return get().apiKey;
}

export function getOpenAIModel(): string {
  return get().model ?? 'gpt-4o-mini';
}

export function isOpenAIConfigured(): boolean {
  return getOpenAIKey() !== null;
}

export function getConfigSource(): ConfigSource {
  return get().source;
}

/**
 * Reports which Constants paths were *populated* on this runtime, regardless
 * of whether they had our keys. Surfaced in Settings to make it obvious when
 * the embedded manifest is missing entirely vs. present-but-empty.
 */
export function getProbeSnapshot(): Record<ConfigSource, boolean> {
  const c = Constants as unknown as Record<string, any>;
  return {
    expoConfig: !!c.expoConfig?.extra,
    manifest2: !!c.manifest2?.extra?.expoClient?.extra,
    manifest: !!c.manifest?.extra,
    'process.env': !!(
      (process.env as Record<string, string | undefined>).EXPO_PUBLIC_OPENAI_API_KEY ??
      (process.env as Record<string, string | undefined>).EXPO_PUBLIC_OPENAI_MODEL
    ),
    none: false,
  };
}

// ---------------------------------------------------------------------------
// Build metadata
// ---------------------------------------------------------------------------

/** Picks the first non-empty string for `key` across every known config path. */
function readExtraString(key: string): string | null {
  const c = Constants as unknown as Record<string, any>;
  const candidates: any[] = [
    c.expoConfig?.extra?.[key],
    c.manifest2?.extra?.expoClient?.extra?.[key],
    c.manifest?.extra?.[key],
    (process.env as Record<string, string | undefined>)[`EXPO_PUBLIC_${key.toUpperCase()}`],
  ];
  for (const v of candidates) {
    const s = asNonEmptyString(v);
    if (s) return s;
  }
  return null;
}

export interface BuildInfo {
  /** Semantic-ish version from app.json (e.g. "0.1.0"). */
  appVersion: string;
  /** Short SHA from the workflow; "local" when running on a dev machine. */
  buildCommit: string;
  /** Workflow run number; "dev" locally. */
  buildRun: string;
  /** ISO timestamp pinned at build time; falls back to evaluation time. */
  buildTime: string;
}/**
 * Reads the version + build metadata stamped onto the manifest by
 * app.config.js. Safe to call from any screen; all fields have local-dev
 * fallbacks so the Settings card never has to show a blank.
 */
export function getBuildInfo(): BuildInfo {
  const c = Constants as unknown as Record<string, any>;
  const appVersion =
    asNonEmptyString(c.expoConfig?.version) ??
    asNonEmptyString(c.manifest2?.extra?.expoClient?.version) ??
    asNonEmptyString(c.manifest?.version) ??
    '0.0.0';
  return {
    appVersion,
    buildCommit: readExtraString('buildCommit') ?? 'local',
    buildRun: readExtraString('buildRun') ?? 'dev',
    buildTime: readExtraString('buildTime') ?? new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Supabase (cloud-sync foundation)
// ---------------------------------------------------------------------------

export function getSupabaseUrl(): string | null {
  return readExtraString('supabaseUrl');
}

export function getSupabaseAnonKey(): string | null {
  return readExtraString('supabaseAnonKey');
}

/** True when both Supabase URL and anon key are present in the manifest. */
export function isSupabaseConfigured(): boolean {
  return getSupabaseUrl() !== null && getSupabaseAnonKey() !== null;
}
