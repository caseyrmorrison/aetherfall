/**
 * Procedural chiptune audio engine (Web Audio API): music sequencer + synthesized SFX.
 * No audio files — everything is synthesized. See notation.ts for the song format,
 * songs/ for the compositions, sfx.ts for effects, and tools/preview-audio.html for a test bench.
 */
import { createMixer, type Mixer } from './mixer';
import { compileSong, type CompiledSong } from './notation';
import { SongPlayer } from './sequencer';
import { SFX, triggerSfx, type SfxVoice } from './sfx';
import { SONGS } from './songs';

export type MusicId =
  | 'title'
  | 'town'
  | 'forest'
  | 'cave'
  | 'volcano'
  | 'tundra'
  | 'citadel'
  | 'abyss'
  | 'boss'
  | 'final_boss'
  | 'cutscene_calm'
  | 'cutscene_sad'
  | 'cutscene_tense'
  | 'cutscene_epic'
  | 'victory'
  | 'gameover'
  | 'credits';

export type SfxId =
  // ui
  | 'ui_move'
  | 'ui_select'
  | 'ui_back'
  | 'ui_error'
  | 'ui_open'
  | 'ui_close'
  | 'ui_tab'
  | 'text_blip'
  // player
  | 'swing'
  | 'swing_heavy'
  | 'swing_light'
  | 'staff_bolt'
  | 'dodge'
  | 'footstep'
  | 'hurt'
  | 'low_hp'
  | 'death'
  | 'heal'
  | 'potion'
  | 'equip'
  | 'no_mana'
  // combat
  | 'hit'
  | 'hit_heavy'
  | 'crit'
  | 'enemy_die'
  | 'block'
  | 'arrow_shoot'
  | 'projectile_hit'
  // skills & magic
  | 'dash_slash'
  | 'whirlwind'
  | 'fireball'
  | 'explosion'
  | 'frost_nova'
  | 'ice_shard'
  | 'lightning'
  | 'blades'
  | 'meteor_fall'
  | 'surge_cutin'
  | 'surge_blast'
  | 'charge_up'
  | 'teleport'
  | 'summon'
  | 'roar'
  | 'slam'
  | 'fire_breath'
  | 'void_pulse'
  | 'telegraph'
  // world
  | 'coin'
  | 'pickup'
  | 'pickup_rare'
  | 'chest_open'
  | 'door'
  | 'waypoint_activate'
  | 'save'
  | 'quest_accept'
  | 'quest_complete'
  | 'shop_buy'
  | 'shop_sell'
  | 'upgrade_success'
  | 'salvage'
  // stingers (short musical phrases; duck the music while playing)
  | 'stinger_levelup'
  | 'stinger_victory'
  | 'stinger_boss_intro'
  | 'stinger_discovery'
  | 'stinger_legendary';

export interface AudioVolumes {
  /** 0..1 */
  master: number;
  music: number;
  sfx: number;
}

export interface SfxOptions {
  /** Multiplier, default 1. */
  volume?: number;
  /** Playback-rate / pitch multiplier, default 1. */
  pitch?: number;
  /** Stereo pan -1..1, default 0. */
  pan?: number;
}

/** Scheduler tick (ms) and minimum look-ahead (s). */
const TICK_MS = 25;
const LOOKAHEAD = 0.12;
/** Concurrent SFX voice cap and same-id dedupe window (s). */
const MAX_SFX = 24;
const DEDUPE = 0.03;

const compiledCache = new Map<MusicId, CompiledSong>();

/** Compile (and cache) a song. Warnings from the notation compiler are on `.warnings`. */
export function getCompiledSong(id: MusicId): CompiledSong {
  let c = compiledCache.get(id);
  if (!c) {
    c = compileSong(SONGS[id]);
    compiledCache.set(id, c);
    if (c.warnings.length && import.meta.env?.DEV) console.warn(`[audio] ${id}:`, c.warnings);
  }
  return c;
}

