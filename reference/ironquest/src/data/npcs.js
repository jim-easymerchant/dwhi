// [IQ] src/data/npcs.js — Tavern NPC roster
import { seededRNG } from '../engine/monsterGen';

export const NPC_ROSTER = [
  { id: 'phil',      name: 'Phil (Former Lich)',            mood: 'Nursing his third ale. Seems philosophical.' },
  { id: 'bartender', name: 'The Bartender (Name Unknown)',  mood: 'Has seen everything. Comments on nothing.' },
  { id: 'elemental', name: 'Sponsored Content Elemental',   mood: 'Keeps mentioning a protein supplement.' },
  { id: 'dog',       name: 'A Dog That Should Not Be Here', mood: 'On the bar stool. No one has moved it.' },
  { id: 'manager',   name: 'Grievance Manager (Retired)',   mood: 'Filing a complaint about the ambiance.' },
  { id: 'carl',      name: 'Carl (Maybe)',                  mood: 'Refuses to confirm or deny being Carl.' },
  { id: 'human',     name: 'Extremely Normal Human',        mood: 'Suspicious. Too normal. Watch this one.' },
  { id: 'announcer', name: 'Dungeon Announcer (Off Duty)',  mood: 'Quieter than expected. Tired eyes.' },
];

/**
 * Returns 3–4 NPCs for tonight, seeded by calendar day.
 * Same NPCs all day, different set each new day.
 */
export function getTonightNPCs() {
  const daySeed = Math.floor(Date.now() / 86400000);
  const rng = seededRNG(daySeed);
  const shuffled = [...NPC_ROSTER].sort(() => rng() - 0.5);
  return shuffled.slice(0, 3 + Math.floor(rng() * 2));
}
