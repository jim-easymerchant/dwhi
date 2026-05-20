# 025 — Template → Quest integration

The bridge between the workout library (branch 024) and the
actual combat orchestrator. Until this branch, importing a
workout or picking "Pull Day" from the library only updated the
home-screen highlight — every quest still ran the hardwired
Push Day fixture. Now the selected template drives the actual
battle: variants, enemy flavour, set memory keys, reward
summary, and the persisted quest-history row all reflect what
the user chose.

The change is additive and contained:

  - **One new pure adapter** —
    `apps/workout/src/workouts/templateToQuest.ts` — converts a
    `WorkoutTemplate` into the existing `Encounter` /
    `QuestDefinition` / `EnemyInput` shapes the battle pipeline
    already understands.
  - **Three new store fields** — `activeEncounter`,
    rebuilt at `startQuest()` time (and eagerly on
    `setSelectedTemplate`), plus the persisted selection.
  - **Zero combat-math changes.** The orchestrator (`runQuest`,
    `questXp`, `momentum`) is untouched.
  - **Set memory preserved.** Existing Push Day memory keys
    (`pushup|bodyweight|pushup|0`) still resolve because the
    template-driven encounter keeps the same variant ids.

---

## 1. Architecture

### Before

```
            ┌─ PUSH_ENCOUNTER ─┐
HomeScreen ─┤ SLUGGARD          ├──→ runQuest(...)
            │ PUSH_DAY_QUEST    │
            └──────────────────┘

Selecting another template only changed labels.
```

### After

```
WorkoutTemplate (built-in or imported)
        │
        ▼
templateToRuntimeEncounter(template)
        │
        ▼
RuntimeEncounter {
  encounter:   Encounter { bodyweightStrategies[], weightedVariants[] },
  quest:       QuestDefinition { plannedSetCount, kind, templateId },
  primaryEnemy: EnemyInput,
  nextPhaseEnemy(prevMaxHp) → EnemyInput,
  workoutName, workoutDescription, templateId,
}
        │
        ▼
   store.activeEncounter (always non-null)
        │
        ▼
runQuest({ quest, enemy, sets, ... })  ← unchanged orchestrator
```

### Adapter contract

`templateToRuntimeEncounter(template)` is **pure**:

  - Same input → same output (string-hashed enemy picks,
    deterministic).
  - Never reads from the store.
  - Never touches persistence.
  - Never mutates the input template.

The store calls it twice:

1. On `setSelectedTemplate(id)` — to update `activeEncounter`
   eagerly so home-screen surfaces (workout name, exercise
   preview, threat-line enemy) reflect the change before the
   first quest.
2. On `startQuest(modality)` — to rebuild from the
   currently-selected template, in case the runtime encounter
   was seeded from a stale persisted id and the template now
   exists.

---

## 2. Runtime flow

```
1. Player opens the app
   → hydratePersistence() runs
     - loads SUM(quest_history.xp), session count, etc.
     - loads stored selected-workout-template-id
     - resolves to a template (falling back to 'push-day')
     - sets store.selectedTemplateId AND store.activeEncounter

2. Player taps "Manage" on the home screen
   → phase = 'workouts'  → WorkoutLibraryScreen mounts
   → picks a template (e.g. Pull Day)
     - setSelectedTemplate(id) eagerly rebuilds activeEncounter
     - bridge persists selectedTemplateId to workout_settings
   → taps "Begin Selected Workout"
     - startQuest(modality) re-builds activeEncounter (idempotent)
     - currentEnemy = activeEncounter.primaryEnemy
     - currentVariantId = first variant in the chosen modality
     - phase = 'battle'

3. Player attacks
   → logCurrentSet() projects damage via the active runtime
     encounter's quest + variants
   → enterRest() → RestScreen
   → endRest() → BattleScreen (variant chooser still available)

4. Player wins or finishes
   → continueAfterVictory() uses
     activeEncounter.nextPhaseEnemy(prevMaxHp)
   → finishQuest() calls runQuest({
       quest: activeEncounter.quest (with expansion),
       enemy: activeEncounter.primaryEnemy,
       sets: buildSetInputsFromLog(log, ..., activeEncounter.encounter),
       ...
     })
   → handlers.onQuestCompleted({ templateId, kind, workoutName, ... })

5. RewardScreen
   → shows the workout name ("PULL DAY") above the headline
   → lists distinct exercises actually performed
```

