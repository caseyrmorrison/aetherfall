/**
 * Ground tiles (16x16). Every texture is built on a torus so any variant tiles
 * seamlessly next to any other: loose marks wrap around the tile, and
 * structured textures (cobbles, flagstones, planks, basalt) share one fixed
 * layout at the tile edges and only vary interior details between variants.
 */
import { PAL } from '../../palette';
import type { GroundKind, Theme } from '../types';
import { Grid, bayer, mix, rng, tileNoise, type Col } from './raster';

const T = 16;

// --------------------------------------------------------------- helpers ----

function flat(c: Col): Grid {
  return new Grid(T, T).rect(0, 0, T, T, c);
}

type Stamp = readonly (readonly [number, number, number])[];

/** Scatter `n` stamps at random wrapped positions. slot → colour via `cols`. */
function scatter(g: Grid, seed: number, n: number, stamps: readonly Stamp[], cols: readonly Col[]): void {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const x = Math.floor(r() * T);
    const y = Math.floor(r() * T);
    const s = stamps[Math.floor(r() * stamps.length)];
    for (const [dx, dy, slot] of s) g.setw(x + dx, y + dy, cols[slot]);
  }
}

/** Random positions kept at least `m` px inside the tile (edge-safe details). */
function inside(
  seed: number,
  n: number,
  m: number,
  fn: (x: number, y: number, r: () => number) => void,
): void {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const x = m + Math.floor(r() * (T - 2 * m));
    const y = m + Math.floor(r() * (T - 2 * m));
    fn(x, y, r);
  }
}

/** Multi-octave tileable noise (period 16). */
function fbm(x: number, y: number, seed: number): number {
  return (
    tileNoise(x, y, 8, 2, seed) * 0.5 +
    tileNoise(x, y, 4, 4, seed + 1) * 0.32 +
    tileNoise(x, y, 2, 8, seed + 2) * 0.18
  );
}

/** Very soft mottling between two close colours (ordered dither at the boundary). */
function mottle(g: Grid, seed: number, b: Col, amount: number): void {
  g.map((c, x, y) => {
    const n = fbm(x, y, seed);
    const th = 1 - amount;
    if (n > th + 0.04) return b;
    if (n > th - 0.02 && bayer(x, y) > 0.5) return b;
    return c;
  });
}

// Voronoi on a 16-torus ------------------------------------------------------

interface Cell {
  i: number;
  d1: number;
  d2: number;
}

function voronoi(pts: readonly (readonly [number, number])[], x: number, y: number, sy = 1): Cell {
  let d1 = Infinity;
  let d2 = Infinity;
  let i = 0;
  for (let k = 0; k < pts.length; k++) {
    let dx = Math.abs(x + 0.5 - pts[k][0]);
    let dy = Math.abs(y + 0.5 - pts[k][1]);
    dx = Math.min(dx, T - dx);
    dy = Math.min(dy, T - dy) * sy;
    const d = Math.hypot(dx, dy);
    if (d < d1) {
      d2 = d1;
      d1 = d;
      i = k;
    } else if (d < d2) d2 = d;
  }
  return { i, d1, d2 };
}

interface StoneStyle {
  gap: Col;
  shadow: Col;
  base: Col;
  hi: Col;
  gapW?: number;
  sy?: number;
}

/** Stone/cobble texture from a Voronoi layout with top-left bevel lighting. */
export function stones(
  pts: readonly (readonly [number, number])[],
  st: StoneStyle,
  tint?: (i: number) => Col | undefined,
): Grid {
  const g = new Grid(T, T);
  const cells: Cell[] = [];
  const gapW = st.gapW ?? 1.1;
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) cells.push(voronoi(pts, x, y, st.sy ?? 1));
  const cellAt = (x: number, y: number) => cells[(((y % T) + T) % T) * T + (((x % T) + T) % T)];
  const isGap = (x: number, y: number) => {
    const c = cellAt(x, y);
    return c.d2 - c.d1 < gapW;
  };
  for (let y = 0; y < T; y++)
    for (let x = 0; x < T; x++) {
      if (isGap(x, y)) {
        g.set(x, y, st.gap);
        continue;
      }
      const c = cellAt(x, y);
      let base = tint?.(c.i) ?? st.base;
      if (isGap(x - 1, y) || isGap(x, y - 1)) base = st.hi;
      else if (isGap(x + 1, y) || isGap(x, y + 1) || isGap(x + 1, y + 1)) base = st.shadow;
      g.set(x, y, base);
    }
  return g;
}

