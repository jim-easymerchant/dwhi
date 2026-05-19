# CLAUDE.md — Iron Quest (Working Title)
> This file is the source of truth for all development decisions. Read it fully before every session. Do not deviate from the architecture, tone, or phase scope without explicit instruction.

---

## What This App Is

A mobile-first fitness RPG where **the workout IS the combat**. Every set you perform is an attack turn. Every rep and pound of weight determines damage dealt. Monsters fight back during your rest period. You can die, get sent back to the tavern, and return to a wounded, enraged monster that remembers you.

This is not a fitness app with gamification bolted on. The combat engine IS the workout tracker. They are the same thing.

**Tone:** Dungeon Crawler Carl (Matt Dinniman). Sardonic, absurdist, self-aware. The dungeon knows it's a dungeon. Monsters have opinions. Gear has unhinged lore. Nothing is played completely straight. An announcer comments on everything.

**Not:** Generic Tolkien fantasy. Not badge/streak/leaderboard gamification. Not a chatbot fitness coach.

---

## Codebase Origin

This project is a rename/rebuild of **RisingKB** — a working Expo kettlebell tracker.

**What carries forward:**
- `ActiveWorkout.js` — set logging UI, handleToggle, progress tracking. The combat screen.
- `src/data.js` — workout data structure, AsyncStorage persistence helpers
- `HomeScreen.js` — becomes the Tavern/home screen
- `HistoryScreen.js` — session history
- `App.js` — view switching logic

---

## Tech Stack — Do Not Deviate

| Layer | Choice | Reason |
|---|---|---|
| Framework | Expo SDK ~54 + React Native | Current SDK after upgrade |
| Language | JavaScript | Do not convert to TypeScript mid-project |
| Sprite rendering | **View-based pixel art only** | No Skia, no Reanimated — both cause native dependency issues in Expo Go. Colored Views render identically for pixel art with zero setup. |
| State management | Zustand | Already installed and working |
| Persistence | AsyncStorage (existing) | For all data for now. expo-sqlite deferred to Phase 4. |
| Navigation | View switching in App.js | Do not introduce React Navigation yet |
| Animations | React Native built-in Animated API only | Do NOT use react-native-reanimated. Do NOT use @shopify/react-native-skia. Both require native setup that breaks Expo Go. |

**BANNED — do not install or import:**
- `react-native-reanimated` — breaks Expo Go, not needed
- `@shopify/react-native-skia` — requires Reanimated, breaks Expo Go
- Redux, React Navigation, any AI image generation library, Firebase

**Sprite rendering rule:** All sprites are built from nested View components with backgroundColor set per pixel. A sprite is a 2D array of color indices mapped to Views. Fast, dependency-free, looks identical to Canvas pixel art on mobile.

---

## Current Phase: PHASE 2

**Phase 1 is complete.** Combat loop works: set logging → damage calculation → monster response → turn timer → grace window → defeat/return with enraged monster.

**Phase 2 Goal:** Visual overhaul + procedural sprite renderer. The app should look and feel like the Iron Quest concept — dark pixel art aesthetic with amber/orange accents.

---

## Global Visual Language

Every screen uses this palette. No exceptions.

```javascript
const C = {
  bg:          '#08080c',
  card:        '#0f0f14',
  border:      '#1e1e28',
  text:        '#e8d8b8',
  muted:       '#8878a0',
  dim:         '#504860',
  accent:      '#f0a030',   // AMBER — primary interactive color
  accentDark:  '#a06010',
  danger:      '#cc2800',   // RED — monster HP, damage, danger
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

**Typography:** fontFamily: 'monospace' everywhere. No exceptions.
**No rounded corners on game elements.** Sharp edges fit the aesthetic.

---

## Phase 2 Checklist

- [ ] Splash screen: "IRON QUEST" amber title, "ENTER THE DUNGEON" button, dark bg
- [ ] Home screen fully restyled — amber accents, DCC flavor text, no "Rising KB" anywhere
- [ ] Combat screen restyled — amber player HP, red monster HP, phase banners
- [ ] View-based MonsterSprite renders procedural pixel art in combat screen
- [ ] Monster archetype drives sprite shape, rarity drives color palette
- [ ] Enraged state = red tint on sprite
- [ ] Cancel/abandon mid-workout shows confirmation Alert (3 options)
- [ ] Rest timer uses exercise.restSeconds (default 90s)
- [ ] No native dependency errors on Expo Go Android
- [ ] babel.config.js has NO react-native-reanimated/plugin entry

**Do NOT build in Phase 2:** monster name generation, loot drops, inventory, character sheet, story/narrative.

---

## Sprite Rendering System (View-Based — NO SKIA)

```javascript
// renderer/MonsterSprite.js
// Pure Views, zero native dependencies

