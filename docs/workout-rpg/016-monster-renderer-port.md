# 016 — Monster Renderer Port

> The first concrete port from `reference/ironquest/` into Momentum.
> Ships a working View-based pixel renderer for enemy silhouettes;
> ships nothing else. Combat math, persistence, orchestrator,
> Supabase, and the DWHI pantry app are all untouched.

---

## 1. What was ported (conceptually)

Three things, and only three:

1. **The rendering technique** — a pixel sprite is a nested grid of
   tiny `View` components, each with a `backgroundColor` set from a
   palette. No SVG library. No Canvas. No Skia. No Reanimated. The
   pattern is generic enough that no one owns it; we adopted the
   shape and re-typed it in TypeScript.
2. **The palette-indexed sprite map** — a 2D array of integers where
   `0` is transparent and `1..N` index into a colour palette. Same
   shape as the Iron Quest sprites; entirely original cell content.
3. **The breathing animation pattern** — a single
   `Animated.loop(Animated.sequence(...))` looped with
   `useNativeDriver: true`. Iron Quest uses the same idiom for its
   low-HP flicker; we use it for the always-on idle breath.

---

## 2. What was intentionally NOT copied

This is the longer list, on purpose.

- **The sprite arrays themselves.** Every Iron Quest 12×14 array
  is a hand-authored asset. We did not copy them. The five maps
  in `apps/workout/src/render/spriteMaps.ts` (`fragmentMap`,
  `hollowMap`, `wardMap`, `veilMap`, `emberMap`) were redrawn
  from scratch with different shape intent.
- **Iron Quest's archetype taxonomy** (`humanoid`, `beast`,
  `aberration`, `construct`, `swarm`). Momentum's enemy
  taxonomy is `lesser_fragment | hollow | ward`
  (`docs/workout-rpg/010-enemy-design-bible.md` §4). Mapping
  Iron Quest archetypes 1:1 would create five sprite slots we
  have no design for.
- **Iron Quest's rarity-keyed palettes.** Iron Quest splits
  palettes by `common | uncommon | rare | epic | legendary`.
  Momentum splits palettes by **mood**
  (`drift | hush | glare | stone`) — a four-way axis tied to
  narrative atmosphere, not RNG drop tiers. The palettes were
  recoloured from scratch against the existing Momentum tokens
  in `workoutColors.ts`.
- **The HP-percent injury logic.** Iron Quest fades the
  silhouette as HP drops, injects "bleed pixels" via a
  coordinate-seeded RNG, and overlays a `tintRed()` distress
  pass below 25% HP. None of that is in Momentum. The Hollow
  doesn't bleed. Enemies *thin* into mist; they do not look
  wounded.
- **The low-HP flicker** — same reasoning. Anti-pattern for our
  tone (`docs/workout-rpg/012-battle-ux-and-feel.md` §3).
- **The enraged red-tint.** Momentum's analogue is the
  Hearth-coloured tint applied when `victoryAvailable` is true.
  Different colour, different meaning: "victory available" reads
  as *thinned*, not *furious*.
- **The DCC tone surface.** Iron Quest's renderer is tone-neutral,
  but its sibling files (`announcer.js`, NPC names) are firmly
  DCC. None of that ships with this renderer — and a future
  voice-pack port will follow the discipline laid out in
  `015-ironquest-port-plan.md` §3 and §7.5.

---

## 3. Palette philosophy

> *Each mood has one job; the palette is the colour of that mood
> heard out loud.*

Four moods, four 5-colour palettes. Ordered dim → bright; the
darkest entry reads as silhouette edge, the brightest as inner
highlight. All four palettes mute the bright end so the sprite
never out-screams the rest of the Battle screen.

| Mood | Palette | Vibe |
|---|---|---|
| `drift` | warm-tinged greys `#3a3540 … #a89a92` | Settled. Dusty. The colour of a room left unswept. |
| `hush` | cool blue-greys `#1a2330 … #7a8a95` | Distance at dusk. Quiet, watchful. |
| `glare` | ember/red `#3a1810 … #e9a14b` | The only warm mood. The "loud" silhouette. |
| `stone` | slate `#1e1e26 … #86869a` | Weight without aggression. |

Crit / victory-available state blends every coloured pixel toward
the Hearth token (`#D55E3F`) at 30% — the silhouette warms and
softens without becoming red. The blend is implemented in pure
TypeScript (`tintHearth(hex, amount)`); no per-pixel native
shaders required.

A reserved `desaturate(hex, amount)` helper is also exported so a
future "rest" or "spent" state can shift toward grey without
re-importing the colour math.

---

## 4. Why View-based rendering

Three independent reasons, in order of importance:

1. **Expo Go compatibility.** `react-native-reanimated` and
   `@shopify/react-native-skia` both break Expo Go on Android
   without a custom dev build. Iron Quest banned them for this
   reason. Momentum's MVP runs on Expo Go and on plain Gradle
   builds with no custom native modules — Views + built-in
   `Animated` get us identical visual results at zero setup
   cost.
2. **Zero new dependencies.** The renderer ships as one TSX
   file plus two data modules. Our `package.json` is unchanged.
   The orchestrator stays pure-TS. There is no new transitive
   surface to audit.
