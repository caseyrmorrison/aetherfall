/**
 * Wall tiles. `face` tiles are the front of a cliff / wall seen in 3/4 view and
 * tile horizontally; `cap` tiles are the top surface of a wall mass and tile in
 * both directions. The top rows of a face continue the cap material (an
 * overhanging lip) so a cap sitting above a face reads as one solid block.
 */
import { PAL } from '../../palette';
import type { Theme } from '../types';
import { stones } from './ground';
import { Grid, bayer, mix, rnd, rng, tileNoise, type Col } from './raster';

const T = 16;

// ------------------------------------------------------------------ helpers --

interface BrickPal {
  mortar: Col;
  shadow: Col;
  base: Col;
  hi: Col;
  alt?: Col;
}

/** Running-bond blocks between rows y0..y1 (inclusive). Horizontally periodic in 16. */
function bricks(
  g: Grid,
  y0: number,
  y1: number,
  bw: number,
  bh: number,
  p: BrickPal,
  seed: number,
  variant: number,
): void {
  for (let y = y0; y <= y1; y++) {
    const row = Math.floor((y - y0) / bh);
    const ly = (y - y0) % bh;
    const off = row % 2 ? bw / 2 : 0;
    for (let x = 0; x < T; x++) {
      const lx = (((x + off) % bw) + bw) % bw;
      const brick = Math.floor((x + off) / bw) % (T / bw);
      let c: Col = p.base;
      // interior bricks (not crossing the tile edge) may vary per variant
      const crosses = off > 0 && brick === 0;
      if (p.alt && rnd(brick, row, seed + (crosses ? 0 : variant)) > 0.6) c = p.alt;
      if (ly === bh - 1 || lx === bw - 1) c = p.mortar;
      else if (ly === 0) c = p.hi;
      else if (lx === 0 && ly < bh - 2) c = mix(c, p.hi, 0.5);
      else if (ly === bh - 2) c = p.shadow;
      g.set(x, y, c);
    }
  }
}

/** Voronoi rock chunks wrapping horizontally only (for cliff faces). */
function chunks(g: Grid, y0: number, y1: number, p: BrickPal, seed: number, cols = 4, rows = 3): void {
  const r = rng(seed);
  const pts: [number, number][] = [];
  const cw = T / cols;
  const rh = (y1 - y0 + 1) / rows;
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < rows; j++)
      pts.push([i * cw + cw / 2 + (r() - 0.5) * cw * 0.6, y0 + j * rh + rh / 2 + (r() - 0.5) * rh * 0.6]);
  const cell = (x: number, y: number) => {
    let d1 = Infinity;
    let d2 = Infinity;
    let id = 0;
    for (let k = 0; k < pts.length; k++) {
      let dx = Math.abs(x + 0.5 - pts[k][0]);
      dx = Math.min(dx, T - dx);
      const dy = (y + 0.5 - pts[k][1]) * 1.15;
      const d = Math.hypot(dx, dy);
      if (d < d1) {
        d2 = d1;
        d1 = d;
        id = k;
      } else if (d < d2) d2 = d;
    }
    return { gap: d2 - d1 < 0.9, id };
  };
  for (let y = y0; y <= y1; y++)
    for (let x = 0; x < T; x++) {
      const cc = cell(x, y);
      if (cc.gap) {
        g.set(x, y, p.mortar);
        continue;
      }
      let col = p.alt && cc.id % 3 === 1 ? p.alt : p.base;
      if (cell((x + T - 1) % T, y).gap || cell(x, y - 1).gap) col = p.hi;
      else if (cell((x + 1) % T, y).gap || cell(x, y + 1).gap) col = p.shadow;
      g.set(x, y, col);
    }
}

/** Ragged lip depth per column (periodic, identical for all variants → seamless). */
function lipDepth(x: number, base: number, seed: number): number {
  const v = rnd(((x % T) + T) % T, 0, seed);
  return base + (v > 0.7 ? 1 : 0) + (v < 0.15 ? -1 : 0);
}

