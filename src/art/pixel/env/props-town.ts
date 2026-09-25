/**
 * Town props: buildings (door at the bottom-centre of each image), fountain,
 * well, fences, lamp posts and market clutter.
 *
 * Building colliders cover the front wall and the lower part of the roof; the
 * top ~8px of each roof is left as walk-behind space so actors north of a
 * building are partly hidden by it. The door trigger belongs just below the anchor.
 */
import { PAL } from '../../palette';
import { R, cyl, def, foot, ink, type PropTable } from './kit';
import { Grid, bayer, mix, ramp, rnd, sphereLight, type Col } from './raster';

// ---------------------------------------------------------------- palettes --

type Ramp5 = readonly [Col, Col, Col, Col, Col];

const ROOF_RED: Ramp5 = [PAL.plum, '#7a1f2c', PAL.darkRed, '#c7303c', PAL.red];
const ROOF_BLUE: Ramp5 = [PAL.navy, '#173a6a', PAL.blue, '#1a6fb0', PAL.sky];
const ROOF_BROWN: Ramp5 = [PAL.plum, PAL.darkBrown, '#9a4a35', PAL.rust, PAL.orangeBrown];
const ROOF_SLATE: Ramp5 = [PAL.black, PAL.navy, PAL.darkSlate, '#4a5678', PAL.slate];
const ROOF_GREEN: Ramp5 = [PAL.deepTeal, '#1d4a3c', PAL.forest, '#2f7045', PAL.darkGreen];

const PLASTER = ['#b8916c', '#d4b48a', '#e6cc9f', PAL.sand] as const;
const TIMBER = [PAL.plum, PAL.darkBrown, '#8a4e3e'] as const;
const WOOD = R.wood;
const STONE = R.warmStone;

// ------------------------------------------------------------------ parts ---

/** Side-gabled roof seen from the front: ridge row y0, eave row y1, ends slant inwards. */
function roof(g: Grid, x0: number, x1: number, y0: number, y1: number, c: Ramp5, slant = 4): void {
  const H = y1 - y0;
  for (let y = y0; y <= y1; y++) {
    const inset = Math.round(((y1 - y) / H) * slant);
    const a = x0 + inset;
    const b = x1 - inset;
    for (let x = a; x <= b; x++) {
      const row = y - y0 - 2;
      const course = Math.floor(row / 3);
      const ly = ((row % 3) + 3) % 3;
      let col: Col;
      if (y === y0) col = c[4];
      else if (y === y0 + 1) col = c[1];
      else if (y === y1) col = c[0];
      else if (y === y1 - 1) col = c[1];
      else {
        col = ly === 0 ? c[4] : ly === 1 ? c[3] : c[2];
        if ((x + course * 3) % 6 === 0 && ly !== 0) col = c[1];
        if (ly === 2 && bayer(x, y) > 0.6) col = c[1];
      }
      if (x === a && y > y0) col = c[Math.min(4, c.indexOf(col) + 1)];
      if (x === b && y > y0) col = c[Math.max(0, c.indexOf(col) - 1)];
      g.set(x, y, col);
    }
  }
}

/** Triangular front gable (roof slopes + a small wall triangle) above a door. */
function gable(
  g: Grid,
  cx: number,
  apex: number,
  base: number,
  hw: number,
  roofC: Ramp5,
  wall: readonly Col[],
  trim: Col,
): void {
  const H = base - apex;
  for (let y = apex; y <= base; y++) {
    const t = (y - apex) / H;
    const w = hw * t;
    for (let x = Math.floor(cx - w - 2); x <= Math.ceil(cx + w + 1); x++) {
      const dx = x + 0.5 - cx;
      const edge = Math.abs(dx) - w;
      if (edge > 2) continue;
      let col: Col;
      if (edge > 0)
        col = dx < 0 ? roofC[3] : roofC[1]; // roof slopes overhanging the gable
      else if (edge > -1)
        col = trim; // barge board
      else col = y < apex + H * 0.25 ? wall[1] : wall[2];
      g.set(x, y, col);
    }
  }
  // roof slope shading line
  g.line(cx - 1, apex - 1, cx - hw - 2, base, roofC[4]);
  g.line(cx, apex - 1, cx + hw + 1, base, roofC[0]);
  g.set(cx - 1, apex - 1, roofC[4]).set(cx, apex - 1, roofC[3]);
}

function plasterWall(g: Grid, x0: number, x1: number, y0: number, y1: number, timber: boolean): void {
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      let col: Col = PLASTER[2];
      if (rnd(x, y, 5) > 0.93) col = PLASTER[1];
      if (x === x1 || x === x1 - 1) col = PLASTER[1];
      g.set(x, y, col);
    }
  if (timber) {
    for (let y = y0; y <= y1; y++) {
      g.set(x0, y, TIMBER[2]).set(x0 + 1, y, TIMBER[1]);
      g.set(x1 - 1, y, TIMBER[1]).set(x1, y, TIMBER[0]);
    }
  }
  // eave shadow
  for (let x = x0; x <= x1; x++) {
    g.set(x, y0, PLASTER[0]);
    if (bayer(x, y0 + 1) > 0.5) g.set(x, y0 + 1, PLASTER[1]);
  }
}

