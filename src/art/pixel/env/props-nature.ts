/**
 * Nature props: trees, bushes, flowers, rocks, logs…
 */
import { PAL } from '../../palette';
import { R, canopy, cyl, def, foot, ink, type PropTable } from './kit';
import { Grid, mix, ramp, rnd, rng, sphereLight, type Col } from './raster';

// ------------------------------------------------------------------ trees ---

function trunk(
  g: Grid,
  cx: number,
  top: number,
  bottom: number,
  hw: number,
  cols: readonly Col[],
  flare = 2,
): void {
  for (let y = top; y <= bottom; y++) {
    const f = y > bottom - 3 ? Math.round(((y - (bottom - 3)) / 3) * flare) : 0;
    const w = hw + f;
    for (let x = Math.round(cx - w); x <= Math.round(cx + w - 1); x++) {
      const nx = (x + 0.5 - cx) / (w || 1);
      let c = cyl(cols, nx, x, y);
      if (
        (x === Math.round(cx) - 1 || x === Math.round(cx) + 1) &&
        y % 5 !== 0 &&
        y < bottom - 2 &&
        rnd(x, y, 3) > 0.35
      )
        c = cols[Math.max(0, cols.indexOf(c) - 1)];
      g.set(x, y, c);
    }
  }
}

function oak(): Grid {
  const g = new Grid(32, 40);
  trunk(g, 16, 22, 38, 3, R.bark, 2);
  const blobs: [number, number, number][] = [
    [16, 9, 8],
    [9, 12, 7],
    [23, 12, 7],
    [6, 18, 5.5],
    [26, 18, 5.5],
    [16, 15, 9],
    [11, 21, 6.5],
    [21, 21, 6.5],
    [16, 23, 6],
  ];
  canopy(g, blobs, R.leaf, 15, 13, 15, 14, 7);
  // shadow cast by the canopy on the trunk
  for (let x = 12; x < 21; x++)
    for (let y = 28; y < 31; y++)
      if (g.get(x, y) && !isLeaf(g.get(x, y)!))
        g.set(x, y, y === 28 ? PAL.plum : mix(g.get(x, y)!, PAL.plum, 0.5));
  // a few bright leaf sparkles on the lit side
  const r = rng(12);
  for (let i = 0; i < 6; i++) {
    const x = 5 + Math.floor(r() * 14);
    const y = 3 + Math.floor(r() * 12);
    if (g.get(x, y) === R.leaf[3]) g.set(x, y, R.leaf[4]);
  }
  return ink(g);
}

function isLeaf(c: Col): boolean {
  return (R.leaf as readonly Col[]).includes(c);
}

const PINE = ['#10231f', PAL.deepTeal, PAL.forest, '#2f7045', PAL.darkGreen] as const;

function pineTiers(
  g: Grid,
  cx: number,
  tiers: readonly [number, number, number][],
  cols: readonly Col[],
  snow: boolean,
): void {
  const own = new Int8Array(g.w * g.h).fill(-1);
  for (let i = tiers.length - 1; i >= 0; i--) {
    const [top, bottom, hw] = tiers[i];
    for (let y = top; y <= bottom + 2; y++) {
      const t = (y - top) / (bottom - top);
      const w = Math.max(0.6, hw * Math.min(1, t) + 0.5);
      for (let x = Math.floor(cx - w); x <= Math.ceil(cx + w); x++) {
        const nx = (x + 0.5 - cx) / hw;
        if (Math.abs(x + 0.5 - cx) > w) continue;
        // jagged hem: every 3px a needle point hangs lower
        const k = (((x - Math.floor(cx)) % 3) + 3) % 3;
        const hem = bottom + (k === 0 ? 2 : k === 1 ? 1 : 0);
        if (y > hem) continue;
        let l = 0.62 - nx * 0.45 - (y >= bottom - 1 ? 0.3 : 0) - t * 0.15;
        if (rnd(x, y, 21 + i) > 0.85) l += 0.15;
        g.set(x, y, ramp(cols, l, x, y, 0.5));
        if (g.inb(x, y)) own[y * g.w + x] = i;
      }
    }
  }
  if (!snow) return;
  // snow settles on the exposed top of every tier (a 2-3px shelf, heavier on the lit side)
  for (let x = 0; x < g.w; x++) {
    let run = 0;
    let prev = -1;
    for (let y = 0; y < g.h; y++) {
      const o = own[y * g.w + x];
      if (o < 0) {
        prev = -1;
        run = 0;
        continue;
      }
      run = o === prev ? run + 1 : 0;
      prev = o;
      const nx = (x + 0.5 - cx) / tiers[o][2];
      const depth = 1 + (nx < -0.2 ? 1 : 0) + (Math.sin(x * 2.1 + o) > 0.7 ? 1 : 0);
      if (run < depth)
        g.set(
          x,
          y,
          run === depth - 1 ? (nx < 0.2 ? '#e8eef6' : PAL.lightGray) : nx < 0.3 ? PAL.white : '#e8eef6',
        );
      else if (run === depth && nx > -0.2) g.set(x, y, mix(g.get(x, y)!, PAL.slate, 0.3));
    }
  }
}

