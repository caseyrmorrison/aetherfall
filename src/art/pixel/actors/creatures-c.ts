/**
 * Creatures, part C (Act II — Sunscar Dunes and the Sunken Temple): scorpion,
 * sand wraith, dune raider, cactoid, drowned, reef crab, naga adept.
 * Side-view sprites face RIGHT.
 */
import { PAL } from '../../palette';
import type { AnimName, CreatureId } from '../types';
import { Buf, INK, mix, shade, type Col, type Pt, type Ramp } from './buf';
import { anims, sideDef } from './defs';
import type { SpriteDef } from './defs';
import { bend, limb, shaded, tri } from './shapes';

const K = '#000000';
const WHITE = '#ffffff';

/** Four-step gait tables shared by the walkers: [far, near] foot lifts. */
const LIFTS: readonly (readonly [number, number])[] = [
  [0, 0],
  [1, 0],
  [0, 0],
  [0, 1],
];

// --------------------------------------------------------------- scorpion ---

const SCORP: Ramp = [PAL.darkBrown, PAL.brown, PAL.orangeBrown, PAL.tan];
const SCORP_FAR: Ramp = [PAL.plum, PAL.darkBrown, PAL.brown];

function scorpion(anim: AnimName, f: number): Buf {
  const W = 24;
  const b = new Buf(W, 16);
  let bx = 0;
  const by = 0;
  let steps = [0, 0, 0, 0];
  let lifts = [0, 0, 0, 0];
  // tail joints: rear of the abdomen → stinger bulb, plus the barb tip
  let tail: Pt[] = [
    [5.6, 8.4],
    [3.6, 7],
    [2.6, 5],
    [3.2, 3],
    [5.2, 1.9],
    [7.8, 1.8],
    [9.8, 2.6],
  ];
  let barb: Pt = [12, 5.6];
  let open = 1;
  let pdx = 0;
  let pdy = 0;
  let venom = false;
  let flinch = false;
  if (anim === 'idle') {
    tail = bend(tail, f * 0.6, f * 0.3);
    barb = [barb[0] + f * 0.6, barb[1] + f * 0.3];
    open = 1 + f * 0.6;
    pdy = f;
  } else if (anim === 'move') {
    steps = [
      [1, -1, 1, -1],
      [0, 0, 0, 0],
      [-1, 1, -1, 1],
      [0, 0, 0, 0],
    ][f];
    lifts = [
      [1, 0, 1, 0],
      [0, 0, 0, 0],
      [0, 1, 0, 1],
      [0, 0, 0, 0],
    ][f];
    const sw = [0, 0.8, 0, -0.8][f];
    tail = bend(tail, sw, 0);
    barb = [barb[0] + sw, barb[1]];
    pdx = [0, 1, 0, -1][f];
    open = 1 + (f % 2) * 0.6;
  } else if (anim === 'attack') {
    if (f === 0) {
      bx = -1;
      tail = [
        [5.6, 8.4],
        [3.6, 7],
        [2.2, 5],
        [2.2, 2.8],
        [3.8, 1.6],
        [6.2, 1.5],
        [8, 2.4],
      ];
      barb = [9.8, 5];
      open = 2;
      pdy = -1;
    } else {
      bx = 1;
      tail = [
        [5.6, 8.4],
        [4.2, 6.2],
        [4.8, 3.8],
        [7, 2.2],
        [10, 1.8],
        [13, 2.4],
        [15.6, 3.8],
      ];
      barb = [19, 6.6];
      open = 0;
      pdx = 1;
      venom = true;
    }
  } else if (anim === 'hurt') {
    bx = -1;
    flinch = true;
    tail = bend(tail, -1.2, 0.8);
    barb = [barb[0] - 1.2, barb[1] + 0.8];
    open = 2;
    pdy = -1;
  }
  tail = tail.map(([x, y]) => [x + bx - 0.8, y + by] as Pt);
  barb = [barb[0] + bx - 0.8, barb[1] + by];

  const leg = (i: number, far: boolean): void => {
    const dir = i < 2 ? -1 : 1;
    const ax = [7, 9.2, 11.4, 13.4][i] + bx + (far ? 1 : 0);
    const ay = 10.6 + by;
    const st = far ? -steps[i] : steps[i];
    const lf = far ? lifts[(i + 1) % 4] : lifts[i];
    const kx = ax + dir * (far ? 1 : 1.6);
    const ky = ay - (far ? 1 : 0.4) - lf;
    const fx = ax + dir * (far ? 1.6 : 2.6) + st;
    const fy = (far ? 13 : 14) - lf;
    const c = far ? SCORP_FAR[1] : SCORP[2];
    b.line(ax, ay, kx, ky, c).line(kx, ky, fx, fy, far ? SCORP_FAR[1] : SCORP[1]);
  };
  const pincer = (sh: Pt, el: Pt, wx: number, wy: number, op: number, far: boolean): void => {
    const l = new Buf(W, 16);
    limb(l, sh, el, 2, 1.6, K);
    limb(l, el, [wx, wy], 1.6, 1.6, K);
    l.ellipse(wx + 1.4, wy + 0.4, far ? 1.7 : 2, far ? 1.4 : 1.7, K);
    // fixed + moving finger with a gap between them
    l.poly(
      [
        [wx + 1.6, wy - 1.2],
        [wx + 4.4, wy - 1 - op],
        [wx + 4.4, wy - op],
        [wx + 2.4, wy],
      ],
      K,
    );
    l.poly(
      [
        [wx + 2.2, wy + 1],
        [wx + 4, wy + 1 + op * 0.4],
        [wx + 3.6, wy + 2.2 + op * 0.4],
        [wx + 1.6, wy + 2],
      ],
      K,
    );
    shade(l, far ? SCORP_FAR : SCORP, { rim: 0.35, bias: far ? 0 : 0.3 });
    // darker finger tips
    let mx = 0;
    l.each((_c, x) => (mx = Math.max(mx, x)));
    l.each((_c, x, y) => {
      if (x === mx) l.set(x, y, far ? INK : PAL.plum);
    });
    b.overlay(l, far ? INK : SCORP[0], 'all');
  };

  for (let i = 0; i < 4; i++) leg(i, true);
  pincer([15 + bx, 9 + by], [16.6 + bx, 8.4 + by], 18.4 + bx - pdx, 8 + by + pdy, open, true);
  // tail: shaded beads so the segments read
  tail.forEach(([x, y], i) => {
    const r = 1.45 - i * 0.05;
    const l = shaded(W, 16, SCORP, (q) => q.ellipse(x + 0.5, y + 0.5, r, r, K), { rim: 0.35 });
    b.overlay(l, SCORP[0], 'back');
  });
  const last = tail[tail.length - 1];
  const bulb = shaded(
    W,
    16,
    [PAL.darkRed, PAL.rust, PAL.orange],
    (q) => q.ellipse(last[0] + 1.6, last[1] + 1.4, 1.6, 1.5, K),
    { rim: 0.3 },
  );
  b.overlay(bulb, SCORP[0], 'back');
  b.line(last[0] + 2, last[1] + 2, barb[0], barb[1], PAL.plum);
  // body: segmented abdomen + carapace
  const body = shaded(
    W,
    16,
    SCORP,
    (q) => {
      q.ellipse(9.2 + bx, 9.5 + by, 5, 2, K);
      q.ellipse(13.9 + bx, 9.7 + by, 2.5, 1.9, K);
    },
    { rim: 0.3 },
  );
  b.overlay(body, SCORP[0], 'back');
  for (const sx of [6, 8, 10]) {
    for (let y = 7; y <= 11; y++) {
      const c = b.get(sx + bx, y + by);
      if (c === SCORP[2] || c === SCORP[3]) b.set(sx + bx, y + by, SCORP[1]);
    }
  }
  for (let i = 0; i < 4; i++) leg(i, false);
  pincer([15.4 + bx, 10.6 + by], [17 + bx, 11.8 + by], 18.2 + bx + pdx, 10.8 + by + pdy, open, false);
  // eyes on the carapace crown
  b.set(13 + bx, 8 + by, flinch ? WHITE : INK).set(14 + bx, 8 + by, flinch ? WHITE : PAL.red);
  b.outline(INK);
  b.set(Math.round(barb[0]), Math.round(barb[1]), PAL.plum);
  if (venom) b.set(Math.round(barb[0]), Math.round(barb[1]) + 1, PAL.green);
  if (anim === 'attack' && f === 1) b.set(23, 4, '#ffffffa0').set(23, 6, '#ffffffc0').set(22, 8, '#ffffffa0');
  return b;
}

