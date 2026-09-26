/**
 * Creatures, part D (Act II — Stormspire and the Eclipse Sanctum): harpy,
 * storm elemental, stone sentinel, eclipse knight, dusk wisp.
 * Side-view sprites face RIGHT.
 */
import { PAL } from '../../palette';
import type { AnimName, CreatureId } from '../types';
import { Buf, INK, mix, shade, type Col, type Pt, type Ramp } from './buf';
import { anims, sideDef } from './defs';
import type { SpriteDef } from './defs';
import { limb, shaded } from './shapes';

const K = '#000000';
const WHITE = '#ffffff';

/** Jagged lightning bolt between two points (deterministic per seed). */
function bolt(b: Buf, a: Pt, c: Pt, seed: number, core: Col = WHITE, glow: Col = PAL.yellow): void {
  const dx = c[0] - a[0];
  const dy = c[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const n = Math.max(2, Math.round(len / 2.5));
  const path: Pt[] = [a];
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const j = i === n ? 0 : (((seed * 7 + i * 13) % 5) - 2) * 0.8;
    path.push([a[0] + dx * t + (-dy / len) * j, a[1] + dy * t + (dx / len) * j]);
  }
  // glow along the whole path, bright core on every other pixel
  let k = 0;
  for (let i = 1; i < path.length; i++) {
    for (const [x, y] of Buf.linePts(path[i - 1][0], path[i - 1][1], path[i][0], path[i][1])) {
      b.set(x, y, k++ % 2 === 0 ? core : glow);
    }
  }
}

// ------------------------------------------------------------------ harpy ---

const FEATHER: Ramp = [PAL.darkSlate, PAL.slate, PAL.gray, PAL.lightGray];
const FEATHER_FAR: Ramp = [INK, PAL.navy, PAL.darkSlate];
const HAIR: Ramp = [PAL.purple, PAL.magenta, '#e39bd6'];
const TALON: Ramp = [PAL.rust, PAL.orange, PAL.gold];

type WingPose = 'up' | 'mid' | 'down' | 'fold';
const HARPY_WING: Record<WingPose, Pt[]> = {
  up: [
    [11, 9],
    [9, 4],
    [6.5, 1.4],
    [3, 1.2],
    [4.5, 3],
    [2, 4.2],
    [4.4, 5.4],
    [2.6, 7],
    [6, 7.6],
    [6.6, 9.6],
    [9, 10.6],
  ],
  mid: [
    [11, 9],
    [7, 6],
    [3, 5],
    [1.4, 6.2],
    [3.4, 7.4],
    [1.4, 9],
    [4.2, 9.4],
    [3, 11],
    [6.2, 11],
    [7.8, 12.4],
    [10, 11.6],
  ],
  down: [
    [11, 9],
    [8, 11],
    [5, 13.6],
    [2.6, 16.6],
    [4.8, 16.2],
    [4.4, 18.6],
    [6.6, 16.8],
    [7.4, 18.6],
    [8.6, 15.4],
    [10, 15],
    [11.4, 12],
  ],
  fold: [
    [11, 8],
    [7, 7],
    [3, 7.6],
    [1.4, 9],
    [4, 9.6],
    [2.4, 10.8],
    [6, 10.6],
    [8.6, 11.2],
    [11, 11],
  ],
};

