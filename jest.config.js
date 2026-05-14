/**
 * Lean Jest config. We only test pure TS modules under `src/services/**`;
 * RN component tests are intentionally out of scope (they'd pull in jest-expo,
 * react-test-renderer, the whole Metro stack — too heavy for a POC).
 *
 * `__DEV__` is shimmed to false so engine debug logs stay silent.
 *
 * Path alias `@/` mirrors tsconfig.json.
 */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  globals: {
    __DEV__: false,
  },
  // Repositories transitively import expo-sqlite, which isn't a real Node
  // module. Tests that go through the engine mock the repos directly with
  // jest.mock(), so we don't need to wire any RN/expo shims here.
};
