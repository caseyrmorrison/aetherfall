/**
 * Act II props (Solenne under the eclipsed sun): Sunscar Dunes, Sunken Temple,
 * Stormspire, Eclipse Sanctum and the oasis town itself.
 *
 * Palettes are ENDESGA-32 plus in-between shades, nudged toward dusk: warm
 * surfaces are rosier and shadows lean violet / blue so everything reads as
 * lit by a black sun's corona.
 *
 * The adobe buildings are drop-in replacements for the Havenbrook ones: same
 * image size, anchor (bottom-centre), collider and door position (bottom-centre,
 * same width) as `inn`, `shop`, `smithy`, `house_a` and `elder_house`.
 */
import { PAL } from '../../palette';
import { R, canopy, cyl, def, foot, ink, type PropTable } from './kit';
import { Grid, alpha, bayer, mix, ramp, rnd, rng, sphereLight, type Col } from './raster';

// ---------------------------------------------------------------- palettes --

const SANDSTONE = ['#4e3040', '#7a4a52', '#a4665a', '#c88468', '#e0a67c', '#f0c898'] as const;
const BONE = ['#6e5a5e', '#a8948a', '#d4c2ac', '#f0e4d0'] as const;
const PALM_LEAF = ['#10302e', '#1a4a3c', '#256446', '#3a8248', '#5fa655', '#95cc68'] as const;
const PALM_BARK = ['#3e2830', '#5e3e3c', '#80584a', '#a27a5e', '#c49c76'] as const;
const CACTUS = ['#163230', '#1f4a40', '#2c6a4c', '#43905a', '#76b86a'] as const;
const TWIG = ['#4a2e30', '#6e4a3e', '#9a7050', '#c49a68', '#e0bc84'] as const;

const RSTONE = ['#10201f', '#1d3533', '#2c4b46', '#3e625a', '#557e70', '#739a88'] as const;
const MOSS = ['#18342e', '#1f4038', '#285640', '#347048', '#4f8c54'] as const;
const MANGROVE_LEAF = ['#0e2226', '#15393a', '#1d5042', '#2a6a4c', '#3f8a52', '#6aae5e'] as const;
const MANGROVE_BARK = ['#231a22', '#3a2a2e', '#56403a', '#735846', '#8f7258'] as const;
const CORAL_PINK = ['#6a1f36', '#a22633', '#e0505a', '#f6757a', '#ffc0b0'] as const;
const CORAL_ORANGE = ['#7a2e2a', '#be4a2f', '#f77622', '#feae34', '#fee0a0'] as const;
const GLOW = ['#0e3a44', '#16707a', '#22b0b0', '#3fe0c8', '#a8fff0', PAL.white] as const;

const SLATE = ['#0f1120', '#1a1d33', '#262b44', '#343b5c', '#465078', '#5f6b96', '#8b9bb4'] as const;
const GRASS_S = ['#1f3440', '#2e4e56', '#46726e', '#6a9a8c', '#9cc8b4'] as const;
const SPARK = ['#3f7fb8', '#6fb4f0', '#9fd8ff', '#dff4ff', PAL.white] as const;

const ONYX = ['#0b0912', '#161221', '#221b30', '#302740', '#433858', '#5c4f78'] as const;
const GOLD = ['#5a3418', '#8a5a2a', '#c48a2c', '#feae34', '#fee761', '#fff6c8'] as const;

/** Lime-washed adobe: a warm cream that stands out from the sand around it. */
const ADOBE = ['#9e7462', '#c29a80', '#dcbc9c', '#ecd4b2', '#f6e6c8'] as const;
/** Clay-plastered roof decks, a little rosier and darker than the sand. */
const ROOFTOP = ['#7a4e46', '#9a6656', '#b27a62', '#c68e6e', '#dca884'] as const;
const TERRA = ['#5e2a2e', '#8a3c38', '#b0544a', '#d0735a', '#e8967a'] as const;
const TURQ = ['#123e4a', '#1d6670', '#2b9494', '#57cac2', '#a6eedf'] as const;
const BLEACHED = [PAL.plum, '#7a5048', '#a87c64', '#c49a78', '#e4c4a0'] as const;

/** Shift a ramp colour by `d` steps (no-op for colours not in the ramp). */
function step(cols: readonly Col[], c: Col, d: number): Col {
  const i = cols.indexOf(c);
  return i < 0 ? c : cols[Math.max(0, Math.min(cols.length - 1, i + d))];
}

// ===================================================================== desert

/**
 * One palm frond: a curved rib with feathery leaflets combed toward the tip.
 * deg = heading (0 = east, screen y down), droop bends it toward the ground.
 */
function palmFrond(
  g: Grid,
  cx: number,
  cy: number,
  deg: number,
  len: number,
  droop: number,
  shade: number,
): void {
  const a = (deg * Math.PI) / 180;
  const dx = Math.cos(a);
  const dy = Math.sin(a) * 0.7;
  const L = PALM_LEAF;
  const at = (k: number) => L[Math.max(0, Math.min(L.length - 1, k + shade))];
  const steps = Math.ceil(len * 1.6);
  const rib: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = cx + dx * len * t;
    const py = cy + dy * len * t + droop * len * t * t;
    const tx = dx;
    const ty = dy + 2 * droop * t;
    const tl = Math.hypot(tx, ty) || 1;
    const ux = tx / tl;
    const uy = ty / tl;
    let nx = -uy;
    let ny = ux;
    if (ny < 0 || (ny === 0 && nx < 0)) {
      nx = -nx;
      ny = -ny;
    }
    const taper = Math.pow(Math.sin(Math.PI * Math.min(1, 0.1 + t * 0.92)), 0.7);
    // leaflets: long ones hang below the rib, short ones above; alternate lengths for a serrated edge
    const lo = (1.2 + 3.2 * taper) * (i % 2 ? 0.7 : 1);
    const hi = (0.4 + 1.4 * taper) * (i % 2 ? 1 : 0.6);
    for (let s = 0.5; s <= lo; s += 0.5) {
      const x = Math.round(px + nx * s + ux * s * 0.55);
      const y = Math.round(py + ny * s + uy * s * 0.55);
      g.set(x, y, at(s < lo * 0.45 ? 3 : s < lo * 0.8 ? 2 : 1));
    }
    for (let s = 0.5; s <= hi; s += 0.5) {
      const x = Math.round(px - nx * s + ux * s * 0.55);
      const y = Math.round(py - ny * s + uy * s * 0.55);
      g.set(x, y, at(s < hi * 0.6 ? 4 : 3));
    }
    rib.push([Math.round(px), Math.round(py)]);
  }
  rib.forEach(([x, y], i) => g.set(x, y, at(i / rib.length < 0.7 ? 5 : 4)));
}

function palm(): Grid {
  const g = new Grid(40, 46);
  // gently curving, ringed trunk
  const topY = 14;
  const baseY = 44;
  for (let y = topY; y <= baseY; y++) {
    const t = (baseY - y) / (baseY - topY);
    const cx = 20.5 - 4 * Math.pow(t, 1.6);
    const hw = 2.3 - 0.5 * t + (y > baseY - 3 ? (y - (baseY - 3)) * 0.6 : 0);
    for (let x = Math.floor(cx - hw); x <= Math.ceil(cx + hw); x++) {
      const nx = (x + 0.5 - cx) / hw;
      if (Math.abs(nx) > 1.05) continue;
      let c = cyl(PALM_BARK, nx, x, y);
      if ((baseY - y) % 3 === 0) c = step(PALM_BARK, c, -1);
      else if ((baseY - y) % 3 === 1 && nx < -0.3) c = step(PALM_BARK, c, 1);
      g.set(x, y, c);
    }
  }
  const cx = 16.5;
  const cy = 13;
  // back fronds, darker
  palmFrond(g, cx, cy, -135, 12, 0.3, -2);
  palmFrond(g, cx, cy, -45, 12, 0.3, -2);
  palmFrond(g, cx, cy, -92, 9, 0.15, -1);
  // coconuts
  for (const [x, y] of [
    [15, 15],
    [18.5, 15],
    [16.5, 17],
  ] as const)
    g.ellipse(x, y, 1.7, 1.6, (px, py, nx, ny) =>
      ramp(PALM_BARK, sphereLight(nx, ny, 0.2) * 0.8, px, py, 0.2),
    );
  // side + front fronds
  palmFrond(g, cx, cy, -175, 16, 0.7, 0);
  palmFrond(g, cx, cy, -5, 16, 0.7, 0);
  palmFrond(g, cx, cy, 155, 12, 0.9, -1);
  palmFrond(g, cx, cy, 28, 13, 0.9, 0);
  palmFrond(g, cx, cy, 95, 7, 0.8, -1);
  g.set(cx - 1, cy - 1, PALM_LEAF[5]).set(cx, cy - 1, PALM_LEAF[5]);
  return ink(g, 0.2);
}

/**
 * A shaded tube along a polyline (cactus arms, roots): lit from the top-left
 * across the tube, with optional darker ribs running along it.
 */
function tube(
  g: Grid,
  pts: readonly (readonly [number, number])[],
  r: number,
  cols: readonly Col[],
  ribs = false,
): void {
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[i + 1];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    const ux = (bx - ax) / len;
    const uy = (by - ay) / len;
    for (let s = 0; s <= len; s += 0.5) {
      const cx = ax + ux * s;
      const cy = ay + uy * s;
      for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
        for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
          const ox = x + 0.5 - cx;
          const oy = y + 0.5 - cy;
          if (ox * ox + oy * oy > r * r) continue;
          // signed offset across the tube, oriented so negative faces the light
          let d = (ox * -uy + oy * ux) / r;
          if (-uy * -0.55 + ux * -0.65 < 0) d = -d;
          let c = ramp(cols, 0.62 + d * 0.55, x, y, 0.3);
          if (ribs && Math.abs(Math.abs(d) - 0.5) < 0.18) c = step(cols, c, -1);
          g.set(x, y, c);
        }
    }
  }
}

