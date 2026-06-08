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
    clara:    { skin:'#e8c4a0', hair:'#7a2418', style:'long',  shirt:'#2c4a32', pants:'#1c1c24', cape:'#561a1a' },
    haze:     { skin:'#d6b088', hair:'#161618', style:'short', shirt:'#26262e', pants:'#1a1a20', cape:'#3a1414' },
    samson:   { skin:'#d8b890', hair:'#b8bcc4', style:'short', shirt:'#cfd2da', pants:'#33384a' },
    woman:    { skin:'#e3bd97', hair:'#b08030', style:'long',  shirt:'#7a5a8a', pants:'#3a2c3a' },
    child:    { skin:'#e8c4a0', hair:'#5a3a20', style:'short', shirt:'#caa23a', pants:'#3a3a46' },
    merchant: { skin:'#d2a878', hair:'#3a3a3a', style:'bald',  shirt:'#2f6a5a', pants:'#26302c' },
    innkeep:  { skin:'#e0b78e', hair:'#7a5a3a', style:'short', shirt:'#b0c0d0', pants:'#4a5a6a' },
    villager: { skin:'#dcb389', hair:'#43321f', style:'short', shirt:'#566b7a', pants:'#2c343a' },
    soldier:  { skin:'#c99c70', hair:'#2a2a2a', style:'helm',  shirt:'#3a4452', pants:'#2c2c34' },
    craig:    { skin:'#d2a878', hair:'#2e2a26', style:'short', shirt:'#28324c', pants:'#1c2334' },
    enny:     { skin:'#dfe1e6', hair:'#cfc9b8', style:'short', shirt:'#bcd0cf', pants:'#9aa6ad' },
    annie:    { skin:'#e3bd97', hair:'#4a352a', style:'long',  shirt:'#2f8a8a', pants:'#236a6a' },
    mother:   { skin:'#e0b890', hair:'#6a4a6a', style:'long',  shirt:'#7a4a52', pants:'#3a2c34' },
    father:   { skin:'#cf9e72', hair:'#3a3530', style:'bald',  shirt:'#5a5240', pants:'#2c2a24' },
    tralalero:{ skin:'#3f74b0', hair:'#2b568c', style:'short', shirt:'#3f74b0', pants:'#22406a' },
    herald:   { skin:'#9a6b2f', hair:'#5e3f18', style:'hood',  shirt:'#7a5223', pants:'#5a3c18' },
    tung:     { skin:'#b07d33', hair:'#6e4a1f', style:'hood',  shirt:'#8a5e26', pants:'#5e3f18' },
    ghost:    { skin:'#bcd0d8', hair:'#9ab0bc', style:'long',  shirt:'#5a7a86', pants:'#46606a' }
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
    // garden hedge cluster beside the boarded-up house
    set(g, 4, 9, 'b'); set(g, 6, 9, 'b'); set(g, 5, 10, 'b');
    set(g, 4, 11, 'b'); set(g, 6, 11, '%');
    // a few flowers / bushes
    set(g, 9, 5, '%'); set(g, 22, 9, '%'); set(g, 10, 16, 'b'); set(g, 18, 7, 'b');
    // south exit to woods
    set(g, 13, H - 1, 'D'); set(g, 14, H - 1, 'D');
    set(g, 13, H - 2, ':'); set(g, 14, H - 2, ':');

    return {
      id: 'village', name: 'Maple Street — 3:00 AM', music: 'village', indoor: false,
      w: W, h: H, tiles: rows(g),
      start: { x: 5, y: 8, dir: 'down' },
      exits: [
        { x: 13, y: 19, to: 'woods', tx: 13, ty: 1, dir: 'down' },
        { x: 14, y: 19, to: 'woods', tx: 14, ty: 1, dir: 'down' }
      ],
      npcs: [
        { id: 'samson',   x: 15, y: 9,  dir: 'left', char: 'samson', name: 'Dr. Samson', script: 'samson' },
        { id: 'neighbor', x: 5,  y: 12, dir: 'up',   char: 'woman',  name: 'Neighbor',   script: 'neighbor' },
        { id: 'kid',      x: 21, y: 10, dir: 'down', char: 'child',  name: 'Kid',        script: 'kid' }
      ],
      objects: [
        { id: 'memory',     x: 5, y: 10, look: 'memory' },
        { id: 'door_knock', x: 5, y: 6,  look: 'door_knock' }
      ],
      triggers: [
        { id: 'intro', x: 5, y: 8, once: true, script: 'intro' }
      ]
    };
  }

  // ---------------------------------------------------------------------------
  // MAP 2 — Night Streets (urban; no forest)
  // ---------------------------------------------------------------------------
  function buildWoods() {
    const W = 30, H = 24;
    const g = grid(W, H, 'a'); // asphalt
    rectBorder(g, 0, 0, W, H, 'W');
    // blocks of buildings forming a winding route through the streets
    const blocks = [
      [3,3],[4,3],[5,3],[6,3],[8,4],[9,4],[2,6],[3,6],[6,7],[7,7],[8,7],
      [11,5],[12,5],[13,5],[14,6],[20,3],[21,3],[22,4],[25,5],[26,5],
      [4,10],[5,10],[6,11],[10,9],[11,9],[12,10],[16,8],[17,8],[18,9],
      [22,9],[23,9],[24,10],[26,11],[3,14],[4,14],[7,15],[8,15],[12,14],
      [13,15],[17,14],[18,14],[21,15],[22,15],[25,15],[6,18],[7,18],
      [11,19],[12,19],[16,19],[17,19],[20,19],[21,19],[25,18],[26,18],
      [9,21],[10,21],[19,21],[20,21]
    ];
    blocks.forEach(([x, y]) => set(g, x, y, Math.random() < 0.5 ? 'W' : 'B'));
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
      id: 'woods', name: 'Night Streets', music: 'woods', indoor: false,
      w: W, h: H, tiles: rows(g),
      start: { x: 13, y: 2, dir: 'down' },
      exits: [
        { x: 13, y: 1, to: 'village', tx: 13, ty: 18, dir: 'up' },
        { x: 14, y: 1, to: 'village', tx: 14, ty: 18, dir: 'up' },
        { x: 25, y: 23, to: 'town', tx: 14, ty: 1, dir: 'down', cond: 'woods_clear', deny: 'woods_blocked' }
      ],
      npcs: [
        { id: 'tralalero', x: 20, y: 18, dir: 'up', char: 'tralalero', name: 'Tralalero Tralala', script: 'tralalero' }
      ],
      objects: [
        { id: 'chest_woods', x: 6, y: 9, look: 'chest', chest: { item: 'potion', n: 2 } }
      ],
      triggers: [],
      encounters: { rate: 0.08, table: ['hound', 'hound', 'crow', 'sleepwalker'] }
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
      id: 'town', name: 'Cedar Hollow', music: 'town', indoor: false,
      w: W, h: H, tiles: rows(g),
      start: { x: 14, y: 2, dir: 'down' },
      exits: [
        { x: 14, y: 1, to: 'woods', tx: 25, ty: 21, dir: 'up' },
        { x: 15, y: 1, to: 'woods', tx: 25, ty: 21, dir: 'up' },
        { x: 14, y: 21, to: 'keep', tx: 9, ty: 22, dir: 'down', cond: 'gate_open', deny: 'gate_locked' },
        { x: 15, y: 21, to: 'keep', tx: 10, ty: 22, dir: 'down', cond: 'gate_open', deny: 'gate_locked' }
      ],
      npcs: [
        { id: 'haze',     x: 8,  y: 11, dir: 'right', char: 'haze',     name: 'Haze',      script: 'haze' },
        { id: 'innkeep',  x: 6,  y: 8,  dir: 'down',  char: 'innkeep',  name: 'Night Nurse', script: 'inn' },
        { id: 'merchant', x: 24, y: 8,  dir: 'down',  char: 'merchant', name: 'Clerk',     script: 'shop' },
        { id: 'gossip',   x: 19, y: 13, dir: 'left',  char: 'villager', name: 'Townsfolk', script: 'gossip' },
        { id: 'guard',    x: 14, y: 18, dir: 'down',  char: 'soldier',  name: 'Watchman',  script: 'wayguard' }
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
      id: 'keep', name: 'The Hour Between', music: 'keep', indoor: true,
      w: W, h: H, tiles: rows(g),
      start: { x: 9, y: 22, dir: 'up' },
      exits: [
        { x: 9, y: 23, to: 'town', tx: 14, ty: 20, dir: 'down' },
        { x: 10, y: 23, to: 'town', tx: 15, ty: 20, dir: 'down' }
      ],
      npcs: [
        { id: 'herald', x: 9, y: 13, dir: 'down', char: 'herald', name: 'The Hollow Herald',     script: 'herald' },
        { id: 'tung',   x: 9, y: 5,  dir: 'down', char: 'tung',   name: 'Tung Tung Tung Sahur', script: 'tung' }
      ],
      objects: [
        { id: 'chest_keep', x: 3, y: 18, look: 'chest', chest: { item: 'elixir', n: 1 } },
        { id: 'chest_keep2', x: 16, y: 18, look: 'chest', chest: { item: 'tonic', n: 3 } }
      ],
      triggers: [
        { id: 'lair_enter', x: 9, y: 21, once: true, script: 'lair_enter' }
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
    potion:  { name: 'Painkillers',  kind: 'heal', amount: 35, price: 18, desc: 'Dulls the pain. Restores 35 HP.' },
    hipotion:{ name: 'First-Aid Kit',kind: 'heal', amount: 80, price: 55, desc: 'Restores 80 HP.' },
    tonic:   { name: 'Energy Drink', kind: 'mp',   amount: 18, price: 22, desc: 'Restores 18 MP.' },
    bandage: { name: 'Bandage',      kind: 'cure', amount: 18, price: 12, desc: 'Heals 18 HP and stops bleeding.' },
    elixir:  { name: 'Strong Coffee',kind: 'full', amount: 0,  price: 200,desc: 'Fully restores HP and MP.' },
    iron_key:{ name: 'Kentungan Mallet', kind: 'key', amount: 0, price: 0, desc: 'A wooden drum-beater. Sound it to open the way between the hours.' }
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
    hound:      { name: 'Night Hound',  hp: 16,  atk: 6,  def: 2,  spd: 7, exp: 12, gold: 5,  art: 'wolf' },
    crow:       { name: 'Omen Crow',    hp: 10,  atk: 5,  def: 1,  spd: 9, exp: 8,  gold: 3,  art: 'crow' },
    sleepwalker:{ name: 'Sleepwalker',  hp: 24,  atk: 8,  def: 3,  spd: 5, exp: 20, gold: 14, art: 'bandit',
                  skills: [{ chance: 0.25, skill: 'rend' }] },
    tralalero:  { name: 'Tralalero Tralala', hp: 78, atk: 12, def: 5, spd: 9, exp: 60, gold: 60, art: 'tralalero', boss: true,
                  drop: 'iron_key',
                  skills: [{ chance: 0.30, skill: 'rend' }] },
    herald:     { name: 'The Hollow Herald', hp: 140, atk: 15, def: 8, spd: 6, exp: 95, gold: 120, art: 'herald', boss: true,
                  skills: [{ chance: 0.3, skill: 'sunder' }] },
    tung:       { name: 'Tung Tung Tung Sahur', hp: 280, atk: 18, def: 10, spd: 8, exp: 0, gold: 0, art: 'tung', boss: true, noRun: true,
                  skills: [{ chance: 0.30, skill: 'reckoning' }, { chance: 0.25, skill: 'rend' }] }
  };

  // Encounter groups for the woods random table -> arrays of enemy keys
  const GROUPS = {
    hound: () => Math.random() < 0.3 ? ['hound', 'hound'] : ['hound'],
    crow:  () => Math.random() < 0.5 ? ['crow'] : ['crow', 'hound'],
    sleepwalker: () => ['sleepwalker']
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
    haze: {
      name: 'Haze', char: 'haze',
      base: { hp: 48, mp: 10, atk: 10, def: 6, spd: 6 },
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
        "Clara's Revenge"
      ] },
      { narrate: [
        "A house on Maple Street. A few years ago.",
        "Back when the lights were always on,",
        "and the loudest thing in it was a little girl."
      ] },
      { say: 'Clara', text: "HAAAZE. You PROMISED you'd play the dumb co-op level with me. Oh my god. You are SUCH an Ass." },
      { say: 'Haze', text: "Language, twerp. ...After dinner. And quit grinning at me like that, it's creepy." },
      { say: 'Clara', text: "Can't help it! My face just does this when I win. Which is always. Get used to it, loser." },
      { narrate: [
        "Clara. Ten years old. Scary-smart. Sunny.",
        "Half her life lived online — friends, games,",
        "a hundred little chats glowing past her bedtime.",
        "",
        "She was the heart of a very quiet house."
      ] },
      { narrate: [
        "Then, one ordinary afternoon,",
        "the bad thing happened.",
        "",
        "The kind that doesn't leave bruises you can see.",
        "The house never sounded the same again."
      ] },
      { narrate: [
        "There was a hospital after that. White rooms.",
        "A kind, tired man named Dr. Samson.",
        "",
        "Clara stopped grinning."
      ] },
      { say: 'Clara', text: "...Dr. Samson says if I say it out loud, it gets smaller. ...He's wrong. It just learns my voice." },
      { narrate: [
        "Haze didn't go to therapy.",
        "Haze went hunting. The news gave him a name —",
        "'the Anonymous.' Then the courts gave him another.",
        "",
        "'Guilty.' And took him away too."
      ] },
      { narrate: [
        "So Clara stayed. Alone in the house on Maple Street.",
        "Alone with the quiet, and the dark, and a guilt",
        "that was never hers to carry —",
        "but moved in anyway, and never paid rent."
      ] },
      { narrate: [
        "The grandmothers have a saying.",
        "Before dawn, the drum calls you to rise. To sahur.",
        "You answer. You always answer.",
        "",
        "Ignore the call three times... and something answers FOR you.",
        "It walks in from the hour that has no name. It carries a bat."
      ] },
      { say: 'Tung Tung Tung Sahur', text: "tung... tung... tung... sahur~ tralalero tralala, bambina Claraaa..." },
      { say: 'Tung Tung Tung Sahur', text: "you no answer? uno... due... TRE knock-knock! bombardiro crocodilo! e poi... I come with the stick. tung tung tung!" },
      { narrate: [
        "It feeds on the sleepless and the guilt-ridden.",
        "Clara was a feast.",
        "",
        "For weeks it knocked, and weeping, she answered every time.",
        "Until tonight."
      ] },
      { narrate: [
        "3:00 AM. The porch boards creak.",
        "Knock one. She freezes. Knock two. She does not move.",
        "",
        "Knock three.",
        "",
        "Then the lock goes quiet — and the air goes wrong.",
        "The hour without a name is bleeding into the house."
      ] },
      { fade: 'in', dur: 50 },
      { say: 'Clara', text: "Okay. Okay okayokayokay. Breathe. ...God, Haze would call me such an idiot for this." },
      { say: 'Clara', text: "He'd ALSO say don't you DARE let it win. So. ...Fine. I'm up. I'm answering." },
      { say: 'Clara', text: "Tung Tung Tung Sahur. You wanted me awake? I'm awake. Come knock ONE more time." },
      { say: null, text: "(Dr. Samson is waiting under the porch light. Talk to him.)" }
    ]),

    samson: (ctx) => {
      if (ctx.flags.tung_dead) return [
        { say: 'Dr. Samson', text: "It's quiet. Really quiet. You did it, Clara. ...Get some sleep. Doctor's orders." }
      ];
      if (ctx.flags.samson_told) return [
        { say: 'Dr. Samson', text: "Through the streets to Cedar Hollow, then sound the drum. The way between the hours will open." },
        { say: 'Dr. Samson', text: "It eats guilt, Clara. So don't hand it yours. What happened was never your fault. Say it walking." }
      ];
      return [
        { say: 'Dr. Samson', text: "Clara. You called me at three in the morning, so here I am. Old habits — you were my patient a long time." },
        { say: 'Clara', text: "It's real, right? The drum thing the old folks warn about. It already took the Hendersons. And the kid two doors down." },
        { say: 'Dr. Samson', text: "Tung Tung Tung Sahur. It comes for the ones who can't answer the call — the sleepless. The guilt-ridden." },
        { say: 'Dr. Samson', text: "Clara... it has circled you for years. To a thing like that, you smell like a home-cooked meal." },
        { say: 'Clara', text: "Cool. Super reassuring, doc. A+. ...So how do I make it stop?" },
        { say: 'Dr. Samson', text: "Find where the hours meet, beyond Cedar Hollow. Take Haze's old bat. And take these — please." },
        { give: 'potion', n: 3 },
        { gold: 30 },
        { setFlag: 'samson_told', value: true },
        { say: null, text: "(Received 3x Painkillers and 30 gold. Head down Maple Street into the night.)" }
      ];
    },

    neighbor: () => ([
      { say: 'Neighbor', text: "I keep the porch light on and I answer every single time it knocks. Every time." },
      { say: 'Neighbor', text: "You're going AFTER it? ...God. Don't ignore the drum, Clara. Whatever you do." }
    ]),

    kid: (ctx) => ctx.flags.tung_dead ? [
      { say: 'Kid', text: "I slept all night! No knocking! You really got it, didn't you?" }
    ] : [
      { say: 'Kid', text: "I'm not s'posed to be up. But if I close my eyes I hear the tung-tung-tung..." }
    ],

    memory: () => ([
      { say: null, text: "Haze's old room. His jacket still hangs on the door. A photo of two grinning kids who didn't know yet." },
      { say: 'Clara', text: "Your dumb jacket still smells like you, Ass. ...You hunted the monsters so I didn't have to. Okay. My turn now." }
    ]),

    door_knock: () => ([
      { say: null, text: "The front door. Three pale dents in the wood, at exactly the height of a wooden bat." },
      { say: null, text: "tung... tung... tung..." }
    ]),

    chest: (ctx, obj) => {
      const it = obj.chest;
      return [
        { give: it.item, n: it.n },
        { setFlag: 'chest_' + obj.id, value: true },
        { say: null, text: "(Found " + it.n + "x " + ITEMS[it.item].name + "!)" }
      ];
    },

    tralalero: (ctx) => {
      if (ctx.flags.tralalero_dead) return [
        { say: null, text: "The shark-thing is gone. Its mallet sits in a puddle under the streetlight. The drum can be sounded now." }
      ];
      return [
        { say: '???', text: "Tralalero tralala! porco shark in the parking lot, porco SHAAARK!" },
        { say: 'Clara', text: "...A shark. Wearing sneakers. In the middle of the street. Yeah. Sure. Why not. Tonight's already insane." },
        { say: 'Tralalero Tralala', text: "Sahur send me, bambina Clara! tralalala, no one reach the drum, no one no one NO ONE!" },
        { say: 'Clara', text: "Move, fish-stick. I'm having a really bad night and you are NOT helping." },
        { battle: 'tralalero', boss: true },
        { setFlag: 'tralalero_dead', value: true },
        { setFlag: 'woods_clear', value: true },
        { say: 'Tralalero Tralala', text: "...tralala... lero...... la..." },
        { say: null, text: "(It dropped the Kentungan Mallet. The way to the hour between can be opened now.)" }
      ];
    },

    haze: (ctx) => {
      if (ctx.flags.haze_joined) return [
        { say: 'Haze', text: "Lead on, sis. The Herald and the big one are waiting. Let's finish it." }
      ];
      return [
        { say: '???', text: "Still picking fights way out of your weight class, twerp. ...You get that from me." },
        { say: 'Clara', text: "...Haze? No. No no no. They TOOK you. I waved at a bus with bars on the windows. You're not—" },
        { say: 'Haze', text: "Real? Out here, where the hours meet, 'real' gets pretty thin, kiddo. The thing got me before it got the neighbors." },
        { say: 'Haze', text: "I couldn't protect you when it counted. Not really. So let me cover you for this one. One last time." },
        { say: 'Clara', text: "...You absolute Ass. You don't get to show up and make me cry in a haunted parking lot." },
        { say: 'Clara', text: "...Keep up, okay? I missed you so much it's stupid." },
        { join: 'haze' },
        { setFlag: 'haze_joined', value: true },
        { say: null, text: "(Haze — the Anonymous — joined your party!)" }
      ];
    },

    inn: () => ([
      { rest: true }
    ]),

    shop: () => ([
      { shop: ['potion', 'hipotion', 'tonic', 'bandage', 'elixir'] }
    ]),

    gossip: (ctx) => ctx.flags.gate_open ? [
      { say: 'Townsfolk', text: "You sounded the drum? You opened the WAY? Kid... nobody comes back out of the hour between." }
    ] : [
      { say: 'Townsfolk', text: "The way only opens to the kentungan mallet — the drum-beater itself. Sound it, and the hours split open." },
      { say: 'Townsfolk', text: "That shark-thing prowling the back streets had it last. If you can take it... Cedar Hollow will pray for you." }
    ],

    wayguard: (ctx) => {
      if (ctx.flags.gate_open) return [
        { say: 'Watchman', text: "The way's open. Whatever's in there... end it, kid." }
      ];
      if (ctx.hasItem('iron_key')) return [
        { say: 'Watchman', text: "That's the kentungan mallet. From the old drum tower. You really took it off that thing." },
        { say: 'Clara', text: "Stand back." },
        { say: null, text: "Clara raises the mallet and strikes the silent drum.  TUNG. TUNG. TUNG." },
        { setFlag: 'gate_open', value: true },
        { say: null, text: "(The air splits open. The way to the hour between yawns wide.)" }
      ];
      return [
        { say: 'Watchman', text: "The way won't open without the kentungan mallet. The drum has to be sounded." }
      ];
    },

    lair_enter: () => ([
      { say: 'Clara', text: "The hour between. No dawn, no dusk. Just... waiting." },
      { say: 'Haze', text: "The Hollow Herald keeps the inner door. The big one — Sahur — is past it. Ready?" },
      { say: 'Clara', text: "I've been ready since I was ten." }
    ]),

    herald: (ctx) => {
      if (ctx.flags.herald_dead) return [
        { say: null, text: "The Herald's drum lies split in two. The inner door stands open." }
      ];
      return [
        { say: 'The Hollow Herald', text: "tung. tung. tung. you would not answer. now you are answered FOR." },
        { say: 'Clara', text: "You knocked on my door for years. Let me knock back." },
        { battle: 'herald', boss: true },
        { setFlag: 'herald_dead', value: true },
        { say: 'Haze', text: "Just the big one left, Clara. Whatever it says to you in there — don't believe it." }
      ];
    },

    tung: (ctx) => {
      if (ctx.flags.tung_dead) return [
        { say: null, text: "Where the creature stood, only a plain wooden drum-beater remains. The hour is over." }
      ];
      return [
        { say: 'Tung Tung Tung Sahur', text: "tung tung tung sahuuur~ little Clara! tralalero tralala, you no answer, so I knock and knock and KNOCK, tung tung tung!" },
        { say: 'Clara', text: "You've been the sound under everything. Every sleepless night since I was ten. The thing in the walls. ...You're real ugly in person, by the way." },
        { say: 'Tung Tung Tung Sahur', text: "bombardiro crocodilo! I am you GUILT, bambina, con la faccia e il bat! lirili larila~ you no can kill your own guilt, no no no, tralalala!" },
        { say: 'Haze', text: "She's not alone in the dark anymore. Go on, sis. Say it." },
        { say: 'Clara', text: "It was never my fault. It was never mine to carry. ...And I'm DONE skipping breakfast for you. Sahur's cancelled, you wooden freak." },
        { say: 'Tung Tung Tung Sahur', text: "...tung? tung?! NO SKIBIDI! TUNG TUNG TUNG SAHUUUR—!" },
        { battle: 'tung', boss: true },
        { setFlag: 'tung_dead', value: true },
        { ending: true }
      ];
    },

    ending: () => ([
      { say: 'Tung Tung Tung Sahur', text: "...t-tung... tralale...ro...... she... answer... back...?" },
      { say: 'Clara', text: "Tung Tung Tung Sahur. I heard you. The first time, every time. ...And now I'm letting you go." },
      { fade: 'out', dur: 60 },
      { narrate: [
        "The drumming stopped.",
        "For the first time in years, the hour before dawn",
        "was simply... quiet."
      ] },
      { narrate: [
        "Haze walked her back to the edge of the hour.",
        "He couldn't follow into the morning. They both knew it.",
        "",
        "\"Go to sleep, sis,\" he said. \"You earned it.\""
      ] },
      { narrate: [
        "On Maple Street the sun came up.",
        "Clara stood on the porch and, at last,",
        "let herself cry — and then breathe.",
        "",
        "The agony did not vanish.",
        "But it was, at last, only hers. And it was quiet."
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

  // Maps a speaker's display name to a portrait key (for the dialogue box).
  const SPEAKER_PORTRAITS = {
    'Clara': 'clara', 'Haze': 'haze', 'Dr. Samson': 'samson',
    'Tung Tung Tung Sahur': 'tung', 'Tralalero Tralala': 'tralalero', 'The Hollow Herald': 'herald',
    'Neighbor': 'woman', 'Kid': 'child', 'Night Nurse': 'innkeep', 'Clerk': 'merchant',
    'Townsfolk': 'villager', 'Watchman': 'soldier',
    'Mother': 'mother', 'Father': 'father', 'Annie': 'annie', 'Enny': 'enny',
    'Officer Craig': 'craig', 'Craig': 'craig'
  };

  // ---------------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------------
  const DATA = {
    PAL, CHARS, TILE_INFO, MAPS, ITEMS, SKILLS, ENEMIES, GROUPS,
    PARTY_DEFS, SCRIPTS, SPEAKER_PORTRAITS, expForLevel, isSolid,
    TILE: 16, VIEW_W: 16, VIEW_H: 12
  };

  global.DATA = DATA;
  if (typeof module !== 'undefined' && module.exports) module.exports = DATA;

})(typeof window !== 'undefined' ? window : globalThis);