/** Leafy clump texture (hedge / canopy), tileable. cols: [deep, dark, mid, light, hi] */
function foliage(g: Grid, cols: readonly Col[], seed: number, variant: number, h = T): void {
  for (let y = 0; y < h; y++)
    for (let x = 0; x < T; x++) {
      const n = tileNoise(x, y, 4, 4, seed);
      g.set(x, y, n > 0.55 ? cols[2] : cols[1]);
    }
  const r = rng(seed + 1);
  const clump = [
    [1, 0, 3],
    [2, 0, 3],
    [0, 1, 3],
    [1, 1, 4],
    [2, 1, 3],
    [3, 1, 2],
    [0, 2, 2],
    [1, 2, 2],
    [2, 2, 2],
    [3, 2, 1],
    [1, 3, 0],
    [2, 3, 0],
  ] as const;
  for (let i = 0; i < 11; i++) {
    const cx = Math.floor(r() * T);
    const cy = Math.floor(r() * h);
    for (const [dx, dy, s] of clump) {
      const yy = cy + dy;
      if (yy >= h) continue;
      g.setw(cx + dx, yy, cols[s]);
    }
  }
  if (variant === 3) g.set(7, 7, PAL.pink).set(8, 8, PAL.white);
}

/** Copy a lip of cap material onto the top of a face with a ragged bottom edge. */
function lip(g: Grid, src: Grid, base: number, seed: number, edge: Col, shadow?: Col): void {
  for (let x = 0; x < T; x++) {
    const d = lipDepth(x, base, seed);
    for (let y = 0; y < d; y++) g.set(x, y, src.get(x, y));
    g.set(x, d, edge);
    if (shadow) g.set(x, d + 1, shadow);
  }
}

function baseShade(g: Grid, dark: Col, mid?: Col): void {
  for (let x = 0; x < T; x++) {
    g.set(x, 15, dark);
    if (bayer(x, 14) > 0.5) g.set(x, 14, mid ?? dark);
  }
}

// ------------------------------------------------------------------ themes --

type WallFn = (face: boolean, v: number) => Grid;

const HEDGE = [PAL.deepTeal, PAL.forest, '#2f7045', PAL.darkGreen, '#5cb04a'] as const;
const CANOPY = [PAL.deepTeal, '#1d4a3c', PAL.forest, '#2f7045', PAL.darkGreen] as const;

const town: WallFn = (face, v) => {
  const g = new Grid(T, T);
  if (!face) {
    foliage(g, HEDGE, 21 + v, v);
    return g;
  }
  bricks(
    g,
    4,
    15,
    8,
    4,
    { mortar: '#3a4466', shadow: '#6f7f9c', base: '#8b9bb4', hi: '#a9b6cb', alt: '#8190aa' },
    31,
    v,
  );
  baseShade(g, PAL.darkSlate, '#5a6988');
  const top = new Grid(T, 8);
  foliage(top, HEDGE, 21, 0, 8);
  lip(g, top, 4, 5, HEDGE[0], PAL.slate);
  if (v === 1) g.set(10, 10, PAL.darkSlate).set(11, 11, PAL.darkSlate);
  if (v === 2)
    g.set(4, 7, PAL.darkGreen).set(4, 8, PAL.forest).set(5, 9, PAL.darkGreen).set(4, 10, PAL.forest);
  return g;
};

