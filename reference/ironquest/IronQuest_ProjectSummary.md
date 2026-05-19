# Iron Quest — Project Summary & Agent Handoff Document
> Last updated: April 2026 | Status: Phase 2 In Progress

---

## 1. What This App Is

Iron Quest is a mobile-first fitness RPG where **the workout IS the combat**. Every set performed is an attack turn. Every rep and pound of weight determines damage dealt to a monster. Monsters fight back during your rest period. You can die, get sent back to the tavern, and return to a wounded, enraged monster that remembers you.

This is not a fitness app with gamification bolted on. The combat engine IS the workout tracker. They are the same thing.

**Tone:** Dungeon Crawler Carl (Matt Dinniman). Sardonic, absurdist, self-aware. The dungeon knows it's a dungeon. Monsters have opinions. Gear has unhinged lore. Nothing is played completely straight. An announcer comments on everything.

**Not:** Generic Tolkien fantasy. Not badge/streak/leaderboard gamification. Not a chatbot fitness coach.

**The one rule:** If a feature treats exercise as a checkbox that unlocks a game reward, it is wrong. The rep is the attack. The set is the turn. The rest period is the monster's turn.

---

## 2. Project Origin

Built on top of **RisingKB** — a working Expo kettlebell tracker. The existing workout tracking UI in `ActiveWorkout.js` became the combat screen. The A/B workout split, set logging, previous session display, and AsyncStorage persistence all carried forward and were layered with the combat engine.

---

## 3. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Expo SDK 54 + React Native | Upgraded from SDK 51 during development |
| Language | JavaScript | No TypeScript conversion |
| Sprite rendering | View-based pixel art ONLY | No Skia, no Reanimated — both break Expo Go |
| State management | Zustand | Installed, working |
| Persistence | AsyncStorage | expo-sqlite deferred to Phase 4 |
| Navigation | View switching in App.js | No React Navigation yet |
| Animations | React Native built-in Animated API | NO reanimated, NO Skia |
| Audio | expo-audio | Replaced deprecated expo-av |

### BANNED — Never Install
- `react-native-reanimated` — breaks Expo Go, not needed
- `@shopify/react-native-skia` — requires Reanimated, breaks Expo Go
- `expo-av` — deprecated in SDK 54, replaced by expo-audio
- Redux, React Navigation, any AI image generation library, Firebase

---

## 4. Global Visual Language

All screens use this palette. No exceptions. Font is monospace everywhere. Sharp corners on all game elements.

```javascript
const C = {
  bg:          '#08080c',   // near-black
  card:        '#0f0f14',
  border:      '#1e1e28',
  text:        '#e8d8b8',   // warm off-white
  muted:       '#8878a0',
  dim:         '#504860',
  accent:      '#f0a030',   // AMBER — primary color
  accentDark:  '#a06010',
  danger:      '#cc2800',   // RED — monster, damage, danger
  dangerDark:  '#440800',
  playerHp:    '#f0a030',
  monsterHp:   '#cc2800',
  logPlayer:   '#f0a030',
  logMonster:  '#cc4422',
  logSystem:   '#706080',
  timerNormal: '#f0a030',
  timerGrace:  '#cc2800',
};
```

---

## 5. System Constants Reference

All tunable game constants collected in one place. If a value appears here, this is the authoritative source. Constants marked ⚙ are being fine-tuned and should be defined as named constants in code for easy adjustment.

```javascript
// === TIMER SYSTEM ===
const MONSTER_ATTACK_DURATION_MS = 8000;       // ⚙ Monster attack animation phase (fixed)
const DEFAULT_REST_SECONDS       = 90;         // ⚙ Default rest period between sets
const DEFAULT_SET_WINDOW_SECONDS = 120;        // ⚙ Default time to perform & log a set
const GRACE_SECONDS              = 9;          // ⚙ Grace window before turn skip
// Rest and set window are both configurable per exercise and per program.
// Per-exercise values override program defaults. Program defaults override global defaults.

// === COMBAT ===
const ENRAGED_DAMAGE_MULTIPLIER  = 1.4;        // ⚙ +40% monster attack on return after defeat
const DAMAGE_VARIANCE_MIN        = 0.9;        // ±10% RNG on final damage
const DAMAGE_VARIANCE_MAX        = 1.1;
const BASE_DAMAGE_MULTIPLIER     = 25;         // effortScore * 25 = baseDamage
const INTENSITY_WEIGHT           = 0.6;        // intensity contribution to effortScore
const VOLUME_WEIGHT              = 0.4;        // volume contribution to effortScore
const COLD_START_INTENSITY        = 0.5;        // default intensity when no e1RM history exists

// === MONSTER PACING ===
const SETS_PER_MONSTER           = 3;          // ~3 sets to kill one procedural monster
const MIN_MONSTERS_PER_SESSION   = 2;          // always at least 2 monsters per session
// Monster count formula: max(MIN_MONSTERS_PER_SESSION, ceil(totalSets / SETS_PER_MONSTER))
// Last set of session ALWAYS forces a kill regardless of remaining monster HP

// === MONSTER STATS ===
// HP formula:  round((80 + rarityIdx * 60) * tierMultiplier * zoneDifficulty)
// ATK formula: round((8 + rarityIdx * 6) * tierMultiplier * zoneDifficulty)
// rarityIdx: common=0, uncommon=1, rare=2, epic=3, legendary=4
const TIER_MULTIPLIERS = { beginner: 0.7, intermediate: 1.0, advanced: 1.3 };
// Tier is set at onboarding (self-select) and auto-adjusts over time based on lift progression.
// killCount NEVER affects HP or ATK — only the seed offset for procedural generation
// Seed offset: sessionSeed + killCount * 9973

// === RARITY ===
const RARITY_WEIGHTS = [40, 30, 18, 9, 3]; // common, uncommon, rare, epic, legendary

// === ECONOMY ===
const XP_PER_SET                 = 10;
const XP_SESSION_COMPLETION      = 50;
const XP_PERSONAL_RECORD         = 15;
const XP_MONSTER_KILL_BASE       = 25;
// XP per kill: XP_MONSTER_KILL_BASE * rarityMultiplier
// rarityMultiplier: common=1, uncommon=1.5, rare=2, epic=3, legendary=5

const GOLD_PER_KILL = { common: [5,15], uncommon: [15,30], rare: [30,60], epic: [60,120], legendary: [100,250] };
// Gold range per kill by rarity — random within range
const GOLD_SESSION_COMPLETION_BASE = 10;       // + 5 per monster killed
// Session completion gold: GOLD_SESSION_COMPLETION_BASE + (monstersKilled * 5)
const GOLD_PR_BONUS              = 5;          // per personal record
const GOLD_RECOVERY_COST_PER_LEVEL = 5;        // tavern recovery: level * 5 gold

// === GRIND MODE MINI-BOSS ===
const MINI_BOSS_CHANCE           = 0.15;       // ⚙ 15% chance per monster spawn in grind mode
const MINI_BOSS_HP_MULTIPLIER    = 2.0;        // 2x normal HP
const MINI_BOSS_LOOT_TIER_BOOST  = 1;          // drops loot one rarity tier higher than normal

// === ZONE DIFFICULTY ===
const ZONE_DIFFICULTY = {
  shallow_crypts:    0.7,
  merchant_district: 1.0,
  fungal_warrens:    1.4,
  corporate_floor:   1.8,
  endless_escalator: 2.4,
  unmapped_place:    3.5,
};

// === ENGAGEMENT & RETENTION ===
const FIRST_SESSION_DAMAGE_MULTIPLIER = 1.5;   // ⚙ Hidden bonus for very first session ever
const SEALED_CRATE_CHANCE            = 0.10;   // ⚙ 10% chance end-of-session chest is sealed (opens next session)
const SESSION_MODIFIER_CHANCE        = 0.40;   // ⚙ 40% chance a random modifier applies to a session
const NOTIFICATION_IDLE_HOURS        = 48;     // ⚙ Hours before first idle notification
const TAVERN_DECAY_DAYS              = 3;      // ⚙ Days of inactivity before tavern mood shifts to 'abandoned'
const STARTING_ATTRIBUTE_POINTS      = 3;      // ⚙ Each attribute starts at 3 (endowed progress)
const ENDOWED_STORY_PROGRESS_PCT     = 8;      // ⚙ Story bar shows 8% on chapter start (endowed progress)

// === ANTI-PATTERNS — NEVER IMPLEMENT ===
// NO daily streaks — streaks create anxiety, not motivation
// NO XP decay or gold tax for inactivity — never punish absence
// NO daily login bonuses or FOMO mechanics — reward presence, don't punish absence
// NO mandatory daily engagement — the app pulls with curiosity, never pushes with guilt
```

---

## 6. Phase Completion Status

| Phase | Status | Deliverable |
|---|---|---|
| 1 | ✅ COMPLETE | Combat loop working on device |
| 2 | 🔨 IN PROGRESS | Visual overhaul + sprite renderer |
| 3 | ⬜ NEXT | Bug fixes + monster generation + Tavern screen |
| 4 | ⬜ | Inventory, gear, gold economy, tavern shop |
| 5 | ⬜ | Season 1 authored narrative + story structure |
| 6 | ⬜ | Grind Mode zones |
| 7 | ⬜ | LLM program builder + program library |
| 8 | ⬜ | Character sheet UI + skill system |
| 9 | ⬜ | Monetization + season pass system |
| 10 | ⬜ | Party system + real-time multiplayer |

---

## 7. What Is Built (Phase 1 — Complete)

### Combat Engine (`src/engine/combat.js`)
- `calculateDamage({ weight, reps, bestE1RM, targetReps })` — relative intensity normalization
- `calcE1RM(weight, reps)` — estimated 1 rep max via Epley formula: `weight * (1 + reps/30)`
- `getExerciseMax(exerciseId, workoutLog)` — scans AsyncStorage history for best e1RM per exercise
- `checkPersonalRecord(exerciseId, weight, reps, workoutLog)` — returns true if current set beats best ever e1RM
- PR hits = intensity > 1.0 = bonus damage (natural crit system, no special mechanic needed)
- Same relative effort = same damage regardless of absolute weight (fairness principle)
- No tier multiplier on damage — tier affects monster HP scaling only
- Cold start: when no e1RM history exists for an exercise, intensity defaults to 0.5

### Turn Timer (`src/engine/timer.js`)
- Singleton `CombatTimer` object
- `start(seconds, { onTick, onGraceStart, onSkip })` — callback-based
- `pause()` / `resume()` / `clear()`
- Immediate first tick on start so UI shows full seconds at t=0
- Grace window: GRACE_SECONDS (9) after set window expires
- Safe to call clear() multiple times

