/**
 * Generic anime bust renderer: head construction (3/4 view), eyes, brows,
 * mouth, expressions, layered cel shading and outlines. Character specs
 * (characters/*.ts) supply hair, clothes and accessories.
 *
 * Design space: 100 x 120 units. Cranium center ~(50, 38), eyes at y≈50,
 * chin ≈75, shoulders from ≈85 down to 120.
 */
import { C } from './pal';
import { Raster, bayer, dither, type Ink } from './raster';
import { clamp, lerp, spline, splinePts, strand, type P } from './geom';

export type Expression =
  'neutral' | 'happy' | 'sad' | 'angry' | 'surprised' | 'determined' | 'hurt' | 'smirk';

export type EyeShape = 'open' | 'arc' | 'closed' | 'wince';

export type MouthShape =
  | 'line'
  | 'smile'
  | 'open'
  | 'grin'
  | 'frown'
  | 'wobble'
  | 'o'
  | 'obig'
  | 'teeth'
  | 'shout'
  | 'set'
  | 'grimace'
  | 'grimaceOpen'
  | 'smirk'
  | 'smirkOpen'
  | 'cruel';

export interface EyeParams {
  shape: EyeShape;
  open: number;
  low: number;
  tilt: number;
  iris: number;
}

export interface BrowParams {
  inner: number;
  mid: number;
  outer: number;
}

export interface ExprParams {
  near: EyeParams;
  far: EyeParams;
  browNear: BrowParams;
  browFar: BrowParams;
  lookX: number;
  lookY: number;
  mouth: MouthShape;
  talk: MouthShape;
  blush: number;
  sweat: boolean;
  tears: boolean;
  glint: boolean;
  scratch: boolean;
}

const eye = (shape: EyeShape, open = 1, low = 0, tilt = 0, iris = 1): EyeParams => ({
  shape,
  open,
  low,
  tilt,
  iris,
});
const brow = (inner = 0, mid = 0, outer = 0): BrowParams => ({ inner, mid, outer });

export function exprParams(e: Expression, happyEyes: 'arc' | 'open'): ExprParams {
  const base: ExprParams = {
    near: eye('open'),
    far: eye('open'),
    browNear: brow(),
    browFar: brow(),
    lookX: 0.12,
    lookY: 0,
    mouth: 'line',
    talk: 'open',
    blush: 0,
    sweat: false,
    tears: false,
    glint: false,
    scratch: false,
  };
  switch (e) {
    case 'neutral':
      return base;
    case 'happy': {
      const ey = happyEyes === 'arc' ? eye('arc') : eye('open', 0.92, 0.45, -0.1);
      return {
        ...base,
        near: ey,
        far: ey,
        browNear: brow(-0.45, -0.35, 0),
        browFar: brow(-0.45, -0.35, 0),
        mouth: 'grin',
        talk: 'grin',
        blush: 0.5,
      };
    }
    case 'sad':
      return {
        ...base,
        near: eye('open', 0.78, 0.15, -0.5),
        far: eye('open', 0.78, 0.15, -0.5),
        browNear: brow(-0.9, -0.2, 0.5),
        browFar: brow(-0.9, -0.2, 0.5),
        lookY: 0.18,
        lookX: 0.05,
        mouth: 'frown',
        talk: 'wobble',
        blush: 0.25,
        tears: true,
      };
    case 'angry':
      return {
        ...base,
        near: eye('open', 0.86, 0.1, 0.6, 0.9),
        far: eye('open', 0.86, 0.1, 0.6, 0.9),
        browNear: brow(1.0, 0.15, -0.4),
        browFar: brow(1.0, 0.15, -0.4),
        mouth: 'teeth',
        talk: 'shout',
      };
    case 'surprised':
      return {
        ...base,
        near: eye('open', 1.12, 0, -0.05, 0.62),
        far: eye('open', 1.12, 0, -0.05, 0.62),
        browNear: brow(-1.0, -1.1, -0.7),
        browFar: brow(-1.0, -1.1, -0.7),
        lookX: 0,
        mouth: 'o',
        talk: 'obig',
        sweat: true,
      };
    case 'determined':
      return {
        ...base,
        near: eye('open', 0.8, 0.12, 0.32),
        far: eye('open', 0.8, 0.12, 0.32),
        browNear: brow(0.6, 0.05, -0.2),
        browFar: brow(0.6, 0.05, -0.2),
        mouth: 'set',
        talk: 'open',
        glint: true,
      };
    case 'hurt':
      return {
        ...base,
        near: eye('wince'),
        far: eye('open', 0.62, 0.2, -0.35, 0.9),
        browNear: brow(0.2, -0.2, 0.2),
        browFar: brow(-0.7, -0.3, 0.45),
        mouth: 'grimace',
        talk: 'grimaceOpen',
        sweat: true,
        scratch: true,
        blush: 0.15,
      };
    case 'smirk':
      return {
        ...base,
        near: eye('open', 0.58, 0.18, 0.18),
        far: eye('open', 0.66, 0.12, 0.05),
        browNear: brow(0.35, 0.05, 0),
        browFar: brow(-0.35, -0.55, -0.25),
        mouth: 'smirk',
        talk: 'smirkOpen',
        lookX: 0.25,
      };
  }
}

/* ------------------------------------------------------------------------ */

export interface EyeGeom {
  x: number;
  y: number;
  w: number;
  h: number;
  /** -1: outer corner to the left (near eye), +1: to the right (far eye). */
  dir: number;
}

export interface FaceGeom {
  T: number;
  eyeY: number;
  near: EyeGeom;
  far: EyeGeom;
  noseX: number;
  noseY: number;
  mouthX: number;
  mouthY: number;
  chinX: number;
  chinY: number;
  face: number[];
  ear: P;
}