const forest: WallFn = (face, v) => {
  const g = new Grid(T, T);
  if (!face) {
    foliage(g, CANOPY, 41 + v, v === 3 ? 0 : v);
    return g;
  }
  // earthen cliff: soft vertical ridges, lit on their left edge, darker toward the foot
  const ER = ['#3e2429', '#553032', '#6a3a35', PAL.darkBrown, '#8a4e3e', '#9a5b45'] as const;
  const ridges = [4, 3, 5, 4];
  let x0 = 0;
  ridges.forEach((w, k) => {
    for (let x = x0; x < x0 + w; x++)
      for (let y = 0; y < T; y++) {
        const lx = x - x0;
        let s = 3 + (k % 2) - (y > 10 ? 1 : 0) - (y > 13 ? 1 : 0);
        if (lx === 0) s += 1;
        if (lx === w - 1) s -= 2;
        if ((y + k * 2) % 5 === 0 && lx < w - 1 && bayer(x, y) > 0.3) s -= 1; // strata
        if (y > 8 && y < 11 && bayer(x, y) > 0.75) s -= 1;
        g.set(x, y, ER[Math.max(0, Math.min(5, s))]);
      }
    x0 += w;
  });
  // stones embedded in the earth
  const r = rng(47 + v);
  for (let i = 0; i < (v === 0 ? 1 : 2); i++) {
    const sx = 2 + Math.floor(r() * 11);
    const sy = 8 + Math.floor(r() * 4);
    g.set(sx, sy, '#a89a8c')
      .set(sx + 1, sy, '#7f6f66')
      .set(sx, sy + 1, '#7f6f66')
      .set(sx + 1, sy + 1, '#4f4040');
  }
  baseShade(g, PAL.plum, '#4a2a2c');
  const top = new Grid(T, 8);
  foliage(top, CANOPY, 41, 0, 8);
  lip(g, top, 4, 9, PAL.deepTeal, '#4a2a2c');
  // hanging roots
  for (let x = 1; x < T - 1; x++) {
    const k = rnd(x, 3, 50 + (x > 2 && x < 13 ? v : 0));
    if (k > 0.8) {
      const d = lipDepth(x, 4, 9) + 1;
      const len = 2 + Math.floor((k - 0.8) * 20);
      for (let y = d; y < d + len; y++)
        g.set(x + (y - d > 2 ? 1 : 0), y, y === d + len - 1 ? '#8f5a44' : PAL.plum);
    }
  }
  return g;
};

const ROCK: BrickPal = {
  mortar: '#1c1f33',
  shadow: '#333b5c',
  base: '#454f73',
  hi: '#5f6b8f',
  alt: '#3e4769',
};
const CAVE_TOP_PTS: [number, number][] = [
  [2, 3],
  [8, 1],
  [13, 5],
  [5, 9],
  [11, 11],
  [1, 13],
  [7, 14],
];

const cave: WallFn = (face, v) => {
  if (!face) {
    const g = stones(CAVE_TOP_PTS, {
      gap: '#131426',
      shadow: '#1b1d30',
      base: '#212439',
      hi: '#2c3049',
      gapW: 1.0,
    });
    if (v === 2) g.set(9, 6, PAL.slate);
    if (v === 3) g.set(4, 11, '#1b1d30').set(5, 11, '#1b1d30');
    return g;
  }
  const g = new Grid(T, T);
  chunks(g, 0, 15, ROCK, 67 + (v % 2), 4, 3);
  for (let x = 0; x < T; x++) {
    g.set(x, 0, '#2c3049');
    g.set(x, 1, rnd(x, 1, 7) > 0.5 ? ROCK.hi : '#525d82');
  }
  baseShade(g, '#1c1f33', ROCK.shadow);
  if (v === 3) g.set(6, 8, PAL.cyan).set(7, 7, '#9ff6ff').set(7, 8, PAL.sky);
  return g;
};

const BASALT = ['#1b1420', '#2b1f2e', '#3a2a3a', '#4f3a4a'] as const;
const BASALT_PTS: [number, number][] = [
  [1, 1],
  [7, 2],
  [12, 0],
  [4, 7],
  [10, 8],
  [15, 6],
  [1, 12],
  [7, 13],
  [13, 13],
];