function harpy(anim: AnimName, f: number): Buf {
  const W = 24;
  const b = new Buf(W, 24);
  const cyc: WingPose[] = ['up', 'mid', 'down', 'mid'];
  let wing: WingPose = cyc[f % 4];
  let by = wing === 'down' ? -1 : wing === 'up' ? 1 : 0;
  let bx = 0;
  let lean = 0;
  let legs: 'hang' | 'raise' | 'strike' | 'tuck' = 'hang';
  let hair = f % 2;
  let hurt = false;
  let streaks = false;
  if (anim === 'move') lean = 1;
  else if (anim === 'attack') {
    if (f === 0) {
      wing = 'up';
      legs = 'raise';
      by = 0;
      bx = -1;
    } else {
      wing = 'down';
      legs = 'strike';
      by = 1;
      bx = 1;
    }
  } else if (anim === 'special') {
    wing = 'fold';
    legs = 'tuck';
    lean = 2;
    by = 1 + f;
    bx = 1;
    streaks = f === 1;
    hair = 1;
  } else if (anim === 'hurt') {
    wing = 'up';
    hurt = true;
    bx = -1;
    by = 0;
  }
  const X = bx;
  const Y = by;
  const wingPoly = (pts: Pt[], dx: number, dy: number): Pt[] =>
    pts.map(([x, y]) => [Math.max(1.2, x + dx), Math.max(1.2, y + dy)] as Pt);
  const drawWing = (far: boolean): void => {
    const pts = wingPoly(HARPY_WING[wing], X + (far ? 3 : 0), Y + (far ? -1 : 0));
    const l = new Buf(W, 24);
    l.poly(pts, K);
    shade(l, far ? FEATHER_FAR : FEATHER, { rim: 0.25 });
    // feather separations from the shoulder to each trailing point
    const [sx, sy] = pts[0];
    for (let i = 3; i < pts.length - 1; i += 2) {
      for (const [x, y] of Buf.linePts(sx, sy, pts[i][0], pts[i][1]).slice(2)) {
        if (l.has(x, y)) l.set(x, y, far ? INK : FEATHER[0]);
      }
    }
    // pale feather tips along the trailing points
    if (!far) {
      for (let i = 2; i < pts.length - 1; i += 2) {
        const [x, y] = pts[i];
        l.tint(Math.round(x - 0.5), Math.round(y - 0.5), WHITE);
      }
    }
    b.overlay(l, INK, 'all');
  };
  drawWing(true);
  // tail fan
  b.line(10 + X, 15 + Y, 6 + X, 17 + Y, FEATHER[1])
    .line(10 + X, 16 + Y, 7 + X, 19 + Y, FEATHER[2])
    .line(11 + X, 16 + Y, 9 + X, 19 + Y, FEATHER[1]);
  b.set(6 + X, 17 + Y, PAL.lightGray).set(7 + X, 19 + Y, PAL.lightGray);
  // legs + talons
  const T = TALON;
  const talon = (hx: number, hy: number, fx: number, fy: number, far: boolean): void => {
    b.line(hx, hy, fx, fy, far ? T[0] : T[1]);
    b.set(fx, fy, far ? T[0] : T[2]);
    b.set(fx + 1, fy + 1, INK)
      .set(fx - 1, fy + 1, INK)
      .set(fx + 1, fy, far ? T[0] : T[1]);
  };
  const hipX = 12 + X + lean;
  const hipY = 16 + Y;
  const legPts: Record<typeof legs, [Pt, Pt]> = {
    hang: [
      [hipX - 1, hipY + 4],
      [hipX + 1, hipY + 5],
    ],
    raise: [
      [hipX + 3, hipY + 1],
      [hipX + 4, hipY + 2],
    ],
    strike: [
      [hipX + 5, hipY + 2],
      [hipX + 6, hipY + 4],
    ],
    tuck: [
      [hipX + 2, hipY + 2],
      [hipX + 3, hipY + 3],
    ],
  };
  const [lf, ln] = legPts[legs];
  talon(hipX, hipY, lf[0], lf[1], true);
  // feathered hips + torso
  b.overlay(
    shaded(
      W,
      24,
      FEATHER,
      (l) => {
        l.ellipse(12.4 + X + lean, 14.8 + Y, 2.6, 2.2, K);
        l.ellipse(13 + X + lean, 11.4 + Y, 2.1, 2.6, K);
      },
      { rim: 0.3 },
    ),
    INK,
    'back',
  );
  // bare shoulders/neck
  b.set(13 + X + lean, 9 + Y, PAL.skin)
    .set(14 + X + lean, 9 + Y, PAL.skinShade)
    .set(14 + X + lean, 10 + Y, PAL.skinShade);
  talon(hipX + 1, hipY, ln[0], ln[1], false);
  // head
  const hx = 14.4 + X + lean + (legs === 'tuck' ? 1 : 0);
  const hy = 6.4 + Y + (legs === 'tuck' ? 1 : 0);
  b.overlay(
    shaded(W, 24, [PAL.skinShade, PAL.skin, '#f4d2b8'], (l) => l.ellipse(hx, hy, 2.3, 2.4, K), { rim: 0.3 }),
    INK,
    'back',
  );
  const ex = Math.round(hx + 0.6);
  const ey = Math.round(hy - 0.6);
  b.set(ex, ey, hurt ? INK : PAL.yellow).set(ex - 1, ey, INK);
  b.set(ex + 1, ey + 2, PAL.darkRed);
  // wild violet hair streaming back
  const hr = new Buf(W, 24);
  const hxr = Math.round(hx);
  const hyr = Math.round(hy);
  hr.hline(hxr - 2, hxr + 1, hyr - 3, K).hline(hxr - 3, hxr + 1, hyr - 2, K);
  hr.rect(hxr - 4, hyr - 1, 3, 3, K);
  hr.line(hxr - 4, hyr - 2, hxr - 7, hyr - 3 + hair, K);
  hr.line(hxr - 4, hyr, hxr - 8, hyr + 1 - hair, K);
  hr.line(hxr - 4, hyr + 2, hxr - 6, hyr + 4, K);
  shade(hr, HAIR, { rim: 0.3 });
  b.overlay(hr, PAL.plum, 'back');
  drawWing(false);
  b.outline(INK);
  if (legs === 'strike')
    b.set(23, 17 + Y, '#ffffffa0')
      .set(22, 20 + Y, '#ffffffc0')
      .set(20, 22, '#ffffff90');
  if (streaks) {
    for (const [x, y] of [
      [0, 4],
      [1, 10],
      [0, 15],
    ] as const)
      b.line(x, y, x + 3, y + 2, '#ffffff90');
  }
  return b;
}

