/** Reusable scenery pieces: skies, glows, ridges, grass, particles, small figures. */
import { C, HEX } from '../pal';
import { Raster, bayer, rampAt, type Ink } from '../raster';
import { fbm, fillPolyCtx, ditherPat } from './kit';
import { rng, spline, strand, type P } from '../geom';

/** Vertical sky gradient over the whole raster. */
export function skyGradient(r: Raster, stops: readonly number[], y0 = 0, y1 = r.h): void {
  const inv = 1 / (y1 - y0);
  for (let y = 0; y < r.h; y++) {
    const t = (y + 0.5 - y0) * inv;
    for (let x = 0; x < r.w; x++) r.data[y * r.w + x] = rampAt(stops, t, x, y);
  }
}

/**
 * Radial glow that blends into whatever is already there: stops go from the
 * center outward; beyond the last stop the existing pixel is kept.
 */
export function glowInto(
  r: Raster,
  cx: number,
  cy: number,
  R: number,
  stops: readonly number[],
  sy = 1,
): void {
  const all = [...stops, -1];
  const n = all.length - 1;
  const y0 = Math.max(0, Math.floor(cy - R * sy));
  const y1 = Math.min(r.h - 1, Math.ceil(cy + R * sy));
  const x0 = Math.max(0, Math.floor(cx - R));
  const x1 = Math.min(r.w - 1, Math.ceil(cx + R));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx;
      const dy = (y + 0.5 - cy) / sy;
      const t = Math.sqrt(dx * dx + dy * dy) / R;
      if (t >= 1) continue;
      const f = t * n;
      let i = Math.floor(f);
      if (i >= n) i = n - 1;
      const c = bayer(x, y) < f - i ? all[i + 1] : all[i];
      if (c >= 0) r.data[y * r.w + x] = c;
    }
  }
}

/** Ridge line function: base height + fractal noise, relative to screen center. */
export function ridgeFn(
  baseY: number,
  amp: number,
  scale: number,
  seed: number,
  oct = 4,
): (dx: number) => number {
  return (dx) => baseY + fbm(dx / scale + 100, seed, oct) * amp;
}

/** Fill a ridge silhouette, with a 1px rim of `rim` on top. Returns top y per column. */
export function ridge(
  r: Raster,
  f: (dx: number) => number,
  ink: Ink,
  rim = -1,
  rimInk?: (x: number, slope: number) => number,
): Int32Array {
  const top = new Int32Array(r.w);
  const cx = r.w / 2;
  for (let x = 0; x < r.w; x++) {
    const y = Math.round(f(x - cx));
    top[x] = y;
    for (let yy = Math.max(0, y); yy < r.h; yy++) r.px(x, yy, ink);
  }
  if (rim >= 0 || rimInk) {
    for (let x = 0; x < r.w; x++) {
      const slope = (top[Math.min(r.w - 1, x + 1)] - top[Math.max(0, x - 1)]) / 2;
      const c = rimInk ? rimInk(x, slope) : rim;
      if (c > 0) r.px(x, top[x], c);
    }
  }
  return top;
}

/** Soft horizontal cloud band (dithered ellipses). */
export function cloudBand(
  r: Raster,
  seed: number,
  y: number,
  count: number,
  spread: number,
  body: Ink,
  top: Ink,
  rx = [30, 70],
  ry = [3, 7],
): void {
  const rand = rng(seed);
  const cx = r.w / 2;
  for (let i = 0; i < count; i++) {
    const x = cx + (rand() - 0.5) * spread;
    const yy = y + (rand() - 0.5) * 16;
    const a = rx[0] + rand() * (rx[1] - rx[0]);
    const b = ry[0] + rand() * (ry[1] - ry[0]);
    r.setTransform(1, 0, 0);
    r.ellipse(x, yy, a, b, body);
    r.ellipse(x - a * 0.1, yy - b * 0.35, a * 0.8, b * 0.55, top);
  }
}

