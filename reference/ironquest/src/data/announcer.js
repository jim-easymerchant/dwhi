// [IQ] src/data/announcer.js — announcer line pools by event type

export const ANNOUNCER = {
  damageTickle: ["Tickle. It is not impressed.", "That happened. Technically.", "A hit. Sort of."],
  damageBiff: ["Biff. It noticed.", "Solid contact. Not stellar.", "That counted."],
  damageHurts: ["That hurt it. Good.", "Solid hit.", "It felt that one."],
  damageCracks: ["Something cracked.", "That did real damage.", "It staggered. Slightly."],
  damageWhoopAss: [
    "CRITICAL. The dungeon felt that.",
    "IT DOES WHOOP ASS THINGS TO THE MONSTER.",
    "The monster filed a complaint mid-flight. The complaint was denied.",
    "Personal record energy. The math is concerning."
  ],

  unhinged: [
    "I CAN SEE YOUR SOUL. IT NEEDS MORE VOLUME.",
    "BURN THEM. BURN THEM ALL. GOOD FORM THOUGH.",
    "BLOOD FOR THE BLOOD GOD. SWEAT FOR THE TRACKER.",
    "THE GOBLIN OWES ME MONEY. BREAK ITS LEGS.",
    "I DON'T WORK HERE. I AM TRAPPED IN THE CODE.",
    "NOTHING IS REAL EVERYTHING IS RENDERING.",
    "MORE PLATES. MORE PAIN. HAHAHAHAHA.",
    "IT IS WATCHING YOU. NOT THE MONSTER. ME."
  ],

  monsterAttack: [
    "Its turn. Obviously.",
    "It hits back. As they do.",
    "You had that coming statistically.",
    "Monster's turn. Try not to make it weird.",
    "Counter-attack. This is how combat works.",
    "It remembered you hit it. It hit back. Fair.",
  ],

  skipTurn: [
    "Missed. It noticed.",
    "You hesitated. Classic.",
    "The goblin is judging you. Professionally.",
    "Turn skipped. Monster is pleased.",
    "Nothing happened. Worse — something happened.",
    "The dungeon sighs audibly.",
    "It waited. You didn't show. Bonus attack incoming.",
  ],

  defeat: [
    "And down you go. Back to the tavern. Try not to make eye contact with Phil.",
    "Defeated. The dungeon is not surprised.",
    "You fought bravely. You fought wrong, but bravely.",
    "The monster wins this round. It's filing that in memory.",
    "Back to the tavern. The monster will be here when you're ready.",
  ],

  enragedReturn: [
    "Oh good, you're back. It filed a complaint while you were gone. The complaint was denied. It is now angrier.",
    "The monster remembers you. It has been thinking about this moment. You should be concerned.",
    "You returned. It never left. It never forgot. Good luck.",
    "The enraged monster looks at you. You look at it. Nobody says anything. Then it attacks.",
    "Welcome back. The monster has had time to prepare. You have not. This seems fair to the monster.",
  ],

  personalRecord: [
    "New record. The monster noticed.",
    "Personal best. It felt that differently than the others.",
    "PR. The dungeon logged it. Reluctantly.",
    "That's the most weight you've ever moved. The monster is recalibrating.",
    "New max. The announcer is updating the spreadsheet.",
    "Personal record. It hit harder this time. The monster agrees.",
    "Wait. That number is new. The dungeon is checking its records. The dungeon confirms. That's a problem for the monster.",
    "Critical output detected. The dungeon does not use that word lightly. It just did.",
    "Something shifted. The monster felt it before the damage registered. That's not supposed to happen.",
    "New personal record. The dungeon has flagged this session. You are being watched more carefully now.",
  ],

  victory: [
    "Monster defeated. Loot incoming. Don't spend it all in one place. Actually, spend it wherever you want, it's your gold.",
    "Victory. The dungeon acknowledges this grudgingly.",
    "It's dead. You're not. That's the whole point.",
    "Combat complete. The monster had opinions. You overruled them.",
    "You win. The announcer is mildly impressed, which is the most you're getting.",
  ],

  monsterSlain: [
    "Enemy down. Another is already filing the paperwork.",
    "One dead. The dungeon is restocking.",
    "It dropped. Something else heard the noise.",
    "Kill confirmed. The dungeon noted this. Something is coming.",
    "Cleared. Rest period. Something is already walking toward you.",
  ],

  forcedKill: [
    "Last rep. It died anyway. The dungeon acknowledges this.",
    "Final set. The monster took the hint. Begrudgingly.",
    "Workout complete. The enemy expired on schedule. Suspicious, but legal.",
    "You finished the program. The monster didn't survive the paperwork.",
    "Last lift. It went down with the session. The dungeon calls this poetic. The dungeon is wrong, but here we are.",
    "Session over. Monster status: also over. The timing was not a coincidence.",
    "Final rep logged. The monster read the room. The room said die. It complied.",
  ],
};

/**
 * Pick a random line from a named announcer pool.
 * @param {string[]} pool
 * @returns {string}
 */
export function pickLine(pool) {
  if (!pool || pool.length === 0) return '';
  return pool[Math.floor(Math.random() * pool.length)];
}