// -------------------------------------------------------- storm elemental ---

const CLOUD: Ramp = [PAL.darkSlate, PAL.slate, PAL.gray, PAL.lightGray];

function stormElemental(anim: AnimName, f: number): Buf {
  const W = 24;
  const b = new Buf(W, 24);
  const by = [0, -1, -1, 0][f % 4];
  let lean = anim === 'move' ? 1 : 0;
  let arms: 'rest' | 'back' | 'thrust' | 'raise' | 'wide' = 'rest';
  let eyes: 'glow' | 'flare' | 'x' = 'glow';
  let strike: 'none' | 'fwd' | 'up' | 'beam' = 'none';
  let charge = 0;
  if (anim === 'attack') {
    arms = f === 0 ? 'back' : 'thrust';
    lean = f === 0 ? -1 : 1;
    if (f === 1) strike = 'fwd';
    else charge = 1;
  } else if (anim === 'cast') {
    arms = 'raise';
    strike = 'up';
    charge = 1 + f;
  } else if (anim === 'special') {
    arms = 'wide';
    eyes = 'flare';
    if (f === 1) strike = 'beam';
    else charge = 2;
  } else if (anim === 'hurt') {
    eyes = 'x';
    lean = -1;
  }
  const X = lean;
  const Y = by;
  const puff = (i: number): number => [0, 0.5, 0, -0.5][(f + i) % 4];
  // vortex tail
  const sw = [0, 1, 0, -1][f % 4];
  const tail = new Buf(W, 24);
  tail.poly(
    [
      [8 + X, 13 + Y],
      [16 + X, 13 + Y],
      [14 + X * 0.5, 17 + Y],
      [12.6 + sw, 21],
      [11.4 + sw * 1.5, 22],
      [11 + sw, 19],
      [9 + X * 0.5, 16 + Y],
    ],
    K,
  );
  shade(tail, [INK, PAL.navy, PAL.darkSlate], { rim: 0.2 });
  b.blit(tail);
  // far arm puff
  const armAt = (p: Pt, far: boolean): void => {
    b.overlay(
      shaded(
        W,
        24,
        far ? [INK, PAL.navy, PAL.darkSlate] : CLOUD,
        (l) => {
          l.ellipse(p[0], p[1], 2.1, 1.9, K);
        },
        { rim: 0.3 },
      ),
      INK,
      'all',
    );
  };
  const armPos: Record<typeof arms, [Pt, Pt]> = {
    rest: [
      [5.5 + X, 12.5 + Y],
      [18.5 + X, 12.5 + Y],
    ],
    back: [
      [5.5 + X, 11.5 + Y],
      [4.5 + X, 8.5 + Y],
    ],
    thrust: [
      [6 + X, 12.5 + Y],
      [20.5, 10.5 + Y],
    ],
    raise: [
      [6.5 + X, 5 + Y],
      [17.5 + X, 5 + Y],
    ],
    wide: [
      [3.5 + X, 9.5 + Y],
      [20.5 + X, 9.5 + Y],
    ],
  };
  const [fa, na] = armPos[arms];
  armAt(fa, true);
  // cloud body: individually shaded puffs, back to front, so the scallops read
  const puffs: [number, number, number][] = [
    [12, 12.2, 5.4],
    [6.4, 10.6, 2.3],
    [17.8, 10.6, 2.3],
    [12, 9.8, 4.6],
    [7.8, 7.8 + puff(0), 2.7],
    [17, 8 + puff(3), 2.6],
    [10.8, 5.8 + puff(1), 2.9],
    [14.6, 5.6 + puff(2), 2.7],
  ];
  for (const [px, py, pr] of puffs) {
    const l = shaded(W, 24, CLOUD, (q) => q.ellipse(px + X, py + Y, pr, pr * 0.9, K), {
      lx: -0.4,
      ly: -1,
      rim: 0.4,
    });
    b.overlay(l, CLOUD[0], 'back');
  }
  // puff seams + dark rain-heavy belly
  for (let x = 7; x <= 17; x++) b.tint(x + X, 13 + Y, PAL.navy).tint(x + X, 14 + Y, PAL.navy);
  // lightning flickering inside the cloud
  const fl = [
    [8, 8],
    [15, 11],
    [10, 5],
    [12, 11],
  ][f % 4];
  b.tint(fl[0] + X, fl[1] + Y, PAL.yellow)
    .tint(fl[0] + X + 1, fl[1] + Y + 1, WHITE)
    .tint(fl[0] + X, fl[1] + Y + 2, PAL.yellow);
  // face
  const fx = 14 + X;
  const fy = 8 + Y;
  if (eyes === 'x') {
    b.set(fx, fy, WHITE)
      .set(fx + 1, fy + 1, WHITE)
      .set(fx + 3, fy, WHITE)
      .set(fx + 2, fy + 1, WHITE);
  } else {
    const ec = eyes === 'flare' ? WHITE : PAL.cyan;
    b.rect(fx, fy, 2, 2, INK).rect(fx + 3, fy, 2, 2, INK);
    b.set(fx + 1, fy, ec).set(fx + 4, fy, ec);
    b.set(fx + 1, fy + 1, eyes === 'flare' ? PAL.cyan : PAL.sky).set(
      fx + 4,
      fy + 1,
      eyes === 'flare' ? PAL.cyan : PAL.sky,
    );
  }
  // jagged mouth
  b.set(fx + 1, fy + 3, INK)
    .set(fx + 2, fy + 4, INK)
    .set(fx + 3, fy + 3, INK)
    .set(fx + 4, fy + 4, INK);
  if (strike !== 'none' || charge) b.set(fx + 2, fy + 3, PAL.yellow).set(fx + 3, fy + 4, PAL.yellow);
  armAt(na, false);
  b.outline(INK);
  // crackling lightning
  const s = f % 4;
  if (strike === 'none' && anim !== 'hurt') {
    // arcs dripping out of the underside
    const ax = [9, 15, 11, 14][s] + X;
    bolt(b, [ax, 14 + Y], [ax + (s % 2 ? 2 : -2), 19 + Y], s);
  }
  if (charge) {
    const [hx, hy] = arms === 'raise' ? [12 + X, 2] : na;
    const r = 1 + charge;
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + f;
      const x = Math.round(hx + Math.cos(a) * (r + 0.5));
      const y = Math.round(hy + Math.sin(a) * (r + 0.5));
      if (!b.has(x, y)) b.set(x, y, k % 2 ? PAL.yellow : PAL.cyan);
    }
    if (arms === 'raise') {
      b.blit(
        shaded(
          W,
          24,
          [PAL.sky, PAL.cyan, '#c9fbff', WHITE],
          (l) => l.ellipse(hx + 0.5, hy + 0.5, r * 0.8, r * 0.8, K),
          { rim: 0.1 },
        ),
      );
    }
  }
  if (strike === 'fwd') {
    bolt(b, [21, 10 + Y], [23, 5 + Y], 1);
    bolt(b, [21, 11 + Y], [23, 16 + Y], 2);
  } else if (strike === 'up') {
    bolt(b, [7 + X, 3], [4 + X, 0], 3);
    bolt(b, [17 + X, 3], [20 + X, 0], 4);
  } else if (strike === 'beam') {
    b.rect(18 + X, 9 + Y, 24, 3, '#fee76180');
    bolt(b, [18 + X, 10 + Y], [23, 10 + Y], 5, WHITE, PAL.cyan);
    b.hline(18 + X, 23, 10 + Y, WHITE);
  }
  if (anim === 'special' && f === 0) {
    for (const [x, y] of [
      [2, 4],
      [21, 3],
      [1, 15],
      [22, 16],
    ] as const)
      b.set(x, y, PAL.cyan);
  }
  return b;
}

