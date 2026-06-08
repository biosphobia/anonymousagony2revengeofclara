# Anonymous Agony II: Clara's Revenge

A grounded, story-driven **puzzle / exploration** game (no combat) in a
retro RPG-Maker style, and a direct continuation of *Anonymous Agony*
(Coded Emotion). Years later, Clara Stratos walks back into the house on
Maple Street to finally face what was done to her as a child — embodied,
obliquely, by **Tung Tung Tung Sahur**: a knocking in the dark that hides
behind silly "Italian brainrot" noise the way her abuser hid behind a
friendly screen. It is a survivor's story about refusing the blame.

> Heavy themes are handled **off-screen and symbolically** — nothing is
> ever depicted or sexualized. The game is about reclaiming a narrative.

Built as a **single, self-contained HTML5 game**: Canvas + vanilla JS,
smooth (non-pixel) rendering, code-drawn art, illustrated portraits,
per-character TTS, and a long animated opening. No build step.

## Play it
Open `index.html` in a modern browser, or host the folder anywhere static.

## Controls
| Action | Keyboard | Touch |
|---|---|---|
| Move | Arrows / WASD | D-pad |
| Confirm / interact | Z / Enter | A |
| Cancel / menu | X / Esc | B |
| Mute | M | — |
| Toggle voice (TTS) | V | — |

## Flow
1. **Title → New Game.**
2. A long, fully **animated opening cinematic** (Clara's backstory and the
   whole original cast). Hold **X/Esc** to skip.
3. An **epic vengeance opening-credits roll** (see Soundtrack below),
   crediting **duugu & gab** for every role. Hold **X/Esc** to skip.
4. **The game**: explore Maple Street and the house, examine memories,
   solve light puzzles (find Haze's note, set the hall clock to 3:00),
   reach **Zede Hospital** for the truth, then open the last locked room
   and face Tung in a dialogue "naming" climax. Twists tied to Clara's
   past land along the way.

## Soundtrack (you supply the song)
The opening credits are meant to run to **"Down With the Sickness" by
Disturbed**, up to the end of the first chorus. For copyright reasons the
audio is **not** in this repo — add your own copy at:

```
assets/down-with-the-sickness.mp3
```

The credits sequence is **synced to the audio's own playback clock**, so
the visuals match whatever file you drop in. To end exactly at the first
chorus, set `CREDITS_END_SEC` (seconds) near the top of `js/game.js`. If
the file is missing, the credits still play (silently) and end on a timer.

## Project layout
```
index.html            entry point
css/style.css         layout / smooth scaling / touch controls
assets/               <- put the song here
js/
  data.js             maps, items, characters, the story & puzzle scripts
  audio.js            ambient soundscape + SFX (Web Audio)
  voice.js            per-character TTS (Web Speech API)
  input.js            keyboard + touch
  graphics.js         smooth rendering, portraits, sprites, tiles
  dialogue.js         message box (typewriter, portraits) + menus
  world.js            map: movement, camera, NPCs, props, interaction
  cinematic.js        animated opening cinematic engine + script
  game.js            state machine, event/puzzle interpreter, credits, save
  main.js             bootstrap + loop
test/headless.js      Node harness: plays the whole game start->credits
```

## Tests
```
node test/headless.js
```
Stubs the browser and auto-plays the full game (skips the cinematic and
credits, solves the puzzle chain, hits the ending), asserting the story
flags and twists along the way.

---
*A continuation of Anonymous Agony by Coded Emotion.*