function cactus(): Grid {
  const g = new Grid(18, 28);
  // arms first so the trunk overlaps their elbows
  tube(
    g,
    [
      [8, 16],
      [3.5, 16],
      [3.5, 9],
    ],
    1.7,
    CACTUS,
    false,
  );
  tube(
    g,
    [
      [10, 12],
      [14.5, 12],
      [14.5, 5.5],
    ],
    1.7,
    CACTUS,
    false,
  );
  tube(
    g,
    [
      [9, 3],
      [9, 26],
    ],
    2.9,
    CACTUS,
    true,
  );
  // round the tops
  g.set(7, 0, CACTUS[3]).set(8, 0, CACTUS[4]).set(9, 0, CACTUS[3]).set(10, 0, CACTUS[2]);
  for (let x = 6; x <= 11; x++) g.set(x, 1, x === 11 ? CACTUS[1] : x < 9 ? CACTUS[4] : CACTUS[3]);
  // spines: tiny pale ticks along the ribs
  for (let y = 3; y < 26; y += 3) g.set(7, y, '#e8dcc8').set(11, y + 1, '#c8bca8');
  for (const [x, y] of [
    [2, 10],
    [4, 13],
    [13, 7],
    [15, 10],
  ] as const)
    g.set(x, y, '#e8dcc8');
  // night-blooming flowers
  g.set(8, 0, PAL.pink).set(9, 0, '#ffb0b8').set(10, 0, PAL.pink).set(9, 1, '#c85a6a');
  g.set(3, 7, PAL.pink).set(4, 7, '#ffb0b8');
  return ink(g, 0.2);
}

function sandstoneRock(): Grid {
  const g = new Grid(24, 20);
  g.poly(
    [
      [1.5, 19.5],
      [0.5, 14],
      [2.5, 9.5],
      [6.5, 6],
      [12, 4.5],
      [17.5, 5.5],
      [21.5, 8.5],
      [23.5, 14],
      [22.5, 19.5],
    ],
    (x, y) => {
      const nx = (x + 0.5 - 11) / 11.5;
      const ny = (y + 0.5 - 13) / 8;
      let l = sphereLight(nx * 0.9, ny, 0.22);
      if (y < 9) l += 0.2;
      l = Math.round(l * 4) / 4 + (rnd(x, y, 61) > 0.9 ? 0.08 : 0);
      return ramp(SANDSTONE, l * 0.95, x, y, 0.2);
    },
  );
  // strata ledges
  for (const [sy, k] of [
    [10, 0],
    [13, 1],
    [16, 2],
  ] as const)
    for (let x = 0; x < 24; x++) {
      const y = sy + Math.round(Math.sin(x * 0.45 + k * 2) * 0.8);
      const c = g.get(x, y);
      if (c && g.get(x, y - 1)) {
        g.set(x, y, step(SANDSTONE, c, -1));
        const up = g.get(x, y - 1)!;
        g.set(x, y - 1, step(SANDSTONE, up, 1));
      }
    }
  // loose sand on the flat top
  g.rim((c, x, y, s) => (s.n && y < 9 && rnd(x, y, 62) > 0.35 ? '#d9a47c' : c));
  g.line(8, 11, 10, 15, SANDSTONE[1]).set(10, 16, SANDSTONE[1]);
  g.set(17, 12, SANDSTONE[1]).set(18, 12, SANDSTONE[0]).set(17, 13, SANDSTONE[4]);
  return ink(g, 0.2);
}

function sandstonePillar(): Grid {
  // a wind-carved rock spire: stacked strata blocks, each ledge offset a little
  const g = new Grid(18, 40);
  const cx = 9;
  for (let y = 3; y <= 38; y++) {
    const band = Math.floor((y + 1) / 4);
    const flare = y > 32 ? (y - 32) * 0.55 : 0;
    const taper = y < 7 ? (7 - y) * 0.45 : 0;
    const wl = 3.6 + (rnd(band, 0, 501) - 0.5) * 2.2 + flare - taper;
    const wr = 3.6 + (rnd(band, 1, 501) - 0.5) * 2.2 + flare - taper;
    const ly = (y + 1) % 4;
    for (let x = Math.floor(cx - wl); x < Math.ceil(cx + wr); x++) {
      const nx = x + 0.5 < cx ? (x + 0.5 - cx) / wl : (x + 0.5 - cx) / wr;
      let s = nx < -0.45 ? 4 : nx < 0.5 ? 3 : nx < 0.85 ? 2 : 1;
      if (ly === 0 && nx < 0.85)
        s += 1; // lit ledge top
      else if (ly === 3 && bayer(x, y) > 0.3) s -= 1; // shadow under the ledge
      if (band % 3 === 1 && s > 1) s -= 1; // a darker stratum
      g.set(x, y, SANDSTONE[Math.max(0, Math.min(5, s))]);
    }
  }
  // flat, sunlit summit
  for (let x = 6; x <= 11; x++) g.set(x, 3, x < 9 ? SANDSTONE[5] : SANDSTONE[4]);
  // erosion pocks and a crack
  g.set(8, 15, SANDSTONE[0]).set(9, 15, SANDSTONE[1]).set(8, 16, SANDSTONE[1]);
  g.set(11, 22, SANDSTONE[1]).set(10, 23, SANDSTONE[1]).set(10, 24, SANDSTONE[0]).set(11, 25, SANDSTONE[1]);
  // fallen chunks + a drift of sand at the foot
  g.rect(1, 35, 3, 2, SANDSTONE[3]).set(1, 35, SANDSTONE[4]).set(3, 36, SANDSTONE[2]);
  g.rect(15, 36, 2, 2, SANDSTONE[2]).set(15, 36, SANDSTONE[4]);
  for (let x = 2; x < 17; x++) {
    const h = Math.round(1.4 - Math.abs(x - 9) * 0.15 + Math.sin(x * 1.7) * 0.5);
    for (let y = 38 - h; y <= 38; y++) g.set(x, y, y === 38 - h ? '#d8aa84' : '#c99474');
  }
  return ink(g, 0.2);
}

function ruinedObelisk(): Grid {
  const g = new Grid(16, 40);
  const S = ['#4a2e3e', '#744852', '#9c6a62', '#bf8c72', '#dcae88', '#ecc8a0'] as const;
  // plinth
  for (let y = 31; y < 39; y++)
    for (let x = 1; x < 15; x++) {
      let c: Col = S[3];
      if (y === 31) c = S[5];
      else if (y === 32) c = S[4];
      else if (x === 1) c = S[4];
      else if (x === 14) c = S[1];
      else if (y === 38) c = S[1];
      else if ((x + (y > 34 ? 3 : 0)) % 6 === 0) c = S[2];
      g.set(x, y, c);
    }
  // tapered shaft, snapped off near the top
  const brk = [9, 8, 6, 7, 5, 6, 8, 9];
  for (let y = 5; y < 31; y++) {
    const t = (y - 5) / 26;
    const hw = 2.6 + t * 1.9;
    for (let x = Math.floor(8 - hw); x < Math.ceil(8 + hw); x++) {
      const i = x - Math.floor(8 - hw);
      if (y < (brk[Math.min(7, Math.max(0, x - 4))] ?? 5)) continue;
      const nx = (x + 0.5 - 8) / hw;
      let c: Col = nx < -0.4 ? S[4] : nx < 0.35 ? S[3] : S[2];
      if (Math.abs(nx) > 0.9) c = nx < 0 ? S[4] : S[1];
      if (i >= 0 && rnd(x, y, 71) > 0.93) c = step(S, c, -1);
      g.set(x, y, c);
    }
  }
  // fracture surface
  for (let x = 4; x < 12; x++) {
    const y = brk[x - 4];
    g.set(x, y, S[5]);
  }
  // carved sun glyph (worn, a trace of gold leaf left)
  const glyph = ['.x.x.', 'x.o.x', '.ooo.', 'x.o.x', '.x.x.'];
  g.stamp(glyph, { x: S[1], o: S[1] }, 6, 14);
  g.set(8, 16, '#c48a2c').set(7, 16, S[2]);
  g.vline(8, 21, 27, S[2]).set(7, 23, S[1]).set(9, 25, S[1]);
  // chipped edge + crack
  g.set(11, 20, null).set(11, 21, null).set(10, 21, S[1]);
  g.line(6, 26, 5, 30, S[1]);
  // half-buried: sand heaped against the plinth
  for (let x = 0; x < 16; x++) {
    const h = Math.max(0, Math.round(3.2 - Math.abs(x - 4) * 0.45 + Math.sin(x * 1.3) * 0.4));
    for (let y = 39 - h; y <= 39; y++) g.set(x, y, y === 39 - h ? '#ddb089' : '#c99474');
  }
  return ink(g, 0.2);
}

function desertBones(): Grid {
  // the bleached skeleton of some great beast, half sunk in the sand
  const g = new Grid(24, 13);
  // spine
  for (let x = 9; x < 24; x++) {
    const y = 10 - Math.round(Math.sin(((x - 9) / 14) * Math.PI) * 1.2);
    g.set(x, y, BONE[2]).set(x, y + 1, BONE[0]);
    if (x % 2 === 1) g.set(x, y - 1, BONE[3]);
  }
  // ribs: tall arcs curving back toward the tail, with gaps between them
  for (const [rx, h] of [
    [11, 8],
    [14, 9],
    [17, 8],
    [20, 6],
  ] as const) {
    for (let k = 0; k <= h; k++) {
      const t = k / h;
      const x = rx + Math.round(t * t * 2.5);
      const y = 9 - k;
      g.set(x, y, t > 0.2 ? BONE[3] : BONE[2]);
      g.set(x + 1, y, BONE[1]);
    }
  }
  // horned skull in profile, snout to the west
  g.stamp(
    ['.......ab', '......ab.', '..aaaaab.', '.aabbbbbc', 'abbkkbbbc', 'abbbbbbcc', '.bcbcbcc.'],
    { a: BONE[3], b: BONE[2], c: BONE[1], k: PAL.plum },
    0,
    4,
  );
  // sand drifted against the bones
  for (const x of [0, 1, 9, 10, 13, 19, 22, 23]) g.set(x, 12, '#c99474');
  g.set(12, 11, '#c99474').set(20, 11, '#c99474');
  return ink(g, 0.3, PAL.plum);
}

const SAGE = ['#4a5a4e', '#6a7a62', '#94a07a', '#bcc49a'] as const;

