/** Shared helpers for character specs (beards, crystals, stars). */
import { C } from '../pal';
import { cel, lock, type DrawCtx } from '../face';
import { spline, type P } from '../geom';
import type { Raster } from '../raster';

/**
 * Beard: region between `outer` (jaw/chin contour) and an inner edge that
 * dips under the nose around the mouth. Adds wavy strand tips at the bottom.
 */
export function beard(
  dc: DrawCtx,
  r: Raster,
  outer: readonly P[],
  base: number,
  shade: number,
  hi: number,
  opts: { top?: number; tips?: readonly [P[], number][]; hollow?: number; cheek?: number } = {},
): void {
  const g = dc.g;
  const mx = g.mouthX;
  const my = g.mouthY;
  const hollow = opts.hollow ?? 3.2;
  const top = opts.top ?? 47;
  const ch = opts.cheek ?? 0;
  const inner: P[] = [
    [74.5, top],
    [72.5, 56 + ch * 0.6],
    [66, 61 + ch],
    [mx + 5.5, my - 1.8],
    [mx + 0.5, my - hollow],
    [mx - 6, my - 1.6],
    [37, 61.5 + ch],
    [28.5, 56 + ch * 0.6],
    [26.5, top],
  ];
  const pts = [...outer, ...inner];
  for (const [p, w] of opts.tips ?? []) lock(dc, r, p, w, base, shade, { pow: 1.2, wind: 0.5 });
  cel(r, dc.L.scratch, spline(pts, true, 3), base, shade, -1.8, -2.2);
  // texture strokes
  r.with({ self: true }, () => {
    for (let i = 0; i < 7; i++) {
      const x = 32 + i * 6;
      const y0 = 66 + ch + Math.abs(i - 3) * -1.5;
      r.stroke(
        spline(
          [
            [x, y0],
            [x + 0.8, y0 + 7],
            [x - 0.5, y0 + 13],
          ],
          false,
          3,
        ),
        0.7,
        0.4,
        i % 2 ? shade : hi,
        1,
      );
    }
  });
}

/** Mustache: two chunky locks from under the nose. */
export function mustache(dc: DrawCtx, r: Raster, base: number, shade: number, droop = 1, size = 1): void {
  const mx = dc.g.mouthX;
  const my = dc.g.noseY + 3.4;
  lock(
    dc,
    r,
    [
      [mx + 0.4, my - 0.4],
      [mx - 3.6 * size, my + 0.4],
      [mx - 7 * size, my + 2.4 * droop],
    ],
    4.4 * size,
    base,
    shade,
    { pow: 1.2, wind: 0.2 },
  );
  lock(
    dc,
    r,
    [
      [mx - 0.2, my - 0.4],
      [mx + 3.2 * size, my + 0.2],
      [mx + 6 * size, my + 2 * droop],
    ],
    3.8 * size,
    base,
    shade,
    { pow: 1.2, wind: 0.2 },
  );
}

/**
 * Black-sun emblem (design units): alternating long / short rays around a
 * gold ring with a dark disc. Used for Aurelian's halo and chest emblem.
 */
export function blackSun(
  r: Raster,
  cx: number,
  cy: number,
  R: number,
  o: {
    rays?: number;
    long?: number;
    short?: number;
    ring?: number;
    ringW?: number;
    disc?: number;
    ray?: number;
    rayShade?: number;
    rot?: number;
  } = {},
): void {
  const n = (o.rays ?? 12) * 2;
  const rot = o.rot ?? -Math.PI / 2;
  const hw = (Math.PI / n) * 0.75;
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2;
    const len = i % 2 === 0 ? (o.long ?? R * 0.55) : (o.short ?? R * 0.3);
    const b = R * 0.9;
    r.poly(
      [
        cx + Math.cos(a - hw) * b,
        cy + Math.sin(a - hw) * b,
        cx + Math.cos(a) * (R + len),
        cy + Math.sin(a) * (R + len),
        cx + Math.cos(a + hw) * b,
        cy + Math.sin(a + hw) * b,
      ],
      i % 2 === 0 ? (o.ray ?? C.gold) : (o.rayShade ?? C.orange),
    );
  }
  r.ellipse(cx, cy, R, R, o.ring ?? C.gold);
  r.ellipse(cx, cy, R - (o.ringW ?? R * 0.14), R - (o.ringW ?? R * 0.14), o.disc ?? C.black);
}

/** Faceted crystal shard (diamond) with light / dark halves. */
export function shard(
  r: Raster,
  scratch: Raster,
  x: number,
  y0: number,
  y1: number,
  w: number,
  light: number,
  dark: number,
  lean = 0,
): void {
  const midY = y0 + (y1 - y0) * 0.62;
  const top: P = [x + lean, y0];
  const bot: P = [x, y1];
  const left: P = [x - w, midY];
  const right: P = [x + w, midY];
  cel(r, scratch, [top[0], top[1], right[0], right[1], bot[0], bot[1], left[0], left[1]], light, dark, 0, 0);
  r.poly([top[0], top[1], right[0], right[1], bot[0], bot[1], x + lean * 0.4, midY], dark);
}