function pine(snow: boolean): Grid {
  const g = new Grid(24, 40);
  trunk(g, 12, 30, 38, 2, R.bark, 1);
  const tiers: [number, number, number][] = [
    [1, 11, 5],
    [6, 18, 7],
    [12, 25, 9],
    [18, 31, 11],
  ];
  pineTiers(g, 12, tiers, snow ? ['#10231f', PAL.deepTeal, '#1f4a42', PAL.forest, '#2f6a52'] : PINE, snow);
  if (snow) {
    g.set(12, 0, PAL.white);
    // snow at the foot of the trunk
    for (let x = 8; x < 17; x++)
      if (!g.get(x, 38) || x < 10 || x > 13) g.set(x, 38, x < 12 ? PAL.white : PAL.lightGray);
  }
  return ink(g);
}

const CHAR = ['#0f0b14', '#1b1420', '#2b1f2e', '#3a2a3a', '#4f3a4a'] as const;

function deadTree(): Grid {
  const g = new Grid(28, 36);
  trunk(g, 14, 10, 34, 2, CHAR, 2);
  const branch = (x0: number, y0: number, x1: number, y1: number, thick: boolean) => {
    g.line(x0, y0, x1, y1, (x, y) => ramp(CHAR, 0.55 - (x - 14) * 0.02, x, y, 0.3));
    if (thick) g.line(x0 + 1, y0, x1 + 1, y1, CHAR[1]);
  };
  branch(13, 16, 5, 8, true);
  branch(8, 11, 4, 4, false);
  branch(6, 9, 1, 7, false);
  branch(15, 13, 23, 5, true);
  branch(20, 8, 22, 1, false);
  branch(22, 6, 26, 5, false);
  branch(14, 11, 13, 2, true);
  branch(13, 5, 10, 1, false);
  branch(15, 22, 20, 18, false);
  // ember cracks glowing through the char
  for (const [x, y] of [
    [13, 20],
    [13, 21],
    [14, 22],
    [15, 27],
    [15, 28],
    [12, 31],
  ] as const)
    g.set(x, y, y % 2 ? PAL.orange : PAL.rust);
  g.set(14, 21, PAL.yellow);
  return ink(g, 0.1);
}

// ----------------------------------------------------------------- shrubs ---

function bush(): Grid {
  const g = new Grid(16, 14);
  canopy(
    g,
    [
      [8, 5.5, 5],
      [4.5, 8, 4],
      [11.5, 8, 4],
      [8, 9, 4.5],
    ],
    R.leaf,
    7,
    6,
    8,
    7,
    31,
  );
  g.set(5, 4, R.leaf[4]).set(6, 3, R.leaf[4]);
  // berries
  g.set(10, 7, PAL.red).set(5, 10, PAL.red).set(12, 10, PAL.red);
  return ink(g);
}

function flowers(petal: Col, petalDark: Col): Grid {
  const g = new Grid(12, 9);
  const stems: [number, number][] = [
    [2, 3],
    [5, 1],
    [8, 3],
    [10, 5],
    [4, 5],
  ];
  for (const [x, y] of stems) {
    g.vline(x, y + 1, 8, PAL.darkGreen);
    g.set(x + 1, y + 3 > 7 ? 7 : y + 3, PAL.green);
  }
  for (const [x, y] of stems) {
    g.set(x - 1, y, petal)
      .set(x + 1, y, petal)
      .set(x, y - 1, petal)
      .set(x, y + 1, petalDark);
    g.set(x, y, PAL.yellow === petal ? PAL.orange : PAL.yellow);
  }
  g.set(1, 8, PAL.forest).set(6, 8, PAL.forest).set(9, 8, PAL.forest);
  return g;
}

