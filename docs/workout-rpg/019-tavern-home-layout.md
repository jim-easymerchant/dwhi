# 019 — Tavern-style home layout

> "Returning to a place, not opening a tool."

The pre-Quest home screen used to be three things in a row: a
camp sprite, a single Push-Day card, and a vow line. It worked but
felt deserted — the world had stopped breathing when the player
arrived. This branch fills the room without changing how the game
plays.

The mandate is narrow:

  - restore the inhabited-world feeling of the Iron Quest tavern
    home screen,
  - preserve every architectural rule that landed in branches
    015 → 018 (theme packs, view-based render, no Skia / no
    Reanimated, no new dependencies, no `reference/ironquest/`
    runtime imports, packages/workout-domain untouched),
  - keep the screen *shareable* between the quiet Momentum theme
    and the loud Iron Quest Classic theme — the layout is shared,
    the copy is themed.

The result: an eight-component home composition where every block
is theme-agnostic and theme-driven copy flows in through the
existing `ThemePack` extension.

---

## 1. Goals

1. **Inhabited room, not empty tab.** When the player opens the
   app there should be at least four atmospheric signals visible
   without scrolling: the location title, the camp scene, an
   ambient flavour panel, and a quest invitation that already
   names the foe.
2. **Theme-portable.** The same layout has to render two voices:
   Momentum (quiet mythic) and Iron Quest Classic (arcade
   tavern). No theme `if/else` ladders inside the screen — the
   theme pack carries the copy.
3. **Composable, not monolithic.** No 1000-line HomeScreen. Each
   block is its own file under `components/tavern/`.
4. **Anti-shame by construction.** Neither theme is allowed to
   shame absence, count days, or moralise food / weight. The test
   suite encodes this as a grep regression.
5. **No new runtime dependencies.** Built from React Native
   primitives and the existing `CampScene` / `workoutColors`.

---

## 2. Header strip (`TavernHeader.tsx`)

Top of the screen. Renders the location title (left) and a
settings gear button (right). Sub-title sits under the title.

Theme drives the strings via `ThemePack.headerCopy`:

```ts
interface ThemeHeaderCopy { title: string; subtitle: string; }
```

| Theme              | title              | subtitle                            |
| ------------------ | ------------------ | ----------------------------------- |
| Momentum           | The Hollow         | A quiet camp at the edge of the Stillness |
| Iron Quest Classic | THE WOUNDED GOBLIN | Tavern & Questionable Lodging       |

The component does not concern itself with the theme — it just
renders the two strings and a gear. The gear has stable testID
`home-open-settings` so the existing Settings tests keep working.

---

## 3. Scene frame (`TavernSceneFrame.tsx`)

A bordered card containing the existing `CampScene` and an
italicised one-line flavour string under it. The scene is
otherwise untouched — same View-based pixel renderer, same
mood-keyed lighting, same hearth animation.

Theme drives the flavour line via `ThemePack.ambient.sceneFlavor(tier)`:

| Tier      | Momentum                                              | Iron Quest Classic                                |
| --------- | ----------------------------------------------------- | ------------------------------------------------- |
| rusted    | Cool stone, low light. The room listens.              | The tavern is quiet. The fire is small. Someone is missing. |
| steady    | Warm light spills from the hearth.                    | The fire crackles. Mugs clink. The dog is asleep. |
| ascendant | The Hollow breathes in. The room is full of slow gold.| The tavern is full. The fire roars. The Goblin grins. |

The frame component is a wrapper, not a re-implementation — it
re-uses `CampScene` and lets the tier-mood-light system continue
to work without changes.

---

## 4. Status row (`TavernStatusRow.tsx`)

A compact horizontal three-card strip: **LEVEL**, **LAST**,
**WEIGHT**.

  - **LEVEL** — current Momentum (numeric mirror of the Ember
    bar). Tinted with `theme.uiAccent.primary`.
  - **LAST** — relative time since the last completed Quest
    (`today`, `yesterday`, `3d ago`, `2w ago`, `a while`). Reads
    `lastSessionAtIso` via the existing `computeDaysSinceLastQuest`
    helper.
  - **WEIGHT** — current bodyweight, rounded to whole kg.

