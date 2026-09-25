/**
 * Synthesized sound effects and stingers. Each effect builds a short node graph on demand.
 */
import type { SfxId, SfxOptions } from './index';
import type { Mixer } from './mixer';
import { parseMML } from './notation';
import {
  filter,
  type Ctx,
  type Inst,
  kRate,
  noiseSource,
  P,
  perc,
  playNote,
  setWave,
  shaperCurve,
} from './synth';

/** Context handed to an effect: where/when to play and the pitch multiplier. */
interface S {
  ctx: Ctx;
  out: AudioNode;
  t: number;
  p: number;
}

export interface SfxDef {
  /** expected max duration (s): used for voice bookkeeping and flagged by the analysis */
  max: number;
  /** output gain multiplier */
  gain?: number;
  /** random pitch jitter (fraction, e.g. 0.04 = ±4%) */
  jitter?: number;
  /** reverb send */
  rev?: number;
  /** duck music by this amount while playing (stingers) */
  duck?: number;
  stinger?: boolean;
  play: (s: S) => void;
}

// ---------------------------------------------------------------------------------------------
// Building blocks

interface ToneOpt {
  /** waveform key (see setWave) */
  w?: string;
  f: number;
  /** sweep target and sweep time (default: whole note) */
  f2?: number;
  sw?: number;
  lin?: boolean;
  at?: number;
  a?: number;
  h?: number;
  d: number;
  g: number;
  lp?: number;
  hp?: number;
  bp?: number;
  q?: number;
  /** vibrato [rate Hz, depth cents] */
  vib?: [number, number];
  det?: number;
  drive?: number;
}

function chainFilters(
  s: S,
  o: { lp?: number; hp?: number; bp?: number; q?: number },
  last: AudioNode,
): AudioNode {
  let head = last;
  const add = (type: BiquadFilterType, f: number): void => {
    const fl = filter(s.ctx, type, f * s.p, o.q ?? 0.7);
    fl.connect(head);
    head = fl;
  };
  if (o.lp) add('lowpass', o.lp);
  if (o.hp) add('highpass', o.hp);
  if (o.bp) add('bandpass', o.bp);
  return head;
}

function driveNode(s: S, drive: number, to: AudioNode): AudioNode {
  const ws = s.ctx.createWaveShaper();
  ws.curve = shaperCurve(s.ctx, drive);
  ws.connect(to);
  return ws;
}

function tone(s: S, o: ToneOpt): number {
  const { ctx } = s;
  const t = s.t + (o.at ?? 0);
  const osc = ctx.createOscillator();
  setWave(ctx, osc, o.w ?? 'sine');
  const f = o.f * s.p;
  osc.frequency.setValueAtTime(f, t);
  const a = o.a ?? 0.002;
  if (o.f2 !== undefined) {
    const f2 = Math.max(1, o.f2 * s.p);
    const st = t + (o.sw ?? a + (o.h ?? 0) + o.d);
    if (o.lin) osc.frequency.linearRampToValueAtTime(f2, st);
    else osc.frequency.exponentialRampToValueAtTime(f2, st);
  }
  if (o.det) osc.detune.value = o.det;
  const g = ctx.createGain();
  const end = perc(g.gain, t, a, o.h ?? 0, o.d, o.g);
  g.connect(s.out);
  let head: AudioNode = o.drive ? driveNode(s, o.drive, g) : g;
  head = chainFilters(s, o, head);
  osc.connect(head);
  if (o.vib) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = o.vib[0];
    const lg = ctx.createGain();
    lg.gain.value = f * (Math.pow(2, o.vib[1] / 1200) - 1);
    lfo.connect(lg);
    lg.connect(osc.frequency);
    lfo.start(t);
    lfo.stop(end);
  }
  osc.start(t);
  osc.stop(end);
  return end;
}

interface NoiseOpt {
  at?: number;
  a?: number;
  h?: number;
  d: number;
  g: number;
  /** main filter type + frequency (+ sweep target) */
  ft?: BiquadFilterType;
  f?: number;
  f2?: number;
  sw?: number;
  q?: number;
  /** extra high/low pass */
  hp?: number;
  lp?: number;
  /** amplitude tremolo [rate, depth 0..0.5] */
  mod?: [number, number];
  /** filter-frequency wobble [rate, depth Hz] */
  fmod?: [number, number];
  drive?: number;
  rate?: number;
}