// --------------------------------------------------------- stone sentinel ---

const SENT: Ramp = [PAL.darkSlate, PAL.slate, PAL.gray, PAL.lightGray];
const SENT_FAR: Ramp = [PAL.navy, PAL.darkSlate, PAL.slate];

function stoneSentinel(anim: AnimName, f: number): Buf {
  const W = 24;
  const b = new Buf(W, 24);
  let by = 0;
  let bx = 0;
  let lifts = [0, 0];
  let glow = 0; // rune brightness 0..2
  let fists: [Pt, Pt] = [
    [5, 17],
    [18, 17],
  ];
  let pose: 'stand' | 'wind' | 'punch' | 'raise' | 'slam' = 'stand';
  let hurt = false;
  if (anim === 'idle') {
    by = f;
    glow = f;
  } else if (anim === 'move') {
    lifts = [
      [0, 0],
      [2, 0],
      [0, 0],
      [0, 2],
    ][f];
    by = f % 2 === 1 ? -1 : 0;
    bx = f === 1 ? 1 : f === 3 ? -1 : 0;
    glow = f % 2;
    fists = [
      [5 + (f === 1 ? -1 : f === 3 ? 1 : 0), 17],
      [18 + (f === 1 ? 1 : f === 3 ? -1 : 0), 17],
    ];
  } else if (anim === 'attack') {
    glow = 1 + f;
    if (f === 0) {
      pose = 'wind';
      bx = -1;
      fists = [
        [5, 16],
        [11, 11],
      ];
    } else {
      pose = 'punch';
      bx = 1;
      fists = [
        [6, 17],
        [21, 12],
      ];
    }
  } else if (anim === 'special') {
    glow = 2;
    if (f === 0) {
      pose = 'raise';
      by = -1;
      fists = [
        [9, 3],
        [16, 2],
      ];
    } else {
      pose = 'slam';
      by = 2;
      fists = [
        [13, 20],
        [19, 20],
      ];
    }
  } else if (anim === 'hurt') {
    bx = -1;
    hurt = true;
    fists = [
      [4, 15],
      [16, 16],
    ];
  }
  const RUNE = hurt ? WHITE : glow === 2 ? '#c9fbff' : glow === 1 ? PAL.cyan : PAL.sky;
  const block = (draw: (l: Buf) => void, far = false, edge: Col = INK): void => {
    b.overlay(shaded(W, 24, far ? SENT_FAR : SENT, draw, { rim: 0.22 }), edge, 'all');
  };
  // legs: stone pillars
  const leg = (x: number, lift: number, far: boolean): void => {
    block((l) => l.rect(x, 17 - lift, 4, 6, K), far);
    b.hline(x, x + 3, 22 - lift, far ? INK : SENT[0]);
    if (!far) b.set(x + 2, 19 - lift, RUNE);
  };
  const arm = (sh: Pt, fist: Pt, far: boolean): void => {
    const l = new Buf(W, 24);
    limb(l, sh, fist, 3.4, 3, K);
    l.rect(fist[0] - 1.5, fist[1] - 1.5, 4, 4, K);
    shade(l, far ? SENT_FAR : SENT, { rim: 0.22 });
    b.overlay(l, INK, 'all');
    // knuckle rune
    if (!far) b.set(Math.round(fist[0]) + 1, Math.round(fist[1]), RUNE);
  };
  const X = bx;
  const Y = by;
  leg(7 + X, lifts[0], true);
  arm([7 + X, 11 + Y], fists[0], true);
  leg(12 + X, lifts[1], false);
  // torso: broad carved block
  block((l) => {
    l.poly(
      [
        [6 + X, 8 + Y],
        [18 + X, 8 + Y],
        [16.5 + X, 17.5 + Y],
        [7.5 + X, 17.5 + Y],
      ],
      K,
    );
  });
  // carved plate lines + chest rune
  b.hline(8 + X, 16 + X, 13 + Y, SENT[0]);
  b.vline(12 + X, 14 + Y, 17 + Y, SENT[0]);
  const rx = 12 + X;
  const ry = 10 + Y;
  b.set(rx, ry - 1, RUNE)
    .set(rx - 1, ry, RUNE)
    .set(rx + 1, ry, RUNE)
    .set(rx, ry + 1, RUNE)
    .set(rx, ry, hurt ? WHITE : PAL.navy);
  b.set(9 + X, 15 + Y, RUNE).set(15 + X, 15 + Y, RUNE);
  // head: squared helm with a glowing visor slit
  const hy = 0;
  block((l) => {
    l.rect(11 + X, 2 + Y + hy, 6, 6, K);
    l.rect(12 + X, 1 + Y + hy, 4, 1, K);
  });
  b.hline(13 + X, 16 + X, 4 + Y + hy, INK).hline(14 + X, 16 + X, 4 + Y + hy, RUNE);
  b.set(12 + X, 6 + Y + hy, SENT[0]).set(13 + X, 7 + Y + hy, SENT[0]);
  // pauldrons
  block((l) => l.rect(15 + X, 7 + Y, 5, 4, K));
  b.set(17 + X, 8 + Y, RUNE);
  if (pose === 'raise') arm([16 + X, 9 + Y], fists[1], false);
  else arm([17 + X, 10 + Y], fists[1], false);
  // weathering: cracks, chips and storm lichen on the upward faces
  for (const [x, y, c] of [
    [8, 10, SENT[0]],
    [9, 11, SENT[0]],
    [9, 12, SENT[0]],
    [14, 15, SENT[0]],
    [15, 16, SENT[0]],
    [7, 9, SENT[3]],
    [12, 2, PAL.darkGreen],
    [13, 2, PAL.green],
    [16, 7, PAL.darkGreen],
    [18, 7, PAL.green],
    [7, 8, PAL.darkGreen],
  ] as [number, number, Col][])
    b.tint(x + X, y + Y, c);
  b.outline(INK);
  if (pose === 'slam') {
    for (const [x, y, c] of [
      [10, 22, SENT[3]],
      [23, 21, SENT[3]],
      [22, 17, SENT[2]],
      [9, 19, SENT[2]],
      [23, 18, PAL.cyan],
      [8, 21, PAL.cyan],
    ] as [number, number, Col][])
      b.set(x, y, c);
  } else if (pose === 'punch') {
    b.set(23, 10, '#ffffffa0').set(23, 14, '#ffffffc0');
  } else if (pose === 'raise') {
    b.set(6, 1, PAL.cyan).set(20, 0, PAL.cyan);
  }
  return b;
}

