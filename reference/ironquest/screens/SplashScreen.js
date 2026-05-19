import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AudioManager } from '../src/engine/audio';

const C = {
  bg:         '#08080c',
  accent:     '#f0a030',
  accentDark: '#a06010',
  muted:      '#8878a0',
  dim:        '#504860',
  text:       '#e8d8b8',
};

const VERSION = '1.0.0';

export default function SplashScreen({ ready, onEnter, muted = false, onToggleMute }) {
  useEffect(() => {
    if (ready) AudioManager.playTrack('intro');
  }, [ready]);

  return (
    <View style={s.screen}>
      {onToggleMute && (
        <TouchableOpacity style={s.muteBtn} onPress={onToggleMute} activeOpacity={0.7}>
          <Text style={s.muteBtnText}>{muted ? '[MUTED]' : '[SOUND]'}</Text>
        </TouchableOpacity>
      )}
      <View style={{ flex: 1 }} />

      <View style={s.titleBlock}>
        <Text style={s.titleLine}>IRON</Text>
        <Text style={s.titleLine}>QUEST</Text>
        <View style={s.divider} />
        <Text style={s.tagline}>// the dungeon is waiting.</Text>
      </View>

      <View style={{ flex: 1 }} />

      <View style={s.bottom}>
        <TouchableOpacity
          style={[s.enterBtn, !ready && s.enterBtnDisabled]}
          onPress={ready ? onEnter : undefined}
          disabled={!ready}
          activeOpacity={0.75}
        >
          <Text style={[s.enterBtnText, !ready && s.enterBtnTextDisabled]}>
            {ready ? '[ ENTER THE DUNGEON ]' : '[ LOADING... ]'}
          </Text>
        </TouchableOpacity>
        <Text style={s.version}>v{VERSION}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen:              { flex: 1, backgroundColor: C.bg, paddingHorizontal: 32 },

  titleBlock:          { alignItems: 'center' },
  titleLine:           { fontSize: 52, fontWeight: '900', color: C.accent, fontFamily: 'monospace', letterSpacing: 6, lineHeight: 58 },
  divider:             { width: 80, height: 2, backgroundColor: C.accent, marginTop: 12, marginBottom: 14 },
  tagline:             { fontSize: 14, color: C.accentDark, fontFamily: 'monospace', fontStyle: 'italic' },

  bottom:              { paddingBottom: 40, alignItems: 'center' },
  enterBtn:            { borderWidth: 1, borderColor: C.accent, borderRadius: 8, paddingVertical: 14, paddingHorizontal: 28, marginBottom: 16 },
  enterBtnDisabled:    { borderColor: C.dim, opacity: 0.5 },
  enterBtnText:        { fontSize: 14, fontWeight: '700', color: C.accent, fontFamily: 'monospace', letterSpacing: 2 },
  enterBtnTextDisabled:{ color: C.dim },
  version:             { fontSize: 11, color: C.dim, fontFamily: 'monospace' },
  muteBtn:             { position: 'absolute', top: 60, right: 16, padding: 12, minHeight: 48, minWidth: 48, justifyContent: 'center', alignItems: 'center' },
  muteBtnText:         { fontSize: 11, color: C.muted, fontFamily: 'monospace', letterSpacing: 1 },
});
