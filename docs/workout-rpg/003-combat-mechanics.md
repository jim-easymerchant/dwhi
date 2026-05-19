# 003 — Combat Mechanics

> Formulas are deliberately simple, deliberately tunable. We want a
> single-page math model that any future contributor can read and
> reason about. Numbers below are starting tuning constants; the MVP
> exposes them as a single `combatBalance.ts` config.

---

## 1. Vocabulary

| Game term | Workout meaning |
|---|---|
| Quest | One workout session |
| Battle | One exercise |
| Turn | One set |
| Attack | A single set's resolved damage |
| Crit | A PR (rep, weight, or volume PR) |
| Finisher | The final set that drops the enemy |
| Enemy turn | The rest period |
| Camp | Recovery / light session |
| Campaign arc | A week's training |

## 2. Core damage formula

```
damage =
  baseAttack
  * exerciseMultiplier
  * momentumMultiplier
  * fatigueModifier
  * critModifier
```

Where:

```
baseAttack =
  effectiveReps * effectiveLoad
```

The four modifiers are bounded multipliers in `[0.4, 1.5]`.

### 2.1 `effectiveReps`

- **Weighted reps-based** (bench, squat): `reps`.
- **Bodyweight reps-based** (pushup, pullup): `reps`.
- **Timed** (plank, wall sit): `seconds / 5` rounded down. (5s ≈ 1 "rep".)
- **Distance/cardio** (future): out of MVP.

A warmup set logs but contributes `0.25 * baseAttack` (it counts as
*scouting*, not real damage).

### 2.2 `effectiveLoad`

- **Weighted**: `weightKg + bodyweightKg * bodyweightCoefficient(exercise)`.
  - Bench press: `bodyweightCoefficient = 0` (bar is the load).
  - Pushup: `bodyweightCoefficient ≈ 0.65` (roughly the load on the bar
    equivalent — well-documented in strength literature).
  - Pullup: `bodyweightCoefficient ≈ 1.0`.
  - Default for unknown: `0.5`.
