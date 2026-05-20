# 020 — World state & patrons

> "Returning to a place, not opening a tool."

Branch 019 split the Home screen into eight composable tavern
components and put the right copy in each. This branch makes the
room feel **occupied** — not by static theme strings, but by
recurring presences and ambient observations that rotate as the
days pass.

The mandate is narrow:

- a small world layer that answers the question "what does the
  room feel like tonight?"
- a deterministic per-day patron rotation (Iron Quest's
  `getTonightNPCs` shape, adapted),
- a patron roster that is **emotional / coaching archetypes**,
  not DCC sketch comedy stand-ins,
- a theme-aware system so the same patrons sound right in both
  Momentum (quiet, mythic) and Iron Quest Classic (loud, arcade),
- **zero** gameplay mechanics, **zero** new dependencies, **zero**
  runtime imports from `reference/ironquest/`.

The result: an opaque `WorldNight` value the Home screen renders,
backed by a 11-entry patron roster and a 20-entry observation
pool (10 per theme).

---

## 1. Goals

1. **Inhabited, not exposition.** The room has recurring figures.
   They are not vendors. They do not block progress. They are
   atmospheric *witnesses*.
2. **Pressure, never cruelty.** A patron can challenge, observe,
   commit to silence, or offer a steady hand. None of them is
   allowed to mock, body-comment, or moralise.
3. **Deterministic + cheap.** Same theme + tier + days-since +
   day-seed → same patrons, same dialogue, same observations.
   Safe to call on every render.
4. **Theme-portable.** One patron, two voices. Identity is
   shared; dialogue is themed.
5. **No new dependencies.** Pure TypeScript, no I/O, no
   persistence, no Reanimated / Skia / Canvas, no runtime
   `reference/ironquest/` imports.

---

## 2. Why archetypes instead of vendors

The Iron Quest tavern (`reference/ironquest/src/data/npcs.js`)
fills the room with characters whose appeal is *sketch comedy*:

- "Phil (Former Lich)"
- "Sponsored Content Elemental"
- "A Dog That Should Not Be Here"
- "Carl (Maybe)"
- "Extremely Normal Human"

That tone has charm, but it conflicts with what Momentum is
trying to do. Momentum's premise is *the room is on your side*.
Sketch comedy works against that — every joke is a small wedge
of disbelief between the player and the world. The world stops
feeling persistent and starts feeling like a punchline.

This branch keeps the *architectural* trick (a small recurring
cast, picked deterministically per day) and changes the *content*
to **coaching / emotional archetypes**:

| archetype          | what they embody                                 |
| ------------------ | ------------------------------------------------ |
| `spotter`          | safety-with-effort coaching                      |
| `quietRunner`      | pace / endurance philosophy                      |
| `hearthkeeper`     | warm presence; tends the room                    |
| `archivist`        | remembers effort kindly                          |
| `challenger`       | pushes — never shames                            |
| `cook`             | provisioning / fuel without policing             |
| `nightJanitor`     | humble witness; sees everything                  |
| `traveler`         | returns from elsewhere with perspective          |
| `oneWhoStretches`  | mobility / patient careful presence              |
| `oldSoldier`       | recovery wisdom; honours when to stop            |
| `newcomer`         | mirrors the player's first steps — always welcome|

These are **roles**, not personalities. The Spotter exists
because a real gym has someone who watches your form. The
Hearthkeeper exists because someone has to keep the fire alive
between visits. None of them is a quest-vendor, a comic relief,
or a moral judge. They are recurring acts of *witness*.

---

## 3. Module layout

```
apps/workout/src/world/
  worldTypes.ts        — type definitions only
  patrons.ts           — the 11-entry roster + per-theme dialogue pools
  patronDialogue.ts    — pickDialogue + selectPatronsForNight
  worldRng.ts          — tiny seeded RNG + tier comparison
  worldState.ts        — generateNightlyWorld (public entry point)
  index.ts             — barrel
```

Public entry point:

