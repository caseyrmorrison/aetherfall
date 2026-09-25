/**
 * Bosses. Big front-facing set pieces (dirs 1) plus the two humanoid bosses
 * (Seraphine, Malachar) which are side-view (dirs 2, facing RIGHT).
 */
import { PAL } from '../../palette';
import type { AnimName, BossId } from '../types';
import { Buf, INK, mix, shade, type Col, type Pt, type Ramp } from './buf';
import { anims, type SpriteDef } from './defs';
import { rng, tri } from './shapes';

const K = '#000000';

function layer(w: number, h: number, ramp: Ramp, draw: (l: Buf) => void, rim = 0.28, bias = 0): Buf {
  const l = new Buf(w, h);
  draw(l);
  return shade(l, ramp, { rim, bias });
}

/** Sample a quadratic bezier. */
function bez(a: Pt, c: Pt, d: Pt, n: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push([
      u * u * a[0] + 2 * u * t * c[0] + t * t * d[0],
      u * u * a[1] + 2 * u * t * c[1] + t * t * d[1],
    ]);
  }
  return out;
}

/** Tapered stroke along points (thickness t0 → t1). */
function stroke(b: Buf, pts: Pt[], t0: number, t1: number, col: Col): void {
  pts.forEach(([x, y], i) => {
    const t = pts.length > 1 ? i / (pts.length - 1) : 0;
    const r = Math.max(0.5, (t0 + (t1 - t0) * t) / 2);
    b.ellipse(x, y, r, r, col);
  });
}

/** A faceted crystal prism from base (x,y) pointing along angle (radians, 0 = up). */
function crystal(
  b: Buf,
  x: number,
  y: number,
  w: number,
  len: number,
  ang: number,
  ramp: Ramp,
  edge: Col = INK,
): void {
  const s = Math.sin(ang);
  const c = -Math.cos(ang);
  // axis (dx, dy) and normal
  const ax = s;
  const ay = c;
  const nx = -ay;
  const ny = ax;
  const P = (along: number, across: number): Pt => [
    x + ax * along + nx * across,
    y + ay * along + ny * across,
  ];
  const l = new Buf(b.w, b.h);
  l.poly([P(0, -w / 2), P(len * 0.75, -w / 2), P(len, 0), P(len * 0.75, w / 2), P(0, w / 2)], K);
  // facets: left half light, right half dark, spine highlight
  l.each((_c, px, py) => {
    const rx = px + 0.5 - x;
    const ry = py + 0.5 - y;
    const across = rx * nx + ry * ny;
    const along = rx * ax + ry * ay;
    const t = along / len;
    let i = across < -w * 0.12 ? 2 : across > w * 0.12 ? 0 : 1;
    if (t > 0.8 && i === 0) i = 1;
    l.set(px, py, ramp[Math.min(ramp.length - 1, i + (t > 0.55 && i === 2 ? 1 : 0))]);
  });
  b.overlay(l, edge, 'all');
}

// =============================================================== THORNMAW ===

const TM = {
  bulb: [PAL.plum, PAL.darkRed, PAL.red, PAL.pink] as Ramp,
  leaf: [PAL.deepTeal, PAL.forest, PAL.darkGreen, PAL.green] as Ramp,
  vine: [PAL.deepTeal, PAL.forest, PAL.darkGreen] as Ramp,
  maw: ['#1a0d1c', PAL.plum] as Ramp,
};