function beam(g: Grid, x0: number, x1: number, y: number): void {
  for (let x = x0; x <= x1; x++) {
    g.set(x, y, TIMBER[2]);
    g.set(x, y + 1, TIMBER[1]);
  }
}

function plankWall(g: Grid, x0: number, x1: number, y0: number, y1: number, cols: readonly Col[]): void {
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const ly = (y - y0) % 4;
      let col: Col = ly === 3 ? cols[1] : ly === 0 ? cols[3] : cols[2];
      if ((x * 7 + Math.floor((y - y0) / 4) * 5) % 17 === 0 && ly !== 3) col = cols[1];
      if (x === x1) col = cols[1];
      g.set(x, y, col);
    }
  for (let x = x0; x <= x1; x++) g.set(x, y0, cols[0]);
}

function stoneWall(
  g: Grid,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  cols: readonly Col[],
  bw = 6,
  bh = 4,
): void {
  for (let y = y0; y <= y1; y++) {
    const row = Math.floor((y - y0) / bh);
    const ly = (y - y0) % bh;
    const off = row % 2 ? bw / 2 : 0;
    for (let x = x0; x <= x1; x++) {
      const lx = (((x - x0 + off) % bw) + bw) % bw;
      const id = Math.floor((x - x0 + off) / bw);
      let col: Col = rnd(id, row, 9) > 0.65 ? cols[2] : cols[3];
      if (ly === bh - 1 || lx === bw - 1) col = cols[1];
      else if (ly === 0) col = cols[4];
      else if (lx === 0) col = mix(col, cols[4], 0.5);
      g.set(x, y, col);
    }
  }
}

function foundation(g: Grid, x0: number, x1: number, y0: number, y1: number): void {
  stoneWall(g, x0, x1, y0, y1, R.stone, 5, 3);
  for (let x = x0; x <= x1; x++) g.set(x, y1, R.stone[1]);
}

interface WinOpts {
  shutters?: Col;
  box?: Col;
  lit?: boolean;
  frame?: Col;
}

function windowAt(g: Grid, x: number, y: number, w: number, h: number, o: WinOpts = {}): void {
  const fr = o.frame ?? TIMBER[1];
  g.rect(x - 1, y - 1, w + 2, h + 2, fr);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      let col: Col;
      if (o.lit) col = j < h / 2 ? PAL.yellow : PAL.gold;
      else col = j < 2 ? '#1a4a80' : j < h - 2 ? PAL.blue : PAL.navy;
      // diagonal glint
      if (!o.lit && (i - j === 1 || i - j === 2) && i < w - 1) col = '#5ab8ea';
      g.set(x + i, y + j, col);
    }
  // muntins
  const mx = x + Math.floor(w / 2);
  const my = y + Math.floor(h / 2);
  g.vline(mx, y, y + h - 1, fr);
  g.hline(x, x + w - 1, my, fr);
  // sill
  g.hline(x - 2, x + w + 1, y + h + 1, PLASTER[3]);
  g.hline(x - 2, x + w + 1, y + h + 2, PLASTER[0]);
  if (o.shutters) {
    const s = o.shutters;
    const sd = mix(s, PAL.black, 0.35);
    for (let j = -1; j <= h; j++) {
      g.set(x - 3, y + j, s).set(x - 2, y + j, sd);
      g.set(x + w + 1, y + j, s).set(x + w + 2, y + j, sd);
    }
  }
  if (o.box) {
    g.rect(x - 1, y + h + 2, w + 2, 2, TIMBER[1]);
    for (let i = -1; i <= w; i++) {
      g.set(x + i, y + h + 1, i % 2 ? o.box : PAL.green);
      if (i % 3 === 0) g.set(x + i, y + h, o.box);
    }
  }
}

function door(
  g: Grid,
  cx: number,
  bottom: number,
  w: number,
  h: number,
  cols: readonly Col[],
  arch = false,
  frame: Col = STONE[1],
): void {
  const x0 = cx - Math.floor(w / 2);
  const top = bottom - h + 1;
  // frame
  g.rect(x0 - 1, top - 1, w + 2, h + 1, frame);
  for (let y = top; y <= bottom; y++)
    for (let x = x0; x < x0 + w; x++) {
      if (arch && y < top + 2) {
        const dx = Math.abs(x + 0.5 - cx);
        if (dx > w / 2 - (y === top ? 2 : 1)) {
          g.set(x, y, frame);
          continue;
        }
      }
      const lx = (x - x0) % 3;
      let col: Col = lx === 2 ? cols[1] : lx === 0 ? cols[3] : cols[2];
      if (y === top + 3 || y === bottom - 3) col = cols[1];
      g.set(x, y, col);
    }
  // centre split for double doors
  if (w >= 10) g.vline(cx, top, bottom, cols[0]);
  // handle
  g.set(w >= 10 ? cx - 2 : x0 + w - 2, top + Math.floor(h / 2), PAL.gold);
  if (w >= 10) g.set(cx + 1, top + Math.floor(h / 2), PAL.gold);
  // threshold shadow
  g.hline(x0, x0 + w - 1, bottom, cols[0]);
}