/** Grass blades along the ground (pixel space). */
export function grassBlades(
  r: Raster,
  seed: number,
  yAt: (x: number) => number,
  dens: number,
  colors: readonly number[],
  hMin = 3,
  hMax = 9,
  lean = 0,
): void {
  const rand = rng(seed);
  for (let x = 0; x < r.w; x++) {
    if (rand() > dens) continue;
    const y = yAt(x);
    const h = hMin + rand() * (hMax - hMin);
    const l = lean + (rand() - 0.5) * 3;
    const col = colors[Math.floor(rand() * colors.length)];
    r.linePx([x, y, x + l * 0.5, y - h * 0.6, x + l, y - h], col);
  }
}

/* ------------------------------------------------------------ particles */

export interface Mote {
  x: number;
  y: number;
  sp: number;
  ph: number;
  col: number;
  big: boolean;
}

export function makeMotes(seed: number, n: number, colors: readonly number[]): Mote[] {
  const rand = rng(seed);
  const out: Mote[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      x: (rand() - 0.5) * 680,
      y: rand() * 300,
      sp: 6 + rand() * 16,
      ph: rand() * 6.28,
      col: colors[Math.floor(rand() * colors.length)],
      big: rand() > 0.8,
    });
  }
  return out;
}

/** Rising (dir=-1) or falling (dir=1) drifting motes. */
export function drawMotes(
  ctx: CanvasRenderingContext2D,
  motes: readonly Mote[],
  t: number,
  w: number,
  h: number,
  dir = -1,
  sway = 5,
  yMin = 0,
): void {
  const cx = w / 2;
  const range = h - yMin + 20;
  for (const m of motes) {
    let y = (m.y + dir * t * m.sp) % range;
    if (y < 0) y += range;
    y += yMin - 10;
    const x = Math.round(cx + m.x + Math.sin(t * 0.9 + m.ph) * sway);
    if (x < 0 || x >= w) continue;
    const tw = Math.sin(t * 3 + m.ph * 3);
    if (tw < -0.6) continue;
    ctx.fillStyle = HEX[m.col];
    const yy = Math.round(y);
    if (m.big && tw > 0.2) {
      ctx.fillRect(x - 1, yy, 3, 1);
      ctx.fillRect(x, yy - 1, 1, 3);
      ctx.fillStyle = HEX[C.white];
      ctx.fillRect(x, yy, 1, 1);
    } else ctx.fillRect(x, yy, 1, 1);
  }
}

/** Light rays from (cx, cy), drawn crisply with a dither pattern. */
export function rays(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  n: number,
  r0: number,
  r1: number,
  rot: number,
  color: number,
  level: number,
  width = 0.05,
  seed = 3,
  W = 4096,
  H = 4096,
): void {
  const rand = rng(seed);
  const pat = ditherPat(ctx, color, level);
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2 + (rand() - 0.5) * 0.3;
    const len = r1 * (0.55 + rand() * 0.45);
    const wd = width * (0.6 + rand() * 0.8);
    fillPolyCtx(
      ctx,
      [
        cx + Math.cos(a) * r0,
        cy + Math.sin(a) * r0,
        cx + Math.cos(a - wd) * len,
        cy + Math.sin(a - wd) * len,
        cx + Math.cos(a + wd) * len,
        cy + Math.sin(a + wd) * len,
      ],
      pat,
      W,
      H,
    );
  }
}

/** Same as `rays` but rasterized into a Raster (for cached ray layers). */
export function raysInto(
  r: Raster,
  cx: number,
  cy: number,
  n: number,
  r0: number,
  r1: number,
  rot: number,
  color: number,
  level: number,
  width = 0.05,
  seed = 3,
): void {
  const rand = rng(seed);
  const lv = level / 16;
  const ink: Ink = (x, y) => (bayer(x, y) < lv ? color : r.data[y * r.w + x]);
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2 + (rand() - 0.5) * 0.3;
    const len = r1 * (0.55 + rand() * 0.45);
    const wd = width * (0.6 + rand() * 0.8);
    r.fillPx(
      [
        cx + Math.cos(a) * r0,
        cy + Math.sin(a) * r0,
        cx + Math.cos(a - wd) * len,
        cy + Math.sin(a - wd) * len,
        cx + Math.cos(a + wd) * len,
        cy + Math.sin(a + wd) * len,
      ],
      ink,
    );
  }
}

