/**
 * Tiny software raster used by the environment + icon generators. Art is built
 * on a colour grid (one hex string per pixel) so it can be shaded, outlined and
 * post-processed before being turned into a canvas once.
 */
import { hash2, makeCanvas, ctx2d, type Canvas } from '../core';

export type Col = string;
/** Per-pixel shader. nx/ny are the offsets from the shape centre normalised to [-1, 1]. */
export type Shader = (x: number, y: number, nx: number, ny: number) => Col | null | undefined;
type Paint = Col | Shader;

// ------------------------------------------------------------------ colour --

const rgbaCache = new Map<string, [number, number, number, number]>();

export function rgba(hex: string): [number, number, number, number] {
  let v = rgbaCache.get(hex);
  if (!v) {
    const h = hex.replace('#', '');
    const full = h.length === 3 ? h.replace(/(.)/g, '$1$1') : h;
    const n = parseInt(full.slice(0, 6), 16);
    const a = full.length >= 8 ? parseInt(full.slice(6, 8), 16) : 255;
    v = [(n >> 16) & 255, (n >> 8) & 255, n & 255, a];
    rgbaCache.set(hex, v);
  }
  return v;
}

function hx(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n)))
    .toString(16)
    .padStart(2, '0');
}

/** Linear blend of two hex colours (t = 0 → a, 1 → b). */
export function mix(a: Col, b: Col, t: number): Col {
  const A = rgba(a);
  const B = rgba(b);
  return `#${hx(A[0] + (B[0] - A[0]) * t)}${hx(A[1] + (B[1] - A[1]) * t)}${hx(A[2] + (B[2] - A[2]) * t)}`;
}

/** Colour with alpha (0-1). */
export function alpha(c: Col, a: number): Col {
  return c.slice(0, 7) + hx(a * 255);
}

// ---------------------------------------------------------------- dithering --

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

/** Ordered-dither threshold in (0, 1). */
export function bayer(x: number, y: number): number {
  return BAYER4[(y & 3) * 4 + (x & 3)];
}

/**
 * Pick a colour from a dark→light ramp for t in [0, 1]. `dither` (0-1) widens the
 * band around each step that is ordered-dithered (0 = hard bands).
 */
export function ramp(cols: readonly Col[], t: number, x: number, y: number, dither = 0.35): Col {
  const n = cols.length;
  const v = Math.max(0, Math.min(0.9999, t)) * (n - 1);
  const i = Math.floor(v);
  const f = v - i;
  const th = 0.5 + (bayer(x, y) - 0.5) * dither;
  return cols[Math.min(n - 1, f > th ? i + 1 : i)];
}

/** Top-left light (x right, y down, z toward the viewer). */
const LX = -0.55;
const LY = -0.65;
const LZ = 0.52;

/** Lambert term for a sphere-ish surface given the normalised offset (nx, ny). Returns 0..1. */
export function sphereLight(nx: number, ny: number, ambient = 0.18): number {
  const d2 = nx * nx + ny * ny;
  const nz = Math.sqrt(Math.max(0, 1 - Math.min(1, d2)));
  const l = (nx * LX + ny * LY + nz * LZ) / Math.hypot(LX, LY, LZ);
  return Math.max(0, Math.min(1, ambient + (1 - ambient) * Math.max(0, l)));
}

/** Deterministic random in [0,1) from integer inputs. */
export function rnd(x: number, y: number, seed = 0): number {
  return hash2(x, y, seed);
}