function jitterGrid(nx: number, ny: number, seed: number, jit: number): [number, number][] {
  const r = rng(seed);
  const out: [number, number][] = [];
  const sx = T / nx;
  const sy = T / ny;
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++)
      out.push([(i + 0.5) * sx + (r() - 0.5) * jit * sx, (j + 0.5) * sy + (r() - 0.5) * jit * sy]);
  return out;
}

// ------------------------------------------------------------------ stamps --

// slots: 0 dark, 1 light, 2 extra
const BLADES: Stamp[] = [
  [
    [0, 0, 1],
    [0, 1, 0],
  ],
  [
    [0, 0, 0],
    [2, 0, 0],
    [1, 1, 0],
  ],
  [
    [0, 0, 1],
    [1, 1, 0],
    [0, 1, 0],
  ],
  [[0, 0, 1]],
  [
    [1, 0, 1],
    [0, 1, 0],
    [2, 1, 0],
    [1, 1, 0],
  ],
];

const SPECKS: Stamp[] = [
  [[0, 0, 0]],
  [[0, 0, 1]],
  [
    [0, 0, 0],
    [1, 0, 0],
  ],
  [
    [0, 0, 1],
    [0, 1, 0],
  ],
];

const PEBBLE: Stamp[] = [
  [
    [0, 0, 1],
    [1, 0, 2],
    [0, 1, 2],
    [1, 1, 0],
  ],
  [
    [0, 0, 1],
    [0, 1, 0],
  ],
  [
    [0, 0, 1],
    [1, 0, 0],
  ],
];

// ------------------------------------------------------------------- grass --

interface GrassPal {
  base: Col;
  dark: Col;
  light: Col;
  deep: Col;
}

function grass(p: GrassPal, seed: number, density: number): Grid {
  const g = flat(p.base);
  mottle(g, seed + 7, mix(p.base, p.dark, 0.3), 0.3);
  scatter(g, seed, density, BLADES, [p.dark, p.light, p.dark]);
  scatter(g, seed + 99, Math.floor(density / 3), SPECKS, [p.deep, p.light]);
  return g;
}

/** Taller, denser grass: vertical strokes with lit tips. */
function tallGrass(p: GrassPal, seed: number, n = 24): Grid {
  const g = flat(mix(p.base, p.dark, 0.4));
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const x = Math.floor(r() * T);
    const y = Math.floor(r() * T);
    const h = 2 + Math.floor(r() * 3);
    const lean = r() < 0.3 ? -1 : r() < 0.5 ? 1 : 0;
    for (let k = 0; k < h; k++) {
      const c = k === 0 ? p.light : k === h - 1 ? p.deep : p.base;
      g.setw(x + (k === 0 ? lean : 0), y + k, c);
    }
  }
  return g;
}

function flowersOn(g: Grid, seed: number, n: number, cols: readonly Col[]): void {
  inside(seed, n, 2, (x, y, r) => {
    const c = cols[Math.floor(r() * cols.length)];
    g.set(x - 1, y, c)
      .set(x + 1, y, c)
      .set(x, y - 1, c)
      .set(x, y + 1, c)
      .set(x, y, PAL.yellow);
    g.set(x + 1, y + 1, mix(c, PAL.black, 0.45));
  });
}

// ------------------------------------------------------------------ others --

