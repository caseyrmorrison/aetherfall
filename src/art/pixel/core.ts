/**
 * Low-level helpers for procedural pixel art. Everything here produces small
 * offscreen canvases that are cached and blitted with nearest-neighbour scaling.
 */

export type Canvas = HTMLCanvasElement;

export function makeCanvas(w: number, h: number): Canvas {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

export function ctx2d(c: Canvas): CanvasRenderingContext2D {
  const ctx = c.getContext('2d', { willReadFrequently: false });
  if (!ctx) throw new Error('2D canvas unavailable');
  ctx.imageSmoothingEnabled = false;
  return ctx;
}

/** Create a canvas and run a draw callback on it. */
export function paint(
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D, c: Canvas) => void,
): Canvas {
  const c = makeCanvas(w, h);
  draw(ctx2d(c), c);
  return c;
}

/**
 * Build a sprite from ASCII rows. Each character maps to a color in `palette`;
 * '.' and ' ' are transparent. All rows are padded to the widest row.
 */
export function fromPixels(rows: readonly string[], palette: Readonly<Record<string, string>>): Canvas {
  const h = rows.length;
  const w = rows.reduce((m, r) => Math.max(m, r.length), 0);
  return paint(w, h, (ctx) => {
    for (let y = 0; y < h; y++) {
      const row = rows[y];
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === '.' || ch === ' ') continue;
        const col = palette[ch];
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  });
}

export function flipX(src: Canvas): Canvas {
  return paint(src.width, src.height, (ctx) => {
    ctx.translate(src.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(src, 0, 0);
  });
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Exact color swap (palette swap). Keys and values are '#rrggbb'. */
export function recolor(src: Canvas, map: Readonly<Record<string, string>>): Canvas {
  const out = makeCanvas(src.width, src.height);
  const ctx = ctx2d(out);
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, out.width, out.height);
  const d = img.data;
  const lut = new Map<number, [number, number, number]>();
  for (const [from, to] of Object.entries(map)) {
    const [r, g, b] = hexToRgb(from);
    lut.set((r << 16) | (g << 8) | b, hexToRgb(to));
  }
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const hit = lut.get((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
    if (hit) {
      d[i] = hit[0];
      d[i + 1] = hit[1];
      d[i + 2] = hit[2];
    }
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

const silhouetteCache = new WeakMap<Canvas, Map<string, Canvas>>();

/** Solid-color silhouette of a sprite (used for hit flashes and shadows). Cached. */
export function silhouette(src: Canvas, color = '#ffffff'): Canvas {
  let byColor = silhouetteCache.get(src);
  if (!byColor) {
    byColor = new Map();
    silhouetteCache.set(src, byColor);
  }
  const cached = byColor.get(color);
  if (cached) return cached;
  const out = paint(src.width, src.height, (ctx) => {
    ctx.drawImage(src, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, src.width, src.height);
  });
  byColor.set(color, out);
  return out;
}

/** Returns a copy of `src` with a 1px outline drawn around opaque pixels (canvas grows by 2px). */
export function outlined(src: Canvas, color: string): Canvas {
  const sil = silhouette(src, color);
  return paint(src.width + 2, src.height + 2, (ctx) => {
    for (const [dx, dy] of [
      [0, 1],
      [2, 1],
      [1, 0],
      [1, 2],
    ] as const) {
      ctx.drawImage(sil, dx, dy);
    }
    ctx.drawImage(src, 1, 1);
  });
}

/** Simple string-keyed memoizer for expensive procedural art. */
export function memo<A extends unknown[], R>(
  keyFn: (...args: A) => string,
  fn: (...args: A) => R,
): (...args: A) => R {
  const cache = new Map<string, R>();
  return (...args: A): R => {
    const k = keyFn(...args);
    let v = cache.get(k);
    if (v === undefined) {
      v = fn(...args);
      cache.set(k, v);
    }
    return v;
  };
}

/** Deterministic hash → [0,1) used for per-tile variation without an RNG object. */
export function hash2(x: number, y: number, seed = 0): number {
  let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
