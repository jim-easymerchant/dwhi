# 009 — Cardio & World Systems

> **Strength training is combat. Cardio is traversal. Recovery is
> stability.**
> Three activities, three fundamentally different scoring surfaces.
> This separation is a *design pillar*, not a feature flag.

---

## 1. Why separate cardio from combat

If cardio is folded into the damage formula, two bad things happen:

1. Long runs become "low DPS workouts" and feel like a worse
   bench press. That is a lie about how cardio works.
2. The game's narrative shape collapses. Everything happens in
   combat. There is no *place*, no *world*, no *traversal* — just
   a fight, then another fight, then another.

By giving cardio its own scoring axis, we recover both of those.
A long run is **a journey across the world map**. A walk to the
mailbox is **a small route through a settlement**. A weekly cycle
commute is **a route along the trade roads**. Cardio is the verb
that **moves the camera**.

This also gives us a clean philosophical home for the player who
cannot or does not want to lift — they can play the game by walking.
The Vow does not require a barbell.

## 2. Cardio as exploration

Cardio output (steps, distance, elevation, time-in-zone) feeds into:

- **Trail Energy** — a fuel resource for traversal.
- **World map exploration** — reveals new regions of The Hollow.
- **Region restoration** — Trail Energy spent on a route restores
  the route's region progress.
- **Dynamic encounters** — ambient world events seeded along the
  player's traversal (post-MVP).
- **Campfire resources** — light, narrative pickups that surface
  during recovery sessions and on long traversals.
- **The Long Road** — the always-available, never-shaming
  background continuity system (see §5).

Cardio **never deals combat damage**. Cardio **never threatens
Momentum negatively**. Cardio's worst case is "nothing happens";
its best case is "the world is bigger now."

## 3. Trail Energy

**Trail Energy** is the spendable currency of traversal. It is
*not* a depleting resource that punishes inactivity — it is a
*battery* that fills with movement and discharges into world
progress.

### Earning

| Activity | Trail Energy |
|---|---|
| Steps (passive, capped at one daily fill) | ~ 1 TE per 200 steps, cap 30/day |
| Walk session (active, ≥ 10 min) | 5 TE + 1 per minute thereafter |
| Hike (active, with elevation) | walk rate × (1 + 0.02 × meters_climbed/100) |
| Run | 1.5 × walk rate (sustained pace) |
| Cycle | 0.6 × walk rate per minute (volume-weighted) |
| Swim | 1.2 × walk rate per minute |

These rates are starting numbers, all live in a single
`cardioBalance.ts` file (post-MVP).

### Cap and decay

- Trail Energy caps at **100** (per player). Players cannot
  hoard hundreds of TE from a single epic hike — the world
  rewards rhythm, not bursts.
- TE does **not decay** on its own. A player who walks once and
  doesn't return for a month still has their TE on return. This
  is intentional. (Compare: Momentum decays gently because
  Momentum is *rhythm*. TE is *intent banked toward a journey*.)

### Spending

- TE is auto-spent against the current route. Players don't pick
  routes manually unless they explicitly opt in.
- The default route is "the nearest unrestored region edge." It
  always exists; the player never has to make a choice to
  participate.

## 4. World map and region restoration

The Hollow is a small, hand-authored map (MVP target: 5-7 named
regions). Each region has:

- A **fog level** (0 = fully restored, 100 = untouched).
- A **flavor** (settlement, mountain, wildlands, trade road,
  tidal ruins).
- A **traversal affinity** (see §8) that biases which cardio
  modes naturally restore it.

Spending Trail Energy reduces the active region's fog level.
Hitting fog 0 unlocks:

- A small lore page.
- A visual change to the home screen world map.
- A region-resident enemy variant becoming available in Quests
  (post-MVP).

There is **no failure state for a region**. Unrestored regions
do not "decay back" or fill in with fog again over time. The
world remembers the work.

## 5. The Long Road

