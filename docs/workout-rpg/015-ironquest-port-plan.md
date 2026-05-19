# 015 — Iron Quest Port Plan

> *Read it. Mine it. Don't import it.*
> Iron Quest (working title for the "RisingKB → fitness-RPG" build
> living under `reference/ironquest/`) is a parallel attempt at the
> same shape Momentum is taking. It ships systems we can learn from
> — and tone choices we will deliberately not adopt. This document
> records what to port, what to leave, and in what order.

---

## 1. Executive recommendation

**Momentum remains the main app.** Iron Quest stays at
`reference/ironquest/` as a **read-only reference**. We do not
import from it; we do not symlink against it; we do not let its
package.json or dependency choices leak across the boundary. Every
ported concept lands as a *fresh implementation* inside Momentum's
existing architecture, using TypeScript, Zustand, our orchestrator,
our anti-shame copy rules, and our archetypes + tiers.

Three reasons we are not merging Iron Quest in:

- **Architecture.** Iron Quest is JavaScript, AsyncStorage-only,
  one-app-one-package. Momentum is TypeScript, monorepo, pure
  orchestrator + shell, SQLite via the persistence bridge that
  just landed in `claude/workout-rpg-local-persistence-N8tDr`.
  Folding Iron Quest in wholesale would un-do that work.
- **Tone.** Iron Quest's voice is *Dungeon Crawler Carl* —
  sardonic, occasionally hostile, "BURN THEM ALL". Momentum's
  voice is hopeful struggle (see `001-design-bible.md` §3 and
  `012-battle-ux-and-feel.md`). The two voices cannot coexist on
  one screen.
- **Branding.** Iron Quest references the RisingKB origin and DCC
  flavour throughout. Neither belongs in Momentum.

What we *will* do: port the **shapes** of Iron Quest's strongest
ideas into Momentum, re-skinning copy and re-typing code as we go.

---

## 2. Concepts to port first

In priority order. The first three are big wins for the
*feel* of the existing MVP shell; the last four are systems that
extend the long tail.

1. **View-based pixel monster renderer** — Iron Quest's biggest
   single asset. A pure-`View` sprite renderer with no native
   dependencies (no Skia, no Reanimated). Maps cleanly onto our
   enemy archetypes (Drift / Hush / Glare / Stone) and to our
   `EnemyInput` shape. **Visual identity unlock.**

2. **Tavern / Camp atmosphere** — the analogue of our Home /
   Camp screen. Same view-based pixel approach used for an
   ambient scene (fireplace, lanterns, tables, NPC silhouettes,
   trophy shelf, mood lighting). Replaces our current
   text-and-Ember home screen with something the player wants to
   *return to*.

3. **Procedural monster generator** — Iron Quest's
   `monsterGen.js` is 88 lines and outputs `{ name, archetype,
   rarity, hp, atk, zone, seed }` from a seeded RNG. With our
   palette (no DCC names, no rarity tiers, no zone numbers in
   the user surface), this becomes a small library of named
   *fragments* that map to our enemy moods and our
   `getNextEnemyPhase()` chain.

4. **Announcer / voice-pack architecture** — Iron Quest splits
   announcer lines into typed pools (`damageTickle`, `unhinged`,
   `monsterAttack`, …). The *architecture* is great; we want a
   pool-by-event design, but our pools are the Mythic Vow lines
   from `012-battle-ux-and-feel.md` §13, not the DCC content.

5. **Combat timer concept** — Iron Quest's
   `CombatTimer` is a singleton with a callback API
   (`onTick`, `onEnd`). Our current `RestScreen` shows a static
   countdown placeholder. A pure-logic timer module (no UI) is
   a clean port we can write fresh in TypeScript.

6. **Dispatch / share card** — Iron Quest uses
   `react-native-view-shot` to render a session card. We do
   **not** want sharing in MVP (012 bans it), but the underlying
   *layout pattern* — a single rendered card summarising the
   Quest — is a strong fit for our Reward screen.

