/**
 * apps/workout/src/world
 *
 * Ambient world-state layer — patron presence + atmospheric
 * observations + hearth / weather / room-energy buckets. Pure
 * presentational, deterministic, no mechanics.
 *
 * See: docs/workout-rpg/020-world-state-and-patrons.md
 */

export {
  defaultDaySeed,
  findPatron,
  generateNightlyWorld,
  PATRON_ROSTER,
  pickDialogue,
  selectPatronsForNight,
} from './worldState';

export type {
  AmbientObservation,
  GenerateWorldInput,
  HearthState,
  Patron,
  PatronAppearanceFilter,
  PatronArchetype,
  PatronPresence,
  PatronTone,
  RoomEnergy,
  ThemeWorldState,
  TimeOfDay,
  Weather,
  WorldNight,
} from './worldTypes';