function dryBush(): Grid {
  // woody desert scrub: bare, forking branches tipped with a few dusty sage leaves
  const g = new Grid(16, 12);
  const r = rng(301);
  const tips: [number, number][] = [];
  const branch = (x0: number, y0: number, ang: number, len: number, depth: number) => {
    let x = x0;
    let y = y0;
    for (let k = 0; k < len; k++) {
      x += Math.cos(ang) * 0.9;
      y += Math.sin(ang) * 0.9;
      const px = Math.round(x);
      const py = Math.round(y);
      if (py > 10) continue;
      g.set(px, py, TWIG[Math.min(3, 1 + depth + (Math.cos(ang) < -0.2 ? 1 : 0))]);
      if (depth < 1 && k === Math.floor(len * 0.5))
        branch(x, y, ang + (r() < 0.5 ? -0.55 : 0.55), len * 0.6, depth + 1);
    }
    tips.push([Math.round(x), Math.round(y)]);
  };
  for (let i = 0; i < 6; i++) {
    const ang = -Math.PI / 2 + (i / 5 - 0.5) * 2.4 + (r() - 0.5) * 0.3;
    branch(7.5, 11, ang, 5 + r() * 3, 0);
  }
  for (const [x, y] of tips) {
    g.set(x, y, SAGE[2])
      .set(x - 1, y, SAGE[1])
      .set(x, y - 1, SAGE[3])
      .set(x + 1, y, SAGE[0]);
    if (r() < 0.5) g.set(x - 1, y + 1, SAGE[0]);
  }
  g.hline(6, 9, 11, TWIG[0]).set(7, 10, TWIG[1]).set(8, 10, TWIG[0]);
  // no outline: like the grass tufts, the gaps between twigs should stay open
  return g;
}

// ===================================================================== ruins

function mangrove(): Grid {
  const g = new Grid(36, 42);
  // arching prop roots
  const roots: [number, number, number, number][] = [
    [18, 26, 3, 40],
    [18, 26, 9, 41],
    [18, 27, 26, 41],
    [18, 26, 32, 40],
    [18, 28, 14, 41],
    [18, 28, 22, 41],
  ];
  for (const [x0, y0, x1, y1] of roots) {
    const steps = 24;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t - Math.sin(t * Math.PI) * 5;
      const lit = x1 < x0;
      g.set(Math.round(x), Math.round(y), MANGROVE_BARK[lit ? 3 : 2]);
      g.set(Math.round(x), Math.round(y) + 1, MANGROVE_BARK[lit ? 2 : 1]);
    }
  }
  // short trunk
  for (let y = 18; y <= 30; y++) {
    const hw = 2.5 + (y > 26 ? (y - 26) * 0.5 : 0);
    for (let x = Math.floor(18 - hw); x < Math.ceil(18 + hw); x++)
      g.set(x, y, cyl(MANGROVE_BARK, (x + 0.5 - 18) / hw, x, y));
  }
  // barnacle / moss band where the tide sits
  for (let x = 2; x < 34; x++)
    for (let y = 36; y < 42; y++)
      if (g.get(x, y) && rnd(x, y, 311) > 0.55) g.set(x, y, rnd(x, y, 312) > 0.5 ? MOSS[2] : MOSS[1]);
  // wide, low canopy
  canopy(
    g,
    [
      [18, 8, 8, 6],
      [9, 12, 7, 5.5],
      [27, 12, 7, 5.5],
      [5, 17, 5, 4],
      [31, 17, 5, 4],
      [18, 14, 10, 7],
      [11, 19, 6.5, 4.5],
      [25, 19, 6.5, 4.5],
    ],
    MANGROVE_LEAF,
    16,
    11,
    17,
    11,
    313,
  );
  // aerial roots dangling from the canopy
  for (const [x, y0, len] of [
    [8, 21, 6],
    [13, 23, 5],
    [24, 23, 7],
    [29, 20, 5],
  ] as const)
    for (let y = y0; y < y0 + len; y++) g.set(x, y, y === y0 + len - 1 ? MANGROVE_BARK[3] : MANGROVE_BARK[1]);
  // pale blossoms
  for (const [x, y] of [
    [10, 9],
    [22, 6],
    [27, 13],
    [15, 15],
  ] as const)
    g.set(x, y, '#d8e8c0');
  return ink(g, 0.2);
}

function brokenColumn(): Grid {
  const g = new Grid(16, 30);
  const H = 30;
  // plinth
  for (let y = H - 6; y < H; y++)
    for (let x = 1; x < 15; x++) {
      let c: Col = RSTONE[3];
      if (y === H - 6) c = RSTONE[5];
      else if (y === H - 5) c = RSTONE[4];
      else if (y === H - 1) c = RSTONE[1];
      else if (x === 14) c = RSTONE[2];
      else if (x === 1) c = RSTONE[4];
      g.set(x, y, c);
    }
  g.hline(2, 13, H - 7, RSTONE[4]).hline(2, 13, H - 8, RSTONE[3]);
  // fluted shaft
  for (let y = 9; y < H - 8; y++)
    for (let x = 3; x < 13; x++) {
      let c = cyl(RSTONE, (x + 0.5 - 8) / 5, x, y, 0.05);
      if (x === 5 || x === 8 || x === 11) c = step(RSTONE, c, -1);
      g.set(x, y, c);
    }
  // snapped top: a shallow jagged break showing the lighter stone inside
  const edge = [1, 0, 0, 1, 2, 1, 0, 1, 2, 1];
  for (let x = 3; x < 13; x++) {
    const d = edge[x - 3];
    for (let y = 9; y < 9 + d; y++) g.set(x, y, null);
    g.set(x, 9 + d, RSTONE[5]);
    g.set(x, 10 + d, x < 9 ? RSTONE[4] : RSTONE[3]);
  }
  // moss cushion on the break, dripping down the flutes
  g.ellipse(6.5, 9.5, 3.8, 1.6, (x, y, nx, ny) => ramp(MOSS, sphereLight(nx, ny, 0.3) + 0.15, x, y, 0.3));
  for (const [x, y0, len] of [
    [4, 10, 4],
    [6, 11, 6],
    [9, 10, 3],
  ] as const)
    for (let y = y0; y < y0 + len; y++) g.set(x, y, y === y0 + len - 1 ? MOSS[3] : MOSS[2]);
  // a vine climbing from the base
  for (let y = 14; y < H - 6; y++) {
    const x = 11 + Math.round(Math.sin(y * 0.7));
    g.set(x, y, MOSS[2]);
    if (y % 3 === 0) g.set(x + 1, y, MOSS[4]);
  }
  // waterline algae + barnacles on the plinth
  for (let x = 1; x < 15; x++) if (rnd(x, 0, 321) > 0.4) g.set(x, H - 3, x % 2 ? MOSS[2] : MOSS[1]);
  g.set(3, H - 2, '#e8e0d0').set(12, H - 4, '#e8e0d0');
  return ink(g, 0.1);
}

function coralRock(): Grid {
  const g = new Grid(20, 16);
  g.ellipse(10, 11, 9, 4.8, (x, y, nx, ny) =>
    ramp(RSTONE, Math.round(sphereLight(nx, ny, 0.25) * 4) / 4 + 0.05, x, y, 0.2),
  );
  g.ellipse(7, 9.5, 5, 3.5, (x, y, nx, ny) =>
    ramp(RSTONE, Math.round(sphereLight(nx, ny, 0.3) * 4) / 4 + 0.15, x, y, 0.2),
  );
  // branching pink coral: thick forks with pale tips
  const twig = (pts: readonly (readonly [number, number])[]) => {
    for (let i = 0; i + 1 < pts.length; i++) {
      g.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], CORAL_PINK[2]);
      g.line(pts[i][0] + 1, pts[i][1], pts[i + 1][0] + 1, pts[i + 1][1], CORAL_PINK[1]);
    }
    const [tx, ty] = pts[pts.length - 1];
    g.set(tx, ty, CORAL_PINK[4]).set(tx + 1, ty, CORAL_PINK[3]);
  };
  twig([
    [5, 9],
    [4, 6],
    [2, 3],
  ]);
  twig([
    [4, 6],
    [5, 2],
  ]);
  twig([
    [6, 9],
    [8, 5],
    [8, 3],
  ]);
  // orange sea fan: a lattice semi-disc
  g.ellipse(14, 8, 4.5, 5, (x, y, nx, ny) => {
    if (ny > 0.35) return undefined;
    const lattice = (x + y) % 3 === 0 || (x - y + 30) % 3 === 0;
    if (!lattice && Math.hypot(nx, ny) < 0.85) return undefined;
    return nx + ny < -0.4 ? CORAL_ORANGE[3] : nx > 0.4 ? CORAL_ORANGE[1] : CORAL_ORANGE[2];
  });
  g.vline(14, 8, 10, CORAL_ORANGE[1]);
  // brain coral + barnacles
  g.ellipse(10.5, 10, 2.2, 1.7, (x, y, nx, ny) =>
    (x + y) % 2
      ? ramp([PAL.purple, PAL.magenta, '#d77bba'], sphereLight(nx, ny, 0.3), x, y, 0.2)
      : PAL.purple,
  );
  for (const [x, y] of [
    [7, 13],
    [12, 13],
    [16, 12],
    [3, 12],
  ] as const)
    g.set(x, y, '#e8e0d0').set(x + 1, y, BONE[1]);
  return ink(g, 0.15);
}

function seaweed(frame: number): Grid {
  const g = new Grid(12, 18);
  const strands: [number, number, number, number][] = [
    [2, 6, 0, 1],
    [5, 1, 1, 2],
    [7, 4, 2, 3],
    [9, 7, 3, 2],
  ];
  for (const [x0, top, ph, col] of strands) {
    for (let y = 17; y >= top; y--) {
      const t = (17 - y) / (17 - top);
      const sway = Math.round(Math.sin(y * 0.55 + ph + (frame * Math.PI) / 2) * t * 1.4);
      const x = x0 + sway;
      const c = t > 0.85 ? MOSS[4] : col === 1 ? MOSS[2] : col === 2 ? MOSS[3] : '#5e7a3a';
      g.set(x, y, c);
      if (t < 0.7 && y % 3 === 0) g.set(x + 1, y, MOSS[1]);
      if (col === 3 && y % 5 === 1 && t > 0.2) g.set(x - 1, y, '#9aa04a');
    }
  }
  return ink(g, 0.35, PAL.black);
}

function seashell(): Grid {
  const g = new Grid(13, 8);
  // spiral whelk
  g.stamp(
    ['..aab..', '.abccb.', 'abcdcbb', '.bccbbe', '..bbee.'],
    { a: BONE[3], b: BONE[2], c: '#e8b0a0', d: CORAL_PINK[2], e: BONE[1] },
    0,
    2,
  );
  // scallop, ribbed coral pink
  g.stamp(
    ['.pqpq.', 'pqpqpq', 'pqpqpq', '.qpqp.', '..rr..'],
    { p: CORAL_PINK[4], q: CORAL_PINK[3], r: CORAL_PINK[2] },
    7,
    2,
  );
  return ink(g, 0.3, PAL.plum);
}