function thornmaw(anim: AnimName, f: number): Buf {
  const W = 48;
  const H = 48;
  const b = new Buf(W, H);
  let bob = [0, 1, 1, 0][f % 4];
  let open = [1.2, 1.6, 2.2, 1.6][f % 4];
  let vineUp = [0, 1, 2, 1][f % 4];
  let vineMode: 'idle' | 'raise' | 'slam' = 'idle';
  let rx = 14.5;
  let ry = 11.5;
  let shake = 0;
  let eyes: 'open' | 'shut' | 'wide' = 'open';
  if (anim === 'attack') {
    vineMode = f === 0 ? 'raise' : 'slam';
    bob = f === 0 ? -1 : 2;
    open = f === 0 ? 2 : 3;
  } else if (anim === 'special') {
    open = [5, 8.5, 8.5][f];
    bob = [-1, -2, -2][f];
    shake = f === 2 ? 1 : 0;
    eyes = 'wide';
    vineUp = 3;
  } else if (anim === 'hurt') {
    rx = 15.5;
    ry = 10.5;
    bob = 2;
    open = 0.6;
    eyes = 'shut';
  }
  const cx = 24 + shake;
  const cy = 18 + bob;

  // ---- vines (behind)
  const vine = (side: number, phase: number): void => {
    const base: Pt = [24 + side * 6, 40];
    let ctrl: Pt;
    let tip: Pt;
    if (vineMode === 'raise') {
      ctrl = [24 + side * 22, 26];
      tip = [24 + side * 14, 2 + phase];
    } else if (vineMode === 'slam') {
      ctrl = [24 + side * 18, 20];
      tip = [24 + side * 23, 42 - phase * 2];
    } else {
      ctrl = [24 + side * 20, 30 - vineUp];
      tip = [24 + side * (19 - phase), 10 - vineUp + phase * 2];
    }
    const pts = bez(base, ctrl, tip, 26);
    const l = new Buf(W, H);
    stroke(l, pts, 4, 1.2, K);
    shade(l, TM.vine, { rim: 0.3 });
    b.overlay(l, INK, 'all');
    // thorns
    for (let i = 3; i < pts.length - 2; i += 4) {
      const [x, y] = pts[i];
      const [x2, y2] = pts[i + 1];
      const nx = -(y2 - y);
      const ny = x2 - x;
      const n = Math.hypot(nx, ny) || 1;
      const o = i % 8 === 3 ? 1 : -1;
      const tx = x + (nx / n) * 2.6 * o;
      const ty = y + (ny / n) * 2.6 * o;
      b.set(tx, ty, PAL.sand);
      b.set((x + tx) / 2, (y + ty) / 2, PAL.tan);
    }
  };
  vine(-1, f % 2);
  vine(1, (f + 1) % 2);

  // ---- leaves at the base
  const leaf = (tip: Pt, root: Pt, width: number): void => {
    const mx = (tip[0] + root[0]) / 2;
    const my = (tip[1] + root[1]) / 2;
    const dx = tip[0] - root[0];
    const dy = tip[1] - root[1];
    const n = Math.hypot(dx, dy) || 1;
    const px = (-dy / n) * width;
    const py = (dx / n) * width;
    const l = new Buf(W, H);
    l.poly([root, [mx + px, my + py], tip, [mx - px, my - py]], K);
    shade(l, TM.leaf, { rim: 0.3 });
    b.overlay(l, INK, 'all');
    b.line(root[0], root[1], (mx + tip[0]) / 2, (my + tip[1]) / 2, PAL.forest);
  };
  leaf([3, 44], [22, 42], 3.5);
  leaf([45, 44], [26, 42], 3.5);
  leaf([9, 36], [22, 42], 3);
  leaf([39, 36], [26, 42], 3);

  // ---- stalk
  const st = layer(W, H, TM.leaf, (l) => {
    stroke(l, bez([24, 45], [22 + shake, 36], [cx, cy + ry - 2], 12), 9, 7, K);
  });
  b.overlay(st, INK, 'all');
  b.hline(19, 29, 45, PAL.forest).hline(20, 28, 46, PAL.deepTeal);
  leaf([14, 45], [24, 44], 2.2);
  leaf([34, 45], [24, 44], 2.2);

  // ---- leafy collar under the bulb
  for (const [tx, ty] of [
    [cx - 13, cy + ry + 2],
    [cx - 6, cy + ry + 5],
    [cx + 6, cy + ry + 5],
    [cx + 13, cy + ry + 2],
  ] as const) {
    leaf([tx, ty], [cx + (tx < cx ? -2 : 2), cy + ry - 3], 2.4);
  }

  // ---- bulb with a dropping jaw
  const mouthY = Math.round(cy + 2);
  const drop = Math.max(0, Math.round(open - 2));
  const bulb = new Buf(W, H);
  bulb.ellipse(cx, cy, rx, ry, K);
  shade(bulb, TM.bulb, { rim: 0.3 });
  // spots + veins on the bulb
  const r = rng(7);
  for (let i = 0; i < 16; i++) {
    const a = r() * Math.PI - Math.PI;
    const d = r() * 0.8;
    const x = Math.round(cx + Math.cos(a) * rx * d);
    const y = Math.round(cy - 3 + Math.sin(a) * ry * d * 0.8);
    if (bulb.has(x, y) && bulb.has(x + 1, y)) {
      bulb.set(x, y, '#f5b0b8');
      if (i % 2) bulb.set(x + 1, y, PAL.pink);
    }
  }
  // compose top half + dropped jaw
  const jaw = new Buf(W, H);
  bulb.each((c, x, y) => {
    if (y <= mouthY) b.set(x, y, c);
    else jaw.set(x, y + drop, c);
  });
  // mouth interior (lens between lips)
  const half = rx - 2.5;
  for (let x = Math.ceil(cx - half); x <= Math.floor(cx + half); x++) {
    const k = 1 - ((x + 0.5 - cx) / half) ** 2;
    if (k <= 0) continue;
    const up = mouthY - Math.round(open * 0.55 * k * 1.3);
    const dn = mouthY + drop + Math.round(open * 0.45 * k * 1.3);
    for (let y = up; y <= dn; y++)
      b.set(x, y, y > dn - 2 && open > 3 ? PAL.darkRed : y < up + 2 ? '#1a0d1c' : PAL.plum);
    // lips
    b.set(x, up - 1, PAL.pink);
    b.set(x, dn + 1, PAL.red);
  }
  b.blit(jaw);
  // tongue when wide open
  if (open > 4) {
    b.blit(
      layer(W, H, [PAL.darkRed, PAL.red, PAL.pink], (l) => l.ellipse(cx, mouthY + drop + 1, 5, 2.2, K), 0.2),
    );
  }
  // teeth: jagged fangs along both lips
  for (let x = Math.ceil(cx - half + 1); x <= Math.floor(cx + half - 1); x += 3) {
    const k = 1 - ((x + 0.5 - cx) / half) ** 2;
    if (k <= 0.05) continue;
    const up = mouthY - Math.round(open * 0.55 * k * 1.3);
    const dn = mouthY + drop + Math.round(open * 0.45 * k * 1.3);
    const len = Math.max(1, Math.min(3, Math.round(1 + open * 0.3 + k)));
    for (let i = 0; i < len; i++) {
      b.set(x, up + i, i === len - 1 ? PAL.sand : '#fff4dc');
      if (i === 0) b.set(x + 1, up, PAL.sand);
      b.set(x + 1, dn - i, i === len - 1 ? PAL.tan : PAL.sand);
      if (i === 0) b.set(x, dn, PAL.tan);
    }
  }
  // eyes on the crown of the bulb
  const clearBelow = (): void => {
    for (let x = 0; x < W; x++) b.set(x, H - 1, null);
  };
  const eye = (x: number, y: number, big: boolean): void => {
    if (eyes === 'shut') {
      b.hline(x - 1, x + 1, y, INK);
      return;
    }
    const w = eyes === 'wide' || big ? 1 : 0;
    b.rect(x - 1 - w, y - 1, 3 + w * 2, 3, INK);
    b.rect(x - w, y - 1, 1 + w * 2, 2, PAL.yellow);
    b.set(x, y - 1, '#ffffff');
    b.vline(x, y, y, PAL.gold);
    b.set(x + w, y, PAL.orange);
  };
  eye(cx - 7, cy - 6, false);
  eye(cx, cy - 8, true);
  eye(cx + 7, cy - 6, false);
  clearBelow();
  b.outline(INK);
  if (anim === 'special' && f >= 1) {
    // roar spit / pollen
    for (const [x, y] of [
      [6, 16],
      [42, 18],
      [9, 24],
      [40, 26],
      [4, 30],
      [44, 31],
    ] as const)
      b.set(x + (f === 2 ? 1 : 0), y, PAL.yellow).set(x + 1, y + 1, '#c4e86b');
  }
  return b;
}

// ========================================================== CRYSTAL GOLEM ===

const CG = {
  rock: [PAL.navy, PAL.darkSlate, PAL.slate, PAL.gray] as Ramp,
  cyan: [PAL.blue, PAL.sky, PAL.cyan, '#ffffff'] as Ramp,
  purple: [PAL.purple, PAL.magenta, PAL.pink, '#ffffff'] as Ramp,
};