### Combat Store (`src/store/combatStore.js`)
- Zustand store: monsterHp, monsterMaxHp, monsterEnraged, monsterAttackDamage
- playerHp, playerMaxHp, playerTier
- currentSetIndex, timerSeconds, timerActive, timeoutCardUsed
- lastPlayerDamage, lastMonsterDamage (for damage number display)
- combatLog array: `{ turn, actor, damage, text }`
- phase: `'idle' | 'monster_attack' | 'rest' | 'set_window' | 'grace' | 'monster_slain' | 'defeated' | 'victory'`
- monsterKillCount (multi-monster sessions)
- Actions: initCombat, logSet, skipTurn, monsterAttack, beginRest, beginSetWindow, respawnMonster, resetCombat, appendLog

### Announcer (`src/data/announcer.js`)
- DCC tone line pools: playerHit, monsterHit, skippedTurn, personalRecord, defeat, enragedReturn, victory, forcedKill
- Random pick per event type

### Multi-Monster Sessions
- Monster count per session: `max(2, ceil(totalSets / 3))`
- Monster HP hits 0 mid-session → `phase: 'monster_slain'` → 1500ms kill screen → respawn next monster
- Next monster seed: `sessionSeed + killCount * 9973` (prime offset, reproducible)
- Last set of session forces kill regardless of remaining monster HP — every session ends with a kill
- `monsterKillCount` increments per kill

### Defeat & Return
- Player HP hits 0 → `phase: 'defeated'` → navigate to tavern recovery screen
- Monster HP persisted to AsyncStorage at exact moment of defeat
- On return: monster HP restored, `monsterEnraged: true`, +40% attack damage (permanent for fight)
- Announcer taunts on re-entry
- Workout set state survives defeat — logged sets, weights, reps all intact on return

### Audio (`src/engine/audio.js`)
- Singleton `AudioManager` using expo-audio
- `playTrack(name)`, `pauseTrack()`, `resumeTrack()`, `stopTrack()`, `setMuted(bool)`, `setVolume(0-1)`
- TRACKS registry: `intro` (active), `tavern` (null), `boss` (null)
- Mute state persists via AsyncStorage key `iq_muted`
- Music pauses entering combat, resumes returning to tavern

### Program Data (`src/data.js`)
- A/B workout split (Session A: Push, Session B: Pull)
- Each exercise: `{ id, name, equipment, sets, targetReps, restSeconds, setWindowSeconds, attribute }`
- `restSeconds` drives the rest phase timer (default 90)
- `setWindowSeconds` drives the attack/set window timer (default 120)
- `attribute`: Strength / Stamina / Agility / Endurance / Vitality
- `buildInitialSets()`, `loadWorkoutLog()`, `saveWorkoutLog()`, `getNextSession()`

---

## 8. What Is Built (Phase 2 — In Progress)

### Splash Screen (`screens/SplashScreen.js`)
- "IRON QUEST" amber title, dark background
- "ENTER THE DUNGEON" button
- Mute toggle top-right

### Visual Overhaul
- Global amber/dark palette applied across screens
- Monospace font throughout
- Phase banners: amber YOUR TURN, red MONSTER ATTACKING, flashing red GRACE
- HP bars: amber (player), red (monster)
- One-set-at-a-time combat UI
- Combat log: last 3-4 lines, color-coded by actor

### Monster Sprite (`renderer/MonsterSprite.js`)
- View-based pixel art renderer — zero native dependencies
- Five archetypes: humanoid, beast, aberration, construct, swarm
- Five rarity tiers: common through legendary
- Each archetype has full palette set per rarity
- `enraged` prop applies red tint via `tintRed()` helper
- 12×14 pixel grid at 8px per pixel = 96×112 display pixels

---

## 9. Damage Calculation — Complete Reference

The damage formula is implemented and verified in `src/engine/combat.js`. Do not modify this algorithm.

### Step-by-Step Breakdown

```javascript
// STEP 1: Estimated 1-Rep Max (Epley Formula)
// Converts any weight×reps combination into a single comparable number.
e1RM = weight * (1 + reps / 30)

// STEP 2: Intensity Score (60% of effort)
// Compares this set's e1RM against the player's all-time best for this exercise.
// getExerciseMax() scans AsyncStorage workout logs for the highest historical e1RM.
// COLD START: If no history exists for this exercise, intensity defaults to 0.5.
intensity = currentE1RM / bestE1RM

// STEP 3: Volume Score (40% of effort)
// Compares reps completed against the programmed target reps.
volumeRatio = reps / targetReps

// STEP 4: Effort Score → Base Damage
effortScore = (intensity * 0.60) + (volumeRatio * 0.40)
baseDamage = round(effortScore * 25)

// STEP 5: Personal Record Detection
// Because intensity is NOT capped at 1.0, setting a new PR (beating your best e1RM)
// makes intensity > 1.0, which naturally inflates effortScore and produces bonus damage.
// No special crit mechanic needed — PRs are crits by math alone.

// STEP 6: RNG Variance (±10%)
variance = 0.9 + (random() * 0.2)
finalDamage = max(1, round(baseDamage * variance))
```

### Fairness Principle
A beginner lifting 20 lbs at 80% of their max deals the SAME damage as an advanced lifter moving 200 lbs at 80% of their max. Damage is proportional to relative effort, never absolute weight. User tier affects monster HP, not player damage. This is the core design principle — do not add tier multipliers to damage.

### Exercise Max Initialization
The app infers exercise maxes over time. On the player's very first set of any exercise, intensity defaults to 0.5. As the player logs more sets, `getExerciseMax()` finds the best historical e1RM and intensity becomes accurate. No onboarding max-entry screen is needed.

---

## 10. Turn Flow — Complete 5-Phase Reference

The turn cycle has five distinct phases. This is the corrected flow — rest time and set time are separate phases.

```
SESSION START
  Monster spawns → phase: 'set_window' (first turn has no preceding rest)
  ↓
PHASE 1 — SET WINDOW (player performs their set)
  Duration: exercise.setWindowSeconds ?? DEFAULT_SET_WINDOW_SECONDS (120s)
  Amber timer bar drains. Banner: "YOUR TURN — Ns"
  Player enters weight + reps and taps checkmark to log set.
  Player CAN log at any point during this phase.
  ↓
  → If player logs set: calculateDamage() → monster HP decreases → damage tier
                         → announcer line → proceed to PHASE 2
  → If timer expires without logging: proceed to PHASE 3 (GRACE)
  ↓
PHASE 2 — MONSTER ATTACK (fixed animation)
  Duration: MONSTER_ATTACK_DURATION_MS (8 seconds, fixed)
  Red timer bar fills. Banner: "MONSTER ATTACKING"
  Monster deals damage to player HP. Animation plays.
  No player input required or accepted.
  ↓
  → When animation completes: proceed to PHASE 4 (REST)
  → Special: if playerHp ≤ 0 → phase: 'defeated' → tavern recovery screen
  ↓
PHASE 3 — GRACE WINDOW (missed set window)
  Duration: GRACE_SECONDS (9 seconds, static, never variable)
  Red timer bar drains fast. Banner: "⚠ ATTACK NOW — 9s" (flashing)
  Player can still log set for reduced damage.
  ↓
  → If player logs during grace: reduced damage, proceed to PHASE 2
  → If grace expires: skipTurn() → monster bonus attack → proceed to PHASE 4
  ↓
PHASE 4 — REST PERIOD (player rests between sets)
  Duration: exercise.restSeconds ?? DEFAULT_REST_SECONDS (90s)
  Amber/dim timer bar. Banner: "REST — Ns"
  THIS IS THE PLAYER'S ACTUAL REST BETWEEN SETS.
  Player CAN log their next set early during this phase to skip ahead.
  ↓
  → If player logs set early: skip remaining rest → calculateDamage()
                               → proceed to PHASE 2
  → If timer expires naturally: proceed to PHASE 1 (next SET WINDOW)
  ↓
PHASE 1 — SET WINDOW (loop repeats)

SPECIAL STATES:
  monsterHp ≤ 0, sets remain → phase: 'monster_slain' → 1500ms kill screen
                               → respawnMonster() → PHASE 1
  Last set of session logged  → forced kill regardless of monster HP
                               → phase: 'victory'
  playerHp ≤ 0               → phase: 'defeated' → persist monster state
                               → navigate to tavern recovery screen

EDGE CASE RULES:
  Killing blow during grace   → Kill takes priority. Monster attack phase is SKIPPED.
                               → Player deals reduced grace damage, but if it kills, monster dies.
                               → No retaliatory attack fires. Proceed to monster_slain or victory.
  Session completion          → On phase: 'victory', immediately persist iq_last_session_date
                               → Tavern mood resets even if player hard-quits before seeing tavern
  Gold cost before Phase 4    → Recovery is FREE until gold economy is implemented.
                               → Display "Recovery fee: ⬡ 0 (complimentary)" in tavern recovery screen.
```

### Timer Configuration Hierarchy
Both `restSeconds` and `setWindowSeconds` follow the same override chain:
1. Per-exercise value (if defined in the exercise object)
2. Program-level default (if defined in the program JSON)
3. Global default (`DEFAULT_REST_SECONDS = 90`, `DEFAULT_SET_WINDOW_SECONDS = 120`)

### Phase State Machine
```
'idle' → 'set_window' → 'monster_attack' → 'rest' → 'set_window' (loop)
                      ↘ 'grace' → 'monster_attack' → 'rest' → 'set_window'
                                ↘ 'monster_attack' (skip) → 'rest' → 'set_window'

Special exits from any combat phase:
  → 'monster_slain' → 'set_window' (respawn)
  → 'defeated' → tavern
  → 'victory' → session end
```

### Timeout Card
One per session. Can be used during any timed phase. Pauses the active timer completely with no penalty. The monster waits. The announcer says something impatient. Cannot be saved between sessions. Does not replenish mid-session.

---

## 11. Monster Defeat & Return — Complete Reference

### On Defeat (playerHp ≤ 0)
1. `phase: 'defeated'`
2. Short defeat animation and announcer flavor text
3. Save monster state to AsyncStorage: `{ hp: monsterHp, enraged: true, attackDamage: monsterAttackDamage * ENRAGED_DAMAGE_MULTIPLIER }`
4. Workout set state preserved — all logged sets, weights, reps survive defeat
5. Navigate to **tavern recovery screen**

### Tavern Recovery Screen
Dedicated screen shown after defeat. NOT the normal tavern. Contains:
- Defeat message and announcer commentary
- Current monster HP display ("The [monster name] waits at [X]% HP")
- Gold cost to recover: `playerLevel * 5` gold, deducted automatically
- Optional: use a Questionable Health Tonic (if owned) to restore HP before re-entry
- "RETURN TO DUNGEON" button — loads saved monster state and resumes session
- "ABANDON SESSION" button — forfeits session, retains all XP/gold/loot earned before defeat