// --------------------------------------------------------- eclipse knight ---

const GOLD: Ramp = [PAL.darkBrown, PAL.orangeBrown, PAL.gold, PAL.yellow];
const BLACK: Ramp = [INK, PAL.navy, PAL.darkSlate];
const BLACK_FAR: Ramp = [INK, PAL.navy];

/** Black disc with a gold corona — the rogue Order's black-sun sigil. */
function blackSun(b: Buf, cx: number, cy: number, r: number): void {
  b.ellipse(cx, cy, r + 1, r + 1, PAL.gold);
  b.ellipse(cx, cy, r + 0.35, r + 0.35, PAL.orange);
  b.ellipse(cx, cy, r, r, INK);
}

function eclipseKnight(anim: AnimName, f: number): Buf {
  const b = new Buf(16, 24);
  let bob = 0;
  let lifts = [0, 0];
  let sword: 'rest' | 'raise' | 'swing' | 'guard' = 'rest';
  let lean = 0;
  let shield: 'side' | 'front' = 'side';
  let hurt = false;
  let flare = false;
  if (anim === 'idle') bob = f;
  else if (anim === 'move') {
    lifts = [
      [0, 0],
      [1, 0],
      [0, 0],
      [0, 1],
    ][f];
    bob = f % 2 ? 0 : 1;
  } else if (anim === 'attack') {
    sword = f === 0 ? 'raise' : 'swing';
    lean = f === 0 ? -1 : 1;
  } else if (anim === 'special') {
    sword = 'guard';
    shield = 'front';
    lean = f === 0 ? 0 : 1;
    bob = f === 0 ? 1 : 0;
    flare = f === 1;
    lifts = f === 1 ? [0, 1] : [0, 0];
  } else if (anim === 'hurt') {
    lean = -1;
    hurt = true;
  }
  const X = lean;
  const Y = bob;
  // black-sun crest disc mounted behind the helm
  blackSun(b, 5.4 + X, 4.6 + Y, 1.7);
  // cape: black with a gold hem
  const cape = new Buf(16, 24);
  cape.poly(
    [
      [5 + X, 10 + Y],
      [8 + X, 10 + Y],
      [6, 21],
      [4.5, 20.4],
      [2.6, 21.6],
      [2.4 - (anim === 'move' ? f % 2 : 0) - (flare ? 1 : 0), 17],
    ],
    K,
  );
  shade(cape, [INK, PAL.navy, PAL.darkSlate], { rim: 0.2 });
  b.blit(cape);
  cape.each((_c, x, y) => {
    if (!cape.has(x, y + 1)) b.set(x, y, PAL.gold);
  });
  // shield: black field, gold rim, gold corona ring around a black disc
  const drawShield = (cx: number, cy: number): void => {
    const s = new Buf(16, 24);
    s.ellipse(cx, cy, 2.9, 3.5, K);
    shade(s, GOLD, { rim: 0.3 });
    s.ellipse(cx, cy, 1.9, 2.5, PAL.navy);
    s.ellipse(cx, cy, 1.3, 1.6, PAL.gold);
    s.ellipse(cx, cy, 0.8, 1, INK);
    b.overlay(s, INK, 'all');
  };
  if (shield === 'side') drawShield(4 + X, 14.5 + Y);
  // legs: black greaves, gold knees and sabatons
  const leg = (x: number, lift: number, far: boolean): void => {
    b.blit(shaded(16, 24, far ? BLACK_FAR : BLACK, (l) => l.rect(x, 17, 2, 6 - lift, K), { rim: 0.3 }));
    b.set(x, 19 - lift, far ? PAL.darkBrown : PAL.gold).set(
      x + 1,
      19 - lift,
      far ? PAL.darkBrown : PAL.orangeBrown,
    );
    b.set(x, 22 - lift, far ? PAL.darkBrown : PAL.orangeBrown)
      .set(x + 1, 22 - lift, far ? PAL.darkBrown : PAL.gold)
      .set(x + 2, 22 - lift, far ? PAL.plum : PAL.darkBrown);
  };
  leg(6, lifts[0], true);
  leg(8, lifts[1], false);
  // torso: black cuirass with gold trim and a sun sigil
  b.blit(
    shaded(
      16,
      24,
      BLACK,
      (l) => {
        l.rect(5 + X, 10 + Y, 6, 7, K);
      },
      { rim: 0.3 },
    ),
  );
  b.hline(5 + X, 10 + X, 16 + Y, PAL.gold).set(8 + X, 16 + Y, PAL.yellow);
  b.vline(10 + X, 11 + Y, 15 + Y, PAL.orangeBrown);
  b.set(8 + X, 12 + Y, PAL.gold)
    .set(7 + X, 13 + Y, PAL.gold)
    .set(9 + X, 13 + Y, PAL.gold)
    .set(8 + X, 14 + Y, PAL.gold)
    .set(8 + X, 13 + Y, INK);
  // gold pauldron
  b.blit(shaded(16, 24, GOLD, (l) => l.ellipse(6.6 + X, 10.8 + Y, 2.2, 1.6, K), { rim: 0.3 }));
  // helm: gold, visor slit glowing
  b.overlay(
    shaded(
      16,
      24,
      GOLD,
      (l) => {
        l.ellipse(8.6 + X, 6.2 + Y, 3.4, 3.6, K);
        l.rect(6 + X, 7 + Y, 6, 3, K);
      },
      { rim: 0.32 },
    ),
    INK,
    'back',
  );
  b.hline(9 + X, 12 + X, 6 + Y, INK)
    .set(10 + X, 6 + Y, hurt ? PAL.red : WHITE)
    .set(12 + X, 6 + Y, hurt ? PAL.darkRed : PAL.yellow);
  b.hline(10 + X, 11 + X, 8 + Y, PAL.darkBrown);
  b.vline(8 + X, 3 + Y, 5 + Y, PAL.yellow);
  // sword: pale steel, gold hilt
  const BL: Col = PAL.lightGray;
  if (sword === 'rest') {
    b.line(12 + X, 14 + Y, 12 + X, 5 + Y, BL).line(13 + X, 14 + Y, 13 + X, 6 + Y, PAL.gray);
    b.set(12 + X, 5 + Y, WHITE);
    b.hline(10 + X, 14 + X, 15 + Y, PAL.gold).set(12 + X, 15 + Y, INK);
    b.set(12 + X, 16 + Y, PAL.darkBrown).set(12 + X, 17 + Y, PAL.gold);
    b.set(11 + X, 16 + Y, PAL.orangeBrown);
  } else if (sword === 'raise') {
    b.line(7 + X, 7, 3 + X, 2, BL).line(8 + X, 7, 4 + X, 2, PAL.gray);
    b.set(3 + X, 2, WHITE);
    b.line(8 + X, 11, 8 + X, 8, PAL.orangeBrown).line(6 + X, 9, 9 + X, 6, PAL.gold);
  } else if (sword === 'swing') {
    b.line(12, 14, 13, 21, BL).line(13, 14, 14, 21, PAL.gray);
    b.set(13, 21, WHITE);
    b.line(9 + X, 12, 11, 12, PAL.orangeBrown).line(10, 13, 13, 12, PAL.gold);
  } else {
    // sword held low behind the charging shield
    b.line(10 + X, 16 + Y, 14 + X, 19 + Y, BL);
    b.set(14 + X, 19 + Y, WHITE);
  }
  if (shield === 'front') drawShield(12 + X, 13 + Y);
  b.outline(INK);
  if (sword === 'swing') {
    for (const [x, y] of [
      [14, 9],
      [15, 11],
      [15, 13],
    ] as const)
      b.set(x, y, '#feae34c0');
  }
  if (flare) {
    for (const [x, y] of [
      [0, 9],
      [1, 13],
      [0, 17],
    ] as const)
      b.hline(x, x + 1, y, '#feae34a0');
  }
  return b;
}