function crystalGolem(anim: AnimName, f: number): Buf {
  const W = 48;
  const H = 48;
  const b = new Buf(W, H);
  let bob = [0, 0, 1, 1][f % 4];
  let glow = [0, 1, 2, 1][f % 4];
  let fistR: Pt = [40, 38];
  let fistL: Pt = [8, 38];
  let lean = 0;
  let slam = false;
  let charge = 0;
  if (anim === 'attack') {
    if (f === 0) {
      fistR = [38, 10];
      lean = 0;
      bob = -1;
    } else {
      fistR = [31, 41];
      lean = 1;
      bob = 2;
      slam = true;
    }
    glow = 1;
  } else if (anim === 'special') {
    charge = f + 1;
    bob = 2;
    glow = 2 + f;
    fistL = [11, 34];
    fistR = [37, 34];
  } else if (anim === 'hurt') {
    lean = -1;
    bob = 0;
    glow = 0;
  }
  const cyan: Ramp = glow >= 3 ? ['#3fb6f0', PAL.cyan, '#c9fbff', '#ffffff'] : CG.cyan;
  const purple: Ramp = glow >= 3 ? [PAL.magenta, PAL.pink, '#ffd0e8', '#ffffff'] : CG.purple;
  const X = lean;
  const Y = bob;

  // back crystals (behind everything)
  crystal(b, 16 + X, 18 + Y, 6, 16, -0.5, purple);
  crystal(b, 32 + X, 18 + Y, 6, 15, 0.45, cyan);
  crystal(b, 24 + X, 14 + Y, 7, 12, 0.05, cyan);
  crystal(b, 20 + X, 16 + Y, 4, 12, -0.2, cyan);
  crystal(b, 29 + X, 15 + Y, 4, 11, 0.25, purple);

  // legs
  const leg = (x: number): void => {
    b.overlay(
      layer(W, H, CG.rock, (l) => {
        l.rect(x, 34 + Y, 8, 10 - Y, K);
        l.ellipse(x + 4, 45, 5.5, 2.4, K);
      }),
      INK,
      'all',
    );
  };
  leg(13);
  leg(27);

  // arms (drawn before torso so the torso overlaps the shoulders)
  const arm = (sh: Pt, fist: Pt, rightSide: boolean): void => {
    const l = new Buf(W, H);
    stroke(
      l,
      bez(sh, [(sh[0] + fist[0]) / 2 + (rightSide ? 3 : -3), (sh[1] + fist[1]) / 2], fist, 10),
      7,
      6,
      K,
    );
    l.ellipse(fist[0], fist[1], 5.5, 5, K);
    shade(l, CG.rock, { rim: 0.3 });
    b.overlay(l, INK, 'all');
    // crystal knuckles
    crystal(b, fist[0] - 2, fist[1] - 3, 3, 5, rightSide ? 0.6 : -0.6, rightSide ? cyan : purple);
    crystal(b, fist[0] + (rightSide ? 2 : -2), fist[1] - 4, 3, 4, rightSide ? 0.9 : -0.9, cyan);
  };
  arm([11 + X, 21 + Y], fistL, false);
  if (fistR[1] >= 20) arm([37 + X, 21 + Y], fistR, true);

  // torso
  b.overlay(
    layer(W, H, CG.rock, (l) => {
      l.ellipse(24 + X, 27 + Y, 12.5, 10.5, K);
      l.ellipse(24 + X, 21 + Y, 15, 6, K);
    }),
    INK,
    'all',
  );
  // plate seams
  b.line(14 + X, 26 + Y, 20 + X, 31 + Y, PAL.navy).line(34 + X, 26 + Y, 28 + X, 31 + Y, PAL.navy);
  b.hline(18 + X, 30 + Y, 35 + Y, PAL.navy);
  // chest core
  const core = glow >= 3 ? '#ffffff' : glow === 2 ? '#c9fbff' : PAL.cyan;
  b.poly(
    [
      [24 + X, 22 + Y],
      [28 + X, 27 + Y],
      [24 + X, 32 + Y],
      [20 + X, 27 + Y],
    ],
    INK,
  );
  b.poly(
    [
      [24 + X, 23.2 + Y],
      [27 + X, 27 + Y],
      [24 + X, 30.8 + Y],
      [21 + X, 27 + Y],
    ],
    PAL.sky,
  );
  b.poly(
    [
      [24 + X, 24.5 + Y],
      [25.8 + X, 27 + Y],
      [24 + X, 29.5 + Y],
      [22.2 + X, 27 + Y],
    ],
    core,
  );
  b.set(23 + X, 25 + Y, '#ffffff');

  // shoulder boulders with crystal clusters
  for (const sx of [11, 37]) {
    b.overlay(
      layer(W, H, CG.rock, (l) => l.ellipse(sx + X, 20 + Y, 6.5, 5.5, K)),
      INK,
      'all',
    );
  }
  crystal(b, 8 + X, 17 + Y, 4, 8, -0.8, purple);
  crystal(b, 12 + X, 16 + Y, 4, 10, -0.35, cyan);
  crystal(b, 36 + X, 16 + Y, 4, 10, 0.35, purple);
  crystal(b, 40 + X, 17 + Y, 4, 8, 0.8, cyan);

  // head
  b.overlay(
    layer(W, H, CG.rock, (l) => {
      l.ellipse(24 + X, 14 + Y, 5.5, 4.6, K);
    }),
    INK,
    'all',
  );
  b.hline(21 + X, 27 + X, 14 + Y, INK);
  b.hline(22 + X, 26 + X, 14 + Y, anim === 'hurt' ? PAL.blue : core === '#ffffff' ? '#ffffff' : PAL.cyan);
  b.set(24 + X, 14 + Y, '#ffffff');
  crystal(b, 24 + X, 11 + Y, 3, 6, 0, cyan);

  // raised fist is drawn in front of the head
  if (fistR[1] < 20) arm([37 + X, 21 + Y], fistR, true);
  b.outline(INK);

  if (slam) {
    // ground cracks + shards
    b.line(31, 46, 24, 47, INK).line(33, 46, 40, 47, INK);
    for (const [x, y, c] of [
      [22, 40, PAL.cyan],
      [42, 38, PAL.pink],
      [45, 43, PAL.cyan],
      [19, 44, PAL.slate],
      [44, 34, '#ffffff'],
    ] as [number, number, Col][])
      b.set(x, y, c).set(x + 1, y - 1, c);
  }
  if (charge) {
    const r = rng(charge * 13);
    const n = 6 + charge * 4;
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2;
      const d = 14 + r() * 8 - charge * 2;
      const x = Math.round(24 + Math.cos(a) * d);
      const y = Math.round(26 + Math.sin(a) * d * 0.9);
      if (!b.has(x, y)) b.set(x, y, i % 3 ? PAL.cyan : PAL.pink);
    }
  }
  return b;
}

// ================================================================= IGNIS ===

const IG = {
  scale: [PAL.plum, PAL.darkRed, PAL.red, '#ff7a6a'] as Ramp,
  belly: [PAL.rust, PAL.orange, PAL.gold, PAL.yellow] as Ramp,
  wing: [PAL.plum, PAL.darkRed, PAL.rust, PAL.orangeBrown] as Ramp,
  horn: [PAL.tan, PAL.sand, '#fff4dc'] as Ramp,
  fire: [PAL.darkRed, PAL.orange, PAL.gold, PAL.yellow, '#fffbe0'] as Ramp,
};