### On Return to Dungeon
1. Load persisted monster state — HP exactly where it was, no regeneration
2. `monsterEnraged: true` — permanent for remainder of this fight
3. `monsterAttackDamage *= ENRAGED_DAMAGE_MULTIPLIER` (1.4x) — permanent +40% damage
4. Monster sprite shows enraged visual state (red tint via `tintRed()`)
5. Announcer delivers enraged taunt on entry
6. Session resumes at PHASE 1 (SET WINDOW)

### The Comeback Narrative
The defeat-and-return loop is a story beat, not a failure state. The player wounded the monster before losing. They came back. The monster is hurt and furious. Beating it now means something. This is DCC energy — the dungeon is absurd and punishing but never unfair.

---

## 12. Onboarding & User Tier System

### Onboarding Flow
1. Splash screen → "ENTER THE DUNGEON"
2. **Tier selection screen**: Player self-selects Beginner / Intermediate / Advanced
   - Brief description per tier: "New to lifting or < 6 months", "6 months to 2 years consistent", "2+ years, know your maxes"
   - This selection affects monster HP and ATK scaling only (see Section 5 for multipliers)
3. Program selection (or use default A/B split)
4. First session begins — exercise maxes cold-start at intensity 0.5

### Tier Auto-Adjustment
After onboarding, the app tracks lifting progression over time. Tier auto-adjusts based on average intensity scores across sessions. Implementation is deferred — for now, tier is set at onboarding and can be manually changed in settings. The tier field exists in the combat store as `playerTier`.

---

## 13. Session Pacing — Monster Count

Monster count per session is determined by the total number of sets in the player's workout:

```javascript
const monsterCount = Math.max(MIN_MONSTERS_PER_SESSION, Math.ceil(totalSets / SETS_PER_MONSTER));
// MIN_MONSTERS_PER_SESSION = 2
// SETS_PER_MONSTER = 3

// Examples:
//  5 sets → max(2, ceil(5/3)) = max(2, 2) = 2 monsters
// 10 sets → max(2, ceil(10/3)) = max(2, 4) = 4 monsters
// 18 sets → max(2, ceil(18/3)) = max(2, 6) = 6 monsters
// 40 sets → max(2, ceil(40/3)) = max(2, 14) = 14 monsters
```

Each monster's HP is calibrated so that ~3 sets of average effort (effortScore ≈ 0.7-0.8) will defeat it. Higher effort kills faster. Lower effort means the monster survives longer but the last set of the session always forces a kill.

No boss encounters exist until Phase 5 (story mode). All pre-Phase-5 sessions are procedural monsters only.

---

## 14. Incomplete Sessions

If a user exits mid-session without completing their workout:
- Story does not advance (relevant in Phase 5+) — the session must be completed
- All XP, gold, and loot earned before exit are retained permanently
- The session can be resumed or restarted at the player's discretion
- No injury debuff, no mechanical penalty, no HP reduction on next session
- The design philosophy is to **never demotivate**. Missing a workout is its own punishment.

### Session Completion Timestamp
- `iq_last_session_date` is written to AsyncStorage the moment `phase: 'victory'` is set in combatStore — NOT when the tavern screen loads
- This ensures tavern mood decay resets correctly even if the player hard-quits after the victory screen
- `iq_sessions_completed` counter also increments at this moment

---

## 15. OPEN BUGS (Fix Before New Features)

