/**
 * Creatures, part A: slimes, wolves, mushroom, goblin archer, bat, skeleton,
 * sapling. All side-view sprites are authored facing RIGHT.
 */
import { PAL } from '../../palette';
import type { AnimName, CreatureId } from '../types';
import { Buf, INK, mix, shade, type Col, type Ramp } from './buf';
import { anims, type SpriteDef } from './defs';
import { limb, R, tri, vol } from './shapes';

// ----------------------------------------------------------------- slimes ---

interface SlimeKind {
  ramp: Ramp;
  eye: Col;
  extra?: 'crystal' | 'magma';
}

const SLIMES: Record<'slime' | 'slime_crystal' | 'slime_magma', SlimeKind> = {
  slime: { ramp: [PAL.forest, PAL.darkGreen, PAL.green, '#b4ec8a'], eye: INK },
  slime_crystal: { ramp: ['#3b3f8f', '#3f7fd0', PAL.cyan, '#d6fdff'], eye: PAL.navy, extra: 'crystal' },
  slime_magma: { ramp: [PAL.darkRed, PAL.rust, PAL.orange, PAL.gold], eye: INK, extra: 'magma' },
};

function slime(k: SlimeKind, anim: AnimName, f: number): Buf {
  let rx = 6;
  let ry = 5.4;
  let lift = 0;
  let dx = 0;
  let mood: 'calm' | 'angry' | 'lunge' | 'hop' = 'calm';
  if (anim === 'idle') {
    if (f === 1) {
      rx = 6.5;
      ry = 5;
    }
  } else if (anim === 'move') {
    const t: [number, number, number][] = [
      [6.9, 4.4, 0],
      [5, 6.6, 1],
      [5.4, 5.4, 3],
      [6.6, 4.8, 0],
    ];
    [rx, ry, lift] = t[f];
    if (f === 1 || f === 2) mood = 'hop';
  } else if (anim === 'attack') {
    if (f === 0) {
      rx = 7;
      ry = 4;
      dx = 0;
      mood = 'angry';
    } else {
      rx = 5.8;
      ry = 5.8;
      dx = 1;
      lift = 2;
      mood = 'lunge';
    }
  }
  const b = new Buf(16, 16);
  const bottom = 14 - lift;
  const cx = 8 + dx;
  const cy = bottom + 1 - ry;
  const top = cy - ry;
  const body = new Buf(16, 16);
  body.ellipse(cx, cy, rx, ry, '#000000');
  body.ellipse(cx, bottom + 1 - ry * 0.42, Math.min(rx + 0.4, 7), ry * 0.42, '#000000');
  shade(body, k.ramp, { rim: 0.32, cy: cy + ry * 0.15, ry: ry * 1.1 });
  b.blit(body);
  for (let x = 0; x < 16; x++)
    if (b.has(x, bottom) && b.has(x - 1, bottom) && b.has(x + 1, bottom)) b.set(x, bottom, k.ramp[0]);

  if (k.extra === 'magma') {
    // molten core + crust
    const core = new Buf(16, 16).ellipse(cx + 0.5, cy + ry * 0.35, rx * 0.42, ry * 0.3, '#000000');
    shade(core, [PAL.orange, PAL.gold, PAL.yellow, '#fff6c8'], { lx: 0, ly: -1, rim: 0 });
    b.blitClip(core);
    const crust = [
      [-4, 1],
      [-3, 0],
      [-2, 0],
      [1, 0],
      [2, 1],
      [4, 2],
    ];
    for (const [ox, oy] of crust) {
      const x = Math.round(cx + ox);
      let y = 0;
      while (y < 16 && !b.has(x, y)) y++;
      b.tint(x, y + oy, PAL.plum);
      if (oy === 0) b.tint(x, y + 1, PAL.darkRed);
    }
  }

  // specular highlight
  const hx = Math.round(cx - rx * 0.52);
  const hy = Math.round(top + ry * 0.55);
  b.tint(hx, hy, '#ffffff')
    .tint(hx + 1, hy - 1, '#ffffff')
    .tint(hx, hy + 1, k.ramp[3]);

  // face (looking right)
  const ey = Math.round(cy - ry * 0.05);
  const e1 = Math.round(cx + rx * 0.08);
  const e2 = Math.round(cx + rx * 0.55);
  if (mood === 'angry') {
    b.set(e1 - 1, ey - 1, k.eye)
      .set(e1, ey, k.eye)
      .set(e1, ey + 1, k.eye);
    b.set(e2 + 1, ey - 1, k.eye)
      .set(e2, ey, k.eye)
      .set(e2, ey + 1, k.eye);
    b.set(e1 + 1, ey + 2, k.eye).set(e2 - 1, ey + 2, k.eye);
  } else {
    b.set(e1, ey, k.eye)
      .set(e1, ey + 1, k.eye)
      .set(e2, ey, k.eye)
      .set(e2, ey + 1, k.eye);
    if (mood === 'lunge') {
      const mx = Math.round((e1 + e2) / 2);
      b.set(mx, ey + 2, k.eye)
        .set(mx + 1, ey + 2, k.eye)
        .set(mx, ey + 3, PAL.darkRed)
        .set(mx + 1, ey + 3, k.eye);
    } else if (mood !== 'hop') {
      b.set(Math.round((e1 + e2) / 2), ey + 2, mix(k.ramp[0], INK, 0.3));
    }
  }

  if (k.extra === 'crystal') {
    const shard = (x0: number, x1: number, ax: number, ay: number): void => {
      const l = new Buf(16, 16);
      tri(l, [x0, top + 2], [ax, Math.max(1.6, ay)], [x1, top + 2], '#000000');
      shade(l, [PAL.purple, PAL.magenta, '#f0b8ff'], { rim: 0.4 });
      b.overlay(l, INK, 'back');
    };
    shard(cx - 3.5, cx - 0.8, cx - 3.2, top - 2.2);
    shard(cx - 0.5, cx + 2.2, cx + 1.2, top - 3);
    shard(cx + 2.4, cx + 4.2, cx + 4.2, top - 0.8);
  }
  b.outline(INK);
  if (k.extra === 'magma' && anim === 'idle') {
    // rising ember
    b.set(cx + (f ? 3 : -2), Math.max(0, top - 2 - f), PAL.gold);
  }
  return b;
}

