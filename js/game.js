/* ============================================================================
 * game.js — state machine for the grounded puzzle/exploration game.
 *   title / cinematic / opening-credits / explore / cutscene / menu / credits.
 *   No combat. Event interpreter drives dialogue, puzzles, choices & twists.
 * ==========================================================================*/
(function (global) {
  'use strict';

  const DATA = global.DATA, GFX = global.GFX, Input = global.Input, Sound = global.Sound,
        World = global.World, Dialogue = global.Dialogue, Menu = global.Menu, Cinematic = global.Cinematic;
  const V = () => global.Voice;

  const SAVE_KEY = 'aa2_clara_save_v2';

  // ---- Opening vengeance credits config -------------------------------------
  // Upload the song to this path in the repo. The credits sequence is synced to
  // the audio's own playback clock, so timing matches whatever file is here.
  const CREDITS_SONG_SRC = 'https://github.com/biosphobia/anonymousagony2revengeofclara/raw/refs/heads/claude/vibrant-goldberg-KryZ2/assets/down-with-the-sickness.mp3';
  // End the credits at the end of the first chorus (seconds). Tweak to match
  // your upload exactly. Falls back to a timer if the audio can't play.
  const CREDITS_END_SEC = 122;

  const Game = {
    mode: 'title', frame: 0, state: null,
    fadeAlpha: 0, fadeTarget: 0, fadeSpeed: 0.08, transition: null, _fadeInQueued: false,
    ev: null, narration: null, pause: null, toast: null, locTimer: 0,
    titleMenu: null, credits: null, choiceMenu: null,
    flash: null, shake: 0,
    oc: null, // opening-credits state

    init() { this.showTitle(); },

    // ---- inventory / flags ----
    addItem(id, n) { this.state.items[id] = (this.state.items[id] || 0) + (n || 1); },
    removeItem(id, n) { this.state.items[id] = Math.max(0, (this.state.items[id] || 0) - (n || 1)); if (!this.state.items[id]) delete this.state.items[id]; },
    hasItem(id) { return (this.state.items[id] || 0) > 0; },
    _ctx() { return { flags: this.state.flags, items: this.state.items, hasItem: (k) => this.hasItem(k) }; },

    // ---- new game / save / load ----
    _newGameState() {
      this.state = { map: 'street', flags: {}, items: {}, triggersDone: {} };
      const m = DATA.MAPS.street;
      World.loadMap('street', m.start.x, m.start.y, m.start.dir);
      this.locTimer = 150;
    },
    newGame() { this._newGameState(); this.startIntro(); },

    startIntro() {
      this.mode = 'cinematic'; this.fadeAlpha = 0;
      Cinematic.play(() => this.startOpenCredits());
    },

    save() {
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify({
          map: this.state.map, player: { tx: World.player.tx, ty: World.player.ty, dir: World.player.dir },
          flags: this.state.flags, items: this.state.items, triggersDone: this.state.triggersDone
        }));
        return true;
      } catch (e) { return false; }
    },
    hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } },
    load() {
      let d; try { d = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return false; }
      if (!d) return false;
      this.state = { map: d.map, flags: d.flags || {}, items: d.items || {}, triggersDone: d.triggersDone || {} };
      const dp = d.player || DATA.MAPS[d.map].start;
      World.loadMap(d.map, dp.tx, dp.ty, dp.dir);
      this.locTimer = 150; this.fadeAlpha = 0; this.mode = 'explore';
      return true;
    },

    // ---- title ----
    showTitle() {
      this.mode = 'title'; this.state = null; Sound.playMusic('title');
      const items = [{ label: 'New Game', value: 'new' }];
      if (this.hasSave()) items.push({ label: 'Continue', value: 'continue' });
      this.titleMenu = new Menu({
        x: 88, y: 130, w: 80, rowH: 15, items,
        onSelect: (it) => {
          Sound.resume(); if (V()) V().warm();
          if (it.value === 'new') this.fadeOutThen(() => this.newGame(), true);
          else this.fadeOutThen(() => { if (!this.load()) this.newGame(); }, true);
        }
      });
    },

    fadeOutThen(cb, noFadeIn) { this.transition = { phase: 'custom', cb, noFadeIn: !!noFadeIn }; this.fadeTarget = 1; this.fadeSpeed = 0.06; },
    warp(exit) { this.transition = { phase: 'out', exit }; this.mode = 'transition'; this.fadeTarget = 1; this.fadeSpeed = 0.1; },

    // ====================================================================
    // Opening vengeance credits (synced to the uploaded song)
    // ====================================================================
    startOpenCredits() {
      this.mode = 'opencredits';
      this.fadeAlpha = 0;
      Sound.stopMusic();
      const roles = [
        'DIRECTED BY', 'WRITTEN BY', 'STORY & SCREENPLAY', 'ART & ANIMATION', 'PROGRAMMING',
        'CHARACTER DESIGN', 'LEVEL DESIGN', 'SOUND DESIGN', 'MUSIC DIRECTION', 'PRODUCED BY',
        'EDITING', 'CASTING', 'SPECIAL THANKS'
      ];
      let audio = null;
      try {
        audio = new global.Audio(CREDITS_SONG_SRC);
        audio.volume = 0.9;
        const p = audio.play();
        if (p && p.catch) p.catch(() => {});
      } catch (e) { audio = null; }
      this.oc = { audio, t: 0, roles, idx: 0, ended: false, skipHold: 0, analyser: null, freq: null, level: 0, shot: -1, cut: 0 };
      // route the song through an analyser so the OP pulses to the actual music
      try {
        const AC = global.AudioContext || global.webkitAudioContext;
        const ac = (Sound && Sound.ctx) ? Sound.ctx : (AC ? new AC() : null);
        if (ac && audio) {
          if (ac.state === 'suspended' && ac.resume) ac.resume();
          const src = ac.createMediaElementSource(audio);
          const an = ac.createAnalyser(); an.fftSize = 256; an.smoothingTimeConstant = 0.6;
          src.connect(an); an.connect(ac.destination);
          this.oc.analyser = an; this.oc.freq = new Uint8Array(an.frequencyBinCount);
        }
      } catch (e) { /* analyser optional */ }
    },

    _updateOpenCredits() {
      const oc = this.oc;
      oc.t += 1000 / 60;
      const now = (oc.audio && oc.audio.currentTime) ? oc.audio.currentTime : (oc.t / 1000);
      // skip (hold) / advance
      if (Input.isDown('cancel')) { oc.skipHold += 1000 / 60; if (oc.skipHold > 650) return this._endOpenCredits(); }
      else oc.skipHold = 0;
      if (Input.justPressed('confirm')) { /* nudge, but song drives timing */ }
      const ended = (oc.audio && oc.audio.ended) || now >= CREDITS_END_SEC;
      if (ended) this._endOpenCredits();
    },

    _endOpenCredits() {
      if (this.oc && this.oc.audio) { try { this.oc.audio.pause(); } catch (e) {} }
      this.oc = null;
      this.mode = 'explore';
      this.fadeAlpha = 1; this.fadeTarget = 0; this.fadeSpeed = 0.03; this._fadeInQueued = true;
      this.locTimer = 200;
      this.toast = { text: 'Maple Street', timer: 200 };
      Sound.playMusic('village');
      this.save();
    },

    // ====================================================================
    // Event interpreter (cutscenes / dialogue / puzzles)
    // ====================================================================
    runScript(id, obj) { const fn = DATA.SCRIPTS[id]; if (!fn) return; this.run(fn(this._ctx(), obj)); },
    run(events) { this.ev = { list: (events || []).slice(), idx: 0, waiting: null }; this.mode = 'cutscene'; this._step(); },
    simpleMessage(text, who) { this.run([{ say: who || null, text }]); },

    _step() {
      const ev = this.ev; if (!ev) return;
      if (ev.idx >= ev.list.length) { this._endCutscene(); return; }
      const e = ev.list[ev.idx++];
      if ('say' in e) { Dialogue.start(e.text, e.say, e.say ? (DATA.SPEAKER_PORTRAITS[e.say] || null) : null); ev.waiting = 'dialogue'; return; }
      if (e.narrate) { this.narration = { lines: e.narrate, t: 0 }; if (V()) V().speak(e.narrate.join('. '), 'Narrator'); ev.waiting = 'narrate'; return; }
      if (e.setFlag) { this.state.flags[e.setFlag] = e.value; World.refreshEntities(); return this._step(); }
      if (e.give) { this.addItem(e.give, e.n || 1); Sound.sfx('item'); return this._step(); }
      if (e.take) { this.removeItem(e.take, e.n || 1); return this._step(); }
      if (e.sfx) { Sound.sfx(e.sfx); return this._step(); }
      if (e.flash) { this.flash = { color: e.flash, t: 0, dur: e.dur || 400 }; return this._step(); }
      if (e.shake) { this.shake = e.shake; this._shakeT = e.dur || 500; return this._step(); }
      if (e.choice) {
        const prompt = e.choice;
        this.choiceMenu = new Menu({
          title: null, x: 12, y: 92, w: GFX.W - 24, rowH: 14,
          items: e.options.map((o, i) => ({ label: o.label, value: i })),
          onSelect: (it) => { const opt = e.options[it.value]; this.choiceMenu = null; ev.waiting = null; ev.list.splice(ev.idx, 0, ...(opt.events || [])); this._step(); }
        });
        this._choicePrompt = prompt; this._choiceWho = e.who || null;
        ev.waiting = 'choice'; return;
      }
      if (e.goto) { const evs = DATA.SCRIPTS[e.goto] ? DATA.SCRIPTS[e.goto](this._ctx()) : []; ev.list.splice(ev.idx, 0, ...evs); return this._step(); }
      if (e.fade) { this.fadeTarget = e.fade === 'out' ? 1 : 0; if (e.dur === 0) { this.fadeAlpha = this.fadeTarget; return this._step(); } this.fadeSpeed = e.dur ? (1 / (e.dur / 16.7)) : 0.08; ev.waiting = 'fade'; return; }
      if (e.ending) { const evs = DATA.SCRIPTS.ending(this._ctx()); ev.list.splice(ev.idx, 0, ...evs); return this._step(); }
      if (e.credits) { this.startCredits(); return; }
      return this._step();
    },
    _endCutscene() { this.ev = null; World.refreshEntities(); this.mode = 'explore'; },

    startCredits() {
      this.mode = 'credits';
      this.credits = { y: GFX.H + 10, lines: [
        'ANONYMOUS AGONY II', "Clara's Revenge", '', 'THE END', '',
        'A grounded story about', 'surviving, and refusing the blame.', '',
        'duugu, gab & taki', 'every single role', '',
        'In memory of every Haze', 'who refused to look away.', '',
        'Press Z to return to the title.'
      ] };
      Sound.playMusic('victory');
    },

    // ====================================================================
    // Pause menu (key items / save / quit)
    // ====================================================================
    openMenu() { this.mode = 'menu'; this.pause = { screen: 'main' }; this._buildPauseMain(); },
    _buildPauseMain() {
      this.pause.menu = new Menu({
        title: 'Menu', x: 84, y: 36, w: 92, rowH: 14,
        items: [{ label: 'Items', value: 'items' }, { label: 'Save', value: 'save' }, { label: 'Quit to Title', value: 'title' }],
        onSelect: (it) => {
          if (it.value === 'items') { this.pause.screen = 'items'; this._buildItems(); }
          else if (it.value === 'save') { this.toast = { text: this.save() ? 'Saved.' : 'Save failed.', timer: 90 }; }
          else if (it.value === 'title') { this.fadeOutThen(() => this.showTitle()); }
        },
        onCancel: () => { this.mode = 'explore'; this.pause = null; }
      });
    },
    _buildItems() {
      const keys = Object.keys(this.state.items);
      const items = keys.map(k => ({ label: DATA.ITEMS[k] ? DATA.ITEMS[k].name : k, value: k }));
      if (!items.length) items.push({ label: '(no items yet)', value: '__none', disabled: true });
      items.push({ label: '< Back', value: '__back' });
      this.pause.itemsMenu = new Menu({
        title: 'Items', x: 24, y: 30, w: 150, rowH: 13, items,
        onSelect: (it) => { if (it.value === '__back') this.pause.screen = 'main'; },
        onCancel: () => { this.pause.screen = 'main'; },
        onMove: (it) => { this.pause.desc = DATA.ITEMS[it.value] ? DATA.ITEMS[it.value].desc : ''; }
      });
      this.pause.desc = items[0] && DATA.ITEMS[items[0].value] ? DATA.ITEMS[items[0].value].desc : '';
    },

    // ====================================================================
    // Update
    // ====================================================================
    update() {
      this.frame++;
      if (this.toast) { this.toast.timer--; if (this.toast.timer <= 0) this.toast = null; }
      if (this.locTimer > 0) this.locTimer--;
      if (this.flash) { this.flash.t += 16.7; if (this.flash.t >= this.flash.dur) this.flash = null; }
      if (this.shake > 0) { this._shakeT -= 16.7; if (this._shakeT <= 0) this.shake = 0; }
      this._animFadeBase();
      switch (this.mode) {
        case 'title': this.titleMenu.update(); break;
        case 'cinematic': Cinematic.update(1000 / 60); break;
        case 'opencredits': this._updateOpenCredits(); break;
        case 'explore': this._updateExplore(); break;
        case 'transition': this._updateTransition(); break;
        case 'cutscene': this._updateCutscene(); break;
        case 'menu': this._updatePause(); break;
        case 'credits': this._updateCredits(); break;
      }
    },

    _animFadeBase() {
      if (this.transition && this.transition.phase === 'custom') {
        this.fadeAlpha = Math.min(1, this.fadeAlpha + this.fadeSpeed);
        if (this.fadeAlpha >= 1) { const cb = this.transition.cb, nf = this.transition.noFadeIn; this.transition = null; this.fadeAlpha = 1; cb(); if (!nf) { this.fadeTarget = 0; this.fadeSpeed = 0.08; this._fadeInQueued = true; } }
      } else if (this._fadeInQueued) {
        this.fadeAlpha = Math.max(0, this.fadeAlpha - this.fadeSpeed);
        if (this.fadeAlpha <= 0) { this.fadeAlpha = 0; this._fadeInQueued = false; }
      }
    },

    _updateExplore() {
      // rare distant knock indoors, for dread
      if (World.map && World.map.indoor) { this._ambT = (this._ambT || 700) - 1; if (this._ambT <= 0) { this._ambT = 800 + (Math.random() * 1000 | 0); Sound.sfx('knock'); } }
      World.update(true);
      if (this.mode !== 'explore') return;
      if (Input.justPressed('confirm')) {
        const act = World.interactInFront();
        if (act) { Sound.sfx('confirm'); if (act.kind === 'npc') this.runScript(act.npc.script); else this.runScript(act.obj.look, act.obj); }
      } else if (Input.justPressed('cancel')) { Sound.sfx('confirm'); this.openMenu(); }
    },

    _updateTransition() {
      const t = this.transition; if (!t) { this.mode = 'explore'; return; }
      if (t.phase === 'out') { this.fadeAlpha = Math.min(1, this.fadeAlpha + this.fadeSpeed); if (this.fadeAlpha >= 1) { World.loadMap(t.exit.to, t.exit.tx, t.exit.ty, t.exit.dir); this.locTimer = 150; this.save(); t.phase = 'in'; } }
      else { this.fadeAlpha = Math.max(0, this.fadeAlpha - this.fadeSpeed); if (this.fadeAlpha <= 0) { this.fadeAlpha = 0; this.transition = null; this.mode = 'explore'; } }
    },

    _updateCutscene() {
      const ev = this.ev; if (!ev) { this.mode = 'explore'; return; }
      if (ev.waiting === 'dialogue') { Dialogue.update(); if (!Dialogue.isActive()) { ev.waiting = null; this._step(); } }
      else if (ev.waiting === 'narrate') { if (this.narration) this.narration.t++; if (Input.justPressed('confirm') || Input.justPressed('cancel')) { Sound.sfx('cursor'); if (V()) V().stop(); this.narration = null; ev.waiting = null; this._step(); } }
      else if (ev.waiting === 'choice') { if (this.choiceMenu) this.choiceMenu.update(); }
      else if (ev.waiting === 'fade') { if (this.fadeTarget > this.fadeAlpha) this.fadeAlpha = Math.min(this.fadeTarget, this.fadeAlpha + this.fadeSpeed); else this.fadeAlpha = Math.max(this.fadeTarget, this.fadeAlpha - this.fadeSpeed); if (Math.abs(this.fadeAlpha - this.fadeTarget) < 0.02) { this.fadeAlpha = this.fadeTarget; ev.waiting = null; this._step(); } }
    },

    _updatePause() {
      const p = this.pause;
      if (p.screen === 'main') p.menu.update();
      else if (p.screen === 'items') p.itemsMenu.update();
    },

    _updateCredits() {
      this.credits.y -= 0.35;
      if (this.credits.y + this.credits.lines.length * 12 < 0 || Input.justPressed('confirm') || Input.justPressed('cancel')) this.fadeOutThen(() => this.showTitle());
    },

    // ====================================================================
    // Render
    // ====================================================================
    render() {
      GFX.beginFrame();
      const sh = this.shake > 0 ? this.shake : 0;
      const ctx = GFX.ctx; let didShake = false;
      if (sh && (this.mode === 'explore' || this.mode === 'cutscene')) { ctx.save(); ctx.translate((Math.random() * 2 - 1) * sh, (Math.random() * 2 - 1) * sh); didShake = true; }

      switch (this.mode) {
        case 'title': this._renderTitle(); break;
        case 'cinematic': Cinematic.render(); break;
        case 'opencredits': this._renderOpenCredits(); break;
        case 'credits': this._renderCredits(); break;
        default:
          World.render();
          if (this.mode === 'explore' || this.mode === 'cutscene' || this.mode === 'menu') GFX.edge(this.frame, World.map && World.map.indoor ? 1.05 : 0.85);
          this._renderHud(); this._drawFade();
          if (this.mode === 'cutscene') { if (this.narration) this._renderNarration(); else if (this.ev && this.ev.waiting === 'choice') this._renderChoice(); else Dialogue.render(); }
          else if (this.mode === 'menu') this._renderPause();
          break;
      }
      if (didShake) ctx.restore();
      if (this.flash) { ctx.save(); ctx.globalAlpha = (1 - this.flash.t / this.flash.dur); ctx.fillStyle = this.flash.color; ctx.fillRect(0, 0, GFX.W, GFX.H); ctx.restore(); }
      if (this.toast && this.mode !== 'title' && this.mode !== 'opencredits') { const w = GFX.textWidth(this.toast.text, 9) + 18; GFX.box((GFX.W - w) / 2, 6, w, 18); GFX.text(this.toast.text, GFX.W / 2, 11, { color: '#f0e0a0', size: 9, align: 'center' }); }
      if (Sound.muted) GFX.text('MUTE', GFX.W - 28, 2, { color: '#888', size: 7 });
      if (this.mode === 'title' || this.mode === 'credits') this._drawFade();
    },

    _drawFade() { if (this.fadeAlpha > 0) { GFX.ctx.save(); GFX.ctx.globalAlpha = this.fadeAlpha; GFX.rect(0, 0, GFX.W, GFX.H, '#000'); GFX.ctx.restore(); } },

    _renderHud() {
      if (this.mode !== 'explore') return;
      if (this.locTimer > 0 && World.map && World.map.name && World.map.name !== '...') {
        GFX.ctx.save(); GFX.ctx.globalAlpha = Math.min(1, this.locTimer / 30);
        const name = World.map.name, w = GFX.textWidth(name, 9) + 18;
        GFX.box((GFX.W - w) / 2, 8, w, 18); GFX.text(name, GFX.W / 2, 13, { color: '#f0e0c0', size: 9, align: 'center' });
        GFX.ctx.restore();
      }
    },

    _renderNarration() {
      const ctx = GFX.ctx;
      ctx.fillStyle = '#05050a'; ctx.fillRect(0, 0, GFX.W, GFX.H);
      const lines = this.narration.lines, a = Math.min(1, this.narration.t / 26);
      ctx.globalAlpha = a; const lh = 15; let y = (GFX.H - lines.length * lh) / 2;
      lines.forEach(l => { const big = l.startsWith('ANON') || l.startsWith("Clara'") || l.startsWith('—'); GFX.text(l, GFX.W / 2, y, { color: big ? '#e8d8c0' : '#cfcbc2', size: big ? 12 : 9, weight: big ? '700' : '500', align: 'center' }); y += lh; });
      ctx.globalAlpha = 1;
      if (this.narration.t > 26 && this.frame % 60 < 30) GFX.text('▼  (Z)', GFX.W / 2, GFX.H - 16, { color: 'rgba(180,180,190,0.7)', size: 8, align: 'center' });
    },

    _renderChoice() {
      Dialogue.render && null;
      if (this._choicePrompt) { GFX.box(8, 64, GFX.W - 16, 22); GFX.text(this._choicePrompt, GFX.W / 2, 71, { color: '#eef0f8', size: 9, align: 'center' }); }
      if (this.choiceMenu) this.choiceMenu.render();
    },

    _renderPause() {
      const p = this.pause;
      if (p.screen === 'main') p.menu.render();
      else if (p.screen === 'items') { p.itemsMenu.render(); if (p.desc) { GFX.box(24, GFX.H - 28, GFX.W - 48, 20); GFX.text(p.desc, 30, GFX.H - 22, { color: '#cfd0e0', size: 8 }); } }
    },

    _renderTitle() {
      const ctx = GFX.ctx;
      ctx.fillStyle = ctx.createLinearGradient ? this._titleGrad() : '#140a0e'; ctx.fillRect(0, 0, GFX.W, GFX.H);
      for (let i = 0; i < 24; i++) { const t = this.frame * 0.5 + i * 53; const x = (i * 41 + Math.sin(t * 0.02) * 18) % GFX.W; const y = GFX.H - ((t * 0.5 + i * 30) % (GFX.H + 20)); ctx.save(); ctx.globalAlpha = 0.4 + 0.4 * Math.sin(t * 0.05); ctx.fillStyle = i % 3 ? '#7a2018' : '#c8501a'; ctx.beginPath(); ctx.arc(x, y, 0.9, 0, 7); ctx.fill(); ctx.restore(); }
      GFX.drawChar((GFX.W / 2) - 8, 150, DATA.CHARS.clara, 'down', 0, {});
      GFX.text('ANONYMOUS AGONY II', GFX.W / 2, 42, { color: '#d8c0b0', size: 16, align: 'center', shadowColor: '#3a1010' });
      GFX.text("Clara's Revenge", GFX.W / 2, 70, { color: '#c83a3a', size: 13, align: 'center', shadowColor: '#200' });
      GFX.edge(this.frame, 0.95);
      this.titleMenu.render();
      GFX.text('Z: select   M: mute   V: voice', GFX.W / 2, GFX.H - 12, { color: '#6a5a5a', size: 8, align: 'center' });
    },
    _titleGrad() { const g = GFX.ctx.createLinearGradient(0, 0, 0, GFX.H); g.addColorStop(0, '#1a0e12'); g.addColorStop(1, '#050306'); return g; },

    _renderCredits() {
      GFX.clear('#06040a');
      this.credits.lines.forEach((l, i) => { const y = this.credits.y + i * 12; if (y > -12 && y < GFX.H + 12) { const big = i < 2 || l === 'duugu & gab'; GFX.text(l, GFX.W / 2, y, { color: big ? '#d8c0b0' : '#9a90a0', size: big ? 12 : 9, align: 'center' }); } });
    },

    // ---- anime-OP helpers ----
    _ocChar(cx, feetY, key, scale, rot, dir, frame, walking, alpha) {
      const ctx = GFX.ctx; ctx.save(); if (alpha != null) ctx.globalAlpha = alpha;
      ctx.translate(cx, feetY); if (rot) ctx.rotate(rot);
      GFX.drawChar(-8 * scale, -16 * scale, DATA.CHARS[key] || DATA.CHARS.clara, dir || 'down', frame || 0, { scale: scale, walking: !!walking });
      ctx.restore();
    },
    _speedLines(cx, cy, t, color, n, inner, outer, alpha) {
      const ctx = GFX.ctx; ctx.save(); ctx.globalAlpha = alpha == null ? 0.5 : alpha; ctx.strokeStyle = color;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + (i % 2 ? t * 0.15 : -t * 0.12);
        const c = Math.cos(a), s = Math.sin(a), r0 = inner + (i % 3) * 7;
        ctx.lineWidth = (i % 4 === 0) ? 2.4 : 1; ctx.beginPath();
        ctx.moveTo(cx + c * r0, cy + s * r0); ctx.lineTo(cx + c * outer, cy + s * outer); ctx.stroke();
      }
      ctx.restore();
    },
    _ocStripes(col, now, alpha) {
      const ctx = GFX.ctx, W = GFX.W, H = GFX.H; ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = col;
      ctx.translate(W / 2, H / 2); ctx.rotate(-0.55); const off = (now * 60) % 36;
      for (let x = -W; x < W; x += 36) ctx.fillRect(x + off, -H, 16, H * 2);
      ctx.restore();
    },

    // ---- anime-style opening credits, cut to the song ----
    _renderOpenCredits() {
      const ctx = GFX.ctx, W = GFX.W, H = GFX.H, oc = this.oc;
      const now = (oc.audio && oc.audio.currentTime) ? oc.audio.currentTime : (oc.t / 1000);
      const frac = Math.min(1, now / CREDITS_END_SEC);
      const intensity = 0.2 + frac * 0.8;
      // pulse driven by the real song (bass) when available, else a steady beat
      let level = 0;
      if (oc.analyser && oc.freq) { oc.analyser.getByteFrequencyData(oc.freq); let s = 0; for (let i = 0; i < 6; i++) s += oc.freq[i]; level = (s / 6) / 255; }
      const pulse = Math.max(level, (0.5 + 0.5 * Math.sin(now * 8.5)) * 0.5);

      const SH = [
        { f: 0.00, t: 'eye' },
        { f: 0.11, t: 'char', c: 'clara', n: 'CLARA', col: '#244a30', dir: 'right' },
        { f: 0.22, t: 'char', c: 'haze', n: 'HAZE', col: '#222230', dir: 'left' },
        { f: 0.33, t: 'char', c: 'samson', n: 'SAMSON', col: '#2a3450', dir: 'down' },
        { f: 0.44, t: 'char', c: 'tung', n: '???', col: '#6a0e16', dir: 'down' },
        { f: 0.56, t: 'run', c: 'clara' },
        { f: 0.68, t: 'montage' },
        { f: 0.80, t: 'faceoff' },
        { f: 0.90, t: 'title' }
      ];
      let si = 0; for (let i = 0; i < SH.length; i++) if (frac >= SH[i].f) si = i;
      const shot = SH[si], f0 = shot.f, f1 = (SH[si + 1] ? SH[si + 1].f : 1.0);
      const local = (frac - f0) / Math.max(0.001, (f1 - f0));
      const ease = local < 0.5 ? 2 * local * local : 1 - Math.pow(-2 * local + 2, 2) / 2;

      ctx.fillStyle = '#05030a'; ctx.fillRect(0, 0, W, H);

      // global shake to the beat
      ctx.save();
      const amt = (1.2 + 3.5 * intensity) * pulse;
      ctx.translate((Math.random() * 2 - 1) * amt, (Math.random() * 2 - 1) * amt * 0.7);

      if (shot.t === 'eye') {
        const open = Math.min(1, local * 1.7);
        const cx = W / 2, cy = H * 0.46, ew = 50, eh = Math.max(1, 28 * open);
        ctx.fillStyle = '#e9e6df'; ctx.beginPath(); ctx.ellipse(cx, cy, ew, eh, 0, 0, 7); ctx.fill();
        GFX.circle(cx, cy, Math.min(eh, 16), '#7a1414'); GFX.circle(cx, cy, Math.min(eh, 16) * 0.5, '#140608');
        GFX.circle(cx - 5, cy - 5, 3, 'rgba(255,255,255,0.85)');
        ctx.fillStyle = '#05030a'; ctx.fillRect(cx - ew, cy - 30, ew * 2, (1 - open) * 30); ctx.fillRect(cx - ew, cy + open * 28, ew * 2, 30);
        this._speedLines(cx, cy, now, 'rgba(180,30,40,0.4)', 28, 60, 200, 0.3 * open);
        GFX.text('ANONYMOUS AGONY II', W / 2, H - 40, { color: 'rgba(220,200,190,' + open + ')', size: 12, align: 'center', shadowColor: '#400' });
      } else if (shot.t === 'char') {
        const red = shot.c === 'tung';
        ctx.fillStyle = ctx.createLinearGradient(0, 0, 0, H); const g = ctx.fillStyle;
        g.addColorStop(0, red ? '#2a0608' : '#0c0c16'); g.addColorStop(1, '#05030a'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        this._ocStripes(shot.col, now, 0.5);
        const fx = W * 0.5 + (shot.dir === 'left' ? 40 : -40);
        this._speedLines(fx, H * 0.5, now, red ? 'rgba(220,30,40,0.5)' : 'rgba(230,230,240,0.35)', 30, 50, 260, 0.4 + 0.3 * pulse);
        const fromX = shot.dir === 'left' ? W + 60 : -60;
        const cx = fromX + (W * 0.5 - fromX) * ease;
        const scale = 6.2 + pulse * 1.2;
        if (red) { for (let i = 0; i < 5; i++) { const y = Math.random() * H; ctx.save(); ctx.globalAlpha = 0.3; ctx.fillStyle = i % 2 ? '#c81020' : '#10c0b0'; ctx.fillRect(0, y, W, 2 + Math.random() * 6); ctx.restore(); } }
        this._ocChar(cx, H - 18, shot.c, scale, Math.sin(now * 3) * 0.03, shot.dir, now * 6, false, 1);
        // name slam from the opposite side
        const nx = (shot.dir === 'left' ? -40 : W + 40); const tx = (-40 + (W * 0.5 - (-40)) * ease);
        ctx.save(); ctx.translate(W * 0.5, H * 0.3); ctx.rotate(-0.06);
        GFX.rect(-90, 8, 180 * Math.min(1, ease * 1.4), 4, red ? '#c81020' : '#e8d0b0');
        GFX.text(shot.n, 0, -12, { color: red ? '#ff5a5a' : '#f4ead6', size: 22, align: 'center', weight: '700', shadowColor: '#000' });
        ctx.restore();
      } else if (shot.t === 'run') {
        for (let L = 0; L < 3; L++) { const sp = (L + 1) * 90, off = (now * sp) % 48; ctx.save(); ctx.globalAlpha = 0.12 + L * 0.06; ctx.fillStyle = ['#101826', '#161024', '#1a0e14'][L]; for (let x = -48; x < W; x += 48) ctx.fillRect(x + (48 - off), 20 + L * 50, 30, 30); ctx.restore(); }
        this._speedLines(W * 0.5, H * 0.5, now, 'rgba(230,230,240,0.3)', 20, 40, 240, 0.3);
        ctx.save(); ctx.globalAlpha = 0.25; for (let i = 0; i < 14; i++) { const y = (i * 17) % H; ctx.fillStyle = '#cfd6e6'; ctx.fillRect(((now * 220 + i * 60) % (W + 40)) - 40, y, 22, 1.5); } ctx.restore();
        const bob = Math.abs(Math.sin(now * 9)) * -4;
        this._ocChar(W * 0.5 + Math.sin(now * 1.5) * 24, H - 24 + bob, 'clara', 6, 0.05, 'right', now * 12, true, 1);
      } else if (shot.t === 'montage') {
        const cuts = ['clara', 'haze', 'samson', 'tung'];
        const sub = Math.floor(local * 8); const c = cuts[sub % cuts.length];
        const cols = ['#3a1020', '#102030', '#0e2a1e', '#2a0a0a'];
        ctx.fillStyle = cols[sub % cols.length]; ctx.fillRect(0, 0, W, H);
        this._ocStripes('#000', now, 0.25);
        this._speedLines(W * 0.5, H * 0.5, now, c === 'tung' ? 'rgba(220,30,40,0.6)' : 'rgba(240,240,255,0.5)', 34, 30, 280, 0.6);
        this._ocChar(W * 0.5, H - 16, c, 6.5 + pulse, (sub % 2 ? 0.08 : -0.08), c === 'tung' ? 'down' : (sub % 2 ? 'left' : 'right'), now * 8, false, 1);
        // hard cut flash each sub-beat
        if ((local * 8) % 1 < 0.18) { ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
      } else if (shot.t === 'faceoff') {
        ctx.fillStyle = '#0a1020'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W * 0.62, 0); ctx.lineTo(W * 0.38, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#2a0608'; ctx.beginPath(); ctx.moveTo(W, 0); ctx.lineTo(W * 0.62, 0); ctx.lineTo(W * 0.38, H); ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
        // lightning seam
        ctx.save(); ctx.strokeStyle = 'rgba(255,240,180,' + (0.5 + 0.5 * pulse) + ')'; ctx.lineWidth = 1.5 + 2 * pulse; ctx.beginPath(); let yy = 0, xx = W * 0.5; ctx.moveTo(xx, 0); while (yy < H) { yy += 14; xx = W * 0.5 + (Math.random() * 2 - 1) * 16; ctx.lineTo(xx, yy); } ctx.stroke(); ctx.restore();
        this._ocChar(W * 0.27, H - 16, 'clara', 6, 0.05, 'right', now * 6, false, 1);
        this._ocChar(W * 0.73, H - 16, 'tung', 6.4, -0.05, 'down', now * 6, false, 1);
      } else if (shot.t === 'title') {
        const fl = Math.max(0, 1 - local * 3); ctx.fillStyle = 'rgba(255,255,255,' + fl + ')'; ctx.fillRect(0, 0, W, H);
        const grd = ctx.createRadialGradient(W / 2, H * 0.7, 10, W / 2, H * 0.7, W * 0.7); grd.addColorStop(0, '#2a0810'); grd.addColorStop(1, '#05030a'); ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
        for (let i = 0; i < 26; i++) { const t = now * 30 + i * 53; const x = (i * 41) % W, y = H - ((t + i * 30) % (H + 20)); ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = i % 3 ? '#7a2018' : '#c8501a'; ctx.beginPath(); ctx.arc(x, y, 1, 0, 7); ctx.fill(); ctx.restore(); }
        this._ocChar(W * 0.5, H - 12, 'clara', 4.5, 0, 'down', 0, false, 0.9);
        const ts = 1 + Math.max(0, (1 - ease)) * 0.55;
        ctx.save(); ctx.translate(W / 2, H * 0.34); ctx.scale(ts, ts);
        GFX.text('ANONYMOUS AGONY II', 0, -16, { color: '#e8d0c0', size: 16, align: 'center', weight: '700', shadowColor: '#400' });
        GFX.text("CLARA'S REVENGE", 0, 4, { color: '#e01f2c', size: 15, align: 'center', weight: '700', shadowColor: '#200' });
        ctx.restore();
        GFX.text('DUUGU · GAB · TAKI', W / 2, H - 30, { color: '#f0e6d0', size: 13, align: 'center', weight: '700', shadowColor: '#500' });
      }

      ctx.restore(); // shake

      // hard cut flash at every shot boundary
      if (local < 0.06) { ctx.save(); ctx.globalAlpha = 0.85 * (1 - local / 0.06); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
      // beat-driven red flash
      if (pulse > 0.62) { ctx.save(); ctx.globalAlpha = 0.14 * pulse; ctx.fillStyle = '#c81020'; ctx.fillRect(0, 0, W, H); ctx.restore(); }

      GFX.edge(this.frame, 0.7 + intensity * 0.55);

      // rolling role cards (lower third) — except during the title drop
      if (shot.t !== 'title') {
        const cardEvery = 3.2; const ri = Math.floor(now / cardEvery) % oc.roles.length;
        const cl = (now % cardEvery) / cardEvery; const ca = Math.min(1, (1 - Math.abs(cl - 0.5) * 2) * 2.4);
        ctx.save(); ctx.globalAlpha = ca;
        GFX.box(W / 2 - 96, H - 44, 192, 30, { alpha: 0.5 });
        GFX.text(oc.roles[ri], W / 2, H - 40, { color: '#bfc0cc', size: 9, align: 'center', weight: '700' });
        GFX.text('DUUGU · GAB · TAKI', W / 2, H - 28, { color: '#f0e6d0', size: 12, align: 'center', weight: '700', shadowColor: '#500' });
        ctx.restore();
      }

      // attribution + skip
      GFX.text("♪  'Down With the Sickness' — Disturbed", W / 2, H - 12, { color: 'rgba(210,210,220,' + (0.45 + 0.3 * pulse) + ')', size: 8, align: 'center' });
      GFX.text('Hold X / Esc to skip', W - 6, 4, { color: 'rgba(200,200,210,0.5)', size: 7, align: 'right' });
      if (oc.skipHold > 0) GFX.rect(0, H - 2, W * Math.min(1, oc.skipHold / 650), 2, '#d44');
      if (!oc.audio || oc.audio.error) GFX.text('(add ' + CREDITS_SONG_SRC + ')', 6, 4, { color: 'rgba(180,120,120,0.6)', size: 7 });
    }
  };

  global.Game = Game;
})(typeof window !== 'undefined' ? window : globalThis);