// -------------------------------------------------------------- dusk wisp ---

const DUSK: Ramp = [PAL.purple, PAL.magenta, PAL.orange, PAL.gold];

function duskWisp(anim: AnimName, f: number): Buf {
  const b = new Buf(16, 16);
  const by = [0, -1, -1, 0][f % 4];
  let r = 3.8;
  let trail = anim === 'move' ? 2 : 1;
  let dx = anim === 'move' ? 1 : 0;
  let core = 1.8;
  let rays = 0;
  let hurt = false;
  if (anim === 'attack') {
    r = f === 0 ? 3.1 : 4.5;
    core = f === 0 ? 1.4 : 2.2;
    dx = f === 0 ? -1 : 1;
    rays = f;
  } else if (anim === 'special') {
    r = 4.4 + f * 0.8;
    core = 2 + f * 0.4;
    rays = 1 + f;
    trail = 0;
  } else if (anim === 'hurt') {
    r = 3.4;
    hurt = true;
    dx = -1;
  }
  const cx = 8 + dx;
  const cy = 8.5 + by;
  const orb = new Buf(16, 16);
  orb.ellipse(cx, cy, r, r, K);
  // wispy tails trailing behind (left), flickering per frame
  const lw = [0, 1, 0, -1][f % 4];
  if (trail) {
    orb.poly(
      [
        [cx - r * 0.3, cy - r * 0.9],
        [cx - r - 1.6 - trail + lw * 0.5, cy - 1.4 + lw],
        [cx - r * 0.2, cy],
      ],
      K,
    );
    orb.poly(
      [
        [cx - r * 0.3, cy + 0.2],
        [cx - r - 1 - trail - lw * 0.5, cy + 1.8 - lw],
        [cx - r * 0.2, cy + r * 0.8],
      ],
      K,
    );
  }
  shade(orb, DUSK, { lx: -0.2, ly: -1, rim: 0.15 });
  b.blit(orb);
  // dark eclipsed core with a thin bright corona
  const kx = cx + 0.5;
  b.ellipse(kx, cy, core + 0.9, core + 0.9, PAL.yellow);
  b.ellipse(kx, cy, core, core, INK);
  // 'diamond ring' glint on the corona (flickers red when hurt)
  const ga = -Math.PI / 4 + [0, 0.3, 0, -0.3][f % 4];
  const gx = Math.round(kx - 0.5 + Math.cos(ga) * (core + 0.5));
  const gy = Math.round(cy - 0.5 + Math.sin(ga) * (core + 0.5));
  b.set(gx, gy, hurt ? PAL.hotPink : WHITE);
  b.outline((n) => mix(n, INK, 0.7));
  // corona rays / motes
  if (rays) {
    const rr = r + 1.5 + rays * 0.8;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + (rays > 1 ? Math.PI / 8 : 0);
      const x = Math.round(cx + Math.cos(a) * rr);
      const y = Math.round(cy + Math.sin(a) * rr);
      if (!b.has(x, y)) b.set(x, y, k % 2 ? PAL.gold : PAL.pink);
    }
  }
  const sp = [
    [3, 3],
    [13, 4],
    [2, 13],
    [13, 13],
  ][f % 4];
  if (!b.has(sp[0], sp[1] + by)) b.set(sp[0], sp[1] + by, f % 2 ? PAL.gold : PAL.pink);
  return b;
}

