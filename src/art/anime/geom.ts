/** Geometry helpers: splines, tapered strands (hair locks), ellipses, RNG. */

export type P = readonly [number, number];

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
export const smooth = (t: number): number => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};

/** Catmull-Rom spline through points → flat array of points. */
export function spline(pts: readonly P[], closed: boolean, seg = 6): number[] {
  const out: number[] = [];
  const n = pts.length;
  if (n < 2) return pts.flatMap((p) => [p[0], p[1]]);
  const get = (i: number): P => {
    if (closed) return pts[((i % n) + n) % n];
    return pts[clamp(i, 0, n - 1)];
  };
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = get(i - 1);
    const p1 = get(i);
    const p2 = get(i + 1);
    const p3 = get(i + 2);
    for (let k = 0; k < seg; k++) {
      const t = k / seg;
      const t2 = t * t;
      const t3 = t2 * t;
      for (let c = 0; c < 2; c++) {
        out.push(
          0.5 *
            (2 * p1[c] +
              (-p0[c] + p2[c]) * t +
              (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 +
              (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3),
        );
      }
    }
  }
  if (!closed) out.push(pts[n - 1][0], pts[n - 1][1]);
  return out;
}

/** Sample a spline as point tuples. */
export function splinePts(pts: readonly P[], closed: boolean, seg = 6): P[] {
  const f = spline(pts, closed, seg);
  const out: P[] = [];
  for (let i = 0; i < f.length; i += 2) out.push([f[i], f[i + 1]]);
  return out;
}

export interface StrandOpts {
  /** Width at the tip (default 0 = pointed). */
  tipW?: number;
  /** Taper exponent (>1 = chunkier, keeps width longer). */
  pow?: number;
  /** Extra bulge in the middle (fraction of w). */
  bulge?: number;
  /** Samples per spline segment. */
  seg?: number;
}

/**
 * Tapered strand (hair lock, scarf tail, flame tongue...) along a spline
 * through `pts`, with width `w` at the root → polygon (flat array).
 */
export function strand(pts: readonly P[], w: number, o: StrandOpts = {}): number[] {
  const mid = splinePts(pts, false, o.seg ?? 5);
  const n = mid.length;
  const pow = o.pow ?? 1;
  const tipW = o.tipW ?? 0;
  const bulge = o.bulge ?? 0;
  // cumulative length
  const cum: number[] = [0];
  for (let i = 1; i < n; i++)
    cum.push(cum[i - 1] + Math.hypot(mid[i][0] - mid[i - 1][0], mid[i][1] - mid[i - 1][1]));
  const L = cum[n - 1] || 1;
  const left: number[] = [];
  const right: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = mid[Math.max(0, i - 1)];
    const b = mid[Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0];
    let ty = b[1] - a[1];
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl;
    ty /= tl;
    const t = cum[i] / L;
    const width = lerp(w, tipW, Math.pow(t, pow)) + Math.sin(t * Math.PI) * bulge * w;
    const hw = Math.max(0, width) / 2;
    left.push(mid[i][0] - ty * hw, mid[i][1] + tx * hw);
    right.push(mid[i][0] + ty * hw, mid[i][1] - tx * hw);
  }
  const out = left.slice();
  for (let i = right.length - 2; i >= 0; i -= 2) out.push(right[i], right[i + 1]);
  return out;
}

/** Ellipse polygon (flat). */
export function ellipsePts(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  n = 32,
  rot = 0,
  a0 = 0,
  a1 = Math.PI * 2,
): number[] {
  const out: number[] = [];
  const full = Math.abs(a1 - a0) >= Math.PI * 2 - 1e-6;
  const cnt = full ? n : n + 1;
  const cr = Math.cos(rot);
  const sr = Math.sin(rot);
  for (let i = 0; i < cnt; i++) {
    const t = a0 + ((a1 - a0) * i) / n;
    const ex = Math.cos(t) * rx;
    const ey = Math.sin(t) * ry;
    out.push(cx + ex * cr - ey * sr, cy + ex * sr + ey * cr);
  }
  return out;
}

/** Flatten a tuple list. */
export function flat(pts: readonly P[]): number[] {
  const out: number[] = [];
  for (const p of pts) out.push(p[0], p[1]);
  return out;
}

/** Translate / scale a flat point list. */
export function xform(
  pts: readonly number[],
  dx: number,
  dy: number,
  sx = 1,
  sy = sx,
  ox = 0,
  oy = 0,
): number[] {
  const out: number[] = new Array(pts.length);
  for (let i = 0; i < pts.length; i += 2) {
    out[i] = ox + (pts[i] - ox) * sx + dx;
    out[i + 1] = oy + (pts[i + 1] - oy) * sy + dy;
  }
  return out;
}

/** Mirror a flat point list around x = cx. */
export function mirrorX(pts: readonly number[], cx: number): number[] {
  const out: number[] = new Array(pts.length);
  for (let i = 0; i < pts.length; i += 2) {
    out[i] = 2 * cx - pts[i];
    out[i + 1] = pts[i + 1];
  }
  return out;
}

/** Small deterministic RNG. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Star polygon (flat). */
export function starPts(
  cx: number,
  cy: number,
  r0: number,
  r1: number,
  points: number,
  rot = -Math.PI / 2,
): number[] {
  const out: number[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? r0 : r1;
    const a = rot + (i * Math.PI) / points;
    out.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  return out;
}
