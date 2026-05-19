# 012 — Battle UX & Feel

> *Workouts should feel mythic, not productive.*
> The Battle screen is where the game keeps every promise this
> design has made. If a player leaves the screen tense, the
> screen is wrong — no matter how clean the numbers.

---

## 1. The feel target

A player who has just finished a Battle should be able to say,
without prompting:

- *I feel grounded.*
- *I feel accomplished.*
- *I feel ready for the rest of my day.*
- *I feel invited back.*

They should never say:

- *I feel like I should be doing more.*
- *I feel addicted.*
- *I feel rushed.*
- *I feel guilty.*

This document is the design surface that controls those
sentences.

## 2. Pacing principles

Five principles. Every UX decision in §3-§10 is downstream of
these.

1. **The screen has time.** Battles are slow, not snappy. We do
   not optimize for "screens per minute."
2. **The screen breathes.** Every interaction has a pre-beat,
   the beat, and a post-beat. We never cut from action to
   action.
3. **Defaults read themselves.** A player who cannot read English
   today (tired, distracted, dim light) should still understand
   what to tap.
4. **Friction is intentional, not forgotten.** The few places we
   introduce friction (the "Return to Camp" exit) are *the
   features*, not the bugs.
5. **Anti-productivity-app energy.** No "streak fire" icons. No
   "you've completed X / Y." No "personal best!!!" with three
   exclamation marks. We trust the player to know.

## 3. Motion language

A small, **named** motion vocabulary, used consistently across
the app.

| Name | Curve | Duration | Where it appears |
|---|---|---|---|
| `breath-in` | ease-in-cubic | 220 ms | Reveals (HP bar appearing, Ember filling) |
| `breath-out` | ease-out-cubic | 320 ms | Settling (numbers landing, enemy thinning) |
| `strike` | spring (stiffness 320, damping 22) | 380 ms | Attack land; enemy flinch |
| `kindle` | ease-in-out-sine | 600 ms | Ember pulses, tier-up shimmer |
| `dispersal` | ease-out-quart | 1.2 s | Enemy defeat — slow and complete |
| `threshold` | spring (stiffness 180, damping 28) | 900 ms | Level-up, tier-up, region restoration |

Two rules about motion:

- **Nothing critical is faster than 220 ms.** A reveal under
  220 ms reads as a *flash*, and flashes feel like notifications.
- **Nothing dramatic is shorter than its meaning.** A Ward
  thinning takes 4-6 seconds because the moment is worth that.

## 4. Color philosophy

A small palette. Each color has a job; no color has two jobs.

| Color | Job | Where it appears |
|---|---|---|
| Ember (warm orange/gold) | Player presence, Momentum | Ember bar, attack flashes |
| Stone (warm grey) | The Hollow at rest | Background, idle UI |
| Ash (cool grey/blue) | Stillness, enemies | Enemy silhouettes, fog |
| Hearth (deep red-orange) | Critical moments (PR, tier-up) | Crit flash, threshold beat |
| Moss (muted green) | Recovery, mending | Recovery archetype, Camp |
| Tideline (muted teal) | Cardio, traversal | Trail Energy, world map |

What we **never** use:

- Bright saturated red as a "warning" color. Stillness is not
  alarming. Restraint is not alarming. There is no warning state.
- Pure white. The world is warm; pure white is sterile. Off-white
  with a hint of Ember.
- Neon / high-saturation accents. They scream. Mythic does not
  scream.

## 5. Audio philosophy

Default state: **silent**. The game does not assume the player
has headphones, is alone, or is at a gym they want to broadcast
from.

When audio is on (opt-in):

| Sound | Role | Constraints |
|---|---|---|
| Attack land | Confirms an action | A soft, low *thunk*. Not a hit. A *land*. |
| Enemy windup | Telegraphs rest end | A low, sustained tone. Slow rise. |
| Rest tick | Time passing | Only at 10s remaining and 0s. No constant ticking. |
| PR | Acknowledgment | A single warm bell. Once. No fanfare. |
| Tier-up | Threshold | A short, slow chord. Held for two seconds. |
| Ward fall | Region change | An ambient bell, far off. Echoes. |
| Quest complete | Return | A simple held breath of soft sustain. |

