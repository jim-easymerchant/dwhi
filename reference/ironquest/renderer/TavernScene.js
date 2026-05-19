// [IQ] renderer/TavernScene.js — View-based pixel art tavern scene
// Pure Views, zero native dependencies. Same render pattern as MonsterSprite.
// Composed of absolutely-positioned mini-sprite elements within a fixed container.

import React, { useRef, useEffect } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';

// ── Mood lighting ─────────────────────────────────────────────────────────────
const MOOD_TINT = {
  normal:      { color: '#ffaa00', opacity: 0.1 },
  quiet:       { color: '#000000', opacity: 0.3 },
  dusty:       { color: '#110c08', opacity: 0.6 },
  abandoned:   { color: '#050207', opacity: 0.85 },
  // Legacy backups
  tense:       { color: '#ff0000', opacity: 0.15 },
  festive:     { color: '#ffda80', opacity: 0.15 },
  late_night:  { color: '#002244', opacity: 0.4 },
};

// ── Pixel sprite renderer (same pattern as MonsterSprite) ─────────────────────
function PixelSprite({ map, palette, pixelSize = 2, style }) {
  return (
    <View style={[{ flexDirection: 'column' }, style]}>
      {map.map((row, y) => (
        <View key={y} style={{ flexDirection: 'row' }}>
          {row.map((idx, x) => {
            if (idx === 0) return <View key={x} style={{ width: pixelSize, height: pixelSize }} />;
            return (
              <View
                key={x}
                style={{ width: pixelSize, height: pixelSize, backgroundColor: palette[idx - 1] }}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ── Sprite maps ───────────────────────────────────────────────────────────────

// Lantern — 5×7
const LANTERN_MAP = [
  [0,1,1,1,0],
  [1,2,2,2,1],
  [1,2,3,2,1],
  [1,2,3,2,1],
  [1,2,2,2,1],
  [0,1,1,1,0],
  [0,0,1,0,0],
];
const LANTERN_PALETTE = ['#3a2808', '#c07010', '#ffcc40'];

// Shelf — 16×5 (empty placeholder)
const SHELF_MAP = [
  [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
  [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1],
  [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
  [0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0],
  [0, 0, 3, 3, 0, 0, 0, 0, 0, 0, 0, 0, 3, 3, 0, 0],
];
const SHELF_PALETTE = ['#4a2e15', '#5c3a1a', '#2d1b0c'];


// NPC silhouette — 6×12 humanoid dark shape
const NPC_MAP = [
  [0,1,1,1,1,0],
  [0,1,2,2,1,0],
  [0,1,1,1,1,0],
  [0,0,1,1,0,0],
  [1,1,1,1,1,1],
  [1,1,1,1,1,1],
  [0,1,1,1,1,0],
  [0,1,1,1,1,0],
  [0,1,0,0,1,0],
  [0,1,0,0,1,0],
  [0,1,0,0,1,0],
  [1,1,0,0,1,1],
];

// NPC palette slots — slightly varied dark tones per position
const NPC_PALETTES = [
  ['#1a1020', '#2a1830'],  // slot 0
  ['#101820', '#182030'],  // slot 1
  ['#141414', '#202020'],  // slot 2
  ['#180a0a', '#280e0e'],  // slot 3
];

// Fireplace outer frame — 12×10
const FIREPLACE_FRAME_MAP = [
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,1],
  [1,1,1,0,0,0,0,0,1,1,1,1],
  [1,1,1,0,0,0,0,0,1,1,1,1],
];
const FIREPLACE_FRAME_PALETTE = ['#2a1810'];

// Animated flame — 10×7, palette driven by animation frame
const FLAME_MAP = [
  [0,0,1,0,0,0,1,0,0,0],
  [0,1,2,1,0,1,2,1,0,0],
  [1,2,2,2,1,2,2,2,1,0],
  [1,2,3,2,2,2,3,2,1,0],
  [1,2,2,3,2,3,2,2,1,0],
  [0,1,2,2,2,2,2,1,0,0],
  [0,0,1,1,1,1,1,0,0,0],
];

// 3 flame palette frames
const FLAME_FRAMES = [
  ['#cc4400', '#ff6600', '#ffaa00'],  // orange
  ['#dd6600', '#ffaa00', '#ffdd40'],  // yellow-orange
  ['#aa2200', '#cc4400', '#ff6600'],  // red-orange
];

// ── Animated flame component ──────────────────────────────────────────────────
function AnimatedFlame({ mood, pixelSize = 2 }) {
  const frameRef = useRef(0);
  const [frame, setFrame] = React.useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setFrame(f => (f + 1) % 3);
    }, 200);
    return () => clearInterval(id);
  }, []);

  const palette = FLAME_FRAMES[frame];

  if (mood === 'abandoned') return null; // Dark

  return (
    <View style={{ flexDirection: 'column', opacity: mood === 'quiet' ? 0.7 : mood === 'dusty' ? 0.4 : 1.0 }}>
      {FLAME_MAP.map((row, y) => (
        <View key={y} style={{ flexDirection: 'row' }}>
          {row.map((idx, x) => {
            if (idx === 0) return <View key={x} style={{ width: pixelSize, height: pixelSize }} />;
            return (
              <View
                key={x}
                style={{ width: pixelSize, height: pixelSize, backgroundColor: palette[idx - 1] }}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ── NPC slot positions (% of scene width, fixed bottom offset) ───────────────
const NPC_SLOTS = [
  { left: '12%', bottom: 58 },
  { left: '30%', bottom: 58 },
  { left: '52%', bottom: 58 },
  { left: '68%', bottom: 58 },
];



// ── Main scene component ──────────────────────────────────────────────────────
export default function TavernScene({ mood = 'normal', npcCount = 3 }) {
  const tint = MOOD_TINT[mood] ?? MOOD_TINT.normal;

  return (
    <View style={s.scene}>

      {/* Stone wall — top band */}
      <View style={s.wall} />
      {/* Brick Wall Grid */}
      <View style={s.brickH1} />
      <View style={s.brickH2} />
      <View style={s.brickH3} />
      <View style={s.brickV1} />
      <View style={s.brickV2} />
      <View style={s.brickV3} />
      <View style={s.brickV4} />

      {/* Ceiling chain for lanterns */}
      <View style={s.ceilingChain} />

      {/* Three lanterns across ceiling */}
      <View style={[s.lantern, { left: '15%' }]}>
        <PixelSprite map={LANTERN_MAP} palette={LANTERN_PALETTE} pixelSize={3} />
      </View>
      <View style={[s.lantern, { left: '47%' }]}>
        <PixelSprite map={LANTERN_MAP} palette={LANTERN_PALETTE} pixelSize={3} />
      </View>
      <View style={[s.lantern, { right: '12%' }]}>
        <PixelSprite map={LANTERN_MAP} palette={LANTERN_PALETTE} pixelSize={3} />
      </View>

      {/* Bar counter — left side */}
      <View style={s.barCounter} />
      <View style={s.barTop} />

      {/* Trophy shelf (above bar) */}
      <View style={s.trophyShelf}>
        <PixelSprite map={SHELF_MAP} palette={SHELF_PALETTE} pixelSize={3} />
        <View style={s.shelfItemsContainer}>
          {/* Future: Map through collected trophies here */}
        </View>
      </View>

      {/* Table 1 */}
      <View style={s.table1} />
      {/* Table 2 */}
      <View style={s.table2} />

      {/* Floor planks */}
      <View style={s.floor} />
      <View style={s.floorPlank1} />
      <View style={s.floorPlank2} />
      <View style={s.floorPlank3} />
      <View style={s.floorPlankV1} />
      <View style={s.floorPlankV2} />
      <View style={s.floorPlankV3} />
      <View style={s.floorPlankV4} />
      <View style={s.floorPlankV5} />

      {/* Fireplace — right side */}
      <View style={s.fireplaceFrame}>
        <PixelSprite map={FIREPLACE_FRAME_MAP} palette={FIREPLACE_FRAME_PALETTE} pixelSize={3} />
      </View>
      <View style={s.flameContainer}>
        <AnimatedFlame mood={mood} pixelSize={2} />
      </View>

      {/* NPC silhouettes */}
      {Array.from({ length: Math.min(npcCount, NPC_SLOTS.length) }).map((_, i) => (
        <View key={i} style={[s.npc, NPC_SLOTS[i]]}>
          <PixelSprite map={NPC_MAP} palette={NPC_PALETTES[i % NPC_PALETTES.length]} pixelSize={3} />
        </View>
      ))}

      {/* Mood lighting overlay */}
      <View
        style={[
          s.lightingOverlay,
          { backgroundColor: tint.color, opacity: tint.opacity },
        ]}
        pointerEvents="none"
      />

      {/* Dusty Overlay */}
      {(mood === 'dusty' || mood === 'abandoned') && (
        <View style={s.dustOverlay} pointerEvents="none" />
      )}

      {/* Tavern sign */}
      <View style={[s.signBox, mood === 'abandoned' && { opacity: 0.2 }]}>
        <Text style={s.sign}>THE WOUNDED GOBLIN</Text>
        <Text style={s.signSub}>Tavern & Questionable Lodging</Text>
      </View>

    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  scene: {
    height:          220,
    overflow:        'hidden',
    backgroundColor: '#392a1c', // Much brighter brown background
    position:        'relative',
  },

  // Wall
  wall: {
    position:        'absolute',
    top:             0,
    left:            0,
    right:           0,
    height:          140, // Increased height
    backgroundColor: '#392a1c',
  },

  // Brick Lines
  brickH1: { position: 'absolute', top: 40, left: 0, right: 0, height: 2, backgroundColor: '#2b1e10' },
  brickH2: { position: 'absolute', top: 80, left: 0, right: 0, height: 2, backgroundColor: '#2b1e10' },
  brickH3: { position: 'absolute', top: 120, left: 0, right: 0, height: 2, backgroundColor: '#2b1e10' },

  brickV1: { position: 'absolute', top: 0, height: 140, left: '15%', width: 2, backgroundColor: '#2b1e10' },
  brickV2: { position: 'absolute', top: 0, height: 140, left: '35%', width: 2, backgroundColor: '#2b1e10' },
  brickV3: { position: 'absolute', top: 0, height: 140, left: '60%', width: 2, backgroundColor: '#2b1e10' },
  brickV4: { position: 'absolute', top: 0, height: 140, left: '85%', width: 2, backgroundColor: '#2b1e10' },

  // Ceiling chain line -> removed for now as image doesn't show it as prominently, but let's keep it subtle
  ceilingChain: {
    position:        'absolute',
    top:             18,
    left:            0,
    right:           0,
    height:          2,
    backgroundColor: '#2b1e10',
  },

  // Lantern positioning
  lantern: {
    position: 'absolute',
    top:      0,
  },

  // Bar counter
  barCounter: {
    position:        'absolute',
    left:            0,
    bottom:          80, // moved up as floor is taller
    width:           140,
    height:          40,
    backgroundColor: '#2b1a0d',
  },
  barTop: {
    position:        'absolute',
    left:            0,
    bottom:          120,
    width:           146,
    height:          6,
    backgroundColor: '#3d2514',
  },

  // Trophy Shelf
  trophyShelf: {
    position: 'absolute',
    left:     150,
    bottom:   150,
  },
  shelfItemsContainer: {
    position: 'absolute',
    bottom:   15,
    left:     0,
    right:    0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-evenly',
  },

  // Tables
  table1: {
    position:        'absolute',
    left:            '10%',
    bottom:          40,
    width:           60,
    height:          8,
    backgroundColor: '#2b1a0d',
  },
  table2: {
    position:        'absolute',
    left:            '60%',
    bottom:          40,
    width:           8,
    height:          8,
    backgroundColor: '#2b1a0d',
  },

  // Floor
  floor: {
    position:        'absolute',
    bottom:          0,
    left:            0,
    right:           0,
    height:          80,
    backgroundColor: '#271203',
  },
  floorPlank1: {
    position:        'absolute',
    bottom:          60,
    left:            0,
    right:           0,
    height:          2,
    backgroundColor: '#371c08',
  },
  floorPlank2: {
    position:        'absolute',
    bottom:          40,
    left:            0,
    right:           0,
    height:          2,
    backgroundColor: '#371c08',
  },
  floorPlank3: {
    position:        'absolute',
    bottom:          20,
    left:            0,
    right:           0,
    height:          2,
    backgroundColor: '#371c08',
  },
  floorPlankV1: { position: 'absolute', bottom: 0, height: 80, left: '10%', width: 2, backgroundColor: '#371c08' },
  floorPlankV2: { position: 'absolute', bottom: 0, height: 80, left: '30%', width: 2, backgroundColor: '#371c08' },
  floorPlankV3: { position: 'absolute', bottom: 0, height: 80, left: '50%', width: 2, backgroundColor: '#371c08' },
  floorPlankV4: { position: 'absolute', bottom: 0, height: 80, left: '70%', width: 2, backgroundColor: '#371c08' },
  floorPlankV5: { position: 'absolute', bottom: 0, height: 80, left: '90%', width: 2, backgroundColor: '#371c08' },

  // Fireplace
  fireplaceFrame: {
    position: 'absolute',
    right:    10,
    bottom:   80,
    transform: [{ scale: 1.5 }],
    transformOrigin: 'bottom right',
  },
  flameContainer: {
    position: 'absolute',
    right:    24,
    bottom:   84,
    transform: [{ scale: 2.0 }],
    transformOrigin: 'bottom right',
  },

  // NPC
  npc: {
    position: 'absolute',
  },

  // Mood overlay
  lightingOverlay: {
    position: 'absolute',
    top:      0,
    left:     0,
    right:    0,
    bottom:   0,
  },

  // Sign
  signBox: {
    position:   'absolute',
    top:        8,
    left:       8,
    backgroundColor: 'rgba(20, 10, 0, 0.8)',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  sign: {
    fontFamily: 'monospace',
    fontSize:   12,
    fontWeight: '900',
    color:      '#f0a030',
    letterSpacing: 1,
  },
  signSub: {
    fontFamily: 'monospace',
    fontSize:   8,
    fontWeight: '700',
    color:      '#886644',
    letterSpacing: 1,
    marginTop: 4,
  },
});
