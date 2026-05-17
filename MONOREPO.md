# Monorepo layout

This repo is in the middle of becoming a monorepo. The end state is:

```
apps/
  dwhi/                   # Do We Have It? pantry app (Expo)
  workout/                # future workout / RPG app (Expo)
packages/
  framework/              # @dwhi/framework
  ui/                     # @dwhi/ui
  domain/                 # @dwhi/domain (pantry-only)
```

This branch lands the **package boundary** — `packages/{framework,ui,domain}`
exist and re-export the existing modules so any new code (or a new app)
can import from `@dwhi/framework` instead of `@/services/...`. The
physical move of `src/` and `app/` into `apps/dwhi/` happens in a
follow-up so this branch can be a pure structural refactor with zero
import-path churn for the existing DWHI app.

## Packages

### `@dwhi/framework`

Reusable app infrastructure. **No DWHI pantry concepts.** Anything that
a workout app would also need lives here.

| Sub-barrel | What's inside |
|---|---|
| `@dwhi/framework/auth` | Email-OTP sign-in: `requestEmailOtp`, `verifyEmailOtp`, normalize/length helpers, `getCurrentSession`, `signOut`. |
| `@dwhi/framework/supabase` | Lazy `getSupabaseClient`, `describeSupabaseStatus`. |
| `@dwhi/framework/env` | Build info + Supabase env probing + config source diagnostics. **Excludes** OpenAI keys (pantry-specific). |
| `@dwhi/framework/households` | Local bootstrap (`bootstrapHousehold`), active-context singleton, household repository CRUD, `switchActiveHouseholdToRemote`. |
| `@dwhi/framework/invites` | Remote invite + member operations (create / accept / revoke / list / remove). |
| `@dwhi/framework/storage` | `app_prefs` key/value store. |
| `@dwhi/framework/sync` | Sync skeleton (stub today): `syncNow`, `getSyncMode`, `countPendingChanges`, `SyncResult`, `SyncMode`. |
| `@dwhi/framework/location` | Background location: distance, decision policy, TaskManager registration, permissions, repository. |
| `@dwhi/framework/db` | `getDb`, `initDatabase`, `columnExists`, `addColumnIfMissing`, `createIndexIfColumnExists`, `nowIso`. |
| `@dwhi/framework/types` | `Household`, `HouseholdMember`, `Device`, `ActiveHouseholdContext`, `HouseholdRole`. |

Top-level barrel `@dwhi/framework` re-exports everything for the "one
import" case.

### `@dwhi/ui`

Reusable React Native UI primitives + design tokens. **Strict rule:**
no domain copy here. If it mentions pantry, household, or any feature,
it stays in the app.

| Sub-barrel | What's inside |
|---|---|
| `@dwhi/ui/components` | `BigButton`, `Card`, `ScreenContainer`, `TextField`. |
| `@dwhi/ui/theme` | `colors`, `spacing`, `radii`, `typography`. |

### `@dwhi/domain`

Pantry-specific surface. **Other apps must not depend on this
package.**

| Sub-barrel | What's inside |
|---|---|
| `@dwhi/domain/items` | Item repository (canonical key, barcode, search). |
| `@dwhi/domain/inventory` | Inventory events + estimated balance. |
| `@dwhi/domain/receipts` | Receipt + receipt-item CRUD. |
| `@dwhi/domain/ask` | Ask history + per-term feedback. |
| `@dwhi/domain/confidence` | Confidence engine + scorer + explainer. |
| `@dwhi/domain/behavior` | Per-item / per-category behaviour stats. |
| `@dwhi/domain/voice` | Voice intent parser + transcript normalizer. |
| `@dwhi/domain/recent-activity` | Home-screen recent activity feed. |
| `@dwhi/domain/types` | Pantry-only types (`Item`, `Receipt`, `InventoryEvent`, …). |

## How imports work today

`packages/*/src/*.ts` files **re-export** from the existing `src/`
implementations using the `@/...` alias. There is no duplication —
each module has exactly one source of truth. The package barrels are
a thin re-export layer on top.

```
packages/framework/src/auth.ts
  └── export * from '@/services/auth/authService'  // ← real file
```

This means:

1. The existing DWHI app keeps importing via `@/services/...` and
   nothing breaks.
2. New code (and the future workout app) imports via
   `@dwhi/framework/auth` or `@dwhi/framework`.
