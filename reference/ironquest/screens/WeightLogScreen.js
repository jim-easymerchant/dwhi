import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet } from 'react-native';
import { formatDate } from '../src/data';

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
};

function BackBtn({ onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={{ marginBottom: 24 }}>
      <Text style={{ color: C.accent, fontSize: 13, fontFamily: 'monospace' }}>← BACK</Text>
    </TouchableOpacity>
  );
}

export default function WeightLogScreen({ weightLog, onAdd, onBack }) {
  const [input, setInput] = useState('');
  const sorted = [...weightLog].sort((a, b) => new Date(b.date) - new Date(a.date));
  const first  = weightLog.length ? weightLog.reduce((a, b) => new Date(a.date) < new Date(b.date) ? a : b) : null;
  const last   = sorted[0] || null;
  const change = first && last && first !== last ? (last.weight - first.weight).toFixed(1) : null;

  function submit() {
    const val = parseFloat(input);
    if (isNaN(val) || val < 50 || val > 500) return;
    onAdd(val);
    setInput('');
  }

  const stats = [
    { label: 'Current', value: last  ? `${last.weight} lb`  : '--' },
    { label: 'Start',   value: first ? `${first.weight} lb` : '--' },
    change !== null ? {
      label: 'Change',
      value: `${parseFloat(change) > 0 ? '+' : ''}${change} lb`,
      color: parseFloat(change) < 0 ? C.accent : C.danger,
    } : null,
  ].filter(Boolean);

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <BackBtn onPress={onBack} />
      <Text style={s.heading}>WEIGHT LOG</Text>

      {weightLog.length > 0 && (
        <View style={s.statsRow}>
          {stats.map(stat => (
            <View key={stat.label} style={s.statCard}>
              <Text style={s.statLabel}>{stat.label}</Text>
              <Text style={[s.statValue, stat.color && { color: stat.color }]}>{stat.value}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={s.inputCard}>
        <Text style={s.inputLabel}>LOG TODAY</Text>
        <View style={s.inputRow}>
          <TextInput
            style={s.input}
            value={input}
            onChangeText={setInput}
            placeholder="lbs"
            placeholderTextColor={C.dim}
            keyboardType="numeric"
            keyboardAppearance="dark"
            returnKeyType="done"
            onSubmitEditing={submit}
          />
          <TouchableOpacity style={s.logBtn} onPress={submit}>
            <Text style={s.logBtnText}>LOG</Text>
          </TouchableOpacity>
        </View>
      </View>

      {sorted.map((entry, i) => (
        <View key={i} style={s.entryRow}>
          <Text style={s.entryDate}>{formatDate(entry.date)}</Text>
          <Text style={s.entryWeight}>{entry.weight} lbs</Text>
        </View>
      ))}
      {!weightLog.length && <Text style={s.empty}>No entries yet.</Text>}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen:      { flex: 1, backgroundColor: C.bg },
  content:     { padding: 20, paddingTop: 56, paddingBottom: 48 },
  heading:     { fontSize: 16, fontWeight: '700', color: C.accent, fontFamily: 'monospace', letterSpacing: 2, marginBottom: 20 },
  statsRow:    { flexDirection: 'row', gap: 10, marginBottom: 24 },
  statCard:    { flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, padding: 12 },
  statLabel:   { fontSize: 11, color: C.dim, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4, fontFamily: 'monospace' },
  statValue:   { fontSize: 18, fontWeight: '700', color: C.text, fontFamily: 'monospace' },
  inputCard:   { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, padding: 16, marginBottom: 24 },
  inputLabel:  { fontSize: 12, color: C.dim, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12, fontFamily: 'monospace' },
  inputRow:    { flexDirection: 'row', gap: 10 },
  input:       { flex: 1, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, color: C.text, fontFamily: 'monospace', fontSize: 16, paddingVertical: 12, paddingHorizontal: 14 },
  logBtn:      { backgroundColor: C.accent, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  logBtnText:  { color: C.bg, fontSize: 13, fontWeight: '700', fontFamily: 'monospace' },
  entryRow:    { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: C.border },
  entryDate:   { fontSize: 13, color: C.muted, fontFamily: 'monospace' },
  entryWeight: { fontSize: 15, fontWeight: '700', color: C.text, fontFamily: 'monospace' },
  empty:       { color: C.dim, textAlign: 'center', marginTop: 40, fontSize: 13, fontFamily: 'monospace' },
});
