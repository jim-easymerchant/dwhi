/**
 * Patron roster — the recurring presences who inhabit the camp.
 *
 * Adapted from the Iron Quest reference `src/data/npcs.js` (which
 * uses DCC-style absurdist NPCs — "Phil (Former Lich)",
 * "Sponsored Content Elemental", "Carl (Maybe)"). The DCC tone
 * does not fit this app's two themes; what we keep is the
 * *architectural* idea — a small recurring cast picked
 * deterministically per day. The patrons themselves are
 * reimagined as **coaching / emotional archetypes** so that the
 * room feels inhabited by people who care about the work, not by
 * sketch-comedy bit-players.
 *
 * Each patron has identical identity across themes; only the
 * *dialogue pools* change. The Spotter still spots; she just
 * sounds different in the Hollow than in the Wounded Goblin.
 *
 * Anti-shame contract: every dialogue line is allowed to apply
 * pressure — challenge, observation, witness, fair judgement —
 * but no line is allowed to wield cruelty (mockery, identity
 * attack, body commentary). The grep test pins this.
 *
 * NB: this module does NOT import from `reference/ironquest/`.
 * The shape is a clean re-implementation in Momentum's
 * TypeScript codebase.
 */

import type { Patron } from './worldTypes';

// ---------------------------------------------------------------------------
// Roster
// ---------------------------------------------------------------------------

