/**
 * Tiny pixel-buffer toolkit used to author actor sprites. Sprites are composed
 * in a `Buf` (a grid of '#rrggbb' strings), shaded / outlined, then converted
 * to a canvas exactly once (callers cache the result).
 */
import { ctx2d, makeCanvas, type Canvas } from '../core';

export type Col = string;
export type Pal = Readonly<Record<string, Col>>;
/** Colour ramp ordered dark → light. */
export type Ramp = readonly Col[];

/** Default outline colour (ENDESGA black). */
export const INK = '#181425';

const rgbaCache = new Map<string, [number, number, number, number]>();

/** Parses '#rgb', '#rrggbb' or '#rrggbbaa'. */
export function rgba(hex: Col): [number, number, number, number] {
  let v = rgbaCache.get(hex);
  if (!v) {
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.replace(/(.)/g, '$1$1');
    const n = parseInt(h.slice(0, 6), 16);
    const a = h.length >= 8 ? parseInt(h.slice(6, 8), 16) : 255;
    v = [(n >> 16) & 255, (n >> 8) & 255, n & 255, a];
    rgbaCache.set(hex, v);
  }
  return v;
}

function hex2(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n)))
    .toString(16)
    .padStart(2, '0');
}

/** Linear blend of two colours (t = 0 → a, 1 → b). */
export function mix(a: Col, b: Col, t: number): Col {
  const A = rgba(a);
  const B = rgba(b);
  return `#${hex2(A[0] + (B[0] - A[0]) * t)}${hex2(A[1] + (B[1] - A[1]) * t)}${hex2(A[2] + (B[2] - A[2]) * t)}`;
}

/** Same colour with an alpha channel (0-1). */
export function alpha(c: Col, a: number): Col {
  const [r, g, b] = rgba(c);
  return `#${hex2(r)}${hex2(g)}${hex2(b)}${hex2(a * 255)}`;
}

export type Pt = readonly [number, number];