---

## 3. Sample mapping — an imported workout → playable battle

Input (paste-import box):

```
Workout: Garage Chest
Bench Press 3x10 @ 135 lb, rest 90s
Shoulder Press 3x8 @ 65 lb
Pushup 3xAMRAP
Plank 3x45s
```

After parse + adapter:

```
RuntimeEncounter {
  templateId: 'garage-chest',
  workoutName: 'Garage Chest',
  encounter: {
    id: 'garage-chest',
    name: 'Garage Chest',
    bodyweightStrategies: [
      { id: 'pushup', name: 'Pushup',  archetype: 'pressure',  defaultReps: undefined (AMRAP) },
      { id: 'plank',  name: 'Plank',   archetype: 'foundation', defaultReps: 45 (seconds) }
    ],
    weightedVariants: [
      { id: 'bench-press',   name: 'Bench Press',   archetype: 'heavy', defaultReps: 10, defaultWeightKg: 61.23 (≈135 lb) },
      { id: 'shoulder-press', name: 'Shoulder Press', archetype: 'heavy', defaultReps:  8, defaultWeightKg: 29.48 (≈65 lb) }
    ],
  },
  quest: { id: 'garage-chest', kind: 'strength', templateId: 'garage-chest', plannedSetCount: 12 },
  primaryEnemy: {
    id: 'enemy-garage-chest',
    name: 'The Sinking Stone',          // dominant archetype = 'heavy' → ward/stone vibe
    category: 'ward', mood: 'stone',
    maxHp: 12 * 60 = 720
  },
  nextPhaseEnemy(720) → maxHp 360, id 'enemy-garage-chest-shadow'
}
```

The BattleScreen displays:

```
GARAGE CHEST
Bench Press · Encounter 1 of 2
─────────────────────────────
THE SINKING STONE
720 / 720 HP · 0% dealt
```

The variant chooser exposes both weighted exercises; switching to
Shoulder Press flips `currentExerciseIndex` to "2 of 2".

After the quest finishes the RewardScreen shows:

```
GARAGE CHEST
The Sinking Stone receded.
Steady
[XP / Ember / Damage stats]
EXERCISES COMPLETED
· Bench Press
· Shoulder Press
```

---

## 4. Set-memory migration

The store's set-memory key is unchanged:

```
memoryKey({ exerciseId, modality, variantId, setIndex })
  = `${exerciseId}|${modality}|${variantId}|${setIndex}`
```

The adapter passes `exercise.id` directly into the runtime
variant's `id`. The built-in Push Day template (`BUILTIN_PUSH_DAY`)
ships the same five bodyweight ids (`pushup`, `pike-pushup`,
`diamond-pushup`, `incline-pushup`, `knee-pushup`) and three
weighted ids (`bench-press`, `shoulder-press`,
`triceps-extension`) that the legacy `PUSH_ENCOUNTER` fixture
exposed. So existing memory rows resolve identically.

A regression test in `questIntegration.test.ts §set-memory keys
are template-driven` pins this:

```ts
useWorkoutGameStore.setState({
  setMemory: {
    'pushup|bodyweight|pushup|0': { reps: 18, ... },
  },
});
api.startQuest('bodyweight');
expect(store.draftReps).toBe(18);   // prefilled from memory ✓
```

User-imported templates produce new variant ids (slugified from
the exercise name — "Zercher Squat" → "zercher-squat"), so they
get a fresh memory namespace without collision.