function grassTuft(): Grid {
  const g = new Grid(12, 9);
  const blades: [number, number, number][] = [
    [2, 4, -1],
    [4, 1, 0],
    [5, 3, 1],
    [7, 0, 0],
    [8, 3, 1],
    [10, 4, 1],
    [3, 5, 0],
    [6, 5, 0],
  ];
  for (const [x, top, lean] of blades) {
    for (let y = top; y <= 8; y++) {
      const t = (y - top) / (8 - top || 1);
      const xx = x + (t < 0.3 ? lean : 0);
      g.set(xx, y, t < 0.2 ? '#9cd455' : t < 0.6 ? PAL.green : t < 0.85 ? PAL.darkGreen : PAL.forest);
    }
  }
  return g;
}

function mushrooms(): Grid {
  const g = new Grid(12, 10);
  const shroom = (cx: number, capY: number, rx: number, stemH: number) => {
    for (let y = capY + 1; y <= capY + stemH; y++) {
      g.set(cx, y, PAL.sand);
      g.set(cx + 1, y, PAL.tan);
    }
    g.ellipse(cx + 0.5, capY + 0.5, rx, rx * 0.7, (x, y, nx, ny) =>
      ny > 0.35 ? PAL.darkRed : ramp([PAL.darkRed, PAL.red, PAL.pink], sphereLight(nx, ny), x, y, 0.2),
    );
    g.set(cx - 1, capY, PAL.white).set(cx + 1, capY - 1, PAL.white);
  };
  shroom(3, 4, 2.6, 4);
  shroom(8, 2, 3.2, 6);
  shroom(6, 6, 1.8, 2);
  return ink(g, 0.15);
}

function log(): Grid {
  const g = new Grid(24, 12);
  // body: horizontal cylinder (light on top)
  for (let x = 1; x < 20; x++)
    for (let y = 2; y < 11; y++) {
      const ny = (y + 0.5 - 6.5) / 4.5;
      let c = ramp(R.bark, 0.75 - ny * 0.6, x, y, 0.3);
      if ((x * 3 + y * 7) % 11 === 0 && ny > -0.6) c = PAL.plum;
      if (y === 5 && x % 6 < 4) c = R.bark[1];
      g.set(x, y, c);
    }
  // cut end (rings)
  g.ellipse(20.5, 6.5, 3, 4.5, (_x, _y, nx, ny) => {
    const d = Math.hypot(nx, ny);
    if (d > 0.8) return R.bark[1];
    return d > 0.55 ? PAL.tan : d > 0.3 ? PAL.sand : d > 0.15 ? PAL.tan : PAL.brown;
  });
  // moss
  for (let x = 3; x < 14; x++) if (rnd(x, 0, 9) > 0.45) g.set(x, 2, x % 3 ? PAL.darkGreen : PAL.green);
  g.set(6, 1, PAL.green).set(7, 1, PAL.darkGreen);
  return ink(g);
}

function stump(): Grid {
  const g = new Grid(16, 14);
  trunk(g, 8, 5, 13, 5, R.bark, 1);
  g.ellipse(8, 5, 5, 2.5, (_x, _y, nx, ny) => {
    const d = Math.hypot(nx, ny);
    return d > 0.75 ? PAL.brown : d > 0.45 ? PAL.sand : d > 0.2 ? PAL.tan : PAL.sand;
  });
  g.set(12, 9, PAL.darkGreen).set(11, 10, PAL.green).set(3, 11, PAL.darkGreen);
  return ink(g);
}

function reeds(): Grid {
  const g = new Grid(12, 16);
  const stalks: [number, number, boolean][] = [
    [2, 5, false],
    [4, 1, true],
    [6, 4, false],
    [7, 2, true],
    [9, 6, true],
    [10, 8, false],
  ];
  for (const [x, top, cat] of stalks) {
    g.vline(x, top, 15, top < 4 ? PAL.darkGreen : PAL.green);
    g.set(x, 15, PAL.forest).set(x, 14, PAL.forest);
    if (cat) {
      g.rect(x, top + 1, 1, 3, PAL.darkBrown);
      g.set(x, top + 1, PAL.brown);
      g.set(x, top, PAL.darkGreen);
    } else {
      g.set(x - 1, top + 1, PAL.green).set(x + 1, top + 3, PAL.darkGreen);
    }
  }
  // leaves
  g.line(3, 14, 1, 9, PAL.green);
  g.line(8, 14, 11, 10, PAL.darkGreen);
  return ink(g, 0.35);
}

// ------------------------------------------------------------------ rocks ---

