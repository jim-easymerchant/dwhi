/**
 * Metro config for the Workout RPG / Momentum app.
 *
 * Monorepo layout: this app lives at `apps/workout/` while the
 * shared packages live at `packages/*`. Metro needs `watchFolders`
 * pointing at the repo root so its file watcher picks up changes
 * in `@dwhi/framework`, `@dwhi/ui`, and `@dwhi/workout-domain`.
 *
 * `nodeModulesPaths` ensures dependency resolution traverses both
 * this app's local `node_modules/` (which contains workspace
 * symlinks) and the root `node_modules/` (which contains hoisted
 * common deps).
 */

const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '..', '..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

config.resolver.disableHierarchicalLookup = false;

module.exports = config;
