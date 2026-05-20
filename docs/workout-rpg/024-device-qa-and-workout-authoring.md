# 024 — Device-QA fixes + workout authoring foundation

Two related deliverables in one branch:

1. **Five device-QA fixes** from the first real-device pass on
   the previous UI-polish branch (023). Header was still
   visually constrained, the sign sat under Android status
   icons, the patrons section duplicated itself, the player HP
   bar never moved, the rest-timer never appeared at the right
   moment.
2. **Workout authoring foundation** — a pure-data + parser +
   library + import-screen pipeline so users are no longer
   stuck with only Push Day. Built-in templates (Push / Pull /
   Legs / Full Body / Recovery), a plain-text import format,
   and a local SQLite repo with a memory-only fallback. Quest
   integration in this branch is intentionally "highlight + UI"
   rather than "rewire the orchestrator" (documented limitation).

All work is additive. Zero new dependencies. The orchestrator's
combat math is untouched. No Supabase, no auth, no sync, no
Pantry changes.

---

## 1. Header is now truly full-bleed

### Before

The TavernSceneFrame used a captured `Dimensions.get('window').width`
at module-load time. On some devices that value was either
stale (after a rotation) or never set to the device width at
all — so the scene rendered narrower than expected and still
felt like a card.

### After

- `useWindowDimensions()` hook is read **per render** — the
  scene width is always live and responds to rotation.
- The negative horizontal margin still cancels the parent
  ScrollView's padding so the scene reaches the screen edges.
- No card chrome on the canvas: no border, no rounded corners,
  no surface background.
- A pinned 230-pixel-tall canvas owns the top ~30% of viewport.
- A three-band bottom vignette (View overlays at increasing
  background-color opacity) fades the scene into the page.

### Files

- `apps/workout/src/components/tavern/TavernSceneFrame.tsx`

### Tests

`tests/deviceQaFixes.test.ts §full-bleed + safe-area handling`
greps for `useWindowDimensions`, `viewportWidth`, and the
absence of any `Dimensions.get('window')` call.

---

## 2. Sign + settings no longer hide under Android status icons

### Cause

The CampScene canvas reaches behind the system status bar
(intentional — "dominant header" effect). The interactive
overlays — the Iron Quest sign and the settings gear — were
positioned at a static `top: workoutSpacing.sm`, which on
Android phones with a tall status-bar inset put them *behind*
the status-bar icons and made them un-tappable.

### Fix

- The scene-frame now pulls `useSafeAreaInsets()` from
  `react-native-safe-area-context`.
- An `overlayTop = insets.top + workoutSpacing.sm` is computed
  per render.
- Both the sign (`top: overlayTop, left: sm`) and the gear
  (`top: overlayTop, right: sm`) use this value via inline
  styles.
- The canvas itself ignores the inset — the room visually
  "owns" the top edge.

### Files

- `apps/workout/src/components/tavern/TavernSceneFrame.tsx`

### Tests

`tests/deviceQaFixes.test.ts §full-bleed + safe-area handling`
asserts that `useSafeAreaInsets` is imported and that
`insets.top + workoutSpacing.sm` is wired to `top: overlayTop`
in the JSX.

---

## 3. Duplicate "TONIGHT'S PATRONS" collapsed into one block

### Cause