function chimney(g: Grid, x: number, y: number, w: number, h: number, glow = false): void {
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const ly = j % 3;
      let col: Col =
        ly === 2 ? PAL.darkBrown : (i + (Math.floor(j / 3) % 2) * 2) % 4 === 3 ? PAL.darkBrown : PAL.rust;
      if (i === 0) col = ly === 2 ? PAL.darkBrown : PAL.orangeBrown;
      if (i === w - 1) col = PAL.plum;
      g.set(x + i, y + j, col);
    }
  g.hline(x - 1, x + w, y, R.stone[3]);
  g.hline(x - 1, x + w, y + 1, R.stone[1]);
  if (glow) g.hline(x + 1, x + w - 2, y, PAL.orange);
}

/** Small painted sign icon (7x5 area). */
function signIcon(g: Grid, x: number, y: number, kind: 'mug' | 'coin' | 'potion' | 'anvil' | 'bed'): void {
  const icons: Record<string, readonly string[]> = {
    mug: ['.www.', 'yyyyo', 'yyy.o', 'yyyyo', '.yy..'],
    coin: ['.ggg.', 'gyyyg', 'gyoyg', 'gyyyg', '.ggg.'],
    potion: ['..w..', '.rrr.', 'rrrrr', 'rpprr', '.rrr.'],
    anvil: ['ssss.', '.ssss', '..s..', '.sss.', 'sssss'],
    bed: ['w....', 'wrrrr', 'wrrrr', 'wwwww', 'w...w'],
  };
  g.stamp(
    icons[kind],
    { w: PAL.white, y: PAL.gold, o: PAL.darkBrown, g: PAL.gold, r: PAL.red, p: PAL.pink, s: PAL.slate },
    x,
    y,
  );
}

function hangingSign(g: Grid, x: number, y: number, kind: 'mug' | 'coin' | 'potion' | 'anvil' | 'bed'): void {
  // bracket
  g.hline(x - 1, x + 9, y, R.iron[1]);
  g.set(x - 1, y + 1, R.iron[1]);
  g.set(x + 1, y + 1, R.iron[2]).set(x + 7, y + 1, R.iron[2]);
  // board
  g.rect(x, y + 2, 9, 8, WOOD[1]);
  g.rect(x + 1, y + 3, 7, 6, WOOD[3]);
  g.hline(x + 1, x + 7, y + 3, WOOD[4]);
  signIcon(g, x + 2, y + 3, kind);
}

// -------------------------------------------------------------- buildings ---

function houseA(): Grid {
  const g = new Grid(48, 52);
  roof(g, 1, 46, 4, 27, ROOF_RED, 4);
  chimney(g, 34, 1, 5, 9);
  plasterWall(g, 3, 44, 28, 49, true);
  beam(g, 3, 44, 28);
  beam(g, 3, 44, 39);
  windowAt(g, 8, 31, 7, 6, { box: PAL.red });
  windowAt(g, 33, 31, 7, 6, { box: PAL.yellow });
  foundation(g, 3, 44, 47, 51);
  door(g, 24, 51, 8, 16, WOOD, true);
  // lantern by the door
  g.set(30, 38, R.iron[1]).set(30, 39, PAL.yellow).set(30, 40, PAL.gold).set(29, 38, R.iron[1]);
  return ink(g, 0.15);
}

function houseB(): Grid {
  const g = new Grid(48, 52);
  roof(g, 1, 46, 5, 27, ROOF_BLUE, 4);
  chimney(g, 8, 2, 4, 8);
  plankWall(g, 3, 44, 28, 49, [PAL.plum, PAL.darkBrown, '#b0785a', '#c98f68']);
  gable(g, 24, 11, 30, 11, ROOF_BLUE, PLASTER, PAL.white);
  // gable boards + a small attic window
  for (let y = 16; y < 30; y++)
    for (let x = 14; x < 35; x++) if (g.get(x, y) === PLASTER[2] && x % 3 === 0) g.set(x, y, PLASTER[1]);
  windowAt(g, 22, 21, 4, 4, { frame: TIMBER[1] });
  windowAt(g, 7, 33, 7, 6, { shutters: PAL.darkGreen });
  windowAt(g, 34, 33, 7, 6, { shutters: PAL.darkGreen });
  foundation(g, 3, 44, 48, 51);
  door(g, 24, 51, 8, 16, [PAL.navy, PAL.blue, '#1a6fb0', PAL.sky], false, TIMBER[1]);
  // step
  g.hline(19, 28, 51, R.stone[3]);
  return ink(g, 0.15);
}

