# 022 — Household integration plan

> This doc describes a plan. **No code in this branch.** The
> goal is to map out how the Workout RPG should eventually
> reuse the `@dwhi/framework` household/session identity layer
> without doing the work yet.

The next implementation step lives in a future branch:

**`claude/workout-rpg-household-foundation-<token>`**

---

## 1. Why now (as a doc, not yet as code)

Three things are coming together at once:

1. **Real device testing has produced first feedback.** The
   product-parity branch (this one) added user settings that
   reasonably belong to a *user*, not a device — most obviously
   the weight-unit preference (one person prefers lb, another
   prefers kg even on the same phone).
2. **DWHI Pantry already runs on `@dwhi/framework` household
   identity.** Every row that matters in the Pantry app carries
   a `household_id`; the same plumbing is the natural backbone
   when (or if) Workout grows multi-user.
3. **Persistence in Workout already lives in SQLite, not on a
   remote.** That means the household join can be added
   *purely on the local side* without inventing a sync layer.

The wrong move right now is to drop a `household_id` column
into the workout schema and hope. The right move is to
document what we'd reuse, what we'd *not* reuse, and where the
seams are — and then ship that doc before anyone writes the
SQL.

---

## 2. What "household" means in this monorepo

The `@dwhi/framework` package owns the vocabulary
(`packages/framework/src/households.ts`):

```ts
// State + identity
getActiveHouseholdId() : string | null
getActiveMemberId()    : string | null
getActiveDeviceId()    : string | null
getActiveContextOrNull()
setActiveHouseholdContext(...)

// Bootstrap (one-time, on app launch)
bootstrapHousehold({ deviceName, householdName, memberName })

// Switching households (rare)
switchActiveHouseholdToRemote(input)

// Local repo
createHousehold / createMember / createDevice / getFirstHousehold / ...
findHouseholdByRemoteId / setHouseholdRemoteId / touchDeviceLastSeen
```

Each `household` has many `members`; each `member` has many
`devices`. The active context is the (household, member,
device) triple stored device-side via
`@dwhi/framework/storage`.

The Pantry app builds every query around this triple. The
Workout app currently builds every query around an implicit
single-user singleton — `workout_settings.id = 'default'`.

---

## 3. What Workout should reuse, verbatim

These framework APIs already do the work; the Workout branch
should call them, not reimplement:

| API                                    | Reuse for                                                       |
| -------------------------------------- | --------------------------------------------------------------- |
| `bootstrapHousehold({...})`            | First-launch flow — create the device row, the singleton household, the first member |
| `getActiveHouseholdId()` / `…MemberId` / `…DeviceId` | Scope every workout repo query                                  |
| `getActiveContextOrNull()`             | Defer the home screen until the context is ready                |
| `setActiveHouseholdContext(...)`       | Multi-member households later — Member A vs Member B            |
| `switchActiveHouseholdToRemote(...)`   | Multi-device handoff, once sync lands                           |
| `findHouseholdByRemoteId` / `setHouseholdRemoteId` | Same — only useful once there is a remote ID to point at        |
| `touchDeviceLastSeen`                  | Existing recency signal — pre-existing utility                  |

The Workout app should **never** reach into `@dwhi/framework`'s
internal repositories (`createHousehold` / `createMember`
directly). The entry point is always the high-level helpers.

---

## 4. What the Workout schema should grow

The four workout tables (`workout_set_memory`,
`workout_player_momentum`, `workout_quest_history`,
`workout_settings`, `workout_personal_records`) each gain ONE
column:

```sql
-- example:
ALTER TABLE workout_quest_history
  ADD COLUMN member_id TEXT;   -- or household_id, see below
```

Two design choices for the scope column, in increasing order
of granularity:

### Option A — household-scoped only

```
member_id is OMITTED. The household owns every row.
```

This matches Pantry's current behaviour: the household is the
unit of shared state. Each person on the phone sees the same
quest history, the same level, the same XP. Simple.

### Option B — member-scoped within household

```
both household_id AND member_id are stored.
```

Each member of the household has their own quest history,
level, and weight-unit preference. The home screen has a
member chip; switching member changes context. This is the
honest model for a workout app where two roommates share the
same phone — one wants lb, one wants kg, and you can't reduce
that to a single setting.

**Recommendation: B.** The shared identity layer already
handles members; the cost of adding `member_id` is one column.
The cost of pretending the household = the user is the unit
toggle scrolling away when the roommate opens the app.

---

## 5. Per-user vs per-household — scope decisions

| state                              | scope                  | rationale                                                                  |
| ---------------------------------- | ---------------------- | -------------------------------------------------------------------------- |
| `theme_id`                         | per-member             | Personal aesthetic. Roommate A wants the Hollow; roommate B wants the Goblin. |
| `weight_unit` (lb / kg)            | per-member             | Personal preference. The feedback that prompted this branch was unit-specific. |
| Quest history rows                 | per-member             | "What did I do this week?" is a personal question.                         |
| Momentum value + tier              | per-member             | Personal trajectory; one person's relentless ≠ another person's rusted.    |
| Cumulative XP / displayed LEVEL    | per-member             | Personal milestone.                                                        |
| Set memory (the prefill cache)     | per-member             | One person's set defaults are not another person's set defaults.           |
| Personal records                   | per-member             | The "personal" is in the name.                                             |
| Recently shared scene (if/when)    | per-household          | A future "family camp" view that summarises *all* members of the home.     |
| Privacy flag ("hide from family")  | per-row, per-member    | Optional: an individual quest the player would rather not surface.         |

