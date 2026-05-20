# 017 — Camp Scene & Iron Quest Sprite Ports

> The second concrete port from `reference/ironquest/` into Momentum.
> Brings two things at once: a layered pixel-art **Camp scene** on
> the Home screen, and the full Iron Quest **monster sprite set**
> as named, registered Momentum assets. Both follow the discipline
> from `015-ironquest-port-plan.md` — no runtime imports from
> `reference/ironquest`, fresh TypeScript, no new dependencies.

---

## 1. What was ported from Iron Quest

Conceptually:

- **The layered View-based pixel-scene technique.** The Camp scene
  composes a back wall, a floor, a hearth frame, an animated
  flame, a low bench, two hanging lanterns, and a mood-tint
  overlay as nested `View` components — same approach as Iron
  Quest's TavernScene.
- **The frame-cycling animated flame.** A `setInterval` (cleaned
  up on unmount) ticks through three palette frames at ~220 ms
  intervals. The same primitive Iron Quest uses for the tavern
  fireplace.
- **The mood-tint overlay.** A full-bleed `View` at sub-1.0
  opacity sits on top of the entire scene to tint everything to
  the current mood — same `View`-overlay trick.
- **The full Iron Quest monster sprite set.** All five archetype
  grids — humanoid / beast / aberration / construct / swarm —
  are copied into Momentum render data as named maps
  (`ironquestHumanoid`, `ironquestBeast`, `ironquestAberration`,
  `ironquestConstruct`, `ironquestSwarm`). Each file carries a
  visible attribution comment.

## 2. What was adapted

- **"Tavern" → "Camp".** No `TavernScene`, no "Wounded Goblin"
  sign, no NPC silhouettes named after DCC characters, no bar
  counter. The Momentum scene is sparser and quieter — a
  hearth, a bench, two lanterns, a wall, a floor.
- **Mood lighting is keyed to Momentum tier, not narrative mood.**
  Iron Quest's `MOOD_TINT` had `normal / quiet / dusty /
  abandoned / tense / festive / late_night`. Momentum's
  `CAMP_TIER_TINTS` is one entry per Momentum tier:

  | Tier | Tint colour | Opacity | Flame intensity |
  |---|---|---|---|
  | rusted | `#08101a` cool blue-grey | 0.45 | 0.4 |
  | steady | `#1a1208` quiet warm | 0.22 | 0.75 |
  | driven | `#3a1d08` ember | 0.18 | 1.0 |
  | relentless | `#5a2810` stronger fire | 0.14 | 1.2 |
  | ascendant | `#a05818` bright hearth | 0.10 | 1.35 |

- **Rarity palettes are ignored.** Iron Quest pairs each sprite
  with five rarity palettes (common → legendary). Momentum
  deliberately does not surface rarity to the player
  (`010-enemy-design-bible.md` §6). The same Iron Quest sprite
  renders against any of Momentum's four mood palettes (drift /
  hush / glare / stone) — the body is the body, the mood does
  the colouring.
- **TypeScript port.** Iron Quest's components are JavaScript;
  Momentum's are typed end-to-end with explicit prop interfaces.
- **No DCC / RisingKB names anywhere in the player-facing UI.**
  The sprite ids use Momentum-neutral identifiers
  (`ironquest-humanoid` etc.) for traceability; the strings never
  surface to the player. The future fragment generator picks
  sprites by Momentum *category*, and the player sees only the
  hand-authored Momentum enemy names from
  `010-enemy-design-bible.md` §9.

## 3. What was intentionally NOT ported