function inn(): Grid {
  const g = new Grid(64, 66);
  roof(g, 1, 62, 4, 24, ROOF_BROWN, 4);
  chimney(g, 7, 0, 5, 10);
  // dormers
  for (const dx of [16, 47]) {
    gable(g, dx, 7, 17, 6, ROOF_BROWN, PLASTER, PAL.sand);
    windowAt(g, dx - 2, 12, 4, 4, { lit: true });
  }
  // upper floor: timber-framed plaster
  plasterWall(g, 3, 60, 25, 42, true);
  beam(g, 3, 60, 25);
  for (const x of [17, 31, 45]) for (let y = 27; y < 42; y++) g.set(x, y, TIMBER[1]).set(x + 1, y, TIMBER[0]);
  windowAt(g, 8, 29, 6, 6, { lit: true, box: PAL.red });
  windowAt(g, 22, 29, 6, 6, { lit: true });
  windowAt(g, 36, 29, 6, 6, { lit: true });
  windowAt(g, 50, 29, 6, 6, { lit: true, box: PAL.pink });
  // balcony beam / floor divider
  for (let x = 2; x <= 61; x++) {
    g.set(x, 42, WOOD[3]);
    g.set(x, 43, WOOD[1]);
    g.set(x, 44, bayer(x, 44) > 0.5 ? STONE[1] : WOOD[0]);
  }
  // ground floor: stone
  stoneWall(g, 3, 60, 45, 65, STONE);
  windowAt(g, 8, 50, 8, 6, { lit: true });
  windowAt(g, 48, 50, 8, 6, { lit: true });
  door(g, 32, 65, 12, 16, WOOD, true, STONE[1]);
  // sign above the door: mug and bed
  g.rect(24, 45, 17, 3, WOOD[1]);
  hangingSign(g, 18, 45, 'mug');
  hangingSign(g, 38, 45, 'bed');
  // lanterns
  for (const x of [23, 42]) g.set(x, 56, R.iron[1]).set(x, 57, PAL.yellow).set(x, 58, PAL.gold);
  return ink(g, 0.15);
}

function shop(): Grid {
  const g = new Grid(64, 50);
  roof(g, 1, 62, 3, 19, ROOF_SLATE, 3);
  // shop board on the roof
  g.rect(22, 6, 20, 9, WOOD[1]);
  g.rect(23, 7, 18, 7, WOOD[3]);
  g.hline(23, 40, 7, WOOD[4]);
  signIcon(g, 25, 8, 'potion');
  signIcon(g, 34, 8, 'coin');
  plankWall(g, 3, 60, 20, 47, [PAL.plum, '#6a3a35', '#9a5b45', PAL.brown]);
  // display windows with goods
  for (const wx of [7, 42]) {
    g.rect(wx - 1, 29, 17, 11, TIMBER[0]);
    g.rect(wx, 30, 15, 9, '#1a4a80');
    for (let i = 0; i < 5; i++) {
      const bx = wx + 1 + i * 3;
      const bc = [PAL.red, PAL.sky, PAL.green, PAL.magenta, PAL.gold][i];
      g.set(bx, 34, PAL.lightGray).rect(bx, 35, 2, 3, bc).set(bx, 35, PAL.white);
    }
    g.hline(wx, wx + 14, 38, WOOD[2]);
    g.hline(wx - 2, wx + 16, 40, PLASTER[3]).hline(wx - 2, wx + 16, 41, PLASTER[0]);
  }
  // awning: red / cream stripes with a scalloped hem
  for (let y = 21; y <= 27; y++)
    for (let x = 4; x <= 59; x++) {
      const stripe = Math.floor((x - 4) / 4) % 2;
      let col: Col = stripe ? '#f4ecd8' : PAL.red;
      if (y === 21) col = stripe ? PAL.white : PAL.pink;
      if (y >= 25) col = stripe ? PAL.sand : PAL.darkRed;
      if (y === 27 && (x - 4) % 4 === 0) continue;
      g.set(x, y, col);
    }
  for (let x = 4; x <= 59; x++) if (bayer(x, 28) > 0.3) g.set(x, 28, '#3e2731');
  foundation(g, 3, 60, 46, 49);
  door(g, 32, 49, 8, 16, WOOD, false, TIMBER[0]);
  return ink(g, 0.15);
}

function smithy(): Grid {
  const g = new Grid(64, 50);
  roof(g, 1, 62, 6, 21, ROOF_SLATE, 3);
  // big stone chimney with forge glow
  for (let y = 0; y < 16; y++)
    for (let x = 48; x < 57; x++) {
      let col: Col = (x + Math.floor(y / 3) * 2) % 4 === 0 || y % 3 === 2 ? R.stone[1] : R.stone[3];
      if (x === 48) col = R.stone[4];
      if (x === 56) col = R.stone[1];
      g.set(x, y, col);
    }
  g.hline(47, 57, 0, R.stone[4]).hline(47, 57, 1, R.stone[2]);
  g.hline(49, 55, 0, PAL.orange).set(52, 0, PAL.yellow);
  stoneWall(g, 3, 60, 22, 49, STONE, 7, 4);
  // forge window glowing
  windowAt(g, 9, 27, 9, 6, { lit: true, frame: R.iron[1] });
  g.hline(9, 17, 32, PAL.orange);
  // heavy door with iron bands
  door(g, 32, 49, 10, 17, [PAL.plum, PAL.darkBrown, '#7a4538', '#8f5a44'], true, R.stone[1]);
  for (const y of [36, 43]) g.hline(28, 36, y, R.iron[2]);
  hangingSign(g, 42, 24, 'anvil');
  // anvil on a stump outside
  g.rect(51, 43, 6, 6, WOOD[1]);
  g.rect(52, 43, 4, 5, WOOD[2]);
  g.hline(49, 58, 40, R.iron[3]).hline(50, 58, 41, R.iron[2]).rect(52, 42, 4, 1, R.iron[1]);
  g.set(49, 40, R.iron[4]).set(58, 41, R.iron[1]);
  // water barrel
  barrelAt(g, 6, 38);
  return ink(g, 0.15);
}

