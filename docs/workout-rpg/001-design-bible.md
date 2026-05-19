# 001 — Design Bible

> **Working title:** *Momentum* (placeholder — see "Naming" below).
> A tactical RPG where workouts are the input mechanic and the player
> is restoring a ruined world by showing up.

---

## 1. One-line pitch

A low-friction, ADHD-friendly **workout RPG** where every set is a
turn in tactical combat, every rest is the enemy's swing, and every
return — not every perfect day — pushes the world a little further
back from the dark.

## 2. Audience

- People with ADHD or executive-function friction around fitness.
- People burned out by streak-shame fitness apps (Strava, Duolingo
  for fitness, etc.).
- Returning lifters who feel guilty about gaps.
- Players who like tactical/turn-based RPGs more than dashboards.
- Light gym-goers and home-bodyweight folks (both must work).

## 3. Tone

**Hopeful struggle, not toxic grindset.**

- The world is *recovering*, not perfect. So is the player.
- Combat is dramatic, but UI text is warm.
- Never moralize about effort. Never use the word "lazy".
- A finished set is a victory. A finished session is a campaign win.
  A skipped day is not a loss — it is silence in the world.
- Returning after absence is welcomed, not penalized.

### Copy guidelines

| Don't say | Say |
|---|---|
| "You broke your streak." | "The world missed you. Welcome back." |
| "Don't lose your progress!" | "Your momentum rests when you do." |
| "Push harder!" | "One more if it's there." |
| "Skipped day." | "Rest day logged." |
| "Failed set." | "Held the line." |

## 4. Fantasy framing

The world is **The Hollow** — a once-thriving land hollowed out by a
slow blight called *Stillness*. Stillness is not evil so much as
absorbed: it is what happens when nothing moves. Movement —
specifically, **structured human effort** — is the only force that
pushes Stillness back.

The player is a **Vow-Bearer** who has chosen to move on behalf of
the world. Each set lands as a blow against Stillness. Each session
restores a region. Each week of consistent training rebuilds a
landmark.

### Key fictional anchors

- **Stillness** — the antagonist. Quiet. Patient. Returns when you
  stop. *Not punishing — atmospheric.*
- **The Hollow** — the persistent world map. Regions clear as the
  player builds Momentum.
- **The Vow** — the player's commitment. The Vow does not break
  when you miss a day. It is renewed every time you return.
- **The Ember** — the visible representation of Momentum. Warm,
  glowing, slow to dim, slow to brighten. Never extinguished.

## 5. Anti-patterns we explicitly reject

This section is non-negotiable. If a future feature contradicts any
of these, it goes back to design.

1. **No fragile streaks.** A streak that resets on a missed day is
   a shame mechanic. We do not ship that.
2. **No infinite junk-volume reward.** Doing 50 sets of curls in
   one session must not out-XP a smart, varied 6-set session.
3. **No skip-day punishment.** Missing a day must not subtract XP,
   currency, or world progress. Decay is gentle and recoverable.
4. **No body-shame copy.** Ever. No before/after framing. No
   weight-loss-as-goal framing. The goal is *showing up*.
5. **No pay-to-win.** No premium mechanic that converts money into
   strength stats. Cosmetics only, if ever.
6. **No "don't break the chain" UI.** No red exclamation marks for
   missed days. No counters that visibly reset.
7. **No grindable XP loops detached from real effort.** Every XP
   source is gated by either real movement or real recovery.
8. **No FOMO push notifications.** Reminders are opt-in, warm, and
   never imply guilt.

## 6. Pillars

The four pillars every feature must serve at least one of:

1. **Show up.** Make it embarrassingly easy to start a session.
2. **Feel powerful.** Numbers go up because effort went up.
3. **Recover wisely.** Rest is a move, not an absence.
4. **Return without shame.** The game wants you back; it does not
   need you to apologize.

## 7. Out of scope (for now)

- Multiplayer / guilds / leaderboards.
- Diet / calorie tracking.
- Body-composition tracking.
- Video form-checking.
- Premium / monetization.
- Cross-app integration with `@dwhi/domain` (pantry).
- Heart-rate or wearable integration.

These may be revisited later, but not in MVP.

## 8. Naming

Working title: **Momentum**.
Backups: *Hollow*, *Vow-Bearer*, *Ember*, *The Long Return*.
Final name decision deferred until MVP screens exist. No app-store
listing depends on the name yet.

## 9. Success criteria (qualitative)

After 4 weeks of dogfooding, a returning user should be able to say:

- "I missed three days and the app didn't make me feel bad."
- "I actually looked forward to the rest timer."
- "I went lighter on a recovery day and the game *liked* that."
- "It took me less than 15 seconds from open to first set."

If any of those fail, MVP is not done.