const clamp01 = (v: number): number => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private mixer: Mixer | null = null;
  private _music: MusicId | null = null;
  private player: SongPlayer | null = null;
  private fading: { p: SongPlayer; end: number }[] = [];
  private intensity = 0;
  private volumes: AudioVolumes = { master: 0.8, music: 0.6, sfx: 0.8 };
  private suspended = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastTick = 0;
  private voices: SfxVoice[] = [];
  private lastSfx = new Map<SfxId, number>();

  /** Must be called from a user gesture (click / keydown / touch) to start the AudioContext. */
  unlock(): void {
    if (this.ctx) {
      if (!this.suspended && this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
      return;
    }
    if (typeof window === 'undefined') return;
    const AC: typeof AudioContext | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC({ latencyHint: 'interactive' });
    } catch {
      return;
    }
    this.mixer = createMixer(this.ctx);
    this.applyVolumes(true);
    if (this.suspended) this.ctx.suspend().catch(() => {});
    else if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
    this.timer = setInterval(() => this.tick(), TICK_MS);
    if (this._music) this.startMusic(this._music, 0.4);
  }

  get unlocked(): boolean {
    return this.ctx !== null && (this.ctx.state === 'running' || this.suspended);
  }

  get currentMusic(): MusicId | null {
    return this._music;
  }

  /** Crossfade to a track. No-op if it is already playing (unless restart). */
  playMusic(id: MusicId, opts: { fade?: number; restart?: boolean } = {}): void {
    if (!SONGS[id]) return;
    if (id === this._music && !opts.restart && (this.player || !this.ctx)) return;
    this._music = id;
    if (!this.ctx) return; // remembered; starts on unlock
    this.startMusic(id, opts.fade ?? 1);
  }

  stopMusic(fade = 1): void {
    this._music = null;
    this.retirePlayer(fade);
  }

  /** 0 = calm exploration, 1 = combat. Smoothly brings in percussion/bass layers. */
  setIntensity(value: number): void {
    const v = clamp01(value);
    if (Math.abs(v - this.intensity) < 1e-3) return;
    this.intensity = v;
    this.player?.setIntensity(v);
  }

  playSfx(id: SfxId, opts: SfxOptions = {}): void {
    const ctx = this.ctx;
    const m = this.mixer;
    if (!ctx || !m || this.suspended || ctx.state !== 'running') return;
    const def = SFX[id];
    if (!def) return;
    const now = ctx.currentTime;
    const last = this.lastSfx.get(id);
    if (last !== undefined && now - last < DEDUPE && now >= last) return;
    this.lastSfx.set(id, now);

    this.reapVoices(now);
    if (this.voices.length >= MAX_SFX) {
      // steal the oldest non-stinger voice (fallback: oldest)
      let k = this.voices.findIndex((v) => !v.stinger);
      if (k < 0) k = 0;
      const [victim] = this.voices.splice(k, 1);
      victim.out.gain.cancelScheduledValues(now);
      victim.out.gain.setValueAtTime(victim.out.gain.value, now);
      victim.out.gain.linearRampToValueAtTime(0, now + 0.03);
      setTimeout(() => victim.out.disconnect(), 80);
    }
    const v = triggerSfx(m, id, now + 0.005, opts);
    if (!v) return;
    this.voices.push(v);
    if (def.duck) this.duckMusic(def.duck, Math.max(0.3, def.max * 0.75));
  }

  setVolumes(v: AudioVolumes): void {
    this.volumes = { master: clamp01(v.master), music: clamp01(v.music), sfx: clamp01(v.sfx) };
    this.applyVolumes(false);
  }

  /** Temporarily lower music volume (e.g. during stingers). */
  duckMusic(amount: number, seconds: number): void {
    const ctx = this.ctx;
    const m = this.mixer;
    if (!ctx || !m) return;
    const g = m.duck.gain;
    const now = ctx.currentTime;
    const lvl = Math.max(0.0001, 1 - clamp01(amount));
    const hold = Math.max(0, seconds);
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(lvl, now + 0.08);
    g.setValueAtTime(lvl, now + 0.08 + hold);
    g.linearRampToValueAtTime(1, now + 0.08 + hold + 0.9);
  }

  /** Pause/resume everything (e.g. when the tab is hidden). */
  setSuspended(suspended: boolean): void {
    this.suspended = suspended;
    const ctx = this.ctx;
    if (!ctx) return;
    if (suspended) ctx.suspend().catch(() => {});
    else {
      this.lastTick = 0;
      ctx.resume().catch(() => {});
    }
  }

  /** Tear down the AudioContext (tests / hot reload). The engine can be unlocked again afterwards. */
  dispose(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.player?.dispose();
    this.player = null;
    for (const f of this.fading) f.p.dispose();
    this.fading = [];
    this.voices = [];
    this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.mixer = null;
  }

  /** Current intensity (0..1). */
  get currentIntensity(): number {
    return this.intensity;
  }

  /** The AudioContext, once unlocked (for debugging / tools). */
  get context(): AudioContext | null {
    return this.ctx;
  }

  // -------------------------------------------------------------------------------------------

  private startMusic(id: MusicId, fade: number): void {
    const ctx = this.ctx;
    const m = this.mixer;
    if (!ctx || !m) return;
    this.retirePlayer(fade);
    const song = getCompiledSong(id);
    const t0 = ctx.currentTime + 0.06;
    this.player = new SongPlayer(m, song, t0, this.intensity, Math.max(0, fade));
    this.player.schedule(ctx.currentTime + LOOKAHEAD);
  }

  private retirePlayer(fade: number): void {
    const p = this.player;
    if (!p) return;
    this.player = null;
    const end = p.fadeOut(Math.max(0.05, fade));
    this.fading.push({ p, end });
  }

  private tick(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const nowMs = performance.now();
    const gap = this.lastTick ? (nowMs - this.lastTick) / 1000 : TICK_MS / 1000;
    this.lastTick = nowMs;
    // Adaptive look-ahead: if the timer is being throttled (background tab), schedule further ahead.
    const ahead = Math.min(1.5, Math.max(LOOKAHEAD, gap * 1.6));
    const now = ctx.currentTime;
    const until = now + ahead;
    this.player?.schedule(until);
    if (this.fading.length) {
      this.fading = this.fading.filter((f) => {
        if (now > f.end + 0.1) {
          f.p.dispose();
          return false;
        }
        f.p.schedule(Math.min(until, f.end));
        return true;
      });
    }
    if (this.voices.length) this.reapVoices(now);
  }

  private reapVoices(now: number): void {
    if (!this.voices.length) return;
    const keep: SfxVoice[] = [];
    for (const v of this.voices) {
      if (v.end < now) v.out.disconnect();
      else keep.push(v);
    }
    this.voices = keep;
  }

  private applyVolumes(immediate: boolean): void {
    const ctx = this.ctx;
    const m = this.mixer;
    if (!ctx || !m) return;
    const now = ctx.currentTime;
    const set = (p: AudioParam, v: number): void => {
      if (immediate) p.value = v;
      else {
        p.cancelScheduledValues(now);
        p.setTargetAtTime(v, now, 0.03);
      }
    };
    set(m.master.gain, this.volumes.master);
    set(m.music.gain, this.volumes.music);
    set(m.sfx.gain, this.volumes.sfx);
  }
}

export const audio = new AudioEngine();

/**
 * Convenience: unlock audio on the first user gesture. Returns a function that removes the listeners.
 */
export function installAutoUnlock(engine: AudioEngine = audio, target: EventTarget = window): () => void {
  const events = ['pointerdown', 'keydown', 'touchend', 'mousedown'];
  const handler = (): void => {
    engine.unlock();
    if (engine.unlocked) remove();
  };
  const remove = (): void => events.forEach((e) => target.removeEventListener(e, handler, true));
  events.forEach((e) => target.addEventListener(e, handler, true));
  return remove;
}

export { MUSIC_IDS } from './songs';
export { SFX_IDS } from './sfx';
