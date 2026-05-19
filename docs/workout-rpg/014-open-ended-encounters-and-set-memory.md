# 014 — Open-Ended Encounters & Set Memory

> *Lifting is not a script. It is the act of adapting under
> fatigue.*
> The first MVP shell modelled an Exercise as a fixed 3-set
> Battle. That is a logging app dressed up as a game. This
> document records the shift to an **Encounter** model — the
> player decides when the work is done.

---

## 1. From Battle to Encounter

### 1.1 The old model (MVP-1)

The first playable shell treated an exercise as a Battle of
exactly three sets. After the third set the app force-advanced
to the next exercise; after the third exercise it force-advanced
to the reward screen.

That model is wrong in three ways:

- Real lifters do not stop at "three." They stop when the set
  did not feel right, or when the time was up, or when the
  energy was elsewhere.
- "Switching exercises" is something a real lifter does for
  *reasons* (a backoff set, a strategy change under fatigue,
  trying a new variant), not because the app's index counter
  ticked over.
- The cadence of "preset → preset → preset → next" turns the
  player into a forms-filler. It is the opposite of mythic.

### 1.2 The new model

```
Quest
  └── Encounter (a "fight" — one or more enemies in series)
       ├── Strategy / Equipment variant (chosen by the player)
       │    └── Set (turn)  ← repeats until the player ends it
       │    └── Set ...
       │    └── Set ...
       ├── (player taps "Switch Strategy" or "Change Plates")
       └── Strategy / Equipment variant (a new variant)
            └── Set ...
            └── Set ...
```

The player decides:

- when to add a set,
- when to switch strategy / equipment,
- when to call the encounter complete,
- when to call the whole quest complete.

The app reads the work, keeps the memory, and quietly suggests
what was logged last time.

## 2. Set Memory

The single biggest UX improvement this document defines.

The app remembers, per **`(exerciseId, modality, variantId, setIndex)`**,
the last logged values:

```
setMemory: Record<MemoryKey, {
  reps?: number;
  weight?: number;
  durationSeconds?: number;
  recordedAtIso: string;
}>
```

`MemoryKey` is the joined string `${exerciseId}|${modality}|${variantId}|${setIndex}`.

### 2.1 Pre-fill behavior

When the player opens a set:

1. If memory exists for the exact `(exerciseId, modality, variantId, setIndex)` → pre-fill those values.
2. Else if memory exists for `setIndex - 1` of the same key → pre-fill *those* values (carry the previous set's pattern forward).
3. Else → fall back to the variant's `defaultReps` / `defaultWeightKg`.

### 2.2 Worked example

Last week's Bench Press encounter:

```
Set 1: 10 reps @ 40 kg
Set 2: 10 reps @ 30 kg
Set 3: 10 reps @ 20 kg
```

This week the player opens the Bench Press variant again. The
draft inputs fill in:

```
Set 1: 10 reps @ 40 kg     ← from memory
Set 2: 10 reps @ 30 kg     ← from memory
Set 3: 10 reps @ 20 kg     ← from memory
Set 4: 10 reps @ 20 kg     ← fallback to set 3 (most recent)
Set 5: 10 reps @ 20 kg     ← keeps falling back
```

### 2.3 Design principle

> **History should feel reflective, not judgmental.**

We never:

- compare the current set to memory aloud,
- colour memory red / green / amber,
- call out "lower than last time,"
- celebrate "higher than last time" with a non-PR flourish.

We just *show* the last value as the starting point. The PR
mechanism (in `003-combat-mechanics.md` §2.6) already handles
"you did something noteworthy."

### 2.4 What is NOT in memory (MVP)

- Cross-Quest persistence. Set memory lives **in process** for
  this branch — it survives a navigation between screens, not
  an app restart. SQLite persistence ships in
  `claude/workout-rpg-local-persistence-<token>`.
- Cross-device. There is no sync yet.
- The full history of a value (just the most recent).

## 3. Open-ended encounter actions

The Battle screen exposes the following actions. Multiple may
be visible at once; nothing is forced.

| Action | Always available? | What it does |
|---|---|---|
| **Attack** | Yes (when reps > 0) | Log the current set, deal damage, advance to Rest |
| **Rest** | Yes after an Attack | Show the Rest overlay; "I'm ready" returns |
| **Switch Strategy** | Yes (bodyweight) | Open a chooser of strategy variants |
| **Change Plates / Switch Equipment** | Yes (weighted) | Open a chooser of equipment variants |
| **Continue Sets** | After enemy defeat | Stay in the encounter; spawn a follow-up fragment |
| **Finish Encounter** | After enemy defeat OR ≥ 1 working set logged | End this encounter (in MVP: jump to Reward) |
| **Finish Quest** | After ≥ 1 working set logged | Run the full orchestrator and go to Reward |

`Attack` does NOT auto-advance to the next "preset exercise."
The current variant stays the active variant until the player
chooses otherwise. The set index ticks up. Defaults pre-fill
from memory.

## 4. Enemy continuation

When enemy HP reaches zero:

- The Battle screen shows the enemy at `0 / max` with a
  thinned silhouette.
- A short flavour line appears: *"The Sluggard thins."*
- The Attack button is hidden in favour of two CTAs:

  - **Continue Sets** — keep the encounter going. The store
    spawns a follow-up *fragment* (a smaller enemy with its
    own name and HP). The shell currently uses a single
    follow-up: **The Lingering Shadow**, sized at roughly
    one-third of the original enemy's HP. Subsequent
    continuations spawn another fragment with HP scaled to
    half of the previous fragment's HP, floored at a small
    constant.

  - **Finish Encounter** — accept the victory and walk away.
    The encounter is done. The Reward screen displays a
    *Finisher* verdict.

The continuation behavior is **strictly opt-in**. It exists so
a lifter who wants a "drop set" tail or a "burnout" finisher
has a system for it. It is **not** the recommended path. The
verdict library never reads "you should keep going" to a player
who chose Finish Encounter.

### 4.1 Anti-grind safeguard

Continuation does not amplify rewards. The XP soft cap from
`011-progression-and-rewards.md` §7.1 still bites past planned + 30%
sets. A player who continues for ten extra sets does *not* earn
ten extra sets' worth of XP — the orchestrator zeroes the late
sets' XP contribution and applies the junk-volume penalty.

## 5. Strategy variants (bodyweight)

The Encounter offers a small set of bodyweight strategies. The
player taps to switch; the active variant is highlighted; set
indices reset to 0 for the new variant for the purpose of
combo / first-set bonuses (per the orchestrator's
`exerciseChanged: true` semantics).

MVP variant catalogue (Push encounter):

| Strategy id | Display name | Archetype |
|---|---|---|
| `pushup` | Pushup | `pressure` |
| `pike-pushup` | Pike Pushup | `pressure` |
| `diamond-pushup` | Diamond Pushup | `pressure` |
| `incline-pushup` | Incline Pushup | `pressure` |
| `knee-pushup` | Knee Pushup (assisted) | `pressure` |

Future strategies (post-MVP, listed so the type stays open):

- `decline-pushup`, `tempo-pushup`, `paused-pushup`,
  `archer-pushup`, `pseudo-planche-pushup`, etc.

The strategy id is what the set memory keys on, so each
strategy carries its own per-set-index history.

## 6. Equipment variants (weighted)

Same shape, different fiction. The player picks the equipment
they are at. "Change Plates" is the weighted version of
"Switch Strategy" and surfaces a chooser of equipment variants
that share the same encounter.

MVP variant catalogue (Push encounter, weighted):

| Equipment id | Display name | Archetype |
|---|---|---|
| `bench-press` | Bench Press | `heavy` |
| `shoulder-press` | Shoulder Press | `heavy` |
| `triceps-extension` | Triceps Extension | `pressure` |

Future variants (post-MVP):

- `dumbbell-bench`, `incline-bench`, `cable-fly`, `machine-press`,
  `paused-bench`, `pin-press`, etc.

"Change Plates" within a variant (i.e. adjusting weight without
switching equipment) is the existing weight stepper — no UI
work needed beyond making it always available.

## 7. Attack readability

Each set should clearly *change the visible state of the
battle*. The Battle screen surfaces:

- The enemy's HP bar (`current / max`, with a numeric label).
- A `Last hit: X dmg` line that updates on every Attack.
- The current battle progress as a percent (`(maxHp - currentHp) / maxHp`).
- A highlighted log entry for the most recent set.

No animations are required. A clear, instantaneous state
change is enough. If a future polish branch lands the motion
vocabulary from `012-battle-ux-and-feel.md` §3, this surface is
where `strike` + `dispersal` first play.

## 8. UX principle

> **The player is adapting under fatigue, not completing a
> preset script.**

Every UI affordance in this layer must serve that sentence. If
a screen ever makes the player feel like they failed a sequence,
the sequence is the bug.

## 9. State shape (reference)

For the curious — the shell's in-memory store grows to include:

```ts
interface WorkoutGameState {
  // ... pre-existing fields elided ...

  // open-ended encounter state
  currentVariantId: string;
  currentSetIndexInVariant: number;
  currentEnemyId: string;
  currentEnemyName: string;
  currentEnemyMaxHp: number;
  currentEnemyHp: number;
  enemyPhaseIndex: number;
  lastSetDamage: number | null;
  victoryAvailable: boolean;

  // memory
  setMemory: Record<string, SetMemoryEntry>;
}
```

`SetMemoryEntry` is `{ reps?, weight?, durationSeconds?, recordedAtIso }`.

## 10. What is NOT in this branch

- **SQLite persistence** for set memory or quest history.
  Memory lives in the running process only. The next branch
  (`claude/workout-rpg-local-persistence-<token>`) lifts
  `setMemory` to disk.
- **Cross-Quest PR detection** beyond what already lives in
  `runQuest`. PRs still detect against the *current* quest's
  log only.
- **Multiple encounters per Quest.** MVP keeps one encounter
  ("Push") per quest; the model supports more but the UI does
  not surface them yet.
- **Animations / sound.** The visual feedback is a static state
  change; the motion vocabulary in §3 of 012 lands later.
- **Drop-set / cluster-set DSL.** Continuation is the closest
  thing — a hand operation, not a programmatic recipe.

## 11. Implementation notes

The orchestrator (`packages/workout-domain/src/orchestrator/`)
does **not** change shape in this branch. The new model is a
*shell-side* re-arrangement of how Sets are presented to the
player; from the orchestrator's perspective, a Quest is still a
sequence of `SetInput`s, and `exerciseChanged: true` is the
signal it consumes to refresh the heavy first-set bonus and the
pressure combo at a strategy switch.

The shell signals `exerciseChanged: true` on the first set after
a `switchVariant()` call, so the combat layer stays
deterministic and the open-ended model still resolves through
the same pure pipeline.

Set memory and enemy phases are entirely **in the shell**. The
orchestrator sees the original enemy (Sluggard) and the full
flat set log; over-kill damage past `enemy.maxHp` is captured
by `overkillAmount` on the final set's result and surfaces in
the verdicts as `Finisher`.