// ------------------------------------------------------------ sand wraith ---

const SAND: Ramp = [PAL.brown, PAL.tan, PAL.sand, '#fff4dc'];

function sandWraith(anim: AnimName, f: number): Buf {
  const b = new Buf(16, 24);
  const by = [1, 0, 0, 1][f % 4];
  let lean = anim === 'move' ? 1 : 0;
  let hands: 'rest' | 'back' | 'swipe' | 'raise' | 'spread' = 'rest';
  let spin = 0;
  let hurt = false;
  if (anim === 'attack') {
    hands = f === 0 ? 'back' : 'swipe';
    lean = f === 0 ? -1 : 1;
  } else if (anim === 'cast') hands = 'raise';
  else if (anim === 'special') {
    hands = 'spread';
    spin = 1 + f;
  } else if (anim === 'hurt') {
    hands = 'back';
    lean = -1;
    hurt = true;
  }
  const sw = [0, 1, 0, -1][f % 4];
  // body: shoulders funnelling into a twisting column of sand
  const robe = new Buf(16, 24);
  robe.poly(
    [
      [5 + lean, 8 + by],
      [11 + lean, 8 + by],
      [12.6 + lean + spin * 0.5, 13 + by],
      [11.4 + spin * 0.5, 16.5 + by],
      [9.6 + sw, 19.5 + by],
      [8.6 + sw * 1.5, 22 + by - (by ? 1 : 0)],
      [7.2 + sw, 19.5 + by],
      [4.6 - spin * 0.5, 16.5 + by],
      [3.6 + lean - spin * 0.5, 13 + by],
    ],
    K,
  );
  shade(robe, SAND, { rim: 0.25 });
  // swirling streaks that crawl down the body each frame
  robe.each((c, x, y) => {
    if (y < 10 + by) return;
    const k = (((x - 2 * y + f * 3) % 7) + 7) % 7;
    if (k === 0) robe.set(x, y, c === SAND[0] ? PAL.darkBrown : SAND[0]);
    else if (k === 1 && c !== SAND[0]) robe.set(x, y, SAND[3]);
  });
  b.blit(robe);
  // hood with a trailing wisp
  const hood = shaded(
    16,
    24,
    SAND,
    (l) => {
      l.ellipse(8.6 + lean, 6.4 + by, 4.2, 4.2, K);
      tri(l, [5 + lean, 3.5 + by], [2.4 + lean + sw * 0.5, 7.5 + by], [5.5 + lean, 8 + by], K);
    },
    { rim: 0.28 },
  );
  b.blit(hood);
  const X = lean;
  const Y = by;
  b.rect(9 + X, 5 + Y, 3, 4, PAL.plum);
  b.set(12 + X, 6 + Y, PAL.plum)
    .set(12 + X, 7 + Y, PAL.plum)
    .set(9 + X, 8 + Y, INK)
    .set(10 + X, 8 + Y, INK);
  b.set(10 + X, 6 + Y, hurt ? WHITE : PAL.orange)
    .set(12 + X, 6 + Y, hurt ? WHITE : PAL.yellow)
    .set(11 + X, 6 + Y, INK);
  b.set(9 + X, 4 + Y, SAND[3])
    .set(10 + X, 4 + Y, SAND[3])
    .set(11 + X, 4 + Y, SAND[2]);
  // sand arms + claws on their own layer so they separate from the body
  const al = new Buf(16, 24);
  const armTo = (x0: number, y0: number, x1: number, y1: number): void => {
    al.line(x0, y0, x1, y1, SAND[2], 2);
    al.set(x1, y1, SAND[3])
      .set(x1 + 1, y1, WHITE)
      .set(x1 + 1, y1 + 1, SAND[3])
      .set(x1, y1 + 1, SAND[2]);
  };
  if (hands === 'rest') armTo(10 + X, 11 + Y, 12 + X, 13 + Y);
  else if (hands === 'back') armTo(7 + X, 11 + Y, 3 + X, 10 + Y);
  else if (hands === 'swipe') armTo(10 + X, 11 + Y, 13 + X, 9 + Y);
  else if (hands === 'raise') {
    armTo(7 + X, 10 + Y, 3 + X, 6 + Y);
    armTo(11 + X, 10 + Y, 13 + X, 6 + Y);
  } else {
    armTo(6, 11 + Y, 2, 11 + Y);
    armTo(11, 11 + Y, 13, 11 + Y);
  }
  b.overlay(al, SAND[0], 'all');
  b.outline((n) => mix(n, INK, 0.72));
  if (hands === 'swipe') b.set(15, 8, '#fff4dcb0').set(15, 10, '#fff4dcd0').set(14, 12, '#fff4dcb0');
  // grains orbiting the vortex
  const orbit = 5 + spin * 1.5;
  for (let k = 0; k < 3; k++) {
    const a = ((f % 4) / 4 + k / 3) * Math.PI * 2;
    const gx = Math.round(8 + Math.cos(a) * orbit);
    const gy = Math.round(18 + by + Math.sin(a) * 1.6);
    if (!b.has(gx, gy)) b.set(gx, gy, k === 0 ? SAND[3] : SAND[2]);
  }
  if (!b.has(f % 2 ? 2 : 13, 13 + by)) b.set(f % 2 ? 2 : 13, 13 + by, SAND[1]);
  if (hands === 'raise') {
    // a sandstorm ring whirling around the wraith
    const n = f === 0 ? 10 : 14;
    const r = f === 0 ? 6.6 : 7.4;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + f * 0.4;
      const x = Math.round(8 + Math.cos(a) * r);
      const y = Math.round(10 + Y + Math.sin(a) * r * 1.15);
      if (!b.has(x, y)) b.set(x, y, k % 3 === 0 ? WHITE : k % 3 === 1 ? SAND[2] : SAND[1]);
    }
  }
  if (spin) {
    for (const [x, y] of [
      [1, 6],
      [14, 4],
      [0, 15],
      [15, 17],
    ] as const)
      if (!b.has(x, y + f)) b.set(x, y + f, spin > 1 ? SAND[3] : SAND[2]);
  }
  return b;
}