// ------------------------------------------------------------------ wolves ---

interface WolfPal {
  d: Col;
  m: Col;
  l: Col;
  w: Col;
  e: Col;
  n: Col;
  i: Col;
  x?: Col; // ice spikes
}

const WOLVES: Record<'wolf' | 'wolf_ice', WolfPal> = {
  wolf: { d: '#4e4049', m: '#7c6a6a', l: '#a9968c', w: '#d9c6ad', e: PAL.gold, n: INK, i: '#c9868a' },
  wolf_ice: {
    d: PAL.slate,
    m: PAL.lightGray,
    l: PAL.white,
    w: '#ffffff',
    e: PAL.cyan,
    n: PAL.navy,
    i: '#9fc0e8',
    x: PAL.cyan,
  },
};

function wolf(P: WolfPal, anim: AnimName, f: number): Buf {
  const b = new Buf(24, 16);
  let bx = 0;
  let by = 0;
  let hx = 0;
  let hy = 0;
  let tail = 0; // -1 low, 0 mid, 1 high
  // paw x offsets: back-far, back-near, front-far, front-near ; lifts
  let paws = [0, 0, 0, 0];
  let lifts = [0, 0, 0, 0];
  let mouth: 'closed' | 'snarl' | 'open' = 'closed';
  let hackles = false;
  if (anim === 'idle') {
    hy = f;
    tail = f ? 0 : 1;
  } else if (anim === 'move') {
    const P4 = [
      [-3, -2, 3, 2],
      [1, 2, -1, 0],
      [-1, 0, 1, 2],
      [2, 3, -2, -1],
    ];
    const L4 = [
      [0, 1, 0, 1],
      [1, 0, 1, 0],
      [0, 0, 1, 0],
      [1, 0, 0, 1],
    ];
    paws = P4[f];
    lifts = L4[f];
    by = f === 1 ? -1 : 0;
    hy = f === 3 ? 1 : 0;
    tail = f % 2 ? 1 : 0;
  } else if (anim === 'attack') {
    if (f === 0) {
      bx = 0;
      by = 1;
      hy = 2;
      hx = 0;
      mouth = 'snarl';
      hackles = true;
      tail = -1;
      paws = [-1, 0, 1, 2];
    } else {
      bx = 1;
      by = -1;
      hx = 0;
      hy = 0;
      mouth = 'open';
      tail = 1;
      paws = [-3, -2, 3, 3];
      lifts = [0, 0, 2, 2];
    }
  }

  // legs (far pair first, darker)
  const leg = (x0: number, pdx: number, lift: number, far: boolean): void => {
    const l = new Buf(24, 16);
    const top = 9 + by;
    const px = x0 + pdx;
    const py = 14 - lift;
    limb(l, [x0 + bx, top], [px + bx, py - 1], 2, 2, '#000000');
    l.set(px + bx, py, '#000000').set(px + bx + 1, py, '#000000');
    shade(l, far ? [mix(P.d, INK, 0.3), P.d] : [P.d, P.m, P.l], { rim: 0.2 });
    b.blit(l);
  };
  leg(6, paws[0], lifts[0], true);
  leg(14, paws[2], lifts[2], true);

  // body volume
  const body = new Buf(24, 16);
  body.ellipse(11 + bx, 7.5 + by, 6, 2.8, '#000000');
  body.ellipse(6.5 + bx, 7.6 + by, 2.7, 2.7, '#000000');
  body.ellipse(15 + bx, 7.6 + by, 2.9, 3.1, '#000000');
  body.poly(
    [
      [14 + bx, 6 + by],
      [17 + bx + hx, 3.4 + by + hy],
      [19.5 + bx + hx, 5.5 + by + hy],
      [17.5 + bx, 9.5 + by],
    ],
    '#000000',
  );
  shade(body, [P.d, P.m, P.l], { rim: 0.25 });
  b.blit(body);

  // tail
  const tl = new Buf(24, 16);
  const tipY = tail === 1 ? 3 : tail === 0 ? 4 : 8;
  const tipX = 2;
  limb(tl, [5 + bx, 6.5 + by], [tipX + bx, tipY + by], 3, 2.6, '#000000');
  shade(tl, [P.d, P.m, P.l], { rim: 0.3 });
  b.blit(tl);
  b.tint(tipX + bx, tipY + by, P.l);

  // head
  const hd = new Buf(24, 16);
  const HX = bx + hx;
  const HY = by + hy;
  hd.ellipse(18.5 + HX, 5.2 + HY, 2.7, 2.3, '#000000');
  hd.poly(
    [
      [19.5 + HX, 4.3 + HY],
      [21.9 + HX, 5.4 + HY],
      [21.9 + HX, 7 + HY],
      [19.5 + HX, 7.6 + HY],
    ],
    '#000000',
  );
  tri(hd, [16.3 + HX, 4.2 + HY], [17 + HX, 1.8 + HY], [18.6 + HX, 3.6 + HY], '#000000');
  tri(hd, [18.4 + HX, 3.6 + HY], [19.8 + HX, 2 + HY], [20.6 + HX, 4.2 + HY], '#000000');
  if (mouth === 'open') {
    hd.poly(
      [
        [19 + HX, 7 + HY],
        [21.8 + HX, 8.6 + HY],
        [21.5 + HX, 9.6 + HY],
        [18.5 + HX, 8.5 + HY],
      ],
      '#000000',
    );
  }
  shade(hd, [P.d, P.m, P.l], { rim: 0.3 });
  b.blit(hd);

  // markings: cream chest, belly, muzzle
  const cream = (x: number, y: number): void => {
    b.tint(Math.round(x), Math.round(y), P.w);
  };
  for (let y = 7; y <= 10; y++)
    for (let x = 15; x <= 18; x++) if (y >= (x > 16 ? 7 : 8)) cream(x + bx, y + by);
  for (let x = 8; x <= 13; x++) cream(x + bx, 10 + by);
  for (let x = 19; x <= 21; x++) cream(x + HX, 6 + HY);
  cream(21 + HX, 7 + HY);
  cream(20 + HX, 7 + HY);
  // ears inner
  b.tint(17 + HX, 2 + HY, P.i);
  b.tint(19 + HX, 2 + HY, P.i);
  // eye + brow
  b.set(19 + HX, 4 + HY, P.e);
  b.set(18 + HX, 4 + HY, INK);
  b.set(19 + HX, 3 + HY, P.d).set(20 + HX, 3 + HY, P.d);
  // nose
  b.set(21 + HX, 5 + HY, P.n);
  // mouth
  if (mouth === 'closed') {
    b.set(20 + HX, 7 + HY, P.d);
  } else if (mouth === 'snarl') {
    b.set(19 + HX, 7 + HY, INK)
      .set(20 + HX, 7 + HY, INK)
      .set(21 + HX, 7 + HY, INK);
    b.set(20 + HX, 6 + HY, '#ffffff').set(21 + HX, 6 + HY, P.w);
    b.set(20 + HX, 5 + HY, P.d);
  } else {
    b.set(19 + HX, 7 + HY, INK)
      .set(20 + HX, 7 + HY, INK)
      .set(21 + HX, 7 + HY, '#ffffff');
    b.set(19 + HX, 8 + HY, PAL.darkRed)
      .set(20 + HX, 8 + HY, INK)
      .set(21 + HX, 8 + HY, '#ffffff');
  }
  // back ridge fur
  if (hackles) {
    for (const x of [8, 10, 12, 14]) b.set(x + bx, 4 + by, P.d).set(x + bx + 1, 4 + by, P.l);
  }
  if (P.x) {
    for (const [x, y] of [
      [9, 4],
      [11, 4],
      [13, 4],
    ] as const) {
      b.set(x + bx, y + by, P.x).set(x + bx, y + by - 1, '#ffffff');
    }
  }

  // near legs on top
  leg(8, paws[1], lifts[1], false);
  leg(16, paws[3], lifts[3], false);
  b.outline(INK);
  return b;
}

