/* ============================================================================
 * game.js — state machine, party & leveling, save/load, event interpreter,
 *           title / pause / shop / game-over / credits, transitions.
 * ==========================================================================*/
(function (global) {
  'use strict';

  const DATA = global.DATA, GFX = global.GFX, Input = global.Input, Sound = global.Sound,
        World = global.World, Battle = global.Battle, Dialogue = global.Dialogue, Menu = global.Menu,
        Cinematic = global.Cinematic;

  const SAVE_KEY = 'aa2_clara_save_v1';
  function rint(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function statAt(base, growth, lvl) { return Math.floor(base + growth * (lvl - 1)); }

  const Game = {
    mode: 'title',
    frame: 0,
    state: null,
    fadeAlpha: 0, fadeTarget: 0, fadeSpeed: 0.08,
    transition: null,
    ev: null,
    narration: null,
    battleReturn: null,
    pause: null,
    shop: null,
    toast: null,
    locTimer: 0,
    titleMenu: null,
    gameoverMenu: null,
    credits: null,

    // -----------------------------------------------------------------
    init() {
      this.showTitle();
    },

    // -----------------------------------------------------------------
    // Party helpers
    // -----------------------------------------------------------------
    makeMember(key, level) {
      const m = { key, name: DATA.PARTY_DEFS[key].name, char: DATA.PARTY_DEFS[key].char, level, exp: 0 };
      this.recalcStats(m);
      m.hp = m.maxhp; m.mp = m.maxmp; m.alive = true; m.status = {}; m.guarding = false;
      m.hitTimer = 0; m.dieTimer = 0; m.isEnemy = false;
      return m;
    },
    recalcStats(m) {
      const d = DATA.PARTY_DEFS[m.key];
      m.maxhp = statAt(d.base.hp, d.growth.hp, m.level);
      m.maxmp = statAt(d.base.mp, d.growth.mp, m.level);
      m.atk = statAt(d.base.atk, d.growth.atk, m.level);
      m.def = statAt(d.base.def, d.growth.def, m.level);
      m.spd = statAt(d.base.spd, d.growth.spd, m.level);
      const sk = [];
      const byl = d.skillsByLevel;
      for (const lv in byl) if (m.level >= +lv) sk.push(...byl[lv]);
      m.skills = [...new Set(sk)];
    },
    partyGainExp(exp) {
      const msgs = [];
      this.state.party.forEach(m => {
        m.exp += exp;
        while (m.exp >= DATA.expForLevel(m.level)) {
          m.exp -= DATA.expForLevel(m.level);
          const oh = m.maxhp, om = m.maxmp, old = m.skills.slice();
          m.level++; this.recalcStats(m);
          m.hp += (m.maxhp - oh); m.mp += (m.maxmp - om);
          msgs.push(m.name + ' reached Lv' + m.level + '!');
          m.skills.filter(s => !old.includes(s)).forEach(s => msgs.push(m.name + ' learned ' + DATA.SKILLS[s].name + '!'));
          Sound.sfx('levelup');
        }
      });
      return msgs;
    },
    addPartyMember(key) {
      if (this.state.party.find(p => p.key === key)) return;
      const lvl = this.state.party[0] ? this.state.party[0].level : 1;
      this.state.party.push(this.makeMember(key, lvl));
    },
    healParty() {
      this.state.party.forEach(p => { p.hp = p.maxhp; p.mp = p.maxmp; p.alive = true; p.status = {}; });
    },

    // -----------------------------------------------------------------
    // Inventory / gold
    // -----------------------------------------------------------------
    addItem(id, n) { this.state.items[id] = (this.state.items[id] || 0) + (n || 1); },
    removeItem(id, n) { this.state.items[id] = Math.max(0, (this.state.items[id] || 0) - (n || 1)); if (this.state.items[id] === 0) delete this.state.items[id]; },
    hasItem(id) { return (this.state.items[id] || 0) > 0; },
    addGold(n) { this.state.gold = Math.max(0, this.state.gold + n); },

    _ctx() {
      return { flags: this.state.flags, party: this.state.party, gold: this.state.gold, hasItem: (k) => this.hasItem(k) };
    },

    // -----------------------------------------------------------------
    // New game / save / load
    // -----------------------------------------------------------------
    _newGameState() {
      this.state = {
        map: 'village',
        flags: {},
        triggersDone: { 'village:intro': true }, // the animated cinematic replaces the in-world intro
        items: { potion: 1, bandage: 2 },
        gold: 0,
        party: [this.makeMember('clara', 1)]
      };
      const m = DATA.MAPS.village;
      World.loadMap('village', m.start.x, m.start.y, m.start.dir);
      this.locTimer = 150;
    },

    // New game = play the long animated opening, then drop into Maple Street.
    newGame() {
      this._newGameState();
      this.startIntro();
    },

    startIntro() {
      this.mode = 'cinematic';
      this.fadeAlpha = 0;
      Cinematic.play(() => {
        this.mode = 'explore';
        this.fadeAlpha = 1; this.fadeTarget = 0; this.fadeSpeed = 0.04; this._fadeInQueued = true;
        this.locTimer = 200;
        this.toast = { text: 'Talk to Dr. Samson', timer: 220 };
        this.save();
      });
    },

    save() {
      try {
        const data = {
          ver: 1,
          map: this.state.map,
          player: { tx: World.player.tx, ty: World.player.ty, dir: World.player.dir },
          flags: this.state.flags,
          triggersDone: this.state.triggersDone,
          items: this.state.items,
          gold: this.state.gold,
          party: this.state.party.map(p => ({ key: p.key, level: p.level, exp: p.exp, hp: p.hp, mp: p.mp }))
        };
        localStorage.setItem(SAVE_KEY, JSON.stringify(data));
        return true;
      } catch (e) { return false; }
    },
    hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } },
    load() {
      let data;
      try { data = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return false; }
      if (!data) return false;
      this.state = {
        map: data.map, flags: data.flags || {}, triggersDone: data.triggersDone || {},
        items: data.items || {}, gold: data.gold || 0,
        party: (data.party || [{ key: 'clara', level: 1, exp: 0, hp: 30, mp: 10 }]).map(p => {
          const m = this.makeMember(p.key, p.level);
          m.exp = p.exp || 0; m.hp = Math.min(m.maxhp, p.hp); m.mp = Math.min(m.maxmp, p.mp);
          m.alive = m.hp > 0;
          return m;
        })
      };
      const dp = data.player || DATA.MAPS[data.map].start;
      World.loadMap(data.map, dp.tx, dp.ty, dp.dir);
      this.locTimer = 150;
      this.fadeAlpha = 0;
      this.mode = 'explore';
      return true;
    },

    // -----------------------------------------------------------------
    // Title screen
    // -----------------------------------------------------------------
    showTitle() {
      this.mode = 'title';
      this.state = null;
      Sound.playMusic('title');
      const items = [{ label: 'New Game', value: 'new' }];
      if (this.hasSave()) items.push({ label: 'Continue', value: 'continue' });
      this.titleMenu = new Menu({
        x: 88, y: 128, w: 80, rowH: 14, items,
        onSelect: (it) => {
          Sound.resume();
          if (it.value === 'new') { this.fadeOutThen(() => { this.newGame(); }, true); }
          else { this.fadeOutThen(() => { if (!this.load()) { this.newGame(); } }, true); }
        }
      });
    },

    fadeOutThen(cb, noFadeIn) {
      this.transition = { phase: 'custom', cb, noFadeIn: !!noFadeIn };
      this.fadeTarget = 1; this.fadeSpeed = 0.06;
    },

    // -----------------------------------------------------------------
    // Map warp transition
    // -----------------------------------------------------------------
    warp(exit) {
      this.transition = { phase: 'out', exit };
      this.mode = 'transition';
      this.fadeTarget = 1; this.fadeSpeed = 0.1;
    },

    // -----------------------------------------------------------------
    // Event-script interpreter (cutscenes)
    // -----------------------------------------------------------------
    runScript(id, obj) {
      const fn = DATA.SCRIPTS[id];
      if (!fn) return;
      const events = fn(this._ctx(), obj);
      this.run(events);
    },
    run(events) {
      this.ev = { list: events.slice(), idx: 0, waiting: null };
      this.mode = 'cutscene';
      this._step();
    },
    simpleMessage(text, who) { this.run([{ say: who || null, text }]); },

    _step() {
      const ev = this.ev;
      if (!ev) return;
      if (ev.idx >= ev.list.length) { this._endCutscene(); return; }
      const e = ev.list[ev.idx++];

      if ('say' in e) { Dialogue.start(e.text, e.say, e.say ? (DATA.SPEAKER_PORTRAITS[e.say] || null) : null); ev.waiting = 'dialogue'; return; }
      if (e.narrate) { this.narration = { lines: e.narrate, t: 0 }; ev.waiting = 'narrate'; return; }
      if (e.setFlag) { this.state.flags[e.setFlag] = e.value; World.refreshEntities(); return this._step(); }
      if ('gold' in e) { this.addGold(e.gold); Sound.sfx('gold'); return this._step(); }
      if (e.give) { this.addItem(e.give, e.n || 1); Sound.sfx('item'); return this._step(); }
      if (e.join) { this.addPartyMember(e.join); World.refreshEntities(); return this._step(); }
      if (e.heal) { this.healParty(); Sound.sfx('heal'); return this._step(); }
      if (e.rest) {
        this.healParty(); Sound.sfx('heal');
        Dialogue.start('Rest a while. HP and MP fully restored.', 'Night Nurse', 'innkeep');
        ev.waiting = 'dialogue'; return;
      }
      if (e.shop) { this.openShop(e.shop, () => { this.mode = 'cutscene'; this._step(); }); return; }
      if (e.battle) { this.startStoryBattle(e.battle); return; }
      if (e.fade) {
        this.fadeTarget = e.fade === 'out' ? 1 : 0;
        if (e.dur === 0) { this.fadeAlpha = this.fadeTarget; return this._step(); }
        this.fadeSpeed = e.dur ? (1 / e.dur) : 0.08;
        ev.waiting = 'fade'; return;
      }
      if (e.ending) {
        const evs = DATA.SCRIPTS.ending(this._ctx());
        ev.list.splice(ev.idx, 0, ...evs);
        return this._step();
      }
      if (e.credits) { this.startCredits(); return; }
      return this._step();
    },

    _endCutscene() {
      this.ev = null;
      World.refreshEntities();
      this.mode = 'explore';
    },

    // -----------------------------------------------------------------
    // Battles
    // -----------------------------------------------------------------
    _startBattle(group, area) {
      this.state.party.forEach(p => { p.alive = p.hp > 0; p.status = {}; p.guarding = false; p.hitTimer = 0; p.dieTimer = 0; });
      this.mode = 'battle';
      Battle.start(this.state.party, group, { area }, (res) => this.battleReturn(res));
    },
    startStoryBattle(key) {
      this.battleReturn = (res) => {
        if (res.lose) { this.gameOver(); return; }
        this.mode = 'cutscene';
        if (this.ev) this.ev.waiting = null;
        this._step();
      };
      this._startBattle([key], this.state.map);
    },
    startRandomEncounter(enc) {
      const pick = enc.table[rint(0, enc.table.length - 1)];
      const group = DATA.GROUPS[pick] ? DATA.GROUPS[pick]() : [pick];
      this.battleReturn = (res) => {
        if (res.lose) { this.gameOver(); return; }
        this.mode = 'explore';
      };
      this._startBattle(group, this.state.map);
    },

    gameOver() {
      this.mode = 'gameover';
      Sound.stopMusic();
      const items = [];
      if (this.hasSave()) items.push({ label: 'Continue (last save)', value: 'load' });
      items.push({ label: 'Return to Title', value: 'title' });
      this.gameoverMenu = new Menu({
        x: 64, y: 120, w: 128, rowH: 14, items,
        onSelect: (it) => {
          if (it.value === 'load') { this.fadeOutThen(() => { if (!this.load()) this.showTitle(); }); }
          else { this.fadeOutThen(() => this.showTitle()); }
        }
      });
      this.fadeAlpha = 0;
    },

    // -----------------------------------------------------------------
    // Shop
    // -----------------------------------------------------------------
    openShop(list, onClose) {
      this.mode = 'shop';
      this.shop = { list, onClose, desc: '' };
      this._buildShopMenu();
    },
    _buildShopMenu() {
      const list = this.shop.list;
      const items = list.map(k => ({ label: DATA.ITEMS[k].name, value: k, sub: DATA.ITEMS[k].price + 'g', item: DATA.ITEMS[k] }));
      items.push({ label: '< Leave', value: '__leave' });
      this.shop.menu = new Menu({
        title: 'Shop', x: 8, y: 40, w: 150, rowH: 13, items,
        onSelect: (it) => {
          if (it.value === '__leave') { const cb = this.shop.onClose; this.shop = null; cb(); return; }
          if (this.state.gold >= it.item.price) {
            this.addGold(-it.item.price); this.addItem(it.value, 1); Sound.sfx('gold');
            this.toast = { text: 'Bought ' + it.item.name + '.', timer: 80 };
          } else { Sound.sfx('cancel'); this.toast = { text: 'Not enough gold!', timer: 80 }; }
        },
        onCancel: () => { const cb = this.shop.onClose; this.shop = null; cb(); },
        onMove: (it) => { this.shop.desc = it.item ? it.item.desc : ''; }
      });
      this.shop.desc = items[0].item ? items[0].item.desc : '';
    },

    // -----------------------------------------------------------------
    // Pause menu
    // -----------------------------------------------------------------
    openMenu() {
      this.mode = 'menu';
      this.pause = { screen: 'main' };
      this._buildPauseMain();
    },
    _buildPauseMain() {
      this.pause.menu = new Menu({
        title: 'Menu', x: 84, y: 30, w: 92, rowH: 13,
        items: [
          { label: 'Items', value: 'items' },
          { label: 'Party', value: 'status' },
          { label: 'Save', value: 'save' },
          { label: 'Quit to Title', value: 'title' }
        ],
        onSelect: (it) => {
          if (it.value === 'items') { this.pause.screen = 'items'; this._buildItemsMenu(); }
          else if (it.value === 'status') { this.pause.screen = 'status'; }
          else if (it.value === 'save') { this.toast = { text: this.save() ? 'Game saved.' : 'Save failed.', timer: 90 }; }
          else if (it.value === 'title') { this.fadeOutThen(() => this.showTitle()); }
        },
        onCancel: () => { this.mode = 'explore'; this.pause = null; }
      });
    },
    _buildItemsMenu() {
      const inv = this.state.items;
      const keys = Object.keys(inv).filter(k => inv[k] > 0);
      const items = keys.map(k => ({ label: DATA.ITEMS[k].name, value: k, sub: 'x' + inv[k], item: DATA.ITEMS[k] }));
      if (!items.length) items.push({ label: '(no items)', value: '__none', disabled: true });
      items.push({ label: '< Back', value: '__back' });
      this.pause.itemsMenu = new Menu({
        title: 'Items', x: 24, y: 24, w: 150, rowH: 12, maxVisible: 9, items,
        onSelect: (it) => {
          if (it.value === '__back') { this.pause.screen = 'main'; return; }
          if (it.value === '__none') return;
          const kind = it.item.kind;
          if (kind === 'key') { this.toast = { text: 'A key item. Cannot use here.', timer: 80 }; return; }
          if (this.state.party.length === 1) { this._useFieldItem(it.value, this.state.party[0]); }
          else { this.pause.screen = 'itemtarget'; this.pause.pendingItem = it.value; this._buildTargetMenu(); }
        },
        onCancel: () => { this.pause.screen = 'main'; },
        onMove: (it) => { this.pause.itemDesc = it.item ? it.item.desc : ''; }
      });
      this.pause.itemDesc = items[0].item ? items[0].item.desc : '';
    },
    _buildTargetMenu() {
      const items = this.state.party.map((p, i) => ({ label: p.name + '  Lv' + p.level, value: i, sub: p.hp + '/' + p.maxhp }));
      items.push({ label: '< Back', value: -1 });
      this.pause.targetMenu = new Menu({
        title: 'Use on', x: 56, y: 50, w: 110, rowH: 13, items,
        onSelect: (it) => {
          if (it.value === -1) { this.pause.screen = 'items'; return; }
          this._useFieldItem(this.pause.pendingItem, this.state.party[it.value]);
          this.pause.screen = 'items'; this._buildItemsMenu();
        },
        onCancel: () => { this.pause.screen = 'items'; }
      });
    },
    _useFieldItem(key, member) {
      const it = DATA.ITEMS[key];
      let msg = '';
      if (it.kind === 'full') { member.hp = member.maxhp; member.mp = member.maxmp; msg = member.name + ' fully restored.'; }
      else if (it.kind === 'mp') { const b = member.mp; member.mp = Math.min(member.maxmp, member.mp + it.amount); msg = member.name + ' +' + (member.mp - b) + ' MP.'; }
      else { const b = member.hp; member.hp = Math.min(member.maxhp, member.hp + it.amount); if (it.kind === 'cure') member.status.bleed = 0; msg = member.name + ' +' + (member.hp - b) + ' HP.'; }
      if (member.hp > 0) member.alive = true;
      this.removeItem(key, 1);
      Sound.sfx(it.kind === 'mp' ? 'magic' : 'heal');
      this.toast = { text: msg, timer: 90 };
      this._buildItemsMenu();
    },

    // -----------------------------------------------------------------
    // Credits
    // -----------------------------------------------------------------
    startCredits() {
      this.mode = 'credits';
      this.credits = { y: GFX.H + 10, lines: [
        'ANONYMOUS AGONY II', "Clara's Revenge", '',
        'A retro web RPG', '',
        'Design & Code', 'Built with HTML5 Canvas', '',
        'Story', 'The hour before dawn', '',
        'Clara ................. the Survivor',
        'Haze ............ the Anonymous',
        'Dr. Samson ......... the Doctor',
        'Tralalero Tralala ..... the Shark',
        'The Hollow Herald .... the Knock',
        'Tung Tung Tung Sahur ... the Hour', '',
        'A continuation of', 'Anonymous Agony by Coded Emotion', '',
        'Thank you for playing.', '',
        'Press Z to return to the title.'
      ] };
      Sound.playMusic('victory');
    },

    // -----------------------------------------------------------------
    // Update
    // -----------------------------------------------------------------
    update() {
      this.frame++;
      if (this.toast) { this.toast.timer--; if (this.toast.timer <= 0) this.toast = null; }
      if (this.locTimer > 0) this.locTimer--;
      this._animFadeBase();

      switch (this.mode) {
        case 'title': this.titleMenu.update(); break;
        case 'cinematic': Cinematic.update(1000 / 60); break;
        case 'explore': this._updateExplore(); break;
        case 'transition': this._updateTransition(); break;
        case 'cutscene': this._updateCutscene(); break;
        case 'battle': Battle.update(); break;
        case 'menu': this._updatePause(); break;
        case 'shop': this.shop.menu.update(); break;
        case 'gameover': this.gameoverMenu.update(); break;
        case 'credits': this._updateCredits(); break;
      }
    },

    _animFadeBase() {
      // generic fade approach for title/gameover "fadeOutThen" custom transitions
      if (this.transition && this.transition.phase === 'custom') {
        this.fadeAlpha = Math.min(1, this.fadeAlpha + this.fadeSpeed);
        if (this.fadeAlpha >= 1) {
          const cb = this.transition.cb; const noFadeIn = this.transition.noFadeIn; this.transition = null;
          this.fadeAlpha = 1;
          cb();
          if (!noFadeIn) { this.fadeTarget = 0; this.fadeSpeed = 0.08; this._fadeInQueued = true; }
        }
      } else if (this._fadeInQueued) {
        this.fadeAlpha = Math.max(0, this.fadeAlpha - this.fadeSpeed);
        if (this.fadeAlpha <= 0) { this.fadeAlpha = 0; this._fadeInQueued = false; }
      }
    },

    _updateExplore() {
      World.update(true);
      if (this.mode !== 'explore') return; // World may have triggered a warp/battle/cutscene
      if (Input.justPressed('confirm')) {
        const act = World.interactInFront();
        if (act) {
          if (act.kind === 'npc') { Sound.sfx('confirm'); this.runScript(act.npc.script); }
          else if (act.kind === 'object') { this._interactObject(act.obj); }
        }
      } else if (Input.justPressed('cancel')) {
        Sound.sfx('confirm'); this.openMenu();
      }
    },
    _interactObject(obj) {
      if (obj.look === 'chest') {
        if (this.state.flags['chest_' + obj.id]) { this.simpleMessage('The chest is empty.'); }
        else { Sound.sfx('confirm'); this.runScript('chest', obj); }
      } else {
        Sound.sfx('confirm'); this.runScript(obj.look);
      }
    },

    _updateTransition() {
      const t = this.transition;
      if (!t) { this.mode = 'explore'; return; }
      if (t.phase === 'out') {
        this.fadeAlpha = Math.min(1, this.fadeAlpha + this.fadeSpeed);
        if (this.fadeAlpha >= 1) {
          World.loadMap(t.exit.to, t.exit.tx, t.exit.ty, t.exit.dir);
          this.locTimer = 150;
          this.save();
          t.phase = 'in';
        }
      } else {
        this.fadeAlpha = Math.max(0, this.fadeAlpha - this.fadeSpeed);
        if (this.fadeAlpha <= 0) { this.fadeAlpha = 0; this.transition = null; this.mode = 'explore'; }
      }
    },

    _updateCutscene() {
      const ev = this.ev;
      if (!ev) { this.mode = 'explore'; return; }
      if (ev.waiting === 'dialogue') {
        Dialogue.update();
        if (!Dialogue.isActive()) { ev.waiting = null; this._step(); }
      } else if (ev.waiting === 'narrate') {
        if (this.narration) this.narration.t++;
        if (Input.justPressed('confirm') || Input.justPressed('cancel')) {
          Sound.sfx('cursor'); this.narration = null; ev.waiting = null; this._step();
        }
      } else if (ev.waiting === 'fade') {
        if (this.fadeTarget > this.fadeAlpha) this.fadeAlpha = Math.min(this.fadeTarget, this.fadeAlpha + this.fadeSpeed);
        else this.fadeAlpha = Math.max(this.fadeTarget, this.fadeAlpha - this.fadeSpeed);
        if (Math.abs(this.fadeAlpha - this.fadeTarget) < 0.02) { this.fadeAlpha = this.fadeTarget; ev.waiting = null; this._step(); }
      }
    },

    _updatePause() {
      const p = this.pause;
      if (p.screen === 'main') p.menu.update();
      else if (p.screen === 'items') p.itemsMenu.update();
      else if (p.screen === 'itemtarget') p.targetMenu.update();
      else if (p.screen === 'status') { if (Input.justPressed('cancel') || Input.justPressed('confirm')) { Sound.sfx('cancel'); p.screen = 'main'; } }
    },

    _updateCredits() {
      this.credits.y -= 0.35;
      const end = this.credits.y + this.credits.lines.length * 12 < 0;
      if (end || Input.justPressed('confirm') || Input.justPressed('cancel')) {
        this.fadeOutThen(() => this.showTitle());
      }
    },

    // -----------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------
    render() {
      GFX.beginFrame();
      switch (this.mode) {
        case 'title': this._renderTitle(); break;
        case 'cinematic': Cinematic.render(); break;
        case 'battle': Battle.render(); break;
        case 'gameover': this._renderGameOver(); break;
        case 'credits': this._renderCredits(); break;
        default:
          World.render();
          this._renderHud();
          this._drawFade();
          if (this.mode === 'cutscene') {
            if (this.narration) this._renderNarration();
            else Dialogue.render();
          } else if (this.mode === 'menu') {
            this._renderPause();
          } else if (this.mode === 'shop') {
            this._renderShop();
          }
          break;
      }
      // toast (above most things)
      if (this.toast && this.mode !== 'title' && this.mode !== 'battle') {
        const w = GFX.textWidth(this.toast.text, 8) + 16;
        GFX.box((GFX.W - w) >> 1, 6, w, 16);
        GFX.text(this.toast.text, GFX.W >> 1, 11, { color: '#f0e0a0', size: 8, align: 'center' });
      }
      // mute indicator
      if (Sound.muted) GFX.text('MUTE', GFX.W - 26, 2, { color: '#888', size: 6 });
      // global fade for title/gameover custom transitions
      if ((this.mode === 'title' || this.mode === 'gameover' || this.mode === 'credits')) this._drawFade();
    },

    _drawFade() {
      if (this.fadeAlpha > 0) {
        GFX.ctx.globalAlpha = this.fadeAlpha;
        GFX.rect(0, 0, GFX.W, GFX.H, '#000');
        GFX.ctx.globalAlpha = 1;
      }
    },

    _renderHud() {
      if (this.mode !== 'explore') return;
      // location nameplate after entering a map
      if (this.locTimer > 0 && World.map) {
        const a = Math.min(1, this.locTimer / 30);
        GFX.ctx.globalAlpha = a;
        const name = World.map.name;
        const w = GFX.textWidth(name, 8) + 16;
        GFX.box((GFX.W - w) >> 1, 8, w, 16);
        GFX.text(name, GFX.W >> 1, 13, { color: '#f0e0c0', size: 8, align: 'center' });
        GFX.ctx.globalAlpha = 1;
      }
      // tiny gold readout bottom-left
      GFX.text('G ' + this.state.gold, 4, GFX.H - 10, { color: '#e6c84a', size: 8 });
    },

    _renderNarration() {
      const ctx = GFX.ctx;
      // deep, slightly warm black with a soft vignette
      ctx.fillStyle = '#05050a'; ctx.fillRect(0, 0, GFX.W, GFX.H);
      const vg = ctx.createRadialGradient(GFX.W / 2, GFX.H / 2, 20, GFX.W / 2, GFX.H / 2, GFX.W * 0.7);
      vg.addColorStop(0, 'rgba(30,22,30,0.5)'); vg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = vg; ctx.fillRect(0, 0, GFX.W, GFX.H);
      const lines = this.narration.lines;
      const a = Math.min(1, this.narration.t / 26);
      ctx.globalAlpha = a;
      const lh = 15;
      const totalH = lines.length * lh;
      let y = (GFX.H - totalH) / 2;
      lines.forEach(l => {
        const big = l.startsWith('—') || l.startsWith('ANON') || l.startsWith("Clara");
        GFX.text(l, GFX.W / 2, y, { color: big ? '#e8d8c0' : '#cfcbc2', size: big ? 12 : 9, weight: big ? '700' : '500', align: 'center', shadowColor: 'rgba(0,0,0,0.9)' });
        y += lh;
      });
      ctx.globalAlpha = 1;
      if (this.narration.t > 26 && this.frame % 60 < 30)
        GFX.text('▼  (Z)', GFX.W / 2, GFX.H - 16, { color: 'rgba(180,180,190,0.7)', size: 8, align: 'center' });
    },

    _renderPause() {
      const p = this.pause;
      if (p.screen === 'main') {
        p.menu.render();
        this._renderPartyMini(8, 30);
      } else if (p.screen === 'items') {
        p.itemsMenu.render();
        if (p.itemDesc) { GFX.box(24, GFX.H - 26, GFX.W - 48, 18); GFX.text(p.itemDesc, 30, GFX.H - 21, { color: '#cfd0e0', size: 8 }); }
      } else if (p.screen === 'itemtarget') {
        p.targetMenu.render();
      } else if (p.screen === 'status') {
        this._renderStatus();
      }
    },
    _renderPartyMini(x, y) {
      this.state.party.forEach((m, i) => {
        const ry = y + i * 30;
        GFX.box(x, ry, 72, 28);
        GFX.text(m.name + ' Lv' + m.level, x + 4, ry + 3, { color: '#fff', size: 8 });
        GFX.text('HP', x + 4, ry + 13, { color: '#9aa', size: 6 });
        GFX.bar(x + 18, ry + 13, 40, 3, m.hp / m.maxhp, '#3ac24a');
        GFX.text('MP', x + 4, ry + 20, { color: '#9aa', size: 6 });
        GFX.bar(x + 18, ry + 20, 40, 3, m.maxmp ? m.mp / m.maxmp : 0, '#3a7ac2');
      });
    },
    _renderStatus() {
      GFX.box(8, 8, GFX.W - 16, GFX.H - 16);
      GFX.text('PARTY', GFX.W >> 1, 12, { color: '#f0d890', size: 8, align: 'center' });
      this.state.party.forEach((m, i) => {
        const x = 16, y = 28 + i * 70;
        GFX.drawChar(x, y + 4, DATA.CHARS[m.char], 'down', 0, {});
        GFX.text(m.name + '  Lv ' + m.level, x + 24, y, { color: '#fff', size: 8 });
        GFX.text('HP ' + m.hp + '/' + m.maxhp, x + 24, y + 12, { color: '#bfe0bf', size: 8 });
        GFX.text('MP ' + m.mp + '/' + m.maxmp, x + 110, y + 12, { color: '#bfd0e0', size: 8 });
        GFX.text('ATK ' + m.atk + '   DEF ' + m.def + '   SPD ' + m.spd, x + 24, y + 24, { color: '#d8d8e4', size: 8 });
        const need = DATA.expForLevel(m.level);
        GFX.text('EXP ' + m.exp + '/' + need, x + 24, y + 36, { color: '#cfc080', size: 8 });
        GFX.text('Skills: ' + (m.skills.map(s => DATA.SKILLS[s].name).join(', ') || '—'), x + 24, y + 48, { color: '#c8b0d0', size: 8 });
      });
      GFX.text('Z/X: back', GFX.W >> 1, GFX.H - 14, { color: '#888', size: 8, align: 'center' });
    },

    _renderShop() {
      this.shop.menu.render();
      GFX.box(8, 16, 150, 16);
      GFX.text('Gold: ' + this.state.gold, 14, 21, { color: '#e6c84a', size: 8 });
      if (this.shop.desc) { GFX.box(8, GFX.H - 26, GFX.W - 16, 18); GFX.text(this.shop.desc, 14, GFX.H - 21, { color: '#cfd0e0', size: 8 }); }
    },

    _renderTitle() {
      const ctx = GFX.ctx;
      const grd = ctx.createLinearGradient(0, 0, 0, GFX.H);
      grd.addColorStop(0, '#1a0e12'); grd.addColorStop(1, '#050306');
      ctx.fillStyle = grd; ctx.fillRect(0, 0, GFX.W, GFX.H);
      // drifting embers
      for (let i = 0; i < 26; i++) {
        const t = this.frame * 0.4 + i * 53;
        const x = (i * 41 + Math.sin(t * 0.02) * 20) % GFX.W;
        const y = GFX.H - ((t * 0.6 + i * 30) % (GFX.H + 20));
        const f = (i % 3);
        ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 0.05);
        GFX.px(x, y, f === 0 ? '#c8501a' : f === 1 ? '#e6a040' : '#7a2018');
      }
      ctx.globalAlpha = 1;
      // a lone silhouette of Clara
      GFX.drawChar((GFX.W >> 1) - 8, 150, DATA.CHARS.clara, 'down', 0, {});
      // title
      GFX.text('ANONYMOUS AGONY', GFX.W >> 1, 40, { color: '#d8c0b0', size: 16, align: 'center', shadowColor: '#3a1010' });
      GFX.text('II', GFX.W >> 1, 60, { color: '#c83a3a', size: 18, align: 'center', shadowColor: '#200' });
      GFX.text("— Clara's Revenge —", GFX.W >> 1, 86, { color: '#a08070', size: 10, align: 'center' });
      this.titleMenu.render();
      GFX.text('Z/Enter: select   M: mute', GFX.W >> 1, GFX.H - 12, { color: '#6a5a5a', size: 8, align: 'center' });
    },

    _renderGameOver() {
      GFX.clear('#000');
      GFX.text('GAME OVER', GFX.W >> 1, 56, { color: '#a02020', size: 18, align: 'center', shadowColor: '#200' });
      GFX.text('The agony was not yet ended.', GFX.W >> 1, 84, { color: '#7a6a6a', size: 8, align: 'center' });
      this.gameoverMenu.render();
    },

    _renderCredits() {
      GFX.clear('#06040a');
      const lines = this.credits.lines;
      lines.forEach((l, i) => {
        const y = this.credits.y + i * 12;
        if (y > -12 && y < GFX.H + 12) {
          const big = i < 2;
          GFX.text(l, GFX.W >> 1, y, { color: big ? '#d8c0b0' : '#9a90a0', size: big ? 12 : 8, align: 'center', shadow: false });
        }
      });
    }
  };

  global.Game = Game;
})(typeof window !== 'undefined' ? window : globalThis);