// ------------------------------------------------------------------- defs ---

const SMALL = { w: 16, h: 16, anchorX: 8, anchorY: 15 } as const;
const TALL = { w: 16, h: 24, anchorX: 8, anchorY: 23 } as const;
const BIG = { w: 24, h: 24, anchorX: 12, anchorY: 23 } as const;

export const CREATURE_D_DEFS: Partial<Record<CreatureId, SpriteDef>> = {
  harpy: sideDef(
    {
      ...BIG,
      anims: anims({
        idle: [4, 8],
        move: [4, 12],
        fly: [4, 12],
        attack: [2, 6],
        special: [2, 8],
        hurt: [1, 1],
      }),
    },
    (a, f) => harpy(a === 'fly' ? 'move' : a, f),
  ),
  storm_elemental: sideDef(
    {
      ...BIG,
      anims: anims({
        idle: [4, 6],
        move: [4, 8],
        fly: [4, 8],
        attack: [2, 5],
        cast: [2, 4],
        special: [2, 8],
        hurt: [1, 1],
      }),
    },
    (a, f) => stormElemental(a === 'fly' ? 'move' : a, f),
  ),
  stone_sentinel: sideDef(
    { ...BIG, anims: anims({ idle: [2, 2], move: [4, 4], attack: [2, 3], special: [2, 3], hurt: [1, 1] }) },
    stoneSentinel,
  ),
  eclipse_knight: sideDef(
    { ...TALL, anims: anims({ idle: [2, 2], move: [4, 6], attack: [2, 5], special: [2, 6], hurt: [1, 1] }) },
    eclipseKnight,
  ),
  dusk_wisp: sideDef(
    {
      ...SMALL,
      anims: anims({
        idle: [4, 8],
        move: [4, 10],
        fly: [4, 10],
        attack: [2, 5],
        special: [2, 8],
        hurt: [1, 1],
      }),
    },
    (a, f) => duskWisp(a === 'fly' ? 'move' : a, f),
  ),
};
