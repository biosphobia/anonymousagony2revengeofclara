/* ============================================================================
 * audio.js — tiny WebAudio chiptune engine (music + SFX), zero assets.
 * ==========================================================================*/
(function (global) {
  'use strict';

  // Note name -> frequency (Hz)
  const NOTE = {};
  (function buildNotes() {
    const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    for (let oct = 1; oct <= 6; oct++) {
      for (let i = 0; i < 12; i++) {
        const f = 440 * Math.pow(2, (oct * 12 + i - 57) / 12);
        NOTE[names[i] + oct] = f;
        if (names[i].includes('#')) NOTE[names[i].replace('#', 's') + oct] = f;
      }
    }
    NOTE['-'] = 0; // rest
  })();

  // Songs: { bpm, loop:[ {ch:'square'|'triangle'|'saw', vol, seq:[ [note, beats], ... ] }, ... ] }
  // Two channels: lead + bass. Beats are in quarter notes.
  const SONGS = {
    title: {
      bpm: 84,
      tracks: [
        { wave: 'triangle', vol: 0.18, seq: [
          ['A3',2],['C4',2],['E4',2],['A4',2],['G4',2],['E4',2],['D4',4],
          ['F3',2],['A3',2],['C4',2],['F4',2],['E4',2],['C4',2],['A3',4]
        ]},
        { wave: 'sine', vol: 0.16, seq: [
          ['A2',4],['A2',4],['F2',4],['F2',4],['D2',4],['D2',4],['E2',4],['E2',4]
        ]}
      ]
    },
    village: {
      bpm: 92,
      tracks: [
        { wave: 'triangle', vol: 0.15, seq: [
          ['E4',1],['G4',1],['A4',2],['G4',1],['E4',1],['D4',2],
          ['C4',1],['E4',1],['G4',2],['A4',1],['G4',1],['E4',2],
          ['E4',1],['G4',1],['A4',2],['B4',1],['A4',1],['G4',2],
          ['A4',2],['G4',1],['E4',1],['D4',2],['C4',2]
        ]},
        { wave: 'sine', vol: 0.14, seq: [
          ['A2',2],['E2',2],['A2',2],['E2',2],['F2',2],['C2',2],['G2',2],['E2',2],
          ['A2',2],['E2',2],['A2',2],['E2',2],['D2',2],['A2',2],['C3',2],['E2',2]
        ]}
      ]
    },
    woods: {
      bpm: 76,
      tracks: [
        { wave: 'triangle', vol: 0.14, seq: [
          ['D4',2],['F4',2],['A4',2],['G4',1],['F4',1],['E4',4],
          ['C4',2],['E4',2],['G4',2],['F4',1],['E4',1],['D4',4],
          ['A3',2],['D4',2],['F4',2],['A4',2],['G4',2],['F4',2],['E4',4]
        ]},
        { wave: 'sine', vol: 0.13, seq: [
          ['D2',4],['A2',4],['F2',4],['C2',4],['D2',4],['A2',4],['G2',4],['A2',4]
        ]}
      ]
    },
    town: {
      bpm: 108,
      tracks: [
        { wave: 'square', vol: 0.10, seq: [
          ['C4',1],['E4',1],['G4',1],['E4',1],['F4',1],['A4',1],['G4',2],
          ['D4',1],['F4',1],['A4',1],['F4',1],['G4',1],['B4',1],['C5',2],
          ['C5',1],['B4',1],['A4',1],['G4',1],['F4',1],['E4',1],['D4',2],
          ['C4',1],['E4',1],['G4',1],['C5',1],['G4',2],['E4',2]
        ]},
        { wave: 'sine', vol: 0.14, seq: [
          ['C2',2],['G2',2],['F2',2],['C2',2],['G2',2],['D2',2],['G2',2],['G2',2],
          ['C2',2],['G2',2],['A2',2],['F2',2],['C3',2],['G2',2],['C2',4]
        ]}
      ]
    },
    keep: {
      bpm: 96,
      tracks: [
        { wave: 'square', vol: 0.10, seq: [
          ['A3',2],['A3',1],['Bb3',1],['A3',2],['G3',1],['F3',1],['E3',4],
          ['F3',2],['F3',1],['G3',1],['F3',2],['E3',1],['D3',1],['C3',4],
          ['A3',1],['C4',1],['E4',1],['F4',1],['E4',2],['C4',2],['A3',4]
        ]},
        { wave: 'saw', vol: 0.10, seq: [
          ['A1',2],['A1',2],['F1',2],['F1',2],['E1',2],['E1',2],['A1',4],
          ['A1',2],['A1',2],['Bb1',2],['Bb1',2],['A1',4]
        ]}
      ]
    },
    battle: {
      bpm: 138,
      tracks: [
        { wave: 'square', vol: 0.10, seq: [
          ['E4',1],['E4',1],['E5',2],['D5',1],['C5',1],['B4',2],
          ['A4',1],['B4',1],['C5',1],['D5',1],['E5',2],['E4',2],
          ['F4',1],['F4',1],['F5',2],['E5',1],['D5',1],['C5',2],
          ['B4',1],['C5',1],['D5',1],['B4',1],['A4',2],['A4',2]
        ]},
        { wave: 'saw', vol: 0.11, seq: [
          ['E2',1],['E2',1],['E2',1],['E2',1],['A2',1],['A2',1],['A2',1],['A2',1],
          ['F2',1],['F2',1],['F2',1],['F2',1],['G2',1],['G2',1],['B2',1],['B2',1]
        ]}
      ]
    },
    boss: {
      bpm: 150,
      tracks: [
        { wave: 'square', vol: 0.11, seq: [
          ['D4',1],['D4',1],['D5',1],['C5',1],['Bb4',1],['A4',1],['G4',2],
          ['A4',1],['Bb4',1],['A4',1],['G4',1],['F4',2],['D4',2],
          ['D4',1],['F4',1],['A4',1],['D5',1],['C5',1],['A4',1],['Bb4',2],
          ['A4',1],['G4',1],['F4',1],['E4',1],['D4',4]
        ]},
        { wave: 'saw', vol: 0.12, seq: [
          ['D2',1],['D2',1],['D2',1],['A2',1],['Bb1',1],['Bb1',1],['Bb1',1],['F2',1],
          ['G1',1],['G1',1],['G1',1],['D2',1],['A1',1],['A1',1],['A1',1],['A1',1]
        ]}
      ]
    },
    victory: {
      bpm: 132, once: true,
      tracks: [
        { wave: 'square', vol: 0.13, seq: [
          ['C5',1],['C5',1],['C5',1],['C5',2],['G4',2],['A4',1],['C5',1],['G4',2],['C5',4]
        ]},
        { wave: 'sine', vol: 0.13, seq: [
          ['C3',1],['C3',1],['C3',1],['C3',2],['E2',2],['F2',1],['A2',1],['G2',2],['C3',4]
        ]}
      ]
    }
  };

  const Sound = {
    ctx: null,
    master: null,
    musicGain: null,
    muted: false,
    started: false,
    current: null,
    _timer: null,

    init() {
      if (this.ctx) return;
      const AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.9;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 1;
      this.musicGain.connect(this.master);
    },

    // Must be called after a user gesture.
    resume() {
      this.init();
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      this.started = true;
    },

    toggleMute() {
      this.muted = !this.muted;
      if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.9, this.ctx.currentTime, 0.02);
      return this.muted;
    },

    // ---- Music ----
    playMusic(name) {
      if (!this.ctx) { this.current = name; return; }
      if (this.current === name && this._timer) return;
      this.stopMusic();
      const song = SONGS[name];
      if (!song) return;
      this.current = name;
      this._scheduleSong(song);
    },

    stopMusic() {
      this.current = null;
      if (this._timer) { clearTimeout(this._timer); this._timer = null; }
      if (this._voices) { this._voices.forEach(v => { try { v.stop(); } catch (e) {} }); this._voices = []; }
    },

    _scheduleSong(song) {
      const ctx = this.ctx;
      const beat = 60 / song.bpm;
      const songName = this.current;
      const playOnce = (startTime) => {
        let maxEnd = 0;
        this._voices = this._voices || [];
        song.tracks.forEach(tr => {
          let t = startTime;
          tr.seq.forEach(([n, beats]) => {
            const dur = beats * beat;
            const freq = NOTE[n] || 0;
            if (freq > 0) this._note(tr.wave, freq, t, dur * 0.92, tr.vol);
            t += dur;
          });
          maxEnd = Math.max(maxEnd, t - startTime);
        });
        return maxEnd;
      };
      const loopFn = () => {
        if (this.current !== songName) return;
        const len = playOnce(ctx.currentTime + 0.05);
        if (song.once) { this._timer = null; return; }
        this._timer = setTimeout(loopFn, len * 1000);
      };
      loopFn();
    },

    _note(wave, freq, start, dur, vol) {
      const ctx = this.ctx;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = wave === 'saw' ? 'sawtooth' : wave;
      osc.frequency.value = freq;
      const v = (vol || 0.1);
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(v, start + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      osc.connect(g); g.connect(this.musicGain);
      osc.start(start); osc.stop(start + dur + 0.02);
    },

    // ---- SFX ----
    sfx(type) {
      if (!this.ctx) return;
      const ctx = this.ctx, now = ctx.currentTime;
      const beep = (freq, dur, wave, vol, slideTo) => {
        const osc = ctx.createOscillator(), g = ctx.createGain();
        osc.type = wave || 'square';
        osc.frequency.setValueAtTime(freq, now);
        if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, now + dur);
        g.gain.setValueAtTime(vol || 0.18, now);
        g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
        osc.connect(g); g.connect(this.master);
        osc.start(now); osc.stop(now + dur + 0.02);
      };
      const noise = (dur, vol) => {
        const n = Math.floor(ctx.sampleRate * dur);
        const buf = ctx.createBuffer(1, n, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
        const src = ctx.createBufferSource(); src.buffer = buf;
        const g = ctx.createGain(); g.gain.value = vol || 0.2;
        src.connect(g); g.connect(this.master); src.start(now);
      };
      switch (type) {
        case 'cursor':  beep(520, 0.05, 'square', 0.12); break;
        case 'confirm': beep(440, 0.06, 'square', 0.14); beep(660, 0.08, 'square', 0.12); break;
        case 'cancel':  beep(330, 0.08, 'square', 0.12, 180); break;
        case 'select':  beep(700, 0.05, 'square', 0.12); break;
        case 'hit':     noise(0.12, 0.22); beep(180, 0.1, 'square', 0.12, 80); break;
        case 'crit':    noise(0.18, 0.28); beep(140, 0.16, 'sawtooth', 0.16, 60); break;
        case 'enemyhit':beep(260, 0.08, 'square', 0.12, 120); noise(0.08, 0.14); break;
        case 'heal':    beep(523, 0.09, 'sine', 0.14); beep(784, 0.12, 'sine', 0.12); break;
        case 'magic':   beep(880, 0.06, 'sine', 0.12, 1320); beep(660, 0.1, 'triangle', 0.1); break;
        case 'item':    beep(660, 0.06, 'triangle', 0.12); beep(880, 0.08, 'triangle', 0.1); break;
        case 'levelup': beep(523,0.1,'square',0.14);beep(659,0.1,'square',0.14);beep(784,0.1,'square',0.14);beep(1046,0.2,'square',0.14); break;
        case 'flee':    beep(400,0.06,'square',0.1,800); beep(500,0.06,'square',0.1,900); break;
        case 'door':    beep(200,0.12,'sine',0.12,140); break;
        case 'defeat':  beep(330,0.2,'sawtooth',0.14,110); beep(220,0.4,'sawtooth',0.12,80); break;
        case 'encounter': beep(880,0.05,'square',0.14); beep(660,0.05,'square',0.14); beep(440,0.12,'square',0.14); break;
        case 'gold':    beep(988,0.05,'square',0.1); beep(1318,0.07,'square',0.1); break;
        default: break;
      }
    }
  };

  global.Sound = Sound;
})(typeof window !== 'undefined' ? window : globalThis);
