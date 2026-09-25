/**
 * Anime-style (PC-98 inspired) portraits, cutscene illustrations and cut-ins.
 *
 * Everything is rendered by a small indexed-color software rasterizer
 * (raster.ts) into offscreen canvases: crisp, palette-only pixels with
 * ordered dithering, cached per (id, expression, flags, size). Illustrations
 * cache their static layers per (id, w, h) and only animate overlays.
 *
 * All functions draw into the provided 2D context, which is the game's LOW-RES
 * canvas (height ~270px, width 400-640px) that is later upscaled with
 * nearest-neighbour filtering.
 */

import { clearPortraitCache, getPortrait } from './portrait';
import { flags as kaiFlags } from './characters/kai';
import { ILLUS } from './illustrations';
import { beginFrame } from './illustrations/kit';
import { cutIn, cutInLength } from './cutins';
import { speedLines } from './fx';

export type PortraitId = 'kai' | 'lyra' | 'maren' | 'brom' | 'mira' | 'seraphine' | 'malachar';

export type Expression =
  'neutral' | 'happy' | 'sad' | 'angry' | 'surprised' | 'determined' | 'hurt' | 'smirk';

export interface PortraitOptions {
  /** Mouth open frame for talking animation. */
  talking?: boolean;
  /** Eyes closed frame for blinking. */
  blink?: boolean;
  /** Mirror horizontally (character faces left instead of right). */
  flip?: boolean;
}

export type IllustrationId =
  | 'title'
  | 'sky_shatter'
  | 'kai_awakens'
  | 'shard_fusion'
  | 'lyra_arrives'
  | 'malachar_reveal'
  | 'seraphine_memory'
  | 'final_clash'
  | 'ending_dawn';

export type CutInId = 'kai_surge' | 'lyra_support' | 'malachar_rage';

export const PORTRAIT_IDS: readonly PortraitId[] = [
  'kai',
  'lyra',
  'maren',
  'brom',
  'mira',
  'seraphine',
  'malachar',
];
export const EXPRESSIONS: readonly Expression[] = [
  'neutral',
  'happy',
  'sad',
  'angry',
  'surprised',
  'determined',
  'hurt',
  'smirk',
];
export const ILLUSTRATION_IDS: readonly IllustrationId[] = [
  'title',
  'sky_shatter',
  'kai_awakens',
  'shard_fusion',
  'lyra_arrives',
  'malachar_reveal',
  'seraphine_memory',
  'final_clash',
  'ending_dawn',
];
export const CUTIN_IDS: readonly CutInId[] = ['kai_surge', 'lyra_support', 'malachar_rage'];

/** Draw a bust portrait (head + shoulders) fitted into the rect. */
export function drawPortrait(
  ctx: CanvasRenderingContext2D,
  id: PortraitId,
  expr: Expression,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: PortraitOptions = {},
): void {
  const c = getPortrait(id, expr, w, h, opts);
  const prev = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(c, Math.round(x), Math.round(y));
  ctx.imageSmoothingEnabled = prev;
}

/**
 * Optional: warm the portrait cache (e.g. before a dialogue starts) so the
 * first frames never hitch. Renders every expression with talking / blink.
 */
export function preloadPortraits(
  ids: readonly PortraitId[],
  w: number,
  h: number,
  exprs: readonly Expression[] = EXPRESSIONS,
  flip = false,
): void {
  for (const id of ids) {
    for (const e of exprs) {
      for (const talking of [false, true]) {
        for (const blink of [false, true]) getPortrait(id, e, w, h, { talking, blink, flip });
      }
    }
  }
}

/**
 * Story-dependent portrait details. `kaiMark`: the faint cyan shard mark under
 * Kai's left eye (default true; set false for scenes before the fusion).
 */
export function setPortraitFlags(f: { kaiMark?: boolean }): void {
  if (f.kaiMark !== undefined && f.kaiMark !== kaiFlags.kaiMark) {
    kaiFlags.kaiMark = f.kaiMark;
    clearPortraitCache();
  }
}

/** Draw a full-screen animated illustration. `t` = seconds since the shot began. */
export function drawIllustration(
  ctx: CanvasRenderingContext2D,
  id: IllustrationId,
  t: number,
  w: number,
  h: number,
): void {
  w = Math.round(w);
  h = Math.round(h);
  const fn = ILLUS[id] ?? ILLUS.title;
  beginFrame();
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.clip();
  fn(ctx, Math.max(0, t), w, h);
  ctx.restore();
}

/**
 * Optional: pre-render every cached layer / animation frame of an illustration
 * at this size (e.g. during a fade-out) so the first frames never hitch.
 */
export function preloadIllustration(id: IllustrationId, w: number, h: number, seconds = 8): void {
  const c = document.createElement('canvas');
  c.width = Math.round(w);
  c.height = Math.round(h);
  const ctx = c.getContext('2d')!;
  const fn = ILLUS[id] ?? ILLUS.title;
  for (let t = 0; t <= seconds; t += 1 / 12) {
    beginFrame(true);
    fn(ctx, t, c.width, c.height);
  }
}

/** Total duration (seconds) of a cut-in animation. */
export function cutInDuration(id: CutInId): number {
  return cutInLength(id);
}

/** Draw an ultimate-attack style cut-in over the current frame. `t` in [0, cutInDuration]. */
export function drawCutIn(ctx: CanvasRenderingContext2D, id: CutInId, t: number, w: number, h: number): void {
  beginFrame();
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  cutIn(ctx, id, t, Math.round(w), Math.round(h));
  ctx.restore();
}

/** Optional: pre-render a cut-in's cached layers at this size (first use costs ~20-40ms otherwise). */
export function preloadCutIn(id: CutInId, w: number, h: number): void {
  const c = document.createElement('canvas');
  c.width = Math.round(w);
  c.height = Math.round(h);
  const ctx = c.getContext('2d')!;
  for (let t = 0; t < cutInLength(id); t += 1 / 15) cutIn(ctx, id, t, c.width, c.height);
}

/** Anime "focus lines" converging on (cx, cy). `t` animates the lines. */
export function drawSpeedLines(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  t: number,
  color = '#ffffff',
  density = 1,
): void {
  speedLines(ctx, cx, cy, w, h, t, color, density);
}
