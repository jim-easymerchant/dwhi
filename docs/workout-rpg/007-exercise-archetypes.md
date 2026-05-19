# 007 — Exercise Archetypes

> Exercises are not damage sources with different numbers attached.
> They are **combat disciplines** — distinct battle styles with
> distinct feel, distinct tactical roles, and distinct narrative
> identity. This document formalizes that promise.

---

## 1. Design rationale

The first temptation in a workout RPG is to treat exercises as
weighted dice — bigger lift, bigger number. We reject that. A
fitness tracker with RPG paint is what the user can already get on
their phone, and it does not solve the *feel* problem we set out to
solve.

Archetypes give every exercise a **personality**:

- A set of pushups should feel different from a set of squats *in
  combat*, not just in arithmetic.
- A long run should not be a worse bench press — it should be a
  fundamentally different activity, scored on a fundamentally
  different axis.
- A mobility session should not score zero. It should score on its
  own terms.

Archetypes are the design device that makes that possible without
inventing a separate game for every exercise.

## 2. Why this avoids "fitness tracker with RPG paint"

Three reinforcing effects:

1. **Combat feedback is shape, not just size.** A pressure attack
   chains. A heavy attack staggers. A control attack debuffs. The
   player learns to *read the combat surface* — which is the thing
   that makes an RPG feel like an RPG.
2. **Exercises become memorable on their own terms.** "Today I went
   heavy" and "today I worked pressure" are different sentences
   that mean different things, both in the gym and in the game.
3. **The catalog is small but expressive.** Three exercises with
   distinct archetypes outperforms ten exercises that all do the
   same thing with different multipliers. MVP-friendly by design.

## 3. How archetypes encourage balanced training naturally

Archetypes act as a **gentle nudge toward variety** without ever
imposing a "you must train X" requirement.

- The Quest reward screen highlights which archetypes were
  exercised this week (small, warm, no red exclamation marks).
- Enemies have soft archetype affinities (post-MVP): a Sluggard
  goes down faster to pressure, a Stoneguard relents to heavy.
  The hints are *whispered*, never demanded.
- Tier-up lore acknowledges archetype breadth: "You learned to
  press *and* to endure" is a different page from "You pressed and
  pressed and pressed."

The system rewards variety with **opportunity**, not with
**penalty for monotony**. Crucial distinction.

## 4. How archetypes reduce grinding exploits

A pure damage-number system can be gamed by finding the highest
`damage / minute` exercise and repeating it. Archetypes change the
math:

- **Fatigue is shared within an archetype.** Doing 20 sets of
  pressure exercises stacks fatigue against the *pressure* pool,
  not a global pool only — so a player who tries to grind one
  archetype hits the fatigue floor (0.5x) faster than a varied
  session.
- **Variety bonus is archetype-aware.** Three pressure exercises
  count as 1 distinct archetype for variety, not 3 — so the
  variety bonus naturally rewards real cross-training.
- **Recovery archetype has its own ledger.** It earns Momentum and
  fatigue *relief*, not raw damage. A player can't grind recovery
  to top a damage chart.

Net effect: the *most efficient* training pattern in the game is
also the *healthiest* training pattern in real life. Anti-grind
emerges from the systems instead of being bolted on as a penalty.

## 5. Future extensibility

Archetypes are the spine for a number of post-MVP systems we want
to leave room for, without building any of them yet:

- **Enemy weaknesses.** Each monster carries a small affinity
  table: `{ vulnerable_to: [...], resistant_to: [...] }`. MVP's
  Sluggard has no affinities — just for shape.
- **Status effects.** Pressure inflicts *Bleed* (small DoT).
  Heavy inflicts *Stagger* (skip enemy windup). Control inflicts
  *Confused* (enemy attacks lighter). Foundation grants *Steady*
  (next 2 sets gain +5%). Endurance grants *Pace* (rest timer
  options widen). Recovery grants *Mending* (ember stabilizes).
- **Classes.** Future classes are archetype *specializations*:
  - **Wardborn** — heavy + foundation.
  - **Sparrow** — pressure + control.
  - **Wayfinder** — endurance + recovery.
  - **Hearthkeeper** — recovery + foundation.
  All optional; "Vow-Bearer" (MVP class) is the unspecialized
  baseline.
