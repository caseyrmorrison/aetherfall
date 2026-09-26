/**
 * Solenne scenery shared by the Act II illustrations: the eclipsed "black sun"
 * (corona + disc), the white sandstone city (drawn in daylight colors; scenes
 * relight it through LUTs such as DUSK), ships, palms and the Dusk Shard.
 * Everything here works in pixel space (transform reset to identity).
 */
import { C } from '../pal';
import { Raster, bayer, type Ink } from '../raster';
import { rng, spline, type P } from '../geom';
import { lut } from './kit';

/** Eclipse-dusk lighting: the white city under a black sun (cool, dim, violet shadows). */
export const DUSK = lut((i) => {
  const m: Record<number, number> = {
    [C.white]: C.gray,
    [C.sand]: C.slate,
    [C.tan]: C.purple,
    [C.brown]: C.plum,
    [C.darkBrown]: C.black,
    [C.plum]: C.black,
    [C.lightGray]: C.gray,
    [C.gray]: C.slate,
    [C.slate]: C.darkSlate,
    [C.darkSlate]: C.navy,
    [C.navy]: C.black,
    [C.yellow]: C.gold,
    [C.gold]: C.orange,
    [C.orange]: C.rust,
    [C.rust]: C.darkRed,
    [C.sky]: C.blue,
    [C.blue]: C.navy,
    [C.cyan]: C.sky,
    [C.red]: C.darkRed,
    [C.darkRed]: C.plum,
    [C.green]: C.darkGreen,
    [C.darkGreen]: C.forest,
    [C.forest]: C.deepTeal,
    [C.deepTeal]: C.black,
    [C.pink]: C.magenta,
    [C.magenta]: C.purple,
  };
  return m[i] ?? i;
});

/** Keep existing pixels where the dither says so (for soft overlays inside a raster). */
function keep(r: Raster, col: number, level: number): Ink {
  return (x, y) => (bayer(x, y) < level ? col : r.data[y * r.w + x]);
}

/* ------------------------------------------------------------- black sun */

/**
 * Corona streamers, the bright inner ring and the black disc (pixel space).
 * `ph` in [0, 1) animates the streamer lengths (flicker). With `disc` false
 * the moon is left out (the sun's face stays white) so it can move separately.
 */
export function corona(
  r: Raster,
  cx: number,
  cy: number,
  R: number,
  ph: number,
  seed = 5,
  rays = 22,
  disc = true,
): void {
  r.setTransform(1, 0, 0);
  const rand = rng(seed);
  const TAU = Math.PI * 2;
  const spike = (a: number, r0: number, r1: number, wd: number, ink: Ink): void =>
    r.fillPx(
      [
        cx + Math.cos(a - wd) * r0,
        cy + Math.sin(a - wd) * r0,
        cx + Math.cos(a) * r1,
        cy + Math.sin(a) * r1,
        cx + Math.cos(a + wd) * r0,
        cy + Math.sin(a + wd) * r0,
      ],
      ink,
    );
  const list: [number, number, number][] = [];
  for (let k = 0; k < rays; k++) {
    const a = (k / rays) * TAU + (rand() - 0.5) * 0.22;
    const base = 0.9 + rand() * 1.4;
    const fl = 0.8 + 0.2 * Math.sin(ph * TAU + k * 1.7) + 0.08 * Math.sin(ph * TAU * 2 + k * 0.9);
    list.push([a, R * base * fl, 0.045 + rand() * 0.05]);
  }
  for (const [a, len, wd] of list) spike(a, R * 0.9, R + len * 1.25, wd * 1.5, keep(r, C.orange, 0.5));
  for (const [a, len, wd] of list) spike(a, R * 0.9, R + len, wd, keep(r, C.gold, 0.75));
  for (const [a, len, wd] of list) spike(a, R * 0.9, R + len * 0.55, wd * 0.8, C.yellow);
  for (const [a, len, wd] of list) spike(a, R * 0.9, R + len * 0.25, wd * 0.6, C.white);
  // bright inner ring
  r.discPx(cx, cy, R + 4, keep(r, C.yellow, 0.6));
  r.discPx(cx, cy, R + 2.4, C.yellow);
  r.discPx(cx, cy, R + 1.2, C.white);
  if (!disc) {
    r.discPx(cx, cy, R, C.white);
    return;
  }
  // the disc, with a faint violet sheen
  r.discPx(cx, cy, R, C.black);
  r.with({ only: C.black }, () => {
    r.discPx(cx - R * 0.2, cy - R * 0.25, R * 0.72, keep(r, C.void0, 0.35));
    r.discPx(cx - R * 0.28, cy - R * 0.32, R * 0.4, keep(r, C.void0, 0.6));
  });
  // "diamond ring" bead flickering on the rim
  const ba = -0.75 + Math.sin(ph * TAU) * 0.05;
  const bx = cx + Math.cos(ba) * (R + 0.5);
  const by = cy + Math.sin(ba) * (R + 0.5);
  r.discPx(bx, by, 2.2 + (ph < 0.5 ? 0.6 : 0), C.white);
  r.fillPx([bx - 7, by, bx, by - 0.8, bx + 7, by, bx, by + 0.8], C.white);
  r.fillPx([bx, by - 7, bx + 0.8, by, bx, by + 7, bx - 0.8, by], C.white);
}