function rock(
  w: number,
  h: number,
  blobs: readonly [number, number, number, number][],
  cols: readonly Col[],
  seed: number,
  moss = false,
): Grid {
  const g = new Grid(w, h);
  for (const [cx, cy, rx, ry] of blobs)
    g.ellipse(cx, cy, rx, ry, (x, y, nx, ny) => {
      let l = sphereLight(nx, ny * 0.9, 0.2);
      // flatten into facets
      l = Math.round(l * 4) / 4 + (rnd(x, y, seed) > 0.9 ? 0.1 : 0);
      return ramp(cols, l, x, y, 0.2);
    });
  // cracks
  const r = rng(seed);
  let x = Math.floor(w * 0.45 + r() * 3);
  for (let y = Math.floor(h * 0.3); y < h * 0.7; y++) {
    if (g.get(x, y)) g.set(x, y, cols[1]);
    if (r() < 0.4) x += r() < 0.5 ? 1 : -1;
  }
  if (moss)
    g.rim((_c, px, py, s) =>
      s.n && rnd(px, py, seed + 1) > 0.3 ? (px % 3 ? PAL.darkGreen : PAL.green) : undefined,
    );
  return g;
}

function rockSmall(): Grid {
  const g = rock(
    12,
    10,
    [
      [6, 5.5, 5, 4],
      [4, 6.5, 3, 3],
    ],
    R.stone,
    41,
  );
  return ink(g);
}

function rockBig(): Grid {
  const g = rock(
    24,
    20,
    [
      [10, 10, 9, 8],
      [16, 12, 7, 6.5],
      [6, 13, 5, 5],
      [12, 15, 9, 4.5],
    ],
    R.stone,
    43,
    true,
  );
  return ink(g);
}

function snowRock(): Grid {
  const g = rock(
    20,
    16,
    [
      [9, 9, 8, 6.5],
      [13, 10.5, 6, 5],
    ],
    R.stone,
    45,
  );
  // snow cap on the upper surfaces
  g.map((c, x, y) => {
    let top = y;
    while (top > 0 && g.get(x, top - 1)) top--;
    const depth = y - top;
    const lim = 3 + Math.round(Math.sin(x * 1.3) + (x < 10 ? 1 : 0));
    if (depth < lim) return x < 9 ? PAL.white : depth < lim - 1 ? '#e8eef6' : PAL.lightGray;
    if (depth === lim) return R.stone[1];
    return c;
  });
  return ink(g);
}

// ----------------------------------------------------------------- export ---

export const NATURE: PropTable = {
  tree_oak: def(32, 40, oak, { anchorX: 16, anchorY: 38, collider: foot(10, 5) }),
  tree_pine: def(24, 40, () => pine(false), { anchorX: 12, anchorY: 38, collider: foot(8, 4) }),
  tree_snowpine: def(24, 40, () => pine(true), { anchorX: 12, anchorY: 38, collider: foot(8, 4) }),
  tree_dead: def(28, 36, deadTree, { anchorX: 14, anchorY: 34, collider: foot(8, 4) }),
  bush: def(16, 14, bush, { anchorX: 8, anchorY: 13, collider: foot(12, 5) }),
  flowers_red: def(12, 9, () => flowers(PAL.red, PAL.darkRed), { anchorX: 6, anchorY: 8 }),
  flowers_blue: def(12, 9, () => flowers(PAL.sky, PAL.blue), { anchorX: 6, anchorY: 8 }),
  flowers_yellow: def(12, 9, () => flowers(PAL.yellow, PAL.gold), { anchorX: 6, anchorY: 8 }),
  grass_tuft: def(12, 9, grassTuft, { anchorX: 6, anchorY: 8 }),
  mushroom_cluster: def(12, 10, mushrooms, { anchorX: 6, anchorY: 9 }),
  log: def(24, 12, log, { anchorX: 12, anchorY: 11, collider: { x: -11, y: -7, w: 22, h: 7 } }),
  stump: def(16, 14, stump, { anchorX: 8, anchorY: 13, collider: foot(10, 5) }),
  reeds: def(12, 16, reeds, { anchorX: 6, anchorY: 15 }),
  rock_small: def(12, 10, rockSmall, { anchorX: 6, anchorY: 9, collider: foot(10, 4) }),
  rock_big: def(24, 20, rockBig, { anchorX: 12, anchorY: 19, collider: { x: -11, y: -8, w: 22, h: 9 } }),
  snow_rock: def(20, 16, snowRock, { anchorX: 10, anchorY: 15, collider: foot(16, 6) }),
};
