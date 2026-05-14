/**
 * Thin wrapper around the env values we read at runtime. Expo inlines any
 * variable prefixed with `EXPO_PUBLIC_` from the project root `.env` file
 * into `process.env` at build/start time, so a missing `.env` simply yields
 * `undefined` here — that's the signal to fall back to the mock parser.
 */

function read(name: string): string | null {
  const value = (process.env as Record<string, string | undefined>)[name];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function getOpenAIKey(): string | null {
  return read('EXPO_PUBLIC_OPENAI_API_KEY');
}

export function getOpenAIModel(): string {
  return read('EXPO_PUBLIC_OPENAI_MODEL') ?? 'gpt-4o-mini';
}

export function isOpenAIConfigured(): boolean {
  return getOpenAIKey() !== null;
}
