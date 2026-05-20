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