- **The NPC roster** (`Phil (Former Lich)`, `Carl (Maybe)`, the
  "Sponsored Content Elemental", the announcer's lines). DCC tone
  is incompatible with Momentum's voice.
- **The trophy shelf.** Equipment surfaces only when the
  autobiographical-equipment branch lands
  (`008-equipment-philosophy.md`). No placeholder.
- **The "Tonight's Patrons" sidebar.** Same reason.
- **Iron Quest's HP-percent injury logic** on the monster sprite
  (bleed pixels, low-HP flicker, red distress wash). Already
  decided in `016-monster-renderer-port.md` §2.
- **Iron Quest's NPC sprite + palette.** Reserved for a later
  pass if and when Camp ever populates with visiting figures —
  and only then with hand-authored Momentum NPCs, not the IQ
  roster.
- **The animated-flame `setInterval` cycle on lanterns.** Iron
  Quest doesn't have this either; we kept lanterns as static
  silhouettes whose brightness scales with tier intensity.

## 4. How Camp differs from Tavern

| | Iron Quest Tavern | Momentum Camp |
|---|---|---|
| Branding | "The Wounded Goblin" sign | none |
| NPCs | 3–4 silhouettes per visit, named | none in MVP |
| Bar counter + tables | yes | no |
| Trophy shelf | yes, above bar | no (deferred to equipment branch) |
| Hearth | right side, large | centre, modest |
| Lanterns | 3 across ceiling | 2 (corner-left + corner-right) |
| Mood lighting | 7 narrative moods | 5 Momentum tiers |
| Default voice | sardonic, DCC | quiet, mythic |
| Animated elements | flame, mood tint | flame, mood tint, breathing |

The Momentum Camp is the same *technique* used for a different
*feeling*: less furniture, less narrative bric-a-brac, more
silence and warmth. The player should read it as **a place that
remembers them**, not a place full of opinions.

## 5. How Iron Quest sprite shapes map to Momentum categories

`apps/workout/src/render/spriteMaps.ts` exposes a
`CATEGORY_SPRITE_OPTIONS` table — for each Momentum
`EnemyCategory`, an ordered list of sprite ids that *can*
represent it. The first entry is the default (Momentum's
hand-authored silhouette from branch 16); the remaining entries
are Iron Quest-derived alternates that a future fragment
generator can rotate through for variety.

| `EnemyCategory` | Default sprite | Iron Quest alternates |
|---|---|---|
| `lesser_fragment` (the room-resident form) | `fragment` (Momentum slumped silhouette) | `ironquest-humanoid`, `ironquest-aberration` |
| `hollow` (the Quest-spanning mood made visible) | `hollow` (Momentum scattered cloud) | `ironquest-beast`, `ironquest-swarm` |
| `ward` (boss-tier sentinel) | `ward` (Momentum pillar with a point of intent) | `ironquest-construct` |

The MonsterSprite component now accepts an optional `spriteId`
prop that overrides the category-based lookup, so the future
fragment generator can ship variants without changing the enemy's
category contract. When no `spriteId` is supplied (the current
default for everything in BattleScreen), the Momentum-original
silhouette renders exactly as before.

## 6. Future plans for the procedural monster generator

The fragment generator from `015-ironquest-port-plan.md` §6 #3
will:

1. Pick a Momentum category for the spawning enemy
   (`lesser_fragment` / `hollow` / `ward`) deterministically from
   the seed.
2. Look up `CATEGORY_SPRITE_OPTIONS[category]` and pick one
   sprite id deterministically from the same seed.
3. Pick a mood (`drift` / `hush` / `glare` / `stone`)
   independently.
4. Construct the `EnemyInput` shape with the chosen sprite id
   threaded through to MonsterSprite.

The Iron Quest sprites give the generator a four-sprite menu for
fragments and a three-sprite menu for hollows; with the four
moods that's already 12-to-16 visually distinct fragments and 12
distinct hollows without any new authoring.

## 7. Layout of the new code

```
apps/workout/src/render/
  CampScene.tsx          new — layered pixel scene component
  campPalettes.ts        new — tier-keyed CAMP_TIER_TINTS, surfaces,
                              FLAME_FRAMES
  campSceneLayers.ts     new — sprite maps for hearth/flame/lantern/
                              bench + CAMP_LAYER_ORDER
  spriteMaps.ts          extended — 5 Iron-Quest-adapted sprites,
                              SPRITE_REGISTRY, CATEGORY_SPRITE_OPTIONS,
                              SpriteId type, spriteById()
  MonsterSprite.tsx      extended — optional spriteId prop
  index.ts               extended barrel
```

Tests (in `apps/workout/src/tests/`):

```
campScene.smoke.test.ts                  +21 tests
  - compile-time CampScene / props guard
  - tier→tint mapping monotonicity
  - tintFor fallback
  - flame frame palette wrap-around
  - layer order stability
  - every layer map is rectangular
  - declared layer dimensions match the maps
  - 5 IQ sprites are 14×12 valid
  - SPRITE_REGISTRY contains every id
  - spriteById fallback
  - CATEGORY_SPRITE_OPTIONS coverage + defaults
  - MonsterSprite accepts spriteId (compile-time)
  - regression: no Reanimated / Skia / reference/ironquest /
    @dwhi/domain / @/... / expo-* imports anywhere in render/
```

## 8. HomeScreen integration

The Home screen now renders a CampScene panel between the
subtitle and the Ember bar. Mood lighting tracks the player's
Momentum tier via the existing `resolveMomentumTier()` pure
helper from `@dwhi/workout-domain`. No layout reshuffles, no
copy changes, no CTA changes — the scene is purely additive.

The BattleScreen MonsterSprite call is unchanged. The Iron Quest
sprite alternates are accessible via the new `spriteId` prop but
nothing in MVP passes it yet — the fragment generator branch
turns them on.

## 9. What this branch is NOT

- Not a new dependency. `react-native` `View` + built-in
  `Animated` only.
- Not a Reanimated / Skia adoption.
- Not a combat-balance change.
- Not a persistence-schema change.
- Not a Supabase / auth / sync change.
- Not a DWHI pantry runtime change.
- Not a runtime import from `reference/ironquest`. The mention is
  doc-only; tests grep enforce it.