// --------------------------------------------------------------- mushroom ---

function mushroom(anim: AnimName, f: number): Buf {
  const b = new Buf(16, 16);
  let capDy = 0;
  let capRx = 6.4;
  let capRy = 4.4;
  let bob = 0;
  let lifts = [0, 0];
  let mood: 'calm' | 'puff' | 'spore' = 'calm';
  if (anim === 'idle') {
    bob = f;
    capDy = f;
  } else if (anim === 'move') {
    lifts = [
      [0, 0],
      [1, 0],
      [0, 0],
      [0, 1],
    ][f];
    bob = f % 2 === 1 ? 0 : 1;
    capDy = bob + (f === 2 ? 1 : 0);
  } else if (anim === 'attack') {
    if (f === 0) {
      capDy = 2;
      capRx = 7;
      capRy = 3.8;
      bob = 1;
      mood = 'puff';
    } else {
      capDy = -2;
      capRy = 4.8;
      mood = 'spore';
    }
  }
  // feet
  const foot = (x: number, lift: number): void => {
    b.set(x, 13 - lift, PAL.brown).set(x + 1, 13 - lift, PAL.brown);
    b.set(x, 14 - lift, PAL.darkBrown)
      .set(x + 1, 14 - lift, PAL.darkBrown)
      .set(x + 2, 14 - lift, PAL.darkBrown);
  };
  foot(5, lifts[0]);
  foot(9, lifts[1]);
  // stem / body
  vol(b, [PAL.tan, PAL.sand, '#fff4dc'], (l) => l.ellipse(8, 10.6 + bob * 0.5, 3.2, 2.8, '#000000'), {
    rim: 0.2,
  });
  // face (looking right)
  const ey = 10 + Math.round(bob * 0.5);
  if (mood === 'puff') {
    b.set(8, ey, INK)
      .set(10, ey, INK)
      .set(9, ey + 2, INK);
    b.set(7, ey + 1, PAL.pink).set(11, ey + 1, PAL.pink);
  } else {
    b.set(8, ey, INK)
      .set(8, ey + 1, INK)
      .set(10, ey, INK)
      .set(10, ey + 1, INK);
    b.set(9, ey + 2, mood === 'spore' ? INK : PAL.skinShade);
  }
  // cap
  const cy = 7.2 + capDy;
  const cap = new Buf(16, 16).ellipse(8, cy, capRx, capRy, '#000000');
  for (let y = Math.ceil(cy + 1); y < 16; y++) for (let x = 0; x < 16; x++) cap.set(x, y, null);
  shade(cap, [PAL.darkRed, PAL.red, '#ff7a7a'], { rim: 0.3, cy: cy - 1 });
  b.blit(cap);
  const gy = Math.ceil(cy + 1);
  for (let x = Math.round(8 - capRx + 1); x <= Math.round(8 + capRx - 2); x++)
    b.set(x, gy, x < 5 || x > 11 ? PAL.darkRed : PAL.skinShade);
  // spots
  const spot = (x: number, y: number, w: number): void => {
    b.tint(x, y + capDy, '#ffffff');
    if (w > 1) b.tint(x + 1, y + capDy, PAL.sand);
    b.tint(x, y + 1 + capDy, w > 1 ? PAL.lightGray : '#ffffff');
  };
  spot(5, 4, 2);
  spot(9, 3, 1);
  spot(11, 6, 2);
  spot(3, 7, 1);
  b.outline(INK);
  if (mood === 'spore') {
    const pts: [number, number, Col][] = [
      [2, 3, PAL.yellow],
      [1, 7, '#c4e86b'],
      [13, 1, PAL.yellow],
      [14, 5, '#c4e86b'],
      [5, 1, '#c4e86b'],
      [11, 0, PAL.yellow],
      [0, 11, PAL.yellow],
      [15, 9, '#c4e86b'],
    ];
    for (const [x, y, c] of pts) b.set(x, y, c);
  } else if (mood === 'puff') {
    b.set(3, 2, '#c4e86b').set(12, 2, '#c4e86b');
  }
  return b;
}

