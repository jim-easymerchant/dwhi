/**
 * World-state generator — the public entry point for the world
 * layer. Given a theme, tier, and day-seed, returns everything
 * the home screen needs to feel inhabited tonight.
 *
 * Determinism: same input → same output. No I/O. No timers. No
 * persistence. Safe to call on every render (the home screen
 * memoises the call anyway).
 *
 * Fallback behaviour: an unknown / non-string theme id returns
 * the Momentum-flavoured world. The patron roster has at least
 * one entry available for every (tier, energy) pair, so the
 * output is never empty.
 *
 * The default daySeed reads the wall clock (one stable value per
 * calendar day). Tests pass an explicit `daySeed` so the
 * generator is fully pinned.
 *
 * See: docs/workout-rpg/020-world-state-and-patrons.md
 */

import type { MomentumTier } from '@dwhi/workout-domain';

import { getTheme } from '../theme';
import { selectPatronsForNight } from './patronDialogue';
import { pickFrom, seededRng } from './worldRng';
import type {
  AmbientObservation,
  GenerateWorldInput,
  HearthState,
  RoomEnergy,
  TimeOfDay,
  Weather,
  WorldNight,
} from './worldTypes';

const MS_PER_DAY = 86_400_000;

const TIME_OF_DAY_OPTIONS: readonly TimeOfDay[] = [
  'dusk',
  'evening',
  'lateNight',
  'predawn',
];
const WEATHER_OPTIONS: readonly Weather[] = [
  'rain',
  'wind',
  'still',
  'snow',
  'fog',
  'clear',
];
const ROOM_ENERGY_OPTIONS: readonly RoomEnergy[] = [
  'quiet',
  'settled',
  'lively',
  'crowded',
];

// ---------------------------------------------------------------------------
// Observation pools — keyed by theme id. The world generator
// picks 2-3 observations per night, deterministically. Each pool
// is intentionally short — adding more obs is a flavour-tuning
// task, not a structural one.
//
// Anti-shame contract: no observation may reference absence,
// failure, or body. Observations describe the *room*, never the
// player.
// ---------------------------------------------------------------------------

const OBSERVATIONS: Readonly<
  Record<string, readonly AmbientObservation[]>
> = {
  momentum: [
    { id: 'rain-stone', text: 'Rain taps softly against the stone.' },
    { id: 'kettle-steam', text: 'A kettle still steams near the fire.' },
    { id: 'bench-repaired', text: 'Someone repaired the old bench.' },
    { id: 'door-ajar', text: 'The side door is ajar by a finger.' },
    { id: 'cat-windowsill', text: 'A cat has claimed the windowsill.' },
    { id: 'lamps-trimmed', text: 'The lamps are trimmed low. Just right.' },
    { id: 'wood-stacked', text: 'A fresh stack of split wood, neatly piled.' },
    { id: 'cloak-hung', text: 'A traveller’s cloak hangs by the hearth.' },
    { id: 'window-mist', text: 'The windows are warm against a cold night.' },
    { id: 'tea-cups', text: 'Two empty tea cups, washed but not put away.' },
  ],
  'ironquest-classic': [
    {
      id: 'lifters-booth',
      text: 'Three tired lifters occupy the back booth, mugs untouched.',
    },
    {
      id: 'deadlift-argument',
      text: 'Someone is patiently losing an argument about deadlifts.',
    },
    {
      id: 'bartender-silence',
      text: 'The bartender refuses to acknowledge the screaming kettle.',
    },
    {
      id: 'chalk-on-bar',
      text: 'A faint dust of chalk has settled along the bar rail.',
    },
    {
      id: 'lantern-creak',
      text: 'A ceiling lantern creaks slightly with the door.',
    },
    {
      id: 'dog-bench',
      text: 'A dog has claimed the long bench. No one is contesting it.',
    },
    {
      id: 'mug-row',
      text: 'A row of mugs sits warming by the fire, lined up like soldiers.',
    },
    {
      id: 'boots-row',
      text: 'A row of boots by the door — different sizes, same wear pattern.',
    },
    {
      id: 'whetstone',
      text: 'A whetstone rests on the bar. No one admits to using it.',
    },
    {
      id: 'ledger-open',
      text: 'A leather ledger sits open, mid-entry, ink still wet.',
    },
  ],
};

// ---------------------------------------------------------------------------
// Bucket pickers — deterministic. Each takes the shared rng and
// returns one bucket.
// ---------------------------------------------------------------------------

function pickTimeOfDay(rng: () => number): TimeOfDay {
  return pickFrom(TIME_OF_DAY_OPTIONS, rng);
}

function pickWeather(rng: () => number): Weather {
  return pickFrom(WEATHER_OPTIONS, rng);
}

/**
 * Derive a hearth state from the player's tier + days-since.
 * Tier dominates; days-since only nudges within a tier (so the
 * fire is "warm" rather than "bright" if the player has been
 * away long enough to let the bed of coals cool).
 */
