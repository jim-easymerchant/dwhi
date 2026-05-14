/**
 * Dynamic Expo config. Evaluated by `expo` CLI both locally (via
 * `expo start`) and on the EAS Build worker just before Metro bundles the JS.
 *
 * Why this file exists:
 *
 *   `process.env.EXPO_PUBLIC_OPENAI_API_KEY` substitution by Metro can be
 *   inconsistent on EAS builds (the worker's process.env must be populated
 *   _before_ Metro starts). To make injection reliable we ALSO copy the
 *   resolved values into `expoConfig.extra`, which Expo bakes into the APK
 *   manifest. The app reads `Constants.expoConfig.extra` first (rock-solid
 *   on EAS) and falls back to `process.env` for local dev. See
 *   src/services/env.ts.
 *
 * Where the env actually comes from on EAS:
 *
 *   The GitHub Actions workflow runs `eas env:create --environment preview`
 *   for each repo secret BEFORE invoking `eas build`. EAS-managed env vars
 *   are populated in the build worker's process.env automatically, which is
 *   when this file is evaluated.
 */

/** @type {(ctx: { config: any }) => any} */
module.exports = ({ config }) => {
  const apiKey = (process.env.EXPO_PUBLIC_OPENAI_API_KEY || '').trim() || null;
  const model = (process.env.EXPO_PUBLIC_OPENAI_MODEL || '').trim() || null;

  // SAFE build-log diagnostics. Length only — never the value, never the
  // last-N chars (those go to the in-app Settings screen where the user is
  // already authenticated to their own device).
  if (apiKey) {
    console.log(
      `[dwhi] OpenAI key present: yes (length ${apiKey.length})`,
    );
  } else {
    console.log(
      '[dwhi] OpenAI key present: no — APK will use the mock receipt parser.',
    );
  }
  if (model) {
    // Model name isn't sensitive — log it in full.
    console.log(`[dwhi] OpenAI model override: ${model}`);
  } else {
    console.log('[dwhi] OpenAI model: default (gpt-4o-mini)');
  }

  return {
    ...config,
    extra: {
      ...(config.extra ?? {}),
      openaiApiKey: apiKey,
      openaiModel: model,
    },
  };
};