- **Skill trees per archetype.** Tier-up grants a single passive
  choice within an archetype the player has used recently.

None of these are MVP. They are listed so that the MVP archetype
shape doesn't paint itself into a corner.

## 6. The initial archetype system

```ts
type ExerciseArchetype =
  | 'pressure'
  | 'heavy'
  | 'control'
  | 'foundation'
  | 'endurance'
  | 'recovery';
```

Six archetypes. Distinct in combat feel, distinct in body system,
distinct in narrative tone.

### 6.1 `pressure`

> *Strikes fall fast. The enemy never resets.*

| Property | Value |
|---|---|
| Tempo | High |
| Attack pattern | Combo chains — successive sets within the same battle gain +3% each (caps at +15%) |
| Fatigue | Low accumulation (+0.6 per set instead of +1.0) |
| Damage | Moderate per-set |
| Status | *Bleed* (tiny DoT during enemy windup) — post-MVP |
| Real-world fit | Push-ups, kettlebell swings, jump rope intervals, calisthenics circuits |
| Vibe | Sparrow, jab-jab-jab, you have not stopped moving |

The "combo" framing rewards the *rhythm* of doing pressure work —
sets feel chained, not isolated. Fatigue cost is lower because the
real-world tax of these exercises is also lower per rep.

### 6.2 `heavy`

> *Slow. Deliberate. The earth notices.*

| Property | Value |
|---|---|
| Tempo | Slow |
| Attack pattern | Single big hit per set; +25% damage on the first working set of a battle |
| Fatigue | High accumulation (+1.4 per set) |
| Damage | High per-set |
| Status | *Armor Break* — next pressure / control attack in the same battle deals +20% — post-MVP |
| Real-world fit | Bench press, squats, deadlifts, weighted pull-ups |
| Vibe | Hammer falls, room shakes, you are *committed* before the bar even leaves the rack |

Fatigue is intentionally higher: the formula reflects the real
cost of heavy training. A "heavy" Quest naturally trends to fewer
sets, which is correct biomechanically and correct narratively.

### 6.3 `control`

> *Read the enemy. Strike where it can't recover.*

| Property | Value |
|---|---|
| Tempo | Measured |
| Attack pattern | Interrupt — a clean working set may shave 5-10s off the next rest timer (if the player wants); also slightly debuffs the enemy windup gauge |
| Fatigue | Medium (+1.0) |
| Damage | Moderate, with a small precision-bonus crit window |
| Status | *Confused* — enemy windup advances slower — post-MVP |
| Real-world fit | Rows, face pulls, single-arm presses, pistol squats, weighted pull-ups (controlled tempo) |
| Vibe | Sniper, swordmaster, *you saw the opening* |

The rest-timer shave is opt-in: it is offered, never auto-applied,
because pacing-pressure could undermine the anti-grind philosophy.

### 6.4 `foundation`

> *Build the ground. The rest of the battle stands on it.*

