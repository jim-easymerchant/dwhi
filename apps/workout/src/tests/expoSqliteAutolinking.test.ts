/**
 * Native-module autolinking regression test.
 *
 * Crash diagnosed from the Android bug report:
 *   JavascriptException: Error: Cannot find native module 'ExpoSQLiteNext'
 *
 * Root cause: `expo-sqlite` was declared in the repo-root
 * `package.json` but NOT in `apps/workout/package.json`. Expo's
 * autolinking (`npx expo prebuild`) reads the *consuming app's*
 * `package.json` to decide which native modules to compile into
 * the APK. Without that direct declaration, the JS shim shipped
 * (because Metro saw the import) but the native module did not —
 * any call into expo-sqlite at runtime threw "Cannot find native
 * module 'ExpoSQLiteNext'".
 *
 * This test pins the contract so a future package.json edit can
 * not silently re-introduce the same crash. If you intentionally
 * remove expo-sqlite from the workout app, also remove the
 * persistence layer's expectation that it exists (or guard with
 * the existing disablePersistence() / DISABLE_PERSISTENCE_BOOT
 * paths).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const APP_PKG = path.resolve(__dirname, '..', '..', 'package.json');
const ROOT_PKG = path.resolve(__dirname, '..', '..', '..', '..', 'package.json');

interface PkgJson {
  dependencies?: Record<string, string>;
}

function readPkg(p: string): PkgJson {
  return JSON.parse(fs.readFileSync(p, 'utf8')) as PkgJson;
}

describe('Workout-app native autolinking — expo-sqlite', () => {
  test('apps/workout/package.json declares expo-sqlite directly', () => {
    const pkg = readPkg(APP_PKG);
    expect(pkg.dependencies).toBeDefined();
    expect(pkg.dependencies!['expo-sqlite']).toBeDefined();
    // Direct version range — the value must look like an actual
    // semver range, not a placeholder.
    expect(pkg.dependencies!['expo-sqlite']).toMatch(/^[~^]?\d/);
  });

  test('workout-app expo-sqlite version matches the repo root', () => {
    const root = readPkg(ROOT_PKG);
    const app = readPkg(APP_PKG);
    const rootVer = root.dependencies?.['expo-sqlite'];
    const appVer = app.dependencies?.['expo-sqlite'];
    expect(rootVer).toBeDefined();
    expect(appVer).toBe(rootVer);
  });
});