// ------------------------------------------------------------ dune raider ---

const RAIDER_HEAD = [
  '......wWWw......',
  '....wWVWWWw.....',
  '...wWVWWwWWJw...',
  '...wWwwWWwwjw...',
  '...wWWWwSSSSS...',
  '...wWWwsSSSeES..',
  '....wwsSSSSSSSS.',
  '.....sRRRRRRRr..',
  '.....rRRRRRRr...',
  '......rRRRRr....',
];
const RAIDER_HEAD_PAL = {
  w: PAL.tan,
  W: '#fff4dc',
  V: PAL.white,
  J: PAL.red,
  j: PAL.darkRed,
  S: PAL.skinShade,
  s: PAL.brown,
  e: WHITE,
  E: INK,
  R: PAL.red,
  r: PAL.darkRed,
};

function duneRaider(anim: AnimName, f: number): Buf {
  const b = new Buf(16, 24);
  const TUNIC: Ramp = [PAL.navy, PAL.blue, '#2a6cb0'];
  const WRAP: Ramp = [PAL.tan, PAL.sand, '#fff4dc'];
  const SKIN: Col = PAL.skinShade;
  const SKIN_D: Col = PAL.brown;
  let bob = 0;
  let lifts: readonly [number, number] = [0, 0];
  let swing: 'rest' | 'raise' | 'slash' | 'hurt' = 'rest';
  let lean = 0;
  let flap = 0;
  if (anim === 'idle') {
    bob = f;
    flap = f;
  } else if (anim === 'move') {
    lifts = LIFTS[f];
    bob = f % 2 === 1 ? 0 : 1;
    flap = f % 2;
  } else if (anim === 'attack') {
    swing = f === 0 ? 'raise' : 'slash';
    lean = f === 0 ? -1 : 1;
    flap = 1;
  } else if (anim === 'hurt') {
    swing = 'hurt';
    lean = -1;
  }
  const X = lean;
  const Y = bob;
  // turban tail + scarf end streaming behind
  b.line(5 + X, 5 + Y, 3 + X - flap, 9 + Y, WRAP[0]).set(3 + X - flap, 10 + Y, WRAP[0]);
  b.line(6 + X, 10 + Y, 4 + X - flap, 12 + Y + flap, PAL.darkRed).set(3 + X - flap, 12 + Y + flap, PAL.red);
  // legs: baggy trousers bound at the ankle
  const leg = (x: number, lift: number, far: boolean): void => {
    const P = far ? PAL.plum : PAL.darkBrown;
    const P2 = far ? PAL.plum : PAL.brown;
    b.rect(x, 17, 2, 3 - lift, P2);
    b.set(x + 2, 18 - lift, P).set(x - 1, 18 - lift, far ? PAL.plum : P);
    b.set(x, 20 - lift, P).set(x + 1, 20 - lift, P);
    b.set(x, 21 - lift, WRAP[0]).set(x + 1, 21 - lift, far ? WRAP[0] : WRAP[1]);
    b.set(x, 22 - lift, PAL.plum)
      .set(x + 1, 22 - lift, PAL.plum)
      .set(x + 2, 22 - lift, far ? INK : PAL.darkBrown);
  };
  leg(6, lifts[0], true);
  leg(8, lifts[1], false);
  // far arm
  b.line(6 + X, 12 + Y, 5 + X, 15 + Y, SKIN_D).set(5 + X, 16 + Y, SKIN_D);
  // torso
  b.blit(shaded(16, 24, TUNIC, (l) => l.rect(5 + X, 11 + Y, 6, 6, K), { rim: 0.2 }));
  b.hline(5 + X, 10 + X, 15 + Y, PAL.orange).hline(5 + X, 10 + X, 16 + Y, PAL.rust);
  b.set(9 + X, 15 + Y, PAL.gold);
  // head: turban wound high, eyes in the slit, scarf over nose and mouth
  const face = swing === 'hurt' ? { ...RAIDER_HEAD_PAL, e: INK, E: SKIN_D } : RAIDER_HEAD_PAL;
  b.stamp(RAIDER_HEAD, face, X, 2 + Y);
  // scimitar: curved blade drawn on its own layer so it stays readable over the turban
  const scimitar = (back: readonly Pt[], front: readonly Pt[], guard: readonly [Pt, Pt]): void => {
    const l = new Buf(16, 24);
    for (let i = 0; i + 1 < back.length; i++)
      l.line(back[i][0], back[i][1], back[i + 1][0], back[i + 1][1], PAL.gray);
    for (let i = 0; i + 1 < front.length; i++)
      l.line(front[i][0], front[i][1], front[i + 1][0], front[i + 1][1], PAL.lightGray);
    const [tx, ty] = front[front.length - 1];
    l.set(tx, ty, WHITE);
    l.line(guard[0][0], guard[0][1], guard[1][0], guard[1][1], PAL.gold);
    b.overlay(l, INK, 'all');
  };
  if (swing === 'rest') {
    b.line(9 + X, 12 + Y, 11 + X, 16 + Y, SKIN);
    scimitar(
      [
        [13, 15 + Y],
        [14, 13 + Y],
      ],
      [
        [12, 15 + Y],
        [13, 13 + Y],
        [14, 11 + Y],
        [14, 9 + Y],
      ],
      [
        [10, 16 + Y],
        [13, 16 + Y],
      ],
    );
    b.set(11, 17 + Y, SKIN);
  } else if (swing === 'raise') {
    b.line(8 + X, 12, 6 + X, 10, SKIN);
    scimitar(
      [
        [3, 8],
        [2, 6],
      ],
      [
        [4, 8],
        [3, 6],
        [2, 4],
        [2, 2],
      ],
      [
        [4, 10],
        [6, 8],
      ],
    );
    b.set(6 + X, 10, SKIN);
  } else if (swing === 'slash') {
    b.line(9 + X, 12, 12, 14, SKIN);
    scimitar(
      [
        [14, 16],
        [15, 18],
      ],
      [
        [13, 15],
        [14, 17],
        [14, 19],
        [13, 21],
      ],
      [
        [12, 13],
        [14, 15],
      ],
    );
    b.set(13, 14, SKIN);
  } else {
    b.line(7 + X, 12, 5 + X, 14, SKIN);
    scimitar(
      [
        [3, 16],
        [2, 18],
      ],
      [
        [4, 15],
        [3, 17],
        [3, 19],
      ],
      [
        [3, 14],
        [5, 14],
      ],
    );
  }
  b.outline(INK);
  if (swing === 'slash') {
    for (const [x, y, a] of [
      [15, 8, 'a0'],
      [15, 10, 'c0'],
      [15, 12, 'c0'],
      [14, 6, '80'],
    ] as const)
      b.set(x, y, `#ffffff${a}`);
  }
  return b;
}