function tintRed(hex) {
  const r = Math.min(255, parseInt(hex.slice(1,3), 16) + 60);
  const g = Math.max(0,   parseInt(hex.slice(3,5), 16) - 30);
  const b = Math.max(0,   parseInt(hex.slice(5,7), 16) - 30);
  return `rgb(${r},${g},${b})`;
}

export default function MonsterSprite({ archetype = 'humanoid', rarity = 'common', enraged = false, pixelSize = 8 }) {
  const spriteMap = SPRITES[archetype];
  const palette = PALETTES[archetype][rarity];
  return (
    <View style={{ flexDirection: 'column' }}>
      {spriteMap.map((row, y) => (
        <View key={y} style={{ flexDirection: 'row' }}>
          {row.map((colorIdx, x) => {
            if (colorIdx === 0) return <View key={x} style={{ width: pixelSize, height: pixelSize }} />;
            let color = palette[colorIdx - 1];
            if (enraged) color = tintRed(color);
            return <View key={x} style={{ width: pixelSize, height: pixelSize, backgroundColor: color }} />;
          })}
        </View>
      ))}
    </View>
  );
}
```

### Palettes

```javascript
const PALETTES = {
  humanoid: {
    common:    ['#3a2840','#5a3860','#7a5080','#c08840','#e0b860'],
    uncommon:  ['#1a3828','#2a6040','#4a8060','#40c080','#80e0b0'],
    rare:      ['#1a1040','#3020a0','#5040c0','#8060e0','#c090ff'],
    epic:      ['#300840','#6010a0','#9030c0','#c050e0','#f080ff'],
    legendary: ['#402000','#c06000','#e08000','#ffaa00','#ffdd80'],
  },
  beast: {
    common:    ['#2a1810','#503020','#784838','#a06030','#c89060'],
    uncommon:  ['#0a2810','#185030','#287850','#40a060','#70d090'],
    rare:      ['#100828','#281860','#403890','#6050c0','#9080f0'],
    epic:      ['#280010','#600030','#980050','#d00070','#ff40a0'],
    legendary: ['#3a1800','#a04000','#d06000','#ff8800','#ffcc40'],
  },
  aberration: {
    common:    ['#181828','#282848','#383868','#505090','#7878b8'],
    uncommon:  ['#082020','#104040','#186060','#2090a0','#40c0d0'],
    rare:      ['#200820','#501050','#802080','#b030b0','#e060e0'],
    epic:      ['#080828','#101870','#2030b0','#3060f0','#60a0ff'],
    legendary: ['#1a0800','#604000','#a07000','#e0a000','#ffd040'],
  },
  construct: {
    common:    ['#181818','#303030','#484848','#909090','#c0c0c0'],
    uncommon:  ['#081828','#103050','#184878','#2878b0','#50a8e0'],
    rare:      ['#100818','#301840','#503068','#7850a0','#b080d8'],
    epic:      ['#080818','#101058','#202098','#3040d8','#6080ff'],
    legendary: ['#281000','#806000','#c09000','#ffcc00','#ffee80'],
  },
  swarm: {
    common:    ['#1a1010','#3a2020','#5a3030','#804040','#b06060'],
    uncommon:  ['#101a10','#203a20','#305a30','#408040','#60b060'],
    rare:      ['#10101a','#20203a','#30305a','#404080','#6060b0'],
    epic:      ['#1a0818','#3a1038','#5a1858','#802080','#c030c0'],
    legendary: ['#1a1000','#4a3000','#8a5000','#c07800','#ffa820'],
  },
};
```

### Sprite Maps (12x14 grids, 0=transparent)

```javascript
const SPRITES = {
  humanoid: [
    [0,0,0,1,3,3,1,0,0,0,0,0],
    [0,0,1,3,2,2,3,1,0,0,0,0],
    [0,0,1,2,4,4,2,1,0,0,0,0],
    [0,0,0,1,2,2,1,0,0,0,0,0],
    [0,1,1,1,1,1,1,1,1,0,0,0],
    [0,1,2,2,2,2,2,2,1,5,5,0],
    [1,2,1,2,2,2,2,1,2,1,5,0],
    [0,1,2,2,2,2,2,2,1,0,0,0],
    [0,0,1,2,2,2,2,1,0,0,0,0],
    [0,1,2,1,0,0,1,2,1,0,0,0],
    [0,1,2,1,0,0,1,2,1,0,0,0],
    [0,1,2,1,0,0,1,2,1,0,0,0],
    [0,1,1,2,0,0,2,1,1,0,0,0],
    [0,2,1,0,0,0,0,1,2,0,0,0],
  ],
  beast: [
    [0,0,0,0,0,0,0,0,0,0,0,0],
    [0,1,1,0,0,0,0,1,1,0,0,0],
    [1,2,2,1,0,0,1,2,2,1,0,0],
    [1,2,4,2,1,1,2,4,2,1,0,0],
    [0,1,2,2,2,2,2,2,1,0,0,0],
    [0,0,1,2,2,2,2,1,0,0,0,0],
    [1,1,1,2,2,2,2,1,1,1,0,0],
    [2,2,2,2,2,2,2,2,2,2,0,0],
    [1,1,2,2,2,2,2,2,1,1,0,0],
    [1,2,1,0,0,0,0,1,2,1,0,0],
    [1,2,1,0,0,0,0,1,2,1,0,0],
    [2,1,0,0,0,0,0,0,1,2,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0],
  ],
  aberration: [
    [0,0,1,1,0,0,1,1,0,0,0,0],
    [0,1,2,2,1,1,2,2,1,0,0,0],
    [1,2,3,2,2,2,2,3,2,1,0,0],
    [1,2,2,2,2,2,2,2,2,1,0,0],
    [0,1,2,4,2,2,4,2,1,0,1,0],
    [0,0,1,2,2,2,2,1,0,1,2,1],
    [0,1,2,2,2,2,2,2,1,2,2,1],
    [1,2,2,3,2,2,3,2,2,2,1,0],
    [1,2,2,2,2,2,2,2,2,1,0,0],
    [0,1,2,2,1,1,2,2,1,0,0,0],
    [0,0,1,1,2,2,1,1,0,0,0,0],
    [0,1,2,0,1,1,0,2,1,0,0,0],
    [1,2,0,0,0,0,0,0,2,1,0,0],
    [0,1,0,0,0,0,0,0,1,0,0,0],
  ],
  construct: [
    [0,0,1,1,1,1,1,1,0,0,0,0],
    [0,1,5,5,5,5,5,5,1,0,0,0],
    [0,1,5,4,0,0,4,5,1,0,0,0],
    [0,1,5,5,5,5,5,5,1,0,0,0],
    [1,1,1,1,1,1,1,1,1,1,0,0],
    [1,2,2,2,2,2,2,2,2,1,0,0],
    [1,2,1,2,2,2,2,1,2,1,0,0],
    [1,2,2,2,2,2,2,2,2,1,0,0],
    [0,1,1,1,1,1,1,1,1,0,0,0],
    [0,1,2,1,0,0,1,2,1,0,0,0],
    [0,1,2,1,0,0,1,2,1,0,0,0],
    [0,1,1,1,0,0,1,1,1,0,0,0],
    [0,2,1,0,0,0,0,1,2,0,0,0],
    [0,1,2,0,0,0,0,2,1,0,0,0],
  ],
  swarm: [
    [0,1,0,0,0,1,0,0,1,0,0,0],
    [1,2,1,0,1,2,1,1,2,1,0,0],
    [0,1,0,0,0,1,0,0,1,0,0,0],
    [0,0,0,1,0,0,0,0,0,1,0,0],
    [0,0,1,2,1,0,1,0,1,2,1,0],
    [0,0,0,1,0,1,2,1,0,1,0,0],
    [1,0,0,0,0,0,1,0,0,0,1,0],
    [2,1,0,1,0,0,0,0,1,0,2,1],
    [1,0,1,2,1,0,0,1,2,1,0,0],
    [0,0,0,1,0,1,0,0,1,0,0,0],
    [0,1,0,0,0,2,1,0,0,1,0,0],
    [1,2,1,0,1,1,2,1,1,2,1,0],
    [0,1,0,0,0,1,0,0,0,1,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0],
  ],
};
```

---

## Phase 3 — Monster Generation (next after Phase 2)

```javascript
// src/engine/monsterGen.js

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

