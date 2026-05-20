/**
 * Patron dialogue + selection helpers.
 *
 * Two responsibilities:
 *
 *   1. `pickDialogue(patron, themeId, seed)` — deterministically
 *      choose one line from the active theme's pool.
 *   2. `selectPatronsForNight(...)` — pick 2-4 patrons from the
 *      roster, respecting `appearsWhen` filters and the theme's
 *      ambient density.
 *
 * Determinism is the whole point — same seed + same input = same
 * output. Tests assert this with a fixed seed; the runtime
 * default seed is `Math.floor(Date.now() / 86_400_000)` (one
 * value per calendar day, matching Iron Quest's
 * `getTonightNPCs` shape).
 *
 * Pure. No I/O. No persistence. No mechanics.
 */

import { safeThemeId } from '../theme/themeRegistry';
import type { ThemeId, ThemePack } from '../theme';
import type {
  Patron,
  PatronPresence,
  RoomEnergy,
  ThemeWorldState,
} from './worldTypes';
import { PATRON_ROSTER } from './patrons';
import { tierIsAtLeast } from './worldRng';
import type { MomentumTier } from '@dwhi/workout-domain';

// ---------------------------------------------------------------------------
// Dialogue picker.
// ---------------------------------------------------------------------------

/**
 * Pick one dialogue line from the patron's active-theme pool.
 * Falls back to Momentum when:
 *   - the patron has no pool for the requested theme, OR
 *   - the requested theme is unknown.
 * Returns an empty string only when no pool has any lines at all
 * (which is asserted impossible by the patron-roster test).
 */
export function pickDialogue(
  patron: Patron,
  themeId: unknown,
  seed: number,
): string {
  const id = safeThemeId(themeId);
  const pool = patron.dialoguePools[id];
  const safePool = pool && pool.length > 0
    ? pool
    : patron.dialoguePools.momentum;
  if (!safePool || safePool.length === 0) return '';
  // Mix the patron id into the seed so two patrons sharing a
  // seed don't accidentally pick the "same index" line.
  const mixed = seedFromString(patron.id, seed);
  return safePool[mixed % safePool.length];
}

// ---------------------------------------------------------------------------
// Patron selection.
// ---------------------------------------------------------------------------

const ENERGY_ORDER: readonly RoomEnergy[] = [
  'quiet',
  'settled',
  'lively',
  'crowded',
];

function energyRank(e: RoomEnergy): number {
  return ENERGY_ORDER.indexOf(e);
}

function densityToCount(density: ThemeWorldState['ambientDensity']): number {
  switch (density) {
    case 'sparse':
      return 2;
    case 'medium':
      return 3;
    case 'dense':
      return 4;
  }
}

function passesFilter(
  p: Patron,
  energy: RoomEnergy,
  tier: MomentumTier,
): boolean {
  const f = p.appearsWhen;
  if (!f) return true;
  if (f.minEnergy && energyRank(energy) < energyRank(f.minEnergy)) {
    return false;
  }
  if (f.maxEnergy && energyRank(energy) > energyRank(f.maxEnergy)) {
    return false;
  }
  if (f.minTier && !tierIsAtLeast(tier, f.minTier)) return false;
  return true;
}

/**
 * Deterministic Fisher-Yates shuffle. The roster is small enough
 * (~11 entries) that the cost is irrelevant; the gain is that
 * the same seed always yields the same ordering.
 */
function shuffle<T>(input: readonly T[], seed: number): T[] {
  const out = input.slice();
  let state = (seed | 0) || 1;
  for (let i = out.length - 1; i > 0; i--) {
    // xorshift32 — small, fast, deterministic.
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    const j = Math.abs(state) % (i + 1);
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

/**
 * Pick patrons for tonight. Returns a presence (patron + line)
 * for each pick.
 *
 *   - The count is `theme.worldState.ambientDensity`-derived (2-4).
 *   - The Hearthkeeper is *always* a candidate; the room is
 *     never empty.
 *   - `appearsWhen` filters out patrons that don't suit tonight's
 *     energy / tier.
 *   - The shuffle + seed makes the result deterministic.
 */
export function selectPatronsForNight(input: {
  themeId: ThemeId;
  theme: ThemePack;
  tier: MomentumTier;
  roomEnergy: RoomEnergy;
  seed: number;
}): readonly PatronPresence[] {
  const { theme, themeId, tier, roomEnergy, seed } = input;
  const targetCount = densityToCount(theme.worldState.ambientDensity);

  const candidates = PATRON_ROSTER.filter((p) =>
    passesFilter(p, roomEnergy, tier),
  );

  const shuffled = shuffle(candidates, seed);

  // Soft-guarantee: at least one warm presence. If the Hearthkeeper
  // happens to be in the picked set, fine; if not, prepend her.
  const HEARTHKEEPER_ID = 'the-hearthkeeper';
  const picked: Patron[] = [];
  const seen = new Set<string>();
  for (const p of shuffled) {
    if (picked.length >= targetCount) break;
    picked.push(p);
    seen.add(p.id);
  }
  if (!seen.has(HEARTHKEEPER_ID) && targetCount > 0) {
    const hk = PATRON_ROSTER.find((p) => p.id === HEARTHKEEPER_ID);
    if (hk && passesFilter(hk, roomEnergy, tier)) {
      // Replace the *last* picked (lowest priority) with the keeper.
      if (picked.length === targetCount) picked.pop();
      picked.unshift(hk);
    }
  }

  return picked.map((patron) => ({
    patron,
    line: pickDialogue(patron, themeId, seed),
  }));
}

// ---------------------------------------------------------------------------
// Small helper — mix a string into a numeric seed.
// ---------------------------------------------------------------------------

function seedFromString(s: string, base: number): number {
  let h = (base | 0) || 1;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  }
  return Math.abs(h);
}
