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

### Open-ended encounters

14. [`014-open-ended-encounters-and-set-memory.md`](./014-open-ended-encounters-and-set-memory.md)
    — the shift from "Battle = 3 fixed sets" to "Encounter =
    sets until the player ends it." Set memory keyed by
    `(exerciseId, modality, variantId, setIndex)`. Strategy /
    Equipment chooser. Enemy continuation with the Lingering
    Shadow fragment. "Victory available" is offered, never
    forced.

### Reference porting

15. [`015-ironquest-port-plan.md`](./015-ironquest-port-plan.md)
    — concrete plan for mining the sibling `reference/ironquest/`
    project: what to port (View-based pixel sprites, camp scene,
    pooled flavour lines, fragment generator, pure-logic timer,
    encounter resume), what to leave (DCC hostile copy, A/B
    workout model, AsyncStorage scatter, monolithic
    ActiveWorkout screen, timeout punishment, RisingKB branding),
    source-to-target map, branch sequence.
16. [`016-monster-renderer-port.md`](./016-monster-renderer-port.md)
    — first concrete port: the View-based pixel monster renderer
    (`apps/workout/src/render/`). What was ported (technique,
    palette-indexed grid, breathing animation), what was
    intentionally NOT copied (the sprite arrays themselves,
    Iron Quest's rarity taxonomy, HP-percent injury logic, low-HP
    flicker, DCC tone), mood-indexed palette philosophy
    (drift / hush / glare / stone), category → sprite binding
    (`fragmentMap` / `hollowMap` / `wardMap` plus reserved
    `veilMap` / `emberMap`), Battle-screen integration, and the
    queued future-extension list.
17. [`017-camp-scene-and-ironquest-sprites.md`](./017-camp-scene-and-ironquest-sprites.md)
    — second port: layered pixel Camp scene on the Home screen +
    full Iron Quest monster sprite set as registered Momentum
    assets. Tier-keyed mood lighting (Rusted → Ascendant), animated
    flame, `SPRITE_REGISTRY` with `SpriteId` union,
    `CATEGORY_SPRITE_OPTIONS` mapping each Momentum category to a
    list of sprite ids (Momentum-original default + Iron-Quest-
    derived alternates), new optional `spriteId` prop on
    MonsterSprite. Sets up the future fragment generator to ship
    visual variety without re-authoring sprites.
18. [`018-theme-packs-and-settings.md`](./018-theme-packs-and-settings.md)
    — theme-pack architecture + Settings panel. Typed `ThemePack`
    structure (sprite preferences, palette overrides, UI accent,
    narration tone, enemy-flavour copy, motivational tagline,
    per-event narration hooks with tone-gate enforcement). Two
    shipped themes: **Momentum** (quiet-mythic default) and
    **Iron Quest Classic** (arcade-tavern opt-in). Single-row
    `workout_settings` SQLite table; safe fallback to Momentum on
    any corrupted / missing stored value; themes work in
    memory-only mode. New SettingsScreen + ThemeCard component;
    HomeScreen gear button opens it; BattleScreen routes the
    theme's preferred sprite id; CampScene accepts a theme-
    overlay tint.
19. [`019-tavern-home-layout.md`](./019-tavern-home-layout.md)
    — tavern-style home layout: TavernHeader, TavernSceneFrame,
    TavernStatusRow (LEVEL/LAST/WEIGHT), AmbientPanel ("Tonight
    in the Hollow" / "TONIGHT'S PATRONS"), QuestSelectionPanel
    + QuestCard (with exercise preview), three expandable
    EchoLogPanels, TavernFooterActions. ThemePack gains five
    sub-shapes (`headerCopy`, `ambient`, `questCard`,
    `panelLabels`, `footer`); `getAmbientLines(themeId, tier)`
    generator with Momentum fallback. HomeScreen becomes a thin
    composition shell with a grep-enforced content boundary —
    zero theme-specific strings inline. Anti-shame regression
    tests reject "lazy", "skipped", "missed", "weak", "calorie",
    "bmi", etc. across every home-surface string.
20. [`020-world-state-and-patrons.md`](./020-world-state-and-patrons.md)
    — ambient world layer: `apps/workout/src/world/` module
    with a deterministic `generateNightlyWorld(...)` generator,
    an 11-entry patron roster of coaching / emotional
    archetypes (Spotter, Quiet Runner, Hearthkeeper,
    Archivist, Challenger, Cook, Night Janitor, Traveler, One
    Who Stretches, Old Soldier, Newcomer), per-day rotation
    seeded on the calendar day, theme-aware dialogue pools, and
    bucketed world-state primitives (timeOfDay, hearthState,
    roomEnergy, weather, activityHint). New `ThemeWorldState`
    sub-shape on `ThemePack` (patron section label, ambient
    density, energy bias, per-bucket weather copy). New
    PatronsPanel component on the HomeScreen. Anti-shame +
    no-reference-ironquest-runtime-imports regression tests
    pin the boundary. Pure presentational — zero mechanics,
    zero new dependencies, packages/workout-domain untouched.

### Product parity & operational docs

21. [`021-expo-go-setup.md`](./021-expo-go-setup.md) — fast-path
    instructions for running the Workout RPG on a real device
    via Expo Go (`cd apps/workout && npx expo start --clear`,
    scan QR), plus the limits — `expo-sqlite` may be
    unavailable in Expo Go, in which case the app flips into a
    visible memory-only mode. Documents when to escalate to a
    `expo-dev-client` build (persistence, household work,
    sharing builds with non-developers) and the EAS / local
    prebuild paths.
22. [`022-household-integration-plan.md`](./022-household-integration-plan.md)
    — plan-only doc (no code in this branch). Maps the
    `@dwhi/framework` household APIs we'd reuse, the workout
    schema's needed `member_id` / `household_id` joins, the
    per-member vs per-household scope decisions (theme + unit
    + history are per-member; only opt-in family views are
    per-household), and the explicit non-goals (no Supabase,
    no auth, no sync) for the foundation branch. Recommends
    next branch: `claude/workout-rpg-household-foundation-…`.

### Branch — Product parity pass

The product-parity branch (021) added the user-facing concerns
that surfaced during first-device testing: weight unit toggle
(lb default), full-bleed home scene with theme-aware sign,
prominent battle HP bar, decoupled cumulative-XP-based LEVEL
display, the Expo Go doc, and the household integration plan.
The leveling rebalance is the most impactful piece: previously
the displayed LEVEL was `Math.round(priorMomentum)` (so 3
battles → "L30"); the new derivation is
`levelForCumulativeXp(SUM(quest_history.xp))` with the curve
`xpForLevel(N) = floor(30 * (N-1) ^ 1.4)` — a short workout
moves the player ~1-2 levels, L10 sits at ~10 sessions, L30 at
~50+ sessions. The new `apps/workout/src/leveling/` module is
pure; the curve is deterministic and tested.

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
