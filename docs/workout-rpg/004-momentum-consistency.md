# 004 — Momentum & Consistency

> Momentum is the **primary retention mechanic**. It replaces the
> streak. It is designed so that a person with ADHD or a busy month
> can fall off for a week, return, and not feel like they have to
> start over. This document specifies the math, the tiers, and the
> emotional contract.

---

## 1. What Momentum is (and isn't)

Momentum is a single floating-point value in `[0, 100]` representing
the player's training rhythm.

It is **not**:

- A consecutive-day streak.
- A weekly target.
- A leaderboard rank.
- Something that can hit zero on its own.

It **is**:

- A rolling reflection of "have you moved recently?"
- A 7-day-weighted signal — weekly rhythm matters more than daily.
- Slow to climb, slow to fall.
- *Floored at 5*: the world remembers you. Momentum never reads "0".

## 2. Sources of Momentum gain

| Event | Δ Momentum |
|---|---|
| Complete a full Quest | +6 |
| Complete a partial Quest (≥ 3 working sets) | +3 |
| Complete a recovery / camp session | +3 |
| First Quest after ≥ 3 days absence ("Return") | +8 (one-time per gap) |
| "Disciplined Exit" (stopped at planned volume) | +1 bonus |
| Variety (3+ distinct exercises in a Quest) | +1 bonus |

**Gain is capped at +10 per calendar day.** No farming.

A "Return" bonus is intentionally large: the most fragile moment in
any habit is the one after a gap. The game cheers louder for the
return than for the streak.

## 3. Decay

Decay is **slow, predictable, and never punishes a single missed
day**.

```
For each calendar day with no logged movement:
  if daysSinceLastSession <= 2: decay = 0
  else: decay = 0.5 * (daysSinceLastSession - 2)
  // i.e. day 3 = -0.5, day 5 = -1.5, day 7 = -2.5, day 14 = -6
```

Worked examples (starting at Momentum 50):

| Gap | Decay total | Resulting Momentum |
|---|---|---|
| 1 day | 0 | 50 |
| 2 days | 0 | 50 |
| 3 days | 0.5 | 49.5 |
| 7 days | 0 + 0 + 0.5 + 1 + 1.5 + 2 + 2.5 = **7.5** | 42.5 |
| 14 days | ~28 | 22 |
| 30 days | floored at 5 | 5 |

Decay is **computed lazily** (on next app open) — there's no
background job and no notification fired.

## 4. Tiers

| Tier | Momentum range | Vibe |
|---|---|---|
| **Rusted** | [0, 20) | The Ember is dim. The world is quiet. |
| **Steady** | [20, 40) | The Ember glows. Stillness is patient. |
| **Driven** | [40, 65) | The Ember crackles. The Hollow is listening. |
| **Relentless** | [65, 85) | The Ember roars. Regions begin to bloom. |
| **Ascendant** | [85, 100] | The Ember is a beacon. The world remembers. |

A new user starts at **Steady (25)** — not Rusted — so first-launch
copy feels welcoming, not corrective.

### 4.1 Per-tier benefits

| Tier | Combat (multiplier) | Visual | World effect |
|---|---|---|---|
| Rusted | 0.9x | Ember faint grey-orange | Map is muted; one fog patch lifts when Steady is reached |
| Steady | 1.0x | Warm ember | Default world tone |
| Driven | 1.1x | Crackling ember + sparks | First region begins to grow |
| Relentless | 1.2x | Pulsing ember + light rays | New ambient music layer in Quests |
| Ascendant | 1.25x | Sun-bright Ember + slow particles | Region map shows blooming flora; legendary enemy variants |

Bonuses **cap at +25%**. We deliberately under-power tier benefits to
avoid creating a "must maintain" trap.

### 4.2 Tier-up moment

When the player crosses a tier threshold:

- Quest reward screen plays a tier-up beat (one extra animation).
- Lore page unlocked.
- Optional opt-in: a single, warm push notification when offline.

Tier-down is silent. No notification, no banner. The Momentum bar
quietly shifts color when the player next opens the app.

## 5. Return bonus, in detail

The single most important mechanic in this document.

When a user opens the app after `>= 3 days` since their last logged
session, the first Quest they complete:

- Grants **+8 Momentum** (the Return bonus).
- Plays the **"Welcome back, Vow-Bearer"** intro card before Battle 1.
- Sets the next 24h to a `gentleMode` flag: junk-volume penalty
  disabled, fatigue floor raised to 0.6.

The Return bonus fires *once per gap*. A user who returns daily does
not stack it.

## 6. Recovery sessions

A **Camp** (recovery session) is a first-class action, not a
"skipped day."

- One-tap from home: "Camp tonight."
- Logs a minimal record (no exercises needed).
- Grants +3 Momentum.
- Lights a small visual in the world map (a campfire).
- Capped at 2 Camps in any 7-day window — we don't want this to
  become a bypass for actual training.

Camp is intended for: travel days, recovery walks, stretching,
"life happened." We trust the player to use it honestly.

## 7. The emotional contract

This is the text we should be able to put on a billboard:

> Momentum rests when you do. It returns when you do.
> Missing a day is not a failure. Coming back is the win.

Every notification, every banner, every empty state must be
auditable against that paragraph.

## 8. What the user sees

- A horizontal **Ember bar** on the home screen, colored by tier.
- Below it, one sentence: *"Steady. The Ember glows."*
- No number unless the user opts in to "show stats" (under settings).

We deliberately hide the raw 0-100 number to discourage min-maxing.
Players who want it can find it; they don't have to look at it.

## 9. Edge cases

| Case | Behavior |
|---|---|
| User logs a Quest at 11:55pm and another at 12:05am | Two separate days, both count, total daily-cap applies to each day. |
| User changes timezone | Calendar days follow device locale; no manual adjustment. |
| User edits a past Quest | Momentum recomputed lazily on next open. |
| User has been gone 60 days | Floor of 5 holds. Return bonus fires once. Welcome copy is extra warm. |
| User does 3 Quests in one day | +6 +3 +3 capped to +10; junk-volume penalties apply within each Quest. |

## 10. Implementation hooks

- **Single function**: `recomputeMomentum(playerId, asOf)` is the
  source of truth. Called on app open, after every Quest complete,
  and after manual edits. Idempotent.
- **Persisted state**:
  - `player_momentum.value` (number)
  - `player_momentum.last_session_at` (timestamp)
  - `player_momentum.last_return_bonus_at` (timestamp)
  - `player_momentum.gentle_mode_until` (timestamp, nullable)
- **Never computed from scratch beyond a 90-day window** — older
  sessions are summarized into a starting Momentum. Keeps the
  computation fast offline-first.
