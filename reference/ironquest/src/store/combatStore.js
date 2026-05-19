// [IQ] src/store/combatStore.js — Zustand combat state

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { calculateDamage, resolveMonsterAttack, makeCombatLogEntry } from '../engine/combat';
import { pickLine, ANNOUNCER } from '../data/announcer';

const MONSTER_PERSIST_KEY = 'iq_monster_state';

const INITIAL_STATE = {
  // Monster identity
  monsterName:         'Unknown Entity',
  monsterArchetype:    'humanoid',
  monsterRarity:       'common',
  monsterZone:         'shallow_crypts',
  monsterSeed:         0,

  // Monster combat stats
  monsterHp:           100,
  monsterMaxHp:        100,
  monsterEnraged:      false,
  monsterAttackDamage: 8,

  // Multi-monster session tracking
  monsterKillCount:  0,
  slainMonsterName:  '',

  // Player
  playerHp:     100,
  playerMaxHp:  100,
  playerTier:   'beginner',

  // Session
  sessionId:         null,
  currentExerciseId: null,
  currentSetIndex:   0,
  timerSeconds:      0,
  timerActive:       false,
  timeoutCardUsed:   false,
  combatLog:         [],

  // Damage tracking (for animated damage numbers in UI)
  lastPlayerDamage:  0,
  lastPlayerDamageTier: 'TICKLE',
  lastMonsterDamage: 0,

  // phase: 'idle' | 'set_window' | 'monster_attack' | 'rest' | 'grace' | 'monster_slain' | 'defeated' | 'victory'
  phase: 'idle',
};