function noise(s: S, o: NoiseOpt): number {
  const { ctx } = s;
  const t = s.t + (o.at ?? 0);
  const a = o.a ?? 0.002;
  const g = ctx.createGain();
  const end = perc(g.gain, t, a, o.h ?? 0, o.d, o.g);
  const src = noiseSource(ctx, t, end, o.rate ?? 1);
  let out: AudioNode = g;
  g.connect(s.out);
  if (o.mod) {
    const trem = ctx.createGain();
    trem.gain.value = 1 - o.mod[1];
    const lfo = ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = o.mod[0];
    const lg = ctx.createGain();
    lg.gain.value = o.mod[1];
    lfo.connect(lg);
    lg.connect(trem.gain);
    lfo.start(t);
    lfo.stop(end);
    trem.connect(out);
    out = trem;
  }
  if (o.drive) out = driveNode(s, o.drive, out);
  out = chainFilters(s, { hp: o.hp, lp: o.lp }, out);
  const fl = filter(ctx, o.ft ?? 'bandpass', (o.f ?? 1000) * s.p, o.q ?? 0.8);
  if (o.f2 !== undefined || o.fmod) kRate(fl.frequency);
  if (o.f2 !== undefined) {
    fl.frequency.setValueAtTime((o.f ?? 1000) * s.p, t);
    fl.frequency.exponentialRampToValueAtTime(o.f2 * s.p, t + (o.sw ?? a + (o.h ?? 0) + o.d));
  }
  if (o.fmod) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = o.fmod[0];
    const lg = ctx.createGain();
    lg.gain.value = o.fmod[1] * s.p;
    lfo.connect(lg);
    lg.connect(fl.frequency);
    lfo.start(t);
    lfo.stop(end);
  }
  fl.connect(out);
  src.connect(fl);
  return end;
}

const semis = (p: number): number => 12 * Math.log2(p);

/** [offset s, midi, duration s, velocity?] */
type NoteSpec = [number, number, number, number?];

function notes(s: S, inst: Inst, list: NoteSpec[]): void {
  const sh = semis(s.p);
  for (const [at, m, d, v] of list) playNote(s.ctx, s.out, inst, s.t + at, d, m + sh, v ?? 1);
}

function arp(s: S, inst: Inst, midis: number[], step: number, dur: number, at = 0, vel = 1): void {
  notes(
    s,
    inst,
    midis.map((m, i) => [at + i * step, m, dur, vel] as NoteSpec),
  );
}

function mml(s: S, inst: Inst, src: string, bpm: number, at = 0): void {
  const spb = 60 / bpm;
  const { ev } = parseMML(src, 4, () => {});
  const sh = semis(s.p);
  for (const e of ev)
    for (const n of e.n) playNote(s.ctx, s.out, inst, s.t + at + e.t * spb, e.d * spb, n + sh, e.v);
}

// Instruments used by effects
const metal: Inst = {
  kind: 'fm',
  ratio: 1.41,
  index: 3,
  idec: 0.08,
  isus: 0.2,
  a: 0.001,
  d: 0.5,
  s: 0,
  r: 0.1,
  gain: 0.16,
};
const clink: Inst = {
  kind: 'fm',
  ratio: 2.76,
  index: 2.2,
  idec: 0.1,
  isus: 0.15,
  a: 0.001,
  d: 0.35,
  s: 0,
  r: 0.1,
  gain: 0.14,
};
const chime: Inst = { ...P.glock, gain: 0.14 };
const sparkle: Inst = { ...P.glass, gain: 0.1 };
const fan: Inst = { ...P.lead, gain: 0.13, d: 0.4, s: 0.75, vdel: 0.12 };
const fanBrass: Inst = { ...P.brass, gain: 0.12 };
const strings: Inst = { ...P.strings, gain: 0.07, a: 0.15 };
const bellI: Inst = { ...P.bell, gain: 0.14 };
const stab: Inst = {
  wave: 'sawtooth',
  uni: 3,
  det: 18,
  a: 0.004,
  d: 0.5,
  s: 0.25,
  r: 0.4,
  gain: 0.1,
  lp: 2400,
  fenv: 2,
  fdec: 0.25,
};
const bassI: Inst = { ...P.bass, gain: 0.3 };

// ---------------------------------------------------------------------------------------------
// Effects

