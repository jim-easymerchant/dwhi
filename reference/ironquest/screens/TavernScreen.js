// [IQ] screens/TavernScreen.js — The Wounded Goblin tavern home screen
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { WORKOUTS, getNextSession, formatDate } from '../src/data';
import { ZONES_AVAILABLE, ZONE_LABELS, ZONE_DIFFICULTY } from '../src/engine/monsterGen';
import { getTonightNPCs } from '../src/data/npcs';
import TavernScene from '../renderer/TavernScene';

const C = {
  bg:         '#08080c',
  card:       '#0f0f14',
  border:     '#1e1e28',
  text:       '#e8d8b8',
  muted:      '#8878a0',
  dim:        '#504860',
  accent:     '#f0a030',
  accentDark: '#a06010',
  danger:     '#cc2800',
  dangerDark: '#440800',
};

const LAST_RESULT_KEY = 'iq_last_combat_result';

function deriveMood(log) {
  if (!log || log.length === 0) return 'normal';
  const lastEntry = log[log.length - 1];
  const hoursSince = (Date.now() - new Date(lastEntry.date)) / 3600000;
  
  if (hoursSince > 72) return 'abandoned';
  if (hoursSince > 48) return 'dusty';
  if (hoursSince > 24) return 'quiet';
  return 'normal';
}