function glowCoral(frame: number): Grid {
  const g = new Grid(14, 16);
  // rocky foot
  g.ellipse(7, 14, 5.5, 2, (x, y, nx, ny) => ramp(RSTONE, sphereLight(nx, ny, 0.25), x, y, 0.3));
  const pulse = [0, 1, 2, 1][frame];
  // antler-like forks: thick near the base, glowing polyps at every tip
  const tips: [number, number][] = [];
  const branch = (x: number, y: number, ang: number, len: number, depth: number) => {
    for (let k = 0; k < len; k++) {
      x += Math.cos(ang);
      y += Math.sin(ang);
      g.set(Math.round(x), Math.round(y), GLOW[1 + depth]);
      if (depth === 0) g.set(Math.round(x) + 1, Math.round(y), GLOW[1]);
    }
    if (depth < 2) {
      branch(x, y, ang - 0.55, len * 0.62, depth + 1);
      branch(x, y, ang + 0.5, len * 0.58, depth + 1);
    } else tips.push([Math.round(x), Math.round(y)]);
  };
  branch(6.5, 13, -Math.PI / 2 - 0.35, 4, 0);
  branch(7.5, 13, -Math.PI / 2 + 0.45, 3.5, 0);
  for (const [x, y] of tips) {
    g.set(x, y, GLOW[3 + pulse]);
    if (pulse > 0) g.set(x, y - 1, alpha(GLOW[4], 0.5 + pulse * 0.2));
  }
  // drifting spores
  const sp = [
    [2, 2],
    [12, 3],
    [1, 10],
    [13, 11],
  ][frame];
  g.set(sp[0], sp[1], alpha(GLOW[4], 0.85));
  return g.outline((inner) => (inner.length > 7 ? undefined : mix(PAL.black, inner, 0.25)));
}

// ===================================================================== storm

function stormRock(): Grid {
  const g = new Grid(22, 18);
  // jagged slate shards, each facet flat-shaded by the way it faces the light
  const facets: [readonly (readonly [number, number])[], number][] = [
    // back spire
    [
      [
        [10, 17.5],
        [11, 7],
        [15.5, 0.5],
        [19, 8],
        [21.5, 17.5],
      ],
      3,
    ],
    [
      [
        [11, 7],
        [15.5, 0.5],
        [14.5, 8],
      ],
      5,
    ],
    // front-left block
    [
      [
        [0.5, 17.5],
        [0.5, 10],
        [4, 4.5],
        [9, 3],
        [12, 9],
        [13, 17.5],
      ],
      4,
    ],
    [
      [
        [0.5, 10],
        [4, 4.5],
        [9, 3],
        [7, 9],
        [2, 12],
      ],
      6,
    ],
    // low front-right slab
    [
      [
        [11, 17.5],
        [13, 11],
        [18, 10],
        [21.5, 13],
        [21.5, 17.5],
      ],
      3,
    ],
    [
      [
        [13, 11],
        [18, 10],
        [21.5, 13],
        [16, 13],
      ],
      5,
    ],
  ];
  for (const [pts, k] of facets) g.poly(pts, (x, y) => SLATE[rnd(x, y, 331) > 0.97 ? k - 1 : k]);
  // lit ridges
  g.line(1, 10, 4, 5, SLATE[6]).line(4, 5, 8, 3, SLATE[5]);
  g.line(12, 7, 15, 1, SLATE[5]);
  g.line(13, 11, 17, 10, SLATE[5]);
  // crease shadows
  g.line(7, 9, 12, 9, SLATE[1]).line(12, 10, 13, 17, SLATE[1]);
  // rain sheen running down the faces
  for (const [x, y0, len] of [
    [4, 12, 4],
    [9, 11, 5],
    [18, 14, 3],
  ] as const)
    for (let y = y0; y < y0 + len; y++) if (g.get(x, y) && y % 2 === 0) g.set(x, y, SLATE[5]);
  // lichen + wind grass at the foot
  g.set(5, 6, GRASS_S[3]).set(6, 6, GRASS_S[2]).set(16, 11, GRASS_S[2]);
  for (const x of [1, 2, 14, 19, 20]) g.set(x, 17, GRASS_S[2]).set(x + 1, 16, GRASS_S[3]);
  return ink(g, 0.1);
}

function stormObelisk(): Grid {
  const g = new Grid(16, 40);
  // rough base stones
  g.ellipse(8, 36, 7.5, 3.5, (x, y, nx, ny) => ramp(SLATE, sphereLight(nx, ny, 0.25) + 0.1, x, y, 0.3));
  // monolith leaning slightly, with a slanted top
  for (let y = 1; y < 36; y++) {
    const t = y / 36;
    const hw = 3.2 + t * 1.6;
    const cx = 8 + (1 - t) * 0.8;
    const topCut = 1 + Math.max(0, cx + hw - 1 - 0) * 0; // cut computed per x below
    for (let x = Math.floor(cx - hw); x < Math.ceil(cx + hw); x++) {
      const cut = 1 + (x - (cx - hw)) * 0.55;
      if (y < cut + topCut - 1) continue;
      const nx = (x + 0.5 - cx) / hw;
      let c: Col = nx < -0.45 ? SLATE[4] : nx < 0.4 ? SLATE[3] : SLATE[2];
      if (Math.abs(nx) > 0.88) c = nx < 0 ? SLATE[5] : SLATE[1];
      if (y < cut + 1) c = SLATE[5];
      g.set(x, y, c);
    }
  }
  // carved lightning rune channel, faintly glowing
  const rune = ['..x', '.x.', 'xxx', '.x.', 'x..'];
  g.stamp(rune, { x: '#6fb4f0' }, 7, 12);
  g.set(8, 14, '#9fd8ff');
  for (let y = 19; y < 30; y += 2) g.set(8, y, '#3f7fb8');
  // lichen + rain streaks
  g.set(5, 9, GRASS_S[3]).set(5, 10, GRASS_S[2]).set(10, 26, GRASS_S[2]);
  for (const x of [6, 11]) for (let y = 16; y < 30; y++) if (y % 3 === 0) g.set(x, y, SLATE[5]);
  return ink(g, 0.1);
}

function thunderRod(frame: number): Grid {
  const g = new Grid(16, 40);
  // slate plinth
  for (let y = 31; y < 39; y++)
    for (let x = 2; x < 14; x++) {
      let c: Col = SLATE[3];
      if (y === 31) c = SLATE[5];
      else if (y === 32) c = SLATE[4];
      else if (x === 2) c = SLATE[4];
      else if (x === 13) c = SLATE[1];
      else if (y === 38) c = SLATE[1];
      g.set(x, y, c);
    }
  g.set(5, 35, '#3f7fb8').set(10, 35, '#3f7fb8');
  // iron rod wrapped in copper coils
  for (let y = 9; y < 31; y++) g.set(7, y, R.iron[4]).set(8, y, R.iron[2]);
  for (const y of [14, 18, 22, 26]) {
    g.hline(6, 9, y, PAL.rust).set(6, y, PAL.orangeBrown).set(9, y, PAL.darkBrown);
    g.hline(6, 9, y + 1, PAL.darkBrown);
  }
  // collar + finial
  g.hline(5, 10, 29, R.iron[3]).hline(5, 10, 30, R.iron[1]);
  g.hline(6, 9, 10, R.iron[3]).hline(6, 9, 11, R.iron[1]);
  g.set(7, 8, R.iron[4]).set(8, 8, R.iron[3]).set(7, 7, PAL.lightGray).set(8, 6, R.iron[4]);
  // crackling orb at the tip
  const orb = [2.2, 2.8, 2.4, 3][frame];
  g.ellipse(8, 5, orb, orb, (x, y, nx, ny) => {
    const d = Math.hypot(nx, ny);
    if (d > 0.8 && bayer(x, y) > 0.5) return alpha(SPARK[1], 0.7);
    return d < 0.45 ? SPARK[4] : SPARK[3 - (d > 0.7 ? 1 : 0)];
  });
  // arcs: jagged bolts that jump to new spots each frame
  const r = rng(341 + frame * 7);
  for (let a = 0; a < 3; a++) {
    let x = 8;
    let y = 5;
    const dir = r() * Math.PI * 2;
    const len = 4 + Math.floor(r() * 3);
    for (let k = 0; k < len; k++) {
      x += Math.cos(dir) * 1.2 + (r() - 0.5) * 1.4;
      y += Math.sin(dir) * 1.2 + (r() - 0.5) * 1.4;
      const px = Math.round(x);
      const py = Math.round(y);
      if (py < 0 || py > 30) break;
      g.set(px, py, k < 2 ? SPARK[3] : SPARK[2]);
    }
  }
  // stray sparks sliding down the rod
  g.set(frame % 2 ? 6 : 9, 13 + frame * 4, SPARK[3]);
  return g.outline((inner) => (inner.length > 7 || SPARK.includes(inner as never) ? undefined : '#0b0d18'));
}

function windGrass(frame: number): Grid {
  const g = new Grid(14, 12);
  const gust = [0, 1, 2, 1][frame];
  const blades: [number, number, number][] = [
    [1, 5, 0],
    [3, 2, 1],
    [5, 6, 0],
    [6, 1, 2],
    [8, 4, 1],
    [10, 3, 0],
  ];
  blades.forEach(([x0, top, lag]) => {
    const h = 11 - top;
    const g2 = Math.max(0, gust - (lag === 2 ? 1 : 0)) + (lag === 1 ? 1 : 0);
    for (let k = 0; k <= h; k++) {
      const t = k / h;
      const bend = Math.round(t * t * (1.5 + g2));
      const y = 11 - k + (t > 0.85 && g2 > 1 ? 1 : 0);
      const c = t > 0.8 ? GRASS_S[4] : t > 0.5 ? GRASS_S[3] : t > 0.2 ? GRASS_S[2] : GRASS_S[1];
      g.set(x0 + bend, y, c);
    }
    g.set(x0 - 1, 11, GRASS_S[0]).set(x0 + 1, 11, GRASS_S[1]);
  });
  return g;
}

// =================================================================== eclipse