const TOWN_GRASS: GrassPal = { base: '#4a9a46', dark: PAL.darkGreen, light: '#7dd05a', deep: PAL.forest };
const FOREST_GRASS: GrassPal = { base: '#2f7045', dark: PAL.forest, light: '#4fa34a', deep: PAL.deepTeal };

function dirt(base: Col, dark: Col, light: Col, hi: Col, seed: number, pebbles = 5): Grid {
  const g = flat(base);
  mottle(g, seed + 3, mix(base, dark, 0.3), 0.3);
  scatter(g, seed, 14, SPECKS, [dark, mix(base, light, 0.5)]);
  scatter(g, seed + 5, pebbles, PEBBLE, [dark, hi, light]);
  return g;
}

/** Vertical wooden planks; plank ends are staggered so no horizontal seam lines up. */
function planks(wood: readonly Col[], seed: number, variant: number): Grid {
  // wood: [gap, dark, mid, light, highlight]
  const g = new Grid(T, T);
  const ends = [3, 11, 7, 14];
  for (let p = 0; p < 4; p++) {
    const x0 = p * 4;
    for (let y = 0; y < T; y++) {
      for (let i = 0; i < 4; i++) {
        const x = x0 + i;
        let c: Col = i === 3 ? wood[0] : i === 0 ? wood[3] : wood[2];
        if (i === 2 && ((y + p * 3) % 7 === 0 || (y + p * 5) % 11 === 0)) c = wood[1];
        g.set(x, y, c);
      }
      if (y === ends[p]) {
        for (let i = 0; i < 3; i++) g.set(x0 + i, y, wood[0]);
        g.set(x0 + 1, (y + 1) % T, wood[4]);
      }
    }
    g.set(x0 + 1, (ends[p] + 2) % T, wood[1]);
    g.set(x0 + 1, (ends[p] + T - 2) % T, wood[1]);
  }
  const r = rng(seed + variant * 31);
  const p = Math.floor(r() * 4);
  const ky = 5 + Math.floor(r() * 5);
  if (variant % 4 !== 0 && Math.abs(ky - ends[p]) > 1) {
    g.set(p * 4 + 1, ky, wood[1])
      .set(p * 4 + 2, ky, wood[1])
      .set(p * 4 + 1, ky + 1, wood[0]);
  }
  return g;
}

const WOOD = [PAL.plum, PAL.darkBrown, '#9a5b45', PAL.brown, PAL.tan] as const;
const WOOD_DARK = [PAL.black, PAL.plum, PAL.darkBrown, '#8f5242', PAL.brown] as const;
const WOOD_CHAR = [PAL.black, PAL.plum, '#4e3036', PAL.darkBrown, '#9a5b45'] as const;
const WOOD_FROST = [PAL.navy, PAL.darkBrown, '#8f5a4a', '#b88a78', PAL.lightGray] as const;
const WOOD_VOID = [PAL.black, PAL.navy, '#3a2a48', PAL.purple, PAL.magenta] as const;

interface FlagPal {
  gap: Col;
  shadow: Col;
  base: Col;
  hi: Col;
  tones: readonly Col[];
}

/**
 * Square flagstones: 2x2 stones of 8x8 per tile. Stones never cross the tile
 * edge, so every variant can recolour / crack them freely.
 */