function ignis(anim: AnimName, f: number): Buf {
  const W = 64;
  const H = 48;
  const b = new Buf(W, H);
  let flap = [0, 2, 4, 2][f % 4];
  let by = [0, 0, 1, 1][f % 4];
  let headY = 0;
  let headS = 0;
  let mouth: 'shut' | 'open' | 'fire' = 'shut';
  let chest = 0;
  let claw: 'rest' | 'raise' | 'swipe' = 'rest';
  if (anim === 'special') {
    if (f === 0) {
      by = -2;
      headY = -1;
      flap = 0;
      chest = 1;
    } else if (f === 1) {
      by = -2;
      headY = 0;
      headS = 1;
      mouth = 'open';
      flap = 0;
      chest = 2;
    } else {
      by = 0;
      headY = 3;
      headS = 1;
      mouth = 'fire';
      flap = 3;
      chest = 2;
    }
  } else if (anim === 'attack') {
    claw = f === 0 ? 'raise' : 'swipe';
    by = f === 0 ? -1 : 1;
    flap = f === 0 ? -1 : 4;
    mouth = f === 1 ? 'open' : 'shut';
  } else if (anim === 'hurt') {
    by = -1;
    headY = -2;
    flap = 1;
  }
  const cx = 32;

  // ---- wings
  const wing = (s: number): void => {
    const sh: Pt = [cx + s * 7, 19 + by];
    const elbow: Pt = [cx + s * 18, 8 + by + flap * 0.5];
    const tip: Pt = [cx + s * 30, Math.max(2, 3 + by + flap)];
    const pts: Pt[] = [
      sh,
      elbow,
      tip,
      [cx + s * 29, 12 + by + flap],
      [cx + s * 26, 16 + by + flap * 0.8],
      [cx + s * 25, 22 + by + flap * 0.6],
      [cx + s * 20, 22 + by + flap * 0.4],
      [cx + s * 18, 28 + by + flap * 0.3],
      [cx + s * 13, 26 + by],
      [cx + s * 9, 29 + by],
    ];
    const l = new Buf(W, H);
    l.poly(pts, K);
    shade(l, IG.wing, { rim: 0.2, lx: -0.2 * s, ly: -1 });
    b.overlay(l, INK, 'all');
    // bones
    b.line(sh[0], sh[1], elbow[0], elbow[1], PAL.plum);
    b.line(sh[0], sh[1] - 1, elbow[0], elbow[1] - 1, IG.scale[2]);
    b.line(elbow[0], elbow[1], tip[0], tip[1], PAL.darkRed);
    for (const k of [3, 5, 7]) b.line(elbow[0], elbow[1], pts[k][0], pts[k][1], PAL.plum);
    b.set(tip[0], tip[1] - 1, IG.horn[1]);
  };
  wing(-1);
  wing(1);

  // ---- tail curling on the ground
  const tail = new Buf(W, H);
  stroke(tail, bez([cx + 6, 40], [cx + 24, 47], [cx + 24, 36 + (f % 2)], 16), 5, 2, K);
  shade(tail, IG.scale, { rim: 0.3 });
  b.overlay(tail, INK, 'all');
  b.set(cx + 24, 34 + (f % 2), IG.horn[1]).set(cx + 25, 35 + (f % 2), IG.horn[0]);

  // ---- legs
  for (const s of [-1, 1]) {
    b.overlay(
      layer(W, H, IG.scale, (l) => {
        l.ellipse(cx + s * 8, 37 + by * 0.5, 5, 5.5, K);
        l.rect(cx + s * 8 - 3, 38, 6, 7, K);
        l.ellipse(cx + s * 8 + s, 45, 4.5, 2, K);
      }),
      INK,
      'all',
    );
    for (const k of [-2, 0, 2]) b.set(cx + s * 8 + s + k, 46, '#fff4dc');
  }

  // ---- body
  b.overlay(
    layer(W, H, IG.scale, (l) => {
      l.ellipse(cx, 30 + by, 10, 11, K);
      l.ellipse(cx, 22 + by, 7, 6, K);
    }),
    INK,
    'all',
  );
  // belly plates
  const belly = layer(
    W,
    H,
    chest ? ['#ffb347', PAL.gold, PAL.yellow, '#fffbe0'] : IG.belly,
    (l) => l.ellipse(cx, 31 + by, 5.5, 9, K),
    0.1,
  );
  b.blitClip(belly);
  for (let y = 24; y <= 39; y += 3) b.hline(cx - 4, cx + 4, y + by, chest ? PAL.orange : PAL.rust);
  // back spikes
  for (const s of [-1, 1])
    for (const [dx, dy] of [
      [9, 22],
      [10, 27],
      [10, 32],
    ] as const)
      b.set(cx + s * dx, dy + by - 1, IG.horn[1]).set(cx + s * (dx + 1), dy + by - 2, IG.horn[0]);

  // ---- forearms / claws
  const fore = (s: number, hand: Pt): void => {
    const l = new Buf(W, H);
    stroke(l, [[cx + s * 7, 25 + by] as Pt, hand], 3.6, 3, K);
    shade(l, IG.scale, { rim: 0.3 });
    b.overlay(l, INK, 'all');
    for (const k of [-2, 0, 2]) {
      b.set(hand[0] + k, hand[1] + 2, PAL.sand);
      b.set(hand[0] + k, hand[1] + 3, '#ffffff');
    }
  };
  if (claw === 'raise') {
    fore(-1, [cx - 9, 33 + by]);
    fore(1, [cx + 16, 10 + by]);
  } else if (claw === 'swipe') {
    fore(-1, [cx - 9, 33 + by]);
    fore(1, [cx + 12, 38 + by]);
  } else {
    fore(-1, [cx - 8, 33 + by]);
    fore(1, [cx + 8, 33 + by]);
  }

  // ---- neck + head
  const hy = 12 + by + headY;
  const neck = layer(W, H, IG.scale, (l) =>
    stroke(l, bez([cx, 22 + by], [cx, 16 + by], [cx, hy + 3], 8), 7, 6, K),
  );
  b.overlay(neck, INK, 'all');
  for (let y = hy + 5; y < 21 + by; y += 2) b.hline(cx - 1, cx + 1, y, IG.belly[1]);
  // horns
  for (const s of [-1, 1]) {
    const hl = new Buf(W, H);
    stroke(hl, bez([cx + s * 4, hy - 1], [cx + s * 9, hy - 3], [cx + s * 10, hy - 8], 8), 3, 1, K);
    shade(hl, IG.horn, { rim: 0.3 });
    b.overlay(hl, INK, 'all');
  }
  const hs = headS;
  const head = new Buf(W, H);
  head.ellipse(cx, hy, 5.2 + hs, 4 + hs * 0.5, K);
  // long snout toward the camera
  head.poly(
    [
      [cx - 4 - hs, hy + 1],
      [cx + 4 + hs, hy + 1],
      [cx + 3.5 + hs, hy + 7 + hs],
      [cx - 3.5 - hs, hy + 7 + hs],
    ],
    K,
  );
  // cheek frills
  for (const s2 of [-1, 1]) {
    head.poly(
      [
        [cx + s2 * (4 + hs), hy - 1],
        [cx + s2 * (9 + hs), hy + 2],
        [cx + s2 * (4 + hs), hy + 4],
      ],
      K,
    );
  }
  shade(head, IG.scale, { rim: 0.3 });
  b.overlay(head, INK, 'all');
  // nose bridge highlight + scale ridge
  b.vline(cx, hy - 3, hy + 3, IG.scale[3]);
  b.set(cx, hy - 4, IG.horn[1]).set(cx, hy - 3, IG.horn[0]);
  for (const s2 of [-1, 1]) {
    // frill spines
    b.set(cx + s2 * (8 + hs), hy + 2, IG.horn[0]);
    // fierce brow ridge + eye
    const ex = cx + s2 * 3;
    b.set(ex - s2, hy - 2, PAL.plum)
      .set(ex, hy - 2, PAL.plum)
      .set(ex + s2, hy - 1, PAL.plum);
    if (anim === 'hurt') b.hline(Math.min(ex, ex + s2), Math.max(ex, ex + s2), hy, PAL.plum);
    else
      b.set(ex, hy - 1, PAL.yellow)
        .set(ex, hy, PAL.gold)
        .set(ex + s2, hy, PAL.yellow)
        .set(ex - s2, hy - 1, PAL.orange);
    // nostrils
    b.set(cx + s2 * 2, hy + 5 + hs, PAL.plum);
  }
  const my = hy + 7 + hs;
  if (mouth === 'shut') {
    b.hline(cx - 3, cx + 3, my, PAL.plum);
    b.set(cx - 2, my + 1, '#fff4dc').set(cx + 2, my + 1, '#fff4dc');
  } else {
    const mh = mouth === 'fire' ? 4 : 3;
    b.rect(cx - 3 - hs, my - 1, 7 + hs * 2, mh + 1, PAL.plum);
    b.rect(cx - 2 - hs, my, 5 + hs * 2, mh, mouth === 'fire' ? PAL.yellow : PAL.orange);
    if (mouth === 'fire') b.hline(cx - 1, cx + 1, my + 1, '#fffbe0');
    b.set(cx - 3 - hs, my, '#ffffff').set(cx + 3 + hs, my, '#ffffff');
    b.set(cx - 2 - hs, my + mh, '#ffffff').set(cx + 2 + hs, my + mh, '#ffffff');
  }
  b.outline(INK);

  // chest glow (building fire)
  if (chest === 1) b.set(cx, 26 + by, PAL.yellow);
  // fire breath cone toward the camera
  if (mouth === 'fire') {
    const fl = new Buf(W, H);
    fl.poly(
      [
        [cx - 3, hy + 10],
        [cx + 3, hy + 10],
        [cx + 13, 47],
        [cx - 13, 47],
      ],
      K,
    );
    const r = rng(f + 3);
    fl.each((_c, x, y) => {
      const t = (y - hy - 10) / (47 - hy - 10);
      const edge = Math.abs(x + 0.5 - cx) / (3 + 10 * t);
      const v = 1 - edge * 0.9 - t * 0.35 + (r() - 0.5) * 0.35;
      const ramp = IG.fire;
      fl.set(x, y, ramp[Math.max(0, Math.min(ramp.length - 1, Math.floor(v * ramp.length)))]);
      if (edge > 0.85 && r() < 0.4) fl.set(x, y, null);
    });
    b.blit(fl);
  }
  if (claw === 'swipe') {
    for (const k of [0, 3, 6]) b.line(cx + 16 + k, 24 + by, cx + 10 + k, 40 + by, '#ffffffd0');
  }
  return b;
}

