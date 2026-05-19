# 006 — Monorepo Integration Plan

> How the workout RPG slots into the existing DWHI monorepo. This
> branch does **not** move any files. It records the agreed plan so
> the next branch can scaffold without re-debating layout.

---

## 1. Target end-state layout

This matches `MONOREPO.md`'s stated direction, extended for the
workout app:

```
apps/
  dwhi/                       # existing pantry app (Expo)
  workout/                    # NEW: workout RPG app (Expo)
packages/
  framework/                  # @dwhi/framework  (auth, db, sync, households)
  ui/                         # @dwhi/ui         (primitives, theme)
  domain/                     # @dwhi/domain     (pantry-only)
  workout-domain/             # NEW: @dwhi/workout-domain (combat, momentum, catalog)
```

**Hard rule:** `apps/workout` and `packages/workout-domain` must not
depend on `@dwhi/domain` (pantry concepts). The reverse is also
true: pantry must not import from workout-domain. This is enforced
by adding a barrel smoke test mirroring the existing
`@dwhi/framework` regression guard.

## 2. Package boundaries

### `@dwhi/workout-domain` (new)

Workout RPG-specific surface. Pure-TS where possible; no RN imports
inside the package so it stays Jest-friendly without the RN bridge.

| Sub-barrel | Contents |
|---|---|
| `@dwhi/workout-domain/combat` | `damage()`, `fatigue()`, `crit()`, `questXp()`, `balance` constants. |
| `@dwhi/workout-domain/momentum` | `recomputeMomentum()`, `tierForMomentum()`, `momentumBalance`. |
| `@dwhi/workout-domain/catalog` | Seeded exercises + enemies. |
| `@dwhi/workout-domain/repositories` | SQLite repos for quests / battles / sets / profile / momentum. |
| `@dwhi/workout-domain/types` | Workout-only types. |

### `@dwhi/framework` (existing — what gets reused)

The workout app consumes:

- `@dwhi/framework/db` — SQLite handle, schema helpers (`columnExists`,
  `addColumnIfMissing`, `nowIso`).
- `@dwhi/framework/storage` — `app_prefs` for last-quest, rest-timer
  default, etc.
- `@dwhi/framework/types` — `Household`, `Device` (if/when sync lands).

It does **not** consume yet:

- Auth (no accounts in MVP).
- Households / invites (no shared household in MVP).
- Sync (local-only MVP).
- Location.

When the workout app needs accounts/sync (post-MVP), nothing new
gets added to framework — it just opts in to existing barrels.

### `@dwhi/ui` (existing — what gets reused)

- `BigButton`, `Card`, `ScreenContainer`, `TextField` — direct reuse.
- `colors`, `spacing`, `radii`, `typography` — base theme.

The workout app *extends* the theme with:

- An `ember.palette` namespace (5 tier colors).
- A `combatColors` namespace (HP red, crit gold, rest indigo).

These extensions live inside `apps/workout/src/theme/` (app-local),
**not** in `@dwhi/ui`. Rule from `MONOREPO.md` stands: if it's not
useful to a second-or-third app, it doesn't belong in `@dwhi/ui`.

## 3. Schema strategy

The existing app uses one SQLite database with all tables in
`src/db/schema.ts`. The follow-up listed in `MONOREPO.md` is to
**split that schema** into a framework base and app contributions.

The workout app's schema should be wired through that mechanism
*when it lands*. Until then, the workout app uses the same SQLite
file via `getDb()` and creates its own tables on first run with
`CREATE TABLE IF NOT EXISTS` — additive, no migration of existing
DWHI tables. This is a deliberate, temporary, low-risk approach.

### Naming convention

To avoid colliding with pantry tables, every workout-RPG table is
prefixed `workout_` or `player_`. Existing DWHI tables (`items`,
`receipts`, etc.) keep their names.

## 4. Proposed schema (full)

Local-first. Supabase columns are the *proposed* future shape; no
migration runs in MVP.

### `exercise_catalog`

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | e.g. `pushup`, `bench_press` |
| display_name | TEXT | "Pushup" |
| category | TEXT | `primary` / `secondary` / `accessory` |
| modality | TEXT | `weighted` / `bodyweight` / `timed` |
| bodyweight_coefficient | REAL | 0..1, used in `effectiveLoad` |
| load_scale | REAL | per-exercise damage normalizer |
| variant_of | TEXT NULL | links bodyweight variant to weighted |
| seeded | INTEGER | 1 if shipped seed, 0 if user-added (future) |

### `workout_quests`

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | uuid |
| template_id | TEXT | `push_day`, etc. |
| started_at | TEXT | ISO |
| completed_at | TEXT NULL | ISO |
| outcome | TEXT NULL | `complete` / `partial` / `abandoned` |
| xp_awarded | INTEGER NULL | computed at completion |
| momentum_delta | REAL NULL | for the history view |
| household_id | TEXT NULL | future sync |

