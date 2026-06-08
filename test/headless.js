/* Headless logic test: stub the browser, load the engine, simulate a playthrough.
 * Catches runtime crashes (undefined refs, bad flow) without rendering. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ---- Fake canvas 2D context (all no-ops, getImageData returns real-ish data) ----
function makeCtx() {
  const handler = {
    get(t, p) {
      if (p in t) return t[p];
      if (p === 'canvas') return { width: 256, height: 192 };
      // any method -> no-op function; any property -> 0
      return typeof p === 'string' ? (function () {}) : undefined;
    },
    set() { return true; }
  };
  const base = {
    globalAlpha: 1, fillStyle: '#000', font: '8px monospace', textBaseline: 'top',
    imageSmoothingEnabled: false,
    measureText: (s) => ({ width: String(s).length * 5 }),
    getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) }),
    putImageData: () => {},
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    drawImage: () => {}, fillRect: () => {}, fillText: () => {}, save: () => {}, restore: () => {},
    translate: () => {}, scale: () => {}, clearRect: () => {}, beginPath: () => {}, fill: () => {},
    createLinearGradient: () => ({ addColorStop: () => {} })
  };
  return new Proxy(base, handler);
}

function makeCanvas(w, h) {
  return {
    width: w || 256, height: h || 192,
    style: {}, classList: { add() {}, remove() {} },
    getContext: () => makeCtx(),
    addEventListener: () => {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: w, height: h })
  };
}

// ---- DOM / window stubs ----
const listeners = {};
const sandbox = {};
sandbox.global = sandbox;
sandbox.globalThis = sandbox;
sandbox.console = console;
sandbox.Math = Math; sandbox.Date = Date; sandbox.JSON = JSON;
sandbox.Set = Set; sandbox.Map = Map; sandbox.Array = Array; sandbox.Object = Object;
sandbox.Uint8ClampedArray = Uint8ClampedArray; sandbox.parseInt = parseInt; sandbox.parseFloat = parseFloat;
sandbox.isNaN = isNaN; sandbox.String = String; sandbox.Number = Number; sandbox.Boolean = Boolean;
sandbox.performance = { now: () => Date.now() };
sandbox.requestAnimationFrame = function (cb) { sandbox.__raf = cb; return 1; };
sandbox.setTimeout = function () { return 0; };
sandbox.clearTimeout = function () {};
sandbox.navigator = { maxTouchPoints: 0 };
const store = {};
sandbox.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; }
};
sandbox.addEventListener = (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); };
sandbox.AudioContext = function () {
  const param = (v) => ({ value: v, setValueAtTime: () => {}, setTargetAtTime: () => {}, exponentialRampToValueAtTime: () => {}, linearRampToValueAtTime: () => {} });
  const node = () => ({
    connect: () => {}, start: () => {}, stop: () => {}, disconnect: () => {},
    gain: param(1), frequency: param(440), Q: param(1), type: 'square'
  });
  return {
    state: 'running', currentTime: 0, sampleRate: 44100, destination: {},
    resume: () => {}, createGain: node, createOscillator: node, createBiquadFilter: node,
    createConvolver: () => ({ connect: () => {}, buffer: null }),
    createBuffer: (c, n) => ({ getChannelData: () => new Float32Array(n) }),
    createBufferSource: () => ({ connect: () => {}, start: () => {}, buffer: null })
  };
};
const elements = {
  screen: makeCanvas(256, 192),
  loading: { style: {} }
};
sandbox.document = {
  readyState: 'complete',
  getElementById: (id) => elements[id] || null,
  createElement: (t) => t === 'canvas' ? makeCanvas(8, 8) : { style: {}, getContext: () => makeCtx() },
  querySelectorAll: () => [],
  addEventListener: (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); },
  body: { classList: { add() {}, remove() {} } }
};
sandbox.window = sandbox;

// ---- Load engine files in order ----
const ctx = vm.createContext(sandbox);
const files = ['data.js', 'audio.js', 'input.js', 'graphics.js', 'dialogue.js', 'battle.js', 'world.js', 'game.js', 'main.js'];
for (const f of files) {
  const code = fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8');
  vm.runInContext(code, ctx, { filename: f });
}

const { Input, Game, World, Battle, DATA } = sandbox;

// ---- frame stepping ----
function frame(btn) {
  if (btn) { Input.down[btn] = true; Input._queue[btn] = true; }
  Input.update();
  Game.update();
  if (btn) Input.down[btn] = false;
}
function frames(n, btn) { for (let i = 0; i < n; i++) frame(i === 0 ? btn : null); }
function waitExplore(max) {
  for (let i = 0; i < (max || 800); i++) { frame(null); if (Game.mode === 'explore') return true; }
  return false;
}
function clearCutscene(max) {
  for (let i = 0; i < (max || 6000); i++) {
    frame(i % 2 === 0 ? 'confirm' : null);
    if (['explore', 'gameover', 'credits'].includes(Game.mode)) return true;
  }
  return false;
}

// ---- BFS pathfinding over the current map ----
function bfs(sx, sy, tx, ty) {
  const W = World.map.w, H = World.map.h;
  const key = (x, y) => y * W + x;
  const q = [[sx, sy]]; const prev = new Map(); prev.set(key(sx, sy), null);
  const dirs = [[0, -1, 'up'], [0, 1, 'down'], [-1, 0, 'left'], [1, 0, 'right']];
  while (q.length) {
    const [cx, cy] = q.shift();
    if (cx === tx && cy === ty) {
      const path = []; let k = key(cx, cy);
      while (prev.get(k)) { const { px, py, d } = prev.get(k); path.unshift(d); k = key(px, py); }
      return path;
    }
    for (const [dx, dy, d] of dirs) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const k = key(nx, ny);
      if (prev.has(k)) continue;
      // allow the destination even if "solid" (e.g., walking onto it not needed here)
      if ((nx === tx && ny === ty) || !World.isSolidAt(nx, ny)) { prev.set(k, { px: cx, py: cy, d }); q.push([nx, ny]); }
    }
  }
  return null;
}
function walkTo(tx, ty, max) {
  let guard = 0;
  while (guard++ < (max || 400)) {
    if (Game.mode === 'battle') { autoBattle(); waitExplore(); }
    if (Game.mode === 'transition') { waitExplore(); }
    if (Game.mode !== 'explore') return false;
    const p = World.player;
    if (p.tx === tx && p.ty === ty) return true;
    if (p.moving) { frame(null); continue; }
    const path = bfs(p.tx, p.ty, tx, ty);
    if (!path || !path.length) return false;
    const d = path[0];
    Input.down[d] = true; Input.update(); Game.update(); Input.down[d] = false;
    // finish the tween (a battle/transition may begin on arrival; handled next loop)
    for (let i = 0; i < 20 && World.player.moving; i++) frame(null);
  }
  return false;
}
// walk next to (nx,ny), face it, and interact
function talkTo(nx, ny) {
  const cand = [[nx + 1, ny], [nx - 1, ny], [nx, ny + 1], [nx, ny - 1]]
    .filter(([x, y]) => x >= 0 && y >= 0 && x < World.map.w && y < World.map.h && !World.isSolidAt(x, y));
  // choose nearest reachable
  let best = null, bestLen = 1e9;
  for (const [x, y] of cand) {
    const path = bfs(World.player.tx, World.player.ty, x, y);
    if (path && path.length < bestLen) { bestLen = path.length; best = [x, y]; }
  }
  if (!best) return false;
  if (!walkTo(best[0], best[1])) return false;
  const p = World.player;
  if (nx > p.tx) p.dir = 'right'; else if (nx < p.tx) p.dir = 'left';
  else if (ny > p.ty) p.dir = 'down'; else p.dir = 'up';
  frame('confirm');
  return true;
}

// ---- smart auto-battle: heal when low, else attack ----
function autoBattle(max) {
  for (let i = 0; i < (max || 60000); i++) {
    if (!Battle.active) return Game.mode;
    if (Battle.phase === 'command' && Battle.menu && !Battle.subMenu) {
      const low = Battle.livingParty().find(p => p.hp / p.maxhp < 0.4);
      const canItem = !Battle.menu.items[2].disabled;
      if (low && canItem) { Battle.menu.index = 2; frame('confirm'); }       // Item
      else { Battle.menu.index = 0; frame('confirm'); }                       // Attack
    } else if (Battle.subMenu) {
      Battle.subMenu.index = 0; frame('confirm');                            // first item/skill
    } else if (Battle.phase === 'target') {
      const tm = Battle.targetMode;
      if (tm.side === 'ally') { // heal lowest-hp ally
        let bi = 0, bv = 1e9; tm.list.forEach((a, idx) => { if (a.hp < bv) { bv = a.hp; bi = idx; } }); tm.index = bi;
      } else tm.index = 0;
      frame('confirm');
    } else { frame('confirm'); }
  }
  return Game.mode;
}

// advance a story cutscene that contains battle(s): mash dialogue, fight when battle starts
function resolveStory(max) {
  for (let i = 0; i < (max || 80000); i++) {
    if (Game.mode === 'battle') { autoBattle(); continue; }
    if (['explore', 'gameover', 'credits'].includes(Game.mode)) return Game.mode;
    frame(i % 2 === 0 ? 'confirm' : null);
  }
  return Game.mode;
}

let failures = 0;
function check(name, cond) { console.log((cond ? 'PASS ' : 'FAIL ') + name); if (!cond) failures++; }
function stock() { Game.addItem('potion', 9); Game.addItem('tonic', 5); } // ensure healing supply for the bot

// ================= RUN =================
try {
  check('boots to title', Game.mode === 'title');

  Game.titleMenu.index = 0;
  frame('confirm');
  frames(40, null);
  check('clear intro', clearCutscene());
  check('in village explore', Game.mode === 'explore' && Game.state.map === 'village');
  check('party has Clara', Game.state.party.length === 1 && Game.state.party[0].key === 'clara');

  check('talked to Samson', talkTo(15, 9));
  clearCutscene();
  check('samson gave items (flag)', !!Game.state.flags.samson_told);
  check('got potions', (Game.state.items.potion || 0) >= 3);

  // examine a grave object
  check('examine memory', talkTo(5, 10));
  clearCutscene();

  check('save works', Game.save());
  check('hasSave', Game.hasSave());

  walkTo(13, 19);
  waitExplore();
  check('entered woods', Game.state.map === 'woods');

  // open the woods chest (6,9)
  talkTo(6, 9); clearCutscene();
  check('chest opened flag', !!Game.state.flags.chest_chest_woods);

  // grind a handful of random encounters directly (deterministic), healing between
  let battles = 0, lvlStart = Game.state.party[0].level;
  stock();
  for (let t = 0; t < 8; t++) {
    Game.healParty();
    Game.startRandomEncounter(DATA.MAPS.woods.encounters);
    autoBattle();
    if (Game.mode === 'gameover') break;
    waitExplore();
    if (!Game.state.flags) break;
    battles++;
  }
  check('won random battles (' + battles + ')', battles >= 4 && Game.mode === 'explore');
  check('clara leveled from grinding', Game.state.party[0].level > lvlStart);

  // heal & resupply, then go beat the houndmaster boss
  Game.healParty(); stock();
  check('reach tralalero', talkTo(20, 18));
  resolveStory();
  check('tralalero defeated', !!Game.state.flags.tralalero_dead);
  check('woods_clear set', !!Game.state.flags.woods_clear);
  check('got iron key', (Game.state.items.iron_key || 0) >= 1);

  walkTo(25, 23, 120);
  waitExplore();
  check('entered town', Game.state.map === 'town');

  // shop test: open merchant, buy a potion
  const goldStart = Game.state.gold = 100;
  talkTo(24, 8);
  // now in shop mode; buy first item
  if (Game.mode === 'shop') { Game.shop.menu.index = 0; frame('confirm'); Game.shop.menu.index = Game.shop.menu.items.length - 1; frame('confirm'); }
  waitExplore();
  check('shop purchase reduced gold', Game.state.gold < goldStart);

  // inn rest test
  talkTo(6, 8); clearCutscene();
  check('inn rested (full hp)', Game.state.party[0].hp === Game.state.party[0].maxhp);

  check('recruit Haze', talkTo(8, 11));
  clearCutscene();
  check('haze joined', !!Game.state.flags.haze_joined && Game.state.party.length === 2);

  check('talk watchman', talkTo(14, 18));
  clearCutscene();
  check('gate opened', !!Game.state.flags.gate_open);

  walkTo(14, 21, 120);
  waitExplore();
  check('entered keep', Game.state.map === 'keep');
  clearCutscene();

  // grant some levels so the attack-bot can win the bosses (player would grind/strategize)
  Game.partyGainExp(400); Game.healParty(); stock();
  check('reach herald', talkTo(9, 13));
  resolveStory();
  check('herald defeated', !!Game.state.flags.herald_dead);

  Game.partyGainExp(600); Game.healParty(); stock();
  check('reach tung', talkTo(9, 5));
  resolveStory();
  check('tung defeated', !!Game.state.flags.tung_dead);
  check('reached credits', Game.mode === 'credits');

  // pause menu smoke test (after returning to title from credits)
  for (let i = 0; i < 200; i++) { frame('confirm'); if (Game.mode === 'title') break; }
  check('returned to title', Game.mode === 'title');

} catch (e) {
  console.log('EXCEPTION: ' + (e && e.stack ? e.stack : e));
  failures++;
}

console.log('\n' + (failures === 0 ? 'ALL CHECKS PASSED' : (failures + ' CHECK(S) FAILED')));
process.exit(failures === 0 ? 0 : 1);
