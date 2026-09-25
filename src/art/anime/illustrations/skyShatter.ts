/**
 * The Aether Crystal shatters: 0–1.5s intact & glowing, 1.5–3s cracks spread,
 * ~3s white flash, then glowing shards streak down like meteors over a dark
 * landscape with a tiny village (steady meteor shower afterwards).
 */
import { C, HEX } from '../pal';
import { blit, blitC, crystal, fade, frame, glow, layer, layerCtx, starList, stars, twinkle } from './kit';
import { raysInto, ridge, ridgeFn, skyGradient } from './scenery';
import { clamp, rng } from '../geom';
import { Raster } from '../raster';

const CW = 80;
const CH = 132;

interface CrackPx {
  x: number;
  y: number;
  d: number;
}

let cracks: CrackPx[] | null = null;
let crystalMask: Raster | null = null;
function crystalRaster(): Raster {
  if (!crystalMask) {
    crystalMask = new Raster(CW, CH);
    crystal(crystalMask, CW / 2, CH / 2, 58, 28, {});
  }
  return crystalMask;
}
function crackPixels(): CrackPx[] {
  if (cracks) return cracks;
  const mask = crystalRaster();
  const rand = rng(99);
  const out: CrackPx[] = [];
  const cx = CW / 2;
  const cy = CH / 2 + 2;
  const walk = (x: number, y: number, a: number, len: number, d0: number, depth: number): void => {
    let d = d0;
    for (let i = 0; i < len; i++) {
      a += (rand() - 0.5) * 0.9;
      const nx = x + Math.cos(a) * 2.2;
      const ny = y + Math.sin(a) * 2.2;
      const steps = 3;
      for (let k = 1; k <= steps; k++) {
        out.push({
          x: Math.round(x + ((nx - x) * k) / steps),
          y: Math.round(y + ((ny - y) * k) / steps),
          d: d + (2.2 * k) / steps,
        });
      }
      d += 2.2;
      x = nx;
      y = ny;
      if (depth < 2 && rand() > 0.82)
        walk(x, y, a + (rand() > 0.5 ? 0.9 : -0.9), Math.floor(len * 0.5), d, depth + 1);
    }
  };
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + rand() * 0.5;
    walk(cx, cy, a, 12 + Math.floor(rand() * 10), 0, 0);
  }
  const inside = out.filter(
    (q) => mask.get(q.x, q.y) !== 0 && mask.get(q.x + 1, q.y) !== 0 && mask.get(q.x, q.y + 1) !== 0,
  );
  inside.sort((p, q) => p.d - q.d);
  cracks = inside;
  return out;
}

interface Meteor {
  t0: number;
  a: number;
  sp: number;
  len: number;
  big: boolean;
  ox: number;
}

const METEORS: Meteor[] = (() => {
  const rand = rng(1234);
  const list: Meteor[] = [];
  for (let i = 0; i < 26; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    list.push({
      t0: 3.05 + i * 0.09 + rand() * 0.15,
      a: Math.PI / 2 + side * (0.25 + rand() * 1.05),
      sp: 110 + rand() * 150,
      len: 30 + rand() * 55,
      big: rand() > 0.55,
      ox: (rand() - 0.5) * 16,
    });
  }
  return list;
})();

const LOOP = 3.2;
const LOOPERS: Meteor[] = (() => {
  const rand = rng(77);
  const list: Meteor[] = [];
  for (let i = 0; i < 10; i++) {
    list.push({
      t0: (i / 10) * LOOP,
      a: Math.PI / 2 + (rand() - 0.5) * 2.2,
      sp: 120 + rand() * 120,
      len: 26 + rand() * 44,
      big: rand() > 0.6,
      ox: (rand() - 0.5) * 60,
    });
  }
  return list;
})();

function drawMeteor(
  ctx: CanvasRenderingContext2D,
  m: Meteor,
  age: number,
  sx: number,
  sy: number,
  w: number,
  horizon: number,
): void {
  if (age < 0) return;
  const dx = Math.cos(m.a);
  const dy = Math.sin(m.a);
  const hx = sx + m.ox + dx * m.sp * age;
  const hy = sy + dy * m.sp * age;
  if (hy > horizon + 4 || hx < -60 || hx > w + 60) return;
  const len = Math.min(m.len, m.sp * age);
  const cols = [C.white, C.cyan, C.cyan, C.sky, C.sky, C.blue];
  for (let k = 0; k < len; k++) {
    const x = Math.round(hx - dx * k);
    const y = Math.round(hy - dy * k);
    if (y > horizon) continue;
    const f = k / len;
    if (f > 0.55 && k & 1) continue;
    ctx.fillStyle = HEX[cols[Math.min(cols.length - 1, Math.floor(f * cols.length))]];
    ctx.fillRect(x, y, 1, 1);
  }
  if (hy <= horizon) {
    ctx.fillStyle = HEX[C.white];
    const s = m.big ? 2 : 1;
    ctx.fillRect(Math.round(hx) - (s >> 1), Math.round(hy) - (s >> 1), s, s);
    if (m.big) {
      ctx.fillStyle = HEX[C.cyan];
      ctx.fillRect(Math.round(hx) - 2, Math.round(hy), 1, 1);
      ctx.fillRect(Math.round(hx) + 1, Math.round(hy), 1, 1);
      ctx.fillRect(Math.round(hx), Math.round(hy) - 2, 1, 1);
      ctx.fillRect(Math.round(hx), Math.round(hy) + 1, 1, 1);
    }
  }
}

