# 005 — MVP Implementation Plan

> The smallest playable game that demonstrates the design bible.
> Anything not on this list is out of MVP scope.

---

## 1. MVP definition

**One class. One Quest. Three exercises. One enemy. One battle
screen. One reward screen. One Momentum meter. Local-first storage.**

The MVP user story:

> I open the app, tap **Begin**, log three sets each of three
> push-day exercises, watch Sluggard, Lord of Couches fall, and
> close the app feeling like I want to come back tomorrow.

If the team can demo that in 5 minutes and the demo-er smiles, MVP
is done.

## 2. Scope checklist

### Must have

- [ ] Single Quest template: **Push Day**.
- [ ] Three exercises with two variants each (weighted + bodyweight):
  - Bench Press / Pushup
  - Shoulder Press / Pike Pushup
  - Triceps Extension / Diamond Pushup
- [ ] One class: **Vow-Bearer** (no class selection UI; implicit).
- [ ] One enemy: **Sluggard, Lord of Couches** (HP scaled to player).
- [ ] One Battle screen.
- [ ] One Reward screen.
- [ ] Momentum meter with 5 tiers, computed offline.
- [ ] Local SQLite persistence (via `@dwhi/framework/db`).
- [ ] First-launch onboarding (3 taps to first set).
- [ ] Resume in-progress Quest within 24h.
- [ ] Camp (recovery) one-tap action.
- [ ] No accounts, no sync, no remote.

### Must not have

- Account creation, OAuth, email-OTP.
- Supabase sync.
- Multiplayer.
- Push notifications.
- Multiple Quest templates.
- Equipment / inventory.
- Body measurement entry.
- Diet tracking.
- Analytics SDK.
- Subscription / IAP.

### Should have (but cuttable)

- Sound effects for hit, crit, tier-up.
- Haptic feedback on attack.
- Quest history list ("scrolls").
- One unlockable cosmetic Ember color at Driven tier.

## 3. Feature breakdown

### 3.1 Onboarding (1 screen)

- Pick Quest (default: Push Day, pre-selected).
- Pick Equipment (default: Bodyweight, pre-selected).
- Optional: enter bodyweight (skippable → 70kg default).
- "Begin" button → first Battle.

### 3.2 Quest screen (very brief)

A thin connecting screen that shows:

- Quest name.
- Enemy preview.
- 3 exercises listed with checkmarks.
- "Start Battle 1" button.

This screen exists so transitions feel like a game, not so the user
has to read it. Auto-advance is acceptable on first-time use.

### 3.3 Battle screen

The core surface. Layout:

```
┌───────────────────────────────────┐
│  [Enemy: Sluggard]   HP ▓▓▓▓▓░    │
│         (sprite/silhouette)        │
│                                    │
│  Exercise: Pushup                  │
│  Set 2 of 3                        │
│                                    │
│   Reps: [ – ]  10  [ + ]           │
│   Weight: [ – ] 0 kg [ + ]         │  ← hidden for pure bw
│                                    │
│   ┌─────────────────────────────┐  │
│   │      🗡  ATTACK             │  │
│   └─────────────────────────────┘  │
│                                    │
│  Momentum: Steady • Ember ▓▓▓░░    │
└───────────────────────────────────┘
```

After Attack:

- Damage number floats up over enemy.
- Enemy bar drops.
- Crit fires gold burst if PR.
- Rest timer auto-starts (modal overlay, but cancellable).

### 3.4 Rest overlay

- Big countdown (60s default, adjustable per session).
- Enemy "wind-up" bar.
- "I'm ready" tap to end early.
- A rotating one-liner tip ("Drink water. Breathe.").
- Tappable to dismiss back to Battle screen if user wants to see HP.

### 3.5 Reward screen

- Animation beat: enemy falls.
- XP tally.
- Momentum delta.
- Verdict label.
- "Return to Camp" button → home.

### 3.6 Home screen

- Ember bar + tier name.
- "Start Quest" CTA.
- Small "Camp tonight" link.
- Quest history (last 5) — optional.

## 4. Data model (MVP-only subset)

See `006-monorepo-integration-plan.md` for the full proposed schema.
MVP only needs these tables in local SQLite:

| Table | Purpose |
|---|---|
| `exercise_catalog` | Seeded; the 3 exercises × 2 variants. |
| `workout_quests` | One row per Quest. |
| `workout_battles` | One row per exercise in a Quest. |
| `workout_sets` | One row per set; the source of truth. |
| `player_profile` | Single-row table with bodyweight, default rest, etc. |
| `player_momentum` | Single-row table with momentum value + timestamps. |
| `battle_results` | Denormalized cache of XP / damage per Quest, for the history list. |

No `monster_catalog` table in MVP — one enemy is hardcoded as
`enemies.sluggard` in `combatBalance.ts`.

## 5. Module layout (proposed)

This is **proposed** for the *next* implementation branch — this
design branch does not create any of these directories.