export interface FaceShape {
  /** 3/4 turn toward the viewer's right, 0 (front) .. 1. */
  turn: number;
  /** Eye width / height (design units). */
  eyeW: number;
  eyeH: number;
  /** Extra jaw width (0 = default). */
  jaw: number;
  /** Chin y offset (+ = longer face). */
  chin: number;
  /** Cheek fullness (+ = rounder). */
  cheek: number;
  /** Eye vertical offset. */
  eyeDy?: number;
  /** Eye spacing offset. */
  eyeSpread?: number;
  /** Mouth vertical offset. */
  mouthDy?: number;
}

type Pts = readonly P[];

// Face contour key points for front (T=0) and 3/4 (T=1) views. Same count & order.
const FACE_FRONT: Pts = [
  [50, 12],
  [66, 15],
  [74.5, 27],
  [75.5, 40],
  [74.5, 49],
  [71, 57.5],
  [65.5, 65.5],
  [57.5, 71.5],
  [50, 74.5],
  [42.5, 71.5],
  [34.5, 65.5],
  [29, 57.5],
  [25.5, 49],
  [24.5, 40],
  [25.5, 27],
  [34, 15],
];
const FACE_TURN: Pts = [
  [52, 12],
  [67, 15],
  [74.5, 27],
  [75, 40],
  [73, 48],
  [72, 55],
  [68, 63],
  [61.5, 70.5],
  [55.5, 74.8],
  [46.5, 72.5],
  [36, 66.5],
  [29.5, 58.5],
  [25.5, 49],
  [24.5, 40],
  [25.5, 27],
  [35, 15],
];

export function faceGeom(fs: FaceShape): FaceGeom {
  const T = fs.turn;
  const chin = fs.chin;
  const jaw = fs.jaw;
  const cheek = fs.cheek;
  const pts: P[] = FACE_FRONT.map((p, i) => {
    const q = FACE_TURN[i];
    let x = lerp(p[0], q[0], T);
    let y = lerp(p[1], q[1], T);
    // lower face adjustments
    if (y > 52) {
      const k = (y - 52) / 23;
      y += chin * k;
      const cx = lerp(50, 55, T);
      x = cx + (x - cx) * (1 + (jaw * (1 - Math.abs(k - 0.5))) / 25);
      if (k < 0.75) x += (x < cx ? -1 : 1) * cheek * Math.sin(k * Math.PI);
    }
    return [x, y];
  });
  const eyeY = 50 + (fs.eyeDy ?? 0);
  const spread = fs.eyeSpread ?? 0;
  return {
    T,
    eyeY,
    near: { x: lerp(37.5, 40, T) - spread, y: eyeY, w: fs.eyeW * lerp(1, 1.06, T), h: fs.eyeH, dir: -1 },
    far: {
      x: lerp(62.5, 64.5, T) + spread * lerp(1, 0.6, T),
      y: eyeY,
      w: fs.eyeW * lerp(1, 0.8, T),
      h: fs.eyeH * lerp(1, 0.98, T),
      dir: 1,
    },
    noseX: lerp(50, 57.5, T),
    noseY: lerp(59, 59.5, T) + chin * 0.3,
    mouthX: lerp(50, 54.5, T),
    mouthY: lerp(66.5, 67, T) + chin * 0.55 + (fs.mouthDy ?? 0),
    chinX: pts[8][0],
    chinY: pts[8][1],
    face: spline(pts, true, 5),
    ear: [lerp(25.5, 26.5, T), 52],
  };
}

/* ------------------------------------------------------------------------ */

export interface Layers {
  back: Raster;
  body: Raster;
  head: Raster;
  feat: Raster;
  front: Raster;
  over: Raster;
  scratch: Raster;
}

export interface Spec {
  id: string;
  skin: number;
  skinShade: number;
  skinLine: number;
  /** Line color for the mouth and inner facial lines. */
  mouthLine: number;
  lash: number;
  iris: readonly [number, number, number];
  pupil: number;
  sclera: number;
  scleraShade: number;
  brow: number;
  hairLine: number;
  clothLine: number;
  backLine?: number;
  female: boolean;
  shape: FaceShape;
  happyEyes: 'arc' | 'open';
  /** Lash thickness multiplier. */
  lashW?: number;
  /** Draw the mouth above the front layer (beards). */
  beard?: boolean;
  /** Vertical slit pupils. */
  slit?: boolean;
  /** Iris size multiplier. */
  irisScale?: number;
  /** Skip the generic ear. */
  noEar?: boolean;
  tweak?(e: Expression, p: ExprParams): ExprParams;
  back?(dc: DrawCtx): void;
  body(dc: DrawCtx): void;
  headExtra?(dc: DrawCtx): void;
  front(dc: DrawCtx): void;
  featExtra?(dc: DrawCtx): void;
  over?(dc: DrawCtx): void;
  brows?(dc: DrawCtx): void;
}

export interface BustOpts {
  talking?: boolean;
  blink?: boolean;
  /** Eye openness override 0..1 (for eye-opening animations). */
  eyeOpen?: number;
  /** Wind for hair / cloth: design units of tip displacement. */
  windX?: number;
  windY?: number;
  /** Animation phase (radians) for flutter. */
  phase?: number;
  /** Costume variant (e.g. 'knight', 'child'). */
  variant?: string;
  /** Iris override colors (e.g. glowing eyes). */
  iris?: readonly [number, number, number];
  /** Skip drawing some layers. */
  noBody?: boolean;
  /** Replace the generic expression-driven marks (sweat/tears...). */
  noMarks?: boolean;
  /** Extra glow color for the eye highlights. */
  eyeGlow?: number;
  /** Only render the eyes into the returned `feat` layer. */
  eyesOnly?: boolean;
  /** Mouth shape override. */
  mouth?: MouthShape;
}