```ts
import { generateNightlyWorld } from '../world';

const world = generateNightlyWorld({
  themeId: selectedThemeId,
  tier,
  daysSinceLastQuest,
  // daySeed: defaults to Math.floor(Date.now() / 86_400_000)
});

// → WorldNight {
//     patronSectionLabel,
//     patrons,        // [{ patron, line }]
//     observations,   // [{ id, text }]
//     timeOfDay, hearthState, roomEnergy, weather,
//     weatherLine, activityHint,
//   }
```

The whole module is pure — no I/O, no timers, no persistence. The
function is safe to call on every render. The HomeScreen memoises
it on `[selectedThemeId, tier, daysSinceLastQuest]` anyway, but
even without that, the cost would be a single seeded shuffle of
an 11-entry list plus a handful of bucket picks.

---

## 4. Theme integration

`ThemePack` gained a sub-shape:

```ts
interface ThemeWorldState {
  patronSectionLabel: string;        // "Tonight at the hearth" / "TONIGHT'S PATRONS"
  ambientDensity: 'sparse' | 'medium' | 'dense'; // → 2 / 3 / 4 patrons
  tavernEnergyBias: number;           // -1..+1; biases room-energy roll
  weatherCopy: Record<Weather, string>; // theme-flavoured weather sentences
}
```

|                    | Momentum                                          | Iron Quest Classic                                |
| ------------------ | ------------------------------------------------- | ------------------------------------------------- |
| patronSectionLabel | "Tonight at the hearth"                           | "TONIGHT'S PATRONS"                               |
| ambientDensity     | sparse (2 patrons, 2 observations)                | dense (4 patrons, 3 observations)                 |
| tavernEnergyBias   | -0.35 (biases toward quiet/settled)               | +0.4 (biases toward lively/crowded)               |
| weatherCopy.rain   | "Rain taps softly on the roof tiles."             | "Rain hammers the tavern roof. The fire mocks it."|

This is the **only** place the layout cares about theme. The
panel component, the screen, and the world generator are
theme-agnostic; the strings flow through `ThemePack.worldState`.

---

## 5. Patron dialogue — one identity, two voices

Each patron carries `dialoguePools[ThemeId]` with at least 2
lines per theme. The Spotter says exactly what the Spotter would
say — but in the right register:

| Spotter, Momentum                                       | Spotter, Iron Quest Classic                        |
| ------------------------------------------------------- | -------------------------------------------------- |
| "Leave one clean rep in the chamber."                   | "Bar path. Eyes up. Breathe."                      |
| "The floor tells the truth. Listen to it."              | "One clean rep beats three sloppy ones. Always."   |
| "Form first. Weight second. Pride a distant third."     | "I have seen too many heroes wreck a shoulder…"    |
| "I'll catch what slips. You handle the rest."           | "I'm right here. Don't be a hero."                 |

The selection is deterministic. `pickDialogue(patron, themeId,
seed)` mixes the patron id into the seed (fnv-1a-style) so that
two patrons sharing the day's seed don't both pick the line at
index 0 of their respective pools — every patron in the room
"says something different."

---

## 6. World-state primitives

The generator produces five bucketed values:

| field        | values                                            | derived from                              |
| ------------ | ------------------------------------------------- | ----------------------------------------- |
| timeOfDay    | dusk / evening / lateNight / predawn              | seeded RNG draw                           |
| hearthState  | cold / low / warm / bright / roaring              | tier + daysSinceLastQuest                 |
| roomEnergy   | quiet / settled / lively / crowded                | RNG + `theme.worldState.tavernEnergyBias` |
| weather      | rain / wind / still / snow / fog / clear          | seeded RNG draw                           |
| activityHint | per-theme sentence, OR empty when room is "quiet" | derived from roomEnergy                   |

The buckets are intentionally coarse. The room only needs to
*feel* different across days, not simulate a city.

---

## 7. Determinism contract

Identical input always produces identical output:

```ts
const a = generateNightlyWorld({ themeId, tier, daysSinceLastQuest, daySeed: 1234 });
const b = generateNightlyWorld({ themeId, tier, daysSinceLastQuest, daySeed: 1234 });
// a.patrons       === b.patrons       (same ids in same order)
// a.observations  === b.observations  (same ids in same order)
// a.weatherLine   === b.weatherLine
// a.hearthState   === b.hearthState
```

