// [IQ] src/engine/audio.js — singleton audio manager (expo-audio)
// One track at a time. Handles mute, volume, loop.
// TRACKS with null values are placeholders — playTrack() is a no-op for them.
//
// SETUP: Drop audio files into assets/audio/, then replace the null values
// below with require() calls, e.g.:
//   tavern: require('../../assets/audio/tavern.mp3'),

import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

const TRACKS = {
  intro:  require('../../assets/audio/intro.mp3'),
  tavern: null, // placeholder — Phase 4
  boss:   null, // placeholder — Phase 4
};

let _player       = null;
let _currentTrack = null;
let _volume       = 1.0;
let _muted        = false;

export const AudioManager = {
  /**
   * Play a named track. Stops any currently playing track first.
   * Loops by default. No-op if track is null (placeholder).
   */
  async playTrack(trackName) {
    const source = TRACKS[trackName];
    if (!source) {
      console.log(`[IQ] Audio: track '${trackName}' is null (placeholder), skipping`);
      return;
    }
    try {
      await this.stopTrack();
      await setAudioModeAsync({ playsInSilentModeIOS: true });
      _player = createAudioPlayer(source);
      _player.loop   = true;
      _player.volume = _volume;
      _player.muted  = _muted;
      _player.play();
      _currentTrack = trackName;
      console.log(`[IQ] Audio: playing '${trackName}'`);
    } catch (e) {
      console.log(`[IQ] Audio: failed to play '${trackName}':`, e.message);
    }
  },

  /**
   * Stop and release the current track. Safe to call when nothing is playing.
   */
  async stopTrack() {
    if (!_player) return;
    try { _player.remove(); } catch {}
    _player       = null;
    _currentTrack = null;
  },

  async pauseTrack() {
    if (!_player) return;
    try { _player.pause(); } catch (e) {
      console.log('[IQ] Audio: pause failed:', e.message);
    }
  },

  async resumeTrack() {
    if (!_player) return;
    try { _player.play(); } catch (e) {
      console.log('[IQ] Audio: resume failed:', e.message);
    }
  },

  /**
   * Set volume (0–1). Persists across track changes.
   * Does not override mute — if muted, sound stays silent until unmuted.
   */
  async setVolume(vol) {
    _volume = Math.max(0, Math.min(1, vol));
    if (_player && !_muted) {
      _player.volume = _volume;
    }
  },

  /**
   * Mute or unmute without stopping the track.
   * Uses the native muted property — synchronous, cannot fail silently.
   */
  async setMuted(muted) {
    _muted = muted;
    if (_player) {
      _player.muted = _muted;
    }
  },

  getCurrentTrack() { return _currentTrack; },
  isMuted()         { return _muted; },
};
