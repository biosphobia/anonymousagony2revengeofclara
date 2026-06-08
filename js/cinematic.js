/* ============================================================================
 * cinematic.js — animated opening-cutscene engine + the long opening script.
 *
 * A timeline of instructions drives painted backdrops, moving/acting
 * characters, weather/lighting FX, camera moves and scored captions. It plays
 * automatically (auto-advancing beats), can be advanced with Z, and skipped by
 * holding X / Esc.
 * ==========================================================================*/
(function (global) {
  'use strict';
  const GFX = global.GFX, Input = global.Input, Sound = global.Sound, DATA = global.DATA;

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function sayDur(t) { return clamp(t.length * 55 + 1300, 2800, 9000); }

  const Cinematic = {
    active: false, onDone: null,
    instr: [], ip: 0, t: 0, waitDur: 0,
    bg: 'black', bgT: 0, gT: 0,
    actors: {}, caption: null, effect: null,
    fade: 0, fadeTarget: 0, fadeDur: 0, fadeT: 0, fadeFrom: 0,
    flash: null, shake: 0, shakeT: 0,
    cam: { x: 0, y: 0, zoom: 1 }, camTween: null,
    skipHold: 0, ended: false,

    play(onDone) {
      this.active = true; this.ended = false; this.onDone = onDone;
      this.instr = buildIntro(); this.ip = 0; this.t = 0; this.waitDur = 0;
      this.bg = 'black'; this.bgT = 0; this.gT = 0;
      this.actors = {}; this.caption = null; this.effect = null;
      this.fade = 0; this.fadeTarget = 0; this.flash = null; this.shake = 0;
      this.cam = { x: 0, y: 0, zoom: 1 }; this.camTween = null;
      this.skipHold = 0;
      this._pump();
    },

    finish() {
      if (this.ended) return; this.ended = true; this.active = false;
      if (global.Voice) global.Voice.stop();
      const cb = this.onDone; this.onDone = null; if (cb) cb();
    },

    // run instructions until a blocking one starts
    _pump() {
      while (this.ip < this.instr.length) {
        const e = this.instr[this.ip];
        const blocking = this._exec(e);
        this.ip++;
        if (blocking) { this.t = 0; return; }
      }
      this.finish();
    },

    _exec(e) {
      if (e.bg !== undefined) { this.bg = e.bg; this.bgT = 0; if (!e.keep) this.actors = {}; return false; }
      if (e.music !== undefined) { Sound.playMusic(e.music); return false; }
      if (e.sfx) { Sound.sfx(e.sfx); return false; }
      if (e.effect !== undefined) { this.effect = e.effect; return false; }
      if (e.actor) {
        this.actors[e.actor] = {
          char: e.char || e.actor, x: e.x != null ? e.x : 128, y: e.y != null ? e.y : 150,
          dir: e.dir || 'down', scale: e.scale || 3.2, alpha: e.alpha != null ? e.alpha : 1,
          anim: e.anim || null, tween: null
        };
        return false;
      }
      if (e.remove) { delete this.actors[e.remove]; return false; }
      if (e.face) { const a = this.actors[e.face]; if (a) a.dir = e.dir; return false; }
      if (e.setAnim) { const a = this.actors[e.setAnim]; if (a) a.anim = e.anim; return false; }
      if (e.flash) { this.flash = { color: e.flash, t: 0, dur: e.dur || 300 }; return false; }
      if (e.shake) { this.shake = e.shake; this.shakeT = e.dur || 500; return false; }
      if (e.camera) { this.camTween = { from: Object.assign({}, this.cam), to: Object.assign({ x: this.cam.x, y: this.cam.y, zoom: this.cam.zoom }, e.camera), t: 0, dur: e.dur || 1500 }; return false; }
      if (e.move) {
        const a = this.actors[e.move]; if (!a) return false;
        a.tween = { fromX: a.x, fromY: a.y, toX: e.x != null ? e.x : a.x, toY: e.y != null ? e.y : a.y, t: 0, dur: e.dur || 1200 };
        if (e.x != null) a.dir = e.x < a.x ? 'left' : (e.x > a.x ? 'right' : a.dir);
        if (e.block) { this.waitDur = e.dur || 1200; return true; }
        return false;
      }
      if (e.wait !== undefined) { this.waitDur = e.wait; return true; }
      if (e.fade !== undefined) {
        this.fadeFrom = this.fade; this.fadeTarget = e.fade === 'out' ? 1 : 0;
        this.fadeDur = e.dur != null ? e.dur : 800; this.fadeT = 0;
        this.waitDur = this.fadeDur; return true;
      }
      if (e.say !== undefined) {
        this.caption = { kind: 'say', who: e.say, portrait: e.portrait !== undefined ? e.portrait : (e.say ? DATA.SPEAKER_PORTRAITS[e.say] : null), text: e.text, shown: 0, full: e.text.length };
        if (global.Voice) global.Voice.speak(e.text, e.say || 'Narrator');
        this.waitDur = e.dur || sayDur(e.text); return true;
      }
      if (e.narrate !== undefined) {
        this.caption = { kind: 'narrate', lines: e.narrate, t: 0 };
        if (global.Voice) global.Voice.speak(e.narrate.join('. '), 'Narrator');
        const chars = e.narrate.join(' ').length;
        this.waitDur = e.dur || clamp(chars * 60 + 1800, 3200, 11000); return true;
      }
      return false;
    },

    update(dtMs) {
      if (!this.active) return;
      const dt = dtMs || 16.7;
      this.gT += dt; this.bgT += dt;
      if (this.shakeT > 0) this.shakeT -= dt;

      // skip (hold) / advance (press)
      if (Input.isDown('cancel')) { this.skipHold += dt; if (this.skipHold > 650) { this.finish(); return; } }
      else this.skipHold = 0;
      const advance = Input.justPressed('confirm');

      // animate fade
      if (this.fadeT < this.fadeDur) { this.fadeT += dt; this.fade = this.fadeFrom + (this.fadeTarget - this.fadeFrom) * clamp(this.fadeT / this.fadeDur, 0, 1); }
      else this.fade = this.fadeTarget;
      // flash
      if (this.flash) { this.flash.t += dt; if (this.flash.t >= this.flash.dur) this.flash = null; }
      // camera
      if (this.camTween) { this.camTween.t += dt; const k = clamp(this.camTween.t / this.camTween.dur, 0, 1), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; const f = this.camTween.from, to = this.camTween.to; this.cam = { x: f.x + (to.x - f.x) * e, y: f.y + (to.y - f.y) * e, zoom: f.zoom + (to.zoom - f.zoom) * e }; if (k >= 1) this.camTween = null; }
      // actor tweens
      for (const k in this.actors) { const a = this.actors[k]; if (a.tween) { a.tween.t += dt; const p = clamp(a.tween.t / a.tween.dur, 0, 1); a.x = a.tween.fromX + (a.tween.toX - a.tween.fromX) * p; a.y = a.tween.fromY + (a.tween.toY - a.tween.fromY) * p; if (p >= 1) a.tween = null; } }
      // caption typewriter
      if (this.caption && this.caption.kind === 'say') { this.caption.shown += dt * 0.06; if (advance && this.caption.shown < this.caption.full) { this.caption.shown = this.caption.full; return; } }
      if (this.caption && this.caption.kind === 'narrate') this.caption.t += dt;

      // beat timing — hold while the line is still being spoken (capped)
      this.t += dt;
      if (advance) { this.t = this.waitDur; if (global.Voice) global.Voice.stop(); }
      const voicing = !advance && global.Voice && global.Voice.isSpeaking() &&
        this.caption && (this.caption.kind === 'say' || this.caption.kind === 'narrate');
      if (this.t >= this.waitDur && (!voicing || this.t >= this.waitDur + 9000)) this._pump();
    },

    render() {
      if (!this.active) return;
      const ctx = GFX.ctx, W = GFX.W, H = GFX.H;
      ctx.save();
      // shake + camera
      let sx = 0, sy = 0;
      if (this.shakeT > 0) { const m = this.shake; sx = (Math.random() * 2 - 1) * m; sy = (Math.random() * 2 - 1) * m; }
      ctx.translate(W / 2 + sx, H / 2 + sy); ctx.scale(this.cam.zoom, this.cam.zoom); ctx.translate(-W / 2 - this.cam.x, -H / 2 - this.cam.y);

      (BG[this.bg] || BG.black)(GFX, this.bgT, this.gT);
      if (this.effect === 'rain') drawRain(ctx, this.gT, 0.5);
      // actors back-to-front
      const list = Object.keys(this.actors).map(k => this.actors[k]).sort((a, b) => a.y - b.y);
      list.forEach(a => this._drawActor(a));
      if (this.effect === 'rain') drawRain(ctx, this.gT, 1);
      if (this.effect === 'snow') drawSnow(ctx, this.gT);
      if (this.effect === 'embers') drawEmbers(ctx, this.gT);
      if (this.effect === 'glitch') drawGlitch(ctx, this.gT, W, H);
      ctx.restore();

      // letterbox
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, 16); ctx.fillRect(0, H - 16, W, 16);

      // flash
      if (this.flash) { ctx.save(); ctx.globalAlpha = (1 - this.flash.t / this.flash.dur) * 0.9; ctx.fillStyle = this.flash.color; ctx.fillRect(0, 0, W, H); ctx.restore(); }
      // fade
      if (this.fade > 0) { ctx.save(); ctx.globalAlpha = this.fade; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.restore(); }

      this._drawCaption();

      // skip hint + progress
      const prog = Math.floor(100 * this.ip / this.instr.length);
      GFX.text('Hold X / Esc to skip', W - 6, H - 13, { color: 'rgba(220,220,230,' + (0.4 + 0.3 * Math.sin(this.gT / 400)) + ')', size: 7, align: 'right', shadow: true });
      if (this.skipHold > 0) { GFX.rect(0, H - 2, W * clamp(this.skipHold / 650, 0, 1), 2, '#d44'); }
      GFX.text('Z: next', 6, H - 13, { color: 'rgba(200,200,210,0.4)', size: 7, shadow: true });
    },

    _drawActor(a) {
      const ctx = GFX.ctx;
      const cfg = DATA.CHARS[a.char] || DATA.CHARS.villager;
      const px = a.x - 8 * a.scale, py = a.y - 16 * a.scale;
      let ox = 0, oy = 0;
      if (a.anim === 'shake') ox = Math.sin(this.gT / 50) * 1.5;
      if (a.anim === 'joy') oy = -Math.abs(Math.sin(this.gT / 180)) * 3;
      ctx.save(); if (a.alpha < 1) ctx.globalAlpha = a.alpha;
      GFX.drawChar(px + ox, py + oy, cfg, a.dir, this.gT / 110, { scale: a.scale, walking: !!a.tween });
      ctx.restore();
      // overlay anims
      const faceCx = a.x + ox, faceCy = py + oy + 5 * a.scale;
      if (a.anim === 'cry') {
        const d = (this.gT / 300) % 1;
        GFX.ellipse(faceCx - 1.8 * a.scale, faceCy + d * 6 * a.scale, 0.7 * a.scale, 1.2 * a.scale, 'rgba(150,200,240,0.85)');
        GFX.ellipse(faceCx + 1.8 * a.scale, faceCy + ((d + 0.5) % 1) * 6 * a.scale, 0.7 * a.scale, 1.2 * a.scale, 'rgba(150,200,240,0.85)');
      }
      if (a.anim === 'angry') { GFX.text('!', a.x, py - 6, { color: '#d85a5a', size: 10, align: 'center' }); }
    },

    _drawCaption() {
      const c = this.caption; if (!c) return;
      const W = GFX.W, H = GFX.H;
      if (c.kind === 'narrate') {
        const a = clamp(c.t / 600, 0, 1);
        GFX.ctx.save(); GFX.ctx.globalAlpha = a;
        const lh = 15, total = c.lines.length * lh; let y = (H - total) / 2;
        c.lines.forEach(l => { const big = l.startsWith('ANON') || l.startsWith("Clara'") || l.startsWith('—'); GFX.text(l, W / 2, y, { color: big ? '#e8d8c0' : '#d0ccc4', size: big ? 12 : 9, weight: big ? '700' : '500', align: 'center' }); y += lh; });
        GFX.ctx.restore();
        return;
      }
      // say: lower-third box with portrait
      const x = 6, w = W - 12, h = 46, y = H - h - 4;
      GFX.box(x, y, w, h);
      let tx = x + 10;
      if (c.portrait) { GFX.drawPortrait(c.portrait, x + 5, y + 5, 36, 36); tx = x + 48; }
      if (c.who) { const nw = GFX.textWidth(c.who, 9) + 12; GFX.box(x + 4, y - 9, nw, 14, { fill: '#241a44', r: 4 }); GFX.text(c.who, x + 10, y - 7, { color: '#f4dca0', size: 9, weight: '700' }); }
      const shown = c.text.slice(0, Math.floor(c.shown));
      const lines = GFX.wrap(shown, w - (tx - x) - 12, 9);
      lines.slice(0, 3).forEach((l, i) => GFX.text(l, tx, y + 8 + i * 12, { color: '#eef0f8', size: 9 }));
    }
  };

  // --------------------------------------------------------------------------
  // Background painters: (GFX, bgT, globalT)
  // --------------------------------------------------------------------------
  const BG = {
    black(g) { g.clear('#05050a'); },
    title(g, bt, t) {
      const ctx = g.ctx; const grd = ctx.createLinearGradient(0, 0, 0, g.H); grd.addColorStop(0, '#1a0e14'); grd.addColorStop(1, '#050308'); ctx.fillStyle = grd; ctx.fillRect(0, 0, g.W, g.H);
      drawEmbers(ctx, t);
    },
    living(g, bt, t) {
      const ctx = g.ctx;
      ctx.fillStyle = g.vgrad(0, 0, g.W, g.H, '#2a2230', '#171019'); ctx.fillRect(0, 0, g.W, g.H);
      g.rect(0, 150, g.W, g.H - 150, '#241a1a');           // floor
      // window with rain
      g.roundRect(20, 36, 54, 50, 3, '#10141f'); g.rect(46, 36, 2, 50, '#20283a');
      // couch
      g.roundRect(150, 116, 86, 30, 6, '#3a2e44'); g.roundRect(150, 104, 86, 16, 6, '#46384f');
      // TV with flicker glow
      const fl = 0.5 + 0.5 * Math.sin(t / 90) * Math.sin(t / 37);
      g.roundRect(96, 60, 64, 40, 3, '#0a0a10');
      ctx.save(); ctx.globalAlpha = 0.4 + 0.3 * fl; g.roundRect(99, 63, 58, 34, 2, '#3a5f86'); ctx.restore();
      // lamp pool
      const lg = ctx.createRadialGradient(210, 70, 4, 210, 90, 60); lg.addColorStop(0, 'rgba(240,210,140,0.25)'); lg.addColorStop(1, 'rgba(240,210,140,0)'); ctx.fillStyle = lg; ctx.fillRect(150, 40, 120, 110);
    },
    claraRoom(g, bt, t) {
      const ctx = g.ctx;
      ctx.fillStyle = g.vgrad(0, 0, g.W, g.H, '#1c2438', '#10131f'); ctx.fillRect(0, 0, g.W, g.H);
      g.rect(0, 152, g.W, g.H - 152, '#181b28');
      // window night + stars
      g.roundRect(24, 30, 52, 46, 3, '#0a1020'); for (let i = 0; i < 8; i++) g.circle(30 + (i * 37 % 44), 36 + (i * 53 % 36), 0.6, 'rgba(220,230,255,0.7)');
      // bed
      g.roundRect(12, 120, 70, 28, 5, '#3a4a6a'); g.roundRect(12, 112, 26, 18, 5, '#cdd6e6');
      // desk + monitor glow (pulsing — she's online)
      g.rect(150, 116, 86, 30, '#2a2230');
      const pg = 0.4 + 0.3 * Math.sin(t / 240);
      g.roundRect(176, 86, 44, 30, 2, '#0a0a12');
      ctx.save(); ctx.globalAlpha = 0.5 + 0.4 * pg; g.roundRect(179, 89, 38, 24, 1, '#5aa0d0'); ctx.restore();
      const mg = ctx.createRadialGradient(198, 100, 6, 198, 110, 70); mg.addColorStop(0, 'rgba(120,180,230,0.22)'); mg.addColorStop(1, 'rgba(120,180,230,0)'); ctx.fillStyle = mg; ctx.fillRect(120, 60, 130, 100);
    },
    streetDay(g) {
      const ctx = g.ctx;
      ctx.fillStyle = g.vgrad(0, 0, g.W, g.H, '#8fa6c0', '#c8cdb8'); ctx.fillRect(0, 0, g.W, g.H);
      for (let i = 0; i < 5; i++) { g.roundRect(8 + i * 52, 70 - (i % 2) * 12, 44, 70, 3, i % 2 ? '#7a5a52' : '#6a6a72'); g.rect(20 + i * 52, 96, 8, 10, '#2a3242'); }
      g.rect(0, 138, g.W, 12, '#5a5d64'); g.rect(0, 150, g.W, g.H - 150, '#3a3d42');
      for (let i = 0; i < 6; i++) g.rect(12 + i * 44, 156, 22, 2, 'rgba(240,240,200,0.6)');
    },
    streetNight(g, bt, t) {
      const ctx = g.ctx;
      ctx.fillStyle = g.vgrad(0, 0, g.W, g.H, '#0e1430', '#070912'); ctx.fillRect(0, 0, g.W, g.H);
      for (let i = 0; i < 30; i++) g.circle((i * 71) % g.W, (i * 37) % 70, 0.6, 'rgba(220,230,255,0.5)');
      for (let i = 0; i < 5; i++) { g.roundRect(8 + i * 52, 64 - (i % 2) * 10, 44, 80, 3, '#161a26'); if ((i + Math.floor(t / 1500)) % 3 === 0) g.rect(20 + i * 52, 88, 8, 9, 'rgba(240,210,120,0.6)'); }
      g.rect(0, 150, g.W, g.H - 150, '#15171f');
      // streetlight pools
      [60, 170].forEach(lx => { const lg = ctx.createRadialGradient(lx, 110, 6, lx, 150, 60); lg.addColorStop(0, 'rgba(240,210,140,0.18)'); lg.addColorStop(1, 'rgba(240,210,140,0)'); ctx.fillStyle = lg; ctx.fillRect(lx - 60, 90, 120, 80); g.rect(lx - 1, 96, 2, 54, '#2a2a30'); });
    },
    hospitalExt(g, bt, t) {
      const ctx = g.ctx;
      ctx.fillStyle = g.vgrad(0, 0, g.W, g.H, '#10182c', '#0a0d18'); ctx.fillRect(0, 0, g.W, g.H);
      g.roundRect(40, 28, 176, 118, 3, '#2a2f3c');
      for (let r = 0; r < 5; r++) for (let c = 0; c < 8; c++) { const on = ((r * 8 + c + Math.floor(t / 900)) % 5) < 2; g.rect(52 + c * 20, 40 + r * 20, 12, 12, on ? 'rgba(230,220,150,0.7)' : '#161b26'); }
      g.rect(0, 150, g.W, g.H - 150, '#0e1018');
      // red cross sign
      g.rect(120, 14, 16, 5, '#d84a4a'); g.rect(125, 9, 5, 16, '#d84a4a');
      g.text('ZEDE HOSPITAL', g.W / 2, 150, { color: '#9aa6c0', size: 8, align: 'center' });
    },
    hospitalRoom(g) {
      const ctx = g.ctx;
      ctx.fillStyle = g.vgrad(0, 0, g.W, g.H, '#cfe0e0', '#a8c2c4'); ctx.fillRect(0, 0, g.W, g.H);
      g.rect(0, 150, g.W, g.H - 150, '#88a2a4');
      g.roundRect(150, 30, 70, 56, 3, '#bfe0ea'); g.rect(184, 30, 2, 56, '#9ab8c0'); // window
      // bed
      g.roundRect(18, 118, 84, 30, 4, '#e8eef0'); g.roundRect(18, 108, 30, 16, 4, '#d6dde0'); g.rect(18, 132, 84, 4, '#c0c8cc');
      // monitor
      g.rect(110, 96, 14, 22, '#2a3036'); g.rect(112, 100, 10, 8, '#3ad06a');
    },
    police(g) {
      const ctx = g.ctx;
      ctx.fillStyle = g.vgrad(0, 0, g.W, g.H, '#1a2230', '#0e131c'); ctx.fillRect(0, 0, g.W, g.H);
      for (let i = 0; i < 10; i++) g.rect(40, 24 + i * 6, 180, 2, 'rgba(120,150,190,0.12)'); // blinds
      g.rect(0, 150, g.W, g.H - 150, '#141821');
      g.roundRect(70, 120, 116, 26, 3, '#3a2f28'); // desk
      const lg = ctx.createRadialGradient(128, 60, 8, 128, 100, 80); lg.addColorStop(0, 'rgba(180,200,230,0.12)'); lg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = lg; ctx.fillRect(0, 0, g.W, g.H);
    },
    court(g) {
      const ctx = g.ctx;
      ctx.fillStyle = g.vgrad(0, 0, g.W, g.H, '#241c16', '#120d0a'); ctx.fillRect(0, 0, g.W, g.H);
      g.roundRect(96, 18, 64, 70, 3, '#0c1424'); for (let i = 1; i < 6; i++) g.rect(96 + i * 10, 18, 2, 70, '#0a0f1c'); // barred window
      g.rect(0, 150, g.W, g.H - 150, '#1a130e');
      g.roundRect(20, 96, 60, 50, 4, '#3a2a1c'); g.roundRect(176, 96, 60, 50, 4, '#3a2a1c'); // benches
    },
    porch(g, bt, t) {
      const ctx = g.ctx;
      ctx.fillStyle = g.vgrad(0, 0, g.W, g.H, '#0c1020', '#06070e'); ctx.fillRect(0, 0, g.W, g.H);
      g.roundRect(60, 30, 136, 120, 2, '#1a1620'); // house wall
      g.roundRect(108, 70, 40, 80, 2, '#2a2018'); // door
      g.circle(143, 110, 1.5, '#caa84a');
      const pl = 0.5 + 0.5 * Math.sin(t / 500); const lg = ctx.createRadialGradient(128, 40, 4, 128, 90, 70); lg.addColorStop(0, 'rgba(240,200,120,' + (0.12 + 0.1 * pl) + ')'); lg.addColorStop(1, 'rgba(240,200,120,0)'); ctx.fillStyle = lg; ctx.fillRect(40, 20, 180, 140);
      g.rect(0, 150, g.W, g.H - 150, '#0a0a10');
    },
    voidHour(g, bt, t) {
      const ctx = g.ctx;
      ctx.fillStyle = g.vgrad(0, 0, g.W, g.H, '#1a0810', '#050207'); ctx.fillRect(0, 0, g.W, g.H);
      for (let i = 0; i < 5; i++) { const rx = (i * 53 + 30) % g.W, ry = 30 + (i * 41) % 120; const pulse = 0.3 + 0.3 * Math.sin(t / 200 + i); ctx.save(); ctx.globalAlpha = pulse; g.ellipse(rx, ry, 3, 22, '#c8401a'); ctx.restore(); }
      g.rect(0, 150, g.W, g.H - 150, '#180810');
    },
    memory(g, bt, t) {
      const ctx = g.ctx;
      ctx.fillStyle = g.vgrad(0, 0, g.W, g.H, '#3a2e22', '#241c16'); ctx.fillRect(0, 0, g.W, g.H);
      ctx.save(); ctx.globalAlpha = 0.12; ctx.fillStyle = '#f0d8a0'; ctx.fillRect(0, 0, g.W, g.H); ctx.restore();
      g.rect(0, 150, g.W, g.H - 150, '#2a2018');
    }
  };

  // --------------------------------------------------------------------------
  // Effects
  // --------------------------------------------------------------------------
  function drawRain(ctx, t, front) {
    ctx.save(); ctx.strokeStyle = front > 0.7 ? 'rgba(180,200,230,0.35)' : 'rgba(120,140,180,0.2)'; ctx.lineWidth = front > 0.7 ? 1 : 0.7;
    const n = front > 0.7 ? 36 : 24;
    for (let i = 0; i < n; i++) { const x = (i * 53 + (t * 0.4)) % 270 - 7; const y = ((i * 71 + t * (front > 0.7 ? 0.9 : 0.6)) % 220) - 10; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 9); ctx.stroke(); }
    ctx.restore();
  }
  function drawSnow(ctx, t) { ctx.save(); ctx.fillStyle = 'rgba(230,235,245,0.8)'; for (let i = 0; i < 40; i++) { const x = (i * 37 + Math.sin((t / 600) + i) * 14) % 260; const y = (i * 53 + t * 0.25) % 200; ctx.beginPath(); ctx.arc(x, y, 0.9, 0, 7); ctx.fill(); } ctx.restore(); }
  function drawEmbers(ctx, t) { for (let i = 0; i < 24; i++) { const x = (i * 41 + Math.sin(t / 500 + i) * 18) % 256; const y = 192 - ((t * 0.5 + i * 33) % 210); ctx.save(); ctx.globalAlpha = 0.4 + 0.4 * Math.sin(t / 200 + i); ctx.fillStyle = i % 3 ? '#c8501a' : '#e6a040'; ctx.beginPath(); ctx.arc(x, y, 0.9, 0, 7); ctx.fill(); ctx.restore(); } }
  function drawGlitch(ctx, t, W, H) {
    if (Math.floor(t / 90) % 3 === 0) {
      for (let i = 0; i < 4; i++) { const y = (Math.random() * H) | 0, h = 2 + Math.random() * 6; ctx.save(); ctx.globalAlpha = 0.3; ctx.fillStyle = i % 2 ? '#c81a2a' : '#1ad0c8'; ctx.fillRect(0, y, W, h); ctx.restore(); }
    }
    ctx.save(); ctx.globalAlpha = 0.05 + 0.05 * Math.sin(t / 60); ctx.fillStyle = '#c81a2a'; ctx.fillRect(0, 0, W, H); ctx.restore();
  }

  // --------------------------------------------------------------------------
  // The opening script (long, multi-act). Actors live in 256x192 space;
  // feet baseline ~150. say/narrate auto-advance; non-blocking moves animate
  // while characters speak.
  // --------------------------------------------------------------------------
  function buildIntro() {
    const G = 150;            // ground baseline
    const L = 64, CL = 100, C = 128, CR = 156, R = 192; // x columns
    const s = [];
    const P = (o) => s.push(o);

    // ---------- ACT I — a knock in the dark ----------
    P({ bg: 'black' }); P({ wait: 700 });
    P({ narrate: ['ANONYMOUS AGONY II', "Clara's Revenge"], dur: 4200 });
    P({ fade: 'out', dur: 10 });
    P({ bg: 'porch', music: 'keep', effect: 'rain' }); P({ fade: 'in', dur: 1200 });
    P({ narrate: ['Before dawn, the old drum calls you to rise.', 'You answer. You always answer.'], dur: 4600 });
    P({ sfx: 'knock', flash: '#fff', dur: 200 }); P({ wait: 700 });
    P({ sfx: 'knock', flash: '#fff', dur: 200 }); P({ wait: 700 });
    P({ sfx: 'knock', flash: '#fff', dur: 200 }); P({ wait: 900 });
    P({ narrate: ['Ignore the call three times...', 'and something answers for you.'], dur: 4200 });
    P({ fade: 'out', dur: 1200 });

    // ---------- ACT II — the cold house ----------
    P({ bg: 'living', music: 'village', effect: 'rain' });
    P({ narrate: ['Years ago. A house on Maple Street.', 'It was never a warm house.'], dur: 4200 });
    P({ fade: 'in', dur: 900 });
    P({ actor: 'father', x: L, y: G, dir: 'right' });
    P({ actor: 'mother', x: R, y: G, dir: 'left' });
    P({ say: 'Father', text: "...don't you look at me like that. I work all day and come home to THIS?" });
    P({ say: 'Mother', text: "Oh, here we go. Poor you. Maybe if you were ever sober we'd HAVE a home worth coming to." });
    P({ setAnim: 'father', anim: 'angry' });
    P({ say: 'Father', text: "Keep your voice down. The kids—" });
    P({ say: 'Mother', text: "The kids? Since when do YOU care about the kids?" });
    P({ narrate: ['Two people who hated each other,', 'staying only because leaving was more effort.'], dur: 4000 });

    // Haze enters
    P({ actor: 'haze', x: -10, y: G, dir: 'right' });
    P({ move: 'haze', x: CL, dur: 1500 });
    P({ wait: 600 });
    P({ say: 'Haze', text: "Wow. The nightly screaming match. Don't stop on my account." });
    P({ say: 'Father', text: "Watch your mouth, boy." });
    P({ say: 'Haze', text: "Or what? You'll threaten me again and fall asleep on the couch? Terrifying." });
    P({ narrate: ['Haze Stratos. Eighteen. All sharp edges,', 'and one soft spot he guarded with his life.'] });

    // Clara enters, bright
    P({ actor: 'clara', x: 270, y: G, dir: 'left', scale: 2.7, anim: 'joy' });
    P({ move: 'clara', x: CR, dur: 1400 });
    P({ say: 'Clara', text: "HAAAZE! You're home! Okay okay you PROMISED you'd play the co-op level with me tonight." });
    P({ setAnim: 'haze', anim: null }); P({ face: 'haze', dir: 'right' });
    P({ say: 'Haze', text: "...Yeah, twerp. After they're done. Go wait in your room, okay?" });
    P({ say: 'Clara', text: "You ALWAYS say that and then you actually do it, which is why you're my favorite. Even if you're a total Ass." });
    P({ say: 'Haze', text: "Language." });
    P({ say: 'Clara', text: "YOU say it like every five seconds!" });
    P({ say: 'Haze', text: "Yeah, well. Do as I say, not as I— just go on. I'll be up." });
    P({ setAnim: 'clara', anim: 'joy' });
    P({ move: 'clara', x: 270, dur: 1500 });
    P({ remove: 'clara' });
    P({ narrate: ['After the accident that nearly took her —', 'the one nobody talked about —', 'Haze swore he\'d never lose her.', '', 'She was the only good thing in that house.'], dur: 5200 });
    P({ fade: 'out', dur: 1000 });

    // ---------- ACT III — Clara's world ----------
    P({ bg: 'claraRoom', music: 'town' });
    P({ actor: 'clara', x: 198, y: G - 2, dir: 'up', scale: 2.7 });
    P({ fade: 'in', dur: 900 });
    P({ narrate: ['She practically lived online.', 'Friends, games, a hundred glowing little chats', 'long past her bedtime.'], dur: 4400 });
    P({ face: 'clara', dir: 'down' });
    P({ say: 'Clara', text: "hehe — okay okay you're actually really funny. nobody at school GETS me like you do." });
    P({ say: 'Clara', text: "you wanna see the drawing I made? hold on hold on—" });
    P({ narrate: ['Somewhere on the other side of the screen,', 'someone patient was smiling.', 'Someone who was not who they said they were.'], dur: 4600 });
    // Haze's snarky hidden warning (canon trait)
    P({ actor: 'haze', x: -10, y: G, dir: 'right', scale: 2.7 });
    P({ move: 'haze', x: 96, dur: 1200 });
    P({ say: 'Haze', text: "Hey. Brat. The internet's full of liars who are nice for a reason. ...Just. Be smart, okay?" });
    P({ say: 'Clara', text: "Oh my GOD I KNOW, mom. I'm eleven, not stupid." });
    P({ say: 'Haze', text: "Yeah. Yeah, I know you're not. ...Night, twerp." });
    P({ remove: 'haze' });
    P({ narrate: ['He meant to say more.', 'He always meant to say more.'], dur: 3400 });
    P({ fade: 'out', dur: 1400 });

    // ---------- ACT IV — the day it broke ----------
    P({ bg: 'streetDay', music: 'woods' });
    P({ narrate: ['One ordinary afternoon,', 'Haze came home early.'], dur: 3400 });
    P({ fade: 'in', dur: 700 });
    P({ actor: 'haze', x: -10, y: G, dir: 'right' });
    P({ move: 'haze', x: C, dur: 1700 });
    P({ say: 'Haze', text: "Clara? I got that dumb game you wanted. ...Clara?" });
    P({ wait: 700 });
    P({ say: 'Haze', text: "...Why's the door shut. Clara, open the door." });
    P({ shake: 3, dur: 600 });
    P({ say: 'Haze', text: "CLARA—" });
    P({ flash: '#fff', dur: 500 }); P({ sfx: 'crit' }); P({ shake: 6, dur: 700 });
    P({ fade: 'out', dur: 1500 });
    P({ bg: 'black' });
    P({ narrate: ['Some doors, once opened,', 'never close again.'], dur: 4000 });
    P({ narrate: ['The bad thing had a face, and a name,', 'and Haze would learn both.', '', 'But the damage was already done.'], dur: 4800 });
    P({ narrate: ['The bright, loud, sunny girl —', 'the heart of that cold house —', '', 'went very, very quiet.'], dur: 5000 });

    // ---------- ACT V — Zede Hospital ----------
    P({ bg: 'hospitalExt', music: 'town' }); P({ fade: 'in', dur: 1000 });
    P({ narrate: ['Zede Hospital.', 'Where they sent her to heal.'], dur: 3600 });
    P({ fade: 'out', dur: 700 });
    P({ bg: 'hospitalRoom' });
    P({ actor: 'clara', x: 60, y: 132, dir: 'down', scale: 2.6, anim: null });
    P({ fade: 'in', dur: 800 });
    P({ actor: 'samson', x: 200, y: G, dir: 'left' });
    P({ move: 'samson', x: 150, dur: 1400 });
    P({ say: 'Dr. Samson', text: "Hi, Clara. I'm Dr. Samson. ...You don't have to say anything today. We can just sit." });
    P({ say: 'Clara', text: "..." });
    P({ say: 'Dr. Samson', text: "That's okay. Silence is allowed in here. It's about the only place it is." });
    P({ narrate: ['Dr. James Samson. He fought to reach kids', 'the system had already written off —', 'and fought the hospital that signed the checks.'], dur: 4800 });
    // Annie
    P({ actor: 'annie', x: 230, y: G, dir: 'left' });
    P({ move: 'annie', x: 188, dur: 1200 });
    P({ say: 'Annie', text: "Doctor. Your 'unconventional methods' are in the director's office again. I covered for you. Again." });
    P({ say: 'Dr. Samson', text: "And this is why you're the only person here I trust, Annie." });
    P({ say: 'Annie', text: "Flattery. Charming. Fix your paperwork." });
    P({ remove: 'annie' });
    // Enny
    P({ narrate: ['And there was a boy.'], dur: 2400 });
    P({ actor: 'enny', x: -10, y: G, dir: 'right', scale: 2.5, anim: 'joy' });
    P({ move: 'enny', x: 96, dur: 1500 });
    P({ say: 'Enny', text: "Hi! Hi. I'm Enny! They don't let me out much 'cause I look 'funny,' but you don't look scared of me. That's NEW." });
    P({ say: 'Clara', text: "...you don't look funny. you look like a friend." });
    P({ say: 'Enny', text: "A FRIEND?! oh boy oh boy. okay we're best friends now, no take-backs, it's the rules." });
    P({ setAnim: 'clara', anim: 'joy' });
    P({ say: 'Clara', text: "...okay. ...no take-backs." });
    P({ setAnim: 'clara', anim: null }); P({ remove: 'enny' });
    P({ narrate: ['It was the smallest light.', 'But after so much dark,', 'even the smallest light blinds you.'], dur: 4400 });
    P({ fade: 'out', dur: 1200 });

    // ---------- ACT VI — the Anonymous ----------
    P({ bg: 'streetNight', music: 'keep', effect: 'rain' });
    P({ narrate: ['Haze did not go to therapy.', 'Haze went looking.'], dur: 3600 });
    P({ fade: 'in', dur: 900 });
    P({ actor: 'haze', x: C, y: G, dir: 'down' });
    P({ say: 'Haze', text: "The cops 'didn't have enough.' The courts 'understood my frustration.' Nobody DID anything." });
    P({ say: 'Haze', text: "So. Fine. I'll use her screen name. I'll be the bait. And the ones who come crawling for a kid..." });
    P({ say: 'Haze', text: "...won't be crawling anywhere after." });
    P({ narrate: ['The headlines found a name for him.', "'The Anonymous.' Another predator, vanished.", 'And another. And another.'], dur: 4800 });
    // Craig
    P({ actor: 'craig', x: -10, y: G, dir: 'right' });
    P({ move: 'craig', x: L, dur: 1300 });
    P({ say: 'Officer Craig', text: "Evenin', Haze! Rough business lately, huh — these creeps just up and disappearing." });
    P({ say: 'Haze', text: "Terrible. Somebody oughta do something." });
    P({ say: 'Officer Craig', text: "Ha! You're a good kid, you know that? Tell your sister Officer Craig says hi. Stay outta trouble!" });
    P({ remove: 'craig' });
    P({ say: 'Haze', text: "...Good kid. Sure." });
    P({ narrate: ['He told himself it was for her.', 'Maybe at first it was.', '', 'But the dark is patient, and it keeps the change.'], dur: 4800 });
    P({ fade: 'out', dur: 1200 });

    // ---------- ACT VII — the fall ----------
    P({ bg: 'court', music: 'keep' });
    P({ narrate: ['It could never last.', 'One night, the Anonymous slipped.'], dur: 3600 });
    P({ fade: 'in', dur: 900 });
    P({ actor: 'haze', x: C, y: G, dir: 'down' });
    P({ actor: 'craig', x: 70, y: G, dir: 'right' });
    P({ say: 'Officer Craig', text: "...Haze. Son. Tell me it isn't you. Tell me and I'll believe you, I swear I will." });
    P({ say: 'Haze', text: "...You were never a good detective, Craig. But you were kind. Sorry I made that hard." });
    P({ say: 'Officer Craig', text: "...God. Why didn't you just LET us—" });
    P({ say: 'Haze', text: "Because 'us' did nothing. Look after her. Promise me you'll look after Clara." });
    P({ move: 'haze', x: -20, dur: 2200 });
    P({ remove: 'haze' });
    P({ fade: 'out', dur: 1000 });
    P({ bg: 'hospitalRoom' });
    P({ actor: 'clara', x: 188, y: 96, dir: 'up', scale: 2.6, anim: 'cry' });
    P({ fade: 'in', dur: 800 });
    P({ narrate: ['From a high white window,', 'Clara watched the car take her brother away.'], dur: 4200 });
    P({ say: 'Clara', text: "...you said you'd be up. you said you'd play the dumb level. you PROMISED, you Ass..." });
    P({ say: 'Clara', text: "...don't leave me too. please. please don't leave me alone in the quiet." });
    P({ narrate: ['But he was gone.', 'And the quiet moved in, and never paid rent.'], dur: 4200 });
    P({ fade: 'out', dur: 1400 });

    // ---------- ACT VIII — the hollow years ----------
    P({ bg: 'streetNight', music: 'woods' });
    P({ narrate: ['The years went by the way water goes down a drain.', 'Slowly. Then all at once.'], dur: 4200 });
    P({ fade: 'in', dur: 900 });
    P({ narrate: ['Clara grew up in that house alone.', 'She did not sleep much.', 'The guilt that was never hers kept her company.'], dur: 4800 });
    P({ narrate: ['And then the neighbors began to whisper', 'about a sound in the hour before dawn.', '', 'Tung. Tung. Tung.'], dur: 4600 });
    P({ sfx: 'knock', flash: '#fff', dur: 150 }); P({ wait: 500 });
    P({ sfx: 'knock', flash: '#fff', dur: 150 }); P({ wait: 500 });
    P({ narrate: ['The Hendersons did not answer their door.', 'Neither did the boy two streets over.', 'They are not on Maple Street anymore.'], dur: 4400 });
    P({ fade: 'out', dur: 1000 });

    // ---------- ACT IX — Tung Tung Tung Sahur ----------
    P({ bg: 'porch', effect: 'rain', music: 'boss' });
    P({ fade: 'in', dur: 800 });
    P({ actor: 'clara', x: 90, y: G, dir: 'right', scale: 3.0 });
    P({ say: 'Clara', text: "...It's three in the morning. It's always three in the morning now." });
    P({ sfx: 'knock', flash: '#fff', dur: 200 }); P({ shake: 2, dur: 300 }); P({ wait: 500 });
    P({ say: 'Clara', text: "One." });
    P({ sfx: 'knock', flash: '#fff', dur: 200 }); P({ shake: 2, dur: 300 }); P({ wait: 500 });
    P({ say: 'Clara', text: "Two. ...don't answer. for ONCE in your life don't—" });
    P({ sfx: 'knock', flash: '#fff', dur: 260 }); P({ shake: 4, dur: 500 }); P({ wait: 700 });
    P({ effect: 'glitch' });
    P({ camera: { zoom: 1.25, y: -10 }, dur: 1400 });
    P({ actor: 'tung', x: C, y: G + 4, dir: 'down', scale: 3.6 });
    P({ flash: '#7a0e14', dur: 600 }); P({ shake: 5, dur: 800 });
    P({ say: 'Tung Tung Tung Sahur', text: "tung... tung... tung... sahuuur~ bambina Claraaa. three knock! tralalero tralala, now I am INSIDE the hour with you." });
    P({ say: 'Tung Tung Tung Sahur', text: "bombardiro crocodilo! you no answer for so long, and the not-answering... it made me FAT. grazie, piccolina." });
    P({ say: 'Clara', text: "...You're the sound. Under everything. Since I was eleven. The thing in the walls when I can't sleep." });
    P({ say: 'Tung Tung Tung Sahur', text: "siii! I am your guilt with a face and a stick! lirili larila~ everyone leave you — mama, papa, the brother — but ME? I always knock-knock-knock!" });
    P({ setAnim: 'clara', anim: 'shake' });
    P({ say: 'Clara', text: "...He'd hate this. Haze. He'd say don't you DARE cry in front of it." });
    P({ setAnim: 'clara', anim: null }); P({ face: 'clara', dir: 'right' });
    P({ say: 'Clara', text: "He'd say grab something heavy and SWING. ...So that's what I'm gonna do." });
    P({ say: 'Clara', text: "Tung Tung Tung Sahur. I heard you. Every single night. ...Now come knock ONE more time." });
    P({ flash: '#fff', dur: 500 }); P({ shake: 6, dur: 700 });
    P({ camera: { zoom: 1, y: 0 }, dur: 800 });
    P({ effect: null });
    P({ fade: 'out', dur: 1400 });
    P({ bg: 'black' });
    P({ narrate: ['ANONYMOUS AGONY II', "Clara's Revenge", '', 'Her turn now.'], dur: 4200 });
    P({ fade: 'out', dur: 10 });
    return s;
  }

  Cinematic.buildIntro = buildIntro;
  global.Cinematic = Cinematic;
})(typeof window !== 'undefined' ? window : globalThis);
