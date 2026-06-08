# Anonymous Agony II: Clara's Revenge

A retro, RPG-Maker-style web RPG. Clara survived the night Ashen Village
burned. A year later she walks out of the ash to settle a promise with the
three men who lit the torches.

Built as a **single, self-contained HTML5 game** — pure Canvas + vanilla
JavaScript, with all art, music, and sound generated procedurally in code.
**No build step, no dependencies, no external assets.**

## Play it

Just open `index.html` in any modern browser:

- Double-click `index.html`, **or**
- Serve the folder and visit it (e.g. `python3 -m http.server` then open
  `http://localhost:8000`), **or**
- Host the folder on any static host (GitHub Pages, Netlify, etc.).

> Tip: it runs straight from the filesystem (`file://`) because the scripts
> are plain `<script>` tags, not ES modules.

## Controls

| Action            | Keyboard                | Touch            |
|-------------------|-------------------------|------------------|
| Move              | Arrow keys / WASD       | On-screen D-pad  |
| Confirm / Talk    | Z / Enter / Space       | **A** button     |
| Cancel / Menu     | X / Esc                 | **B** button     |
| Run (hold)        | Shift                   | —                |
| Mute / unmute     | M                       | —                |

On phones/tablets a virtual D-pad and A/B buttons appear automatically.

## Features

- **Overworld exploration** across four hand-built maps (village, woods,
  town, keep) with grid-based movement, a following camera, and NPCs.
- **Story & cutscenes** driven by a small event interpreter — dialogue with
  a typewriter effect, branching by story flags, full-screen narration.
- **Turn-based battles**: command → resolve in speed order, with skills,
  items, guard, run, criticals, bleed/buff/debuff statuses, and a smart-ish
  enemy AI.
- **Progression**: EXP, leveling, learnable skills, a second party member
  (Roan), gold, an inn, and a shop.
- **Three bosses** and a proper ending + credits.
- **Save / load** via `localStorage`, with autosave on area transitions.
- **Procedural chiptune** soundtrack and SFX via the Web Audio API
  (toggle with **M**).
- Crisp pixel rendering (text included) at a 256×192 internal resolution,
  scaled to fit any screen.

## Walkthrough (no spoilers beyond the obvious)

1. Talk to **Elias** by the well in Ashen Village — he points you south.
2. Head into the **Whispering Woods**. Tall grass hides random encounters;
   grind a couple of levels and learn *Rend*.
3. The **Houndmaster** blocks the forest road. Beat him for the **Iron Key**.
4. In **Greyhold**, rest at the inn, shop for potions, and recruit **Roan**.
   Show the Iron Key to the gate guard to open the keep.
5. In **Vael's Keep**, cut down **Captain Dross**, then **Lord Vael**.

Stuck on a boss? Grind a level or two, keep potions stocked, and use *Guard*
on turns you expect a big hit. *Mend* (Clara) and *Patch Up* (Roan) keep you
alive; *Sunder* softens armored foes.

## Project layout

```
index.html        entry point (loads everything)
css/style.css     layout, scaling, touch controls
js/
  data.js         all content: palette, maps, enemies, items, skills, story
  audio.js        Web Audio chiptune engine (music + SFX)
  input.js        keyboard + touch input
  graphics.js     canvas, pixel text, procedural sprites & tiles
  dialogue.js     message box (typewriter) + reusable menu
  battle.js       turn-based battle system
  world.js        overworld: tiles, movement, camera, NPCs, encounters
  game.js         state machine, party/leveling, save/load, menus, shop
  main.js         bootstrap + fixed-timestep loop
test/headless.js  Node harness that stubs the browser and plays the whole
                  game start-to-credits to catch runtime regressions
```

## Tests

The logic can be exercised headlessly (no browser needed):

```
node test/headless.js
```

It boots the engine with stubbed browser APIs and auto-plays a full run
(title → intro → exploration → random battles → all three bosses → ending
→ credits), asserting story flags, leveling, items, save/load, shop, and
inn along the way.

---

*Anonymous Agony II: Clara's Revenge — a promise kept in ash.*