export const useCombatStore = create((set, get) => ({
  ...INITIAL_STATE,

  /**
   * Initialize a new combat session.
   * Checks AsyncStorage for a persisted (enraged) monster from a prior defeat.
   * Initialize a new combat session or restore from existing state.
   */
  initCombat: async ({ sessionId, monster, playerMaxHp, playerTier, currentSetIndex = 0, sessionModifier = null, isFirstSession = false }) => {
    let monsterHp      = monster.maxHp;
    let monsterMaxHp   = monster.maxHp;
    let monsterEnraged = false;
    let attackDamage   = monster.atk;

    // Apply Modifier effects natively
    if (sessionModifier?.id === 'organized') {
      monsterMaxHp = Math.round(monsterMaxHp * 1.15);
      monsterHp = monsterMaxHp;
      console.log('[IQ] Applied "Organized" modifier (+15% HP)');
    }
    if (sessionModifier?.id === 'apologizes') {
      monsterMaxHp = Math.round(monsterMaxHp * 0.80);
      monsterHp = monsterMaxHp;
      console.log('[IQ] Applied "Apologizes" modifier (-20% HP)');
    }

    try {
      const saved = await AsyncStorage.getItem(MONSTER_PERSIST_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Only restore if it's the same monster (same seed)
        if (parsed.seed === monster.seed) {
          monsterHp      = parsed.hp;
          monsterEnraged = parsed.enraged ?? false;
          attackDamage   = parsed.attackDamage ?? monster.atk;
          console.log('[IQ] Restored persisted monster — enraged:', monsterEnraged);
        } else {
          // Different monster — clear stale persist
          AsyncStorage.removeItem(MONSTER_PERSIST_KEY).catch(() => {});
          console.log('[IQ] Stale monster persist cleared');
        }
      }
    } catch (e) {
      console.log('[IQ] No persisted monster state, starting fresh');
    }

    const log = [];
    if (monsterEnraged) {
      log.push(makeCombatLogEntry('system', 0, pickLine(ANNOUNCER.enragedReturn), 0));
    }

    set({
      ...INITIAL_STATE,
      sessionId,
      monsterName:         monster.name,
      monsterArchetype:    monster.archetype,
      monsterRarity:       monster.rarity,
      monsterZone:         monster.zone,
      monsterSeed:         monster.seed ?? 0,
      monsterHp,
      monsterMaxHp,
      monsterEnraged,
      monsterAttackDamage: attackDamage,
      monsterKillCount:    0,
      slainMonsterName:    '',
      playerMaxHp,
      playerHp:            playerMaxHp,
      playerTier:          playerTier ?? 'beginner',
      currentSetIndex,
      phase:               'set_window',
      combatLog:           log,
      sessionModifier,
      isFirstSession,
      sessionStats:        { damage: 0, kills: 0, prs: 0 },
    });
  },

  /**
   * Player logs a set. Calculates damage, applies it to monster, then calculates monster
   * counter-attack damage. Sets phase to 'monster_turn' — the component's useEffect
   * will call beginPlayerTurn() after MONSTER_TURN_DURATION_MS elapses.
   * currentSetIndex is NOT incremented here; beginPlayerTurn() handles that.
   */
  logSet: ({ weight, reps, bestE1RM, targetReps, exercise, isLastSet = false }) => {
    const state = get();
    const turn = state.currentSetIndex + 1;

    let damage = calculateDamage({
      weight,
      reps,
      bestE1RM,
      userTier: state.playerTier,
      targetReps,
    });

    if (state.phase === 'grace') {
      damage = Math.max(1, Math.round(damage * 0.5));
      console.log('[IQ] Set logged during grace! 50% damage penalty applied.');
    }

    if (state.sessionModifier?.id === 'ghost') {
      damage = Math.max(1, Math.round(damage * 1.1));
      console.log('[IQ] Applied Ghost modifier (+10% damage)');
    }

    if (state.isFirstSession) {
      damage = Math.max(1, Math.round(damage * 1.5));
      console.log('[IQ] Applied First Session Endowed Progress (x1.5 damage)');
    }

    const hpPct = damage / state.monsterMaxHp;
    let tierStr = 'TICKLE';
    let pool = ANNOUNCER.damageTickle;
    if (hpPct >= 0.18) { tierStr = 'WHOOP_ASS'; pool = ANNOUNCER.damageWhoopAss; }
    else if (hpPct >= 0.10) { tierStr = 'CRACKS'; pool = ANNOUNCER.damageCracks; }
    else if (hpPct >= 0.05) { tierStr = 'HURTS'; pool = ANNOUNCER.damageHurts; }
    else if (hpPct >= 0.02) { tierStr = 'BIFF'; pool = ANNOUNCER.damageBiff; }

    if (state.sessionModifier?.id === 'unhinged') {
      pool = ANNOUNCER.unhinged;
    }

    const newMonsterHp = Math.max(0, state.monsterHp - damage);
    const hitLine = pickLine(pool);
    const logEntry = makeCombatLogEntry('player', damage, hitLine, turn);

    console.log(`[IQ] Player set: ${weight}x${reps} → ${damage} damage. Monster HP: ${state.monsterHp} → ${newMonsterHp}`);

    // Last set of the workout — always end in victory regardless of monster HP
    const recordKill = async (name, archetype, rarity, exerciseName, weight, reps) => {
      try {
        const existingStr = await AsyncStorage.getItem('iq_kill_log');
        const existing = existingStr ? JSON.parse(existingStr) : [];
        existing.push({
          monsterName: name,
          archetype,
          rarity,
          date: new Date().toISOString(),
          killingBlow: { exercise: exerciseName, weight, reps }
        });
        await AsyncStorage.setItem('iq_kill_log', JSON.stringify(existing));
      } catch (e) { console.log(e); }
    };

    if (isLastSet) {
      AsyncStorage.removeItem(MONSTER_PERSIST_KEY).catch(() => {});
      const killedByForce = newMonsterHp > 0; // monster still had HP — forced kill
      const finalHp = killedByForce ? 0 : newMonsterHp;
      const victoryLine = pickLine(ANNOUNCER.forcedKill);
      
      // Feature 15: Kill Log
      recordKill(state.monsterName, state.monsterArchetype, state.monsterRarity, exercise.name, weight, reps);

      set((s) => ({
        monsterHp: finalHp,
        lastPlayerDamage: damage,
        lastPlayerDamageTier: tierStr,
        lastMonsterDamage: 0,
        phase: 'victory',
        sessionStats: { ...s.sessionStats, damage: s.sessionStats.damage + damage },
        combatLog: [...s.combatLog, logEntry, makeCombatLogEntry('system', 0, victoryLine, turn)],
      }));
      return;
    }

    if (newMonsterHp <= 0) {
      // Mid-session kill — show slain overlay then respawn
      const slainName = state.monsterName;
      
      // Feature 15: Kill Log
      recordKill(state.monsterName, state.monsterArchetype, state.monsterRarity, exercise.name, weight, reps);

      set((s) => ({
        monsterHp: 0,
        lastPlayerDamage: damage,
        lastPlayerDamageTier: tierStr,
        lastMonsterDamage: 0,
        phase: 'monster_slain',
        slainMonsterName: slainName,
        monsterKillCount: s.monsterKillCount + 1,
        sessionStats: { ...s.sessionStats, damage: s.sessionStats.damage + damage, kills: s.sessionStats.kills + 1 },
        combatLog: [...s.combatLog, logEntry, makeCombatLogEntry('system', 0, pickLine(ANNOUNCER.monsterSlain), turn)],
      }));
      return;
    }

    // Calculate monster counter-attack (damage value computed now, displayed during monster_turn phase)
    const monsterDamage = resolveMonsterAttack(state.monsterAttackDamage, state.monsterEnraged);
    const newPlayerHp = Math.max(0, state.playerHp - monsterDamage);
    const monsterLine = pickLine(ANNOUNCER.monsterAttack);
    const monsterEntry = makeCombatLogEntry('monster', monsterDamage, monsterLine, turn);

    console.log(`[IQ] Monster counter: ${monsterDamage} damage. Player HP: ${state.playerHp} → ${newPlayerHp}`);

    if (newPlayerHp <= 0) {
      // Defeat — persist monster state so the return fight picks up where we left off
      const persistedState = {
        seed:         state.monsterSeed,
        hp:           newMonsterHp,
        enraged:      true,
        attackDamage: Math.round(state.monsterAttackDamage * 1.4),
      };
      AsyncStorage.setItem(MONSTER_PERSIST_KEY, JSON.stringify(persistedState)).catch(() => {});

      set((s) => ({
        monsterHp: newMonsterHp,
        playerHp: 0,
        lastPlayerDamage: damage,
        lastPlayerDamageTier: tierStr,
        lastMonsterDamage: monsterDamage,
        phase: 'defeated',
        sessionStats: { ...s.sessionStats, damage: s.sessionStats.damage + damage },
        combatLog: [...s.combatLog, logEntry, monsterEntry, makeCombatLogEntry('system', 0, pickLine(ANNOUNCER.defeat), turn)],
      }));
      return;
    }

    // Normal survival — enter monster_attack phase, beginRest() will increment currentSetIndex
    set((s) => ({
      monsterHp: newMonsterHp,
      playerHp: newPlayerHp,
      lastPlayerDamage: damage,
      lastPlayerDamageTier: tierStr,
      lastMonsterDamage: monsterDamage,
      phase: 'monster_attack',
      sessionStats: { ...s.sessionStats, damage: s.sessionStats.damage + damage },
      combatLog: [...s.combatLog, logEntry, monsterEntry],
    }));
  },

  /**
   * Player's turn timer expired (after grace window). Monster gets a bonus attack.
   * Sets phase to 'monster_attack' — component's useEffect will call beginRest().
   * currentSetIndex is NOT incremented here; beginRest() handles that.
   */
  skipTurn: () => {
    console.log('[IQ] skipTurn called');
    const state = get();
    const turn = state.currentSetIndex + 1;

    const monsterDamage = resolveMonsterAttack(state.monsterAttackDamage, state.monsterEnraged);
    const newPlayerHp = Math.max(0, state.playerHp - monsterDamage);
    const skipLine = pickLine(ANNOUNCER.skipTurn);
    const skipEntry = makeCombatLogEntry('system', 0, skipLine, turn);
    const monsterEntry = makeCombatLogEntry('monster', monsterDamage, pickLine(ANNOUNCER.monsterAttack), turn);

    console.log(`[IQ] Turn skipped. Monster bonus attack: ${monsterDamage}. Player HP: ${state.playerHp} → ${newPlayerHp}`);

    if (newPlayerHp <= 0) {
      const persistedState = {
        seed:         state.monsterSeed,
        hp:           state.monsterHp,
        enraged:      true,
        attackDamage: Math.round(state.monsterAttackDamage * 1.4),
      };
      AsyncStorage.setItem(MONSTER_PERSIST_KEY, JSON.stringify(persistedState)).catch(() => {});

      set((s) => ({
        playerHp: 0,
        lastPlayerDamage: 0,
        lastMonsterDamage: monsterDamage,
        phase: 'defeated',
        combatLog: [...s.combatLog, skipEntry, monsterEntry, makeCombatLogEntry('system', 0, pickLine(ANNOUNCER.defeat), turn)],
      }));
      return;
    }

    // Survival — enter monster_attack phase, beginRest() will increment currentSetIndex
    set((s) => ({
      playerHp: newPlayerHp,
      lastPlayerDamage: 0,
      lastMonsterDamage: monsterDamage,
      phase: 'monster_attack',
      combatLog: [...s.combatLog, skipEntry, monsterEntry],
    }));
  },

  /**
   * Called by the component after MONSTER_ATTACK_DURATION_MS elapses.
   * Increments currentSetIndex and opens the player's next rest window.
   */
  beginRest: () => set((s) => ({
    phase: 'rest',
    currentSetIndex: s.currentSetIndex + 1,
  })),

  /**
   * Called by the component after restSeconds elapses.
   */
  beginSetWindow: () => set({ phase: 'set_window' }),

  /**
   * Called by the component after setWindowSeconds elapses.
   */
  beginGrace: () => set({ phase: 'grace' }),

  /**
   * Use the one-time timeout card. Pauses timer, no penalty.
   */
  useTimeoutCard: () => {
    const state = get();
    if (state.timeoutCardUsed) return;
    set({ timeoutCardUsed: true, timerActive: false });
    console.log('[IQ] Timeout card used');
  },

  setTimer: (seconds) => set({ timerSeconds: seconds }),
  setTimerActive: (active) => set({ timerActive: active }),
  setPhase: (phase) => set({ phase }),
  setCurrentExercise: (exerciseId) => set({ currentExerciseId: exerciseId }),

  /** Append a single entry to the combat log (used for PR announcements from the component) */
  appendLog: (entry) => set((s) => ({ 
    combatLog: [...s.combatLog, entry],
    sessionStats: { ...s.sessionStats, prs: s.sessionStats.prs + 1 }
  })),

  /**
   * Spawn the next monster after a mid-session kill (monster_slain phase).
   * Restores player to full HP and opens the next player turn.
   */
  respawnMonster: (monster) => {
    let monsterMaxHp = monster.maxHp;
    if (get().sessionModifier?.id === 'organized') monsterMaxHp = Math.round(monsterMaxHp * 1.15);
    if (get().sessionModifier?.id === 'apologizes') monsterMaxHp = Math.round(monsterMaxHp * 0.80);

    console.log(`[IQ] respawnMonster: ${monster.name} hp=${monsterMaxHp} atk=${monster.atk} (no enraged bleed)`);
    set((s) => ({
      monsterName:         monster.name,
      monsterArchetype:    monster.archetype,
      monsterRarity:       monster.rarity,
      monsterZone:         monster.zone,
      monsterSeed:         monster.seed ?? 0,
      monsterHp:           monsterMaxHp,
      monsterMaxHp:        monsterMaxHp,
      monsterEnraged:      false,
      monsterAttackDamage: monster.atk,
      slainMonsterName:    '',
      playerHp:            s.playerMaxHp,
      currentSetIndex:     s.currentSetIndex + 1,  // advance past the killing set
      phase:               'set_window',
      combatLog: [...s.combatLog, makeCombatLogEntry('system', 0, 'A new enemy approaches.', s.currentSetIndex + 1)],
    }));
  },

  /**
   * Reset combat HP/phase/log. Does NOT affect workout set data — that lives in
   * ActiveWorkout local state and AsyncStorage, so it survives defeat/return cycles.
   */
  resetCombat: () => set({ ...INITIAL_STATE }),
}));