---

## 5. Enemy generation rules

```
dominantArchetype = mode-of(template.exercises.map(e => e.archetype))

vibe = {
  heavy:       { category: 'ward',             mood: 'stone', names: [Burden of Iron, The Sinking Stone, The Weighted Hush] },
  pressure:    { category: 'lesser_fragment',  mood: 'drift', names: [Sluggard…, The Drifting Weight, The Long Press] },
  control:     { category: 'lesser_fragment',  mood: 'glare', names: [The Watchful Doubt, The Held Frame, The Bright Stare] },
  foundation:  { category: 'hollow',           mood: 'hush',  names: [The Held Breath, Stillness, The Quiet Hour] },
  endurance:   { category: 'lesser_fragment',  mood: 'drift', names: [The Long Burn, The Slow Tide, The Heavy Mile] },
  recovery:    { category: 'hollow',           mood: 'hush',  names: [Knotted Drift, The Tangle, The Held Knot] },
}

enemyName = vibe.names[ stableHash(template.id) % vibe.names.length ]
enemyMaxHp = max( MIN_PRIMARY_HP, plannedSets * HP_PER_PLANNED_SET )
nextPhaseEnemy(prev) = halve(prev) floored at MIN_CONTINUATION_HP
```

Templates can opt out of auto-derivation via two optional fields:

  - `enemyOverride?: EnemyInput` — replaces the derived primary
    enemy entirely.
  - `nextPhaseEnemyOverride?: (prevMaxHp: number) => EnemyInput`
    — replaces the continuation generator.

The **Push Day built-in** sets both — `SLUGGARD` and the
legacy `getNextEnemyPhase` (Lingering Shadow) — so the canonical
encounter looks and feels exactly as it did before the adapter
landed. User imports never set these; they always go through
the auto-derivation path.

### Tuning constants (in `templateToQuest.ts`)

| name                   | value | role                                       |
| ---------------------- | ----- | ------------------------------------------ |
| `HP_PER_PLANNED_SET`   | 60    | Primary enemy HP scaling                   |
| `MIN_PRIMARY_HP`       | 120   | Floor for the primary HP                   |
| `MIN_CONTINUATION_HP`  | 40    | Floor for continuation phases              |
| `DEFAULT_PLANNED_SET_COUNT` | 6 | Empty-template fallback                    |

---

## 6. Persistence

A new column lands on the existing `workout_settings` singleton
row (additive, idempotent migration):

```sql
ALTER TABLE workout_settings ADD COLUMN workout_template_id TEXT;
```

