import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const C = {
  bg: '#08080c',
  card: '#0f0f14',
  border: '#1e1e28',
  text: '#e8d8b8',
  dim: '#504860',
  accent: '#f0a030',
  accentDark: '#a06010',
};

// Generates obituary lines based on the monster
const generateObituary = (kill) => {
  const { monsterName, killingBlow } = kill;
  const verb = killingBlow?.weight ? `with ${killingBlow.weight}lb` : `with`;
  const ex = killingBlow?.exercise || 'determination';
  const reps = killingBlow?.reps ? `× ${killingBlow.reps}` : '';
  
  const pool = [
    `It had concerns. Those concerns are no longer relevant.`,
    `It was confused before. Now it is deceased. Still confused.`,
    `The paperwork has been filed and subsequently ignored.`,
    `A tragic loss for its immediate family. We have not notified them.`,
    `Not even the dungeon remembers its name.`,
  ];
  return `${monsterName} — Defeated ${new Date(kill.date).toLocaleDateString()} — ${ex} ${verb} ${reps}. ${pool[Math.floor(Math.random()*pool.length)]}`;
};

export default function KillLogScreen({ onBack }) {
  const [kills, setKills] = useState([]);

  useEffect(() => {
    AsyncStorage.getItem('iq_kill_log').then(data => {
      if (data) setKills(JSON.parse(data).reverse()); // newest first
    });
  }, []);

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Text style={s.title}>KILL LOG</Text>
        <Text style={s.subtitle}>TOTAL KILLS: {kills.length}</Text>
      </View>

      <FlatList
        data={kills}
        keyExtractor={(item, idx) => idx.toString()}
        contentContainerStyle={s.list}
        renderItem={({ item }) => (
          <View style={s.card}>
            <Text style={s.obituary}>{generateObituary(item)}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={s.empty}>The dungeon is waiting.</Text>}
      />

      <TouchableOpacity style={s.backBtn} onPress={onBack}>
        <Text style={s.backBtnText}>RETURN TO TAVERN</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  header: { padding: 20, paddingTop: 50, borderBottomWidth: 1, borderBottomColor: C.border, alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', color: C.danger, fontFamily: 'monospace', letterSpacing: 4 },
  subtitle: { fontSize: 12, color: C.accent, fontFamily: 'monospace', letterSpacing: 1, marginTop: 8 },
  list: { padding: 20 },
  card: { backgroundColor: C.card, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: C.border },
  obituary: { fontSize: 13, color: '#aaa', fontFamily: 'monospace', lineHeight: 20 },
  empty: { fontSize: 14, color: C.dim, fontFamily: 'monospace', textAlign: 'center', marginTop: 40 },
  backBtn: { padding: 20, alignItems: 'center', borderTopWidth: 1, borderTopColor: C.border },
  backBtnText: { color: C.accent, fontFamily: 'monospace', fontSize: 14, fontWeight: 'bold', letterSpacing: 1 }
});
