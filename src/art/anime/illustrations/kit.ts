/**
 * Shared toolkit for full-screen illustrations and cut-ins: cached static
 * layers, lazily generated animation frame sets (bounded work per frame),
 * crisp (non anti-aliased) polygon fills on a 2D context, ordered-dither
 * overlay patterns, 1D noise, star fields, crystals and glow sprites.
 */
import { makeCanvas } from '../../pixel/core';
import { C, HEX } from '../pal';
import { Raster, rgrad, type Ink } from '../raster';
import { clamp, rng } from '../geom';

/* ------------------------------------------------------------ caching */

const layerCache = new Map<string, HTMLCanvasElement>();
const MAX_LAYERS = 400;
/** Pixel budget for all cached layers (~64 MB of RGBA). */
const MAX_PIXELS = 16_000_000;
let cachedPixels = 0;

/** LRU lookup: move a hit to the most-recent end. */
function touch(key: string): HTMLCanvasElement | undefined {
  const hit = layerCache.get(key);
  if (hit) {
    layerCache.delete(key);
    layerCache.set(key, hit);
  }
  return hit;
}

function remember(key: string, c: HTMLCanvasElement): HTMLCanvasElement {
  const px = c.width * c.height;
  while (layerCache.size > 0 && (layerCache.size >= MAX_LAYERS || cachedPixels + px > MAX_PIXELS)) {
    const oldKey = layerCache.keys().next().value as string;
    const old = layerCache.get(oldKey)!;
    cachedPixels -= old.width * old.height;
    layerCache.delete(oldKey);
  }
  layerCache.set(key, c);
  cachedPixels += px;
  return c;
}

/** Cached static layer rendered with the software rasterizer. */
export function layer(key: string, w: number, h: number, draw: (r: Raster) => void): HTMLCanvasElement {
  const k = `${key}|${w}x${h}`;
  const hit = touch(k);
  if (hit) return hit;
  const r = new Raster(w, h);
  draw(r);
  return remember(k, r.toCanvas());
}

/** Cached layer painted directly with a 2D context. */
export function layerCtx(
  key: string,
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): HTMLCanvasElement {
  const k = `${key}|${w}x${h}`;
  const hit = touch(k);
  if (hit) return hit;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  draw(ctx);
  return remember(k, c);
}

let budget = 1;
/** Called at the start of every drawIllustration / drawCutIn. */
export function beginFrame(unlimited = false): void {
  budget = unlimited ? Infinity : 1;
}

/**
 * Animation frames rendered lazily: at most one new frame is generated per
 * displayed frame (keeps every frame cheap); missing frames fall back to the
 * nearest generated one.
 */
export function frame(
  key: string,
  i: number,
  count: number,
  w: number,
  h: number,
  draw: (r: Raster, i: number) => void,
): HTMLCanvasElement {
  const idx = ((i % count) + count) % count;
  const k = `${key}#${idx}|${w}x${h}`;
  const hit = touch(k);
  if (hit) return hit;
  if (budget > 0) {
    budget--;
    const r = new Raster(w, h);
    draw(r, idx);
    return remember(k, r.toCanvas());
  }
  for (let d = 1; d < count; d++) {
    for (const j of [idx - d, idx + d]) {
      const jj = ((j % count) + count) % count;
      const alt = layerCache.get(`${key}#${jj}|${w}x${h}`);
      if (alt) return alt;
    }
  }
  // nothing yet: render anyway (first frame of a shot)
  const r = new Raster(w, h);
  draw(r, idx);
  return remember(k, r.toCanvas());
}

/* ------------------------------------------------------ crisp ctx fills */

const xs = new Float64Array(256);