function eclipsePillar(): Grid {
  const g = new Grid(16, 40);
  const H = 40;
  // plinth with gold band
  for (let y = H - 6; y < H; y++)
    for (let x = 1; x < 15; x++) {
      let c: Col = ONYX[3];
      if (y === H - 6) c = ONYX[5];
      else if (y === H - 5) c = ONYX[4];
      else if (y === H - 3) c = x % 4 === 1 ? GOLD[3] : GOLD[2];
      else if (y === H - 1) c = ONYX[1];
      else if (x === 14) c = ONYX[2];
      else if (x === 1) c = ONYX[4];
      g.set(x, y, c);
    }
  g.hline(2, 13, H - 7, ONYX[4]).hline(2, 13, H - 8, GOLD[2]);
  // shaft with gold-filled fluting
  for (let y = 8; y < H - 8; y++)
    for (let x = 3; x < 13; x++) {
      const nx = (x + 0.5 - 8) / 5;
      let c = cyl(ONYX, nx, x, y, 0.08);
      if (x === 5 || x === 10) c = nx < 0 ? GOLD[2] : GOLD[1];
      g.set(x, y, c);
    }
  // capital: stepped onyx under a gold abacus
  for (let x = 0; x < 16; x++) {
    g.set(x, 1, GOLD[4]);
    g.set(x, 2, x === 0 ? GOLD[3] : x === 15 ? GOLD[1] : GOLD[2]);
    g.set(x, 3, ONYX[1]);
  }
  for (let y = 4; y < 7; y++)
    for (let x = 2; x < 14; x++) g.set(x, y, cyl(ONYX, (x + 0.5 - 8) / 6, x, y, 0.15));
  g.hline(2, 13, 7, ONYX[0]);
  // eclipse emblem on the shaft
  g.ellipse(8, 15, 2.8, 2.8, (_x, _y, nx, ny) => {
    const d = Math.hypot(nx, ny);
    if (d > 0.72) return nx + ny < -0.4 ? GOLD[4] : GOLD[3];
    return PAL.black;
  });
  g.set(7, 14, ONYX[2]);
  // subtle marble veins
  g.line(4, 22, 7, 28, ONYX[4]).line(9, 25, 11, 30, ONYX[3]);
  return ink(g, 0.05, PAL.black);
}

function sunStatue(): Grid {
  const g = new Grid(24, 44);
  // pedestal
  for (let y = 30; y < 44; y++)
    for (let x = 2; x < 22; x++) {
      let c: Col = ONYX[3];
      if (y === 30) c = ONYX[5];
      else if (y === 31) c = GOLD[3];
      else if (y === 32) c = ONYX[4];
      else if (y === 43) c = ONYX[0];
      else if (x === 2) c = ONYX[4];
      else if (x === 21) c = ONYX[1];
      g.set(x, y, c);
    }
  g.hline(3, 20, 41, GOLD[2]);
  // plaque: a small sun glyph
  g.rect(9, 35, 6, 4, GOLD[2]).rect(10, 36, 4, 2, GOLD[1]).set(11, 36, GOLD[4]).set(12, 37, GOLD[3]);
  // robed figure (onyx) raising the black sun overhead
  const sh = (x: number, cx: number, w: number, y: number, bias = 0) =>
    cyl(ONYX, (x + 0.5 - cx) / w, x, y, bias);
  for (let y = 17; y < 30; y++) {
    const t = (y - 17) / 12;
    const hw = 3.2 + t * 3.4;
    for (let x = Math.floor(12 - hw); x < Math.ceil(12 + hw); x++) {
      let c = sh(x, 12, hw, y, 0.2);
      // falling folds
      if ((x === 10 || x === 14) && y > 20) c = step(ONYX, c, -1);
      if (x === 11 && y > 21) c = step(ONYX, c, 1);
      g.set(x, y, c);
    }
  }
  g.hline(6, 17, 29, ONYX[1]);
  // gold girdle + hem
  g.hline(9, 15, 21, GOLD[2]).set(12, 21, GOLD[4]).set(12, 22, GOLD[2]).set(12, 23, GOLD[1]);
  for (let x = 6; x <= 17; x += 2) g.set(x, 28, GOLD[1]);
  // hooded head
  g.ellipse(12, 14.5, 2.6, 2.7, (x, y, nx, ny) => ramp(ONYX, sphereLight(nx, ny, 0.3) + 0.25, x, y, 0.2));
  g.hline(11, 13, 16, ONYX[0]).set(12, 15, ONYX[1]);
  // arms raised in sleeves, hands on the disc
  for (const [x0, x1, c1, c2] of [
    [9, 7, ONYX[5], ONYX[4]],
    [15, 17, ONYX[4], ONYX[3]],
  ] as const) {
    g.line(x0, 18, x1, 10, c1);
    g.line(x0 + (x1 < x0 ? 1 : -1), 18, x1 + (x1 < x0 ? 1 : -1), 10, c2);
    g.line(x0 + (x1 < x0 ? -1 : 1), 18, x1 + (x1 < x0 ? -1 : 1), 12, ONYX[2]);
  }
  g.set(7, 9, GOLD[3]).set(17, 9, GOLD[3]);
  // violet rim light so the dark figure still reads on the dark sanctum floor
  g.rim((c, _x, y, s) =>
    y >= 9 && y < 29 && (s.w || s.n) && (ONYX as readonly Col[]).includes(c) ? '#7a6aa0' : undefined,
  );
  // the eclipsed sun: black disc with a blazing gold corona
  g.ellipse(12, 5, 6, 5, (_x, _y, nx, ny) => {
    const d = Math.hypot(nx, ny);
    const ang = Math.atan2(ny, nx);
    if (d > 0.82) return Math.abs(Math.sin(ang * 6)) > 0.55 ? (ny < 0 ? GOLD[4] : GOLD[3]) : undefined;
    if (d > 0.62) return nx + ny < -0.3 ? GOLD[5] : GOLD[3];
    return PAL.black;
  });
  g.set(10, 3, ONYX[2]);
  return ink(g, 0.1, PAL.black);
}

/** Golden flame (hotter, yellower tongue than the brazier flame). */
function goldFlame(g: Grid, cx: number, by: number, w: number, h: number, frame: number, seed = 0): void {
  const cols = [PAL.rust, PAL.orange, PAL.gold, PAL.yellow, '#fff3b0', PAL.white];
  const ph = frame * 1.6 + seed;
  const hh = h * (0.85 + 0.15 * Math.sin(ph * 1.3));
  for (let y = Math.floor(by - hh); y <= by; y++) {
    const t = (by - y) / hh;
    if (t < 0 || t > 1) continue;
    const width = w * Math.pow(1 - t, 0.85) * (t < 0.15 ? 0.8 + t * 1.3 : 1);
    const off = Math.sin(t * 3 + ph) * t * 1.4;
    for (let x = Math.floor(cx - width + off); x <= Math.ceil(cx + width + off); x++) {
      const d = Math.abs(x + 0.5 - (cx + off)) / Math.max(width, 0.6);
      if (d > 1) continue;
      const heat = (1 - d) * 0.8 + (1 - t) * 0.5 - 0.15;
      g.set(x, y, ramp(cols, heat, x, y, 0.4));
    }
  }
  const r = rng(frame * 17 + seed * 5 + 1);
  g.set(Math.round(cx + (r() - 0.5) * w * 1.6), Math.round(by - hh - 1 - r() * 2), PAL.gold);
}

function sunBrazier(frame: number): Grid {
  const g = new Grid(16, 28);
  // onyx column stand
  for (let y = 17; y < 27; y++)
    for (let x = 6; x < 10; x++) g.set(x, y, cyl(ONYX, (x + 0.5 - 8) / 2, x, y, 0.15));
  g.hline(4, 11, 26, ONYX[2]).hline(4, 11, 27, ONYX[0]).hline(5, 10, 25, ONYX[4]);
  g.hline(5, 10, 21, GOLD[2]);
  // gold bowl
  g.ellipse(8, 14, 6.5, 3.6, (x, y, nx, ny) =>
    ny < -0.2 ? null : ramp(GOLD.slice(0, 5), sphereLight(nx, ny, 0.3) + 0.15, x, y, 0.3),
  );
  g.hline(1, 14, 13, GOLD[4]).hline(2, 13, 12, GOLD[3]);
  g.set(1, 13, GOLD[3]).set(14, 13, GOLD[2]);
  // sun rays on the bowl
  for (const x of [3, 6, 10, 13]) g.set(x, 15, GOLD[1]);
  g.set(8, 16, PAL.black).set(7, 16, GOLD[4]).set(9, 16, GOLD[4]).set(8, 15, GOLD[4]).set(8, 17, GOLD[1]);
  // embers
  for (let x = 3; x < 13; x++)
    g.set(x, 12, (x + frame) % 3 === 0 ? PAL.white : x % 2 ? PAL.yellow : PAL.gold);
  goldFlame(g, 8, 11, 3.6, 10, frame, 1);
  goldFlame(g, 5, 11, 1.8, 5, frame + 2, 3);
  goldFlame(g, 11, 11, 1.8, 6, frame + 1, 5);
  return ink(g, 0.2, PAL.black);
}

function goldRubble(): Grid {
  const g = new Grid(16, 9);
  const chunk = (cx: number, cy: number, rx: number, ry: number) =>
    g.ellipse(cx, cy, rx, ry, (x, y, nx, ny) =>
      ramp(ONYX, Math.round(sphereLight(nx, ny, 0.3) * 3) / 3 + 0.2, x, y, 0.2),
    );
  chunk(4, 6, 3.5, 2.4);
  chunk(11, 6.5, 3, 2);
  chunk(8, 4, 2, 1.5);
  // broken gold trim pieces
  g.hline(2, 5, 4, GOLD[3]).set(2, 4, GOLD[4]).hline(3, 5, 5, GOLD[1]);
  g.set(12, 5, GOLD[3]).set(13, 5, GOLD[2]).set(11, 4, GOLD[4]);
  // a coin and a glint
  g.set(14, 8, GOLD[3]).set(15, 8, GOLD[2]).set(14, 7, GOLD[4]);
  g.set(7, 2, PAL.white);
  return ink(g, 0.15, PAL.black);
}

// ================================================================ oasis town

/** Flat roof seen from above: parapet rim around a slightly sunken, clay-plastered deck. */
function flatRoof(g: Grid, x0: number, x1: number, y0: number, y1: number): void {
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      let c: Col = rnd(x, y, 401) > 0.92 ? ROOFTOP[1] : ROOFTOP[2];
      if ((y - y0) % 4 === 0 && bayer(x, y) > 0.55) c = ROOFTOP[1];
      const rim = x <= x0 + 1 || x >= x1 - 1 || y <= y0 + 1 || y >= y1 - 1;
      if (rim) {
        c = ROOFTOP[3];
        if (y === y0 || x === x0) c = ROOFTOP[4];
        if (x === x1) c = ROOFTOP[1];
        if (y === y1) c = ROOFTOP[3];
      } else if (y === y0 + 2 || x === x0 + 2) c = ROOFTOP[0]; // inner shadow under the parapet
      g.set(x, y, c);
    }
}

