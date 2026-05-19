import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';

import TavernScreen   from './screens/TavernScreen';
import ActiveWorkout  from './screens/ActiveWorkout';
import HistoryScreen  from './screens/HistoryScreen';
import WeightLogScreen from './screens/WeightLogScreen';
import KillLogScreen  from './screens/KillLogScreen';
import SplashScreen   from './screens/SplashScreen';

import {
  loadWorkoutLog, saveWorkoutLog,
  loadWeightLog,  saveWeightLog,
} from './src/data';
import { AudioManager } from './src/engine/audio';
import { scheduleDungeonTriggers } from './src/engine/notifications';

const MUTED_KEY = 'iq_muted';

export default function App() {
  const [log,       setLog]       = useState([]);
  const [weightLog, setWeightLog] = useState([]);
  const [view,          setView]          = useState('splash');
  const [activeSession, setActiveSession] = useState(null);
  const [activeZone,    setActiveZone]    = useState('shallow_crypts');
  const [ready,         setReady]         = useState(false);
  const [muted,         setMuted]         = useState(false);

  useEffect(() => {
    Promise.all([
      loadWorkoutLog(),
      loadWeightLog(),
      AsyncStorage.getItem(MUTED_KEY),
    ]).then(([wl, wt, mutedVal]) => {
      setLog(wl);
      setWeightLog(wt);
      const isMuted = mutedVal === 'true';
      setMuted(isMuted);
      AudioManager.setMuted(isMuted);
      setReady(true);
    });
  }, []);

  async function toggleMute() {
    const next = !muted;
    setMuted(next);
    await AudioManager.setMuted(next);
    await AsyncStorage.setItem(MUTED_KEY, String(next));
  }

  if (!ready) return <SplashScreen ready={false} onEnter={null} muted={muted} onToggleMute={toggleMute} />;

  function startWorkout(session, zone = 'shallow_crypts') {
    setActiveSession(session);
    setActiveZone(zone);
    AudioManager.pauseTrack();
    setView('active');
  }

  async function finishWorkout(result) {
    const entry = {
      session:  activeSession,
      date:     new Date().toISOString(),
      sets:     result.sets,
      notes:    result.notes,
      duration: result.duration,
      // Pass stats like PR count for dispatcher? it's in combat store.
    };
    const newLog = [...log, entry];
    setLog(newLog);
    await saveWorkoutLog(newLog);
    AudioManager.resumeTrack();
    setView('home');
    setActiveSession(null);
    scheduleDungeonTriggers();
  }

  async function addWeight(val) {
    const newLog = [...weightLog, { weight: val, date: new Date().toISOString() }];
    setWeightLog(newLog);
    await saveWeightLog(newLog);
  }

  const prevSessionEntry = activeSession
    ? ([...log].reverse().find(e => e.session === activeSession) || null)
    : null;

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      {view === 'active' && (
        <ActiveWorkout
          session={activeSession}
          zone={activeZone}
          prevEntry={prevSessionEntry}
          onFinish={finishWorkout}
          onCancel={() => { 
            AudioManager.resumeTrack(); 
            setView('home'); 
            scheduleDungeonTriggers(); 
          }}
          workoutLog={log}
        />
      )}
      {view === 'history' && (
        <HistoryScreen log={log} onBack={() => setView('home')} />
      )}
      {view === 'weight' && (
        <WeightLogScreen
          weightLog={weightLog}
          onAdd={addWeight}
          onBack={() => setView('home')}
        />
      )}
      {view === 'kill_log' && (
        <KillLogScreen onBack={() => setView('home')} />
      )}
      {view === 'splash' && (
        <SplashScreen
          ready={true}
          onEnter={() => { AudioManager.playTrack('tavern'); setView('home'); }}
          muted={muted}
          onToggleMute={toggleMute}
        />
      )}
      {view === 'home' && (
        <TavernScreen
          log={log}
          weightLog={weightLog}
          onStart={startWorkout}
          onHistory={() => setView('history')}
          onWeight={() => setView('weight')}
          onKillLog={() => setView('kill_log')}
          activeZone={activeZone}
          onZoneChange={setActiveZone}
          muted={muted}
          onToggleMute={toggleMute}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#080808' },
});