export interface DrawCtx {
  L: Layers;
  spec: Spec;
  e: ExprParams;
  expr: Expression;
  g: FaceGeom;
  o: BustOpts;
  wx: number;
  wy: number;
  phase: number;
  variant: string;
}

/* ------------------------------------------------------------------------ */
/* Drawing helpers shared by character specs                                 */

/** Fill polygon with `shade`, then its light-shifted copy with `base` (cel shading). */
export function cel(
  r: Raster,
  scratch: Raster,
  pts: ArrayLike<number>,
  base: Ink,
  shade: Ink,
  lx: number,
  ly: number,
): void {
  const px = r.toPx(pts);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < px.length; i += 2) {
    minX = Math.min(minX, px[i]);
    maxX = Math.max(maxX, px[i]);
    minY = Math.min(minY, px[i + 1]);
    maxY = Math.max(maxY, px[i + 1]);
  }
  const x0 = Math.max(0, Math.floor(minX) - 1);
  const x1 = Math.min(scratch.w - 1, Math.ceil(maxX) + 1);
  const y0 = Math.max(0, Math.floor(minY) - 1);
  const y1 = Math.min(scratch.h - 1, Math.ceil(maxY) + 1);
  if (x1 < x0 || y1 < y0) return;
  for (let y = y0; y <= y1; y++) scratch.data.fill(0, y * scratch.w + x0, y * scratch.w + x1 + 1);
  scratch.fillPx(px, 1);
  r.fillPx(px, shade);
  const s = r.scale;
  const sx = lx * s;
  const sy = ly * s;
  // shift in screen space (independent of rotation)
  const shifted = new Float64Array(px.length);
  for (let i = 0; i < px.length; i += 2) {
    shifted[i] = px[i] + sx;
    shifted[i + 1] = px[i + 1] + sy;
  }
  const pm = r.clipMask;
  r.clipMask = scratch.data;
  r.fillPx(shifted, base);
  r.clipMask = pm;
}

/** Ink that maps the existing color through `map` (shade whatever is below). */
export function mapInk(r: Raster, map: Readonly<Record<number, number>>): Ink {
  return (x, y) => {
    const v = r.data[y * r.w + x];
    const m = map[v];
    return m === undefined ? v : m;
  };
}

/** Anime "angel ring" highlight band on hair, clipped to the layer's existing pixels. */
export function angelRing(
  r: Raster,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  a0: number,
  a1: number,
  color: number,
  opts: { n?: number; len?: number; w?: number; seed?: number; only?: number; color2?: number } = {},
): void {
  const n = (opts.n ?? 9) * 2;
  const len = opts.len ?? 4.5;
  const w = opts.w ?? 2.4;
  const seed = opts.seed ?? 0;
  r.with({ self: true, only: opts.only ?? -1 }, () => {
    const inner: number[] = [];
    const outer: number[] = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const a = lerp(a0, a1, t);
      const c = Math.cos(a);
      const sn = Math.sin(a);
      let nx = c / rx;
      let ny = sn / ry;
      const nl = Math.hypot(nx, ny) || 1;
      nx /= nl;
      ny /= nl;
      const px = cx + c * rx;
      const py = cy + sn * ry;
      const taper = Math.pow(Math.sin(t * Math.PI), 0.6);
      const jag = i % 2 === 1 ? len * (0.55 + 0.45 * Math.abs(Math.sin(i * 1.7 + seed))) : 0;
      inner.push(px - nx * w * 0.35 * taper, py - ny * w * 0.35 * taper);
      outer.push(px + nx * (w * 0.5 + jag) * taper, py + ny * (w * 0.5 + jag) * taper);
    }
    const pts = inner.slice();
    for (let i = outer.length - 2; i >= 0; i -= 2) pts.push(outer[i], outer[i + 1]);
    r.poly(pts, color);
    if (opts.color2 !== undefined) {
      // small bright specks in the middle of the band
      for (let i = 2; i < n - 1; i += 4) {
        const a = lerp(a0, a1, i / n);
        r.ellipse(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry + 0.3, w * 0.28, w * 0.28, opts.color2);
      }
    }
  });
}

/** Hair lock with cel shading + optional wind. pts: root → tip. */
export function lock(
  dc: DrawCtx,
  r: Raster,
  pts: readonly P[],
  w: number,
  base: number,
  shade: number,
  opts: {
    pow?: number;
    lx?: number;
    ly?: number;
    wind?: number;
    tipW?: number;
    bulge?: number;
    /** Strand separation line color (default: shade). -1 = none. */
    edge?: number;
    /** Fraction along the lock where the separation lines start. */
    edgeFrom?: number;
  } = {},
): void {
  const wind = opts.wind ?? 1;
  const p2: P[] = pts.map((p, i) => {
    if (i === 0 || wind === 0) return p;
    const k = (i / (pts.length - 1)) * wind;
    const fl = Math.sin(dc.phase + p[1] * 0.15 + i) * 0.25 + 1;
    return [p[0] + dc.wx * k * fl, p[1] + dc.wy * k * fl];
  });
  const poly = strand(p2, w, { pow: opts.pow ?? 1.3, tipW: opts.tipW, bulge: opts.bulge });
  cel(r, dc.L.scratch, poly, base, shade, opts.lx ?? -1.2, opts.ly ?? -0.9);
  const edge = opts.edge ?? shade;
  if (edge >= 0) {
    const half = poly.length / 2;
    const m = half / 2; // points per side
    const from = Math.floor(m * (opts.edgeFrom ?? 0.35));
    const left: number[] = [];
    const right: number[] = [];
    for (let i = from; i < m; i++) left.push(poly[i * 2], poly[i * 2 + 1]);
    for (let i = m; i < 2 * m - from; i++) right.push(poly[i * 2], poly[i * 2 + 1]);
    r.line(left, edge);
    r.line(right, edge);
  }
}

