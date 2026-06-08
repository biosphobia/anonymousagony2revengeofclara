/* ============================================================================
 * voice.js — per-character TTS voice acting via the Web Speech API.
 * No assets/network: uses the browser's built-in speech voices. Each speaker
 * gets a distinct real voice when the platform has several, plus its own
 * pitch/rate so characters always sound different.  Safely no-ops where the
 * API is unavailable (e.g. Node test harness).
 * ==========================================================================*/
(function (global) {
  'use strict';

  // Per-speaker voice design. g = preferred gender pool, pitch (0-2), rate.
  const PROFILES = {
    'Narrator':              { g: 'n', pitch: 0.92, rate: 0.94 },
    'Clara':                 { g: 'f', pitch: 1.5,  rate: 1.06 },
    'Haze':                  { g: 'm', pitch: 0.82, rate: 1.0 },
    'Dr. Samson':            { g: 'm', pitch: 0.86, rate: 0.9 },
    'Mother':                { g: 'f', pitch: 1.22, rate: 1.12 },
    'Father':                { g: 'm', pitch: 0.68, rate: 0.92 },
    'Annie':                 { g: 'f', pitch: 1.12, rate: 1.0 },
    'Enny':                  { g: 'f', pitch: 1.75, rate: 1.18 },
    'Officer Craig':         { g: 'm', pitch: 1.02, rate: 1.04 },
    'Craig':                 { g: 'm', pitch: 1.02, rate: 1.04 },
    'Tung Tung Tung Sahur':  { g: 'm', pitch: 0.4,  rate: 0.86 },
    'Tralalero Tralala':     { g: 'm', pitch: 1.35, rate: 1.34 },
    'The Hollow Herald':     { g: 'm', pitch: 0.5,  rate: 0.82 },
    'Neighbor':              { g: 'f', pitch: 1.05, rate: 1.0 },
    'Kid':                   { g: 'f', pitch: 1.6,  rate: 1.12 },
    'Night Nurse':           { g: 'f', pitch: 1.08, rate: 0.98 },
    'Clerk':                 { g: 'm', pitch: 0.95, rate: 1.05 },
    'Townsfolk':             { g: 'm', pitch: 1.0,  rate: 1.0 },
    'Watchman':              { g: 'm', pitch: 0.9,  rate: 0.98 },
    '???':                   { g: 'm', pitch: 0.7,  rate: 0.95 }
  };

  const FEMALE_RE = /female|woman|zira|samantha|victoria|susan|karen|moira|tessa|fiona|amelie|female|google uk english female|catherine|serena|allison|ava|joanna|salli|kimberly|kendra/i;
  const MALE_RE = /male|man|david|daniel|alex|fred|rishi|guy|george|james|google uk english male|tom|matthew|brian|arthur|oliver/i;

  const Voice = {
    synth: null, ready: false, enabled: true, muted: false,
    fpool: [], mpool: [], npool: [], assigned: {}, _warmed: false,

    init() {
      if (typeof global.speechSynthesis === 'undefined') return;
      this.synth = global.speechSynthesis;
      this.ready = true;
      this._build();
      // voices load asynchronously in most browsers
      if (typeof this.synth.addEventListener === 'function') {
        this.synth.addEventListener('voiceschanged', () => this._build());
      } else {
        this.synth.onvoiceschanged = () => this._build();
      }
    },

    _build() {
      if (!this.synth) return;
      let voices = [];
      try { voices = this.synth.getVoices() || []; } catch (e) { voices = []; }
      if (!voices.length) return;
      const en = voices.filter(v => /^en/i.test(v.lang));
      const pool = en.length ? en : voices;
      this.fpool = pool.filter(v => FEMALE_RE.test(v.name));
      this.mpool = pool.filter(v => MALE_RE.test(v.name));
      // anything unclassified is usable for either / neutral
      this.npool = pool.filter(v => !FEMALE_RE.test(v.name) && !MALE_RE.test(v.name));
      if (!this.fpool.length) this.fpool = this.npool.length ? this.npool : pool;
      if (!this.mpool.length) this.mpool = this.npool.length ? this.npool : pool;
      // Deterministically hand each character a different real voice.
      this.assigned = {};
      let fi = 0, mi = 0, ni = 0;
      Object.keys(PROFILES).forEach(name => {
        const p = PROFILES[name];
        let v;
        if (p.g === 'f') { v = this.fpool[fi % this.fpool.length]; fi++; }
        else if (p.g === 'm') { v = this.mpool[mi % this.mpool.length]; mi++; }
        else { v = (this.npool.length ? this.npool : pool)[ni % (this.npool.length || pool.length)]; ni++; }
        this.assigned[name] = v || null;
      });
    },

    warm() {
      // unlock speech on first user gesture (some browsers require it)
      if (!this.synth || this._warmed) return;
      this._warmed = true;
      try { const u = new global.SpeechSynthesisUtterance(' '); u.volume = 0; this.synth.speak(u); } catch (e) {}
    },

    setMuted(m) { this.muted = m; if (m) this.stop(); },
    toggle() { this.enabled = !this.enabled; if (!this.enabled) this.stop(); return this.enabled; },
    isSpeaking() { return !!(this.synth && this.enabled && !this.muted && this.synth.speaking); },
    stop() { if (this.synth) { try { this.synth.cancel(); } catch (e) {} } },

    _profile(who) { return PROFILES[who] || PROFILES.Narrator; },

    // Split into speakable chunks (avoids browser long-utterance cutoffs).
    _chunks(text) {
      const sentences = String(text).split(/(?<=[.!?…])\s+/);
      const out = [];
      sentences.forEach(s => {
        s = s.trim(); if (!s) return;
        while (s.length > 180) { let cut = s.lastIndexOf(' ', 180); if (cut < 60) cut = 180; out.push(s.slice(0, cut)); s = s.slice(cut).trim(); }
        if (s) out.push(s);
      });
      return out;
    },

    _speakable(text) {
      const t = String(text).trim();
      if (!t) return false;
      if (t[0] === '(') return false;            // system/parenthetical lines
      if (/^[.\s…]+$/.test(t)) return false;     // pure "..."
      return true;
    },

    // Clean brainrot/expressive text a little for the synth.
    _clean(text) {
      return String(text).replace(/~/g, '').replace(/—/g, ', ').replace(/\s+/g, ' ').trim();
    },

    speak(text, who) {
      if (!this.ready || !this.enabled || this.muted) return;
      if (!this._speakable(text)) { this.stop(); return; }
      if (!this.fpool.length && !this.mpool.length && !this.npool.length) this._build();
      this.stop();
      const prof = this._profile(who);
      const voice = this.assigned[who] || this.assigned.Narrator || null;
      const chunks = this._chunks(this._clean(text));
      for (const c of chunks) {
        let u;
        try { u = new global.SpeechSynthesisUtterance(c); } catch (e) { return; }
        if (voice) u.voice = voice;
        u.pitch = prof.pitch; u.rate = prof.rate; u.volume = 0.95;
        try { this.synth.speak(u); } catch (e) { return; }
      }
    }
  };

  global.Voice = Voice;
})(typeof window !== 'undefined' ? window : globalThis);