// ------------------------------------------------------------------ goblin ---

function goblin(anim: AnimName, f: number): Buf {
  const b = new Buf(16, 16);
  let bob = 0;
  let lifts = [0, 0];
  let draw: 'rest' | 'pull' | 'release' = 'rest';
  if (anim === 'idle') bob = f;
  else if (anim === 'move') {
    lifts = [
      [0, 0],
      [1, 0],
      [0, 0],
      [0, 1],
    ][f];
    bob = f % 2 === 1 ? 0 : 1;
  } else if (anim === 'attack') draw = f === 0 ? 'pull' : 'release';
  const G: Ramp = [PAL.darkGreen, PAL.green, '#a6e87a'];
  const TUNIC: Ramp = [PAL.plum, PAL.darkBrown, PAL.brown];
  // quiver on the back
  b.rect(3, 9 + bob, 2, 4, PAL.darkBrown).set(3, 9 + bob, PAL.brown);
  b.set(3, 8 + bob, PAL.red).set(4, 8 + bob, PAL.sand);
  // legs
  const leg = (x: number, lift: number, far: boolean): void => {
    b.set(x, 12 - lift, far ? PAL.forest : PAL.darkGreen).set(x, 13 - lift, far ? PAL.forest : PAL.darkGreen);
    b.set(x, 14 - lift, far ? INK : PAL.plum).set(x + 1, 14 - lift, far ? INK : PAL.plum);
  };
  leg(6, lifts[0], true);
  // tunic
  vol(b, TUNIC, (l) => l.rect(5, 9 + bob, 5, 4, '#000000'), { rim: 0.15 });
  b.hline(5, 9, 11 + bob, PAL.plum).set(8, 11 + bob, PAL.gold);
  leg(8, lifts[1], false);
  // head
  const hy = bob;
  const hd = new Buf(16, 16);
  hd.ellipse(8.2, 5.4 + hy, 3.8, 3.2, '#000000');
  tri(hd, [5.2, 4.4 + hy], [1, 2.4 + hy], [5.4, 6.4 + hy], '#000000');
  hd.poly(
    [
      [11, 5 + hy],
      [13.4, 6.6 + hy],
      [11, 7.6 + hy],
    ],
    '#000000',
  );
  shade(hd, G, { rim: 0.3 });
  b.blit(hd);
  // inner ear
  b.set(3, 3 + hy, PAL.pink).set(4, 4 + hy, PAL.skinShade);
  // leather hood cap
  for (let x = 6; x <= 10; x++) b.set(x, 2 + hy, x < 8 ? PAL.brown : PAL.darkBrown);
  for (let x = 5; x <= 11; x++) b.tint(x, 3 + hy, x < 7 ? PAL.darkBrown : PAL.plum);
  // face: brow, big yellow eye, grin
  b.set(9, 4 + hy, PAL.forest)
    .set(10, 4 + hy, PAL.forest)
    .set(11, 4 + hy, PAL.forest);
  b.set(10, 5 + hy, PAL.yellow).set(11, 5 + hy, INK);
  b.set(9, 7 + hy, INK)
    .set(10, 7 + hy, INK)
    .set(11, 7 + hy, '#ffffff');
  b.set(12, 6 + hy, PAL.darkGreen);
  // bow at chest height
  const bowX = draw === 'release' ? 13 : 12;
  const by0 = 5 + bob;
  const by1 = 13 + bob;
  const cy = 9 + bob;
  b.set(bowX, by0, PAL.tan).set(bowX + 1, by0 + 1, PAL.brown);
  for (let y = by0 + 2; y <= by1 - 2; y++) b.set(bowX + 1, y, y === cy ? PAL.darkBrown : PAL.brown);
  b.set(bowX + 1, by1 - 1, PAL.brown).set(bowX, by1, PAL.darkBrown);
  if (draw === 'pull') {
    b.line(bowX, by0 + 1, 8, cy, PAL.lightGray);
    b.line(8, cy, bowX, by1 - 1, PAL.lightGray);
    b.hline(8, 14, cy, PAL.brown);
    b.set(14, cy, '#ffffff')
      .set(14, cy - 1, PAL.gray)
      .set(14, cy + 1, PAL.gray);
    b.set(8, cy - 1, PAL.red)
      .set(7, cy, G[1])
      .set(bowX + 1, cy, G[2]);
  } else {
    b.vline(bowX, by0 + 1, by1 - 1, PAL.lightGray);
    b.line(9, 10 + bob, bowX, cy, G[1]);
    b.set(bowX + 1, cy, G[2]);
    if (draw === 'release') b.line(6, 10 + bob, 4, 9 + bob, G[1]);
  }
  b.outline(INK);
  if (draw === 'release') b.set(15, cy, '#ffffff').set(14, cy, PAL.lightGray);
  return b;
}

