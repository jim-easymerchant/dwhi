# 013 — Nutrition & Provisioning

> *Nutrition is provisioning the camp. It is not calorie policing.*
> Everything in this document follows from that single sentence. If
> a feature ever drifts away from it, we cut the feature, not the
> sentence.

---

## 1. Core principle

The Workout RPG treats nutrition as **provisioning**: the player is
laying in supplies for the road, restocking the hearth, sharpening
tools. The game asks "what is in the camp this week?" — not "did
you exceed your calorie budget?"

Three sentences we can put on a wall:

> *Nutrition makes tomorrow easier. It does not make today feel
> guilty.*
> *There is no bad food. There is only the food that was on the
> shelf when you needed it.*
> *A camp that ate well in the evening fights better in the morning.*

If a contributor proposes anything that reads against those three,
the contribution does not ship.

## 2. Anti-patterns we explicitly reject

This section is non-negotiable.

1. **No calorie tracking.** No daily calorie target. No
   "remaining calories." No deficit / surplus framing.
2. **No "bad food" lists.** No red / green markers. No "ultra-
   processed warning." No before/after photos of any food.
3. **No macro obsession.** Protein, carbs, fat are referenced
   only as in-fiction *provisioning materials* (repair fibre,
   trail rations, hearth fuel). Numeric grams are never required.
4. **No moralised copy.** Never "clean," "dirty," "cheat,"
   "earned," "burned off." Never "you should." Never "you
   shouldn't."
5. **No body-surveillance framing.** No weight goal. No
   body-composition tracking. No before/after. No "look better in
   a month."
6. **No shame loops.** No counters that reset. No "you missed a
   day of provisioning." No streak.
7. **No mandatory entry.** A player who never logs anything is
   still playing the game. Their Hearth simply uses default
   stores.
8. **No external sharing.** Nothing about food is shareable.
9. **No diet ideology.** No "low-carb," "paleo," "intermittent
   fasting" pushes. No fitness-culture vocabulary at all.

## 3. What nutrition does in the fiction

Nutrition lives inside the **Camp** layer (see
`004-momentum-consistency.md` §6 and `012-battle-ux-and-feel.md`
§12). It does **not** appear during a Battle. The Hearth is the
home screen between Quests, and Camp is what the player does to it.

When the camp is provisioned:

- The next Quest's fatigue floor is **slightly more forgiving**.
- The Ember stabilises a touch faster.
- Recovery-day choices feel narratively warmer.
- Verdicts on the *next* Quest may include a small flavour line
  ("The kettle was already warm.").

When the camp is sparsely provisioned (or the player never logs):

- **Nothing bad happens.** The game uses defaults.
- A gentle invitation may surface in the Hearth screen — never a
  warning. Tone: *"There is room on the shelves."*

## 4. Provisioning categories (in-fiction)

| In-fiction name | What it represents | How it's logged |
|---|---|---|
| **Repair fibre** | Protein-rich foods | Tap one of: lentils / fish / eggs / poultry / tofu / dairy / meat / nuts / seitan / beans. No grams. |
| **Trail rations** | Carbohydrate-rich foods | Tap one of: bread / rice / oats / pasta / fruit / potatoes / tortillas / grains. No grams. |
| **Hearth fuel** | Fat-rich foods | Tap one of: oils / butter / nuts / seeds / avocado / cheese / olives. No grams. |
| **Bright leaves** | Vegetables and greens | Tap one or many. No counts. |
| **Tideline salts** | Hydration | Tap a cup count if the player wants — never required. Water, tea, herbal infusions all count. |
| **Festival fare** | Celebratory eating | Optional. Tagged as flavour, never penalised. |

The catalogue is deliberately small, deliberately humane, and
deliberately not a comprehensive food database. Anything not
present is logged as "Whatever was on the shelf" — a single tap.

## 5. Camp systems

### 5.1 The Hearth pantry

A small, ambient panel on the home screen between Quests.
Visually: a low shelf with stylised silhouettes (a jar, a sack, a
bowl) that fill in over the course of a week as the player
provisions.

- Tapping the shelf opens the Hearth screen.
- Provisioning is a *single tap per category per day*. The
  category-button glows softly until tapped, then settles.
- No required minimum. No daily quota. No streak.

### 5.2 Hydration