/** Apply wind displacement to a point, weighted by k (0 at root, 1 at tip). */
export function blow(dc: DrawCtx, p: P, k: number): P {
  const fl = Math.sin(dc.phase + p[1] * 0.12) * 0.2 + 1;
  return [p[0] + dc.wx * k * fl, p[1] + dc.wy * k * fl];
}

/* ------------------------------------------------------------------------ */
/* Eyes                                                                     */

// Upper lid (u from inner -1 to outer +1) and lower lid profiles (v in half-heights).
const UPPER: Pts = [
  [-1.0, -0.2],
  [-0.62, -0.78],
  [-0.1, -1.0],
  [0.45, -0.94],
  [0.85, -0.66],
  [1.02, -0.4],
];
const LOWER: Pts = [
  [-1.0, 0.1],
  [-0.55, 0.72],
  [0.05, 0.9],
  [0.6, 0.78],
  [1.0, 0.32],
];

function profile(tab: Pts, u: number): number {
  if (u <= tab[0][0]) return tab[0][1];
  for (let i = 0; i < tab.length - 1; i++) {
    const a = tab[i];
    const b = tab[i + 1];
    if (u <= b[0]) {
      const t = (u - a[0]) / (b[0] - a[0]);
      // smoothstep-ish interpolation for roundness
      const s = t * t * (3 - 2 * t);
      return lerp(a[1], b[1], lerp(t, s, 0.5));
    }
  }
  return tab[tab.length - 1][1];
}

function upperV(u: number, p: EyeParams): number {
  const base = profile(UPPER, u) + p.tilt * -u * 0.32 + (p.tilt > 0 ? p.tilt * 0.12 : 0);
  const closed = 0.42 + 0.12 * (1 - u * u);
  const o = clamp(p.open, 0, 1.2);
  return o >= 1 ? base - (o - 1) * 0.5 * (1 - u * u * 0.5) : lerp(closed, base, o);
}

function lowerV(u: number, p: EyeParams): number {
  return profile(LOWER, u) - p.low * 0.55 * (1 - u * u * 0.6);
}

function ept(E: EyeGeom, u: number, v: number): P {
  return [E.x + E.dir * u * (E.w / 2), E.y + v * (E.h / 2)];
}