/* ---------------------------------------------------------------- city */

const ROOF = C.white;
const WALL = C.sand;
const SIDE = C.tan;
const HOLE = C.darkBrown;

export interface Lamp {
  x: number;
  y: number;
}

export interface CityRow {
  /** Ground line of the row (pixels). */
  y: number;
  /** Building scale (≈ pixels per unit). */
  s: number;
  x0: number;
  x1: number;
}

/** Oblique box: front face, roof and left side receding up-left (light from the upper right). */
export function box(r: Raster, x: number, top: number, w: number, h: number, d: number): void {
  const by = top + h;
  const hd = d * 0.5;
  r.fillPx([x, top, x - d, top - hd, x - d, by - hd, x, by], SIDE);
  r.fillPx([x, top, x + w, top, x + w - d, top - hd, x - d, top - hd], ROOF);
  r.rectPx(x, top, w, h, WALL);
  if (w > 6) r.rectPx(x, top, w, 1, ROOF);
  if (d >= 2) r.px(x - 1, by - 1, C.brown);
}

type DomePal = 'white' | 'blue' | 'gold';

const DOME: Record<DomePal, [number, number, number]> = {
  white: [C.white, C.sand, C.tan],
  blue: [C.cyan, C.sky, C.blue],
  gold: [C.yellow, C.gold, C.orange],
};

/** Onion-ish dome standing on (cx, by), lit from the right. */
export function dome(r: Raster, cx: number, by: number, rx: number, pal: DomePal, ry = rx * 1.05): void {
  const [lit, mid, dark] = DOME[pal];
  const ink: Ink = (x, y) => {
    const u = (x + 0.5 - cx) / rx + (bayer(x, y) - 0.5) * 0.35;
    const v = (by - y) / ry;
    if (u > 0.2 - v * 0.2) return lit;
    return u > -0.45 ? mid : dark;
  };
  const y0 = Math.floor(by - ry);
  for (let y = y0; y <= by; y++) {
    const v = (by - (y + 0.5)) / ry;
    if (v < 0) continue;
    // slight onion profile: widest a bit above the base
    const k = Math.sqrt(Math.max(0, 1 - v * v)) * (1 + 0.12 * Math.sin(v * Math.PI));
    const hw = rx * k;
    r.span(y, Math.round(cx - hw), Math.round(cx + hw) - 1, ink);
  }
  // finial
  const ft = Math.max(2, Math.round(ry * 0.35));
  r.rectPx(Math.round(cx) - 0.5, y0 - ft, 1, ft, C.gold);
  r.px(cx, y0 - ft - 1, C.yellow);
}

function windows(
  r: Raster,
  rand: () => number,
  x: number,
  top: number,
  w: number,
  h: number,
  s: number,
  lamps: Lamp[],
): void {
  if (s < 0.45 || h < 5) return;
  const ww = Math.max(1, Math.round(1.4 * s));
  const wh = Math.max(1, Math.round(2.2 * s));
  const sx = Math.max(ww + 2, Math.round(4 * s));
  const sy = Math.max(wh + 2, Math.round(5 * s));
  for (let yy = top + Math.max(2, Math.round(2 * s)); yy + wh < top + h - 1; yy += sy) {
    for (let xx = x + Math.max(1, Math.round(2 * s)); xx + ww < x + w - 1; xx += sx) {
      if (rand() < 0.35) continue;
      r.rectPx(xx, yy, ww, wh, HOLE);
      if (s > 0.7 && wh > 2) r.px(xx, yy, C.plum);
      if (rand() < 0.22) lamps.push({ x: xx + (ww >> 1), y: yy + (wh >> 1) });
    }
  }
}

