/* ============================================================================
 * world.js — overworld map: tiles, grid movement, camera, NPCs, encounters.
 * ==========================================================================*/
(function (global) {
  'use strict';

  const DATA = global.DATA, GFX = global.GFX, Input = global.Input, Sound = global.Sound;
  const TILE = DATA.TILE;
  const DIRV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

  const World = {
    map: null,
    npcs: [],
    objects: [],
    player: { tx: 0, ty: 0, px: 0, py: 0, dir: 'down', moving: false, frame: 0, prog: 0, fromX: 0, fromY: 0 },
    camX: 0, camY: 0,
    animFrame: 0,
    stepCount: 0,
    _blockDeny: 0,

    loadMap(id, tx, ty, dir) {
      this.map = DATA.MAPS[id];
      this.player.tx = tx; this.player.ty = ty;
      this.player.px = tx * TILE; this.player.py = ty * TILE;
      this.player.dir = dir || 'down';
      this.player.moving = false; this.player.prog = 0;
      this.refreshEntities();
      this._updateCamera(true);
      if (global.Game) global.Game.state.map = id;
      Sound.playMusic(this.map.music || 'village');
    },

    refreshEntities() {
      const flags = global.Game ? global.Game.state.flags : {};
      this.npcs = (this.map.npcs || [])
        .filter(n => !(n.removeFlag && flags[n.removeFlag]))
        .filter(n => !(n.id === 'tung' && flags.tung_done))   // the corner empties out once faced
        .map(n => Object.assign({}, n));
      this.objects = (this.map.objects || []).map(o => Object.assign({}, o));
    },

    tileAt(x, y) {
      if (!this.map.tiles[y]) return ' ';
      const c = this.map.tiles[y][x];
      return c == null ? ' ' : c;
    },

    npcAt(x, y) { return this.npcs.find(n => n.x === x && n.y === y) || null; },
    objAt(x, y) { return this.objects.find(o => o.x === x && o.y === y) || null; },

    isSolidAt(x, y) {
      if (x < 0 || y < 0 || x >= this.map.w || y >= this.map.h) return true;
      const c = this.tileAt(x, y);
      if (DATA.isSolid(c)) return true;
      if (this.npcAt(x, y)) return true;
      if (this.objAt(x, y)) return true;                 // furniture/props block
      return false;
    },

    // -------------------------------------------------------------
    // Update (called only when free-roam is allowed)
    // -------------------------------------------------------------
    update(canMove) {
      this.animFrame++;
      const p = this.player;

      if (p.moving) {
        const speed = Input.isDown('run') ? 1 / 5 : 1 / 8;
        p.prog += speed;
        if (p.prog >= 1) {
          p.prog = 1; p.moving = false;
          p.px = p.tx * TILE; p.py = p.ty * TILE;
          this._onArrive();
        } else {
          p.px = (p.fromX + (p.tx - p.fromX) * p.prog) * TILE;
          p.py = (p.fromY + (p.ty - p.fromY) * p.prog) * TILE;
        }
        this._updateCamera(false);
        return;
      }

      if (!canMove) { this._updateCamera(false); return; }

      const dir = Input.heldDir();
      if (dir) {
        p.dir = dir;
        const [dx, dy] = DIRV[dir];
        const nx = p.tx + dx, ny = p.ty + dy;
        if (!this.isSolidAt(nx, ny)) {
          p.fromX = p.tx; p.fromY = p.ty;
          p.tx = nx; p.ty = ny;
          p.moving = true; p.prog = 0;
          this.stepCount++;
          p.frame = (p.frame + 1) % 4;
        }
      }
      this._updateCamera(false);
    },

    _onArrive() {
      const p = this.player;
      const map = this.map;
      // exits (locked exits show a deny line instead of warping)
      const ex = (map.exits || []).find(e => e.x === p.tx && e.y === p.ty);
      if (ex) {
        const flags = global.Game.state.flags;
        if (ex.cond && !flags[ex.cond]) {
          if (ex.deny) { global.Game.simpleMessage(ex.deny, 'Clara'); }
          return;
        }
        Sound.sfx('door'); global.Game.warp(ex); return;
      }
      // triggers (auto cutscenes)
      const trig = (map.triggers || []).find(t => t.x === p.tx && t.y === p.ty);
      if (trig) {
        const done = (global.Game.state.triggersDone = global.Game.state.triggersDone || {});
        if (!(trig.once && done[map.id + ':' + trig.id])) {
          if (trig.once) done[map.id + ':' + trig.id] = true;
          global.Game.runScript(trig.script);
        }
      }
    },

    interactInFront() {
      const p = this.player;
      const [dx, dy] = DIRV[p.dir];
      const fx = p.tx + dx, fy = p.ty + dy;
      const npc = this.npcAt(fx, fy);
      if (npc) { npc.dir = this._facing(p.dir); return { kind: 'npc', npc }; }
      const obj = this.objAt(fx, fy);
      if (obj) return { kind: 'object', obj };
      // also allow interacting with the tile you stand on (graves etc. handled as objects)
      const here = this.objAt(p.tx, p.ty);
      if (here) return { kind: 'object', obj: here };
      return null;
    },

    _facing(d) { return { up: 'down', down: 'up', left: 'right', right: 'left' }[d]; },

    _updateCamera(snap) {
      const p = this.player;
      const mapW = this.map.w * TILE, mapH = this.map.h * TILE;
      let cx = Math.round(p.px + TILE / 2 - GFX.W / 2);
      let cy = Math.round(p.py + TILE / 2 - GFX.H / 2);
      cx = Math.max(0, Math.min(cx, mapW - GFX.W));
      cy = Math.max(0, Math.min(cy, mapH - GFX.H));
      if (mapW < GFX.W) cx = -((GFX.W - mapW) >> 1);
      if (mapH < GFX.H) cy = -((GFX.H - mapH) >> 1);
      this.camX = cx; this.camY = cy;
    },

    // -------------------------------------------------------------
    // Render
    // -------------------------------------------------------------
    render() {
      if (!this.map) return;
      const ctx = GFX.ctx;
      GFX.clear(this.map.indoor ? '#08080c' : '#0a0e0a');
      const x0 = Math.floor(this.camX / TILE);
      const y0 = Math.floor(this.camY / TILE);
      const x1 = Math.ceil((this.camX + GFX.W) / TILE);
      const y1 = Math.ceil((this.camY + GFX.H) / TILE);

      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          if (x < 0 || y < 0 || x >= this.map.w || y >= this.map.h) continue;
          const ch = this.tileAt(x, y);
          const sx = x * TILE - this.camX, sy = y * TILE - this.camY;
          GFX.tile(ch, sx, sy, x, y, this.animFrame);
        }
      }

      // build a list of drawables (objects, npcs, player) sorted by feet-Y
      const draws = [];
      this.objects.forEach(o => draws.push({ y: o.y * TILE, fn: () => this._drawObject(o) }));
      this.npcs.forEach(n => draws.push({ y: n.y * TILE, fn: () => this._drawNpc(n) }));
      const p = this.player;
      draws.push({ y: p.py, fn: () => this._drawPlayer() });
      draws.sort((a, b) => a.y - b.y);
      draws.forEach(d => d.fn());

      // subtle indoor vignette / outdoor tint at night-ish
      if (this.map.indoor) {
        ctx.globalAlpha = 0.18; ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, GFX.W, 14); ctx.fillRect(0, GFX.H - 14, GFX.W, 14);
        ctx.globalAlpha = 1;
      }
    },

    _drawPlayer() {
      const p = this.player;
      GFX.drawChar(p.px - this.camX, p.py - this.camY, DATA.CHARS.clara, p.dir, p.frame, { walking: p.moving });
    },

    _drawNpc(n) {
      const cfg = DATA.CHARS[n.char] || DATA.CHARS.villager;
      // gentle idle: occasionally bob
      const f = (Math.floor(this.animFrame / 40) + n.x) % 8 === 0 ? 1 : 0;
      GFX.drawChar(n.x * TILE - this.camX, n.y * TILE - this.camY, cfg, n.dir || 'down', 0, { walking: false });
      // small "!" marker for the key story NPCs to nudge the player
      if (n.script && ['samson', 'haze', 'tung', 'annie', 'enny'].includes(n.script)) {
        if (this.animFrame % 80 < 40)
          GFX.text('!', n.x * TILE - this.camX + 7, n.y * TILE - this.camY - 8, { color: '#f0d860', size: 8 });
      }
    },

    // furniture / props
    _drawObject(o) {
      const x = o.x * TILE - this.camX, y = o.y * TILE - this.camY;
      const R = (a, b, w, h, c) => GFX.rect(x + a, y + b, w, h, c);
      const rr = (a, b, w, h, r, c) => GFX.roundRect(x + a, y + b, w, h, r, c);
      switch (o.look) {
        case 'photo': R(3, 1, 10, 9, '#caa46a'); R(4, 2, 8, 7, '#1c2436'); R(5, 3, 6, 5, '#5a6a86'); break;
        case 'laptop': rr(2, 4, 12, 8, 1, '#2a2d34'); R(3, 5, 10, 6, '#7fbfe6'); R(2, 12, 12, 2, '#3a3d44'); break;
        case 'clock': {
          GFX.circle(x + 8, y + 8, 6, '#2a2230'); GFX.circle(x + 8, y + 8, 5, '#e8e4d6');
          const f = global.Game.state.flags, h = (f.clock_set ? 3 : (f.clock_h || 12));
          const ang = (h % 12) / 12 * Math.PI * 2 - Math.PI / 2;
          GFX.ctx.strokeStyle = '#1a1a22'; GFX.ctx.lineWidth = 1; GFX.ctx.beginPath(); GFX.ctx.moveTo(x + 8, y + 8); GFX.ctx.lineTo(x + 8 + Math.cos(ang) * 3.5, y + 8 + Math.sin(ang) * 3.5); GFX.ctx.moveTo(x + 8, y + 8); GFX.ctx.lineTo(x + 8, y + 4); GFX.ctx.stroke();
          break;
        }
        case 'couch': rr(0, 6, 16, 8, 3, '#3a2e44'); rr(0, 3, 16, 6, 3, '#46384f'); break;
        case 'tv': rr(2, 3, 12, 9, 1, '#0a0a10'); R(3, 4, 10, 7, this.animFrame % 8 < 4 ? '#3a5f86' : '#27425e'); break;
        case 'table': rr(1, 4, 14, 8, 2, '#5a4030'); R(2, 11, 2, 4, '#46301f'); R(12, 11, 2, 4, '#46301f'); break;
        case 'fridge': rr(3, 0, 10, 16, 2, '#cfd6dc'); R(5, 6, 1, 4, '#9aa4ac'); break;
        case 'bed': rr(1, 4, 14, 11, 2, '#e8eef0'); rr(1, 2, 6, 6, 2, '#d6dde0'); R(1, 9, 14, 2, '#c0c8cc'); break;
        case 'window': R(2, 1, 12, 11, '#0a1020'); R(7, 1, 2, 11, '#20283a'); R(2, 6, 12, 1, '#20283a'); GFX.ctx.save(); GFX.ctx.globalAlpha = 0.3; R(2, 1, 12, 5, '#6a8ab0'); GFX.ctx.restore(); break;
        case 'mailbox': R(6, 4, 5, 8, '#3a3d44'); rr(5, 2, 7, 4, 1, '#4a4d54'); R(11, 5, 2, 3, '#c83a3a'); break;
        case 'car': rr(0, 4, 16, 9, 3, '#2a3340'); rr(2, 1, 12, 6, 2, '#1c2330'); GFX.circle(x + 4, y + 14, 2, '#15161a'); GFX.circle(x + 12, y + 14, 2, '#15161a'); break;
        default: rr(4, 6, 8, 8, 2, '#5a5560');
      }
    }
  };

  global.World = World;
})(typeof window !== 'undefined' ? window : globalThis);
