/**
 * Synth voices. Every function takes a BaseAudioContext so the exact same code renders
 * live (AudioContext) and offline (OfflineAudioContext) for analysis.
 */
import { mtof } from './theory';

export type Ctx = BaseAudioContext;

/** Instrument description. All times in seconds. */
export interface Inst {
  /** 'osc' (default): subtractive oscillator voice. 'fm': 2-op FM (bells, piano). 'kit': drum kit. */
  kind?: 'osc' | 'fm' | 'kit';
  /** 'sine' | 'square' | 'sawtooth' | 'triangle' | 'pulse12' | 'pulse25' | 'pulse33' | 'organ' | 'choir' | 'soft' | 'reed' */
  wave?: string;
  /** unison oscillators (default 1) and their total detune spread in cents */
  uni?: number;
  det?: number;
  /** level of an extra sine at the fundamental (weight for basses) */
  sub?: number;
  /** octave shift */
  oct?: number;
  a?: number;
  d?: number;
  s?: number;
  r?: number;
  /** peak gain at velocity 1 */
  gain: number;
  /** lowpass cutoff Hz (+ lpk * note frequency key-tracking) */
  lp?: number;
  lpk?: number;
  q?: number;
  /** filter envelope: cutoff starts at cutoff*fenv and falls to cutoff over fdec */
  fenv?: number;
  fdec?: number;
  /** vibrato depth (cents), rate (Hz), onset delay (s) */
  vib?: number;
  vrate?: number;
  vdel?: number;
  /** breath noise amount (flute) */
  breath?: number;
  /** FM: modulator ratio, start index, index decay time, sustained index fraction */
  ratio?: number;
  index?: number;
  idec?: number;
  isus?: number;
}

// ---------------------------------------------------------------------------------------------
// Waveforms & shared buffers (cached per context)

const waveCache = new WeakMap<Ctx, Map<string, PeriodicWave>>();
const noiseCache = new WeakMap<Ctx, AudioBuffer>();
const shaperCache = new WeakMap<Ctx, Map<number, Float32Array<ArrayBuffer>>>();

const HARMONICS: Record<string, number[]> = {
  organ: [1, 0.72, 0.42, 0.5, 0, 0.3, 0, 0.2],
  choir: [1, 0.5, 0.38, 0.3, 0.2, 0.22, 0.1, 0.07, 0.05, 0.035],
  soft: [1, 0.22, 0.07, 0.035],
  reed: [1, 0, 0.45, 0, 0.28, 0, 0.16, 0, 0.1, 0, 0.06],
};

const NATIVE = new Set(['sine', 'square', 'sawtooth', 'triangle']);

function buildWave(ctx: Ctx, key: string): PeriodicWave {
  const n = 48;
  const real = new Float32Array(n + 1);
  const imag = new Float32Array(n + 1);
  if (key.startsWith('pulse')) {
    const duty = parseInt(key.slice(5), 10) / 100;
    for (let k = 1; k <= n; k++) real[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
  } else {
    const h = HARMONICS[key] ?? [1];
    h.forEach((amp, i) => (imag[i + 1] = amp));
  }
  return ctx.createPeriodicWave(real, imag);
}

export function setWave(ctx: Ctx, osc: OscillatorNode, key: string): void {
  if (NATIVE.has(key)) {
    osc.type = key as OscillatorType;
    return;
  }
  let m = waveCache.get(ctx);
  if (!m) waveCache.set(ctx, (m = new Map()));
  let w = m.get(key);
  if (!w) m.set(key, (w = buildWave(ctx, key)));
  osc.setPeriodicWave(w);
}

export function noiseBuffer(ctx: Ctx): AudioBuffer {
  let b = noiseCache.get(ctx);
  if (!b) {
    const len = Math.floor(ctx.sampleRate * 2);
    b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    noiseCache.set(ctx, b);
  }
  return b;
}

export function noiseSource(ctx: Ctx, t: number, stop: number, rate = 1): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;
  src.playbackRate.value = rate;
  src.start(t, Math.random() * 1.5);
  src.stop(stop);
  return src;
}

/** tanh soft-clip curve for grit. */
export function shaperCurve(ctx: Ctx, drive: number): Float32Array<ArrayBuffer> {
  let m = shaperCache.get(ctx);
  if (!m) shaperCache.set(ctx, (m = new Map()));
  const key = Math.round(drive * 10);
  let c = m.get(key);
  if (!c) {
    c = new Float32Array(1024);
    const norm = Math.tanh(drive);
    for (let i = 0; i < c.length; i++) {
      const x = (i / (c.length - 1)) * 2 - 1;
      c[i] = Math.tanh(x * drive) / norm;
    }
    m.set(key, c);
  }
  return c;
}