Functions added to the theme repository (same file by design —
it's the singleton-settings repo, themes share it):

```ts
loadStoredWorkoutTemplateId(): Promise<string | null>
saveStoredWorkoutTemplateId(templateId): Promise<boolean>
```

Bridge wiring:

  - Hydrate: reads the id, resolves it against the in-memory
    template library (which has just been seeded from
    `loadAllWorkoutTemplates()`), falls back to `'push-day'` on
    unknown / null. Seeds `selectedTemplateId` and
    `activeEncounter`.
  - Save: `persistSelectedWorkoutTemplate(id)` fired from the
    store's `setSelectedTemplate` action via the persistence
    handlers registry.

Memory-only mode still works: the store keeps the in-session
selection; the persist call is a no-op.

---

## 7. Built-in template expansion

`BUILTIN_PUSH_DAY` was expanded to include every legacy
bodyweight + weighted variant the original `PUSH_ENCOUNTER`
fixture defined. That's how the canonical encounter remains
identical after the adapter: same variants, same Sluggard, same
Lingering Shadow continuation. No back-compat headache.

The other four built-ins (Pull, Legs, Full Body, Recovery)
were left at their existing 3-4 exercises each — distinct
encounter flows, distinct enemy vibes.

---

## 8. Files

```
NEW:
  apps/workout/src/workouts/templateToQuest.ts
  apps/workout/src/tests/templateToQuest.test.ts
  apps/workout/src/tests/questIntegration.test.ts
  docs/workout-rpg/025-template-to-quest-integration.md

MODIFIED:
  apps/workout/src/workouts/index.ts                (barrel)
  apps/workout/src/workouts/builtins.ts             (Push enemy override + expanded variants)
  apps/workout/src/workouts/types.ts                (override fields)
  apps/workout/src/state/workoutGameStore.ts        (activeEncounter slot + helpers)
  apps/workout/src/state/persistenceBridge.ts      (hydrate + persist template id)
  apps/workout/src/persistence/schema.ts            (workout_template_id column)
  apps/workout/src/persistence/db.ts                (idempotent ADD COLUMN)
  apps/workout/src/persistence/themeRepository.ts   (load/save template id)
  apps/workout/src/persistence/index.ts             (re-exports)
  apps/workout/app/_layout.tsx                      (handler wiring)
  apps/workout/src/screens/BattleScreen.tsx         (workout header)
  apps/workout/src/screens/HomeScreen.tsx           (preview from active template)
  apps/workout/src/screens/RewardScreen.tsx         (workout name + exercises completed)
  apps/workout/src/screens/WorkoutLibraryScreen.tsx (Begin button)
  apps/workout/src/tests/persistenceBridge.test.ts  (mock additions)
  apps/workout/src/tests/persistenceCrashFix.test.ts (mock additions)
  apps/workout/src/tests/workoutGameStore.test.ts   (new buildSetInputsFromLog signature)
  docs/workout-rpg/README.md                        (§25 index entry)
```

---

## 9. Tests

| suite                              | new tests | status |
| ---------------------------------- | --------- | ------ |
| `templateToQuest.test.ts` (new)    | 17        | pass   |
| `questIntegration.test.ts` (new)   | 21        | pass   |
| existing suites (updated mocks)    | —         | pass   |
| **Full DWHI suite**                | 1142      | **pass** |
| `tsc --noEmit`                     | —         | clean  |
| `expo config --type prebuild`      | —         | resolves |

The integration suite covers every requirement in the brief:

  - templateToQuest adapter unit-tests
  - imported workout → playable battle
  - selecting Pull / Legs changes encounter flow
  - set memory keys generalized correctly (and Push Day memory
    still resolves)
  - selected workout persistence (via the mocked bridge tests)
  - quest summary workout naming (RewardScreen reads
    `activeEncounter.workoutName`)
  - fallback behavior (unknown id keeps the previous encounter)
  - no Push hardcoding regressions (grep against the store body)
  - no runtime imports from `reference/ironquest` (grep against
    every new file)

---

## 10. Constraints respected

  - **No new dependencies.** `apps/workout/package.json` and the
    root `package.json` are unchanged.
  - **No Supabase / auth / sync.** Persistence stays local.
  - **No household implementation yet.** Doc 022 still describes
    the plan; this branch did not start it.
  - **No DWHI pantry changes.** `git diff apps/dwhi
    packages/framework` is empty.
  - **No workout-domain combat rewrites.** The orchestrator's
    `runQuest` / `questXp` / `momentum` files in
    `packages/workout-domain/` are untouched.
  - **No runtime imports from `reference/ironquest`.** Grep
    regression in `questIntegration.test.ts §no runtime imports
    from reference/ironquest` verifies the new files; the
    legacy fixture (`pushDayQuest.ts`) is unchanged.
  - **No giant class hierarchies, no monolithic screens.** The
    adapter is a single 280-line pure module; the store keeps
    its existing function-only shape; the BattleScreen +
    HomeScreen + RewardScreen got small additive edits.
  - **No drag/drop editor yet.** The library still uses the
    paste-import box.
  - **No online workout sharing.** Local SQLite only.