export function drawEye(dc: DrawCtx, r: Raster, E: EyeGeom, p: EyeParams, side: 'near' | 'far'): void {
  const sp = dc.spec;
  const s = r.scale;
  const pxH = E.h * s;
  const lashW = (sp.lashW ?? 1) * (sp.female ? 0.5 : 0.4);
  let shape = p.shape;
  let open = p.open;
  if (dc.o.eyeOpen !== undefined && shape === 'open') open = Math.min(open, dc.o.eyeOpen);
  if (dc.o.blink && (shape === 'open' || shape === 'arc')) shape = 'closed';
  if (shape === 'open' && open < 0.12) shape = 'closed';
  const lashInk = sp.lash;

  if (shape === 'closed') {
    const pts: P[] = [];
    for (let i = 0; i <= 8; i++) {
      const u = -1 + (i / 8) * 2.1;
      pts.push(ept(E, u, 0.42 + 0.22 * (1 - Math.min(1, u * u)) + p.tilt * -u * 0.1));
    }
    r.stroke(spline(pts, false, 3), E.h * lashW * 0.35, E.h * lashW * 0.75, lashInk);
    // lash flick
    r.stroke(
      spline([ept(E, 0.85, 0.5), ept(E, 1.15, 0.58), ept(E, 1.32, 0.8)], false, 3),
      E.h * lashW * 0.4,
      0.2,
      lashInk,
    );
    return;
  }
  if (shape === 'arc') {
    const pts: P[] = [];
    for (let i = 0; i <= 8; i++) {
      const u = -1 + (i / 8) * 2.05;
      pts.push(ept(E, u, 0.35 - 0.8 * Math.pow(1 - Math.min(1, u * u), 0.7)));
    }
    r.stroke(spline(pts, false, 3), E.h * lashW * 0.5, E.h * lashW * 0.7, lashInk);
    return;
  }
  if (shape === 'wince') {
    const pts: P[] = [ept(E, 1.05, -0.62), ept(E, -0.75, 0.02), ept(E, 1.05, 0.55)];
    r.stroke(spline(pts, false, 1), E.h * lashW * 0.6, E.h * lashW * 0.45, lashInk);
    return;
  }

  const pp: EyeParams = { ...p, open };
  // Eye white region
  const N = 14;
  const up: P[] = [];
  const lo: P[] = [];
  for (let i = 0; i <= N; i++) {
    const u = -1 + (2 * i) / N;
    up.push(ept(E, u, upperV(u, pp)));
    lo.push(ept(E, u, Math.max(upperV(u, pp) + 0.02, lowerV(u, pp))));
  }
  const white: number[] = [];
  for (const q of up) white.push(q[0], q[1]);
  for (let i = lo.length - 1; i >= 0; i--) white.push(lo[i][0], lo[i][1]);

  const scr = dc.L.scratch;
  scr.clear();
  scr.copyTransform(r);
  scr.poly(white, 1);
  r.poly(white, sp.sclera);

  const iris = dc.o.iris ?? sp.iris;
  r.with({ clip: scr }, () => {
    // sclera shadow under the lash
    const band: number[] = [];
    for (let i = 0; i <= N; i++) {
      const u = -1 + (2 * i) / N;
      const q = ept(E, u, upperV(u, pp) - 0.1);
      band.push(q[0], q[1]);
    }
    for (let i = N; i >= 0; i--) {
      const u = -1 + (2 * i) / N;
      const q = ept(E, u, upperV(u, pp) + 0.34);
      band.push(q[0], q[1]);
    }
    r.poly(band, sp.scleraShade);

    // iris
    const ir = p.iris * (sp.irisScale ?? 1);
    const icx = E.x + (dc.e.lookX * 0.32 + (side === 'far' ? 0.04 : 0)) * (E.w / 2);
    const icy = E.y + (0.06 + dc.e.lookY * 0.3) * (E.h / 2);
    const rx = 0.6 * (E.w / 2) * ir;
    const ry = 0.9 * (E.h / 2) * ir;
    r.ellipse(icx, icy, rx, ry, iris[0]);
    const ring = Math.min(0.9, 1 / s);
    const top = r.Y(icx, icy - ry);
    const bot = r.Y(icx, icy + ry);
    const grad: Ink = (x, y) => {
      const t = (y + 0.5 - top) / (bot - top);
      if (t < 0.3) return iris[0];
      if (t < 0.52) return ditherPick(iris[0], iris[1], (t - 0.3) / 0.22, x, y);
      if (t < 0.7) return iris[1];
      return ditherPick(iris[1], iris[2], (t - 0.7) / 0.18, x, y);
    };
    r.ellipse(icx, icy + ring * 0.3, rx - ring, ry - ring, grad);
    // pupil
    const prx = Math.max(rx * (sp.slit ? 0.16 : 0.4), 0.55 / s);
    const pry = Math.max(ry * (sp.slit ? 0.7 : 0.46), 0.8 / s);
    r.ellipse(icx, icy - ry * 0.06, prx, pry, sp.pupil);
    // lid shadow over the iris top
    const sh: number[] = [];
    for (let i = 0; i <= N; i++) {
      const u = -1 + (2 * i) / N;
      const q = ept(E, u, upperV(u, pp) - 0.1);
      sh.push(q[0], q[1]);
    }
    for (let i = N; i >= 0; i--) {
      const u = -1 + (2 * i) / N;
      const q = ept(E, u, upperV(u, pp) + 0.42);
      sh.push(q[0], q[1]);
    }
    const map: Record<number, number> = { [iris[1]]: iris[0], [iris[2]]: iris[1] };
    if (pxH > 11) r.poly(sh, mapInk(r, map));
    // highlights
    const hl = dc.o.eyeGlow ?? C.white;
    const hrx = Math.max(rx * 0.3, 0.5 / s);
    const hry = Math.max(ry * 0.25, 0.5 / s);
    r.ellipse(icx - rx * 0.36, icy - ry * 0.3, hrx, hry, hl, -0.5);
    if (pxH > 9)
      r.ellipse(
        icx + rx * 0.4,
        icy + ry * 0.42,
        Math.max(rx * 0.14, 0.5 / s),
        Math.max(ry * 0.1, 0.5 / s),
        C.white,
      );
    if (pxH > 20) {
      // tiny sparkle
      r.ellipse(
        icx + rx * 0.05,
        icy - ry * 0.55,
        Math.max(rx * 0.08, 0.5 / s),
        Math.max(ry * 0.06, 0.5 / s),
        C.white,
      );
    }
  });

  // upper lash (thick, flicked at the outer corner)
  const th = (u: number): number =>
    lashW * (0.45 + (sp.female ? 0.75 : 0.45) * clamp((u + 1) / 2, 0, 1) ** 1.3);
  const lash: number[] = [];
  const M = 16;
  for (let i = 0; i <= M; i++) {
    const u = -1.06 + (2.06 * i) / M;
    const q = ept(E, u, upperV(u, pp) - th(u) - 0.05);
    lash.push(q[0], q[1]);
  }
  const wing = ept(E, sp.female ? 1.34 : 1.2, upperV(1, pp) + (sp.female ? 0.08 : -0.05));
  lash.push(wing[0], wing[1]);
  for (let i = M; i >= 0; i--) {
    const u = -1.06 + (2.06 * i) / M;
    const q = ept(E, u, upperV(u, pp) + 0.12);
    lash.push(q[0], q[1]);
  }
  r.poly(lash, lashInk);
  // lower lash hint
  const ll: P[] = [];
  for (let i = 0; i <= 5; i++) {
    const u = 0.15 + (0.85 * i) / 5;
    ll.push(ept(E, u, lowerV(u, pp) + 0.08));
  }
  r.stroke(spline(ll, false, 2), 0.35, 0.6, sp.female ? lashInk : sp.mouthLine, 1);
  // crease
  if (pxH > 12) {
    const cr: P[] = [];
    for (let i = 0; i <= 5; i++) {
      const u = -0.35 + (1.15 * i) / 5;
      cr.push(ept(E, u, upperV(u, pp) - th(u) - 0.42));
    }
    r.stroke(spline(cr, false, 2), 0.3, 0.3, sp.mouthLine, 1);
  }
}

function ditherPick(a: number, b: number, t: number, x: number, y: number): number {
  return bayer(x, y) < t ? b : a;
}

