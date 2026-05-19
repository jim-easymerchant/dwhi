import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateSetArray } from './engine/combat';

export const SESSION_MODIFIERS = [
  { id: 'double_gold', name: 'Double Gold Session', text: 'The dungeon is feeling generous. This is not a trap. Probably.' },
  { id: 'organized', name: 'The Monsters Are Organized', text: 'They have a union now. This is your fault.' },
  { id: 'restless', name: 'Restless Dungeon', text: 'The dungeon is impatient. So are you, apparently.' },
  { id: 'unhinged', name: 'The Announcer Is Having A Day', text: '...I CAN SEE YOUR SOUL...' },
  { id: 'ghost', name: 'Ghost of a Previous Adventurer', text: 'Someone died here. They are helping. Do not ask questions.' },
  { id: 'apologizes', name: 'The Dungeon Apologizes', text: 'Management received feedback. Adjustments were made. Do not get used to this.' }
];

export const WORKOUTS = {
  A: {
    label: 'Session A',
    focus: 'Push',
    color: '#f0a030',
    exercises: [
      { id: 'goblet',  name: 'Goblet Squat',          equipment: '53lb Kettlebell', sets: 4, targetReps: 10,    restSeconds: 90,  attribute: 'Strength' },
      { id: 'bench',   name: 'DB Bench Press',         equipment: 'Dumbbells',      sets: 4, targetReps: 10,    restSeconds: 90,  attribute: 'Strength' },
      { id: 'rdl',     name: 'Romanian Deadlift',      equipment: '53lb Kettlebell', sets: 3, targetReps: 12,    restSeconds: 90,  attribute: 'Strength' },
      { id: 'press',   name: 'DB Shoulder Press',      equipment: 'Dumbbells',      sets: 3, targetReps: 10,    restSeconds: 75,  attribute: 'Stamina'  },
      { id: 'plank',   name: 'Plank',                  equipment: 'Bodyweight',     sets: 3, targetReps: '45s', targetSeconds: 45, restSeconds: 60,  attribute: 'Endurance', noWeight: true, timedExercise: true },
    ],
  },
  B: {
    label: 'Session B',
    focus: 'Pull',
    color: '#40a8d0',
    exercises: [
      { id: 'trap',    name: 'Trap Bar Deadlift',    equipment: 'Trap Bar',       sets: 4, targetReps: 8,     restSeconds: 120, attribute: 'Strength' },
      { id: 'pullup',  name: 'Pull-ups',             equipment: 'Pull-up Bar',    sets: 4, targetReps: 'Max', restSeconds: 90,  attribute: 'Agility',  noWeight: true },
      { id: 'swing',   name: 'Kettlebell Swing',     equipment: '53lb Kettlebell', sets: 4, targetReps: 15,    restSeconds: 75,  attribute: 'Stamina'  },
      { id: 'row',     name: 'DB Row',               equipment: 'Dumbbells',      sets: 3, targetReps: 12,    restSeconds: 75,  attribute: 'Strength' },
      { id: 'goblet2', name: 'Goblet Squat',         equipment: '53lb Kettlebell', sets: 3, targetReps: 10,    restSeconds: 90,  attribute: 'Strength' },
    ],
  },
};

const WORKOUT_KEY = 'iq_workout_log_v1';
const WEIGHT_KEY  = 'iq_weight_log';

export async function loadWorkoutLog() {
  try {
    const val = await AsyncStorage.getItem(WORKOUT_KEY);
    return val ? JSON.parse(val) : [];
  } catch { return []; }
}

export async function saveWorkoutLog(log) {
  try { await AsyncStorage.setItem(WORKOUT_KEY, JSON.stringify(log)); } catch {}
}

export async function loadWeightLog() {
  try {
    const val = await AsyncStorage.getItem(WEIGHT_KEY);
    return val ? JSON.parse(val) : [];
  } catch { return []; }
}

export async function saveWeightLog(log) {
  try { await AsyncStorage.setItem(WEIGHT_KEY, JSON.stringify(log)); } catch {}
}

export function getNextSession(log) {
  if (!log.length) return null;
  return log[log.length - 1].session === 'A' ? 'B' : 'A';
}

export function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function buildInitialSets(workout) {
  return Object.fromEntries(
    workout.exercises.map(e => [
      e.id,
      Array.from({ length: e.sets }, () => ({ reps: '', weight: '', done: false }))
    ])
  );
}