const ZONE_DIFFICULTY = {
  shallow_crypts: 0.7, merchant_district: 1.0, fungal_warrens: 1.4,
  corporate_floor: 1.8, endless_escalator: 2.4, unmapped_place: 3.5,
};

function seededRNG(seed) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
}

function generateMonster({ zone = 'shallow_crypts', sessionSeed = Date.now() } = {}) {
  const rng = seededRNG(sessionSeed);
  const archetype = ARCHETYPES[Math.floor(rng() * ARCHETYPES.length)];
  const rarity = weightedPick(RARITIES, RARITY_WEIGHTS, rng);
  const name = `${ADJ[Math.floor(rng()*ADJ.length)]} ${NOUNS[archetype][Math.floor(rng()*NOUNS[archetype].length)]}`;
  const rarityIdx = RARITIES.indexOf(rarity);
  const hp = Math.round((80 + rarityIdx * 60) * ZONE_DIFFICULTY[zone]);
  const atk = Math.round((8 + rarityIdx * 6) * ZONE_DIFFICULTY[zone]);
  return { name, archetype, rarity, hp, maxHp: hp, atk, zone, seed: sessionSeed };
}
```

### Phase 3 Checklist
- [ ] monsterGen.js generates named monsters with archetype + rarity
- [ ] Combat store initializes with generated monster
- [ ] Monster name displayed in combat header
- [ ] Archetype drives MonsterSprite, rarity drives palette
- [ ] Same session seed = same monster every time
- [ ] Zone selection stub on home screen

---

## Turn Flow (current)

```
Player logs set
  → calculateDamage() → monsterHp decreases
  → phase: 'monster_turn' (MONSTER_TURN_DURATION_MS = 15000)
  → phase: 'player_turn' → CombatTimer starts (exercise.restSeconds ?? 90)
  → player logs next set OR timer expires → grace (10s)
  → grace expires → turn skipped → monster bonus attack
  → phase: 'monster_turn' → loop