What we **never** ship:

- Voice lines. The game does not talk at the player.
- "Power-up" stingers. No "ding!" celebrations.
- Random crowd noise / hype tracks.

Background music exists for the Battle screen (post-MVP), but
it is **always under -18 LUFS** — present, never insistent.

## 6. Haptics philosophy

Haptics are off by default. When on:

| Event | Pattern |
|---|---|
| Attack land | Single short tap. Medium intensity. |
| Crit (PR) | Two soft taps. Slow. |
| Rest 10s remaining | One light tap. Once. |
| Rest end | One medium tap. |
| Tier-up | Three slow soft taps. |
| Ward fall | One long, soft sustained pulse. |

What we **never** do:

- Continuous rumble. The phone in the player's pocket is not a
  drum.
- Negative-coded haptics (sharp, fast). No "wrong!" feedback.
  There is nothing to be wrong about.

## 7. The Battle screen

The layout from `002-core-loop.md` §3 stands. This document
specifies the *feel* of each element.

### 7.1 Enemy silhouette

- **Always centered, always larger than the player UI.** The
  enemy is the focal point.
- **Idle motion**: a slow, ambient sway — `breath-in` /
  `breath-out` looped at 4-6 second cycle. The enemy is
  *present*, not lurking.
- **On hit**: `strike` — a quick flinch, then a return to idle.
  The flinch's amplitude is proportional to damage dealt,
  *bounded* — a crit doubles the flinch, a typical hit reads
  consistent.
- **HP bar position**: above the silhouette, not below. The eye
  finds it first. Color: Ash, with the remaining fill rendered as
  Ember-edged.
- **On defeat**: `dispersal`. The silhouette does not *fall*; it
  *thins*, from the edges in, over 1.2 seconds. The HP bar
  vanishes only after the dispersal completes.

### 7.2 The Attack button

- **Wide, low, thumb-friendly.** Sized for one-handed use,
  bottom 1/3 of screen.
- **Default copy**: simply *Attack*. No verbs that imply
  *destruction* ("Strike," "Hit," "Smash"). *Attack* is mythic-
  neutral.
- **Pressed state**: a brief `breath-in` glow before the strike
  resolves. The pressed state is the *commitment*, the resolve
  is the *consequence*.
- **Disabled state**: never red. A soft greyed-Ember. Disabled
  means "the set isn't ready to log," not "you did something
  wrong."

### 7.3 Rep / weight steppers

- **Steppers, not number-pad keyboards**, unless the player
  long-presses to enter exactly. Tap-heavy, type-light is from
  `005-mvp-implementation-plan.md` and we hold the line.
- **Pre-filled** with the last logged value for this exercise.
  *The right answer is almost always the value already there.*
- **No "+5"/"+10" shortcut clutter**. A single `−` and `+`, with
  long-press for a faster repeat.
- **Recent history strip** (post-MVP): a thin row of the last 3
  sets' values, tappable to autofill.

### 7.4 Damage numbers

Damage numbers are *narrative*, not analytical.

- **One number per attack**, floating up from the enemy's
  silhouette, drifting slightly to one side. `breath-out` curve.
- **Size scales with relative impact**, not raw value.
  - "Below trend": small numerals, regular color.
  - "On trend": standard numerals, Ember-warm.
  - "Above trend (crit/PR)": large numerals, Hearth color.
- **No total tally on screen.** The player doesn't see the
  Quest's cumulative damage during a Battle. The accounting
  happens at the end.
- **No `0` numbers**. If for some reason an attack rounds to
  zero damage, we render a quiet *hold* effect instead — the
  silhouette steadies briefly. Zero is never displayed as a
  number; that is an arithmetic statement that *the player did
  nothing*, and that is never the truth.

## 8. The Ember

The Ember is the most *seen* element of the game. It is the
player's avatar in everything that isn't a Battle.

### 8.1 Where it lives

- A horizontal bar on the home screen.
- A small ember-glyph in the corner of the Battle screen.
- A larger element on the reward screen.

