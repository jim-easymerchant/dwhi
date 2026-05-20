# 023 — UI polish: full-bleed header, player HP, rest timers

Sixth pass on the home and battle screens, addressing the device
feedback that arrived after the product-parity branch landed:

1. **True full-bleed tavern header.** The scene still looked like
   a centred card; this branch makes it dominate the top of the
   screen and bleed under the safe-area inset.
2. **Iron Quest sign positioning.** The sign was too large and
   centred; this branch shrinks it ~40% and moves it to the
   upper-left so the scene stays visible.
3. **Leveling rebalance (again).** L5 after one gym visit was
   still excessive; this branch slows the curve significantly.
4. **No duplicate "TONIGHT'S PATRONS".** The coach-archetype
   panel and the environmental-blurb panel both shared a
   heading; this branch renames the coach panel.
5. **Player HP system.** A new pure module computes readiness /
   capacity from level + recent sessions + momentum — never from
   body mass. The battle screen gets a dedicated player HP bar
   that visually mirrors the enemy HP bar.
6. **Optional rest timer.** A supportive, never-blocking
   countdown widget for after-attack breathing room.

All six changes are additive. Zero new dependencies. The
orchestrator's combat math is untouched; only the level curve
and the new player-HP module land tuning constants.

---

## 1. True full-bleed tavern header

### Before

The `TavernSceneFrame` used a `marginHorizontal: -lg` to bleed
past the parent ScrollView padding, but it still felt like a
*card* — bordered, fixed-height, alone above the rest of the
home content. The visual relationship was "screen padded; image
sits in a slot near the top."

### After

  - The frame pulls in `Dimensions.get('window').width` and
    pins itself to that width. The wrapper is now the full
    width of the device, not just "padded width plus the
    margin trick."
  - The canvas has no border, no rounded corners, no surface
    background. The scene IS the chrome.
  - `HomeScreen.tsx` switched `SafeAreaView` to `edges={['bottom']}`
    — the scene now reaches behind the status bar, occupying
    the top ~30% of the viewport (target: 28-35%).
  - A subtle bottom vignette (three thin View bands at
    increasing background opacity) fades the scene into the
    page so home content scrolling underneath feels like it
    "lifts" the scene up rather than pushing it away.

```
┌───────────── full screen width ─────────────┐
│  [sign][                       ][gear]      │  ← top-left sign, top-right gear
│       │                                     │
│       │      CampScene (centred)            │  ← dominant top 28-35%
│       │                                     │
│       └─────── vignette fade ───────────────│
│                                             │
│  [Status row, padded content below]         │
│  ...                                        │
```

### Files

- `apps/workout/src/components/tavern/TavernSceneFrame.tsx`
- `apps/workout/src/screens/HomeScreen.tsx`

### Tests

Grep regression: `tests/uiPolish.test.ts §TavernSceneFrame full-bleed`
pins `Dimensions.get('window')`, the negative-margin, the
absence of any `borderWidth` / `borderRadius` on the canvas, and
the vignette band testID.

---

## 2. Iron Quest sign positioning

### Before

The sign was a centred chrome card (max-width 92% of the scene)
that overlaid the tavern art. It read as "app branding," not
"environmental signage."

### After

  - **Anchored upper-left**, with breathing-room padding from
    the corner.
  - **Max width 160px** (down from ~92% of scene width — a ~40%
    reduction relative to a typical 400px scene wrapper).
  - **Translucent** — `rgba(8, 8, 12, 0.55)` background with
    `opacity: 0.92` on the wrapper. The scene continues to
    show *through* the sign.
  - Smaller font sizes (caption-11 title / caption-9 subtitle).
  - **Momentum theme still opts out** — no sign at all. The
    Hollow stays unannounced.

### Files

- `apps/workout/src/components/tavern/TavernSceneFrame.tsx`

### Tests