// ---------------------------------------------------------------- cactoid ---

const CACTUS: Ramp = [PAL.forest, PAL.darkGreen, PAL.green, '#b4ec8a'];

function cactoid(anim: AnimName, f: number): Buf {
  const b = new Buf(16, 24);
  let bob = 0;
  let tilt = 0;
  let lifts: readonly [number, number] = [0, 0];
  let armL = 0; // arm tip raise
  let armR = 0;
  let puff = 0;
  let spines = 1;
  let volley: 'none' | 'aim' | 'fire' | 'ring' = 'none';
  let eyes: 'mean' | 'shut' = 'mean';
  if (anim === 'idle') {
    bob = f;
    armL = f;
    armR = 1 - f;
  } else if (anim === 'move') {
    lifts = LIFTS[f];
    bob = f % 2 === 1 ? 0 : 1;
    tilt = [0, 1, 0, -1][f];
    armL = f % 2;
    armR = 1 - (f % 2);
  } else if (anim === 'attack') {
    if (f === 0) {
      tilt = -1;
      bob = 1;
      armL = 2;
      armR = 2;
      spines = 2;
      volley = 'aim';
    } else {
      tilt = 1;
      armR = 0;
      volley = 'fire';
    }
  } else if (anim === 'cast') {
    puff = 1;
    spines = 2;
    armL = 2;
    armR = 2;
    if (f === 1) volley = 'ring';
    else bob = 1;
  } else if (anim === 'hurt') {
    bob = 1;
    tilt = -1;
    eyes = 'shut';
    spines = 0;
  }
  const T = tilt;
  const Y = bob;
  // root feet
  const root = (x: number, lift: number, dir: number): void => {
    b.set(x, 21 - lift, PAL.darkBrown)
      .set(x + 1, 21 - lift, PAL.brown)
      .set(x, 22 - lift, PAL.darkBrown)
      .set(x + dir, 22 - lift, PAL.plum);
  };
  root(5, lifts[0], -1);
  root(9, lifts[1], 1);
  // far arm (screen left)
  // arms: a stub out of the trunk, then an upright column with a rounded tip
  const arm = (x0: number, y0: number, up: number, dir: number, far: boolean): void => {
    const l = new Buf(16, 24);
    const x1 = dir > 0 ? Math.min(14, x0 + 3) : Math.max(1, x0 - 3);
    l.rect(Math.min(x0, x1), y0, Math.abs(x1 - x0) + 1, 2, K);
    const ux = dir > 0 ? x1 - 1 : x1;
    l.rect(ux, y0 - 4 - up, 2, 5 + up, K);
    l.ellipse(ux + 1, y0 - 4 - up + 0.4, 1, 1, K);
    shade(l, far ? [PAL.forest, PAL.darkGreen, PAL.green] : CACTUS, { rim: 0.3 });
    b.overlay(l, PAL.forest, 'all');
  };
  arm(4 + T - puff, 15 + Y, armL, -1, true);
  // trunk
  const tr = shaded(
    16,
    24,
    CACTUS,
    (l) => {
      l.ellipse(8 + T, 8.5 + Y, 3.2 + puff, 3, K);
      l.rect(5 + T - puff, 8 + Y, 6 + puff * 2, 13 - Y, K);
    },
    { rim: 0.3 },
  );
  b.overlay(tr, PAL.forest, 'all');
  // ribs
  for (const rx of [6, 9]) {
    for (let y = 8; y <= 20; y++) {
      const x = rx + T + (rx < 8 ? -puff : puff);
      if (y >= 10 + Y && y <= 14 + Y && rx === 9) continue;
      if (b.get(x, y + (y > 18 ? 0 : 0)) === CACTUS[2] || b.get(x, y) === CACTUS[3]) b.set(x, y, CACTUS[1]);
    }
  }
  arm(11 + T + puff, 12 + Y, armR, 1, false);
  // blossom
  b.set(7 + T, 4 + Y, PAL.hotPink)
    .set(8 + T, 4 + Y, PAL.pink)
    .set(9 + T, 4 + Y, PAL.hotPink)
    .set(8 + T, 3 + Y, PAL.pink)
    .set(8 + T, 5 + Y, PAL.yellow);
  // face
  const ex = 8 + T;
  const ey = 10 + Y;
  if (eyes === 'shut') {
    b.set(ex, ey, INK)
      .set(ex + 1, ey + 1, INK)
      .set(ex + 2, ey, INK);
  } else {
    b.set(ex, ey - 1, INK).set(ex + 1, ey, INK);
    b.set(ex + 3, ey - 1, INK).set(ex + 2, ey, INK);
    b.set(ex, ey, INK).set(ex, ey + 1, PAL.yellow);
    b.set(ex + 3, ey, INK).set(ex + 3, ey + 1, PAL.yellow);
  }
  if (volley === 'fire' || volley === 'ring')
    b.rect(ex + 1, ey + 3, 2, 2, INK).set(ex + 1, ey + 4, PAL.darkRed);
  else b.hline(ex + 1, ex + 2, ey + 3, INK);
  b.outline(INK);
  // spines poking out of the silhouette
  const sp = (x: number, y: number, dx: number, dy: number): void => {
    for (let i = 1; i <= spines; i++) {
      const px = x + dx * i;
      const py = y + dy * i;
      if (!b.has(px, py) || b.get(px, py) === INK) b.set(px, py, i === spines ? WHITE : PAL.sand);
    }
  };
  if (spines > 0) {
    for (let y = 9; y <= 19; y += 3) {
      sp(4 + T - puff, y + Y, -1, 0);
      sp(11 + T + puff, y + 1 + Y, 1, 0);
    }
    sp(6 + T, 5 + Y, -1, -1);
    sp(10 + T, 5 + Y, 1, -1);
  }
  if (volley === 'aim') b.set(14, 9, PAL.sand).set(15, 8, WHITE);
  if (volley === 'fire') {
    b.hline(13, 15, 10, PAL.sand).set(15, 10, WHITE);
    b.hline(12, 14, 14, PAL.sand).set(14, 14, WHITE);
  }
  if (volley === 'ring') {
    for (const [x, y, dx, dy] of [
      [1, 4, 1, 1],
      [14, 4, -1, 1],
      [0, 12, 1, 0],
      [15, 12, -1, 0],
      [1, 19, 1, -1],
      [14, 19, -1, -1],
      [8, 0, 0, 1],
    ] as const) {
      b.set(x, y, WHITE);
      if (!b.has(x + dx, y + dy)) b.set(x + dx, y + dy, PAL.sand);
    }
  }
  return b;
}