// --------------------------------------------------------------------- bat ---

const WING: Record<'up' | 'mid' | 'down', [number, number][]> = {
  up: [
    [6.5, 7],
    [4.5, 3],
    [1, 1],
    [1.2, 4.5],
    [2.5, 5.2],
    [3, 7.2],
    [4.5, 7.6],
    [5, 9.4],
  ],
  mid: [
    [6.5, 7],
    [3, 5.5],
    [0.6, 6.2],
    [1.4, 8.6],
    [2.8, 8.2],
    [3.4, 10],
    [4.8, 9.4],
    [5.6, 10.4],
  ],
  down: [
    [6.5, 7.2],
    [4.2, 8.6],
    [1.6, 12.6],
    [3, 12],
    [3.8, 13.4],
    [5, 12],
    [5.8, 12.8],
    [6.4, 10.5],
  ],
};

function bat(anim: AnimName, f: number): Buf {
  const b = new Buf(16, 16);
  const cyc: ('up' | 'mid' | 'down')[] = ['up', 'mid', 'down', 'mid'];
  let ph = cyc[f % 4];
  let dy = ph === 'down' ? -1 : ph === 'up' ? 1 : 0;
  let mouth = false;
  if (anim === 'attack') {
    ph = f === 0 ? 'up' : 'down';
    dy = f === 0 ? 0 : 1;
    mouth = true;
  }
  const W = WING[ph];
  const wing = new Buf(16, 16);
  wing.poly(
    W.map(([x, y]) => [Math.max(1.3, x), y + dy] as [number, number]),
    '#000000',
  );
  wing.poly(
    W.map(([x, y]) => [16 - Math.max(1.3, x), y + dy] as [number, number]),
    '#000000',
  );
  shade(wing, [PAL.plum, PAL.purple, '#8a5a8e'], { rim: 0.2 });
  // wing bones along the leading edge
  const bone = (sgn: number): void => {
    const [x0, y0] = W[0];
    const [x1, y1] = W[2];
    const X = (x: number): number => (sgn > 0 ? Math.max(1.3, x) : 16 - Math.max(1.3, x));
    b.line(X(x0), y0 + dy, X(x1), y1 + dy, PAL.plum);
  };
  b.blit(wing);
  bone(1);
  bone(-1);
  // body + ears
  const body = new Buf(16, 16);
  body.ellipse(8, 8 + dy, 2.6, 3, '#000000');
  tri(body, [5.8, 7 + dy], [5.6, 3 + dy], [7.6, 5.5 + dy], '#000000');
  tri(body, [10.2, 7 + dy], [10.4, 3 + dy], [8.4, 5.5 + dy], '#000000');
  shade(body, [PAL.plum, PAL.purple, PAL.magenta], { rim: 0.3 });
  b.blit(body);
  b.set(6, 5 + dy, PAL.pink).set(9, 5 + dy, PAL.pink);
  // face
  b.set(7, 7 + dy, PAL.hotPink).set(9, 7 + dy, PAL.hotPink);
  if (mouth) {
    b.set(7, 9 + dy, INK)
      .set(8, 9 + dy, INK)
      .set(9, 9 + dy, INK);
    b.set(7, 10 + dy, '#ffffff')
      .set(9, 10 + dy, '#ffffff')
      .set(8, 10 + dy, PAL.darkRed);
  } else {
    b.set(7, 10 + dy, '#ffffff').set(9, 10 + dy, '#ffffff');
  }
  b.outline(INK);
  return b;
}