/** Switch a param to k-rate automation where supported (cheaper for filter sweeps). */
export function kRate(p: AudioParam): void {
  try {
    if ('automationRate' in p) p.automationRate = 'k-rate';
  } catch {
    /* unsupported: stays a-rate */
  }
}

export function filter(ctx: Ctx, type: BiquadFilterType, freq: number, q = 0.7): BiquadFilterNode {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = Math.min(freq, ctx.sampleRate * 0.45);
  f.Q.value = q;
  return f;
}

// ---------------------------------------------------------------------------------------------
// Envelopes

const FLOOR = 0.0001;

/**
 * ADSR on a gain param. Decay/release are exponential. Returns the time the voice is silent.
 * `s` is a fraction of peak; s = 0 gives a plucked/percussive decay over `d`.
 */
export function adsr(
  p: AudioParam,
  t: number,
  dur: number,
  a: number,
  d: number,
  s: number,
  r: number,
  peak: number,
): number {
  a = Math.max(0.002, a);
  d = Math.max(0.005, d);
  r = Math.max(0.01, r);
  peak = Math.max(FLOOR * 2, peak);
  const sl = Math.max(FLOOR, peak * s);
  p.setValueAtTime(0, t);
  if (dur <= a) {
    // released during the attack
    p.linearRampToValueAtTime(Math.max(FLOOR, (peak * dur) / a), t + dur);
  } else {
    p.linearRampToValueAtTime(peak, t + a);
    if (dur < a + d) {
      // released during the decay: land exactly on the decay curve
      p.exponentialRampToValueAtTime(Math.max(FLOOR, peak * Math.pow(sl / peak, (dur - a) / d)), t + dur);
    } else {
      p.exponentialRampToValueAtTime(sl, t + a + d);
      p.setValueAtTime(sl, t + dur);
    }
  }
  p.exponentialRampToValueAtTime(FLOOR, t + dur + r);
  p.setValueAtTime(0, t + dur + r + 0.002);
  return t + dur + r + 0.01;
}

/** Simple percussive envelope: attack, optional hold, exponential decay. Returns end time. */
export function perc(p: AudioParam, t: number, a: number, hold: number, dec: number, peak: number): number {
  a = Math.max(0.001, a);
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(peak, t + a);
  if (hold > 0) p.setValueAtTime(peak, t + a + hold);
  p.exponentialRampToValueAtTime(FLOOR, t + a + hold + dec);
  p.setValueAtTime(0, t + a + hold + dec + 0.002);
  return t + a + hold + dec + 0.01;
}

// ---------------------------------------------------------------------------------------------
// Voices