// ---------------------------------------------------------------- drowned ---

const DROWNED_SKIN: Ramp = ['#35605a', '#6fa192', '#b0d4bf'];

function drowned(anim: AnimName, f: number): Buf {
  const b = new Buf(16, 24);
  const S = DROWNED_SKIN;
  let bob = 0;
  let lifts: readonly [number, number] = [0, 0];
  let lean = 1;
  // hands: far, near (absolute)
  let hands: [Pt, Pt] = [
    [14, 11],
    [14, 13],
  ];
  let jaw = 0;
  let hurt = false;
  if (anim === 'idle') {
    bob = f;
    hands = [
      [14, 11 + f],
      [14, 14],
    ];
  } else if (anim === 'move') {
    lifts = LIFTS[f];
    bob = f % 2 === 1 ? 0 : 1;
    lean = f % 2 === 1 ? 2 : 1;
    hands = [
      [14, 11 + bob + (f === 1 ? 1 : 0)],
      [14, 13 + bob - (f === 3 ? 1 : 0)],
    ];
  } else if (anim === 'attack') {
    jaw = 1;
    if (f === 0) {
      lean = 0;
      hands = [
        [9, 4],
        [11, 5],
      ];
    } else {
      lean = 2;
      bob = 1;
      hands = [
        [14, 15],
        [14, 18],
      ];
    }
  } else if (anim === 'hurt') {
    lean = -1;
    hurt = true;
    jaw = 1;
    hands = [
      [3, 10],
      [4, 13],
    ];
  }
  const X = lean;
  const Y = bob;
  // legs: torn trousers, bare feet
  const leg = (x: number, lift: number, far: boolean): void => {
    const P = far ? PAL.navy : PAL.darkSlate;
    b.rect(x, 17, 2, 3 - lift, P);
    b.set(x + 1, 19 - lift, far ? PAL.navy : PAL.slate);
    b.set(x, 20 - lift, far ? S[0] : S[1]).set(x, 21 - lift, far ? S[0] : S[1]);
    b.set(x + 1, 20 - lift, S[0]).set(x + 1, 21 - lift, S[0]);
    b.set(x, 22 - lift, far ? S[0] : S[1])
      .set(x + 1, 22 - lift, S[0])
      .set(x + 2, 22 - lift, far ? INK : S[0]);
  };
  leg(6, lifts[0], true);
  leg(8, lifts[1], false);
  const armTo = (sh: Pt, h: Pt, far: boolean): void => {
    const l = new Buf(16, 24);
    limb(l, sh, h, 2, 2, K);
    shade(l, far ? [S[0], S[1]] : S, { rim: 0.3 });
    l.set(h[0], h[1], far ? S[1] : S[2]);
    b.overlay(l, INK, 'all');
  };
  // torso: torn striped sailor shirt
  const shirt = new Buf(16, 24);
  shirt.rect(4 + X, 11 + Y, 6, 6, K);
  shirt.set(4 + X, 16 + Y, null).set(7 + X, 16 + Y, null);
  shade(shirt, [PAL.slate, PAL.gray, PAL.lightGray], { rim: 0.2 });
  shirt.each((_c, x, y) => {
    if ((y - Y) % 2 === 0) shirt.set(x, y, x >= 9 + X ? PAL.navy : PAL.blue);
  });
  b.blit(shirt);
  b.set(5 + X, 16 + Y, S[1]).set(8 + X, 15 + Y, S[1]);
  if (!hurt) armTo([7 + X, 12 + Y], hands[0], true);
  // head: hunched forward, seaweed hair plastered down the back
  const hx = X;
  const hy = Y;
  b.overlay(
    shaded(16, 24, S, (l) => l.ellipse(9.8 + hx, 7.2 + hy, 3.2, 3, K), { rim: 0.3 }),
    INK,
    'all',
  );
  b.hline(8 + hx, 11 + hx, 4 + hy, PAL.darkGreen)
    .hline(7 + hx, 9 + hx, 5 + hy, PAL.forest)
    .set(10 + hx, 5 + hy, PAL.darkGreen)
    .set(11 + hx, 5 + hy, PAL.green);
  for (const [x, len] of [
    [7, 5],
    [8, 3],
  ] as const) {
    for (let i = 0; i < len; i++)
      b.set(x + hx - (i > 3 ? 1 : 0), 6 + hy + i, i % 2 ? PAL.forest : PAL.darkGreen);
  }
  // sunken socket + glowing eye, gaping jaw
  b.set(10 + hx, 6 + hy, S[0]).set(11 + hx, 6 + hy, S[0]);
  b.set(11 + hx, 7 + hy, hurt ? WHITE : PAL.cyan).set(10 + hx, 7 + hy, INK);
  b.set(13 + hx, 8 + hy, S[1]);
  b.hline(10 + hx, 12 + hx, 9 + hy, INK);
  if (jaw)
    b.hline(10 + hx, 12 + hx, 10 + hy, INK)
      .set(11 + hx, 10 + hy, PAL.darkRed)
      .set(12 + hx, 9 + hy, WHITE);
  else b.set(11 + hx, 9 + hy, S[2]);
  // barnacles on the shoulder + cheek
  b.set(5 + X, 11 + Y, PAL.lightGray)
    .set(6 + X, 11 + Y, WHITE)
    .set(5 + X, 12 + Y, PAL.gray);
  b.set(8 + hx, 8 + hy, PAL.lightGray);
  if (hurt) armTo([7 + X, 12 + Y], hands[0], true);
  armTo([8 + X, 13 + Y], hands[1], false);
  // kelp strand hanging off the near arm
  const kx = Math.round((8 + X + hands[1][0]) / 2);
  const ky = Math.round((13 + Y + hands[1][1]) / 2) + 1;
  b.set(kx, ky, PAL.darkGreen).set(kx, ky + 1, PAL.forest);
  b.outline(INK);
  // dripping water
  const drip = f % 2;
  if (anim !== 'attack') {
    b.set(hands[1][0], hands[1][1] + 2 + drip, '#2ce8f5c0');
    b.set(6 + X, 23 - drip, '#2ce8f590');
  }
  if (anim === 'attack' && f === 1)
    b.set(15, 11, '#ffffffa0').set(15, 13, '#ffffffc0').set(15, 15, '#ffffffa0');
  return b;
}