// ---------------------------------------------------------------- skeleton ---

function skeleton(anim: AnimName, f: number): Buf {
  const b = new Buf(16, 24);
  let bob = 0;
  let lifts = [0, 0];
  let swing: 'rest' | 'raise' | 'slash' = 'rest';
  let lean = 0;
  if (anim === 'idle') bob = f;
  else if (anim === 'move') {
    lifts = [
      [0, 0],
      [1, 0],
      [0, 0],
      [0, 1],
    ][f];
    bob = f % 2 === 1 ? 0 : 1;
  } else if (anim === 'attack') {
    swing = f === 0 ? 'raise' : 'slash';
    lean = f === 0 ? 0 : 1;
  }
  const BONE: Ramp = [PAL.gray, PAL.lightGray, '#ffffff'];
  const bone = PAL.lightGray;
  const boneS = PAL.gray;
  // shield (on the far arm, behind)
  const sh = new Buf(16, 24);
  sh.ellipse(4 + lean, 14.5 + bob, 2.9, 3.4, '#000000');
  shade(sh, [PAL.darkBrown, PAL.brown, PAL.tan], { rim: 0.3 });
  b.blit(sh);
  b.ring(4 + lean, 14.5 + bob, 2.9, 1, PAL.slate, 3.4);
  b.set(4 + lean, 14 + bob, PAL.lightGray).set(4 + lean, 15 + bob, PAL.gray);
  // legs
  const leg = (x: number, lift: number, far: boolean): void => {
    const c = far ? boneS : bone;
    b.vline(x, 18, 21 - lift, c);
    b.set(x + 1, 18, far ? PAL.slate : boneS);
    b.set(x, 19 - lift, far ? PAL.slate : '#ffffff');
    b.set(x, 22 - lift, c)
      .set(x + 1, 22 - lift, c)
      .set(x + 2, 22 - lift, far ? PAL.slate : boneS);
  };
  leg(6, lifts[0], true);
  leg(8, lifts[1], false);
  // pelvis + spine + ribs
  b.hline(5 + lean, 10 + lean, 17 + bob, boneS).hline(6 + lean, 9 + lean, 16 + bob, bone);
  const rib = new Buf(16, 24);
  rib.rect(5 + lean, 11 + bob, 6, 4, '#000000');
  rib.set(5 + lean, 11 + bob, null).set(10 + lean, 14 + bob, null);
  shade(rib, BONE, { rim: 0.3 });
  b.blit(rib);
  b.hline(6 + lean, 9 + lean, 12 + bob, PAL.navy).hline(6 + lean, 9 + lean, 14 + bob, PAL.navy);
  b.vline(7 + lean, 11 + bob, 16 + bob, boneS);
  b.set(7 + lean, 15 + bob, bone);
  // skull
  const sk = new Buf(16, 24);
  sk.ellipse(8.5 + lean, 6 + bob, 4, 3.8, '#000000');
  sk.rect(7 + lean, 8 + bob, 5, 2, '#000000');
  shade(sk, BONE, { rim: 0.3 });
  b.blit(sk);
  const sx = lean;
  const sy = bob;
  b.set(9 + sx, 5 + sy, INK)
    .set(10 + sx, 5 + sy, INK)
    .set(9 + sx, 6 + sy, INK)
    .set(10 + sx, 6 + sy, PAL.hotPink);
  b.set(12 + sx, 7 + sy, INK);
  // jaw & teeth
  b.hline(8 + sx, 11 + sx, 9 + sy, INK);
  b.set(8 + sx, 8 + sy, '#ffffff').set(10 + sx, 8 + sy, '#ffffff');
  b.set(9 + sx, 10 + sy, boneS)
    .set(10 + sx, 10 + sy, bone)
    .set(11 + sx, 10 + sy, boneS);
  // crack
  b.set(6 + sx, 3 + sy, PAL.gray).set(7 + sx, 4 + sy, PAL.gray);
  // sword arm + rusty sword
  const blade = (x0: number, y0: number, x1: number, y1: number): void => {
    const pts = Buf.linePts(x0, y0, x1, y1);
    pts.forEach(([x, y], i) => {
      const rust = i % 3 === 1;
      b.set(x, y, rust ? PAL.rust : i === pts.length - 1 ? PAL.lightGray : PAL.gray);
    });
  };
  if (swing === 'rest') {
    b.line(8 + sx, 12 + sy, 11 + sx, 15 + sy, bone);
    blade(12, 14 + sy, 12, 6 + sy);
    b.hline(11, 13, 15 + sy, PAL.darkBrown).set(12, 16 + sy, PAL.brown);
    b.set(11, 15 + sy, bone);
  } else if (swing === 'raise') {
    b.line(8 + sx, 12, 9 + sx, 9, bone);
    blade(8 + sx, 7, 3 + sx, 2);
    b.line(8 + sx, 9, 10 + sx, 7, PAL.darkBrown);
    b.set(9 + sx, 8, bone);
  } else {
    b.line(9 + sx, 12, 12 + sx, 14, bone);
    blade(13, 15, 14, 21);
    b.set(12, 14, PAL.darkBrown).set(14, 14, PAL.darkBrown).set(13, 14, bone);
  }
  b.outline(INK);
  if (swing === 'slash') {
    // swoosh
    b.set(15, 17, '#ffffffa0').set(15, 18, '#ffffffc0').set(15, 19, '#ffffffa0');
  }
  return b;
}