### BUG 1 — Timer Phase Architecture Wrong
**Files:** `screens/ActiveWorkout.js`, `src/engine/timer.js`, `src/store/combatStore.js`
**Problem:** The current timer system treats rest and set time as one combined phase. The correct flow is 5 distinct phases (see Section 10). The `MONSTER_TURN_DURATION_MS` constant (15000ms) was being used for what should be the player's rest period, and `restSeconds` was being used for what should be the set window.
**Fix:** Refactor the turn system to implement the 5-phase flow:
1. SET WINDOW (player performs set, `setWindowSeconds ?? 120`)
2. MONSTER ATTACK (fixed animation, `MONSTER_ATTACK_DURATION_MS = 8000`)
3. GRACE (only if set window expired without logging, `GRACE_SECONDS = 9`)
4. REST (player's actual rest, `restSeconds ?? 90`)
5. Loop back to SET WINDOW

Update `combatStore.js` phases from `'player_turn' | 'monster_turn'` to `'set_window' | 'monster_attack' | 'rest' | 'grace'`.

Update `CombatTimer` to accept different durations per phase. The timer must handle:
- Set window: countdown from `setWindowSeconds`, triggers grace on expiry
- Monster attack: countdown from `MONSTER_ATTACK_DURATION_MS / 1000`, auto-advances to rest
- Rest: countdown from `restSeconds`, auto-advances to set window. Player can log early to skip.
- Grace: countdown from `GRACE_SECONDS` (always exactly 9), triggers skip on expiry

### BUG 2 — Grace Period Not Static / Not Triggering Skip
**File:** `src/engine/timer.js` and `screens/ActiveWorkout.js`
**Problem:** Grace period duration is variable (should always be exactly 9 seconds). When grace hits zero, turn skip is not triggering — UI just sits there flashing indefinitely.
**Fix:**
- Set `GRACE_SECONDS = 9` as a named constant in timer.js
- Verify `onSkip` callback fires when grace reaches 0
- Add `console.log('[IQ] Grace expired — calling skipTurn()')` in onSkip
- Add `console.log('[IQ] skipTurn called')` at top of skipTurn in combatStore.js
- If both logs fire but UI keeps flashing, check that skipTurn transitions phase to 'monster_attack'

---

## 16. PENDING FEATURES (Build After Bug Fixes)

### FEATURE 1 — Timed Exercise Support (Planks etc.)
**Problem:** Plank and other `noWeight` timed exercises have no timer support.
**Spec:**
- Add `timedExercise: true` and `targetSeconds: 45` to plank in data.js
- Instead of weight/reps inputs, show a large countdown timer
- "3... 2... 1... GO!" start sequence (1 second each, amber flash)
- Animated timer bar fills left to right, amber → red as time runs low
- At expiry: auto-complete set, treat as `reps = targetSeconds` for damage calc
- Player can tap "DONE" early for partial credit
- For damage calculation: `weight = 1`, `reps = secondsCompleted`, `targetReps = targetSeconds`

### FEATURE 2 — Universal Timer Bar
**Problem:** All timed phases need a visible progress bar, not just a number.
**Spec:**
- Full-width horizontal bar below phase banner
- Set window: amber bar draining left to right over setWindowSeconds
- Monster attack: red bar filling left to right over MONSTER_ATTACK_DURATION_MS
- Rest period: dim amber bar draining left to right over restSeconds
- Grace window: red bar draining rapidly over 9 seconds, flashing when < 3s remain
- Use React Native built-in Animated API — NOT Reanimated

### FEATURE 3 — Monster Injury States
**Problem:** Monster sprite looks identical at 100% HP and 1% HP.
**Spec:**
- `MonsterSprite` receives `hpPercent` prop (0-1)
- Healthy (>75% HP): Normal sprite
- Hurt (50-75% HP): Slight desaturation, scratch pixel overlay
- Wounded (25-50% HP): More desaturation, red bleed in palette
- Critical (<25% HP): Heavy red tint, Animated flicker at 400ms intervals
- Injury state is separate from enraged — can be both injured and enraged simultaneously

### FEATURE 4 — Damage Flavor Text Tiers
**Problem:** No visual feedback on hit magnitude.
**Spec:**

Damage thresholds (% of monster max HP):
- < 2% → TICKLE: small grey text, dismissive announcer
- 2-5% → BIFF: white text, brief fade
- 5-10% → HURTS: amber text, 300ms fade
- 10-18% → CRACKS: amber bold, screen edge flash, 400ms fade
- >18% → WHOOP ASS: large red/gold text, screen edge red flash, announcer goes unhinged

Announcer lines to add to announcer.js:
```javascript
ANNOUNCER.damageTickle = ["Tickle. It is not impressed.", "That happened. Technically.", "A hit. Sort of."];
ANNOUNCER.damageBiff = ["Biff. It noticed.", "Solid contact. Not stellar.", "That counted."];
ANNOUNCER.damageHurts = ["That hurt it. Good.", "Solid hit.", "It felt that one."];
ANNOUNCER.damageCracks = ["Something cracked.", "That did real damage.", "It staggered. Slightly."];
ANNOUNCER.damageWhoopAss = [
  "CRITICAL. The dungeon felt that.",
  "IT DOES WHOOP ASS THINGS TO THE MONSTER.",
  "The monster filed a complaint mid-flight. The complaint was denied.",
  "Personal record energy. The math is concerning.",
];
```

### FEATURE 5 — Cardio Integration (Experimental)
**Status:** Experimental framework — mark all cardio mapping as tunable. This is a rough model.
**Spec:**
- Timed holds (plank, wall sit): `weight = 1`, `reps = secondsHeld`, `targetReps = targetSeconds`
- Rowing/cycling: `weight = resistance setting`, `reps = calories or distance`, needs calibration
- Running: `weight = 1`, `reps = secondsRun`, `targetReps = targetSeconds`
- All cardio exercises get `attribute: "Stamina"` or `attribute: "Endurance"`
- The damage calc works unchanged — intensity still compares current e1RM to best e1RM
- Prefix all cardio-related constants with `EXPERIMENTAL_` in code

### FEATURE 6 — Session Modifiers (Random Events)
**Problem:** Every session feels structurally identical. No element of surprise.
**Spec:**
- On session start, roll against `SESSION_MODIFIER_CHANCE` (40%). If triggered, select one modifier randomly:
  - **"Double Gold Session"** — all gold drops doubled. Amber glow on gold display. Announcer: "The dungeon is feeling generous. This is not a trap. Probably."
  - **"The Monsters Are Organized"** — all monsters gain +15% HP but drop loot one rarity tier higher. Announcer: "They have a union now. This is your fault."
  - **"Restless Dungeon"** — rest phase reduced to 60% of normal duration, but XP +25%. Announcer: "The dungeon is impatient. So are you, apparently."
  - **"The Announcer Is Having A Day"** — all announcer lines replaced with extra-unhinged variants from a special `ANNOUNCER.unhinged` pool. No mechanical change.
  - **"Ghost of a Previous Adventurer"** — phantom ally deals 10% bonus damage each turn (flat addition to finalDamage). Announcer: "Someone died here. They are helping. Do not ask questions."
  - **"The Dungeon Apologizes"** — all monsters have -20% HP. Announcer: "Management received feedback. Adjustments were made. Do not get used to this."
- Modifier is announced via a full-screen interstitial overlay before the first monster spawns. Dark background, amber text: "SESSION MODIFIER: [Name]" + announcer line. Tap to dismiss or auto-dismiss after 4 seconds. This overlay appears AFTER the combat screen loads but BEFORE the first set window timer starts.
- Modifier persists for the entire session
- Store `iq_session_modifier` in AsyncStorage for the session
- Only one modifier per session, never stacked
- **Pre-Phase 4 behavior:** Modifiers that reference gold or loot (e.g., "Double Gold Session") display the announcer text and visual indicator but have no mechanical effect until the gold/loot systems exist. The modifier is still rolled and shown — it sets expectations for when the economy arrives. Code should check for the existence of the gold system before applying mathematical effects.

### FEATURE 7 — Sealed Crate (Zeigarnik Loot)
**Problem:** No between-session anticipation mechanic. Player has no reason to think about the app between workouts.
**Spec:**
- End-of-session loot chest has a `SEALED_CRATE_CHANCE` (10%) of being a "Sealed Crate" instead of opening immediately
- Sealed Crate appears on the victory screen: pixel art crate with a glowing lock, pulsing amber
- Text: "You found a SEALED CRATE. It cannot be opened until your next session. The lock appears to be... bureaucratic."
- Crate is visible in the tavern between sessions — sitting on the bar, glowing, with flavor text: "The crate is here. It is sealed. You know this. Stop looking at it."
- On next session start, before first monster: "The Sealed Crate is ready." → opens with loot reveal animation. This appears as a full-screen overlay on the combat screen, BEFORE the session modifier overlay (if any), BEFORE the first set window. Tap to dismiss after reveal.
- Sealed Crate loot is one rarity tier higher than normal end-of-session chest
- **Pre-Phase 4 behavior:** Before the loot system exists, the Sealed Crate opens to reveal bonus XP and gold (stored as numbers, displayed on open). Actual item drops are stubbed until Phase 4 item generation is built. The visual and Zeigarnik anticipation mechanic work immediately — the loot content improves once the inventory system exists.
- Store in AsyncStorage: `iq_sealed_crate: { contents: {...}, earnedDate: '...' }`

### FEATURE 8 — First Session Amplification (Endowed Progress)
**Problem:** Cold start feels weak. New players deal mediocre damage and have no sense of momentum.
**Spec:**
- First session ever (detected via `iq_sessions_completed === 0`): all damage silently multiplied by `FIRST_SESSION_DAMAGE_MULTIPLIER` (1.5x). Not shown to player.
- First monster should die satisfyingly fast. Announcer reacts: "That was... unexpectedly violent. The dungeon has taken note."
- Character sheet starts with `STARTING_ATTRIBUTE_POINTS` (3) in each attribute, not zero. "Strength: 3" feels like arriving with something. "Strength: 0" feels like being nothing.
- Story progress bar (Phase 5+) starts at `ENDOWED_STORY_PROGRESS_PCT` (8%) on chapter start, not 0%. Endowed progress.
- After first session: endowed multiplier is removed permanently. Player never knows it was there.

### FEATURE 9 — Personal Records Board
**Problem:** No persistent visibility into real-world strength gains between sessions.
**Spec:**
- New screen: `screens/PersonalRecordsScreen.js`
- Displays all-time PR (best e1RM) per exercise, with date achieved and the weight × reps that produced it
- When a PR is broken in-session, the entry flashes amber and updates with new date
- Announcer milestones for PR counts:
  - 5 PRs: "Five records. The dungeon has noticed."
  - 10 PRs: "Ten personal records. The dungeon has formally acknowledged your existence as a statistical anomaly."
  - 25 PRs: "Twenty-five. The math department filed a complaint. It was denied."
  - 50 PRs: "Fifty personal records. The dungeon recommends you stop. You will not stop."
- Accessible from tavern screen via a "RECORDS" button

### FEATURE 10 — Session Recap with Stats
**Problem:** No post-session feedback on overall performance trend.
**Spec:**
- Victory screen shows:
  - Total damage dealt this session
  - Personal best session damage (all-time)
  - Average session damage (rolling 10 sessions)
  - Monsters killed this session
  - Personal records set this session (if any)
  - Session duration
- Simple trend indicator: ▲ if this session beat average, ─ if below or within 10%. No red down arrows — a returning player should never feel punished for an off day. The numbers speak for themselves.
- No judgment text — just the numbers. The player draws their own conclusions.
- Store session stats in AsyncStorage: `iq_session_history` array

### FEATURE 11 — Final Monster Banner (Goal Gradient)
**Problem:** No signal that the workout is almost over. Player doesn't know to push harder on last exercises.
**Spec:**
- When the last monster of the session spawns, display a full-width banner: "⚔ FINAL ENCOUNTER ⚔"
- Announcer: "This is the last one. Make it count." or "Final monster. The dungeon is watching." or "One more. That's it. Unless you die. Then it's two more."
- Monster sprite gets a subtle size increase (1.15x scale) to visually signal importance
- Monster HP percentage displayed numerically alongside HP bar: "HP: 67%"
- As HP drops below 25%, the percentage text pulses red — goal gradient accelerator

### FEATURE 12 — Tavern State & Mood Decay
**Problem:** No visual consequence for absence. The tavern looks the same whether you played yesterday or two weeks ago.
**Spec:**
- Tavern mood states (expanded from Phase 3 spec):
  - **Normal** (last session < 24h ago): Warm amber lighting, full NPC roster, fire crackling
  - **Quiet** (24-48h): Slightly dimmed. One fewer NPC. Fire lower. "It's been quiet."
  - **Dusty** (48-72h): Dim lighting. Only 2 NPCs. Dust pixel overlay on surfaces. Bartender: "You're back. The cobwebs were asking about you."
  - **Abandoned** (72h+ / `TAVERN_DECAY_DAYS`): Deep dim. Only the Dog remains. Heavy dust. Fireplace cold. Sign flickering. Announcer: "The Wounded Goblin was beginning to think you weren't coming back. It was right to worry."
- Mood restores to Normal immediately after completing a session (triggered by `iq_last_session_date` update on victory, not by tavern screen mount)
- Abandoned sessions (exit mid-workout) do NOT restore tavern mood — only completed sessions count
- Mood state stored in AsyncStorage: `iq_tavern_mood`, derived from `iq_last_session_date`
- Mood affects NPC flavor text — NPCs comment on absence in DCC voice

### FEATURE 13 — Dungeon Notifications (External Triggers)
**Problem:** No external trigger to re-engage lapsed players. The app relies entirely on the player remembering to open it.
**Spec:**
- Uses `expo-notifications` for local push notifications (no server required)
- Notification schedule:
  - **Post-session hook** (8h after session): "The tavern has restocked. Phil has opinions about your last performance."
  - **Idle nudge** (48h no session): "[Monster Name] has been pacing the dungeon. It filed a complaint about your absence. The complaint was acknowledged."
  - **Sealed crate reminder** (if sealed crate waiting, 24h after earned): "The Sealed Crate is still on the bar. It is not getting any less sealed. The bartender keeps looking at it."
  - **Defeated monster taunt** (if defeated state saved, 24h after defeat): "[Monster Name] waits at [X]% HP. It has been practicing. It is worse at fighting now but more emotionally prepared."
- All notifications are in DCC voice — sardonic, never guilt-tripping, never generic
- Notifications can be disabled in settings. Mute toggle also mutes notifications.
- Never more than one notification per 24h period
- Notification tone guidelines: "You missed your workout" = WRONG. "A Slightly Damp Goblin has moved into your tavern room. It claims squatter's rights." = CORRECT.
- Store notification permissions and schedule in AsyncStorage: `iq_notifications_enabled`, `iq_last_notification_date`

### FEATURE 14 — Shareable Workout Card (Dispatch Card)
**Problem:** No way to share workout accomplishments. No organic marketing. No social proof.
**Spec:**

**The Dispatch Card** is a full pixel art scene rendered as a shareable image. It shows the player's character standing over a defeated monster, with session stats overlaid in the game's visual style.

**Visual Layout (View-based pixel art, rendered to image via `react-native-view-shot`):**
- Background: Dark dungeon floor scene (procedural, matches session zone or default dungeon)
- Center: Player character pixel sprite (basic humanoid, equipment overlay from gear if Phase 4 is built)
- Below character: Defeated monster sprite (last monster killed, desaturated/collapsed state)
- Stats overlay (monospace font, amber on dark card):
  ```
  ╔══════════════════════════════╗
  ║  DUNGEON DISPATCH            ║
  ║  ──────────────────────────  ║
  ║  SESSION: #47                ║
  ║  DURATION: 52 min            ║
  ║  MONSTERS SLAIN: 6           ║
  ║  TOTAL DAMAGE: 847           ║
  ║  ──────────────────────────  ║
  ║  EXERCISES:                  ║
  ║  Bench Press   185×6, 185×5  ║
  ║  OHP           115×8, 115×7  ║
  ║  Inc. DB Press  60×10        ║
  ║  ──────────────────────────  ║
  ║  TOTAL VOLUME: 12,450 lbs    ║
  ║  PERSONAL RECORDS: 2 🔥      ║
  ║  ──────────────────────────  ║
  ║  LEVEL 12 — DUNGEON CRAWLER  ║
  ╚══════════════════════════════╝
  ```
- Bottom strip: "IRON QUEST — THE WORKOUT IS THE COMBAT" in small monospace text + app icon
- Announcer quote at bottom in italics — random from a `ANNOUNCER.dispatchQuote` pool:
  - "The dungeon acknowledges this violence."
  - "This individual is not to be trifled with."
  - "Filed under: Concerning."
  - "The monster's family has been notified. They were unsurprised."
  - "Statistics provided by the Department of Unnecessary Force."

**Conditional elements:**
- If session had a PR: "🔥 PERSONAL RECORD" badge in amber, prominent
- If session had a legendary monster kill: Monster sprite in legendary gold palette instead of desaturated
- If player was defeated and came back: "COMEBACK VICTORY" badge in red
- If session modifier was active: Modifier name displayed ("SESSION MODIFIER: Double Gold")

**Technical implementation:**
- Use `react-native-view-shot` to capture a View hierarchy as a PNG image
- The card is a React component (`components/DispatchCard.js`) that receives session data as props
- Card dimensions: 1080×1350 (4:5 Instagram-friendly aspect ratio)
- All rendering is View-based pixel art — same system as MonsterSprite and TavernScene
- NO external image assets — everything is procedural pixel art drawn in code

**Share flow:**
1. Victory screen displays session summary
2. "DISPATCH" button (amber, prominent) at bottom of victory screen
3. Tap → card renders in a modal preview (full screen, scrollable if needed)
4. Two buttons: "SHARE" (opens native share sheet via `expo-sharing`) and "SAVE" (saves to camera roll via `expo-media-library`)
5. Share sheet includes the image + text: "Dungeon cleared. [X] monsters slain. The dungeon has concerns. #IronQuest"
6. After sharing or saving, toast: "Dispatch filed. The dungeon appreciates your transparency."
7. Dismiss modal → returns to Victory screen. Player can then navigate to Tavern normally.
8. If Phase 4 gear system is not yet built, character sprite renders as basic humanoid without equipment overlay. Equipment overlay is added automatically once Phase 4 equip system exists.

**Announcer dispatch quotes to add to announcer.js:**
```javascript
ANNOUNCER.dispatchQuote = [
  "The dungeon acknowledges this violence.",
  "This individual is not to be trifled with.",
  "Filed under: Concerning.",
  "The monster's family has been notified. They were unsurprised.",
  "Statistics provided by the Department of Unnecessary Force.",
  "The dungeon recommends you share this. For legal reasons.",
  "Performance review: Exceeds expectations. Expectations were low.",
  "This dispatch has been approved by dungeon management. Reluctantly.",
  "The announcer would like it noted that this is impressive. Off the record.",
  "Certified dungeon business. Do not fold, spindle, or ignore.",
];
```

**Dependencies:**
- `expo-sharing` — for native share sheet
- `expo-media-library` — for saving to camera roll
- `react-native-view-shot` — for rendering View to image (verify Expo Go compatibility before installing)
- If `react-native-view-shot` breaks Expo Go, fallback: render card as a static View the player screenshots manually, with "Screenshot this!" prompt

### FEATURE 15 — Kill Log (Monster History)
**Problem:** No persistent record connecting workout history to game narrative.
**Spec:**
- Accessible from tavern: "KILL LOG" button
- Scrollable list of every monster the player has ever defeated
- Each entry shows: monster name, archetype icon, rarity color, date killed, the exercise + weight × reps of the killing blow
- One-line obituary per entry in DCC voice:
  - "Bureaucratic Lich — Defeated April 12, 2026 — Bench Press, 185 lbs × 6. It had concerns. Those concerns are no longer relevant."
  - "Confused Boar — Defeated April 10, 2026 — Kettlebell Swing, 35 lbs × 15. It was confused before. Now it is deceased. Still confused."
- Kill count total displayed at top: "TOTAL KILLS: 47"
- Store in AsyncStorage: `iq_kill_log` array of `{ monsterName, archetype, rarity, date, killingBlow: { exercise, weight, reps } }`

### FEATURE 16 — Character Level Milestones
**Problem:** Leveling up has no narrative moment. It's just a number incrementing.
**Spec:**
- At milestone levels (5, 10, 15, 20, 30, 50), trigger a full-screen tavern moment:
  - Screen dims, announcer text appears center screen in large amber monospace
  - Level 5 — "The dungeon formally recognizes you as an ACTUAL THREAT. This designation carries no benefits, responsibilities, or meaning. The paperwork was filed anyway."
  - Level 10 — "DUNGEON CRAWLER. The monsters have started a support group. Attendance is mandatory. Refreshments are not provided."
  - Level 15 — "PROBLEM. The dungeon would like you to know that you are now classified as a problem. This is not a compliment. It is also not not a compliment."
  - Level 20 — "CERTIFIED MENACE. Your file has been escalated. The escalation was escalated. There are now three committees."
  - Level 30 — "THE DUNGEON HAS CONCERNS. Those concerns have been formally documented, filed, lost, found, redacted, and filed again."
  - Level 50 — "CARL (MAYBE). The dungeon neither confirms nor denies. The paperwork is classified. You are now involved."
- Tap to dismiss. Announcer: "Proceed."
- Non-milestone level-ups get a simple toast: "Level [N]. The dungeon noticed."

---

## 17. File Structure

```
/
  CLAUDE.md                    ← source of truth for all dev decisions
  App.js                       ← view switcher, audio wiring, mute state
  app.json                     ← name: "Iron Quest"
  babel.config.js              ← presets: ['babel-preset-expo'] ONLY, no plugins
  package.json
  assets/
    audio/
      intro.mp3
      tavern.mp3               ← placeholder
      boss.mp3                 ← placeholder
  src/
    data.js                    ← WORKOUTS A/B, AsyncStorage helpers
    engine/
      combat.js                ← calculateDamage, calcE1RM, getExerciseMax, checkPersonalRecord
      timer.js                 ← CombatTimer singleton, phase-aware timer
      audio.js                 ← AudioManager singleton, expo-audio
      monsterGen.js            ← Phase 3 — procedural monster generation
      itemGen.js               ← Phase 4 — procedural item generation
      sessionModifiers.js      ← Session modifier roll + definitions
      notifications.js         ← Dungeon notification scheduler (expo-notifications)
    store/
      combatStore.js           ← Zustand combat state
    data/
      announcer.js             ← ANNOUNCER line pools by event type (incl. dispatch, unhinged, milestones)
      npcs.js                  ← Phase 3 — NPC roster
  screens/
    SplashScreen.js            ← amber title, Enter button, mute toggle
    TavernScreen.js            ← Phase 3 — replaces HomeScreen.js
    TavernRecoveryScreen.js    ← Phase 3 — post-defeat recovery + re-entry
    ActiveWorkout.js           ← combat screen
    VictoryScreen.js           ← session recap, stats, share button
    HistoryScreen.js           ← session history
    WeightLogScreen.js         ← weight tracking
    PersonalRecordsScreen.js   ← all-time PRs per exercise
    KillLogScreen.js           ← monster kill history
    InventoryScreen.js         ← Phase 4 — gear, trophies, junk
    GrindModeScreen.js         ← Phase 6 — zone selection + freeplay
  renderer/
    MonsterSprite.js           ← View-based pixel art, 5 archetypes, 5 rarities
    TavernScene.js             ← Phase 3 — pixel art tavern scene
    ItemSprite.js              ← Phase 4 — item pixel art by slot + rarity
  components/
    DispatchCard.js            ← Shareable workout card (View-based, rendered to image)
    TimerBar.js                ← Universal timer bar component
    SealedCrate.js             ← Sealed crate tavern visual + open animation
```

---

## 18. Phase 3 Spec — Monster Generation + Tavern Screen

### Priority Order
1. Fix all open bugs (Section 15) — timer architecture is the big one
2. Build pending features (Section 16)
3. Monster generation engine
4. Tavern screen + tavern recovery screen

### Monster Generator (`src/engine/monsterGen.js`)

```javascript
const ARCHETYPES = ['humanoid','beast','aberration','construct','swarm'];
const RARITIES   = ['common','uncommon','rare','epic','legendary'];
const RARITY_WEIGHTS = [40,30,18,9,3];

const ADJ = ['Rotting','Pale','Furious','Confused','Slightly Damp','Cursed',
  'Sponsored','Enraged','Bureaucratic','Disgraced','Malevolent','Forgotten',
  'Caffeinated','Perpetually Annoyed','Twice-Dead','Budget','Artisanal'];

const NOUNS = {
  humanoid:   ['Accountant-Lich','Goblin Auditor','Skeleton Intern','Tax Collector','Middle Manager','Compliance Officer'],
  beast:      ['Stag','Hound','Toad','Boar','Crow','Badger','Elk','Rat'],
  aberration: ['Eyeball Cluster','Void Tendril','Meat Cloud','Concept Given Form','Noise','Brief Regret'],
  construct:  ['Vending Machine','Filing Cabinet','Broken Escalator','Automated Kiosk','Self-Checkout Lane'],
  swarm:      ['Disappointed Pigeons','Angry Receipts','Filing Errors','Notification Alerts','Terms and Conditions'],
};

// HP formula: round((80 + rarityIdx * 60) * TIER_MULTIPLIERS[playerTier] * zoneDifficulty)
// ATK formula: round((8 + rarityIdx * 6) * TIER_MULTIPLIERS[playerTier] * zoneDifficulty)
// rarityIdx: common=0, uncommon=1, rare=2, epic=3, legendary=4
// TIER_MULTIPLIERS: { beginner: 0.7, intermediate: 1.0, advanced: 1.3 }
// For story mode (pre-Phase 6), use zoneDifficulty = 1.0

// killCount NEVER affects HP or ATK — only the seed offset
// Seed offset: sessionSeed + killCount * 9973
```

### Tavern Screen (`screens/TavernScreen.js`)
- Rename HomeScreen.js → TavernScreen.js
- Full pixel art tavern scene via `renderer/TavernScene.js` (View-based, no Skia)
- Elements: stone wall, wood floor, fireplace (Animated API flicker), bar counter, hanging lanterns, tables, NPC silhouettes, trophy shelf
- Trophy shelf populates as player collects trophies (Phase 4)
- NPC roster: 3-4 visible per visit, seeded daily from NPC_ROSTER
- NPC interaction: ambient flavor text displayed near their sprite. No tap interaction. No dialog trees.
- Mood states: normal / festive (after victory) / tense (after defeat) / late night
- Music: `AudioManager.playTrack('tavern')` on mount
- Gold display: top right "⬡ 0" (placeholder until Phase 4 economy)
- "THE WOUNDED GOBLIN — Tavern and Questionable Lodging" sign always visible at top
- "ENTER DUNGEON" button — starts a new session with current program
- "GRIND MODE" button — available from the start, navigates to zone selection (Phase 6)

### Tavern Recovery Screen (`screens/TavernRecoveryScreen.js`)
Shown only after defeat. Separate from the main tavern.
- Defeat announcer text (random from `ANNOUNCER.defeat` pool)
- Monster status: "[Monster Name] waits at [X]% HP. It is not happy."
- Gold cost: "Recovery fee: ⬡ [level * 5]" — deducted on re-entry. **Pre-Phase 4: recovery is free. Display "Recovery fee: ⬡ 0 (complimentary)" until gold economy exists.**
- Optional consumable use (if owned): Questionable Health Tonic restores HP
- "RETURN TO DUNGEON" button — loads saved monster state, resumes session at Phase 1
- "ABANDON SESSION" button — confirmation dialog ("Abandon session? XP and gold earned so far are kept.") → return to main tavern

### NPC Roster (`src/data/npcs.js`)
```javascript
export const NPC_ROSTER = [
  { id: 'phil',      name: 'Phil (Former Lich)',            mood: 'Nursing his third ale. Seems philosophical.' },
  { id: 'bartender', name: 'The Bartender (Name Unknown)',  mood: 'Has seen everything. Comments on nothing.' },
  { id: 'elemental', name: 'Sponsored Content Elemental',   mood: 'Keeps mentioning a protein supplement.' },
  { id: 'dog',       name: 'A Dog That Should Not Be Here', mood: 'On the bar stool. No one has moved it.' },
  { id: 'manager',   name: 'Grievance Manager (Retired)',   mood: 'Filing a complaint about the ambiance.' },
  { id: 'carl',      name: 'Carl (Maybe)',                  mood: 'Refuses to confirm or deny being Carl.' },
  { id: 'human',     name: 'Extremely Normal Human',        mood: 'Suspicious. Too normal. Watch this one.' },
  { id: 'announcer', name: 'Dungeon Announcer (Off Duty)',  mood: 'Quieter than expected. Tired eyes.' },
];
```

### Music Wiring (complete in Phase 3)
```
Splash mounts    → playTrack('intro', loop)
Tap Enter        → playTrack('tavern', loop)
Start workout    → pauseTrack()
Return to tavern → resumeTrack()
Boss fight       → playTrack('boss', loop)    [Phase 5]
Return from boss → playTrack('tavern', loop)  [Phase 5]
```

---

## 19. Phase 4 Spec — Inventory, Gear & Economy

### Loot System
- Monsters drop gold + possible gear on death
- Every kill drops a trophy (proof of kill, cannot discard)
- Drop rates by rarity: common 40% item chance, uncommon 55%, rare 70%, epic 85%, legendary 100%
- Gold per kill: random within range by rarity (see GOLD_PER_KILL in Section 5)
- Grind Mode mini-bosses: drop loot one rarity tier higher than their own rarity

### Item Acquisition Sources
| Source | What Drops |
|---|---|
| Random dungeon monsters | Common/Uncommon gear, junk, gold |
| Grind Mode mini-bosses | Uncommon/Rare gear, treasures, set pieces |
| Story boss encounters (Phase 5) | Rare/Epic gear, trophy items, unique story drops |
| Grind Mode zones | Zone-appropriate loot, higher tier = higher rarity |
| End-of-session chest | Always gold + at least one item |
| Party dungeon (Phase 10) | Party-exclusive cosmetic gear, epic drops |
| Season finale (Phase 5) | Guaranteed legendary unique to that season |

### Inventory Screen (`screens/InventoryScreen.js`)
- Tabs: EQUIPPED / BAGS / TROPHIES / JUNK
- 10 equipment slots: weapon, offhand, helmet, chest, gloves, boots, belt, amulet, ring1, ring2
- No inventory cap — bottomless bag, the hoard IS the game
- Item detail modal: name, flavor text, stats, Equip / Discard buttons
- "Stuff" tab with sorting and filtering for junk/collectibles
- No "inventory full" prompts, no auto-sell, no inventory limit warnings

### Set Bonus Discovery
- Game does NOT reveal a set exists until the player finds the second piece
- On equipping a second set piece: **toast notification** appears with set name and current bonus
- All owned pieces of the discovered set are **highlighted with a glow** in the inventory screen
- Set bonus UI shows: "[Set Name] (2/3 equipped)" with bonus description

### Item Generation (`src/engine/itemGen.js`)
DCC naming conventions:
- Common: "Reinforced Leather Gloves (Left One Slightly Damp)"
- Uncommon: "The Pauldrons of Someone Named Gerald"
- Rare: "Boots That Have Seen Things"
- Epic: "Greaves of the Third Disappointment"
- Legendary: "Carl's Original Protein Shaker (Slightly Exploded) — Recovered from the Incident. The Incident is classified. You are now involved in the Incident."

Flavor text templates by rarity:
- Common: "[Item]. It exists."
- Uncommon: "[Item] of [person]. They are fine. Probably."
- Rare: "[Item]. It has been places. You can tell."
- Epic: "[Item]. The previous owner is not available for comment. This is unrelated to the item."
- Legendary: "[Item]. [3 sentences that contradict each other]"

### Equipment Stats
Available stats: strength, stamina, agility, endurance, vitality, luck, armor

Stat count by rarity: common 1, uncommon 1-2, rare 2-3, epic 3-4, legendary has unique passive ability

**Character attribute accumulation:** Completing a set tagged with `attribute: "Strength"` accumulates a Strength point on the character sheet. This is **display-only until Phase 8** (skill system). The attribute exists on the character, is visible on the character sheet, but has no mechanical combat effect until Phase 8 implements the skill tree.

### Set Bonuses (examples)
- The Bureaucrat's Regalia (3pc): +8% XP, +12% gold, passive: once per session a monster surrenders without a fight
- Gym Rat's Starter Pack (2pc): +10% damage on first set of any exercise. "Smells like determination and poor choices."
- The Incident Set (5pc): All bonuses [REDACTED] until all 5 equipped. Each piece flavor text is a redacted incident report.

### Gold Economy
**Sources:**
- Monster kills: random within GOLD_PER_KILL range by rarity
- Session completion bonus: 10 + (monstersKilled × 5) gold
- Personal record bonus: +5 gold per PR

**Sinks:**
- Tavern recovery after defeat: playerLevel × 5 gold
- Tavern shop consumables (see below)

**Display format:** "⬡ 1,247"

### Tavern Shop (added to TavernScreen in Phase 4)
- Questionable Health Tonic: 30g — restore 30 HP
- Extra Timeout Card: 50g — start next session with 2 timeout cards
- Probably Lucky Charm: 75g — +10% gold drop rate next session
- Tip the Announcer (Nothing Happens): 10g — nothing happens. The announcer acknowledges this.

### XP & Levels
- Per set: 10 XP
- Monster kill: 25 × rarityMultiplier XP (common=1, uncommon=1.5, rare=2, epic=3, legendary=5)
- Session completion bonus: 50 XP
- Personal record: 15 XP per PR
- Level-up formula: `XP required = level * 100` (Level 2 = 200 XP, Level 10 = 1000 XP, etc.)

Level titles:
| Level | Title |
|---|---|
| 1 | FRESH MEAT |
| 3 | DUNGEON CURIOUS |
| 5 | ACTUAL THREAT |
| 10 | DUNGEON CRAWLER |
| 15 | PROBLEM |
| 20 | CERTIFIED MENACE |
| 30 | THE DUNGEON HAS CONCERNS |
| 50 | CARL (MAYBE) |

---

## 20. Phase 5 Spec — Season 1 Authored Narrative

### Season Model
- 12-16 chapters per season, one chapter = one completed workout session
- Season 1: Free/bundled. Establishes world, introduces key characters, ends on cliffhanger.
- Season 2+: Paid content. ~$4.99-$9.99 per season or annual subscription.
- Character carries forward: XP, level, skills, gold persist across seasons
- Season restart option: replay with new program, character progression retained, story resets to chapter 1

### Story Progression vs Character Progression (Deliberately Decoupled)
- **Story:** Linear. One beat per completed session. All users see same chapter at same session count regardless of volume or intensity.
- **Character:** Effort-based. More sets = more XP = faster leveling. More weight = more damage = faster kills.

Someone doing 5 sets/session and someone doing 50 sets/session both finish chapter 3 after session 3. The high-volume player is just a higher level character. Narrative is the reward for consistency; character power is the reward for effort.

### Session Story Structure (Phase 5+)
Each story session has four phases:

| Phase | Description | Story Involvement |
|---|---|---|
| Opening Cutscene | 30-60 seconds authored narrative text. Sets location and objective. | Authored — advances story arc |
| Dungeon Run | Procedurally generated monster encounters. One turn per set logged. | Procedural — randomized within location |
| Boss Encounter | Final sets trigger the session boss fight. Boss is authored and story-relevant. | Authored — fixed boss tied to season chapter |
| Closing Cutscene | Loot summary, XP, story hook for next session. | Authored — advances story arc |

Story opening and closing are identical for all users in a given session. Only mid-session monster content scales to workout volume.

### Authored vs Procedural Monsters
- **Authored Story Bosses:** Fixed monsters tied to narrative. HP scales to character level via tier multiplier, but identity and lore are static.
- **Procedural Dungeon Monsters:** Generated per session within location theme using monsterGen.js. Every session is unique.

---

## 21. Phase 6 Spec — Grind Mode

### Overview
Freeplay mode outside the story campaign. No narrative, no authored beats. Pure combat and loot loop. Primary mode for players between seasons. **Available from the start — no story unlock required.**

### Zone Selection (unlocked by character level)
| Zone | Unlock Level | Flavor |
|---|---|---|
| The Shallow Crypts | 1 | Weak monsters, high junk drops. Good for learning. |
| The Merchant District (Abandoned) | 5 | Former shopkeepers and bureaucrats. Uncommon/Rare drops. |
| The Fungal Warrens | 12 | Monsters inflict weird status effects. Strong Rare/Epic drops. |
| The Corporate Sponsorship Floor | 20 | Branded monsters. Sponsor gear that does nothing mechanically. Epic drops. |
| The Endless Escalator | 30 | Monsters confused about existence. Legendary drop chance. |
| The Place That Is Not On Any Map | 50 | Endgame. Unexplained. The dungeon does not want you here. |

### Grind Mode Session Structure
- Player selects zone, begins session
- One monster encounter per set completed (same ~3 sets per monster pacing)
- **Mini-boss encounters:** 15% chance per monster spawn. Mini-bosses have 2x HP and drop loot one rarity tier higher than normal. Visually distinguished by a size increase or aura.
- Player can end the session at any time after completing at least one full exercise
- End-of-session loot chest scales to zone tier and total monsters defeated
- XP and gold scale to zone difficulty multiplier
- No story text, no authored beats — just the grind

### Grind Mode & Character Progression
Grind Mode feeds the same character sheet as story mode. XP, gold, gear drops, and attribute accumulation all apply to the persistent character. A player who exclusively grinds can become a high-level character with excellent gear. When they eventually start a story season, they will be overpowered for the early content. This is intentional and on-brand — the dungeon announcer should comment on it.

---

## 22. Phase 7 Spec — LLM Program Builder

### Custom Program Builder
Flagship feature: in-app LLM interface where player describes their goals, schedule, equipment, and experience level in natural language. LLM generates a structured program as JSON that drops directly into the app.

### Program Library (ships at launch)
Pre-built programs, no configuration required:
- Strength: 5x5, Starting Strength, StrongLifts variants
- Hypertrophy: Push/Pull/Legs, Upper/Lower splits, Arnold-style
- General Fitness: Full body 3x/week, beginner A/B splits
- Endurance hybrid: Programs integrating cardio with resistance

### Program JSON Schema
```javascript
{
  "program_name": "Push Pull Legs - Intermediate",
  "split_type": "PPL",
  "sessions_per_week": 6,
  "default_rest_seconds": 90,          // program-level default
  "default_set_window_seconds": 120,    // program-level default
  "days": [
    {
      "day": "Push",
      "exercises": [
        {
          "name": "Bench Press",
          "sets": 4,
          "reps": "6-8",
          "restSeconds": 180,            // per-exercise override (optional)
          "setWindowSeconds": 60,        // per-exercise override (optional)
          "attribute": "Strength"
        },
        {
          "name": "Overhead Press",
          "sets": 3,
          "reps": "8-10",
          "attribute": "Strength"
          // no restSeconds or setWindowSeconds → uses program defaults
        }
      ]
    }
  ]
}
```

The `attribute` field maps exercises to character stats (display-only until Phase 8). Powerlifters build Strength-heavy characters. Endurance athletes develop Stamina. Different training styles create different character archetypes.

### Program Switching
Players can freely swap programs at any time. No program locking. No mid-season restrictions. Character progression carries forward regardless of program changes.

---

## 23. Phase 8 Spec — Character Sheet UI & Skill System

### Character Sheet
Persistent character that grows across sessions and seasons.

| Attribute | Primary Source Exercise | Accumulation |
|---|---|---|
| Strength | Compound lifts: bench press, squat, deadlift, overhead press | +1 per Strength-tagged set completed |
| Stamina | High rep sets, cardio intervals, circuit training | +1 per Stamina-tagged set completed |
| Agility | Plyometrics, speed work, bodyweight movements | +1 per Agility-tagged set completed |
| Endurance | Long sets, sustained effort exercises | +1 per Endurance-tagged set completed |
| Vitality | Overall session completion rate and consistency | +1 per completed session |

**Before Phase 8:** Attributes accumulate and display on the character sheet but have NO mechanical effect on combat.
**Phase 8 implements:** Skill point allocation into active combat abilities that use attribute values.

### Skill Points
Earned per session. Allocated to active combat abilities:
- Passive damage bonuses per exercise type
- Defensive buffs (reduce monster attack damage)
- Special attacks that trigger on personal records
- Cooldown abilities that restore HP on exceptional effort

---

## 24. Phase 9 Spec — Monetization

### Revenue Streams
| Stream | Details |
|---|---|
| Season Pass | Primary revenue. Season 1 free/bundled. Season 2+ ~$4.99-$9.99 each or annual subscription. |
| Cosmetic Shop | Character appearance, weapon skins, mount cosmetics. No gameplay advantage. |
| Tavern Consumables | Most purchasable with in-game gold. Premium currency option for convenience. |
| Party Dungeon Expansions | Standalone paid dungeon packs with unique story, bosses, party loot. |

### Ethical Monetization Principles
- No paywalling the workout itself. Core exercise tracking and combat loop always free.
- No pay-to-win. Premium purchases are cosmetic or narrative only. Character power comes from actual workouts.
- No punishing non-payers with degraded experience. Free tier is fully functional.
- Story is the premium product — players pay for more narrative, not mechanical advantages.

---

## 25. Phase 10 Spec — Party System & Multiplayer

### Party System
- Parties of 2-4 players tackle special party dungeons together in real time, each from their own gym
- Each party member assigned a role/class determining turn order and exercise type
- Real-time sync across all party member apps via WebSocket (Pusher, Ably, or Azure SignalR)
- When it's a member's turn to attack, app prompts them to complete their current set
- Other party members see waiting indicator
- Countdown timer ensures no one waits indefinitely — turn passes if member takes too long
- Party members can log sets during off-turns but deal no damage until their attack turn

### Party Dungeons vs Solo Campaign
| Mode | Description |
|---|---|
| Solo Campaign | Primary story-driven experience. Seasonal narrative, authored bosses, personal progression. Always available. |
| Party Dungeon | Cooperative event content. Larger monsters scaled to party size. Separate from campaign — does not advance story. Rewards party-exclusive loot and cosmetics. |

Party dungeons are optional social events. Solo players miss nothing in the main narrative.

---

## 26. Sprite System Reference

### MonsterSprite Props
```javascript
<MonsterSprite
  archetype="humanoid"  // humanoid | beast | aberration | construct | swarm
  rarity="common"       // common | uncommon | rare | epic | legendary
  enraged={false}       // boolean — applies red tint
  hpPercent={1.0}       // 0-1 — drives injury state (Feature 3)
  pixelSize={8}         // pixels per sprite pixel, default 8
/>
```

### Monster Archetype Visual Profiles
| Archetype | Visual Profile | Example Variants |
|---|---|---|
| Humanoid | Bipedal figure with head, torso, arms, legs. Helmet and weapon overlays vary by rarity. | Goblin Auditor, Skeleton Intern, Bureaucratic Lich |
| Beast | Quadruped with snout, ears, tail. Horns added at Epic rarity. | Rotting Stag, Confused Boar, Caffeinated Badger |
| Aberration | Amorphous blob with multiple eyes. Eye count scales with rarity. | Void Tendril, Meat Cloud, Brief Regret |
| Construct | Boxy mechanical frame with visor, panel lines. Antenna at Epic+. | Broken Escalator, Automated Kiosk, Disappointed Vending Machine |
| Swarm | Cluster of small identical creatures arranged semi-randomly. | Angry Receipts, Notification Alerts, Terms and Conditions |

### Rarity Palettes
| Rarity | Palette Character |
|---|---|
| Common (Grey) | Desaturated greys and off-whites. Intentionally boring. |
| Uncommon (Green) | Cool greens or blues. Nature/frost tones. |
| Rare (Blue) | Deep blues and purples. Strong light-to-dark contrast. |
| Epic (Purple) | Rich purples, magentas, teals. High saturation. |
| Legendary (Orange) | Golds, ambers, deep reds. Subtle canvas glow overlay. |

### Injury States
- >75% HP: Normal
- 50-75% HP: Hurt — slight desaturation, scratch pixel overlay
- 25-50% HP: Wounded — more desaturation, red bleed in palette
- <25% HP: Critical — heavy red tint, Animated flicker at 400ms intervals
- Injury state is independent of enraged state — can be both

### tintRed Helper
```javascript
function tintRed(hex) {
  const r = Math.min(255, parseInt(hex.slice(1,3), 16) + 60);
  const g = Math.max(0,   parseInt(hex.slice(3,5), 16) - 30);
  const b = Math.max(0,   parseInt(hex.slice(5,7), 16) - 30);
  return `rgb(${r},${g},${b})`;
}
```

### Item Sprite System (Phase 4)
Item sprites use the same View-based pixel compositor as monsters. Each equipment slot has a distinct silhouette:
| Slot | Silhouette |
|---|---|
| Weapon | Vertical blade with crossguard. Gem at pommel for Epic+. |
| Helmet | Dome with visor cutout. Crown extension for Legendary. |
| Chest | Rectangular torso plate with shoulder straps. |
| Boots | L-shaped foot profile with ankle guard. |
| Ring | Circular band with center hole. Gem cluster for Rare+. |
| Junk/Collectible | Randomized: spoon, coin, trophy, or rock. Intentionally mundane. |

Rarity palettes apply identically to monster and item sprites for visual consistency.

### Tavern Scene Renderer (`renderer/TavernScene.js`)
View-based pixel art scene. NOT a static image. Every element drawn in code, updates dynamically:
- Stone wall + wood floor patterns
- Fireplace with Animated API warm flicker
- Bar counter, hanging lanterns, tables
- NPC silhouettes with ambient flavor text (no interaction)
- Trophy shelf (populates as trophies are collected in Phase 4)
- Mood color overlays: normal (warm amber) / festive (bright yellow, after victory) / tense (deep purple, after defeat) / late night (dimmed)
- "THE WOUNDED GOBLIN — Tavern and Questionable Lodging" sign at top

---

## 27. Announcer Voice Reference

DCC tone — sardonic, dry, slightly hostile, occasionally unhinged. The dungeon is aware of itself. The announcer is a character, not a system notification.

**Current pools:**
- `playerHit` — player damages monster
- `monsterHit` — monster damages player
- `skippedTurn` — player misses attack window
- `personalRecord` — new e1RM record set
- `defeat` — player HP hits zero
- `enragedReturn` — player comes back after defeat
- `victory` — all monsters defeated
- `forcedKill` — monster dies on last rep regardless of HP

**To add (Feature 4 — Damage Tiers):**
- `damageTickle` / `damageBiff` / `damageHurts` / `damageCracks` / `damageWhoopAss`

**To add (Engagement Features):**
- `dispatchQuote` — sardonic one-liners for the shareable Dispatch Card (Feature 14)
- `unhinged` — extra-unhinged variants for the "Announcer Is Having A Day" session modifier (Feature 6)
- `sealedCrate` — flavor text for sealed crate in tavern and on open
- `prMilestone` — milestone commentary at 5, 10, 25, 50 PRs (Feature 9)
- `levelMilestone` — full-screen authored text at levels 5, 10, 15, 20, 30, 50 (Feature 16)
- `notification` — DCC-voice push notification text (Feature 13)
- `tavernDecay` — NPC and announcer comments on player absence (Feature 12)
- `finalMonster` — announcer lines for the last monster of a session (Feature 11)

**Tone guidelines for new announcer lines:**
- First person, direct address — the dungeon is talking to YOU
- Short and punchy — 1-2 sentences max
- Never cruel, never discouraging — sardonic but ultimately on the player's side
- Absurdist references to dungeon bureaucracy, complaints, paperwork, regulations
- The dungeon treats apocalyptic events as mildly inconvenient
- Tutorial text is self-aware: "Yes, this is a tutorial. No, we will not apologize for it."

---

## 28. Gear & Item Naming Convention

All gear follows DCC naming convention. This is a core differentiator — do not make items sound generic.

| Rarity | Naming Pattern | Example |
|---|---|---|
| Common | Descriptive + one odd detail | "Reinforced Leather Gloves (Left One Slightly Damp)" |
| Uncommon | Proper name implying history | "The Pauldrons of Someone Named Gerald" |
| Rare | Active voice, item has opinions | "Boots That Have Seen Things" |
| Epic | References unexplained in-world event | "Greaves of the Third Disappointment" |
| Legendary | Named artifact + self-contradicting lore | "Carl's Original Protein Shaker (Slightly Exploded)" |

### Junk, Treasures & Collectibles
A significant portion of drops are intentionally useless — but collectible. No stat value, cannot be equipped. Exist to be hoarded and to have unhinged descriptions.
- **Junk:** "A Slightly Bent Spoon", "Someone Else's Grocery List", "A Rock That Looks Like Another Rock"
- **Treasures:** High gold value. "A Coin Depicting a King Who Officially Never Existed"
- **Collectibles:** Season-specific rare drops. "Season 1 Commemorative Participation Trophy (You Did Not Win Anything)"
- **Trophies:** Boss/kill drops. Displayed in tavern. Cannot be sold, traded, or discarded.

---

## 29. Procedural Graphics Philosophy

All in-game visuals are procedural View-based pixel art. Zero hand-drawn assets. Zero AI image generation. Every pixel drawn by code at runtime from entity properties.

**Why this matters:**
- Zero per-render cost (no API calls, no token costs)
- Perfectly consistent art style across all entities
- Instant render, no network latency, fully offline capable
- Deterministic: same seed = same sprite, always
- Status states (enraged, wounded) are trivially animatable
- Full creative control over aesthetic
- Works in any gym with no signal

**The only exception:** One-time authored assets like season cover art or promotional images may use external art. All runtime game graphics are procedural, always.

**Implementation constraints:**
- View-based pixel art ONLY — no Canvas, no Skia, no Reanimated
- Pixel scale: 8px per sprite pixel for monsters (12×14 logical = 96×112 rendered)
- Item sprites: smaller logical grid, same pixel scale
- All color via inline styles on View elements
- Animated API for simple animations (flicker, pulse, fade)

---

## 30. Technical Architecture (Future Vision)

| Component | Technology | Notes |
|---|---|---|
| Procedural Sprite Renderer | View-based pixel art (React Native) | Deterministic seeded RNG; no image files |
| Combat Engine | Client-side calculation | Server validation in Phase 10 (multiplayer) |
| Turn Timer | 5-phase state machine, client-side | Must survive phone lock screen; push notification fallback TBD |
| Monster State Persistence | AsyncStorage (monster HP snapshot on defeat) | Enraged status survives app close |
| Monster Generator | Template-based name/stat generation | LLM descriptions can be pre-generated and cached |
| Inventory System | AsyncStorage (Phase 4), server-side (Phase 9+) | No inventory cap = unbounded growth |
| Loot Tables | JSON config per zone, monster type, rarity | Content-configurable without code changes |
| Program Builder | In-app LLM chat → structured JSON | Phase 7 |
| Grind Mode Zones | Zone config, same combat engine, no narrative | Zone unlock by character level |
| Party Sync | WebSocket (Pusher/Ably/Azure SignalR) | Phase 10 |
| Story Content | CMS-managed (Contentful or Sanity) | Phase 5+ — non-developer authoring |
| Character Persistence | AsyncStorage with cloud sync (future) | Character data must never be lost |

### MVP Build Order
1. Fix timer architecture (Section 15 bugs)
2. Build pending features (Section 16)
3. Phase 3: Monster generation + Tavern + Recovery screen
4. Phase 4: Inventory + Gear + Gold economy
5. Phase 5: Season 1 narrative
6. Phase 6: Grind Mode
7. Phase 7: LLM program builder
8. Phase 8: Character sheet + skills
9. Phase 9: Monetization
10. Phase 10: Party multiplayer

---

## 31. Engagement Psychology — Design Principles

Iron Quest's retention strategy is grounded in four research-backed frameworks. Every engagement feature references these principles. An agent building features should understand WHY each mechanic exists, not just WHAT it does.

### Framework 1: Variable Ratio Reinforcement (B.F. Skinner)
Rewards delivered after an unpredictable number of actions produce the highest sustained engagement. Predictable rewards (every 10th action) cause engagement to drop after the reward and spike before it. Unpredictable rewards maintain constant engagement because the next action might be the one that pays off.

**How Iron Quest uses this:**
- Loot drops are randomized by rarity weights — every monster kill MIGHT drop Epic gear
- Session modifiers (Feature 6) randomize the combat experience itself — the session structure is unpredictable
- Sealed Crates (Feature 7) add anticipation between sessions with unknown contents
- PR-as-crit: the player never knows exactly when they'll hit a new personal record, but when they do, damage explodes

### Framework 2: Self-Determination Theory / SDT (Ryan & Deci)
Long-term intrinsic motivation comes from three psychological needs:
- **Autonomy** — "I choose what I do." Player picks their program, their exercises, their rest times. No mandatory daily quests.
- **Competence** — "I can see myself getting better." The damage formula rewards effort proportionally. PRs are visible and celebrated. The Personal Records Board (Feature 9) and Session Recap (Feature 10) make progress concrete.
- **Relatedness** — "I'm part of something." The DCC world creates emotional attachment. The Dispatch Card (Feature 14) connects to real people. Party mode (Phase 10) creates social accountability.

**Critical:** SDT research shows that controlling external motivators (streaks, loss penalties, FOMO) UNDERMINE intrinsic motivation over time. Iron Quest must NEVER use these. See Anti-Patterns below.

### Framework 3: The Hook Model (Nir Eyal)
Habit formation works through a four-step loop:
1. **Trigger** — What prompts the player to open the app? Dungeon Notifications (Feature 13) are external triggers. Over time, the internal trigger becomes "I need to work out" → Iron Quest is the first-to-mind solution.
2. **Action** — The minimum behavior to get the reward. In Iron Quest: log one set. The combat system makes this effortless and immediately rewarding.
3. **Variable Reward** — The unpredictable payoff. Loot drops, session modifiers, damage variance, announcer lines — every session delivers different rewards.
4. **Investment** — The player puts something into the product that makes it more valuable next time. The character (level, stats, gear), the kill log, the PR board, the inventory hoard. Leaving Iron Quest means losing a character that reflects months of real physical effort.

### Framework 4: Endowed Progress + Goal Gradient + Zeigarnik Effect
Three related effects that create "just one more set" compulsion:
- **Endowed Progress** (Nunes & Dreze): People work harder toward goals they feel they've already started. Iron Quest starts characters with 3 attribute points, story progress at 8%, and amplifies first-session damage (Feature 8).
- **Goal Gradient** (Hull): People accelerate effort as they approach a goal. The Final Monster Banner (Feature 11) signals the end is near, and showing monster HP as a percentage creates visible proximity to the kill.
- **Zeigarnik Effect** (Zeigarnik): People can't stop thinking about unfinished tasks. The defeat-and-return mechanic, Sealed Crates, story cliffhangers (Phase 5+), and mid-session exit notifications all create open loops that pull the player back.

### Anti-Patterns — NEVER Implement
These mechanics are common in mobile games but actively harm Iron Quest's design goals. SDT research shows they undermine intrinsic motivation:

- **NO daily streaks.** Streaks create anxiety, not motivation. Missing one day breaks the streak, creating shame and often causing the player to quit entirely. Track "sessions this week" without penalizing gaps.
- **NO XP decay or gold tax for inactivity.** Never punish absence. The punishment for not working out is not working out.
- **NO daily login bonuses.** Rewards that require showing up every day create obligation, not desire. Iron Quest rewards you when you show up, not punishes you when you don't.
- **NO FOMO mechanics.** No time-limited events that disappear if you miss them. No "you missed a special monster!" guilt. Session modifiers are random but always-available — there's always another session.
- **NO guilt-tripping notifications.** "You haven't worked out in 3 days!" kills the fantasy and creates negative association. "A Slightly Damp Goblin has moved into your tavern room. It claims squatter's rights." makes you smile and tap.
- **NO mandatory engagement.** The app pulls you back with curiosity and anticipation, never pushes you with obligation.

The core philosophy: **Iron Quest makes you WANT to come back. It never makes you AFRAID to leave.**

---

## 32. Open Design Questions

These items require further design decisions. An agent should NOT attempt to resolve these — implement them as configurable or skip them and leave a TODO comment.

- **Background Timer:** How does the turn timer behave when the app is backgrounded on iOS vs Android? Push notification as fallback? Airplane mode in a gym dead zone?
- **Enraged Damage Scaling:** Should the enraged multiplier (currently 1.4x) scale with number of times defeated by the same monster?
- **Timeout Card Replenishment:** Should the card replenish for very long sessions (90+ minutes)?
- **Sprite Animation Depth:** Flame flicker and aura pulse are trivial. Full idle animation per archetype adds complexity. Where is the MVP line?
- **Tavern Customization:** Can players arrange trophy displays or decorate their tavern room? Or always auto-generated from game state?
- **Inventory Storage Scaling:** Long-term players accumulate thousands of items. What is the archiving strategy?
- **Gear Trading:** Can party members trade gear? Player economy adds depth but introduces balance risks.
- **Grind Mode Seasonal Tie-ins:** Should zones ever reference story events or stay story-agnostic?
- **Accessibility:** How does the damage algorithm handle users with physical limitations who cannot perform standard rep/weight progressions?
- **Seasonal Content Cadence:** How frequently should new seasons release? What is the DCC-voice writing pipeline?
- **Dispatch Card Expo Go Compatibility:** Does `react-native-view-shot` work in Expo Go? If not, fallback to screenshot prompt.
- **Notification Frequency Tuning:** Is one notification per 24h the right cap? Should it vary by player engagement level?
- **Session Modifier Balance:** Do modifiers like -20% monster HP make sessions too easy? Needs playtesting.

---

## 33. Handoff Notes for AI Agent

If you are an AI agent taking over this project, read this section carefully.

### What works well — do not touch:
- Damage calculation algorithm in `src/engine/combat.js` — verified correct, fairness principle holds
- e1RM personal record system — working as a natural crit mechanic
- Multi-monster session flow — kill count seeding with prime offset is correct
- AsyncStorage persistence for workout logs
- View-based MonsterSprite architecture — do not replace with Skia or Canvas

### What is broken — fix first:
- Timer architecture needs refactoring to 5-phase system (see Section 15, BUG 1)
- Grace period not static and not triggering skip (see Section 15, BUG 2)
- These bugs MUST be fixed before any new features

### What to build next (in order):
1. Bug fixes (Section 15) — timer architecture refactor + grace period fix
2. Features 1-5 (Section 16) — timed exercise, timer bar, injury states, damage tiers, cardio framework
3. Pre-tavern engagement features (no screen dependency): Features 6 (session modifiers), 8 (first session amp), 10 (session recap / victory screen), 11 (final monster banner)
4. Phase 3 core: Monster generation (`monsterGen.js`) + Tavern screen + Tavern recovery screen
5. Post-tavern engagement features (require tavern): Features 7 (sealed crate), 9 (PR board), 12 (tavern decay), 15 (kill log), 16 (level milestones)
6. External-dependency engagement features (Expo Go risk): Features 13 (notifications via `expo-notifications`), 14 (dispatch card via `react-native-view-shot` + `expo-sharing`)
7. Phase 4: Inventory + gear + gold economy + tavern shop
8. Phases 5-10 in order

### Critical constraints — NEVER violate:
- NO `react-native-reanimated` — breaks Expo Go
- NO `@shopify/react-native-skia` — breaks Expo Go
- NO `expo-av` — deprecated in SDK 54, use `expo-audio`
- NO Canvas, no SVG libraries — all sprites are View-based pixel art
- NO daily streaks, NO login bonuses, NO XP decay, NO FOMO mechanics — see Section 31 Anti-Patterns
- `babel.config.js` must have ONLY `presets: ['babel-preset-expo']` — no plugins array
- AsyncStorage keys all prefixed `iq_`
- `console.log` all prefixed `[IQ]`
- Monospace font everywhere, no exceptions
- The workout IS the combat — never treat them as separate systems
- All tunable constants must be defined as named constants (see Section 5), never magic numbers inline
- All system constants marked ⚙ are being fine-tuned — make them easy to change
- All notification text must be in DCC voice — sardonic, never guilt-tripping, never generic

### The one rule:
If a feature treats exercise as a checkbox that unlocks a game reward, it is wrong. The rep is the attack. The set is the turn. The rest period is the monster's recovery. The player's rest is a separate, distinct phase.
