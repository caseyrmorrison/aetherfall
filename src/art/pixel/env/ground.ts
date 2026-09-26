/**
 * Ground tiles (16x16). Every texture is built on a torus so any variant tiles
 * seamlessly next to any other: loose marks wrap around the tile, and
 * structured textures (cobbles, flagstones, planks, basalt) share one fixed
 * layout at the tile edges and only vary interior details between variants.
 */
import { PAL } from '../../palette';
import type { GroundKind, Theme } from '../types';
import { Grid, bayer, mix, rnd, rng, tileNoise, type Col } from './raster';

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

const THEMES: Theme[] = [
  'town',
  'forest',
  'cave',
  'volcano',
  'tundra',
  'citadel',
  'abyss',
  'desert',
  'ruins',
  'storm',
  'eclipse',
  'oasis',
];
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
    case 'desert':
      return desert(kind, v, seed);
    case 'ruins':
      return ruins(kind, v, seed);
    case 'storm':
      return storm(kind, v, seed);
    case 'eclipse':
      return eclipse(kind, v, seed);
    case 'oasis':
      return oasis(kind, v, seed);
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

// ------------------------------------------------------------------ act II --
// Solenne lies under an eclipsed sun: every palette below is pulled slightly
// toward dusk (rosier sand, bluer shadows) while keeping its local colour.

/** Short wind ripples: a lit crest arcing over a shadowed trough (wrapping). */
function ripples(g: Grid, seed: number, n: number, crest: Col, trough: Col): void {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const x = Math.floor(r() * T);
    const y = Math.floor(r() * T);
    const w = 4 + Math.floor(r() * 3);
    for (let k = 0; k < w; k++) {
      const dy = k === 0 || k === w - 1 ? 1 : 0;
      g.setw(x + k + 1, y + dy + 1, trough);
      g.setw(x + k, y + dy, crest);
    }
  }
}

/** Hairline cracks: short random walks (wrapping), optionally lit on their lower lip. */
function cracks(g: Grid, seed: number, n: number, len: number, c: Col, lit?: Col): void {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    let x = Math.floor(r() * T);
    let y = Math.floor(r() * T);
    const dx = r() < 0.5 ? 1 : -1;
    for (let k = 0; k < len; k++) {
      g.setw(x, y, c);
      if (lit && g.getw(x, y + 1) !== c) g.setw(x, y + 1, lit);
      if (r() < 0.6) x += dx;
      else y += 1;
    }
  }
}

/** Small tufts (dry scrub / beach grass), kept inside the tile. cols: [root, mid, tip] */
function tufts(g: Grid, seed: number, n: number, cols: readonly Col[]): void {
  inside(seed, n, 2, (x, y, r) => {
    const h = 2 + Math.floor(r() * 2);
    for (let k = 0; k < h; k++) g.set(x, y - k, k === 0 ? cols[0] : k === h - 1 ? cols[2] : cols[1]);
    g.set(x - 1, y - 1, cols[1])
      .set(x - 1, y, cols[0])
      .set(x + 1, y - h + 2, cols[2])
      .set(x + 1, y, cols[0]);
  });
}

const DUNE = {
  base: '#c99474',
  mot: '#c08b70',
  crest: '#d8aa84',
  trough: '#b07c66',
  deep: '#8a5a58',
  grain: '#e4bf96',
} as const;
const STRAW = ['#8a6a4e', '#b8905e', '#e0b87a'] as const;
const WOOD_BLEACHED = [PAL.plum, '#7a5048', '#a87c64', '#c49a78', '#e4c4a0'] as const;