/** Play one note. Returns the end time of the voice. */
export function playNote(
  ctx: Ctx,
  out: AudioNode,
  inst: Inst,
  t: number,
  dur: number,
  midi: number,
  vel: number,
): number {
  if (inst.kind === 'kit') return playDrum(ctx, out, t, midi, vel * inst.gain);
  const f = mtof(midi + 12 * (inst.oct ?? 0));
  const peak = inst.gain * vel;
  if (peak <= 0 || !Number.isFinite(f)) return t;

  const amp = ctx.createGain();
  const end = adsr(amp.gain, t, dur, inst.a ?? 0.01, inst.d ?? 0.2, inst.s ?? 0.8, inst.r ?? 0.1, peak);
  amp.connect(out);

  let head: AudioNode = amp;
  if (inst.lp) {
    const cut = Math.min(16000, inst.lp + f * (inst.lpk ?? 0));
    const flt = filter(ctx, 'lowpass', cut, inst.q ?? 0.7);
    if (inst.fenv && inst.fenv !== 1) {
      kRate(flt.frequency); // per-block coefficient updates: far cheaper than per-sample
      flt.frequency.setValueAtTime(Math.min(16000, cut * inst.fenv), t);
      flt.frequency.exponentialRampToValueAtTime(cut, t + (inst.fdec ?? 0.15));
    }
    flt.connect(amp);
    head = flt;
  }

  const oscs: OscillatorNode[] = [];
  const stopAt = end + 0.02;

  if (inst.kind === 'fm') {
    const mod = ctx.createOscillator();
    mod.frequency.value = f * (inst.ratio ?? 2);
    const mg = ctx.createGain();
    const i0 = (inst.index ?? 2) * f;
    mg.gain.setValueAtTime(i0, t);
    mg.gain.exponentialRampToValueAtTime(Math.max(0.5, i0 * (inst.isus ?? 0.05)), t + (inst.idec ?? 0.5));
    mod.connect(mg);
    mod.start(t);
    mod.stop(stopAt);
    const n = inst.uni ?? 1;
    const g = n > 1 ? ctx.createGain() : null;
    if (g) {
      g.gain.value = 1 / Math.sqrt(n);
      g.connect(head);
    }
    for (let i = 0; i < n; i++) {
      const c = ctx.createOscillator();
      c.frequency.value = f;
      if (n > 1) c.detune.value = ((i / (n - 1)) * 2 - 1) * (inst.det ?? 0) * 0.5;
      mg.connect(c.frequency);
      c.connect(g ?? head);
      oscs.push(c);
    }
  } else {
    const n = inst.uni ?? 1;
    const wave = inst.wave ?? 'triangle';
    const g = n > 1 ? ctx.createGain() : null;
    if (g) {
      g.gain.value = 1 / Math.sqrt(n);
      g.connect(head);
    }
    for (let i = 0; i < n; i++) {
      const o = ctx.createOscillator();
      setWave(ctx, o, wave);
      o.frequency.value = f;
      if (n > 1) o.detune.value = ((i / (n - 1)) * 2 - 1) * (inst.det ?? 0) * 0.5;
      o.connect(g ?? head);
      oscs.push(o);
    }
    if (inst.sub) {
      const s = ctx.createOscillator();
      s.frequency.value = f;
      const sg = ctx.createGain();
      sg.gain.value = inst.sub;
      s.connect(sg);
      sg.connect(amp);
      s.start(t);
      s.stop(stopAt);
    }
    if (inst.breath) {
      const src = noiseSource(ctx, t, stopAt);
      const bp = filter(ctx, 'bandpass', Math.min(9000, f * 2), 1.2);
      const bg = ctx.createGain();
      bg.gain.setValueAtTime(inst.breath * 2.2, t);
      bg.gain.setTargetAtTime(inst.breath, t + 0.02, 0.08);
      src.connect(bp);
      bp.connect(bg);
      bg.connect(amp);
    }
  }

  if (inst.vib && dur > 0.18) {
    // Vibrato drives `frequency` in Hz (driving `detune` costs a pow() per sample in Chrome).
    const lfo = ctx.createOscillator();
    lfo.frequency.value = inst.vrate ?? 5.5;
    const lg = ctx.createGain();
    const vd = t + (inst.vdel ?? 0.2);
    const depthHz = f * (Math.pow(2, inst.vib / 1200) - 1);
    lg.gain.setValueAtTime(0, t);
    lg.gain.setValueAtTime(0, vd);
    lg.gain.linearRampToValueAtTime(depthHz, vd + 0.35);
    lfo.connect(lg);
    for (const o of oscs) lg.connect(o.frequency);
    lfo.start(t);
    lfo.stop(stopAt);
  }

  for (const o of oscs) {
    o.start(t);
    o.stop(stopAt);
  }
  return end;
}

// ---------------------------------------------------------------------------------------------
// Drums

/** Drum names used by the drum-pattern notation, indexed by position. */
export const DRUM_KEYS = 'kshoctmirbxzp';
// k kick, s snare, h closed hat, o open hat, c crash, t low tom, m mid tom, i high tom,
// r rim/click, b boom (timpani-ish), x shaker, z clock tick, p clap

function sweepTone(
  ctx: Ctx,
  out: AudioNode,
  t: number,
  type: OscillatorType,
  f0: number,
  f1: number,
  sweep: number,
  dec: number,
  g: number,
): number {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + sweep);
  const a = ctx.createGain();
  const end = perc(a.gain, t, 0.001, 0, dec, g);
  o.connect(a);
  a.connect(out);
  o.start(t);
  o.stop(end);
  return end;
}

function noiseHit(
  ctx: Ctx,
  out: AudioNode,
  t: number,
  type: BiquadFilterType,
  freq: number,
  q: number,
  a: number,
  dec: number,
  g: number,
  hp = 0,
): number {
  const e = t + a + dec + 0.02;
  const src = noiseSource(ctx, t, e);
  const f = filter(ctx, type, freq, q);
  const amp = ctx.createGain();
  perc(amp.gain, t, a, 0, dec, g);
  src.connect(f);
  if (hp) {
    const h = filter(ctx, 'highpass', hp, 0.7);
    f.connect(h);
    h.connect(amp);
  } else f.connect(amp);
  amp.connect(out);
  return e;
}