function elderHouse(): Grid {
  const g = new Grid(56, 58);
  roof(g, 1, 54, 4, 30, ROOF_GREEN, 4);
  chimney(g, 8, 0, 5, 11);
  plasterWall(g, 3, 52, 31, 53, true);
  beam(g, 3, 52, 31);
  gable(g, 28, 9, 33, 14, ROOF_GREEN, PLASTER, PAL.gold);
  // stained-glass rose window
  g.ellipse(28, 24, 3.5, 3.5, (x, y, nx, ny) => {
    const d = Math.hypot(nx, ny);
    if (d > 0.75) return PAL.gold;
    if (d < 0.3) return PAL.white;
    return (x + y) % 2 ? PAL.sky : PAL.magenta;
  });
  // columns flanking the door
  for (const x of [21, 34]) {
    for (let y = 37; y < 54; y++)
      g.set(x, y, cyl(R.stone, -0.3, x, y)).set(x + 1, y, cyl(R.stone, 0.6, x + 1, y));
    g.hline(x - 1, x + 2, 36, R.stone[4]).hline(x - 1, x + 2, 37, R.stone[2]);
  }
  windowAt(g, 7, 37, 8, 7, { box: PAL.red, shutters: PAL.forest });
  windowAt(g, 41, 37, 8, 7, { box: PAL.red, shutters: PAL.forest });
  foundation(g, 3, 52, 52, 57);
  door(g, 28, 57, 10, 18, [PAL.plum, PAL.darkBrown, '#7a4538', '#9a5b45'], true, PAL.gold);
  // green banners beside the door
  for (const x of [17, 38]) {
    g.rect(x, 39, 2, 6, PAL.darkGreen);
    g.set(x, 39, PAL.gold)
      .set(x + 1, 39, PAL.gold)
      .set(x, 45, PAL.darkGreen);
  }
  // steps
  g.hline(22, 34, 57, R.stone[4]);
  return ink(g, 0.15);
}

// -------------------------------------------------------------- furniture ---

function barrelAt(g: Grid, x: number, y: number): void {
  const w = 10;
  const h = 11;
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const nx = (i + 0.5 - w / 2) / (w / 2);
      const bulge = Math.abs(j - h / 2) > h / 2 - 1.5 && Math.abs(nx) > 0.85;
      if (bulge) continue;
      let col = cyl(WOOD, nx, x + i, y + j, 0.05);
      if (j === 2 || j === h - 3) col = cyl(R.iron, nx, x + i, y + j, 0.1);
      if ((i === 3 || i === 6) && j > 0 && j < h - 1 && col !== R.iron[2] && col !== R.iron[3])
        col = mix(col, PAL.plum, 0.4);
      g.set(x + i, y + j, col);
    }
  g.ellipse(x + w / 2, y + 0.5, w / 2 - 0.5, 1.6, (_px, _py, nx) => (nx < -0.3 ? WOOD[3] : WOOD[2]));
  g.hline(x + 2, x + 7, y, WOOD[1]);
}

function barrel(): Grid {
  const g = new Grid(12, 14);
  barrelAt(g, 1, 2);
  return ink(g);
}

function crate(): Grid {
  const g = new Grid(14, 14);
  // top face
  g.rect(1, 1, 12, 3, WOOD[4]);
  g.hline(1, 12, 3, WOOD[3]);
  // front face planks
  for (let y = 4; y < 13; y++)
    for (let x = 1; x < 13; x++) {
      let col: Col = (y - 4) % 3 === 2 ? WOOD[1] : WOOD[3];
      if (x === 1 || x === 12 || y === 4 || y === 12) col = WOOD[2];
      g.set(x, y, col);
    }
  g.line(2, 5, 11, 11, WOOD[1]);
  g.line(2, 6, 10, 11, WOOD[2]);
  for (const [x, y] of [
    [2, 5],
    [11, 5],
    [2, 11],
    [11, 11],
  ] as const)
    g.set(x, y, R.iron[3]);
  return ink(g);
}

function hayBale(): Grid {
  const g = new Grid(16, 12);
  const hay = [PAL.darkBrown, PAL.orangeBrown, PAL.gold, PAL.yellow, '#fff3b0'] as const;
  // top face: pale, stippled
  for (let y = 1; y < 4; y++)
    for (let x = 1; x < 15; x++)
      g.set(x, y, y === 1 ? hay[3] : rnd(x, y, 3) > 0.8 ? hay[3] : rnd(x, y, 4) > 0.7 ? hay[1] : hay[2]);
  // front face: horizontal straw strands
  for (let y = 4; y < 11; y++) {
    let x = 1;
    while (x < 15) {
      const len = 2 + Math.floor(rnd(x, y, 7) * 4);
      const shade = y === 4 ? 3 : y > 8 ? 1 : rnd(x, y, 8) > 0.6 ? 1 : 2;
      for (let k = 0; k < len && x < 15; k++, x++)
        g.set(x, y, k === len - 1 ? hay[Math.max(0, shade - 1)] : hay[shade]);
    }
  }
  // twine bands
  for (const x of [4, 11]) for (let y = 1; y < 11; y++) g.set(x, y, y < 4 ? PAL.tan : PAL.darkBrown);
  // stray straws
  g.set(0, 6, PAL.gold).set(15, 8, PAL.gold).set(7, 0, PAL.yellow).set(8, 0, PAL.gold);
  return ink(g);
}