// ============================================================= SERAPHINE ===

const SE = {
  hair: ['#2f5f9e', '#4f8fd0', '#94d0f2', '#dff6ff'] as Ramp,
  gown: ['#7aa9dc', '#cde8f8', '#f1faff', '#ffffff'] as Ramp,
  sleeve: [PAL.blue, PAL.sky, '#7fd6f5'] as Ramp,
  skin: ['#d9b3b3', '#f3dcd6', '#fff2ee'] as Ramp,
};

function seraphine(anim: AnimName, f: number): Buf {
  const W = 24;
  const H = 32;
  const b = new Buf(W, H);
  let by = [1, 2, 2, 1][f % 4];
  let lean = anim === 'move' ? 1 : 0;
  let arms: 'rest' | 'back' | 'thrust' | 'raise' | 'high' = 'rest';
  let burst = 0;
  if (anim === 'attack') {
    arms = f === 0 ? 'back' : 'thrust';
    lean = f === 0 ? -1 : 1;
  } else if (anim === 'cast') arms = 'raise';
  else if (anim === 'special') {
    arms = 'high';
    burst = f + 1;
    by = 1;
  } else if (anim === 'hurt') {
    lean = -1;
    by = 1;
  }
  const fl = f % 2;
  const X = lean;
  const Y = by;
  const trail = anim === 'move' ? -2 : 0;
  // ---- hair flowing behind
  const hair = new Buf(W, H);
  hair.poly(
    [
      [10 + X, 2 + Y],
      [15 + X, 2.5 + Y],
      [13 + X, 12 + Y],
      [11 + X, 18 + Y],
      [8 - fl + trail, 23 + Y],
      [5 - fl + trail, 23 + Y],
      [6 + X + trail * 0.5, 17 + Y],
      [7 + X, 9 + Y],
    ],
    K,
  );
  shade(hair, SE.hair, { rim: 0.3 });
  b.blit(hair);
  // hair strands
  b.line(8 + X, 10 + Y, 7 + trail, 21 + Y, SE.hair[0]);
  // ---- gown
  const gown = new Buf(W, H);
  gown.poly(
    [
      [10 + X, 11 + Y],
      [15 + X, 11 + Y],
      [16 + X, 17 + Y],
      [19 + fl, 25 + Y],
      [16, 26 + Y - fl],
      [13, 25 + Y],
      [10, 26.5 + Y + fl],
      [7 - fl, 25 + Y],
      [9 + X, 17 + Y],
    ],
    K,
  );
  shade(gown, SE.gown, { rim: 0.3 });
  b.overlay(gown, SE.hair[0], 'all');
  b.line(12 + X, 18 + Y, 11, 25 + Y, SE.gown[0]).line(15 + X, 19 + Y, 16, 25 + Y, SE.gown[0]);
  for (let x = 7; x <= 18; x += 2) b.tint(x, 25 + Y, PAL.cyan);
  // bodice
  b.blit(layer(W, H, SE.sleeve, (l) => l.rect(10 + X, 11 + Y, 5, 5, K), 0.25));
  b.hline(10 + X, 15 + X, 16 + Y, PAL.blue);
  b.set(13 + X, 13 + Y, PAL.cyan)
    .set(13 + X, 12 + Y, '#ffffff')
    .set(12 + X, 13 + Y, PAL.sky);
  // ---- head
  b.blit(layer(W, H, SE.skin, (l) => l.ellipse(13.5 + X, 6.5 + Y, 3.3, 3.5, K), 0.25));
  const bang = new Buf(W, H);
  bang.poly(
    [
      [9.5 + X, 4 + Y],
      [12 + X, 1.6 + Y],
      [16.8 + X, 3.4 + Y],
      [16.5 + X, 5 + Y],
      [13.5 + X, 4.4 + Y],
      [12 + X, 8.5 + Y],
      [10 + X, 10 + Y],
    ],
    K,
  );
  shade(bang, SE.hair, { rim: 0.3 });
  b.blit(bang);
  // face
  if (anim === 'hurt') b.hline(15 + X, 16 + X, 7 + Y, PAL.blue);
  else
    b.set(15 + X, 6 + Y, PAL.navy)
      .set(15 + X, 7 + Y, PAL.cyan)
      .set(16 + X, 6 + Y, SE.skin[1]);
  b.set(16 + X, 9 + Y, SE.skin[0]).set(14 + X, 8 + Y, '#f5b8b8');
  // tiara: three ice spikes
  const ty = 1 + Y;
  b.set(11 + X, ty, PAL.cyan).set(11 + X, ty + 1, PAL.sky);
  b.set(13 + X, ty - 1, '#ffffff')
    .set(13 + X, ty, PAL.cyan)
    .set(13 + X, ty + 1, PAL.sky);
  b.set(15 + X, ty, PAL.cyan).set(15 + X, ty + 1, PAL.sky);
  b.hline(11 + X, 15 + X, ty + 2, PAL.sky);
  // ---- arms (sleeves), separated from the body with a dark edge
  const arm = (sh: Pt, h: Pt): void => {
    const l = new Buf(W, H);
    l.line(sh[0], sh[1], h[0], h[1], SE.sleeve[1], 2);
    l.line(sh[0], sh[1], h[0], h[1], SE.sleeve[2]);
    l.set(h[0], h[1], SE.skin[1]).set(h[0] + 1, h[1], SE.skin[0]);
    b.overlay(l, SE.hair[0], 'all');
  };
  const shoulder: Pt = [12 + X, 12 + Y];
  let hand: Pt | null = null;
  let hand2: Pt | null = null;
  if (arms === 'rest') arm(shoulder, [15 + X, 17 + Y]);
  else if (arms === 'back') {
    arm(shoulder, [7 + X, 14 + Y]);
    hand = [6 + X, 12 + Y];
  } else if (arms === 'thrust') {
    arm(shoulder, [19 + X, 12 + Y]);
    hand = [21 + X, 11 + Y];
  } else if (arms === 'raise') {
    arm(shoulder, [17 + X, 7 + Y]);
    hand = [18 + X, 5 + Y];
  } else {
    arm([11 + X, 12 + Y], [7 + X, 5 + Y]);
    arm(shoulder, [18 + X, 5 + Y]);
    hand = [19 + X, 4 + Y];
    hand2 = [6 + X, 4 + Y];
  }
  b.outline((n) => mix(n, INK, 0.72));
  // ice in hand
  for (const hnd of [hand, hand2]) {
    if (!hnd) continue;
    const s = arms === 'raise' || (arms === 'high' && burst > 1) ? 2 : 1;
    const [x, y] = hnd;
    b.set(x, y - s, '#ffffff');
    for (let i = 1; i <= s; i++) b.set(x - i, y - s + i, PAL.cyan).set(x + i, y - s + i, PAL.sky);
    b.set(x, y, PAL.cyan);
    if (s > 1) b.set(x, y + 1, PAL.sky).set(x, y - 1, '#c9fbff');
  }
  if (burst) {
    const shards: Pt[] = [
      [3, 8],
      [21, 9],
      [2, 17],
      [22, 19],
      [4, 26],
      [20, 28],
    ];
    shards.slice(0, 2 + burst * 2).forEach(([x, y], i) => {
      const o = (f + i) % 2;
      b.set(x, y + o, '#ffffff')
        .set(x, y + o + 1, PAL.cyan)
        .set(x + (i % 2 ? -1 : 1), y + o + 1, PAL.sky);
      b.set(x, y + o + 2, PAL.blue);
    });
  }
  return b;
}