Hydration ("tideline salts") is the **lightest-touch entry** in
the game. A single cup icon on the Hearth screen. Tap to increment;
long-press to decrement. The icon dims as the day passes if no
tap registered. **It never alarms.** A dim cup is just a quiet
suggestion.

We deliberately do not show numbers (oz / ml). Cups are an
abstract unit; the player decides what their cup means.

### 5.3 Recovery meals

A **Recovery Meal** is a special, *optional* one-tap action
available after any Quest. It is one of:

- *Warm grain*  — a bowl of oats, rice, or barley.
- *Slow stew*   — anything braised, simmered, or with broth.
- *Cold larder* — yogurt, fruit, nuts, seeds.
- *Hearth bread* — toast, sandwich, anything between two slices.
- *Open kettle* — tea, herbal infusion, soup.

Tapping a Recovery Meal:

- Marks the camp's `recently_provisioned_at`.
- Slightly raises the next Quest's fatigue floor (capped per the
  `recoveryBonus` cap in the orchestrator's reward packet — never
  > 0.15).
- Does nothing else. No XP, no Momentum, no shame.

### 5.4 Feast moments

A **Feast** is a narrative event the player can mark when they
want to remember the meal — a holiday, a birthday, a long-awaited
dinner with friends. It is a single tap on the Hearth screen,
with an optional one-line note (private, never synced unless
explicit consent is added in a much later branch).

Feasts contribute **zero** to balance. They are *purely
autobiographical*. The Hearth screen renders them as small warm
stars on the week's timeline.

### 5.5 Low-energy days

If the player logs a `low-energy` flag (a single tap on the home
screen — soft, friendly icon), the next Quest:

- Suggests a recovery template by default.
- Pre-fills lower reps on weighted exercises (~20% under last
  session's working weight).
- Raises the fatigue floor by the same `recoveryBonus` mechanism
  as a Recovery Meal.

The flag self-clears the next morning. There is no "low energy
streak." There is no record of how many low-energy days were
logged, except inside the player's own private journal.

### 5.6 Gentle-mode integration

When the orchestrator's `gentleModeActive` is true (returning
after a ≥ 3-day gap), the Hearth screen:

- Shows an inviting copy line: *"Stock what's easy. The shelves
  remember."*
- Pre-elevates the visibility of Recovery Meal and tideline salts
  taps.
- Hides any "missing" copy on the pantry shelf — the dim
  silhouettes are not framed as gaps.

## 6. Why nutrition makes tomorrow easier, not today guiltier

The cardinal design choice: **all nutrition effects apply
*forward*, never *backward*.** Provisioning the camp this evening
sets up the next Quest. There is no mechanic that reaches back
and penalises a Quest that already happened, no mechanic that
inspects what the player ate today and emits a verdict.

This is intentional. Backward-looking nutrition systems are how
fitness apps create shame loops; forward-looking systems are how
caregivers and coaches actually feed athletes. We are the
caregiver, never the auditor.

## 7. Hydration as a first-class action

Hydration is the single mechanic most likely to drift toward
shame. We are explicit:

- **No daily target is shown.** Not 8 cups, not 64 oz, not 2 L.
- **No dehydration "warning."** Ever.
- **No comparative copy.** No "you drank less than yesterday."
- **No reminders that imply failure.** A gentle ambient cue
  ("tideline salts are quiet today") is the maximum, and it is
  opt-in.

If a player taps the cup once a week, that is *fine*. The system
recognises that hydration ambient awareness is the goal; precise
measurement is not.

## 8. Repair fibre, trail rations, hearth fuel — the language

We use the in-fiction names because the macronutrient names are
loaded vocabulary in fitness culture. We are not avoiding
science — we are avoiding the *rhetoric* attached to the science.
A player who taps *repair fibre* every evening for a month is
provisioning protein; we just decline to play the part of the
nutrition policeman about it.

Tooltip copy convention:

| In-fiction | Tooltip (single line) |
|---|---|
| Repair fibre | *"What the body uses to mend itself."* |
| Trail rations | *"What the body uses to keep moving."* |
| Hearth fuel | *"What the body uses to stay warm."* |
| Bright leaves | *"What rounds out the table."* |
| Tideline salts | *"What keeps the river running."* |

No tooltip ever says "should," "must," "need to," "deficit," or
"goal."

## 9. Recovery meals as a Verdict signal

