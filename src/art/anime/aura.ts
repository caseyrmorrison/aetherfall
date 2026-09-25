/**
 * DBZ-style flame auras (in-world around small sprites, and huge ones in
 * illustrations) plus crackling lightning bolts. Frames are rasterized once
 * per (palette, height bucket, layer, intensity, frame) and then blitted.
 */
import { C, HEX } from './pal';
import { Raster, bayer } from './raster';
import { rng, strand, type P } from './geom';

export type AuraPalette = 'aether' | 'void' | 'ice' | 'fire';
export type AuraLayer = 'back' | 'front';

interface AuraCols {
  core: number;
  inner: number;
  mid: number;
  outer: number;
  edge: number;
  accent: number;
  spark: readonly number[];
}

export const AURA_COLS: Record<AuraPalette, AuraCols> = {
  aether: {
    core: C.white,
    inner: C.cyan,
    mid: C.sky,
    outer: C.blue,
    edge: C.ice1,
    accent: C.gold,
    spark: [C.white, C.cyan, C.yellow],
  },
  void: {
    core: C.pink,
    inner: C.magenta,
    mid: C.purple,
    outer: C.void0,
    edge: C.magenta,
    accent: C.hotPink,
    spark: [C.hotPink, C.magenta, C.white],
  },
  ice: {
    core: C.white,
    inner: C.ice0,
    mid: C.ice1,
    outer: C.ice2,
    edge: C.white,
    accent: C.cyan,
    spark: [C.white, C.ice0, C.cyan],
  },
  fire: {
    core: C.white,
    inner: C.yellow,
    mid: C.orange,
    outer: C.red,
    edge: C.gold,
    accent: C.yellow,
    spark: [C.yellow, C.orange, C.white],
  },
};

export const AURA_FRAMES = 8;

/** Canvas geometry for an aura of height H: returns [width, height, footX, footY]. */
export function auraBox(H: number, wf = 1): [number, number, number, number] {
  const w = Math.ceil(H * 1.25 * wf) + 10;
  const h = Math.ceil(H * 1.72) + 4;
  return [w, h, Math.floor(w / 2), h - Math.ceil(H * 0.07) - 2];
}

/**
 * Rasterize one aura frame into `r` (pixel space). (fx, fy) = feet position,
 * H = character height the aura wraps, `f` = frame index, `k` = intensity.
 */