const volcano: WallFn = (face, v) => {
  if (!face) {
    const g = stones(BASALT_PTS, {
      gap: '#140f1a',
      shadow: BASALT[1],
      base: '#33253a',
      hi: BASALT[3],
      gapW: 1.1,
      sy: 1.1,
    });
    if (v === 1 || v === 3) {
      // a glowing seam in an interior joint
      g.map((c, x, y) =>
        c === '#140f1a' && x > 3 && x < 12 && y > 3 && y < 12 && (x + y + v) % 3 === 0 ? PAL.rust : undefined,
      );
    }
    return g;
  }
  const g = new Grid(T, T);
  const widths = [4, 3, 5, 4];
  let x0 = 0;
  for (let k = 0; k < widths.length; k++) {
    const w = widths[k];
    for (let x = x0; x < x0 + w; x++)
      for (let y = 0; y < T; y++) {
        const lx = x - x0;
        let col: Col = BASALT[2];
        if (lx === 0) col = BASALT[3];
        else if (lx === w - 1) col = BASALT[0];
        else if (lx === w - 2 && w > 3) col = BASALT[1];
        if ((y + k * 3) % 6 === 0 && lx !== w - 1) col = BASALT[1];
        g.set(x, y, col);
      }
    x0 += w;
  }
  // glowing joint between two columns (interior joints only; varies per variant)
  const joints = [3, 6, 11];
  const jx = joints[v % 3];
  if (v !== 0) {
    const from = 3 + (v % 2) * 3;
    for (let y = from; y < from + 7; y++)
      g.set(jx, y, y === from + 3 ? PAL.yellow : y % 2 ? PAL.orange : PAL.gold);
    g.set(jx - 1, from + 3, mix(BASALT[2], PAL.orange, 0.4)).set(
      jx + 1,
      from + 3,
      mix(BASALT[2], PAL.orange, 0.4),
    );
  }
  // rim: column tops
  for (let x = 0; x < T; x++) {
    g.set(x, 0, BASALT[3]);
    g.set(x, 1, g.get(x, 2) === BASALT[0] ? BASALT[0] : '#5d4656');
  }
  baseShade(g, PAL.black, BASALT[0]);
  // faint lava under-glow at the base
  for (let x = 0; x < T; x++) if (bayer(x, 13) > 0.8) g.set(x, 13, '#5a1a22');
  return g;
};

const ICE = ['#3f7fb8', '#5fa3d4', '#8fcbee', '#c4ecff', PAL.white] as const;
const SNOW_PTS: [number, number][] = [
  [4, 3],
  [12, 6],
  [5, 12],
  [14, 14],
];

const tundra: WallFn = (face, v) => {
  if (!face) {
    const g = stones(SNOW_PTS, {
      gap: '#cdd7e6',
      shadow: '#dbe3ee',
      base: '#e8edf5',
      hi: '#f7faff',
      gapW: 0.7,
      sy: 1.3,
    });
    if (v === 2) g.set(8, 7, PAL.gray).set(9, 7, PAL.slate);
    if (v === 3) g.set(12, 5, PAL.white).set(12, 4, '#dff4ff');
    return g;
  }
  const g = new Grid(T, T);
  const facets = [3, 4, 3, 2, 4];
  let x0 = 0;
  let k = 0;
  while (x0 < T) {
    const w = facets[k % facets.length];
    for (let x = x0; x < Math.min(T, x0 + w); x++)
      for (let y = 0; y < T; y++) {
        const lx = x - x0;
        const shade = (k % 3) + (lx === 0 ? 1 : 0) - (lx === w - 1 ? 1 : 0);
        let col: Col = ICE[Math.max(0, Math.min(3, shade + (y < 8 ? 1 : 0)))];
        if (y > 11 && bayer(x, y) > 0.5) col = ICE[Math.max(0, shade - 1)];
        g.set(x, y, col);
      }
    x0 += w;
    k++;
  }
  const r = rng(83 + v);
  for (let i = 0; i < 2; i++) {
    const gx = 2 + Math.floor(r() * 12);
    const gy = 6 + Math.floor(r() * 5);
    g.set(gx, gy, PAL.white).set(gx, gy + 1, ICE[3]);
  }
  baseShade(g, '#2c5d91', ICE[0]);
  // snow overhang with icicles
  const snow = ['#c4cfdf', '#dfe6f0', PAL.white] as const;
  for (let x = 0; x < T; x++) {
    const d = lipDepth(x, 4, 13);
    for (let y = 0; y < d; y++) g.set(x, y, y === d - 1 ? snow[1] : bayer(x, y) > 0.8 ? snow[1] : snow[2]);
    g.set(x, d, snow[0]);
    const icicle = rnd(x, 9, 13 + (x > 2 && x < 13 ? v : 0));
    if (icicle > 0.7) {
      const len = 2 + Math.floor((icicle - 0.7) * 12);
      for (let y = d + 1; y < d + 1 + len; y++) g.set(x, y, y === d + len ? ICE[2] : ICE[3]);
    }
  }
  return g;
};

