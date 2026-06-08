/* ============================================================================
 * graphics.js — canvas setup, crisp pixel text, procedural sprites & tiles.
 * ==========================================================================*/
(function (global) {
  'use strict';

  const PAL = global.DATA.PAL;
  const TILE = global.DATA.TILE; // 16

  function hexToRgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  const GFX = {
    canvas: null, ctx: null, W: 256, H: 192,
    _textCache: new Map(),
    _cacheOrder: [],

    init(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.W = canvas.width; this.H = canvas.height;
      this.ctx.imageSmoothingEnabled = false;
      this.ctx.textBaseline = 'top';
    },

    clear(color) {
      this.ctx.fillStyle = color || '#000';
      this.ctx.fillRect(0, 0, this.W, this.H);
    },

    // --- primitives ---
    rect(x, y, w, h, c) { this.ctx.fillStyle = c; this.ctx.fillRect(x | 0, y | 0, w | 0, h | 0); },
    px(x, y, c) { this.ctx.fillStyle = c; this.ctx.fillRect(x | 0, y | 0, 1, 1); },
    border(x, y, w, h, c) {
      this.rect(x, y, w, 1, c); this.rect(x, y + h - 1, w, 1, c);
      this.rect(x, y, 1, h, c); this.rect(x + w - 1, y, 1, h, c);
    },

    // Classic RPG message window: dark fill, light double frame.
    box(x, y, w, h, opt) {
      opt = opt || {};
      const ctx = this.ctx;
      ctx.globalAlpha = opt.alpha != null ? opt.alpha : 0.92;
      this.rect(x, y, w, h, opt.fill || '#0e1430');
      ctx.globalAlpha = 1;
      this.border(x, y, w, h, opt.dark || '#000');
      this.border(x + 1, y + 1, w - 2, h - 2, opt.light || '#7a8ad0');
      this.border(x + 2, y + 2, w - 4, h - 4, opt.dark2 || '#28346a');
    },

    // --- text (crisp 1-bit font derived from system monospace) ---
    _renderText(text, size, color) {
      const tmp = document.createElement('canvas');
      const tctx = tmp.getContext('2d');
      tctx.font = size + 'px monospace';
      const w = Math.max(1, Math.ceil(tctx.measureText(text).width));
      const h = size + 3;
      tmp.width = w; tmp.height = h;
      tctx.font = size + 'px monospace';
      tctx.textBaseline = 'top';
      tctx.fillStyle = '#fff';
      tctx.fillText(text, 0, 1);
      const img = tctx.getImageData(0, 0, w, h);
      const d = img.data;
      const [r, g, b] = hexToRgb(color);
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] > 110) { d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255; }
        else { d[i + 3] = 0; }
      }
      tctx.putImageData(img, 0, 0);
      return { canvas: tmp, w, h };
    },

    _getText(text, size, color) {
      const key = size + '|' + color + '|' + text;
      let e = this._textCache.get(key);
      if (!e) {
        e = this._renderText(text, size, color);
        this._textCache.set(key, e);
        this._cacheOrder.push(key);
        if (this._cacheOrder.length > 600) {
          const old = this._cacheOrder.shift();
          this._textCache.delete(old);
        }
      }
      return e;
    },

    textWidth(text, size) { return this._getText(text, size || 8, '#fff').w; },

    text(text, x, y, opt) {
      opt = opt || {};
      const size = opt.size || 8;
      const color = opt.color || PAL.ink;
      x = x | 0; y = y | 0;
      const e = this._getText(text, size, color);
      let dx = x;
      if (opt.align === 'center') dx = x - (e.w >> 1);
      else if (opt.align === 'right') dx = x - e.w;
      if (opt.shadow !== false) {
        const sh = this._getText(text, size, opt.shadowColor || '#000');
        this.ctx.drawImage(sh.canvas, dx + 1, y + 1);
      }
      this.ctx.drawImage(e.canvas, dx, y);
      return e.w;
    },

    // word-wrap helper -> array of lines fitting maxW
    wrap(text, maxW, size) {
      size = size || 8;
      const words = text.split(' ');
      const lines = [];
      let line = '';
      for (const w of words) {
        const test = line ? line + ' ' + w : w;
        if (this.textWidth(test, size) > maxW && line) { lines.push(line); line = w; }
        else line = test;
      }
      if (line) lines.push(line);
      return lines;
    },

    // HP/MP bar
    bar(x, y, w, h, frac, fg, bg) {
      frac = Math.max(0, Math.min(1, frac));
      this.rect(x, y, w, h, '#000');
      this.rect(x + 1, y + 1, w - 2, h - 2, bg || '#2a2a36');
      this.rect(x + 1, y + 1, Math.round((w - 2) * frac), h - 2, fg || '#3ac24a');
    },

    // --------------------------------------------------------------------
    // Tiles
    // --------------------------------------------------------------------
    _hash(x, y) {
      let h = (x * 374761393 + y * 668265263) ^ 0x9e3779b9;
      h = (h ^ (h >> 13)) * 1274126177;
      return ((h ^ (h >> 16)) >>> 0) / 4294967295;
    },

    tile(ch, sx, sy, wx, wy, frame) {
      const r = this.rect.bind(this);
      const rnd = this._hash(wx, wy);
      switch (ch) {
        case '.': // grass
          r(sx, sy, TILE, TILE, PAL.grass1);
          this._grassTuft(sx, sy, rnd);
          break;
        case ',': { // tall grass (encounters)
          r(sx, sy, TILE, TILE, PAL.tall1);
          this.ctx.fillStyle = PAL.tall2;
          for (let i = 0; i < 6; i++) {
            const gx = sx + 1 + ((i * 5 + (rnd * 7 | 0)) % 14);
            const gy = sy + 6 + ((i * 3) % 8);
            this.ctx.fillRect(gx, gy, 1, 4);
          }
          break;
        }
        case ':': // dirt path
          r(sx, sy, TILE, TILE, PAL.dirt1);
          this.ctx.fillStyle = PAL.dirt2;
          for (let i = 0; i < 4; i++) {
            const gx = sx + ((i * 7 + (rnd * 11 | 0)) % 15);
            const gy = sy + ((i * 5 + (rnd * 13 | 0)) % 15);
            this.ctx.fillRect(gx, gy, 2, 1);
          }
          break;
        case '%': // flowers
          r(sx, sy, TILE, TILE, PAL.grass1);
          this._grassTuft(sx, sy, rnd);
          r(sx + 4, sy + 5, 2, 2, PAL.flower);
          r(sx + 10, sy + 9, 2, 2, PAL.flower2);
          r(sx + 7, sy + 11, 2, 2, PAL.flower);
          break;
        case 'b': // bush
          r(sx, sy, TILE, TILE, PAL.grass1);
          r(sx + 2, sy + 4, 12, 10, PAL.tree1);
          r(sx + 3, sy + 5, 10, 7, PAL.tree2);
          r(sx + 5, sy + 6, 2, 2, '#3e6b40');
          break;
        case '#': // round tree
          r(sx, sy, TILE, TILE, PAL.grass1);
          r(sx + 6, sy + 10, 4, 5, PAL.trunk);
          r(sx + 2, sy + 1, 12, 11, PAL.tree1);
          r(sx + 3, sy, 10, 11, PAL.tree2);
          r(sx + 5, sy + 2, 3, 3, '#3e7a44');
          break;
        case '^': // pine
          r(sx, sy, TILE, TILE, PAL.grass1);
          r(sx + 7, sy + 12, 2, 4, PAL.trunk);
          this.ctx.fillStyle = PAL.tree1;
          this._tri(sx + 8, sy + 1, 7);
          this._tri(sx + 8, sy + 6, 8);
          this.ctx.fillStyle = PAL.tree2;
          this._tri(sx + 8, sy + 3, 5);
          break;
        case '~': { // water (animated)
          r(sx, sy, TILE, TILE, PAL.water1);
          this.ctx.fillStyle = PAL.water2;
          const off = (frame >> 3) % 4;
          for (let yy = 0; yy < TILE; yy += 4) {
            const xx = (yy + off * 2 + (wx * 3)) % TILE;
            this.ctx.fillRect(sx + xx, sy + yy + 1, 5, 1);
          }
          break;
        }
        case '=': // bridge
          r(sx, sy, TILE, TILE, PAL.water1);
          r(sx, sy + 2, TILE, 12, PAL.wood1);
          this.ctx.fillStyle = PAL.wood2;
          for (let i = 0; i < TILE; i += 3) this.ctx.fillRect(sx + i, sy + 2, 1, 12);
          r(sx, sy + 2, TILE, 1, '#3a2a1a'); r(sx, sy + 13, TILE, 1, '#3a2a1a');
          break;
        case 'o': // rock
          r(sx, sy, TILE, TILE, PAL.grass1);
          r(sx + 3, sy + 5, 10, 8, PAL.rock);
          r(sx + 4, sy + 4, 8, 3, '#6a6a74');
          r(sx + 5, sy + 9, 3, 2, '#42424c');
          break;
        case 'm': // mountain
          r(sx, sy, TILE, TILE, PAL.rock);
          this.ctx.fillStyle = '#42424c'; this._tri(sx + 8, sy + 1, 8);
          this.ctx.fillStyle = '#6a6a74'; this._tri(sx + 8, sy + 3, 5);
          break;
        case 'W': // stone wall
          r(sx, sy, TILE, TILE, PAL.stone1);
          this.ctx.fillStyle = PAL.stone2;
          r(sx + 1, sy + 1, 6, 6, PAL.stone2); r(sx + 9, sy + 1, 6, 6, PAL.stone2);
          r(sx + 1, sy + 9, 6, 6, PAL.stone2); r(sx + 9, sy + 9, 6, 6, PAL.stone2);
          break;
        case 'B': // brick building
          r(sx, sy, TILE, TILE, PAL.brick1);
          this.ctx.fillStyle = PAL.brick2;
          r(sx, sy + 1, 7, 3, PAL.brick2); r(sx + 9, sy + 1, 6, 3, PAL.brick2);
          r(sx + 4, sy + 6, 7, 3, PAL.brick2); r(sx, sy + 11, 7, 3, PAL.brick2); r(sx + 9, sy + 11, 6, 3, PAL.brick2);
          break;
        case 'D': // door
          r(sx, sy, TILE, TILE, PAL.brick1);
          r(sx + 3, sy + 2, 10, 14, PAL.wood1);
          this.ctx.fillStyle = PAL.wood2;
          r(sx + 4, sy + 3, 3, 12, PAL.wood2); r(sx + 9, sy + 3, 3, 12, PAL.wood2);
          r(sx + 10, sy + 8, 2, 2, PAL.gold);
          break;
        case 'g': // gate (iron bars)
          r(sx, sy, TILE, TILE, PAL.stone1);
          this.ctx.fillStyle = '#2a2a30';
          for (let i = 2; i < TILE; i += 4) this.ctx.fillRect(sx + i, sy, 2, TILE);
          r(sx, sy + 4, TILE, 2, '#2a2a30'); r(sx, sy + 10, TILE, 2, '#2a2a30');
          break;
        case 'f': // wood floor
          r(sx, sy, TILE, TILE, PAL.floor1);
          this.ctx.fillStyle = PAL.floor2;
          for (let i = 0; i < TILE; i += 4) this.ctx.fillRect(sx, sy + i, TILE, 1);
          break;
        case 's': // stone floor
          r(sx, sy, TILE, TILE, PAL.sfloor1);
          this.ctx.fillStyle = PAL.sfloor2;
          r(sx, sy, TILE, 1, PAL.sfloor2); r(sx, sy, 1, TILE, PAL.sfloor2);
          if (rnd > 0.7) this.px(sx + (rnd * 12 | 0) + 2, sy + (rnd * 10 | 0) + 2, '#3a3a44');
          break;
        case 'C': // carpet
          r(sx, sy, TILE, TILE, PAL.carpet);
          r(sx, sy, TILE, 1, '#5a1622'); r(sx, sy + TILE - 1, TILE, 1, '#5a1622');
          this.ctx.fillStyle = PAL.gold;
          r(sx + 7, sy + 7, 2, 2, PAL.gold);
          break;
        case '+': // grave
          r(sx, sy, TILE, TILE, PAL.grass1);
          r(sx + 5, sy + 4, 6, 10, PAL.grave);
          r(sx + 4, sy + 6, 8, 2, PAL.grave);
          r(sx + 6, sy + 5, 4, 1, '#4a4a52');
          break;
        case 'r': // rubble / ash
          r(sx, sy, TILE, TILE, PAL.rubble);
          this.ctx.fillStyle = '#2e2620';
          for (let i = 0; i < 5; i++) this.ctx.fillRect(sx + (this._hash(wx + i, wy) * 13 | 0), sy + (this._hash(wx, wy + i) * 13 | 0), 3, 2);
          this.ctx.fillStyle = '#5a4e42';
          r(sx + 2, sy + 9, 5, 2, '#5a4e42'); r(sx + 9, sy + 4, 4, 2, '#5a4e42');
          break;
        case 'P': // pillar
          r(sx, sy, TILE, TILE, PAL.sfloor1);
          r(sx + 4, sy, 8, TILE, PAL.stone2);
          r(sx + 4, sy, 2, TILE, '#8a8a96'); r(sx + 10, sy, 2, TILE, '#42424c');
          r(sx + 3, sy, 10, 2, '#8a8a96'); r(sx + 3, sy + TILE - 2, 10, 2, '#42424c');
          break;
        case 't': // table / throne
          r(sx, sy, TILE, TILE, PAL.sfloor1);
          r(sx + 1, sy + 1, 14, 13, PAL.wood1);
          r(sx + 1, sy + 1, 14, 3, PAL.wood2);
          r(sx + 5, sy + 1, 6, 6, PAL.gold);
          break;
        case 'L': { // lava (animated)
          r(sx, sy, TILE, TILE, PAL.lava1);
          this.ctx.fillStyle = PAL.lava2;
          const o = (frame >> 2) % TILE;
          for (let yy = 0; yy < TILE; yy += 5) {
            const xx = (yy * 3 + o) % TILE;
            this.ctx.fillRect(sx + xx, sy + yy + 1, 4, 2);
          }
          r(sx + ((frame >> 4) % 10) + 2, sy + 6, 2, 2, '#f4c84a');
          break;
        }
        default:
          r(sx, sy, TILE, TILE, '#101018');
      }
    },

    _grassTuft(sx, sy, rnd) {
      this.ctx.fillStyle = PAL.grass2;
      const n = 3 + (rnd * 3 | 0);
      for (let i = 0; i < n; i++) {
        const gx = sx + ((i * 6 + (rnd * 15 | 0)) % 15);
        const gy = sy + ((i * 7 + (rnd * 11 | 0)) % 14);
        this.ctx.fillRect(gx, gy, 2, 1);
      }
    },
    _tri(cx, baseY, half) { // upward triangle, apex up
      for (let i = 0; i < half; i++) this.ctx.fillRect(cx - i, baseY - half + i, i * 2 + 1, 1);
    },

    // --------------------------------------------------------------------
    // Characters (procedural). dir: up/down/left/right. frame: walk phase.
    // Drawn within a 16x16 cell at (px,py). bob/scale optional for battle.
    // --------------------------------------------------------------------
    drawChar(px, py, cfg, dir, frame, opt) {
      opt = opt || {};
      const s = opt.scale || 1;
      const ctx = this.ctx;
      const R = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(px + x * s, py + y * s, w * s, h * s); };

      const walking = opt.walking;
      const phase = walking ? (frame % 2) : 0;
      const bob = walking && (frame % 2) ? -1 : 0;

      // shadow
      ctx.globalAlpha = 0.3;
      R(4, 15, 8, 1, '#000');
      ctx.globalAlpha = 1;

      const yo = bob; // vertical offset for body when walking

      // cape (behind body) for caped characters
      if (cfg.cape && dir !== 'down') {
        R(4, 6 + yo, 8, 8, cfg.cape);
      }

      // legs
      const lL = phase === 1 ? 1 : 0;
      const lR = phase === 1 ? 0 : 1;
      R(5, 12 + yo + lL, 2, 3, cfg.pants);
      R(9, 12 + yo + lR, 2, 3, cfg.pants);
      // feet
      R(5, 14 + yo + lL, 2, 1, '#1a1a1a');
      R(9, 14 + yo + lR, 2, 1, '#1a1a1a');

      // body / torso
      R(4, 7 + yo, 8, 6, cfg.shirt);
      // simple shading
      ctx.globalAlpha = 0.25; R(4, 7 + yo, 8, 1, '#fff'); R(4, 12 + yo, 8, 1, '#000'); ctx.globalAlpha = 1;

      // arms
      if (dir === 'left') {
        R(4, 8 + yo, 2, 4, cfg.shirt); R(4, 11 + yo, 2, 1, cfg.skin);
      } else if (dir === 'right') {
        R(10, 8 + yo, 2, 4, cfg.shirt); R(10, 11 + yo, 2, 1, cfg.skin);
      } else {
        R(3, 8 + yo, 2, 4, cfg.shirt); R(11, 8 + yo, 2, 4, cfg.shirt);
        R(3, 11 + yo, 2, 1, cfg.skin); R(11, 11 + yo, 2, 1, cfg.skin);
      }

      // head
      R(5, 2 + yo, 6, 6, cfg.skin);

      // hair / headgear by style and direction
      const hair = cfg.hair;
      const top = (h) => { R(4, 1 + yo, 8, 2, h); R(4, 2 + yo, 1, 3, h); R(11, 2 + yo, 1, 3, h); };
      switch (cfg.style) {
        case 'long':
          top(hair);
          R(3, 2 + yo, 1, 7, hair); R(12, 2 + yo, 1, 7, hair);
          if (dir === 'up') R(4, 3 + yo, 8, 5, hair);
          break;
        case 'short':
          top(hair);
          if (dir === 'up') R(4, 2 + yo, 8, 4, hair);
          break;
        case 'old':
          R(4, 1 + yo, 8, 2, hair); R(3, 2 + yo, 1, 5, hair); R(12, 2 + yo, 1, 5, hair);
          if (dir !== 'up') { R(4, 7 + yo, 8, 2, '#d8d8de'); } // beard
          break;
        case 'bald':
          R(5, 1 + yo, 6, 1, cfg.skin);
          break;
        case 'hood':
          R(3, 1 + yo, 10, 7, hair);
          if (dir !== 'up') R(5, 4 + yo, 6, 3, '#1a1a20'); // shadow inside hood
          R(4, 2 + yo, 8, 1, '#000');
          break;
        case 'helm':
          R(4, 1 + yo, 8, 4, '#9aa0ac'); R(4, 1 + yo, 8, 1, '#c0c6d0');
          R(4, 4 + yo, 8, 1, '#5a606a');
          if (dir !== 'up') R(5, 5 + yo, 6, 1, '#2a2a30');
          break;
        default: top(hair);
      }

      // eyes (skip if hood shadow or facing up)
      if (dir !== 'up' && cfg.style !== 'bald') {
        const eyeY = 4 + yo;
        const ec = (cfg.style === 'ghost') ? '#1a3a44' : '#1a1a22';
        if (dir === 'down') { R(6, eyeY, 1, 2, ec); R(9, eyeY, 1, 2, ec); }
        else if (dir === 'left') { R(5, eyeY, 1, 2, ec); }
        else if (dir === 'right') { R(10, eyeY, 1, 2, ec); }
      }
      if (cfg.style === 'bald' && dir !== 'up') { R(6, 4 + yo, 1, 2, '#1a1a22'); R(9, 4 + yo, 1, 2, '#1a1a22'); }
    },

    // Draw a large enemy sprite (centered at cx,cy) using its art key.
    drawEnemy(art, cx, cy, frame, flash) {
      const ctx = this.ctx;
      const tint = flash ? '#fff' : null;
      const R = (x, y, w, h, c) => { ctx.fillStyle = tint || c; ctx.fillRect((cx + x) | 0, (cy + y) | 0, w, h); };
      const bob = Math.sin(frame / 20) * 2;
      cy = cy + bob;
      switch (art) {
        case 'wolf':
          R(-14, 0, 24, 10, '#5a5560'); R(8, -6, 10, 8, '#5a5560');
          R(14, -8, 4, 4, '#5a5560'); R(10, -10, 3, 3, '#5a5560');
          R(16, -4, 2, 2, '#c83a2a'); // eye
          R(-14, 8, 3, 8, '#46424c'); R(-8, 8, 3, 8, '#46424c'); R(2, 8, 3, 8, '#46424c'); R(8, 8, 3, 8, '#46424c');
          R(-18, 2, 5, 3, '#46424c'); // tail
          R(15, -2, 4, 2, '#2a2a30'); // snout
          break;
        case 'crow':
          R(-8, -4, 16, 10, '#1c1c22'); R(6, -8, 7, 6, '#1c1c22');
          R(11, -6, 3, 2, '#c8a000'); // beak
          R(8, -6, 2, 2, '#c83a2a');
          R(-12, -8, 8, 6, '#14141a'); R(-12, 0, 8, 6, '#14141a'); // wings
          R(-2, 6, 2, 6, '#46444a'); R(4, 6, 2, 6, '#46444a');
          break;
        case 'bandit':
          this._humanoid(R, '#c79a6c', '#3a2c26', '#221c18', '#22201e', true);
          R(-6, -14, 14, 4, '#3a2c26'); // hood
          R(-2, 6, 8, 2, '#8a8a96'); // dagger
          break;
        case 'soldier':
          this._humanoid(R, '#c99c70', '#4a4a58', '#2c2c34', null, false);
          R(-7, -18, 16, 6, '#9aa0ac'); R(-7, -13, 16, 2, '#5a606a'); // helm
          R(9, -10, 3, 20, '#8a8a96'); R(8, -12, 5, 3, '#5a5560'); // spear
          break;
        case 'houndman':
          this._humanoid(R, '#b8895c', '#4a2c1c', '#241a14', '#241a14', true);
          R(-8, -16, 18, 5, '#241a14'); // big hood
          R(-3, -10, 3, 2, '#c83a2a'); R(3, -10, 3, 2, '#c83a2a');
          R(10, -2, 8, 4, '#5a5560'); R(16, -4, 4, 8, '#5a5560'); // a hound at his side
          break;
        case 'captain':
          this._humanoid(R, '#c79a6c', '#5a3030', '#2c2024', null, false);
          R(-9, -20, 20, 7, '#aab0bc'); R(-9, -14, 20, 2, '#5a606a'); R(-2, -22, 6, 3, '#c83a2a');// plumed helm
          R(-14, -6, 6, 16, '#7a8090'); // shield
          R(11, -16, 4, 24, '#c0c6d0'); // sword
          break;
        case 'vael':
          // imposing dark lord
          R(-12, -10, 26, 26, '#1c1c2a'); // robe body
          R(-16, -8, 6, 20, '#3a0e14'); R(12, -8, 6, 20, '#3a0e14'); // cape
          R(-4, -26, 14, 16, '#cdbfae'); // pale face area / hood frame
          R(-7, -30, 20, 8, '#15151a'); // crown/hood
          R(-2, -22, 3, 3, '#c8202a'); R(6, -22, 3, 3, '#c8202a'); // red eyes
          R(-10, 14, 9, 12, '#1c1c2a'); R(5, 14, 9, 12, '#1c1c2a'); // legs
          R(13, -14, 4, 30, '#6a6a74'); R(12, -18, 6, 5, '#9a2230'); // staff
          break;
        case 'tralalero': // brainrot shark in sneakers
          R(-16, -10, 30, 18, '#3f74b0');
          R(-16, 2, 30, 6, '#cdd8e6');            // belly
          R(12, -8, 6, 4, '#2b568c'); R(12, 2, 6, 4, '#2b568c'); // tail
          R(-22, -4, 8, 10, '#3f74b0');           // snout
          R(-22, 4, 11, 2, '#e8eef6');            // teeth
          R(-22, 6, 11, 1, '#0c0c10');            // mouth
          R(-14, -6, 3, 3, '#ffffff'); R(-13, -5, 1, 1, '#0c0c10'); // eye
          R(-3, -16, 6, 7, '#2b568c');            // dorsal fin
          R(-9, 8, 3, 5, '#3a3a40'); R(4, 8, 3, 5, '#3a3a40'); // legs
          R(-12, 12, 9, 4, '#f0f0f0'); R(1, 12, 9, 4, '#f0f0f0'); // sneakers
          R(-11, 13, 5, 1, '#1a1a1a'); R(2, 13, 5, 1, '#1a1a1a'); // swoosh
          break;
        case 'herald': // hollow wooden drummer
          R(-8, -14, 16, 22, '#7a5223');
          R(-7, -13, 13, 20, '#9a6b2f');
          R(-8, -6, 16, 1, '#5e3f18'); R(-8, 2, 16, 1, '#5e3f18'); // grain
          R(-4, -10, 3, 4, '#120a04'); R(2, -10, 3, 4, '#120a04'); // hollow eyes
          R(-3, -2, 7, 2, '#120a04');             // mouth
          R(-13, -6, 5, 2, '#5e3f18'); R(8, -8, 6, 2, '#5e3f18'); // arms
          R(12, -12, 2, 7, '#a98a4a'); R(11, -14, 5, 3, '#a98a4a'); // mallet
          R(9, 2, 8, 8, '#6e4a1f'); R(10, 5, 6, 1, '#120a04');   // slit-drum
          R(-6, 8, 4, 6, '#5a3c18'); R(2, 8, 4, 6, '#5a3c18');   // legs
          break;
        case 'tung': { // Tung Tung Tung Sahur
          const eye = flash ? '#ffffff' : '#f4f0e6';
          R(-7, -36, 14, 5, '#16162a'); R(-7, -32, 14, 1, '#26263a'); // peci cap
          R(-9, -31, 18, 46, '#8a5e26');          // wooden body
          R(-7, -29, 13, 42, '#a9762f');          // lighter face
          R(-9, -18, 18, 1, '#5e3f18'); R(-9, -4, 18, 1, '#5e3f18'); R(-9, 8, 18, 1, '#5e3f18'); // grain
          R(-8, -28, 7, 2, '#3a2410'); R(2, -28, 7, 2, '#3a2410'); // brows
          R(-8, -26, 7, 8, eye); R(2, -26, 7, 8, eye);            // big eyes
          R(-6, -23, 3, 4, '#9a1a1a'); R(3, -23, 3, 4, '#9a1a1a'); // red pupils
          R(-8, -14, 16, 7, '#1a0e06');           // mouth
          R(-8, -14, 16, 2, '#f4f0e6');           // upper teeth
          R(-4, -14, 1, 7, '#1a0e06'); R(1, -14, 1, 7, '#1a0e06'); // tooth gaps
          R(-15, -10, 6, 2, '#6e4a1f'); R(9, -16, 7, 2, '#6e4a1f'); // stick arms
          R(14, -32, 4, 18, '#b3914a'); R(13, -33, 6, 5, '#b3914a'); // raised bat
          R(-7, 15, 5, 6, '#5e3f18'); R(3, 15, 5, 6, '#5e3f18');   // legs
          break;
        }
        default:
          R(-8, -8, 16, 16, '#a040a0');
      }
    },

    _humanoid(R, skin, shirt, pants, hood, dark) {
      R(-7, -2, 14, 14, shirt); // torso
      R(-7, 12, 5, 8, pants); R(2, 12, 5, 8, pants); // legs
      R(-9, -2, 3, 10, shirt); R(6, -2, 3, 10, shirt); // arms
      R(-5, -16, 10, 10, skin); // head
      if (!hood) { R(-6, -17, 12, 4, '#2a2a2a'); }
      R(-3, -12, 2, 2, '#1a1a22'); R(1, -12, 2, 2, '#1a1a22'); // eyes
    }
  };

  global.GFX = GFX;
})(typeof window !== 'undefined' ? window : globalThis);
