/* ============================================================================
 * input.js — keyboard + on-screen touch input, normalized to game buttons.
 * Buttons: up, down, left, right, confirm, cancel, menu
 * ==========================================================================*/
(function (global) {
  'use strict';

  const KEYMAP = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right',
    KeyZ: 'confirm', Enter: 'confirm', Space: 'confirm',
    KeyX: 'cancel', Escape: 'cancel', Backspace: 'cancel',
    ShiftLeft: 'run', ShiftRight: 'run'
  };

  const Input = {
    down: {},        // currently held button -> true
    pressed: {},     // edge-triggered this frame
    _queue: {},      // buttons pressed since last poll
    anyKey: false,
    onFirstInput: null,
    _firedFirst: false,

    init() {
      global.addEventListener('keydown', (e) => {
        // Mute toggle handled globally
        if (e.code === 'KeyM') { if (global.Sound) global.Sound.toggleMute(); }
        const b = KEYMAP[e.code];
        if (b) {
          e.preventDefault();
          if (!this.down[b]) this._queue[b] = true;
          this.down[b] = true;
          this._fireFirst();
        } else if (e.key && e.key.length === 1) {
          this._fireFirst();
        }
      }, { passive: false });

      global.addEventListener('keyup', (e) => {
        const b = KEYMAP[e.code];
        if (b) { e.preventDefault(); this.down[b] = false; }
      }, { passive: false });

      // lose focus -> clear
      global.addEventListener('blur', () => { this.down = {}; });

      this._bindTouch();
    },

    _fireFirst() {
      if (!this._firedFirst) {
        this._firedFirst = true;
        if (this.onFirstInput) this.onFirstInput();
      }
    },

    _bindTouch() {
      const isTouch = ('ontouchstart' in global) || (navigator && navigator.maxTouchPoints > 0);
      if (isTouch) document.body.classList.add('touch');
      const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', z: 'confirm', x: 'cancel' };
      document.querySelectorAll('[data-key]').forEach(el => {
        const b = map[el.getAttribute('data-key')];
        if (!b) return;
        const press = (e) => {
          e.preventDefault();
          if (!this.down[b]) this._queue[b] = true;
          this.down[b] = true;
          if (global.Sound) global.Sound.resume();
          this._fireFirst();
        };
        const release = (e) => { e.preventDefault(); this.down[b] = false; };
        el.addEventListener('touchstart', press, { passive: false });
        el.addEventListener('touchend', release, { passive: false });
        el.addEventListener('touchcancel', release, { passive: false });
        el.addEventListener('mousedown', press);
        el.addEventListener('mouseup', release);
        el.addEventListener('mouseleave', release);
      });
    },

    // Call once per frame to compute edge-triggered presses.
    update() {
      this.pressed = this._queue;
      this._queue = {};
    },

    isDown(b) { return !!this.down[b]; },
    justPressed(b) { return !!this.pressed[b]; },

    // Returns 'up'|'down'|'left'|'right'|null for a held direction (priority order).
    heldDir() {
      if (this.down.up) return 'up';
      if (this.down.down) return 'down';
      if (this.down.left) return 'left';
      if (this.down.right) return 'right';
      return null;
    },
    pressedDir() {
      if (this.pressed.up) return 'up';
      if (this.pressed.down) return 'down';
      if (this.pressed.left) return 'left';
      if (this.pressed.right) return 'right';
      return null;
    }
  };

  global.Input = Input;
})(typeof window !== 'undefined' ? window : globalThis);