export function drawBrow(dc: DrawCtx, r: Raster, E: EyeGeom, b: BrowParams): void {
  const sp = dc.spec;
  const by = -1.72;
  const pts: P[] = [
    ept(E, -0.9, by + b.inner * 0.9 + 0.05),
    ept(E, 0.05, by - 0.28 + b.mid * 0.7),
    ept(E, 1.05, by + 0.12 + b.outer * 0.8),
  ];
  const w = sp.female ? 1.5 : 2.1;
  r.stroke(spline(pts, false, 4), w, w * 0.35, sp.brow, 1);
}

/* ------------------------------------------------------------------------ */
/* Mouth                                                                    */

export function drawMouth(dc: DrawCtx, r: Raster, shape: MouthShape): void {
  const g = dc.g;
  const sp = dc.spec;
  const x = g.mouthX;
  const y = g.mouthY;
  const L = sp.mouthLine;
  const s = r.scale;
  const inside = C.darkRed;
  const tongue = C.pink;
  const outline = (pts: number[]): void => {
    r.line([...pts, pts[0], pts[1]], L);
  };
  const filled = (
    pts: readonly P[],
    opts: { teethTop?: boolean; teethBot?: boolean; tongue?: boolean } = {},
  ): void => {
    const f = spline(pts, true, 4);
    r.poly(f, inside);
    const ys = pts.map((p) => p[1]);
    const top = Math.min(...ys);
    const bot = Math.max(...ys);
    const scr = dc.L.scratch;
    scr.clear();
    scr.copyTransform(r);
    scr.poly(f, 1);
    r.with({ clip: scr }, () => {
      if (opts.tongue) r.ellipse(x + 0.4, bot, 2.4, (bot - top) * 0.45, tongue);
      if (opts.teethTop)
        r.poly(
          [
            x - 6,
            top - 1,
            x + 6,
            top - 1,
            x + 6,
            top + Math.max(0.9, 1.1 / s),
            x - 6,
            top + Math.max(0.9, 1.1 / s),
          ],
          C.white,
        );
      if (opts.teethBot)
        r.poly(
          [
            x - 6,
            bot + 1,
            x + 6,
            bot + 1,
            x + 6,
            bot - Math.max(0.8, 1 / s),
            x - 6,
            bot - Math.max(0.8, 1 / s),
          ],
          C.white,
        );
    });
    outline(f);
  };
  switch (shape) {
    case 'line':
      r.stroke(
        spline(
          [
            [x - 2.1, y - 0.1],
            [x + 0.2, y + 0.25],
            [x + 2.0, y - 0.05],
          ],
          false,
          3,
        ),
        0.7,
        0.5,
        L,
        1,
      );
      break;
    case 'smile':
      r.stroke(
        spline(
          [
            [x - 3, y - 0.9],
            [x, y + 0.6],
            [x + 2.8, y - 1.0],
          ],
          false,
          4,
        ),
        0.7,
        0.6,
        L,
        1,
      );
      break;
    case 'set':
      r.stroke(
        spline(
          [
            [x - 2.4, y + 0.4],
            [x, y - 0.1],
            [x + 2.2, y + 0.45],
          ],
          false,
          3,
        ),
        0.8,
        0.6,
        L,
        1,
      );
      break;
    case 'frown':
      r.stroke(
        spline(
          [
            [x - 2.4, y + 0.8],
            [x, y - 0.4],
            [x + 2.2, y + 0.7],
          ],
          false,
          4,
        ),
        0.7,
        0.6,
        L,
        1,
      );
      break;
    case 'smirk':
      r.stroke(
        spline(
          [
            [x - 2.4, y + 0.1],
            [x + 0.6, y + 0.3],
            [x + 2.6, y - 0.8],
            [x + 3.4, y - 1.8],
          ],
          false,
          4,
        ),
        0.7,
        0.6,
        L,
        1,
      );
      break;
    case 'open':
      filled(
        [
          [x - 2.3, y - 0.8],
          [x + 2.3, y - 0.9],
          [x + 1.2, y + 1.6],
          [x - 0.9, y + 1.7],
        ],
        { tongue: true },
      );
      break;
    case 'wobble':
      filled(
        [
          [x - 2.0, y + 0.2],
          [x, y - 0.8],
          [x + 2.0, y + 0.1],
          [x + 1, y + 1.6],
          [x - 1, y + 1.6],
        ],
        { tongue: true },
      );
      break;
    case 'grin':
      filled(
        [
          [x - 3.8, y - 1.2],
          [x + 3.6, y - 1.4],
          [x + 2.2, y + 2.0],
          [x + 0.2, y + 3.0],
          [x - 2.1, y + 2.0],
        ],
        { tongue: true },
      );
      break;
    case 'o':
      filled([
        [x, y - 1.2],
        [x + 1.4, y + 0.5],
        [x, y + 2.0],
        [x - 1.4, y + 0.5],
      ]);
      break;
    case 'obig':
      filled(
        [
          [x, y - 1.6],
          [x + 2, y + 0.6],
          [x, y + 3.2],
          [x - 2, y + 0.6],
        ],
        { tongue: true },
      );
      break;
    case 'teeth':
      filled(
        [
          [x - 3.3, y - 1.0],
          [x + 3.3, y - 1.3],
          [x + 3.0, y + 1.3],
          [x - 3.1, y + 1.4],
        ],
        { teethTop: true, teethBot: true },
      );
      break;
    case 'shout':
      filled(
        [
          [x - 3.6, y - 1.6],
          [x + 3.4, y - 1.8],
          [x + 2.4, y + 2.6],
          [x - 2.6, y + 2.8],
        ],
        { teethTop: true, tongue: true },
      );
      break;
    case 'grimace':
      filled(
        [
          [x - 3.3, y - 0.2],
          [x + 3.2, y - 1.5],
          [x + 3.0, y + 0.6],
          [x - 3.0, y + 1.2],
        ],
        { teethTop: true, teethBot: true },
      );
      break;
    case 'grimaceOpen':
      filled(
        [
          [x - 3.3, y - 0.5],
          [x + 3.2, y - 1.7],
          [x + 2.6, y + 1.8],
          [x - 2.6, y + 2.2],
        ],
        { teethTop: true, teethBot: true },
      );
      break;
    case 'smirkOpen':
      filled(
        [
          [x - 2.2, y - 0.2],
          [x + 3.4, y - 1.8],
          [x + 2.2, y + 1.3],
          [x - 0.8, y + 1.1],
        ],
        { teethTop: true },
      );
      break;
    case 'cruel':
      filled(
        [
          [x - 3.4, y - 0.8],
          [x + 3.8, y - 2.2],
          [x + 2.4, y + 1.5],
          [x - 1.6, y + 1.2],
        ],
        { teethTop: true },
      );
      break;
  }
}

