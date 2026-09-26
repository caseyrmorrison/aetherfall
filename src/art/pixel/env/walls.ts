/**
 * Wall tiles. `face` tiles are the front of a cliff / wall seen in 3/4 view and
 * tile horizontally; `cap` tiles are the top surface of a wall mass and tile in
 * both directions. The top rows of a face continue the cap material (an
 * overhanging lip) so a cap sitting above a face reads as one solid block.
 */
import { PAL } from '../../palette';
import type { Theme } from '../types';
import { mossOver, stones } from './ground';
import { Grid, bayer, fbm16, mix, rnd, rng, tileNoise, type Col } from './raster';

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

// ------------------------------------------------------------------ act II --

/** Periodic (16px) wobble used to bend strata / bands without breaking the tiling. */
function wob(x: number, k: number, amp = 0.9): number {
  return Math.round(Math.sin(((x + k * 5) / T) * Math.PI * 2) * amp);
}

const MESA_TOP_PTS: [number, number][] = [
  [3, 3],
  [11, 2],
  [7, 10],
  [14, 11],
  [1, 12],
];
/** Rose sandstone, dark → light. */
const MESA = ['#3e2434', '#5a3446', '#784450', '#96585a', '#b06e62', '#c8866c'] as const;
/** One step lighter on the MESA ramp. */
const step1 = (c: Col): Col => {
  const i = (MESA as readonly Col[]).indexOf(c);
  return i < 0 ? c : MESA[Math.min(5, i + 1)];
};

function mesaCap(v: number): Grid {
  // the flat top of a mesa: broad rock plates dusted with blown sand
  const g = stones(MESA_TOP_PTS, {
    gap: '#86505a',
    shadow: '#985c5c',
    base: '#a4665e',
    hi: '#b27264',
    gapW: 0.8,
  });
  g.map((c, x, y) => {
    if (c === '#86505a') return undefined;
    const n = fbm16(x, y, 151);
    if (n > 0.6 || (n > 0.56 && bayer(x, y) > 0.5)) return rnd(x, y, 152) > 0.85 ? '#d4a07c' : '#bd8468';
    return rnd(x, y, 153) > 0.94 ? '#8a5054' : undefined;
  });
  if (v === 1) g.set(9, 6, '#d8b8a8').set(10, 6, '#8a6a70').set(9, 7, '#6e5460');
  if (v === 3) g.set(5, 9, '#b8905e').set(5, 8, '#e0b87a').set(6, 9, '#8a6a4e').set(4, 8, '#b8905e');
  return g;
}

const desert: WallFn = (face, v) => {
  if (!face) return mesaCap(v);
  // layered sandstone cliff: wavy strata with lit ledges, a few deep joints
  const g = new Grid(T, T);
  const tone = [4, 3, 4, 2, 3] as const;
  for (let x = 0; x < T; x++)
    for (let y = 0; y < T; y++) {
      const yy = y + wob(x, 2, 0.8);
      const band = Math.floor(yy / 3);
      const ly = ((yy % 3) + 3) % 3;
      let s: number = tone[((band % 5) + 5) % 5];
      if (ly === 0) s += 1;
      else if (ly === 2 && bayer(x, y) > 0.4) s -= 1;
      if (y > 11) s -= 1;
      g.set(x, y, MESA[Math.max(0, Math.min(5, s))]);
    }
  for (const [jx, y0, y1] of [
    [3, 5, 9],
    [9, 8, 13],
    [13, 4, 8],
  ] as const)
    for (let y = y0; y <= y1; y++) {
      g.set(jx, y, MESA[0]);
      g.set(jx + 1, y, step1(g.get(jx + 1, y)!));
    }
  if (v === 1) g.set(6, 10, MESA[0]).set(7, 10, MESA[0]).set(6, 11, MESA[1]).set(7, 11, MESA[1]);
  if (v === 2) g.set(11, 6, '#e4c4a0').set(12, 6, '#c8a890').set(11, 7, '#a8887c');
  if (v === 3) g.line(6, 5, 7, 9, MESA[1]);
  baseShade(g, MESA[0], MESA[1]);
  lip(g, mesaCap(0), 4, 157, MESA[1], MESA[0]);
  return g;
};