`tests/uiPolish.test.ts §Iron Quest sign positioning` checks:
top-left anchor, `maxWidth ≤ 200`, translucent rgba background,
and that Momentum still passes `undefined` for the sign props.

---

## 3. Leveling rebalance (round 2)

### Why again

The branch-022 curve was `xpForLevel(N) = floor(30 * (N-1)^1.4)`.
A typical workout earns ~150-220 XP, which under that curve
lands the player at L5 in one session (L5 = 209 XP). The brief
called that out: "Level 5 after one gym visit is excessive."

### New curve

```
xpForLevel(N) = floor(100 * (N - 1) ^ 1.7)
```

The shift: base 30 → 100 (3.3× higher entry cost), exponent
1.4 → 1.7 (a much steeper compounding).

### Anchor table

| Level | XP threshold (new) | XP threshold (old) | Realistic session count to reach (at ~200 XP/quest) |
| -----:| -----------------: | -----------------: | --------------------------------------------------- |
|   2   |             100   |              30    |  1 workout                                          |
|   3   |             324   |              79    |  ~2-3                                               |
|   4   |             647   |             144    |  ~4 (week)                                          |
|   5   |           1,055   |             209    |  ~6                                                 |
|   8   |           2,733   |             606    |  ~14 (month)                                        |
|  10   |           4,189   |             891    |  ~21                                                |
|  15   |           8,880   |           1,953    |  ~45                                                |
|  20   |          14,923   |           3,302    |  ~75                                                |
|  30   |          30,625   |           6,810    |  ~150 (year of consistency)                         |
|  50   |          74,702   |          17,143    |  ~370                                               |

### Lived experience targets (from the brief)

| Phase             | Target  | Curve check                  | Status |
| ----------------- | ------- | ---------------------------- | ------ |
| First workout     | ≤ L2    | 200 XP → L2 (just under L3=324) | ✓   |
| First week        | L3-4    | 3×200=600 → L3                | ✓     |
| First month       | L6-8    | 12×200=2,400 → L7             | ✓     |
| 3 months consistent | L12-18 | 36×200=7,200 → L13           | ✓     |
| 1 year            | L30+    | 150×200=30,000 → L29 / 200×200=40k → L31 | ✓ (band)|

The "L30 at one year" target is fuzzy — 150 sessions × exactly
200 XP lands one short of L30 (30,625). A slightly stronger year
crosses cleanly. The test asserts L29+ at 150 sessions and L30+
at 200 sessions.

### What is unchanged

  - **No decay.** Monotonic only. Skipped weeks do not reduce
    cumulative XP.
  - **No reconnection to momentum.** LEVEL stays decoupled.
    Momentum is the Ember bar; LEVEL is long-term identity.
  - **Combat math.** The orchestrator's `questXp.ts` and
    `balance.ts` are untouched. Only the *display curve* moved.

### Files

- `apps/workout/src/leveling/levelCurve.ts`
- `apps/workout/src/tests/leveling.test.ts`

---

## 4. No duplicate "TONIGHT'S PATRONS"

### Cause

Two distinct sections both rendered "TONIGHT'S PATRONS" for the
Iron Quest theme:

  - `ambient.sectionLabel` (used by `AmbientPanel`) — the
    environmental tavern characters (Bartender, Dog…) — atmospheric
    blurbs static to the theme + tier.
  - `worldState.patronSectionLabel` (used by `PatronsPanel`) —
    the coach / guidance archetypes (Spotter, Hearthkeeper…) —
    dynamic per-day picks from the patron roster.

Same words. Two different sources. Confusing.

### Fix

The **environmental** label (the IQ "Bartender / Dog / Bard" list)
keeps `TONIGHT'S PATRONS` — that's the exact phrasing the player
will recognise from the IQ reference.

The **coach** label is renamed per theme:

| Theme              | Old                  | New                       |
| ------------------ | -------------------- | ------------------------- |
| Momentum           | "Tonight at the hearth" | "Voices around the fire"   |
| Iron Quest Classic | "TONIGHT'S PATRONS"  | **"THE REGULARS"**        |