/** Fill a polygon (pixel space, flat array) on a 2D context with crisp 1px spans. */
export function fillPolyCtx(
  ctx: CanvasRenderingContext2D,
  p: ArrayLike<number>,
  style: string | CanvasPattern,
  W = 4096,
  H = 4096,
): void {
  const n = p.length >> 1;
  if (n < 3) return;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 1; i < p.length; i += 2) {
    minY = Math.min(minY, p[i]);
    maxY = Math.max(maxY, p[i]);
  }
  ctx.fillStyle = style;
  const y0 = Math.max(0, Math.ceil(minY - 0.5));
  const y1 = Math.min(H - 1, Math.floor(maxY - 0.5));
  for (let y = y0; y <= y1; y++) {
    const sy = y + 0.5;
    let cnt = 0;
    for (let i = 0; i < n; i++) {
      const j = i === n - 1 ? 0 : i + 1;
      const ya = p[i * 2 + 1];
      const yb = p[j * 2 + 1];
      if ((ya <= sy && yb > sy) || (yb <= sy && ya > sy)) {
        const x = p[i * 2] + ((sy - ya) * (p[j * 2] - p[i * 2])) / (yb - ya);
        let k = cnt++;
        while (k > 0 && xs[k - 1] > x) {
          xs[k] = xs[k - 1];
          k--;
        }
        xs[k] = x;
        if (cnt >= 255) break;
      }
    }
    for (let k = 0; k + 1 < cnt; k += 2) {
      const a = Math.max(0, Math.ceil(xs[k] - 0.5));
      const b = Math.min(W - 1, Math.floor(xs[k + 1] - 0.5));
      if (b >= a) ctx.fillRect(a, y, b - a + 1, 1);
    }
  }
}

/** Crisp 1px line on a 2D context. */
export function lineCtx(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  style: string | CanvasPattern,
  w = 1,
): void {
  ctx.fillStyle = style;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  const hw = Math.floor(w / 2);
  let lx = NaN;
  let ly = NaN;
  for (let i = 0; i <= steps; i++) {
    const x = Math.floor(x0 + ((x1 - x0) * i) / steps);
    const y = Math.floor(y0 + ((y1 - y0) * i) / steps);
    if (x === lx && y === ly) continue;
    lx = x;
    ly = y;
    ctx.fillRect(x - hw, y - hw, w, w);
  }
}

/* --------------------------------------------------- dither patterns */

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const patCache = new Map<string, CanvasPattern | null>();
const patCanvases = new Map<string, HTMLCanvasElement>();

/** 4x4 Bayer pattern of `color` covering level/16 of the pixels (rest transparent). */
export function ditherPat(
  ctx: CanvasRenderingContext2D,
  color: number | string,
  level: number,
): CanvasPattern | string {
  const hex = typeof color === 'number' ? HEX[color] : color;
  const lv = clamp(Math.round(level), 0, 16);
  if (lv >= 16) return hex;
  const key = `${hex}|${lv}`;
  let c = patCanvases.get(key);
  if (!c) {
    c = makeCanvas(4, 4);
    const g = c.getContext('2d')!;
    g.fillStyle = hex;
    for (let i = 0; i < 16; i++) if (BAYER4[i] < lv) g.fillRect(i & 3, i >> 2, 1, 1);
    patCanvases.set(key, c);
  }
  // patterns are context-bound in some browsers; cache per canvas element
  const ck = `${key}|${(ctx.canvas as HTMLCanvasElement & { __pid?: number }).__pid ?? assignPid(ctx.canvas as HTMLCanvasElement)}`;
  let p = patCache.get(ck);
  if (p === undefined) {
    p = ctx.createPattern(c, 'repeat');
    patCache.set(ck, p);
  }
  return p ?? hex;
}

let pidCounter = 1;
function assignPid(c: HTMLCanvasElement & { __pid?: number }): number {
  c.__pid = pidCounter++;
  return c.__pid;
}

/** Ordered-dither overlay of `color` at `amount` (0..1) over a rect. */
export function fade(
  ctx: CanvasRenderingContext2D,
  color: number | string,
  amount: number,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const lv = Math.round(clamp(amount, 0, 1) * 16);
  if (lv <= 0) return;
  ctx.fillStyle = ditherPat(ctx, color, lv);
  ctx.fillRect(x, y, w, h);
}

/* --------------------------------------------------------------- noise */