// -------------------------------------------------------------- reef crab ---

const CRAB: Ramp = [PAL.plum, PAL.darkRed, PAL.red, PAL.pink];
const CRAB_FAR: Ramp = ['#2a1a22', PAL.plum, PAL.darkRed];

function reefCrab(anim: AnimName, f: number): Buf {
  const W = 24;
  const b = new Buf(W, 24);
  let bx = 0;
  let by = 0;
  let legPh = 0;
  // near claw: 'up' raised V, 'open' raised + gaping, 'snap' thrust forward, 'ram' both forward
  let claw: 'up' | 'open' | 'snap' | 'ram' = 'up';
  let clawY = 0;
  let stalks = 3;
  let speed = false;
  let hurt = false;
  if (anim === 'idle') {
    by = f;
    clawY = f;
    stalks = 3 - f;
  } else if (anim === 'move') {
    legPh = f;
    by = f % 2 ? 0 : 1;
    clawY = f % 2;
  } else if (anim === 'attack') {
    if (f === 0) {
      claw = 'open';
      bx = -1;
      clawY = -2;
    } else {
      claw = 'snap';
      bx = 1;
      by = 1;
    }
  } else if (anim === 'special') {
    claw = 'ram';
    by = 2;
    bx = f;
    stalks = 1;
    legPh = f * 2 + 1;
    speed = f === 1;
  } else if (anim === 'hurt') {
    bx = -1;
    stalks = 1;
    claw = 'open';
    clawY = 1;
    hurt = true;
  }
  const legs = (far: boolean): void => {
    for (let i = 0; i < 4; i++) {
      const dir = i < 2 ? -1 : 1;
      const ax = 5.5 + i * 3 + bx + (far ? 1 : 0);
      const ay = 18.5 + by - (far ? 1 : 0);
      const ph = (i + legPh + (far ? 1 : 0)) % 2;
      const kx = ax + dir * 2;
      const ky = ay - 2 + ph;
      const fx = ax + dir * (3 + (i === 0 || i === 3 ? 1 : 0)) + (ph ? dir : 0);
      const fy = 22 - ph;
      const R = far ? CRAB_FAR : CRAB;
      b.line(ax, ay, kx, ky, R[1]).line(ax, ay + 1, kx, ky + 1, R[1]);
      b.line(kx, ky, fx, fy, R[2]);
      b.set(Math.round(fx), Math.round(fy), R[0]);
    }
  };
  const pincer = (cx: number, cy: number, mode: typeof claw, far: boolean, big: number): void => {
    const R = far ? CRAB_FAR : CRAB;
    const l = new Buf(W, 24);
    if (mode === 'snap' || mode === 'ram') {
      l.ellipse(cx, cy, 2.4 * big, 2.1 * big, K);
      l.poly(
        [
          [cx + 1, cy - 2],
          [cx + 4.4, cy - 1.4],
          [cx + 4, cy - 0.2],
          [cx + 1, cy],
        ],
        K,
      );
      l.poly(
        [
          [cx + 1, cy + 0.8],
          [cx + 3.8, cy + 0.8],
          [cx + 3.4, cy + 2],
          [cx + 1, cy + 2],
        ],
        K,
      );
    } else {
      const op = mode === 'open' ? 1.6 : 0;
      l.ellipse(cx, cy, 2.4 * big, 2.3 * big, K);
      l.poly(
        [
          [cx + 0.2, cy - 1.6],
          [cx + 2.2, cy - 5.4],
          [cx + 3.1, cy - 4.4],
          [cx + 2.4, cy - 1],
        ],
        K,
      );
      l.poly(
        [
          [cx - 2, cy - 1.2],
          [cx - 1.2 - op, cy - 4.6],
          [cx - 0.3 - op, cy - 4.8],
          [cx - 0.2, cy - 1.8],
        ],
        K,
      );
    }
    shade(l, R, { rim: 0.35, bias: far ? 0 : 0.25 });
    // dark claw tips
    l.each((_c, x, y) => {
      const tip = mode === 'snap' || mode === 'ram' ? x >= cx + 3.4 : y <= cy - 4;
      if (tip) l.set(x, y, far ? INK : PAL.plum);
    });
    b.overlay(l, INK, 'all');
  };
  legs(true);
  // far claw
  b.line(15 + bx, 16 + by, 16 + bx, 14 + by + clawY, CRAB_FAR[1]);
  if (claw === 'ram') pincer(18 + bx, 14 + by, 'ram', true, 0.85);
  else pincer(16.6 + bx, 11.6 + by + clawY, claw === 'snap' ? 'up' : claw, true, 0.85);
  // eye stalks (far one first)
  const eye = (x: number, h: number): void => {
    b.vline(x + bx, 12 + by - h, 12 + by, PAL.darkRed);
    b.set(x + bx, 11 + by - h, INK)
      .set(x + bx + 1, 11 + by - h, INK)
      .set(x + bx + 1, 10 + by - h, hurt ? INK : WHITE);
  };
  eye(13, stalks);
  // domed shell with a flatter belly
  const shell = shaded(
    W,
    24,
    CRAB,
    (l) => {
      l.ellipse(10.5 + bx, 15.2 + by, 7.3, 4.8, K);
      l.ellipse(10.5 + bx, 18 + by, 6.4, 2.2, K);
    },
    { rim: 0.3, cy: 14 + by },
  );
  b.overlay(shell, INK, 'all');
  // pale underside + rim notches
  for (let x = 5; x <= 16; x++) {
    let y = 23;
    while (y > 0 && !b.has(x + bx, y)) y--;
    b.tint(x + bx, y, PAL.tan);
    if (x % 2 === 0) b.tint(x + bx, y - 1, PAL.sand);
  }
  for (let x = 4; x <= 17; x += 2) b.tint(x + bx, 16 + by, CRAB[1]);
  b.set(17 + bx, 13 + by, CRAB[3]).set(16 + bx, 11 + by, CRAB[3]);
  // coral + barnacles on the carapace
  const top = (x: number): number => {
    let y = 0;
    while (y < 24 && !b.has(x + bx, y)) y++;
    return y;
  };
  const t1 = top(7);
  b.set(7 + bx, t1 - 1, PAL.cyan)
    .set(6 + bx, t1 - 2, PAL.cyan)
    .set(8 + bx, t1 - 2, '#c9fbff')
    .set(7 + bx, t1 - 2, PAL.sky)
    .set(6 + bx, t1 - 3, '#c9fbff');
  const t2 = top(10);
  b.set(10 + bx, t2 - 1, PAL.hotPink)
    .set(10 + bx, t2 - 2, PAL.pink)
    .set(11 + bx, t2 - 3, PAL.pink)
    .set(9 + bx, t2 - 3, PAL.hotPink)
    .set(11 + bx, t2 - 2, PAL.hotPink);
  for (const [x, dy] of [
    [4, 1],
    [12, 1],
    [14, 2],
  ] as const) {
    const t = top(x);
    b.set(x + bx, t + dy, PAL.lightGray).set(x + bx + 1, t + dy, WHITE);
  }
  eye(15, stalks);
  // mouth parts
  b.set(17 + bx, 15 + by, PAL.tan).set(17 + bx, 16 + by, PAL.sand);
  legs(false);
  // near claw + arm
  b.line(15 + bx, 18 + by, 18 + bx, 16 + by + clawY, CRAB[1]).line(
    15 + bx,
    19 + by,
    18 + bx,
    17 + by + clawY,
    CRAB[0],
  );
  if (claw === 'ram') pincer(18.4 + bx, 17 + by, 'ram', false, 1);
  else if (claw === 'snap') pincer(18.4 + bx, 15 + by, 'snap', false, 1);
  else pincer(19.4 + bx, 14 + by + clawY, claw, false, 1);
  b.outline(INK);
  if (claw === 'snap') b.set(23, 12, '#ffffffc0').set(23, 17, '#ffffffa0').set(22, 11, '#ffffff80');
  if (speed) {
    for (const [x, y] of [
      [0, 12],
      [1, 16],
      [0, 20],
    ] as const)
      b.hline(x, x + 2, y, '#ffffff90');
  }
  return b;
}

