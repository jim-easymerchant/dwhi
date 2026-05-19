# apps/workout (placeholder)

This directory is the **planned home** for the second app in the
DWHI monorepo: the Workout RPG, working title **Momentum**.

**Status: placeholder.** There is no runtime entry yet. No
`app.json`, no `package.json`, no Expo Router screens. The next
implementation branch will scaffold the Expo app shell into this
directory.

---

## What this app will be

Momentum is a low-friction, ADHD-friendly tactical-RPG workout
game. A workout session is a Quest. Each exercise is a Battle.
Each set is a Turn. Rest periods are the enemy's turn. Consistency
builds Momentum — a slow-gain / slow-decay tier system that
replaces the streak.

For the design surface, read first:

- [`docs/workout-rpg/README.md`](../../docs/workout-rpg/README.md)
- [`docs/workout-rpg/001-design-bible.md`](../../docs/workout-rpg/001-design-bible.md)
- [`docs/workout-rpg/005-mvp-implementation-plan.md`](../../docs/workout-rpg/005-mvp-implementation-plan.md)
- [`docs/workout-rpg/012-battle-ux-and-feel.md`](../../docs/workout-rpg/012-battle-ux-and-feel.md)

---

## Relationship to shared packages

When the Expo shell lands, this app will consume:

| Package | Role |
|---|---|
| [`@dwhi/framework`](../../packages/framework) | Reusable infrastructure: auth, db, storage, sync (when ready). The workout app uses `@dwhi/framework/db` and `@dwhi/framework/storage` in MVP; auth / households / sync are post-MVP. |
| [`@dwhi/ui`](../../packages/ui) | Domain-agnostic React Native primitives + theme tokens. The workout app extends the theme with an Ember palette in its own `src/theme/`, app-local. |
| [`@dwhi/workout-domain`](../../packages/workout-domain) | Workout-RPG domain: exercises, archetypes, enemies, momentum, progression, battle shape, cardio, equipment. **Sibling** to `@dwhi/domain`; the two never depend on each other. |

The workout app **must not** import from
[`@dwhi/domain`](../../packages/domain) — that's the pantry-only
surface for `apps/dwhi`. This rule is enforced by smoke tests in
each domain package's `__tests__/barrel.test.ts`.

---

## Where the existing DWHI Expo app still lives

The existing pantry app's Expo entry (`app/`, `app.json`,
`app.config.js`) still lives at the repo root. The follow-up
listed in [`MONOREPO.md`](../../MONOREPO.md) is to move it into
`apps/dwhi/` as a pure structural refactor. That move is **not
part of this branch** and is not required before this app starts
scaffolding — Expo can run two apps from a workspace once
`metro.config.js` is updated to include `packages/*` in
`watchFolders`.

---

## Next steps

The branch sequence (from
[`docs/workout-rpg/006-monorepo-integration-plan.md`](../../docs/workout-rpg/006-monorepo-integration-plan.md)
§9):

1. **This branch — `claude/workout-rpg-scaffold-<token>`** —
   creates the `@dwhi/workout-domain` package shell and this
   placeholder. No screens, no formulas. ← *you are here*
2. **`claude/workout-rpg-combat-core-<token>`** — implements
   `damage()`, `fatigue()`, `crit()`, `questXp()` as pure
   functions inside `@dwhi/workout-domain/combat/` with golden
   tests. No UI.
3. **`claude/workout-rpg-momentum-<token>`** —
   `recomputeMomentum()`, tier resolution, Return bonus.
4. **`claude/workout-rpg-mvp-ui-<token>`** — Battle / Rest /
   Reward screens scaffolded into `apps/workout/app/`, wired to
   `@dwhi/workout-domain` via a Zustand store.
5. **`claude/workout-rpg-polish-<token>`** — animations, sounds,
   Camp action, history list.

Until step 4, this directory holds only this README.