/* ------------------------------------------------------------------------ */
/* Common body parts                                                        */

export function drawNeck(dc: DrawCtx, width = 8.2, bottom = 86): void {
  const r = dc.L.body;
  const cx = lerp(49.5, 48.5, dc.g.T);
  r.poly(
    spline(
      [
        [cx - width, 56],
        [cx + width, 56],
        [cx + width * 1.02, 74],
        [cx + width * 1.4, bottom],
        [cx - width * 1.4, bottom],
        [cx - width * 1.02, 74],
      ],
      true,
      3,
    ),
    dc.spec.skin,
  );
}

/** Standard shoulders / torso silhouette (flat, for clothing specs to fill). */
export function torsoPts(dc: DrawCtx, broad = 1, top = 78): number[] {
  const T = dc.g.T;
  const k = (x: number): number => 50 + (x - 50) * broad * (x > 50 ? 1 - 0.08 * T : 1);
  return spline(
    [
      [k(40), top],
      [k(22), top + 6],
      [k(9), top + 13],
      [k(4), top + 24],
      [k(2), 124],
      [k(98), 124],
      [k(96), top + 24],
      [k(91), top + 13],
      [k(78), top + 6],
      [k(60), top],
    ],
    true,
    4,
  );
}

/* ------------------------------------------------------------------------ */
/* Render pipeline                                                          */

export function makeLayers(w: number, h: number, like: Raster): Layers {
  const mk = (): Raster => new Raster(w, h).copyTransform(like);
  return { back: mk(), body: mk(), head: mk(), feat: mk(), front: mk(), over: mk(), scratch: mk() };
}

/**
 * Render a bust into `out` (whose transform maps design space to pixels).
 * Returns the layers (already composited into `out`).
 */
export function renderBust(out: Raster, spec: Spec, expr: Expression, o: BustOpts = {}): Layers {
  const L = makeLayers(out.w, out.h, out);
  let e = exprParams(expr, spec.happyEyes);
  if (spec.tweak) e = spec.tweak(expr, e);
  const g = faceGeom(spec.shape);
  const dc: DrawCtx = {
    L,
    spec,
    e,
    expr,
    g,
    o,
    wx: o.windX ?? 0,
    wy: o.windY ?? 0,
    phase: o.phase ?? 0,
    variant: o.variant ?? '',
  };
  const s = out.scale;

  if (o.eyesOnly) {
    // only the eyes (for eye-opening animations); returned in L.feat, not composited
    drawEye(dc, L.feat, g.near, e.near, 'near');
    drawEye(dc, L.feat, g.far, e.far, 'far');
    return L;
  }

  spec.back?.(dc);
  if (!o.noBody) spec.body(dc);

  // head
  const head = L.head;
  head.poly(g.face, spec.skin);
  if (!spec.noEar) {
    const [ex, ey] = g.ear;
    head.ellipse(ex - 0.5, ey, 3.2, 5.2, spec.skin, 0.15);
    head.stroke(
      spline(
        [
          [ex - 1.5, ey - 3],
          [ex - 2.2, ey],
          [ex - 1.2, ey + 2.8],
        ],
        false,
        3,
      ),
      0.6,
      0.6,
      spec.skinShade,
      1,
    );
  }
  // far side face shadow (cel crescent)
  head.with({ only: spec.skin }, () => {
    const shifted = g.face.map((v, i) => (i % 2 === 0 ? v - 2.6 : v + 0.8));
    const scr = L.scratch;
    scr.clear();
    scr.copyTransform(head);
    scr.poly(shifted, 1);
    const inv = (x: number, y: number): number => (scr.data[y * scr.w + x] ? spec.skin : spec.skinShade);
    head.poly(g.face, inv);
  });
  spec.headExtra?.(dc);

  spec.front(dc);

  // cast shadows: hair on forehead, head on neck
  head.castShadow(L.front, 0.6 * s, 2.4 * s, dither(spec.skin, spec.skinShade, 1), spec.skin);
  const chinMask = L.scratch;
  chinMask.clear();
  chinMask.over(head);
  chinMask.over(L.front);
  L.body.castShadow(chinMask, 0.4 * s, 3.6 * s, spec.skinShade, spec.skin);

  // features
  const f = L.feat;
  f.copyTransform(out);
  drawFeatures(dc);

  // brows are drawn over the hair (anime convention)
  if (spec.brows) spec.brows(dc);
  else {
    drawBrow(dc, L.over, g.near, e.browNear);
    drawBrow(dc, L.over, g.far, e.browFar);
  }
  const mouthLayer = spec.beard ? L.over : L.feat;
  drawMouth(dc, mouthLayer, o.mouth ?? (o.talking ? e.talk : e.mouth));
  spec.over?.(dc);
  if (!o.noMarks) drawMarks(dc);

  // outlines
  L.back.outline(spec.backLine ?? spec.hairLine);
  L.body.outline(spec.clothLine);
  head.outline(spec.skinLine);
  L.front.outline(spec.hairLine);

  out.over(L.back);
  out.over(L.body);
  out.over(head);
  out.over(f);
  out.over(L.front);
  out.over(L.over);
  return L;
}