function flagstones(p: FlagPal, seed: number, variant: number, crack: Col, extra?: (g: Grid) => void): Grid {
  const g = new Grid(T, T);
  const r = rng(seed * 13 + variant * 7);
  for (let sy = 0; sy < 2; sy++)
    for (let sx = 0; sx < 2; sx++) {
      const tone = p.tones[Math.floor(r() * p.tones.length)];
      for (let y = 0; y < 8; y++)
        for (let x = 0; x < 8; x++) {
          let c: Col = tone;
          if (x === 7 || y === 7) c = p.gap;
          else if (x === 0 || y === 0) c = p.hi;
          else if (x === 6 || y === 6) c = p.shadow;
          g.set(sx * 8 + x, sy * 8 + y, c);
        }
      // surface wear
      for (let k = 0; k < 2; k++) {
        const x = sx * 8 + 1 + Math.floor(r() * 5);
        const y = sy * 8 + 1 + Math.floor(r() * 5);
        g.set(x, y, r() < 0.5 ? p.shadow : mix(tone, p.hi, 0.5));
      }
    }
  // one crack or chip per variant
  if (variant === 1 || variant === 3) {
    const sx = (variant === 1 ? 0 : 8) + 1;
    const sy = (variant === 1 ? 8 : 0) + 1;
    let cx = sx + 1 + Math.floor(r() * 3);
    for (let y = sy; y < sy + 6; y++) {
      g.set(cx, y, crack);
      if (r() < 0.5) cx += r() < 0.5 ? 1 : -1;
      cx = Math.max(sx, Math.min(sx + 5, cx));
    }
  }
  extra?.(g);
  return g;
}

function hexBasalt(top: Col, hi: Col, edge: Col, gap: Col, seed: number, variant: number): Grid {
  const pts: [number, number][] = [
    [0, 0],
    [8, 0],
    [4, 8],
    [12, 8],
  ];
  const g = stones(pts, { gap, shadow: edge, base: top, hi, gapW: 1.2, sy: 1.25 });
  if (variant === 1 || variant === 3) {
    const r = rng(seed + variant);
    const x = 5 + Math.floor(r() * 6);
    const y = 5 + Math.floor(r() * 6);
    if (g.get(x, y) === gap) g.set(x, y, PAL.rust);
  }
  return g;
}

// ------------------------------------------------------------------ build --

const THEMES: Theme[] = ['town', 'forest', 'cave', 'volcano', 'tundra', 'citadel', 'abyss'];
const KINDS: GroundKind[] = ['floor', 'floorAlt', 'path', 'bridge'];

export function buildGround(theme: Theme, kind: GroundKind, variant: number): Grid {
  const v = ((variant % 4) + 4) % 4;
  const seed = THEMES.indexOf(theme) * 1000 + KINDS.indexOf(kind) * 100 + v * 7 + 1;
  switch (theme) {
    case 'town':
      return town(kind, v, seed);
    case 'forest':
      return forest(kind, v, seed);
    case 'cave':
      return cave(kind, v, seed);
    case 'volcano':
      return volcano(kind, v, seed);
    case 'tundra':
      return tundra(kind, v, seed);
    case 'citadel':
      return citadel(kind, v, seed);
    case 'abyss':
      return abyss(kind, v, seed);
  }
}

const COBBLE_PTS = jitterGrid(3, 3, 11, 0.55);

function cobbles(style: StoneStyle, alt: readonly Col[], v: number, seed: number): Grid {
  // the centre stone (index 4) moves per variant; stones touching the edge stay fixed
  const pts = COBBLE_PTS.map((p) => [p[0], p[1]] as [number, number]);
  const r = rng(seed);
  pts[4] = [pts[4][0] + (r() - 0.5) * 2.5, pts[4][1] + (r() - 0.5) * 2.5];
  return stones(pts, style, (i) => (i === 4 ? alt[v % alt.length] : undefined));
}

function town(kind: GroundKind, v: number, seed: number): Grid {
  switch (kind) {
    case 'floor': {
      const g = grass(TOWN_GRASS, seed, 13);
      if (v === 3)
        inside(seed + 1, 1, 3, (x, y) =>
          g
            .set(x, y, '#9cd455')
            .set(x + 1, y, '#7dd05a')
            .set(x, y + 1, PAL.darkGreen),
        );
      return g;
    }
    case 'floorAlt': {
      const g = tallGrass(TOWN_GRASS, seed);
      if (v === 2) flowersOn(g, seed + 4, 1, [PAL.pink]);
      return g;
    }
    case 'path': {
      const g = cobbles(
        { gap: '#6b5a52', shadow: '#9c8676', base: '#bfa98f', hi: '#e0cdb0' },
        ['#bfa98f', '#b39d86', '#c6b194', '#ad9784'],
        v,
        seed,
      );
      if (v === 1) g.set(8, 8, '#5f8f3c');
      return g;
    }
    case 'bridge':
      return planks(WOOD, seed, v);
  }
}

