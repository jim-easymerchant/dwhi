# 021 — Expo Go setup (and when you've outgrown it)

This document is for someone picking up the repo for the first
time and trying to run the Workout RPG on their phone. The
shortest path is Expo Go, but Expo Go does not work for every
feature. This is what to do, when, and why.

---

## 1. The fast path — Expo Go

You can preview the app on a real device in ~60 seconds:

```bash
# from the repo root
cd apps/workout
npx expo start --clear
```

`--clear` is important the first time on a machine: it nukes
the Metro cache so a stale bundle from another branch doesn't
follow you into this one.

When the QR code appears in the terminal:

1. Install **Expo Go** on your phone (App Store / Play Store).
2. Open the camera (iOS) or the Expo Go app (Android) and
   scan the QR. The bundle loads in 5–10 seconds on the same
   Wi-Fi network as your laptop.
3. The home screen should show the camp scene, the patron panel,
   and the two quest cards. Tap **Begin · Bodyweight** to enter
   the battle screen.

If the bundle never connects, walk through the [Expo Go
troubleshooting section](#3-when-things-look-wrong) before
escalating to a dev build.

---

## 2. Limitations of Expo Go for this app

Expo Go is a *generic* host: it bundles a fixed set of native
modules. The Workout RPG ships exactly one native dependency
that Expo Go may or may not have available depending on the SDK
version:

### `expo-sqlite`

Persistence (set memory, quest history, theme preference,
weight-unit preference, cumulative XP) lives in a local SQLite
database via `expo-sqlite`. The boot code in
`apps/workout/app/_layout.tsx` does its best to load it
gracefully:

  - Lazy `require('expo-sqlite')` inside `useEffect`, never at
    module load time.
  - Feature-detects `openDatabaseAsync` before calling it.
  - On any failure, the app flips into **memory-only mode**.
    The dev-only diagnostic banner on the home screen shows
    the exact error message so you can decide what to do.

In Expo Go that means:

  - Set memory + momentum + level + theme + unit preference do
    **not** survive a process restart.
  - The app remains fully playable for the session.
  - There is a small `PERSISTENCE DISABLED` banner on the
    home screen in dev builds only.

The persistence layer auto-recovers the next time you launch a
proper build (dev client / APK / TestFlight). Nothing is lost
on the database side; you've just been writing to a no-op in
the meantime.

### Other features that are Expo-Go-safe

The rest of the stack is engineered specifically to work in
Expo Go:

  - No Reanimated.
  - No Skia.
  - No Canvas.
  - No native gesture handlers beyond the SafeAreaView/StatusBar
    that Expo Go already ships.
  - Sprites are View-based pixel art (nested coloured Views).
  - The camp scene's flame animation uses the built-in
    `Animated` API, not Reanimated.

So everything *except* persistence runs the same way in Expo
Go as in a dev build.

---

## 3. When things look wrong

| Symptom                                  | Likely cause                                              | Fix                                                              |
| ---------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------- |
| QR scan opens Safari / browser           | iOS only — open Expo Go first, then scan from inside it.  | Use the in-app scanner.                                          |
| "Could not connect to server" red screen | Laptop and phone on different Wi-Fi.                      | Same network. Try `npx expo start --tunnel`.                     |
| Old screen / wrong theme                 | Metro cache still has the previous branch.                | `npx expo start --clear`.                                        |
| `PERSISTENCE DISABLED` banner            | Expo Go lacks the matching `expo-sqlite` native module.   | Acceptable in Expo Go. Move to a dev build to test persistence.  |
| Unit toggle resets every launch          | Preference is in `workout_settings` — needs persistence.  | Same as above — switch to a dev build.                           |
| Type errors before `expo start`          | Out-of-sync TS / lint.                                    | `cd /home/user/dwhi && npx tsc --noEmit`.                        |

---

## 4. When you need a real dev build

Move past Expo Go when **any** of the following is true:

  - You want persistence to survive process restarts (any work
    on level progression, momentum, theme stickiness, weight-
    unit stickiness needs this).
  - You want to test the household-integration foundation
    (see [022](./022-household-integration-plan.md)) — that
    branch will depend on `@dwhi/framework` membership state
    that does not survive memory-only mode.
  - You want to share a screenshot or recording with someone
    on TestFlight / internal Android testing.
  - You hit a native crash that Expo Go gives a misleading
    stack trace for.

### Dev-client build (EAS)

```bash
# from the repo root
cd apps/workout
npx expo install expo-dev-client
eas build --profile development --platform android
# (or --platform ios; --platform all for both)
```

EAS builds run in the cloud; the install link arrives in the
terminal + your EAS dashboard. Install the resulting `.apk` /
`.aab` once; from then on, `npx expo start --dev-client` from
the same Wi-Fi is enough — same QR-code flow as Expo Go, but
the bundle runs inside *your* native binary with `expo-sqlite`
fully loaded.

### Local APK / IPA

If you don't want to involve EAS:

```bash
cd apps/workout
npx expo prebuild           # generates android/ and ios/ dirs
npx expo run:android        # builds + installs on a connected device
# or: npx expo run:ios
```

This produces a native binary on disk under
`apps/workout/android/app/build/outputs/apk/...` (Android) or
inside the Xcode workspace (iOS). The trade-off is that you now
have to commit to Android Studio / Xcode locally.

---

## 5. Quick sanity checks before opening Expo Go

These ten seconds catch 80% of the "why isn't it loading"
mysteries:

```bash
# Repo root
npx tsc --noEmit            # types compile
npm test                    # 900+ tests pass
cd apps/workout && npx expo config --type prebuild
```

If those three pass and the Wi-Fi is right, the bundle will
load.

---

## 6. Summary

  - **Use Expo Go** for the fast iteration loop: layout work,
    flavour copy, theme switching, the battle screen, the
    settings UI, the patrons panel.
  - **Use a dev build** when persistence matters: anything
    around level progression, theme stickiness, unit
    stickiness, quest-history persistence, the future
    household-integration foundation.
  - **Use a release build** (TestFlight / Play Console) when
    you need to share with people who don't have your laptop.

The app is engineered to make Expo Go the default. The
escalation path is well-trodden — `expo-dev-client` slots in
with one install command — but you don't owe yourself the
escalation until persistence shows up in your task list.