export const SFX: Record<SfxId, SfxDef> = {
  // ---- UI
  ui_move: {
    gain: 2.4,
    max: 0.12,
    jitter: 0.015,
    play: (s) => void tone(s, { w: 'pulse25', f: 880, d: 0.04, g: 0.12, lp: 3500 }),
  },
  ui_select: {
    gain: 1.6,
    max: 0.25,
    play: (s) => {
      tone(s, { w: 'pulse25', f: 660, d: 0.05, g: 0.12, lp: 4000 });
      tone(s, { w: 'pulse25', f: 990, at: 0.05, d: 0.1, g: 0.12, lp: 4000 });
    },
  },
  ui_back: {
    gain: 1.6,
    max: 0.25,
    play: (s) => {
      tone(s, { w: 'pulse25', f: 700, d: 0.05, g: 0.11, lp: 3500 });
      tone(s, { w: 'pulse25', f: 466, at: 0.05, d: 0.09, g: 0.11, lp: 3500 });
    },
  },
  ui_error: {
    gain: 0.75,
    max: 0.35,
    play: (s) => {
      tone(s, { w: 'square', f: 150, d: 0.07, h: 0.03, g: 0.1, lp: 1400 });
      tone(s, { w: 'square', f: 142, at: 0.13, d: 0.09, h: 0.03, g: 0.1, lp: 1400 });
    },
  },
  ui_open: {
    gain: 1.5,
    max: 0.35,
    play: (s) => {
      tone(s, { w: 'triangle', f: 420, f2: 1100, sw: 0.12, d: 0.15, g: 0.22 });
      tone(s, { f: 1650, at: 0.09, d: 0.14, g: 0.06 });
    },
  },
  ui_close: {
    gain: 1.5,
    max: 0.3,
    play: (s) => void tone(s, { w: 'triangle', f: 1000, f2: 380, sw: 0.12, d: 0.14, g: 0.22 }),
  },
  ui_tab: {
    gain: 1.7,
    max: 0.1,
    jitter: 0.02,
    play: (s) => {
      tone(s, { w: 'triangle', f: 1400, d: 0.03, g: 0.16 });
      noise(s, { ft: 'highpass', f: 5000, d: 0.015, g: 0.06 });
    },
  },
  text_blip: {
    gain: 2.8,
    max: 0.08,
    jitter: 0.05,
    play: (s) => void tone(s, { w: 'pulse25', f: 540, a: 0.003, d: 0.035, g: 0.05, lp: 2200 }),
  },

  // ---- player
  swing: {
    gain: 3,
    max: 0.3,
    jitter: 0.05,
    play: (s) => void noise(s, { ft: 'bandpass', f: 700, f2: 2600, q: 1.4, a: 0.03, d: 0.16, g: 0.5 }),
  },
  swing_heavy: {
    gain: 1.6,
    max: 0.45,
    jitter: 0.04,
    play: (s) => {
      noise(s, { ft: 'bandpass', f: 350, f2: 1500, q: 1.2, a: 0.05, d: 0.28, g: 0.65 });
      tone(s, { f: 120, f2: 60, a: 0.04, d: 0.2, g: 0.25 });
    },
  },
  swing_light: {
    gain: 2.9,
    max: 0.2,
    jitter: 0.05,
    play: (s) => void noise(s, { ft: 'bandpass', f: 1600, f2: 4200, q: 1.6, a: 0.015, d: 0.09, g: 0.4 }),
  },
  staff_bolt: {
    gain: 4.4,
    max: 0.35,
    jitter: 0.04,
    play: (s) => {
      tone(s, { w: 'sawtooth', f: 1500, f2: 260, sw: 0.18, d: 0.2, g: 0.1, lp: 3500 });
      tone(s, { f: 2400, f2: 1200, d: 0.15, g: 0.08 });
      noise(s, { ft: 'bandpass', f: 3000, q: 2, d: 0.1, g: 0.2 });
    },
  },
  dodge: {
    gain: 2.0,
    max: 0.25,
    jitter: 0.04,
    play: (s) => {
      noise(s, { ft: 'bandpass', f: 2000, f2: 5000, q: 1, a: 0.02, d: 0.12, g: 0.32 });
      tone(s, { w: 'triangle', f: 300, f2: 700, d: 0.1, g: 0.08 });
    },
  },
  footstep: {
    max: 0.12,
    jitter: 0.07,
    gain: 1.7,
    play: (s) => {
      noise(s, { ft: 'lowpass', f: 380, q: 0.7, a: 0.004, d: 0.06, g: 0.35 });
      tone(s, { f: 95, f2: 60, d: 0.05, g: 0.1 });
    },
  },
  hurt: {
    gain: 4.4,
    max: 0.35,
    jitter: 0.04,
    play: (s) => {
      tone(s, { w: 'square', f: 320, f2: 110, sw: 0.2, d: 0.2, g: 0.12, lp: 1800 });
      noise(s, { ft: 'lowpass', f: 1800, d: 0.1, g: 0.35 });
    },
  },
  low_hp: {
    gain: 0.67,
    max: 0.5,
    play: (s) => {
      tone(s, { f: 62, f2: 38, sw: 0.14, a: 0.005, d: 0.16, g: 0.6 });
      noise(s, { ft: 'lowpass', f: 150, d: 0.08, g: 0.3 });
      tone(s, { f: 55, f2: 36, sw: 0.16, at: 0.2, a: 0.005, d: 0.18, g: 0.45 });
    },
  },
  death: {
    max: 1.5,
    rev: 0.25,
    play: (s) => {
      tone(s, { w: 'triangle', f: 440, f2: 55, sw: 1.1, a: 0.01, h: 0.15, d: 1.1, g: 0.25 });
      tone(s, { w: 'square', f: 220, f2: 40, sw: 1, a: 0.01, d: 0.9, g: 0.05, lp: 900 });
      noise(s, { ft: 'lowpass', f: 600, f2: 150, d: 1.0, g: 0.2 });
    },
  },
  heal: {
    max: 1.3,
    rev: 0.3,
    play: (s) => {
      arp(s, chime, [84, 88, 91, 96], 0.06, 0.5, 0, 0.8);
      noise(s, { ft: 'highpass', f: 6000, a: 0.1, d: 0.4, g: 0.05 });
      tone(s, { f: 523, f2: 1046, sw: 0.3, a: 0.05, d: 0.3, g: 0.05 });
    },
  },
  potion: {
    gain: 1.4,
    max: 0.9,
    play: (s) => {
      for (let i = 0; i < 3; i++)
        tone(s, { f: 260 + i * 70, f2: 620 + i * 120, sw: 0.06, at: i * 0.08, d: 0.07, g: 0.2 });
      notes(s, chime, [[0.28, 100, 0.4, 0.7]]);
    },
  },
  equip: {
    gain: 1.5,
    max: 0.55,
    play: (s) => {
      notes(s, metal, [[0, 86, 0.3, 0.8]]);
      noise(s, { ft: 'highpass', f: 3000, d: 0.03, g: 0.2 });
      notes(s, metal, [[0.07, 91, 0.25, 0.5]]);
    },
  },
  no_mana: {
    gain: 1.1,
    max: 0.3,
    play: (s) => {
      tone(s, { w: 'triangle', f: 330, f2: 220, d: 0.09, g: 0.2 });
      tone(s, { w: 'triangle', f: 262, f2: 165, at: 0.11, d: 0.12, g: 0.2 });
    },
  },

  // ---- combat
  hit: {
    gain: 2.3,
    max: 0.22,
    jitter: 0.05,
    play: (s) => {
      noise(s, { ft: 'lowpass', f: 2200, f2: 600, d: 0.09, g: 0.6 });
      tone(s, { f: 190, f2: 55, sw: 0.1, d: 0.11, g: 0.5 });
    },
  },
  hit_heavy: {
    gain: 1.9,
    max: 0.4,
    jitter: 0.04,
    play: (s) => {
      noise(s, { ft: 'lowpass', f: 1600, f2: 300, d: 0.18, g: 0.55, drive: 3 });
      tone(s, { f: 130, f2: 38, sw: 0.2, d: 0.22, g: 0.6 });
      tone(s, { w: 'square', f: 90, f2: 45, d: 0.1, g: 0.08, lp: 600 });
    },
  },
  crit: {
    gain: 2.9,
    max: 0.6,
    jitter: 0.03,
    play: (s) => {
      noise(s, { ft: 'lowpass', f: 2600, f2: 700, d: 0.1, g: 0.55 });
      tone(s, { f: 200, f2: 50, sw: 0.12, d: 0.14, g: 0.5 });
      notes(s, clink, [[0.01, 93, 0.35, 0.8]]);
      tone(s, { w: 'pulse12', f: 1800, f2: 2600, d: 0.08, g: 0.05, lp: 5000 });
    },
  },
  enemy_die: {
    gain: 3.5,
    max: 0.55,
    jitter: 0.05,
    play: (s) => {
      noise(s, { ft: 'bandpass', f: 1800, f2: 300, q: 1.2, d: 0.3, g: 0.55 });
      tone(s, { w: 'square', f: 660, f2: 110, sw: 0.3, d: 0.3, g: 0.07, lp: 2000 });
      tone(s, { w: 'pulse25', f: 330, f2: 80, at: 0.05, sw: 0.25, d: 0.25, g: 0.06, lp: 1500 });
    },
  },
  block: {
    gain: 2.9,
    max: 0.55,
    jitter: 0.03,
    play: (s) => {
      notes(s, metal, [[0, 81, 0.3, 1]]);
      noise(s, { ft: 'bandpass', f: 3500, q: 2, d: 0.03, g: 0.45 });
      tone(s, { f: 220, d: 0.06, g: 0.2 });
    },
  },
  arrow_shoot: {
    gain: 2.6,
    max: 0.25,
    jitter: 0.05,
    play: (s) => {
      tone(s, { w: 'triangle', f: 720, f2: 300, sw: 0.08, d: 0.1, g: 0.2 });
      noise(s, { ft: 'bandpass', f: 4000, f2: 1500, q: 1, d: 0.12, g: 0.28, hp: 1200 });
    },
  },
  projectile_hit: {
    gain: 2.4,
    max: 0.18,
    jitter: 0.05,
    play: (s) => {
      noise(s, { ft: 'lowpass', f: 1800, d: 0.06, g: 0.45 });
      tone(s, { f: 420, f2: 140, d: 0.07, g: 0.3 });
    },
  },

  // ---- skills & magic
  dash_slash: {
    gain: 1.9,
    max: 0.35,
    jitter: 0.03,
    play: (s) => {
      noise(s, { ft: 'bandpass', f: 600, f2: 4500, q: 1.2, a: 0.02, d: 0.15, g: 0.55 });
      noise(s, { ft: 'highpass', f: 5000, at: 0.08, d: 0.1, g: 0.25 });
      tone(s, { w: 'sawtooth', f: 2000, f2: 900, at: 0.08, d: 0.08, g: 0.05, lp: 5000 });
    },
  },
  whirlwind: {
    max: 0.85,
    jitter: 0.03,
    play: (s) => {
      noise(s, { ft: 'bandpass', f: 1000, q: 2.2, fmod: [9, 700], a: 0.1, h: 0.35, d: 0.3, g: 0.7 });
      noise(s, { ft: 'highpass', f: 4000, mod: [18, 0.4], a: 0.1, h: 0.3, d: 0.25, g: 0.08 });
    },
  },
  fireball: {
    gain: 1.6,
    max: 0.75,
    jitter: 0.04,
    play: (s) => {
      noise(s, { ft: 'lowpass', f: 400, f2: 2200, sw: 0.3, q: 1, a: 0.05, d: 0.4, g: 0.6, mod: [18, 0.25] });
      tone(s, { f: 90, f2: 55, a: 0.03, d: 0.3, g: 0.25 });
      noise(s, { ft: 'highpass', f: 3000, mod: [30, 0.45], a: 0.02, d: 0.3, g: 0.08 });
    },
  },
  explosion: {
    gain: 1.4,
    max: 1.4,
    rev: 0.25,
    jitter: 0.03,
    play: (s) => {
      noise(s, { ft: 'lowpass', f: 2400, f2: 150, sw: 0.9, a: 0.004, d: 1.0, g: 0.55, drive: 2 });
      tone(s, { f: 95, f2: 28, sw: 0.6, d: 0.7, g: 0.75 });
      noise(s, { ft: 'highpass', f: 2500, d: 0.15, g: 0.2 });
    },
  },
  frost_nova: {
    gain: 1.35,
    max: 1.5,
    rev: 0.35,
    play: (s) => {
      noise(s, { ft: 'bandpass', f: 6000, f2: 2500, q: 3, d: 0.9, g: 0.4 });
      notes(s, sparkle, [
        [0, 96, 0.6],
        [0.03, 100, 0.6],
        [0.06, 103, 0.6],
        [0.09, 108, 0.6],
      ]);
      tone(s, { f: 1800, f2: 600, d: 0.5, g: 0.06 });
      noise(s, { ft: 'lowpass', f: 700, d: 0.25, g: 0.25 });
    },
  },
  ice_shard: {
    gain: 1.6,
    max: 0.8,
    jitter: 0.04,
    play: (s) => {
      notes(s, sparkle, [
        [0, 100, 0.3, 0.9],
        [0.02, 107, 0.3, 0.7],
      ]);
      noise(s, { ft: 'highpass', f: 6000, d: 0.05, g: 0.22 });
      tone(s, { w: 'triangle', f: 2600, f2: 1800, d: 0.06, g: 0.08 });
    },
  },
  lightning: {
    max: 1.0,
    rev: 0.2,
    jitter: 0.04,
    play: (s) => {
      noise(s, { ft: 'highpass', f: 900, mod: [45, 0.5], a: 0.002, h: 0.1, d: 0.45, g: 0.55 });
      tone(s, { w: 'square', f: 70, f2: 40, d: 0.25, g: 0.12, lp: 400 });
      noise(s, { ft: 'lowpass', f: 300, a: 0.01, d: 0.6, g: 0.55 });
    },
  },
  blades: {
    gain: 2.0,
    max: 0.7,
    jitter: 0.04,
    play: (s) => {
      for (let i = 0; i < 3; i++)
        noise(s, { ft: 'bandpass', f: 3000, f2: 6000, q: 2, at: i * 0.07, d: 0.08, g: 0.35 });
      notes(s, clink, [
        [0.05, 98, 0.3, 0.6],
        [0.19, 101, 0.3, 0.5],
      ]);
    },
  },
  meteor_fall: {
    gain: 1.4,
    max: 1.25,
    play: (s) => {
      tone(s, { f: 2200, f2: 260, sw: 1.0, a: 0.05, d: 1.0, g: 0.12 });
      noise(s, { ft: 'lowpass', f: 200, f2: 1200, sw: 1.0, a: 0.7, d: 0.35, g: 0.45 });
    },
  },
  surge_cutin: {
    gain: 0.9,
    max: 1.3,
    rev: 0.3,
    play: (s) => {
      noise(s, { ft: 'bandpass', f: 1500, f2: 8000, sw: 0.28, q: 1.2, a: 0.25, d: 0.25, g: 0.3 });
      notes(s, stab, [
        [0.28, 60, 0.35],
        [0.28, 67, 0.35],
        [0.28, 72, 0.35],
        [0.28, 76, 0.35],
      ]);
      tone(s, { f: 150, f2: 40, at: 0.28, d: 0.4, g: 0.5 });
      notes(s, sparkle, [[0.28, 100, 0.5, 0.7]]);
    },
  },
  surge_blast: {
    max: 2.0,
    rev: 0.35,
    play: (s) => {
      noise(s, { ft: 'lowpass', f: 3000, f2: 120, sw: 1.4, a: 0.004, d: 1.5, g: 0.55, drive: 2.5 });
      tone(s, { f: 110, f2: 26, sw: 0.9, d: 1.0, g: 0.75 });
      notes(s, stab, [
        [0, 50, 0.6],
        [0, 57, 0.6],
        [0, 62, 0.6],
        [0, 69, 0.6],
      ]);
      noise(s, { ft: 'highpass', f: 5000, a: 0.01, d: 1.0, g: 0.12, mod: [24, 0.3] });
    },
  },
  charge_up: {
    gain: 0.9,
    max: 1.05,
    play: (s) => {
      tone(s, {
        w: 'sawtooth',
        f: 180,
        f2: 1100,
        sw: 0.8,
        a: 0.05,
        h: 0.7,
        d: 0.15,
        g: 0.06,
        lp: 2500,
        vib: [14, 40],
      });
      tone(s, { f: 360, f2: 2200, sw: 0.8, a: 0.05, h: 0.7, d: 0.15, g: 0.08 });
      noise(s, { ft: 'bandpass', f: 1000, f2: 6000, sw: 0.8, q: 3, a: 0.1, h: 0.6, d: 0.15, g: 0.12 });
    },
  },
  teleport: {
    gain: 1.8,
    max: 0.9,
    rev: 0.3,
    play: (s) => {
      tone(s, { f: 400, f2: 2400, sw: 0.2, a: 0.01, d: 0.25, g: 0.15, vib: [30, 80] });
      tone(s, { f: 2400, f2: 400, sw: 0.25, at: 0.2, a: 0.01, d: 0.3, g: 0.12 });
      noise(s, { ft: 'highpass', f: 6000, a: 0.05, d: 0.4, g: 0.07 });
    },
  },
  summon: {
    gain: 0.5,
    max: 1.7,
    rev: 0.35,
    play: (s) => {
      notes(s, strings, [
        [0, 42, 1.0],
        [0, 48, 1.0],
        [0, 53, 1.0],
      ]);
      noise(s, { ft: 'lowpass', f: 200, f2: 1500, sw: 0.9, a: 0.5, d: 0.4, g: 0.25 });
      tone(s, { f: 55, a: 0.3, h: 0.4, d: 0.4, g: 0.3 });
    },
  },
  roar: {
    gain: 0.8,
    max: 1.4,
    jitter: 0.05,
    play: (s) => {
      tone(s, {
        w: 'sawtooth',
        f: 110,
        f2: 70,
        sw: 1.0,
        a: 0.08,
        h: 0.55,
        d: 0.4,
        g: 0.16,
        lp: 700,
        vib: [18, 60],
        drive: 4,
      });
      noise(s, { ft: 'lowpass', f: 900, f2: 400, a: 0.1, h: 0.5, d: 0.4, g: 0.4, mod: [22, 0.35] });
    },
  },
  slam: {
    gain: 1.5,
    max: 0.9,
    rev: 0.15,
    jitter: 0.03,
    play: (s) => {
      tone(s, { f: 100, f2: 30, sw: 0.3, d: 0.5, g: 0.8 });
      noise(s, { ft: 'lowpass', f: 1200, f2: 100, d: 0.45, g: 0.55, drive: 2 });
      noise(s, { ft: 'highpass', f: 2000, d: 0.08, g: 0.2 });
    },
  },
  fire_breath: {
    max: 1.3,
    jitter: 0.03,
    play: (s) => {
      noise(s, {
        ft: 'lowpass',
        f: 900,
        f2: 1800,
        sw: 0.8,
        q: 1,
        a: 0.1,
        h: 0.6,
        d: 0.35,
        g: 0.55,
        mod: [16, 0.25],
      });
      noise(s, { ft: 'highpass', f: 4000, mod: [35, 0.5], a: 0.05, h: 0.6, d: 0.3, g: 0.07 });
    },
  },
  void_pulse: {
    max: 1.2,
    rev: 0.35,
    play: (s) => {
      tone(s, { f: 70, f2: 45, a: 0.05, d: 0.7, g: 0.5 });
      tone(s, { w: 'sawtooth', f: 110, f2: 55, a: 0.05, d: 0.6, g: 0.12, lp: 400, vib: [6, 60] });
      noise(s, { ft: 'bandpass', f: 400, q: 4, fmod: [3, 300], a: 0.05, d: 0.7, g: 0.3 });
    },
  },
  telegraph: {
    gain: 2.6,
    max: 0.3,
    play: (s) => {
      tone(s, { w: 'square', f: 1320, d: 0.07, g: 0.06, lp: 3000 });
      tone(s, { w: 'square', f: 1320, at: 0.12, d: 0.07, g: 0.06, lp: 3000 });
    },
  },

  // ---- world
  coin: {
    gain: 2.0,
    max: 0.45,
    jitter: 0.01,
    play: (s) => {
      tone(s, { w: 'pulse25', f: 988, d: 0.06, g: 0.1, lp: 5000 });
      tone(s, { w: 'pulse25', f: 1319, at: 0.06, d: 0.3, g: 0.1, lp: 5000 });
    },
  },
  pickup: {
    max: 0.35,
    jitter: 0.02,
    play: (s) => {
      tone(s, { w: 'triangle', f: 523, d: 0.05, g: 0.22 });
      tone(s, { w: 'triangle', f: 659, at: 0.05, d: 0.05, g: 0.22 });
      tone(s, { w: 'triangle', f: 1046, at: 0.1, d: 0.14, g: 0.22 });
    },
  },
  pickup_rare: {
    max: 1.4,
    rev: 0.3,
    play: (s) => {
      arp(s, chime, [88, 92, 95, 100, 104], 0.05, 0.6, 0, 0.85);
      noise(s, { ft: 'highpass', f: 7000, a: 0.05, d: 0.7, g: 0.06, mod: [20, 0.4] });
    },
  },
  chest_open: {
    max: 1.5,
    rev: 0.2,
    play: (s) => {
      tone(s, {
        w: 'sawtooth',
        f: 90,
        f2: 140,
        sw: 0.35,
        a: 0.02,
        h: 0.2,
        d: 0.15,
        g: 0.08,
        lp: 600,
        vib: [25, 40],
      });
      noise(s, { ft: 'lowpass', f: 400, at: 0.33, d: 0.1, g: 0.3 });
      arp(s, chime, [84, 88, 91, 96], 0.05, 0.5, 0.4, 0.8);
    },
  },
  door: {
    gain: 1.2,
    max: 0.5,
    play: (s) => {
      noise(s, { ft: 'lowpass', f: 500, d: 0.25, g: 0.5 });
      tone(s, { f: 80, f2: 50, d: 0.25, g: 0.4 });
      tone(s, { w: 'sawtooth', f: 150, f2: 110, at: 0.05, a: 0.03, h: 0.12, d: 0.1, g: 0.05, lp: 800 });
    },
  },
  waypoint_activate: {
    max: 2.6,
    rev: 0.4,
    play: (s) => {
      tone(s, { f: 220, f2: 440, sw: 0.6, a: 0.3, h: 0.3, d: 0.5, g: 0.12, vib: [5, 10] });
      notes(s, bellI, [
        [0.5, 81, 1.4, 0.8],
        [0.56, 85, 1.4, 0.7],
        [0.62, 88, 1.4, 0.7],
        [0.68, 93, 1.4, 0.6],
      ]);
    },
  },
  save: {
    max: 1.7,
    rev: 0.3,
    play: (s) => {
      arp(s, chime, [79, 84, 88, 91, 96], 0.08, 0.7, 0, 0.8);
      notes(s, strings, [
        [0, 60, 0.7, 0.8],
        [0, 64, 0.7, 0.8],
        [0, 67, 0.7, 0.8],
      ]);
    },
  },
  quest_accept: {
    max: 0.9,
    play: (s) => {
      notes(s, fan, [
        [0, 72, 0.1],
        [0.12, 79, 0.35],
      ]);
      notes(s, chime, [[0.12, 91, 0.5, 0.6]]);
    },
  },
  quest_complete: {
    max: 1.7,
    rev: 0.25,
    play: (s) => {
      notes(s, fan, [
        [0, 72, 0.09],
        [0.1, 76, 0.09],
        [0.2, 79, 0.09],
        [0.3, 84, 0.6],
      ]);
      notes(s, fanBrass, [
        [0.3, 60, 0.6, 0.8],
        [0.3, 64, 0.6, 0.8],
        [0.3, 67, 0.6, 0.8],
      ]);
      notes(s, chime, [[0.3, 96, 0.8, 0.6]]);
    },
  },
  shop_buy: {
    gain: 1.6,
    max: 0.7,
    play: (s) => {
      noise(s, { ft: 'highpass', f: 3000, d: 0.03, g: 0.2 });
      tone(s, { w: 'pulse25', f: 1319, d: 0.05, g: 0.1, lp: 5000 });
      tone(s, { w: 'pulse25', f: 1760, at: 0.05, d: 0.3, g: 0.1, lp: 5000 });
      notes(s, chime, [[0.08, 100, 0.4, 0.5]]);
    },
  },
  shop_sell: {
    gain: 1.9,
    max: 0.5,
    play: (s) => {
      tone(s, { w: 'pulse25', f: 1760, d: 0.05, g: 0.1, lp: 5000 });
      tone(s, { w: 'pulse25', f: 1319, at: 0.06, d: 0.06, g: 0.1, lp: 5000 });
      tone(s, { w: 'pulse25', f: 988, at: 0.12, d: 0.22, g: 0.1, lp: 5000 });
    },
  },
  upgrade_success: {
    max: 1.6,
    rev: 0.25,
    play: (s) => {
      notes(s, metal, [[0, 88, 0.4, 1]]);
      noise(s, { ft: 'highpass', f: 3000, d: 0.04, g: 0.3 });
      arp(s, chime, [84, 88, 91, 96, 100], 0.06, 0.6, 0.25, 0.85);
    },
  },
  salvage: {
    gain: 1.6,
    max: 0.6,
    jitter: 0.04,
    play: (s) => {
      for (const at of [0, 0.05, 0.11]) noise(s, { ft: 'bandpass', f: 2500, q: 1, at, d: 0.05, g: 0.45 });
      notes(s, clink, [
        [0, 84, 0.15, 0.7],
        [0.07, 79, 0.15, 0.6],
      ]);
      tone(s, { f: 160, f2: 60, d: 0.12, g: 0.3 });
    },
  },

  // ---- stingers
  stinger_levelup: {
    max: 3.2,
    stinger: true,
    duck: 0.6,
    rev: 0.3,
    play: (s) => {
      mml(s, fan, 'o4 l16 c e g >c e g >c8 r8 <b-8 >c2', 150);
      mml(s, fanBrass, 'o4 r2. {ceg>c}2', 150);
      mml(s, chime, 'o6 r2. c16 e16 g16 >c16 e4', 150);
      mml(s, bassI, 'o3 r2. c2', 150);
    },
  },
  stinger_victory: {
    max: 4.2,
    stinger: true,
    duck: 0.65,
    rev: 0.25,
    play: (s) => {
      mml(s, fan, 'o4 g8 >c8 e8 g4. e8 g8 | a4 b8 >d8 c2', 150);
      mml(s, fanBrass, 'o4 {ceg}2. r4 | {cfa}4 {<b>dg}4 {ceg>c}2', 150);
      mml(s, bassI, 'o3 c4 r4 c4 r4 | f4 g4 c2', 150);
      mml(s, chime, 'o6 r1 | r2 c16 e16 g16 >c16 e4', 150);
      noise(s, { ft: 'highpass', f: 4500, at: 2.4, d: 1.3, g: 0.14 });
    },
  },
  stinger_boss_intro: {
    max: 3.4,
    stinger: true,
    duck: 0.75,
    rev: 0.35,
    play: (s) => {
      tone(s, { f: 62, f2: 30, sw: 1.2, d: 1.4, g: 0.8 });
      noise(s, { ft: 'lowpass', f: 900, f2: 90, sw: 1.2, d: 1.4, g: 0.5, drive: 2 });
      notes(s, { ...P.brass, gain: 0.1, a: 0.01, lp: 900, r: 0.6 }, [
        [0, 36, 1.6],
        [0, 37, 1.6],
        [0, 42, 1.6],
        [0, 43, 1.6],
      ]);
      noise(s, { ft: 'bandpass', f: 200, f2: 3000, sw: 2.3, q: 2, a: 2.0, d: 0.3, g: 0.3 });
      tone(s, { w: 'sawtooth', f: 55, f2: 220, sw: 2.3, a: 2.0, d: 0.3, g: 0.08, lp: 1500 });
      notes(s, { ...P.bell, gain: 0.12 }, [[2.3, 38, 1.0, 1]]);
    },
  },
  stinger_discovery: {
    max: 3.2,
    stinger: true,
    duck: 0.55,
    rev: 0.4,
    play: (s) => {
      arp(s, bellI, [74, 78, 81, 85, 88], 0.12, 1.5, 0, 0.8);
      notes(s, strings, [
        [0.1, 62, 1.8, 0.8],
        [0.1, 69, 1.8, 0.8],
        [0.1, 78, 1.8, 0.7],
      ]);
      notes(s, bassI, [[0.1, 38, 1.6, 0.8]]);
    },
  },
  stinger_legendary: {
    max: 3.8,
    stinger: true,
    duck: 0.6,
    rev: 0.45,
    play: (s) => {
      const pool = [76, 80, 83, 86, 88, 92, 95, 98, 100, 104];
      const list: NoteSpec[] = [];
      for (let i = 0; i < 18; i++)
        list.push([
          i * 0.08 + Math.random() * 0.03,
          pool[(i * 7) % pool.length],
          0.6,
          0.5 + 0.4 * Math.random(),
        ]);
      notes(s, sparkle, list);
      notes(s, strings, [
        [0, 52, 2.2, 0.8],
        [0, 59, 2.2, 0.8],
        [0, 64, 2.2, 0.8],
        [0, 68, 2.2, 0.8],
        [0, 71, 2.2, 0.7],
      ]);
      notes(s, bellI, [
        [0, 76, 2, 0.8],
        [0, 88, 2, 0.6],
      ]);
      noise(s, { ft: 'highpass', f: 8000, a: 0.3, h: 0.8, d: 1.2, g: 0.08, mod: [14, 0.4] });
    },
  },
};