```
packages/workout-domain/
  src/
    combat/
      balance.ts          # tunable constants
      damage.ts           # damage() pure function
      crit.ts             # PR detection
      fatigue.ts          # fatigue accumulator
      questXp.ts          # XP aggregator
      __tests__/
    momentum/
      tiers.ts
      recompute.ts        # idempotent
      __tests__/
    catalog/
      exercises.ts        # MVP seed (3 × 2)
      enemies.ts          # Sluggard
    repositories/
      questRepository.ts
      battleRepository.ts
      setRepository.ts
      momentumRepository.ts
      profileRepository.ts
    types.ts
    index.ts

apps/workout/
  app/                    # expo-router screens
    _layout.tsx
    index.tsx             # home
    onboarding.tsx
    quest/
      [questId].tsx
      battle/[battleId].tsx
      reward.tsx
  src/
    components/
      EmberBar.tsx
      HpBar.tsx
      RepStepper.tsx
      RestOverlay.tsx
      AttackButton.tsx
    state/
      questStore.ts       # zustand
    assets/
  app.json
  package.json
  tsconfig.json
  README.md
```

## 6. State management

- **Zustand** for in-flight Quest state (already in DWHI's deps).
- **SQLite via `@dwhi/framework/db`** for persistence.
- Pattern: writes go to SQLite; the store is a *read-through cache*
  populated on screen mount.

## 7. Testing plan

- Pure functions only need unit tests (no RN).
  - `damage()` — golden table of inputs → expected damage.
  - `fatigue()` — accumulator across sets, floor at 0.5.
  - `crit()` — PR detection with empty history, with prior PR.
  - `recomputeMomentum()` — idempotent over a fixed timeline.
  - `tierForMomentum()` — boundary cases.
- Repositories tested with the existing `expo-sqlite` test stub
  pattern (see `test-stubs/expo-sqlite.ts`).
- No RN component tests in MVP — manual play test on device.

## 8. Tunable constants (single file)

```ts
// packages/workout-domain/src/combat/balance.ts
export const combatBalance = {
  // damage
  xpRate: 0.1,
  warmupDamageScalar: 0.25,
  critMultiplier: 1.5,
  defaultBodyweightKg: 70,
  // fatigue
  fatigueFreeSets: 2,
  fatiguePointPerSet: 1.0,
  fatiguePerPointPenalty: 0.05,
  fatigueModifierFloor: 0.5,
  // tier multipliers
  momentumMultipliers: {
    rusted: 0.9, steady: 1.0, driven: 1.1, relentless: 1.2, ascendant: 1.25,
  },
  // quest scoring
  varietyBonusPerExercise: 0.05,
  varietyBonusCap: 0.25,
  disciplinedExitBonus: 1.1,
  junkVolumeSetThreshold: 12,
  junkVolumePenaltyPerSet: 5,
  // enemies
  enemyHpFactor: 1.15,
} as const;
```

```ts
// packages/workout-domain/src/momentum/balance.ts
export const momentumBalance = {
  startingValue: 25,
  min: 5,
  max: 100,
  gainPerFullQuest: 6,
  gainPerPartialQuest: 3,
  gainPerCamp: 3,
  gainReturnBonus: 8,
  gainDailyCap: 10,
  decayGraceDays: 2,
  decayPerDayBeyondGrace: 0.5,
  tiers: [
    { name: 'rusted',     min: 0,  max: 20 },
    { name: 'steady',     min: 20, max: 40 },
    { name: 'driven',     min: 40, max: 65 },
    { name: 'relentless', min: 65, max: 85 },
    { name: 'ascendant',  min: 85, max: 100 },
  ],
} as const;
```

## 9. Acceptance — MVP demo script

A reviewer plays through the following in <= 5 minutes:

1. Fresh install → onboarding → first Battle.
2. Log 3 sets of pushups → 3 sets of pike pushups → 3 sets of
   diamond pushups, defeating Sluggard.
3. Reward screen plays.
4. Reopen app → Ember shows Steady → Camp tonight → tier holds.
5. Force a 3-day gap (or stub clock) → reopen → Return bonus fires.

Any deviation from this script that produces a shame-y message, a
crashing screen, or > 2-tap friction is a blocker.

## 10. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Damage math feels arbitrary | Add a debug overlay (off by default) that prints each multiplier. |
| Rest timer feels boring | Lock 2 days of polish for windup animation + tip rotation before MVP demo. |
| Players ignore Momentum | A/B with/without the Ember on home; favor the visible Ember. |
| Three exercises feels thin | Ship anyway — variety is post-MVP; thinness is the point. |
| Anti-grind feels punishing | The fatigue floor (0.5) + junk-volume penalty cap (only above 12 sets) should keep typical sessions unaffected. |

## 11. Out of MVP, but design-locked already

These are decided enough that the next implementation branch should
not re-debate them:

- 5 Momentum tiers, names, ranges.
- Damage formula shape (5 multipliers, bounded).
- Crit = any PR, capped at 1.5x.
- Return bonus = +8, one-shot per gap.
- Camp = +3, capped at 2 per 7 days.
- Junk-volume penalty above 12 sets per Quest.
- Disciplined Exit bonus = +10% XP, +1 Momentum.
- No accounts, no sync, in MVP.