```

---

## Damage Calculation (current)

```javascript
// e1RM = weight * (1 + reps/30)
// intensity = currentE1RM / bestE1RM (PR = intensity > 1.0, bonus damage)
// effortScore = intensity*0.6 + volumeRatio*0.4
// damage = round(effortScore * 25 * variance(0.9-1.1))
// No tier multiplier — same relative effort = same damage
```

---

## Announcer Lines (src/data/announcer.js)

DCC tone: sardonic, dry, slightly hostile, occasionally unhinged. Keep expanding.

playerHit, monsterHit, skippedTurn, personalRecord, defeat, enragedReturn, victory arrays.

---

## Code Style

- Functional components, no classes
- StyleSheet at bottom of file
- `const C = { ... }` at top, global palette above
- Combat logic in src/engine/ only
- AsyncStorage keys prefixed `iq_`
- Console.log prefixed `[IQ]`
- babel.config.js: `presets: ['babel-preset-expo']` ONLY, no plugins array needed

---

## Phase Completion

| Phase | Status | Deliverable |
|---|---|---|
| 1 | COMPLETE | Combat loop working |
| 2 | IN PROGRESS | Visual overhaul + View-based sprites |
| 3 | NEXT | Procedural monster generation |
| 4 | | Inventory, gear drops, equipment slots |
| 5 | | Season 1 authored narrative |
| 6 | | Grind Mode zones |
| 7 | | LLM program builder |
| 8 | | Character sheet, gold economy |
| 9 | | Party system, multiplayer |

---

## The One Rule

**The workout is the combat. They are not separate systems.** The rep is the attack. The set is the turn. The rest period is the monster's turn. Everything flows from this.

---

## Phase 3 — Monster Generation + Tavern Screen (NEXT)

**Goal:** Monsters have procedurally generated names, archetypes, and stats. The HomeScreen becomes a real Tavern with pixel art scene, NPCs, and trophy display. Music system is fully wired per screen.

### Phase 3 Checklist

**Monster Generation:**
- [ ] `src/engine/monsterGen.js` creates named monsters with archetype + rarity + seeded RNG
- [ ] Combat store initializes with generated monster, not placeholder
- [ ] Monster name displayed in combat header (e.g. "PALE GOBLIN AUDITOR")
- [ ] Monster archetype drives MonsterSprite rendering
- [ ] Monster rarity drives color palette
- [ ] Same sessionSeed always produces same monster sequence
- [ ] Second+ monsters use `sessionSeed + killCount * 9973` for seed offset
- [ ] Monster HP does NOT scale with killCount — only zone difficulty and rarity affect HP
- [ ] monsterAttackDamage resets cleanly on each new monster spawn (no bleed from enraged state)

**Bug fixes carried into Phase 3 (fix before new features):**
- [ ] Mute button sets volume to exactly 0.0 / 1.0 — not a partial reduction
- [ ] Music pauses when entering combat (`AudioManager.pauseTrack()` in App.js on setView('active'))
- [ ] Music resumes when returning to home screen
- [ ] Grace window `onSkip` callback actually fires and calls `skipTurn()` — add [IQ] log to verify
- [ ] Subsequent monsters not stronger than first — HP formula audit

**Tavern Screen (HomeScreen.js becomes TavernScreen):**
- [ ] Rename HomeScreen.js to TavernScreen.js, update App.js import
- [ ] Full pixel art tavern scene rendered using View-based compositor (same approach as MonsterSprite)
- [ ] Tavern scene elements: floor planks, stone wall, fireplace, hanging lanterns, bar counter, tables
- [ ] Dynamic lighting: amber warm glow from fireplace and candles via colored View overlays at low opacity
- [ ] NPC pixel silhouettes rendered in scene (2-4 per visit, randomized from roster)
- [ ] Trophy shelf renders collected trophies as small pixel item sprites (0 trophies early, grows over time)
- [ ] Tavern name sign: "THE WOUNDED GOBLIN" in amber pixel font style
- [ ] NPC roster sidebar: tonight's patrons listed with name + mood line (DCC tone)
- [ ] Mood states: normal / festive (after boss kill) / tense (after defeat) / late night
- [ ] Mood affects lighting color: amber=normal, bright yellow=festive, purple=tense, dim orange=late
- [ ] Tavern music plays when on this screen (`AudioManager.playTrack('tavern')` — null/silent until asset added)
- [ ] "CHOOSE YOUR FATE" session selector cards remain, styled consistently
- [ ] Gold balance displayed in top right (placeholder 0 until Phase 4 economy)
- [ ] Session history and weight log nav buttons remain at bottom

### Tavern Scene Architecture

```javascript
// renderer/TavernScene.js
// Pure View-based, same pattern as MonsterSprite
// Scene is a fixed 320x240 logical pixel canvas at pixelSize=2 → 640x480 display

