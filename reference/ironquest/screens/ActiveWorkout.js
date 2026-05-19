import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  TextInput, StyleSheet, KeyboardAvoidingView, Platform, Animated, Alert, Modal
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import { WORKOUTS, buildInitialSets, SESSION_MODIFIERS } from '../src/data';
import { useCombatStore } from '../src/store/combatStore';
import { CombatTimer } from '../src/engine/timer';
import { getExerciseMax, checkPersonalRecord, makeCombatLogEntry } from '../src/engine/combat';
import { pickLine, ANNOUNCER } from '../src/data/announcer';
import MonsterSprite from '../renderer/MonsterSprite';
import { generateMonster } from '../src/engine/monsterGen';
import { DispatchCardView } from '../src/components/DispatchCard';

// How long the "MONSTER ATTACKING" phase displays before YOUR TURN opens.
// In milliseconds — easy to tune.
const MONSTER_ATTACK_DURATION_MS = 8000;

// AsyncStorage key for in-progress session data (survives defeat/return cycles)
const WIP_KEY = (session) => `iq_wip_${session}`;

const C = {
  bg:          '#08080c',
  card:        '#0f0f14',
  border:      '#1e1e28',
  text:        '#e8d8b8',
  muted:       '#8878a0',
  dim:         '#504860',
  accent:      '#f0a030',
  accentDark:  '#a06010',
  danger:      '#cc2800',
  hpMonster:   '#cc2800',
  hpPlayer:    '#f0a030',
  logPlayer:   '#f0a030',
  logMonster:  '#cc4422',
  logSystem:   '#706080',
  timerNormal: '#f0a030',
  timerGrace:  '#cc2800',
};

// Maps a flat currentSetIndex to { exercise, setIndex }.
// Returns null when all sets are complete (index >= total sets).
// Handles noWeight exercises identically to weighted ones — noWeight is a
// display/input concern, not a set-counting concern.
function getCurrentSetInfo(currentSetIndex, exercises) {
  if (currentSetIndex < 0) return null;
  let rem = currentSetIndex;
  for (const exercise of exercises) {
    if (rem < exercise.sets) return { exercise, setIndex: rem };
    rem -= exercise.sets;
  }
  return null; // currentSetIndex >= total sets → all done
}

// Count how many sets are marked done across all exercises, in order.
// Used to restore currentSetIndex from persisted sets state.
function countDoneSets(setsState, exercises) {
  let count = 0;
  for (const exercise of exercises) {
    for (const set of (setsState[exercise.id] ?? [])) {
      if (set.done) count++;
    }
  }
  return count;
}

function normalizeTargetReps(val) {
  if (typeof val === 'number') return val;
  if (val === 'Max') return 20;
  if (val === '45s') return 15;
  const n = parseInt(val, 10);
  return isNaN(n) ? 10 : n;
}

