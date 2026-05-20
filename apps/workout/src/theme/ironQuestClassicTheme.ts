/**
 * Iron Quest Classic — the alternate theme pack.
 *
 * Tone: arcade tavern combat. Stronger amber/red contrast,
 * louder narration, taunt-capable copy. Preserves the original
 * Iron Quest design intent (RisingKB → Dungeon-Crawler-Carl tone)
 * as a player-opt-in alternative to Momentum's quiet mythic
 * default.
 *
 * Important design boundary: even at this theme's loudest, the
 * combat math, momentum decay, persistence layer, and
 * orchestrator are UNCHANGED. The theme is presentational only.
 *
 * Adapted from `reference/ironquest/`. The runtime does not
 * import from that directory; the strings here are
 * reimplementations in Momentum's TypeScript codebase. See
 * `docs/workout-rpg/015-ironquest-port-plan.md`.
 */

import type { ThemePack } from './themeTypes';

// Iron Quest's original amber + red palette. Preserved as direct
// hex literals so the theme pack carries its own colour identity
// without depending on the Momentum tokens. The tavern's amber:
const IQ_AMBER = '#f0a030';
const IQ_AMBER_DARK = '#a06010';
const IQ_DANGER = '#cc2800';
const IQ_BG = '#08080c';
const IQ_HEARTH = '#e08000';

export const ironQuestClassicTheme: ThemePack = {
  id: 'ironquest-classic',
  displayName: 'Iron Quest Classic',
  description: 'Arcade tavern combat. Monsters remember weakness.',
  tone: 'arcade-tavern',
  defaultCampStyle: 'tavern',

  // Iron Quest-derived silhouettes preferred for every category.
  preferredSpriteIds: {
    lesser_fragment: 'ironquest-humanoid',
    hollow: 'ironquest-beast',
    ward: 'ironquest-construct',
  },

  paletteOverrides: {
    ember: IQ_AMBER,
    hearth: IQ_HEARTH,
    // Cool-warm contrast that reads against the amber accents.
    ash: '#1e1e28',
  },

  uiAccent: {
    primary: IQ_AMBER,
    danger: IQ_DANGER,
    textOnAccent: IQ_BG,
  },

  narrationStyle: {
    tone: 'taunting',
    // The theme permits the louder register; the player opted in.
    allowAllCaps: true,
    allowExclamation: true,
    voicePackId: 'tavern-loud',
  },

  enemyFlavor: {
    namePrefix: undefined,
    introCopy: (name) =>
      `${name.split(',')[0].toUpperCase()} WANTS A FIGHT.`,
  },

  motivational: {
    style: 'arcade',
    tagline: 'THE TAVERN WAITS.',
  },

  narration: {
    onQuestStart: () => 'THE TAVERN ROARS.',
    onEnemyDefeat: ({ enemyName, defeatedPhaseCount }) => {
      const short = enemyName.split(',')[0].toUpperCase();
      if (defeatedPhaseCount >= 2) {
        return 'ANOTHER FRAGMENT FALLS. THE FIRE GROWS.';
      }
      return `${short} FELL. THE TAVERN APPROVES.`;
    },
    onComeback: ({ daysSinceLastQuest }) =>
      daysSinceLastQuest >= 7
        ? 'THE BEAST REMEMBERS YOU.'
        : 'BACK FOR MORE. GOOD.',
    onFailure: () => 'STAGGERED. NOT BROKEN.',
    onLongAbsence: () => 'THE TAVERN KEPT YOUR SEAT.',
  },
};
