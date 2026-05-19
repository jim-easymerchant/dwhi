# 010 — Enemy Design Bible

> *Stillness is not a villain. It is what is left when nothing
> moves.*
> Every enemy in *The Hollow* is a fragment of Stillness given
> shape — and every fragment has a name, a silhouette, and a
> reason to be remembered.

---

## 1. What Stillness is

Stillness is the antagonist of the game, but not in the way most
games have antagonists. It is not malicious. It is not plotting.
It is **what happens when motion stops** — the slow accretion of
nothing-in-particular into something that has weight.

Three things about Stillness, in order:

1. **It is not the player.** Stillness is *outside*. It moves in
   when the player does not. The player is never fighting
   themselves; they are pushing back a thing that grew while they
   were away.
2. **It is not personified.** Stillness does not speak. It does
   not appear as a single figure. It is the *medium* through
   which the lesser fragments — the enemies — take shape.
3. **It is patient, not cruel.** Stillness has no campaign. It
   does not chase. It does not punish. It simply settles. The
   moment the player moves again, it begins to recede.

This framing matters because it lets every enemy mean something
without making the player the problem. The player is never
"fighting their depression." The player is *making the world
warm again*, and the things between them and warmth are
recognizable, but never accusatory.

## 2. Enemy philosophy

Six commitments. Each is non-negotiable.

1. **Mythic before clinical.** An enemy named *The Pale Hours*
   does the work that *Doomscrolling Demon* never could. The
   player should feel a chord struck, not a label applied.
2. **Recognizable but oblique.** A player going through a hard
   season should *feel seen* without ever being addressed. The
   enemies are mirrors held at an angle.
3. **Beautiful enough to mourn.** Every enemy has a moment of
   melancholy in its silhouette. We are not slaying monsters; we
   are dispersing fog.
4. **Defeat is dispersal, not death.** Enemies do not "die." They
   *thin*, *settle*, *let go*, *return to the ground*. The
   reward screen never reads "killed."
5. **No "you" framing in flavor text.** Enemy descriptions never
   say "your anxiety," "your inertia," "you when you...". Always
   third-person, mythic distance: "It gathers in rooms left
   undusted," not "It is your overwhelm."
6. **No diagnostic vocabulary.** No "depression," "anxiety,"
   "ADHD," "burnout," "trauma" appears anywhere in enemy
   text — in the game or the docs that ship near the game. We
   know these are present in the design's *intent*; the player
   does not need to read them on a card.

## 3. Emotional symbolism, decoded

This table is internal — for designers, writers, illustrators.
**It does not appear in-game.** It is the key the team holds; the
player reads only the right-hand column, and obliquely.

| Symbolic root (internal) | Enemy expression (player-facing) |
|---|---|
| Inertia | A weighty, slow-moving shape that sits where the player last stopped |
| Overwhelm | A many-edged thing that fragments attention with simultaneous gestures |
| Doomscrolling | A flicker that pulls the eye downward; never quite resolves |
| Self-abandonment | A figure that mirrors the player's silhouette but turned away |
| Perfection paralysis | A pristine, unmoving statue that refuses to chip until *enough* is enough |
| Exhaustion | A figure made of long shadows; gives off cold, asks for nothing |
| Fragmentation | A shape that scatters and re-forms in a different position each turn |
| Emotional numbness | A grey, smooth thing without edges to grip |
| Shame spirals | A spiral that closes in on itself; the more the player flinches, the tighter it draws |
| Isolation | A ring of empty chairs; the enemy is the absence in the middle |

If a writer is tempted to be more literal than the right-hand
column allows, they have left this document's tone band.

## 4. Enemy categories

Three structural categories. They are about *combat behavior*,
not about symbolism. (Symbolism varies within each category.)

### 4.1 Lesser Fragments

The bread and butter of any Quest. Single-Battle enemies.

