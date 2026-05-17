// Jest stub for expo-constants. The real module ships ESM that Jest
// can't parse without the full expo preset. This stub is used via
// `moduleNameMapper` in jest.config.js.
//
// Tests that need specific extra/manifest fields override this with
// jest.mock('expo-constants', () => (...)) in the test file itself.
const Constants = {
  expoConfig: null,
  manifest: null,
  manifest2: null,
};
export default Constants;
