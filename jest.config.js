// Lean Jest config. We only test pure TS modules under src/services
// and the workspace package barrels under packages/<pkg>/src/__tests__;
// RN component tests are intentionally out of scope (they'd pull in
// jest-expo, react-test-renderer, the whole Metro stack — too heavy
// for a POC).
//
// __DEV__ is shimmed to false so engine debug logs stay silent.
//
// Path aliases mirror tsconfig.json:
//   @/...                       -> src/...
//   @dwhi/framework[/x]         -> packages/framework/src[/x]
//   @dwhi/ui[/x]                -> packages/ui/src[/x]
//   @dwhi/domain[/x]            -> packages/domain/src[/x]
//   @dwhi/workout-domain[/x]    -> packages/workout-domain/src[/x]
module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.test.ts',
    '<rootDir>/packages/*/src/**/__tests__/**/*.test.ts',
  ],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@dwhi/framework$': '<rootDir>/packages/framework/src/index.ts',
    '^@dwhi/framework/(.*)$': '<rootDir>/packages/framework/src/$1',
    '^@dwhi/ui$': '<rootDir>/packages/ui/src/index.ts',
    '^@dwhi/ui/(.*)$': '<rootDir>/packages/ui/src/$1',
    '^@dwhi/domain$': '<rootDir>/packages/domain/src/index.ts',
    '^@dwhi/domain/(.*)$': '<rootDir>/packages/domain/src/$1',
    '^@dwhi/workout-domain$': '<rootDir>/packages/workout-domain/src/index.ts',
    '^@dwhi/workout-domain/(.*)$': '<rootDir>/packages/workout-domain/src/$1',
    // Stub native modules whose real implementations require a RN
    // runtime. Tests that need specific behavior still override with
    // jest.mock() inside the test file — the mapper just keeps the
    // bare imports resolvable so barrel smoke tests work.
    '^expo-constants$': '<rootDir>/test-stubs/expo-constants.ts',
    '^expo-sqlite$': '<rootDir>/test-stubs/expo-sqlite.ts',
    '^expo-task-manager$': '<rootDir>/test-stubs/expo-task-manager.ts',
    '^expo-location$': '<rootDir>/test-stubs/expo-location.ts',
    '^@react-native-async-storage/async-storage$': '<rootDir>/test-stubs/async-storage.ts',
  },
  globals: {
    __DEV__: false,
  },
  // Repositories transitively import expo-sqlite, which isn't a real Node
  // module. Tests that go through the engine mock the repos directly with
  // jest.mock(), so we don't need to wire any RN/expo shims here.
};
