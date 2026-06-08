/* ============================================================================
 * dialogue.js — message box (typewriter) + reusable selectable Menu.
 * ==========================================================================*/
(function (global) {
  'use strict';

  const GFX = global.GFX, Input = global.Input, Sound = global.Sound;

  // ---------------------------------------------------------------------------
  // Message box with typewriter + pagination
  // ---------------------------------------------------------------------------
  const Dialogue = {
    active: false,
    who: null,
    pages: [],
    page: 0,
    revealed: 0,
    total: 0,
    blink: 0,
    speed: 1.6,

    start(text, who) {
      this.active = true;
      this.who = who || null;
      const maxW = GFX.W - 28;
      const lines = GFX.wrap(String(text), maxW, 8);
      this.pages = [];
      for (let i = 0; i < lines.length; i += 3) this.pages.push(lines.slice(i, i + 3));
      if (this.pages.length === 0) this.pages = [['']];
      this.page = 0;
      this._initPage();
    },

    _initPage() {
      this.revealed = 0;
      this.total = this.pages[this.page].join('\n').length;
      this.blink = 0;
    },

    isActive() { return this.active; },

    update() {
      if (!this.active) return;
      const typing = this.revealed < this.total;
      if (typing) {
        this.revealed = Math.min(this.total, this.revealed + this.speed);
        if (Input.justPressed('confirm') || Input.justPressed('cancel')) {
          this.revealed = this.total; // reveal all
        }
      } else {
        this.blink = (this.blink + 1) % 60;
        if (Input.justPressed('confirm') || Input.justPressed('cancel')) {
          Sound.sfx('cursor');
          if (this.page < this.pages.length - 1) { this.page++; this._initPage(); }
          else { this.active = false; }
        }
      }
    },

    render() {
      if (!this.active) return;
      const x = 6, w = GFX.W - 12, h = 50, y = GFX.H - h - 6;
      GFX.box(x, y, w, h);
      if (this.who) {
        const nw = GFX.textWidth(this.who, 8) + 8;
        GFX.box(x + 4, y - 9, nw, 13, { fill: '#1a1638' });
        GFX.text(this.who, x + 8, y - 6, { color: '#f0d890', size: 8 });
      }
      const lines = this.pages[this.page];
      let rem = Math.floor(this.revealed);
      for (let i = 0; i < lines.length; i++) {
        const full = lines[i];
        let shown;
        if (rem >= full.length + 1) { shown = full; rem -= full.length + 1; }
        else if (rem <= 0) { shown = ''; }
        else { shown = full.slice(0, rem); rem = 0; }
        GFX.text(shown, x + 8, y + 8 + i * 12, { color: '#e8e8f0', size: 8 });
      }
      if (this.revealed >= this.total && this.blink < 30) {
        GFX.text('▼', x + w - 14, y + h - 14, { color: '#f0d890', size: 8 });
      }
    }
  };

  // ---------------------------------------------------------------------------
  // Reusable selectable menu (vertical list, optional right-aligned sublabels)
  // ---------------------------------------------------------------------------
  class Menu {
    constructor(opt) {
      this.title = opt.title || null;
      this.items = opt.items || [];
      this.x = opt.x; this.y = opt.y; this.w = opt.w || 100;
      this.rowH = opt.rowH || 12;
      this.index = opt.index || 0;
      this.onSelect = opt.onSelect || function () {};
      this.onCancel = opt.onCancel || null;
      this.onMove = opt.onMove || null;
      this.maxVisible = opt.maxVisible || this.items.length;
      this.scroll = 0;
      this.padTop = this.title ? 14 : 6;
      this.closed = false;
      this._clampScroll();
    }

    get height() {
      return this.padTop + Math.min(this.items.length, this.maxVisible) * this.rowH + 6;
    }

    _clampScroll() {
      if (this.index < this.scroll) this.scroll = this.index;
      if (this.index >= this.scroll + this.maxVisible) this.scroll = this.index - this.maxVisible + 1;
    }

    move(d) {
      const n = this.items.length;
      let i = this.index;
      for (let k = 0; k < n; k++) {
        i = (i + d + n) % n;
        if (!this.items[i].disabled) break;
      }
      if (i !== this.index) { this.index = i; Sound.sfx('cursor'); this._clampScroll(); if (this.onMove) this.onMove(this.items[i], i); }
    }

    update() {
      if (Input.justPressed('up')) this.move(-1);
      else if (Input.justPressed('down')) this.move(1);
      if (Input.justPressed('confirm')) {
        const it = this.items[this.index];
        if (it && !it.disabled) { Sound.sfx('confirm'); this.onSelect(it, this.index); }
        else Sound.sfx('cancel');
      } else if (Input.justPressed('cancel')) {
        if (this.onCancel) { Sound.sfx('cancel'); this.onCancel(); }
      }
    }

    render() {
      const h = this.height;
      GFX.box(this.x, this.y, this.w, h);
      if (this.title) GFX.text(this.title, this.x + 6, this.y + 4, { color: '#f0d890', size: 8 });
      const start = this.scroll;
      const end = Math.min(this.items.length, start + this.maxVisible);
      for (let vi = start; vi < end; vi++) {
        const it = this.items[vi];
        const ry = this.y + this.padTop + (vi - start) * this.rowH;
        const sel = vi === this.index;
        if (sel) GFX.text('▶', this.x + 4, ry, { color: '#f0d890', size: 8 });
        const col = it.disabled ? '#6a6a7a' : (sel ? '#ffffff' : '#c8c8d8');
        GFX.text(it.label, this.x + 13, ry, { color: col, size: 8 });
        if (it.sub != null) GFX.text(String(it.sub), this.x + this.w - 7, ry, { color: it.disabled ? '#6a6a7a' : '#cfc080', size: 8, align: 'right' });
      }
      // scroll arrows
      if (this.scroll > 0) GFX.text('▲', this.x + this.w - 10, this.y + this.padTop - 1, { color: '#f0d890', size: 6 });
      if (end < this.items.length) GFX.text('▼', this.x + this.w - 10, this.y + h - 8, { color: '#f0d890', size: 6 });
    }
  }

  global.Dialogue = Dialogue;
  global.Menu = Menu;
})(typeof window !== 'undefined' ? window : globalThis);
