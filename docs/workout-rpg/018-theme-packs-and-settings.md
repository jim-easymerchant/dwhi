# 018 — Theme Packs & Settings

> *Momentum is the engine. The themes are what the engine sounds
> like.*
> This branch formalizes the product direction: Momentum stays the
> default, Iron Quest Classic becomes a player-selectable
> alternate, and the architecture is built so future emotional /
> coaching / accessibility styles can land without re-plumbing
> anything.

---

## 1. What a theme pack IS — and what it is NOT

A **theme pack** is a typed declarative description of how the
Momentum engine should *present* itself. It bundles together:

- a sprite preference per enemy category,
- optional palette overrides on top of the canonical tokens,
- UI accent + danger colours,
- a coarse tone label (`quiet-mythic` / `arcade-tavern`),
- narration metadata (allow-all-caps / allow-exclamation gates),
- per-event narration hooks (`onQuestStart`, `onEnemyDefeat`,
  `onComeback`, `onFailure`, `onLongAbsence`),
- default enemy flavour copy + a name prefix,
- a motivational tagline shown on Home.

A theme pack **never** changes:

- combat math,
- momentum decay,
- persistence schemas,
- the orchestrator's transaction pipeline,
- soft caps / junk-volume / disciplined-exit logic,
- the verdict vocabulary.

> **Design rule:** if a feature would diverge *mechanically* between
> themes, it does not belong in a theme. It belongs in a separate
> setting, mode, or feature flag.

This separation lets us add as many themes as the team can author
without ever touching `packages/workout-domain/`. The engine is
sacred; the surface is a wardrobe.

---

## 2. Shared mechanics vs presentation layers

```
┌────────────────────────────────────────────────────────────────┐
│   Shared mechanics (untouched by themes)                       │
│                                                                │
│   • packages/workout-domain/   combat, orchestrator, momentum  │
│   • apps/workout/src/persistence/   SQLite + repositories      │
│   • apps/workout/src/state/    Zustand store, persistence      │
│                                bridge, side-effect registry    │
└────────────────────────────────────────────────────────────────┘
                              ▲
                              │   (read-only)
                              │
┌────────────────────────────────────────────────────────────────┐
│   Presentation layer (theme-aware)                             │
│                                                                │
│   • apps/workout/src/theme/    ThemePack registry + narration  │
│   • apps/workout/src/render/   sprites + Camp scene            │
│   • apps/workout/src/screens/  Home / Battle / Reward / Settings│
│   • apps/workout/src/components/  ThemeCard, future widgets    │
└────────────────────────────────────────────────────────────────┘
```

Themes flow downward: the store carries `selectedThemeId`, the
screens resolve it via `getTheme(id)`, and the render layer
receives theme-derived sprite ids and palette overlays as props.
There is no upward flow — the engine never asks which theme is
active.

---

## 3. The two shipped themes

### Momentum (default)

> *Quiet mythic endurance. The Hollow softens through steady
> work.*

- Tone `quiet-mythic`, camp style `hearth`.
- Sprite preference: Momentum's hand-authored silhouettes
  (`fragment` / `hollow` / `ward`).
- UI accent: Ember orange (`#E9A14B`) primary, Hearth red-orange
  (`#D55E3F`) danger.
- Narration: warm voice; **no ALL CAPS, no exclamation marks**
  — the `applyToneGates` helper strips them at render time even
  if a content author slips up.
- Enemy intro: *"Sluggard has settled in the room."*
- Tagline: *"Steady. The Ember glows."*

Source of truth for the voice: `001-design-bible.md`,
`010-enemy-design-bible.md`, `012-battle-ux-and-feel.md` §13.

### Iron Quest Classic

> *Arcade tavern combat. Monsters remember weakness.*

- Tone `arcade-tavern`, camp style `tavern`.
- Sprite preference: the Iron-Quest-derived silhouettes
  (`ironquest-humanoid` / `ironquest-beast` /
  `ironquest-construct`).
- UI accent: Iron Quest amber (`#f0a030`) primary, IQ danger
  red (`#cc2800`).
- Narration: taunting voice; **ALL CAPS and exclamation marks
  permitted** — the player opted in.
- Enemy intro: *"SLUGGARD WANTS A FIGHT."*
- Tagline: *"THE TAVERN WAITS."*

