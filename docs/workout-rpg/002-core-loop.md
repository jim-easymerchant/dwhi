# 002 — Core Loop

> The shortest path between "I opened the app" and "I want to come
> back." Everything else in this design exists to protect this loop.

---

## 1. Session-level loop (the Quest)

```
Open app
  └─ Resume in-progress Quest?  ─yes→ jump to Battle
     │no
     ▼
  Tap "Start Quest"
     │
     ▼
  Pick a Quest (workout template)         ← <= 1 tap on default
     │
     ▼
  Enter first Battle (exercise)
     │
     ▼
  ┌─► Perform Turn (set)
  │     ├─ Log reps                       ← steppers, no keyboard
  │     ├─ Log weight (auto-prefilled)
  │     └─ Tap "Attack"
  │       │
  │       ▼
  │     Attack resolves
  │       ├─ Damage dealt → enemy HP down
  │       ├─ XP / loot preview
  │       └─ Crit / PR celebration if applicable
  │       │
  │       ▼
  │     Rest = Enemy turn
  │       ├─ Rest timer counts down
  │       ├─ Enemy "wind-up" animates
  │       └─ Optional: tap to end rest early
  │       │
  │       ▼
  │     More sets?  ─yes→ ┘
  │       │no
  │       ▼
  │     Enemy defeated (or set count reached)
  │       │
  │       ▼
  │     Next Battle? ─yes→ pick next exercise → loop
  │       │no
  │       ▼
  Quest complete
     │
     ▼
  Reward screen
     ├─ XP gained
     ├─ Momentum tier change (if any)
     ├─ Region progress
     └─ "Disciplined Exit" bonus if user stopped at planned volume
     │
     ▼
  Close app (the player wants to return)
```

## 2. Time budget per phase

ADHD-friendly means we measure the loop in seconds, not minutes.

| Phase | Target time | Hard cap |
|---|---|---|
| App open → "Start Quest" tap available | < 2s | 4s |
| Start Quest tap → first Battle screen | < 1s | 2s |
| Battle screen → "Attack" tap available | 0s (defaults pre-filled) | 1s |
| Attack tap → attack resolution finishes | ~1.5s | 3s |
| Rest timer | configurable (60/90/120s) | — |
| Quest complete → reward screen | < 1s | 2s |

**Total fixed overhead per session (not counting work or rest): < 10s.**

## 3. First-launch loop

The very first session must be *playable* in under 60 seconds of
non-exercise time. Onboarding is one screen:

```
[ Welcome to The Hollow ]

A world recovering, one set at a time.

Pick a starting Quest:
  ( ) Push Day        (recommended)
  ( ) Pull Day
  ( ) Legs

Equipment:
  ( ) Bodyweight
  ( ) Dumbbells / barbell

[ Begin ]
```

No account. No email. No tutorial gate. Defaults are pre-selected.
A user who taps Begin immediately should land in their first
Battle. Tutorial hints appear *inline* in the first Battle (one
sentence, dismissible).

## 4. Resume / abandon behavior

If the user closes the app mid-Quest:

- Quest state is persisted locally after every Turn.
- On reopen within 24h: "Resume your Quest?" with one-tap resume.
- After 24h: the Quest is gracefully archived as "Held the Line"
  (partial credit for sets completed, no penalty).
- Resuming a Quest never costs Momentum.

## 5. Rest timer as gameplay

Rest is **not dead time**. It is the enemy's turn. During rest:

- Enemy animates a wind-up (telegraphs incoming "damage").
- Player sees their current XP / Momentum bar gently fill.
- A short tip rotates ("Breathe through the nose.").
- Tap to end rest early *if you're ready* (no penalty, no reward).
- Auto-advance when timer hits 0.

The rest timer is the **single most important retention feature**.
A boring rest timer is why people quit fitness apps. It must be
*pleasant to wait through*.

## 6. Reward screen choreography

After the last Battle of a Quest:

1. **Beat 1 — the hit lands.** Final enemy collapses. Camera pulls
   back. Region map shows a small area being "un-hollowed."
2. **Beat 2 — XP tally.** Numbers count up. Momentum bar updates.
3. **Beat 3 — verdict.** One of:
   - "Disciplined Exit" — stopped at planned volume.
   - "Held the Line" — partial session, no shame copy.
   - "PR Logged" — new personal best.
   - "Steady Vow" — repeat of a previous quest.
4. **Beat 4 — invitation.** "Rest well. The Vow holds."

No "share to social" prompt. No rating prompt in MVP.

## 7. Failure modes the loop must survive

| Failure | The loop must... |
|---|---|
| User skips 5 days | Open with a warm return prompt, no shame. |
| User logs a set wrong | Allow inline edit within 10s of logging. |
| User wants to bail mid-Quest | One-tap "Wrap it up" → counts toward Momentum. |
| User is at the gym between sets | Rest timer must not block the screen entirely. |
| User has no equipment today | Bodyweight Quest must be one tap away. |

## 8. What the loop is NOT

- Not a workout tracker with a coat of paint. The combat is the
  primary feedback, not a flourish on top of a logger.
- Not a guided coach. We do not prescribe specific weights. We
  reflect the player's choices back as drama.
- Not a calendar. There is no "your schedule for Tuesday." The
  player chooses a Quest when they open the app.
