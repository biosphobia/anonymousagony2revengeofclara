/* ============================================================================
 * Anonymous Agony 2: Clara's Revenge
 * data.js — all static game content: palette, characters, tiles, maps,
 *           enemies, items, skills, and story scripts.
 *
 * Wrapped so it can also be loaded in Node for map-validation tests.
 * ==========================================================================*/
(function (global) {
  'use strict';

  // ---------------------------------------------------------------------------
  // Color palette
  // ---------------------------------------------------------------------------
  const PAL = {
    black:   '#0a0a10',
    night:   '#14121f',
    grass1:  '#3a5a3a',
    grass2:  '#476b41',
    tall1:   '#33502f',
    tall2:   '#5a7d3e',
    dirt1:   '#7a5a3a',
    dirt2:   '#8c6b46',
    water1:  '#2a4a78',
    water2:  '#3a5f96',
    stone1:  '#5a5a66',
    stone2:  '#73737f',
    brick1:  '#6b4a3a',
    brick2:  '#7d5a44',
    wood1:   '#5a3f2a',
    wood2:   '#6e4f36',
    floor1:  '#4a3a2a',
    floor2:  '#5a4736',
    sfloor1: '#42424e',
    sfloor2: '#50505c',
    tree1:   '#1f3a24',
    tree2:   '#2c5230',
    trunk:   '#46301f',
    rock:    '#54545e',
    grave:   '#6a6a74',
    rubble:  '#4a4038',
    flower:  '#c85a8a',
    flower2: '#e6c84a',
    lava1:   '#7a1f10',
    lava2:   '#c84a1a',
    carpet:  '#7a2030',
    gold:    '#e6c84a',
    blood:   '#9a2230',
    ink:     '#e8e8f0'
  };

  // ---------------------------------------------------------------------------
  // Character appearance presets (drawn procedurally in graphics.js)
  // ---------------------------------------------------------------------------
  const CHARS = {
    clara:   { skin:'#e8c4a0', hair:'#7a2418', style:'long',  shirt:'#2c4a32', pants:'#1c1c24', cape:'#561a1a' },
    elias:   { skin:'#d8b890', hair:'#c9c9d0', style:'old',   shirt:'#574027', pants:'#3a2c1c' },
    roan:    { skin:'#cf9e6f', hair:'#4a342a', style:'short', shirt:'#33557a', pants:'#26303a' },
    woman:   { skin:'#e3bd97', hair:'#b08030', style:'long',  shirt:'#7a5a8a', pants:'#3a2c3a' },
    child:   { skin:'#e8c4a0', hair:'#5a3a20', style:'short', shirt:'#caa23a', pants:'#3a3a46' },
    merchant:{ skin:'#d2a878', hair:'#3a3a3a', style:'bald',  shirt:'#2f6a5a', pants:'#26302c' },
    innkeep: { skin:'#e0b78e', hair:'#7a5a3a', style:'short', shirt:'#8a6a3a', pants:'#4a3a26' },
    villager:{ skin:'#dcb389', hair:'#43321f', style:'short', shirt:'#566b7a', pants:'#2c343a' },
    bandit:  { skin:'#c79a6c', hair:'#22201e', style:'hood',  shirt:'#3a2c26', pants:'#221c18' },
    soldier: { skin:'#c99c70', hair:'#2a2a2a', style:'helm',  shirt:'#4a4a58', pants:'#2c2c34' },
    houndman:{ skin:'#b8895c', hair:'#1c1a18', style:'hood',  shirt:'#4a2c1c', pants:'#241a14' },
    captain: { skin:'#c79a6c', hair:'#3a2a1a', style:'helm',  shirt:'#5a3030', pants:'#2c2024' },
    vael:    { skin:'#cdbfae', hair:'#15151a', style:'hood',  shirt:'#1c1c2a', pants:'#15151c', cape:'#3a0e14' },
    ghost:   { skin:'#bcd0d8', hair:'#9ab0bc', style:'long',  shirt:'#5a7a86', pants:'#46606a' }
  };

  // ---------------------------------------------------------------------------
  // Tile properties.  SOLID = blocks movement.  ANIM = animated frames.
  // ---------------------------------------------------------------------------
  const SOLID = new Set(['^','#','B','W','o','~','+','r','m','P','t','g','L','b',' ','=H']);
  const TILE_INFO = {
    ' ': { name:'void' },
    '.': { name:'grass' },
    ',': { name:'tallgrass', encounter:true },
    ':': { name:'dirt' },
    '%': { name:'flowers' },
    '#': { name:'tree' },
    '^': { name:'pine' },
    '~': { name:'water', anim:true },
    '=': { name:'bridge' },
    'o': { name:'rock' },
    'm': { name:'mountain' },
    'W': { name:'stonewall' },
    'B': { name:'brick' },
    'b': { name:'bush' },
    'D': { name:'door' },
    'f': { name:'woodfloor' },
    's': { name:'stonefloor' },
    'C': { name:'carpet' },
    '+': { name:'grave' },
    'r': { name:'rubble' },
    'P': { name:'pillar' },
    't': { name:'table' },
    'g': { name:'gate' },
    'L': { name:'lava', anim:true }
  };
  function isSolid(ch) { return SOLID.has(ch); }

  // ---------------------------------------------------------------------------
  // Map builder helpers (guarantee rectangular, correct-width grids)
  // ---------------------------------------------------------------------------
  function grid(w, h, fill) {
    const g = [];
    for (let y = 0; y < h; y++) g.push(new Array(w).fill(fill));
    return g;
  }
  function set(g, x, y, ch) {
    if (g[y] && x >= 0 && x < g[y].length) g[y][x] = ch;
  }
  function rectFill(g, x, y, w, h, ch) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) set(g, i, j, ch);
  }
  function rectBorder(g, x, y, w, h, ch) {
    for (let i = x; i < x + w; i++) { set(g, i, y, ch); set(g, i, y + h - 1, ch); }
    for (let j = y; j < y + h; j++) { set(g, x, j, ch); set(g, x + w - 1, j, ch); }
  }
  function hLine(g, x, y, len, ch) { for (let i = 0; i < len; i++) set(g, x + i, y, ch); }
  function vLine(g, x, y, len, ch) { for (let i = 0; i < len; i++) set(g, x, y + i, ch); }
  // A small building: brick walls with a door at bottom-center.
  function building(g, x, y, w, h) {
    rectFill(g, x, y, w, h, 'B');
    set(g, x + (w >> 1), y + h - 1, 'D');
  }
  function rows(g) { return g.map(r => r.join('')); }

  // ---------------------------------------------------------------------------
  // MAP 1 — Ashen Village (Clara's ruined home)
  // ---------------------------------------------------------------------------
  function buildVillage() {
    const W = 28, H = 20;
    const g = grid(W, H, '.');
    rectBorder(g, 0, 0, W, H, '^');
    rectFill(g, 1, 1, W - 2, 1, '^');
    // central vertical road
    vLine(g, 13, 1, H - 2, ':'); vLine(g, 14, 1, H - 2, ':');
    // plaza
    rectFill(g, 11, 8, 6, 4, ':');
    // well at plaza
    set(g, 13, 9, 'o'); set(g, 14, 9, 'o');
    // Clara's ruined house (top-left) — rubble
    rectFill(g, 3, 3, 5, 4, 'r');
    set(g, 5, 6, ':'); // doorway gap
    // intact houses
    building(g, 19, 3, 5, 4);
    building(g, 3, 13, 5, 4);
    building(g, 20, 13, 5, 4);
    // graveyard (right of ruins)
    set(g, 4, 9, '+'); set(g, 6, 9, '+'); set(g, 5, 10, '+');
    set(g, 4, 11, '+'); set(g, 6, 11, '+');
    // a few flowers / bushes
    set(g, 9, 5, '%'); set(g, 22, 9, '%'); set(g, 10, 16, 'b'); set(g, 18, 7, 'b');
    // south exit to woods
    set(g, 13, H - 1, 'D'); set(g, 14, H - 1, 'D');
    set(g, 13, H - 2, ':'); set(g, 14, H - 2, ':');

    return {
      id: 'village', name: 'Ashen Village', music: 'village', indoor: false,
      w: W, h: H, tiles: rows(g),
      start: { x: 5, y: 8, dir: 'down' },
      exits: [
        { x: 13, y: 19, to: 'woods', tx: 13, ty: 1, dir: 'down' },
        { x: 14, y: 19, to: 'woods', tx: 14, ty: 1, dir: 'down' }
      ],
      npcs: [
        { id: 'elias',   x: 15, y: 9,  dir: 'left',  char: 'elias',    name: 'Elias',   script: 'elias' },
        { id: 'mourner', x: 5,  y: 12, dir: 'up',    char: 'woman',    name: 'Mourner', script: 'mourner' },
        { id: 'kid',     x: 21, y: 10, dir: 'down',  char: 'child',    name: 'Boy',     script: 'kid' }
      ],
      objects: [
        { id: 'grave_family', x: 5, y: 10, look: 'grave_family' },
        { id: 'home_ruin',    x: 5, y: 6,  look: 'home_ruin' }
      ],
      triggers: [
        { id: 'intro', x: 5, y: 8, once: true, script: 'intro' }
      ]
    };
  }

  // ---------------------------------------------------------------------------
  // MAP 2 — Whispering Woods
  // ---------------------------------------------------------------------------
  function buildWoods() {
    const W = 30, H = 24;
    const g = grid(W, H, '.');
    rectBorder(g, 0, 0, W, H, '^');
    // scatter trees to form a winding path
    const trees = [
      [3,3],[4,3],[5,3],[6,3],[8,4],[9,4],[2,6],[3,6],[6,7],[7,7],[8,7],
      [11,5],[12,5],[13,5],[14,6],[20,3],[21,3],[22,4],[25,5],[26,5],
      [4,10],[5,10],[6,11],[10,9],[11,9],[12,10],[16,8],[17,8],[18,9],
      [22,9],[23,9],[24,10],[26,11],[3,14],[4,14],[7,15],[8,15],[12,14],
      [13,15],[17,14],[18,14],[21,15],[22,15],[25,15],[6,18],[7,18],
      [11,19],[12,19],[16,19],[17,19],[20,19],[21,19],[25,18],[26,18],
      [9,21],[10,21],[19,21],[20,21]
    ];
    trees.forEach(([x, y]) => set(g, x, y, Math.random() < 0.5 ? '#' : '^'));
    // path from top (village) down to bottom-right (town)
    vLine(g, 13, 1, 6, ':'); vLine(g, 14, 1, 6, ':');
    hLine(g, 13, 6, 4, ':');
    vLine(g, 16, 6, 6, ':');
    hLine(g, 9, 11, 8, ':');
    vLine(g, 9, 11, 6, ':');
    hLine(g, 9, 16, 12, ':');
    vLine(g, 20, 16, 6, ':');
    hLine(g, 20, 22, 6, ':');
    set(g, 25, 22, 'D'); set(g, 25, 23, 'D');
    // a small pond with bridge
    rectFill(g, 22, 12, 4, 3, '~');
    set(g, 23, 13, '='); set(g, 24, 13, '=');
    // tall grass patches (encounters)
    rectFill(g, 2, 8, 4, 3, ',');
    rectFill(g, 18, 4, 4, 3, ',');
    rectFill(g, 4, 17, 4, 4, ',');
    rectFill(g, 14, 11, 4, 3, ',');
    rectFill(g, 24, 18, 4, 3, ',');
    // rocks / flowers
    set(g, 7, 12, 'o'); set(g, 27, 8, 'o'); set(g, 2, 21, '%'); set(g, 28, 14, '%');
    // treasure chest (object)
    // houndmaster blocks the path south (NPC on the road)
    return {
      id: 'woods', name: 'Whispering Woods', music: 'woods', indoor: false,
      w: W, h: H, tiles: rows(g),
      start: { x: 13, y: 2, dir: 'down' },
      exits: [
        { x: 13, y: 1, to: 'village', tx: 13, ty: 18, dir: 'up' },
        { x: 14, y: 1, to: 'village', tx: 14, ty: 18, dir: 'up' },
        { x: 25, y: 23, to: 'town', tx: 14, ty: 1, dir: 'down', cond: 'woods_clear', deny: 'woods_blocked' }
      ],
      npcs: [
        { id: 'houndmaster', x: 20, y: 18, dir: 'up', char: 'houndman', name: 'Houndmaster Grull', script: 'houndmaster' }
      ],
      objects: [
        { id: 'chest_woods', x: 6, y: 9, look: 'chest', chest: { item: 'potion', n: 2 } }
      ],
      triggers: [],
      encounters: { rate: 0.08, table: ['wolf', 'wolf', 'crow', 'bandit'] }
    };
  }

  // ---------------------------------------------------------------------------
  // MAP 3 — Greyhold Town
  // ---------------------------------------------------------------------------
  function buildTown() {
    const W = 30, H = 22;
    const g = grid(W, H, 's'); // stone plaza ground
    rectBorder(g, 0, 0, W, H, 'W');
    // grass fringe
    rectFill(g, 1, 1, W - 2, 1, ':');
    // main road cross
    rectFill(g, 1, 10, W - 2, 2, ':');
    rectFill(g, 14, 1, 2, H - 2, ':');
    // buildings
    building(g, 3, 3, 6, 5);    // inn
    building(g, 21, 3, 6, 5);   // shop
    building(g, 3, 14, 6, 5);   // house
    building(g, 21, 14, 6, 5);  // house
    // a fountain
    rectFill(g, 13, 6, 4, 3, 'W'); set(g, 14, 7, '~'); set(g, 15, 7, '~');
    // pillars decorating plaza
    set(g, 11, 10, 'P'); set(g, 18, 10, 'P'); set(g, 11, 11, 'P'); set(g, 18, 11, 'P');
    // north entrance from woods
    set(g, 14, 1, 'D'); set(g, 15, 1, 'D');
    // the locked gate to the keep (south)
    rectFill(g, 12, 19, 6, 1, 'W');
    set(g, 14, 20, 'g'); set(g, 15, 20, 'g');
    set(g, 14, 21, 'D'); set(g, 15, 21, 'D');
    return {
      id: 'town', name: 'Greyhold', music: 'town', indoor: false,
      w: W, h: H, tiles: rows(g),
      start: { x: 14, y: 2, dir: 'down' },
      exits: [
        { x: 14, y: 1, to: 'woods', tx: 25, ty: 21, dir: 'up' },
        { x: 15, y: 1, to: 'woods', tx: 25, ty: 21, dir: 'up' },
        { x: 14, y: 21, to: 'keep', tx: 9, ty: 22, dir: 'down', cond: 'gate_open', deny: 'gate_locked' },
        { x: 15, y: 21, to: 'keep', tx: 10, ty: 22, dir: 'down', cond: 'gate_open', deny: 'gate_locked' }
      ],
      npcs: [
        { id: 'roan',     x: 8,  y: 11, dir: 'right', char: 'roan',    name: 'Roan',       script: 'roan' },
        { id: 'innkeep',  x: 6,  y: 8,  dir: 'down',  char: 'innkeep', name: 'Innkeeper',  script: 'inn' },
        { id: 'merchant', x: 24, y: 8,  dir: 'down',  char: 'merchant',name: 'Pelt',       script: 'shop' },
        { id: 'gossip',   x: 19, y: 13, dir: 'left',  char: 'villager',name: 'Townsfolk',  script: 'gossip' },
        { id: 'guard',    x: 14, y: 18, dir: 'down',  char: 'soldier', name: 'Gate Guard', script: 'gateguard' }
      ],
      objects: [],
      triggers: []
    };
  }

  // ---------------------------------------------------------------------------
  // MAP 4 — Vael's Keep
  // ---------------------------------------------------------------------------
  function buildKeep() {
    const W = 20, H = 24;
    const g = grid(W, H, 's');
    rectBorder(g, 0, 0, W, H, 'W');
    // entrance corridor (bottom)
    rectFill(g, 8, 18, 4, 5, 's');
    set(g, 9, 23, 'D'); set(g, 10, 23, 'D');
    // walls dividing rooms
    rectFill(g, 1, 16, 7, 1, 'W');
    rectFill(g, 12, 16, 7, 1, 'W');
    set(g, 9, 16, 's'); set(g, 10, 16, 's'); // passage up
    // mid hall with pillars and lava channels (flavor / hazard look)
    set(g, 3, 13, 'P'); set(g, 16, 13, 'P'); set(g, 3, 10, 'P'); set(g, 16, 10, 'P');
    rectFill(g, 1, 12, 3, 1, 'L'); rectFill(g, 16, 12, 3, 1, 'L');
    // dividing wall to throne room
    rectFill(g, 1, 8, 8, 1, 'W');
    rectFill(g, 11, 8, 8, 1, 'W');
    set(g, 9, 8, 's'); set(g, 10, 8, 's');
    // throne room (top) with carpet
    rectFill(g, 7, 2, 6, 5, 'C');
    set(g, 9, 2, 't'); set(g, 10, 2, 't'); // throne (table tiles)
    set(g, 5, 4, 'P'); set(g, 14, 4, 'P');
    return {
      id: 'keep', name: "Vael's Keep", music: 'keep', indoor: true,
      w: W, h: H, tiles: rows(g),
      start: { x: 9, y: 22, dir: 'up' },
      exits: [
        { x: 9, y: 23, to: 'town', tx: 14, ty: 20, dir: 'down' },
        { x: 10, y: 23, to: 'town', tx: 15, ty: 20, dir: 'down' }
      ],
      npcs: [
        { id: 'captain', x: 9,  y: 13, dir: 'down', char: 'captain', name: 'Captain Dross', script: 'captain' },
        { id: 'vael',    x: 9,  y: 5,  dir: 'down', char: 'vael',    name: 'Lord Vael',    script: 'vael' }
      ],
      objects: [
        { id: 'chest_keep', x: 3, y: 18, look: 'chest', chest: { item: 'elixir', n: 1 } },
        { id: 'chest_keep2', x: 16, y: 18, look: 'chest', chest: { item: 'tonic', n: 3 } }
      ],
      triggers: [
        { id: 'keep_enter', x: 9, y: 21, once: true, script: 'keep_enter' }
      ]
    };
  }

  const MAPS = {
    village: buildVillage(),
    woods:   buildWoods(),
    town:    buildTown(),
    keep:    buildKeep()
  };

  // ---------------------------------------------------------------------------
  // Items
  // ---------------------------------------------------------------------------
  const ITEMS = {
    potion:  { name: 'Potion',   kind: 'heal',   amount: 35, price: 18, desc: 'Restores 35 HP.' },
    hipotion:{ name: 'Hi-Potion',kind: 'heal',   amount: 80, price: 55, desc: 'Restores 80 HP.' },
    tonic:   { name: 'Tonic',    kind: 'mp',     amount: 18, price: 22, desc: 'Restores 18 MP.' },
    bandage: { name: 'Bandage',  kind: 'cure',   amount: 18, price: 12, desc: 'Heals 18 HP and stops bleeding.' },
    elixir:  { name: 'Elixir',   kind: 'full',   amount: 0,  price: 200,desc: 'Fully restores HP and MP.' },
    iron_key:{ name: 'Iron Key', kind: 'key',    amount: 0,  price: 0,  desc: "Opens the keep's gate." }
  };

  // ---------------------------------------------------------------------------
  // Skills
  // ---------------------------------------------------------------------------
  const SKILLS = {
    vengeance: { name: 'Vengeance', mp: 4,  type: 'attack', power: 1.9, target: 'enemy', desc: 'A furious strike fueled by hate.' },
    rend:      { name: 'Rend',      mp: 6,  type: 'attack', power: 1.1, target: 'enemy', status: 'bleed', desc: 'Cut deep — the foe bleeds.' },
    mend:      { name: 'Mend',      mp: 5,  type: 'heal',   power: 34,  target: 'ally',  desc: 'Bind wounds (~34 HP).' },
    reckoning: { name: 'Reckoning', mp: 12, type: 'attack', power: 3.2, target: 'enemy', desc: 'All her grief in one blow.' },
    // Roan
    sunder:    { name: 'Sunder',    mp: 4,  type: 'debuff', power: 1.0, target: 'enemy', status: 'defdown', desc: "Shatter a foe's guard." },
    patch:     { name: 'Patch Up',  mp: 4,  type: 'heal',   power: 26,  target: 'ally',  desc: 'Field medicine (~26 HP).' },
    rally:     { name: 'Rally',     mp: 6,  type: 'buff',   power: 1.0, target: 'self',  status: 'atkup', desc: 'Steel the nerves (ATK up).' }
  };

  // ---------------------------------------------------------------------------
  // Enemies
  // ---------------------------------------------------------------------------
  const ENEMIES = {
    wolf:    { name: 'Gaunt Wolf',  hp: 16,  atk: 6,  def: 2,  spd: 7, exp: 12, gold: 5,  art: 'wolf' },
    crow:    { name: 'Carrion Crow',hp: 10,  atk: 5,  def: 1,  spd: 9, exp: 8,  gold: 3,  art: 'crow' },
    bandit:  { name: 'Road Bandit', hp: 24,  atk: 8,  def: 3,  spd: 5, exp: 20, gold: 14, art: 'bandit',
               skills: [{ chance: 0.25, skill: 'rend' }] },
    soldier: { name: "Vael's Soldier", hp: 40, atk: 12, def: 6, spd: 5, exp: 28, gold: 18, art: 'soldier' },
    houndmaster: { name: 'Houndmaster Grull', hp: 78, atk: 12, def: 5, spd: 6, exp: 60, gold: 60, art: 'houndman', boss: true,
                   drop: 'iron_key',
                   skills: [{ chance: 0.30, skill: 'rend' }] },
    captain: { name: 'Captain Dross', hp: 140, atk: 15, def: 8, spd: 6, exp: 95, gold: 120, art: 'captain', boss: true,
               skills: [{ chance: 0.3, skill: 'sunder' }] },
    vael:    { name: 'Lord Vael', hp: 280, atk: 18, def: 10, spd: 8, exp: 0, gold: 0, art: 'vael', boss: true, noRun: true,
               skills: [{ chance: 0.30, skill: 'reckoning' }, { chance: 0.25, skill: 'rend' }] }
  };

  // Encounter groups for the woods random table -> arrays of enemy keys
  const GROUPS = {
    wolf:   () => Math.random() < 0.3 ? ['wolf', 'wolf'] : ['wolf'],
    crow:   () => Math.random() < 0.5 ? ['crow'] : ['crow', 'wolf'],
    bandit: () => ['bandit']
  };

  // ---------------------------------------------------------------------------
  // Party member base definitions
  // ---------------------------------------------------------------------------
  const PARTY_DEFS = {
    clara: {
      name: 'Clara', char: 'clara',
      base: { hp: 42, mp: 14, atk: 11, def: 6, spd: 6 },
      growth: { hp: 10, mp: 3, atk: 2, def: 1, spd: 0.6 },
      skillsByLevel: { 1: ['vengeance', 'mend'], 2: ['rend'], 5: ['reckoning'] }
    },
    roan: {
      name: 'Roan', char: 'roan',
      base: { hp: 46, mp: 10, atk: 9, def: 6, spd: 5 },
      growth: { hp: 11, mp: 2, atk: 2, def: 1, spd: 0.5 },
      skillsByLevel: { 1: ['sunder', 'patch'], 3: ['rally'] }
    }
  };

  function expForLevel(l) { return Math.floor(l * l * 5 + l * 10 + 15); }

  // ---------------------------------------------------------------------------
  // Story scripts. Each entry is a function(ctx) -> array of events.
  // ctx = { flags, party, gold, hasItem(id) }
  // Event kinds handled by the EventRunner in game.js.
  // ---------------------------------------------------------------------------
  const SCRIPTS = {
    intro: () => ([
      { fade: 'out', dur: 0 },
      { narrate: [
        "ANONYMOUS AGONY II",
        "— Clara's Revenge —"
      ] },
      { narrate: [
        "They came in the night and called it justice.",
        "They burned Ashen Village. They took everything.",
        "They left a girl named Clara for dead in the ash."
      ] },
      { narrate: [
        "She did not die.",
        "Some prayers are answered. Hers was not a prayer.",
        "It was a promise."
      ] },
      { fade: 'in', dur: 40 },
      { say: "Clara", text: "...The ash is cold now. Good. Cold things keep." },
      { say: "Clara", text: "Lord Vael. Captain Dross. The Houndmaster. I remember every name." },
      { say: null, text: "(Find Elias by the well. He may know where the others went.)" }
    ]),

    elias: (ctx) => {
      if (ctx.flags.vael_dead) return [
        { say: 'Elias', text: "It's over, then. You did it, child. Rest now — you've earned it." }
      ];
      if (ctx.flags.elias_told) return [
        { say: 'Elias', text: "Vael's men hold Greyhold, south through the Whispering Woods. Be careful, Clara." },
        { say: 'Elias', text: "And mind the Houndmaster on the forest road. He took such joy in the burning." }
      ];
      return [
        { say: 'Elias', text: "Spirits — Clara? You're alive. I buried you in my heart a year ago." },
        { say: 'Clara', text: "I came back for them, Elias. All of them. Where are they?" },
        { say: 'Elias', text: "Vael rules from his keep beyond Greyhold town, south through the Whispering Woods." },
        { say: 'Elias', text: "His Houndmaster, Grull, prowls the forest road. He led the men who lit the torches." },
        { say: 'Clara', text: "Then the road begins with him." },
        { say: 'Elias', text: "Take this — an old sword of mine, and what coin I have. Make it count." },
        { give: 'potion', n: 3 },
        { gold: 30 },
        { setFlag: 'elias_told', value: true },
        { say: null, text: "(Received 3 Potions and 30 gold. Head south to the Whispering Woods.)" }
      ];
    },

    mourner: () => ([
      { say: 'Mourner', text: "I lay flowers for the dead each dawn. Soon there will be more graves, won't there." },
      { say: 'Mourner', text: "...I see it in your eyes, girl. Go. Just come back, if you can." }
    ]),

    kid: (ctx) => ctx.flags.vael_dead ? [
      { say: 'Boy', text: "You're the lady who beat the bad lord! Will you teach me to be brave?" }
    ] : [
      { say: 'Boy', text: "My da says a ghost walks the ruins. But you're not a ghost... are you?" }
    ],

    grave_family: () => ([
      { say: null, text: "Three graves, unmarked. You know whose they are. You dug them yourself." },
      { say: 'Clara', text: "...I'm not done. Not yet." }
    ]),

    home_ruin: () => ([
      { say: null, text: "Charred timber and ash. Home, once. Nothing left to save here." }
    ]),

    chest: (ctx, obj) => {
      const it = obj.chest;
      return [
        { give: it.item, n: it.n },
        { setFlag: 'chest_' + obj.id, value: true },
        { say: null, text: "(Found " + it.n + "x " + ITEMS[it.item].name + "!)" }
      ];
    },

    houndmaster: (ctx) => {
      if (ctx.flags.houndmaster_dead) return [
        { say: null, text: "Grull's body lies cooling on the road. The way south is open." }
      ];
      return [
        { say: 'Houndmaster Grull', text: "Well, well. A ghost with a grudge. I burned a hundred like you." },
        { say: 'Clara', text: "You burned my family. You laughed while they screamed." },
        { say: 'Houndmaster Grull', text: "I did! Ha! Shall I do it again, little—" },
        { say: 'Clara', text: "No. This is where you stop." },
        { battle: 'houndmaster', boss: true },
        { setFlag: 'houndmaster_dead', value: true },
        { setFlag: 'woods_clear', value: true },
        { say: 'Houndmaster Grull', text: "...heh... the master... will... gut you..." },
        { say: null, text: "(Grull dropped an Iron Key. The keep's gate will open now.)" },
        { say: 'Clara', text: "One." }
      ];
    },

    roan: (ctx) => {
      if (ctx.flags.roan_joined) return [
        { say: 'Roan', text: "Lead on. Dross and Vael won't kill themselves... more's the pity." }
      ];
      return [
        { say: 'Roan', text: "You're the one who put down Grull. The whole town's whispering." },
        { say: 'Clara', text: "And you are?" },
        { say: 'Roan', text: "Roan. Vael's men hanged my brother for 'sedition.' I've a debt to settle too." },
        { say: 'Roan', text: "Two blades are better than one against Captain Dross. Let me come with you." },
        { say: 'Clara', text: "...Keep up, then." },
        { join: 'roan' },
        { setFlag: 'roan_joined', value: true },
        { say: null, text: "(Roan joined your party!)" }
      ];
    },

    inn: () => ([
      { rest: true }
    ]),

    shop: () => ([
      { shop: ['potion', 'hipotion', 'tonic', 'bandage', 'elixir'] }
    ]),

    gossip: (ctx) => ctx.flags.gate_open ? [
      { say: 'Townsfolk', text: "You opened the keep gate? Spirits keep you. Nobody comes back from up there." }
    ] : [
      { say: 'Townsfolk', text: "The keep gate's barred from inside. Only Dross's iron key works it." },
      { say: 'Townsfolk', text: "...Wait. That key Grull carried? You have it? Then Greyhold owes you a prayer." }
    ],

    gateguard: (ctx) => {
      if (ctx.flags.gate_open) return [
        { say: 'Gate Guard', text: "The gate's open. The Lord's reckoning is yours to deliver." }
      ];
      if (ctx.hasItem('iron_key')) return [
        { say: 'Gate Guard', text: "That's... the Iron Key. Grull's key. Then he's truly dead." },
        { say: 'Gate Guard', text: "I've no love for Vael. I'll work the lock. The keep is yours." },
        { setFlag: 'gate_open', value: true },
        { say: null, text: "(The gate to the keep grinds open.)" }
      ];
      return [
        { say: 'Gate Guard', text: "The keep gate won't open without the Iron Key. The Houndmaster kept it." }
      ];
    },

    keep_enter: () => ([
      { say: 'Clara', text: "The keep. After all this time. I can still smell the smoke." },
      { say: null, text: "(Captain Dross waits in the hall ahead. Lord Vael, beyond.)" }
    ]),

    captain: (ctx) => {
      if (ctx.flags.captain_dead) return [
        { say: null, text: "Captain Dross is dead. The stairs to the throne room lie open." }
      ];
      return [
        { say: 'Captain Dross', text: "Halt. No one sees the Lord. Especially not dead girls who won't stay buried." },
        { say: 'Clara', text: "You gave the order, Dross. 'Leave no one.' I heard you say it." },
        { say: 'Captain Dross', text: "Orders are orders. I sleep fine." },
        { say: 'Clara', text: "Then sleep." },
        { battle: 'captain', boss: true },
        { setFlag: 'captain_dead', value: true },
        { say: 'Captain Dross', text: "...should have... made sure..." },
        { say: 'Clara', text: "Two. Only the Lord remains." }
      ];
    },

    vael: (ctx) => {
      if (ctx.flags.vael_dead) return [
        { say: null, text: "Lord Vael's throne is empty. Only ash remains — as it should be." }
      ];
      return [
        { say: 'Lord Vael', text: "So the rumor walks. The girl from Ashen Village. I'd thought you a story." },
        { say: 'Clara', text: "You burned my home for a tax I couldn't pay. You called it 'order.'" },
        { say: 'Lord Vael', text: "I call it the cost of peace. One village, that others might fear and obey." },
        { say: 'Lord Vael', text: "You've come for vengeance. How quaint. It changes nothing." },
        { say: 'Clara', text: "It changes you. From living to dead. That's enough." },
        { battle: 'vael', boss: true },
        { setFlag: 'vael_dead', value: true },
        { ending: true }
      ];
    },

    ending: () => ([
      { say: 'Lord Vael', text: "...impossible... a single girl... from the ashes..." },
      { say: 'Clara', text: "Not from the ashes. I AM the ashes. And ash remembers." },
      { fade: 'out', dur: 60 },
      { narrate: [
        "Lord Vael fell. The keep went quiet.",
        "Three names struck through. The promise kept."
      ] },
      { narrate: [
        "Clara walked back through Greyhold, then the woods,",
        "then the cold ruins of Ashen Village —",
        "to three unmarked graves."
      ] },
      { narrate: [
        "She knelt. For the first time in a year,",
        "she let herself weep.",
        "",
        "The agony did not leave her.",
        "But it was, at last, her own."
      ] },
      { narrate: [
        "— THE END —",
        "",
        "Thank you for playing.",
        "Anonymous Agony II: Clara's Revenge"
      ] },
      { credits: true }
    ])
  };

  // ---------------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------------
  const DATA = {
    PAL, CHARS, TILE_INFO, MAPS, ITEMS, SKILLS, ENEMIES, GROUPS,
    PARTY_DEFS, SCRIPTS, expForLevel, isSolid,
    TILE: 16, VIEW_W: 16, VIEW_H: 12
  };

  global.DATA = DATA;
  if (typeof module !== 'undefined' && module.exports) module.exports = DATA;

})(typeof window !== 'undefined' ? window : globalThis);