// Scene layers (render in order, each is a View overlay):
// 1. Wall (stone tile pattern, dark)
// 2. Floor (plank pattern, warm brown)
// 3. Fireplace (right side, animated flicker via Animated API)
// 4. Bar counter (left side)
// 5. Lanterns (hanging, 3 across ceiling)
// 6. Tables (2-3 scattered)
// 7. NPC silhouettes (2-4, randomized positions)
// 8. Trophy shelf (above bar, populated by collected trophies)
// 9. Lighting overlay (mood-based color tint at 10-15% opacity)
// 10. Sign ("THE WOUNDED GOBLIN" text, not pixel art, just styled Text component)

// Fireplace animation: use React Native Animated API to cycle
// through 3 flame color states every 200ms — orange → yellow → red → orange
// DO NOT use Reanimated for this. Built-in Animated.loop is sufficient.
```

### NPC Roster (src/data/npcs.js)

```javascript
export const NPC_ROSTER = [
  { id: 'phil',      name: 'Phil (Former Lich)',           mood: 'Nursing his third ale. Seems philosophical.' },
  { id: 'bartender', name: 'The Bartender (Name Unknown)', mood: 'Has seen everything. Comments on nothing.' },
  { id: 'elemental', name: 'Sponsored Content Elemental',  mood: 'Keeps mentioning a protein supplement.' },
  { id: 'dog',       name: 'A Dog That Should Not Be Here',mood: 'On the bar stool. No one has moved it.' },
  { id: 'manager',   name: 'Grievance Manager (Retired)',  mood: 'Filing a complaint about the ambiance.' },
  { id: 'carl',      name: 'Carl (Maybe)',                  mood: 'Refuses to confirm or deny being Carl.' },
  { id: 'human',     name: 'Extremely Normal Human',       mood: 'Suspicious. Too normal. Watch this one.' },
  { id: 'announcer', name: 'Dungeon Announcer (Off Duty)', mood: 'Quieter than expected. Tired eyes.' },
];

// Pick 3-4 per visit, seeded by date so NPCs change daily but are consistent within a day
export function getTonightNPCs() {
  const daySeed = Math.floor(Date.now() / 86400000);
  const rng = seededRNG(daySeed);
  const shuffled = [...NPC_ROSTER].sort(() => rng() - 0.5);
  return shuffled.slice(0, 3 + Math.floor(rng() * 2)); // 3 or 4 NPCs
}
```

### Music Wiring (Phase 3 completion)

```javascript
// App.js music logic
// Splash screen mounts → AudioManager.playTrack('intro', { loop: true })
// Player taps Enter → setView('home') → AudioManager.playTrack('tavern', { loop: true })
// Player starts workout → setView('active') → AudioManager.pauseTrack()
// Player returns from workout → setView('home') → AudioManager.resumeTrack()
// Boss fight (future) → AudioManager.playTrack('boss', { loop: true })
// Return from boss → AudioManager.playTrack('tavern', { loop: true })