/** A tall slender tower (minaret) with a balcony and a small dome or spire. */
function tower(r: Raster, rand: () => number, x: number, by: number, s: number, lamps: Lamp[]): number {
  const w = Math.max(3, Math.round((4 + rand() * 2) * s));
  const h = Math.round((24 + rand() * 20) * s);
  const d = Math.max(1, Math.round(2 * s));
  const top = by - h;
  box(r, x, top, w, h, d);
  // slit windows
  for (let yy = top + Math.round(4 * s); yy < by - 4 * s; yy += Math.max(3, Math.round(7 * s)))
    r.rectPx(x + Math.floor(w / 2), yy, 1, Math.max(1, Math.round(2 * s)), HOLE);
  // balcony
  const bt = top + Math.round(4 * s);
  r.rectPx(x - 1, bt, w + 2, Math.max(1, Math.round(s)), ROOF);
  r.rectPx(x - 1, bt + Math.max(1, Math.round(s)), w + 2, 1, SIDE);
  if (rand() < 0.5) dome(r, x + w / 2 - d / 2, top - d * 0.25, w * 0.62, rand() < 0.5 ? 'gold' : 'white');
  else {
    r.fillPx([x - d, top, x + w, top, x + w / 2 - d / 2, top - Math.round(8 * s)], C.gold);
    r.fillPx([x - d, top, x + w / 2 - d / 2, top, x + w / 2 - d / 2, top - Math.round(8 * s)], C.orange);
  }
  if (rand() < 0.5) lamps.push({ x: x + Math.floor(w / 2), y: bt - 2 });
  return w + d;
}

/** Palm tree (pixel space): trunk from (x, by) leaning, feathery drooping fronds; `ph` sways. */
export function palm(
  r: Raster,
  x: number,
  by: number,
  hgt: number,
  lean: number,
  ph: number,
  cols: readonly [number, number, number, number] = [C.brown, C.darkBrown, C.darkGreen, C.forest],
): P {
  r.setTransform(1, 0, 0);
  const tx = x + lean;
  const ty = by - hgt;
  const trunk = spline(
    [
      [x, by],
      [x + lean * 0.15, by - hgt * 0.5],
      [tx, ty],
    ],
    false,
    6,
  );
  const tw = Math.max(1.4, hgt * 0.05);
  r.stroke(trunk, tw * 1.5, tw * 0.9, cols[1], 1);
  if (tw > 2)
    r.stroke(
      trunk.map((v, i) => (i % 2 === 0 ? v + tw * 0.25 : v)),
      tw * 0.6,
      tw * 0.35,
      cols[0],
      1,
    );
  // trunk rings
  if (hgt > 30)
    for (let i = 2; i < trunk.length - 4; i += 4) r.px(trunk[i] + tw * 0.3, trunk[i + 1], cols[1]);
  const L = hgt * 0.4;
  const fronds: [number, number, number][] = [
    [-3.0, 0.95, 0.9],
    [-2.55, 1, 0.65],
    [-2.05, 0.85, 0.45],
    [-1.5, 0.6, 0.3],
    [-1.0, 0.85, 0.45],
    [-0.5, 1, 0.65],
    [-0.05, 0.95, 0.9],
    [2.5, 0.6, 0.3],
    [0.65, 0.55, 0.3],
  ];
  fronds.forEach(([a0, lf, droop], k) => {
    const a = a0 + Math.sin(ph + k * 1.3) * 0.06;
    const len = L * lf;
    const d = droop + Math.sin(ph + k) * 0.06;
    const n = Math.max(4, Math.round(len / 3));
    const pts: P[] = [];
    for (let j = 0; j <= n; j++) {
      const u = j / n;
      pts.push([tx + Math.cos(a) * len * u, ty + Math.sin(a) * len * u * 0.8 + d * u * u * len]);
    }
    const col = k % 2 ? cols[3] : cols[2];
    r.stroke(spline(pts, false, 2), Math.max(1.2, hgt * 0.022), 1, col, 1);
    // leaflets hanging from the rib
    const lw = Math.max(2, len * 0.28);
    for (let j = 1; j < n; j++) {
      const u = j / n;
      const [px0, py0] = pts[j];
      const dx = pts[j + 1][0] - pts[j - 1][0];
      const dy = pts[j + 1][1] - pts[j - 1][1];
      const dl = Math.hypot(dx, dy) || 1;
      const ll = lw * Math.pow(1 - u, 0.6) * (0.7 + 0.3 * Math.sin(j * 2.1));
      for (const side of [-1, 1]) {
        const nx = (-dy / dl) * side * 0.6 + (dx / dl) * 0.35;
        const ny = (dx / dl) * side * 0.6 + 0.8;
        const nl = Math.hypot(nx, ny);
        r.linePx([px0, py0, px0 + (nx / nl) * ll, py0 + (ny / nl) * ll], col);
      }
    }
  });
  r.discPx(tx, ty, Math.max(1, hgt * 0.035), cols[1]);
  return [tx, ty];
}