export class Buf {
  readonly w: number;
  readonly h: number;
  readonly d: (Col | null)[];

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.d = new Array<Col | null>(w * h).fill(null);
  }

  /** Buffer from ASCII rows ('.' / ' ' / unknown chars are transparent). */
  static rows(rows: readonly string[], pal: Pal): Buf {
    const w = rows.reduce((m, r) => Math.max(m, r.length), 0);
    const b = new Buf(w, rows.length);
    b.stamp(rows, pal);
    return b;
  }

  inb(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  get(x: number, y: number): Col | null {
    x = Math.floor(x);
    y = Math.floor(y);
    if (!this.inb(x, y)) return null;
    return this.d[y * this.w + x];
  }

  has(x: number, y: number): boolean {
    return this.get(x, y) !== null;
  }

  set(x: number, y: number, c: Col | null): this {
    x = Math.floor(x);
    y = Math.floor(y);
    if (this.inb(x, y)) this.d[y * this.w + x] = c;
    return this;
  }

  /** Set only where the pixel is already opaque. */
  tint(x: number, y: number, c: Col): this {
    if (this.has(x, y)) this.set(x, y, c);
    return this;
  }

  rect(x: number, y: number, w: number, h: number, c: Col | null): this {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
    return this;
  }

  hline(x0: number, x1: number, y: number, c: Col | null): this {
    const a = Math.min(x0, x1);
    const b = Math.max(x0, x1);
    for (let x = a; x <= b; x++) this.set(x, y, c);
    return this;
  }

  vline(x: number, y0: number, y1: number, c: Col | null): this {
    const a = Math.min(y0, y1);
    const b = Math.max(y0, y1);
    for (let y = a; y <= b; y++) this.set(x, y, c);
    return this;
  }

  /** Bresenham line; `thick` > 1 stamps a square brush. */
  line(x0: number, y0: number, x1: number, y1: number, c: Col | null, thick = 1): this {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    const o = Math.floor((thick - 1) / 2);
    for (;;) {
      if (thick <= 1) this.set(x0, y0, c);
      else this.rect(x0 - o, y0 - o, thick, thick, c);
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

  /** Points of a Bresenham line (inclusive). */
  static linePts(x0: number, y0: number, x1: number, y1: number): Pt[] {
    const pts: Pt[] = [];
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      pts.push([x0, y0]);
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
    return pts;
  }

  /** Filled ellipse; centre/radii are real-valued, tested at pixel centres. */
  ellipse(cx: number, cy: number, rx: number, ry: number, c: Col | null): this {
    if (rx <= 0 || ry <= 0) return this;
    const x0 = Math.floor(cx - rx);
    const x1 = Math.ceil(cx + rx);
    const y0 = Math.floor(cy - ry);
    const y1 = Math.ceil(cy + ry);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const nx = (x + 0.5 - cx) / rx;
        const ny = (y + 0.5 - cy) / ry;
        if (nx * nx + ny * ny <= 1.0001) this.set(x, y, c);
      }
    }
    return this;
  }

  /** Ring (ellipse outline) between radius r-thick and r. */
  ring(cx: number, cy: number, r: number, thick: number, c: Col | null, ry = r): this {
    const k = ry / r;
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
      for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
        const dx = x + 0.5 - cx;
        const dy = (y + 0.5 - cy) / k;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d <= r && d > r - thick) this.set(x, y, c);
      }
    }
    return this;
  }

  /** Filled polygon (even-odd, sampled at pixel centres). */
  poly(pts: readonly Pt[], c: Col | null): this {
    if (pts.length < 3) return this;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const p of pts) {
      y0 = Math.min(y0, p[1]);
      y1 = Math.max(y1, p[1]);
    }
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
      const sy = y + 0.5;
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        if ((a[1] <= sy && b[1] > sy) || (b[1] <= sy && a[1] > sy)) {
          xs.push(a[0] + ((sy - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
        }
      }
      xs.sort((p, q) => p - q);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        for (let x = Math.ceil(xs[i] - 0.5); x <= Math.floor(xs[i + 1] - 0.5); x++) this.set(x, y, c);
      }
    }
    return this;
  }

  /** Draw ASCII rows at (ox, oy). */
  stamp(rows: readonly string[], pal: Pal, ox = 0, oy = 0, flip = false): this {
    const w = rows.reduce((m, r) => Math.max(m, r.length), 0);
    for (let y = 0; y < rows.length; y++) {
      const row = rows[y];
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === '.' || ch === ' ') continue;
        const col = pal[ch];
        if (col === undefined) continue;
        this.set(ox + (flip ? w - 1 - x : x), oy + y, col);
      }
    }
    return this;
  }

  /** Composite another buffer on top. */
  blit(src: Buf, ox = 0, oy = 0, flip = false): this {
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const c = src.d[y * src.w + x];
        if (c === null) continue;
        this.set(ox + (flip ? src.w - 1 - x : x), oy + y, c);
      }
    }
    return this;
  }

  /** Composite only where this buffer is already opaque (clip to silhouette). */
  blitClip(src: Buf, ox = 0, oy = 0): this {
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const c = src.d[y * src.w + x];
        if (c === null) continue;
        if (this.has(ox + x, oy + y)) this.set(ox + x, oy + y, c);
      }
    }
    return this;
  }

  each(fn: (c: Col, x: number, y: number) => void): this {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const c = this.d[y * this.w + x];
        if (c !== null) fn(c, x, y);
      }
    }
    return this;
  }

  /** Replace colours (exact match). */
  recolor(map: Readonly<Record<string, Col>>): this {
    const norm = new Map<string, Col>();
    for (const [k, v] of Object.entries(map)) norm.set(k.toLowerCase(), v);
    for (let i = 0; i < this.d.length; i++) {
      const c = this.d[i];
      if (c === null) continue;
      const r = norm.get(c.toLowerCase());
      if (r !== undefined) this.d[i] = r;
    }
    return this;
  }

  /**
   * Add a 1px outline around the silhouette. `col` may be a function of the
   * neighbouring colour (for selective outlines). `diag` also fills corners.
   */
  outline(col: Col | ((neighbour: Col) => Col | null) = INK, diag = false): this {
    const src = this.d.slice();
    const at = (x: number, y: number): Col | null => (this.inb(x, y) ? src[y * this.w + x] : null);
    const N4: Pt[] = [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ];
    const N8: Pt[] = [...N4, [1, 1], [1, -1], [-1, 1], [-1, -1]];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (at(x, y) !== null) continue;
        for (const [dx, dy] of diag ? N8 : N4) {
          const n = at(x + dx, y + dy);
          if (n === null) continue;
          const c = typeof col === 'function' ? col(n) : col;
          if (c !== null) this.d[y * this.w + x] = c;
          break;
        }
      }
    }
    return this;
  }

  /**
   * Draw a dark line along the edges of `layer` where it overlaps existing
   * opaque pixels of this buffer (separates overlapping parts), then blit it.
   */
  overlay(layer: Buf, edge: Col = INK, sides: 'all' | 'back' = 'all', ox = 0, oy = 0): this {
    const N: Pt[] =
      sides === 'all'
        ? [
            [0, 1],
            [0, -1],
            [1, 0],
            [-1, 0],
          ]
        : [
            [-1, 0],
            [0, 1],
          ];
    const marks: Pt[] = [];
    layer.each((_c, x, y) => {
      for (const [dx, dy] of N) {
        const lx = x + dx;
        const ly = y + dy;
        if (layer.has(lx, ly)) continue;
        if (this.has(lx + ox, ly + oy)) marks.push([lx + ox, ly + oy]);
      }
    });
    for (const [x, y] of marks) this.set(x, y, edge);
    return this.blit(layer, ox, oy);
  }

  flipX(): Buf {
    const b = new Buf(this.w, this.h);
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) b.d[y * this.w + (this.w - 1 - x)] = this.d[y * this.w + x];
    return b;
  }

  /** Rotate 90° clockwise `turns` times (square buffers keep their size). */
  rot90(turns: number): Buf {
    let cur = this.clone();
    for (let t = 0; t < ((turns % 4) + 4) % 4; t++) {
      const b = new Buf(cur.h, cur.w);
      for (let y = 0; y < cur.h; y++)
        for (let x = 0; x < cur.w; x++) b.set(cur.h - 1 - y, x, cur.d[y * cur.w + x]);
      cur = b;
    }
    return cur;
  }

  clone(): Buf {
    const b = new Buf(this.w, this.h);
    for (let i = 0; i < this.d.length; i++) b.d[i] = this.d[i];
    return b;
  }

  /** New buffer of size (w, h) with this one drawn at (ox, oy). */
  place(w: number, h: number, ox = 0, oy = 0): Buf {
    return new Buf(w, h).blit(this, ox, oy);
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

export interface ShadeOpts {
  /** Light direction the lit side faces (default top-left). */
  lx?: number;
  ly?: number;
  /** Extra lighting on top/left edges and darkening on bottom/right edges. */
  rim?: number;
  /** Shift all values (positive = lighter). */
  bias?: number;
  /** Override the volume used for the normal (defaults to the bounding box). */
  cx?: number;
  cy?: number;
  rx?: number;
  ry?: number;
  /** Checker-dither across band edges. */
  dither?: boolean;
}

const THRESH: Record<number, number[]> = {
  1: [],
  2: [0],
  3: [-0.3, 0.38],
  4: [-0.38, 0.22, 0.78],
  5: [-0.62, -0.2, 0.3, 0.82],
  6: [-0.7, -0.35, 0.05, 0.45, 0.85],
};

/**
 * Volume-shade every opaque pixel of `b` with `ramp` (dark → light) as if it
 * were a rounded solid lit from the top-left. Returns `b`.
 */
export function shade(b: Buf, ramp: Ramp, o: ShadeOpts = {}): Buf {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  b.each((_c, x, y) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  });
  if (minX === Infinity) return b;
  const cx = o.cx ?? (minX + maxX + 1) / 2;
  const cy = o.cy ?? (minY + maxY + 1) / 2;
  const rx = Math.max(0.5, o.rx ?? (maxX - minX + 1) / 2);
  const ry = Math.max(0.5, o.ry ?? (maxY - minY + 1) / 2);
  let lx = o.lx ?? -0.55;
  let ly = o.ly ?? -0.85;
  const ll = Math.hypot(lx, ly) || 1;
  lx /= ll;
  ly /= ll;
  const rim = o.rim ?? 0.28;
  const bias = o.bias ?? 0;
  const th = THRESH[ramp.length] ?? THRESH[4];
  const src = b.clone();
  b.each((_c, x, y) => {
    const nx = (x + 0.5 - cx) / rx;
    const ny = (y + 0.5 - cy) / ry;
    let v = nx * lx + ny * ly + bias;
    if (!src.has(x - 1, y) || !src.has(x, y - 1)) v += rim;
    if (!src.has(x + 1, y) || !src.has(x, y + 1)) v -= rim;
    if (o.dither && (x + y) % 2 === 0) v += 0.12;
    else if (o.dither) v -= 0.12;
    let i = 0;
    while (i < th.length && v > th[i]) i++;
    b.set(x, y, ramp[Math.min(i, ramp.length - 1)]);
  });
  return b;
}

/** Convenience: a fresh layer the size of `like`. */
export function layer(like: { w: number; h: number }): Buf {
  return new Buf(like.w, like.h);
}

/** Draw `fn` into a temp layer, volume-shade it with `ramp`, then composite onto `dst`. */
export function part(dst: Buf, ramp: Ramp, fn: (l: Buf) => void, o: ShadeOpts = {}): Buf {
  const l = layer(dst);
  fn(l);
  shade(l, ramp, o);
  dst.blit(l);
  return l;
}

/** Deterministic small hash for sprinkling details. */
export function h2(x: number, y: number, s = 0): number {
  let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