/* -------------------------------------------------------------- figures */

/**
 * Kai silhouette standing (pixel space, feet at (fx, fy), height ≈ 52 * s),
 * sword held low, scarf and hair streaming in the wind. `ph` animates.
 */
export function kaiSilhouette(
  r: Raster,
  fx: number,
  fy: number,
  s: number,
  ph: number,
  body = C.black,
  scarf = C.darkRed,
): void {
  r.setTransform(s, fx, fy);
  const sw = Math.sin(ph);
  const sw2 = Math.sin(ph * 1.7 + 1);
  // legs
  r.poly(
    strand(
      [
        [-2.5, -24],
        [-4.5, -12],
        [-6.5, 0],
      ],
      6,
      { tipW: 4 },
    ),
    body,
  );
  r.poly(
    strand(
      [
        [2.5, -24],
        [4.5, -12],
        [7, 0],
      ],
      6,
      { tipW: 4 },
    ),
    body,
  );
  r.poly([-9, 0, -4, 0, -4, -2, -8, -2], body);
  r.poly([4, 0, 10, 0, 9, -2, 5, -2], body);
  // tunic / torso
  r.poly(
    spline(
      [
        [-6, -40],
        [6, -40],
        [6.5, -30],
        [8, -21],
        [-8, -21],
        [-6.5, -30],
      ],
      true,
      3,
    ),
    body,
  );
  // pauldron
  r.ellipse(-6.5, -39, 4, 3.2, body);
  // arms
  r.poly(
    strand(
      [
        [-7, -38],
        [-8.5, -30],
        [-8, -23],
      ],
      3.6,
      { tipW: 3 },
    ),
    body,
  );
  r.poly(
    strand(
      [
        [6.5, -38],
        [9, -31],
        [11, -25],
      ],
      3.6,
      { tipW: 3 },
    ),
    body,
  );
  // sword: grip at (11,-25), blade down-right
  r.stroke([10, -27, 12.5, -22], 1.6, 1.6, body);
  r.stroke([8.5, -23.5, 14.5, -26], 1.2, 1.2, body);
  r.poly([12, -23.5, 13.6, -24.3, 28, -3, 27.2, -2.4], body);
  // head
  r.ellipse(0.5, -46.5, 5.2, 5.8, body);
  // hair spikes streaming right
  for (const [a, b, c, w] of [
    [[-3, -49], [-6, -54], [-7.5, -57.5 + sw * 0.5], 5.5],
    [[0, -50], [1, -55], [3.5, -58.5], 5.5],
    [[2.5, -49], [7, -53], [11 + sw, -53], 5.5],
    [[3, -47], [8.5, -48], [13 + sw2, -46], 5],
    [[3, -44], [8, -42.5], [12 + sw, -40], 4.5],
    [[-4, -46], [-8, -46], [-10, -43], 4],
  ] as [P, P, P, number][]) {
    r.poly(strand([a, b, c], w, { pow: 1.2 }), body);
  }
  // neck
  r.poly([-2, -41, 2.5, -41, 2.5, -39, -2, -39], body);
  // scarf wrap + streaming tails
  r.ellipse(0.5, -40, 4.6, 2.2, scarf);
  const tail = (y0: number, amp: number, ln: number, w: number): void => {
    const pts: P[] = [];
    for (let i = 0; i <= 5; i++) {
      const u = i / 5;
      pts.push([3 + u * ln, y0 + u * 2 + Math.sin(ph * 2 + u * 4) * amp * u]);
    }
    r.poly(strand(pts, w, { tipW: w * 0.6, pow: 1 }), scarf);
  };
  tail(-40.5, 2.2, 22, 3.2);
  tail(-39.5, 1.8, 16, 2.6);
  r.setTransform(1, 0, 0);
}
