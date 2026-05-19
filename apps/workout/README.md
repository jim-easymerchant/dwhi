# apps/workout — Momentum (Workout RPG)

Expo app shell for the Workout RPG. **MVP UI shell only.** Local /
in-memory state. The pure `runQuest()` orchestrator in
`@dwhi/workout-domain` resolves the final Quest. There is **no**
SQLite, **no** Supabase, **no** auth, **no** sync in this branch.

The existing DWHI pantry app at the repo root is untouched.

---

## Run locally

From the repo root:

```bash
npm install           # workspace install — picks up apps/workout
cd apps/workout
npx expo start        # Metro / Expo Go
```

For an Android device:

```bash
cd apps/workout
npx expo prebuild --platform android --non-interactive --clean
cd android
./gradlew assembleRelease
```

The resulting APK is at `apps/workout/android/app/build/outputs/apk/release/*.apk`.

GitHub Actions has a manual workflow `Build Workout APK (Android)`
that runs the same flow on a CI runner — see
[`.github/workflows/workout-android-apk.yml`](../../.github/workflows/workout-android-apk.yml).

---

## Layout

```
apps/workout/
  app/                       expo-router screens
    _layout.tsx              SafeAreaProvider + status bar
    index.tsx                phase-dispatching route shell
  src/
    screens/
      HomeScreen.tsx         The Camp; one CTA: Start Quest
      BattleScreen.tsx       Enemy silhouette, set entry, Attack
      RestScreen.tsx         Enemy windup; "I'm ready" exit
      RewardScreen.tsx       Verdict, XP, Ember, Return to Camp
    state/
      workoutGameStore.ts    Zustand store, in-memory only
    fixtures/
      pushDayQuest.ts        Push Day quest + Sluggard + 3 battles
    theme/
      workoutColors.ts       Ember / Stone / Ash / Hearth / Moss /
                             Tideline palette per 012 §4
    tests/
      ...                    Pure store + fixture tests
  app.json                   Expo manifest (Momentum, com.dwhi.workout)
  package.json               Workspace member; @dwhi/workout-app
  metro.config.js            watchFolders → monorepo root
  tsconfig.json              Extends root; adds @workout/* alias
```

---

## MVP flow (open-ended encounter model)

```
HomeScreen
  ↓  tap "Begin · Bodyweight" or "Begin · Weighted"
BattleScreen — Sluggard encounter
  ├─ Attack            log a set, deal damage, Rest
  ├─ Switch Strategy   (bodyweight) tap a chip to change variant
  ├─ Change Plates     (weighted)   tap a chip to change equipment
  ├─ Continue Sets     after enemy reaches 0 HP
  ├─ Finish Encounter  after enemy reaches 0 HP
  └─ Finish Quest      any time after the first set
RestScreen → BattleScreen
RewardScreen
  ↓  tap "Return to Camp"
HomeScreen
```

The Battle screen no longer auto-advances after a fixed set count.
The player decides when to switch variants and when to stop. Set
memory pre-fills the next set's reps/weight from the most recent
matching `(exerciseId, modality, variant, setIndex)` snapshot;
on first contact, defaults come from the variant. See
[`docs/workout-rpg/014-open-ended-encounters-and-set-memory.md`](../../docs/workout-rpg/014-open-ended-encounters-and-set-memory.md).

The RewardScreen reads the result of `runQuest()` from the store
and displays the verdict + XP + Ember change + enemy fate.

---

## Tone (012-battle-ux-and-feel.md)

- One CTA per screen. No "Next Quest" prompts.
- Reward screen ends in **"Return to Camp"**, never "Continue".
- Copy library: *The Ember holds. Rest is a move. The Hollow has
  felt the work. The kettle whistled and you reached for it.*
- No streak counters, no exclamation marks, no comparative copy.

---

## What's NOT in this branch

- SQLite persistence (Quest history, PRs, Momentum decay).
- Supabase sync or household integration.
- Auth (email OTP / accounts).
- Animations / sound / haptics.
- Multiple quest templates (Pull Day, Legs Day).
- Camp / recovery flow.
- Long Road / cardio / Trail Energy.
- Equipment / inventory.
- Lore journal.

Each of these lands in a subsequent branch. See
[`docs/workout-rpg/006-monorepo-integration-plan.md`](../../docs/workout-rpg/006-monorepo-integration-plan.md) §9
for the planned sequence.