The semantic distinction is clear:
  - **TONIGHT'S PATRONS** → who happens to be in the room.
  - **THE REGULARS / VOICES AROUND THE FIRE** → recurring people
    who train here and know the work.

### Files

- `apps/workout/src/theme/ironQuestClassicTheme.ts`
- `apps/workout/src/theme/momentumTheme.ts`

### Tests

`tests/uiPolish.test.ts §no duplicate patrons heading` pins the
fact that `ambient.sectionLabel !== worldState.patronSectionLabel`
for *every* theme, and asserts the exact new strings.

---

## 5. Player HP system

### Design intent

Enemy HP is the resistance of the encounter. Player HP is the
**readiness / capacity** the player walks in with — a *positive*
number that grows with consistency, momentum, and training
history.

Non-negotiables:

  - No body-weight tie-in. Body mass is an honest input to the
    orchestrator's damage math; it is NOT a measure of "how
    much HP a person has."
  - No punishment mechanics. Player HP never decays during a
    session, never punishes missed days, never goes negative.
  - Monotonic positive. More consistency / level / momentum
    only adds.
  - Deterministic and pure.

### v1 formula

```ts
playerHp =
  BASE_PLAYER_HP                                  // 100
  + min(recentSessions, MAX_RECENT_SESSIONS) * RECENT_SESSION_BONUS  // ×3
  + level * LEVEL_BONUS                           // ×4
  + clamp(momentum, 0, 100) * MOMENTUM_BONUS      // ×0.2
```

Constants:

| name                   | value |
| ---------------------- | ----- |
| `BASE_PLAYER_HP`       | 100   |
| `RECENT_SESSION_BONUS` | 3     |
| `MAX_RECENT_SESSIONS`  | 14    |
| `LEVEL_BONUS`          | 4     |
| `MOMENTUM_BONUS`       | 0.2   |

Round-number anchors (asserted by tests):

| profile                                  | HP    |
| ---------------------------------------- | ----- |
| Day 1, L1, momentum 25, 0 recent         | ~109  |
| One-week-in, L3, momentum 30, 3 recent   | ~127  |
| First month, L7, momentum 45, 8 recent   | ~161  |
| Year-one, L30, momentum 70, 14 recent    | ~276  |

### Inputs (and what isn't an input)

`PlayerHpInputs = { recentSessions, level, momentum }`. There is
no `bodyweight` field. Compile-time fence: a regression test
greps the source file for `bodyweight` inside the type
definition.

### Battle screen

A new `playerHpBlock` mirrors the enemy HP block in structure:

| feature             | Enemy HP                  | Player HP                |
| ------------------- | ------------------------- | ------------------------ |
| label               | "HP"                      | "YOU"                    |
| right-side tag      | "PHASE N" (multi-phase)   | "LVL N"                  |
| fill colour         | `theme.uiAccent.danger`   | `theme.uiAccent.primary` (ember/amber) |
| fill width          | shrinks as damage is dealt| always 100% (no in-session decay) |
| border              | neutral `workoutColors.border` | ember-edge (`workoutColors.emberDim`) |
| readout             | `123/540 · 77% dealt`     | `161 HP · ready`         |

The "fill always 100%" is intentional — `playerHp` represents
the player's *current readiness*, which is the value the bar
already shows. There is no in-session damage to the player. The
HP number under the bar is the readiness total. A future branch
may add fatigue mechanics that visibly drain this bar; today
the bar is the readiness frame, full and ready.

### Files

- `apps/workout/src/combat/playerHp.ts` (pure module + types)
- `apps/workout/src/combat/index.ts` (barrel)
- `apps/workout/src/screens/BattleScreen.tsx` (integration)
- `apps/workout/src/state/workoutGameStore.ts` (recentSessionsCount)
- `apps/workout/src/state/persistenceBridge.ts` (hydrate count)
- `apps/workout/src/persistence/questHistoryRepository.ts`
  (`loadSessionCountSince`)