export const SFX_IDS = Object.keys(SFX) as SfxId[];

export interface SfxVoice {
  out: GainNode;
  end: number;
  stinger: boolean;
}

/** Build and start one effect on the mixer's sfx bus at time t. */
export function triggerSfx(
  m: Mixer,
  id: SfxId,
  t: number,
  opts: SfxOptions = {},
  jitter = true,
): SfxVoice | null {
  const def = SFX[id];
  if (!def) return null;
  const ctx = m.ctx;
  const j = jitter && def.jitter ? 1 + (Math.random() * 2 - 1) * def.jitter : 1;
  const p = Math.max(0.1, (opts.pitch ?? 1) * j);
  const out = ctx.createGain();
  out.gain.value = Math.max(0, (opts.volume ?? 1) * (def.gain ?? 1));
  let tail: AudioNode = out;
  if (opts.pan) {
    const pn = ctx.createStereoPanner();
    pn.pan.value = Math.max(-1, Math.min(1, opts.pan));
    out.connect(pn);
    tail = pn;
  }
  tail.connect(m.sfx);
  if (def.rev) {
    const rs = ctx.createGain();
    rs.gain.value = def.rev;
    tail.connect(rs);
    rs.connect(m.sfxRev);
  }
  def.play({ ctx, out, t, p });
  return { out, end: t + def.max / p + 0.1, stinger: !!def.stinger };
}