/** Front parapet edge with clay drain spouts (canales) and their drip stains. */
function parapet(g: Grid, x0: number, x1: number, y: number, spouts: readonly number[]): void {
  g.hline(x0, x1, y, ROOFTOP[4]).hline(x0, x1, y + 1, ROOFTOP[1]);
  for (const sx of spouts) {
    g.set(sx, y + 1, TERRA[3])
      .set(sx + 1, y + 1, TERRA[1])
      .set(sx, y + 2, TERRA[2])
      .set(sx + 1, y + 2, TERRA[0]);
    for (let k = 3; k < 7; k++) if (bayer(sx, y + k) > 0.3) g.set(sx, y + k, ADOBE[1]);
  }
}

/** Small hanging shop sign on an iron bracket. */
function hangSign(g: Grid, x: number, y: number, icon: readonly string[]): void {
  g.hline(x - 1, x + 9, y, R.iron[1]);
  g.set(x - 1, y + 1, R.iron[1]);
  g.set(x + 1, y + 1, R.iron[2]).set(x + 7, y + 1, R.iron[2]);
  g.rect(x, y + 2, 9, 8, R.wood[1]);
  g.rect(x + 1, y + 3, 7, 6, TURQ[2]);
  g.hline(x + 1, x + 7, y + 3, TURQ[3]);
  g.stamp(
    icon,
    { w: PAL.white, y: PAL.gold, o: PAL.darkBrown, r: PAL.red, p: PAL.pink, s: PAL.lightGray },
    x + 2,
    y + 4,
  );
}

function adobeWall(g: Grid, x0: number, x1: number, y0: number, y1: number): void {
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      let c: Col = rnd(x, y, 403) > 0.93 ? ADOBE[2] : ADOBE[3];
      if (x <= x0 + 1) c = ADOBE[4];
      if (x >= x1 - 1) c = ADOBE[2];
      if (y >= y1 - 2 && bayer(x, y) > 0.35) c = ADOBE[2]; // dust splashed at the foot
      g.set(x, y, c);
    }
  // shadow under the roof lip
  for (let x = x0; x <= x1; x++) {
    g.set(x, y0, ADOBE[0]);
    if (bayer(x, y0 + 1) > 0.5) g.set(x, y0 + 1, ADOBE[1]);
  }
}

/** Protruding roof beams (vigas). */
function vigas(g: Grid, x0: number, x1: number, y: number, every = 6): void {
  for (let x = x0; x <= x1; x += every) {
    g.set(x, y, R.wood[3]).set(x + 1, y, R.wood[1]);
    g.set(x, y + 1, R.wood[1]).set(x + 1, y + 1, R.wood[0]);
    if (bayer(x, y + 2) > 0.3) g.set(x + 1, y + 2, ADOBE[1]);
  }
}

/** Round-arched opening frame; returns true when (x, y) lies inside the arch. */
function inArch(x: number, y: number, cx: number, top: number, w: number): boolean {
  const r = w / 2;
  const dx = x + 0.5 - cx;
  if (Math.abs(dx) >= r) return false;
  return y + 0.5 >= top + r - Math.sqrt(r * r - dx * dx);
}

/** Arched door: sandstone surround, turquoise-painted planks (or a dark opening with a curtain). */
function archDoor(
  g: Grid,
  cx: number,
  bottom: number,
  w: number,
  h: number,
  cols: readonly Col[] = TURQ,
  frame: Col = SANDSTONE[4],
): void {
  const top = bottom - h + 1;
  const x0 = cx - Math.floor(w / 2);
  // surround
  for (let y = top - 2; y <= bottom; y++)
    for (let x = x0 - 2; x < x0 + w + 2; x++)
      if (inArch(x, y, cx, top - 2, w + 4)) g.set(x, y, (x + y) % 5 === 0 ? SANDSTONE[3] : frame);
  for (let y = top; y <= bottom; y++)
    for (let x = x0; x < x0 + w; x++) {
      if (!inArch(x, y, cx, top, w)) continue;
      const lx = (x - x0) % 3;
      let c: Col = lx === 2 ? cols[1] : lx === 0 ? cols[3] : cols[2];
      if (y === bottom - 4 || (y === top + Math.floor(w / 2) + 1 && w >= 8)) c = cols[1];
      g.set(x, y, c);
    }
  if (w >= 10) g.vline(cx, top + 1, bottom, cols[0]);
  // iron studs + ring handle
  g.set(w >= 10 ? cx - 2 : x0 + w - 2, top + Math.floor(h / 2) + 1, PAL.gold);
  if (w >= 10) g.set(cx + 1, top + Math.floor(h / 2) + 1, PAL.gold);
  // threshold
  g.hline(x0 - 1, x0 + w, bottom, SANDSTONE[2]);
}

interface ArchWinOpts {
  lit?: boolean;
  shutters?: boolean;
  lattice?: boolean;
}

function archWindow(g: Grid, cx: number, y: number, w: number, h: number, o: ArchWinOpts = {}): void {
  const x0 = cx - Math.floor(w / 2);
  for (let yy = y - 1; yy <= y + h; yy++)
    for (let x = x0 - 1; x <= x0 + w; x++) if (inArch(x, yy, cx, y - 1, w + 2)) g.set(x, yy, SANDSTONE[4]);
  for (let yy = y; yy < y + h; yy++)
    for (let x = x0; x < x0 + w; x++) {
      if (!inArch(x, yy, cx, y, w)) continue;
      let c: Col = o.lit ? (yy < y + h / 2 ? PAL.yellow : PAL.gold) : yy < y + 2 ? '#1a2c44' : '#23304e';
      if (o.lattice && (x + yy) % 2 === 0) c = o.lit ? PAL.orange : R.wood[1];
      g.set(x, yy, c);
    }
  // sill
  g.hline(x0 - 1, x0 + w, y + h, SANDSTONE[5]).hline(x0 - 1, x0 + w, y + h + 1, ADOBE[1]);
  if (o.shutters) {
    for (let yy = y; yy < y + h; yy++) {
      g.set(x0 - 2, yy, TURQ[3]).set(x0 - 3, yy, TURQ[2]);
      g.set(x0 + w + 1, yy, TURQ[2]).set(x0 + w + 2, yy, TURQ[1]);
    }
    g.set(x0 - 3, y + 1, TURQ[1]).set(x0 + w + 2, y + 1, TURQ[0]);
  }
}

/** Striped canvas awning seen from above-front, with a scalloped hem. */
function awning(g: Grid, x0: number, x1: number, y0: number, y1: number, a: Col, b: Col, stripe = 4): void {
  for (let y = y0; y <= y1; y++)
    for (let x = x0 + Math.max(0, y0 + 1 - y); x <= x1 - Math.max(0, y0 + 1 - y); x++) {
      const s = Math.floor((x - x0) / stripe) % 2;
      let c: Col = s ? b : a;
      if (y === y0) c = mix(c, PAL.white, 0.3);
      if (y >= y1 - 1) c = mix(c, PAL.black, 0.25);
      if (y === y1 && (x - x0) % stripe === 0) continue;
      g.set(x, y, c);
    }
  for (let x = x0; x <= x1; x++) if (bayer(x, y1 + 1) > 0.3) g.set(x, y1 + 1, alpha(PAL.plum, 0.7));
}

function potAt(g: Grid, x: number, y: number, plant = true): void {
  // terracotta pot (5 wide, 4 tall) with a leafy plant
  g.rect(x, y, 5, 4, TERRA[2])
    .hline(x - 1, x + 5, y, TERRA[3])
    .vline(x + 4, y + 1, y + 3, TERRA[1]);
  g.set(x, y + 3, TERRA[1])
    .set(x + 4, y + 3, TERRA[0])
    .set(x + 1, y + 1, TERRA[3]);
  if (plant) {
    g.set(x + 1, y - 1, PALM_LEAF[4])
      .set(x + 2, y - 2, PALM_LEAF[5])
      .set(x + 3, y - 1, PALM_LEAF[3]);
    g.set(x, y - 2, PALM_LEAF[3])
      .set(x + 4, y - 3, PALM_LEAF[4])
      .set(x + 2, y - 1, PALM_LEAF[2]);
  }
}

function jarAt(g: Grid, x: number, y: number): void {
  // tall water jar (amphora) 5x7
  g.ellipse(x + 2.5, y + 4, 2.6, 3, (px, py, nx, ny) =>
    ramp(TERRA, sphereLight(nx, ny, 0.3) + 0.1, px, py, 0.2),
  );
  g.hline(x + 1, x + 3, y, TERRA[3]).set(x + 2, y + 1, TERRA[1]);
  g.hline(x + 1, x + 4, y + 3, TURQ[2]);
}

function signBoard(g: Grid, x: number, y: number, w: number, icons: readonly string[][]): void {
  g.rect(x, y, w, 9, R.wood[1]);
  g.rect(x + 1, y + 1, w - 2, 7, TURQ[2]);
  g.hline(x + 1, x + w - 2, y + 1, TURQ[3]);
  icons.forEach((rows, i) =>
    g.stamp(
      rows,
      { w: PAL.white, y: PAL.gold, o: PAL.darkBrown, r: PAL.red, p: PAL.pink, s: PAL.lightGray },
      x + 2 + i * 8,
      y + 2,
    ),
  );
}

const ICON = {
  mug: ['.www.', 'yyyyo', 'yyy.o', 'yyyyo', '.yy..'],
  bed: ['w....', 'wrrrr', 'wrrrr', 'wwwww', 'w...w'],
  coin: ['.yyy.', 'yyoyy', 'yoyoy', 'yyoyy', '.yyy.'],
  potion: ['..w..', '.rrr.', 'rrrrr', 'rpprr', '.rrr.'],
  anvil: ['ssss.', '.ssss', '..s..', '.sss.', 'sssss'],
};

function adobeHouse(): Grid {
  const g = new Grid(48, 52);
  flatRoof(g, 2, 45, 5, 20);
  // rooftop stair hut with a little dome, a water jar and a potted palm
  flatRoof(g, 29, 41, 0, 7);
  adobeWall(g, 29, 41, 8, 12);
  archDoor(g, 35, 12, 4, 5, [PAL.plum, '#3e2731', '#4a2e36', '#5a3a3e'], SANDSTONE[4]);
  jarAt(g, 7, 9);
  potAt(g, 14, 14);
  parapet(g, 2, 45, 20, [8, 39]);
  adobeWall(g, 3, 44, 22, 50);
  vigas(g, 6, 42, 23);
  // upper and lower arched windows
  archWindow(g, 11, 27, 4, 4, { lattice: true });
  archWindow(g, 37, 27, 4, 4, { lattice: true });
  archWindow(g, 11, 37, 6, 7, { shutters: true });
  archWindow(g, 37, 37, 6, 7, { shutters: true, lattice: true });
  // sandstone plinth
  for (let x = 3; x <= 44; x++) {
    g.set(x, 48, SANDSTONE[4]);
    g.set(x, 49, x % 6 === 0 ? SANDSTONE[2] : SANDSTONE[3]);
    g.set(x, 50, SANDSTONE[3]);
    g.set(x, 51, SANDSTONE[1]);
  }
  // small striped awning over the door
  awning(g, 17, 31, 29, 32, TERRA[2], ADOBE[4], 3);
  archDoor(g, 24, 51, 8, 16);
  potAt(g, 30, 45);
  return ink(g, 0.15);
}