- **Bodyweight without weight**: `effectiveLoad = bodyweightKg * bodyweightCoefficient`.
- **Timed**: `effectiveLoad = bodyweightKg * bodyweightCoefficient` (planks scale to bodyweight).
- If `bodyweightKg` is unknown (user hasn't entered it), use `70kg` as
  a neutral default. We never block on this.

A unit-normalization step divides by a per-exercise `loadScale` so
the resulting numbers feel like RPG damage (2-digit to 4-digit
range), not like Newton-meters.

```
baseAttack = (effectiveReps * effectiveLoad) / exercise.loadScale
```

Starting values:

| Exercise | loadScale | bwCoef | Notes |
|---|---|---|---|
| Bench press | 8 | 0 | barbell |
| Pushup | 8 | 0.65 | bodyweight |
| Shoulder press (DB) | 6 | 0 | |
| Pike pushup | 6 | 0.6 | bodyweight shoulder |
| Triceps extension | 4 | 0 | |
| Diamond pushup | 4 | 0.65 | bodyweight triceps |

### 2.3 `exerciseMultiplier`

Per-exercise drama tuning. Compounds hit harder narratively than
accessories.

| Class | Multiplier |
|---|---|
| Primary compound (bench, squat, deadlift) | 1.2 |
| Secondary compound (OHP, row) | 1.1 |
| Accessory (curls, lateral raise) | 0.9 |
| Bodyweight equivalent | 1.0 (same as the lift it replaces) |

### 2.4 `momentumMultiplier`

From the player's Momentum tier (see `004-momentum-consistency.md`):

| Tier | Multiplier |
|---|---|
| Rusted | 0.9 |
| Steady | 1.0 |
| Driven | 1.1 |
| Relentless | 1.2 |
| Ascendant | 1.25 |

Capped at +25% so showing up matters *but* a brand-new player isn't
6x weaker than a veteran. Anti-grind.

### 2.5 `fatigueModifier`

The anti-grind heart of the system. Each completed working set
within the *same Quest* adds fatigue points (see
`005-mvp-implementation-plan.md` for tunable curve).

```
fatigueModifier = clamp(1.0 - 0.05 * fatiguePoints, 0.5, 1.0)
```

Approximation:

| Sets done this Quest | fatigueModifier |
|---|---|
| 1 | 1.00 |
| 2 | 1.00 (free) |
| 3 | 0.95 |
| 4 | 0.90 |
| 6 | 0.80 |
| 8 | 0.70 |
| 12 | 0.50 (floor) |

The first 1-2 sets per exercise are unfatigued. Sets stack across
exercises with a slight discount (an exercise change refreshes 1
point of fatigue).

**Why floor at 0.5 and not 0?** Players still want a satisfying
"hit" sound even at the end of a long session. We tax efficiency,
not joy.

### 2.6 `critModifier`

A crit fires when *any* PR is set this turn:

- Rep PR (more reps at same-or-greater weight on this exercise).
- Weight PR (heavier than any prior working set).
- Volume PR (single-set tonnage record).

```
critModifier = 1.5   // on PR
critModifier = 1.0   // otherwise
```

Stacking is **disallowed** — a triple-PR set is still 1.5x, not
3.375x. We celebrate it visually instead (golden VFX, screen shake,
"LEGENDARY HIT" banner).

## 3. Enemy model

```
enemy = {
  id: string,
  name: string,
  hp: number,          // ~ 1.2x player's projected Quest damage
  attackName: string,  // flavor only in MVP
  windupSeconds: number, // matches default rest
}
```

Enemy HP is **calibrated to the player**, not fixed. The MVP enemy
("Sluggard, Lord of Couches") scales:

```
enemy.hp = 1.15 * expectedQuestDamage(player, questTemplate)
```

This guarantees the player almost always defeats the enemy *near*
the end of the planned volume — not after the first set, not 4 sets
past the planned volume. It is the difference between feeling
powerful and feeling like a treadmill.

If the player overshoots planned volume by more than 50%, the
enemy is already dead — extra sets log normally but do not deal
"on-screen" damage. (See `005` for the "shadowboxing" UX.)

## 4. Enemy turn (rest)

During rest, the enemy "winds up":

- A bar fills as rest elapses. At full, the enemy attacks.
- Enemy attack does *not* damage the player numerically. It is
  flavor (camera shake, region map flickers).
- If the player taps "Ready" before windup completes, they
  *interrupt* the enemy — small narrative win, no mechanical bonus
  (to avoid encouraging short rests).

We considered "shorter rest = bonus damage." Rejected: it encourages
unsafe pacing. Anti-grind philosophy wins.

## 5. Warmup / working / PR set distinction

| Set type | XP contrib | Damage contrib | Fatigue cost |
|---|---|---|---|
| Warmup | 0.25x | 0.25x | 0.5 pt |
| Working | 1.0x | 1.0x | 1.0 pt |
| PR (auto-detected) | 1.0x + bonus | 1.5x (crit) | 1.0 pt |

Set type is **inferred**, not chosen by the user:
- First 1-2 sets at < 70% of the day's heaviest are warmups.
- Sets matching the user's heaviest are working.
- A set that beats any previous PR is a PR set.

The user can override via long-press → "Mark as warmup," but they
shouldn't have to.

## 6. XP from a Quest

```
questXp =
  sum(set.damage * xpRate)
  * varietyBonus
  * disciplinedExitBonus
  - junkVolumePenalty
```

Where:

- `xpRate = 0.1` (i.e., 10 damage ≈ 1 XP).
- `varietyBonus = 1.0 + 0.05 * distinctExercises` (cap +25%).
- `disciplinedExitBonus = 1.1` if the user stopped within ±10% of
  planned volume; else 1.0.
- `junkVolumePenalty = max(0, totalSets - 12) * 5 XP`. (See `005`.)

## 7. Loot

MVP loot is *cosmetic and lore-only*:

- Region fragments (chunks of the world map).
- Ember motes (visual sparkles on the Momentum bar).
- "Sigil" pages (lore snippets unlocked at tier-ups).

**No equipment that changes stats** in MVP. Equipment that buffs
damage means more buttons, more inventory, more decisions before a
set — the opposite of low-friction. We add gear only if dogfooding
proves the loop is sticky without it.

## 8. Worked example

Player: 75 kg, Momentum tier Steady (1.0x), Quest = Push Day,
Equipment = bodyweight.

Battle 1: Pushups.
- Set 1: 10 reps. (warmup-eligible? No prior data → call it working.)
  - effectiveLoad = 75 * 0.65 = 48.75
  - baseAttack = (10 * 48.75) / 8 = 60.9
  - exerciseMult = 1.0 (bodyweight primary)
  - momentumMult = 1.0
  - fatigueMod = 1.0 (set 1)
  - critMod = 1.5 (first-ever logged = automatic PR)
  - **damage ≈ 91**
- Set 2: 12 reps (rep PR).
  - baseAttack = (12 * 48.75) / 8 = 73.1
  - fatigueMod = 1.0 (set 2, still free)
  - critMod = 1.5 (rep PR)
  - **damage ≈ 110**
- Set 3: 10 reps (no PR).
  - baseAttack = (10 * 48.75) / 8 = 60.9
  - fatigueMod = 0.95
  - critMod = 1.0
  - **damage ≈ 58**

Sluggard, Lord of Couches has hp ≈ 350. After 3 sets of pushups
(~260 dmg) and one set of pike pushups, the enemy falls — right on
schedule. **The math feels like an RPG, the workout feels like a
real session.**

## 9. Tunable constants summary

All of the following live in one file (`combatBalance.ts`):

```ts
export const combatBalance = {
  xpRate: 0.1,
  fatigueFreeSets: 2,
  fatiguePointPerSet: 1.0,
  fatiguePerPointPenalty: 0.05,
  fatigueModifierFloor: 0.5,
  warmupDamageScalar: 0.25,
  critMultiplier: 1.5,
  defaultBodyweightKg: 70,
  defaultLoadScale: 6,
  momentumMultipliers: {
    rusted: 0.9, steady: 1.0, driven: 1.1, relentless: 1.2, ascendant: 1.25,
  },
  varietyBonusPerExercise: 0.05,
  varietyBonusCap: 0.25,
  disciplinedExitBonus: 1.1,
  junkVolumeSetThreshold: 12,
  junkVolumePenaltyPerSet: 5,
  enemyHpFactor: 1.15,
};
```

One file. One PR to retune. No magic numbers in business logic.
