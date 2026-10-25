# Makeup Work: sound design

Everything is synthesized in the browser with the Web Audio API (`src/makeup/sound.js`), so there are no audio files to host or license. Sound is **off by default**: a student turns it on with the speaker button (top right of the journey) or the "Turn on quiet music" button on the first screen. The choice is remembered per browser.

## What it sounds like

**Music.** Six quiet voices in D (sines and triangles) through a low-pass filter, with a slow breathing in volume (about once every 12 seconds) and a long, soft reverb. It follows the sky:

| Step | Sky | Chord | Filter opens to |
|---|---|---|---|
| Begin | predawn | low D, A, E, A | 380 Hz (dark, close) |
| Choose | blue hour | adds F♯ and E | 520 Hz |
| Learn | first light | D major 7 | 800 Hz |
| Truth | dawn | G 6/9 | 1.3 kHz |
| Understand | sunrise | D add 9 | 2 kHz |
| Apply | golden | brighter, thinner bass | 2.8 kHz |
| Done | morning | D 6/9, open and high | 3.6 kHz |

The low voices thin out and the high ones come in as day breaks, so the music literally brightens as the mountains do. While a talk or recording plays, the music ducks about 12 dB so it never competes with the speaker.

**Soft sounds** (each starts and ends at silence, so there are no clicks):

| Moment | Sound |
|---|---|
| Choosing a way to learn | a soft tick |
| Taking a pick off | a lower tick |
| Moving to the next step | a two-note chime, then a breath of air |
| Finishing a reading or recording | a small bell |
| Citing a moment in a transcript | a bright bell |
| A blocked paste or drop | a low, gentle thud |
| The end | a five-note bell run up a D major scale |

**Controls.** Speaker on/off, plus a small panel: quiet music, soft sounds, volume. Reduced-motion does not affect sound; sound is only ever opt-in.

## How it was tested

Unit tests (`src/makeup/sound.test.jsx`, 15 tests): the graph builds; nothing plays until switched on; music and effects fade; ducking works; the filter opens with the sky; every effect runs; preferences are remembered and survive a broken saved value; a browser with no audio support shows no control and breaks nothing; the audio engine starts from the student's tap and closes when the journey closes.

Measured levels (`scripts/measure-sound.js`, run in a real browser by rendering the audio offline, so no speakers are needed). All 23 checks passed:

- Music: -29 to -30 dBFS average and never above -18 dBFS at the default volume. Quiet background level.
- No clicks anywhere (largest sample-to-sample jump 0.0067 on a scale of 1).
- It brightens: spectral center 102 Hz at predawn, 201 Hz at dawn, 274 Hz at morning.
- Every effect peaks between -16 and -21 dBFS: audible over the music, gentle on its own.
- Worst case, everything at once at full volume: -3.1 dBFS. It cannot clip.
- Ducking: about 12 dB quieter while a talk plays, back to full afterward.
- Turning music off fades to silence (-78 dBFS).

Also confirmed in a real browser: a real tap starts the audio engine ("running"), a full run through all seven steps with sound on produces no errors, and the audio keeps advancing.

**What a machine cannot judge:** whether the music is *beautiful*. The measurements show it is quiet, clean and brightening. Have someone listen on real speakers and headphones, and tell me what to change (the chords are the `CHORDS` table at the top of `sound.js`, so retuning is a few numbers).

Re-run the measurements after any change: start the dev server, open any page, paste `scripts/measure-sound.js` into the console.