/** One ordinary building; returns its footprint width (pixels). */
function building(r: Raster, rand: () => number, x: number, by: number, s: number, lamps: Lamp[]): number {
  if (rand() < 0.1) return tower(r, rand, x, by, s, lamps);
  const w = Math.max(4, Math.round((8 + rand() * 12) * s));
  const h = Math.max(3, Math.round((6 + rand() * 11) * s));
  const d = Math.max(1, Math.round((3 + rand() * 2) * s));
  const top = by - h;
  box(r, x, top, w, h, d);
  windows(r, rand, x, top, w, h, s, lamps);
  // arched door
  if (s >= 0.6 && w > 6) {
    const dx = x + Math.round(w * (0.2 + rand() * 0.5));
    const dw = Math.max(2, Math.round(2.4 * s));
    const dh = Math.max(3, Math.round(4 * s));
    r.rectPx(dx, by - dh, dw, dh, HOLE);
    if (dw >= 3) r.rectPx(dx, by - dh, 1, 1, WALL);
  }
  const roll = rand();
  if (roll < 0.26) {
    const pal: DomePal = rand() < 0.45 ? 'white' : rand() < 0.6 ? 'blue' : 'gold';
    dome(r, x + w / 2 - d / 2, top - d * 0.25, Math.max(2, w * 0.34), pal);
  } else if (roll < 0.4 && s > 0.5) {
    // striped market awning
    const aw = Math.round(w * 0.6);
    const ax = x + Math.round((w - aw) / 2);
    const ay = by - Math.round(5 * s);
    for (let i = 0; i < aw; i++)
      r.rectPx(ax + i, ay, 1, Math.max(1, Math.round(1.6 * s)), (i >> 1) % 2 ? C.white : C.red);
    r.rectPx(ax, ay + Math.max(1, Math.round(1.6 * s)), aw, 1, C.darkRed);
  } else if (roll < 0.5 && s > 0.5) {
    // little rooftop stair hut
    const hw = Math.max(2, Math.round(w * 0.25));
    box(
      r,
      x + Math.round(w * 0.55) - d,
      top - Math.round(3 * s) - Math.round(d * 0.3),
      hw,
      Math.round(3 * s),
      1,
    );
  }
  return w + d;
}

/**
 * Rows of white sandstone buildings, drawn back (first row) to front. Within a
 * row buildings are laid out left→right but drawn right→left so gaps reveal
 * shaded side walls. Returns lamp positions (lit windows) for flicker overlays.
 */
export function city(r: Raster, seed: number, rows: readonly CityRow[], lamps: Lamp[] = []): Lamp[] {
  r.setTransform(1, 0, 0);
  const rand = rng(seed);
  for (const row of rows) {
    const plan: { x: number; by: number; seed: number; palm: boolean }[] = [];
    let x = row.x0 + rand() * 6 * row.s;
    while (x < row.x1) {
      const by = row.y + Math.round((rand() - 0.5) * 3 * row.s);
      const isPalm = rand() < 0.07 && row.s > 0.55;
      plan.push({ x: Math.round(x), by, seed: Math.floor(rand() * 1e9), palm: isPalm });
      x += isPalm ? 3 * row.s : (9 + rand() * 12) * row.s + rand() * 3 * row.s;
    }
    for (let i = plan.length - 1; i >= 0; i--) {
      const p = plan[i];
      const br = rng(p.seed);
      if (p.palm) palm(r, p.x, p.by, 20 * row.s + br() * 8 * row.s, (br() - 0.5) * 6 * row.s, p.seed);
      else building(r, br, p.x, p.by, row.s, lamps);
    }
  }
  return lamps;
}

