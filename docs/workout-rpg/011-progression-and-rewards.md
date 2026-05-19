# 011 — Progression & Reward Design

> *The reward loop should send the player home, not keep them at
> the table.*
> Everything in this document is shaped by one question: *does
> this reinforce the kind of progression a person can sustain for
> ten years, or only for ten weeks?*

---

## 1. XP philosophy

XP is the **summary signal** of effort. It is not the player's
identity (that's `008-equipment-philosophy.md`), it is not the
retention mechanic (that's `004-momentum-consistency.md`), and it
is not the world's progress (that's
`009-cardio-world-systems.md`). XP exists so the player can
*read* a session at a glance.

Three commitments:

1. **XP is bounded per session.** A Quest's XP ceiling is
   *generous but real*. Going past planned volume earns less per
   set, not more. Going past sane volume earns none.
2. **XP is honest.** Reps + weight + variety + discipline drive
   XP. No XP appears from menus, tutorials, returning daily,
   watching ads (we don't have ads), or filling out the profile.
3. **XP is not the prize.** XP unlocks lore and tier-up beats. It
   does not unlock stat boosts. Levels are *bookmarks*, not power
   ladders.

## 2. Quest XP formula (reference)

Restating from `003-combat-mechanics.md` for convenience — this
is the existing formula, not a change:

```
questXp =
  sum(set.damage * xpRate)
  * varietyBonus              // up to +25%
  * disciplinedExitBonus      // 1.1 if exited at planned volume
  - junkVolumePenalty         // kicks in above 12 sets
```

This document **expands** the bonus surface (see §6) and the
penalty floor (see §7) without changing the formula's shape.

## 3. Levels and cadence

### 3.1 Level structure

**Levels 1-50 are the named ladder.** Beyond level 50, the
display is *prestige*, not arithmetic — see §3.4.

Why 50 and not 100? A 100-level ladder reads as a *grind*. A
50-level ladder reads as a *journey*. Each level should feel like
a thing the player did, not a thing the algorithm gave them.

### 3.2 Pacing

For a player training 3 sessions/week at the modeled MVP
volumes:

| Span | Expected level |
|---|---|
| First week | 1 → 3 |
| First month | 3 → 8 |
| Three months | 8 → 18 |
| Six months | 18 → 28 |
| One year | 28 → 38 |
| Two years | 38 → 47 |
| Three years+ | 47 → 50 |

The curve is **front-loaded warm** (early levels arrive fast),
then settles into a *slow, dignified* pace. A six-month player
should still see new lore pages; a two-year player should still
have a few unrevealed.

This is *deliberately* slower than most fitness apps' "levels."
We want a player to be proud of level 30, not embarrassed by it.

### 3.3 The level-up moment

At each level-up:

- The Quest reward screen plays a one-beat *threshold* animation
  (a small turning of the world — see `012-battle-ux-and-feel.md`
  §10).
- **Exactly one** of the following unlocks (rotating through the
  list in a stable order; see §10):
  - A lore fragment (the most common — most levels grant a
    fragment).
  - A new exercise variant in the catalog (post-MVP).
  - A new visual stage on currently-worn equipment.
  - A new "tip" the rest timer rotates through.
  - A new region's edge fog clears slightly (post-MVP).
- No raw stat increase.
- No new "Quest type unlocked" (Quests are unlocked by *choice*,
  never gated by level).

### 3.4 Beyond level 50

Past level 50, the display reads *Steadfast 1, Steadfast 2, …*.
Each additional Steadfast level takes roughly as long as the
last two named levels combined — a deliberate decompression.

Steadfast levels do not unlock new mechanics. They unlock
*memorial* lore: extended writings about regions already
restored, retrospectives in the Vow-Bearer's voice, etc. The text
is **always set in the past tense**, reinforcing that the player
has crossed the threshold from *building* to *tending*.

There is **no level cap**. A player who plays for ten years can
keep adding Steadfast levels. The cadence simply keeps slowing.
This is intentional: an explicit cap reads as "the game is over."
There is no over.

## 4. What scales — and what *never* scales

The hard list. Future features that try to scale anything in the
right-hand column go back to design.

| Scales with level / consistency | Never scales |
|---|---|
| Number of unlocked lore fragments | Damage multiplier from level alone |
| Visual evolution of equipment | "Strength" / "stamina" / "dex" stats |
| Number of known enemies (lore-wise) | Crit chance from level |
| Quest templates unlocked (post-MVP, by *region*, not by level) | XP-per-set multiplier from level |
| World-map regions opened (by traversal) | Maximum daily Momentum gain |
| Rest-timer flavor lines | Anything that compounds infinitely |

A level 50 player and a level 5 player who do the same Quest with
the same effort produce the same damage on screen and feel the
same impact land. The level 50 player has more *context* around
that hit; they don't have a more *powerful* hit. This is
embodied progression. We do not break it for the dopamine.

## 5. Session-end reward psychology

The reward screen is a **transition**, not a stage. Its job is
to send the player into the rest of their day, not to keep them
in a menu.

### 5.1 Pacing rules

- **Maximum dwell time: 8 seconds before the dismissal CTA is
  fully tappable.** We add no "skip" button because the screen
  itself is brief.
- **Numbers count up, but they do not chase.** The XP tally
  finishes in ~1.5s. No "watch for 4s to see your bonus."
- **One verdict. One sentence.** Not a checklist of seven
  earned things. The reward screen says one true thing.

### 5.2 Verdicts (expanded)

The MVP defined four. We add three more, in the same voice.

| Verdict | Trigger |
|---|---|
| **Disciplined Exit** | Stopped within ±10% of planned volume |
| **Held the Line** | Partial Quest; ≥ 3 working sets |
| **PR Logged** | New personal best on any working set |
| **Steady Vow** | Repeat of a recent Quest template |
| **First of the Week** | First strength Quest in a calendar week (see §6) |
| **Comeback Quest** | First Quest after ≥ 7 days absence |
| **Warmth Returned** | A Camp or Long Road session that protects the Ember |

Verdicts do not stack. The most *narratively right* one shows.
Priority order: **Comeback** > **PR** > **First of the Week** >
**Disciplined Exit** > **Held the Line** > **Steady Vow** >
**Warmth Returned**.

### 5.3 What the screen does *not* do

- No "share to social."
- No "rate this app."
- No "next workout in 23h 59m 12s."
- No "you've trained X days in a row!" counter.
- No comparative chart against last week.

A player who *wants* to see history can find it in the journal
(post-MVP). The reward screen is one breath of acknowledgment,
then a door home.

## 6. Returning, weekly rhythm, and recovery bonuses

The single largest expansion this document makes is to formalize
the bonus structure around the kinds of training a body actually
benefits from.

### 6.1 First-session-of-the-week bonus

- **+10% XP** on the first strength Quest of the calendar week.
- **+1 Momentum** (above the usual gain).
- Verdict: *First of the Week*.

This nudges weekly *spread*, not daily compliance. A player who
trains Mon/Wed/Fri gets this once. A player who trains
Mon/Tue/Wed/Thu/Fri/Sat/Sun also gets it once. **The bonus
honors the rhythm; it never demands more than one good session.**

### 6.2 Recovery-week bonus

When a player's last 7 days contain at least one explicit
recovery session (Camp, or any `recovery`-archetype-dominant
Quest, or a logged mobility / yoga session):

- The next strength Quest has its **fatigue floor raised to 0.6**
  (a hair more forgiving than the standard 0.5).
- +1 Momentum on completion.
- Verdict eligible: *Warmth Returned* on the recovery session
  itself.

This is a small mechanical thumb-on-the-scale that says *the
game saw you rest*. Most players won't notice the floor change;
they will notice that the next workout feels good.

### 6.3 Comeback bonus

Already defined in `004-momentum-consistency.md`. We restate it
here so progression-side bonuses are in one place:

- After ≥ 3 days absence: +8 Momentum (Return bonus), gentleMode
  for 24h.
- After ≥ 7 days absence: above, **plus** +20% XP on the first
  Quest back, verdict *Comeback Quest*. Ashwalker Garb unlock
  pipeline triggered (see `008-equipment-philosophy.md`).
- After ≥ 28 days absence: above, plus a hand-written intro card
  (the Vow-Bearer's perspective, warm, never apologetic *for* the
  player). The lore log gains a single entry: *The Long Return*.

These are **cumulative thresholds**, not exclusive. A 30-day
return gets all three.

### 6.4 The "good stopping point" reinforcement

A `Disciplined Exit` already exists. We add three subtle
reinforcements without making them into a system the player has
to game:

1. **The Quest screen shows a soft "you have hit your planned
   volume" pulse** when planned sets are complete. No timer. No
   guilt-trip. Just the Ember briefly stabilizing.
2. **A "Wrap it up" button appears alongside "Next Battle"** when
   planned volume is met. Same prominence; not larger.
3. **The Quest reward screen for a Disciplined Exit closes with
   one line the player will see often:** *"You stopped at the
   right time. The Hollow is grateful."*

We never *prevent* the player from continuing. The system
*invites* the stop; it does not *enforce* it.

## 7. Soft caps, diminishing returns, and anti-exploit

Expanding on `003-combat-mechanics.md`'s anti-grind floor.

### 7.1 Soft cap on Quest XP

- Up to **planned volume** (typically 9-12 working sets): full
  XP rate.
- From **planned + 1** to **planned + 30%**: XP rate falls
  linearly to 0.5x.
- Beyond **planned + 30%**: XP rate is 0, *not* negative. We do
  not punish — we *stop rewarding*. A player who wants to keep
  lifting can; the game just no longer applauds.

### 7.2 Daily XP cap

- 1.5× a typical day's expected XP is the daily cap.
- Above the cap: the reward screen still shows a *verdict* but
  shows `XP: —` instead of a number. The player did the work;
  the game does not pretend the meter is still climbing.
- Daily cap exists **per modality**: a strength cap, a cardio
  cap, a recovery cap — so a player can do an honest mixed day
  without running into the strength cap from the morning.

### 7.3 Weekly XP soft cap

- A *soft* cap at 7× a typical day.
- Above it, XP halves; no shame language. Equivalent of "the
  story has its rest beats."

### 7.4 Junk volume penalty

Already in the formula: `-5 XP per set above 12 in a single
Quest`. We document the *intent* here for clarity: this is a
penalty applied **only when planned volume is already exceeded**.
A Quest planned for 14 sets does not get penalized at set 13.
The penalty is for **junk** volume, not for *high* volume.

### 7.5 What the player sees when caps engage

- A faint Ember stabilization (the bar visually settles instead
  of pulsing).
- One line in the reward screen: *"The Ember has settled. Tomorrow
  is the next page."*
- No red text. No exclamation marks. No "limit reached" framing.

## 8. The relationship between Momentum and progression

Momentum and XP/level are **parallel rails**, not the same rail.

| Axis | Reflects | Decays? | Caps? |
|---|---|---|---|
| XP / level | *What the player has done* | No | Soft (Steadfast slowdown) |
| Momentum | *Where the player is in their rhythm* | Slowly, gracefully | Floored at 5, capped at 100 |
| Trail Energy | *Banked intent for traversal* | No | Capped at 100 |

Momentum is the **mood** of the journey. XP is the **road
behind**. Trail Energy is the **road ahead**. None of them are
the player; all of them are *about* the player.

A player whose Momentum is Rusted but whose level is high reads
as "a respected Vow-Bearer between seasons." A player whose
Momentum is Relentless but whose level is low reads as "newly
sworn, walking hot." Both are real, both are valid, and the game
never makes one feel like a failure version of the other.

## 9. Quest completion psychology

Three rules we are willing to defend in code review.

1. **The exit beat must be longer than the entry beat.** The
   moment of closing a Quest should feel like sitting down — not
   like a level loading. We invest more frames in *leaving* than
   in *starting*.
2. **The next Quest is not on the reward screen.** The reward
   screen ends in *Return to Camp*, not *Next Quest*. We
   deliberately ask the player to leave the loop and re-enter
   through the home screen if they want more. The friction is the
   feature.
3. **The reward screen never previews tomorrow.** No "Quest
   suggested for tomorrow." No "you're 1 session from the next
   tier." Tomorrow takes care of itself.

## 10. Lore fragment structure

Lore is the **primary reward** of progression. We are deliberate
about it.

### 10.1 Cadence

| Source | Cadence |
|---|---|
| Level-up | Most levels. ~70% of named levels grant a fragment. |
| Tier-up | Each crossing of a Momentum tier grants a fragment. |
| Region restoration | Each region fully un-hollowed grants a fragment. |
| Ward defeat | A long fragment (a "page" rather than a "verse"). |
| Comeback ≥ 28 days | One memorial fragment (*The Long Return*). |
| Equipment visual evolution | A short fragment when a stage is reached. |

A typical fragment is **3-7 short lines**. A "page" is **3-6
fragments collected as a chapter**. There is no novel. The
writing is sparse on purpose.

### 10.2 Voice

- Past tense, mostly.
- Third-person mostly; occasional first-person from the
  Vow-Bearer's notes.
- No moralizing. No "remember to..." No "always..."
- A line should be able to live on a postcard.

Example fragment (illustrative — not canon yet):

> *On the third evening, the Long Smoke thinned without me
> swinging. I sat. The kettle whistled a long time before I
> reached for it. There was no hurry left in the room.*
> — page from the Vow-Bearer's notebook

### 10.3 Where lore lives

- A **journal** screen (post-MVP) lists all collected
  fragments, grouped by chapter.
- A **lore peek** appears on the reward screen when a fragment
  is granted — one short line, tappable for the full fragment.
- Lore is **never lost**. Fragments are read-only; collecting one
  is permanent.

## 11. Emotional pacing of progression

The shape of the year the system is aiming for:

- **First week**: warm, attentive, surprising. Multiple
  level-ups. Multiple fragments. Several "First of the Week"
  beats. The game leans in.
- **First month**: settling into rhythm. Fewer level-ups per
  Quest. The Ember stabilizes around a familiar tier. Lore
  fragments arrive often enough to feel earned, not often enough
  to feel inflationary.
- **Third month**: the first armor identity locks in.
  Equipment-evolution beats start carrying narrative weight.
  Region restoration becomes visible in a *paragraph*, not a
  pixel.
- **Sixth month**: the first Ward should be felled around now.
  The world map looks different. Lore "pages" begin to assemble.
- **First year**: roughly half the regions restored. A small
  collection of Steadfast levels (or close to it). The journal
  begins to read like a book the player wrote.
- **Beyond**: the *tending* phase. Slower. Quieter. New
  fragments still arrive — they just no longer arrive every
  Quest. The world remembers the player; the player remembers the
  world.

## 12. Anti-exploit summary

A short, sharp list. Every reward described in this document was
designed against this list.

- **No "log a 1-rep set 30 times" exploit.** Sets below a
  reasonable minimum threshold (e.g., < 3 reps on bodyweight, < 1
  rep on weighted) score 0.
- **No "fake recovery" exploit.** Recovery sessions need a
  duration entry; sub-3-minute entries do not count toward the
  recovery-week bonus.
- **No "wait for the Comeback bonus" loop.** Comeback bonuses
  scale *upward* with gap length only across the three
  thresholds. There is no incentive to stretch a gap to chase a
  bigger bonus. (We tested: the Momentum decay between days 7 and
  28 outweighs the bonus difference. The math is on the side of
  showing up.)
- **No "alt account farming."** Local-first means there is one
  account, one device-roots. Post-MVP sync uses per-household
  rules, not per-account.
- **No "schedule farming."** The game does not have a calendar.
  There is no schedule to comply with. There is no calendar to
  game.

## 13. The reward loop the docs promise

The end-of-session feeling the system aims for, in one paragraph,
which we will quote back to ourselves any time a future change is
proposed:

> *The player closes the app feeling like they did the thing
> they set out to do. The room is slightly warmer. The Ember is
> steady. There is a small new sentence in the world. They are
> not thinking about tomorrow's session; tomorrow will arrive.
> They are not thinking about XP per minute; that conversation
> is for a different kind of game. They are thinking about the
> rest of their day, and they are looking forward to it, and
> when they next open the app, the room they left will be the
> room they return to.*

If a feature does not point at that paragraph, it does not ship.