function adobeInn(): Grid {
  const g = new Grid(64, 66);
  flatRoof(g, 2, 61, 5, 20);
  // rooftop terrace: a shade canopy over cushions, plants and jars
  for (const x of [8, 26]) for (let y = 4; y < 14; y++) g.set(x, y, R.wood[3]).set(x + 1, y, R.wood[1]);
  g.rect(11, 11, 5, 2, TERRA[3])
    .rect(18, 11, 5, 2, TURQ[3])
    .hline(11, 15, 12, TERRA[1])
    .hline(18, 22, 12, TURQ[1]);
  awning(g, 6, 29, 2, 6, TURQ[2], ADOBE[4], 3);
  potAt(g, 42, 12);
  jarAt(g, 52, 8);
  potAt(g, 34, 14, false);
  parapet(g, 2, 61, 20, [6, 31, 57]);
  // upper floor with lit arched windows
  adobeWall(g, 3, 60, 22, 44);
  vigas(g, 5, 59, 23);
  for (const cx of [11, 25, 39, 53])
    archWindow(g, cx, 28, 6, 9, { lit: true, lattice: cx === 25 || cx === 39 });
  // carved wooden balcony rail
  for (let x = 2; x <= 61; x++) {
    g.set(x, 41, R.wood[3]);
    g.set(x, 42, x % 3 === 0 ? R.wood[3] : R.wood[0]);
    g.set(x, 43, R.wood[1]);
    g.set(x, 44, bayer(x, 44) > 0.5 ? ADOBE[0] : R.wood[0]);
  }
  // ground floor
  adobeWall(g, 3, 60, 45, 64);
  for (let x = 3; x <= 60; x++) {
    g.set(x, 63, x % 7 === 0 ? SANDSTONE[2] : SANDSTONE[3]);
    g.set(x, 64, SANDSTONE[3]);
    g.set(x, 65, SANDSTONE[1]);
  }
  archWindow(g, 10, 51, 8, 7, { lit: true, lattice: true });
  archWindow(g, 54, 51, 8, 7, { lit: true, lattice: true });
  awning(g, 22, 42, 45, 48, TERRA[2], ADOBE[4], 3);
  archDoor(g, 32, 65, 12, 16, [R.wood[0], R.wood[1], R.wood[2], R.wood[3]], SANDSTONE[4]);
  // hanging signs flanking the door: mug and bed
  hangSign(g, 15, 49, ICON.mug);
  hangSign(g, 41, 49, ICON.bed);
  // lanterns by the door
  for (const x of [24, 40])
    g.set(x, 51, R.iron[1]).set(x, 52, PAL.yellow).set(x, 53, PAL.gold).set(x, 54, R.iron[1]);
  return ink(g, 0.15);
}

function adobeShop(): Grid {
  const g = new Grid(64, 50);
  flatRoof(g, 2, 61, 3, 18);
  // sign board on the parapet
  signBoard(g, 23, 6, 18, [ICON.potion, ICON.coin]);
  g.vline(24, 15, 17, R.wood[1]).vline(39, 15, 17, R.wood[1]);
  jarAt(g, 8, 8);
  jarAt(g, 51, 7);
  parapet(g, 2, 61, 18, []);
  adobeWall(g, 3, 60, 20, 47);
  vigas(g, 5, 59, 21, 7);
  // display arches full of wares
  for (const cx of [14, 50]) {
    archWindow(g, cx, 29, 14, 10, {});
    for (let i = 0; i < 4; i++) {
      const bx = cx - 6 + i * 3 + 1;
      const bc = [PAL.red, TURQ[3], PAL.green, PAL.gold][i];
      g.set(bx, 33, PAL.lightGray).rect(bx, 34, 2, 3, bc).set(bx, 34, PAL.white);
    }
    g.hline(cx - 6, cx + 6, 37, R.wood[2]);
    // rolled rugs leaning in the window
    g.set(cx + 5, 32, TERRA[3]).vline(cx + 5, 33, 37, TERRA[2]);
  }
  // long striped awning (turquoise / cream)
  awning(g, 4, 59, 21, 27, TURQ[2], '#f0dcc0', 4);
  for (let x = 3; x <= 60; x++) {
    g.set(x, 46, SANDSTONE[4]);
    g.set(x, 47, SANDSTONE[3]);
    g.set(x, 48, x % 6 === 0 ? SANDSTONE[2] : SANDSTONE[3]);
    g.set(x, 49, SANDSTONE[1]);
  }
  archDoor(g, 32, 49, 8, 16);
  potAt(g, 22, 44, false);
  potAt(g, 38, 44);
  return ink(g, 0.15);
}

function adobeSmithy(): Grid {
  const g = new Grid(64, 50);
  flatRoof(g, 2, 61, 6, 21);
  // tall sandstone chimney with forge glow
  for (let y = 0; y < 16; y++)
    for (let x = 48; x < 57; x++) {
      let c: Col = (x + Math.floor(y / 3) * 2) % 4 === 0 || y % 3 === 2 ? SANDSTONE[2] : SANDSTONE[4];
      if (x === 48) c = SANDSTONE[5];
      if (x === 56) c = SANDSTONE[1];
      g.set(x, y, c);
    }
  g.hline(47, 57, 0, SANDSTONE[5]).hline(47, 57, 1, SANDSTONE[2]);
  g.hline(49, 55, 0, PAL.orange).set(52, 0, PAL.yellow);
  // firewood stacked on the roof to dry
  for (const [x, y] of [
    [9, 13],
    [12, 13],
    [15, 13],
    [10.5, 10.5],
    [13.5, 10.5],
  ] as const)
    g.ellipse(x, y, 1.6, 1.4, (_px, _py, nx, ny) => {
      const d = Math.hypot(nx, ny);
      return d > 0.7 ? (nx + ny < 0 ? R.wood[3] : R.wood[1]) : d > 0.3 ? PAL.tan : R.wood[2];
    }).set(Math.round(x), Math.round(y), R.wood[2]);
  jarAt(g, 22, 10);
  parapet(g, 2, 61, 21, [30, 44]);
  // heavy sandstone block walls
  for (let y = 23; y <= 49; y++) {
    const row = Math.floor((y - 23) / 4);
    const ly = (y - 23) % 4;
    const off = row % 2 ? 4 : 0;
    for (let x = 3; x <= 60; x++) {
      const lx = (x - 3 + off) % 8;
      let c: Col = rnd(Math.floor((x - 3 + off) / 8), row, 411) > 0.6 ? SANDSTONE[3] : SANDSTONE[4];
      if (ly === 3 || lx === 7) c = SANDSTONE[1];
      else if (ly === 0) c = SANDSTONE[5];
      else if (lx === 0) c = mix(c, SANDSTONE[5], 0.5);
      if (x >= 59) c = step(SANDSTONE, c, -1);
      g.set(x, y, c);
    }
  }
  for (let x = 3; x <= 60; x++) g.set(x, 23, ADOBE[0]);
  // the open forge mouth: soot-dark inside, coals glowing along the hearth
  for (let y = 26; y <= 38; y++)
    for (let x = 5; x <= 21; x++) {
      if (!inArch(x, y, 13, 26, 16)) continue;
      const inner = inArch(x, y, 13, 28, 12) && x >= 7 && x <= 18;
      let c: Col = SANDSTONE[(x + y) % 4 === 0 ? 4 : 5];
      if (inner) {
        c = y < 32 ? '#2a1a24' : y < 34 ? '#4a1e26' : y < 36 ? PAL.darkRed : y < 37 ? PAL.orange : PAL.yellow;
        if (y >= 34 && (x * 3 + y) % 4 === 0) c = y < 36 ? PAL.rust : PAL.gold;
      }
      g.set(x, y, c);
    }
  // tongs and a hammer hanging inside
  g.vline(10, 29, 32, R.iron[3])
    .vline(11, 29, 31, R.iron[2])
    .set(15, 29, R.iron[3])
    .rect(14, 30, 3, 2, R.iron[2]);
  g.hline(5, 21, 39, SANDSTONE[2]);
  // heavy door with iron bands
  archDoor(g, 32, 49, 10, 17, [PAL.plum, PAL.darkBrown, '#7a4538', '#8f5a44'], SANDSTONE[4]);
  for (const y of [38, 44]) g.hline(28, 36, y, R.iron[2]);
  // anvil sign
  g.hline(41, 51, 26, R.iron[1]).set(41, 27, R.iron[1]);
  g.rect(42, 28, 9, 8, R.wood[1]).rect(43, 29, 7, 6, TURQ[2]).hline(43, 49, 29, TURQ[3]);
  g.stamp(ICON.anvil, { s: PAL.lightGray }, 44, 30);
  // anvil on a stump outside
  g.rect(51, 43, 6, 6, R.wood[1]);
  g.rect(52, 43, 4, 5, R.wood[2]);
  g.hline(49, 58, 40, R.iron[3]).hline(50, 58, 41, R.iron[2]).rect(52, 42, 4, 1, R.iron[1]);
  g.set(49, 40, R.iron[4]).set(58, 41, R.iron[1]);
  // water jars
  jarAt(g, 5, 41);
  jarAt(g, 11, 42);
  return ink(g, 0.15);
}