// TRACKS registry (src/engine/audio.js)
const TRACKS = {
  intro:  require('../../assets/audio/intro.mp3'),
  tavern: null,   // drop tavern.mp3 in assets/audio/ to activate
  boss:   null,   // drop boss.mp3 in assets/audio/ to activate
};
```

---

## Phase 4 — Inventory, Gear & Economy

**Goal:** Players collect gear from monster kills. Equipment has stats that affect combat. Persistent inventory lives forever. Gold is earned and spent. The tavern shop opens.

### Phase 4 Checklist

**Loot System:**
- [ ] Monsters drop loot on death (gear item or gold or both)
- [ ] Loot determined by monster rarity and zone (loot tables in src/data/lootTables.js)
- [ ] Victory screen shows loot dropped with item sprite and name
- [ ] Items save to persistent inventory (AsyncStorage key `iq_inventory`)
- [ ] Gold saves to persistent balance (AsyncStorage key `iq_gold`)
- [ ] Trophy items drop from every monster kill — proof of the kill, cannot be discarded

**Inventory Screen (new screen):**
- [ ] New screen: InventoryScreen.js accessible from TavernScreen
- [ ] Tabs: EQUIPPED / BAGS / TROPHIES / JUNK
- [ ] EQUIPPED tab: 9 equipment slots displayed (Weapon, Offhand, Helmet, Chest, Gloves, Boots, Belt, Amulet, Ring x2)
- [ ] Each slot shows equipped item sprite + name or empty slot placeholder
- [ ] BAGS tab: grid of all collected items with item sprite + name + rarity color
- [ ] TROPHIES tab: all trophy items from monster kills
- [ ] JUNK tab: useless collectibles and vendor trash
- [ ] Tap item in BAGS → detail modal: item name, flavor text, stats, Equip / Discard options
- [ ] No inventory cap — bottomless bag
- [ ] Discard requires confirmation ("Are you sure? This item will be gone. The dungeon does not offer refunds.")

**Item Sprite System (renderer/ItemSprite.js):**
- [ ] View-based pixel art, same pattern as MonsterSprite
- [ ] Slot types: weapon, helmet, chest, gloves, boots, belt, amulet, ring, junk, trophy
- [ ] Each slot type has distinct silhouette (weapon=vertical blade, helmet=dome, ring=circle with gem, etc.)
- [ ] Rarity drives color palette (grey/green/blue/purple/orange — common through legendary)
- [ ] Small size variant (32x32 display) for inventory grid
- [ ] Large size variant (64x64 display) for item detail modal

**Equipment Slots & Stats:**

```javascript
// src/data/equipment.js
export const EQUIPMENT_SLOTS = [
  'weapon', 'offhand', 'helmet', 'chest', 
  'gloves', 'boots', 'belt', 'amulet', 'ring1', 'ring2'
];

// Stats gear can carry (one or more per item based on rarity)
export const GEAR_STATS = {
  strength:  'Increases damage on Strength exercises',
  stamina:   'Increases damage on Stamina exercises',
  agility:   'Increases damage on Agility exercises',
  endurance: 'Increases damage on Endurance exercises',
  vitality:  'Increases max player HP',
  luck:      'Increases rare loot drop chance',
  armor:     'Reduces monster attack damage',
};

// Stat count by rarity
// common: 1 stat, uncommon: 1-2, rare: 2-3, epic: 3-4, legendary: unique passive
```

**Rarity Tiers:**

```javascript
export const RARITIES = {
  common:    { color: '#aaaaaa', label: 'COMMON',    statCount: 1,   dropWeight: 50 },
  uncommon:  { color: '#40dd40', label: 'UNCOMMON',  statCount: 2,   dropWeight: 28 },
  rare:      { color: '#4080ff', label: 'RARE',      statCount: 3,   dropWeight: 15 },
  epic:      { color: '#a040dd', label: 'EPIC',      statCount: 4,   dropWeight: 5  },
  legendary: { color: '#ff8000', label: 'LEGENDARY', statCount: 0,   dropWeight: 2  }, // unique passive
};
```

**Set Bonuses (src/data/sets.js):**

```javascript
// Sets are discovered organically — game doesn't tell you a set exists
// until you find the second piece
export const GEAR_SETS = {
  bureaucrat_regalia: {
    name: "The Bureaucrat's Regalia",
    pieces: ['bureaucrat_helmet', 'bureaucrat_chest', 'bureaucrat_ring'],
    bonuses: {
      2: { xpBonus: 0.08, description: '+8% XP gain' },
      3: { goldBonus: 0.12, passiveText: 'Once per session a monster surrenders and files a complaint instead.' },
    },
  },
  gym_rat: {
    name: "Gym Rat's Starter Pack",
    pieces: ['gym_gloves', 'gym_boots'],
    bonuses: {
      2: { firstSetBonus: 0.10, description: '+10% damage on first set of any exercise' },
    },
  },
  incident_set: {
    name: 'The Incident Set',
    pieces: ['incident_1','incident_2','incident_3','incident_4','incident_5'],
    bonuses: {
      2: { mystery: true, description: '[REDACTED]' },
      3: { mystery: true, description: '[REDACTED]' },
      5: { mystery: true, description: '[CLASSIFIED]' },
    },
  },
};
```

**Item Naming System (src/engine/itemGen.js):**

```javascript
// DCC tone — unhinged names with lore implications
const PREFIXES = {
  common:    ['Slightly Used','Worn','Standard-Issue','Regulation'],
  uncommon:  ['Enchanted','Reinforced','Named After Someone'],
  rare:      ['Ancient','Twice-Cursed','Definitely Not Stolen'],
  epic:      ['Of the Third Incident','Remembered By None','Somehow Still Intact'],
  legendary: ['Carl\'s','The Original','What Remains Of'],
};