// ============================================================== MALACHAR ===

const MA = {
  armor: [INK, PAL.navy, PAL.darkSlate, PAL.slate] as Ramp,
  cape: ['#12091c', '#2b1440', PAL.purple] as Ramp,
  hair: [INK, '#231f36', '#3d3858'] as Ramp,
  skin: ['#a9a3bd', '#d8d4e4', '#f0eef6'] as Ramp,
  blade: ['#1a1628', PAL.navy, PAL.darkSlate, PAL.slate] as Ramp,
};

function malachar(anim: AnimName, f: number): Buf {
  const W = 24;
  const H = 32;
  const b = new Buf(W, H);
  let bob = anim === 'idle' ? [0, 0, 1, 1][f % 4] : 0;
  let lifts = [0, 0];
  let sword: 'plant' | 'carry' | 'wind' | 'slash' | 'up' | 'slam' = 'plant';
  let lean = 0;
  let aura = 0;
  if (anim === 'move') {
    lifts = [
      [0, 0],
      [1, 0],
      [0, 0],
      [0, 1],
    ][f];
    bob = f % 2 ? 0 : 1;
    sword = 'carry';
  } else if (anim === 'attack') {
    sword = f === 0 ? 'wind' : 'slash';
    lean = f === 0 ? -1 : 1;
  } else if (anim === 'special') {
    sword = f < 2 ? 'up' : 'slam';
    aura = f + 1;
    lean = f === 2 ? 1 : 0;
    bob = f === 2 ? 1 : 0;
  } else if (anim === 'cast') {
    sword = 'plant';
    aura = 2;
  } else if (anim === 'hurt') {
    lean = -2;
    sword = 'carry';
  }
  const X = lean;
  const Y = bob + 1;
  const fl = f % 2;
  // ---- tattered cape
  const cape = new Buf(W, H);
  const tr = anim === 'move' ? -2 : 0;
  cape.poly(
    [
      [9 + X, 11 + Y],
      [13 + X, 11 + Y],
      [11, 29],
      [9, 27 + fl],
      [7 + tr, 30],
      [5 + tr, 27],
      [Math.max(1.5, 3 + tr - fl), 29],
      [Math.max(2, 4 + tr), 20],
    ],
    K,
  );
  shade(cape, MA.cape, { rim: 0.25 });
  b.blit(cape);
  // ---- long black hair
  const hair = new Buf(W, H);
  hair.poly(
    [
      [9 + X, 4 + Y],
      [14 + X, 3 + Y],
      [12 + X, 11 + Y],
      [10 + X, 17 + Y],
      [7 + X + tr, 19 + Y],
      [7 + X, 10 + Y],
    ],
    K,
  );
  shade(hair, MA.hair, { rim: 0.3 });
  b.blit(hair);
  // ---- legs
  const leg = (x: number, lift: number, far: boolean): void => {
    b.blit(layer(W, H, far ? [INK, '#1f1a33'] : MA.armor, (l) => l.rect(x, 22, 3, 9 - lift, K)));
    b.set(x + 3, 30 - lift, far ? INK : PAL.navy);
  };
  leg(9 + (anim === 'move' ? fl : 0), lifts[0], true);
  leg(12, lifts[1], false);
  // ---- torso armor
  b.blit(
    layer(W, H, MA.armor, (l) => {
      l.rect(9 + X, 11 + Y, 7, 10, K);
      l.ellipse(12.5 + X, 12 + Y, 4.5, 2, K);
    }),
  );
  b.hline(9 + X, 15 + X, 20 + Y, PAL.purple);
  b.set(14 + X, 14 + Y, PAL.magenta).set(14 + X, 15 + Y, PAL.purple);
  b.line(10 + X, 13 + Y, 11 + X, 18 + Y, PAL.navy);
  // tasset
  b.rect(10 + X, 21 + Y, 5, 2, '#1f1a33').hline(10 + X, 14 + X, 22 + Y, PAL.purple);
  // ---- head
  b.blit(layer(W, H, MA.skin, (l) => l.ellipse(13 + X, 7 + Y, 3, 3.2, K), 0.25));
  // hair fringe
  b.hline(10 + X, 15 + X, 4 + Y, MA.hair[1])
    .hline(10 + X, 13 + X, 5 + Y, MA.hair[1])
    .set(11 + X, 6 + Y, MA.hair[0]);
  // red eyes
  b.set(14 + X, 7 + Y, PAL.hotPink)
    .set(15 + X, 7 + Y, PAL.darkRed)
    .set(14 + X, 6 + Y, '#8c8aa0');
  b.set(15 + X, 9 + Y, MA.skin[0]);
  // horned crown
  b.hline(10 + X, 15 + X, 3 + Y, '#231f36');
  b.hline(11 + X, 14 + X, 2 + Y, INK);
  b.set(12 + X, 2 + Y, PAL.magenta)
    .set(13 + X, 2 + Y, PAL.purple)
    .set(12 + X, 1 + Y, PAL.pink);
  b.set(10 + X, 2 + Y, PAL.navy)
    .set(9 + X, 1 + Y, PAL.darkSlate)
    .set(9 + X, 0 + Y, PAL.slate)
    .set(8 + X, 0 + Y, PAL.darkSlate);
  b.set(15 + X, 2 + Y, PAL.navy)
    .set(16 + X, 1 + Y, PAL.darkSlate)
    .set(16 + X, 0 + Y, PAL.slate)
    .set(17 + X, 0 + Y, PAL.darkSlate);
  // pauldron
  b.blit(layer(W, H, MA.armor, (l) => l.ellipse(13.5 + X, 12 + Y, 2.8, 1.8, K), 0.35));
  b.set(15 + X, 11 + Y, PAL.slate)
    .set(12 + X, 13 + Y, PAL.purple)
    .set(13 + X, 13 + Y, PAL.purple);
  // hair strands catching light
  b.line(8 + X, 9 + Y, 7 + X + tr, 17 + Y, MA.hair[2]);
  b.line(10 + X, 11 + Y, 9 + X + tr, 16 + Y, MA.hair[2]);
  // ---- greatsword
  const blade = (x0: number, y0: number, x1: number, y1: number): void => {
    b.line(x0, y0, x1, y1, MA.blade[1], 3);
    b.line(x0, y0, x1, y1, MA.blade[3]);
    b.set(x1, y1, PAL.slate);
  };
  const glow = (x0: number, y0: number, x1: number, y1: number): void => {
    Buf.linePts(x0, y0, x1, y1).forEach(([x, y], i) => b.set(x, y, i % 3 === 1 ? PAL.pink : PAL.magenta));
  };
  const armTo = (h: Pt): void => {
    b.line(13 + X, 12 + Y, h[0], h[1], MA.armor[2]);
    b.line(13 + X, 13 + Y, h[0], h[1] + 1, MA.armor[1]);
  };
  switch (sword) {
    case 'plant':
      armTo([17 + X, 15 + Y]);
      blade(19, 17 + Y, 19, 29);
      glow(20, 18 + Y, 20, 28);
      b.hline(17, 21, 16 + Y, PAL.darkSlate).set(19, 16 + Y, PAL.magenta);
      b.vline(19, 13 + Y, 15 + Y, '#2b1440');
      b.set(19, 12 + Y, PAL.pink);
      break;
    case 'carry':
      armTo([16 + X, 16 + Y]);
      blade(17 + X, 15 + Y, 21, 5 + Y);
      glow(18 + X, 16 + Y, 22, 6 + Y);
      b.line(15 + X, 17 + Y, 17 + X, 15 + Y, PAL.darkSlate);
      break;
    case 'wind':
      armTo([10 + X, 9]);
      blade(9 + X, 9, 3, 3);
      glow(10 + X, 10, 4, 4);
      b.line(8 + X, 10, 11 + X, 7, PAL.darkSlate);
      break;
    case 'slash':
      armTo([18 + X, 14]);
      blade(19 + X, 15, 21, 27);
      glow(20 + X, 14, 22, 25);
      b.line(17 + X, 13, 20 + X, 15, PAL.darkSlate);
      break;
    case 'up':
      armTo([15 + X, 6 + Y]);
      blade(16 + X, 5 + Y, 16 + X, 2);
      b.line(14 + X, 6 + Y, 18 + X, 6 + Y, PAL.darkSlate);
      break;
    case 'slam':
      armTo([18 + X, 16 + Y]);
      blade(19 + X, 18 + Y, 21, 29);
      glow(20 + X, 18 + Y, 22, 29);
      break;
  }
  b.outline(INK);
  if (sword === 'slash') {
    for (const [x0, y0, x1, y1] of [
      [21, 6, 23, 18],
      [19, 4, 22, 9],
    ] as const)
      for (const [x, y] of Buf.linePts(x0, y0, x1, y1)) b.set(x, y, '#e39bd6b0');
  }
  if (aura) {
    const r = rng(aura * 5 + f);
    for (let i = 0; i < aura * 5; i++) {
      const x = Math.round(3 + r() * 19);
      const y = Math.round(1 + r() * 29);
      if (!b.has(x, y)) b.set(x, y, i % 3 ? PAL.magenta : PAL.pink);
    }
    if (sword === 'up') {
      b.set(16 + X, 0, '#ffffff')
        .set(15 + X, 1, PAL.pink)
        .set(17 + X, 1, PAL.pink);
    }
    if (sword === 'slam') {
      for (let x = 12; x <= 23; x++) if ((x + f) % 2 === 0) b.set(x, 31, PAL.magenta);
      b.set(18, 30, PAL.pink).set(23, 29, PAL.pink);
    }
  }
  return b;
}

