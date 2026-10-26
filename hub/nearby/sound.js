// Room only, never position (docs/shared/patents/FTO-sound-room.md). Tokens are made here, on the device.
// Nearby by sound — a short near-ultrasonic "chirp" that carries a 20-bit room token, and the decoder that hears it
// (docs/shared/NEARBY.md, "Layer 2: sound"). PROTOTYPE. Works in browsers (Web Audio) and in Node (tests): pure maths
// on Float32 samples, no recording is ever kept or sent — the decoder looks only at its 17 frequencies.
//
// Packet (0.6 s): a 120 ms marker tone, then 8 symbols × 60 ms, each one of 16 tones (4 bits): 5 symbols = the 20-bit
// token, 3 symbols = a CRC-12. Decoding is self-clocking (runs of the same tone), so speaker/mic drift doesn't matter.
// v3 (22 Oct): tones 19 313 … 20 719 Hz with the long marker at the TOP (20 813 Hz, where ears are least sensitive),
// one continuous tone that glides between notes (no volume dips, which small speakers turn into ticks), 40 ms fades
// at the two ends only, 20 % volume. (v1 at 18.5 kHz squeaked on an iPhone; an audible "chime" voice was tried and
// dropped — Jonathan: "a more annoying version".) On a MacBook these frequencies come through 36–46 dB over silence.
// Same packet on Mac/Windows later (AVAudioEngine / WASAPI).
(function (root) {
  "use strict";
  const STEP = 93.75, TONES = 16;
  const PROFILES = {
    quiet: { marker: 20812.5, base: 19312.5, step: STEP, glide: 0.004, edge: 0.04, level: 0.2 },
  };
  const freqsOf = pr => [...(pr.tones || Array.from({ length: TONES }, (_, i) => pr.base + i * pr.step)), pr.marker]; // index 16 = marker
  const MARKER_S = 0.12, SYMBOL_S = 0.06, SYMBOLS = 8;
  const FREQS = freqsOf(PROFILES.quiet);

  // CRC-12 (polynomial 0x80F) over the token's 20 bits, starting from 0x5A5 so all-zero isn't valid.
  const checksum = token => {
    let c = 0x5A5;
    for (let i = 19; i >= 0; i--) { const bit = ((token >> i) & 1) ^ (c >> 11); c = ((c << 1) & 0xFFF) ^ (bit ? 0x80F : 0) }
    return c;
  };
  const symbolsOf = token => { const c = checksum(token); return [0, 1, 2, 3, 4].map(i => (token >> (16 - i * 4)) & 15).concat(c >> 8, (c >> 4) & 15, c & 15) };
  const randomToken = () => {
    const r = (typeof crypto !== "undefined" && crypto.getRandomValues) ? crypto.getRandomValues(new Uint32Array(1))[0] : Math.floor(Math.random() * 2 ** 32);
    return r & 0xFFFFF;
  };
  const hex = token => token.toString(16).padStart(5, "0");

  /**
   * The packet as samples, ready for an AudioBuffer (`level` defaults to 0.2). The phase runs on through every note
   * and the pitch glides into the next one, so there's no click or volume dip anywhere inside the packet; only its
   * two ends fade.
   */
  function encode(token, sampleRate, level, profile = "quiet") {
    const pr = PROFILES[profile] || PROFILES.quiet, f = freqsOf(pr);
    level = level ?? pr.level;
    const parts = [[16, MARKER_S]].concat(symbolsOf(token).map(s => [s, SYMBOL_S]));
    const total = parts.reduce((t, [, d]) => t + Math.round(d * sampleRate), 0);
    const out = new Float32Array(total), edge = Math.round(pr.edge * sampleRate), glide = Math.round(pr.glide * sampleRate);
    let at = 0, phase = 0, prev = f[16];
    for (const [idx, dur] of parts) {
      const n = Math.round(dur * sampleRate), target = f[idx];
      for (let i = 0; i < n; i++) {
        const freq = i < glide ? prev + (target - prev) * (0.5 - 0.5 * Math.cos(Math.PI * i / glide)) : target;
        phase += 2 * Math.PI * freq / sampleRate;
        const t = at + i;
        let env = t < edge ? 0.5 - 0.5 * Math.cos(Math.PI * t / edge) : t > total - edge ? 0.5 - 0.5 * Math.cos(Math.PI * (total - t) / edge) : 1;
        out[t] = level * env * Math.sin(phase);
      }
      prev = target; at += n;
    }
    return out;
  }

  /**
   * Feed it microphone samples in any block size; it returns the tokens it heard (each once per packet).
   * Per 10 ms it measures the 17 tones (Goertzel over 20 ms) and keeps the strongest when it clearly stands out;
   * a marker of ≥ 70 ms starts a packet, then runs of the same tone are counted into symbols, and the CRC decides.
   */
  class Decoder {
    constructor(sampleRate, profile = "quiet") {
      this.rate = sampleRate;
      this.freqs = freqsOf(PROFILES[profile] || PROFILES.quiet);
      this.win = Math.round(0.02 * sampleRate);
      this.hop = Math.round(0.01 * sampleRate);
      this.buf = new Float32Array(this.win); this.w = 0; this.filled = 0; this.sinceHop = 0; this.t = 0; // samples seen
      this.coeff = this.freqs.map(f => 2 * Math.cos(2 * Math.PI * f / sampleRate));
      this.hann = Float32Array.from({ length: this.win }, (_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (this.win - 1)));
      this.markerFrames = 0; this.packet = null; this.frames = [];
    }
    push(samples) {
      const heard = [];
      for (let i = 0; i < samples.length; i++) {
        // Ring buffer of the last 20 ms; a look every 10 ms.
        this.buf[this.w] = samples[i]; this.w = (this.w + 1) % this.win;
        if (this.filled < this.win) this.filled++;
        this.t++;
        if (this.filled === this.win && ++this.sinceHop >= this.hop) {
          this.sinceHop = 0;
          const token = this.frame((this.t - this.win / 2) / this.rate);
          if (token != null) heard.push(token);
        }
      }
      return heard;
    }
    // One 20 ms look: which tone, if any, clearly dominates?
    frame(time) {
      const e = this.coeff.map(c => {
        let s1 = 0, s2 = 0;
        for (let i = 0, j = this.w; i < this.win; i++, j = j + 1 === this.win ? 0 : j + 1) { const s0 = this.buf[j] * this.hann[i] + c * s1 - s2; s2 = s1; s1 = s0 }
        return s1 * s1 + s2 * s2 - c * s1 * s2;
      });
      let best = 0; for (let i = 1; i < e.length; i++) if (e[i] > e[best]) best = i;
      const sorted = [...e].sort((a, b) => a - b), median = sorted[8];
      const floor = 1e-7 * this.win * this.win; // absolute floor: silence isn't a tone
      const sym = e[best] > 8 * median && e[best] > floor ? best : -1;
      return this.track(time, sym);
    }
    // Self-clocking: after the marker, collect runs of the same tone; a run's length says how many symbols it is
    // (two equal symbols in a row make one double-length run). Robust to speaker/mic timing drift; unclear frames
    // inside a run are tolerated, runs under 3 looks are dropped, and the CRC has the last word.
    track(time, sym) {
      if (sym === 16) { this.markerFrames++; if (this.markerFrames >= 7) this.packet = null; return null }
      if (this.markerFrames >= 7 && !this.packet) this.packet = { start: time, runs: [] };
      this.markerFrames = 0;
      const p = this.packet; if (!p) return null;
      if (sym >= 0) {
        const last = p.runs[p.runs.length - 1];
        if (last && last.sym === sym) { last.n++; last.end = time }
        else {
          // A new tone ends the previous run: once the finished runs hold all 8 symbols, the packet is complete,
          // so whatever sounds after it (an echo, a whistle, another chirp) can't add to it.
          if (Decoder.symbols(p.runs).length >= SYMBOLS) return this.finish(p);
          p.runs.push({ sym, n: 1, start: time, end: time });
        }
      }
      return time - p.start < (SYMBOLS + 0.6) * SYMBOL_S ? null : this.finish(p);
    }
    finish(p) {
      this.packet = null;
      const syms = Decoder.symbols(p.runs);
      // Exactly 8 — except that the last tone may ring on (echo): extra copies of the last symbol are trimmed.
      // Anything else (two chirps overlapping make many short runs) is dropped rather than guessed.
      const last = p.runs.filter(r => r.n >= 3).pop();
      while (syms.length > SYMBOLS && last && syms[syms.length - 1] === last.sym && syms[syms.length - 2] === last.sym) syms.pop();
      if (syms.length !== SYMBOLS) return null;
      // Timing must add up: the runs span ~8 symbols (±15 %, so speaker/mic drift passes but a jumble of two
      // overlapping chirps doesn't).
      const used = p.runs.filter(r => r.n >= 3), span = used[used.length - 1].end - used[0].start + 0.02;
      if (Math.abs(span / (SYMBOLS * SYMBOL_S) - 1) > 0.15) return null;
      const token = syms.slice(0, 5).reduce((t, s) => (t << 4) | s, 0);
      return checksum(token) === ((syms[5] << 8) | (syms[6] << 4) | syms[7]) ? token : null;
    }
    // Runs → symbols: runs under 3 looks are dropped; a run's length says how many equal symbols it holds.
    static symbols(runs) {
      const out = [];
      for (const r of runs) {
        if (r.n < 3) continue; // a 60 ms tone gives 4–6 clear looks; shorter runs are blips or overlaps
        const count = Math.max(1, Math.round((r.end - r.start + 0.02) / SYMBOL_S));
        for (let i = 0; i < count; i++) out.push(r.sym);
      }
      return out;
    }
  }

  const api = { encode, Decoder, randomToken, hex, checksum, FREQS, PROFILES, freqsOf, packetSeconds: MARKER_S + SYMBOLS * SYMBOL_S };
  if (typeof module === "object" && module.exports) module.exports = api; else root.StashSound = api;
})(globalThis);