export function auraInto(
  r: Raster,
  fx: number,
  fy: number,
  H: number,
  pal: AuraPalette,
  f: number,
  layer: AuraLayer,
  k = 1,
  wf = 1,
  flare = true,
): void {
  const cols = AURA_COLS[pal];
  const rand = rng(1000 + f * 97 + Math.round(H));
  const ph = (f / AURA_FRAMES) * Math.PI * 2;
  r.setTransform(1, 0, 0);
  const big = H > 110;

  // one flame layer = teardrop body + rising tongues, scaled toward the body center
  const flame = (scale: number, ink: number, seed: number, tongueK: number): void => {
    const rr = rng(seed + f * 13);
    const bx = (H * 0.42 * wf + 2) * scale;
    const by = H * 0.6 * scale;
    const cy = fy - by * 0.95;
    // egg-shaped body (wider low, narrower high)
    r.ellipse(fx, cy + by * 0.12, bx, by * 0.88, ink);
    r.ellipse(fx, cy - by * 0.2, bx * 0.8, by * 0.8, ink);
    // flared base on the ground
    if (flare) r.ellipse(fx, fy - H * 0.02, bx * 1.1, H * 0.06 * scale + 1, ink);
    // spiky flame tongues all around the upper silhouette, flaring outward + up
    const n = 9 + Math.round(H / 14);
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      const a = Math.PI * (1.02 + u * 0.96); // left side → top → right side
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const px = fx + ca * bx * 0.92;
      const py = cy - by * 0.1 + sa * by * 0.9;
      const top = Math.max(0, -sa); // 1 at the very top
      let dx = ca * 0.55;
      let dy = sa * 0.55 - 0.6;
      const dl = Math.hypot(dx, dy) || 1;
      dx /= dl;
      dy /= dl;
      const flick = 0.7 + 0.35 * Math.sin(ph * (i % 2 ? 1 : 2) + i * 1.7 + seed) + rr() * 0.25;
      const len = H * (0.16 + 0.34 * top * top + (i % 3 === 1 ? 0.1 : 0)) * scale * flick * tongueK * k;
      const sway = Math.sin(ph + i * 2.3) * H * 0.025;
      const tip: P = [px + dx * len + sway, py + dy * len];
      const mid: P = [px + dx * len * 0.5 + sway * 0.4 - ca * H * 0.015, py + dy * len * 0.5];
      const wd = Math.max(2, bx * (0.34 + 0.2 * top));
      r.poly(
        strand([[px - dx * wd * 0.6, py - dy * wd * 0.6], mid, tip], wd, { pow: 1.05, bulge: 0.1 }),
        ink,
      );
    }
  };

  if (layer === 'back') {
    flame(1, cols.outer, 11, 1.05);
    // soft dithered outer edge + bright rim
    const edge = new Uint8Array(r.data.length);
    const d = r.data;
    const w = r.w;
    for (let y = 1; y < r.h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        if (!d[i]) continue;
        if (!d[i - 1] || !d[i + 1] || !d[i - w] || !d[i + w]) edge[i] = 1;
      }
    }
    for (let i = 0; i < d.length; i++) if (edge[i]) d[i] = cols.edge;
    flame(0.8, cols.mid, 23, 1);
    flame(0.6, cols.inner, 37, 0.95);
    flame(0.38, cols.core, 51, 0.85);
    // flickering accent: rim turns to the accent color on some frames + thin accent licks
    if (f % 3 === 1) {
      for (let i = 0; i < d.length; i++) if (edge[i] && bayer(i % w, (i / w) | 0) < 0.6) d[i] = cols.accent;
    }
    const na = big ? 4 : 1;
    for (let i = 0; i < na; i++) {
      if (rand() < 0.4) continue;
      const u = (rand() * 2 - 1) * 0.9;
      const bx = fx + u * H * 0.36 * wf;
      const by = fy - H * (0.45 + rand() * 0.35);
      const len = H * (0.18 + rand() * 0.22) * k;
      const bend = u * H * 0.06;
      r.poly(
        strand(
          [
            [bx, by],
            [bx + bend * 0.3 - u * 2, by - len * 0.5],
            [bx + bend, by - len],
          ],
          Math.max(1.2, H * 0.022),
          { pow: 1 },
        ),
        cols.accent,
      );
    }
    if (big) {
      // rising light streaks inside the flame
      for (let i = 0; i < 14; i++) {
        const x = Math.round(fx + (rand() * 2 - 1) * H * 0.3);
        const y0 = fy - H * (0.1 + rand() * 0.6);
        const len = H * (0.1 + rand() * 0.25);
        for (let y = Math.round(y0 - len); y < y0; y++) {
          const v = r.get(x, y);
          if (v === cols.mid || v === cols.outer) r.px(x, y, cols.inner);
          else if (v === cols.inner) r.px(x, y, cols.core);
        }
      }
      // dithered transitions between bands
      const d2 = r.data;
      for (let y = 1; y < r.h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const i = y * w + x;
          const v = d2[i];
          if (v === cols.mid && d2[i - w] === cols.inner && bayer(x, y) < 0.5) d2[i] = cols.inner;
          else if (v === cols.outer && d2[i - w] === cols.mid && bayer(x, y) < 0.5) d2[i] = cols.mid;
        }
      }
    }
  } else {
    // front: a few thin wisps at the sides + sparks
    const n = big ? 7 : 3;
    for (let i = 0; i < n; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const u = side * (0.55 + rand() * 0.4);
      const bx = fx + u * (H * 0.42 * wf + 1);
      const by = fy - H * (0.02 + rand() * 0.35);
      const flick = 0.7 + 0.4 * Math.sin(ph * 2 + i * 1.3);
      const len = H * (0.22 + rand() * 0.3) * flick * k;
      const wd = Math.max(1.5, H * 0.045);
      r.poly(
        strand(
          [
            [bx, by],
            [bx + u * H * 0.04, by - len * 0.5],
            [bx + u * H * 0.02 + Math.sin(ph + i) * 2, by - len],
          ],
          wd,
          { pow: 1 },
        ),
        i % 3 === 0 ? cols.core : cols.inner,
      );
    }
    // ground flare
    if (flare) {
      const gw = H * 0.46 * wf + 2;
      r.ellipse(fx, fy + 0.5, gw * (0.9 + 0.1 * Math.sin(ph * 2)), Math.max(1, H * 0.025), cols.inner);
      r.ellipse(fx, fy + 0.5, gw * 0.5, Math.max(1, H * 0.015), cols.core);
    }
    // sparks
    const ns = big ? 24 : 5 + Math.round(H / 20);
    for (let i = 0; i < ns; i++) {
      const a = rand() * Math.PI * 2;
      const rad = H * (0.3 + rand() * 0.25);
      const x = fx + Math.cos(a) * rad * 1.1 * wf;
      const y = fy - H * 0.5 + Math.sin(a) * rad - ((f * 3 + i * 5) % 9);
      r.px(x, y, cols.spark[i % cols.spark.length]);
      if (big && i % 3 === 0) r.px(x, y - 1, cols.spark[(i + 1) % cols.spark.length]);
    }
  }
}