function desert(kind: GroundKind, v: number, seed: number): Grid {
  switch (kind) {
    case 'floor': {
      // dune sand with wind ripples
      const g = flat(DUNE.base);
      mottle(g, seed + 1, DUNE.mot, 0.4);
      ripples(g, seed, 3, DUNE.crest, DUNE.trough);
      scatter(g, seed + 5, 6, SPECKS, [DUNE.trough, DUNE.grain]);
      if (v === 1)
        inside(seed + 7, 1, 3, (x, y) =>
          g
            .set(x, y, '#9a8088')
            .set(x + 1, y, '#6e5460')
            .set(x, y + 1, '#6e5460')
            .set(x + 1, y + 1, DUNE.deep),
        );
      if (v === 3) inside(seed + 9, 1, 3, (x, y) => g.set(x, y, '#efe2cc').set(x + 1, y, '#c9b39a'));
      return g;
    }
    case 'floorAlt': {
      // scrub flats: firmer, cracked sand with dry grass tufts
      const g = flat('#c08a6e');
      mottle(g, seed + 1, '#b6816a', 0.45);
      cracks(g, seed + 3, 3, 5, '#9a6658', '#cd9a7a');
      scatter(g, seed + 5, 3, PEBBLE, [DUNE.deep, '#dcae88', '#a8735f']);
      tufts(g, seed + 6, v === 2 ? 3 : 2, STRAW);
      return g;
    }
    case 'path':
      // packed caravan trail
      return dirt('#aa725f', '#8e5c55', '#c28a70', '#ddb089', seed, 5);
    case 'bridge':
      return planks(WOOD_BLEACHED, seed, v);
  }
}

const OASIS_BLADE = ['#2f6a52', '#3e8948', '#63a85a', '#9cd06a'] as const;

function oasis(kind: GroundKind, v: number, seed: number): Grid {
  switch (kind) {
    case 'floor': {
      // fine, pale town sand
      const g = flat('#d4a67c');
      mottle(g, seed + 1, '#cb9d76', 0.35);
      ripples(g, seed, 2, '#e6c29a', '#b98c6c');
      scatter(g, seed + 5, 7, SPECKS, ['#b98c6c', '#e8c8a0']);
      if (v === 2) inside(seed + 7, 1, 3, (x, y) => g.set(x, y, '#f0e0cc').set(x + 1, y, '#d8b8a8'));
      return g;
    }
    case 'floorAlt': {
      // oasis grass sprouting through the sand
      const g = flat('#cc9f78');
      mottle(g, seed + 1, '#c0946f', 0.35);
      const r = rng(seed);
      for (let i = 0; i < 18; i++) {
        const x = Math.floor(r() * T);
        const y = Math.floor(r() * T);
        const h = 2 + Math.floor(r() * 3);
        const lean = r() < 0.35 ? -1 : r() < 0.5 ? 1 : 0;
        for (let k = 0; k < h; k++) {
          const c = k === 0 ? OASIS_BLADE[0] : k === h - 1 ? OASIS_BLADE[3] : OASIS_BLADE[k % 2 ? 1 : 2];
          g.setw(x + (k === h - 1 ? lean : 0), y - k, c);
        }
      }
      if (v === 1) flowersOn(g, seed + 4, 1, [PAL.pink]);
      if (v === 3) flowersOn(g, seed + 4, 1, [PAL.gold]);
      return g;
    }
    case 'path':
      // squared sandstone paving with sand blown into the joints
      return flagstones(
        {
          gap: '#9a6852',
          shadow: '#bb8a6a',
          base: '#cfa07a',
          hi: '#e0b890',
          tones: ['#cfa07a', '#c99a74', '#d4a67e', '#c49470'],
        },
        seed,
        v,
        '#a8765e',
        (g) => {
          g.map((c, x, y) => (c === '#9a6852' && rnd(x, y, seed + 3) > 0.7 ? '#c8986e' : undefined));
          if (v === 2)
            g.set(11, 3, '#2f8a8c').set(12, 3, '#5fc4bc').set(11, 4, '#1f5a64').set(12, 4, '#2f8a8c');
        },
      );
    case 'bridge':
      return planks(WOOD, seed, v);
  }
}

const RUIN_FLAG: FlagPal = {
  gap: '#1a2f2f',
  shadow: '#32514b',
  base: '#3a5c56',
  hi: '#476a60',
  tones: ['#3a5c56', '#375750', '#3d6059', '#395a54'],
};

/** Drifts of pale silt left behind by the flood water. */
function silt(g: Grid, seed: number, amount: number): void {
  const th = 1 - amount;
  g.map((c, x, y) => {
    const n = fbm(x, y, seed);
    if (n < th - 0.02 || (n < th + 0.03 && bayer(x, y) < 0.5)) return c;
    return n > th + 0.12 && rnd(x, y, seed + 1) > 0.6 ? '#5f735f' : '#51655a';
  });
}
const MOSS = ['#1d3c36', '#264e40', '#2f6246', '#437a50'] as const;
const WOOD_WET = [PAL.black, PAL.plum, '#4a3a38', '#6a5244', '#8a7a5a'] as const;