function hash1(i: number, seed: number): number {
  let h = (i * 374761393 + seed * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Smooth 1D value noise in [0,1]. */
export function noise1(x: number, seed = 0): number {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return hash1(i, seed) * (1 - u) + hash1(i + 1, seed) * u;
}

/** Fractal ridge height at x (sum of octaves, roughly -1..1). */
export function fbm(x: number, seed: number, oct = 4): number {
  let a = 1;
  let f = 1;
  let s = 0;
  let n = 0;
  for (let i = 0; i < oct; i++) {
    s += (noise1(x * f, seed + i * 17) * 2 - 1) * a;
    n += a;
    a *= 0.5;
    f *= 2.1;
  }
  return s / n;
}

/**
 * Fill a mountain/hill silhouette: for each column x, from ridge(x) down to
 * the bottom. `ridgeY(xFromCenter)` returns the ridge height.
 */
export function silhouette(
  r: Raster,
  ridgeY: (dx: number) => number,
  ink: Ink,
  cx = r.w / 2,
  bottom = r.h,
): Float64Array {
  const ys = new Float64Array(r.w);
  for (let x = 0; x < r.w; x++) {
    const y = Math.round(ridgeY(x - cx));
    ys[x] = y;
    for (let yy = Math.max(0, y); yy < bottom; yy++) r.px(x, yy, ink);
  }
  return ys;
}

/* ------------------------------------------------------------- skies */

export interface Star {
  x: number;
  y: number;
  big: boolean;
  col: number;
}

const starLists = new Map<string, Star[]>();

/** Deterministic star positions for a given screen width (centered composition). */
export function starList(seed: number, count: number, yMax: number, w: number): Star[] {
  const key = `${seed}|${count}|${yMax}|${w}`;
  const hit = starLists.get(key);
  if (hit) return hit;
  const rand = rng(seed);
  const cx = w / 2;
  const out: Star[] = [];
  for (let i = 0; i < count; i++) {
    const x = Math.round(cx + (rand() - 0.5) * 700);
    const y = Math.round(rand() * rand() * yMax);
    const b = rand();
    if (x < 0 || x >= w) continue;
    out.push({ x, y, big: b > 0.93, col: b > 0.75 ? C.white : b > 0.4 ? C.lightGray : C.gray });
  }
  starLists.set(key, out);
  return out;
}

/** Star field drawn into a raster; returns the star list for twinkle overlays. */
export function stars(r: Raster, seed: number, count: number, yMax: number): Star[] {
  const list = starList(seed, count, yMax, r.w);
  for (const s of list) {
    r.px(s.x, s.y, s.col);
    if (s.big) {
      r.px(s.x - 1, s.y, C.gray);
      r.px(s.x + 1, s.y, C.gray);
      r.px(s.x, s.y - 1, C.gray);
      r.px(s.x, s.y + 1, C.gray);
    }
  }
  return list;
}

/** Twinkle overlay: every `step`-th star flashes a small sparkle. */
export function twinkle(
  ctx: CanvasRenderingContext2D,
  list: readonly Star[],
  t: number,
  step = 7,
  col = C.lightGray,
): void {
  for (let i = 0; i < list.length; i += step) {
    const s = list[i];
    if (Math.sin(t * 2.3 + i * 1.7) > 0.75) blitC(ctx, sparkleSprite(s.big ? 3 : 2, col), s.x, s.y);
  }
}

/** Glow sprite: dithered radial falloff through `stops` (last stop fades out). */
export function glow(r: number, stops: readonly number[], sy = 1): HTMLCanvasElement {
  const size = Math.ceil(r * 2 + 2);
  return layer(`glow|${r}|${stops.join(',')}|${sy}`, size, Math.ceil(size * sy), (ras) => {
    const ink = rgrad(size / 2, (size * sy) / 2, r, [...stops, 0], sy);
    ras.rectPx(0, 0, ras.w, ras.h, ink);
  });
}

/** Four-point sparkle sprite. */
export function sparkleSprite(size: number, color: number, core = C.white): HTMLCanvasElement {
  const d = size * 2 + 1;
  return layerCtx(`spark|${size}|${color}|${core}`, d, d, (ctx) => {
    ctx.fillStyle = HEX[color];
    ctx.fillRect(size, 0, 1, d);
    ctx.fillRect(0, size, d, 1);
    if (size >= 3) {
      ctx.fillRect(size - 1, size - Math.floor(size / 2), 3, size + 1 - (size % 2));
      ctx.fillRect(size - Math.floor(size / 2), size - 1, size + 1 - (size % 2), 3);
    }
    ctx.fillStyle = HEX[core];
    ctx.fillRect(size, size, 1, 1);
  });
}

/** Draw a canvas centered at (x, y) with integer snapping. */
export function blitC(ctx: CanvasRenderingContext2D, c: HTMLCanvasElement, x: number, y: number): void {
  ctx.drawImage(c, Math.round(x - c.width / 2), Math.round(y - c.height / 2));
}

/** Integer-snapped drawImage. */
export function blit(ctx: CanvasRenderingContext2D, c: HTMLCanvasElement, x = 0, y = 0): void {
  ctx.drawImage(c, Math.round(x), Math.round(y));
}

/* ------------------------------------------------------------ crystal */

export interface CrystalOpts {
  cracks?: number;
  seed?: number;
  palette?: 'sky' | 'dawn';
}

/**
 * Giant floating Aether crystal (elongated bipyramid) with faceted cel
 * shading, an inner core glow and optional cracks. (cx, cy) = center, H =
 * half-height of the upper pyramid, W = half-width. Pixel space.
 */
export function crystal(r: Raster, cx: number, cy: number, H: number, W: number, o: CrystalOpts = {}): void {
  const top: [number, number] = [cx, cy - H];
  const bot: [number, number] = [cx + W * 0.05, cy + H * 0.95];
  const L: [number, number] = [cx - W, cy - H * 0.08];
  const FL: [number, number] = [cx - W * 0.35, cy + H * 0.06];
  const FR: [number, number] = [cx + W * 0.45, cy + H * 0.04];
  const R: [number, number] = [cx + W, cy - H * 0.1];
  const lightest = C.white;
  const light = o.palette === 'dawn' ? C.ice0 : C.cyan;
  const mid = o.palette === 'dawn' ? C.ice1 : C.sky;
  const dark = o.palette === 'dawn' ? C.ice2 : C.blue;
  const darkest = o.palette === 'dawn' ? C.ice3 : C.navy;
  const tri = (a: number[], b: number[], c: number[], ink: Ink): void =>
    r.fillPx([a[0], a[1], b[0], b[1], c[0], c[1]], ink);
  tri(top, L, FL, light);
  tri(top, FL, FR, lightest);
  tri(top, FR, R, mid);
  tri(bot, L, FL, mid);
  tri(bot, FL, FR, dark);
  tri(bot, FR, R, darkest);
  // inner core glow (dithered)
  r.with({ self: true }, () => {
    r.fillPx(
      [
        cx - W * 0.3,
        cy - H * 0.3,
        cx + W * 0.1,
        cy - H * 0.45,
        cx + W * 0.3,
        cy + H * 0.1,
        cx - W * 0.1,
        cy + H * 0.5,
      ],
      (x, y) => ((x + y) & 1 ? light : r.data[y * r.w + x]),
    );
    // facet edge highlights
    r.linePx([top[0], top[1], FL[0], FL[1]], C.white);
    r.linePx([FL[0], FL[1], bot[0], bot[1]], light);
    r.linePx([top[0], top[1], FR[0], FR[1]], light);
  });
  // cracks
  const n = o.cracks ?? 0;
  if (n > 0) {
    const rand = rng(o.seed ?? 7);
    for (let i = 0; i < n; i++) {
      let x = cx + (rand() - 0.5) * W * 0.8;
      let y = cy + (rand() - 0.5) * H * 0.9;
      let a = rand() * Math.PI * 2;
      const len = 4 + Math.floor(rand() * 6);
      const pts: number[] = [x, y];
      for (let k = 0; k < len; k++) {
        a += (rand() - 0.5) * 1.4;
        x += Math.cos(a) * H * 0.07;
        y += Math.sin(a) * H * 0.07;
        pts.push(x, y);
      }
      r.with({ self: true }, () => {
        r.linePx(pts, darkest);
        r.linePx(
          pts.map((v, j) => (j % 2 === 0 ? v + 1 : v)),
          C.white,
        );
      });
    }
  }
  // outline
  r.outline(C.navy);
}

/** Drop every cached layer / frame (e.g. after a resolution change). */
export function clearLayerCache(): void {
  layerCache.clear();
  cachedPixels = 0;
}

/** Palette LUT helper: map indices via a table built from `f`. */
export function lut(f: (i: number) => number): Uint8Array {
  const t = new Uint8Array(HEX.length);
  for (let i = 0; i < HEX.length; i++) t[i] = i === 0 ? 0 : f(i);
  return t;
}
