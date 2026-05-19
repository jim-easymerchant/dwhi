import React, { forwardRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import ViewShot from 'react-native-view-shot';
import MonsterSprite from '../../renderer/MonsterSprite';

// Feature 14: Social Dispatch Card
// A pure View representation to be screenshotted by react-native-view-shot.
export const DispatchCardView = forwardRef(({ sessionStats, workoutLog, modifier, level }, ref) => {
  const prCount = workoutLog?.[0]?.prs ?? sessionStats?.prs ?? 0;
  const damage = sessionStats?.damage ?? 0;
  const kills = sessionStats?.kills ?? 0;
  const durationStr = "N/A"; // Or derived

  return (
    <ViewShot ref={ref} style={s.card} options={{ format: 'png', quality: 0.9 }}>
      {/* Background Container */}
      <View style={s.bg} />

      {/* Decorative Border */}
      <View style={s.innerBorder}>
        <Text style={s.title}>DUNGEON DISPATCH</Text>
        <Text style={s.divider}>──────────────────────────</Text>

        {/* Dynamic Badges */}
        {modifier && (
          <Text style={s.badge}>SESSION MODIFIER: {modifier.name.toUpperCase()}</Text>
        )}

        <Text style={s.statText}>DURATION: {new Date().toLocaleDateString()}</Text>
        <Text style={s.statText}>MONSTERS SLAIN: {kills}</Text>
        <Text style={s.statText}>TOTAL DAMAGE: {damage}</Text>
        <Text style={s.divider}>──────────────────────────</Text>

        <Text style={s.statText}>EXERCISES:</Text>
        <View style={s.exerciseList}>
          {workoutLog?.map((set, idx) => (
            <Text key={idx} style={s.exerciseLine}>
              {set.exercise}  {set.reps}x{set.weight}
            </Text>
          )).slice(0, 5)}
          {(workoutLog?.length > 5) && <Text style={s.exerciseLine}>...and more</Text>}
        </View>
        <Text style={s.divider}>──────────────────────────</Text>

        {prCount > 0 && <Text style={s.prText}>PERSONAL RECORDS: {prCount} 🔥</Text>}
        <Text style={s.levelText}>LEVEL {level || '?'} — DUNGEON CRAWLER</Text>

      </View>

      {/* Player and Monster Sprite Rendering via Renderer components */}
      <View style={s.artContainer}>
        {/* Placeholder for character sprite */}
        <View style={s.playerDummy}>
          <Text style={{color: '#aaa', fontSize: 10, fontFamily: 'monospace'}}>PLAYER</Text>
        </View>

        {/* The defeated monster */}
        <View style={s.monsterWrap}>
          <MonsterSprite npcCount={1} scale={1.5} overrideHp={0} isDefeated={true} />
        </View>
      </View>

      <View style={s.footer}>
        <Text style={s.footerBrand}>IRON QUEST — THE WORKOUT IS THE COMBAT</Text>
      </View>
    </ViewShot>
  );
});

const s = StyleSheet.create({
  card: {
    width: 1080 / 3, // For rendering in layout without making the physical node 1080px right now
    height: 1350 / 3,
    backgroundColor: '#111',
    alignSelf: 'center',
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#444',
  },
  bg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0c0a10',
  },
  innerBorder: {
    margin: 16,
    flex: 1,
    borderWidth: 2,
    borderColor: '#f0a030',
    padding: 12,
  },
  title: {
    fontFamily: 'monospace',
    color: '#f0a030',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  divider: {
    fontFamily: 'monospace',
    color: '#f0a030',
    opacity: 0.5,
    marginVertical: 4,
  },
  statText: {
    fontFamily: 'monospace',
    color: '#ddd',
    fontSize: 10,
    lineHeight: 16,
  },
  exerciseList: {
    marginVertical: 4,
  },
  exerciseLine: {
    fontFamily: 'monospace',
    color: '#aaa',
    fontSize: 9,
  },
  prText: {
    fontFamily: 'monospace',
    color: '#ff6600',
    fontSize: 11,
    fontWeight: 'bold',
    marginVertical: 2,
  },
  badge: {
    fontFamily: 'monospace',
    color: '#ff0055',
    fontSize: 10,
    marginBottom: 4,
  },
  levelText: {
    fontFamily: 'monospace',
    color: '#f0a030',
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 8,
    textAlign: 'center',
  },
  artContainer: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    height: 120,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  playerDummy: {
    width: 30,
    height: 50,
    backgroundColor: '#333',
    marginRight: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monsterWrap: {
    opacity: 0.5, // Dead
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 30,
    backgroundColor: '#f0a030',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerBrand: {
    fontFamily: 'monospace',
    color: '#000',
    fontSize: 9,
    fontWeight: 'bold',
  }
});