Source of original tone: `reference/ironquest/` (Dungeon-Crawler-
Carl flavour, ported into Momentum's TypeScript codebase).

The Iron Quest Classic theme preserves the original Iron Quest
design intent as a player-opt-in alternative. The default
remains the quiet anti-shame Momentum surface — but a player who
wants the louder presentation can pick it up in Settings and have
it persist.

---

## 4. Why theme-driven narration exists

Three reasons it lives at this layer instead of inline in each
screen:

1. **Tone-gate enforcement.** `applyToneGates(line, theme)`
   strips exclamation marks and lowers ALL CAPS runs when the
   theme has declared it doesn't want those affordances. If a
   future content author writes `"THE TAVERN ROARS!"` into the
   Momentum theme by accident, it renders as
   `"The tavern roars."` — the rule survives the typo.
2. **Voice-pack readiness.** Each theme already declares a
   `voicePackId`. The voice-pack branch
   (`015-ironquest-port-plan.md` §6 #2) drops a rotating line
   pool keyed on the same id; no screen-file edits needed.
3. **Per-event scope.** Hooks are typed by event context
   (`QuestStartContext`, `EnemyDefeatContext`, …). Each event has
   exactly one entry point that screens call by name. That makes
   it trivial to swap a single hook for a localized or
   coaching-mode override later, without touching the rest.

---

## 5. Settings panel

A new dedicated screen (`apps/workout/src/screens/SettingsScreen.tsx`)
renders when the store's `phase === 'settings'`. The Home screen
gains a small gear button (top-right) that calls
`openSettings()` to flip the phase. Returning to camp uses the
existing `returnToCamp()` action — no React Navigation
introduced, no route stack changes.

Sections shipped in this branch:

1. **Theme selection** — every registered theme as a
   `ThemeCard`. Tapping a card calls `store.setTheme(id)`. The
   active card has a coloured border in the theme's own accent.
2. **Theme descriptions** — embedded in each card.
3. **Preview** — a small paused `CampScene` at the *Driven*
   tier shows what the camp will look like.
4. **Persistence status** — `active` / `loading…` /
   `disabled — memory-only` with the failure message when one
   is present.
5. **Version / build info** — from `Constants.expoConfig`.
6. **Placeholder sections** for future settings: Voice packs,
   Accessibility, Haptics, Audio — each marked `soon`.

---

## 6. Persistence behaviour

The store gains:

```ts
interface WorkoutGameState {
  selectedThemeId: string;                  // default 'momentum'
  setTheme(themeId: string): void;          // safeThemeId-validated
  openSettings(): void;
}
```

On hydration (`hydratePersistence()`), the persisted theme id is
loaded from a new `workout_settings` table (single row,
`id = 'default'`, `theme_id` column) and routed through
`safeThemeId()` so an invalid stored value silently falls back
to Momentum. On `setTheme(id)`, the store fires an
`onThemeChanged(id)` handler — the persistence bridge attaches
`persistThemeSelection(id)` as a fire-and-forget save.

**Graceful failure surface:**

- DB unavailable → `setTheme` still updates the in-memory store;
  the write is a no-op.
- Stored value missing → store stays at default Momentum.
- Stored value corrupted (`"   "` / `"Momentum"` /
  `"not-a-theme"`) → `safeThemeId()` returns `'momentum'`; the
  user sees the default theme.
- `DISABLE_PERSISTENCE_BOOT=true` (the emergency bypass from
  the SQLite-compat branch) → the persistence module is never
  loaded; the theme system still works in memory-only mode for
  the running session.

The schema migration is additive — `CREATE TABLE IF NOT EXISTS
workout_settings (…)` — so an existing install upgrades cleanly.

---

## 7. Future themes (sketches, not commitments)

The architecture invites these without architectural changes:

- **Coaching mode** — explicit second-person warmth, plain-English
  rep targets, no fantasy framing. Narration hooks return
  *"Three more, then breathe."*-style lines. Same combat math.
- **Hardcore taunting pack** — louder than Iron Quest Classic;
  explicit "the dungeon mocks you" copy. Same combat math.
- **Cozy / meditative pack** — Momentum stripped of even the
  enemy framing. Sets become breath cycles; the "battle" reads
  as a stillness arc. Same combat math.
- **Accessibility voice packs** — pre-recorded audio cues +
  high-contrast palettes + larger sprite scale. Pairs with the
  reserved `voicePackId` field.
- **Locale themes** — language packs distributed as themes so
  copy + tone arrive together (a Spanish "Iron Quest Classic"
  can take its own creative liberties without affecting an
  English Momentum install).

None of these require touching the orchestrator. None of these
require a new dependency. None of these change combat balance.

---

## 8. Tests

`apps/workout/src/tests/themePacks.test.ts` (+33 tests across the
seven concern areas):

1. **Registry validity** — ids match `ALL_THEME_IDS`; fallback
   id is present; `listThemes()` returns stable order; each
   theme declares preferred sprite ids per category; Momentum
   prefers original sprites, Iron Quest Classic prefers
   IQ-derived.
2. **Fallback behaviour** — `getTheme(unknown)` returns
   Momentum; `safeThemeId(non-string)` returns `'momentum'`;
   corrupted stored values (mixed-case, whitespace, empty
   string) all fall back.
3. **Tone gates** — Momentum strips ALL CAPS + `!`; Iron Quest
   Classic preserves both; short acronyms (≤ 2 chars) are kept.
4. **Narration hooks** — Momentum is sentence-cased and quiet;
   Iron Quest Classic is theatrical; all five hooks return
   non-empty strings for both themes.
5. **Store integration** — default `selectedThemeId` is
   Momentum; `setTheme` updates known ids and falls back on
   unknown; `openSettings` flips phase; `returnToCamp` exits.
6. **Memory-only support** — `setTheme` works while
   `persistenceDisabled: true`.
7. **Compile-time exports** — `SettingsScreen`, `ThemeCard`,
   `ThemeCardProps`, the `ThemeId`/`ThemePack` types resolve.
8. **Regression** — no runtime imports of `reference/ironquest`,
   no Reanimated / no Skia in any theme / component / screen /
   state file.

---

## 9. What this branch is NOT

- Not a new dependency. Pure TypeScript + the existing
  `Constants` import already used elsewhere.
- Not a DWHI pantry change.
- Not a Supabase / auth / sync change.
- Not a combat-balance change. `packages/workout-domain/` is
  untouched.
- Not a runtime import from `reference/ironquest`. The
  registration of IQ flavour lives in `ironQuestClassicTheme.ts`
  as fresh TypeScript; the regression-grep test enforces it.
- Not a full voice / announcer system. The narration hooks are
  the architecture only — one line per event per theme. The
  rotating pool + deterministic picker land in the voice-pack
  branch from `015-ironquest-port-plan.md` §6 #2.