const CIT_BLOCK: BrickPal = {
  mortar: '#1c1f33',
  shadow: '#3a4264',
  base: '#4a5378',
  hi: '#646f98',
  alt: '#454e72',
};

const citadel: WallFn = (face, v) => {
  const g = new Grid(T, T);
  if (!face) {
    for (let y = 0; y < T; y++)
      for (let x = 0; x < T; x++) {
        let col: Col = '#22263d';
        if (x % 8 === 7 || y % 8 === 7) col = '#15172a';
        else if (x % 8 === 0 || y % 8 === 0) col = '#2a2f4a';
        g.set(x, y, col);
      }
    if (v === 1) g.set(4, 3, '#15172a').set(5, 4, '#15172a');
    return g;
  }
  bricks(g, 4, 13, 8, 5, CIT_BLOCK, 91, v);
  // cornice: bright moulding, gold-studded purple band, deep shadow
  for (let x = 0; x < T; x++) {
    g.set(x, 0, '#7d88ab');
    g.set(x, 1, '#5a6388');
    g.set(x, 2, x % 8 === 3 ? PAL.gold : PAL.purple);
    g.set(x, 3, '#15172a');
  }
  for (let x = 0; x < T; x++) {
    g.set(x, 14, '#2c3150');
    g.set(x, 15, '#15172a');
  }
  if (v === 2) {
    // carved sigil in the lower block
    g.set(7, 10, PAL.purple).set(8, 10, PAL.purple).set(7, 11, PAL.magenta).set(8, 11, PAL.purple);
  }
  if (v === 3) g.set(12, 6, '#1c1f33').set(12, 7, '#1c1f33').set(13, 8, '#2c3150');
  return g;
};

const VOID_BLOCK: BrickPal = {
  mortar: PAL.purple,
  shadow: '#2a2446',
  base: '#3a3360',
  hi: '#4d4578',
  alt: '#342e58',
};

const abyss: WallFn = (face, v) => {
  const g = new Grid(T, T);
  if (!face) {
    const c = stones(CAVE_TOP_PTS, {
      gap: '#3a2352',
      shadow: '#130f1e',
      base: '#1a1429',
      hi: '#251c38',
      gapW: 0.9,
    });
    c.map((col, x, y) => (col === '#3a2352' && (x * 5 + y * 3) % 11 === 0 ? PAL.purple : undefined));
    if (v === 1) c.set(8, 8, PAL.magenta);
    return c;
  }
  bricks(g, 3, 14, 8, 4, VOID_BLOCK, 107, v);
  g.map((c, x, y) => (c === PAL.purple && (x * 3 + y) % 7 === 0 ? PAL.magenta : undefined));
  for (let x = 0; x < T; x++) {
    g.set(x, 0, '#4d4578');
    g.set(x, 1, '#2a2446');
    g.set(x, 2, '#120e1c');
    g.set(x, 15, '#120e1c');
  }
  if (v === 2 || v === 3) {
    const rx = v === 2 ? 3 : 10;
    g.set(rx, 8, PAL.cyan)
      .set(rx + 1, 8, PAL.cyan)
      .set(rx, 9, '#1fa3c9');
  }
  return g;
};

const WALLS: Record<Theme, WallFn> = { town, forest, cave, volcano, tundra, citadel, abyss };

export function buildWall(theme: Theme, face: boolean, variant: number): Grid {
  return WALLS[theme](face, ((variant % 4) + 4) % 4);
}