3. **Test-friendly.** Pure-data modules (`spriteMaps.ts`,
   `spritePalettes.ts`) are runtime-loadable in Node Jest. The
   component file is the only thing that touches `react-native`,
   and we type-import it in tests rather than runtime-import
   (mirroring `packages/ui`'s convention). That keeps the test
   harness lean.

We will revisit Skia/Reanimated if and only if a future visual —
particle effects, large-screen scenes, real-time blending — *cannot*
be expressed in Views. None of MVP, post-MVP, or the planned
camp-scene port needs them.

---

## 5. How enemy moods map visually

Live category mappings (`apps/workout/src/render/spriteMaps.ts`
`CATEGORY_TO_MAP`):

| `EnemyCategory` | Sprite | Read |
|---|---|---|
| `lesser_fragment` | `fragmentMap` | A settled, slumped form. No face, no posture, just weight in the room. |
| `hollow` | `hollowMap` | A scattered cloud-like mass with small motes drifting above and below. Reads as "many things at once." |
| `ward` | `wardMap` | A tall sentinel pillar. The only sprite whose idle silhouette uses palette index 5 (a single point of intent at the head). |

Reserved silhouettes (no category binding yet; ready for future
extensions without a schema change):

| Reserved map | Intended use |
|---|---|
| `veilMap` | A hanging drape with two faint eyes near the top. Tidal-ruin enemies; aberration-aligned forms. |
| `emberMap` | A radiant centre-bright orb. Ascendant-tier tier-up beats; future symbolic boss encounters. |

The renderer also accepts a `spriteMap` override prop. A future
branch can pass a curated `emberMap` for an Ascendant flourish
without touching the category table.

---

## 6. Animation: "quiet mythic pressure"

Single budget: one `Animated.loop` per mounted sprite, modulating
opacity between `1.0` and `0.88` over a 4.8-second cycle (2.4 s
each direction), using the native driver.

This is the *entire* animation surface. No:

- bouncing
- screen shake
- particle bursts
- flashing damage numbers
- scale pulse
- rotation
- colour-cycling effects
- "intro" reveal animations

That restraint is deliberate. The animation is there to make the
silhouette feel *present*, not *alive*. Players reading
`docs/workout-rpg/012-battle-ux-and-feel.md` §3 will recognise
this as `breath-in`/`breath-out` territory — slow, ambient, no
arcade energy.

A `paused` prop is available for callers that want a frozen sprite
(e.g., a future Reward screen review of the encounter); the loop
cleans up on unmount and on the `paused` flip.

---

## 7. Battle screen integration

The change to `BattleScreen.tsx` is minimal:

```tsx
// before
<View style={[styles.silhouette, victoryAvailable && styles.silhouetteThinned]}>
  <Text style={[styles.silhouetteGlyph, victoryAvailable && styles.silhouetteGlyphThinned]}>◆</Text>
</View>

// after
<View style={[styles.silhouette, victoryAvailable && styles.silhouetteThinned]} accessibilityRole="image">
  <MonsterSprite
    mood={currentEnemy.mood}
    category={currentEnemy.category}
    victoryAvailable={victoryAvailable}
    pixelSize={8}
    testID="battle-monster-sprite"
  />
</View>
```

The existing circular `silhouette` container (140 × 140) and the
`silhouetteThinned` border-colour shift on victory are kept. The
text glyph and its companion styles are removed; the sprite (96 ×
112 at `pixelSize: 8`) sits cleanly inside the circle's padding.

No other Battle-screen change. No new state, no new selectors,
no copy edits.

---

## 8. Future extension ideas

Listed here so the next person picking up the renderer doesn't
have to re-derive them:

- **Per-set hit reaction.** A one-shot 120 ms scale jitter on
  `lastSetDamage` change. Subtle enough to not cross into arcade
  territory.
- **Per-enemy sprite variant.** The renderer already accepts a
  `spriteMap` override; the next step is a small lookup keyed on
  `enemy.id` so individual named fragments
  (e.g. *The Pale Hours*, *The Brittle Crown*) can ship distinct
  silhouettes without changing the category contract.
- **Camp scene** (already queued in
  `015-ironquest-port-plan.md` §6 #1). The same View + palette
  primitives compose into the Tavern → Camp layered scene.
- **Tier-up cameo.** On a Momentum tier crossing, swap to the
  reserved `emberMap` for ~3 s with a slow opacity fade, then
  return to the normal sprite. Reuses existing primitives.
- **Larger pixel size on the Reward screen.** Pass
  `pixelSize: 12` to render the just-defeated silhouette at 144 ×
  168 on the reward summary card.
- **Mood transition.** When `maybeEscalateEnemyMood()` ticks
  (`packages/workout-domain/src/orchestrator/enemyState.ts`),
  cross-fade between the prior mood's palette and the new mood's
  palette over ~600 ms. Pure JS-side blend; no new deps.

None of those land in this branch. This branch is *just* the
renderer + integration + tests + this document.

---

## 9. Layout of the new code

```
apps/workout/src/render/
  index.ts              barrel
  MonsterSprite.tsx     React component (the only RN-touching file)
  spritePalettes.ts     mood-indexed palettes + tint helpers
  spriteMaps.ts         5 hand-redrawn sprite grids + category lookup
```

Tests:

```
apps/workout/src/tests/monsterSprite.smoke.test.ts
  - palette shape + count + hex format
  - sprite map shape + bounds (every cell 0..5)
  - category → map binding for every live EnemyCategory
  - tintHearth + desaturate math (round-trips, clamps)
  - render-layer regression: no Reanimated / no Skia / no
    reference/ironquest / no @dwhi/domain / no @/... imports
```

---

## 10. What this branch is NOT

For the record, so a code reviewer can verify by checking the diff:

- Not a combat-math change. `packages/workout-domain/` is
  untouched.
- Not a persistence change. `apps/workout/src/persistence/` is
  untouched.
- Not a Supabase change. No remote calls, no schemas.
- Not a DWHI pantry change. No files under `src/`, `app/`,
  `apps/dwhi/`, `supabase/`, or any `packages/{framework,ui,domain}/`
  were modified.
- Not a dependency change. Both `package.json` files
  (root + `apps/workout/`) are unchanged in this branch.
- Not a copy of any Iron Quest source. All sprite arrays,
  palette colours, and component code are original.
