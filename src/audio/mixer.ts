/**
 * Bus graph shared by live and offline rendering:
 *
 *   music tracks ─► music (volume) ─► duck ─┐
 *   music sends ─► musicRev (convolver) ─► music
 *   sfx voices  ─► sfx (volume) ────────────┼─► master ─► limiter (DynamicsCompressor) ─► destination
 *   sfx sends   ─► sfxRev (convolver) ─► sfx
 */
import type { Ctx } from './synth';

export interface Mixer {
  ctx: Ctx;
  master: GainNode;
  limiter: DynamicsCompressorNode;
  music: GainNode;
  duck: GainNode;
  sfx: GainNode;
  /** reverb send inputs */
  musicRev: GainNode;
  sfxRev: GainNode;
}

const irCache = new WeakMap<Ctx, Map<string, AudioBuffer>>();

/** Generated noise impulse: exponential decay, darkening over time, energy-normalised. */
function impulse(ctx: Ctx, seconds: number, decay: number): AudioBuffer {
  let byKey = irCache.get(ctx);
  if (!byKey) irCache.set(ctx, (byKey = new Map()));
  const key = `${seconds}:${decay}`;
  const cached = byKey.get(key);
  if (cached) return cached;
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * seconds);
  const buf = ctx.createBuffer(2, len, sr);
  const pre = Math.floor(sr * 0.012);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    let energy = 0;
    for (let i = pre; i < len; i++) {
      const t = (i - pre) / sr;
      const k = 0.85 - 0.75 * (t / seconds); // progressively darker tail
      lp += (Math.random() * 2 - 1 - lp) * k;
      const v = lp * Math.exp(-t * decay);
      d[i] = v;
      energy += v * v;
    }
    const norm = 1 / Math.sqrt(energy || 1);
    for (let i = 0; i < len; i++) d[i] *= norm;
  }
  byKey.set(key, buf);
  return buf;
}

export function createMixer(ctx: Ctx): Mixer {
  const master = ctx.createGain();
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -6;
  limiter.knee.value = 5;
  limiter.ratio.value = 16;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.2;
  master.connect(limiter);
  limiter.connect(ctx.destination);

  const music = ctx.createGain();
  const duck = ctx.createGain();
  music.connect(duck);
  duck.connect(master);

  const sfx = ctx.createGain();
  sfx.connect(master);

  const mk = (ret: AudioNode, level: number, ir: AudioBuffer): GainNode => {
    const send = ctx.createGain();
    const conv = ctx.createConvolver();
    conv.normalize = false;
    conv.buffer = ir;
    const g = ctx.createGain();
    g.gain.value = level;
    send.connect(conv);
    conv.connect(g);
    g.connect(ret);
    return send;
  };
  // music: lush ~2.4 s hall; sfx: tighter ~1.2 s room so effects stay punchy and short
  const musicRev = mk(music, 0.9, impulse(ctx, 2.4, 2.6));
  const sfxRev = mk(sfx, 0.8, impulse(ctx, 1.2, 4.5));
  return { ctx, master, limiter, music, duck, sfx, musicRev, sfxRev };
}