Pinned by `worldState.test.ts §4`.

The default `daySeed` is `Math.floor(Date.now() / 86_400_000)` —
one stable value per UTC day. Same shape as Iron Quest's
`getTonightNPCs`. A test confirms `defaultDaySeed(now)` returns
the same number for the whole day and increments at midnight.

---

## 8. Filters

Two patrons opt out of arbitrary nights:

- **The Challenger** sets `appearsWhen.minEnergy = 'settled'`.
  Pressure is a tonal choice — a quiet room is not a pressure
  room.
- **The Old Soldier** sets `appearsWhen.minTier = 'driven'`.
  Recovery wisdom needs context; on the rusted Ember, the Old
  Soldier is not yet in the room.

The Hearthkeeper has a soft guarantee: if she didn't get
shuffled into the picked set, the selector prepends her over the
lowest-priority pick. The room is never empty of warmth.

---

## 9. Example generated nights

```ts
generateNightlyWorld({
  themeId: 'momentum',
  tier: 'rusted',
  daysSinceLastQuest: 9,
  daySeed: 100,
})
// →
// patronSectionLabel: "Tonight at the hearth"
// patrons: [
//   { The Hearthkeeper, "I banked the coals before sundown. They held." },
//   { The Quiet Runner, "The road is patient. So am I." },
// ]
// observations: [
//   { rain-stone, "Rain taps softly against the stone." },
//   { lamps-trimmed, "The lamps are trimmed low. Just right." },
// ]
// weather: 'rain' / weatherLine: "Rain taps softly on the roof tiles."
// hearthState: 'cold'   roomEnergy: 'quiet'   activityHint: ''
```

```ts
generateNightlyWorld({
  themeId: 'ironquest-classic',
  tier: 'driven',
  daysSinceLastQuest: 1,
  daySeed: 100,
})
// →
// patronSectionLabel: "TONIGHT'S PATRONS"
// patrons: [
//   { The Hearthkeeper, "Kettle is hot. Mug is yours." },
//   { The Challenger,    "That all you brought?" },
//   { The Archivist,     "The kill log is open. Add a line, would you?" },
//   { The Old Soldier,   "I rack the bar when the bar tells me to." },
// ]
// observations: [
//   { chalk-on-bar, "A faint dust of chalk has settled along the bar rail." },
//   { lifters-booth, "Three tired lifters occupy the back booth, mugs untouched." },
//   { mug-row, "A row of mugs sits warming by the fire..." },
// ]
// weather: 'rain' / weatherLine: "Rain hammers the tavern roof. The fire mocks it."
// hearthState: 'bright'   roomEnergy: 'crowded'   activityHint: "The bar is full. The kettle is loud..."
```

Same seed, different theme + tier → completely different room.

---

## 10. Home-screen integration

The HomeScreen now:

1. Calls `generateNightlyWorld(...)` once per render (memoised).
2. Renders a new `PatronsPanel` between the scene-frame and the
   existing AmbientPanel.
3. Appends `world.weatherLine` to the scene-frame's flavour
   line so the scene "breathes" with the weather day to day.
4. Renders `world.activityHint` (italic muted) above the lower
   panels when non-empty.

The existing AmbientPanel (tier-keyed generic blurbs from
`theme.ambient.lines`) stays put. The new PatronsPanel
(dynamically generated per-day presences) sits *above* it. The
two panels complement each other: AmbientPanel is the room's
*atmosphere*, PatronsPanel is the room's *occupants*.

---

## 11. Anti-shame contract — tested

The world layer's testing surface includes a curated regression
list:

```ts
const SHAMING = [
  /\blazy\b/, /\bweak\b/, /\bquitter\b/, /\bfailure\b/,
  /\bworthless\b/, /\buseless\b/, /\bcalorie/, /\bbmi\b/,
  /\bdiet\b/, /\bfat\b/, /\bskinny\b/, /\bugly\b/,
  /\bpathetic\b/, /\bdisappointing\b/,
];
const NEGATIVE = [
  /\bmissed\b/, /\bskipped\b/, /\bgone too long\b/,
  /\bwhere have you been\b/,
];
```

