import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { WORKOUTS, formatDate } from '../src/data';

const C = {
  bg:     '#08080c',
  card:   '#0f0f14',
  border: '#1e1e28',
  text:   '#e8d8b8',
  muted:  '#8878a0',
  dim:    '#504860',
  accent: '#f0a030',
};

function BackBtn({ onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={{ marginBottom: 24 }}>
      <Text style={{ color: C.accent, fontSize: 13, fontFamily: 'monospace' }}>← BACK</Text>
    </TouchableOpacity>
  );
}

export default function HistoryScreen({ log, onBack }) {
  const [detail, setDetail] = useState(null);

  if (detail !== null) {
    const entry   = log[detail];
    const workout = WORKOUTS[entry.session];
    return (
      <ScrollView style={s.screen} contentContainerStyle={s.content}>
        <BackBtn onPress={() => setDetail(null)} />
        <Text style={[s.title, { color: workout.color }]}>{workout.label} · {workout.focus}</Text>
        <Text style={s.meta}>{formatDate(entry.date)} · {entry.duration}min</Text>
        {workout.exercises.map(ex => (
          <View key={ex.id} style={{ marginBottom: 20 }}>
            <Text style={s.exName}>{ex.name}</Text>
            {(entry.sets[ex.id] || []).map((set, i) => (
              <View key={i} style={s.setDetailRow}>
                <Text style={s.setDetailNum}>S{i + 1}</Text>
                {!ex.noWeight && <Text style={[s.setDetailVal, !set.done && { color: C.dim }]}>{set.weight ? `${set.weight} lb` : '—'}</Text>}
                <Text style={[s.setDetailVal, !set.done && { color: C.dim }]}>{set.reps ? `${set.reps} ${ex.noWeight && ex.targetReps !== 'Max' ? 'sec' : 'reps'}` : '—'}</Text>
                {set.done && <Text style={{ color: workout.color, fontFamily: 'monospace' }}>✓</Text>}
              </View>
            ))}
          </View>
        ))}
        {!!entry.notes && <Text style={s.notes}>"{entry.notes}"</Text>}
      </ScrollView>
    );
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <BackBtn onPress={onBack} />
      <Text style={s.heading}>SESSION HISTORY</Text>
      {!log.length && <Text style={s.empty}>No sessions logged yet.</Text>}
      {[...log].reverse().map((entry, i) => {
        const workout = WORKOUTS[entry.session];
        const total   = workout.exercises.reduce((a, e) => a + e.sets, 0);
        const done    = workout.exercises.reduce((a, e) => a + (entry.sets[e.id]?.filter(s => s.done).length || 0), 0);
        const origIdx = log.length - 1 - i;
        return (
          <TouchableOpacity key={i} style={s.card} onPress={() => setDetail(origIdx)} activeOpacity={0.75}>
            <View style={s.cardRow}>
              <Text style={[s.cardSession, { color: workout.color }]}>{workout.label} · {workout.focus}</Text>
              <Text style={s.cardDuration}>{entry.duration}min</Text>
            </View>
            <Text style={s.cardMeta}>{formatDate(entry.date)} · {done}/{total} sets</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: C.bg },
  content:      { padding: 20, paddingTop: 56, paddingBottom: 48 },
  heading:      { fontSize: 16, fontWeight: '700', color: C.accent, fontFamily: 'monospace', letterSpacing: 2, marginBottom: 20 },
  title:        { fontSize: 18, fontWeight: '700', fontFamily: 'monospace', marginBottom: 4 },
  meta:         { fontSize: 12, color: C.muted, fontFamily: 'monospace', marginBottom: 20 },
  exName:       { fontSize: 13, fontWeight: '700', color: C.text, fontFamily: 'monospace', marginBottom: 8 },
  setDetailRow: { flexDirection: 'row', gap: 16, marginBottom: 4, alignItems: 'center' },
  setDetailNum: { width: 24, fontSize: 13, color: C.dim, fontFamily: 'monospace' },
  setDetailVal: { fontSize: 13, color: C.muted, fontFamily: 'monospace' },
  notes:        { fontSize: 12, color: C.muted, fontStyle: 'italic', fontFamily: 'monospace', marginTop: 8 },
  empty:        { color: C.dim, textAlign: 'center', marginTop: 60, fontFamily: 'monospace' },
  card:         { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 10 },
  cardRow:      { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  cardSession:  { fontWeight: '700', fontFamily: 'monospace' },
  cardDuration: { fontSize: 12, color: C.muted, fontFamily: 'monospace' },
  cardMeta:     { fontSize: 12, color: C.dim, fontFamily: 'monospace' },
});