| Property | Value |
|---|---|
| Tempo | Steady |
| Attack pattern | "Footwork" — when a foundation exercise is the first battle in a Quest, all subsequent battles gain +5% damage |
| Fatigue | Medium (+1.0) |
| Damage | Moderate |
| Status | *Steady* — discipline bonus, next-set crit window widened — post-MVP |
| Real-world fit | Squats, deadlifts (when programmed as the day's anchor), core work, posture/braced holds |
| Vibe | The mountain. The thing other things rest on. |

Foundation's signature mechanic is **upstream**, not downstream —
the bonus applies to *later* battles in the same Quest, which
rewards the real-world habit of programming compound work first.

### 6.5 `endurance`

> *The fight is long. So are you.*

| Property | Value |
|---|---|
| Tempo | Sustained |
| Attack pattern | Damage rises slightly with set count instead of falling — endurance is the *one* archetype that partially resists fatigue (fatigue floor is 0.7 instead of 0.5 within an endurance battle) |
| Fatigue | Low (+0.5) |
| Damage | Low per "rep equivalent" but huge volume |
| Status | *Pace* — rest timer options widen, no penalty for long rests — post-MVP |
| Real-world fit | Long-duration cycling, rowing, swimming, sustained jogging, weighted carries (in a strength session) |
| Vibe | The march. The thing you can keep doing. |

**Important:** endurance lives at the boundary of strength and
cardio. A 5-minute weighted carry is endurance-in-a-Quest;
distance running is endurance-in-the-world (see
`009-cardio-world-systems.md`). The archetype identifier is
shared so future synergies make sense; the *scoring surface* is
different.

### 6.6 `recovery`

> *The Ember stabilizes. The world breathes.*

| Property | Value |
|---|---|
| Tempo | Slow / non-combat |
| Attack pattern | None — recovery exercises do not deal damage |
| Fatigue | **Negative** — reduces accumulated fatigue by 1 point per recovery set within a Quest |
| Damage | 0 |
| Status | *Mending* — stabilizes the Ember (slows Momentum decay) — post-MVP |
| Real-world fit | Mobility, yoga, foam rolling, breathwork, stretching |
| Vibe | The hearth. The quiet. The thing that makes tomorrow possible. |

Recovery's first-class status in the system is the most important
single statement this document makes. Recovery is **not** "rest."
It is a move. It earns Momentum. It contributes to the Quest. It
unlocks lore.

## 7. Example exercise mappings

The MVP catalog (see `005-mvp-implementation-plan.md`) seeds with:

| Exercise | Archetype | Notes |
|---|---|---|
| Pushup | `pressure` | The signature pressure exercise |
| Bench press | `heavy` | The signature heavy exercise |
| Shoulder press (DB) | `heavy` | Lower tonnage but pattern is heavy |
| Pike pushup | `pressure` | Bodyweight equivalent stays in archetype |
| Triceps extension | `pressure` | Accessory but pattern is pressure |
| Diamond pushup | `pressure` | Bodyweight equivalent |

Future expansion (illustrative, **not MVP**):

| Exercise | Archetype |
|---|---|
| Rows (BB or DB) | `control` |
| Face pulls | `control` |
| Squats (programmed first) | `foundation` |
| Plank / dead bug | `foundation` |
| Long run / cycle | `endurance` |
| Loaded carry | `endurance` |
| Mobility flow | `recovery` |
| Yoga / breathwork | `recovery` |

Note: an exercise's archetype is *programmatic*, not just
biological. Squats programmed as the day's first lift are
`foundation`; the same movement at the end of a high-volume circuit
could meaningfully be `endurance`. MVP keeps the mapping static; a
post-MVP "Quest position" system can adjust archetype contextually.

## 8. Mechanical hooks summary

The MVP combat balance file (`combatBalance.ts` in
`003-combat-mechanics.md`) gains an `archetypes` block:

```ts
export const archetypeBalance = {
  pressure:   { fatiguePerSet: 0.6, comboBonusPerSet: 0.03, comboCap: 0.15 },
  heavy:      { fatiguePerSet: 1.4, firstSetBonus: 0.25 },
  control:    { fatiguePerSet: 1.0, restShaveSecondsMax: 10 },
  foundation: { fatiguePerSet: 1.0, downstreamQuestBonus: 0.05 },
  endurance:  { fatiguePerSet: 0.5, fatigueFloorOverride: 0.7 },
  recovery:   { fatiguePerSet: -1.0, dealsDamage: false },
} as const;
```

One file. Six entries. Anyone debating a balance change has
exactly this surface to argue about.

## 9. What this is not

- **Not classes.** A player isn't assigned an archetype; they
  pick exercises that map to archetypes. Classes (post-MVP) are
  *specializations* that amplify two archetypes.
- **Not weaknesses-required combat.** MVP enemies have no
  archetype affinity. The system *supports* affinity if it lands
  well; it does not depend on it.
- **Not a job system.** No grinding "level up your pressure
  archetype." Archetypes have no XP of their own — the player's
  XP and Momentum are unified.

## 10. The promise the player feels

A user who plays for a month should be able to say:

- "I'm a pressure-and-control kind of player."
- "I went heavy last week and I'm doing a recovery week now."
- "The fight feels different when I bench than when I do pushups —
   and that's exactly right."

If the user describes their own play this way without prompting,
the archetype system is working.
