// [IQ] src/engine/monsterGen.js — procedural monster generation

const ARCHETYPES = ['humanoid', 'beast', 'aberration', 'construct', 'swarm'];
const RARITIES   = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const RARITY_WEIGHTS = [40, 30, 18, 9, 3];

const ADJ = [
  'Rotting', 'Pale', 'Furious', 'Confused', 'Slightly Damp', 'Cursed',
  'Sponsored', 'Enraged', 'Bureaucratic', 'Disgraced', 'Malevolent', 'Forgotten',
  'Caffeinated', 'Perpetually Annoyed', 'Twice-Dead', 'Budget', 'Artisanal',
];

const NOUNS = {
  humanoid:   ['Accountant-Lich', 'Goblin Auditor', 'Skeleton Intern', 'Tax Collector', 'Middle Manager', 'Compliance Officer'],
  beast:      ['Stag', 'Hound', 'Toad', 'Boar', 'Crow', 'Badger', 'Elk', 'Rat'],
  aberration: ['Eyeball Cluster', 'Void Tendril', 'Meat Cloud', 'Concept Given Form', 'Noise', 'Brief Regret'],
  construct:  ['Vending Machine', 'Filing Cabinet', 'Broken Escalator', 'Automated Kiosk', 'Self-Checkout Lane'],
  swarm:      ['Disappointed Pigeons', 'Angry Receipts', 'Filing Errors', 'Notification Alerts', 'Terms and Conditions'],
};

export const ZONE_DIFFICULTY = {
  shallow_crypts:    0.7,
  merchant_district: 1.0,
  fungal_warrens:    1.4,
  corporate_floor:   1.8,
  endless_escalator: 2.4,
  unmapped_place:    3.5,
};

export const ZONE_LABELS = {
  shallow_crypts:    'Shallow Crypts',
  merchant_district: 'Merchant District',
  fungal_warrens:    'Fungal Warrens',
  corporate_floor:   'Corporate Floor',
  endless_escalator: 'Endless Escalator',
  unmapped_place:    'Unmapped Place',
};

// Zones unlocked in order. Phase 3 exposes only the first two.
export const ZONES_AVAILABLE = ['shallow_crypts', 'merchant_district'];

export function seededRNG(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function weightedPick(options, weights, rng) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < options.length; i++) {
    r -= weights[i];
    if (r <= 0) return options[i];
  }
  return options[options.length - 1];
}

/**
 * Generate a monster deterministically from a zone + seed.
 * Same zone + same seed = same monster every time (survive defeat and return to same fight).
 *
 * HP formula:  (80 + rarityIdx * 60) * zoneDifficulty
 * ATK formula: (5 + rarityIdx * 4) * zoneDifficulty
 *   — ATK is tuned to ~40% below the raw spec to prevent death-spiral at typical
 *     session lengths (10–17 sets). Monster attacks every set; player has 100 HP.
 *
 * @param {{ zone?: string, sessionSeed?: number }} options
 * @returns {{ name, archetype, rarity, hp, maxHp, atk, zone, seed }}
 */
export function generateMonster({ zone = 'shallow_crypts', sessionSeed = Date.now() } = {}) {
  const rng       = seededRNG(sessionSeed);
  const archetype = ARCHETYPES[Math.floor(rng() * ARCHETYPES.length)];
  const rarity    = weightedPick(RARITIES, RARITY_WEIGHTS, rng);
  const adj       = ADJ[Math.floor(rng() * ADJ.length)];
  const noun      = NOUNS[archetype][Math.floor(rng() * NOUNS[archetype].length)];
  const name      = `${adj} ${noun}`;

  const rarityIdx   = RARITIES.indexOf(rarity);
  const difficulty  = ZONE_DIFFICULTY[zone] ?? 1.0;
  const hp          = Math.round((80 + rarityIdx * 60) * difficulty);
  const atk         = Math.round((5 + rarityIdx * 4) * difficulty);

  return { name, archetype, rarity, hp, maxHp: hp, atk, zone, seed: sessionSeed };
}

export { RARITIES };