// ========================================================= MALACHAR TRUE ===

const MT = {
  body: [INK, '#1d0f2c', '#34184c', PAL.purple] as Ramp,
  horn: ['#241533', PAL.darkSlate, PAL.slate, PAL.gray] as Ramp,
  tendril: [INK, '#2b1440', PAL.purple, PAL.magenta] as Ramp,
};

function malacharTrue(anim: AnimName, f: number): Buf {
  const W = 64;
  const H = 64;
  const b = new Buf(W, H);
  let by = [0, -1, -1, 0][f % 4];
  let armsMode: 'idle' | 'raise' | 'slam' | 'spread' | 'curl' = 'idle';
  let core = 1;
  let burst = 0;
  const blink = anim === 'idle' && f === 3;
  if (anim === 'attack') {
    armsMode = f === 0 ? 'raise' : 'slam';
    by = f === 0 ? -1 : 1;
  } else if (anim === 'special') {
    armsMode = f === 0 ? 'curl' : 'spread';
    core = 2 + f;
    burst = f;
    by = f === 0 ? 1 : -1;
  } else if (anim === 'hurt') {
    by = -1;
    core = 0;
  }
  const cx = 32;
  // ---- void halo
  const halo = new Buf(W, H);
  halo.ellipse(cx, 30 + by, 22, 26, '#68386c40');
  halo.ellipse(cx, 30 + by, 17, 22, '#b5508830');
  b.blit(halo);
  // ---- tendrils from the back
  const tend = (a: Pt, c: Pt, d: Pt, t0: number): void => {
    const l = new Buf(W, H);
    stroke(l, bez(a, c, d, 24), t0, 1, K);
    shade(l, MT.tendril, { rim: 0.35 });
    b.overlay(l, INK, 'all');
    b.set(d[0], d[1], PAL.pink);
  };
  const w = [0, 2, 3, 1][f % 4];
  tend([cx - 8, 30 + by], [cx - 26, 22 - w], [cx - 29, 6 + w], 5);
  tend([cx + 8, 30 + by], [cx + 26, 22 + w], [cx + 29, 8 - w], 5);
  tend([cx - 10, 38 + by], [cx - 30, 44 + w], [cx - 27, 58 - w], 4);
  tend([cx + 10, 38 + by], [cx + 30, 44 - w], [cx + 28, 57 + w], 4);
  // ---- smoky lower body (tapers into a vortex)
  const low = new Buf(W, H);
  low.poly(
    [
      [cx - 13, 34 + by],
      [cx + 13, 34 + by],
      [cx + 9, 50],
      [cx + 4 + (f % 2), 58],
      [cx + 7, 62],
      [cx - 1, 60],
      [cx - 7 - (f % 2), 62],
      [cx - 5, 56],
      [cx - 10, 49],
    ],
    K,
  );
  shade(low, MT.body, { rim: 0.2 });
  b.blit(low);
  // ---- torso: broad spiked shoulders tapering to a narrow waist
  b.overlay(
    layer(W, H, MT.body, (l) => {
      l.poly(
        [
          [cx - 18, 19 + by],
          [cx + 18, 19 + by],
          [cx + 12, 30 + by],
          [cx + 8, 40 + by],
          [cx - 8, 40 + by],
          [cx - 12, 30 + by],
        ],
        K,
      );
      l.ellipse(cx - 15, 21 + by, 6.5, 5, K);
      l.ellipse(cx + 15, 21 + by, 6.5, 5, K);
    }),
    INK,
    'all',
  );
  // shoulder spikes
  for (const s2 of [-1, 1]) {
    for (const [dx, h, lean2] of [
      [11, 6, 0.1],
      [15, 8, 0.35],
      [19, 5, 0.7],
    ] as const) {
      const l = new Buf(W, H);
      tri(
        l,
        [cx + s2 * (dx - 1.5), 18 + by],
        [cx + s2 * (dx + lean2 * h), 18 + by - h],
        [cx + s2 * (dx + 1.5), 18 + by],
        K,
      );
      shade(l, MT.horn, { rim: 0.4 });
      b.overlay(l, INK, 'all');
    }
  }
  // rib-like plates
  for (let i = 0; i < 3; i++) {
    const y = 32 + by + i * 2;
    b.line(cx - 7 + i, y, cx - 3, y - 1, '#34184c').line(cx + 7 - i, y, cx + 3, y - 1, '#34184c');
  }
  // glowing veins
  const vr = rng(11);
  for (let i = 0; i < 6; i++) {
    let x = cx - 12 + vr() * 24;
    let y = 21 + by + vr() * 12;
    for (let k = 0; k < 6; k++) {
      b.tint(x, y, k % 2 ? PAL.purple : PAL.magenta);
      x += (vr() - 0.5) * 3;
      y += 1;
    }
  }
  // chest core
  const coreCol = core >= 3 ? '#ffffff' : core === 2 ? PAL.pink : core === 1 ? PAL.magenta : PAL.purple;
  b.overlay(
    layer(
      W,
      H,
      [PAL.purple, PAL.magenta, PAL.pink, '#ffffff'],
      (l) => l.ellipse(cx, 28 + by, 2.6 + core * 0.8, 3 + core * 0.8, K),
      0.1,
      core * 0.2,
    ),
    INK,
    'all',
  );
  b.set(cx, 28 + by, coreCol).set(cx - 1, 27 + by, '#ffffff');
  // ---- arms with long curved talons
  const arm = (s: number, elbow: Pt, hand: Pt): void => {
    const l = new Buf(W, H);
    stroke(l, bez([cx + s * 16, 22 + by], elbow, hand, 16), 6.5, 4, K);
    shade(l, MT.body, { rim: 0.3 });
    b.overlay(l, INK, 'all');
    const dx = hand[0] - elbow[0];
    const dy = hand[1] - elbow[1];
    const n = Math.hypot(dx, dy) || 1;
    const ux = dx / n;
    const uy = dy / n;
    for (const k of [-1.6, 0, 1.6]) {
      const bx = hand[0] - uy * k;
      const bY = hand[1] + ux * k;
      const tip: Pt = [bx + ux * 5 + s * 1, bY + uy * 5];
      b.line(bx + ux * 1.5, bY + uy * 1.5, tip[0], tip[1], PAL.gray);
      b.set(tip[0], tip[1], '#ffffff');
    }
  };
  for (const s of [-1, 1]) {
    if (armsMode === 'idle') arm(s, [cx + s * 23, 30 + by], [cx + s * 21, 42 + by]);
    else if (armsMode === 'raise') arm(s, [cx + s * 26, 15 + by], [cx + s * 22, 8]);
    else if (armsMode === 'slam') arm(s, [cx + s * 23, 36], [cx + s * 14, 53]);
    else if (armsMode === 'curl') arm(s, [cx + s * 19, 34 + by], [cx + s * 8, 35 + by]);
    else arm(s, [cx + s * 27, 21 + by], [cx + s * 29, 10 + by]);
  }
  // ---- head with great horns
  const hy = 13 + by;
  for (const s of [-1, 1]) {
    const hl = new Buf(W, H);
    stroke(hl, bez([cx + s * 5, hy - 2], [cx + s * 20, hy - 2], [cx + s * 19, hy - 11], 18), 5, 1, K);
    stroke(hl, bez([cx + s * 3, hy - 5], [cx + s * 6, hy - 9], [cx + s * 3, hy - 11], 8), 2.5, 1, K);
    shade(hl, MT.horn, { rim: 0.4 });
    b.overlay(hl, INK, 'all');
    b.set(cx + s * 19, hy - 11, PAL.lightGray);
  }
  b.overlay(
    layer(W, H, MT.body, (l) => {
      l.ellipse(cx, hy - 1, 7, 5.5, K);
      l.poly(
        [
          [cx - 7, hy],
          [cx + 7, hy],
          [cx + 3, hy + 8],
          [cx, hy + 10],
          [cx - 3, hy + 8],
        ],
        K,
      );
    }),
    INK,
    'all',
  );
  // many red eyes
  const eyes: [number, number, number][] = [
    [-3, -2, 2],
    [3, -2, 2],
    [0, -5, 1],
    [-6, 1, 1],
    [6, 1, 1],
    [-2, 2, 1],
    [2, 2, 1],
  ];
  for (const [ex, ey, s] of eyes) {
    const x = cx + ex;
    const y = hy + ey;
    if (blink && s === 1) {
      b.set(x, y, '#3b0a16');
      continue;
    }
    if (anim === 'hurt' && s === 2) {
      b.hline(x - 1, x + 1, y, PAL.darkRed);
      continue;
    }
    if (s === 2) {
      b.rect(x - 1, y - 1, 3, 2, PAL.hotPink)
        .set(x, y - 1, PAL.yellow)
        .set(x, y, '#ffffff');
    } else b.set(x, y, PAL.hotPink);
  }
  // jagged glowing maw
  for (let x = cx - 3; x <= cx + 3; x++) b.set(x, hy + 5 + (x % 2), PAL.magenta);
  b.set(cx, hy + 6, PAL.pink);
  b.outline(INK);
  // ---- void burst
  if (burst) {
    const R = 10 + burst * 10;
    for (let a = 0; a < 64; a++) {
      const t = (a / 64) * Math.PI * 2;
      const x = Math.round(cx + Math.cos(t) * R);
      const y = Math.round(30 + by + Math.sin(t) * R * 0.85);
      if (a % 2 === 0) b.set(x, y, burst === 2 ? PAL.pink : PAL.magenta);
      if (a % 4 === 0) b.set(x + Math.sign(Math.cos(t)), y, '#ffffffc0');
    }
    const r = rng(burst * 31);
    for (let i = 0; i < 20; i++) {
      const t = r() * Math.PI * 2;
      const d = R * (0.5 + r() * 0.5);
      b.set(cx + Math.cos(t) * d, 30 + by + Math.sin(t) * d * 0.85, i % 2 ? PAL.magenta : PAL.purple);
    }
  }
  return b;
}