// ----------------------------------------------------------------- sapling ---

function sapling(anim: AnimName, f: number): Buf {
  const b = new Buf(16, 16);
  let bob = 0;
  let lifts = [0, 0];
  let arms: 'rest' | 'up' | 'whip' = 'rest';
  if (anim === 'idle') bob = f;
  else if (anim === 'move') {
    lifts = [
      [0, 0],
      [1, 0],
      [0, 0],
      [0, 1],
    ][f];
    bob = f % 2 === 1 ? 0 : 1;
  } else if (anim === 'attack') arms = f === 0 ? 'up' : 'whip';
  // roots
  const root = (x: number, lift: number, dir: number): void => {
    b.set(x, 13 - lift, PAL.darkBrown)
      .set(x, 14 - lift, PAL.darkBrown)
      .set(x + dir, 14 - lift, PAL.plum);
  };
  root(6, lifts[0], -1);
  root(9, lifts[1], 1);
  // trunk
  vol(b, R.wood, (l) => l.rect(6, 8 + bob, 4, 6, '#000000'), { rim: 0.3 });
  b.set(7, 10 + bob, INK)
    .set(7, 11 + bob, INK)
    .set(9, 10 + bob, INK)
    .set(9, 11 + bob, INK);
  b.set(8, 12 + bob, PAL.plum);
  // twig arms
  const tw = PAL.brown;
  if (arms === 'rest') {
    b.line(5, 11 + bob, 4, 10 + bob, tw).set(3, 10 + bob, PAL.green);
    b.line(10, 11 + bob, 11, 10 + bob, tw).set(12, 10 + bob, PAL.green);
  } else if (arms === 'up') {
    b.line(5, 10, 3, 7, tw).set(3, 6, PAL.green).set(2, 7, PAL.green);
    b.line(10, 10, 12, 7, tw).set(12, 6, PAL.green).set(13, 7, PAL.green);
  } else {
    b.line(10, 11, 14, 11, tw).set(14, 10, PAL.green).set(15, 11, PAL.green);
    b.line(5, 11, 4, 12, tw);
  }
  // leafy crown
  const cr = new Buf(16, 16);
  cr.ellipse(8, 5.4 + bob, 5.4, 3.9, '#000000');
  cr.ellipse(4.5, 6.6 + bob, 2.4, 2, '#000000');
  cr.ellipse(11.5, 6.4 + bob, 2.4, 2, '#000000');
  cr.ellipse(8, 3.2 + bob, 2.4, 1.8, '#000000');
  shade(cr, R.green, { rim: 0.35 });
  b.blit(cr);
  b.set(6, 3 + bob, '#d8f8b0')
    .set(10, 5 + bob, PAL.pink)
    .set(11, 5 + bob, PAL.hotPink);
  b.outline(INK);
  return b;
}

