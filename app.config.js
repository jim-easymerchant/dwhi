/**
 * Dynamic Expo config. Evaluated by Expo CLI both locally (via `expo start`)
 * and on the EAS Build worker before Metro bundles the JS and before
 * prebuild emits native config.
 *
 * Why this file exists:
 *
 *   `process.env.EXPO_PUBLIC_*` substitution by Metro can be inconsistent on
 *   EAS builds (the worker's process.env must be populated before Metro
 *   starts). To make injection reliable we ALSO copy the resolved values
 *   into `expoConfig.extra`, which Expo bakes into the embedded manifest.
 *   The app reads it via `Constants.expoConfig.extra` (or fallbacks) — see
 *   src/services/env.ts.
 *
 * Where the env actually comes from on EAS:
 *
 *   The GitHub Actions workflow runs `eas env:create --environment preview`
 *   for each repo secret BEFORE invoking `eas build`. EAS populates the
 *   build worker's process.env with those values, which is when this file
 *   is evaluated.
 */

/** @type {(ctx: { config: any }) => any} */
module.exports = ({ config }) => {
  const apiKey = (process.env.EXPO_PUBLIC_OPENAI_API_KEY || '').trim() || null;
  const model = (process.env.EXPO_PUBLIC_OPENAI_MODEL || '').trim() || null;

  // SAFE build-log diagnostics. Length only — never the value, never the
  // last-N chars (those live in the in-app Settings screen where the user
  // is already on their own device).
  console.log('---- [dwhi] app.config.js evaluating ----');
  const publicEnvKeys = Object.keys(process.env).filter(k =>
    k.startsWith('EXPO_PUBLIC_'),
  );
  console.log(
    `[dwhi] EXPO_PUBLIC_* visible at config eval: ${
      publicEnvKeys.length ? publicEnvKeys.join(', ') : '(none)'
    }`,
  );
  if (apiKey) {
    console.log(`[dwhi] OpenAI key present: yes (length ${apiKey.length})`);
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
  console.log(
    `[dwhi] Setting extra.openaiApiKey: ${apiKey ? 'yes' : 'no'} ; extra.openaiModel: ${
      model ? 'yes' : 'no'
    }`,
  );
  console.log('-----------------------------------------');

  return {
    ...config,
    extra: {
      ...(config.extra ?? {}),
      openaiApiKey: apiKey,
      openaiModel: model,
    },
  };
};
