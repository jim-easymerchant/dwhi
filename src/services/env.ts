/**
 * Resolves OpenAI env values at app runtime.
 *
 * Reads in this order:
 *   1. `Constants.expoConfig.extra.*` — populated by app.config.js at build
 *      time. Reliable on EAS builds because the value is baked into the
 *      APK's manifest, not subject to Metro inlining quirks.
 *   2. `process.env.EXPO_PUBLIC_*` — populated by Metro when running locally
 *      with `expo start` (Expo CLI auto-loads .env there).
 *
 * If neither path yields a value, we return null and the rest of the app
 * falls back to the mock receipt parser.
 */

import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;

function fromExtra(key: string): string | null {
  const value = extra[key];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function fromEnv(name: string): string | null {
  const value = (process.env as Record<string, string | undefined>)[name];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function getOpenAIKey(): string | null {
  return fromExtra('openaiApiKey') ?? fromEnv('EXPO_PUBLIC_OPENAI_API_KEY');
}

export function getOpenAIModel(): string {
  return (
    fromExtra('openaiModel') ??
    fromEnv('EXPO_PUBLIC_OPENAI_MODEL') ??
    'gpt-4o-mini'
  );
}

export function isOpenAIConfigured(): boolean {
  return getOpenAIKey() !== null;
}
