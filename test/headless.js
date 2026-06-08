/* Headless logic test for the grounded puzzle/exploration build.
 * Stubs the browser, then plays: title -> new game -> (skip cinematic) ->
 * (skip opening credits) -> explore -> solve the puzzle chain -> ending -> credits. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');

function makeCtx() {
  const base = {
    globalAlpha: 1, fillStyle: '#000', font: '8px sans-serif', textBaseline: 'top', lineWidth: 1, lineCap: 'butt', strokeStyle: '#000',
    measureText: (s) => ({ width: String(s).length * 5 }),
    getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) }),
    putImageData: () => {}, drawImage: () => {}, fillRect: () => {}, fillText: () => {}, strokeText: () => {},
    save: () => {}, restore: () => {}, translate: () => {}, scale: () => {}, rotate: () => {}, setTransform: () => {},
    clearRect: () => {}, beginPath: () => {}, closePath: () => {}, fill: () => {}, stroke: () => {}, clip: () => {},
    moveTo: () => {}, lineTo: () => {}, arc: () => {}, arcTo: () => {}, ellipse: () => {}, quadraticCurveTo: () => {}, bezierCurveTo: () => {}, rect: () => {},
    createLinearGradient: () => ({ addColorStop: () => {} }), createRadialGradient: () => ({ addColorStop: () => {} })
  };
  return new Proxy(base, { get(t, p) { if (p in t) return t[p]; if (p === 'canvas') return { width: 640, height: 480 }; return typeof p === 'string' ? (() => {}) : undefined; }, set() { return true; } });
}
function makeCanvas(w, h) { return { width: w || 640, height: h || 480, style: {}, classList: { add() {}, remove() {} }, getContext: () => makeCtx(), addEventListener: () => {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: w, height: h }) }; }

const sandbox = {}; sandbox.global = sandbox; sandbox.globalThis = sandbox; sandbox.window = sandbox;
sandbox.console = console; sandbox.Math = Math; sandbox.Date = Date; sandbox.JSON = JSON; sandbox.Set = Set; sandbox.Map = Map;
sandbox.Array = Array; sandbox.Object = Object; sandbox.Uint8ClampedArray = Uint8ClampedArray; sandbox.Float32Array = Float32Array;
sandbox.parseInt = parseInt; sandbox.parseFloat = parseFloat; sandbox.isNaN = isNaN; sandbox.String = String; sandbox.Number = Number; sandbox.Boolean = Boolean;
sandbox.performance = { now: () => Date.now() };
sandbox.requestAnimationFrame = (cb) => { sandbox.__raf = cb; return 1; };
sandbox.setTimeout = () => 0; sandbox.clearTimeout = () => {};
sandbox.navigator = { maxTouchPoints: 0 };
const store = {}; sandbox.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
const listeners = {}; sandbox.addEventListener = (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); };
// no AudioContext / Audio / speechSynthesis -> audio + tts safely no-op
const elements = { screen: makeCanvas(640, 480), loading: { style: {} } };
sandbox.document = { readyState: 'complete', getElementById: (id) => elements[id] || null, createElement: (t) => t === 'canvas' ? makeCanvas(8, 8) : { style: {}, getContext: () => makeCtx() }, querySelectorAll: () => [], addEventListener: (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); }, body: { classList: { add() {}, remove() {} } } };

const ctx = vm.createContext(sandbox);
['data.js', 'audio.js', 'voice.js', 'input.js', 'graphics.js', 'dialogue.js', 'world.js', 'cinematic.js', 'game.js', 'main.js']
  .forEach(f => vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, { filename: f }));

const { Input, Game, World, DATA } = sandbox;

function frame(btn) { if (btn) { Input.down[btn] = true; Input._queue[btn] = true; } Input.update(); Game.update(); if (btn) Input.down[btn] = false; }
function holdUntilExplore(max) { for (let i = 0; i < (max || 400); i++) { Input.down.cancel = true; Input.update(); Game.update(); if (Game.mode === 'explore') { Input.down.cancel = false; return true; } } Input.down.cancel = false; return false; }
function waitExplore(max) { for (let i = 0; i < (max || 400); i++) { frame(null); if (Game.mode === 'explore') return true; } return false; }
function clearScene(max) {
  for (let i = 0; i < (max || 4000); i++) {
    if (Game.mode === 'explore' || Game.mode === 'credits') return true;
    if (Game.mode === 'cutscene' && Game.ev && Game.ev.waiting === 'choice' && Game.choiceMenu) {
      Game.choiceMenu.index = Game.choiceMenu.items.length - 1; // the "I was eleven..." naming option
      frame('confirm');
    } else frame(i % 2 === 0 ? 'confirm' : null);
  }
  return false;
}

// BFS pathing
function bfs(sx, sy, tx, ty) {
  const W = World.map.w, H = World.map.h, key = (x, y) => y * W + x;
  const q = [[sx, sy]], prev = new Map(); prev.set(key(sx, sy), null);
  const dirs = [[0, -1, 'up'], [0, 1, 'down'], [-1, 0, 'left'], [1, 0, 'right']];
  while (q.length) {
    const [cx, cy] = q.shift();
    if (cx === tx && cy === ty) { const p = []; let k = key(cx, cy); while (prev.get(k)) { const e = prev.get(k); p.unshift(e.d); k = key(e.px, e.py); } return p; }
    for (const [dx, dy, d] of dirs) { const nx = cx + dx, ny = cy + dy, k = key(nx, ny); if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(k)) continue; if ((nx === tx && ny === ty) || !World.isSolidAt(nx, ny)) { prev.set(k, { px: cx, py: cy, d }); q.push([nx, ny]); } }
  }
  return null;
}
function walkTo(tx, ty, max) {
  for (let g = 0; g < (max || 200); g++) {
    if (Game.mode === 'transition') { waitExplore(); return true; }
    if (Game.mode !== 'explore') return false;
    const p = World.player; if (p.tx === tx && p.ty === ty) return true; if (p.moving) { frame(null); continue; }
    const path = bfs(p.tx, p.ty, tx, ty); if (!path || !path.length) return false;
    const d = path[0]; Input.down[d] = true; Input.update(); Game.update(); Input.down[d] = false;
    for (let i = 0; i < 20 && World.player.moving; i++) frame(null);
    if (Game.mode !== 'explore') { if (Game.mode === 'transition') waitExplore(); return true; } // hit an exit/trigger
  }
  return false;
}
function interact(nx, ny) {
  const cand = [[nx + 1, ny], [nx - 1, ny], [nx, ny + 1], [nx, ny - 1]].filter(([x, y]) => x >= 0 && y >= 0 && x < World.map.w && y < World.map.h && !World.isSolidAt(x, y));
  let best = null, bl = 1e9; for (const [x, y] of cand) { const pa = bfs(World.player.tx, World.player.ty, x, y); if (pa && pa.length < bl) { bl = pa.length; best = [x, y]; } }
  if (!best) return false; if (!walkTo(best[0], best[1])) return false;
  const p = World.player; if (nx > p.tx) p.dir = 'right'; else if (nx < p.tx) p.dir = 'left'; else if (ny > p.ty) p.dir = 'down'; else p.dir = 'up';
  frame('confirm'); return true;
}

let fails = 0; const check = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) fails++; };

try {
  check('boots to title', Game.mode === 'title');
  Game.titleMenu.index = 0; frame('confirm'); for (let i = 0; i < 40; i++) frame(null);
  check('intro cinematic playing', Game.mode === 'cinematic');
  // skip cinematic, then skip the opening credits (hold cancel through both)
  check('skipped to explore', holdUntilExplore(600));
  check('on Maple Street', Game.state.map === 'street');

  walkTo(10, 9); clearScene();                       // street arrival cutscene
  walkTo(10, 3); waitExplore();                       // into the house
  check('entered house', Game.state.map === 'house');
  walkTo(11, 14); clearScene();                       // house_enter trigger

  interact(19, 3); clearScene();                      // Haze -> note
  check('got Haze note', Game.hasItem('haze_note') && !!Game.state.flags.note_taken);
  interact(5, 1); clearScene();                       // family photo
  check('photo seen', !!Game.state.flags.photo_seen);
  interact(20, 3); clearScene();                      // laptop / Tung first contact
  check('laptop seen', !!Game.state.flags.laptop_seen);

  for (let i = 0; i < 4 && !Game.state.flags.clock_set; i++) { interact(4, 10); clearScene(); }
  check('clock set to 3:00', !!Game.state.flags.clock_set);

  walkTo(11, 16); walkTo(11, 17); waitExplore();      // front door -> hospital
  check('reached hospital', Game.state.map === 'hospital');
  walkTo(11, 11); clearScene();                       // hosp_enter
  interact(12, 5); clearScene();                      // Samson
  interact(4, 8); clearScene();                       // Annie (Haze-is-dead twist)
  check('haze truth revealed', !!Game.state.flags.haze_truth);
  interact(19, 9); clearScene();                      // Enny -> hospital_done
  check('hospital done', !!Game.state.flags.hospital_done);

  walkTo(11, 14); waitExplore();                      // hospital exit -> back to house
  check('back in house', Game.state.map === 'house');
  walkTo(11, 6);                                       // up the hall to the locked door
  walkTo(11, 5); waitExplore();                        // into Clara's room
  check("entered Clara's room", Game.state.map === 'room');
  walkTo(6, 8); clearScene();                         // room_enter
  interact(6, 3); clearScene(8000);                   // confront Tung (climax choices -> ending)
  check('named it', !!Game.state.flags.named_it);
  check('tung done', !!Game.state.flags.tung_done);
  check('reached credits', Game.mode === 'credits');

  // back to title
  for (let i = 0; i < 200; i++) { frame('confirm'); if (Game.mode === 'title') break; }
  check('returned to title', Game.mode === 'title');
} catch (e) { console.log('EXCEPTION: ' + (e && e.stack ? e.stack : e)); fails++; }

console.log('\n' + (fails === 0 ? 'ALL CHECKS PASSED' : fails + ' CHECK(S) FAILED'));
process.exit(fails === 0 ? 0 : 1);