export default function ActiveWorkout({ session, zone = 'shallow_crypts', prevEntry, onFinish, onCancel, workoutLog = [] }) {
  const workout = WORKOUTS[session];

  const [sets, setSets]               = useState(() => buildInitialSets(workout));
  const [notes, setNotes]             = useState('');
  const [startTime]                   = useState(Date.now());
  const [showFullWorkout, setShowFullWorkout] = useState(false);
  const [timerDisplay, setTimerDisplay]       = useState(0);

  // Modifiers & History (Feature 6 & 10)
  const [sessionModifier, setSessionModifier] = useState(null);
  const [showModifierOverlay, setShowModifierOverlay] = useState(false);
  const [sessionHistory, setSessionHistory]   = useState([]);

  // Timed Exercise state
  const [plankState, setPlankState] = useState('idle'); // 'idle' | 'countdown' | 'running'
  const [plankCount, setPlankCount] = useState(0);
  const plankIntervalRef = useRef(null);

  // Dispatch variables
  const [showDispatch, setShowDispatch] = useState(false);
  const dispatchRef = useRef(null);
  const [playerLevel, setPlayerLevel] = useState(1);

  useEffect(() => {
    AsyncStorage.getItem('iq_last_seen_level').then(l => {
        if (l) setPlayerLevel(parseInt(l, 10));
    });
  }, []);

  const handleShareDispatch = async () => {
    try {
      if (!dispatchRef.current) return;
      const uri = await dispatchRef.current.capture();
      if (!(await Sharing.isAvailableAsync())) {
         Alert.alert("Sharing not available", "Sharing isn't available on this device.");
         return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'Dungeon Dispatch',
        UTI: 'public.png'
      });
    } catch (err) {
      console.log("[IQ] Share failed", err);
    }
  };

  const handleSaveDispatch = async () => {
    try {
      if (!dispatchRef.current) return;
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        const req = await MediaLibrary.requestPermissionsAsync();
        if (req.status !== 'granted') {
           Alert.alert('Permission needed', 'Allow camera roll access to save your dispatch.');
           return;
        }
      }
      const uri = await dispatchRef.current.capture();
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert('Dispatch Filed', 'The dungeon appreciates your transparency.');
    } catch (err) {
      console.log("[IQ] Save failed", err);
    }
  };
  // Animated values
  const playerDmgOpacity = useRef(new Animated.Value(0)).current;
  const monsterDmgOpacity = useRef(new Animated.Value(0)).current;
  const monsterHpAnim = useRef(new Animated.Value(1)).current;
  const playerHpAnim  = useRef(new Animated.Value(1)).current;
  const graceFlashAnim = useRef(new Animated.Value(1)).current;
  const phaseBarAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    return () => { if (plankIntervalRef.current) clearInterval(plankIntervalRef.current); };
  }, []);

  // Skip save on the very first render (before we've loaded WIP or entered data)
  const isFirstRender = useRef(true);

  const {
    playerHp, playerMaxHp,
    monsterHp, monsterMaxHp, monsterEnraged,
    monsterName, monsterArchetype, monsterRarity,
    monsterKillCount, slainMonsterName,
    combatLog, phase,
    currentSetIndex,
    lastPlayerDamage, lastPlayerDamageTier, lastMonsterDamage,
    initCombat, logSet, skipTurn, beginRest, beginSetWindow, beginGrace,
    resetCombat, appendLog, respawnMonster,
  } = useCombatStore();

  const sessionSeedRef = useRef(null);

  // ── Derived values ────────────────────────────────────────────────────────
  const totalSets     = workout.exercises.reduce((a, e) => a + e.sets, 0);
  const completedSets = workout.exercises.reduce((a, e) => a + sets[e.id].filter(s => s.done).length, 0);
  const progress      = completedSets / totalSets;
  const allDone       = completedSets === totalSets;
  const currentSetInfo = getCurrentSetInfo(currentSetIndex, workout.exercises);
  const canConfirm     = (phase === 'set_window' || phase === 'grace' || phase === 'rest') && currentSetInfo !== null;

  // ── Mount: load WIP then init combat ─────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      // Seed: stable per session+date so same monster appears all day,
      // but changes the next calendar day (encourages daily play).
      const today = new Date();
      const daySeed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
      const sessionSeed = (session === 'A' ? 1 : 2) * daySeed;
      sessionSeedRef.current = sessionSeed;
      const monster = generateMonster({ zone, sessionSeed });
      console.log(`[IQ] Monster: ${monster.name} (${monster.archetype}/${monster.rarity}) HP:${monster.hp} ATK:${monster.atk}`);

      let restoredSetIndex = 0;
      let activeModifier = null;
      try {
        const historyStr = await AsyncStorage.getItem('iq_session_history');
        if (historyStr) setSessionHistory(JSON.parse(historyStr));

        // Modifier logic
        const modKey = `iq_modifier_${session}`;
        const savedMod = await AsyncStorage.getItem(modKey);
        if (savedMod) {
          activeModifier = JSON.parse(savedMod);
        } else if (workoutLog.length > 0 && Math.random() < 0.40) {
          // 40% chance if not first session
          activeModifier = SESSION_MODIFIERS[Math.floor(Math.random() * SESSION_MODIFIERS.length)];
          await AsyncStorage.setItem(modKey, JSON.stringify(activeModifier));
        }

        if (activeModifier) {
          setSessionModifier(activeModifier);
          if (restoredSetIndex === 0) setShowModifierOverlay(true);
        }

        const saved = await AsyncStorage.getItem(WIP_KEY(session));
        if (saved) {
          const { sets: savedSets, notes: savedNotes } = JSON.parse(saved);
          setSets(savedSets);
          if (savedNotes) setNotes(savedNotes);
          restoredSetIndex = countDoneSets(savedSets, workout.exercises);
          if (restoredSetIndex > 0) setShowModifierOverlay(false); // already well into workout
          console.log(`[IQ] Restored WIP for session ${session}: ${restoredSetIndex} sets done`);
        }
      } catch (e) {
        console.log('[IQ] No WIP found, starting fresh');
      }

      const isFirstSession = workoutLog.length === 0;

      initCombat({
        sessionId:       session,
        monster,
        playerMaxHp:     100,
        playerTier:      'beginner',
        currentSetIndex: restoredSetIndex,
        sessionModifier: activeModifier,
        isFirstSession,
      });
    };
    init();
    return () => CombatTimer.clear();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Persist WIP whenever sets or notes change (skip first render) ─────────
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    AsyncStorage.setItem(WIP_KEY(session), JSON.stringify({ sets, notes })).catch(() => {});
  }, [sets, notes]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 1. set_window phase ───────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'set_window') return;
    if (showModifierOverlay) return; // Feature 6: delay timer

    const info = getCurrentSetInfo(currentSetIndex, workout.exercises);
    if (!info) return; // all sets done
    const setWindowSeconds = info.exercise.setWindowSeconds ?? 120;
    
    phaseBarAnim.setValue(1);
    Animated.timing(phaseBarAnim, { toValue: 0, duration: setWindowSeconds * 1000, useNativeDriver: false }).start();

    CombatTimer.start(setWindowSeconds, {
      onTick: (rem) => setTimerDisplay(rem),
      onEnd:  () => beginGrace(),
    });
    return () => CombatTimer.clear();
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 2. grace phase ────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'grace') return;
    phaseBarAnim.setValue(1);
    Animated.timing(phaseBarAnim, { toValue: 0, duration: 9000, useNativeDriver: false }).start();

    CombatTimer.start(9, {
      onTick: (rem) => setTimerDisplay(rem),
      onEnd:  () => { console.log('[IQ] Grace expired — calling skipTurn()'); skipTurn(); },
    });
    return () => CombatTimer.clear();
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 3. monster_attack phase ───────────────────────────────────────
  useEffect(() => {
    if (phase !== 'monster_attack') return;
    const duration = Math.round(MONSTER_ATTACK_DURATION_MS / 1000);
    let secondsLeft = duration;
    setTimerDisplay(secondsLeft);
    phaseBarAnim.setValue(0);
    Animated.timing(phaseBarAnim, { toValue: 1, duration: MONSTER_ATTACK_DURATION_MS, useNativeDriver: false }).start();
    
    const interval = setInterval(() => {
      secondsLeft -= 1;
      setTimerDisplay(Math.max(0, secondsLeft));
    }, 1000);
    const timeout = setTimeout(() => beginRest(), MONSTER_ATTACK_DURATION_MS);
    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 4. rest phase ─────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'rest') return;
    const info = getCurrentSetInfo(currentSetIndex, workout.exercises);
    if (!info) return;
    const baseRest = info.exercise.restSeconds ?? 90;
    const restSeconds = sessionModifier?.id === 'restless' ? Math.round(baseRest * 0.6) : baseRest;

    phaseBarAnim.setValue(1);
    Animated.timing(phaseBarAnim, { toValue: 0, duration: restSeconds * 1000, useNativeDriver: false }).start();

    CombatTimer.start(restSeconds, {
      onTick: (rem) => setTimerDisplay(rem),
      onEnd:  () => beginSetWindow(),
    });
    return () => CombatTimer.clear();
  }, [phase, sessionModifier]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Player damage number flash ────────────────────────────────────────────
  useEffect(() => {
    if (!lastPlayerDamage) return;
    playerDmgOpacity.setValue(1);
    Animated.timing(playerDmgOpacity, { toValue: 0, duration: 1800, useNativeDriver: true }).start();
  }, [lastPlayerDamage]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Monster damage number flash ───────────────────────────────────────────
  useEffect(() => {
    if (!lastMonsterDamage) return;
    monsterDmgOpacity.setValue(1);
    Animated.timing(monsterDmgOpacity, { toValue: 0, duration: 1800, useNativeDriver: true }).start();
  }, [lastMonsterDamage]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Monster HP bar animation ──────────────────────────────────────────────
  useEffect(() => {
    Animated.timing(monsterHpAnim, {
      toValue: monsterMaxHp > 0 ? monsterHp / monsterMaxHp : 0,
      duration: 400,
      useNativeDriver: false, // width is a layout property
    }).start();
  }, [monsterHp]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Player HP bar animation ───────────────────────────────────────────────
  useEffect(() => {
    Animated.timing(playerHpAnim, {
      toValue: playerMaxHp > 0 ? playerHp / playerMaxHp : 0,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [playerHp]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Grace flash animation ─────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'grace') { graceFlashAnim.stopAnimation(); graceFlashAnim.setValue(1); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(graceFlashAnim, { toValue: 0.15, duration: 350, useNativeDriver: true }),
        Animated.timing(graceFlashAnim, { toValue: 1,    duration: 350, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Monster slain: wait 1500ms then respawn ───────────────────────────────
  useEffect(() => {
    if (phase !== 'monster_slain') return;
    const nextSeed = (sessionSeedRef.current ?? 0) + monsterKillCount * 9973;
    const timeout = setTimeout(() => {
      const nextMonster = generateMonster({ zone, sessionSeed: nextSeed });
      console.log(`[IQ] Respawn monster #${monsterKillCount}: ${nextMonster.name}`);
      respawnMonster(nextMonster);
    }, 1500);
    return () => clearTimeout(timeout);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Actions ───────────────────────────────────────────────────────────────
  function handleChange(exId, i, field, val) {
    setSets(prev => ({
      ...prev,
      [exId]: prev[exId].map((s, j) => j === i ? { ...s, [field]: val } : s),
    }));
  }

  function handleConfirmSetWith(forcedReps) {
    if (!canConfirm || !currentSetInfo) return;
    const { exercise, setIndex } = currentSetInfo;
    const currentSet = sets[exercise.id]?.[setIndex];
    const weight     = parseFloat(currentSet?.weight) || 0;
    
    // For timed exercises, take the forcedReps from state, else use user input string
    const repsStr    = forcedReps !== undefined ? forcedReps : currentSet?.reps;
    const reps       = parseFloat(repsStr) || 0;
    
    const effectiveWeight = exercise.noWeight ? 1 : weight;
    const targetReps = normalizeTargetReps(exercise.targetReps);

    const bestE1RM = getExerciseMax(exercise.id, workoutLog);
    const isPR     = checkPersonalRecord(exercise.id, effectiveWeight, reps, workoutLog);

    // Mark the set done in local state
    setSets(prev => ({
      ...prev,
      [exercise.id]: prev[exercise.id].map((s, j) => j === setIndex ? { ...s, done: true, reps: String(reps) } : s),
    }));

    const isLastSet = currentSetIndex === totalSets - 1;
    logSet({ weight: effectiveWeight, reps, bestE1RM, targetReps, exercise, isLastSet });

    if (isPR) {
      appendLog(makeCombatLogEntry('system', 0, pickLine(ANNOUNCER.personalRecord), currentSetIndex + 1));
      console.log('[IQ] PR detected for', exercise.id);
    }
    // No timer start — player_turn useEffect handles it when beginPlayerTurn fires
  }

  function handleConfirmSet() {
    handleConfirmSetWith(undefined);
  }

  // ── Finish session & save stats ───────────────────────────────────────────
  function finish() {
    AsyncStorage.removeItem(WIP_KEY(session)).catch(() => {});
    const duration = Math.round((Date.now() - startTime) / 60000);
    const state = useCombatStore.getState();
    
    // Save session stats for feature 10
    const newStats = {
      date: new Date().toISOString(),
      damage: state.sessionStats.damage,
      kills: state.sessionStats.kills,
      prs: state.sessionStats.prs,
      duration,
    };
    AsyncStorage.setItem('iq_session_history', JSON.stringify([...sessionHistory, newStats])).catch(() => {});

    onFinish({ sets, notes, duration });
  }

  // ── Phase banner config ───────────────────────────────────────────────────
  function getPhaseBanner() {
    // Feature 11: Final Encounter
    if (totalSets - currentSetIndex <= 3 && totalSets > 3 && (phase === 'set_window' || phase === 'rest' || phase === 'grace' || phase === 'monster_attack')) {
      return { bg: '#2a0000', text: `⚔ FINAL ENCOUNTER ⚔ — ${timerDisplay}s`, color: '#ff4444', flash: phase === 'grace' };
    }

    if (phase === 'monster_attack') {
      return { bg: '#1a0000', text: `MONSTER ATTACKING — ${timerDisplay}s`, color: C.hpMonster, flash: false };
    }
    if (phase === 'grace') {
      return { bg: '#1a0000', text: `⚠ ATTACK OR LOSE YOUR TURN — ${timerDisplay}s`, color: C.hpMonster, flash: true };
    }
    if (phase === 'set_window') {
      return { bg: '#1a0e00', text: `YOUR TURN — ${timerDisplay}s`, color: C.logPlayer, flash: false };
    }
    if (phase === 'rest') {
      return { bg: '#14141a', text: `REST PERIOD — ${timerDisplay}s`, color: C.dim, flash: false };
    }
    if (phase === 'monster_slain') {
      return { bg: '#0a1400', text: 'ENEMY SLAIN', color: '#40ff80', flash: false };
    }
    if (phase === 'victory') {
      return { bg: '#1a0e00', text: 'VICTORY', color: C.hpPlayer, flash: false };
    }
    if (phase === 'defeated') {
      return { bg: '#1a0000', text: 'DEFEATED', color: C.hpMonster, flash: false };
    }
    return null; // 'idle'
  }

  const banner = getPhaseBanner();

  // ── Combat log helpers ────────────────────────────────────────────────────
  const logActorColor = (actor) => {
    if (actor === 'player')  return C.logPlayer;
    if (actor === 'monster') return C.logMonster;
    return C.logSystem;
  };
  const logActorSigil = (actor) => {
    if (actor === 'player')  return 'ATK';
    if (actor === 'monster') return 'HIT';
    return 'SYS';
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.screen}>

        {/* ── STICKY HEADER ───────────────────────────────────────────── */}
        <View style={s.header}>
          {/* Title row */}
          <View style={s.headerTop}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={s.headerSub}>COMBAT · {workout.label}</Text>
              <Text style={s.headerTitle} numberOfLines={1}>{monsterName}</Text>
              <Text style={s.headerRarity}>{monsterRarity.toUpperCase()} {monsterArchetype.toUpperCase()}</Text>
            </View>
            <TouchableOpacity style={s.cancelBtn} onPress={() => {
              const lastSystemLine = [...combatLog].reverse().find(e => e.actor === 'system')?.text;
              const msg = lastSystemLine ?? 'Your progress will be saved.';
              Alert.alert('Leave Combat?', msg, [
                { text: 'Save & Exit', style: 'default', onPress: () => { CombatTimer.clear(); resetCombat(); onCancel(); } },
                { text: 'Abandon Session', style: 'destructive', onPress: () => { CombatTimer.clear(); resetCombat(); AsyncStorage.removeItem(WIP_KEY(session)).catch(() => {}); onCancel(); } },
                { text: 'Keep Fighting', style: 'cancel' },
              ]);
            }}>
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>

          {/* HP bars with floating damage numbers */}
          <View style={s.hpBarsWrapper}>
            <View style={s.hpBars}>
              {/* Monster HP */}
              <View style={s.hpRow}>
                <Text style={s.hpLabel}>{monsterEnraged ? 'BOSS⚡' : 'BOSS'}</Text>
                <View style={s.hpTrack}>
                  <Animated.View style={[
                    s.hpFill,
                    { backgroundColor: C.hpMonster },
                    { width: monsterHpAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
                  ]} />
                </View>
                <Text style={s.hpNum}>{monsterHp}</Text>
              </View>
              {/* Feature 11: Final Encounter HP Pulsing Text */}
              {totalSets - currentSetIndex <= 3 && totalSets > 3 && monsterHp > 0 && (
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 2 }}>
                  <Text style={{ fontFamily: 'monospace', color: monsterHp / monsterMaxHp < 0.25 ? '#ff4444' : C.dim, fontSize: 10 }}>
                    MONSTER VITALITY: {Math.round((monsterHp / monsterMaxHp) * 100)}%
                  </Text>
                </View>
              )}
              {/* Player HP */}
              <View style={s.hpRow}>
                <Text style={s.hpLabel}>YOU</Text>
                <View style={s.hpTrack}>
                  <Animated.View style={[
                    s.hpFill,
                    { backgroundColor: C.hpPlayer },
                    { width: playerHpAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
                  ]} />
                </View>
                <Text style={s.hpNum}>{playerHp}</Text>
              </View>
            </View>

            {/* Damage number overlays — pointerEvents='none' so they never block touches */}
            <View style={s.damageLayer} pointerEvents="none">
              <Animated.Text style={[
                s.dmgPlayer, 
                lastPlayerDamageTier === 'WHOOP_ASS' && { fontSize: 40, color: '#ffd700' },
                lastPlayerDamageTier === 'CRACKS' && { color: C.accent, fontWeight: '900' },
                lastPlayerDamageTier === 'HURTS' && { color: C.accent },
                lastPlayerDamageTier === 'BIFF' && { color: '#ffffff' },
                lastPlayerDamageTier === 'TICKLE' && { fontSize: 16, color: '#888888' },
                { opacity: playerDmgOpacity }
              ]}>
                +{lastPlayerDamage}
              </Animated.Text>
              <Animated.Text style={[s.dmgMonster, { opacity: monsterDmgOpacity }]}>
                -{lastMonsterDamage}
              </Animated.Text>
            </View>
          </View>

          {/* Session progress */}
          <View style={s.progressTrack}>
            <View style={[s.progressFill, { width: `${progress * 100}%`, backgroundColor: workout.color }]} />
          </View>
          <Text style={s.progressText}>{completedSets}/{totalSets} sets done</Text>

          {/* Phase banner */}
          {banner && (
            <View style={[s.phaseBanner, { backgroundColor: banner.bg }]}>
              {banner.flash ? (
                <Animated.Text style={[s.phaseBannerText, { color: banner.color, opacity: graceFlashAnim }]}>
                  {banner.text}
                </Animated.Text>
              ) : (
                <Text style={[s.phaseBannerText, { color: banner.color }]}>{banner.text}</Text>
              )}
              {/* Universal Timer Bar */}
              <View style={s.phaseBarTrack}>
                <Animated.View style={[s.phaseBarFill, { 
                   backgroundColor: banner.color, 
                   width: phaseBarAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
                }]} />
              </View>
            </View>
          )}
        </View>
        {/* ── END STICKY HEADER ───────────────────────────────────────── */}

        <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 48 }}>

          {/* Monster sprite */}
          <View style={[s.monsterContainer, totalSets - currentSetIndex <= 3 && totalSets > 3 && { transform: [{ scale: 1.15 }] }]}>
            <MonsterSprite archetype={monsterArchetype} rarity={monsterRarity} enraged={monsterEnraged} hpPercent={monsterMaxHp > 0 ? monsterHp / monsterMaxHp : 1.0} pixelSize={8} />
          </View>

          {/* Combat log — always at top of scroll content */}
          {combatLog.length > 0 && (
            <View style={s.combatLogContainer}>
              {combatLog.slice(-3).map((entry, i) => (
                <Text key={i} style={[s.combatLogLine, { color: logActorColor(entry.actor) }]}>
                  [{logActorSigil(entry.actor)}] {entry.text}
                </Text>
              ))}
            </View>
          )}

          {/* ── ACTIVE SET PANEL OR RECAP ─────────────────────────────── */}
          {phase === 'victory' ? (
            <View style={s.activeSetPanel}>
              <Text style={[s.activeExName, { color: workout.color }]}>SESSION COMPLETE</Text>
              <Text style={s.activeExMeta}>The dungeon yields.</Text>
              <View style={{ marginTop: 12, padding: 12, backgroundColor: C.border, borderWidth: 1, borderColor: '#333' }}>
                <Text style={{ fontFamily: 'monospace', color: C.text, fontSize: 14, marginBottom: 8 }}>SESSION RECAP</Text>
                
                {(() => {
                  const state = useCombatStore.getState();
                  const totalDmgThisSession = state.sessionStats.damage;
                  
                  // Feature 10 trend calculations
                  let avgStr = '─'; // neutral indicator
                  let avgColor = C.dim;
                  
                  if (sessionHistory.length > 0) {
                     const recent = sessionHistory.slice(-10);
                     const avgDamage = recent.reduce((sum, h) => sum + h.damage, 0) / recent.length;
                     if (totalDmgThisSession > avgDamage * 1.05) { avgStr = '▲'; avgColor = C.accent; }
                  }

                  const pbDamage = sessionHistory.length > 0 ? Math.max(...sessionHistory.map(h => h.damage)) : totalDmgThisSession;
                  const isNewPb = sessionHistory.length > 0 && totalDmgThisSession > pbDamage;

                  return (
                    <>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                        <Text style={{ fontFamily: 'monospace', color: C.muted, fontSize: 12 }}>TOTAL DAMAGE</Text>
                        <Text style={{ fontFamily: 'monospace', color: C.text, fontSize: 12 }}>{totalDmgThisSession} <Text style={{ color: avgColor }}>{avgStr}</Text></Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                        <Text style={{ fontFamily: 'monospace', color: C.muted, fontSize: 12 }}>PB SESSION DMG</Text>
                        <Text style={{ fontFamily: 'monospace', color: isNewPb ? C.accent : C.dim, fontSize: 12 }}>{isNewPb ? totalDmgThisSession : pbDamage}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                        <Text style={{ fontFamily: 'monospace', color: C.muted, fontSize: 12 }}>MONSTERS DEFEATED</Text>
                        <Text style={{ fontFamily: 'monospace', color: C.text, fontSize: 12 }}>{state.sessionStats.kills}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                        <Text style={{ fontFamily: 'monospace', color: C.muted, fontSize: 12 }}>PRs SHATTERED</Text>
                        <Text style={{ fontFamily: 'monospace', color: state.sessionStats.prs > 0 ? C.accent : C.text, fontSize: 12 }}>{state.sessionStats.prs}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ fontFamily: 'monospace', color: C.muted, fontSize: 12 }}>DURATION</Text>
                        <Text style={{ fontFamily: 'monospace', color: C.text, fontSize: 12 }}>{Math.round((Date.now() - startTime) / 60000)}m</Text>
                      </View>
                    </>
                  );
                })()}
              </View>
            </View>
          ) : currentSetInfo ? (
            <View style={s.activeSetPanel}>
              <Text style={s.activeExName}>{currentSetInfo.exercise.name}</Text>
              <Text style={s.activeExMeta}>
                {currentSetInfo.exercise.equipment} · {currentSetInfo.exercise.sets}×{currentSetInfo.exercise.targetReps} · {currentSetInfo.exercise.restSeconds}s rest
              </Text>
              <Text style={s.setIndicator}>
                SET {currentSetInfo.setIndex + 1} OF {currentSetInfo.exercise.sets}
              </Text>

              {/* Prev session data */}
              {(() => {
                const prev = prevEntry?.sets?.[currentSetInfo.exercise.id]?.[currentSetInfo.setIndex];
                if (!prev?.done) return null;
                return (
                  <View style={s.prevDataRow}>
                    {!currentSetInfo.exercise.noWeight && prev.weight ? (
                      <Text style={s.prevDataText}>prev: {prev.weight}lb</Text>
                    ) : null}
                    {prev.reps ? <Text style={s.prevDataText}>prev: {prev.reps} reps</Text> : null}
                  </View>
                );
              })()}

              {/* Large inputs or Timed container */}
              {currentSetInfo.exercise.timedExercise ? (
                <View style={s.activeInputRow}>
                   {plankState === 'idle' && (
                     <TouchableOpacity style={[s.activeInput, { flex: 1, backgroundColor: '#1a0e00' }]} onPress={startPlankCountdown}>
                       <Text style={{ fontFamily: 'monospace', color: C.accent, fontWeight: '700', fontSize: 16, textAlign: 'center' }}>
                         START {currentSetInfo.exercise.targetSeconds}s TIMER
                       </Text>
                     </TouchableOpacity>
                   )}
                   {plankState === 'countdown' && (
                     <View style={[s.activeInput, { flex: 1, backgroundColor: '#111', justifyContent: 'center' }]}>
                       <Text style={{ fontFamily: 'monospace', color: C.accent, fontWeight: '900', fontSize: 32, textAlign: 'center' }}>
                         {plankCount}
                       </Text>
                     </View>
                   )}
                   {plankState === 'running' && (
                     <View style={[s.activeInputRow, { flex: 1, marginBottom: 0 }]}>
                       <View style={[s.activeInput, { flex: 1, backgroundColor: '#221000', borderColor: C.accentDark, justifyContent: 'center' }]}>
                         <Text style={{ fontFamily: 'monospace', color: '#ffcc00', fontWeight: '900', fontSize: 24, textAlign: 'center' }}>
                           {plankCount}s
                         </Text>
                       </View>
                       <TouchableOpacity style={[s.activeInput, { flex: 0.3, backgroundColor: '#000', justifyContent: 'center' }]} onPress={() => finishPlank()}>
                         <Text style={{ fontFamily: 'monospace', color: C.muted, fontWeight: '700', fontSize: 14, textAlign: 'center' }}>
                           DONE
                         </Text>
                       </TouchableOpacity>
                     </View>
                   )}
                </View>
              ) : (
                <View style={s.activeInputRow}>
                  {!currentSetInfo.exercise.noWeight && (
                    <TextInput
                      style={s.activeInput}
                      value={sets[currentSetInfo.exercise.id]?.[currentSetInfo.setIndex]?.weight ?? ''}
                      onChangeText={v => handleChange(currentSetInfo.exercise.id, currentSetInfo.setIndex, 'weight', v)}
                      placeholder="lb"
                      placeholderTextColor="#333"
                      keyboardType="numeric"
                      keyboardAppearance="dark"
                    />
                  )}
                  <TextInput
                    style={[s.activeInput, currentSetInfo.exercise.noWeight && { flex: 1 }]}
                    value={sets[currentSetInfo.exercise.id]?.[currentSetInfo.setIndex]?.reps ?? ''}
                    onChangeText={v => handleChange(currentSetInfo.exercise.id, currentSetInfo.setIndex, 'reps', v)}
                    placeholder="reps"
                    placeholderTextColor="#333"
                    keyboardType="numeric"
                    keyboardAppearance="dark"
                  />
                </View>
              )}

              {/* Confirm button */}
              <TouchableOpacity
                style={[s.confirmBtn, !canConfirm && s.confirmBtnDisabled]}
                onPress={handleConfirmSet}
                disabled={!canConfirm}
              >
                <Text style={[s.confirmBtnText, !canConfirm && s.confirmBtnTextDisabled]}>
                  {phase === 'monster_attack' ? 'WAIT — MONSTER ATTACKING' : 'CONFIRM SET ✓'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* All sets done — show finish prompt */
            <View style={s.activeSetPanel}>
              <Text style={[s.activeExName, { color: workout.color }]}>All sets complete.</Text>
              <Text style={s.activeExMeta}>Finish the workout below.</Text>
            </View>
          )}

          {/* ── VIEW FULL WORKOUT (collapsible, read-only) ────────────── */}
          <TouchableOpacity style={s.fullWorkoutToggle} onPress={() => setShowFullWorkout(v => !v)}>
            <Text style={s.fullWorkoutToggleText}>
              {showFullWorkout ? 'HIDE WORKOUT ▲' : 'VIEW FULL WORKOUT ▼'}
            </Text>
          </TouchableOpacity>

          {showFullWorkout && (
            <View style={s.fullWorkoutList}>
              {workout.exercises.map(exercise => {
                const exSets   = sets[exercise.id];
                const done     = exSets.filter(s => s.done).length;
                const complete = done === exercise.sets;
                return (
                  <View key={exercise.id} style={s.fullWorkoutExercise}>
                    <Text style={[s.fullWorkoutExName, complete && { color: workout.color }]}>
                      {complete ? '✓ ' : ''}{exercise.name}
                      <Text style={s.fullWorkoutExMeta}>  {done}/{exercise.sets}</Text>
                    </Text>
                    {exSets.map((set, i) => (
                      <Text key={i} style={[s.fullWorkoutSet, set.done && { color: C.muted }]}>
                        {set.done ? '✓' : '·'} Set {i + 1}
                        {set.done && !exercise.noWeight && set.weight ? ` — ${set.weight}lb` : ''}
                        {set.done && set.reps ? ` × ${set.reps}` : ''}
                      </Text>
                    ))}
                  </View>
                );
              })}
            </View>
          )}

          {/* Notes */}
          <View style={s.notesContainer}>
            <TextInput
              style={s.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="Notes (optional)..."
              placeholderTextColor="#444"
              multiline
              keyboardAppearance="dark"
            />
          </View>

          {/* Finish button */}
          <View style={s.finishContainer}>
            <TouchableOpacity
              style={[s.finishBtn, (allDone || phase === 'victory') && { backgroundColor: workout.color, borderWidth: 0 }]}
              onPress={finish}
            >
              <Text style={[s.finishText, (allDone || phase === 'victory') && { color: '#080808' }]}>
                {allDone ? 'Finish Workout' : `Finish (${completedSets}/${totalSets} sets)`}
              </Text>
            </TouchableOpacity>

            {phase === 'victory' && (
              <TouchableOpacity
                style={[s.finishBtn, { backgroundColor: '#1a1005', borderColor: '#f0a030', marginTop: 12 }]}
                onPress={() => setShowDispatch(true)}
              >
                <Text style={[s.finishText, { color: '#f0a030' }]}>VIEW DISPATCH CARD</Text>
              </TouchableOpacity>
            )}
          </View>

        </ScrollView>

        {/* ── MONSTER SLAIN OVERLAY ───────────────────────────────────── */}
        {phase === 'monster_slain' && (
          <View style={s.slainOverlay}>
            <Text style={s.slainName}>{slainMonsterName}</Text>
            <Text style={s.slainLabel}>DEFEATED</Text>
            <Text style={s.slainSub}>The next enemy is already here.</Text>
          </View>
        )}

        {/* ── DEFEAT OVERLAY ──────────────────────────────────────────── */}
        {phase === 'defeated' && (
          <View style={s.defeatOverlay}>
            <Text style={s.defeatTitle}>DEFEATED</Text>
            <Text style={s.defeatMsg}>
              {combatLog.filter(e => e.actor === 'system').slice(-1)[0]?.text ?? 'Back to the tavern.'}
            </Text>
            <TouchableOpacity
              style={s.defeatBtn}
              onPress={() => { resetCombat(); onCancel(); }}
            >
              <Text style={s.defeatBtnText}>RETURN TO TAVERN</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── MODIFIER OVERLAY ──────────────────────────────────────────── */}
        {showModifierOverlay && sessionModifier && (
          <View style={s.modifierOverlay}>
            <Text style={s.modifierTitle}>SESSION MODIFIER</Text>
            <Text style={s.modifierName}>{sessionModifier.name.toUpperCase()}</Text>
            <Text style={s.modifierMsg}>{sessionModifier.text}</Text>
            <TouchableOpacity
              style={s.modifierBtn}
              onPress={() => setShowModifierOverlay(false)}
            >
              <Text style={s.modifierBtnText}>PROCEED TO DUNGEON</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── DISPATCH MODAL ──────────────────────────────────────────── */}
        <Modal visible={showDispatch} transparent={true} animationType="fade">
          <View style={s.dispatchModal}>
            <Text style={s.dispatchModalTitle}>DISPATCH PREVIEW</Text>
            
            {/* We capture this exact View hierarchy */}
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <DispatchCardView
                ref={dispatchRef}
                sessionStats={{
                  kills: monsterKillCount,
                  damage: combatLog.filter(x => x.actor === 'player').reduce((acc, curr) => acc + curr.damage, 0),
                  prs: combatLog.filter(x => x.text?.includes('PR')).length,
                }}
                workoutLog={[]} // stub for now
                modifier={sessionModifier}
                level={playerLevel}
              />
            </View>

            <View style={s.dispatchControls}>
              <TouchableOpacity style={s.dispatchBtn} onPress={handleShareDispatch}>
                <Text style={s.dispatchBtnText}>SHARE</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.dispatchBtn} onPress={handleSaveDispatch}>
                <Text style={s.dispatchBtnText}>SAVE</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.dispatchBtn, { borderColor: '#444' }]} onPress={() => setShowDispatch(false)}>
                <Text style={[s.dispatchBtnText, { color: '#aaa' }]}>CLOSE</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  screen:        { flex: 1, backgroundColor: C.bg },

  // Header
  header:        { backgroundColor: C.bg, paddingHorizontal: 20, paddingTop: 52, paddingBottom: 0, borderBottomWidth: 1, borderBottomColor: C.border },
  headerTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  headerSub:     { fontSize: 10, color: C.dim, letterSpacing: 2, fontFamily: 'monospace' },
  headerTitle:   { fontSize: 17, fontWeight: '700', color: C.text, fontFamily: 'monospace' },
  headerRarity:  { fontSize: 9, color: C.muted, letterSpacing: 2, fontFamily: 'monospace', marginTop: 1 },
  cancelBtn:     { borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, paddingVertical: 6 },
  cancelText:    { color: C.muted, fontSize: 12, fontFamily: 'monospace' },

  // HP bars — game elements, no rounded corners
  hpBarsWrapper: { position: 'relative', marginBottom: 10 },
  hpBars:        {},
  hpRow:         { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  hpLabel:       { width: 56, fontSize: 10, color: C.muted, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: 1 },
  hpTrack:       { flex: 1, height: 5, backgroundColor: C.border, overflow: 'hidden' },
  hpFill:        { height: '100%' },
  hpNum:         { width: 32, fontSize: 10, color: C.dim, fontFamily: 'monospace', textAlign: 'right' },

  // Floating damage numbers
  damageLayer:   { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 60 },
  dmgPlayer:     { fontSize: 26, fontWeight: '900', color: C.logPlayer, fontFamily: 'monospace' },
  dmgMonster:    { fontSize: 26, fontWeight: '900', color: C.hpMonster, fontFamily: 'monospace' },

  // Progress — game element, no rounded corners
  progressTrack: { height: 3, backgroundColor: C.border, marginBottom: 6 },
  progressFill:  { height: '100%' },
  progressText:  { fontSize: 12, color: C.muted, fontFamily: 'monospace', paddingBottom: 8 },

  // Phase banner
  phaseBanner:     { marginHorizontal: -20, paddingHorizontal: 20, paddingVertical: 10, marginBottom: 0 },
  phaseBannerText: { fontSize: 13, fontWeight: '700', fontFamily: 'monospace', letterSpacing: 1, textAlign: 'center' },

  // Monster sprite
  monsterContainer: { alignItems: 'center', paddingTop: 16, paddingBottom: 8 },

  // Combat log
  combatLogContainer: { marginHorizontal: 20, marginTop: 14, marginBottom: 4 },
  combatLogLine:      { fontSize: 11, fontFamily: 'monospace', lineHeight: 19, letterSpacing: 0.3 },

  // Active set panel — game element, no rounded corners
  activeSetPanel:     { marginHorizontal: 20, marginTop: 16, marginBottom: 8 },
  activeExName:       { fontSize: 20, fontWeight: '700', color: C.text, fontFamily: 'monospace', marginBottom: 4 },
  activeExMeta:       { fontSize: 12, color: C.muted, fontFamily: 'monospace', marginBottom: 6 },
  setIndicator:       { fontSize: 11, color: C.dim, fontFamily: 'monospace', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 },
  prevDataRow:        { flexDirection: 'row', gap: 16, marginBottom: 8 },
  prevDataText:       { fontSize: 12, color: C.dim, fontFamily: 'monospace', fontStyle: 'italic' },
  activeInputRow:     { flexDirection: 'row', gap: 12, marginBottom: 14 },
  activeInput:        { flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, color: C.text, fontFamily: 'monospace', fontSize: 28, fontWeight: '700', paddingVertical: 16, paddingHorizontal: 12, textAlign: 'center' },
  confirmBtn:         { backgroundColor: '#1a0e00', borderWidth: 1, borderColor: C.accentDark, paddingVertical: 18, alignItems: 'center' },
  confirmBtnDisabled: { backgroundColor: C.card, borderColor: C.border, opacity: 0.4 },
  confirmBtnText:     { fontSize: 15, fontWeight: '700', color: C.accent, fontFamily: 'monospace', letterSpacing: 1 },
  confirmBtnTextDisabled: { color: C.dim },

  // Full workout collapsible
  fullWorkoutToggle:     { marginHorizontal: 20, marginTop: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.border },
  fullWorkoutToggleText: { fontSize: 11, color: C.dim, fontFamily: 'monospace', letterSpacing: 1 },
  fullWorkoutList:       { marginHorizontal: 20, marginBottom: 8 },
  fullWorkoutExercise:   { marginBottom: 12 },
  fullWorkoutExName:     { fontSize: 13, fontWeight: '700', color: C.muted, fontFamily: 'monospace', marginBottom: 4 },
  fullWorkoutExMeta:     { fontSize: 11, color: C.dim, fontWeight: '400' },
  fullWorkoutSet:        { fontSize: 11, color: C.dim, fontFamily: 'monospace', lineHeight: 18, paddingLeft: 8 },

  // Notes
  notesContainer: { margin: 20, marginBottom: 0 },
  notesInput:     { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, color: C.muted, fontFamily: 'monospace', fontSize: 13, padding: 12, minHeight: 60 },

  // Finish button
  finishContainer: { padding: 20 },
  finishBtn:       { padding: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: 'center' },
  finishText:      { fontSize: 14, fontWeight: '700', color: C.dim, letterSpacing: 1, textTransform: 'uppercase', fontFamily: 'monospace' },

  // Monster slain overlay
  slainOverlay:  { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,10,0,0.95)', alignItems: 'center', justifyContent: 'center', zIndex: 100, paddingHorizontal: 32 },
  slainName:     { fontSize: 18, fontWeight: '700', color: '#e8d8b8', fontFamily: 'monospace', textAlign: 'center', letterSpacing: 2, marginBottom: 12 },
  slainLabel:    { fontSize: 42, fontWeight: '900', color: '#40ff80', fontFamily: 'monospace', letterSpacing: 6, marginBottom: 16 },
  slainSub:      { fontSize: 12, color: '#506050', fontFamily: 'monospace', textAlign: 'center', fontStyle: 'italic' },

  // Defeat overlay
  defeatOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(8,8,12,0.97)', alignItems: 'center', justifyContent: 'center', zIndex: 100, paddingHorizontal: 32 },
  defeatTitle:   { fontSize: 28, fontWeight: '700', color: C.danger, fontFamily: 'monospace', letterSpacing: 4, marginBottom: 16 },
  defeatMsg:     { fontSize: 13, color: C.muted, fontFamily: 'monospace', textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  defeatBtn:     { borderWidth: 1, borderColor: C.border, paddingHorizontal: 24, paddingVertical: 12 },
  defeatBtnText: { fontSize: 14, color: C.text, fontFamily: 'monospace', letterSpacing: 1 },

  // Modifier overlay
  modifierOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(5,3,0,0.95)', alignItems: 'center', justifyContent: 'center', zIndex: 100, paddingHorizontal: 32 },
  modifierTitle:   { fontSize: 14, fontWeight: '700', color: C.accentDark, fontFamily: 'monospace', letterSpacing: 2, marginBottom: 8 },
  modifierName:    { fontSize: 24, fontWeight: '900', color: C.accent, fontFamily: 'monospace', letterSpacing: 2, textAlign: 'center', marginBottom: 16 },
  modifierMsg:     { fontSize: 13, color: '#aa8866', fontFamily: 'monospace', textAlign: 'center', lineHeight: 22, fontStyle: 'italic', marginBottom: 32 },
  modifierBtn:     { backgroundColor: '#221100', borderWidth: 1, borderColor: C.accentDark, paddingHorizontal: 24, paddingVertical: 12 },
  modifierBtnText: { fontSize: 14, color: C.accent, fontFamily: 'monospace', fontWeight: '700', letterSpacing: 1 },

  // Dispatch Modal
  dispatchModal: { flex: 1, backgroundColor: 'rgba(5,3,0,0.98)', justifyContent: 'center' },
  dispatchModalTitle: { fontSize: 18, color: C.accent, fontFamily: 'monospace', textAlign: 'center', letterSpacing: 2, marginTop: 40, marginBottom: 20 },
  dispatchControls: { flexDirection: 'row', justifyContent: 'space-evenly', padding: 20, marginBottom: 30 },
  dispatchBtn: { backgroundColor: '#1a1005', borderWidth: 1, borderColor: C.accentDark, paddingVertical: 12, paddingHorizontal: 20 },
  dispatchBtnText: { color: C.accent, fontSize: 14, fontFamily: 'monospace', fontWeight: 'bold' }
});