> **Notable:** every default piece of state today is
> *per-member*. The household is only relevant for *shared*
> visibility surfaces — which we have not built yet.

---

## 6. Privacy surface

The reason to scope per-member instead of per-device is the
existence of a future "family view" — and the *requirement*
that opting out of it is cheap.

Workout has a different privacy posture than Pantry: nutrition
data has shame and gender baggage; lifting history has less. But
it isn't zero. Two soft rules to land in the foundation branch:

1. **Default to private.** A new quest history row is visible
   only to the member who logged it, not to other household
   members.
2. **A "share with family" opt-in flag.** A single boolean per
   member, per session — or a global default flipped from
   Settings. The household-shared view only ever surfaces rows
   where the flag is true.

This shape avoids the "I forgot to opt out" failure mode that
shame-sensitive apps trip over.

---

## 7. Future sync boundary

Sync lives in `apps/dwhi/` today and is Pantry-specific. The
Workout household-foundation branch does **not** add Supabase or
remote sync. The path looks like:

1. **Foundation branch** — local-only, household_id +
   member_id columns, repo functions scoped by active context.
   *(next branch.)*
2. **Outbound sync branch** — patrol the workout outbound
   queue, exactly mirror Pantry's `outboundSync` shape. Likely
   `claude/workout-rpg-outbound-sync-…`.
3. **Inbound sync branch** — server-driven inbound apply.
   `claude/workout-rpg-inbound-sync-…`.
4. **Member switcher UI** — the home screen gains a chip /
   modal for picking the active member. Optional; can live in
   its own branch.

None of these are in scope for the immediate next step. The
**foundation** branch only needs the schema joins + the active-
context calls + a smooth fallback when the framework's bootstrap
hasn't run.

---

## 8. What to NOT do in the foundation branch

The following are explicit non-goals:

  - **No Supabase.** No `remoteRepository`. No realtime. No
    outbound queue. No anonymous-user / signed-in distinction.
    The framework's `householdRemoteId` is a column we *carry
    forward*, not one we *write to*.
  - **No auth flow.** No login screen. No "are you sure this is
    your account" dialog. The bootstrap helper already creates
    a singleton household on first launch; for the Workout
    foundation branch, that singleton is enough.
  - **No multi-household UI.** The active context can switch
    via `setActiveHouseholdContext` (used by the framework's
    test helpers); the Workout app does not need a household
    picker yet.
  - **No DWHI Pantry changes.** The framework package is
    shared; touching anything in Pantry is outside this
    branch's scope.

---

## 9. Foundation-branch checklist (for the next session)

The branch should be a *small* one. Estimated 6-8 files,
~700 lines.

  - [ ] `apps/workout/src/persistence/schema.ts` — add
    `household_id TEXT`, `member_id TEXT` to the four scoped
    tables.
  - [ ] `apps/workout/src/persistence/db.ts` — `addColumnIfMissing`
    migrations for existing installs.
  - [ ] `apps/workout/src/state/persistenceBridge.ts` — wrap
    every read/write with the active member id, falling back
    to a singleton id if the framework's bootstrap has not
    yet finished. Memory-only mode unchanged.
  - [ ] `apps/workout/app/_layout.tsx` — before
    `hydratePersistence()`, call `bootstrapHousehold(...)` so
    the active context exists.
  - [ ] Each repository function (set memory, momentum,
    history, settings, personal records) gains a `memberId`
    filter / write column.
  - [ ] Tests:
    - new persistence integration tests that hydrate two
      different `memberId`s and confirm they never see each
      other's data
    - no Supabase imports
    - no auth imports
    - HomeScreen still renders for a bootstrap-pending context
  - [ ] Doc 023 documenting the actual landing (companion to
    this plan doc).

---

## 10. Summary

| question                                              | answer                                                        |
| ----------------------------------------------------- | ------------------------------------------------------------- |
| Do we eventually want households in Workout?          | Yes.                                                          |
| What framework APIs do we reuse?                      | `bootstrapHousehold`, `getActive*Id`, `getActiveContextOrNull`. |
| Per-user or per-household state?                      | Per-member by default (theme, unit, history, XP, PRs).        |
| What is shared at household level?                    | Only opt-in "share with family" rows + future family views.   |
| What's in scope for the foundation branch?            | Schema, scoped repos, bootstrap call.                         |
| What's out of scope until later?                      | Supabase. Auth. Sync. Multi-household UI. Pantry changes.     |
| Branch name                                           | `claude/workout-rpg-household-foundation-<token>`             |
