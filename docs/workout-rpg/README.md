# Workout RPG — design docs

Design/planning artifacts for the second app in the DWHI family: an
ADHD-friendly tactical-RPG workout game. This folder contains the
design bible only — no app code, no schema migrations, no screens.

Read in order:

1. [`001-design-bible.md`](./001-design-bible.md) — pitch, tone,
   fantasy, anti-patterns, pillars, **embodied progression**.
2. [`002-core-loop.md`](./002-core-loop.md) — open-to-close
   session flow, time budget, rest-as-gameplay.
3. [`003-combat-mechanics.md`](./003-combat-mechanics.md) — damage
   formula, exercise math, enemy model, tunable constants.
4. [`004-momentum-consistency.md`](./004-momentum-consistency.md) —
   the streak-replacement: Momentum, decay, tiers, Return bonus.
5. [`005-mvp-implementation-plan.md`](./005-mvp-implementation-plan.md) —
   the smallest playable build: 1 Quest, 3 exercises, 1 enemy.
6. [`006-monorepo-integration-plan.md`](./006-monorepo-integration-plan.md) —
   how it slots into `apps/` + `packages/` and the schema proposal.

### Systems expansion

These documents formalize the second wave of design — systems
that shape the long tail of the game without expanding MVP scope.

7. [`007-exercise-archetypes.md`](./007-exercise-archetypes.md) —
   exercises as combat disciplines (`pressure`, `heavy`,
   `control`, `foundation`, `endurance`, `recovery`); how
   archetypes prevent the "fitness tracker with RPG paint" failure
   mode and naturally encourage balanced training.
8. [`008-equipment-philosophy.md`](./008-equipment-philosophy.md) —
   weapons and armor as autobiography, not loot treadmill. The
   "no stat soup" rule. Titan Hammer, Twin Ash Blades, Traveler's
   Spear, Ember Staff; Stonebound Plate, Ashwalker Garb,
   Emberweave.
9. [`009-cardio-world-systems.md`](./009-cardio-world-systems.md) —
   cardio as traversal, not combat. *Trail Energy*, world-map
   restoration, regional affinities, passive Health API
   integration, and **The Long Road** anti-shame continuity
   system.

### Enemies, progression, and feel

These documents formalize the third wave of design — the
emotional texture of the long game. They do not expand MVP scope.

10. [`010-enemy-design-bible.md`](./010-enemy-design-bible.md) —
    what *Stillness* is, enemy philosophy, mood-based factions
    (*The Drift, The Hush, The Glare, The Stone*), named lesser
    fragments (*Sluggard*, *The Pale Hours*, *Old Mire*, *The
    Brittle Crown*, *The Long Smoke*, *The Hundred Hands*, *The
    Splintering*, *The Grey Vow*, *The Inward Ring*, *The Empty
    Hearth*), the Ward system, archetype affinities, escalation
    philosophy.
11. [`011-progression-and-rewards.md`](./011-progression-and-rewards.md) —
    XP philosophy, the 1-50 named ladder plus *Steadfast*
    post-level-50 cadence, what scales and what *never* scales,
    First-of-the-Week / Recovery-week / Comeback bonuses, the
    "good stopping point" reinforcement, soft caps and
    anti-exploit rules, lore fragment structure.
12. [`012-battle-ux-and-feel.md`](./012-battle-ux-and-feel.md) —
    the covenant: motion language, color and audio palettes,
    haptics, Ember behavior, Rest overlay design, Quest
    completion cinematic, recovery-day screen, "you are tired"
    feedback without shame, sample timelines (heavy / pressure /
    recovery / comeback-after-2-weeks).

### Provisioning

13. [`013-nutrition-and-provisioning.md`](./013-nutrition-and-provisioning.md)
    — nutrition as *provisioning the camp*, never calorie
    policing. Hard anti-shame / anti-disordered-eating
    safeguards; in-fiction categories (repair fibre, trail
    rations, hearth fuel, bright leaves, tideline salts); Camp
    systems (Hearth pantry, hydration, Recovery Meals, Feast
    moments, low-energy days); gentle-mode integration; passive
    Health-API read scope and the things we deliberately decline
    to read.

## Quick reference

- **Working title:** Momentum.
- **Antagonist:** *Stillness*. The world is *The Hollow*. The
  player is a *Vow-Bearer*. The Momentum bar is *The Ember*.
- **MVP user story:** open → 3 sets each of 3 push-day exercises
  → Sluggard, Lord of Couches falls → close, wanting to return.
- **Hard rules:** no streak shame, no junk-volume reward, no
  skip-day punishment, no pay-to-win, no FOMO notifications.
- **Primary retention mechanic:** Momentum (slow gain, slow decay,
  floored at 5, **Return bonus** of +8 on coming back after ≥ 3 days).
- **Three activities, three surfaces:** strength = combat, cardio
  = traversal, recovery = stability. They never collapse into one
  score.
- **Equipment is autobiographical:** what the character wears is a
  portrait of how the player trained, not what dropped from a
  chest.
- **The antagonist is not the player:** *Stillness* is what
  gathers when no witness is present. Enemies are mythic
  fragments of it — *defeat is dispersal, not death*. No therapy
  language, no diagnostic vocabulary, no "fight your X" copy.
- **The reward loop sends the player home:** the exit beat is
  longer than the entry beat; the reward screen ends in *Return
  to Camp*, never *Next Quest*; tomorrow takes care of itself.
- **The Battle screen is a covenant:** mythic before productive;
  no streak counters, no countdown skip incentives, no
  comparative copy, no exclamation marks.
- **Nutrition is provisioning the camp:** never calorie policing,
  never body surveillance, never moralised. Effects apply *forward*
  (tomorrow easier), never *backward* (today guiltier).

## Implementation scaffold

The first implementation branch (`claude/workout-rpg-scaffold-…`)
has landed the monorepo plumbing without building any game
mechanics:

- [`packages/workout-domain/`](../../packages/workout-domain) —
  the workout-RPG domain package. Vocabulary only: archetypes,
  enemy moods/categories, momentum tiers, cardio modalities,
  equipment kinds/families/sets, Quest- and Battle-kind tuples.
  No formulas, no React, no React Native, no side effects.
- [`apps/workout/`](../../apps/workout) — placeholder directory
  holding only a `README.md`. The Expo app shell lands in a
  later branch.
- `tsconfig.json` and `jest.config.js` are wired with
  `@dwhi/workout-domain` aliases. The existing DWHI app's
  imports and runtime are unchanged.
- Barrel smoke tests guarantee the package surface stays
  vocabulary-only, has no forbidden imports (React, React
  Native, `@/...`, `@dwhi/domain`), and does not leak into
  `@dwhi/framework` / `@dwhi/domain`.

## Next implementation branch

After the scaffold, the next branch is
**`claude/workout-rpg-combat-core-<token>`** — implementing
`damage()`, `fatigue()`, `crit()`, and `questXp()` as pure
functions inside `@dwhi/workout-domain/combat/` with golden-table
unit tests. See `006-monorepo-integration-plan.md` §9 for the full
sequence.