function forest(kind: GroundKind, v: number, seed: number): Grid {
  switch (kind) {
    case 'floor': {
      const g = grass(FOREST_GRASS, seed, 14);
      if (v === 2) inside(seed + 3, 1, 2, (x, y) => g.set(x, y, PAL.orangeBrown).set(x + 1, y, PAL.rust));
      return g;
    }
    case 'floorAlt': {
      // undergrowth: dense ferny grass, clover and the odd tiny bloom
      const g = tallGrass({ ...FOREST_GRASS, light: '#5bb04e' }, seed, 28);
      scatter(g, seed + 5, 3, SPECKS, [PAL.deepTeal, PAL.deepTeal]);
      if (v === 1) flowersOn(g, seed + 4, 1, [PAL.white]);
      if (v === 3)
        inside(seed + 6, 1, 3, (x, y) =>
          g
            .set(x, y, PAL.red)
            .set(x + 1, y, PAL.red)
            .set(x, y + 1, PAL.sand),
        );
      return g;
    }
    case 'path':
      return dirt('#8a5040', PAL.darkBrown, PAL.brown, PAL.tan, seed, 4);
    case 'bridge':
      return planks(WOOD, seed, v);
  }
}

function cave(kind: GroundKind, v: number, seed: number): Grid {
  switch (kind) {
    case 'floor': {
      const base = '#343c5c';
      const g = flat(base);
      mottle(g, seed + 1, '#2e3554', 0.35);
      scatter(g, seed, 16, SPECKS, [PAL.navy, '#45507a']);
      scatter(g, seed + 3, 4, PEBBLE, [PAL.navy, PAL.slate, PAL.darkSlate]);
      if (v === 3) inside(seed + 2, 1, 2, (x, y) => g.set(x, y, PAL.cyan));
      return g;
    }
    case 'floorAlt': {
      // damp moss with faint bioluminescent flecks
      const g = flat('#23474a');
      mottle(g, seed + 1, '#1f3f44', 0.35);
      scatter(g, seed, 18, BLADES, [PAL.deepTeal, '#2f6a52', PAL.deepTeal]);
      if (v === 1 || v === 2) inside(seed + 8, 1, 2, (x, y) => g.set(x, y, PAL.cyan));
      return g;
    }
    case 'path': {
      const pts = jitterGrid(3, 2, 41, 0.6);
      const alt = ['#46507a', '#414a70', '#4b5580', '#434c74'];
      return stones(
        pts,
        { gap: '#22263d', shadow: '#394166', base: '#46507a', hi: '#5c6790', gapW: 1.0 },
        (i) => (i === 1 || i === 4 ? alt[(v + i) % 4] : undefined),
      );
    }
    case 'bridge':
      return planks(WOOD_DARK, seed, v);
  }
}

