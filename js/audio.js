/* ============================================================================
 * audio.js — cinematic ambient soundscape (Web Audio), no external assets.
 * Soft pads + sparse piano-ish tones through a synthesized reverb, plus SFX.
 * ==========================================================================*/
(function (global) {
  'use strict';

  const NOTE = {};
  (function () {
    const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    for (let oct = 1; oct <= 6; oct++) for (let i = 0; i < 12; i++) {
      const f = 440 * Math.pow(2, (oct * 12 + i - 57) / 12);
      NOTE[names[i] + oct] = f; if (names[i].includes('#')) NOTE[names[i].replace('#', 's') + oct] = f;
    }
  })();
  const ch = (arr) => arr.map(n => NOTE[n]);

  // Ambient tracks: slow chord pads + optional sparse piano lead.
  // chordDur in seconds. lead: [{n, at(beats within bar), dur}]
  const SONGS = {
    title: {
      chordDur: 4.5, cutoff: 1100, pad: 'sine',
      prog: [ch(['A2', 'C3', 'E3']), ch(['F2', 'A2', 'C3']), ch(['D2', 'F2', 'A2']), ch(['E2', 'G2', 'B2'])],
      lead: [[{ n: 'E4', at: 0.1, d: 1.2 }, { n: 'A4', at: 1.4, d: 1.4 }], [{ n: 'C4', at: 0.2, d: 1.6 }], [{ n: 'D4', at: 0.1, d: 1.2 }, { n: 'F4', at: 1.6, d: 1.4 }], [{ n: 'B3', at: 0.4, d: 2.0 }]]
    },
    village: { // Maple Street — quiet, sad
      chordDur: 5, cutoff: 900, pad: 'sine',
      prog: [ch(['A2', 'C3', 'E3']), ch(['G2', 'B2', 'D3']), ch(['F2', 'A2', 'C3']), ch(['E2', 'G2', 'B2'])],
      lead: [[{ n: 'C4', at: 0.5, d: 2.2 }], [], [{ n: 'A3', at: 0.6, d: 2.4 }], [{ n: 'E3', at: 0.8, d: 2.6 }]]
    },
    woods: { // night streets — tense, hollow
      chordDur: 4, cutoff: 700, pad: 'triangle',
      prog: [ch(['A1', 'A2', 'B2']), ch(['A1', 'A2', 'F2']), ch(['G1', 'G2', 'A2']), ch(['A1', 'A2', 'E2'])],
      lead: [[], [{ n: 'D4', at: 1.5, d: 1.0 }], [], [{ n: 'C4', at: 1.0, d: 1.2 }]]
    },
    town: { // Cedar Hollow / hospital — cold, clinical
      chordDur: 4.5, cutoff: 1300, pad: 'sine',
      prog: [ch(['C3', 'E3', 'G3']), ch(['A2', 'C3', 'E3']), ch(['D3', 'F3', 'A3']), ch(['G2', 'B2', 'D3'])],
      lead: [[{ n: 'G4', at: 0.4, d: 1.5 }], [{ n: 'E4', at: 0.6, d: 1.6 }], [{ n: 'A4', at: 0.3, d: 1.4 }], [{ n: 'D4', at: 0.8, d: 1.8 }]]
    },
    house: { // inside the house — hushed, wrong
      chordDur: 5, cutoff: 800, pad: 'sine',
      prog: [ch(['A2', 'C3', 'E3']), ch(['A2', 'C3', 'F3']), ch(['G2', 'B2', 'E3']), ch(['A2', 'C3', 'E3'])],
      lead: [[{ n: 'C4', at: 0.6, d: 2.4 }], [], [{ n: 'B3', at: 0.7, d: 2.2 }], []]
    },
    room: { // the childhood room — sparse, held breath
      chordDur: 4, cutoff: 700, pad: 'sine',
      prog: [ch(['D2', 'A2', 'E3']), ch(['D2', 'A2', 'F3']), ch(['C2', 'G2', 'E3']), ch(['D2', 'A2', 'D3'])],
      lead: [[{ n: 'A3', at: 0.8, d: 2.0 }], [], [{ n: 'F3', at: 0.6, d: 2.2 }], []]
    },
    keep: { // (legacy) dread
      chordDur: 3.5, cutoff: 600, pad: 'sawtooth',
      prog: [ch(['A1', 'Bb1', 'E2']), ch(['A1', 'A2', 'Eb2']), ch(['G1', 'Ab1', 'D2']), ch(['A1', 'Bb1', 'F2'])],
      lead: [[], [{ n: 'Bb3', at: 1.0, d: 1.4 }], [], [{ n: 'A3', at: 0.5, d: 1.8 }]]
    },
    battle: { // tense, pulsing (not chiptune)
      chordDur: 2.2, cutoff: 1400, pad: 'triangle',
      prog: [ch(['E2', 'B2', 'E3']), ch(['A2', 'E3', 'A3']), ch(['F2', 'C3', 'F3']), ch(['G2', 'D3', 'G3'])],
      lead: [[{ n: 'E4', at: 0.0, d: 0.5 }, { n: 'B4', at: 1.0, d: 0.6 }], [{ n: 'A4', at: 0.0, d: 0.5 }], [{ n: 'C5', at: 0.0, d: 0.5 }, { n: 'A4', at: 1.1, d: 0.5 }], [{ n: 'B4', at: 0.0, d: 0.7 }]]
    },
    boss: { // dissonant, heavy
      chordDur: 2.0, cutoff: 1200, pad: 'sawtooth',
      prog: [ch(['D2', 'A2', 'Eb3']), ch(['D2', 'Bb2', 'E3']), ch(['C2', 'G2', 'Db3']), ch(['D2', 'A2', 'F3'])],
      lead: [[{ n: 'D4', at: 0.0, d: 0.5 }, { n: 'Eb4', at: 1.0, d: 0.5 }], [{ n: 'Bb3', at: 0.0, d: 0.6 }], [{ n: 'Db4', at: 0.0, d: 0.5 }], [{ n: 'A3', at: 0.0, d: 0.8 }]]
    },
    victory: {
      chordDur: 3.5, cutoff: 1600, pad: 'sine', once: true,
      prog: [ch(['C3', 'E3', 'G3']), ch(['G2', 'C3', 'E3'])],
      lead: [[{ n: 'C5', at: 0.0, d: 0.4 }, { n: 'E5', at: 0.5, d: 0.4 }, { n: 'G5', at: 1.0, d: 1.2 }], [{ n: 'C5', at: 0.0, d: 2.0 }]]
    }
  };

  const Sound = {
    ctx: null, master: null, musicBus: null, reverb: null, muted: false, started: false,
    current: null, _timer: null, _idx: 0,

    init() {
      if (this.ctx) return;
      const AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.85;
      this.master.connect(this.ctx.destination);
      // reverb
      this.reverb = this.ctx.createConvolver();
      this.reverb.buffer = this._impulse(2.2, 2.4);
      const revGain = this.ctx.createGain(); revGain.gain.value = 0.55;
      this.reverb.connect(revGain); revGain.connect(this.master);
      this._revIn = this.reverb;
      // music bus
      this.musicBus = this.ctx.createGain(); this.musicBus.gain.value = 0.9;
      this.musicBus.connect(this.master); this.musicBus.connect(this.reverb);
    },

    _impulse(dur, decay) {
      const rate = this.ctx.sampleRate, len = rate * dur;
      const buf = this.ctx.createBuffer(2, len, rate);
      for (let c = 0; c < 2; c++) {
        const d = buf.getChannelData(c);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
      return buf;
    },

    resume() { this.init(); if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); this.started = true; },
    toggleMute() { this.muted = !this.muted; if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.85, this.ctx.currentTime, 0.03); return this.muted; },

    playMusic(name) {
      if (!this.ctx) { this.current = name; return; }
      if (this.current === name && this._timer) return;
      this.stopMusic();
      if (!SONGS[name]) return;
      this.current = name; this._idx = 0;
      this._loop();
    },
    stopMusic() { this.current = null; if (this._timer) { clearTimeout(this._timer); this._timer = null; } },

    _loop() {
      const song = SONGS[this.current]; if (!song) return;
      const name = this.current;
      const t = this.ctx.currentTime + 0.06;
      const i = this._idx % song.prog.length;
      this._pad(song.prog[i], t, song.chordDur, song.pad, song.cutoff);
      const lead = (song.lead && song.lead[i]) || [];
      lead.forEach(ev => this._piano(NOTE[ev.n], t + ev.at, ev.d));
      this._idx++;
      if (song.once && this._idx >= song.prog.length) { this._timer = null; return; }
      this._timer = setTimeout(() => { if (this.current === name) this._loop(); }, song.chordDur * 1000);
    },

    // soft evolving pad (chord)
    _pad(freqs, start, dur, wave, cutoff) {
      const ctx = this.ctx;
      const filt = ctx.createBiquadFilter(); filt.type = 'lowpass';
      filt.frequency.setValueAtTime((cutoff || 900) * 0.6, start);
      filt.frequency.linearRampToValueAtTime(cutoff || 900, start + dur * 0.4);
      filt.frequency.linearRampToValueAtTime((cutoff || 900) * 0.7, start + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.16, start + dur * 0.35);
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      filt.connect(g); g.connect(this.musicBus);
      freqs.forEach(f => {
        if (!f) return;
        [0, 1].forEach(k => {
          const o = ctx.createOscillator();
          o.type = wave || 'sine';
          o.frequency.value = f * (k ? 1.005 : 0.997);
          o.connect(filt); o.start(start); o.stop(start + dur + 0.1);
        });
      });
    },

    // sparse piano-ish tone (fast attack, medium decay)
    _piano(freq, start, dur) {
      if (!freq) return;
      const ctx = this.ctx;
      const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle'; o2.type = 'sine';
      o.frequency.value = freq; o2.frequency.value = freq * 2;
      const g2 = ctx.createGain(); g2.gain.value = 0.25; o2.connect(g2); g2.connect(g);
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.2, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      o.connect(g); g.connect(this.musicBus); g.connect(this.reverb);
      o.start(start); o.stop(start + dur + 0.1); o2.start(start); o2.stop(start + dur + 0.1);
    },

    // ---- SFX (soft, non-chiptune) ----
    sfx(type) {
      if (!this.ctx) return;
      const ctx = this.ctx, now = ctx.currentTime;
      const tone = (freq, dur, wave, vol, slideTo, rev) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = wave || 'sine'; o.frequency.setValueAtTime(freq, now);
        if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, now + dur);
        g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(vol || 0.16, now + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
        o.connect(g); g.connect(this.master); if (rev) g.connect(this.reverb);
        o.start(now); o.stop(now + dur + 0.02);
      };
      const noise = (dur, vol, cutoff) => {
        const n = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
        const src = ctx.createBufferSource(); src.buffer = buf;
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff || 1800;
        const g = ctx.createGain(); g.gain.value = vol || 0.18;
        src.connect(f); f.connect(g); g.connect(this.master); src.start(now);
      };
      switch (type) {
        case 'cursor': tone(620, 0.06, 'sine', 0.10); break;
        case 'confirm': tone(540, 0.08, 'sine', 0.12); tone(760, 0.1, 'sine', 0.09, null, true); break;
        case 'cancel': tone(300, 0.1, 'sine', 0.10, 200); break;
        case 'select': tone(700, 0.06, 'sine', 0.1); break;
        case 'hit': noise(0.16, 0.22, 1400); tone(150, 0.12, 'sine', 0.14, 70); break;
        case 'crit': noise(0.22, 0.28, 2200); tone(110, 0.2, 'triangle', 0.16, 55, true); break;
        case 'enemyhit': tone(240, 0.1, 'sine', 0.12, 120); noise(0.1, 0.12, 1200); break;
        case 'heal': tone(523, 0.12, 'sine', 0.13, null, true); tone(784, 0.16, 'sine', 0.1, null, true); break;
        case 'magic': tone(880, 0.1, 'sine', 0.1, 1400, true); tone(660, 0.14, 'triangle', 0.09, null, true); break;
        case 'item': tone(660, 0.08, 'triangle', 0.11); tone(880, 0.1, 'triangle', 0.09, null, true); break;
        case 'levelup': [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'sine', 0.13, null, true), i * 90)); break;
        case 'flee': tone(420, 0.08, 'sine', 0.1, 820); tone(520, 0.08, 'sine', 0.1, 920); break;
        case 'door': tone(180, 0.18, 'sine', 0.12, 120, true); break;
        case 'defeat': tone(300, 0.3, 'triangle', 0.14, 90, true); tone(200, 0.5, 'sine', 0.12, 70, true); break;
        case 'encounter': tone(740, 0.08, 'sine', 0.12); tone(520, 0.1, 'sine', 0.12); tone(330, 0.18, 'triangle', 0.12, null, true); break;
        case 'gold': tone(940, 0.06, 'sine', 0.1); tone(1280, 0.09, 'sine', 0.08, null, true); break;
        case 'knock': tone(150, 0.16, 'sine', 0.2, 90, true); noise(0.06, 0.1, 600); break; // the sahur drum
        default: break;
      }
    }
  };

  global.Sound = Sound;
})(typeof window !== 'undefined' ? window : globalThis);