// ------------------------------------------------------------- naga adept ---

const NAGA: Ramp = ['#193c3e', '#1c5566', '#1f9192', '#48c7b0'];
const CORAL: Ramp = [PAL.darkRed, PAL.hotPink, PAL.pink];

function nagaAdept(anim: AnimName, f: number): Buf {
  const W = 24;
  const b = new Buf(W, 24);
  const by = anim === 'idle' || anim === 'cast' ? [0, -1, -1, 0][f % 4] : 0;
  let lean = 0;
  let wave = [0, 1, 0, -1][f % 4];
  // staff: top point, plus whether it's raised overhead
  let staff: 'rest' | 'back' | 'thrust' | 'raise' = 'rest';
  let glow = 0;
  let hurt = false;
  if (anim === 'move') {
    lean = 1;
    wave = [1, 0, -1, 0][f];
  } else if (anim === 'attack') {
    staff = f === 0 ? 'back' : 'thrust';
    lean = f === 0 ? -1 : 1;
  } else if (anim === 'cast') {
    staff = 'raise';
    glow = 1 + f;
  } else if (anim === 'hurt') {
    lean = -1;
    hurt = true;
  }
  const X = lean;
  const Y = by;
  // serpent tail: hips → ground → curling tip
  const spine: Pt[] = [
    [13 + X, 15 + Y],
    [13.4, 18.6],
    [11.4, 21],
    [8, 21.4 + wave * 0.3],
    [5, 20.8 - wave * 0.4],
    [3, 19.4 - wave * 0.6],
    [2.6 + wave * 0.5, 17],
  ];
  const tl = new Buf(W, 24);
  for (let i = 0; i + 1 < spine.length; i++) {
    const t0 = 4.6 - i * 0.55;
    limb(tl, spine[i], spine[i + 1], t0, t0 - 0.55, K);
  }
  shade(tl, NAGA, { rim: 0.3, cy: 17, ry: 5 });
  // belly scales on the underside, dark scale flecks on top
  const tb = tl.clone();
  tb.each((_c, x, y) => {
    if (!tb.has(x, y + 1)) tl.set(x, y, (x + y) % 2 ? PAL.sand : PAL.tan);
    else if (!tb.has(x, y - 1) && x % 3 === 0) tl.set(x, y, NAGA[3]);
    else if ((x * 3 + y * 5) % 11 === 0) tl.set(x, y, NAGA[1]);
  });
  b.blit(tl);
  // cobra hood behind the head
  b.overlay(
    shaded(W, 24, [NAGA[0], NAGA[1], NAGA[2]], (l) => l.ellipse(12.6 + X, 7.4 + Y, 3.4, 4.4, K), {
      rim: 0.3,
    }),
    INK,
    'all',
  );
  b.set(11 + X, 6 + Y, PAL.gold)
    .set(11 + X, 9 + Y, PAL.gold)
    .set(10 + X, 8 + Y, NAGA[3]);
  // far arm
  const farHand: Pt = staff === 'raise' ? [12 + X, 5 + Y] : [11 + X, 14 + Y];
  b.line(12 + X, 11 + Y, farHand[0], farHand[1], NAGA[1]);
  b.set(farHand[0], farHand[1], NAGA[2]);
  // torso
  b.overlay(
    shaded(
      W,
      24,
      NAGA,
      (l) => {
        l.ellipse(14 + X, 12.4 + Y, 2.6, 3.4, K);
        l.rect(12 + X, 13 + Y, 4, 3, K);
      },
      { rim: 0.3 },
    ),
    NAGA[0],
    'back',
  );
  // belly plates + gold collar
  for (let y = 12; y <= 15; y++) b.tint(15 + X, y + Y, y % 2 ? PAL.sand : PAL.tan);
  b.hline(13 + X, 16 + X, 10 + Y, PAL.gold).set(15 + X, 11 + Y, PAL.orange);
  b.hline(12 + X, 16 + X, 16 + Y, PAL.gold);
  // head
  b.overlay(
    shaded(W, 24, NAGA, (l) => l.ellipse(14.6 + X, 6.6 + Y, 2.5, 2.6, K), { rim: 0.35 }),
    NAGA[0],
    'back',
  );
  b.set(16 + X, 6 + Y, hurt ? WHITE : PAL.yellow).set(15 + X, 6 + Y, INK);
  b.set(16 + X, 5 + Y, NAGA[0]);
  b.set(17 + X, 8 + Y, NAGA[0]);
  b.set(14 + X, 4 + Y, PAL.gold).set(15 + X, 4 + Y, PAL.red);
  // coral staff (near hand)
  let s0: Pt;
  let s1: Pt;
  let hand: Pt;
  if (staff === 'rest') {
    s0 = [19 + X, 21];
    s1 = [19 + X, 4 + Y];
    hand = [18 + X, 13 + Y];
  } else if (staff === 'back') {
    s0 = [17, 20];
    s1 = [13, 3];
    hand = [15, 11];
  } else if (staff === 'thrust') {
    s0 = [14, 17];
    s1 = [21, 6];
    hand = [17, 12];
  } else {
    s0 = [18 + X, 17];
    s1 = [18 + X, 1];
    hand = [17 + X, 8 + Y];
  }
  b.line(15 + X, 11 + Y, hand[0], hand[1], NAGA[2]);
  const sl = new Buf(W, 24);
  sl.line(s0[0], s0[1], s1[0], s1[1], K, 1);
  shade(sl, CORAL, { rim: 0.3 });
  b.blit(sl);
  // branching coral head
  const [tx, ty] = s1;
  b.set(tx - 1, ty + 1, PAL.hotPink)
    .set(tx - 2, ty, PAL.pink)
    .set(tx + 1, ty + 2, PAL.hotPink)
    .set(tx + 2, ty + 1, PAL.pink);
  b.set(hand[0], hand[1], NAGA[3]).set(hand[0] + 1, hand[1], NAGA[2]);
  b.outline(INK);
  // pearl
  const pr = glow ? 1.2 + glow * 0.5 : 1;
  if (glow) b.blit(new Buf(W, 24).ellipse(tx + 0.5, ty - 0.5, pr + 1.4, pr + 1.4, '#2ce8f555'));
  b.blit(
    shaded(W, 24, [PAL.sky, PAL.cyan, '#c9fbff', WHITE], (l) => l.ellipse(tx + 0.5, ty - 0.5, pr, pr, K), {
      rim: 0.2,
    }),
  );
  if (glow === 2) {
    for (const [x, y] of [
      [tx - 4, ty + 2],
      [tx + 4, ty - 1],
      [tx - 2, ty - 3],
      [tx + 3, ty + 4],
    ] as const)
      b.set(x, y, PAL.cyan);
  }
  if (staff === 'thrust') b.set(23, 5, '#2ce8f5c0').set(22, 3, '#c9fbffa0');
  return b;
}