const oasisCap = (v: number): Grid => {
  const g = new Grid(T, T);
  for (let y = 0; y < T; y++)
    for (let x = 0; x < T; x++) {
      const lx = x & 7;
      const ly = y & 7;
      let c: Col = rnd(x, y, 161) > 0.9 ? '#a87260' : '#b27a62';
      if (lx === 7 || ly === 7) c = '#7a4e46';
      else if (lx === 0 || ly === 0) c = '#c68e6e';
      else if (lx === 6 || ly === 6) c = '#9a6656';
      g.set(x, y, c);
    }
  if (v === 1) g.set(3, 3, '#7a4e46').set(4, 4, '#7a4e46').set(4, 5, '#9a6656');
  if (v === 2) g.set(11, 3, '#2f9a9a').set(12, 3, '#5fd0c8').set(11, 4, '#1f6f78').set(12, 4, '#2f9a9a');
  return g;
};

const oasis: WallFn = (face, v) => {
  if (!face) return oasisCap(v);
  // whitewashed adobe over a sandstone plinth, terracotta frieze under the coping
  const g = new Grid(T, T);
  for (let y = 4; y < 12; y++)
    for (let x = 0; x < T; x++) {
      let c: Col = rnd(x, y, 163) > 0.88 ? '#dcbc9c' : '#ecd4b2';
      if (y === 6) c = '#c29a80';
      else if (y === 7 && bayer(x, y) > 0.5) c = '#dcbc9c';
      g.set(x, y, c);
    }
  for (let x = 0; x < T; x++) {
    g.set(x, 4, '#c8644c');
    g.set(x, 5, x % 4 === 0 ? '#7a3a3a' : '#a84c44');
  }
  bricks(
    g,
    12,
    15,
    8,
    4,
    { mortar: '#8e5a4c', shadow: '#b0805e', base: '#c4966e', hi: '#dcb088', alt: '#bb8d68' },
    171,
    v,
  );
  baseShade(g, '#7a4a42', '#946050');
  lip(g, oasisCap(0), 3, 167, '#7a4e46', '#c29a80');
  if (v === 1) g.line(10, 7, 12, 10, '#c29a80');
  if (v === 2) g.set(7, 8, '#2f9a9a').set(8, 8, '#5fd0c8').set(7, 9, '#1f6f78').set(8, 9, '#2f9a9a');
  if (v === 3) {
    // small arched niche
    g.rect(6, 8, 4, 4, '#5a3040').set(6, 8, '#ecd4b2').set(9, 8, '#ecd4b2');
    g.hline(7, 8, 8, '#3e2731').hline(6, 9, 11, '#a86e56');
  }
  return g;
};

const RUIN_BLOCK: BrickPal = {
  mortar: '#132628',
  shadow: '#2b4745',
  base: '#3a5c56',
  hi: '#507769',
  alt: '#34544f',
};
const RUIN_MOSS = ['#18342e', '#1d3c36', '#264e40', '#2f6246', '#437a50'] as const;

function ruinCap(v: number): Grid {
  // big dressed blocks on top of the temple walls, half swallowed by moss
  const g = new Grid(T, T);
  for (let y = 0; y < T; y++)
    for (let x = 0; x < T; x++) {
      let c: Col = rnd(x >> 3, y >> 3, 191) > 0.5 ? '#2c4644' : '#2a4240';
      if (x % 8 === 7 || y % 8 === 7) c = '#111f21';
      else if (x % 8 === 0 || y % 8 === 0) c = '#385854';
      else if (x % 8 === 6 || y % 8 === 6) c = '#223836';
      g.set(x, y, c);
    }
  mossOver(g, 193 + v * 3, 0.45);
  // sink the whole top into shadow so wall masses read darker than the floor
  g.map((c) => mix(c, '#0b1416', 0.3));
  if (v === 2) g.set(10, 4, '#5a8a86').set(11, 4, '#2c4644');
  if (v === 3) g.set(4, 11, PAL.pink).set(5, 12, '#c85a6a');
  return g;
}