/** Soft moss clumps following a tileable noise field. amount 0..1 of the tile covered. */
export function mossOver(g: Grid, seed: number, amount: number): void {
  const th = 1 - amount;
  g.map((c, x, y) => {
    const n = fbm(x, y, seed);
    if (n < th - 0.03 || (n < th + 0.02 && bayer(x, y) < 0.5)) return c;
    const k = n > th + 0.16 ? 3 : n > th + 0.08 ? 2 : 1;
    return rnd(x, y, seed + 3) > 0.82 ? MOSS[Math.min(3, k + 1)] : MOSS[k];
  });
}

const RUIN_PTS: [number, number][] = [
  [3, 3],
  [11, 2],
  [7.5, 8.5],
  [14, 9.5],
  [2, 12],
  [10, 14.5],
];

/** Big, worn, irregular temple slabs with moss creeping along the joints. */
function ruinSlabs(v: number, seed: number): Grid {
  const tone = ['#3a5c56', '#375750', '#3d6059', '#395a54'];
  const g = stones(
    RUIN_PTS,
    { gap: RUIN_FLAG.gap, shadow: RUIN_FLAG.shadow, base: RUIN_FLAG.base, hi: RUIN_FLAG.hi, gapW: 1.0 },
    // only the interior slab changes tone per variant, so seams always match
    (i) => (i === 2 ? tone[v] : undefined),
  );
  g.map((c, x, y) =>
    c === RUIN_FLAG.gap && rnd(x, y, 29) > 0.55 ? MOSS[rnd(x, y, 30) > 0.5 ? 1 : 0] : undefined,
  );
  cracks(g, seed + 7, v === 1 || v === 3 ? 1 : 0, 3, '#243e3a');
  return g;
}

function ruins(kind: GroundKind, v: number, seed: number): Grid {
  switch (kind) {
    case 'floor': {
      // worn temple slabs, silted over where the flood receded
      const g = ruinSlabs(v, seed);
      silt(g, seed + 21, 0.22);
      mossOver(g, seed + 11, 0.14);
      if (v === 2) inside(seed + 4, 1, 3, (x, y) => g.set(x, y, '#6fa0a0').set(x + 1, y, '#9fd0c8'));
      return g;
    }
    case 'floorAlt': {
      // the same slabs, swallowed by moss and algae
      const g = ruinSlabs(v, seed);
      mossOver(g, seed + 13, 0.52);
      scatter(g, seed + 5, 5, BLADES, [MOSS[1], MOSS[3], MOSS[0]]);
      if (v === 3) inside(seed + 6, 1, 3, (x, y) => g.set(x, y, PAL.pink).set(x + 1, y + 1, '#c85a6a'));
      return g;
    }
    case 'path': {
      // processional walkway: long slabs carved with a wave frieze
      const g = new Grid(T, T);
      const tone = ['#46695f', '#43655c', '#4a6e63', '#446760'];
      for (let y = 0; y < T; y++)
        for (let x = 0; x < T; x++) {
          const row = y >> 3;
          const ly = y & 7;
          const jx = row === 0 ? 15 : x < 8 ? 7 : 15;
          const lx = row === 0 ? x : x & 7;
          let c: Col = tone[(row * 2 + (x < 8 ? 0 : 1) + v) % 4];
          if (ly === 7 || x === jx) c = '#152a2b';
          else if (ly === 0 || lx === 0) c = '#5f8676';
          else if (ly === 6 || x === jx - 1) c = '#33524c';
          g.set(x, y, c);
        }
      for (let x = 1; x < 15; x++) {
        const yy = 3 + (((x + 1) >> 1) & 1);
        g.set(x, yy, '#26413e');
        g.set(x, yy + 1, '#5a8272');
      }
      if (v === 1 || v === 3) g.set(v === 1 ? 4 : 10, 11, '#26413e').set(v === 1 ? 5 : 11, 11, '#26413e');
      if (v === 2) g.set(7, 3, PAL.cyan).set(8, 4, '#3fd6c0');
      mossOver(g, seed + 17, 0.12);
      return g;
    }
    case 'bridge': {
      const g = planks(WOOD_WET, seed, v);
      scatter(g, seed + 1, 4, SPECKS, [MOSS[2], MOSS[1]]);
      return g;
    }
  }
}