7. **Persistent enemy memory** — Iron Quest persists monster HP
   when the player dies, then restores it (enraged) on return.
   Our orchestrator doesn't model "death"; our analogue is the
   *Lingering Shadow* continuation chain. Persisting the
   current encounter's phase + HP across an app restart gives
   the player the same emotional beat ("the room I left is the
   room I return to") without the punitive framing.

---

## 3. Things not to port directly

Each rejection is on principle, not on quality.

### 3.1 Hostile copy as default

Iron Quest's announcer pools include lines like *"BURN THEM ALL"*,
*"It is watching you. Not the monster. ME."*, and the
`unhinged` pool. These are well-crafted in their own voice.
**They are the opposite of Momentum's voice.** See
`001-design-bible.md` §3 (*hopeful struggle, not toxic grindset*)
and `012-battle-ux-and-feel.md` §13 (the Mythic Vow line library
and the explicit ban on exclamation marks).

If we port the *line pool architecture* (which we should) we
write fresh content. The vow lines we already have are the
seed. No DCC tone leaks into Momentum.

### 3.2 A/B hard-coded workout model

Iron Quest's `src/data.js` is two named sessions ("A" / "B")
that the player toggles between. That is fine for the Iron
Quest scope. We have already moved past it: the open-ended
encounter model in `014-open-ended-encounters-and-set-memory.md`
lets the player switch strategies mid-encounter, log indefinitely,
and continue past defeat. Adopting A/B back would be a regression.

### 3.3 AsyncStorage scatter

Iron Quest persists everything via AsyncStorage, with keys
spread across files (`iq_inventory`, `iq_gold`, `iq_muted`,
`iq_character`, workout-log per session). It works, but the
storage shape is opaque, debugging is painful, and there is no
schema. Momentum already has SQLite via the persistence layer
landed in `claude/workout-rpg-local-persistence-N8tDr`. We do
not adopt AsyncStorage as a second storage backend — schema lives
in `apps/workout/src/persistence/schema.ts`.

### 3.4 Monolithic ActiveWorkout screen

Iron Quest's `screens/ActiveWorkout.js` is **1011 lines** —
combat state, timer, rest UI, monster sprite mount, set logging
all intertwined. Our `BattleScreen.tsx` is ~440 lines and
already factored cleanly with selectors from
`workoutGameStore.ts`. Porting the monolith back in would
collapse our orchestrator boundary. The *individual UI ideas*
inside `ActiveWorkout.js` (sprite mount, HP bar, timer overlay)
are portable; the file itself is not.

### 3.5 Timeout punishment

Iron Quest expires a "set window" timer and then enters a 9-second
"grace" window; failing the grace fires a monster bonus attack
and counts as a skipped turn. That is *active timeout punishment*
— exactly the anti-pattern Momentum's `004-momentum-consistency.md`
and `012 §9.5` explicitly reject (*"I'm ready" carries no reward
and no penalty*). Our rest is always opt-out; we do not punish
slow rests.

### 3.6 RisingKB branding

Iron Quest's `package.json` is still `"name": "rising-kb"`. The
docs reference the RisingKB origin. We do not port any of that
language. Even when we port a file's *shape*, we strip the
brand.

### 3.7 DCC-style references

`reference/ironquest/CLAUDE.md` is explicit: the *tone* is
Dungeon Crawler Carl. Names like "Phil (Former Lich)",
"Sponsored Content Elemental", "Carl (Maybe)", "Tax Collector
goblin" are all DCC-adjacent. Momentum's NPCs (when we add them)
will be in our own register — warm, mythic, restrained. Not
sardonic.

---

## 4. Exact source-to-target map

Each row: what we'd take, where it'd land in Momentum, whether we
**keep / adapt / replace**, the risk level, and the test surface.

| # | Iron Quest source | Momentum target | Mode | Risk | Tests we'd add |
|---|---|---|---|---|---|
| 1 | `reference/ironquest/renderer/MonsterSprite.js` (213 LOC, View-based sprite + 5 palettes × 5 rarities + 5 sprite maps) | `apps/workout/src/render/MonsterSprite.tsx` + `apps/workout/src/render/spritePalettes.ts` + `apps/workout/src/render/spriteMaps.ts` | **adapt** — rename rarities → enemy moods (`drift`/`hush`/`glare`/`stone`), drop the `legendary` slot, keep `tintRed` (rename `tintEnraged`); TypeScript port; pure-View, no native deps | low | snapshot of pixel grid count; palette table parity test; mood-tint pure-function test |
| 2 | `reference/ironquest/renderer/TavernScene.js` (457 LOC, layered View scene + mood lighting + flicker) | `apps/workout/src/render/CampScene.tsx` + `apps/workout/src/render/sceneLayers.ts` | **adapt** — rename Tavern → Camp; drop "the Wounded Goblin" sign; replace mood-lighting palette with our Ember/Hearth/Moss colours; keep the layered-View compositor pattern and the flame flicker via the built-in `Animated` API; do not use Reanimated or Skia | low–med | layer-order test; mood→tint mapping test; Animated.loop usage smoke test (compile-time only, like the existing screens smoke) |
| 3 | `reference/ironquest/src/engine/monsterGen.js` (88 LOC, seeded RNG + rarity weights + zone difficulty) | `packages/workout-domain/src/catalog/fragmentGen.ts` | **adapt** — pure-TS port, no native imports; rename "zones" → our regions (`009-cardio-world-systems.md` §8); drop DCC adjective/noun pools; replace with a small mythic noun bank ("Drowsy", "Half-Asleep", "Listless", "Forgetful", "Settled"); seed offset stays the same idea (`sessionSeed + killCount * 9973`) | low | seeded determinism test; rarity-weight distribution test; HP/ATK monotonicity vs rarity test; bounded multiplier checks |
| 4 | `reference/ironquest/src/data/announcer.js` (109 LOC, pooled lines by event) | `apps/workout/src/copy/voicePack.ts` + `apps/workout/src/copy/voicePackPicker.ts` | **adapt** — keep the pool-by-event architecture, **replace 100% of the content** with the Mythic Vow library (`012-battle-ux-and-feel.md` §13), no exclamation marks, no all-caps; add a deterministic picker keyed on `(setIndex, phaseIndex)` so the same Quest replays the same flavour lines | low | pool shape test; picker determinism test; banned-token test (no `!`, no `BURN`, no `HAHAH…`) |
| 5 | `reference/ironquest/src/engine/timer.js` (79 LOC, callback-based singleton) | `apps/workout/src/state/restTimer.ts` | **replace** — re-write fresh in TypeScript with `onTick(remaining)` + `onComplete()` + idempotent `start/pause/clear`; **drop the grace window and the "skipped turn" punishment** entirely; the rest's expiry is silent return-to-battle, never a monster bonus attack | med — *only because we must not import the timeout-punishment behaviour by mistake* | timer fires expected ticks; pause/resume is exact; clear is idempotent; **regression: timer never triggers a side-effect that is presented as a penalty** |
| 6 | `reference/ironquest/screens/KillLogScreen.js` (78 LOC) — proto session-card layout | `apps/workout/src/screens/RewardScreen.tsx` (already exists) — *concepts only* | **adapt** — borrow only the single-card-summary layout idea (one scroll-free panel with stats + lore line + return CTA); we already render most of this; the port is a polish pass, not a new file | low | none beyond existing reward-screen tests |
| 7 | `reference/ironquest/src/engine/combat.js` (180 LOC, persists monster HP on player death) | `apps/workout/src/state/workoutGameStore.ts` + `apps/workout/src/persistence/encounterStateRepository.ts` (new) | **replace** — Momentum has no "player death". We adopt the *persist-the-current-encounter* idea: phase HP + phase index + active variant id, so an app restart resumes mid-Quest. Use the same SQLite layer that landed in the persistence branch | med | round-trip test (persist → relaunch-simulate → restore); single-row constraint; clears on quest completion |

Files in `reference/ironquest/screens/` like `ActiveWorkout.js`,
`HistoryScreen.js`, `WeightLogScreen.js`, `SplashScreen.js`,
`TavernScreen.js` are **not** ported as files — they're studied
for individual ideas (logged-set row layout, HP-bar styling, etc.)
and ideas are re-implemented in the existing Momentum screens.

---

## 5. First implementation branch recommendation

> **`claude/workout-rpg-port-monster-renderer-<token>`**

Single, focused branch. Lands the visual identity unlock without
touching any system.

Scope:

- New: `apps/workout/src/render/MonsterSprite.tsx` — TypeScript
  port of the View-based sprite renderer.
- New: `apps/workout/src/render/spritePalettes.ts` —
  mood-indexed palettes (Drift / Hush / Glare / Stone), not
  rarity-indexed.
- New: `apps/workout/src/render/spriteMaps.ts` — five 12×14 sprite
  grids, one per enemy archetype the design supports (Lesser
  Fragment, Ward, Hollow + two reserved slots). Hand-drawn from
  scratch; we do not copy the Iron Quest sprite arrays.
- Modified: `apps/workout/src/screens/BattleScreen.tsx` — replace
  the current `◆` placeholder silhouette with `<MonsterSprite>`,
  keyed on `currentEnemy.mood` and `currentEnemy.category`.
- New tests: `apps/workout/src/tests/monsterSprite.smoke.test.ts`
  — type-only compile-time guard (the renderer imports
  `react-native`, so we keep the runtime out of Node Jest, same
  convention as the existing `screens.smoke.test.ts`).

Out of scope for that branch:

- No combat-mechanics changes.
- No persistence-schema changes.
- No Supabase, no auth, no sync.
- No DWHI pantry changes.
- No new dependencies (View + React Native built-ins only).
- No `react-native-reanimated`, no `@shopify/react-native-skia`.

Acceptance: `npm test`, `npx tsc --noEmit`, `npx expo config
--type prebuild` all clean. The `BattleScreen` renders the
ported sprite in place of the current glyph; the
`tintEnraged` helper applies a Hearth-coloured tint when the
phase is in *victory-available* state.

---

## 6. Future branches

In recommended order. Each one is documentation- or
implementation-only, never overlapping with the others.

1. **`claude/workout-rpg-port-camp-scene-<token>`** — port the
   layered-View camp scene to replace the current text-only
   home screen. Mood lighting maps to Momentum tier (Rusted →
   dim, Ascendant → warm-bright). Built-in `Animated.loop`
   only — no Reanimated.

2. **`claude/workout-rpg-voice-pack-<token>`** — implement the
   pooled flavour-line architecture in
   `apps/workout/src/copy/voicePack.ts`. Seed pools from the
   Mythic Vow library; add a deterministic picker for rest tips
   and reward-screen lines. No DCC content imported.

3. **`claude/workout-rpg-fragment-generator-<token>`** — pure-TS
   port of `monsterGen.js` into
   `packages/workout-domain/src/catalog/fragmentGen.ts`.
   Outputs `EnemyInput` with name, mood, category, scaled HP.
   Wired into the orchestrator's `getNextEnemyPhase()` so
   continuation fragments get varied names without changing
   their math.

4. **`claude/workout-rpg-rest-timer-<token>`** — pure-TS
   countdown module replacing the static placeholder in
   `RestScreen`. Strictly no timeout-punishment behaviour; the
   expiry fires `onComplete()` which silently returns the user
   to the battle screen.

5. **`claude/workout-rpg-dispatch-card-<token>`** — borrow the
   single-card layout pattern (not the share/export pipeline)
   for a polished Reward screen pass. Still no sharing
   features.

6. **`claude/workout-rpg-encounter-resume-<token>`** — persist
   `(currentEnemy, currentEnemyHp, enemyPhaseIndex,
   currentVariantId, currentSetIndexInVariant, log)` into the
   existing SQLite layer so an interrupted Quest resumes on
   relaunch. Pairs with the recent persistence work.

After branch 6 the major Iron-Quest-shaped ideas have been
re-homed in Momentum; what remains in the reference (inventory,
gold, loot tables, set bonuses, character store, party system)
is explicitly out of scope for Momentum's MVP and post-MVP
roadmaps (see `008-equipment-philosophy.md` and
`011-progression-and-rewards.md` for the autobiographical-not-
loot stance).

---

## 7. Risks

### 7.1 IP / style risk

Iron Quest's sprite *bitmaps* are hand-authored creative work.
Copy-pasting the 12×14 pixel arrays is at minimum lazy and at
worst attribution-fraught. The port redraws them. The *renderer
mechanism* (nested Views per pixel) is a generic technique with
no IP attached.

### 7.2 Build risk

Iron Quest banned `react-native-reanimated` and
`@shopify/react-native-skia` because they break Expo Go. The
same constraint applies to Momentum's MVP — the existing app
shell uses Expo Router with no Reanimated dependency. Every
ported visual must use built-in `Animated` only. Tests should
include a guard that the new modules don't transitively import
either library.

### 7.3 Dependency risk

Iron Quest pulls in `react-native-view-shot`, `expo-audio`,
`expo-media-library`, `expo-notifications`, `expo-sharing`. We
adopt **none of them** in MVP. If the dispatch-card branch ever
wants screenshot export, we re-evaluate at that point and only
add `react-native-view-shot` after a green-light review.

### 7.4 Architecture risk

The most subtle. Iron Quest's combat engine is *coupled* to its
AsyncStorage layer (e.g., `getExerciseMax` scans AsyncStorage
inside the damage formula). Momentum keeps the orchestrator
pure: `runQuest()` takes `priorMomentum` as input, never reads
storage. **We must not port any pattern where the combat layer
reaches into persistence.** Tests already enforce this for
`@dwhi/workout-domain` (no expo-*, no @/..., no `@dwhi/ui`); any
new code that adds an orchestrator-side import of persistence is
the bug.

### 7.5 Tone risk

Iron Quest is loud, Momentum is quiet. The hardest discipline
during the port is to avoid drift. Every PR description that
includes a ported file should answer: *"What did we say
instead?"* and link the replacement copy. The voice-pack branch
should ship with a *content audit* checklist asserting zero
banned tokens (`!`, ALL-CAPS verbs, "CRITICAL", "HAHAHAHA", DCC
NPC names).

---

## 8. Acceptance criteria

This is a documentation-only branch:

- No `apps/workout/`, `packages/workout-domain/`, or any other
  runtime code is modified.
- No new dependencies are declared.
- The `reference/ironquest/` directory is read-only context for
  authors — no symlinks, no re-exports, no test imports.
- `npm test` still passes (the prior counts are preserved).
- `npx tsc --noEmit` is clean.
- `npx expo config --type prebuild` evaluates at the repo root
  (DWHI pantry app) AND inside `apps/workout/` (Momentum) —
  both unchanged.

---

## 9. Open questions for the next design pass

These are **not** decisions for this branch — they are notes for
whoever picks up the first implementation branch.

- Does the camp scene render at the same resolution as the
  battle screen, or do we use distinct pixel sizes (battle
  reads as portrait silhouette, camp reads as room interior)?
- Does the voice-pack pull from BOTH the rest-tip pool and the
  reward-line pool with the same picker, or are they separate?
- Should the fragment generator share the seed with Momentum's
  existing fixture `getNextEnemyPhase()` (so the chain is
  reproducible), or generate fresh names per phase?
- Does the encounter-resume layer apply to recovery Quests
  (camp / mobility), or only to strength Quests with an enemy?
- Do we ever surface enemy "rarity" to the player? Iron Quest
  does; Momentum's design bible suggests we *whisper* affinity
  rather than label it (`010-enemy-design-bible.md` §6). The
  ported fragment generator will produce rarity internally; the
  UI may not display it.

Holding these open is the right call. The implementation branch
that ports each system gets to answer the question that matters
to it.