The HomeScreen mounted both `PatronsPanel` (dynamic coach
archetypes) and `AmbientPanel` (static environmental blurbs).
Iron Quest gave them confusingly similar labels ("THE
REGULARS" + "TONIGHT'S PATRONS"); the player saw two NPC lists
where one was expected.

### Fix

- `AmbientPanel` removed from HomeScreen entirely.
- IQ's `worldState.patronSectionLabel` reverts to **"TONIGHT'S
  PATRONS"** — that's the recognisable Iron Quest phrasing.
- Momentum keeps **"Voices around the fire"** — the quiet-mythic
  framing.
- The `AmbientPanel` component itself is preserved (it's still
  exported from the tavern barrel) for any future use; only
  the HomeScreen mount is gone.

### Files

- `apps/workout/src/screens/HomeScreen.tsx`
- `apps/workout/src/theme/ironQuestClassicTheme.ts`

### Tests

`tests/deviceQaFixes.test.ts §single patron block`:
  - `PatronsPanel` is mounted exactly once
  - `AmbientPanel` is not mounted and not imported

---

## 4. Player HP bar actually moves now

### Cause

The "YOU" HP bar always rendered at 100%. The previous branch
shipped `playerHp.total` as a derived value with no
in-encounter mutation — so the bar was visually fake.

### v1 model

A simple current/max model:

  - `playerMaxHp` is captured at quest start from the existing
    pure formula:
    `BASE_PLAYER_HP + min(recent, 14)*3 + level*4 + clamp(mom,0,100)*0.2`.
  - `playerCurrentHp` is initialised to `playerMaxHp`.
  - **Each `enterRest()` transition** (= after the player has
    attacked and the enemy is "winding up") shaves a small,
    deterministic amount off `playerCurrentHp`:

    ```
    pressure = PHASE_DAMAGE_BASE + enemyPhaseIndex * PHASE_DAMAGE_STEP
             = 6 + (phaseIndex * 2)
    ```

    So phase 0 = -6 HP per rest; phase 1 = -8; phase 2 = -10.

  - `playerCurrentHp` is clamped at `MIN_PLAYER_HP_FLOOR = 1` —
    the bar **never collapses** (no defeat state in this v1; no
    shame mechanics).
  - `returnToCamp()` resets `playerCurrentHp` back to
    `playerMaxHp` — a clean slate.

### Non-negotiables

  - **No body-weight tie-in.** The pure formula in
    `apps/workout/src/combat/playerHp.ts` has no bodyweight
    field; this branch did not change that.
  - **No punishment.** Skipped days do not reduce HP between
    quests. HP is only ever reset *upward* at quest start.
  - **Bounded.** Min 1, max = the at-start value.
  - **Deterministic.** Same inputs always produce the same HP.

### Battle screen

The bar now reads:

```
YOU                                            LVL 4
█████████████████░░░░░░░░░░░░░░░░░░░░░░
118 / 153  ·  77%
```

The bar visibly shrinks each rest cycle; the text below
shows current/max + percent.

### Files

- `apps/workout/src/state/workoutGameStore.ts` (state +
  `enterRest` + `startQuest` + `returnToCamp`)
- `apps/workout/src/screens/BattleScreen.tsx` (current/max
  rendering)

### Tests

`tests/deviceQaFixes.test.ts §player HP current/max model`:
  - `startQuest` seeds current = max from the pure formula
  - `enterRest` shaves a deterministic amount
  - 200 rest cycles never drop below the floor of 1
  - `returnToCamp` resets to max
  - phase-2 pressure > phase-1 pressure

---

## 5. Rest timer fixes

### Cause

The rest-timer chips were mounted on `BattleScreen` and gated
on `log.length > 0 && !victoryAvailable`. The player NEVER saw
them — `BattleScreen` early-returns `<RestScreen />` when
`phase === 'rest'`, which happens *immediately* after an
attack. So the timer was rendered to a screen that was
unmounted the same render tick.

### Fix

- `RestTimer` mount is removed from `BattleScreen`.
- It is added to `RestScreen` instead — where it belongs.
- The `useRestTimer()` hook is created on the RestScreen so
  the timer's state is tied to the rest-period lifecycle.
- The chips are offered unconditionally on the RestScreen
  (`offerWhenIdle` is true) — the player is already in a rest
  context, no extra gating needed.
- The "I'm ready" button still ends the rest immediately,
  regardless of timer state. The timer **never blocks**.

### Preset correctness

The 60 / 90 / 120 chips each call `timer.start(60)`,
`timer.start(90)`, `timer.start(120)`. The reducer's
`START` action clamps to `[1, 3600]` (so absurd values can't
break it). A regression test exercises each preset across the
full duration:

```
START(90) → running, remainingSeconds=90, presetSeconds=90
89 × TICK → running, remainingSeconds=1
1 × TICK  → complete
```

…and the same for 60 and 120.

### Files

- `apps/workout/src/screens/RestScreen.tsx` (timer mount + hook)
- `apps/workout/src/screens/BattleScreen.tsx` (timer mount removed)

### Tests

`tests/deviceQaFixes.test.ts §rest timer presets` + `§rest
timer placement` verify both the preset correctness and the
new mount location.

---

## 6. Workout authoring foundation

The brief: "Users should not be stuck with only Push Day."
This branch ships the minimum-viable foundation — types,
built-in templates, a plain-text parser, persistence, and a
library screen.

### Module layout

```
apps/workout/src/workouts/
  types.ts        — pure types: WorkoutTemplate, WorkoutExercise,
                    WorkoutImportResult, WorkoutModality, ExerciseInputKind
  builtins.ts     — five built-in templates
  parser.ts       — parseWorkoutText / parseExerciseLine (pure)
  library.ts      — listAllTemplates / addImportedTemplate / etc.
  index.ts        — barrel
```

```
apps/workout/src/persistence/workoutTemplateRepository.ts
                  — local SQLite repo for imported templates
                    (built-ins live in code, never in this table)
```

```
apps/workout/src/screens/WorkoutLibraryScreen.tsx
                  — library + import + preview UI
```

### Types

```ts
type WorkoutModality = 'bodyweight' | 'weighted';
type ExerciseInputKind = 'reps' | 'amrap' | 'time';

interface WorkoutExercise {
  id: string;
  name: string;
  archetype: ExerciseArchetype;     // from @dwhi/workout-domain
  profile: ExerciseProfile;          // same — drives orchestrator math
  modality: WorkoutModality;
  inputKind: ExerciseInputKind;
  defaultSets?: number;
  defaultReps?: number;              // OR duration in seconds if inputKind='time'
  defaultWeightKg?: number;          // canonical kg storage
  defaultRestSeconds?: number;
  equipmentLabel?: string;
}

interface WorkoutTemplate {
  id: string;
  name: string;
  description?: string;
  defaultModality: WorkoutModality;
  exercises: readonly WorkoutExercise[];
  source: 'builtin' | 'import';
  createdAtIso: string;
}

interface WorkoutImportResult {
  template: WorkoutTemplate;
  warnings: readonly WorkoutImportIssue[];
  errors: readonly WorkoutImportIssue[];
}
```

### Built-in templates

| id                | name               | exercises             | default modality |
| ----------------- | ------------------ | --------------------- | ---------------- |
| push-day          | Push Day           | 4 (bench, OHP, tri, pushup) | weighted   |
| pull-day          | Pull Day           | 4 (row, pulldown, inverted, curl) | weighted |
| legs-day          | Legs Day           | 4 (squat, RDL, lunge, calf) | weighted   |
| full-body         | Full Body          | 4 (squat, push, pull, plank) | bodyweight |
| recovery-mobility | Recovery / Mobility | 4 (cat-cow, stretch, bridge, box-breath) | bodyweight |

### Import format

```
Workout: My Push Day
Description: A push-day variation.
Bench Press 3x10 @ 135 lb, rest 90s
Shoulder Press 3x8 @ 65 lb
Triceps Extension 3x12
Pushup 3xAMRAP
Plank 3x45s
# comment lines start with # or //
```

Grammar notes:
  - `Workout: <name>` — optional, picked up by the parser as
    `template.name`. First match wins; subsequent headers emit a
    warning.
  - `Description: <text>` — optional, captured as
    `template.description`.
  - `<Name> <sets>x<reps>` — required for every exercise line.
    Reps can be a number, `AMRAP`, `Max`, or `<n>s` (timed).
  - `@ <weight> <unit>` — optional. Units: `lb` / `lbs` / `kg` /
    `kgs`. `@ bodyweight` / `@ bw` marks the line as
    bodyweight.
  - `, rest <n>s` — optional. Trailing rest-period clause.

Parser invariants:
  - **Pure.** Never throws. All issues come back via
    `warnings` and `errors`.
  - **Tolerant.** Unparseable lines become warnings and are
    dropped; the rest of the template still parses.
  - **Unit-aware.** lb values are converted to canonical kg
    via the NIST factor.

### Persistence

- New schema table `workout_templates`:
  ```
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at_iso TEXT NOT NULL,
  updated_at_iso TEXT NOT NULL
  ```
- Hydration pulls every row via `loadAllWorkoutTemplates()` and
  seeds the in-memory library via
  `setImportedTemplatesForHydration(...)`.
- Imports go through `persistImportedWorkoutTemplate(template)`
  (fire-and-forget). The in-memory library is updated
  synchronously by `importWorkoutFromText(...)`; persistence is
  best-effort.
- **Memory-only mode**: when persistence is disabled (Expo Go
  without expo-sqlite, hydrate failed, etc.) the import still
  works for the running session. The library screen surfaces a
  small "Memory-only mode — imports live for this session"
  note in that case.

### UI

`WorkoutLibraryScreen` reachable from the HomeScreen's
"Workouts" panel (Manage button). Shows:
  - The active template card (name + 4 exercise names + a
    "BUILT-IN" / "IMPORTED" tag).
  - The full library list with every built-in and import,
    selectable.
  - An import paste box + Preview + Save buttons.
  - The parsed preview (warnings + errors inline).
  - "Return to Camp" exit.

### Quest integration — what's wired vs. what's deferred

| feature                              | status      |
| ------------------------------------ | ----------- |
| Built-in templates ship + listed     | ✅          |
| Plain-text import works              | ✅          |
| Persistence + memory-only fallback   | ✅          |
| Library screen reachable from home   | ✅          |
| Active template highlight in store   | ✅          |
| Home's "Active workout" surface      | ✅          |
| Tapping `Begin · Bodyweight/Weighted` runs the *selected template's exercises* through `runQuest()` | **deferred** |

The orchestrator's encounter is still the Push Day fixture in
v1. Selecting "Legs Day" on the library screen and then
tapping `Begin · Bodyweight` on home will still spawn the Push
encounter — the user sees their selected template's name on
the home screen, but the combat exercises are still
Push-Day's.

This is the smallest honest cut. The full template→encounter
wire requires refactoring the store's hardwired
`PUSH_ENCOUNTER` / `findVariant()` machinery to read from the
selected template, which is a separate branch's worth of
work. Branch 025 is a natural place to land it.

### Files (summary)

```
apps/workout/src/workouts/types.ts                       (new)
apps/workout/src/workouts/builtins.ts                    (new)
apps/workout/src/workouts/parser.ts                      (new)
apps/workout/src/workouts/library.ts                     (new)
apps/workout/src/workouts/index.ts                       (new)
apps/workout/src/persistence/workoutTemplateRepository.ts (new)
apps/workout/src/persistence/schema.ts                   (+ table)
apps/workout/src/persistence/index.ts                    (re-export)
apps/workout/src/screens/WorkoutLibraryScreen.tsx        (new)
apps/workout/app/index.tsx                               (dispatch)
apps/workout/src/state/workoutGameStore.ts               (+ phase + actions)
apps/workout/src/state/persistenceBridge.ts              (+ hydrate + save)
apps/workout/src/screens/HomeScreen.tsx                  (Workouts panel)
```

---

## 7. Constraints respected

  - **No new dependencies.** `apps/workout/package.json` and
    root `package.json` unchanged.
  - **No Supabase / auth / sync / pantry changes.**
  - **No workout-domain combat-balance rewrites.** Orchestrator
    math is untouched. The new player-HP pressure model lives
    in `apps/workout/`, not in the domain package.
  - **No runtime imports from `reference/ironquest`.** Grep
    regression in `deviceQaFixes.test.ts` confirms.
  - **Theme system preserved.** Sign / patrons / weather copy
    all still flow through `ThemePack`.
  - **Unit preference (lb/kg) preserved + extended.** The
    parser routes lb inputs through the existing
    `convertLbToKg` helper from the units module.
  - **DISABLE_PERSISTENCE_BOOT** still respected — when the
    bridge is bypassed, the workout library degrades to
    memory-only with a visible note.

## 8. Testing summary

| suite                                  | tests | status |
| -------------------------------------- | ----- | ------ |
| `workoutParser.test.ts` (new)          | 32    | pass   |
| `workoutLibrary.test.ts` (new)         | 13    | pass   |
| `deviceQaFixes.test.ts` (new)          | 31    | pass   |
| `uiPolish.test.ts` (updated)           | 27    | pass   |
| `tavernLayout.test.ts` (updated)       | 21    | pass   |
| Full DWHI suite                        | 1104  | pass   |
| `tsc --noEmit`                         | —     | clean  |
| `cd apps/workout && npx expo config --type prebuild` | — | resolves |