const ruins: WallFn = (face, v) => {
  if (!face) return ruinCap(v);
  // mossy temple masonry, stained dark along the old waterline
  const g = new Grid(T, T);
  bricks(g, 4, 15, 8, 4, RUIN_BLOCK, 181, v);
  g.map((c, x, y) => {
    if (y < 10 || y > 13) return undefined;
    if (y === 10) return bayer(x, y) > 0.5 ? mix(c, '#1d3f38', 0.3) : undefined;
    return mix(c, '#1d3f38', y === 13 ? 0.55 : 0.4);
  });
  for (let x = 0; x < T; x++) if (rnd(x, 11, 187) > 0.72) g.set(x, 11, RUIN_MOSS[2]);
  baseShade(g, '#0e1c1e', '#1a3030');
  lip(g, ruinCap(0), 4, 197, RUIN_MOSS[0], '#1d3432');
  // moss hanging over the lip
  for (let x = 1; x < T - 1; x++) {
    const k = rnd(x, 3, 199 + (x > 2 && x < 13 ? v : 0));
    if (k > 0.78) {
      const d = lipDepth(x, 4, 197) + 1;
      const len = 1 + Math.floor((k - 0.78) * 18);
      for (let y = d; y < d + len; y++) g.set(x, y, y === d + len - 1 ? RUIN_MOSS[3] : RUIN_MOSS[2]);
    }
  }
  if (v === 1) g.set(10, 8, '#3fd6c0').set(11, 8, '#26413e').set(10, 9, '#26413e').set(11, 9, '#3fd6c0');
  if (v === 2) g.rect(9, 12, 5, 2, '#0e1c1e').hline(9, 13, 14, '#1a3030');
  return g;
};

const SLATE = ['#141729', '#1f2440', '#2b3151', '#383f63', '#4a5479', '#65709a'] as const;
const STORM_GRASS = ['#27404a', '#3c6068', '#5a8a86', '#8fbcae'] as const;

function stormCap(v: number): Grid {
  // plateau top: dark, rain-darkened slate, a few joints and wind-combed grass
  const g = new Grid(T, T);
  g.each((x, y) => {
    const n = fbm16(x, y, 213);
    return n > 0.58 || (n > 0.54 && bayer(x, y) > 0.5) ? '#2f3656' : '#2a3050';
  });
  const r = rng(214);
  for (let i = 0; i < 3; i++) {
    let x = Math.floor(r() * T);
    let y = Math.floor(r() * T);
    for (let k = 0; k < 4; k++) {
      g.setw(x, y, '#171a2e').setw(x, y + 1, '#3a4264');
      if (r() < 0.6) x++;
      else y++;
    }
  }
  const rg = rng(215 + v * 7);
  for (let i = 0; i < 5; i++) {
    const x = 1 + Math.floor(rg() * 12);
    const y = 3 + Math.floor(rg() * 12);
    for (let k = 0; k < 3; k++) g.set(x + (k > 0 ? k - 1 : 0), y - k, STORM_GRASS[k + 1]);
    g.set(x, y + 1, STORM_GRASS[0]);
  }
  if (v === 2) g.set(7, 8, SLATE[5]).set(8, 8, '#8b9bb4');
  return g;
}