const SLATE_G = {
  base: '#3c4462',
  mot: '#363d5a',
  crack: '#23283f',
  lit: '#4a5476',
  wet: '#5c6890',
  shine: '#8b9bb4',
} as const;
const STORM_GRASS = ['#27404a', '#3c6068', '#5a8a86', '#8fbcae'] as const;
const STORM_FLAG_PTS: [number, number][] = [
  [3.5, 3.5],
  [11.5, 2.5],
  [7.5, 9],
  [1, 12.5],
  [13.5, 12],
];
const WOOD_STORM = [PAL.black, PAL.navy, '#4a4a5e', '#66667c', '#8a8aa2'] as const;

/** A shallow rain puddle reflecting the sky. */
function puddle(g: Grid, x: number, y: number, w: number): void {
  for (let i = 0; i < w; i++) {
    g.set(x + i, y, i === 0 || i === w - 1 ? '#2e3658' : '#262d4c');
    g.set(x + i, y + 1, i === 0 || i === w - 1 ? SLATE_G.lit : '#2e3658');
  }
  g.set(x + 1, y, SLATE_G.wet).set(x + 2, y, SLATE_G.shine);
}

function storm(kind: GroundKind, v: number, seed: number): Grid {
  switch (kind) {
    case 'floor': {
      // rain-slick slate plateau
      const g = flat(SLATE_G.base);
      mottle(g, seed + 1, SLATE_G.mot, 0.42);
      cracks(g, seed + 3, 2, 4, SLATE_G.crack, SLATE_G.lit);
      scatter(g, seed + 5, 8, SPECKS, ['#2e3452', '#4c5578']);
      const r = rng(seed + 9);
      for (let i = 0; i < 2; i++) {
        const x = Math.floor(r() * T);
        const y = Math.floor(r() * T);
        g.setw(x, y, SLATE_G.wet)
          .setw(x + 1, y, SLATE_G.wet)
          .setw(x + 2, y, SLATE_G.lit);
      }
      if (v === 1) inside(seed + 7, 1, 4, (x, y) => puddle(g, x - 2, y, 5));
      if (v === 3)
        inside(seed + 8, 1, 3, (x, y) => g.set(x, y, STORM_GRASS[2]).set(x, y + 1, STORM_GRASS[1]));
      return g;
    }
    case 'floorAlt': {
      // heath: wind-bent grass combed toward the east
      const g = flat('#38425e');
      mottle(g, seed + 1, '#33405a', 0.4);
      const r = rng(seed);
      for (let i = 0; i < 20; i++) {
        const x = Math.floor(r() * T);
        const y = Math.floor(r() * T);
        const h = 3 + Math.floor(r() * 2);
        for (let k = 0; k < h; k++) {
          const c = k === 0 ? STORM_GRASS[0] : k === h - 1 ? STORM_GRASS[3] : STORM_GRASS[k === 1 ? 1 : 2];
          g.setw(x + (k > 1 ? k - 1 : 0), y - k, c);
        }
      }
      if (v === 2) g.set(6, 9, PAL.lightGray).set(7, 9, '#9fa8d0');
      return g;
    }
    case 'path': {
      // worn slate flags, rain pooling in the hollows
      const alt = ['#4d5678', '#48516f', '#525c80', '#4a5374'];
      const g = stones(
        STORM_FLAG_PTS,
        { gap: '#1d2136', shadow: '#3f476a', base: '#4d5678', hi: '#5e6990', gapW: 1.1, sy: 1.2 },
        (i) => (i === 2 ? alt[v] : undefined),
      );
      cracks(g, seed + 3, v === 3 ? 1 : 0, 3, '#2e3452');
      if (v === 1) puddle(g, 5, 9, 4);
      if (v === 2) g.set(9, 4, SLATE_G.shine).set(10, 4, SLATE_G.wet);
      return g;
    }
    case 'bridge':
      return planks(WOOD_STORM, seed, v);
  }
}

