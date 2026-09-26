/**
 * Small drawing helpers shared by the creature / boss modules.
 */
import { PAL } from '../../palette';
import { Buf, INK, mix, shade, type Col, type Pt, type Ramp, type ShadeOpts } from './buf';

export const R = {
  green: [PAL.forest, PAL.darkGreen, PAL.green, '#b4ec8a'],
  red: [PAL.darkRed, PAL.red, PAL.pink],
  fire: [PAL.darkRed, PAL.rust, PAL.orange, PAL.gold, PAL.yellow],
  gold: [PAL.rust, PAL.orange, PAL.gold, PAL.yellow],
  ice: [PAL.blue, PAL.sky, PAL.cyan, '#c9fbff'],
  snow: [PAL.slate, PAL.gray, PAL.lightGray, PAL.white],
  stone: [PAL.darkSlate, PAL.slate, PAL.gray, PAL.lightGray],
  rock: [PAL.plum, PAL.darkBrown, PAL.brown, PAL.tan],
  wood: [PAL.plum, PAL.darkBrown, PAL.brown],
  bone: [PAL.gray, PAL.lightGray, PAL.white],
  purple: [PAL.plum, PAL.purple, PAL.magenta, PAL.pink],
  void: ['#1f1030', PAL.purple, PAL.magenta, '#e39bd6'],
  shadow: [INK, PAL.navy, PAL.darkSlate, PAL.slate],
  sand: [PAL.skinShade, PAL.tan, PAL.sand, PAL.white],
  skin: [PAL.skinShade, PAL.skin, '#f4d2b8'],
} as const satisfies Record<string, Ramp>;

/** Draw a shape into a temp layer, shade it as a volume, composite it. */
export function vol(dst: Buf, ramp: Ramp, draw: (l: Buf) => void, o: ShadeOpts = {}): Buf {
  const l = new Buf(dst.w, dst.h);
  draw(l);
  shade(l, ramp, o);
  dst.blit(l);
  return l;
}

/** A fresh w×h layer with `draw` volume-shaded by `ramp` (not composited). */
export function shaded(w: number, h: number, ramp: Ramp, draw: (l: Buf) => void, o: ShadeOpts = {}): Buf {
  const l = new Buf(w, h);
  draw(l);
  return shade(l, ramp, o);
}

/** Offset a polyline progressively: point i moves by (dx, dy) · i / (n - 1). */
export function bend(pts: readonly Pt[], dx: number, dy: number): Pt[] {
  const n = Math.max(1, pts.length - 1);
  return pts.map(([x, y], i) => [x + (dx * i) / n, y + (dy * i) / n] as Pt);
}

/** Like vol() but separated from what is already drawn by a dark edge. */
export function volOver(
  dst: Buf,
  ramp: Ramp,
  draw: (l: Buf) => void,
  o: ShadeOpts = {},
  edge: Col = INK,
): Buf {
  const l = new Buf(dst.w, dst.h);
  draw(l);
  shade(l, ramp, o);
  dst.overlay(l, edge, 'all');
  return l;
}

/** A tapered limb (thickness t0 → t1) from a to b. */
export function limb(b: Buf, a: Pt, c: Pt, t0: number, t1: number, col: Col): Buf {
  const pts = Buf.linePts(a[0], a[1], c[0], c[1]);
  pts.forEach(([x, y], i) => {
    const t = pts.length > 1 ? i / (pts.length - 1) : 0;
    const r = (t0 + (t1 - t0) * t) / 2;
    b.ellipse(x + 0.5, y + 0.5, Math.max(0.5, r), Math.max(0.5, r), col);
  });
  return b;
}

/** Sample a quadratic bezier (n + 1 points). */
export function bez(a: Pt, c: Pt, d: Pt, n: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push([
      u * u * a[0] + 2 * u * t * c[0] + t * t * d[0],
      u * u * a[1] + 2 * u * t * c[1] + t * t * d[1],
    ]);
  }
  return out;
}

/** Tapered stroke along points (thickness t0 → t1). */
export function stroke(b: Buf, pts: readonly Pt[], t0: number, t1: number, col: Col): void {
  pts.forEach(([x, y], i) => {
    const t = pts.length > 1 ? i / (pts.length - 1) : 0;
    const r = Math.max(0.5, (t0 + (t1 - t0) * t) / 2);
    b.ellipse(x, y, r, r, col);
  });
}

/** Filled triangle. */
export function tri(b: Buf, a: Pt, c: Pt, d: Pt, col: Col): Buf {
  return b.poly([a, c, d], col);
}

/** Outline with a colour derived from each neighbour (darkened), for softer sprites. */
export function selOutline(b: Buf, t = 0.65): Buf {
  return b.outline((n) => mix(n, INK, t));
}

/** Glow pixels: semi-transparent halo around opaque pixels. */
export function glow(b: Buf, col: Col, a = 0.35): Buf {
  const [r, g, bl] = [col.slice(1, 3), col.slice(3, 5), col.slice(5, 7)];
  const c = `#${r}${g}${bl}${Math.round(a * 255)
    .toString(16)
    .padStart(2, '0')}`;
  return b.outline(c);
}

/** Scatter single pixels deterministically inside a region. */
export function sprinkle(
  b: Buf,
  x0: number,
  y0: number,
  w: number,
  h: number,
  n: number,
  col: Col,
  seed: number,
  onlyOpaque = true,
): Buf {
  let s = seed * 9301 + 49297;
  const rnd = (): number => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  for (let i = 0; i < n; i++) {
    const x = Math.floor(x0 + rnd() * w);
    const y = Math.floor(y0 + rnd() * h);
    if (!onlyOpaque || b.has(x, y)) b.set(x, y, col);
  }
  return b;
}

/** Deterministic PRNG. */
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