// ------------------------------------------------------------------- defs ---

const SMALL = { w: 16, h: 16, anchorX: 8, anchorY: 15 } as const;

function side(
  info: Omit<SpriteDef['info'], 'dirs'>,
  fn: (anim: AnimName, f: number) => Buf,
  dirs: 1 | 2 = 2,
): SpriteDef {
  return { info: { ...info, dirs }, draw: (anim, f) => fn(anim, f) };
}

export const CREATURE_A_DEFS: Partial<Record<CreatureId, SpriteDef>> = {
  slime: side({ ...SMALL, anims: anims({ idle: [2, 3], move: [4, 8], attack: [2, 6] }) }, (a, f) =>
    slime(SLIMES.slime, a, f),
  ),
  slime_crystal: side({ ...SMALL, anims: anims({ idle: [2, 3], move: [4, 8], attack: [2, 6] }) }, (a, f) =>
    slime(SLIMES.slime_crystal, a, f),
  ),
  slime_magma: side({ ...SMALL, anims: anims({ idle: [2, 3], move: [4, 8], attack: [2, 6] }) }, (a, f) =>
    slime(SLIMES.slime_magma, a, f),
  ),
  wolf: side(
    { w: 24, h: 16, anchorX: 12, anchorY: 15, anims: anims({ idle: [2, 2], move: [4, 10], attack: [2, 6] }) },
    (a, f) => wolf(WOLVES.wolf, a, f),
  ),
  wolf_ice: side(
    { w: 24, h: 16, anchorX: 12, anchorY: 15, anims: anims({ idle: [2, 2], move: [4, 10], attack: [2, 6] }) },
    (a, f) => wolf(WOLVES.wolf_ice, a, f),
  ),
  mushroom: side({ ...SMALL, anims: anims({ idle: [2, 2], move: [4, 6], attack: [2, 4] }) }, mushroom),
  goblin: side({ ...SMALL, anims: anims({ idle: [2, 2], move: [4, 8], attack: [2, 4] }) }, goblin),
  bat: side(
    { w: 16, h: 16, anchorX: 8, anchorY: 15, anims: anims({ idle: [4, 10], move: [4, 12], attack: [2, 6] }) },
    bat,
    1,
  ),
  skeleton: side(
    { w: 16, h: 24, anchorX: 8, anchorY: 23, anims: anims({ idle: [2, 2], move: [4, 6], attack: [2, 5] }) },
    skeleton,
  ),
  sapling: side({ ...SMALL, anims: anims({ idle: [2, 2], move: [4, 8], attack: [2, 5] }) }, sapling),
};