function fenceH(): Grid {
  const g = new Grid(16, 12);
  // rails span the whole tile so segments join up
  for (let x = 0; x < 16; x++) {
    g.set(x, 4, WOOD[4]).set(x, 5, WOOD[2]);
    g.set(x, 8, WOOD[3]).set(x, 9, WOOD[1]);
  }
  // post
  for (let y = 1; y < 12; y++) g.set(6, y, WOOD[3]).set(7, y, WOOD[2]).set(8, y, WOOD[1]);
  g.set(6, 1, WOOD[4]).set(7, 1, WOOD[3]).set(7, 0, WOOD[3]);
  return g.outline((inner) => mix(PAL.black, inner, 0.3));
}

function fenceV(): Grid {
  const g = new Grid(8, 24);
  // rails running north (seen almost edge-on from above)
  for (let y = 2; y < 14; y++) {
    g.set(3, y, WOOD[3]);
    g.set(4, y, WOOD[1]);
  }
  // post
  for (let y = 12; y < 24; y++) g.set(2, y, WOOD[3]).set(3, y, WOOD[2]).set(4, y, WOOD[2]).set(5, y, WOOD[1]);
  g.hline(2, 5, 12, WOOD[4]);
  g.set(3, 16, WOOD[1]).set(4, 16, WOOD[0]).set(3, 20, WOOD[1]).set(4, 20, WOOD[0]);
  return g.outline((inner) => mix(PAL.black, inner, 0.3));
}

function lampPost(): Grid {
  const g = new Grid(10, 30);
  // base
  g.rect(2, 26, 6, 3, R.iron[2]).hline(2, 7, 26, R.iron[3]).hline(3, 6, 25, R.iron[2]);
  // pole
  for (let y = 9; y < 26; y++) g.set(4, y, R.iron[3]).set(5, y, R.iron[1]);
  g.hline(3, 6, 17, R.iron[2]);
  // lantern
  g.hline(2, 7, 2, R.iron[2]).hline(3, 6, 1, R.iron[3]).set(4, 0, R.iron[3]).set(5, 0, R.iron[2]);
  g.rect(2, 3, 6, 6, R.iron[1]);
  g.rect(3, 4, 4, 4, PAL.gold);
  g.rect(3, 4, 2, 2, PAL.yellow).set(3, 4, PAL.white);
  g.hline(2, 7, 9, R.iron[2]);
  return ink(g, 0.1);
}

function quest_board(): Grid {
  const g = new Grid(24, 26);
  // posts
  for (const x of [2, 20]) for (let y = 4; y < 26; y++) g.set(x, y, WOOD[3]).set(x + 1, y, WOOD[1]);
  // little roof
  roof(g, 0, 23, 1, 5, ROOF_RED, 1);
  // board
  g.rect(3, 7, 18, 12, WOOD[1]);
  g.rect(4, 8, 16, 10, WOOD[3]);
  for (let y = 9; y < 18; y += 3) g.hline(4, 19, y, WOOD[2]);
  // notes
  const notes: [number, number, Col][] = [
    [5, 9, PAL.sand],
    [10, 8, PAL.white],
    [15, 10, PAL.sand],
    [7, 13, PAL.white],
    [13, 14, '#f7e8c0'],
  ];
  for (const [x, y, c] of notes) {
    g.rect(x, y, 4, 4, c);
    g.hline(x + 1, x + 2, y + 2, PAL.gray);
    g.set(x + 1, y, PAL.red);
  }
  g.set(10, 8, PAL.gold).set(11, 9, PAL.yellow);
  return ink(g, 0.15);
}

function fountain(frame: number): Grid {
  const g = new Grid(32, 32);
  // basin rim (outer)
  g.ellipse(16, 23.5, 15, 7.5, (x, y, nx, ny) =>
    ramp(R.stone, sphereLight(nx * 0.8, ny, 0.3) + 0.15, x, y, 0.3),
  );
  // water surface
  g.ellipse(16, 23, 12, 5.2, (x, y, nx, ny) => {
    const d = Math.hypot(nx, ny);
    const ring = Math.floor((d * 6 - frame) % 3);
    if (d > 0.85) return '#1a6fb0';
    if (ring === 0 && d > 0.3) return '#5ab8ea';
    return (x + y) % 7 === 0 ? '#2d8ad0' : '#1f78c0';
  });
  // front rim face
  for (let x = 1; x < 31; x++) {
    const nx = (x + 0.5 - 16) / 15;
    const yb = Math.round(23.5 + 7.5 * Math.sqrt(Math.max(0, 1 - nx * nx)));
    for (let y = yb - 2; y <= yb; y++) if (y > 24) g.set(x, y, y === yb ? R.stone[1] : R.stone[2]);
  }
  // column + upper bowl
  for (let y = 10; y < 24; y++) {
    g.set(15, y, R.stone[4]).set(16, y, R.stone[3]).set(17, y, R.stone[2]);
  }
  g.ellipse(16, 11, 6, 2.2, (x, y, nx, ny) => ramp(R.stone, sphereLight(nx, ny, 0.3) + 0.1, x, y, 0.2));
  g.hline(12, 20, 11, '#5ab8ea').hline(11, 21, 12, R.stone[2]);
  // spout + falling water (animated)
  const drops = ['#bff4ff', '#5ab8ea', PAL.white];
  g.set(16, 6, PAL.white)
    .set(16, 7, '#bff4ff')
    .set(16, 8, '#5ab8ea')
    .set(15, 9, '#5ab8ea')
    .set(17, 9, '#5ab8ea');
  for (let k = 0; k < 3; k++) {
    const t = ((frame + k) % 3) / 3;
    for (const side of [-1, 1]) {
      const x = 16 + side * (5 + t * 4);
      const y = 11 + t * 9 + t * t * 3;
      g.set(Math.round(x), Math.round(y), drops[k % 3]);
      g.set(Math.round(x), Math.round(y) + 1, '#5ab8ea');
    }
  }
  // splash rings
  g.set(8 + frame, 21, PAL.white).set(23 - frame, 21, PAL.white);
  return ink(g, 0.2);
}

