# Workout RPG — design docs

Design/planning artifacts for the second app in the DWHI family: an
ADHD-friendly tactical-RPG workout game. This folder contains the
design bible only — no app code, no schema migrations, no screens.

Read in order:

1. [`001-design-bible.md`](./001-design-bible.md) — pitch, tone,
   fantasy, anti-patterns, pillars.
2. [`002-core-loop.md`](./002-core-loop.md) — open-to-close
   session flow, time budget, rest-as-gameplay.
3. [`003-combat-mechanics.md`](./003-combat-mechanics.md) — damage
   formula, exercise math, enemy model, tunable constants.
4. [`004-momentum-consistency.md`](./004-momentum-consistency.md) —
   the streak-replacement: Momentum, decay, tiers, Return bonus.
5. [`005-mvp-implementation-plan.md`](./005-mvp-implementation-plan.md) —
   the smallest playable build: 1 Quest, 3 exercises, 1 enemy.
6. [`006-monorepo-integration-plan.md`](./006-monorepo-integration-plan.md) —
   how it slots into `apps/` + `packages/` and the schema proposal.

## Quick reference

- **Working title:** Momentum.
- **Antagonist:** *Stillness*. The world is *The Hollow*. The
  player is a *Vow-Bearer*. The Momentum bar is *The Ember*.
- **MVP user story:** open → 3 sets each of 3 push-day exercises
  → Sluggard, Lord of Couches falls → close, wanting to return.
- **Hard rules:** no streak shame, no junk-volume reward, no
  skip-day punishment, no pay-to-win, no FOMO notifications.
- **Primary retention mechanic:** Momentum (slow gain, slow decay,
  floored at 5, **Return bonus** of +8 on coming back after ≥ 3 days).

## Next implementation branch

After this design branch merges (or is referenced), the recommended
follow-up is **`claude/workout-rpg-scaffold-<token>`** — see
`006-monorepo-integration-plan.md` §9 for the full sequence.
