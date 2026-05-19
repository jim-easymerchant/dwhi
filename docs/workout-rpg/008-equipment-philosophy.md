# 008 — Equipment Philosophy

> Weapons and armor are not a loot treadmill. They are **the
> player's training identity, externalized**. A player's gear at
> tier 30 should look like a portrait of how they actually trained.

---

## 1. Core principles

These four lines bind every equipment decision we ever make:

1. **Equipment reflects HOW the player trains.** Not how lucky
   they got. Not how much they paid. Not how many hours they
   ground.
2. **Equipment amplifies effort but never replaces it.** A great
   weapon makes a good set *read* bigger. It does not turn a bad
   set into a good one.
3. **Real-world effort is the primary progression vector.** Gear
   is downstream of behavior. If the player stops training, gear
   does not save them. If the player starts training, gear catches
   up to them quickly.
4. **No stat soup.** Generic +12 STR boots are forbidden. Every
   piece of gear has a *named effect* tied to a *named behavior*.

If a future feature contradicts any of these, it goes back to
design.

## 2. The autobiographical principle

> *Equipment becomes autobiographical.*

A long-time player's build — what they're holding, what they're
wearing — should be readable as a short biography of how they
trained. A player who pressed for a year carries the Titan Hammer.
A player who walked back from a long absence wears Ashwalker Garb.
A player who never skipped recovery wears Emberweave.

This means:

- Gear unlocks are **conditional on consistent behavior**, not on
  RNG drops, currency spend, or session count alone.
- Gear *visually evolves* with continued use. The first Titan
  Hammer is plain; after months of heavy work it weathers,
  inscribes, and gains its silhouette. Same item id; visual layer.
- Switching gear is **free and frictionless** but mostly
  unnecessary — most players will wear what they earned because
  it matches who they became.

## 3. Weapons — attack identity

A weapon expresses *attack style*. It is **archetype-resonant**:
the more a player trains in an archetype, the more naturally the
matching weapon family fits them.

### 3.1 Titan Hammer

> *Two-handed. Stone-faced. Made for the thing that does not
> move.*

| Property | Effect |
|---|---|
| Archetype resonance | `heavy` |
| Unlock | 12 logged heavy sessions over 6 weeks, or one PR in a heavy compound |
| Effect | The first working set in each battle has a louder hit and a wider damage number on screen. **No raw damage change.** |
| Visual evolution | At 50 sessions, gains a low pulse. At 150, gains earth crack VFX on swing. |

The Hammer's effect is *theatre*, not arithmetic. The bigger
number is the same number; it just lands harder.

### 3.2 Twin Ash Blades

> *Light. Paired. The fight ends because you never let it
> breathe.*

| Property | Effect |
|---|---|
| Archetype resonance | `pressure` |
| Unlock | 8 Quests in which 3+ pressure sets were the dominant work |
| Effect | Combo chain extends by +1 set before fatigue floor — *not* a damage buff, a *fatigue softening*. Encourages the rhythm without rewarding spam. |
| Visual evolution | Ember-flickers along the edges grow brighter as pressure consistency grows. |

The blades' effect is *forgiveness*, not amplification. A nudge,
not a lever.

### 3.3 Traveler's Spear

> *Reach. Patience. The first to read the room and the last to
> leave it.*

| Property | Effect |
|---|---|
| Archetype resonance | `control` / `endurance` (dual; spears are honest about being two things) |
| Unlock | A 4-week stretch in which the player both *controlled* (read: rowed, pulled, paced) and *endured* (walked, ran, cycled) at least once each week |
| Effect | The rest-timer "shave" option offered by `control` exercises widens by 5s; long endurance sessions earn slightly larger Ember stabilization. |
| Visual evolution | Travel dust and patina grow with logged distance. |

### 3.4 Ember Staff

> *Quiet. Warm. The kind of weapon you hold when you've made it
> through.*

| Property | Effect |
|---|---|
| Archetype resonance | `recovery` / `foundation` |
| Unlock | 6 recovery sessions in 4 weeks **without** a Quest gap exceeding 8 days |
| Effect | Recovery sessions count for +1 extra Ember stabilization tick; the staff's presence reduces decay by an additional 10% on rest days. |
| Visual evolution | The Ember at the staff's head brightens as Momentum tier rises and dims (softly) as it falls. Not a guilt-meter — a barometer. |

### 3.5 Weapon family → training pattern mapping

| Family | What it says about the player |
|---|---|
| Titan Hammer | "I press. I commit. Slow is fine." |
| Twin Ash Blades | "I keep moving. Bodyweight rhythms suit me." |
| Traveler's Spear | "I row, I walk, I read the room." |
| Ember Staff | "I rest with intent. I returned and kept the Vow." |

A player can swap weapons freely. The weapon they *wear most often*
becomes part of their identity.

### 3.6 Anti-patterns we reject

- "Legendary +37% damage sword" — banned. Damage is the player's,
  not the weapon's.
- Weapon tiers that gate progression (white/green/blue/purple).
  Banned. Weapon families have *one* identity; visual evolution
  reflects depth, not rarity.
- Random drops. Banned. Gear is earned by training pattern, not
  by luck.