export function drawSkyShatter(ctx: CanvasRenderingContext2D, t: number, w: number, h: number): void {
  const cx = Math.round(w / 2);
  const ky = 88;
  const horizon = 214;
  const after = t >= 3;

  const sky = layer('shatter/sky', w, h, (r) => {
    skyGradient(r, [C.black, C.black, C.navy, C.navy, C.darkSlate, C.purple], 0, horizon);
    stars(r, 17, 240, 190);
  });
  blit(ctx, sky);
  twinkle(ctx, starList(17, 240, 190, w), t);

  if (!after) {
    const p = clamp((t - 1.5) / 1.5, 0, 1);
    const pulse = (Math.sin(t * 3) + 1) / 2;
    blitC(ctx, glow(96 + Math.round(p * 5) * 8, [C.blue, C.darkSlate, C.navy]), cx, ky);
    const step = p <= 0 ? Math.floor(t * 2) % 2 : 2 + Math.min(5, Math.floor(p * 6));
    const rl = frame('shatter/rays', step, 8, w, h, (r, i) => {
      const q = i < 2 ? 0 : (i - 1) / 6;
      raysInto(r, cx, ky, 12, 26, 150 + q * 120, i * 0.03, C.cyan, 2 + Math.round(q * 3), 0.05 + q * 0.03, 5);
    });
    blit(ctx, rl);
    blitC(ctx, glow(46 + Math.round(p * 20 + pulse * 3), [C.cyan, C.sky, C.blue]), cx, ky);
    const shake = p * p * 2.5;
    const ox = Math.round((Math.sin(t * 91) + Math.sin(t * 57)) * shake);
    const oy = Math.round(Math.cos(t * 73) * shake) + Math.round(Math.sin(t * 1.3) * 2 * (1 - p));
    const cr = layer('shatter/crystal', CW, CH, (r) => r.over(crystalRaster()));
    const x0 = cx - CW / 2 + ox;
    const y0 = ky - CH / 2 + oy;
    blit(ctx, cr, x0, y0);
    if (p > 0) {
      const list = crackPixels();
      const maxD = list[list.length - 1].d;
      const lim = p * maxD * 1.05;
      ctx.fillStyle = HEX[C.white];
      for (const q of list) {
        if (q.d > lim) break;
        ctx.fillRect(x0 + q.x, y0 + q.y, 1, 1);
      }
      ctx.fillStyle = HEX[C.cyan];
      for (const q of list) {
        if (q.d > lim) break;
        ctx.fillRect(x0 + q.x + 1, y0 + q.y, 1, 1);
      }
    }
    // brightening just before the burst
    const b = clamp((t - 2.6) / 0.4, 0, 1);
    if (b > 0) ctx.drawImage(ditherMask(whiteOf(cr), b), x0, y0);
  } else {
    // remnant burst: expanding ring + fading core
    const a = t - 3;
    const ringR = Math.round(10 + a * 70);
    if (a < 2.5) drawRing(ctx, cx, ky, ringR, 1 - a / 2.5);
    const coreR = Math.max(6, Math.round(34 - a * 6));
    blitC(ctx, glow(coreR, [C.white, C.cyan, C.sky, C.blue]), cx, ky);
    for (const m of METEORS) drawMeteor(ctx, m, t - m.t0, cx, ky, w, horizon);
    if (t > 4.5) {
      const lt = t - 4.5;
      for (const m of LOOPERS) {
        const age = (lt - m.t0 + LOOP * 10) % LOOP;
        if (lt - m.t0 < 0) continue;
        drawMeteor(ctx, m, age, cx, ky + 6, w, horizon);
      }
    }
  }

  // landscape + village
  const land = layer('shatter/land', w, h, (r) => {
    ridge(r, ridgeFn(200, 14, 60, 31), C.navy, C.darkSlate);
    ridge(r, ridgeFn(222, 7, 40, 32), C.black, C.navy);
    // village
    const rand = rng(8);
    r.setTransform(1, 0, 0);
    for (let i = 0; i < 11; i++) {
      const x = Math.round(cx - 70 + i * 13 + rand() * 6);
      const bw = 6 + Math.floor(rand() * 5);
      const bh = 5 + Math.floor(rand() * 4);
      const by = 226 + Math.floor(rand() * 5);
      r.rectPx(x, by - bh, bw, bh + 8, C.black);
      r.fillPx([x - 1, by - bh, x + bw / 2, by - bh - 5, x + bw + 1, by - bh], C.black);
      if (rand() > 0.3) r.px(x + 2, by - bh + 2, C.gold);
      if (rand() > 0.5) r.px(x + bw - 2, by - bh + 2, C.yellow);
    }
    // bell tower
    r.rectPx(cx + 12, 208, 5, 24, C.black);
    r.fillPx([cx + 11, 208, cx + 14.5, 199, cx + 18, 208], C.black);
    r.px(cx + 14, 211, C.gold);
    // trees
    for (let i = 0; i < 26; i++) {
      const x = Math.round(cx + (rand() - 0.5) * 640);
      if (Math.abs(x - cx) < 80) continue;
      const th = 8 + rand() * 12;
      const by = 224 + rand() * 6;
      r.fillPx([x, by - th, x + th * 0.35, by, x - th * 0.35, by], C.black);
    }
    for (let y = 236; y < h; y++) for (let x = 0; x < w; x++) r.px(x, y, C.black);
  });
  blit(ctx, land);

  // window flicker
  if (after) {
    const rand = rng(Math.floor(t * 4));
    ctx.fillStyle = HEX[C.yellow];
    for (let i = 0; i < 4; i++)
      ctx.fillRect(Math.round(cx - 70 + rand() * 140), 222 + Math.floor(rand() * 6), 1, 1);
  }

  // flash
  if (t >= 2.95 && t < 3.9) {
    const f = t < 3.12 ? 1 : 1 - (t - 3.12) / 0.78;
    fade(ctx, C.white, f, 0, 0, w, h);
  }
}