function well(): Grid {
  const g = new Grid(22, 28);
  // posts + roof
  for (const x of [3, 17]) for (let y = 6; y < 20; y++) g.set(x, y, WOOD[3]).set(x + 1, y, WOOD[1]);
  roof(g, 0, 21, 1, 7, ROOF_RED, 2);
  // crossbar + rope + bucket
  g.hline(4, 17, 9, WOOD[2]).hline(4, 17, 10, WOOD[1]);
  g.vline(11, 11, 15, PAL.sand);
  g.rect(9, 15, 4, 3, WOOD[3]).hline(9, 12, 15, R.iron[3]);
  // stone ring
  g.ellipse(11, 20, 9, 3, (_x, _y, nx) => (nx < 0 ? R.stone[4] : R.stone[3]));
  g.ellipse(11, 20, 6.5, 1.8, (_x, _y, _nx, ny) => (ny < 0 ? PAL.black : PAL.navy));
  for (let y = 21; y < 27; y++)
    for (let x = 2; x < 21; x++) {
      const nx = (x + 0.5 - 11) / 9;
      const yb = 20 + 3 * Math.sqrt(Math.max(0, 1 - nx * nx));
      if (y < yb - 0.5) continue;
      const row = Math.floor((y - 21) / 3);
      let col: Col = cyl(R.stone, nx, x, y, 0.05);
      if ((y - 21) % 3 === 2 || (x + row * 2) % 5 === 0) col = R.stone[1];
      g.set(x, y, col);
    }
  return ink(g, 0.15);
}

function marketStall(): Grid {
  const g = new Grid(34, 30);
  // posts
  for (const x of [3, 29]) for (let y = 8; y < 28; y++) g.set(x, y, WOOD[3]).set(x + 1, y, WOOD[1]);
  // counter
  g.rect(2, 18, 30, 3, WOOD[4]);
  g.hline(2, 31, 20, WOOD[2]);
  for (let y = 21; y < 29; y++)
    for (let x = 3; x < 31; x++) g.set(x, y, (x % 4 === 0 ? WOOD[1] : WOOD[2]) as Col);
  g.hline(3, 30, 21, WOOD[0]);
  // produce baskets
  const goods: [number, Col, Col][] = [
    [5, PAL.red, PAL.darkRed],
    [11, PAL.green, PAL.darkGreen],
    [17, PAL.orange, PAL.rust],
    [23, PAL.yellow, PAL.gold],
  ];
  for (const [x, a, b] of goods) {
    g.rect(x, 15, 5, 3, WOOD[1]);
    for (let i = 0; i < 5; i++) g.set(x + i, 14, i % 2 ? b : a).set(x + i, 15 - (i % 2), a);
    g.set(x + 1, 13, a)
      .set(x + 3, 13, a)
      .set(x + 2, 13, PAL.white);
  }
  // striped canopy
  for (let y = 1; y <= 8; y++) {
    const inset = Math.max(0, 3 - y);
    for (let x = 1 + inset; x <= 32 - inset; x++) {
      const stripe = Math.floor((x - 1) / 4) % 2;
      let col: Col = stripe ? '#f4ecd8' : PAL.sky;
      if (y === 1) col = stripe ? PAL.white : '#6fd0f0';
      if (y >= 7) col = stripe ? PAL.sand : PAL.blue;
      if (y === 8 && (x - 1) % 4 === 0) continue;
      g.set(x, y, col);
    }
  }
  for (let x = 2; x <= 31; x++) if (bayer(x, 9) > 0.4) g.set(x, 9, '#3e2731');
  return ink(g, 0.15);
}