- Crafting / refining / socketing. Banned in MVP and post-MVP
  alike. This is not a JRPG.

## 4. Armor — recovery & discipline identity

Armor expresses **how the player rests and returns**. Where
weapons are about attack, armor is about *durability of practice*.

### 4.1 Stonebound Plate

> *Heavy. Reliable. Worn by those who keep showing up.*

| Property | Effect |
|---|---|
| Theme | Consistency |
| Unlock | 4 consecutive weeks with at least 2 Quests per week (any archetype, any length) |
| Effect | Momentum decay grace extends from 2 → 3 days. The Ember holds longer between sessions. |
| Re-unlock after lapse | Resumes automatically when the consistency condition is met again — **no shame penalty for losing it.** |

Stonebound Plate is the "I am steady" armor. Its effect is
*forgiveness*, not raw strength.

### 4.2 Ashwalker Garb

> *Travel-worn. Made for the long return.*

| Property | Effect |
|---|---|
| Theme | Returning after a break |
| Unlock | Completing the first Quest after a ≥ 7-day gap (the "Long Return") |
| Effect | Adds +2 to the Return bonus (so +10 total instead of +8). The *first* week back also enables `gentleMode` on **every** Quest, not just the first. |
| Re-unlock | Re-earned every time a meaningful return is logged. |

This is, deliberately, the warmest piece of equipment in the game.
A player who falls off and comes back receives a *visible, named,
remembered* welcome — they earned a set of clothes for the walk
back. We want that to feel like a hug.

### 4.3 Emberweave

> *Light. Glowing. Won by those who guard the Ember.*

| Property | Effect |
|---|---|
| Theme | Disciplined exit / recovery practice |
| Unlock | 3 weeks of Quests in which the player honored "Disciplined Exit" at least 60% of the time, OR 4 recovery sessions in 4 weeks |
| Effect | Disciplined-exit bonus rises from +10% to +15% XP; recovery sessions stabilize the Ember slightly more. |
| Visual evolution | Threads of Ember grow into the cloth with continued discipline. |

### 4.4 Armor set summary

| Set | Reinforces | Anti-shame property |
|---|---|---|
| Stonebound Plate | Consistency | Auto-re-earned. Cannot be "lost." |
| Ashwalker Garb | Coming back after a break | Triggered *by* the gap, not despite it. |
| Emberweave | Disciplined exit & recovery | Earned by stopping well, not by going further. |

## 5. The hard "no stat soup" rule

For every piece of armor, ask:

1. What real-world behavior unlocks it?
2. What named in-game effect does it produce?
3. What is the *emotional sentence* it makes the player say
   when they earn it?

If any of those three answers is blank, the piece does not ship.

Generic stat boosters (defense, dodge, crit chance untethered to
behavior) are out. Set bonuses ("wear 2 pieces for +5% damage")
are out. Tier inflation (rare/epic/legendary armor) is out.

Every piece of gear is *one promise to the player*. Three pieces
is enough. We resist the urge to fill out a screen.

## 6. MVP recommendation

This is the entire equipment scope for MVP and for the first
post-MVP polish branch:

- **Equipment is cosmetic / identity-first.** The mechanical
  effects above are designed but **not required for MVP demo**.
- **Visual evolution is tied to exercise consistency**, not to
  inventory slots. There is no inventory screen in MVP.
- **No inventory stats UI.** Gear surfaces as silhouette + name on
  the home screen. A tap reveals the named effect and the
  behavior that earned it. That's it.
- **No swap menu in MVP.** Whatever the player has earned, they
  wear. (Multi-loadout switching is a post-MVP convenience.)

Concretely, the MVP demo ships with **zero equipment unlocks**.
The framing is there in lore; the unlock pipeline is not. This is
deliberate: equipment is a long-tail retention feature, and we do
not want to ship it shallow.

## 7. Sequencing

Equipment lands on this rough timeline (post-MVP):

1. **Tier 1 polish branch** — silhouette + name only, no
   mechanical effects. Earn-by-behavior pipeline exists for the
   first three pieces (Titan Hammer, Ashwalker Garb, Emberweave).
   This is enough to deliver the autobiographical promise.
2. **Tier 2 — mechanical effects** wired through
   `combatBalance.ts` and `momentumBalance.ts`. Behavior
   unchanged; numbers begin to nudge.
3. **Tier 3 — full family** (Twin Ash Blades, Traveler's Spear,
   Ember Staff, Stonebound Plate added). Visual evolution stages.
4. **Beyond** — only if dogfooding *proves* the system makes
   players feel seen. Otherwise we stop here.

## 8. What this is not

- Not a wardrobe. There is no "cosmetic shop."
- Not a tier list. No piece is "best in slot."
- Not a treadmill. No piece requires endless grinding to maintain.
- Not transactional. No piece is paywalled or premium-only.
- Not a flex. There is no leaderboard of who has what.

## 9. The promise the player feels

A player two months in should be able to glance at their character
and feel, without reading a single tooltip, that the screen *is
about them*. Their gear is not what they pulled from a chest. It
is what they did.

If a player ever says "I want to keep showing up so my character
stays looking like this" — the system has done its job. If they
ever say "I want to grind for that legendary chest" — it has
failed, and we cut the offending feature.
