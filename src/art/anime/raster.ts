/**
 * Tiny indexed-color software rasterizer. Shapes are filled without
 * anti-aliasing (pixel centers are sampled), so everything drawn here is crisp
 * pixel art by construction: no alpha fringes, only palette colors. Inks may be
 * solid palette indices or per-pixel functions (ordered-dither gradients).
 *
 * Shapes are given in "design units" and mapped through an affine transform,
 * which lets the same character drawing code render at any size / rotation.
 */
import { makeCanvas } from '../pixel/core';
import { RGBA } from './pal';

export type Ink = number | ((x: number, y: number) => number);

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** 4x4 Bayer threshold in (0,1) for pixel (x, y). */
export function bayer(x: number, y: number): number {
  return (BAYER4[((y & 3) << 2) | (x & 3)] + 0.5) / 16;
}

/** Ordered-dither mix: `b` covers fraction `t` of the pixels, `a` the rest. */
export function dither(a: number, b: number, t: number): Ink {
  if (t <= 0.02) return a;
  if (t >= 0.98) return b;
  return (x, y) => (bayer(x, y) < t ? b : a);
}

/** Pick a color from `stops` at position t (0..1), dithering between neighbours. */
export function rampAt(stops: readonly number[], t: number, x: number, y: number): number {
  const n = stops.length - 1;
  if (n <= 0) return stops[0];
  const f = (t < 0 ? 0 : t > 1 ? 1 : t) * n;
  let i = Math.floor(f);
  if (i >= n) i = n - 1;
  return bayer(x, y) < f - i ? stops[i + 1] : stops[i];
}

/** Vertical dithered gradient in pixel space. */
export function vgrad(y0: number, y1: number, stops: readonly number[]): Ink {
  const inv = 1 / (y1 - y0 || 1);
  return (x, y) => rampAt(stops, (y + 0.5 - y0) * inv, x, y);
}

/** Horizontal dithered gradient in pixel space. */
export function hgrad(x0: number, x1: number, stops: readonly number[]): Ink {
  const inv = 1 / (x1 - x0 || 1);
  return (x, y) => rampAt(stops, (x + 0.5 - x0) * inv, x, y);
}

/** Radial dithered gradient in pixel space (optionally elliptical via sy). */
export function rgrad(cx: number, cy: number, r: number, stops: readonly number[], sy = 1): Ink {
  const inv = 1 / r;
  return (x, y) => {
    const dx = x + 0.5 - cx;
    const dy = (y + 0.5 - cy) / sy;
    return rampAt(stops, Math.sqrt(dx * dx + dy * dy) * inv, x, y);
  };
}

/** Gradient along an arbitrary direction (pixel space) from p0 to p1. */
export function lgrad(x0: number, y0: number, x1: number, y1: number, stops: readonly number[]): Ink {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const inv = 1 / (dx * dx + dy * dy || 1);
  return (x, y) => rampAt(stops, ((x + 0.5 - x0) * dx + (y + 0.5 - y0) * dy) * inv, x, y);
}

const xsBuf = new Float64Array(512);
const dirBuf = new Int8Array(512);

export class Raster {
  readonly w: number;
  readonly h: number;
  readonly data: Uint8Array;
  // Affine transform design → pixel: X = a*x + c*y + e ; Y = b*x + d*y + f
  a = 1;
  b = 0;
  c = 0;
  d = 1;
  e = 0;
  f = 0;
  /** When set, only pixels where clipMask[i] !== 0 are painted. */
  clipMask: Uint8Array | null = null;
  /** When true, only pixels that are already opaque are painted. */
  clipSelf = false;
  /** When >= 0, only pixels currently equal to this index are painted. */
  only = -1;
  /** When >= 0, pixels currently equal to this index are protected. */
  protect = -1;

  constructor(w: number, h: number) {
    this.w = Math.max(1, Math.ceil(w));
    this.h = Math.max(1, Math.ceil(h));
    this.data = new Uint8Array(this.w * this.h);
  }

  /** Uniform scale `s`, then rotation `rot` (radians), then translation; `flip` mirrors x first. */
  setTransform(s: number, tx: number, ty: number, rot = 0, flip = false): this {
    const cs = Math.cos(rot) * s;
    const sn = Math.sin(rot) * s;
    const fx = flip ? -1 : 1;
    this.a = cs * fx;
    this.b = sn * fx;
    this.c = -sn;
    this.d = cs;
    this.e = tx;
    this.f = ty;
    return this;
  }

  /** Scale/rotate about design point (dx, dy) and put it at pixel (sx, sy). */
  place(s: number, rot: number, dx: number, dy: number, sx: number, sy: number, flip = false): this {
    this.setTransform(s, 0, 0, rot, flip);
    this.e = sx - (this.a * dx + this.c * dy);
    this.f = sy - (this.b * dx + this.d * dy);
    return this;
  }