These run against **every patron dialogue line in every theme**
and against the observation + activity-hint corpus over a 50-seed
sweep. New patrons / observations / weather copy that violate the
contract fail CI immediately.

Pressure is allowed:

- "Again. Cleaner this time."
- "That all you brought?"

Cruelty is not. The Challenger pushes; she does not insult.

---

## 12. Distinction: atmosphere vs mechanics vs progression vs narration

This module is **atmosphere**. It is not any of the other three:

| layer       | what it is                                          | this branch?                  |
| ----------- | --------------------------------------------------- | ----------------------------- |
| atmosphere  | how the room *feels* — patrons, weather, observations| **yes**                       |
| mechanics   | combat math, fatigue, momentum decay                | no (untouched)                |
| progression | XP, gear, levels, persistence                       | no (untouched)                |
| narration   | per-event lines triggered by combat                  | no (lives in `theme/narration.ts`) |

A future branch may consult `WorldNight` for *narration cues*
("the Challenger is in the room → the quest-start line can be a
shade louder") — but that consumer lives outside this module. The
world layer **never reads from** combat / persistence; it never
writes to them. It is one-way data.

---

## 13. Future expansion (not in this branch)

- **Memory of recent presences** — a patron whose dialogue you
  liked sticks for a second day. (Single-row SQLite table.)
- **Tier-keyed observation pools** — currently the observation
  pool is theme-keyed only. A later branch can pick observations
  per (theme × tier).
- **Per-patron sprite silhouettes** — render small figures into
  the scene frame so the room visually fills as patron count
  grows.
- **Reward-screen acknowledgement** — the Archivist's line
  appears on the reward summary when she was in the room that
  day.
- **Patron voice-pack integration** — the narration system (017
  → 018) gains an optional patron-voiced overlay.

All deferred. This branch ships the atmospheric layer only.

---

## 14. Files

```
apps/workout/src/world/                       (new)
  worldTypes.ts
  patrons.ts
  patronDialogue.ts
  worldRng.ts
  worldState.ts
  index.ts
apps/workout/src/components/tavern/
  PatronsPanel.tsx                            (new)
  index.ts                                    (updated)
apps/workout/src/screens/HomeScreen.tsx       (updated)
apps/workout/src/theme/themeTypes.ts          (worldState sub-shape on ThemePack)
apps/workout/src/theme/momentumTheme.ts       (worldState block added)
apps/workout/src/theme/ironQuestClassicTheme.ts (worldState block added)
apps/workout/src/theme/index.ts               (re-exports ThemeWorldState)
apps/workout/src/tests/worldState.test.ts     (new — 32 assertions)
docs/workout-rpg/020-world-state-and-patrons.md (this file)
docs/workout-rpg/README.md                    (§20 entry)
```

---

## 15. Constraints respected

  - **No new dependencies.** `apps/workout/package.json` unchanged.
  - **`packages/workout-domain` is untouched.**
  - **No Supabase / auth / sync.**
  - **No Reanimated / Skia / Canvas.**
  - **No runtime imports from `reference/ironquest/`.** The
    concept-source comment in `worldTypes.ts` cites the file;
    the grep test rejects only actual `import …from
    '…reference/ironquest…'` (and `require()` / dynamic
    `import()`) statements.
  - **No gameplay mechanics, no progression systems, no lore
    databases.** Atmosphere only.
  - **No monolithic screens.** PatronsPanel is ~90 lines. The
    world module is split across 5 files averaging ~150 lines
    each.

---

## 16. Validation

| check                                  | result                  |
| -------------------------------------- | ----------------------- |
| `npm test`                             | 893 / 893 passing       |
| `npx tsc --noEmit`                     | clean                   |
| `cd apps/workout && npx expo config --type prebuild` | resolves   |
| world-state suite                      | 32 / 32 passing         |
| anti-shame regression                  | 50-seed sweep clean     |
| reference/ironquest import boundary    | grep regression clean   |