The labels are *not* theme-driven on this branch — they describe
canonical Momentum state, not flavour. A future theme can opt into
a `statusLabels` sub-shape; we are deliberately not paying that
flexibility cost yet.

Anti-shame note: the LAST card never says "missed" or "skipped"
or counts a streak. `a while` is the worst it gets.

---

## 5. Ambient panel (`AmbientPanel.tsx`)

The signature inhabited-room beat — a section header followed by
2-5 atmospheric blurbs. Each line has a heading (`The Bartender`,
`A Dog That Should Not Be Here`, `The ember`) and a muted mood
fragment (`Name Unknown`, `Wagging Anyway`, `thin, but it
answers`).

Theme drives every part via `ThemePack.ambient`:

```ts
interface ThemeAmbient {
  sectionLabel: string;
  lines(tier: MomentumTier): readonly AmbientLine[];
  sceneFlavor(tier: MomentumTier): string;
}
interface AmbientLine { heading: string; mood: string; }
```

The runtime never reaches into the pack directly — it routes
through `getAmbientLines(themeId, tier)`, which falls back to the
Momentum lines for unknown ids. This is how a future theme drops
new ambient material without touching the panel component.

Tier sensitivity is intentional: both themes render *more* lines
at warmer tiers, so the Hollow / Tavern fills up as the player's
Momentum warms. The default branch always returns a fallback
non-empty list so the panel never renders empty.

---

## 6. Quest selection panel (`QuestSelectionPanel.tsx` + `QuestCard.tsx`)

A section header, a threat line ("Sluggard is settled in the
room." / "SLUGGARD IS IN THE ROOM."), and two side-by-side quest
cards: Bodyweight and Weighted.

Each `QuestCard` shows:

  - the modality label (`BODYWEIGHT` / `WEIGHTED`),
  - a bulleted preview of up to 5 exercise names (read from the
    existing `PUSH_BODYWEIGHT_STRATEGIES` / `PUSH_WEIGHTED_VARIANTS`
    fixtures),
  - a theme-tinted CTA button with a theme-driven action label
    (`Begin · Bodyweight` / `SESSION A · BODYWEIGHT`).

Card surfaces:

```ts
interface ThemeQuestCard {
  sectionLabel: string;
  threatLine(enemyName: string): string;
  bodyweightLabel: string;
  weightedLabel: string;
}
```

The "active" modality (`store.modality`) gets an accent-coloured
border so the player can see which one they last picked. Tapping
either card calls `startQuest(modality)` — no extra confirmation
step; the existing transition handles everything.

---

## 7. Lower expandable panels (`EchoLogPanel.tsx`)

Three identical panels stacked at the bottom of the screen:

  - **Echo / Kill log** — defeated fragments (count from
    `store.defeatedEnemies.length` for now; the journal-style row
    rendering lands in a later branch).
  - **Weight log** — PR sets. Empty in this branch.
  - **Session history** — completed quests. Empty in this branch.

Each panel uses the same `EchoLogPanel` component:

  - tappable header with the section label and a `(count)`,
  - chevron flips between `▸` (collapsed) and `▾` (expanded),
  - body shows either rendered rows or a theme-driven empty hint.

Labels and the empty-hint come from `ThemePack.panelLabels`:

```ts
interface ThemePanelLabels {
  echoLog: string;
  weightLog: string;
  sessionHistory: string;
  emptyHint: string;
}
```

Why count rather than full row rendering this branch? The journal
panels are the part of the Iron Quest screenshot that needs the
most domain-aware data plumbing (PR formatting, defeated-enemy
flavour mapping). Count + empty hint is the smallest shape that
matches the visual rhythm of the Iron Quest screenshot without
requiring that plumbing. Full rows land when the journal
formatter does.

---

## 8. Footer (`TavernFooterActions.tsx`)

The very bottom of the screen: a slim Ember bar + a single
italicised reassurance line.

  - Ember bar — the same 0-100 fill that used to sit in the
    middle of the screen. Tinted with `theme.uiAccent.primary`.
  - Reassurance — `ThemePack.footer.reassurance`.

Anti-shame contract — see `tavernLayout.test.ts §4`. The grep
test rejects any of `lazy`, `skipped`, `missed (it|workouts|days)`,
`failed (you|us|me)`, `weak`, `quitter`, `disappointed`, `diet`,
`calorie`, `bmi`, `fat` anywhere on the home surface, for every
theme.

Iron Quest Classic's reassurance reads `Minimum viable dungeon
run: show up. That's the whole rule.` — dark humour, but the
content is anti-shame. Momentum's reads `Showing up is the rule.
The rest is detail.`.

---

## 9. Composition shell — `HomeScreen.tsx`

The screen itself is **~170 lines** and contains zero raw flavour
strings. It:

1. reads the store slices it needs,
2. resolves `theme = getTheme(selectedThemeId)`,
3. calls `getAmbientLines(...)` / `getAmbientSceneFlavor(...)` for
   the panel inputs,
4. composes the eight tavern components in order.

A grep test (`HomeScreen content boundary`) enforces that the
screen file does not inline any of the theme-specific strings
(e.g. `THE WOUNDED GOBLIN`, `TONIGHT'S PATRONS`, `KILL LOG`,
`Tonight in the Hollow`, `CHOOSE YOUR FATE`, `Minimum viable
dungeon run`). All theme copy *must* flow through the pack.