function volcano(kind: GroundKind, v: number, seed: number): Grid {
  switch (kind) {
    case 'floor': {
      const base = '#4a2c33';
      const g = flat(base);
      mottle(g, seed + 1, '#43272f', 0.35);
      scatter(g, seed, 14, SPECKS, [PAL.plum, '#6b3c3a']);
      scatter(g, seed + 3, 3, PEBBLE, [PAL.plum, '#7a4a45', '#5a343a']);
      if (v === 2) inside(seed + 4, 1, 2, (x, y) => g.set(x, y, PAL.rust).set(x + 1, y, PAL.orange));
      return g;
    }
    case 'floorAlt': {
      // cinder gravel: same hue as the rock, dotted with ash and warm embers
      const base = '#523238';
      const g = flat(base);
      mottle(g, seed + 1, '#4a2d35', 0.4);
      scatter(g, seed, 22, SPECKS, ['#3a2330', '#6e5058']);
      scatter(g, seed + 2, 6, PEBBLE, [PAL.plum, '#7d5f64', '#5f4046']);
      if (v !== 0)
        inside(seed + 6, v === 3 ? 2 : 1, 1, (x, y) => g.set(x, y, v === 3 ? PAL.orange : PAL.rust));
      return g;
    }
    case 'path':
      return hexBasalt('#3a3148', '#4f4563', '#2b2438', '#1b1420', seed, v);
    case 'bridge':
      return planks(WOOD_CHAR, seed, v);
  }
}

function tundra(kind: GroundKind, v: number, seed: number): Grid {
  switch (kind) {
    case 'floor': {
      const base = '#d9e1ed';
      const g = flat(base);
      mottle(g, seed + 1, '#ccd6e5', 0.35);
      // soft wind ripples: short white crest with a blue-grey underside
      const r = rng(seed);
      for (let i = 0; i < 3; i++) {
        const x = Math.floor(r() * T);
        const y = Math.floor(r() * T);
        const w = 2 + Math.floor(r() * 2);
        for (let k = 0; k < w; k++) g.setw(x + k, y, '#eef3f9');
        for (let k = 1; k <= w; k++) g.setw(x + k, y + 1, '#bcc8da');
      }
      scatter(g, seed + 5, 3, [[[0, 0, 0]]], [PAL.white]);
      if (v === 1)
        inside(seed + 7, 1, 3, (x, y) =>
          g
            .set(x, y, PAL.white)
            .set(x, y - 1, '#e8f7ff')
            .set(x + 1, y, '#e8f7ff'),
        );
      return g;
    }
    case 'floorAlt': {
      // frost-bitten grass poking through the snow
      const base = '#cdd6e4';
      const g = flat(base);
      mottle(g, seed + 1, '#c2cddd', 0.35);
      const r = rng(seed);
      const blade = ['#7f9a95', '#6a8580', '#9fb5b0'];
      for (let i = 0; i < 9; i++) {
        const x = Math.floor(r() * T);
        const y = Math.floor(r() * T);
        const h = 2 + Math.floor(r() * 2);
        for (let k = 0; k < h; k++) g.setw(x, y + k, k === 0 ? PAL.white : blade[k % 3]);
        if (r() < 0.5) g.setw(x + 1, y + h - 1, blade[1]);
        g.setw(x, y + h, '#b3bfd2');
      }
      return g;
    }
    case 'path': {
      const base = '#aeb9cb';
      const g = flat(base);
      mottle(g, seed + 1, '#a2aec2', 0.4);
      scatter(g, seed, 10, SPECKS, [PAL.gray, '#c7d0de']);
      scatter(g, seed + 2, 2, PEBBLE, [PAL.slate, PAL.lightGray, PAL.gray]);
      if (v === 1 || v === 3) {
        const fx = v === 1 ? 4 : 8;
        g.rect(fx, 3, 2, 3, '#97a3b8').rect(fx + 3, 9, 2, 3, '#97a3b8');
        g.set(fx, 3, PAL.gray).set(fx + 3, 9, PAL.gray);
      }
      return g;
    }
    case 'bridge': {
      const g = planks(WOOD_FROST, seed, v);
      scatter(g, seed + 1, 4, SPECKS, [PAL.white, PAL.lightGray]);
      return g;
    }
  }
}

