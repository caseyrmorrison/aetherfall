/**
 * Song player: schedules compiled note events on the AudioContext clock.
 * `schedule(until)` is called from a look-ahead timer live, or once with a large horizon offline.
 */
import type { Mixer } from './mixer';
import type { CompiledSong, TrackDef } from './notation';
import { filter, playNote } from './synth';

interface TrackRt {
  def: TrackDef;
  input: GainNode;
  layer: GainNode;
  range: [number, number] | null;
  /** current layer target and when the ramp settles (to skip silent layers) */
  target: number;
  settle: number;
}

const LAYER_TC = 0.5; // setTargetAtTime constant -> ~1.5 s to reach 95%

function layerRange(def: TrackDef): [number, number] | null {
  if (!def.layer) return null;
  if (def.layer === 'hi') return [0, 1];
  if (def.layer === 'lo') return [1, 0.35];
  return def.layer;
}

export class SongPlayer {
  readonly song: CompiledSong;
  private readonly m: Mixer;
  private readonly tracks: TrackRt[];
  /** fade gains (dry + reverb return) */
  private readonly fades: GainNode[];
  private readonly extra: AudioNode[] = [];
  private idx: number;
  private base: number;
  private level: number;
  stopped = false;

  constructor(m: Mixer, song: CompiledSong, t0: number, intensity: number, fadeIn: number, startBeat = 0) {
    this.m = m;
    this.song = song;
    const ctx = m.ctx;
    const def = song.def;
    this.level = def.gain ?? 1;

    const dry = ctx.createGain();
    const wet = ctx.createGain();
    this.fades = [dry, wet];
    for (const g of this.fades) {
      g.gain.setValueAtTime(fadeIn > 0 ? 0 : this.level, 0);
      g.gain.setValueAtTime(fadeIn > 0 ? 0 : this.level, t0);
      if (fadeIn > 0) g.gain.linearRampToValueAtTime(this.level, t0 + fadeIn);
    }
    dry.connect(m.music);
    wet.connect(m.musicRev);

    let dlyIn: GainNode | null = null;
    if (def.delay) {
      dlyIn = ctx.createGain();
      const dl = ctx.createDelay(2);
      dl.delayTime.value = Math.min(1.9, def.delay.beats * song.spb);
      const fb = ctx.createGain();
      fb.gain.value = def.delay.fb;
      const lp = filter(ctx, 'lowpass', def.delay.lp ?? 2400, 0.5);
      dlyIn.connect(dl);
      dl.connect(lp);
      lp.connect(fb);
      fb.connect(dl);
      lp.connect(dry);
      const toRev = ctx.createGain();
      toRev.gain.value = 0.3;
      lp.connect(toRev);
      toRev.connect(wet);
      this.extra.push(dlyIn, dl, fb, lp, toRev);
    }

    this.tracks = song.tracks.map((td) => {
      const input = ctx.createGain();
      input.gain.value = td.vol ?? 1;
      const layer = ctx.createGain();
      const range = layerRange(td);
      const target = range ? range[0] + (range[1] - range[0]) * intensity : 1;
      layer.gain.value = target;
      input.connect(layer);
      let tail: AudioNode = layer;
      if (td.pan) {
        const p = ctx.createStereoPanner();
        p.pan.value = td.pan;
        layer.connect(p);
        tail = p;
      }
      tail.connect(dry);
      if (td.rev) {
        const s = ctx.createGain();
        s.gain.value = td.rev;
        tail.connect(s);
        s.connect(wet);
      }
      if (td.dly && dlyIn) {
        const s = ctx.createGain();
        s.gain.value = td.dly;
        tail.connect(s);
        s.connect(dlyIn);
      }
      return { def: td, input, layer, range, target, settle: 0 };
    });

    // seek
    this.base = t0 - startBeat * song.spb;
    this.idx = song.events.findIndex((e) => e.t >= startBeat - 1e-6);
    if (this.idx < 0) this.idx = song.events.length;
  }

  setIntensity(v: number): void {
    const ctx = this.m.ctx;
    const now = ctx.currentTime;
    for (const tr of this.tracks) {
      if (!tr.range) continue;
      const target = tr.range[0] + (tr.range[1] - tr.range[0]) * v;
      if (Math.abs(target - tr.target) < 1e-4) continue;
      tr.target = target;
      tr.settle = now + LAYER_TC * 6;
      tr.layer.gain.cancelScheduledValues(now);
      tr.layer.gain.setTargetAtTime(target, now, LAYER_TC);
    }
  }

  /** Schedule every event starting before `until` (context seconds). */
  schedule(until: number): void {
    if (this.stopped) return;
    const { events, spb, total, loopStart, loopIdx } = this.song;
    if (!events.length) return;
    const ctx = this.m.ctx;
    const now = ctx.currentTime;
    for (let guard = 0; guard < 20000; guard++) {
      if (this.idx >= events.length) {
        if (total - loopStart <= 0 || loopIdx >= events.length) return;
        this.base += (total - loopStart) * spb;
        this.idx = loopIdx;
      }
      const e = events[this.idx];
      const t = this.base + e.t * spb;
      if (t >= until) return;
      this.idx++;
      if (t < now - 0.06) continue; // hopelessly late (e.g. after a stall) -> skip
      const tr = this.tracks[e.k];
      if (tr.target < 0.005 && now >= tr.settle) continue; // silent layer
      const at = Math.max(t, now);
      for (const n of e.n) playNote(ctx, tr.input, tr.def.inst, at, e.d * spb, n, e.v);
    }
  }

  /** Fade out; returns the time the fade completes. */
  fadeOut(dur: number): number {
    const now = this.m.ctx.currentTime;
    dur = Math.max(0.02, dur);
    for (const g of this.fades) {
      const v = g.gain.value;
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(v, now);
      g.gain.linearRampToValueAtTime(0, now + dur);
    }
    return now + dur;
  }

  dispose(): void {
    this.stopped = true;
    for (const g of this.fades) g.disconnect();
    for (const n of this.extra) n.disconnect();
    for (const tr of this.tracks) tr.layer.disconnect();
  }
}
