/* ============================================================================
 * battle.js — classic turn-based battle (command -> resolve in speed order).
 * ==========================================================================*/
(function (global) {
  'use strict';

  const DATA = global.DATA, GFX = global.GFX, Input = global.Input,
        Sound = global.Sound, Menu = global.Menu;

  function rint(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }

  const Battle = {
    active: false,

    start(partyRefs, enemyKeys, opts, onEnd) {
      this.active = true;
      this.opts = opts || {};
      this.onEnd = onEnd;
      this.party = partyRefs.filter(p => p);
      this.enemies = enemyKeys.map((k, i) => this._makeEnemy(k, i, enemyKeys.length));
      this.frame = 0;
      this.result = null;
      this.actions = [];
      this.cmdIndex = 0;
      this.menu = null;
      this.subMenu = null;
      this.targetMode = null;
      this.curMsgs = [];
      this.msgIndex = 0;
      this.msgTimer = 0;
      this.flash = null;
      this.shake = 0;
      this.queue = [];
      this.qi = 0;
      this.rewardMsgs = [];
      this._resetGuards();
      Sound.sfx('encounter');
      Sound.playMusic(this.enemies.some(e => e.boss) ? 'boss' : 'battle');
      // _setMessage sets phase = 'message'; intro flows into the command phase.
      this._setMessage([this.enemies.length > 1 ? 'Enemies block your path!' : this.enemies[0].name + ' blocks your path!'], () => this._beginCommand());
    },

    _makeEnemy(key, i, n) {
      const d = DATA.ENEMIES[key];
      const spread = 46;
      const cx = 128 + (i - (n - 1) / 2) * spread;
      return {
        key, name: d.name, hp: d.hp, maxhp: d.hp, atk: d.atk, def: d.def, spd: d.spd,
        exp: d.exp, gold: d.gold, art: d.art, boss: !!d.boss, noRun: !!d.noRun,
        skills: d.skills || [], drop: d.drop || null,
        status: {}, guarding: false, alive: true, isEnemy: true,
        x: cx, y: 92, hitTimer: 0, dieTimer: 0
      };
    },

    _resetGuards() {
      this.party.forEach(p => { p.guarding = false; });
      this.enemies.forEach(e => { e.guarding = false; });
    },

    livingParty() { return this.party.filter(p => p.alive && p.hp > 0); },
    livingEnemies() { return this.enemies.filter(e => e.alive); },

    // ---- message helper (auto-advancing log) ----
    _setMessage(msgs, after) {
      this.curMsgs = msgs.slice();
      this.msgIndex = 0;
      this.msgTimer = 0;
      this._msgAfter = after || null;
      this.phase = 'message';
    },

    _updateMessage() {
      this.msgTimer++;
      const advance = this.msgTimer > 46 || Input.justPressed('confirm') || Input.justPressed('cancel');
      if (advance) {
        Sound.sfx('cursor');
        this.msgIndex++;
        this.msgTimer = 0;
        if (this.msgIndex >= this.curMsgs.length) {
          const cb = this._msgAfter; this._msgAfter = null;
          if (cb) cb();
        }
      }
    },

    // -----------------------------------------------------------------
    // Command phase
    // -----------------------------------------------------------------
    _beginCommand() {
      this.phase = 'command';
      this.actions = [];
      this.cmdIndex = 0;
      this._resetGuards();
      this._openCommandFor(0);
    },

    _openCommandFor(idx) {
      const living = this.livingParty();
      if (idx >= living.length) { this._buildQueue(); return; }
      this.curActor = living[idx];
      const actor = this.curActor;
      const items = [
        { label: 'Attack', value: 'attack' },
        { label: 'Skill', value: 'skill', disabled: actor.skills.length === 0 },
        { label: 'Item', value: 'item', disabled: !this._hasUsableItems() },
        { label: 'Guard', value: 'guard' },
        { label: 'Run', value: 'run', disabled: this.enemies.some(e => e.noRun) }
      ];
      this.menu = new Menu({
        title: actor.name, x: 6, y: 104, w: 78, rowH: 13,
        items,
        onSelect: (it) => this._chooseCommand(it.value),
        onCancel: idx > 0 ? () => this._backCommand() : null
      });
      this.subMenu = null;
      this.targetMode = null;
    },

    _backCommand() {
      this.actions.pop();
      const living = this.livingParty();
      const cur = living.indexOf(this.curActor);
      this._openCommandFor(Math.max(0, cur - 1));
    },

    _hasUsableItems() {
      const inv = global.Game.state.items;
      return Object.keys(inv).some(k => inv[k] > 0 && DATA.ITEMS[k].kind !== 'key');
    },

    _chooseCommand(cmd) {
      const actor = this.curActor;
      if (cmd === 'attack') {
        this._pickTarget('enemy', (t) => this._queueAction({ actor, type: 'attack', target: t }));
      } else if (cmd === 'guard') {
        this._queueAction({ actor, type: 'guard' });
      } else if (cmd === 'run') {
        this._attemptRun();
      } else if (cmd === 'skill') {
        this._openSkillMenu(actor);
      } else if (cmd === 'item') {
        this._openItemMenu(actor);
      }
    },

    _openSkillMenu(actor) {
      const items = actor.skills.map(k => {
        const s = DATA.SKILLS[k];
        return { label: s.name, value: k, sub: 'MP ' + s.mp, disabled: actor.mp < s.mp, skill: s };
      });
      items.push({ label: '< Back', value: '__back' });
      this.subMenu = new Menu({
        title: 'Skill', x: 6, y: 70, w: 120, rowH: 12, items,
        onSelect: (it) => {
          if (it.value === '__back') { this.subMenu = null; return; }
          const s = it.skill;
          if (s.target === 'self') { this._queueAction({ actor, type: 'skill', skill: it.value, target: actor }); }
          else if (s.target === 'ally') { this._pickTarget('ally', (t) => this._queueAction({ actor, type: 'skill', skill: it.value, target: t })); }
          else { this._pickTarget('enemy', (t) => this._queueAction({ actor, type: 'skill', skill: it.value, target: t })); }
        },
        onCancel: () => { this.subMenu = null; },
        onMove: (it) => { this._skillDesc = it.skill ? it.skill.desc : ''; }
      });
      this._skillDesc = items[0].skill ? items[0].skill.desc : '';
    },

    _openItemMenu(actor) {
      const inv = global.Game.state.items;
      const items = Object.keys(inv)
        .filter(k => inv[k] > 0 && DATA.ITEMS[k].kind !== 'key')
        .map(k => ({ label: DATA.ITEMS[k].name, value: k, sub: 'x' + inv[k], item: DATA.ITEMS[k] }));
      items.push({ label: '< Back', value: '__back' });
      this.subMenu = new Menu({
        title: 'Item', x: 6, y: 70, w: 120, rowH: 12, items,
        onSelect: (it) => {
          if (it.value === '__back') { this.subMenu = null; return; }
          const kind = it.item.kind;
          if (kind === 'mp' || kind === 'heal' || kind === 'cure' || kind === 'full') {
            this._pickTarget('ally', (t) => this._queueAction({ actor, type: 'item', item: it.value, target: t }));
          }
        },
        onCancel: () => { this.subMenu = null; },
        onMove: (it) => { this._skillDesc = it.item ? it.item.desc : ''; }
      });
      this._skillDesc = items[0].item ? items[0].item.desc : '';
    },

    _pickTarget(side, cb) {
      const list = side === 'enemy' ? this.livingEnemies() : this.livingParty();
      this.targetMode = { side, list, index: 0, cb };
      this.phase = 'target';
    },

    _updateTarget() {
      const tm = this.targetMode;
      if (Input.justPressed('left') || Input.justPressed('up')) { tm.index = (tm.index - 1 + tm.list.length) % tm.list.length; Sound.sfx('cursor'); }
      if (Input.justPressed('right') || Input.justPressed('down')) { tm.index = (tm.index + 1) % tm.list.length; Sound.sfx('cursor'); }
      if (Input.justPressed('confirm')) {
        Sound.sfx('confirm');
        const t = tm.list[tm.index];
        this.targetMode = null;
        this.phase = 'command';
        tm.cb(t);
      } else if (Input.justPressed('cancel')) {
        Sound.sfx('cancel');
        this.targetMode = null;
        this.phase = 'command';
      }
    },

    _queueAction(action) {
      this.actions.push(action);
      this.subMenu = null;
      const living = this.livingParty();
      const cur = living.indexOf(this.curActor);
      this._openCommandFor(cur + 1);
    },

    // -----------------------------------------------------------------
    // Build & run the resolution queue
    // -----------------------------------------------------------------
    _buildQueue() {
      this.menu = null; this.subMenu = null;
      // enemy AI actions
      const enemyActions = this.livingEnemies().map(e => this._enemyChoose(e));
      const all = this.actions.concat(enemyActions);
      // apply guard immediately (affects whole round)
      all.forEach(a => { if (a.type === 'guard') a.actor.guarding = true; });
      // order by effective speed (desc), small jitter
      all.sort((a, b) => (this._spd(b.actor) + Math.random()) - (this._spd(a.actor) + Math.random()));
      this.queue = all;
      this.qi = 0;
      this._nextAction();
    },

    _enemyChoose(e) {
      // pick a skill by chance, else attack
      for (const s of e.skills) {
        const sk = DATA.SKILLS[s.skill];
        if (Math.random() < s.chance && (sk.type !== 'heal' || true)) {
          if (sk.target === 'enemy' || sk.type === 'attack' || sk.type === 'debuff') {
            const targets = this.livingParty();
            if (targets.length) return { actor: e, type: 'skill', skill: s.skill, target: this._aiTarget(targets) };
          } else if (sk.type === 'buff') {
            return { actor: e, type: 'skill', skill: s.skill, target: e };
          }
        }
      }
      const targets = this.livingParty();
      if (!targets.length) return { actor: e, type: 'guard' };
      return { actor: e, type: 'attack', target: this._aiTarget(targets) };
    },

    _aiTarget(list) {
      // 60% random, 40% the lowest-HP target
      if (Math.random() < 0.4) return list.slice().sort((a, b) => a.hp - b.hp)[0];
      return list[rint(0, list.length - 1)];
    },

    _spd(u) { return u.spd * (u.status.slow ? 0.5 : 1); },
    _atk(u) { return u.atk * (u.status.atkup ? 1.35 : 1); },
    _def(u) { return u.def * (u.status.defdown ? 0.6 : 1); },

    _nextAction() {
      // resolve any pending end states
      if (!this.livingEnemies().length) return this._victory();
      if (!this.livingParty().length) return this._defeat();

      if (this.qi >= this.queue.length) { this._endRound(); return; }
      const act = this.queue[this.qi++];
      if (!act.actor.alive || act.actor.hp <= 0) { this._nextAction(); return; }
      // target may have died — retarget
      if (act.target && (!act.target.alive || act.target.hp <= 0)) {
        if (act.type === 'attack' || (act.type === 'skill' && DATA.SKILLS[act.skill].target === 'enemy')) {
          const alt = this.livingEnemies().length && act.target.isEnemy ? this.livingEnemies() : this.livingParty();
          const pool = act.actor.isEnemy ? this.livingParty() : this.livingEnemies();
          if (!pool.length) { this._nextAction(); return; }
          act.target = pool[0];
        }
      }
      this._resolve(act);
    },

    _resolve(act) {
      const a = act.actor;
      const msgs = [];
      if (act.type === 'guard') {
        msgs.push(a.name + ' braces for impact.');
        this._setMessage(msgs, () => this._nextAction());
        return;
      }
      if (act.type === 'item') {
        const it = DATA.ITEMS[act.item];
        global.Game.removeItem(act.item, 1);
        this._applyHealItem(it, act.target, msgs, a);
        Sound.sfx('item');
        this._setMessage(msgs, () => this._nextAction());
        return;
      }
      if (act.type === 'skill') {
        const s = DATA.SKILLS[act.skill];
        a.mp = Math.max(0, a.mp - s.mp);
        if (s.type === 'heal') {
          const amt = s.power + Math.floor(this._atk(a) * 0.3);
          this._heal(act.target, amt);
          msgs.push(a.name + ' uses ' + s.name + '! ' + act.target.name + ' +' + amt + ' HP.');
          Sound.sfx('heal');
          this.flash = { target: act.target, timer: 14, kind: 'heal' };
        } else if (s.type === 'buff') {
          a.status.atkup = 3;
          msgs.push(a.name + ' uses ' + s.name + '! ATK rises.');
          Sound.sfx('magic');
          this.flash = { target: a, timer: 14, kind: 'buff' };
        } else if (s.type === 'debuff') {
          act.target.status.defdown = 3;
          msgs.push(a.name + ' uses ' + s.name + '! ' + act.target.name + "'s guard breaks.");
          Sound.sfx('magic');
          this.flash = { target: act.target, timer: 14, kind: 'debuff' };
        } else { // attack skill
          this._attackResolve(a, act.target, s.power, s, msgs, true);
        }
        this._setMessage(msgs, () => this._afterHit(act.target));
        return;
      }
      // basic attack
      this._attackResolve(a, act.target, 1.0, null, msgs, false);
      this._setMessage(msgs, () => this._afterHit(act.target));
    },

    _attackResolve(a, target, power, skill, msgs, isSkill) {
      const crit = !isSkill && Math.random() < 0.09;
      let base = this._atk(a) * power * (crit ? 1.7 : 1);
      let dmg = base - this._def(target) * 0.5;
      dmg *= 0.88 + Math.random() * 0.24;
      if (target.guarding) dmg *= 0.5;
      dmg = Math.max(1, Math.round(dmg));
      target.hp = Math.max(0, target.hp - dmg);
      target.hitTimer = 16;
      this.flash = { target, timer: 16, kind: 'hit' };
      this.shake = 6;
      const verb = isSkill ? (' uses ' + skill.name + '!') : ' attacks!';
      let line = a.name + verb + ' ' + dmg + (crit ? ' CRITICAL!' : ' damage.');
      msgs.push(line);
      Sound.sfx(target.isEnemy ? (crit ? 'crit' : 'hit') : 'enemyhit');
      if (skill && skill.status === 'bleed' && target.hp > 0) {
        target.status.bleed = 3;
        msgs.push(target.name + ' is bleeding!');
      }
    },

    _applyHealItem(it, target, msgs, user) {
      if (it.kind === 'full') {
        target.hp = target.maxhp; target.mp = target.maxmp;
        msgs.push(user.name + ' uses ' + it.name + '! ' + target.name + ' fully restored.');
        this.flash = { target, timer: 14, kind: 'heal' };
      } else if (it.kind === 'mp') {
        const before = target.mp; target.mp = Math.min(target.maxmp, target.mp + it.amount);
        msgs.push(user.name + ' uses ' + it.name + '! ' + target.name + ' +' + (target.mp - before) + ' MP.');
        this.flash = { target, timer: 14, kind: 'buff' };
      } else {
        const before = target.hp; this._heal(target, it.amount);
        if (it.kind === 'cure') target.status.bleed = 0;
        msgs.push(user.name + ' uses ' + it.name + '! ' + target.name + ' +' + (target.hp - before) + ' HP.');
        this.flash = { target, timer: 14, kind: 'heal' };
      }
    },

    _heal(target, amt) { target.hp = Math.min(target.maxhp, target.hp + amt); },

    _afterHit(target) {
      // check death of target
      if (target.hp <= 0 && target.alive) {
        target.alive = false;
        target.dieTimer = 20;
        if (target.isEnemy) {
          Sound.sfx('defeat');
          this._setMessage([target.name + ' is defeated!'], () => this._postDeath());
          return;
        } else {
          this._setMessage([target.name + ' falls!'], () => this._postDeath());
          return;
        }
      }
      this._postDeath();
    },

    _postDeath() {
      if (!this.livingEnemies().length) return this._victory();
      if (!this.livingParty().length) return this._defeat();
      this._nextAction();
    },

    _endRound() {
      // bleed damage
      const bleeders = [];
      [...this.party, ...this.enemies].forEach(u => {
        if (u.alive && u.hp > 0 && u.status.bleed) {
          const d = 6;
          u.hp = Math.max(0, u.hp - d);
          bleeders.push(u.name + ' bleeds for ' + d + '.');
          if (u.hp <= 0) { u.alive = false; bleeders.push(u.name + (u.isEnemy ? ' is defeated!' : ' falls!')); }
        }
      });
      // tick statuses
      [...this.party, ...this.enemies].forEach(u => {
        ['bleed', 'defdown', 'atkup', 'slow'].forEach(s => { if (u.status[s]) u.status[s]--; });
        u.guarding = false;
      });
      const after = () => {
        if (!this.livingEnemies().length) return this._victory();
        if (!this.livingParty().length) return this._defeat();
        this._beginCommand();
      };
      if (bleeders.length) this._setMessage(bleeders, after);
      else after();
    },

    // -----------------------------------------------------------------
    // Run / Victory / Defeat
    // -----------------------------------------------------------------
    _attemptRun() {
      this.menu = null;
      const pSpd = this.livingParty().reduce((s, p) => s + p.spd, 0) / Math.max(1, this.livingParty().length);
      const eSpd = this.livingEnemies().reduce((s, e) => s + e.spd, 0) / Math.max(1, this.livingEnemies().length);
      const chance = Math.min(0.9, Math.max(0.25, 0.5 + (pSpd - eSpd) * 0.06));
      if (Math.random() < chance) {
        Sound.sfx('flee');
        this._setMessage(['You slip away from the fight.'], () => this._finish({ fled: true }));
      } else {
        this._setMessage(["Couldn't escape!"], () => {
          // enemies take a free swing
          this.actions = [];
          this.queue = this.livingEnemies().map(e => this._enemyChoose(e));
          this.qi = 0;
          this._nextAction();
        });
      }
    },

    _victory() {
      this.phase = 'victory';
      Sound.playMusic('victory');
      let exp = 0, gold = 0;
      const drops = [];
      this.enemies.forEach(e => {
        exp += DATA.ENEMIES[e.key].exp;
        gold += DATA.ENEMIES[e.key].gold;
        if (e.drop) drops.push(e.drop);
      });
      const msgs = ['Victory!'];
      if (exp > 0) msgs.push('Gained ' + exp + ' EXP and ' + gold + ' gold.');
      global.Game.addGold(gold);
      drops.forEach(d => { global.Game.addItem(d, 1); msgs.push('Found ' + DATA.ITEMS[d].name + '!'); });
      const levelMsgs = global.Game.partyGainExp(exp);
      // revive KO'd members to 1 HP after a win
      this.party.forEach(p => { if (!p.alive || p.hp <= 0) { p.alive = true; p.hp = Math.max(1, p.hp); } p.status = {}; p.guarding = false; });
      this._setMessage(msgs.concat(levelMsgs), () => this._finish({ win: true }));
    },

    _defeat() {
      this.phase = 'defeat';
      Sound.stopMusic();
      Sound.sfx('defeat');
      this._setMessage(['Clara has fallen...', 'The agony was not yet ended.'], () => this._finish({ lose: true }));
    },

    _finish(result) {
      this.party.forEach(p => { p.status = {}; p.guarding = false; });
      this.active = false;
      Sound.stopMusic();
      if (this.onEnd) this.onEnd(result);
    },

    // -----------------------------------------------------------------
    // Update / Render
    // -----------------------------------------------------------------
    update() {
      if (!this.active) return;
      this.frame++;
      if (this.shake > 0) this.shake--;
      if (this.flash) { this.flash.timer--; if (this.flash.timer <= 0) this.flash = null; }
      this.party.forEach(p => { if (p.hitTimer) p.hitTimer--; });
      this.enemies.forEach(e => { if (e.hitTimer) e.hitTimer--; if (e.dieTimer) e.dieTimer--; });

      switch (this.phase) {
        case 'message': this._updateMessage(); break;
        case 'command':
          if (this.subMenu) this.subMenu.update();
          else if (this.menu) this.menu.update();
          break;
        case 'target': this._updateTarget(); break;
        default: break;
      }
    },

    render() {
      if (!this.active) return;
      const ctx = GFX.ctx;
      const sx = this.shake > 0 ? rint(-2, 2) : 0;
      const sy = this.shake > 0 ? rint(-1, 1) : 0;
      ctx.save();
      ctx.translate(sx, sy);

      // background
      this._drawBg();

      // enemies
      this.livingEnemies().forEach((e, i) => {
        const flashing = (this.flash && this.flash.target === e && this.flash.timer % 6 > 2) || (e.hitTimer > 0 && e.hitTimer % 4 > 1);
        if (this.targetMode && this.targetMode.side === 'enemy' && this.targetMode.list[this.targetMode.index] === e) {
          GFX.text('▼', e.x, e.y - 44 + (this.frame % 30 < 15 ? 0 : 2), { color: '#f0d890', size: 8, align: 'center' });
        }
        GFX.drawEnemy(e.art, e.x, e.y, this.frame, flashing);
      });
      // dying enemies fade
      this.enemies.filter(e => !e.alive && e.dieTimer > 0).forEach(e => {
        ctx.globalAlpha = e.dieTimer / 20;
        GFX.drawEnemy(e.art, e.x, e.y, this.frame, true);
        ctx.globalAlpha = 1;
      });

      // enemy info panel (top-right)
      this._drawEnemyInfo();

      // party status (bottom)
      this._drawPartyStatus();

      // message box (top)
      if (this.phase === 'message' || this.phase === 'victory' || this.phase === 'defeat' || this.phase === 'intro') {
        GFX.box(4, 4, GFX.W - 8, 24);
        GFX.text(this.curMsgs[this.msgIndex] || '', 12, 12, { color: '#fff', size: 8 });
        if (this.msgIndex < this.curMsgs.length - 1 && this.frame % 40 < 20)
          GFX.text('▼', GFX.W - 16, 18, { color: '#f0d890', size: 8 });
      }

      // command / sub menus
      if (this.phase === 'command' || this.phase === 'target') {
        if (this.menu) this.menu.render();
        if (this.subMenu) {
          this.subMenu.render();
          if (this._skillDesc) {
            GFX.box(4, 4, GFX.W - 8, 18);
            GFX.text(this._skillDesc, 10, 9, { color: '#cfd0e0', size: 8 });
          }
        }
        if (this.phase === 'target') {
          GFX.box(4, 4, GFX.W - 8, 18);
          GFX.text('Choose a target  (Left/Right)', 10, 9, { color: '#cfd0e0', size: 8 });
        }
      }

      ctx.restore();
    },

    _drawBg() {
      const ctx = GFX.ctx;
      const area = this.opts.area || 'woods';
      let top = '#1a2238', bot = '#0a0e18';
      if (area === 'keep') { top = '#241018'; bot = '#0a0608'; }
      else if (area === 'town') { top = '#22242e'; bot = '#0c0c12'; }
      else if (area === 'village') { top = '#241c1c'; bot = '#0c0a0a'; }
      const grd = ctx.createLinearGradient(0, 0, 0, GFX.H);
      grd.addColorStop(0, top); grd.addColorStop(1, bot);
      ctx.fillStyle = grd; ctx.fillRect(-4, -4, GFX.W + 8, GFX.H + 8);
      // ground band
      ctx.fillStyle = area === 'keep' ? '#2a1418' : '#1b2a1b';
      ctx.fillRect(-4, 104, GFX.W + 8, 50);
      ctx.fillStyle = area === 'keep' ? '#341a1e' : '#243424';
      ctx.fillRect(-4, 104, GFX.W + 8, 2);
    },

    _drawEnemyInfo() {
      const liv = this.livingEnemies();
      const x = GFX.W - 120, y = 28;
      // group identical names
      liv.forEach((e, i) => {
        const ry = y + i * 12;
        const targeted = this.targetMode && this.targetMode.side === 'enemy' && this.targetMode.list[this.targetMode.index] === e;
        GFX.text((targeted ? '▶' : ' ') + e.name, x, ry, { color: targeted ? '#fff' : '#d0c0a0', size: 8 });
        GFX.bar(x + 1, ry + 8, 112, 2, e.hp / e.maxhp, '#c83a3a', '#3a1a1a');
      });
    },

    _drawPartyStatus() {
      const n = this.party.length;
      const boxY = GFX.H - 40, boxH = 40;
      GFX.box(2, boxY, GFX.W - 4, boxH);
      const colW = (GFX.W - 8) / n;
      this.party.forEach((p, i) => {
        const x = 6 + i * colW;
        const acting = (this.phase === 'command' || this.phase === 'target') && this.curActor === p;
        const ko = !p.alive || p.hp <= 0;
        GFX.text((acting ? '▶' : '') + p.name, x, boxY + 4, { color: ko ? '#8a4a4a' : (acting ? '#fff' : '#e0e0ec'), size: 8 });
        GFX.text('Lv' + p.level, x + colW - 14, boxY + 4, { color: '#b0b0c0', size: 8 });
        GFX.text('HP', x, boxY + 16, { color: '#9aa0b0', size: 8 });
        GFX.bar(x + 16, boxY + 17, colW - 44, 4, p.hp / p.maxhp, ko ? '#6a2a2a' : '#3ac24a', '#222');
        GFX.text(p.hp + '/' + p.maxhp, x + colW - 26, boxY + 16, { color: '#c8c8d4', size: 8 });
        GFX.text('MP', x, boxY + 26, { color: '#9aa0b0', size: 8 });
        GFX.bar(x + 16, boxY + 27, colW - 44, 4, p.maxmp ? p.mp / p.maxmp : 0, '#3a7ac2', '#222');
        GFX.text(p.mp + '/' + p.maxmp, x + colW - 26, boxY + 26, { color: '#c8c8d4', size: 8 });
        // status icons
        let sx = x;
        if (p.status.bleed) { GFX.text('B', sx, boxY + 35, { color: '#c83a3a', size: 6 }); sx += 6; }
        if (p.status.atkup) { GFX.text('A+', sx, boxY + 35, { color: '#e6c84a', size: 6 }); sx += 8; }
        if (p.guarding) { GFX.text('G', sx, boxY + 35, { color: '#7a8ad0', size: 6 }); }
      });
    }
  };

  global.Battle = Battle;
})(typeof window !== 'undefined' ? window : globalThis);
