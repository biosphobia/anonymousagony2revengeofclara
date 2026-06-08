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
        .map(n => Object.assign({}, n));
      // default removeFlags for story NPCs
      this.npcs = this.npcs.filter(n => {
        if (n.id === 'houndmaster' && flags.houndmaster_dead) return false;
        if (n.id === 'captain' && flags.captain_dead) return false;
        if (n.id === 'vael' && flags.vael_dead) return false;
        if (n.id === 'roan' && flags.roan_joined) return false;
        return true;
      });
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
      const flags = global.Game ? global.Game.state.flags : {};
      if (c === 'g') return !flags.gate_open;           // gate opens with flag
      if (DATA.isSolid(c)) return true;
      if (this.npcAt(x, y)) return true;
      const o = this.objAt(x, y);
      if (o && o.look === 'chest') return true;          // chests are solid
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
        } else {
          // blocked — show deny for locked gate (throttled)
          if (this.tileAt(nx, ny) === 'g' && this._blockDeny <= 0) {
            this._blockDeny = 40;
            if (global.Game) global.Game.simpleMessage('The keep gate is locked tight.');
          }
        }
      }
      if (this._blockDeny > 0) this._blockDeny--;
      this._updateCamera(false);
    },

    _onArrive() {
      const p = this.player;
      const map = this.map;
      // exits
      const ex = (map.exits || []).find(e => e.x === p.tx && e.y === p.ty);
      if (ex) {
        const flags = global.Game.state.flags;
        if (ex.cond && !flags[ex.cond]) {
          // shouldn't usually happen (blocked earlier) but guard anyway
        } else {
          Sound.sfx('door');
          global.Game.warp(ex);
          return;
        }
      }
      // triggers (auto cutscenes)
      const trig = (map.triggers || []).find(t => t.x === p.tx && t.y === p.ty);
      if (trig) {
        const done = global.Game.state.triggersDone;
        if (!(trig.once && done[map.id + ':' + trig.id])) {
          if (trig.once) done[map.id + ':' + trig.id] = true;
          global.Game.runScript(trig.script);
          return;
        }
      }
      // random encounter on tall grass
      if (map.encounters && this.tileAt(p.tx, p.ty) === ',') {
        if (Math.random() < map.encounters.rate) {
          global.Game.startRandomEncounter(map.encounters);
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
          // gate that has opened: draw floor instead of bars
          if (ch === 'g' && global.Game.state.flags.gate_open) GFX.tile('s', sx, sy, x, y, this.animFrame);
          else GFX.tile(ch, sx, sy, x, y, this.animFrame);
        }
      }

      // build a list of drawables (objects, npcs, player) sorted by feet-Y
      const draws = [];
      this.objects.forEach(o => { if (o.look === 'chest') draws.push({ y: o.y * TILE, fn: () => this._drawChest(o) }); });
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
      if (n.script && ['elias', 'houndmaster', 'roan', 'captain', 'vael', 'gateguard'].includes(n.script)) {
        if (this.animFrame % 80 < 40)
          GFX.text('!', n.x * TILE - this.camX + 7, n.y * TILE - this.camY - 8, { color: '#f0d860', size: 8 });
      }
    },

    _drawChest(o) {
      const opened = global.Game.state.flags['chest_' + o.id];
      const x = o.x * TILE - this.camX, y = o.y * TILE - this.camY;
      GFX.rect(x + 3, y + 7, 10, 7, '#6e4f36');
      GFX.rect(x + 3, y + (opened ? 2 : 5), 10, opened ? 3 : 4, '#8a6a44');
      GFX.rect(x + 3, y + 7, 10, 1, '#3a2a1a');
      GFX.rect(x + 7, y + 8, 2, 2, DATA.PAL.gold);
      if (opened) { GFX.ctx.globalAlpha = 0.4; GFX.rect(x + 3, y + 2, 10, 4, '#000'); GFX.ctx.globalAlpha = 1; }
    }
  };

  global.World = World;
})(typeof window !== 'undefined' ? window : globalThis);