// ------------------------------------------------------------------- defs ---

const WIDE = { w: 24, h: 16, anchorX: 12, anchorY: 15 } as const;
const TALL = { w: 16, h: 24, anchorX: 8, anchorY: 23 } as const;
const BIG = { w: 24, h: 24, anchorX: 12, anchorY: 23 } as const;

export const CREATURE_C_DEFS: Partial<Record<CreatureId, SpriteDef>> = {
  scorpion: sideDef(
    { ...WIDE, anims: anims({ idle: [2, 3], move: [4, 12], attack: [2, 6], hurt: [1, 1] }) },
    scorpion,
  ),
  sand_wraith: sideDef(
    {
      ...TALL,
      anims: anims({
        idle: [4, 6],
        move: [4, 8],
        attack: [2, 5],
        cast: [2, 4],
        special: [2, 8],
        hurt: [1, 1],
      }),
    },
    sandWraith,
  ),
  dune_raider: sideDef(
    { ...TALL, anims: anims({ idle: [2, 2], move: [4, 8], attack: [2, 6], hurt: [1, 1] }) },
    duneRaider,
  ),
  cactoid: sideDef(
    { ...TALL, anims: anims({ idle: [2, 2], move: [4, 6], attack: [2, 5], cast: [2, 4], hurt: [1, 1] }) },
    cactoid,
  ),
  drowned: sideDef(
    { ...TALL, anims: anims({ idle: [2, 2], move: [4, 5], attack: [2, 4], hurt: [1, 1] }) },
    drowned,
  ),
  reef_crab: sideDef(
    { ...BIG, anims: anims({ idle: [2, 2], move: [4, 8], attack: [2, 4], special: [2, 10], hurt: [1, 1] }) },
    reefCrab,
  ),
  naga_adept: sideDef(
    { ...BIG, anims: anims({ idle: [4, 4], move: [4, 6], attack: [2, 4], cast: [2, 3], hurt: [1, 1] }) },
    nagaAdept,
  ),
};