function deriveHearthState(
  tier: MomentumTier,
  daysSinceLastQuest: number,
): HearthState {
  switch (tier) {
    case 'rusted':
      return daysSinceLastQuest >= 7 ? 'cold' : 'low';
    case 'steady':
      return 'warm';
    case 'driven':
      return 'bright';
    case 'relentless':
      return 'bright';
    case 'ascendant':
      return 'roaring';
  }
}

/**
 * Pick a room-energy bucket. The theme nudges the result up or
 * down via its `tavernEnergyBias`.
 */
function pickRoomEnergy(rng: () => number, bias: number): RoomEnergy {
  const base = Math.floor(rng() * ROOM_ENERGY_OPTIONS.length);
  const shifted = clampIndex(
    base + Math.round(bias * (ROOM_ENERGY_OPTIONS.length - 1)),
    ROOM_ENERGY_OPTIONS.length,
  );
  return ROOM_ENERGY_OPTIONS[shifted];
}

function clampIndex(i: number, length: number): number {
  if (i < 0) return 0;
  if (i >= length) return length - 1;
  return i;
}

/** Pull `count` observations from the theme's pool; falls back
 *  to Momentum's pool if the requested theme has no entries. */
function pickObservations(
  themeId: string,
  count: number,
  rng: () => number,
): readonly AmbientObservation[] {
  const pool =
    OBSERVATIONS[themeId] && OBSERVATIONS[themeId].length > 0
      ? OBSERVATIONS[themeId]
      : OBSERVATIONS.momentum;
  // Reservoir-style picking without replacement.
  const out: AmbientObservation[] = [];
  const used = new Set<number>();
  let attempts = 0;
  while (out.length < count && attempts < count * 8 && used.size < pool.length) {
    const idx = Math.floor(rng() * pool.length);
    if (used.has(idx)) {
      attempts++;
      continue;
    }
    used.add(idx);
    out.push(pool[idx]);
  }
  return out;
}

function densityToObservationCount(
  density: 'sparse' | 'medium' | 'dense',
): number {
  return density === 'sparse' ? 2 : 3;
}

/**
 * Activity hint — short forward-looking sentence about the
 * room's recent activity. Never references absence. Returns ''
 * when the room is too quiet to report anything.
 */
function deriveActivityHint(energy: RoomEnergy, themeId: string): string {
  if (themeId === 'ironquest-classic') {
    switch (energy) {
      case 'quiet':
        return '';
      case 'settled':
        return 'A mug clinks. A boot scuffs the floor. Steady night.';
      case 'lively':
        return 'A laugh from the back booth — short, then quiet again.';
      case 'crowded':
        return 'The bar is full. The kettle is loud. The fire is louder.';
    }
  }
  switch (energy) {
    case 'quiet':
      return '';
    case 'settled':
      return 'Someone shifts a log on the fire. The room settles.';
    case 'lively':
      return 'Quiet voices at the long table. The hearth answers.';
    case 'crowded':
      return 'The room is warm with breathing. The hearth answers all of it.';
  }
}

// ---------------------------------------------------------------------------
// Public entry point.
// ---------------------------------------------------------------------------

/**
 * Generate the full WorldNight for the given input. The result
 * is fully deterministic on `themeId + tier + daysSinceLastQuest
 * + daySeed`.
 */
export function generateNightlyWorld(
  input: GenerateWorldInput,
): WorldNight {
  const theme = getTheme(input.themeId);
  const themeId = theme.id;
  const ws = theme.worldState;
  const seed = input.daySeed ?? defaultDaySeed();
  const tier = input.tier;
  const rng = seededRng(seed);

  // Order matters — keep this list stable so a given seed always
  // produces the same buckets across releases.
  const timeOfDay = pickTimeOfDay(rng);
  const weather = pickWeather(rng);
  const roomEnergy = pickRoomEnergy(rng, ws.tavernEnergyBias);
  const hearthState = deriveHearthState(tier, input.daysSinceLastQuest);
  const observations = pickObservations(
    themeId,
    densityToObservationCount(ws.ambientDensity),
    rng,
  );

  const patrons = selectPatronsForNight({
    themeId,
    theme,
    tier,
    roomEnergy,
    seed,
  });

  const weatherLine = ws.weatherCopy[weather] ?? ws.weatherCopy.clear;
  const activityHint = deriveActivityHint(roomEnergy, themeId);

  return {
    patronSectionLabel: ws.patronSectionLabel,
    patrons,
    observations,
    timeOfDay,
    hearthState,
    roomEnergy,
    weather,
    weatherLine,
    activityHint,
  };
}

/**
 * One stable value per calendar day (UTC). Matches Iron Quest's
 * `Math.floor(Date.now() / 86_400_000)` shape.
 */
export function defaultDaySeed(now: number = Date.now()): number {
  return Math.floor(now / MS_PER_DAY);
}

// Re-export the helpers consumers actually need.
export { pickDialogue, selectPatronsForNight } from './patronDialogue';
export { PATRON_ROSTER, findPatron } from './patrons';
