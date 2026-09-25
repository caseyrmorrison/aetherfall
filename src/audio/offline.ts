/**
 * Offline rendering + level analysis (used by tools/preview-audio.html). Renders through the exact
 * same mixer/synth code as the live engine, so the numbers reflect what players hear.
 */
import { getCompiledSong, type MusicId, type SfxId } from './index';
import { createMixer, type Mixer } from './mixer';
import { SongPlayer } from './sequencer';
import { SFX, triggerSfx } from './sfx';

export interface Analysis {
  peak: number;
  peakDb: number;
  rms: number;
  rmsDb: number;
  /** seconds until the signal falls permanently below -60 dBFS */
  tail: number;
  nan: boolean;
  clipped: number;
}

const SR = 44100;

function offlineMixer(seconds: number, sr = SR): { ctx: OfflineAudioContext; m: Mixer } {
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * sr), sr);
  const m = createMixer(ctx);
  // unity volumes for worst-case analysis
  m.master.gain.value = 1;
  m.music.gain.value = 1;
  m.sfx.gain.value = 1;
  return { ctx, m };
}

export async function renderSfx(id: SfxId, pitch = 1): Promise<AudioBuffer> {
  const def = SFX[id];
  const { ctx, m } = offlineMixer(def.max + 1.0);
  triggerSfx(m, id, 0.01, { pitch }, false);
  return ctx.startRendering();
}

export async function renderMusic(
  id: MusicId,
  seconds: number,
  intensity: number,
  fromLoop = false,
): Promise<AudioBuffer> {
  const song = getCompiledSong(id);
  const { ctx, m } = offlineMixer(seconds);
  const p = new SongPlayer(m, song, 0.02, intensity, 0, fromLoop ? representativeBeat(id) : 0);
  p.schedule(seconds);
  return ctx.startRendering();
}

/** Render one track of a song solo (for mix balancing). */
export async function renderTrackSolo(
  id: MusicId,
  track: number,
  seconds: number,
  intensity: number,
  startBeat: number,
): Promise<AudioBuffer> {
  const song = getCompiledSong(id);
  const events = song.events.filter((e) => e.k === track);
  let loopIdx = events.findIndex((e) => e.t >= song.loopStart - 1e-6);
  if (loopIdx < 0) loopIdx = events.length;
  const { ctx, m } = offlineMixer(seconds);
  const p = new SongPlayer(m, { ...song, events, loopIdx }, 0.02, intensity, 0, startBeat);
  p.schedule(seconds);
  return ctx.startRendering();
}

/** A representative start beat for balancing: the loop point, or the 2nd section if the song loops from its start. */
export function representativeBeat(id: MusicId): number {
  const song = getCompiledSong(id);
  const def = song.def;
  if (song.loopStart > 0 || def.order.length < 2) return song.loopStart;
  return def.sections[def.order[0]].bars * (def.bpb ?? 4);
}

const db = (x: number): number => (x > 0 ? 20 * Math.log10(x) : -Infinity);

export function analyze(buf: AudioBuffer, skip = 0): Analysis {
  let peak = 0;
  let sum = 0;
  let n = 0;
  let nan = false;
  let clipped = 0;
  let lastLoud = 0;
  const thr = 0.001; // -60 dBFS
  const start = Math.floor(skip * buf.sampleRate);
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < d.length; i++) {
      const x = d[i];
      if (!Number.isFinite(x)) {
        nan = true;
        continue;
      }
      const a = Math.abs(x);
      if (a > peak) peak = a;
      if (a > 0.99) clipped++;
      if (a > thr && i > lastLoud) lastLoud = i;
      if (i >= start) {
        sum += x * x;
        n++;
      }
    }
  }
  const rms = Math.sqrt(sum / Math.max(1, n));
  return { peak, peakDb: db(peak), rms, rmsDb: db(rms), tail: lastLoud / buf.sampleRate, nan, clipped };
}

/** RMS over the active part only (ignores leading/trailing silence) — better for short SFX. */
export function activeRms(buf: AudioBuffer): number {
  const d0 = buf.getChannelData(0);
  const d1 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : d0;
  let sum = 0;
  let n = 0;
  for (let i = 0; i < d0.length; i++) {
    const x = Math.max(Math.abs(d0[i]), Math.abs(d1[i]));
    if (x > 0.003) {
      sum += x * x;
      n++;
    }
  }
  return Math.sqrt(sum / Math.max(1, n));
}
