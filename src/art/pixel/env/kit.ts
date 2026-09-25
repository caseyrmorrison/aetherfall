/**
 * Shared building blocks for props: definitions, material ramps and shading
 * helpers (all top-left lit).
 */
import { PAL } from '../../palette';
import type { PropId, PropInfo } from '../types';
import { Grid, mix, ramp, rnd, sphereLight, type Col } from './raster';

export interface PropDef {
  info: PropInfo;
  /** frame is already wrapped to [0, info.frames). */
  draw: (frame: number) => Grid;
}

export type PropTable = Partial<Record<PropId, PropDef>>;

export function def(
  w: number,
  h: number,
  draw: (frame: number) => Grid,
  opts: Partial<Omit<PropInfo, 'w' | 'h'>> = {},
): PropDef {
  return {
    info: {
      w,
      h,
      anchorX: opts.anchorX ?? Math.floor(w / 2),
      anchorY: opts.anchorY ?? h - 1,
      frames: opts.frames ?? 1,
      fps: opts.fps ?? 0,
      ...(opts.collider ? { collider: opts.collider } : {}),
      ...(opts.light ? { light: opts.light } : {}),
    },
    draw,
  };
}

/** Collider centred on the anchor: w wide, h tall, sitting on the anchor row. */
export function foot(w: number, h: number, dy = 0): { x: number; y: number; w: number; h: number } {
  return { x: -Math.floor(w / 2), y: -h + 1 + dy, w, h };
}

// ------------------------------------------------------------------ ramps ---

export const OUTLINE = PAL.black;

export const R = {
  leaf: [PAL.deepTeal, PAL.forest, PAL.darkGreen, PAL.green, '#9cd455'],
  leafDark: [PAL.black, PAL.deepTeal, PAL.forest, PAL.darkGreen, PAL.green],
  bark: [PAL.plum, PAL.darkBrown, '#9a5b45', PAL.brown],
  wood: [PAL.plum, PAL.darkBrown, '#9a5b45', PAL.brown, PAL.tan],
  stone: [PAL.navy, PAL.darkSlate, PAL.slate, PAL.gray, PAL.lightGray],
  warmStone: ['#4a3b3d', '#6b5a52', '#9c8676', '#bfa98f', '#e0cdb0'],
  snow: [PAL.slate, PAL.gray, PAL.lightGray, '#e8eef6', PAL.white],
  ice: ['#2c5d91', '#3f7fb8', '#5fa3d4', '#8fcbee', '#c4ecff', PAL.white],
  gold: [PAL.darkBrown, PAL.rust, PAL.gold, PAL.yellow, PAL.white],
  iron: [PAL.black, PAL.navy, PAL.darkSlate, PAL.slate, PAL.gray],
  crystal: [PAL.blue, PAL.sky, PAL.cyan, '#9ff6ff', PAL.white],
  voidc: [PAL.black, PAL.purple, PAL.magenta, PAL.pink, '#ffd6f0'],
  basalt: ['#140f1a', '#1b1420', '#2b1f2e', '#3a2a3a', '#4f3a4a'],
  fire: [PAL.darkRed, PAL.red, PAL.orange, PAL.gold, PAL.yellow, PAL.white],
} as const;

/** Sphere-shaded blob. */
export function blob(
  g: Grid,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  cols: readonly Col[],
  amb = 0.15,
  dither = 0.4,
): void {
  g.ellipse(cx, cy, rx, ry, (x, y, nx, ny) => ramp(cols, sphereLight(nx, ny, amb), x, y, dither));
}

/** Vertical cylinder shading (left lit, right dark) by normalised x. */
export function cyl(cols: readonly Col[], nx: number, x: number, y: number, bias = 0): Col {
  const l = Math.max(0, Math.min(1, 0.62 - nx * 0.55 + bias));
  return ramp(cols, l, x, y, 0.3);
}

/** A thin, soft contact shadow at the base of a prop (engine draws the big one). */
export function contact(g: Grid, cx: number, y: number, hw: number, col: Col = '#18142566'): void {
  for (let x = Math.round(cx - hw); x <= Math.round(cx + hw); x++) if (!g.opaque(x, y)) g.set(x, y, col);
}

/** Outline every shape, darkening against the inner colour for a softer "selout" look. */
export function selout(g: Grid, dark: Col = OUTLINE, soft = 0): Grid {
  return g.outline((inner) => (soft > 0 ? mix(dark, inner, soft) : dark));
}

/** Soft dark outline tinted by the neighbouring colour. */
export function ink(g: Grid, amt = 0.22, base: Col = OUTLINE): Grid {
  return g.outline((inner) => mix(base, inner, amt));
}

export function noiseAt(x: number, y: number, seed: number): number {
  return rnd(x, y, seed);
}

/** Apply a leafy clumped canopy made of overlapping blobs. Blobs listed back→front. */
export function canopy(
  g: Grid,
  blobs: readonly (readonly [number, number, number, number?])[],
  cols: readonly Col[],
  gcx: number,
  gcy: number,
  grx: number,
  gry: number,
  seed: number,
): void {
  const own = new Int16Array(g.w * g.h).fill(-1);
  blobs.forEach(([bx, by, r, ry], i) => {
    const ryy = ry ?? r;
    for (let y = Math.floor(by - ryy - 1); y <= by + ryy + 1; y++)
      for (let x = Math.floor(bx - r - 1); x <= bx + r + 1; x++) {
        if (!g.inb(x, y)) continue;
        const nx = (x + 0.5 - bx) / r;
        const ny = (y + 0.5 - by) / ryy;
        if (nx * nx + ny * ny <= 1) own[y * g.w + x] = i;
      }
  });
  for (let y = 0; y < g.h; y++)
    for (let x = 0; x < g.w; x++) {
      const i = own[y * g.w + x];
      if (i < 0) continue;
      const [bx, by, r, ry] = blobs[i];
      const ryy = ry ?? r;
      const lnx = (x + 0.5 - bx) / r;
      const lny = (y + 0.5 - by) / ryy;
      const gnx = (x + 0.5 - gcx) / grx;
      const gny = (y + 0.5 - gcy) / gry;
      let l = sphereLight(lnx, lny, 0.1) * 0.5 + sphereLight(gnx, gny, 0.05) * 0.6 - 0.05;
      // leaf texture
      const n = rnd(x, y, seed);
      if (n > 0.9) l += 0.12;
      else if (n < 0.08) l -= 0.12;
      g.set(x, y, ramp(cols, l, x, y, 0.5));
    }
}