function statue(): Grid {
  const g = new Grid(24, 42);
  const S = ['#3a4466', '#5a6988', '#8b9bb4', '#aab6ca', '#c0cbdc'] as const;
  // pedestal
  for (let y = 28; y < 42; y++)
    for (let x = 2; x < 22; x++) {
      let col: Col = S[2];
      if (y === 28) col = S[4];
      else if (y === 29) col = S[3];
      else if (y === 41) col = S[0];
      else if (x === 2) col = S[3];
      else if (x === 21) col = S[1];
      g.set(x, y, col);
    }
  g.rect(3, 32, 18, 1, S[1]);
  // plaque
  g.rect(8, 34, 8, 4, PAL.gold);
  g.hline(9, 14, 35, PAL.darkBrown).hline(9, 13, 36, PAL.rust);
  // hero figure (stone): cape, legs, torso, head, sword raised high
  const sh = (x: number, cx: number, w: number, y: number, bias = 0) =>
    cyl(S, (x + 0.5 - cx) / w, x, y, bias);
  // cape flowing behind to the left
  g.poly(
    [
      [9, 13],
      [13, 13],
      [11, 27],
      [4, 28],
      [6, 20],
    ],
    (x, _y) => (x < 7 ? S[2] : S[1]),
  );
  // legs + boots
  for (let y = 21; y < 28; y++) {
    for (const lx of [9, 12]) for (let x = lx; x < lx + 3; x++) g.set(x, y, sh(x, lx + 1.5, 1.6, y));
  }
  g.hline(8, 11, 27, S[1]).hline(12, 15, 27, S[1]);
  // torso (armour) + belt
  for (let y = 13; y < 21; y++) {
    const hw = y < 15 ? 4 : 3.2;
    for (let x = Math.floor(11.5 - hw); x < Math.ceil(11.5 + hw); x++) g.set(x, y, sh(x, 11.5, hw, y, 0.1));
  }
  g.hline(8, 14, 19, S[1]).set(11, 19, S[4]);
  // pauldrons
  g.ellipse(8, 13.5, 1.8, 1.4, (x, y, nx, ny) => ramp(S, sphereLight(nx, ny, 0.3) + 0.1, x, y, 0.2));
  g.ellipse(15, 13.5, 1.8, 1.4, (x, y, nx, ny) => ramp(S, sphereLight(nx, ny, 0.3), x, y, 0.2));
  // left arm resting at the side
  g.vline(7, 15, 19, S[3]).vline(6, 16, 18, S[2]);
  // right arm raised
  g.line(15, 12, 16, 8, S[2]).line(16, 12, 17, 8, S[1]);
  g.rect(15, 7, 3, 2, S[3]);
  // head with a crested helm
  g.ellipse(11.5, 10, 2.6, 2.8, (x, y, nx, ny) => ramp(S, sphereLight(nx, ny, 0.3) + 0.1, x, y, 0.2));
  g.hline(10, 13, 10, S[1]);
  g.vline(11, 6, 8, S[4]).set(12, 7, S[3]);
  // sword pointing to the sky
  g.hline(14, 18, 6, S[3]).set(14, 6, S[4]);
  for (let y = 0; y < 6; y++) g.set(16, y, S[4]).set(17, y, y === 0 ? S[3] : S[2]);
  g.set(16, 0, PAL.white);
  // soft moss at the base
  g.set(3, 40, PAL.darkGreen).set(4, 40, PAL.green).set(20, 40, PAL.darkGreen);
  return ink(g, 0.1);
}

export const TOWN: PropTable = {
  house_a: def(48, 52, houseA, { anchorX: 24, anchorY: 51, collider: { x: -21, y: -40, w: 42, h: 41 } }),
  house_b: def(48, 52, houseB, { anchorX: 24, anchorY: 51, collider: { x: -21, y: -39, w: 42, h: 40 } }),
  inn: def(64, 66, inn, { anchorX: 32, anchorY: 65, collider: { x: -29, y: -53, w: 58, h: 54 } }),
  shop: def(64, 50, shop, { anchorX: 32, anchorY: 49, collider: { x: -29, y: -38, w: 58, h: 39 } }),
  smithy: def(64, 50, smithy, { anchorX: 32, anchorY: 49, collider: { x: -29, y: -36, w: 58, h: 37 } }),
  elder_house: def(56, 58, elderHouse, {
    anchorX: 28,
    anchorY: 57,
    collider: { x: -25, y: -44, w: 50, h: 45 },
  }),
  quest_board: def(24, 26, quest_board, { anchorX: 12, anchorY: 25, collider: foot(20, 4) }),
  fountain: def(32, 32, fountain, {
    anchorX: 16,
    anchorY: 31,
    frames: 3,
    fps: 6,
    collider: { x: -14, y: -13, w: 28, h: 14 },
  }),
  well: def(22, 28, well, { anchorX: 11, anchorY: 27, collider: foot(18, 7) }),
  fence_h: def(16, 12, fenceH, { anchorX: 8, anchorY: 11, collider: { x: -8, y: -3, w: 16, h: 3 } }),
  fence_v: def(8, 24, fenceV, { anchorX: 4, anchorY: 23, collider: { x: -2, y: -15, w: 4, h: 16 } }),
  lamp_post: def(10, 30, lampPost, {
    anchorX: 5,
    anchorY: 28,
    collider: foot(4, 3),
    light: { radius: 48, color: '#feae34' },
  }),
  crate: def(14, 14, crate, { anchorX: 7, anchorY: 13, collider: foot(12, 7) }),
  barrel: def(12, 14, barrel, { anchorX: 6, anchorY: 13, collider: foot(10, 5) }),
  market_stall: def(34, 30, marketStall, {
    anchorX: 17,
    anchorY: 29,
    collider: { x: -15, y: -11, w: 30, h: 12 },
  }),
  hay_bale: def(16, 12, hayBale, { anchorX: 8, anchorY: 11, collider: foot(14, 6) }),
  statue: def(24, 42, statue, { anchorX: 12, anchorY: 41, collider: foot(20, 10) }),
};