/**
 * The Order's sanctum: colonnaded hall, great gold dome and a tall tower with
 * the round sun-window. (x, by) = left of the front face on the ground line.
 * Returns the round window's center.
 */
export function sanctum(r: Raster, x: number, by: number, s: number, lamps: Lamp[] = []): P {
  r.setTransform(1, 0, 0);
  const w = Math.round(56 * s);
  const h = Math.round(22 * s);
  const d = Math.round(9 * s);
  const top = by - h;
  // tower behind the hall (right)
  const tw = Math.round(10 * s);
  const th = Math.round(84 * s);
  const tx = x + w - Math.round(8 * s);
  box(r, tx, by - th, tw, th, Math.round(4 * s));
  const wy = by - th + Math.round(14 * s);
  const wcx = tx + tw / 2;
  r.discPx(wcx, wy, 3.6 * s, C.gold);
  r.discPx(wcx, wy, 2.6 * s, C.plum);
  lamps.push({ x: Math.round(wcx), y: Math.round(wy) });
  for (let yy = wy + Math.round(8 * s); yy < by - h; yy += Math.round(8 * s))
    r.rectPx(Math.round(wcx) - 1, yy, 2, Math.round(3 * s), HOLE);
  // spire
  const sp = by - th;
  r.fillPx([tx - 4 * s, sp, tx + tw, sp, wcx - 2 * s, sp - 22 * s], C.gold);
  r.fillPx([tx - 4 * s, sp, wcx - 2 * s, sp, wcx - 2 * s, sp - 22 * s], C.orange);
  r.px(wcx - 2 * s, sp - 22 * s - 1, C.yellow);
  // hall
  box(r, x, top, w, h, d);
  // colonnade
  const ct = top + Math.round(6 * s);
  r.rectPx(x + 2, ct, w - 4, by - ct, HOLE);
  for (let cx = x + 3; cx < x + w - 3; cx += Math.max(3, Math.round(5 * s)))
    r.rectPx(cx, ct, Math.max(1, Math.round(2 * s)), by - ct, WALL);
  r.rectPx(x, ct - 1, w, Math.max(1, Math.round(1.5 * s)), ROOF);
  // pediment frieze in gold
  r.rectPx(x + 1, top + Math.round(2 * s), w - 2, 1, C.gold);
  // steps
  for (let k = 0; k < 3; k++) r.rectPx(x - 2 - k * 2, by + k, w + 4 + k * 4, 1, k % 2 ? SIDE : ROOF);
  // great gold dome with a drum
  const dcx = x + w * 0.45 - d / 2;
  const dty = top - d * 0.4;
  box(
    r,
    Math.round(dcx - 13 * s),
    Math.round(dty - 6 * s),
    Math.round(26 * s),
    Math.round(6 * s),
    Math.round(3 * s),
  );
  dome(r, dcx, dty - 6 * s, 15 * s, 'gold', 16 * s);
  // ribs
  for (const u of [-0.5, 0, 0.5])
    r.linePx(
      [dcx + u * 15 * s, dty - 6 * s, dcx + u * 6 * s, dty - 6 * s - 14 * s],
      u > 0.2 ? C.gold : C.orange,
    );
  return [wcx, wy];
}

/** Small merchant ship at anchor (pixel space, waterline at y). */
export function ship(r: Raster, x: number, y: number, s: number, flip = false, masts = 2): void {
  r.setTransform(1, 0, 0);
  const f = flip ? -1 : 1;
  const X = (u: number): number => x + u * s * f;
  r.fillPx([X(-11), y - 3 * s, X(12), y - 4.5 * s, X(8), y + 1, X(-8), y + 1], C.darkBrown);
  r.fillPx([X(-11), y - 3 * s, X(12), y - 4.5 * s, X(11.5), y - 3.5 * s, X(-10.5), y - 2 * s], C.brown);
  r.rectPx(Math.min(X(-9), X(-4)), y - 5 * s, 5 * s, 2 * s, C.tan);
  for (let m = 0; m < masts; m++) {
    const mx = Math.round(X(-2 + m * 8));
    const mh = Math.round((18 - m * 3) * s);
    r.rectPx(mx, y - 3 * s - mh, 1, mh, C.darkBrown);
    for (let k = 0; k < 2; k++) {
      const yy = Math.round(y - 3 * s - mh + (3 + k * 6) * s);
      r.rectPx(mx - Math.round(4 * s), yy, Math.round(8 * s) + 1, Math.max(1, Math.round(1.2 * s)), C.sand);
    }
    r.rectPx(mx, y - 3 * s - mh - 2, Math.round(3 * s), 2, C.red);
  }
}