3. The physical move of files into `packages/*/src/` happens in a
   follow-up branch, swapping the re-exports for the actual
   implementations one folder at a time. The public API doesn't
   change.

## Adding a new app

The intended layout for a second app:

```
apps/<my-app>/
  app/                    # expo-router screens
  app.json                # or app.config.js
  package.json            # depends on @dwhi/framework, @dwhi/ui
  tsconfig.json           # extends the root
  README.md
```

Imports inside the new app:

```ts
import {
  verifyEmailOtp,
  ensureBootstrap,        // when this lands
  getActiveHouseholdId,
} from '@dwhi/framework';
import { BigButton, colors, spacing } from '@dwhi/ui';
// Do NOT import from @dwhi/domain — that's DWHI-only.
```

The framework provides everything the new app needs to:

- sign in (email OTP)
- bootstrap a local household + member + device
- create a remote household after sign-in
- mint / accept invites
- persist device-wide prefs
- store and query rows scoped to the active household
- collect background location samples (opt-in)
- run the sync skeleton (stub today; real push/pull soon)

The new app supplies its own domain package (e.g.
`@dwhi/workout-domain`) for app-specific tables and logic.

## Known follow-ups (do not block this branch)

1. **Physical move of `src/`.** Today everything lives at the repo
   root. The next branch should move:
   - `src/services/auth/`, `src/services/supabaseClient.ts`,
     `src/services/env.ts`, `src/services/household*.ts`,
     `src/services/sync/`, `src/services/remote/`,
     `src/services/location/`, `src/repositories/{household,appPrefs,locationEvent}*.ts`,
     `src/db/database.ts` → into `packages/framework/src/`
   - `src/components/{BigButton,Card,TextField,ScreenContainer}.tsx`,
     `src/theme/colors.ts` → into `packages/ui/src/`
   - `src/repositories/{item,inventoryEvent,receipt,recentActivity,askHistory,askFeedback}*.ts`,
     `src/services/confidence/`, `src/services/voice/`,
     `src/services/behaviorStats.ts` → into `packages/domain/src/`
   - `src/types/models.ts` → split between framework/types and
     domain/types.
   - `app/`, `assets/`, `app.json` → into `apps/dwhi/`.
2. **Split `src/db/schema.ts`** into a framework-side base schema
   (households, members, devices, app_prefs, location_events) and an
   app-side schema contribution (items, inventory_events, receipts,
   receipt_items, ask_history, ask_feedback). The framework should
   expose a `registerAppSchema(statements)` hook.
3. **Split `src/services/env.ts`** so OpenAI getters live in DWHI
   domain or app instead of being side-by-side with framework probes.
4. **Split `src/services/diagnostics.ts`** — currently composes
   framework + domain probes in one file. Move to:
   `packages/framework/src/diagnostics/index.ts` (build / auth /
   household / sync / location blocks) and
   `apps/dwhi/src/diagnostics.ts` (composes framework blocks +
   pantry-specific item/receipt counts).
5. **Configure Metro `watchFolders`** to include `packages/*` once
   the app starts importing from `@dwhi/*` so live reload picks up
   changes.
6. **Document a workout-app package** layout once the second app
   begins (placeholder: `apps/workout/` and
   `packages/workout-domain/`).

## Local development

```bash
npm install         # creates node_modules/@dwhi/* symlinks via workspaces
npm test            # runs Jest across src/ and packages/*/src/
npm run typecheck   # tsc --noEmit
npx expo config --type prebuild   # validates app.json + plugins
```

Workspace symlinks are created at install time. There is no separate
build step — TypeScript path aliases + the `main`/`types`
declarations in each package's `package.json` resolve at consume
time.

## Smoke tests

Each package has a `src/__tests__/barrel.test.ts` that:

- Verifies the public surface (function names exist with the
  expected runtime types).
- Verifies the root barrel re-exports the sub-barrels.
- For `@dwhi/ui` only: references components via `import type`
  rather than runtime require, so the test stays in a Node env
  without dragging in the `react-native` bridge. `tsc --noEmit`
  covers the actual existence of those re-exports.

The smoke tests also include a regression guard that **`@dwhi/framework`
does not export pantry-specific names** (item / receipt / inventory /
confidence helpers). That catches accidental promotion of DWHI code
into the shared layer.