/* helpers ------------------------------------------------------------ */

const maskCache = new Map<string, HTMLCanvasElement>();
let maskId = 1;
const ids = new WeakMap<HTMLCanvasElement, number>();

/** Return `src` with only a Bayer-ordered fraction `amount` of its pixels kept (cached per level). */
function ditherMask(src: HTMLCanvasElement, amount: number): HTMLCanvasElement {
  const lv = Math.round(clamp(amount, 0, 1) * 16);
  let id = ids.get(src);
  if (!id) {
    id = maskId++;
    ids.set(src, id);
  }
  const key = `${id}|${lv}`;
  const hit = maskCache.get(key);
  if (hit) return hit;
  const c = layerCtx(`mask|${key}`, src.width, src.height, (g) => {
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'destination-in';
    g.fillStyle = ditherPatFor(g, lv);
    g.fillRect(0, 0, src.width, src.height);
  });
  maskCache.set(key, c);
  return c;
}

function ditherPatFor(g: CanvasRenderingContext2D, lv: number): CanvasPattern | string {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 4;
  const x = c.getContext('2d')!;
  const B = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  x.fillStyle = '#fff';
  for (let i = 0; i < 16; i++) if (B[i] < lv) x.fillRect(i & 3, i >> 2, 1, 1);
  return g.createPattern(c, 'repeat') ?? '#fff';
}

function whiteOf(src: HTMLCanvasElement): HTMLCanvasElement {
  return layerCtx(`white|${ids.get(src) ?? 0}|${src.width}`, src.width, src.height, (g) => {
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = HEX[C.white];
    g.fillRect(0, 0, src.width, src.height);
  });
}

function drawRing(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, amount: number): void {
  for (let k = 0; k < 3; k++) {
    const rr = R - k * 3;
    if (rr <= 2) continue;
    ctx.fillStyle = HEX[k === 0 ? C.white : k === 1 ? C.cyan : C.sky];
    const n = Math.ceil(rr * 6.3);
    const keep = amount * (k === 0 ? 1 : 0.6);
    for (let i = 0; i < n; i++) {
      if (((i * 2654435761) >>> 0) / 4294967296 > keep) continue;
      const a = (i / n) * Math.PI * 2;
      ctx.fillRect(Math.round(cx + Math.cos(a) * rr), Math.round(cy + Math.sin(a) * rr * 0.85), 1, 1);
    }
  }
}

export { ditherMask, whiteOf };
