# assets/audio/

Drop your audio files here, then update `src/engine/audio.js` TRACKS:

```js
const TRACKS = {
  intro:  require('../../assets/audio/intro.mp3'),   // ← update this line
  tavern: null,
  boss:   null,
};
```

Required files:
- `intro.mp3`  — splash screen + main menu music (loops)

Future:
- `tavern.mp3` — home screen ambient
- `boss.mp3`   — enraged monster fight music