The single most important mechanic in this document.

> **The Long Road** is the always-on, low-effort traversal system
> that keeps the Ember alive when the player can't lift.

Mechanically:

- Any logged cardio activity (active or ambient) contributes to
  the Long Road.
- Walking 1,500 steps in a day → +0.5 Momentum **floor protection**
  (i.e., decay is delayed by half a day).
- A 20-minute walk session → +1 Momentum **directly**, plus floor
  protection.
- A 60+ minute hike, run, or ride → counts as a Camp for
  Momentum purposes (+3 Momentum, capped per `004` rules).

The narrative framing:

> *Even when the war waits, the road moves. Walking is the Vow
> too.*

The Long Road is **explicitly anti-shame**. A player who can't
lift this week for any reason — injury, illness, depression, life
— can stay connected to the world by walking. Their Momentum
holds. Their Ember stays warm. Their character continues to
exist in The Hollow. The system *expects* this and accommodates
it as a first-class path.

### Who the Long Road is for

- Injured players in a healing arc.
- Players in a depressive episode who need the lowest possible
  bar to "play."
- Travelers without gym access.
- Walking commuters who would otherwise feel "off the map."
- New parents whose only movement for a stretch is a stroller
  walk.

These are not edge cases. These are *most users, some weeks*.

### What the Long Road is NOT

- Not a damage path. The Long Road does not feed into combat math.
- Not a shame loophole that "doesn't count." It explicitly
  *counts* for Momentum, for armor unlock conditions
  (Ashwalker Garb, Emberweave), and for world progress.
- Not gamified into a steps competition. There is no leaderboard,
  no daily target, no streak counter for the Long Road.

## 6. Dynamic encounters and Campfire resources (post-MVP)

These are listed here so the data model has room for them; **MVP
ships none of them**.