function drawFeatures(dc: DrawCtx): void {
  const { g, e, spec, L } = dc;
  const f = L.feat;
  // blush under the eyes
  if (e.blush > 0) {
    const bl = dither(spec.skin, C.blush, 0.35 + e.blush * 0.4);
    L.head.with({ only: spec.skin }, () => {
      L.head.ellipse(g.near.x - 1.5, g.eyeY + 9.5, 4.8, 1.9, bl);
      L.head.ellipse(g.far.x + 1.5, g.eyeY + 9.5, 3.4, 1.7, bl);
    });
  }
  // nose
  const nx = g.noseX;
  const ny = g.noseY;
  L.head.with({ only: spec.skin }, () => {
    L.head.stroke([nx + 0.2, ny - 2.8, nx + 0.9, ny - 0.3], 0.8, 0.8, spec.skinShade, 1);
  });
  f.stroke([nx - 0.4, ny + 0.2, nx + 0.5, ny + 0.1], 0.5, 0.5, spec.mouthLine, 1);
  // eyes
  drawEye(dc, f, g.near, e.near, 'near');
  drawEye(dc, f, g.far, e.far, 'far');
  spec.featExtra?.(dc);
}

function drawMarks(dc: DrawCtx): void {
  const { g, e, L, spec } = dc;
  const r = L.over;
  if (e.sweat) {
    const x = 75;
    const y = 35;
    outlinedMark(dc, C.sky, (m) => {
      m.poly(
        strand(
          [
            [x + 0.4, y + 6],
            [x, y + 3],
            [x - 0.2, y - 1],
          ],
          3.6,
          { pow: 0.6 },
        ),
        C.white,
      );
      m.ellipse(x + 0.3, y + 5.4, 1.9, 1.8, C.white);
      m.with({ self: true }, () => m.ellipse(x + 0.9, y + 5.8, 1.1, 1.1, C.lightGray));
    });
  }
  if (e.tears && !dc.o.blink) {
    const frozen = spec.id === 'seraphine';
    for (const [E, p] of [
      [g.near, e.near],
      [g.far, e.far],
    ] as const) {
      if (p.shape !== 'open') continue;
      // welling tear along the lower lid
      const ll: P[] = [];
      for (let i = 0; i <= 6; i++) {
        const u = -0.55 + (1.35 * i) / 6;
        ll.push(ept(E, u, lowerV(u, p) - 0.12));
      }
      L.feat.stroke(spline(ll, false, 2), 0.5, 0.5, frozen ? C.ice1 : C.white, 1);
      const tx = E.x + E.dir * E.w * 0.42;
      const ty = E.y + E.h * 0.5;
      if (frozen) {
        outlinedMark(dc, C.ice3, (m) => {
          m.poly([tx, ty + 1, tx + 1.4, ty + 3.4, tx, ty + 6.4, tx - 1.4, ty + 3.4], C.ice1);
          m.with({ self: true }, () => m.poly([tx, ty + 1, tx + 1.4, ty + 3.4, tx, ty + 3.8], C.ice0));
        });
      } else {
        outlinedMark(dc, C.sky, (m) => {
          m.poly(
            strand(
              [
                [tx, ty + 4.2],
                [tx, ty + 2.6],
                [tx - 0.1 * E.dir, ty + 0.6],
              ],
              2.6,
              { pow: 0.6 },
            ),
            C.white,
          );
          m.ellipse(tx, ty + 3.9, 1.3, 1.3, C.white);
        });
      }
    }
  }
  if (e.glint && !dc.o.blink) {
    const E = g.far;
    const x = E.x + E.w * 0.62;
    const y = E.y - E.h * 0.45;
    sparkle(r, x, y, 3.2, C.white);
  }
  if (e.scratch) {
    const x = g.near.x - 2;
    const y = g.eyeY + 12;
    L.head.with({ only: spec.skin }, () => {
      L.head.stroke([x - 3, y - 1.5, x + 1.5, y + 1], 0.7, 0.5, C.red, 1);
      L.head.stroke([x - 2, y + 0.8, x + 2, y + 3], 0.7, 0.5, C.red, 1);
    });
    // head already composited order: marks drawn in head layer before composite
  }
}

/** Draw something into a temp layer, outline it, and put it on the `over` layer. */
export function outlinedMark(dc: DrawCtx, line: Ink, fn: (m: Raster) => void): void {
  const m = new Raster(dc.L.over.w, dc.L.over.h).copyTransform(dc.L.over);
  fn(m);
  m.outline(line);
  dc.L.over.over(m);
}

/** Four-point sparkle (design units). */
export function sparkle(r: Raster, x: number, y: number, size: number, ink: Ink): void {
  r.poly(
    [
      x,
      y - size,
      x + size * 0.22,
      y - size * 0.22,
      x + size,
      y,
      x + size * 0.22,
      y + size * 0.22,
      x,
      y + size,
      x - size * 0.22,
      y + size * 0.22,
      x - size,
      y,
      x - size * 0.22,
      y - size * 0.22,
    ],
    ink,
  );
}

export { splinePts };