### `workout_battles`

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | uuid |
| quest_id | TEXT FK → workout_quests | |
| exercise_id | TEXT FK → exercise_catalog | |
| sequence | INTEGER | order within quest |
| enemy_id | TEXT NULL | `sluggard` in MVP |
| enemy_hp_start | REAL | calibrated at battle start |
| enemy_hp_remaining | REAL | live during battle |
| resolved_at | TEXT NULL | |

### `workout_sets`

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | uuid |
| battle_id | TEXT FK → workout_battles | |
| sequence | INTEGER | turn # in battle |
| set_type | TEXT | `warmup` / `working` / `pr` (auto-inferred) |
| reps | INTEGER NULL | nullable for timed |
| weight_kg | REAL NULL | nullable for bodyweight |
| duration_seconds | INTEGER NULL | nullable for non-timed |
| damage_dealt | REAL | |
| crit | INTEGER | 0/1 |
| logged_at | TEXT | ISO |

### `player_profile`

Single-row.

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | always `default` in MVP |
| bodyweight_kg | REAL NULL | optional |
| default_rest_seconds | INTEGER | 60/90/120 |
| created_at | TEXT | |
| updated_at | TEXT | |

### `player_momentum`

Single-row.

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | always `default` |
| value | REAL | 0..100 |
| last_session_at | TEXT NULL | |
| last_return_bonus_at | TEXT NULL | |
| gentle_mode_until | TEXT NULL | |
| computed_through | TEXT | high-water mark for lazy decay |

### `monster_catalog`

Future-proofed; in MVP we don't read from it (Sluggard is
hardcoded), but we ship the table so schema doesn't churn.

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | `sluggard` |
| display_name | TEXT | |
| flavor | TEXT | "Lord of Couches" |
| hp_factor | REAL | overrides global default if set |
| tier_min | TEXT NULL | tier requirement for legendary variants |

### `battle_results`

Denormalized history cache. Could be derived, but speeds the home
screen.

| Column | Type | Notes |
|---|---|---|
| quest_id | TEXT PK | |
| summary | TEXT | JSON blob: per-exercise reps/sets/PRs |
| xp | INTEGER | |
| momentum_delta | REAL | |
| disciplined_exit | INTEGER | 0/1 |
| created_at | TEXT | |

## 5. Sync plan (post-MVP)

The framework's `sync` module is currently a stub. When real sync
lands:

- Every workout table gets a `household_id` and an `updated_at`.
- Conflict resolution is **last-write-wins per row** — workout
  sets are append-only after logging (edits within 10s are local).
- Camp + Quest tables are LWW. Momentum is recomputed on the
  device that "wins" the latest session, then synced.

These changes are additive to schema — they can be done as a
single migration when sync is needed. No design change required to
the MVP shape.

## 6. Metro config follow-up

When `apps/workout/` exists, the project's `metro.config.js` must
include `packages/*` in `watchFolders`. This is already a listed
follow-up in `MONOREPO.md` for the DWHI app — the workout app
inherits the same configuration. Plan: a single update to
`metro.config.js` once either app starts importing from `@dwhi/*`.

## 7. Test infrastructure

The existing `jest.config.js` already globs
`packages/*/src/**/__tests__/**/*.test.ts`. A new
`packages/workout-domain` is automatically picked up. No config
change needed.

`tsconfig.json` paths must add:

```json
"@dwhi/workout-domain":      ["./packages/workout-domain/src/index.ts"],
"@dwhi/workout-domain/*":    ["./packages/workout-domain/src/*"]
```

And mirror the alias in `jest.config.js` `moduleNameMapper`. The
next branch handles both.

## 8. CI / build implications

- No new app build is needed in MVP for CI — the workout app's
  build can be opt-in via a separate Expo profile (EAS) when it's
  ready to deploy. CI for *this* design branch is the same as
  always: `npm test`, `tsc --noEmit`, `expo config --type prebuild`
  for the existing DWHI app.
- `expo config --type prebuild` should keep passing — design docs
  don't touch `app.json` / `app.config.js`.

## 9. Branch sequencing

This is the recommended branch lineage downstream of this design
branch:

1. `claude/workout-rpg-design-q31Jk` (this branch — design only)
2. `claude/workout-rpg-scaffold-<token>` — create
   `packages/workout-domain` shell + `apps/workout` shell, wire
   tsconfig + jest aliases, add barrel smoke tests. No screens.
3. `claude/workout-rpg-combat-core-<token>` — implement
   `damage()`, `fatigue()`, `crit()`, `questXp()` with golden tests.
4. `claude/workout-rpg-momentum-<token>` — implement
   `recomputeMomentum()`, tiers, return bonus.
5. `claude/workout-rpg-mvp-ui-<token>` — Battle / Rest / Reward
   screens, zustand store, SQLite repos wired to the pure layer.
6. `claude/workout-rpg-polish-<token>` — animations, sounds, Camp
   action, history list.

## 10. What this branch leaves intact

No source files are modified. The DWHI app and the existing
packages are unchanged. The only addition is `docs/workout-rpg/`.
Build, typecheck, and tests should be exactly as green as the base
branch.