- `apps/workout/src/tests/playerHp.test.ts`

---

## 6. Optional rest timer

### Design intent

Three rules from the brief, encoded literally:

  - **Never blocks progression.** The player can dismiss the
    timer at any time, or ignore it entirely.
  - **Supportive, not punishing.** The copy is "Rest a moment?",
    "Ready when you are.", "Timer complete." — never "WAIT",
    "RECOVERY REQUIRED", "DO NOT SKIP." The component file has
    a grep regression to enforce.
  - **No external timer libraries.** `setInterval` only.

### Architecture

The hook is a thin `useReducer` wrapper around a pure
state machine:

```
type RestTimerAction =
  | { type: 'START', seconds }
  | { type: 'TICK' }
  | { type: 'CANCEL' }
  | { type: 'ACKNOWLEDGE_COMPLETE' };

idle      -- START -->  running (clamps seconds to [1, 3600])
running   -- TICK -->   running (n-1)  OR  complete (when n==1)
running   -- CANCEL --> idle
complete  -- ACK -->    idle
*         -- START -->  running   (replaces prior; no stacking)
```

Side effects: one `setInterval(_, 1000)` while running. Cleaned
up on phase change, cancel, completion, and unmount.

The hook surface:

```ts
const timer = useRestTimer();
// timer.phase        : 'idle' | 'running' | 'complete'
// timer.remainingSeconds
// timer.presetSeconds  // null when idle
// timer.start(seconds)
// timer.cancel()
// timer.acknowledgeComplete()
```

### Component states

| `phase`    | UI                                              |
| ---------- | ----------------------------------------------- |
| `idle`     | "Rest a moment?" + three chips (60s / 90s / 120s) |
| `running`  | `mm:ss` countdown + "Resting · ready when you are." + Dismiss |
| `complete` | "Timer complete." + "Got it" acknowledge button |

### When the chips appear

The component accepts an `offerWhenIdle` prop. The BattleScreen
passes `offerWhenIdle={log.length > 0 && !victoryAvailable}` —
no nag on a fresh-start session, no nag during the victory CTA.

### Files

- `apps/workout/src/hooks/useRestTimer.ts` (pure reducer + hook)
- `apps/workout/src/components/battle/RestTimer.tsx` (component)
- `apps/workout/src/screens/BattleScreen.tsx` (integration)
- `apps/workout/src/tests/restTimer.test.ts` (reducer + copy)

---

## 7. Constraints respected

  - **No new dependencies.** `apps/workout/package.json` and root
    `package.json` unchanged.
  - **No `packages/workout-domain` changes.** The orchestrator's
    XP / momentum / damage math is untouched.
  - **No Supabase / auth / sync.**
  - **No DWHI Pantry changes.**
  - **No Skia / Reanimated / Canvas / SVG sprite systems.** All
    new visual work is plain View + Animated. The vignette is
    three overlay Views at increasing opacity.
  - **No runtime imports from `reference/ironquest`.** Concept-
    source comments still cite the reference; the grep regression
    rejects only actual `import / require / dynamic import`.
  - **No combat-math rewrites** outside the leveling display
    curve and the new Player-HP module.

## 8. Testing

| suite                                  | tests | status |
| -------------------------------------- | ----- | ------ |
| `playerHp.test.ts` (new)               | 17    | pass   |
| `restTimer.test.ts` (new)              | 21    | pass   |
| `uiPolish.test.ts` (new)               | 27    | pass   |
| `leveling.test.ts` (updated anchors)   | 23    | pass   |
| full DWHI suite                        | 1028  | pass   |
| `tsc --noEmit`                         |  —    | clean  |
| `cd apps/workout && npx expo config --type prebuild` | —  | resolves |