- **Dynamic encounters**: occasional, low-stakes world prompts
  during long traversals ("A traveler is camped along the road —
  share a story?"). Tap to read; tap to dismiss. Never blocks.
  Never requires action.
- **Campfire resources**: small lore tokens collected during
  recovery sessions and long traversals. Surfaced as a quiet
  badge on the home screen; tap to read flavor.

Both are pure narrative. They do not affect combat balance or
Momentum. They are **texture**, not mechanics.

## 7. Health API / wearable integration

We integrate with platform Health APIs **passively** and
**ambiently**. The integration is opt-in, deferrable forever, and
never required to play.

### Principles

1. **Passive sync only initially.** Read steps, distance, active
   minutes, elevation. Do *not* write back to Health.
2. **No mandatory smartwatch gameplay.** Combat does not require
   a heart-rate signal. Quests do not require a watch.
3. **No active tracking pressure.** No "start workout" handoff to
   the watch. The player's phone is the source of truth.
4. **Ambient supportive design.** If Health data shows a long
   walk happened, the Long Road quietly accepts it. If not,
   manual logging works equally well.

### Possible integrations (post-MVP, opt-in)

| Signal | Effect |
|---|---|
| Steps | Passive Trail Energy (capped per §3) |
| Distance | Route progress on the world map |
| Active minutes | Long Road contribution |
| Heart rate zones | Light "intensity" flavor for run/cycle entries — *not* a multiplier |
| Hiking elevation | Bonus Trail Energy for elevation gained |
| Cycling distance | Trade-road region progress (see §8) |

We deliberately do **not** integrate:

- VO2 max estimates (medicalized, often inaccurate, easy to
  shame around).
- Sleep tracking (out of scope; we are not a sleep app).
- Body composition (banned by `001-design-bible.md` §5).
- Move/stand rings (third-party rhetoric we do not want to
  inherit).

### Permission flow

Health permissions are requested **only** at the moment a player
opts in to a feature that needs them. We do not ask on first
launch. We do not gate any MVP screen behind permission.

If a player declines Health access, the entire cardio system
still works through manual entry. Manual entry is **never** a
worse experience than synced entry — same fields, same XP, same
world progress.

## 8. Regional and environmental affinities

Every region in The Hollow has a soft preference for *how* it
gets traversed:

| Region type | Affinity | Example regions |
|---|---|---|
| Settlements | Walking | Stonehearth, the Lampway |
| Mountains | Hiking (walking + elevation) | The Spine, Ridgehold |
| Wildlands | Running | The Verge, Long Heath |
| Trade roads | Cycling | The Iron Loop, Salt Way |
| Tidal ruins | Swimming | Drowned Sept, Cradle Coves |

"Affinity" means the region restores ~1.25× faster when
traversed in its preferred mode. There is **no penalty** for
non-preferred traversal — only a gentle bonus for preferred.

A player who walks everywhere will progress through every region;
they will simply move through settlements fastest. This means the
world is not gated by gear (no bike required to play). Affinity is
**flavor, not a paywall**.

## 9. MVP scope for cardio

MVP cardio shipping in the first playable build is intentionally
small:

- **Manual walk / hike / run / cycle entry**, single screen,
  fields = minutes + (optional) distance.
- **Trail Energy bar** on the home screen, alongside the Ember.
- **One region** on the world map (the Hollow's edge — a small
  settlement-edge zone).
- **Long Road** rules wired through Momentum (the most important
  piece). Walking counts. Camp logic extended to honor cardio
  sessions.

What's **not** in MVP:

- Health API integration (post-MVP, opt-in).
- Multi-region map.
- Routes, affinities, dynamic encounters, campfire resources.

The order is deliberate: **the Long Road comes first**, because
it is the anti-shame anchor. Everything else is texture.

## 10. Data model deltas (proposed)

Additions to the schema proposed in `006-monorepo-integration-plan.md`:

### `cardio_sessions`

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | uuid |
| modality | TEXT | `walk` / `hike` / `run` / `cycle` / `swim` |
| started_at | TEXT | ISO |
| duration_seconds | INTEGER | |
| distance_meters | REAL NULL | |
| elevation_meters_gained | REAL NULL | |
| source | TEXT | `manual` / `health_api` |
| trail_energy_earned | INTEGER | denormalized at log time |
| household_id | TEXT NULL | future sync |

### `world_regions`

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | `stonehearth`, etc. |
| display_name | TEXT | |
| flavor | TEXT | `settlement` / `mountain` / `wildlands` / `road` / `tidal` |
| fog_level | INTEGER | 0-100 |
| affinity | TEXT | the modality this region restores fastest |

### `player_trail_energy`

Single-row.

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | always `default` |
| value | INTEGER | 0-100 |
| computed_through | TEXT | ISO; high-water mark for passive top-ups |

### `route_progress`

Lightweight cache of TE applied to regions.

| Column | Type | Notes |
|---|---|---|
| region_id | TEXT PK | |
| te_applied | INTEGER | total TE applied lifetime |
| restored_at | TEXT NULL | timestamp of first full restoration |

These tables are *proposed*, not migrated in this branch.

## 11. Connection to other systems

| System | Cardio's relationship |
|---|---|
| Combat (`003`) | None. Cardio does not feed combat math. |
| Momentum (`004`) | The Long Road feeds Momentum directly and provides decay protection. |
| Archetypes (`007`) | `endurance` archetype is the *strength-session* analog of cardio; `recovery` is the *Ember stabilizer*. Cardio sessions can earn endurance-archetype credit toward weapon resonance. |
| Equipment (`008`) | Traveler's Spear and Ashwalker Garb unlock from cardio patterns. |

## 12. The promise the player feels

A player who walked for a month while injured should be able to
open the app and feel that **the game saw them**. Their Ember is
warm. Their world has grown. Their armor has a name. The Vow
holds.

If a player ever says "I felt embarrassed to log a walk" — the
system has failed and we redesign. If they say "the walks kept me
in" — it has worked.