const SUFFIXES = {
  weapon:  ['Shortsword','Greatclub','Staff','Axe','Dagger','Shaker (Slightly Exploded)'],
  helmet:  ['Helm','Crown','Headband','Hat (Vibrates)','Circlet'],
  chest:   ['Chestplate','Vest','Chainmail','Breastplate','Jacket (Questionable Origin)'],
  gloves:  ['Gauntlets','Grips','Wraps','Gloves (Left One Damp)'],
  boots:   ['Greaves','Boots','Sneakers','Shoes (Run Sometimes on Own)'],
  belt:    ['Belt','Girdle','Sash','Strap'],
  amulet:  ['Amulet','Pendant','Medallion','Necklace (Haunted)'],
  ring:    ['Band','Ring','Signet','Loop (Does Not Fit)'],
  junk:    ['Spoon (Bent)','Grocery List (Someone Else\'s)','Rock (Looks Like Rock)','Receipt (Specific)','Coin (King Never Existed)'],
  trophy:  ['Trophy','Trophy (Participation)','Trophy (Real)','Commemorative Badge'],
};

// Flavor text templates by rarity
// common: "[Item]. It exists."
// uncommon: "[Item] of [person]. They are fine. Probably."
// rare: "[Item]. It has been places. You can tell."
// epic: "[Item]. The previous owner is not available for comment. This is unrelated to the item."
// legendary: "[Item]. [3 sentence lore that contradicts itself]"
```

**Loot Tables (src/data/lootTables.js):**

```javascript
// Drop rates per monster rarity
export const LOOT_TABLES = {
  common:    { goldMin: 5,   goldMax: 15,  itemChance: 0.40, itemRarity: ['common'] },
  uncommon:  { goldMin: 12,  goldMax: 30,  itemChance: 0.55, itemRarity: ['common','uncommon'] },
  rare:      { goldMin: 25,  goldMax: 60,  itemChance: 0.70, itemRarity: ['common','uncommon','rare'] },
  epic:      { goldMin: 50,  goldMax: 120, itemChance: 0.85, itemRarity: ['uncommon','rare','epic'] },
  legendary: { goldMin: 100, goldMax: 250, itemChance: 1.00, itemRarity: ['rare','epic','legendary'] },
};

// Every monster kill drops a trophy regardless of other loot
// Trophy name = monster name + " Trophy" or monster name + "'s [body part]"
```

**Gold Economy:**

```javascript
// Gold sources
// Monster kills: goldMin-goldMax per rarity (see loot tables)
// Session completion bonus: 10-50 gold based on total sets completed
// Personal record bonus: +5 gold per PR hit in session

// Gold sinks (Phase 4)
// Tavern recovery after defeat: 10-50 gold (scales to character level)
// Tavern shop: consumables (HP potions, timeout card refills)
// Cosmetic items: character appearance (future)

