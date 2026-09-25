/** Anime focus / speed lines (crisp, cached per flicker tick). */
import { makeCanvas } from '../pixel/core';
import { nearest, C } from './pal';
import { Raster } from './raster';
import { rng } from './geom';

const cache = new Map<string, HTMLCanvasElement>();
const MAX = 48;
const TICKS = 6;

function colorIndex(color: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return C.white;
  const n = parseInt(m[1], 16);
  return nearest((n >> 16) & 255, (n >> 8) & 255, n & 255);
}

function render(
  cx: number,
  cy: number,
  w: number,
  h: number,
  tick: number,
  col: number,
  density: number,
): HTMLCanvasElement {
  const r = new Raster(w, h);
  const rand = rng(tick * 7919 + 13);
  const n = Math.floor(56 * density);
  const R = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy)) + 4;
  const base = Math.min(w, h);
  for (let i = 0; i < n; i++) {
    const a = ((i + rand() * 0.9) / n) * Math.PI * 2;
    const rin = base * (0.3 + rand() * 0.22);
    const wd = (0.6 + rand() * rand() * 3.4) / R;
    const len = R;
    r.fillPx(
      [
        cx + Math.cos(a) * rin,
        cy + Math.sin(a) * rin,
        cx + Math.cos(a - wd) * len,
        cy + Math.sin(a - wd) * len,
        cx + Math.cos(a + wd) * len,
        cy + Math.sin(a + wd) * len,
      ],
      col,
    );
  }
  return r.toCanvas();
}

/** Anime "focus lines" converging on (cx, cy). `t` animates (flicker at ~15 fps). */
export function speedLines(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  t: number,
  color = '#ffffff',
  density = 1,
): void {
  w = Math.max(1, Math.round(w));
  h = Math.max(1, Math.round(h));
  const tick = Math.floor(t * 15) % TICKS;
  const ccx = Math.round(cx / 4) * 4;
  const ccy = Math.round(cy / 4) * 4;
  const d = Math.round(density * 10) / 10;
  const key = `${ccx},${ccy}|${w}x${h}|${color}|${d}|${tick}`;
  let c = cache.get(key);
  if (!c) {
    if (cache.size >= MAX) cache.delete(cache.keys().next().value as string);
    c = w > 0 && h > 0 ? render(ccx, ccy, w, h, tick, colorIndex(color), d) : makeCanvas(1, 1);
    cache.set(key, c);
  }
  ctx.drawImage(c, 0, 0);
}