const GOLD_INLAY = '#c48a2c';
const BRONZE = '#523626';
const ONYX: FlagPal = {
  gap: '#0e0b16',
  shadow: '#1a1527',
  base: '#241e33',
  hi: '#352c48',
  tones: ['#241e33', '#221c30', '#27203a', '#231d31'],
};
const WOOD_ONYX = [PAL.black, '#1a1526', '#2e2640', '#443a5a', GOLD_INLAY] as const;

/** Bronze inlay along the tile's south + east joints (a 16px grid), gold studs where they cross. */
function goldGrid(g: Grid): void {
  for (let i = 0; i < T; i++) {
    g.set(15, i, BRONZE);
    g.set(i, 15, BRONZE);
  }
  g.set(15, 15, PAL.gold).set(14, 15, GOLD_INLAY).set(15, 14, GOLD_INLAY);
}

function eclipse(kind: GroundKind, v: number, seed: number): Grid {
  switch (kind) {
    case 'floor':
      // black marble veined with violet, set in gold
      return flagstones(ONYX, seed, v, '#0e0b16', (g) => {
        // a faint diagonal vein through one slab
        const r = rng(seed + 5);
        const sx = Math.floor(r() * 2) * 8;
        const sy = Math.floor(r() * 2) * 8;
        for (let i = 0; i < 5; i++) g.set(sx + 1 + i, sy + 5 - i, i === 2 ? '#3e3456' : '#2e2640');
        goldGrid(g);
      });
    case 'floorAlt': {
      // star mosaic: indigo tesserae scattered with gold and white stars
      const g = new Grid(T, T);
      for (let y = 0; y < T; y++)
        for (let x = 0; x < T; x++) g.set(x, y, ((x >> 1) + (y >> 1)) % 2 ? '#1b1936' : '#1e1c3c');
      const star = [
        ['..o..', '.oyo.', 'oywyo', '.oyo.', '..o..'],
        ['..y..', '..o..', 'yowoy', '..o..', '..y..'],
        ['.....', '.w...', '...o.', '.o...', '...w.'],
        ['.ooo.', 'o...o', 'o.k.o', 'o...o', '.ooo.'],
      ][v];
      g.stamp(star, { y: PAL.gold, o: GOLD_INLAY, w: PAL.white, k: PAL.black }, 5, 5);
      const r = rng(seed + 3);
      for (let i = 0; i < 5; i++) {
        const x = Math.floor(r() * 15);
        const y = Math.floor(r() * 15);
        if (x > 2 && x < 12 && y > 2 && y < 12) continue;
        g.set(x, y, i % 3 === 0 ? PAL.lightGray : i % 3 === 1 ? '#6a76c0' : PAL.white);
      }
      goldGrid(g);
      return g;
    }
    case 'path': {
      // processional road: an eclipse emblem (black disc, gold corona) per slab
      const g = new Grid(T, T);
      for (let y = 0; y < T; y++)
        for (let x = 0; x < T; x++) {
          let c: Col = (x + y) % 2 ? '#2a2140' : '#2c2343';
          if (x === 0 || y === 0) c = '#3a2e54';
          const d = Math.hypot(x + 0.5 - 7.5, y + 0.5 - 7.5);
          const ang = Math.atan2(y + 0.5 - 7.5, x + 0.5 - 7.5);
          const ray = Math.abs(Math.sin(ang * 4)) < 0.22;
          if (d < 2.4) c = PAL.black;
          else if (d < 3.4) c = ang < -0.8 && ang > -2.4 ? PAL.gold : GOLD_INLAY;
          else if (d < 4.2) c = '#4a2e30';
          else if (d < 6 && ray) c = d < 5 ? '#8a5a2a' : BRONZE;
          g.set(x, y, c);
        }
      // the phase differs per variant: a sliver of sun peeks past the disc
      const peek = [null, [6, 6], [9, 6], [9, 9]][v];
      if (peek) g.set(peek[0], peek[1], PAL.yellow);
      goldGrid(g);
      return g;
    }
    case 'bridge':
      return planks(WOOD_ONYX, seed, v);
  }
}
