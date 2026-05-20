/**
 * Momentum — the default theme pack.
 *
 * Tone: quiet mythic endurance. The Hollow softens through steady
 * work. Anti-shame default copy; warm atmospheric framing; Ember
 * + Hearth as primary motifs.
 *
 * See:
 *   docs/workout-rpg/001-design-bible.md (the canonical voice)
 *   docs/workout-rpg/012-battle-ux-and-feel.md (no exclamation
 *     marks, no ALL CAPS, no streak counters)
 */

import { workoutColors } from './workoutColors';
import type { ThemePack } from './themeTypes';

export const momentumTheme: ThemePack = {
  id: 'momentum',
  displayName: 'Momentum',
  description: 'Quiet mythic endurance. The Hollow softens through steady work.',
  tone: 'quiet-mythic',
  defaultCampStyle: 'hearth',

  preferredSpriteIds: {
    lesser_fragment: 'fragment',
    hollow: 'hollow',
    ward: 'ward',
  },

  // No overrides — Momentum is the canonical palette.
  paletteOverrides: {},

  uiAccent: {
    primary: workoutColors.ember,
    danger: workoutColors.hearth,
    textOnAccent: workoutColors.background,
  },

  narrationStyle: {
    tone: 'warm',
    allowAllCaps: false,
    allowExclamation: false,
    voicePackId: 'mythic-warm',
  },

  enemyFlavor: {
    namePrefix: undefined,
    introCopy: (name) =>
      `${name.split(',')[0]} has settled in the room.`,
  },

  motivational: {
    style: 'anti-shame',
    tagline: 'Steady. The Ember glows.',
  },

  headerCopy: {
    title: 'The Hollow',
    subtitle: 'A quiet camp at the edge of the Stillness',
  },

  ambient: {
    sectionLabel: 'Tonight in the Hollow',
    lines: (tier) => {
      switch (tier) {
        case 'rusted':
          return [
            { heading: 'The ember', mood: 'thin, but it answers' },
            { heading: 'The hearth', mood: 'cool stone, patient' },
            { heading: 'The Vow', mood: 'still here, where you left it' },
          ];
        case 'steady':
          return [
            { heading: 'The ember', mood: 'a steady amber' },
            { heading: 'The hearth', mood: 'warming the near wall' },
            { heading: 'The road outside', mood: 'quieter than yesterday' },
          ];
        case 'ascendant':
          return [
            { heading: 'The ember', mood: 'bright, unhurried' },
            { heading: 'The hearth', mood: 'casting long warm shadows' },
            { heading: 'The Hollow', mood: 'smaller than it once was' },
            { heading: 'The Vow', mood: 'kept' },
          ];
        default:
          return [
            { heading: 'The ember', mood: 'present' },
            { heading: 'The hearth', mood: 'waiting' },
          ];
      }
    },
    sceneFlavor: (tier) =>
      tier === 'rusted'
        ? 'Cool stone, low light. The room listens.'
        : tier === 'steady'
          ? 'Warm light spills from the hearth.'
          : 'The Hollow breathes in. The room is full of slow gold.',
  },

  questCard: {
    sectionLabel: 'Tonight’s work',
    threatLine: (enemyName) => {
      const short = enemyName.split(',')[0];
      return `${short} is settled in the room.`;
    },
    bodyweightLabel: 'Begin · Bodyweight',
    weightedLabel: 'Begin · Weighted',
  },

  panelLabels: {
    echoLog: 'Echoes',
    weightLog: 'Recent work',
    sessionHistory: 'Quests remembered',
    emptyHint: 'Nothing yet. Tomorrow takes care of itself.',
  },

  footer: {
    reassurance: 'Showing up is the rule. The rest is detail.',
  },

  worldState: {
    patronSectionLabel: 'Voices around the fire',
    ambientDensity: 'sparse',
    tavernEnergyBias: -0.35,
    weatherCopy: {
      rain: 'Rain taps softly on the roof tiles.',
      wind: 'A low wind moves outside the door.',
      still: 'The night is still. The hearth answers.',
      snow: 'Snow falls outside, slow and patient.',
      fog: 'Fog leans against the windows.',
      clear: 'The night is clear and quiet.',
    },
  },

  narration: {
    onQuestStart: () => 'The Vow holds.',
    onEnemyDefeat: ({ enemyName, defeatedPhaseCount }) => {
      const short = enemyName.split(',')[0];
      if (defeatedPhaseCount >= 2) {
        return 'The room is quieter than it has been.';
      }
      return `${short} thinned. The room felt taller.`;
    },
    onComeback: ({ daysSinceLastQuest }) =>
      daysSinceLastQuest >= 7
        ? 'The Hollow listened. Welcome back.'
        : 'The Ember still answers.',
    onFailure: () => 'You held the line. The Vow holds.',
    onLongAbsence: () => 'The world remembered the witness.',
  },
};