### 8.2 How it behaves

- **Idle**: a slow ambient pulse, `kindle` motion, cycling 5-8 s.
  Brightness mapped to current Momentum tier.
- **On a logged set**: a brief brighten, fading back over 2 s.
- **On a Disciplined Exit / Quest complete**: a small `threshold`
  beat — *stability*, not celebration. The Ember steadies.
- **On a missed day**: nothing. The Ember dims very slightly the
  next time it is seen, on its own time. It does not flash, blink,
  or invite attention to the absence.
- **On a Comeback Quest**: a slow `kindle` to warm tier color
  before the Quest screen even opens. *The game noticed you
  came back.*

### 8.3 What the Ember is *not*

- Not a meter the player has to "fill" today.
- Not red when low. Ember at Rusted is a *dimmer* Ember, not a
  *warning* Ember.
- Not a thing that ever shows the underlying 0-100 number unless
  the player opts in to "show stats" in settings.

## 9. The Rest overlay

Rest is the **most important** UX surface in this document. A
rest period that feels good is what makes the game retain. A rest
period that feels productive is what makes the game lose.

### 9.1 Default layout

```
┌──────────────────────────────────────┐
│            ( Sluggard )              │
│         windup arc filling           │
│                                      │
│              0 : 58                  │
│         rest until next set          │
│                                      │
│                                      │
│   ▼  tip: "Breathe out longer        │
│         than you breathe in."        │
│                                      │
│    [   I'm ready   ]  (no penalty)   │
└──────────────────────────────────────┘
```

### 9.2 The countdown

- Large, slow numerals. The tens-of-seconds digit changes; the
  units digit ticks. Avoids the "every second is a slap"
  feeling of fast counters.
- **No emoji, no exclamation, no animation that intensifies as
  time runs down.** The rest doesn't *escalate*. It *passes*.
- **At 0**, the overlay does not vanish abruptly. It softens
  back to the Battle screen over a 320 ms `breath-out`.

### 9.3 The enemy windup arc

- A faint arc above the enemy, filling in Ash-color.
- When the arc completes, the silhouette plays a small `strike`
  *on itself* — the enemy's turn was simply *the passage of
  rest*. The player loses nothing.
- The arc is purely **narrative**. It does not threaten or
  represent damage to the player.

### 9.4 Tip rotation

A small library of tips rotates during rest. Tone and content
rules:

| Allowed | Forbidden |
|---|---|
| Breath cues ("Breathe out longer.") | Calorie / weight-loss tips |
| Form cues, gentle ("Soft knees on the next set.") | "You should be doing X" tips |
| World flavor ("The Long Heath is quieter today.") | Push notifications copy |
| Mythic vow lines (see §13) | Anything with an exclamation mark |
| Permissions ("It's okay to call this enough.") | "Just one more set!" |

A tip never repeats within a single Quest. A tip is never a
*nudge to do more*.

### 9.5 The "I'm ready" button

- Always present. No countdown gate.
- Tapping it does not earn anything. Does not lose anything.
- Copy reads "I'm ready," not "Skip rest." We are not skipping
  anything.

### 9.6 Background dismissal

A tap *outside* the overlay (on the visible Battle background)
**dismisses the overlay to the Battle screen** while the rest
continues counting in the background. This lets a player check
their HP, adjust the next set's reps, or just look at the screen
without exiting the rest. The overlay slides back in 5s before
rest ends to re-engage.

## 10. Quest completion cinematic

The exit beat. Longer than the entry beat (by rule from
`011-progression-and-rewards.md` §9).

### 10.1 Beats

1. **The last attack lands.** (`strike`)
2. **The enemy thins.** (`dispersal`, 1.2 s)
3. **The world quiets.** A 500 ms hold on a softened Battle
   screen. No UI. Just stillness.
4. **The world remembers.** A small region-map fragment slides
   in from the side, the un-hollowed patch updating. (`breath-in`)
5. **The verdict.** One sentence, centered, Ember-warm. Held for
   1.5 s.
6. **The XP tally.** Counts up over ~1.5 s. (`breath-out` per
   digit.)
