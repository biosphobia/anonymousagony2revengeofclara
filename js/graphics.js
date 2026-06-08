/* ============================================================================
 * graphics.js — smooth (non-pixel) rendering: anti-aliased text, gradient
 * tiles & characters, and hand-drawn-style character portraits.
 *
 * The game logic works in a fixed 256x192 "logical" space; the canvas backing
 * store is larger (e.g. 640x480) and we apply a scale transform so everything
 * is rendered crisp and smooth at high resolution.
 * ==========================================================================*/
(function (global) {
  'use strict';

  const PAL = global.DATA.PAL;
  const TILE = global.DATA.TILE; // 16
  const FONT = '"Segoe UI", "Helvetica Neue", Arial, sans-serif';

  function lerpHex(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const ar = (pa >> 16) & 255, ag = (pa >> 8) & 255, ab = pa & 255;
    const br = (pb >> 16) & 255, bg = (pb >> 8) & 255, bb = pb & 255;
    const r = Math.round(ar + (br - ar) * t), g = Math.round(ag + (bg - ag) * t), bl = Math.round(ab + (bb - ab) * t);
    return 'rgb(' + r + ',' + g + ',' + bl + ')';
  }

  const GFX = {
    canvas: null, ctx: null, W: 256, H: 192, S: 1,

    init(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.W = 256; this.H = 192;
      this.S = canvas.width / this.W;
      this.ctx.imageSmoothingEnabled = true;
      this.ctx.textBaseline = 'alphabetic';
    },

    beginFrame() {
      this.ctx.setTransform(this.S, 0, 0, this.S, 0, 0);
      this.ctx.imageSmoothingEnabled = true;
    },

    clear(color) {
      this.ctx.fillStyle = color || '#000';
      this.ctx.fillRect(0, 0, this.W, this.H);
    },

    // --- primitives ---
    rect(x, y, w, h, c) { this.ctx.fillStyle = c; this.ctx.fillRect(x, y, w, h); },
    px(x, y, c) { this.ctx.fillStyle = c; this.ctx.fillRect(x, y, 1, 1); },

    _rrPath(x, y, w, h, r) {
      const c = this.ctx;
      r = Math.min(r, w / 2, h / 2);
      c.beginPath();
      c.moveTo(x + r, y);
      c.arcTo(x + w, y, x + w, y + h, r);
      c.arcTo(x + w, y + h, x, y + h, r);
      c.arcTo(x, y + h, x, y, r);
      c.arcTo(x, y, x + w, y, r);
      c.closePath();
    },
    roundRect(x, y, w, h, r, c) { this._rrPath(x, y, w, h, r); this.ctx.fillStyle = c; this.ctx.fill(); },
    circle(cx, cy, r, c) { const x = this.ctx; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fillStyle = c; x.fill(); },
    ellipse(cx, cy, rx, ry, c, a) {
      const x = this.ctx; x.save(); if (a != null) x.globalAlpha = a;
      x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, 7); x.fillStyle = c; x.fill(); x.restore();
    },

    vgrad(x, y, w, h, top, bot) {
      const g = this.ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, top); g.addColorStop(1, bot);
      return g;
    },

    // Modern message / menu window: rounded, soft gradient, glow border.
    box(x, y, w, h, opt) {
      opt = opt || {};
      const ctx = this.ctx;
      ctx.save();
      ctx.globalAlpha = opt.alpha != null ? opt.alpha : 0.95;
      this._rrPath(x, y, w, h, opt.r || 5);
      ctx.fillStyle = opt.fill ? this.vgrad(x, y, w, h, opt.fill, opt.fill) : this.vgrad(x, y, w, h, '#1b2138', '#0c1020');
      ctx.fill();
      ctx.globalAlpha = 1;
      // outer border
      this._rrPath(x, y, w, h, opt.r || 5);
      ctx.lineWidth = 1.2; ctx.strokeStyle = opt.light || '#8a9bdc'; ctx.stroke();
      // inner subtle highlight
      this._rrPath(x + 1.5, y + 1.5, w - 3, h - 3, (opt.r || 5) - 1);
      ctx.lineWidth = 0.8; ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.stroke();
      ctx.restore();
    },

    // --- text (anti-aliased, readable) ---
    _font(size, weight) { this.ctx.font = (weight || '600') + ' ' + (size || 9) + 'px ' + FONT; },
    textWidth(text, size, weight) { this._font(size, weight); return this.ctx.measureText(text).width; },

    text(text, x, y, opt) {
      opt = opt || {};
      const ctx = this.ctx;
      const size = opt.size || 9;
      this._font(size, opt.weight);
      ctx.textAlign = opt.align || 'left';
      ctx.textBaseline = 'top';
      if (opt.shadow !== false) {
        ctx.fillStyle = opt.shadowColor || 'rgba(0,0,0,0.85)';
        ctx.fillText(text, x + 0.7, y + 0.9);
      }
      ctx.fillStyle = opt.color || PAL.ink;
      ctx.fillText(text, x, y);
      ctx.textAlign = 'left';
      return ctx.measureText(text).width;
    },

    wrap(text, maxW, size, weight) {
      this._font(size, weight);
      const ctx = this.ctx;
      const words = String(text).split(' ');
      const lines = []; let line = '';
      for (const w of words) {
        const test = line ? line + ' ' + w : w;
        if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
        else line = test;
      }
      if (line) lines.push(line);
      return lines;
    },

    bar(x, y, w, h, frac, fg, bg) {
      frac = Math.max(0, Math.min(1, frac));
      const ctx = this.ctx;
      this._rrPath(x, y, w, h, h / 2); ctx.fillStyle = bg || 'rgba(0,0,0,0.6)'; ctx.fill();
      if (frac > 0) {
        const fw = Math.max(h, (w) * frac);
        this._rrPath(x, y, fw, h, h / 2);
        const top = fg || '#46d06a';
        ctx.fillStyle = this.vgrad(x, y, fw, h, lerpHex2(top, '#ffffff', 0.35), top);
        ctx.fill();
      }
      this._rrPath(x, y, w, h, h / 2); ctx.lineWidth = 0.7; ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.stroke();
    },

    _hash(x, y) {
      let h = (x * 374761393 + y * 668265263) ^ 0x9e3779b9;
      h = (h ^ (h >> 13)) * 1274126177;
      return ((h ^ (h >> 16)) >>> 0) / 4294967295;
    },

    // --------------------------------------------------------------------
    // Tiles — smooth, modern night-suburb / interior look
    // --------------------------------------------------------------------
    tile(ch, sx, sy, wx, wy, frame) {
      const ctx = this.ctx;
      const rnd = this._hash(wx, wy);
      const fill = (c) => { ctx.fillStyle = c; ctx.fillRect(sx, sy, TILE, TILE); };
      switch (ch) {
        case '.': // lawn / grass at night
          ctx.fillStyle = this.vgrad(sx, sy, TILE, TILE, '#27412a', '#1f3422'); ctx.fillRect(sx, sy, TILE, TILE);
          ctx.strokeStyle = 'rgba(120,160,110,0.18)'; ctx.lineWidth = 0.8;
          for (let i = 0; i < 3; i++) { const gx = sx + 2 + ((i * 6 + rnd * 9) % 13); const gy = sy + 6 + ((i * 5 + rnd * 7) % 8); ctx.beginPath(); ctx.moveTo(gx, gy + 3); ctx.lineTo(gx + 1, gy); ctx.stroke(); }
          break;
        case 'a': // asphalt / road
          ctx.fillStyle = this.vgrad(sx, sy, TILE, TILE, '#2c2f37', '#23262d'); ctx.fillRect(sx, sy, TILE, TILE);
          if (rnd > 0.6) { ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(sx + (rnd * 10 | 0), sy + (rnd * 12 | 0), 2, 1); }
          break;
        case ':': // sidewalk / pavement
          fill('#474b54');
          ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 0.8;
          ctx.strokeRect(sx + 0.5, sy + 0.5, TILE - 1, TILE - 1);
          break;
        case ',': // dark alley / shadow (random-encounter tile)
          ctx.fillStyle = this.vgrad(sx, sy, TILE, TILE, '#1a1c22', '#101216'); ctx.fillRect(sx, sy, TILE, TILE);
          ctx.save(); ctx.globalAlpha = 0.10 + 0.06 * Math.sin((frame + wx * 20) / 30);
          this.ellipse(sx + 8, sy + 8, 7, 6, '#5a6a8a'); ctx.restore();
          break;
        case '%': // planter / flowers
          fill('#27412a');
          this.circle(sx + 5, sy + 9, 2, '#d06a96'); this.circle(sx + 10, sy + 7, 2, '#e6c24a'); this.circle(sx + 8, sy + 12, 2, '#c0577f');
          break;
        case 'b': // bush
          this.ellipse(sx + 8, sy + 9, 7, 6, '#23401f'); this.ellipse(sx + 6, sy + 8, 4, 4, '#2f5226');
          break;
        case '#': // tree (suburban, sparse)
          this.rect(sx + 7, sy + 9, 3, 6, '#3a2a1c');
          this.circle(sx + 8, sy + 6, 6, '#244a26'); this.circle(sx + 6, sy + 5, 3.5, '#2f5e30');
          break;
        case '^': // hedge (replaces forest pines)
          ctx.fillStyle = this.vgrad(sx, sy, TILE, TILE, '#234a22', '#15301a');
          this._rrPath(sx, sy + 2, TILE, TILE - 2, 3); ctx.fill();
          this.ellipse(sx + 5, sy + 5, 3, 2.5, 'rgba(120,170,100,0.25)');
          break;
        case 'W': // concrete wall / building
          ctx.fillStyle = this.vgrad(sx, sy, TILE, TILE, '#42454d', '#2f323a'); ctx.fillRect(sx, sy, TILE, TILE);
          ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(sx, sy, TILE, 1);
          ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(sx, sy + TILE - 1, TILE, 1);
          break;
        case 'B': // brick building wall (with lit window sometimes)
          ctx.fillStyle = this.vgrad(sx, sy, TILE, TILE, '#5a3f3a', '#46302c'); ctx.fillRect(sx, sy, TILE, TILE);
          ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 0.7;
          for (let r = 0; r < 16; r += 5) { ctx.beginPath(); ctx.moveTo(sx, sy + r); ctx.lineTo(sx + TILE, sy + r); ctx.stroke(); }
          if (this._hash(wx, wy) > 0.78) { ctx.fillStyle = 'rgba(240,210,120,0.55)'; this.roundRect(sx + 4, sy + 4, 8, 7, 1, 'rgba(240,210,120,0.5)'); }
          break;
        case 'D': // door
          fill('#3a2c2c');
          ctx.fillStyle = this.vgrad(sx + 3, sy + 2, 10, 14, '#7a5a3c', '#5a3f28'); this.roundRect(sx + 3, sy + 2, 10, 14, 1, ctx.fillStyle);
          this.circle(sx + 11, sy + 9, 1, '#e6c84a');
          break;
        case 'g': { // barrier / sealed way
          fill('#2f323a');
          ctx.strokeStyle = '#15161a'; ctx.lineWidth = 2;
          for (let i = 3; i < TILE; i += 4) { ctx.beginPath(); ctx.moveTo(sx + i, sy); ctx.lineTo(sx + i, sy + TILE); ctx.stroke(); }
          break;
        }
        case '~': // water / pool
          ctx.fillStyle = this.vgrad(sx, sy, TILE, TILE, '#1f3a52', '#16293a'); ctx.fillRect(sx, sy, TILE, TILE);
          ctx.strokeStyle = 'rgba(150,190,220,0.25)'; ctx.lineWidth = 0.8;
          { const o = (frame / 18) % TILE; ctx.beginPath(); ctx.moveTo(sx, sy + ((o + wx) % TILE)); ctx.lineTo(sx + TILE, sy + ((o + wx + 4) % TILE)); ctx.stroke(); }
          break;
        case '=': // boardwalk / crossing
          fill('#4a4d54'); ctx.fillStyle = 'rgba(255,255,255,0.5)';
          ctx.fillRect(sx + 2, sy, 2, TILE); ctx.fillRect(sx + 9, sy, 2, TILE);
          break;
        case 'o': // streetlamp base / boulder
          this.ellipse(sx + 8, sy + 12, 5, 3, '#1c1e22');
          this.circle(sx + 8, sy + 8, 4, '#54565e'); this.circle(sx + 6.5, sy + 6.5, 1.6, '#7a7c84');
          break;
        case 'f': // wood floor
          ctx.fillStyle = this.vgrad(sx, sy, TILE, TILE, '#5a4030', '#46301f'); ctx.fillRect(sx, sy, TILE, TILE);
          ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 0.6;
          for (let r = 0; r < 16; r += 5) { ctx.beginPath(); ctx.moveTo(sx, sy + r); ctx.lineTo(sx + TILE, sy + r); ctx.stroke(); }
          break;
        case 's': // tile / linoleum floor
          ctx.fillStyle = ((wx + wy) & 1) ? '#3a3d46' : '#33363e'; ctx.fillRect(sx, sy, TILE, TILE);
          ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.strokeRect(sx + 0.5, sy + 0.5, TILE - 1, TILE - 1);
          break;
        case 'C': // rug
          ctx.fillStyle = this.vgrad(sx, sy, TILE, TILE, '#7a2030', '#5a1622'); ctx.fillRect(sx, sy, TILE, TILE);
          ctx.strokeStyle = '#c9a24a'; ctx.lineWidth = 0.8; ctx.strokeRect(sx + 1.5, sy + 1.5, TILE - 3, TILE - 3);
          break;
        case '+': // small marker
          fill('#27412a'); this.roundRect(sx + 6, sy + 5, 4, 9, 1, '#7a7c84');
          break;
        case 'r': // debris / boarded ruin
          ctx.fillStyle = this.vgrad(sx, sy, TILE, TILE, '#3a322c', '#272320'); ctx.fillRect(sx, sy, TILE, TILE);
          ctx.fillStyle = '#4a4038';
          for (let i = 0; i < 3; i++) ctx.fillRect(sx + (this._hash(wx + i, wy) * 12 | 0), sy + (this._hash(wx, wy + i) * 12 | 0), 4, 2);
          break;
        case 'P': // pillar
          ctx.fillStyle = this.vgrad(sx + 3, sy, 10, TILE, '#6a6d76', '#3a3d44'); ctx.fillRect(sx + 3, sy, 10, TILE);
          ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(sx + 4, sy, 2, TILE);
          break;
        case 't': // altar / table
          ctx.fillStyle = this.vgrad(sx + 1, sy + 1, 14, 13, '#6a4a2c', '#46301f'); this.roundRect(sx + 1, sy + 1, 14, 13, 2, ctx.fillStyle);
          this.circle(sx + 8, sy + 6, 3, '#c9a24a');
          break;
        case 'L': { // supernatural red rift (The Hour Between)
          ctx.fillStyle = this.vgrad(sx, sy, TILE, TILE, '#3a0e12', '#160608'); ctx.fillRect(sx, sy, TILE, TILE);
          const pulse = 0.4 + 0.35 * Math.sin((frame + wx * 30 + wy * 17) / 16);
          ctx.save(); ctx.globalAlpha = pulse; this.ellipse(sx + 8, sy + 8, 6, 3, '#c8401a'); ctx.restore();
          ctx.save(); ctx.globalAlpha = pulse * 0.8; this.ellipse(sx + 8, sy + 8, 3, 1.5, '#f4c44a'); ctx.restore();
          break;
        }
        default:
          fill('#101018');
      }
    },

    // --------------------------------------------------------------------
    // Overworld characters — smooth, rounded "illustrated chibi"
    // --------------------------------------------------------------------
    drawChar(px, py, cfg, dir, frame, opt) {
      opt = opt || {};
      const ctx = this.ctx;
      const walking = opt.walking;
      const phase = walking ? Math.sin(frame * 1.6) : 0;
      const bob = walking ? Math.abs(Math.sin(frame * 1.6)) * -1 : 0;
      const cx = px + 8, top = py + bob;

      // shadow
      this.ellipse(cx, py + 15.5, 6, 2, 'rgba(0,0,0,0.35)');

      // cape behind
      if (cfg.cape && dir !== 'down') { this.roundRect(px + 3.5, top + 6, 9, 8, 2, cfg.cape); }

      // legs
      const lo = phase * 1.4;
      this.roundRect(cx - 3.2, top + 11 + lo, 2.6, 4.5, 1.2, cfg.pants);
      this.roundRect(cx + 0.6, top + 11 - lo, 2.6, 4.5, 1.2, cfg.pants);

      // torso (rounded), with soft top highlight
      ctx.fillStyle = this.vgrad(px + 3, top + 6.5, 10, 7, lerpHex2(cfg.shirt, '#ffffff', 0.16), cfg.shirt);
      this._rrPath(px + 3, top + 6.5, 10, 7.5, 3); ctx.fill();

      // arms
      const armSw = phase * 1.2;
      if (dir === 'left') { this.roundRect(px + 2.5, top + 7.5, 2.4, 4.5, 1.2, cfg.shirt); }
      else if (dir === 'right') { this.roundRect(px + 11.1, top + 7.5, 2.4, 4.5, 1.2, cfg.shirt); }
      else {
        this.roundRect(px + 2.3, top + 7.5 + armSw, 2.4, 4.2, 1.2, cfg.shirt);
        this.roundRect(px + 11.3, top + 7.5 - armSw, 2.4, 4.2, 1.2, cfg.shirt);
      }

      // head
      ctx.fillStyle = this.vgrad(cx - 4.5, top + 1, 9, 8, lerpHex2(cfg.skin, '#ffffff', 0.12), cfg.skin);
      this.circle(cx, top + 5, 4.6, ctx.fillStyle);

      // hair / headgear
      this._hair(cx, top, cfg, dir);

      // face (skip when facing up)
      if (dir !== 'up' && cfg.style !== 'bald2') {
        const ec = '#23252e';
        if (dir === 'down') {
          this.circle(cx - 1.8, top + 5, 0.85, ec); this.circle(cx + 1.8, top + 5, 0.85, ec);
        } else if (dir === 'left') { this.circle(cx - 2.2, top + 5, 0.85, ec); }
        else if (dir === 'right') { this.circle(cx + 2.2, top + 5, 0.85, ec); }
      }
    },

    _hair(cx, top, cfg, dir) {
      const ctx = this.ctx;
      const h = cfg.hair;
      ctx.fillStyle = h;
      switch (cfg.style) {
        case 'long':
          this.circle(cx, top + 3, 5, h);
          this.roundRect(cx - 5, top + 2, 2.4, 7, 1, h); this.roundRect(cx + 2.6, top + 2, 2.4, 7, 1, h);
          if (dir === 'up') this.circle(cx, top + 5, 4.6, h);
          break;
        case 'short':
          this._rrPath(cx - 4.8, top + 0.5, 9.6, 4.5, 3); ctx.fillStyle = h; ctx.fill();
          if (dir === 'up') this.circle(cx, top + 5, 4.6, h);
          break;
        case 'old':
          this._rrPath(cx - 4.8, top + 1, 9.6, 3, 2); ctx.fillStyle = h; ctx.fill();
          this.roundRect(cx - 5, top + 2, 1.8, 5, 1, h); this.roundRect(cx + 3.2, top + 2, 1.8, 5, 1, h);
          break;
        case 'bald':
          this.ellipse(cx, top + 2.6, 4, 2, h);
          break;
        case 'hood':
          this._rrPath(cx - 5.2, top + 0.5, 10.4, 7, 4); ctx.fillStyle = h; ctx.fill();
          if (dir !== 'up') { this.ellipse(cx, top + 5, 3.4, 3.2, 'rgba(10,10,14,0.55)'); }
          break;
        case 'helm':
          this._rrPath(cx - 4.8, top + 0.5, 9.6, 5, 3); ctx.fillStyle = this.vgrad(cx - 4.8, top, 9.6, 5, '#aab0bc', '#6a707c'); ctx.fill();
          break;
        case 'pig': // pigtails (Clara)
          this.circle(cx, top + 3, 5, h);
          this.circle(cx - 5.2, top + 4, 2.2, h); this.circle(cx + 5.2, top + 4, 2.2, h);
          this.circle(cx - 5.6, top + 6.5, 1.6, h); this.circle(cx + 5.6, top + 6.5, 1.6, h);
          if (dir === 'up') this.circle(cx, top + 5, 4.6, h);
          break;
        default:
          this.circle(cx, top + 3, 4.8, h);
      }
    },

    // --------------------------------------------------------------------
    // Battle enemy sprites — smooth shapes with gradients
    // --------------------------------------------------------------------
    drawEnemy(art, cx, cy, frame, flash) {
      const ctx = this.ctx;
      ctx.save();
      cy += Math.sin(frame / 22) * 2;
      // ground shadow
      this.ellipse(cx, cy + 22, 22, 5, 'rgba(0,0,0,0.3)');
      if (flash) ctx.globalAlpha = 0.92;
      const T = (c) => flash ? '#ffffff' : c;

      switch (art) {
        case 'wolf': { // gaunt night hound
          this.ellipse(cx - 2, cy + 4, 16, 8, T('#3a3640'));
          this.roundRect(cx + 8, cy - 6, 11, 9, 4, T('#3a3640'));
          ctx.beginPath(); ctx.moveTo(cx + 14, cy - 6); ctx.lineTo(cx + 16, cy - 12); ctx.lineTo(cx + 18, cy - 6); ctx.closePath(); ctx.fillStyle = T('#2e2b34'); ctx.fill();
          this.circle(cx + 15, cy - 2, 1.6, '#d23a2a');
          this.roundRect(cx + 16, cy + 1, 5, 3, 1, T('#2a272f')); // snout
          for (let i = 0; i < 4; i++) this.roundRect(cx - 14 + i * 7, cy + 8, 3, 9, 1.5, T('#2e2b34'));
          this.ellipse(cx - 18, cy - 1, 5, 2, T('#2e2b34'));
          break;
        }
        case 'crow': {
          this.ellipse(cx - 1, cy + 1, 11, 7, T('#1c1c24'));
          this.circle(cx + 8, cy - 6, 4.5, T('#1c1c24'));
          ctx.beginPath(); ctx.moveTo(cx + 12, cy - 6); ctx.lineTo(cx + 17, cy - 5); ctx.lineTo(cx + 12, cy - 3); ctx.closePath(); ctx.fillStyle = '#c8a000'; ctx.fill();
          this.circle(cx + 9, cy - 7, 1.2, '#d23a2a');
          this.ellipse(cx - 8, cy - 4, 8, 5, T('#141419')); this.ellipse(cx - 8, cy + 5, 8, 5, T('#141419'));
          break;
        }
        case 'bandit': { // sleepwalker (a person taken)
          this._humanoidSmooth(cx, cy, T('#c79a6c'), T('#3a3f4a'), T('#23262e'), 'hood', T);
          this.ellipse(cx - 3, cy - 11, 1.4, 1.8, '#cfe0ff'); this.ellipse(cx + 3, cy - 11, 1.4, 1.8, '#cfe0ff'); // pale eyes
          break;
        }
        case 'tralalero': { // brainrot shark in sneakers
          ctx.fillStyle = this.vgrad(cx - 22, cy - 12, 44, 24, T('#4a83c0'), T('#315f96'));
          this._rrPath(cx - 18, cy - 11, 34, 20, 9); ctx.fill();
          this.ellipse(cx - 2, cy + 4, 16, 4, T('#cdd9e8')); // belly
          ctx.beginPath(); ctx.moveTo(cx - 18, cy - 2); ctx.lineTo(cx - 26, cy + 1); ctx.lineTo(cx - 18, cy + 5); ctx.closePath(); ctx.fillStyle = T('#315f96'); ctx.fill(); // snout
          ctx.fillStyle = '#f2f5fa'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(cx - 24 + i * 2.4, cy + 4); ctx.lineTo(cx - 23 + i * 2.4, cy + 1.5); ctx.lineTo(cx - 22 + i * 2.4, cy + 4); ctx.closePath(); ctx.fill(); }
          this.circle(cx - 12, cy - 4, 2.4, '#ffffff'); this.circle(cx - 11.5, cy - 3.7, 1.1, '#101014');
          ctx.beginPath(); ctx.moveTo(cx - 2, cy - 11); ctx.lineTo(cx + 2, cy - 19); ctx.lineTo(cx + 5, cy - 11); ctx.closePath(); ctx.fillStyle = T('#2a5286'); ctx.fill(); // dorsal
          this.roundRect(cx - 10, cy + 8, 3, 5, 1, '#2a2d34'); this.roundRect(cx + 3, cy + 8, 3, 5, 1, '#2a2d34');
          this.roundRect(cx - 13, cy + 12, 10, 4, 2, '#f2f2f2'); this.roundRect(cx + 1, cy + 12, 10, 4, 2, '#f2f2f2'); // sneakers
          ctx.strokeStyle = '#15161a'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(cx - 12, cy + 14); ctx.lineTo(cx - 6, cy + 13); ctx.moveTo(cx + 2, cy + 14); ctx.lineTo(cx + 8, cy + 13); ctx.stroke();
          break;
        }
        case 'herald': { // hollow wooden drummer
          ctx.fillStyle = this.vgrad(cx - 9, cy - 16, 18, 26, T('#9a6b2f'), T('#6e4a1f'));
          this._rrPath(cx - 9, cy - 16, 18, 26, 4); ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 0.8;
          ctx.beginPath(); ctx.moveTo(cx - 9, cy - 6); ctx.lineTo(cx + 9, cy - 6); ctx.moveTo(cx - 9, cy + 2); ctx.lineTo(cx + 9, cy + 2); ctx.stroke();
          this.ellipse(cx - 3.5, cy - 9, 1.8, 2.4, '#120a04'); this.ellipse(cx + 3.5, cy - 9, 1.8, 2.4, '#120a04');
          this.roundRect(cx - 3.5, cy - 2, 7, 2.4, 1, '#120a04');
          this.roundRect(cx + 8, cy - 10, 7, 2.2, 1, T('#5e3f18')); // arm
          this.roundRect(cx + 12, cy - 14, 2.4, 8, 1, '#a98a4a'); this.circle(cx + 13, cy - 15, 2.4, '#a98a4a'); // mallet
          this.roundRect(cx - 7, cy + 10, 4, 6, 1.5, T('#5a3c18')); this.roundRect(cx + 3, cy + 10, 4, 6, 1.5, T('#5a3c18'));
          break;
        }
        case 'tung': { // Tung Tung Tung Sahur
          // peci cap
          this.roundRect(cx - 8, cy - 38, 16, 6, 2, T('#16162a'));
          // wooden body
          ctx.fillStyle = this.vgrad(cx - 11, cy - 33, 22, 50, T('#a9762f'), T('#7a5020'));
          this._rrPath(cx - 11, cy - 33, 22, 50, 6); ctx.fill();
          // grain
          ctx.strokeStyle = 'rgba(60,36,16,0.45)'; ctx.lineWidth = 0.8;
          for (let r = -22; r < 14; r += 11) { ctx.beginPath(); ctx.moveTo(cx - 11, cy + r); ctx.bezierCurveTo(cx - 4, cy + r - 2, cx + 4, cy + r + 2, cx + 11, cy + r); ctx.stroke(); }
          // brows
          ctx.strokeStyle = '#3a2410'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx - 9, cy - 27); ctx.lineTo(cx - 2, cy - 25); ctx.moveTo(cx + 9, cy - 27); ctx.lineTo(cx + 2, cy - 25); ctx.stroke();
          // big eyes
          this.ellipse(cx - 5, cy - 22, 4, 4.6, flash ? '#fff' : '#f4f0e6'); this.ellipse(cx + 5, cy - 22, 4, 4.6, flash ? '#fff' : '#f4f0e6');
          this.circle(cx - 4.5, cy - 21, 2, '#9a1414'); this.circle(cx + 5.5, cy - 21, 2, '#9a1414');
          this.circle(cx - 4, cy - 21.5, 0.7, '#fff'); this.circle(cx + 6, cy - 21.5, 0.7, '#fff');
          // wide toothy grin
          ctx.fillStyle = '#160a04'; this._rrPath(cx - 8, cy - 13, 16, 7, 2); ctx.fill();
          ctx.fillStyle = '#f4f0e6'; ctx.fillRect(cx - 8, cy - 13, 16, 2);
          ctx.strokeStyle = '#160a04'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(cx - 3, cy - 13); ctx.lineTo(cx - 3, cy - 6); ctx.moveTo(cx + 2, cy - 13); ctx.lineTo(cx + 2, cy - 6); ctx.stroke();
          // stick arms
          ctx.strokeStyle = T('#6e4a1f'); ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(cx - 11, cy - 8); ctx.lineTo(cx - 17, cy - 4); ctx.moveTo(cx + 11, cy - 12); ctx.lineTo(cx + 18, cy - 18); ctx.stroke();
          // raised bat
          ctx.save(); ctx.translate(cx + 18, cy - 20); ctx.rotate(-0.5);
          ctx.fillStyle = this.vgrad(-2, -14, 5, 18, '#c2a05a', '#9a7a3a'); this.roundRect(-2, -14, 5, 18, 2.5, ctx.fillStyle); ctx.restore();
          // legs
          this.roundRect(cx - 7, cy + 16, 5, 6, 2, T('#5e3f18')); this.roundRect(cx + 2, cy + 16, 5, 6, 2, T('#5e3f18'));
          break;
        }
        default:
          this.circle(cx, cy, 12, '#a040a0');
      }
      ctx.restore();
    },

    _humanoidSmooth(cx, cy, skin, shirt, pants, hair, T) {
      this._rrPath(cx - 8, cy - 4, 16, 16, 5); this.ctx.fillStyle = shirt; this.ctx.fill();
      this.roundRect(cx - 6, cy + 10, 5, 9, 2, pants); this.roundRect(cx + 1, cy + 10, 5, 9, 2, pants);
      this.roundRect(cx - 11, cy - 3, 4, 11, 2, shirt); this.roundRect(cx + 7, cy - 3, 4, 11, 2, shirt);
      this.circle(cx, cy - 11, 6, skin);
      if (hair === 'hood') { this._rrPath(cx - 7, cy - 18, 14, 11, 6); this.ctx.fillStyle = '#2a2a30'; this.ctx.fill(); this.ellipse(cx, cy - 11, 4.5, 4.5, 'rgba(10,10,14,0.5)'); }
    },

    // --------------------------------------------------------------------
    // Portraits — larger, hand-drawn-style busts (non-pixel)
    // --------------------------------------------------------------------
    drawPortrait(key, x, y, w, h) {
      const ctx = this.ctx;
      ctx.save();
      // frame
      this._rrPath(x, y, w, h, 4);
      ctx.fillStyle = this.vgrad(x, y, w, h, '#222842', '#0e1426'); ctx.fill();
      ctx.save(); this._rrPath(x, y, w, h, 4); ctx.clip();
      const cx = x + w / 2, cy = y + h * 0.52, r = w * 0.30;
      const C = global.DATA.CHARS[key] || {};
      if (key === 'tung') this._faceTung(cx, cy, r);
      else if (key === 'tralalero') this._faceTralalero(cx, cy, r);
      else if (key === 'herald') this._faceHerald(cx, cy, r);
      else this._faceHuman(cx, cy, r, key, C);
      ctx.restore();
      // frame stroke
      this._rrPath(x, y, w, h, 4); ctx.lineWidth = 1.2; ctx.strokeStyle = '#8a9bdc'; ctx.stroke();
      ctx.restore();
    },

    _faceHuman(cx, cy, r, key, C) {
      const ctx = this.ctx;
      const skin = C.skin || '#e7c39c', hair = C.hair || '#3a2a1a', shirt = C.shirt || '#445';
      // shoulders / clothing
      ctx.fillStyle = this.vgrad(cx - r * 1.7, cy + r * 0.8, r * 3.4, r * 2, lerpHex2(shirt, '#ffffff', 0.12), shirt);
      this._rrPath(cx - r * 1.7, cy + r * 0.9, r * 3.4, r * 2.4, r * 0.6); ctx.fill();
      // neck
      ctx.fillStyle = lerpHex2(skin, '#000000', 0.12); this.roundRect(cx - r * 0.35, cy + r * 0.3, r * 0.7, r * 0.8, r * 0.2, ctx.fillStyle);
      // head
      const hg = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.2, cx, cy, r * 1.25);
      hg.addColorStop(0, lerpHex2(skin, '#ffffff', 0.18)); hg.addColorStop(1, skin);
      this.ellipse(cx, cy, r * 0.92, r * 1.05, '#000', 0); ctx.fillStyle = hg; this.ellipse(cx, cy, r * 0.92, r * 1.05, hg);
      // ears
      this.circle(cx - r * 0.9, cy, r * 0.2, skin); this.circle(cx + r * 0.9, cy, r * 0.2, skin);
      // hair behind/top per character
      this._portraitHair(cx, cy, r, key, hair);
      // eyes
      const ex = r * 0.4, ey = cy - r * 0.05, er = r * 0.2;
      const young = (key === 'clara');
      this.ellipse(cx - ex, ey, er, er * (young ? 1.35 : 1.1), '#ffffff');
      this.ellipse(cx + ex, ey, er, er * (young ? 1.35 : 1.1), '#ffffff');
      const iris = key === 'clara' ? '#5a7a3a' : key === 'haze' ? '#3a4a6a' : '#4a3a2a';
      this.circle(cx - ex, ey + (young ? er * 0.2 : 0), er * 0.62, iris); this.circle(cx + ex, ey + (young ? er * 0.2 : 0), er * 0.62, iris);
      this.circle(cx - ex, ey + (young ? er * 0.2 : 0), er * 0.3, '#15151c'); this.circle(cx + ex, ey + (young ? er * 0.2 : 0), er * 0.3, '#15151c');
      this.circle(cx - ex - er * 0.2, ey - er * 0.2, er * 0.16, '#fff'); this.circle(cx + ex - er * 0.2, ey - er * 0.2, er * 0.16, '#fff');
      // brows
      ctx.strokeStyle = lerpHex2(hair, '#000', 0.1); ctx.lineWidth = r * 0.13; ctx.lineCap = 'round';
      const brow = key === 'haze' ? r * 0.05 : -r * 0.02;
      ctx.beginPath(); ctx.moveTo(cx - ex - er, ey - r * 0.42 + brow); ctx.lineTo(cx - ex + er, ey - r * 0.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + ex + er, ey - r * 0.42 + brow); ctx.lineTo(cx + ex - er, ey - r * 0.5); ctx.stroke();
      // nose
      ctx.strokeStyle = lerpHex2(skin, '#000', 0.18); ctx.lineWidth = r * 0.07;
      ctx.beginPath(); ctx.moveTo(cx, ey + r * 0.18); ctx.lineTo(cx - r * 0.08, ey + r * 0.45); ctx.stroke();
      // mouth (expression: sad for clara/haze, neutral else)
      ctx.strokeStyle = '#7a3a3a'; ctx.lineWidth = r * 0.1; ctx.beginPath();
      const my = cy + r * 0.55;
      if (key === 'clara' || key === 'haze') { ctx.moveTo(cx - r * 0.3, my + r * 0.08); ctx.quadraticCurveTo(cx, my - r * 0.08, cx + r * 0.3, my + r * 0.08); }
      else { ctx.moveTo(cx - r * 0.28, my); ctx.lineTo(cx + r * 0.28, my); }
      ctx.stroke();
      // glasses for Samson
      if (key === 'samson') {
        ctx.strokeStyle = '#22242c'; ctx.lineWidth = r * 0.08;
        ctx.beginPath(); ctx.arc(cx - ex, ey, er * 1.25, 0, 7); ctx.arc(cx + ex, ey, er * 1.25, 0, 7); ctx.moveTo(cx - ex + er * 1.2, ey); ctx.lineTo(cx + ex - er * 1.2, ey); ctx.stroke();
      }
      // hair front fringe (drawn after face)
      this._portraitFringe(cx, cy, r, key, hair);
    },

    _portraitHair(cx, cy, r, key, hair) {
      const ctx = this.ctx; ctx.fillStyle = hair;
      if (key === 'clara') {
        this.ellipse(cx, cy - r * 0.5, r * 1.05, r * 0.95, hair);              // top
        this.circle(cx - r * 1.05, cy - r * 0.1, r * 0.45, hair);             // pigtail L
        this.circle(cx + r * 1.05, cy - r * 0.1, r * 0.45, hair);             // pigtail R
        this.circle(cx - r * 1.15, cy + r * 0.5, r * 0.32, hair);
        this.circle(cx + r * 1.15, cy + r * 0.5, r * 0.32, hair);
      } else if (key === 'haze') {
        this.ellipse(cx, cy - r * 0.55, r * 1.05, r * 0.8, hair);
        // messy spikes
        ctx.beginPath(); ctx.moveTo(cx - r, cy - r * 0.6); ctx.lineTo(cx - r * 0.6, cy - r * 1.3); ctx.lineTo(cx - r * 0.2, cy - r * 0.7); ctx.lineTo(cx + r * 0.2, cy - r * 1.35); ctx.lineTo(cx + r * 0.5, cy - r * 0.7); ctx.lineTo(cx + r * 0.95, cy - r * 1.2); ctx.lineTo(cx + r, cy - r * 0.5); ctx.closePath(); ctx.fill();
      } else if (key === 'samson') {
        this.ellipse(cx, cy - r * 0.6, r * 1.0, r * 0.6, hair);
        this.roundRect(cx - r, cy - r * 0.6, r * 0.35, r * 1.1, r * 0.15, hair); this.roundRect(cx + r * 0.65, cy - r * 0.6, r * 0.35, r * 1.1, r * 0.15, hair);
      } else {
        this.ellipse(cx, cy - r * 0.55, r * 1.05, r * 0.85, hair);
      }
    },
    _portraitFringe(cx, cy, r, key, hair) {
      const ctx = this.ctx; ctx.fillStyle = hair;
      if (key === 'clara') { // soft fringe
        ctx.beginPath(); ctx.moveTo(cx - r * 0.95, cy - r * 0.7); ctx.quadraticCurveTo(cx - r * 0.3, cy - r * 0.2, cx - r * 0.1, cy - r * 0.55); ctx.quadraticCurveTo(cx + r * 0.1, cy - r * 0.15, cx + r * 0.5, cy - r * 0.5); ctx.quadraticCurveTo(cx + r * 0.85, cy - r * 0.2, cx + r * 0.95, cy - r * 0.7); ctx.lineTo(cx - r * 0.95, cy - r * 0.7); ctx.fill();
      } else if (key === 'haze') {
        ctx.beginPath(); ctx.moveTo(cx - r * 0.95, cy - r * 0.55); ctx.lineTo(cx - r * 0.2, cy - r * 0.15); ctx.lineTo(cx + r * 0.2, cy - r * 0.55); ctx.lineTo(cx + r * 0.6, cy - r * 0.1); ctx.lineTo(cx + r * 0.95, cy - r * 0.55); ctx.lineTo(cx - r * 0.95, cy - r * 0.55); ctx.fill();
      }
    },

    _faceTung(cx, cy, r) {
      const ctx = this.ctx;
      this.roundRect(cx - r * 1.0, cy - r * 1.55, r * 2.0, r * 0.7, r * 0.2, '#16162a'); // cap
      ctx.fillStyle = this.vgrad(cx - r, cy - r, r * 2, r * 2.6, '#b07f33', '#7c521f');
      this._rrPath(cx - r * 0.95, cy - r, r * 1.9, r * 2.4, r * 0.4); ctx.fill();
      ctx.strokeStyle = 'rgba(60,36,16,0.5)'; ctx.lineWidth = r * 0.08;
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(cx - r * 0.9, cy + i * r * 0.5); ctx.bezierCurveTo(cx, cy + i * r * 0.5 - r * 0.15, cx, cy + i * r * 0.5 + r * 0.15, cx + r * 0.9, cy + i * r * 0.5); ctx.stroke(); }
      ctx.strokeStyle = '#3a2410'; ctx.lineWidth = r * 0.16; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx - r * 0.7, cy - r * 0.55); ctx.lineTo(cx - r * 0.1, cy - r * 0.4); ctx.moveTo(cx + r * 0.7, cy - r * 0.55); ctx.lineTo(cx + r * 0.1, cy - r * 0.4); ctx.stroke();
      this.ellipse(cx - r * 0.4, cy - r * 0.2, r * 0.32, r * 0.4, '#f4f0e6'); this.ellipse(cx + r * 0.4, cy - r * 0.2, r * 0.32, r * 0.4, '#f4f0e6');
      this.circle(cx - r * 0.38, cy - r * 0.15, r * 0.16, '#9a1414'); this.circle(cx + r * 0.42, cy - r * 0.15, r * 0.16, '#9a1414');
      // grin
      ctx.fillStyle = '#160a04'; this._rrPath(cx - r * 0.7, cy + r * 0.35, r * 1.4, r * 0.55, r * 0.15); ctx.fill();
      ctx.fillStyle = '#f4f0e6'; ctx.fillRect(cx - r * 0.7, cy + r * 0.35, r * 1.4, r * 0.16);
      ctx.strokeStyle = '#160a04'; ctx.lineWidth = r * 0.07;
      for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(cx + i * r * 0.28, cy + r * 0.35); ctx.lineTo(cx + i * r * 0.28, cy + r * 0.9); ctx.stroke(); }
    },
    _faceTralalero(cx, cy, r) {
      const ctx = this.ctx;
      ctx.fillStyle = this.vgrad(cx - r, cy - r, r * 2, r * 2, '#4a83c0', '#2f5f96');
      this.ellipse(cx + r * 0.1, cy, r * 1.05, r * 0.95, ctx.fillStyle);
      ctx.beginPath(); ctx.moveTo(cx - r * 0.7, cy - r * 0.2); ctx.lineTo(cx - r * 1.5, cy + r * 0.15); ctx.lineTo(cx - r * 0.7, cy + r * 0.5); ctx.closePath(); ctx.fillStyle = '#315f96'; ctx.fill();
      this.ellipse(cx - r * 0.3, cy + r * 0.45, r * 1.1, r * 0.4, '#cdd9e8'); // belly/jaw
      ctx.fillStyle = '#f2f5fa'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(cx - r * 1.2 + i * r * 0.28, cy + r * 0.45); ctx.lineTo(cx - r * 1.1 + i * r * 0.28, cy + r * 0.2); ctx.lineTo(cx - r * 1.0 + i * r * 0.28, cy + r * 0.45); ctx.closePath(); ctx.fill(); }
      ctx.beginPath(); ctx.moveTo(cx, cy - r * 0.8); ctx.lineTo(cx + r * 0.3, cy - r * 1.5); ctx.lineTo(cx + r * 0.6, cy - r * 0.7); ctx.closePath(); ctx.fillStyle = '#2a5286'; ctx.fill();
      this.circle(cx + r * 0.2, cy - r * 0.3, r * 0.22, '#fff'); this.circle(cx + r * 0.22, cy - r * 0.27, r * 0.1, '#101014');
    },
    _faceHerald(cx, cy, r) {
      const ctx = this.ctx;
      ctx.fillStyle = this.vgrad(cx - r * 0.9, cy - r, r * 1.8, r * 2.2, '#9a6b2f', '#6e4a1f');
      this._rrPath(cx - r * 0.85, cy - r, r * 1.7, r * 2.1, r * 0.3); ctx.fill();
      this.ellipse(cx - r * 0.35, cy - r * 0.1, r * 0.2, r * 0.3, '#120a04'); this.ellipse(cx + r * 0.35, cy - r * 0.1, r * 0.2, r * 0.3, '#120a04');
      this.roundRect(cx - r * 0.4, cy + r * 0.5, r * 0.8, r * 0.25, r * 0.1, '#120a04');
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = r * 0.08; ctx.beginPath(); ctx.moveTo(cx - r * 0.8, cy + r * 0.1); ctx.lineTo(cx + r * 0.8, cy + r * 0.1); ctx.stroke();
    }
  };

  function lerpHex2(a, b, t) {
    const norm = (h) => { if (h[0] !== '#') return null; if (h.length === 4) h = '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3]; return h; };
    a = norm(a); b = norm(b); if (!a || !b) return a || '#888';
    return lerpHex(a, b, t);
  }

  global.GFX = GFX;
})(typeof window !== 'undefined' ? window : globalThis);