function adobeHall(): Grid {
  const g = new Grid(56, 58);
  flatRoof(g, 2, 53, 11, 29);
  // drum: a ring of small arched windows under a gold band
  for (let y = 19; y <= 28; y++)
    for (let x = 16; x <= 40; x++) {
      let c: Col = x < 18 ? ADOBE[4] : x > 38 ? ADOBE[1] : ADOBE[3];
      if (y === 19) c = GOLD[3];
      else if (y === 20) c = GOLD[1];
      else if (y === 28) c = ADOBE[0];
      g.set(x, y, c);
    }
  for (const cx of [20, 26, 32, 38]) {
    if (cx > 38) continue;
    g.rect(cx - 1, 23, 2, 4, PAL.plum)
      .set(cx - 1, 23, ADOBE[2])
      .set(cx, 23, '#3e2731');
  }
  // turquoise tiled dome with a gold finial
  g.ellipse(28.5, 19, 12.5, 12, (x, y, nx, ny) => {
    if (ny > 0) return undefined;
    const l = sphereLight(nx, ny * 0.9, 0.2) + 0.12;
    let c = ramp(TURQ, l, x, y, 0.3);
    if ((x + (y >> 1)) % 4 === 0 && l > 0.3) c = step(TURQ, c, -1);
    if (y % 3 === 0 && l > 0.5) c = step(TURQ, c, 1);
    return c;
  });
  g.vline(28, 3, 7, GOLD[3]).set(27, 5, GOLD[2]).set(29, 5, GOLD[2]);
  g.ellipse(28.5, 2, 1.5, 1.5, (_x, _y, nx) => (nx < 0 ? GOLD[4] : GOLD[3]));
  // corner urns on the parapet
  jarAt(g, 5, 17);
  jarAt(g, 46, 17);
  parapet(g, 2, 53, 29, [7, 48]);
  adobeWall(g, 3, 52, 31, 56);
  vigas(g, 5, 51, 32, 6);
  // star window above the door
  g.ellipse(28, 37, 3.5, 3.5, (x, y, nx, ny) => {
    const d = Math.hypot(nx, ny);
    if (d > 0.75) return GOLD[2];
    if (d < 0.3) return PAL.white;
    return (x + y) % 2 ? TURQ[3] : PAL.gold;
  });
  // columns flanking the door
  for (const x of [20, 35]) {
    for (let y = 41; y < 55; y++)
      g.set(x, y, cyl(SANDSTONE.slice(1), -0.3, x, y)).set(x + 1, y, cyl(SANDSTONE.slice(1), 0.6, x + 1, y));
    g.hline(x - 1, x + 2, 40, GOLD[3]).hline(x - 1, x + 2, 41, SANDSTONE[3]);
  }
  archWindow(g, 10, 40, 7, 8, { shutters: true, lattice: true });
  archWindow(g, 46, 40, 7, 8, { shutters: true, lattice: true });
  // banners: turquoise with a gold sun
  for (const x of [15, 39]) {
    g.rect(x, 42, 3, 7, TURQ[2]).vline(x + 2, 42, 48, TURQ[1]);
    g.hline(x, x + 2, 42, GOLD[3])
      .set(x + 1, 45, GOLD[4])
      .set(x + 1, 49, TURQ[1]);
  }
  for (let x = 3; x <= 52; x++) {
    g.set(x, 54, SANDSTONE[4]);
    g.set(x, 55, x % 6 === 0 ? SANDSTONE[2] : SANDSTONE[3]);
    g.set(x, 56, SANDSTONE[3]);
    g.set(x, 57, SANDSTONE[1]);
  }
  archDoor(g, 28, 57, 10, 18, [PAL.plum, PAL.darkBrown, '#7a4538', '#9a5b45'], GOLD[2]);
  // steps
  g.hline(21, 35, 57, SANDSTONE[5]);
  return ink(g, 0.15);
}

function marketAwning(): Grid {
  const g = new Grid(34, 30);
  // rug laid on the sand
  for (let y = 22; y < 29; y++)
    for (let x = 4; x < 30; x++) {
      let c: Col = (x + y) % 4 < 2 ? TERRA[2] : TERRA[1];
      if (y === 22 || y === 28 || x === 4 || x === 29) c = PAL.gold;
      else if ((x - 16) % 6 === 0 || y === 25) c = TURQ[2];
      g.set(x, y, c);
    }
  // wares: pots, a basket of dates, folded cloth
  potAt(g, 6, 20, false);
  jarAt(g, 12, 17);
  g.ellipse(21, 22, 3, 1.6, R.wood[2])
    .hline(19, 23, 21, PAL.darkRed)
    .set(20, 20, PAL.red)
    .set(22, 20, PAL.darkRed);
  g.rect(25, 20, 4, 3, TURQ[3]).hline(25, 28, 20, TURQ[4]).hline(25, 28, 22, TURQ[1]);
  // poles
  for (const x of [2, 30]) for (let y = 6; y < 29; y++) g.set(x, y, R.wood[3]).set(x + 1, y, R.wood[1]);
  // striped canopy (terracotta / cream) sagging between the poles
  for (let y = 1; y <= 9; y++) {
    const inset = Math.max(0, 3 - y);
    for (let x = 1 + inset; x <= 32 - inset; x++) {
      const sag = Math.round(Math.sin(((x - 1) / 31) * Math.PI) * 1.2);
      const yy = y + (y > 6 ? sag : 0);
      const s = Math.floor((x - 1) / 4) % 2;
      let c: Col = s ? '#f0dcc0' : TERRA[2];
      if (y === 1) c = s ? PAL.white : TERRA[3];
      if (y >= 8) c = s ? ADOBE[3] : TERRA[1];
      if (y === 9 && (x - 1) % 4 === 0) continue;
      g.set(x, yy, c);
    }
  }
  // tassels
  for (let x = 3; x <= 31; x += 4)
    g.set(x, 11 + Math.round(Math.sin(((x - 1) / 31) * Math.PI) * 1.2), PAL.gold);
  return ink(g, 0.15);
}

function sandCrate(): Grid {
  const g = new Grid(14, 14);
  const W = BLEACHED;
  g.rect(1, 1, 12, 3, W[4]);
  g.hline(1, 12, 3, W[3]);
  for (let y = 4; y < 13; y++)
    for (let x = 1; x < 13; x++) {
      let c: Col = (y - 4) % 3 === 2 ? W[1] : W[3];
      if (x === 1 || x === 12 || y === 4 || y === 12) c = W[2];
      g.set(x, y, c);
    }
  // rope lashing
  for (let y = 1; y < 13; y++)
    g.set(4, y, y < 4 ? '#e8d0a0' : '#c8a878').set(9, y, y < 4 ? '#e8d0a0' : '#c8a878');
  // stamped sun
  g.set(6, 7, TERRA[2]).set(7, 7, TERRA[2]).set(6, 8, TERRA[2]).set(7, 8, TERRA[2]);
  g.set(5, 7, TERRA[1]).set(8, 8, TERRA[1]).set(6, 6, TERRA[1]).set(7, 9, TERRA[1]);
  return ink(g);
}

// ------------------------------------------------------------------ export --

export const ACT2: PropTable = {
  // desert
  palm_tree: def(40, 46, palm, { anchorX: 20, anchorY: 44, collider: foot(8, 4) }),
  cactus: def(18, 28, cactus, { anchorX: 9, anchorY: 26, collider: foot(8, 4) }),
  sandstone_rock: def(24, 20, sandstoneRock, {
    anchorX: 12,
    anchorY: 19,
    collider: { x: -11, y: -8, w: 22, h: 9 },
  }),
  sandstone_pillar: def(18, 40, sandstonePillar, { anchorX: 9, anchorY: 38, collider: foot(12, 5) }),
  ruined_obelisk: def(16, 40, ruinedObelisk, { anchorX: 8, anchorY: 38, collider: foot(12, 5) }),
  desert_bones: def(24, 13, desertBones, { anchorX: 12, anchorY: 12 }),
  dry_bush: def(16, 12, dryBush, { anchorX: 8, anchorY: 11 }),
  // ruins
  mangrove_tree: def(36, 42, mangrove, { anchorX: 18, anchorY: 40, collider: foot(10, 5) }),
  broken_column: def(16, 30, brokenColumn, { anchorX: 8, anchorY: 29, collider: foot(14, 6) }),
  coral_rock: def(20, 16, coralRock, { anchorX: 10, anchorY: 15, collider: foot(16, 6) }),
  seaweed: def(12, 18, seaweed, { anchorX: 6, anchorY: 17, frames: 4, fps: 4 }),
  seashell: def(13, 8, seashell, { anchorX: 6, anchorY: 7 }),
  glow_coral: def(14, 16, glowCoral, {
    anchorX: 7,
    anchorY: 15,
    frames: 4,
    fps: 4,
    light: { radius: 36, color: '#3fe0c8' },
  }),
  // storm
  storm_rock: def(22, 18, stormRock, { anchorX: 11, anchorY: 17, collider: { x: -10, y: -7, w: 20, h: 8 } }),
  storm_obelisk: def(16, 40, stormObelisk, { anchorX: 8, anchorY: 38, collider: foot(12, 5) }),
  thunder_rod: def(16, 40, thunderRod, {
    anchorX: 8,
    anchorY: 38,
    frames: 4,
    fps: 10,
    collider: foot(10, 5),
    light: { radius: 52, color: '#9fd8ff' },
  }),
  wind_grass: def(14, 12, windGrass, { anchorX: 7, anchorY: 11, frames: 4, fps: 5 }),
  // eclipse
  eclipse_pillar: def(16, 40, eclipsePillar, { anchorX: 8, anchorY: 39, collider: foot(14, 6) }),
  sun_statue: def(24, 44, sunStatue, { anchorX: 12, anchorY: 43, collider: foot(20, 10) }),
  sun_brazier: def(16, 28, sunBrazier, {
    anchorX: 8,
    anchorY: 27,
    frames: 4,
    fps: 8,
    collider: foot(10, 4),
    light: { radius: 56, color: '#feae34' },
  }),
  gold_rubble: def(16, 9, goldRubble, { anchorX: 8, anchorY: 8 }),
  // oasis town: drop-in replacements for the Havenbrook buildings
  adobe_house: def(48, 52, adobeHouse, {
    anchorX: 24,
    anchorY: 51,
    collider: { x: -21, y: -40, w: 42, h: 41 },
  }),
  adobe_inn: def(64, 66, adobeInn, { anchorX: 32, anchorY: 65, collider: { x: -29, y: -53, w: 58, h: 54 } }),
  adobe_shop: def(64, 50, adobeShop, {
    anchorX: 32,
    anchorY: 49,
    collider: { x: -29, y: -38, w: 58, h: 39 },
  }),
  adobe_smithy: def(64, 50, adobeSmithy, {
    anchorX: 32,
    anchorY: 49,
    collider: { x: -29, y: -36, w: 58, h: 37 },
  }),
  adobe_hall: def(56, 58, adobeHall, {
    anchorX: 28,
    anchorY: 57,
    collider: { x: -25, y: -44, w: 50, h: 45 },
  }),
  market_awning: def(34, 30, marketAwning, { anchorX: 17, anchorY: 29 }),
  sand_crate: def(14, 14, sandCrate, { anchorX: 7, anchorY: 13, collider: foot(12, 7) }),
};