/* ------------------------------------------------------ sprite auras */

const cache = new Map<string, HTMLCanvasElement>();
const MAX = 700;

function heightBucket(h: number): number {
  const hh = Math.max(12, Math.min(260, h));
  return hh <= 96 ? Math.round(hh / 4) * 4 : Math.round(hh / 12) * 12;
}

export function auraFrame(
  H: number,
  pal: AuraPalette,
  layer: AuraLayer,
  f: number,
  k: number,
): { c: HTMLCanvasElement; fx: number; fy: number } {
  const hb = heightBucket(H);
  const kb = Math.max(1, Math.min(6, Math.round(k * 4)));
  const [w, h, fx, fy] = auraBox(hb);
  const key = `${pal}|${layer}|${hb}|${kb}|${f}`;
  let c = cache.get(key);
  if (!c) {
    if (cache.size >= MAX) cache.delete(cache.keys().next().value as string);
    const r = new Raster(w, h);
    auraInto(r, fx, fy, hb, pal, f, layer, kb / 4);
    c = r.toCanvas();
    cache.set(key, c);
  }
  return { c, fx, fy };
}

/**
 * DBZ flame aura around an in-world sprite. (cx, footY) = the sprite's feet
 * on the low-res screen; `height` = sprite height the aura wraps (24–90px).
 * Call with layer 'back' before drawing the sprite and 'front' after it.
 */
export function aura(
  ctx: CanvasRenderingContext2D,
  cx: number,
  footY: number,
  height: number,
  t: number,
  palette: AuraPalette,
  layer: AuraLayer,
  intensity = 1,
): void {
  if (intensity <= 0.05) return;
  const f = Math.floor(t * 14) % AURA_FRAMES;
  const { c, fx, fy } = auraFrame(height, palette, layer, f, intensity);
  const s = height / heightBucket(height);
  if (Math.abs(s - 1) < 0.02) {
    ctx.drawImage(c, Math.round(cx - fx), Math.round(footY - fy));
  } else {
    const prev = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      c,
      Math.round(cx - fx * s),
      Math.round(footY - fy * s),
      Math.round(c.width * s),
      Math.round(c.height * s),
    );
    ctx.imageSmoothingEnabled = prev;
  }
}

/* --------------------------------------------------------- lightning */

/** Jagged lightning bolt from (x0,y0) to (x1,y1), with optional branches. Crisp 1px core + glow. */
export function lightning(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  seed: number,
  core: number,
  glowCol: number,
  branches = 2,
  jag = 0.28,
): void {
  const rand = rng(seed);
  const pts: [number, number][] = [[x0, y0]];
  const n = Math.max(4, Math.round(Math.hypot(x1 - x0, y1 - y0) / 7));
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  for (let i = 1; i < n; i++) {
    const u = i / n;
    const off = (rand() * 2 - 1) * len * jag * Math.sin(u * Math.PI) * 0.5;
    pts.push([x0 + dx * u + nx * off, y0 + dy * u + ny * off]);
  }
  pts.push([x1, y1]);
  const seg = (a: [number, number], b: [number, number], col: number, ox: number, oy: number): void => {
    ctx.fillStyle = HEX[col];
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]))));
    for (let k = 0; k <= steps; k++) {
      ctx.fillRect(
        Math.round(a[0] + ((b[0] - a[0]) * k) / steps) + ox,
        Math.round(a[1] + ((b[1] - a[1]) * k) / steps) + oy,
        1,
        1,
      );
    }
  };
  for (let i = 0; i < pts.length - 1; i++) {
    seg(pts[i], pts[i + 1], glowCol, 1, 0);
    seg(pts[i], pts[i + 1], glowCol, -1, 0);
  }
  for (let i = 0; i < pts.length - 1; i++) seg(pts[i], pts[i + 1], core, 0, 0);
  for (let b = 0; b < branches; b++) {
    const i = 1 + Math.floor(rand() * (pts.length - 2));
    const p = pts[i];
    const a = Math.atan2(dy, dx) + (rand() > 0.5 ? 1 : -1) * (0.5 + rand() * 0.6);
    const bl = len * (0.15 + rand() * 0.2);
    let q: [number, number] = p;
    const m = 3;
    for (let k = 1; k <= m; k++) {
      const nq: [number, number] = [
        p[0] + Math.cos(a) * bl * (k / m) + (rand() - 0.5) * 5,
        p[1] + Math.sin(a) * bl * (k / m) + (rand() - 0.5) * 5,
      ];
      seg(q, nq, k === 1 ? core : glowCol, 0, 0);
      q = nq;
    }
  }
}
