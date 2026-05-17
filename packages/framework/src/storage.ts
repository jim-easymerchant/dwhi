/**
 * Device-wide key/value store. Used today for active-household
 * persistence and location-tracking flags. Any small "remember this
 * across cold starts" knob belongs here rather than getting its own
 * SQLite table.
 */
export {
  clearActiveHouseholdPref,
  getActiveHouseholdPref,
  getPref,
  setActiveHouseholdPref,
  setPref,
} from '@/repositories/appPrefsRepository';