- HP in the same ballpark as MVP Sluggard (calibrated to the
  player's Quest projection).
- One named gesture (a windup animation that telegraphs its
  "turn" during rest).
- One archetype affinity bias (soft — see §6).
- A short flavor line on the reward screen. Two sentences max.

### 4.2 Hollows

Multi-Battle encounters that span an entire Quest. A Hollow does
not present as a single enemy; it presents as a *region's mood*
that resolves at the end of the Quest with a small narrative
beat.

- Functionally: the Quest itself is the encounter.
- The Hollow has no HP bar. It has a *clarity meter* that fills
  as Battles within the Quest resolve.
- The Hollow is what regional flavor uses to give a Quest a
  *day's identity*. ("Today, the Long Heath was uneasy.")

Hollows are post-MVP. They are documented here so the data model
in `006-monorepo-integration-plan.md` has language for them when
the time comes.

### 4.3 Wards

Boss-tier presences. Named, hand-authored, region-resident, slow
to appear. A Ward is not encountered every Quest; a Ward appears
when a region has been engaged enough that its central knot is
ready to loosen.

- HP scaled across multiple Quests (a Ward is a *campaign arc*,
  not a session).
- A Ward's defeat is a region-defining narrative moment, a major
  visual change to the world map, a lore page, an armor
  visual-evolution stage — but **no power-spike loot**.
- One Ward per region. There are 5-7 in the planned long-form
  game; **zero in MVP**.

Wards are the *only* enemies that may have personhood in their
flavor text. Even then, they are *titles*, not characters.

## 5. Faction structure

There are no factions in the political sense. Stillness does not
recruit; it accumulates. But for the writer's room and the
illustrator, we group fragments into four **moods**:

| Mood | Vibe | Where they're most common |
|---|---|---|
| **The Drift** | Soft, formless, slow | Settlements, hearths, beds left unmade |
| **The Hush** | Quiet, watchful, attentive | Wildlands, treelines, long roads at dusk |
| **The Glare** | Bright but cold, fragmented | Trade roads, marketplaces, screens |
| **The Stone** | Heavy, set, unwilling to chip | Mountains, ruins, monuments |

A mood is **aesthetic guidance**, not a combat tag. Writers and
artists work from the mood; designers work from the archetype
affinity.

## 6. Archetype affinity

Lesser Fragments and Wards may carry soft affinities — they bend
slightly toward or against the six exercise archetypes (see
`007-exercise-archetypes.md`).

The affinity model is **whispered**, not announced:

- *Vulnerable to* an archetype: that archetype's working sets
  deal +10% damage against this enemy.
- *Resistant to* an archetype: -10% damage.
- Most enemies have **at most one** vulnerability and **zero or
  one** resistance.
- The MVP enemy (Sluggard) has no affinities. Affinity arrives
  in the first post-MVP enemy pass.

The UI surfaces affinity through *texture*, not text: the
silhouette flinches more visibly on a strong hit; ember-flickers
respond more on a weak one. A player who pays attention learns to
read it. A player who doesn't loses nothing — the differences are
within ±10%, comfortably inside what variety bonuses already cover.

## 7. Escalation philosophy

Enemies do not scale to "always defeat the player." They scale to
**always be roughly the right size for the planned Quest**. From
`003-combat-mechanics.md`:

```
enemy.hp = 1.15 * expectedQuestDamage(player, questTemplate)
```

This is the spine. Three rules elaborate it:

1. **Enemy HP is calibrated to the *plan*, not the *day*.** If a
   player has a bad day and stops short, the enemy thins to the
   plan and the *unspent* damage is logged as a narrative remnant,
   not as a punishment.
2. **Enemy HP is never inflated for "challenge."** We do not
   tune fights to be "hard" — we tune them so a sensible session
   *fells the enemy near the planned final set*. The drama is
   timing, not difficulty.
3. **No enemy scales with the player's level.** A first-month
   Sluggard and a sixth-month Sluggard are the same Sluggard.
   The player has grown; the enemy hasn't. That feels right.

## 8. Boss (Ward) philosophy

Wards exist to give regions *closure*. They are not a difficulty
spike; they are a *seasonal moment*.

Rules a Ward must satisfy:

- **Earned, not gated.** A Ward becomes available when its
  region has been engaged enough — through Quests, traversal,
  recovery, and return — that it is ready to loosen. There is no
  "kill 100 monsters to unlock the boss."
- **Resolved in a single session if possible.** Multi-session
  Wards are an exception, only used when the *narrative* warrants
  it. We do not chase raid-tier engagement.
- **Defeat changes the world, not the stats.** A Ward fall
  un-hollows a region, plays a music change, and unlocks lore.
  It grants **no power increase**.
- **Cannot be replayed for grinding.** Once felled, a Ward is
  felled. A "remembered" Ward Quest is available as a memorial
  visit; it grants lore re-reads, not rewards.

The narrative beat at a Ward's fall is **never triumphalist**.
The Ward thins. The region exhales. A bell sounds, far off. The
player sits with the moment. There is no fireworks screen.

## 9. Named enemy examples

Each entry lists: *Mood*, *Internal symbolic root*, *Combat
silhouette*, *Affinity (post-MVP)*, *Reward-screen line*.

### Sluggard, Lord of Couches (MVP)

- *Mood:* The Drift.
- *Root:* Inertia.
- *Silhouette:* A slumped, robed shape that takes the form of
  whatever the player last sat in. Its windup is a long sigh.
- *Affinity:* none (MVP; first post-MVP pass adds
  vulnerable-to-`pressure`).
- *Reward-screen line:* *Sluggard thinned. The room felt
  taller.*

### The Pale Hours

- *Mood:* The Glare.
- *Root:* Doomscrolling.
- *Silhouette:* A tall figure of fluttering pages, none of which
  finish. Its windup is a slow flicker that pulls the eye down.
- *Affinity:* vulnerable to `control`; resistant to `pressure`
  (a long flurry of strikes makes it stronger, not weaker —
  reading the room beats running at it).
- *Reward-screen line:* *The pages stilled. The light in the
  room thinned to evening.*

### Old Mire

- *Mood:* The Drift.
- *Root:* Self-abandonment.
- *Silhouette:* A figure that wears the player's outline but
  faces away. Its windup is a slow shrug.
- *Affinity:* vulnerable to `foundation`.
- *Reward-screen line:* *Old Mire turned its head. The room
  remembered the player was in it.*

### The Brittle Crown

- *Mood:* The Stone.
- *Root:* Perfection paralysis.
- *Silhouette:* A pristine, unmoving statue that refuses to
  chip. Its windup is the air around it growing very still.
- *Affinity:* vulnerable to `recovery`; resistant to `heavy` (a
  big swing reinforces the lacquer; a quiet, unhurried gesture
  cracks it).
- *Reward-screen line:* *The Crown cracked, just enough. Air
  moved into the cracks.*

### The Long Smoke

- *Mood:* The Hush.
- *Root:* Exhaustion.
- *Silhouette:* A tall, thin figure of grey wood-smoke. Its
  windup is the cold of it briefly reaching the player.
- *Affinity:* vulnerable to `endurance`.
- *Reward-screen line:* *The smoke thinned. The room was warmer
  for a while.*

### The Hundred Hands

- *Mood:* The Glare.
- *Root:* Overwhelm.
- *Silhouette:* A many-armed shape, each arm doing a different
  small gesture, none finished. Its windup is the gestures
  multiplying.
- *Affinity:* vulnerable to `foundation`; resistant to
  `pressure`.
- *Reward-screen line:* *The hands lowered, one by one. The
  table was clearer than it had been.*

### The Splintering

- *Mood:* The Glare.
- *Root:* Fragmentation.
- *Silhouette:* A shape that scatters into glittering pieces and
  re-forms on the opposite side of the room each turn. Its
  windup is the scatter.
- *Affinity:* vulnerable to `control`.
- *Reward-screen line:* *The pieces settled into one piece. The
  light was less sharp.*

### The Grey Vow

- *Mood:* The Drift.
- *Root:* Emotional numbness.
- *Silhouette:* A perfectly smooth, edgeless figure. Light slides
  off it. Its windup is a non-event.
- *Affinity:* vulnerable to `recovery`; resistant to all damage
  in the first turn (it does not register the first hit; the
  player has to *be there* for a second one).
- *Reward-screen line:* *The Grey Vow remembered colour. The
  room was less far away.*

### The Inward Ring

- *Mood:* The Hush.
- *Root:* Shame spirals.
- *Silhouette:* A ring closing slowly on itself. Its windup is
  the ring tightening.
- *Affinity:* vulnerable to `foundation` and `recovery` equally;
  resistant to repeated identical attacks (mirrors the spiral).
- *Reward-screen line:* *The ring opened. The space inside it
  was livable again.*

### The Empty Hearth

- *Mood:* The Drift.
- *Root:* Isolation.
- *Silhouette:* A circle of unoccupied chairs around a cold
  fireplace. The "enemy" is the absence at the center.
- *Affinity:* vulnerable to `recovery`; takes additional damage
  from any Quest that follows a logged cardio session within
  24 hours (because the player came in from outside).
- *Reward-screen line:* *A coal caught. The room had a glow
  again.*

## 10. Regional enemy variants

Each region (see `009-cardio-world-systems.md` §4) carries its
own subset of moods. This is loose guidance, not a strict
constraint.

| Region type | Common moods | Example region-resident fragments |
|---|---|---|
| Settlements | Drift, Hush | Sluggard variants, Empty Hearth, Old Mire |
| Mountains | Stone, Hush | The Brittle Crown, The Long Smoke |
| Wildlands | Hush, Drift | The Long Smoke, The Inward Ring |
| Trade roads | Glare, Drift | The Pale Hours, The Hundred Hands |
| Tidal ruins | Hush, Glare | The Splintering, The Grey Vow |

Wards are region-specific and named per region. The plan is one
Ward per region, named after the region itself — *The Ward of
Stonehearth*, *The Ward of the Iron Loop*, etc. Their flavor is
written when the region is.

## 11. What the player feels when an enemy is defeated

Not what we tell them. What we want them to *feel*.

| Enemy | Felt thing |
|---|---|
| Sluggard | The room is slightly taller. Air moves. |
| The Pale Hours | The light is warmer; the eye lifts. |
| Old Mire | A small turning-toward; remembered presence. |
| The Brittle Crown | Permission to be unfinished. |
| The Long Smoke | Warmth restored, not earned through force. |
| The Hundred Hands | Quiet. One thing at a time. |
| The Splintering | Held together; a piece of self pulled back. |
| The Grey Vow | A first colour after a long grey. |
| The Inward Ring | Room around the self. |
| The Empty Hearth | A coal catches; a chair fills. |

None of these are about the player conquering a part of
themselves. All of them are about the room being warmer when the
player leaves than when they came in.

## 12. What this is not

- **Not therapy.** We are not modeling cognitive distortions.
  We are writing a bestiary.
- **Not metaphors that demand decoding.** A player who never once
  reads the symbolism table should still feel that each enemy
  *means something*.
- **Not a moral system.** No enemy is "evil." Stillness is
  weather.
- **Not a power fantasy.** The player is not "stronger than
  Stillness." They are *warm enough* that it loosens.

## 13. The mythic vow this document holds

*The world is not the player. The player is the world's
witness.*
*The enemies are not the player. The enemies are what gathers
when no witness is present.*
*Defeating an enemy is not a victory. It is the return of a
witness to a place that was waiting.*

If a future writer can hold those three lines in their head as
they draft a new fragment, the bestiary will stay in tune.