  copyTransform(o: Raster): this {
    this.a = o.a;
    this.b = o.b;
    this.c = o.c;
    this.d = o.d;
    this.e = o.e;
    this.f = o.f;
    return this;
  }

  /** Pixels per design unit. */
  get scale(): number {
    return Math.sqrt(Math.abs(this.a * this.d - this.b * this.c));
  }

  X(x: number, y: number): number {
    return this.a * x + this.c * y + this.e;
  }

  Y(x: number, y: number): number {
    return this.b * x + this.d * y + this.f;
  }

  clear(): void {
    this.data.fill(0);
  }

  resetClip(): void {
    this.clipMask = null;
    this.clipSelf = false;
    this.only = -1;
    this.protect = -1;
  }

  /** Run `fn` with a temporary paint restriction. */
  with(
    opts: { clip?: Raster | null; self?: boolean; only?: number; protect?: number },
    fn: () => void,
  ): void {
    const pm = this.clipMask;
    const ps = this.clipSelf;
    const po = this.only;
    const pp = this.protect;
    if (opts.clip !== undefined) this.clipMask = opts.clip ? opts.clip.data : null;
    if (opts.self !== undefined) this.clipSelf = opts.self;
    if (opts.only !== undefined) this.only = opts.only;
    if (opts.protect !== undefined) this.protect = opts.protect;
    fn();
    this.clipMask = pm;
    this.clipSelf = ps;
    this.only = po;
    this.protect = pp;
  }

  private restricted(): boolean {
    return this.clipMask !== null || this.clipSelf || this.only >= 0 || this.protect >= 0;
  }

  private put(i: number, x: number, y: number, ink: Ink): void {
    if (this.clipMask !== null && this.clipMask[i] === 0) return;
    const cur = this.data[i];
    if (this.clipSelf && cur === 0) return;
    if (this.only >= 0 && cur !== this.only) return;
    if (this.protect >= 0 && cur === this.protect) return;
    this.data[i] = typeof ink === 'number' ? ink : ink(x, y);
  }

  /** Fill pixels x0..x1 (inclusive) on row y. */
  span(y: number, x0: number, x1: number, ink: Ink): void {
    if (y < 0 || y >= this.h) return;
    if (x0 < 0) x0 = 0;
    if (x1 >= this.w) x1 = this.w - 1;
    if (x1 < x0) return;
    const row = y * this.w;
    if (!this.restricted()) {
      if (typeof ink === 'number') {
        this.data.fill(ink, row + x0, row + x1 + 1);
      } else {
        for (let x = x0; x <= x1; x++) this.data[row + x] = ink(x, y);
      }
      return;
    }
    for (let x = x0; x <= x1; x++) this.put(row + x, x, y, ink);
  }

  /** Set a single pixel (pixel space). */
  px(x: number, y: number, ink: Ink): void {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.put(y * this.w + x, x, y, ink);
  }

  get(x: number, y: number): number {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.data[y * this.w + x];
  }

  rectPx(x: number, y: number, w: number, h: number, ink: Ink): void {
    const x0 = Math.round(x);
    const y0 = Math.round(y);
    const x1 = Math.round(x + w) - 1;
    const y1 = Math.round(y + h) - 1;
    for (let yy = Math.max(0, y0); yy <= Math.min(this.h - 1, y1); yy++) this.span(yy, x0, x1, ink);
  }