7. **The Ember settles.** A final `threshold` beat — *stability*.
8. **The door home.** A single CTA: *Return to Camp*.

Total runtime: roughly **6-8 seconds** before the CTA is
tappable. We've extensively measured: longer than that, the
player feels held; shorter, the player feels processed.

### 10.2 Skip / fast-forward

There is no skip. There is no fast-forward. The Quest exit beat
is the slowest screen in the app on purpose.

A player who finds this annoying is telling us something true
about the rest of the day they are about to walk into. We hold
the beat anyway.

## 11. "You are tired" feedback — without shame

A player who reaches the **fatigue floor** (0.5x damage modifier)
within a Battle deserves to know — but not be lectured.

### 11.1 The visual

- The Ember on screen pulses *steadier*, not *dimmer*. The
  message is *the player is doing real work*, not *the player is
  failing*.
- The damage number on a floor-fatigue set renders in **Stone
  color** (instead of Ember). One small visual change. No banner.

### 11.2 The optional copy

A single short line *may* appear after a floor-fatigue set, no
more than once per Quest:

> *The Hollow has felt the work. The next set is not owed.*

That is the only line. It is **opt-out in settings** for players
who would rather just see the visual.

### 11.3 What we **never** do

- Pop a modal.
- Suggest the player "consider stopping."
- Flash a warning icon.
- Lower the volume of subsequent attacks.
- Withhold XP — XP is reduced by the formula, but the screen
  doesn't subtract anything visibly.

## 12. Recovery-day presentation

When the player opens a recovery-archetype-dominant Quest (or a
Camp), the Battle screen changes shape.

### 12.1 Layout differences

- The enemy silhouette is replaced by a **Hearth** — a soft,
  pulsing warm shape, smaller than an enemy, off-center.
- The "Attack" button copy becomes **Settle**.
- Damage numbers do not appear. In their place: a brief Ember
  brighten and a small `kindle` motion.
- The HP bar is replaced by an **Ember-stabilization arc**.
- Rest periods are shorter by default (30-45 s).

### 12.2 Verdict copy

A recovery Quest's reward screen reads:

> *The Hearth remembers you. The Vow keeps.*

— and the verdict is *Warmth Returned*.

### 12.3 Why this matters

Recovery is a **first-class session type**, not a "lite" mode.
The screen visibly *changes shape* so the player feels they are
playing the game, not playing a sub-game.

## 13. Mythic vow lines

A small inventory of one-liners that appear in tips, reward
screens, and quiet beats. These are the **canonical voice** of
the game. Any future copywriter should be able to add to this
list, and should reject any line they couldn't.

- *The Vow holds.*
- *The Hollow is listening.*
- *Rest is a move.*
- *You stopped at the right time.*
- *The Ember knows your hand.*
- *Stillness is patient. So are you.*
- *You came back.*
- *The room is warmer than it was.*
- *The world remembers the witness.*
- *The next set is not owed.*
- *The kettle whistled and you reached for it.*
- *Tomorrow is the next page.*

What this list **does not** contain:

- *You got this!*
- *Keep going!*
- *Don't stop now!*
- *You're crushing it!*
- *One more!*
- Anything ending in an exclamation mark.

## 14. Sample workout-to-battle timelines

Four worked examples. Each is a *minute-by-minute feel sketch*
of how the screen behaves during a real session.

### 14.1 A heavy session

Player: planning 4 working sets of bench press at moderate weight.
The Battle is *Sluggard, Lord of Couches* (calibrated to the plan).

| Time | Screen | Feel |
|---|---|---|
| 0:00 | Onboard → Battle screen. Reps prefilled at 5, weight prefilled at last session's working weight. | Settled in. No setup. |
| 0:10 | Player adjusts weight up 2.5kg via long-press +. | Quiet, single tap, no number-pad. |
| 0:18 | Tap *Attack*. `breath-in` glow, then `strike`. Damage number drifts up — Hearth color (it's a working-weight PR by 2.5 kg, so it's a crit). Soft bell. | Felt big. *I noticed*. |
| 0:20 | Rest overlay slides in. 2:00 timer. Enemy windup arc begins to fill. | Permission to wait. |
| 1:50 | Tap outside overlay to peek at HP. Sees enemy thinning. Slides back. | Optional curiosity, no friction. |
| 2:00 | Rest ends. `breath-out` back to Battle. Steppers prefilled with the same values. | No re-orientation needed. |
| ... | Repeat for sets 2-4. Set 3 hits fatigue floor (Stone-colored damage number). | *Honest fatigue, no shame.* |
| ~12:00 | Quest completion cinematic. Verdict: *PR Logged*. | Sat down. |