// Gold display: top right of TavernScreen, amber color, monospace
// Format: "⬡ 1,247" (no dollar signs, it's a fantasy game)
```

**Tavern Shop (TavernScreen addition):**

```javascript
// Small shop accessible from TavernScreen
// "TALK TO BARTENDER" button → opens ShopModal
// Shop items (Phase 4 launch):
{
  hp_potion:     { name: 'Questionable Health Tonic',    cost: 30,  effect: 'Restore 30 HP before next session' },
  timeout_card:  { name: 'Extra Timeout Card',           cost: 50,  effect: 'Start next session with 2 timeout cards' },
  lucky_charm:   { name: 'Probably Lucky Charm',         cost: 75,  effect: '+10% gold drop rate for next session' },
  announcer_tip: { name: 'Tip the Announcer (Nothing Happens)', cost: 10, effect: 'Nothing happens. The announcer acknowledges this.' },
}
```

**Character State (src/store/characterStore.js — create in Phase 4):**

```javascript
// Zustand store for persistent character data
{
  gold: number,
  totalXp: number,
  level: number,               // derived from totalXp
  equippedItems: {             // keyed by slot name
    weapon: itemId | null,
    offhand: itemId | null,
    helmet: itemId | null,
    chest: itemId | null,
    gloves: itemId | null,
    boots: itemId | null,
    belt: itemId | null,
    amulet: itemId | null,
    ring1: itemId | null,
    ring2: itemId | null,
  },
  inventory: Item[],           // full item objects, no cap
  discoveredSets: string[],    // set IDs where player has 2+ pieces
  consumables: {
    hpPotions: number,
    timeoutCards: number,      // base 1 per session, extra from shop
    luckyCharms: number,
  },
  stats: {                     // derived from equipped gear + base
    strength: number,
    stamina: number,
    agility: number,
    endurance: number,
    vitality: number,
    luck: number,
    armor: number,
  }
}

// Persistence: full characterStore saves to AsyncStorage key iq_character on every change
// Load on App.js init alongside workout log
```

**XP & Leveling:**

```javascript
// XP sources
// Per set completed: 10 XP base
// Monster kill: 25 * rarityMultiplier XP (common=1, uncommon=1.5, rare=2, epic=3, legendary=5)
// Session completion: 50 XP bonus
// Personal record: 15 XP bonus per PR

// Level thresholds (first 10 levels)
// Level 1: 0 XP (start)
// Level 2: 100 XP
// Level 3: 250 XP
// Level 4: 500 XP
// Level 5: 900 XP
// Level 6: 1400 XP
// Level 7: 2100 XP
// Level 8: 3000 XP
// Level 9: 4200 XP
// Level 10: 5800 XP
// Formula after 10: previousThreshold * 1.4 (rounded to nearest 100)

// Level display: shown on TavernScreen near player name
// "LVL 7 // DUNGEON CRAWLER" — tier title changes at milestone levels
const LEVEL_TITLES = {
  1:  'FRESH MEAT',
  3:  'DUNGEON CURIOUS',
  5:  'ACTUAL THREAT',
  10: 'DUNGEON CRAWLER',
  15: 'PROBLEM',
  20: 'CERTIFIED MENACE',
  30: 'THE DUNGEON HAS CONCERNS',
  50: 'CARL (MAYBE)',
};
```

**Victory Screen (expand existing):**

```javascript
// After all monsters defeated, show victory screen before returning to tavern
// Components:
// 1. "SESSION COMPLETE" in amber, large
// 2. Monsters defeated count: "3 ENEMIES SLAIN"
// 3. XP gained: "+285 XP" with level up indicator if applicable
// 4. Gold gained: "⬡ +47"
// 5. Loot dropped: item sprites + names for each dropped item
// 6. PR count: "4 PERSONAL RECORDS" if any
// 7. "RETURN TO TAVERN" button
// Announcer line at top of screen — victory pool
```

**New Files for Phase 4:**

```
src/
  store/
    characterStore.js      ← Zustand character/inventory state
  engine/
    itemGen.js             ← procedural item name + stat generation
    lootResolver.js        ← resolves loot drops from monster kills
  data/
    lootTables.js          ← drop rates per rarity
    equipment.js           ← slot definitions, stat descriptions
    sets.js                ← set bonus definitions
    npcs.js                ← NPC roster (move here from inline)
renderer/
  ItemSprite.js            ← View-based item pixel art
screens/
  InventoryScreen.js       ← inventory management UI
  VictoryScreen.js         ← post-session summary (or modal)
```

---

## Phase Completion Summary (updated)

| Phase | Status | Deliverable |
|---|---|---|
| 1 | ✅ COMPLETE | Combat loop: log set → damage → monster responds → timer → defeat/return |
| 2 | 🔨 IN PROGRESS | Visual overhaul + View-based sprite renderer |
| 3 | ⬜ NEXT | Bug fixes + monster generation + Tavern screen + music wiring |
| 4 | ⬜ | Inventory, gear drops, item generation, gold economy, tavern shop, character store |
| 5 | ⬜ | Season 1 authored narrative, story beats, authored bosses |
| 6 | ⬜ | Grind Mode with zone selection |
| 7 | ⬜ | LLM program builder with JSON import |
| 8 | ⬜ | Character sheet UI, attributes, skill trees |
| 9 | ⬜ | Party system, real-time multiplayer |