  /** Fill a polygon given in PIXEL space (flat [x0,y0,x1,y1,...]), nonzero winding. */
  fillPx(p: ArrayLike<number>, ink: Ink): void {
    const n = p.length >> 1;
    if (n < 3) return;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 1; i < p.length; i += 2) {
      const v = p[i];
      if (v < minY) minY = v;
      if (v > maxY) maxY = v;
    }
    const y0 = Math.max(0, Math.ceil(minY - 0.5));
    const y1 = Math.min(this.h - 1, Math.floor(maxY - 0.5));
    for (let y = y0; y <= y1; y++) {
      const sy = y + 0.5;
      let cnt = 0;
      for (let i = 0; i < n; i++) {
        const j = i === n - 1 ? 0 : i + 1;
        const ya = p[i * 2 + 1];
        const yb = p[j * 2 + 1];
        if ((ya <= sy && yb > sy) || (yb <= sy && ya > sy)) {
          const xa = p[i * 2];
          const xb = p[j * 2];
          const x = xa + ((sy - ya) * (xb - xa)) / (yb - ya);
          const dir = yb > ya ? 1 : -1;
          // insertion sort
          let k = cnt++;
          while (k > 0 && xsBuf[k - 1] > x) {
            xsBuf[k] = xsBuf[k - 1];
            dirBuf[k] = dirBuf[k - 1];
            k--;
          }
          xsBuf[k] = x;
          dirBuf[k] = dir;
          if (cnt >= 511) break;
        }
      }
      let wind = 0;
      let start = 0;
      for (let k = 0; k < cnt; k++) {
        const prev = wind;
        wind += dirBuf[k];
        if (prev === 0 && wind !== 0) start = xsBuf[k];
        else if (prev !== 0 && wind === 0) {
          this.span(y, Math.ceil(start - 0.5), Math.floor(xsBuf[k] - 0.5), ink);
        }
      }
    }
  }

  /** Transform flat design-space points to pixel space. */
  toPx(pts: ArrayLike<number>): Float64Array {
    const out = new Float64Array(pts.length);
    const { a, b, c, d, e, f } = this;
    for (let i = 0; i < pts.length; i += 2) {
      const x = pts[i];
      const y = pts[i + 1];
      out[i] = a * x + c * y + e;
      out[i + 1] = b * x + d * y + f;
    }
    return out;
  }

  /** Fill a polygon given in design units. */
  poly(pts: ArrayLike<number>, ink: Ink): void {
    this.fillPx(this.toPx(pts), ink);
  }

  /** Fill an ellipse given in design units. */
  ellipse(cx: number, cy: number, rx: number, ry: number, ink: Ink, rot = 0): void {
    const s = this.scale;
    const n = Math.max(12, Math.min(96, Math.ceil((rx + ry) * s * 1.2)));
    const pts = new Float64Array(n * 2);
    const cr = Math.cos(rot);
    const sr = Math.sin(rot);
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      const ex = Math.cos(t) * rx;
      const ey = Math.sin(t) * ry;
      pts[i * 2] = cx + ex * cr - ey * sr;
      pts[i * 2 + 1] = cy + ex * sr + ey * cr;
    }
    this.poly(pts, ink);
  }

  /** Disc in pixel space (center-sampled). */
  discPx(cx: number, cy: number, r: number, ink: Ink): void {
    if (r < 0.75) {
      this.px(cx, cy, ink);
      return;
    }
    const r2 = r * r;
    const y0 = Math.ceil(cy - r - 0.5);
    const y1 = Math.floor(cy + r - 0.5);
    for (let y = y0; y <= y1; y++) {
      const dy = y + 0.5 - cy;
      const hw = Math.sqrt(Math.max(0, r2 - dy * dy));
      this.span(y, Math.ceil(cx - hw - 0.5), Math.floor(cx + hw - 0.5), ink);
    }
  }

  /**
   * Tapered brush stroke along a design-space polyline. Widths in design units;
   * `minPx` is the minimum rendered width in pixels.
   */
  stroke(pts: ArrayLike<number>, w0: number, w1: number, ink: Ink, minPx = 1): void {
    const p = this.toPx(pts);
    const s = this.scale;
    const n = p.length >> 1;
    if (n < 2) return;
    const maxW = Math.max(w0, w1) * s;
    if (maxW <= 1.4 && minPx <= 1) {
      this.linePx(p, ink);
      return;
    }
    let total = 0;
    const seg: number[] = [];
    for (let i = 0; i < n - 1; i++) {
      const l = Math.hypot(p[i * 2 + 2] - p[i * 2], p[i * 2 + 3] - p[i * 2 + 1]);
      seg.push(l);
      total += l;
    }
    let acc = 0;
    for (let i = 0; i < n - 1; i++) {
      const l = seg[i];
      const steps = Math.max(1, Math.ceil(l / 0.3));
      for (let k = 0; k <= steps; k++) {
        const u = k / steps;
        const x = p[i * 2] + (p[i * 2 + 2] - p[i * 2]) * u;
        const y = p[i * 2 + 1] + (p[i * 2 + 3] - p[i * 2 + 1]) * u;
        const t = total > 0 ? (acc + l * u) / total : 0;
        const wpx = Math.max(minPx, (w0 + (w1 - w0) * t) * s);
        this.discPx(x, y, wpx / 2, ink);
      }
      acc += l;
    }
  }

  /** 1px "pixel-perfect" polyline (no L-shaped corners), pixel space. */
  linePx(p: ArrayLike<number>, ink: Ink): void {
    const xs: number[] = [];
    const ys: number[] = [];
    const n = p.length >> 1;
    for (let i = 0; i < n - 1; i++) {
      const xa = p[i * 2];
      const ya = p[i * 2 + 1];
      const xb = p[i * 2 + 2];
      const yb = p[i * 2 + 3];
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(xb - xa), Math.abs(yb - ya)) * 2));
      for (let k = 0; k <= steps; k++) {
        const x = Math.floor(xa + ((xb - xa) * k) / steps);
        const y = Math.floor(ya + ((yb - ya) * k) / steps);
        const m = xs.length;
        if (m && xs[m - 1] === x && ys[m - 1] === y) continue;
        xs.push(x);
        ys.push(y);
      }
    }
    if (n === 1) {
      xs.push(Math.floor(p[0]));
      ys.push(Math.floor(p[1]));
    }
    // remove L corners
    const keep = new Uint8Array(xs.length).fill(1);
    let last = 0;
    for (let i = 1; i < xs.length - 1; i++) {
      const j = i + 1;
      if (
        Math.abs(xs[j] - xs[last]) === 1 &&
        Math.abs(ys[j] - ys[last]) === 1 &&
        (xs[i] === xs[last] || ys[i] === ys[last])
      ) {
        keep[i] = 0;
      } else last = i;
    }
    for (let i = 0; i < xs.length; i++) if (keep[i]) this.px(xs[i], ys[i], ink);
  }

  /** 1px polyline in design units. */
  line(pts: ArrayLike<number>, ink: Ink): void {
    this.linePx(this.toPx(pts), ink);
  }

  /** Add a 1px outline of `ink` around opaque pixels (into transparent pixels). */
  outline(ink: Ink, diag = false): void {
    const { w, h, data } = this;
    const src = data.slice();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (src[i] !== 0) continue;
        let hit =
          (x > 0 && src[i - 1] !== 0) ||
          (x < w - 1 && src[i + 1] !== 0) ||
          (y > 0 && src[i - w] !== 0) ||
          (y < h - 1 && src[i + w] !== 0);
        if (!hit && diag) {
          hit =
            (x > 0 && y > 0 && src[i - w - 1] !== 0) ||
            (x < w - 1 && y > 0 && src[i - w + 1] !== 0) ||
            (x > 0 && y < h - 1 && src[i + w - 1] !== 0) ||
            (x < w - 1 && y < h - 1 && src[i + w + 1] !== 0);
        }
        if (hit) data[i] = typeof ink === 'number' ? ink : ink(x, y);
      }
    }
  }

  /** Recolor opaque edge pixels that touch transparency on the given side (rim light). */
  rim(ink: Ink, dx: number, dy: number, only = -1): void {
    const { w, h, data } = this;
    const src = data.slice();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const v = src[i];
        if (v === 0 || (only >= 0 && v !== only)) continue;
        const nx = x + dx;
        const ny = y + dy;
        const out = nx < 0 || ny < 0 || nx >= w || ny >= h ? false : src[ny * w + nx] === 0;
        if (out) data[i] = typeof ink === 'number' ? ink : ink(x, y);
      }
    }
  }

  /** Composite another raster of the same size over this one (index 0 = transparent). */
  over(src: Raster, dx = 0, dy = 0): void {
    if (dx === 0 && dy === 0 && src.w === this.w && src.h === this.h) {
      const s = src.data;
      const d = this.data;
      for (let i = 0; i < s.length; i++) if (s[i] !== 0) d[i] = s[i];
      return;
    }
    for (let y = 0; y < src.h; y++) {
      const ty = y + dy;
      if (ty < 0 || ty >= this.h) continue;
      for (let x = 0; x < src.w; x++) {
        const v = src.data[y * src.w + x];
        if (v === 0) continue;
        const tx = x + dx;
        if (tx < 0 || tx >= this.w) continue;
        this.data[ty * this.w + tx] = v;
      }
    }
  }

  /**
   * Cast shadow: pixels of this raster (optionally only of color `only`) that
   * are covered by `mask` shifted by (dx, dy) pixels get `ink`.
   */
  castShadow(mask: Raster, dx: number, dy: number, ink: Ink, only = -1): void {
    const { w, h, data } = this;
    const mdx = Math.round(dx);
    const mdy = Math.round(dy);
    for (let y = 0; y < h; y++) {
      const sy = y - mdy;
      if (sy < 0 || sy >= mask.h) continue;
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const v = data[i];
        if (v === 0 || (only >= 0 && v !== only)) continue;
        const sx = x - mdx;
        if (sx < 0 || sx >= mask.w) continue;
        if (mask.data[sy * mask.w + sx] !== 0) data[i] = typeof ink === 'number' ? ink : ink(x, y);
      }
    }
  }

  /** Replace colors through a lookup table (index → index). */
  remap(lut: ArrayLike<number>): void {
    const d = this.data;
    for (let i = 0; i < d.length; i++) if (d[i] !== 0) d[i] = lut[d[i]];
  }

  /** Paint into a fresh canvas. */
  toCanvas(): HTMLCanvasElement {
    const cv = makeCanvas(this.w, this.h);
    const ctx = cv.getContext('2d')!;
    const img = ctx.createImageData(this.w, this.h);
    const u32 = new Uint32Array(img.data.buffer);
    const d = this.data;
    for (let i = 0; i < d.length; i++) u32[i] = RGBA[d[i]];
    ctx.putImageData(img, 0, 0);
    return cv;
  }
}