// ================================================================== defs ===

export const BOSS_DEFS: Record<BossId, SpriteDef> = {
  boss_thornmaw: {
    info: {
      w: 48,
      h: 48,
      anchorX: 24,
      anchorY: 46,
      dirs: 1,
      anims: anims({ idle: [4, 4], attack: [2, 4], special: [3, 5], hurt: [1, 1] }),
    },
    draw: (a, f) => thornmaw(a, f),
  },
  boss_crystal_golem: {
    info: {
      w: 48,
      h: 48,
      anchorX: 24,
      anchorY: 47,
      dirs: 1,
      anims: anims({ idle: [4, 4], attack: [2, 3], special: [3, 5], hurt: [1, 1] }),
    },
    draw: (a, f) => crystalGolem(a, f),
  },
  boss_ignis: {
    info: {
      w: 64,
      h: 48,
      anchorX: 32,
      anchorY: 47,
      dirs: 1,
      anims: anims({ idle: [4, 5], attack: [2, 4], special: [3, 4], hurt: [1, 1] }),
    },
    draw: (a, f) => ignis(a, f),
  },
  boss_seraphine: {
    info: {
      w: 24,
      h: 32,
      anchorX: 12,
      anchorY: 31,
      dirs: 2,
      anims: anims({
        idle: [4, 4],
        move: [4, 6],
        attack: [2, 5],
        cast: [2, 4],
        special: [3, 5],
        hurt: [1, 1],
      }),
    },
    draw: (a, f) => seraphine(a, f),
  },
  boss_malachar: {
    info: {
      w: 24,
      h: 32,
      anchorX: 12,
      anchorY: 31,
      dirs: 2,
      anims: anims({
        idle: [4, 3],
        move: [4, 6],
        attack: [2, 5],
        cast: [1, 1],
        special: [3, 5],
        hurt: [1, 1],
      }),
    },
    draw: (a, f) => malachar(a, f),
  },
  boss_malachar_true: {
    info: {
      w: 64,
      h: 64,
      anchorX: 32,
      anchorY: 63,
      dirs: 1,
      anims: anims({ idle: [4, 4], attack: [2, 3], special: [3, 5], hurt: [1, 1] }),
    },
    draw: (a, f) => malacharTrue(a, f),
  },
};