function citadel(kind: GroundKind, v: number, seed: number): Grid {
  switch (kind) {
    case 'floor':
      return flagstones(
        {
          gap: '#1c1f33',
          shadow: '#2c3250',
          base: '#363d5e',
          hi: '#4a5378',
          tones: ['#363d5e', '#333a5a', '#3a4263', '#353c5d'],
        },
        seed,
        v,
        '#1c1f33',
      );
    case 'floorAlt':
      return flagstones(
        {
          gap: '#1c1f33',
          shadow: '#2a2f4b',
          base: '#30365a',
          hi: '#424a6e',
          tones: ['#30365a', '#2d3354', '#343a5c'],
        },
        seed,
        (v + 1) % 4 === 0 ? 1 : 3,
        '#1c1f33',
        (g) => {
          scatter(g, seed + 3, 3, PEBBLE, [PAL.navy, PAL.slate, PAL.darkSlate]);
          scatter(g, seed + 4, 4, BLADES, [PAL.deepTeal, '#2f6a52', PAL.deepTeal]);
        },
      );
    case 'path': {
      // royal runner: deep purple weave with gold lozenges
      const g = new Grid(T, T);
      for (let y = 0; y < T; y++)
        for (let x = 0; x < T; x++) {
          let c: Col = (x + y) % 2 === 0 ? '#5a2f60' : PAL.purple;
          const dx = Math.abs(x - 7.5);
          const dy = Math.abs(y - 7.5);
          const d = dx + dy;
          if (d < 2) c = PAL.gold;
          else if (d < 3) c = '#4a2450';
          else if (Math.abs(d - 5) < 0.6) c = '#7a4a82';
          if ((x === 0 || x === 15) && (y === 0 || y === 15)) c = PAL.darkRed;
          g.set(x, y, c);
        }
      g.set(7, 6, PAL.yellow).set(8, 6, PAL.yellow);
      return g;
    }
    case 'bridge':
      return planks(WOOD_DARK, seed, v);
  }
}

function abyss(kind: GroundKind, v: number, seed: number): Grid {
  switch (kind) {
    case 'floor':
      return flagstones(
        {
          gap: '#120e1c',
          shadow: '#28223f',
          base: '#312a4c',
          hi: '#423a62',
          tones: ['#312a4c', '#2e2848', '#352d52', '#302a4a'],
        },
        seed,
        v,
        PAL.purple,
        (g) => {
          if (v === 3) g.set(10, 3, PAL.magenta).set(10, 4, PAL.purple);
        },
      );
    case 'floorAlt': {
      // corrupted ground veined with violet light
      const base = '#2a2140';
      const g = flat(base);
      mottle(g, seed + 1, '#251c39', 0.4);
      const r = rng(seed);
      for (let i = 0; i < 3; i++) {
        let x = Math.floor(r() * T);
        let y = Math.floor(r() * T);
        for (let k = 0; k < 5; k++) {
          g.setw(x, y, k === 2 ? PAL.magenta : PAL.purple);
          x += r() < 0.5 ? 1 : 0;
          y += 1;
        }
      }
      scatter(g, seed + 5, 5, SPECKS, ['#1a1428', '#3d3058']);
      if (v === 1) g.set(7, 6, PAL.cyan);
      if (v === 3) g.set(10, 11, PAL.pink);
      return g;
    }
    case 'path': {
      const g = flagstones(
        { gap: '#120e1c', shadow: '#2e2a4a', base: '#3b365c', hi: '#4f4a78', tones: ['#3b365c'] },
        seed,
        0,
        PAL.purple,
      );
      const glyphs = [
        ['.x.', 'xxx', '.x.'],
        ['x.x', '.x.', 'x.x'],
        ['xx.', '.x.', '.xx'],
        ['.x.', 'x.x', '.x.'],
      ];
      const s = [0, 3, 1, 2][v];
      g.stamp(glyphs[v], { x: '#7a4a9a' }, (s % 2) * 8 + 2, Math.floor(s / 2) * 8 + 2);
      g.set((s % 2) * 8 + 3, Math.floor(s / 2) * 8 + 3, PAL.cyan);
      return g;
    }
    case 'bridge':
      return planks(WOOD_VOID, seed, v);
  }
}