A logged Recovery Meal within 4 hours of a Quest's end emits a
single verdict eligibility flag the orchestrator can read:
**"Hearth Tended."** This verdict (post-MVP) takes the same
priority class as *Warmth Returned* and surfaces a one-line
reward-screen copy: *"The kettle whistled. You reached for it."*

It is **not** a requirement. A Quest with no Recovery Meal logs
is also fine.

## 10. Future Health API integration

When (much later) we integrate with Apple Health, Google Health,
or a similar platform:

### 10.1 Allowed reads (passive only, opt-in)

- Cups of water (if the platform records them).
- Whether a meal was logged today (presence only — not its
  contents).

### 10.2 What we will never read

- Detailed food entries.
- Calorie totals.
- Macro breakdowns.
- Weight.
- Body composition.
- BMI.
- Heart-rate variability tied to nutrition.

These signals exist on the platform. We deliberately decline
access. Reading them invites the rhetoric we just spent this whole
document rejecting. The player can use other apps for those
metrics if they want them; the Workout RPG does not.

### 10.3 What we will write

**Nothing.** We do not write to Health platforms. Provisioning
data stays inside the camp.

## 11. Why manual entry must always exist

Even when Health integration lands:

- A player may decline platform access. The Hearth must still
  fully work.
- A player on an older OS, a different OS, or a device without
  Health support is a first-class player.
- Manual entry is *not a worse experience*. The single-tap
  category buttons are the same UI whether or not Health is on.

If, in any branch, a feature exists *only* through Health
integration, the feature is rejected and rebuilt for manual
entry first.

## 12. Anti-disordered-eating safeguards

This is the most important safeguard list in the document. Every
contributor should be able to apply each test.

1. **No calorie surface anywhere.** Not in tooltips, not in
   diagnostics, not in dev-only debug overlays.
2. **No "perfect day."** No daily achievement related to food.
3. **No comparative copy.** Never "more / less than yesterday."
4. **No "danger" zones.** No red colour applied to a low entry.
5. **No mandatory entry to play.** Skipping is normal.
6. **No body-image surface.** No avatar that changes shape based
   on intake. No "before / after."
7. **No micronutrient gamification.** No "vitamin progress." No
   "complete your nutrient set."
8. **No fasting metrics.** Even if the platform reports them,
   we ignore them.
9. **No restrictive language.** No "limits." No "allowances." No
   "budgets."
10. **No food-as-reward / food-as-punishment.** Food never
    grants damage, never penalises XP.
11. **A visible exit.** Every nutrition surface has a "hide" /
    "off" toggle (per-section in settings). A player can play
    the game with the entire nutrition layer disabled.

## 13. What this is not

- **Not a meal planner.** No menus, no recipes (in MVP and
  post-MVP).
- **Not a tracker.** No reports of intake history.
- **Not a coach.** No nutrition advice. The game never tells the
  player what to eat.
- **Not a medical device.** Tooltips never mention disease,
  diagnosis, recovery from injury, deficiencies.
- **Not a religion.** No dietary ideology promoted, ever.

## 14. The promise the player feels

> *I came back from the kitchen and the camp looked warmer. The
> game saw that I made tea. It did not ask me what was in the
> tea. It did not ask me how many cups. It just remembered that
> the kettle whistled.*

If a player ever says that, the nutrition layer is doing its job.
If a player ever says "I felt bad about what I logged in the
camp," it has failed and we redesign the offending surface that
same day.

## 15. Roadmap and sequencing

This document is **design-only**; no code lands in the
orchestrator branch or any branch immediately downstream of it.
The nutrition layer is sequenced to land **after** the Expo MVP
shell + SQLite repos exist, on its own dedicated branch:

  `claude/workout-rpg-hearth-pantry-<token>`

At that time, the implementation surfaces will be:

- `packages/workout-domain/src/hearth/` — types + pure-function
  helpers (no React, no DB).
- `apps/workout/app/(hearth)/` — screens (in the same branch
  that introduces the Hearth screen at all).
- `apps/workout/src/db/hearth.ts` — SQLite repositories.

The orchestrator's `RunQuestResult.rewards.recoveryBonus` already
provides the hook the Hearth layer will read: a non-negative
scalar the *next* quest can use to soften its fatigue floor. No
schema change is needed in the orchestrator branch — the value is
present, ready, and unused.