export const PATRON_ROSTER: readonly Patron[] = [
  // -------------------------------------------------------------------
  {
    id: 'the-spotter',
    title: 'The Spotter',
    archetype: 'spotter',
    philosophy: 'Safety with effort — never one without the other.',
    tone: 'firm',
    dialoguePools: {
      momentum: [
        'Leave one clean rep in the chamber.',
        'The floor tells the truth. Listen to it.',
        'Form first. Weight second. Pride a distant third.',
        "I'll catch what slips. You handle the rest.",
      ],
      'ironquest-classic': [
        'Bar path. Eyes up. Breathe.',
        'One clean rep beats three sloppy ones. Always.',
        'I have seen too many heroes wreck a shoulder this way.',
        "I'm right here. Don't be a hero.",
      ],
    },
  },
  // -------------------------------------------------------------------
  {
    id: 'the-quiet-runner',
    title: 'The Quiet Runner',
    archetype: 'quietRunner',
    philosophy: 'Pace survives motivation.',
    tone: 'quiet',
    dialoguePools: {
      momentum: [
        'Pace survives motivation.',
        'Slower than yesterday. Further than tomorrow.',
        'The road is patient. So am I.',
        'No need to hurry. The work waits.',
      ],
      'ironquest-classic': [
        'Pace survives motivation. Engineering survives both.',
        'I have outlasted faster runners. Quietly.',
        'Heart rate down. Stride steady. Win the boring way.',
        'Sprint when it matters. Walk when it does not.',
      ],
    },
  },
  // -------------------------------------------------------------------
  {
    id: 'the-hearthkeeper',
    title: 'The Hearthkeeper',
    archetype: 'hearthkeeper',
    philosophy: 'Someone has to keep the fire alive between visits.',
    tone: 'warm',
    dialoguePools: {
      momentum: [
        'The fire was waiting for you.',
        'A kettle still steams near the hearth.',
        'I banked the coals before sundown. They held.',
        'Come closer. The room is warmer than it looks.',
      ],
      'ironquest-classic': [
        'Kettle is hot. Mug is yours.',
        'Banked the fire last night. Welcome back.',
        'Sit by the flame for a minute. The bar can wait.',
        "Don't lift cold. The fire is right there.",
      ],
    },
  },
  // -------------------------------------------------------------------
  {
    id: 'the-archivist',
    title: 'The Archivist',
    archetype: 'archivist',
    philosophy: 'The log remembers effort kindly.',
    tone: 'steady',
    dialoguePools: {
      momentum: [
        'The log remembers effort kindly.',
        'A page turned. A line added. The book grows.',
        'Today is already part of the record.',
        'Numbers are a memory of choice. Yours look honest.',
      ],
      'ironquest-classic': [
        'The kill log is open. Add a line, would you?',
        'I write down the wins. The losses learn from themselves.',
        'Three lifts on the page already. Steady week.',
        'The book remembers what the mirror forgets.',
      ],
    },
  },
  // -------------------------------------------------------------------
  {
    id: 'the-challenger',
    title: 'The Challenger',
    archetype: 'challenger',
    philosophy: 'Pressure, never punishment.',
    tone: 'firm',
    appearsWhen: {
      minEnergy: 'settled',
    },
    dialoguePools: {
      momentum: [
        'A little harder. Just one set harder.',
        "I think you have one more in you. Quiet, but it's there.",
        'Match yourself. Not anyone else.',
        'Steady is good. Steady-and-one-more is better.',
      ],
      'ironquest-classic': [
        'That all you brought?',
        'Again. Cleaner this time.',
        'One more set. Then mug, then chair.',
        'You came in here for a reason. Honour it.',
      ],
    },
  },
  // -------------------------------------------------------------------
  {
    id: 'the-cook',
    title: 'The Cook',
    archetype: 'cook',
    philosophy: 'Fuel is for the work, not the mirror.',
    tone: 'warm',
    dialoguePools: {
      momentum: [
        'There is broth on the back of the stove.',
        'Eat what kept you warm today. Tomorrow needs you.',
        "I'm not measuring. Neither should you.",
        'Bread is rising. So is the player.',
      ],
      'ironquest-classic': [
        'Plate is on the bar. Bring an appetite.',
        "Don't lift on an empty tank. I've seen what happens.",
        'Stew tonight. Heavier than the lifts. About right.',
        'Fuel for the work. Not for the mirror.',
      ],
    },
  },
  // -------------------------------------------------------------------
  {
    id: 'the-night-janitor',
    title: 'The Night Janitor',
    archetype: 'nightJanitor',
    philosophy: 'Quiet witness. Sweeps the floor. Sees everything.',
    tone: 'quiet',
    dialoguePools: {
      momentum: [
        'Someone repaired the old bench. It was not me.',
        'The dust settles between visits. I move it along.',
        "I've seen quieter nights. They were not better.",
        'The lamps are full. The floor is swept. Begin.',
      ],
      'ironquest-classic': [
        'Swept the mat. Wiped the bar. Rest is up to you.',
        "I keep the place standing. You keep the place breathing.",
        'Late shift. Always have been.',
        'I do not judge the noise. I just clean after it.',
      ],
    },
  },
  // -------------------------------------------------------------------
  {
    id: 'the-traveler',
    title: 'The Traveler',
    archetype: 'traveler',
    philosophy: 'Returns from elsewhere with perspective.',
    tone: 'wry',
    dialoguePools: {
      momentum: [
        'The road outside was quieter than I remembered.',
        'I came back to see the hearth again.',
        'New ground tomorrow. Same hearth tonight.',
        'You learn the room better after you leave it.',
      ],
      'ironquest-classic': [
        'Three towns north. Two south. This one is the best mug.',
        "I've been around. This bench is still the best one.",
        "Walked twelve miles. I'll lift after a sit.",
        "Different city. Same iron. Same questions.",
      ],
    },
  },
  // -------------------------------------------------------------------
  {
    id: 'the-one-who-stretches',
    title: 'The One Who Always Stretches',
    archetype: 'oneWhoStretches',
    philosophy: 'Mobility is a long argument with the future.',
    tone: 'steady',
    dialoguePools: {
      momentum: [
        'Hips first. The rest of the body follows.',
        "I'm patient with the hinge. The hinge is patient with me.",
        'Two minutes here saves twenty later.',
        'The body answers questions you forgot to ask.',
      ],
      'ironquest-classic': [
        "Couldn't touch my toes last winter. Can now.",
        'Stretch first. Lift second. Brag third, if at all.',
        'Mobility is the long game. I am playing it.',
        'Hips. Always hips.',
      ],
    },
  },
  // -------------------------------------------------------------------
  {
    id: 'the-old-soldier',
    title: 'The Old Soldier',
    archetype: 'oldSoldier',
    philosophy: 'Knows when to stop. Honours both work and rest.',
    tone: 'firm',
    appearsWhen: {
      minTier: 'driven',
    },
    dialoguePools: {
      momentum: [
        'Stopping well is a craft of its own.',
        'I have left more reps on the floor than I have lifted.',
        'Tomorrow is also a training day.',
        'Knowing the room is half the room.',
      ],
      'ironquest-classic': [
        'I rack the bar when the bar tells me to.',
        'Old injuries are quiet teachers. I listen.',
        "I've earned a chair. I've earned the next set too.",
        "Stopping is a skill. I've been training it for years.",
      ],
    },
  },
  // -------------------------------------------------------------------
  {
    id: 'the-newcomer',
    title: 'The Newcomer',
    archetype: 'newcomer',
    philosophy: "Mirrors the player's first steps — always welcome.",
    tone: 'quiet',
    dialoguePools: {
      momentum: [
        'First time. Or fifth. Hard to say.',
        'I came to see what the room felt like.',
        'I will sit a while. Then maybe move.',
        'Quiet here. I like that.',
      ],
      'ironquest-classic': [
        'Day one. Maybe day two. Counting is hard.',
        "I'm here. That seems important.",
        "Don't know the lifts yet. I know the room.",
        'Watching. Learning. Eventually doing.',
      ],
    },
  },
] as const;

/**
 * Look up a patron by id. Returns `undefined` for ids outside the
 * roster. Pure.
 */
export function findPatron(id: string): Patron | undefined {
  return PATRON_ROSTER.find((p) => p.id === id);
}