export function playDrum(ctx: Ctx, out: AudioNode, t: number, idx: number, v: number): number {
  switch (DRUM_KEYS[idx]) {
    case 'k': {
      noiseHit(ctx, out, t, 'highpass', 2500, 0.7, 0.001, 0.012, v * 0.18);
      return sweepTone(ctx, out, t, 'sine', 150, 44, 0.12, 0.38, v * 0.95);
    }
    case 's': {
      sweepTone(ctx, out, t, 'triangle', 200, 150, 0.05, 0.09, v * 0.42);
      return noiseHit(ctx, out, t, 'bandpass', 1900, 0.75, 0.001, 0.17, v * 0.75, 500);
    }
    case 'h':
      return noiseHit(ctx, out, t, 'highpass', 7800, 0.8, 0.001, 0.045, v * 0.32);
    case 'o':
      return noiseHit(ctx, out, t, 'highpass', 7000, 0.8, 0.002, 0.3, v * 0.24);
    case 'c': {
      noiseHit(ctx, out, t, 'bandpass', 5200, 0.6, 0.002, 0.5, v * 0.18);
      return noiseHit(ctx, out, t, 'highpass', 4200, 0.7, 0.002, 1.5, v * 0.26);
    }
    case 't':
      noiseHit(ctx, out, t, 'lowpass', 900, 0.7, 0.001, 0.05, v * 0.2);
      return sweepTone(ctx, out, t, 'sine', 120, 72, 0.22, 0.42, v * 0.7);
    case 'm':
      noiseHit(ctx, out, t, 'lowpass', 1100, 0.7, 0.001, 0.05, v * 0.2);
      return sweepTone(ctx, out, t, 'sine', 175, 110, 0.2, 0.36, v * 0.62);
    case 'i':
      noiseHit(ctx, out, t, 'lowpass', 1400, 0.7, 0.001, 0.05, v * 0.2);
      return sweepTone(ctx, out, t, 'sine', 240, 160, 0.18, 0.3, v * 0.55);
    case 'r':
      sweepTone(ctx, out, t, 'triangle', 1700, 1500, 0.02, 0.025, v * 0.25);
      return noiseHit(ctx, out, t, 'bandpass', 2600, 3, 0.001, 0.03, v * 0.5);
    case 'b': {
      sweepTone(ctx, out, t, 'sine', 138, 100, 0.4, 0.8, v * 0.22);
      noiseHit(ctx, out, t, 'lowpass', 320, 0.7, 0.002, 0.35, v * 0.45);
      return sweepTone(ctx, out, t, 'sine', 92, 64, 0.5, 1.3, v * 0.85);
    }
    case 'x':
      return noiseHit(ctx, out, t, 'bandpass', 7200, 1.4, 0.012, 0.055, v * 0.3);
    case 'z':
      sweepTone(ctx, out, t, 'sine', 2600, 2400, 0.01, 0.014, v * 0.3);
      return noiseHit(ctx, out, t, 'highpass', 5000, 0.7, 0.001, 0.01, v * 0.2);
    case 'p': {
      for (let i = 0; i < 3; i++)
        noiseHit(ctx, out, t + i * 0.011, 'bandpass', 1300, 1.1, 0.001, 0.012, v * 0.5);
      return noiseHit(ctx, out, t + 0.033, 'bandpass', 1300, 1.1, 0.001, 0.15, v * 0.55);
    }
    default:
      return t;
  }
}

// ---------------------------------------------------------------------------------------------
// Instrument presets (spread + override per song: `{ ...P.lead, gain: 0.1 }`)