---

## 10. Constraints respected

  - **No new dependencies.** Verified: `apps/workout/package.json`
    is unchanged; the components import only `react`,
    `react-native`, `react-native-safe-area-context` (already
    present), and the existing `@dwhi/workout-domain` /
    `../theme` / `../render` modules.
  - **No Skia / Canvas / Reanimated.** The Ember bar and panel
    expansion use plain View + state.
  - **`packages/workout-domain` is untouched.** This branch
    touches only `apps/workout/` and the docs.
  - **No `reference/ironquest/` imports.** The Iron Quest copy is
    reimplemented in our own TypeScript. The visual silhouette
    matches; the source code does not cross the boundary.
  - **No punishment systems / FOMO / streak counters.** The LAST
    card is friendly; the panels stay collapsed by default; the
    Ember bar moves on Momentum logic, not on attendance.
  - **No giant screens.** `HomeScreen.tsx` is a thin composition
    shell. The eight components average ~80 lines each.

---

## 11. Tests

`apps/workout/src/tests/tavernLayout.test.ts` covers:

  1. *Compile-time smoke* — every component export and the
     `HomeScreen` symbol still resolve via `import type`.
  2. *Theme data shape* — `headerCopy`, `ambient`, `questCard`,
     `panelLabels`, `footer` all carry expected values for both
     shipped themes. Iron Quest labels are UPPERCASE; Momentum
     labels are sentence-case.
  3. *Ambient generator behaviour* — `getAmbientLines` returns the
     theme's own lines for a known id, falls back to Momentum's
     lines for unknown / non-string / null / undefined ids;
     `getAmbientSceneFlavor` is non-empty for every theme × tier;
     `getAmbientSectionLabel` routes through `getTheme`.
  4. *Anti-shame regression* — for every theme, the joined corpus
     of every home-surface string (header + ambient + quest +
     panels + footer + scene flavour per tier) does not match a
     curated list of shaming / disordered-eating vocabulary.
  5. *Content boundary* — `HomeScreen.tsx` does not contain any
     theme-specific flavour literals; it imports the tavern
     barrel and `getTheme`.

Total: 21 new assertions; the whole workout suite (245 tests)
passes; the full DWHI suite (861 tests across 67 suites) passes;
`tsc --noEmit` is clean.

---

## 12. Not in this branch

  - Journal rows (Echo log rendering defeated fragments with mood
    flavour, Weight log rendering PR rows with weight + reps,
    Session history rendering completed quests with verdicts).
  - Camp scene density bump — extra NPC silhouettes / lanterns /
    benches at higher tiers. The current scene already does
    tier-keyed lighting; adding silhouettes is a separate
    art-tuning pass.
  - "Choose Your Fate" zone selector (Shallow Crypts × 0.7 /
    Merchant District × 1.0). That belongs in the Quest-zone
    branch and would need balance math.
  - Voice-pack playback. The narration architecture (017 / 018)
    is wired but the home screen does not yet trigger it.
  - Per-theme camp art (Hollow vs Tavern silhouettes). The
    current `CampScene` is shared between themes with overlay
    tint; per-theme layer maps are a sprite-art branch.

See `docs/workout-rpg/README.md` for the next branch in the
sequence.
