import React, { useEffect, useRef } from 'react';
import { View, Animated } from 'react-native';

function parseColor(c) {
  if (c.startsWith('#')) {
    return [parseInt(c.slice(1,3), 16), parseInt(c.slice(3,5), 16), parseInt(c.slice(5,7), 16)];
  }
  const match = c.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (match) {
    return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)];
  }
  return [0, 0, 0];
}

function tintRed(colorStr) {
  const [r, g, b] = parseColor(colorStr);
  const nr = Math.min(255, r + 60);
  const ng = Math.max(0,   g - 30);
  const nb = Math.max(0,   b - 30);
  return `rgb(${nr},${ng},${nb})`;
}

function desaturateHex(colorStr, amount = 0.3) {
  const [r, g, b] = parseColor(colorStr);
  const avg = (r + g + b) / 3;
  const nr = Math.round(r + (avg - r) * amount);
  const ng = Math.round(g + (avg - g) * amount);
  const nb = Math.round(b + (avg - b) * amount);
  return `rgb(${nr},${ng},${nb})`;
}

// PALETTES and SPRITES ... (Need to keep the same text of palettes and sprites)!

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

export default function MonsterSprite({ archetype = 'humanoid', rarity = 'common', enraged = false, hpPercent = 1.0, pixelSize = 8 }) {
  const spriteMap = SPRITES[archetype] ?? SPRITES.humanoid;
  const palette   = (PALETTES[archetype] ?? PALETTES.humanoid)[rarity] ?? PALETTES.humanoid.common;
  const flickerAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (hpPercent > 0.25) {
      flickerAnim.stopAnimation();
      flickerAnim.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(flickerAnim, { toValue: 0.5, duration: 400, useNativeDriver: true }),
        Animated.timing(flickerAnim, { toValue: 1, duration: 400, useNativeDriver: true })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [hpPercent]);

  return (
    <Animated.View style={{ flexDirection: 'column', opacity: flickerAnim }}>
      {spriteMap.map((row, y) => (
        <View key={y} style={{ flexDirection: 'row' }}>
          {row.map((colorIdx, x) => {
            if (colorIdx === 0) return <View key={x} style={{ width: pixelSize, height: pixelSize }} />;
            let color = palette[colorIdx - 1];

            // Injury Logic
            if (hpPercent <= 0.75) {
               let desatAmt = 0.3;
               if (hpPercent <= 0.50) desatAmt = 0.5;
               color = desaturateHex(color, desatAmt);

               const coordSeed = (x * 13) + (y * 7); 
               
               if (hpPercent <= 0.75 && hpPercent > 0.50) {
                 if (coordSeed % 17 === 0) return <View key={x} style={{ width: pixelSize, height: pixelSize }} />;
               }
               if (hpPercent <= 0.50 && hpPercent > 0.25) {
                 if (coordSeed % 17 === 0) return <View key={x} style={{ width: pixelSize, height: pixelSize }} />; 
                 if (coordSeed % 11 === 0) color = '#8b0000'; // dark red bleed
               }
               if (hpPercent <= 0.25) {
                 if (coordSeed % 17 === 0) return <View key={x} style={{ width: pixelSize, height: pixelSize }} />; 
                 if (coordSeed % 7 === 0)  color = '#ff0000'; // red bleed
                 color = tintRed(color);
               }
            }

            if (enraged) color = tintRed(color);
            return <View key={x} style={{ width: pixelSize, height: pixelSize, backgroundColor: color }} />;
          })}
        </View>
      ))}
    </Animated.View>
  );
}