export const P = {
  lead: {
    wave: 'pulse25',
    a: 0.012,
    d: 0.35,
    s: 0.7,
    r: 0.16,
    gain: 0.12,
    lp: 3200,
    lpk: 1,
    vib: 14,
    vrate: 5.5,
    vdel: 0.22,
  },
  lead12: {
    wave: 'pulse12',
    a: 0.01,
    d: 0.3,
    s: 0.7,
    r: 0.14,
    gain: 0.13,
    lp: 3600,
    lpk: 1,
    vib: 12,
    vrate: 5.8,
    vdel: 0.2,
  },
  square: {
    wave: 'square',
    a: 0.006,
    d: 0.25,
    s: 0.65,
    r: 0.1,
    gain: 0.085,
    lp: 2200,
    lpk: 1.4,
    vib: 10,
    vrate: 6,
    vdel: 0.2,
  },
  flute: {
    wave: 'soft',
    a: 0.05,
    d: 0.3,
    s: 0.82,
    r: 0.18,
    gain: 0.19,
    lp: 5000,
    vib: 20,
    vrate: 5,
    vdel: 0.16,
    breath: 0.07,
  },
  tri: { wave: 'triangle', a: 0.01, d: 0.4, s: 0.7, r: 0.22, gain: 0.24, vib: 10, vrate: 5, vdel: 0.25 },
  theremin: { wave: 'sine', a: 0.12, d: 0.5, s: 0.85, r: 0.4, gain: 0.2, vib: 32, vrate: 4.4, vdel: 0.05 },
  brass: {
    wave: 'sawtooth',
    uni: 2,
    det: 8,
    a: 0.04,
    d: 0.5,
    s: 0.75,
    r: 0.2,
    gain: 0.1,
    lp: 650,
    lpk: 1.6,
    q: 1,
    fenv: 2.6,
    fdec: 0.2,
    vib: 12,
    vrate: 5,
    vdel: 0.3,
  },
  strings: {
    wave: 'sawtooth',
    uni: 3,
    det: 12,
    a: 0.35,
    d: 0.8,
    s: 0.85,
    r: 0.7,
    gain: 0.05,
    lp: 1500,
    lpk: 0.5,
    vib: 7,
    vrate: 5.2,
    vdel: 0.3,
  },
  pad: { wave: 'sawtooth', uni: 3, det: 16, a: 0.7, d: 1, s: 0.8, r: 1.0, gain: 0.045, lp: 900, lpk: 0.3 },
  organ: { wave: 'organ', uni: 2, det: 6, a: 0.06, d: 0.3, s: 0.9, r: 0.3, gain: 0.05, lp: 3000 },
  choir: {
    wave: 'choir',
    uni: 3,
    det: 16,
    a: 0.7,
    d: 1,
    s: 0.85,
    r: 1.1,
    gain: 0.055,
    lp: 2200,
    vib: 9,
    vrate: 4.6,
    vdel: 0.4,
  },
  bell: {
    kind: 'fm',
    ratio: 3.5,
    index: 2.4,
    idec: 1.4,
    isus: 0.12,
    a: 0.002,
    d: 3,
    s: 0,
    r: 0.8,
    gain: 0.12,
  },
  glass: {
    kind: 'fm',
    ratio: 5,
    index: 1.2,
    idec: 0.5,
    isus: 0.1,
    a: 0.002,
    d: 1.3,
    s: 0,
    r: 0.4,
    gain: 0.08,
  },
  glock: {
    kind: 'fm',
    ratio: 4,
    index: 1.6,
    idec: 0.25,
    isus: 0.1,
    a: 0.002,
    d: 1.2,
    s: 0,
    r: 0.3,
    gain: 0.11,
  },
  piano: {
    kind: 'fm',
    ratio: 1,
    index: 1.3,
    idec: 0.7,
    isus: 0.18,
    uni: 2,
    det: 4,
    a: 0.003,
    d: 2.6,
    s: 0,
    r: 0.35,
    gain: 0.16,
  },
  harp: { wave: 'triangle', a: 0.003, d: 1.1, s: 0, r: 0.3, gain: 0.15, lp: 3000 },
  pluck: {
    wave: 'pulse25',
    a: 0.002,
    d: 0.35,
    s: 0,
    r: 0.1,
    gain: 0.09,
    lp: 1400,
    lpk: 1,
    fenv: 3,
    fdec: 0.08,
  },
  bass: { wave: 'triangle', a: 0.005, d: 0.25, s: 0.8, r: 0.08, gain: 0.3 },
  bassPluck: { wave: 'triangle', a: 0.004, d: 0.22, s: 0.35, r: 0.06, gain: 0.32 },
  pbass: {
    wave: 'pulse25',
    a: 0.004,
    d: 0.18,
    s: 0.6,
    r: 0.06,
    gain: 0.11,
    lp: 750,
    lpk: 1,
    fenv: 2.2,
    fdec: 0.08,
    sub: 0.9,
  },
  sawbass: {
    wave: 'sawtooth',
    a: 0.004,
    d: 0.2,
    s: 0.6,
    r: 0.07,
    gain: 0.11,
    lp: 420,
    lpk: 1.2,
    q: 2.5,
    fenv: 3.5,
    fdec: 0.1,
    sub: 0.8,
  },
  sub: { wave: 'sine', a: 0.01, d: 0.2, s: 0.9, r: 0.12, gain: 0.3 },
  arp: { wave: 'pulse12', a: 0.002, d: 0.14, s: 0.25, r: 0.05, gain: 0.07, lp: 2600, lpk: 1 },
  kit: { kind: 'kit', gain: 1 },
} satisfies Record<string, Inst>;
