/* ============================================================================
 * dialogue.js — message box (typewriter) with character portraits + Menu.
 * ==========================================================================*/
(function (global) {
  'use strict';

  const GFX = global.GFX, Input = global.Input, Sound = global.Sound;

  const Dialogue = {
    active: false, who: null, portrait: null,
    pages: [], page: 0, revealed: 0, total: 0, blink: 0, speed: 1.6,

    start(text, who, portrait) {
      this.active = true;
      this.who = who || null;
      this.portrait = portrait || null;
      const px = this.portrait ? 50 : 8;
      const maxW = GFX.W - 22 - px;
      const lines = GFX.wrap(String(text), maxW, 9);
      this.pages = [];
      for (let i = 0; i < lines.length; i += 3) this.pages.push(lines.slice(i, i + 3));
      if (!this.pages.length) this.pages = [['']];
      this.page = 0; this._initPage();
    },

    _initPage() { this.revealed = 0; this.total = this.pages[this.page].join('\n').length; this.blink = 0; },
    isActive() { return this.active; },

    update() {
      if (!this.active) return;
      if (this.revealed < this.total) {
        this.revealed = Math.min(this.total, this.revealed + this.speed);
        if (Input.justPressed('confirm') || Input.justPressed('cancel')) this.revealed = this.total;
      } else {
        this.blink = (this.blink + 1) % 60;
        if (Input.justPressed('confirm') || Input.justPressed('cancel')) {
          Sound.sfx('cursor');
          if (this.page < this.pages.length - 1) { this.page++; this._initPage(); }
          else this.active = false;
        }
      }
    },

    render() {
      if (!this.active) return;
      const x = 6, w = GFX.W - 12, h = 54, y = GFX.H - h - 6;
      GFX.box(x, y, w, h);
      let tx = x + 10;
      if (this.portrait) {
        GFX.drawPortrait(this.portrait, x + 6, y + 7, 40, 40);
        tx = x + 54;
      }
      if (this.who) {
        const nw = GFX.textWidth(this.who, 9) + 12;
        GFX.box(x + 4, y - 10, nw, 15, { fill: '#241a44', r: 4 });
        GFX.text(this.who, x + 10, y - 7, { color: '#f4dca0', size: 9, weight: '700' });
      }
      const lines = this.pages[this.page];
      let rem = Math.floor(this.revealed);
      for (let i = 0; i < lines.length; i++) {
        const full = lines[i];
        let shown;
        if (rem >= full.length + 1) { shown = full; rem -= full.length + 1; }
        else if (rem <= 0) shown = '';
        else { shown = full.slice(0, rem); rem = 0; }
        GFX.text(shown, tx, y + 9 + i * 13, { color: '#eef0f8', size: 9 });
      }
      if (this.revealed >= this.total && this.blink < 30)
        GFX.text('▼', x + w - 15, y + h - 14, { color: '#f4dca0', size: 9 });
    }
  };

  class Menu {
    constructor(opt) {
      this.title = opt.title || null;
      this.items = opt.items || [];
      this.x = opt.x; this.y = opt.y; this.w = opt.w || 100;
      this.rowH = opt.rowH || 13;
      this.index = opt.index || 0;
      this.onSelect = opt.onSelect || function () {};
      this.onCancel = opt.onCancel || null;
      this.onMove = opt.onMove || null;
      this.maxVisible = opt.maxVisible || this.items.length;
      this.scroll = 0;
      this.padTop = this.title ? 16 : 7;
      this._clampScroll();
    }
    get height() { return this.padTop + Math.min(this.items.length, this.maxVisible) * this.rowH + 6; }
    _clampScroll() {
      if (this.index < this.scroll) this.scroll = this.index;
      if (this.index >= this.scroll + this.maxVisible) this.scroll = this.index - this.maxVisible + 1;
    }
    move(d) {
      const n = this.items.length; let i = this.index;
      for (let k = 0; k < n; k++) { i = (i + d + n) % n; if (!this.items[i].disabled) break; }
      if (i !== this.index) { this.index = i; Sound.sfx('cursor'); this._clampScroll(); if (this.onMove) this.onMove(this.items[i], i); }
    }
    update() {
      if (Input.justPressed('up')) this.move(-1);
      else if (Input.justPressed('down')) this.move(1);
      if (Input.justPressed('confirm')) {
        const it = this.items[this.index];
        if (it && !it.disabled) { Sound.sfx('confirm'); this.onSelect(it, this.index); } else Sound.sfx('cancel');
      } else if (Input.justPressed('cancel')) { if (this.onCancel) { Sound.sfx('cancel'); this.onCancel(); } }
    }
    render() {
      const h = this.height;
      GFX.box(this.x, this.y, this.w, h);
      if (this.title) GFX.text(this.title, this.x + 8, this.y + 5, { color: '#f4dca0', size: 9, weight: '700' });
      const start = this.scroll, end = Math.min(this.items.length, start + this.maxVisible);
      for (let vi = start; vi < end; vi++) {
        const it = this.items[vi];
        const ry = this.y + this.padTop + (vi - start) * this.rowH;
        const sel = vi === this.index;
        if (sel) { GFX.roundRect(this.x + 3, ry - 1, this.w - 6, this.rowH, 3, 'rgba(140,160,230,0.18)'); GFX.text('▶', this.x + 5, ry, { color: '#f4dca0', size: 8 }); }
        const col = it.disabled ? '#6a6a7a' : (sel ? '#ffffff' : '#c8c8d8');
        GFX.text(it.label, this.x + 14, ry, { color: col, size: 9 });
        if (it.sub != null) GFX.text(String(it.sub), this.x + this.w - 8, ry, { color: it.disabled ? '#6a6a7a' : '#d8c888', size: 9, align: 'right' });
      }
      if (this.scroll > 0) GFX.text('▲', this.x + this.w - 12, this.y + this.padTop - 2, { color: '#f4dca0', size: 7 });
      if (end < this.items.length) GFX.text('▼', this.x + this.w - 12, this.y + h - 9, { color: '#f4dca0', size: 7 });
    }
  }

  global.Dialogue = Dialogue;
  global.Menu = Menu;
})(typeof window !== 'undefined' ? window : globalThis);