/** Lighthouse on the breakwater (pixel space). Returns the lamp position. */
export function lighthouse(r: Raster, x: number, by: number, s: number): P {
  r.setTransform(1, 0, 0);
  const h = 40 * s;
  const w0 = 7 * s;
  const w1 = 4.5 * s;
  const top = by - h;
  const ink: Ink = (px) => (px + 0.5 > x + w1 * 0.1 ? ROOF : px + 0.5 > x - w1 * 0.5 ? WALL : SIDE);
  r.fillPx([x - w0, by, x + w0, by, x + w1, top, x - w1, top], ink);
  for (const k of [0.3, 0.62])
    r.rectPx(x - w0 + (w0 - w1) * k, by - h * k - 2 * s, (w0 - (w0 - w1) * k) * 2, 2 * s, C.gold);
  r.rectPx(x - w1 - 1, top - 1, w1 * 2 + 2, 2, C.darkBrown);
  r.rectPx(x - w1 * 0.7, top - 6 * s, w1 * 1.4, 5 * s, C.plum);
  r.fillPx([x - w1 - 1, top - 6 * s, x + w1 + 1, top - 6 * s, x, top - 11 * s], C.darkRed);
  return [x, top - 3.5 * s];
}

/* ---------------------------------------------------------- dusk shard */

/**
 * The Dusk Shard: an elongated dark crystal with violet facets, gold veins and
 * a gold rim light (pixel space). H = half-height, W = half-width.
 */
export function duskShard(r: Raster, cx: number, cy: number, H: number, W: number, seed = 3): void {
  r.setTransform(1, 0, 0);
  const top: P = [cx + W * 0.1, cy - H];
  const bot: P = [cx - W * 0.05, cy + H * 0.9];
  const L: P = [cx - W, cy - H * 0.05];
  const FL: P = [cx - W * 0.3, cy + H * 0.1];
  const FR: P = [cx + W * 0.4, cy + H * 0.05];
  const R: P = [cx + W, cy - H * 0.12];
  const tri = (a: P, b: P, c: P, ink: Ink): void => r.fillPx([a[0], a[1], b[0], b[1], c[0], c[1]], ink);
  tri(top, L, FL, C.purple);
  tri(top, FL, FR, C.magenta);
  tri(top, FR, R, C.void0);
  tri(bot, L, FL, C.void0);
  tri(bot, FL, FR, C.purple);
  tri(bot, FR, R, C.black);
  r.with({ self: true }, () => {
    // inner dusk glow (dithered)
    r.fillPx(
      [
        cx - W * 0.25,
        cy - H * 0.35,
        cx + W * 0.15,
        cy - H * 0.5,
        cx + W * 0.3,
        cy + H * 0.1,
        cx - W * 0.1,
        cy + H * 0.5,
      ],
      keep(r, C.pink, 0.3),
    );
    // gold veins
    const rand = rng(seed);
    for (let i = 0; i < 4; i++) {
      let x = cx + (rand() - 0.5) * W * 0.6;
      let y = cy + (rand() - 0.5) * H * 0.8;
      let a = rand() * Math.PI * 2;
      const pts: number[] = [x, y];
      for (let k = 0; k < 5; k++) {
        a += (rand() - 0.5) * 1.3;
        x += Math.cos(a) * H * 0.12;
        y += Math.sin(a) * H * 0.12;
        pts.push(x, y);
      }
      r.linePx(pts, i % 2 ? C.gold : C.orange);
    }
    // facet edge highlights
    r.linePx([top[0], top[1], FL[0], FL[1]], C.pink);
    r.linePx([top[0], top[1], FR[0], FR[1]], C.magenta);
    r.linePx([FL[0], FL[1], bot[0], bot[1]], C.magenta);
  });
  r.outline(C.black);
  // gold rim light along the upper left edges
  r.linePx([L[0] - 1, L[1], top[0], top[1] - 1], C.gold);
  r.px(top[0], top[1] - 2, C.yellow);
}