### 14.2 A pressure session

Player: 6 sets of pushups, planning to *flow*. The Battle is *The
Hundred Hands*.

| Time | Screen | Feel |
|---|---|---|
| 0:00 | Reps prefilled at 15, weight invisible (bodyweight). | Low friction. |
| 0:05 | *Attack*. Damage number standard size, Ember color. | Got into rhythm. |
| 0:08 | Rest overlay: 60 s default. Faster pacing for pressure. | Honors the tempo. |
| 1:08 | Set 2. Damage slightly larger — pressure combo bonus reads visibly. | *The chain matters.* |
| ... | Sets 3-6 unfold quickly. Fatigue accumulates slowly (pressure cost is 0.6 per set). | A flow. |
| ~9:00 | Quest completion. Verdict: *Steady Vow* (it's a repeated template). | Light. Done. |

### 14.3 A recovery session

Player: a Camp. They tap *Camp tonight* from home.

| Time | Screen | Feel |
|---|---|---|
| 0:00 | Recovery-shaped Battle screen. The Hearth (not an enemy). *Settle* button. | This is a different room. |
| 0:08 | Tap *Settle*. Ember brightens softly. No damage number. | Held. |
| 0:35 | 30 s rest. A tip: *Rest is a move.* | The tip *is* the practice. |
| 1:05 | Settle again. The Ember stabilization arc fills. | Quiet progress. |
| ~3:00 | Quest completion cinematic. Verdict: *Warmth Returned*. | Sat down before sitting down. |

### 14.4 A comeback-after-2-weeks session

Player: hasn't trained in 14 days. Opens the app. Picks Push Day.

| Time | Screen | Feel |
|---|---|---|
| 0:00 | Home screen: the Ember pulses warm in `kindle` motion before the tap registers. A hand-written-looking line: *The Hollow listened. Welcome back.* | *Seen.* |
| 0:02 | Quest screen. The 3 exercises are pre-listed; warmup-set hint is gentler than usual (gentleMode is on). | No re-onboarding. |
| 0:10 | Battle 1. Reps prefilled to *80% of their last session's reps*, not 100%. (Comeback eases in.) | Permission to ramp. |
| ... | Damage numbers ride a bit warmer than usual: Comeback +20% XP modifier renders as warmer Ember color, not a "boost" badge. | *Quiet generosity.* |
| ~15:00 | Quest completion. Verdict: *Comeback Quest*. The reward screen runs **9 seconds** instead of the usual 6-8 — beat 4 (the world remembering) is held longer. A lore page is unlocked: *The Long Return*. | A homecoming. |

## 15. Anti-patterns banned on this surface

A summary list, easy to audit against:

- Streak counters of any kind on the Battle / Rest / Reward
  screens.
- Comparative copy ("better than yesterday").
- Time-pressure (countdown skip incentives).
- "Don't break the chain" framing.
- Pop-ups that block.
- Numerical health/calorie/heart-rate stats during a Battle.
- Social share buttons.
- App-store rating prompts.
- "Notifications enabled?" prompts on the reward screen.
- The word "fail," anywhere.
- The exclamation mark, almost anywhere.

## 16. The screen as a covenant

The Battle UX is the covenant the game keeps with the player.
Every other system can be patched. This surface, once it ships
wrong, is hard to walk back — the body remembers a bad rest
timer.

We will hold this document tightly. Changes here require a
designer, a writer, and a player who has been using the app for
≥ 4 weeks to all sign off. We can be wrong about a balance
constant. We cannot be wrong about how the rest screen feels.