export default function TavernScreen({
  log, weightLog, onStart, onHistory, onWeight, onKillLog,
  activeZone = 'shallow_crypts', onZoneChange,
  muted = false, onToggleMute,
}) {
  const [mood,      setMood]      = useState('normal');
  const [npcs,      setNpcs]      = useState([]);

  // Feature 16: Level Milestones
  const [level,     setLevel]     = useState(1);
  const [showMilestone, setShowMilestone] = useState(null);

  useEffect(() => {
    const calculatedMood = deriveMood(log);
    setMood(calculatedMood);
    let myNpcs = getTonightNPCs();

    if (calculatedMood === 'quiet') {
      myNpcs = myNpcs.slice(0, Math.max(0, myNpcs.length - 1));
      let bk = myNpcs.find(n => n.id === 'barkeep');
      if (bk) bk.mood = "It's been quiet. Pull up a stool.";
    } else if (calculatedMood === 'dusty') {
      myNpcs = myNpcs.filter(n => n.id === 'barkeep'); // Barkeep and dog usually? Actually Barkeep has id 'barkeep'.
      let bk = myNpcs.find(n => n.id === 'barkeep');
      if (bk) bk.mood = "You're back. The cobwebs were asking about you.";
    } else if (calculatedMood === 'abandoned') {
      myNpcs = []; // Empty
      // Note: we can add an announcer comment in the UI or just let the empty tavern speak for itself.
    }
    setNpcs(myNpcs);

    // Calculate level based on total completed sets across all history
    let completedSets = 0;
    log.forEach(wLog => {
      Object.keys(wLog.sets).forEach(exId => {
        completedSets += wLog.sets[exId].filter(s => s.done).length;
      });
    });
    
    // Level formula: 10 sets = 1 level
    const currentLevel = Math.floor(completedSets / 10) + 1;
    setLevel(currentLevel);

    AsyncStorage.getItem('iq_last_seen_level').then(l => {
      const lastSeen = l ? parseInt(l, 10) : 1;
      if (currentLevel > lastSeen) {
        AsyncStorage.setItem('iq_last_seen_level', String(currentLevel)).catch(()=>{});
        
        // Milestone levels
        const milestones = {
          5: "The dungeon formally recognizes you as an ACTUAL THREAT. This designation carries no benefits, responsibilities, or meaning. The paperwork was filed anyway.",
          10: "DUNGEON CRAWLER. The monsters have started a support group. Attendance is mandatory. Refreshments are not provided.",
          15: "PROBLEM. The dungeon would like you to know that you are now classified as a problem. This is not a compliment. It is also not not a compliment.",
          20: "CERTIFIED MENACE. Your file has been escalated. The escalation was escalated. There are now three committees.",
          30: "THE DUNGEON HAS CONCERNS. Those concerns have been formally documented, filed, lost, found, redacted, and filed again.",
          50: "CARL (MAYBE). The dungeon neither confirms nor denies. The paperwork is classified. You are now involved."
        };

        if (milestones[currentLevel]) {
          setShowMilestone({ level: currentLevel, msg: milestones[currentLevel] });
        }
      }
    });

  }, [log]);

  const suggested  = getNextSession(log);
  const lastEntry  = log[log.length - 1] || null;
  const daysSince  = lastEntry ? Math.round((Date.now() - new Date(lastEntry.date)) / 86400000) : null;
  const lastWeight = weightLog[weightLog.length - 1];

  const stats = [
    { label: 'Level',    value: `${level}` },
    { label: 'Last',     value: daysSince === null ? '--' : daysSince === 0 ? 'Today' : `${daysSince}d ago`, warn: daysSince >= 3 },
    { label: 'Weight',   value: lastWeight ? `${lastWeight.weight}lb` : '--' },
  ];

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>

      {showMilestone && (
        <View style={s.milestoneOverlay}>
          <Text style={s.milestoneTitle}>LEVEL {showMilestone.level}</Text>
          <Text style={s.milestoneMsg}>{showMilestone.msg}</Text>
          <TouchableOpacity style={s.milestoneBtn} onPress={() => setShowMilestone(null)}>
            <Text style={s.milestoneBtnText}>PROCEED.</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── TAVERN SCENE (full-bleed, no horizontal padding) ── */}
      <View style={s.sceneWrapper}>
        <TavernScene mood={mood} npcCount={npcs.length} />

        {/* Gold + mute overlaid on top-right of scene */}
        <View style={s.sceneOverlay}>
          <Text style={s.gold}>⬡ 0</Text>
          {onToggleMute && (
            <TouchableOpacity onPress={onToggleMute} activeOpacity={0.7} style={s.muteBtn}>
              <Text style={s.muteBtnText}>{muted ? '[MUTED]' : '[SOUND]'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── TONIGHT'S PATRONS ── */}
      <View style={s.padded}>
        <Text style={s.sectionLabel}>TONIGHT'S PATRONS</Text>
        <View style={s.npcList}>
          {npcs.map(npc => (
            <View key={npc.id} style={s.npcRow}>
              <Text style={s.npcName}>{npc.name}</Text>
              <Text style={s.npcMood}>{npc.mood}</Text>
            </View>
          ))}
        </View>

        {/* ── STATS ── */}
        <View style={s.row}>
          {stats.map(stat => (
            <View key={stat.label} style={s.statCard}>
              <Text style={s.statLabel}>{stat.label}</Text>
              <Text style={[s.statValue, stat.warn && { color: C.danger }]}>{stat.value}</Text>
            </View>
          ))}
        </View>

        {/* ── WARNING ── */}
        {daysSince !== null && daysSince >= 2 && (
          <View style={s.warning}>
            <Text style={s.warningText}>
              {daysSince >= 3
                ? "Three days gone. The monster grew. Get in there."
                : "Two days. The dungeon noticed. It has been preparing."}
            </Text>
          </View>
        )}

        {/* ── ZONE SELECTOR ── */}
        <Text style={s.sectionLabel}>ZONE</Text>
        <View style={s.zoneRow}>
          {ZONES_AVAILABLE.map(zoneKey => {
            const active = zoneKey === activeZone;
            const diff   = ZONE_DIFFICULTY[zoneKey];
            return (
              <TouchableOpacity
                key={zoneKey}
                style={[s.zoneBtn, active && s.zoneBtnActive]}
                onPress={() => onZoneChange?.(zoneKey)}
                activeOpacity={0.75}
              >
                <Text style={[s.zoneBtnText, active && s.zoneBtnTextActive]}>
                  {ZONE_LABELS[zoneKey]}
                </Text>
                <Text style={[s.zoneDiff, active && { color: C.accentDark }]}>
                  ×{diff.toFixed(1)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── SESSION SELECTOR ── */}
        <Text style={s.sectionLabel}>CHOOSE YOUR FATE</Text>
        <View style={s.row}>
          {['A', 'B'].map(key => {
            const w = WORKOUTS[key];
            const isSuggested = key === suggested;
            return (
              <TouchableOpacity
                key={key}
                style={[s.sessionCard, { borderColor: isSuggested ? C.accent : C.border }]}
                onPress={() => onStart(key)}
                activeOpacity={0.75}
              >
                {isSuggested && <Text style={[s.nextUp, { color: C.accent }]}>NEXT UP</Text>}
                <Text style={[s.sessionLabel, { color: C.accent }]}>{w.label}</Text>
                <Text style={s.sessionFocus}>{w.focus} · {w.exercises.length} exercises</Text>
                {w.exercises.map(e => (
                  <Text key={e.id} style={s.exercisePreview}>
                    {e.name} <Text style={s.exerciseSets}>{e.sets}×{e.targetReps}</Text>
                  </Text>
                ))}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── FLOOR REMINDER ── */}
        <View style={s.floorCard}>
          <Text style={s.floorText}>Minimum viable dungeon run: show up. That's the whole rule.</Text>
        </View>

        {/* ── NAV ── */}
        <TouchableOpacity style={s.navBtn} onPress={onKillLog}>
          <Text style={s.navBtnText}>KILL LOG (Monster History)</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.navBtn} onPress={onWeight}>
          <Text style={s.navBtnText}>WEIGHT LOG{lastWeight ? ` · ${lastWeight.weight} lbs` : ''}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.navBtn} onPress={onHistory}>
          <Text style={s.navBtnText}>SESSION HISTORY ({log.length})</Text>
        </TouchableOpacity>
      </View>

    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: C.bg },
  content:      { paddingTop: 44, paddingBottom: 48 },

  // Level Milestone Modal
  milestoneOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,10,20,0.95)', zIndex: 999, justifyContent: 'center', padding: 32 },
  milestoneTitle: { fontSize: 36, color: C.accent, fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: 4, textAlign: 'center', marginBottom: 20 },
  milestoneMsg: { fontSize: 16, color: C.text, fontFamily: 'monospace', textAlign: 'center', lineHeight: 26, marginBottom: 40 },
  milestoneBtn: { backgroundColor: '#1a1005', borderColor: C.accentDark, borderWidth: 1, padding: 16 },
  milestoneBtnText: { color: C.accent, fontSize: 16, fontFamily: 'monospace', textAlign: 'center', fontWeight: 'bold' },

  // Scene wrapper — full width, no horizontal padding
  sceneWrapper: { position: 'relative', marginBottom: 0 },
  sceneOverlay: {
    position:       'absolute',
    top:            16,
    right:          16,
    flexDirection:  'row',
    alignItems:     'center',
    gap:            12,
  },
  gold:         { fontSize: 12, color: C.accent, fontFamily: 'monospace', fontWeight: '700', letterSpacing: 1 },
  muteBtn:      { padding: 12, minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center' },
  muteBtnText:  { fontSize: 10, color: C.muted, fontFamily: 'monospace', letterSpacing: 1 },

  // Padded content below scene
  padded:       { paddingHorizontal: 20, paddingTop: 14 },

  // NPC list
  npcList:      { marginBottom: 18 },
  npcRow:       { marginBottom: 8, borderLeftWidth: 2, borderLeftColor: C.border, paddingLeft: 10 },
  npcName:      { fontSize: 12, fontWeight: '700', color: C.text, fontFamily: 'monospace', marginBottom: 1 },
  npcMood:      { fontSize: 11, color: C.muted, fontFamily: 'monospace', fontStyle: 'italic' },

  // Stats
  row:          { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard:     { flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, padding: 12 },
  statLabel:    { fontSize: 10, color: C.dim, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4, fontFamily: 'monospace' },
  statValue:    { fontSize: 20, fontWeight: '700', color: C.text, fontFamily: 'monospace' },

  // Warning
  warning:      { backgroundColor: C.dangerDark, borderWidth: 1, borderColor: C.danger, padding: 12, marginBottom: 16 },
  warningText:  { fontSize: 12, color: C.danger, fontFamily: 'monospace' },

  // Section label
  sectionLabel: { fontSize: 11, color: C.muted, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10, fontFamily: 'monospace' },

  // Zone
  zoneRow:          { flexDirection: 'row', gap: 10, marginBottom: 16 },
  zoneBtn:          { flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, padding: 10 },
  zoneBtnActive:    { borderColor: C.accent, backgroundColor: '#1a0e00' },
  zoneBtnText:      { fontSize: 11, color: C.muted, fontFamily: 'monospace', marginBottom: 2 },
  zoneBtnTextActive:{ color: C.accent },
  zoneDiff:         { fontSize: 10, color: C.dim, fontFamily: 'monospace' },

  // Session cards — no rounded corners (game element)
  sessionCard:    { flex: 1, backgroundColor: C.card, borderWidth: 2, padding: 14 },
  nextUp:         { fontSize: 9, letterSpacing: 1, marginBottom: 4, fontFamily: 'monospace' },
  sessionLabel:   { fontSize: 20, fontWeight: '700', marginBottom: 4, fontFamily: 'monospace' },
  sessionFocus:   { fontSize: 12, color: C.muted, marginBottom: 10, fontFamily: 'monospace' },
  exercisePreview:{ fontSize: 11, color: C.dim, marginBottom: 2, fontFamily: 'monospace' },
  exerciseSets:   { color: C.dim },

  // Floor + nav — no rounded corners
  floorCard:    { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, padding: 12, marginBottom: 16 },
  floorText:    { fontSize: 12, color: C.muted, fontFamily: 'monospace' },
  navBtn:       { borderWidth: 1, borderColor: C.accent, padding: 14, marginBottom: 10 },
  navBtnText:   { fontSize: 13, color: C.accent, fontFamily: 'monospace', letterSpacing: 1 },
});