const storm: WallFn = (face, v) => {
  if (!face) return stormCap(v);
  // dark slate cleaved into slanted slabs, streaked by rain
  const g = new Grid(T, T);
  const segs = [
    [0, 5],
    [5, 4],
    [9, 4],
    [13, 3],
  ] as const;
  for (let y = 0; y < T; y++)
    for (let x = 0; x < T; x++) {
      const xs = (((x - Math.floor(y / 3)) % T) + T) % T;
      const k = segs.findIndex(([s, w]) => xs >= s && xs < s + w);
      const [s, w] = segs[k];
      const lx = xs - s;
      let c: Col = SLATE[k % 2 ? 2 : 3];
      if (lx === 0) c = SLATE[4];
      else if (lx === 1 && k % 2 === 0) c = SLATE[4];
      else if (lx === w - 1) c = SLATE[1];
      if (y === 9 + (k % 2) * 2 && lx > 0 && lx < w - 1) c = SLATE[1];
      if (y > 11 && bayer(x, y) > 0.55) c = SLATE[Math.max(0, SLATE.indexOf(c as never) - 1)];
      g.set(x, y, c);
    }
  // rain streaks (inside the tile, vary per variant)
  const r = rng(217 + v);
  for (let i = 0; i < 2; i++) {
    const sx = 1 + Math.floor(r() * 14);
    const sy = 5 + Math.floor(r() * 3);
    for (let y = sy; y < sy + 6; y++) if (y % 3 !== 2) g.set(sx, y, '#6a76a0');
  }
  if (v === 3) g.line(6, 6, 8, 9, SLATE[0]).line(8, 9, 7, 11, SLATE[0]).set(7, 7, '#6a76a0');
  baseShade(g, '#0d0f1c', SLATE[0]);
  lip(g, stormCap(0), 4, 211, SLATE[0], SLATE[1]);
  // grass tips blown over the edge
  for (let x = 0; x < T; x++) {
    if (rnd(x, 5, 219) < 0.75) continue;
    const d = lipDepth(x, 4, 211);
    g.set(x, d, STORM_GRASS[2]).set(x + 1, d + 1, STORM_GRASS[3]);
  }
  return g;
};

const ONYX_BLOCK: BrickPal = {
  mortar: '#0e0b16',
  shadow: '#1a1527',
  base: '#241e33',
  hi: '#352c48',
  alt: '#211b2f',
};
const GOLD_INLAY = '#c48a2c';

const eclipse: WallFn = (face, v) => {
  const g = new Grid(T, T);
  if (!face) {
    for (let y = 0; y < T; y++)
      for (let x = 0; x < T; x++) {
        let c: Col = '#18131f';
        if (x % 8 === 7 || y % 8 === 7) c = '#0b0912';
        else if (x % 8 === 0 || y % 8 === 0) c = '#221b2e';
        g.set(x, y, c);
      }
    g.set(7, 7, GOLD_INLAY).set(15, 15, GOLD_INLAY).set(7, 15, '#6a4424').set(15, 7, '#6a4424');
    if (v === 1) g.set(3, 4, '#6a76c0');
    if (v === 3) g.set(11, 2, PAL.lightGray);
    return g;
  }
  // black marble ashlar under a gold cornice
  bricks(g, 4, 13, 8, 5, ONYX_BLOCK, 223, v);
  const r = rng(227 + v);
  for (let k = 0; k < 2; k++) {
    let x = 1 + Math.floor(r() * 12);
    let y = 5 + Math.floor(r() * 3);
    for (let i = 0; i < 4; i++) {
      if (g.get(x, y) !== ONYX_BLOCK.mortar) g.set(x, y, '#3a3150');
      x++;
      if (r() < 0.5) y++;
    }
  }
  for (let x = 0; x < T; x++) {
    g.set(x, 0, '#5a4d78');
    g.set(x, 1, '#3a3150');
    g.set(x, 2, x % 8 === 3 ? PAL.yellow : x % 8 === 2 || x % 8 === 4 ? PAL.gold : GOLD_INLAY);
    g.set(x, 3, '#0e0b16');
    g.set(x, 14, x % 4 === 1 ? '#8a5a2a' : '#5a3a26');
    g.set(x, 15, '#0b0912');
  }
  if (v === 2)
    g.set(8, 7, PAL.gold).set(7, 8, PAL.gold).set(9, 8, PAL.gold).set(8, 9, PAL.gold).set(8, 8, PAL.yellow);
  if (v === 3) {
    g.set(3, 10, GOLD_INLAY).set(4, 10, PAL.gold).set(2, 11, GOLD_INLAY).set(5, 11, GOLD_INLAY);
    g.set(3, 12, GOLD_INLAY).set(4, 12, GOLD_INLAY).set(3, 11, PAL.black).set(4, 11, PAL.black);
  }
  return g;
};

const WALLS: Record<Theme, WallFn> = {
  town,
  forest,
  cave,
  volcano,
  tundra,
  citadel,
  abyss,
  desert,
  ruins,
  storm,
  eclipse,
  oasis,
};

export function buildWall(theme: Theme, face: boolean, variant: number): Grid {
  return WALLS[theme](face, ((variant % 4) + 4) % 4);
}