/** Tiny seeded PRNG for procedural placement. */
export function rng(seed: number): () => number {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

/** Tileable value noise with the given integer period (in cells of size `cell`). */
export function tileNoise(x: number, y: number, cell: number, period: number, seed: number): number {
  const gx = x / cell;
  const gy = y / cell;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const fx = gx - x0;
  const fy = gy - y0;
  const p = (a: number) => ((a % period) + period) % period;
  const v = (a: number, b: number) => hash2(p(a), p(b), seed);
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = v(x0, y0) + (v(x0 + 1, y0) - v(x0, y0)) * sx;
  const b = v(x0, y0 + 1) + (v(x0 + 1, y0 + 1) - v(x0, y0 + 1)) * sx;
  return a + (b - a) * sy;
}

// -------------------------------------------------------------------- grid --

export class Grid {
  readonly d: (Col | null)[];

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.d = new Array<Col | null>(w * h).fill(null);
  }

  inb(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  get(x: number, y: number): Col | null {
    x = Math.floor(x);
    y = Math.floor(y);
    return this.inb(x, y) ? this.d[y * this.w + x] : null;
  }

  /** Wrapping read (for tileable textures). */
  getw(x: number, y: number): Col | null {
    const w = this.w;
    const h = this.h;
    return this.d[(((y % h) + h) % h) * w + (((x % w) + w) % w)];
  }

  /** `undefined` is a no-op, `null` clears. */
  set(x: number, y: number, c: Col | null | undefined): this {
    if (c === undefined) return this;
    x = Math.floor(x);
    y = Math.floor(y);
    if (this.inb(x, y)) this.d[y * this.w + x] = c;
    return this;
  }

  /** Wrapping write. */
  setw(x: number, y: number, c: Col | null | undefined): this {
    if (c === undefined) return this;
    const w = this.w;
    const h = this.h;
    this.d[(((y % h) + h) % h) * w + (((x % w) + w) % w)] = c;
    return this;
  }

  opaque(x: number, y: number): boolean {
    return this.get(x, y) !== null;
  }

  rect(x: number, y: number, w: number, h: number, c: Paint): this {
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const px = x + i;
        const py = y + j;
        this.set(
          px,
          py,
          typeof c === 'string'
            ? c
            : c(px, py, w > 1 ? (i / (w - 1)) * 2 - 1 : 0, h > 1 ? (j / (h - 1)) * 2 - 1 : 0),
        );
      }
    return this;
  }

  hline(x0: number, x1: number, y: number, c: Col): this {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.set(x, y, c);
    return this;
  }

  vline(x: number, y0: number, y1: number, c: Col): this {
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) this.set(x, y, c);
    return this;
  }

  line(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    c: Col | ((x: number, y: number, t: number) => Col | null | undefined),
  ): this {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    const len = Math.max(dx, -dy) || 1;
    let n = 0;
    for (;;) {
      this.set(x0, y0, typeof c === 'string' ? c : c(x0, y0, n / len));
      n++;
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
    return this;
  }

  /** Filled ellipse. cx/cy may be fractional (use .5 for even sizes). */
  ellipse(cx: number, cy: number, rx: number, ry: number, c: Paint): this {
    const x0 = Math.floor(cx - rx - 1);
    const x1 = Math.ceil(cx + rx + 1);
    const y0 = Math.floor(cy - ry - 1);
    const y1 = Math.ceil(cy + ry + 1);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const nx = (x + 0.5 - cx) / rx;
        const ny = (y + 0.5 - cy) / ry;
        if (nx * nx + ny * ny <= 1) this.set(x, y, typeof c === 'string' ? c : c(x, y, nx, ny));
      }
    return this;
  }

  /** Filled polygon (even-odd scanline, pixel centres). */
  poly(pts: readonly (readonly [number, number])[], c: Paint): this {
    let minY = Infinity;
    let maxY = -Infinity;
    let minX = Infinity;
    let maxX = -Infinity;
    for (const [px, py] of pts) {
      minY = Math.min(minY, py);
      maxY = Math.max(maxY, py);
      minX = Math.min(minX, px);
      maxX = Math.max(maxX, px);
    }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const sy = y + 0.5;
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i];
        const [bx, by] = pts[(i + 1) % pts.length];
        if ((ay <= sy && by > sy) || (by <= sy && ay > sy)) xs.push(ax + ((sy - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.ceil(xs[k] - 0.5); x <= Math.floor(xs[k + 1] - 0.5); x++) {
          const nx = maxX > minX ? ((x + 0.5 - minX) / (maxX - minX)) * 2 - 1 : 0;
          const ny = maxY > minY ? ((y + 0.5 - minY) / (maxY - minY)) * 2 - 1 : 0;
          this.set(x, y, typeof c === 'string' ? c : c(x, y, nx, ny));
        }
      }
    }
    return this;
  }

  /** Re-colour every opaque pixel (return undefined to keep, null to clear). */
  map(fn: (c: Col, x: number, y: number) => Col | null | undefined): this {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const c = this.d[y * this.w + x];
        if (c !== null) {
          const r = fn(c, x, y);
          if (r !== undefined) this.d[y * this.w + x] = r;
        }
      }
    return this;
  }

  /** Visit every pixel (opaque or not). */
  each(fn: (x: number, y: number, c: Col | null) => Col | null | undefined): this {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const r = fn(x, y, this.d[y * this.w + x]);
        if (r !== undefined) this.d[y * this.w + x] = r;
      }
    return this;
  }

  /**
   * Add a 1px outline around opaque pixels. `c` may be a function of the
   * neighbouring inner colour (for selective outlines).
   */
  outline(c: Col | ((inner: Col, x: number, y: number) => Col | null | undefined), diag = false): this {
    const src = this.d.slice();
    const at = (x: number, y: number) => (this.inb(x, y) ? src[y * this.w + x] : null);
    const nb: [number, number][] = diag
      ? [
          [0, -1],
          [1, 0],
          [0, 1],
          [-1, 0],
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ]
      : [
          [0, -1],
          [1, 0],
          [0, 1],
          [-1, 0],
        ];
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (src[y * this.w + x] !== null) continue;
        for (const [dx, dy] of nb) {
          const inner = at(x + dx, y + dy);
          if (inner !== null) {
            const oc = typeof c === 'string' ? c : c(inner, x, y);
            if (oc) this.d[y * this.w + x] = oc;
            break;
          }
        }
      }
    return this;
  }

  /** Pixels of the shape that touch transparency on any 4-side get `fn` applied. */
  rim(
    fn: (
      c: Col,
      x: number,
      y: number,
      side: { n: boolean; e: boolean; s: boolean; w: boolean },
    ) => Col | undefined,
  ): this {
    const src = this.d.slice();
    const at = (x: number, y: number) => (this.inb(x, y) ? src[y * this.w + x] : null);
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const c = src[y * this.w + x];
        if (c === null) continue;
        const side = {
          n: at(x, y - 1) === null,
          e: at(x + 1, y) === null,
          s: at(x, y + 1) === null,
          w: at(x - 1, y) === null,
        };
        if (side.n || side.e || side.s || side.w) {
          const r = fn(c, x, y, side);
          if (r !== undefined) this.d[y * this.w + x] = r;
        }
      }
    return this;
  }

  /** Draw another grid on top. */
  blit(src: Grid, ox: number, oy: number, flip = false): this {
    for (let y = 0; y < src.h; y++)
      for (let x = 0; x < src.w; x++) {
        const c = src.d[y * src.w + (flip ? src.w - 1 - x : x)];
        if (c !== null) this.set(ox + x, oy + y, c);
      }
    return this;
  }

  /** Stamp ASCII art; '.' and ' ' are transparent, unknown chars are skipped. */
  stamp(rows: readonly string[], pal: Readonly<Record<string, Col>>, ox = 0, oy = 0, flip = false): this {
    for (let y = 0; y < rows.length; y++) {
      const r = rows[y];
      for (let x = 0; x < r.length; x++) {
        const ch = r[flip ? r.length - 1 - x : x];
        if (ch === '.' || ch === ' ') continue;
        const c = pal[ch];
        if (c) this.set(ox + x, oy + y, c);
      }
    }
    return this;
  }

  clone(): Grid {
    const g = new Grid(this.w, this.h);
    for (let i = 0; i < this.d.length; i++) g.d[i] = this.d[i];
    return g;
  }

  toCanvas(): Canvas {
    const c = makeCanvas(this.w, this.h);
    const ctx = ctx2d(c);
    const img = ctx.createImageData(this.w, this.h);
    const out = img.data;
    for (let i = 0; i < this.d.length; i++) {
      const col = this.d[i];
      if (col === null) continue;
      const [r, g, b, a] = rgba(col);
      out[i * 4] = r;
      out[i * 4 + 1] = g;
      out[i * 4 + 2] = b;
      out[i * 4 + 3] = a;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }
}

/** Parse ASCII art into a fresh grid. */
export function gridFrom(rows: readonly string[], pal: Readonly<Record<string, Col>>): Grid {
  const w = rows.reduce((m, r) => Math.max(m, r.length), 0);
  return new Grid(w, rows.length).stamp(rows, pal);
}

/** Multi-octave tileable noise with period 16 (0..1). */
export function fbm16(x: number, y: number, seed: number): number {
  return (
    tileNoise(x, y, 8, 2, seed) * 0.5 +
    tileNoise(x, y, 4, 4, seed + 1) * 0.32 +
    tileNoise(x, y, 2, 8, seed + 2) * 0.18
  );
}
