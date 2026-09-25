/**
 * Creatures, part B: golems, fire imp, salamander, wisps, yeti, frost wraith,
 * shadow knight, void mage, gargoyle. Side-view sprites face RIGHT.
 */
import { PAL } from '../../palette';
import type { AnimName, CreatureId } from '../types';
import { Buf, INK, mix, shade, type Col, type Pt, type Ramp } from './buf';
import { anims, type SpriteDef } from './defs';
import { limb, tri } from './shapes';

const K = '#000000';

function layer(w: number, h: number, ramp: Ramp, draw: (l: Buf) => void, rim = 0.28): Buf {
  const l = new Buf(w, h);
  draw(l);
  return shade(l, ramp, { rim });
}

// ------------------------------------------------------------------ golem ---

interface GolemPal {
  ramp: Ramp;
  dark: Col;
  moss: Col;
  mossL: Col;
  eye: Col;
  eyeHi: Col;
  gem?: Col;
}

const GOLEMS: Record<'golem' | 'golem_ice', GolemPal> = {
  golem: {
    ramp: ['#3b3140', '#6a5a5c', '#948378', '#bcae9c'],
    dark: '#2a2230',
    moss: PAL.darkGreen,
    mossL: PAL.green,
    eye: PAL.gold,
    eyeHi: PAL.yellow,
  },
  golem_ice: {
    ramp: [PAL.blue, '#3f86c6', '#8fd3f0', '#e4fbff'],
    dark: PAL.navy,
    moss: '#e8f4ff',
    mossL: '#ffffff',
    eye: PAL.cyan,
    eyeHi: '#ffffff',
  },
};

function golem(P: GolemPal, anim: AnimName, f: number): Buf {
  const W = 24;
  const H = 24;
  const b = new Buf(W, H);
  let by = 0;
  let bx = 0;
  let hy = 0;
  let lifts = [0, 0];
  // fists: far, near
  let fists: [Pt, Pt] = [
    [5, 19],
    [17, 19],
  ];
  let raised = false;
  let slam = false;
  if (anim === 'idle') {
    by = f;
    hy = f;
  } else if (anim === 'move') {
    lifts = [
      [0, 0],
      [2, 0],
      [0, 0],
      [0, 2],
    ][f];
    by = f % 2 === 1 ? -1 : 0;
    bx = f === 1 ? 1 : f === 3 ? -1 : 0;
    fists = [
      [5 + (f === 1 ? -1 : f === 3 ? 1 : 0), 19 - (f === 1 ? 1 : 0)],
      [17 + (f === 1 ? 1 : f === 3 ? -1 : 0), 19 - (f === 3 ? 1 : 0)],
    ];
  } else if (anim === 'attack') {
    if (f === 0) {
      by = 1;
      bx = -1;
      hy = 1;
      fists = [
        [9, 4],
        [16, 4],
      ];
      raised = true;
    } else {
      by = 2;
      bx = 1;
      hy = 2;
      fists = [
        [14, 20],
        [20, 20],
      ];
      slam = true;
    }
  }
  const ramp = P.ramp;
  const farRamp: Ramp = [P.dark, ramp[0], ramp[1]];
  const leg = (x: number, lift: number, far: boolean): void => {
    b.blit(layer(W, H, far ? farRamp : ramp, (q) => q.rect(x, 18 - lift, 4, 5, K)));
    b.hline(x, x + 3, 22 - lift, far ? P.dark : ramp[0]);
  };
  const arm = (sh: Pt, fist: Pt, far: boolean): void => {
    const l = new Buf(W, H);
    limb(l, sh, fist, 3.6, 3, K);
    l.ellipse(fist[0] + 0.5, fist[1] + 0.5, 2.9, 2.6, K);
    shade(l, far ? farRamp : ramp, { rim: 0.3, bias: far ? 0 : 0.2 });
    b.overlay(l, INK, 'all');
    const kc = far ? P.dark : ramp[0];
    b.set(fist[0] + 1, fist[1] - 1, kc).set(fist[0] + 1, fist[1], kc);
  };
  leg(7, lifts[0], true);
  arm([8 + bx, 11 + by], fists[0], true);
  leg(12, lifts[1], false);
  // body boulder with a hunched back
  b.blit(
    layer(W, H, ramp, (l) => {
      l.ellipse(12 + bx, 13.5 + by, 6.6, 5.6, K);
      l.ellipse(10 + bx, 10 + by, 5, 3.6, K);
    }),
  );
  const cracks: Pt[] = [
    [9, 12],
    [10, 13],
    [10, 14],
    [11, 15],
    [14, 12],
    [15, 13],
    [7, 16],
  ];
  for (const [x, y] of cracks) b.tint(x + bx, y + by, P.dark);
  // moss / snow along the back
  for (let x = 6; x <= 13; x++) {
    let yy = 0;
    while (yy < H && !b.has(x + bx, yy)) yy++;
    if ((x * 7) % 5 < 4) b.tint(x + bx, yy, x % 2 ? P.mossL : P.moss);
    if (x % 3 === 0) b.tint(x + bx, yy + 1, P.moss);
  }
  const head = (): void => {
    const hx = bx + (slam ? 2 : 0);
    const Y = hy;
    b.overlay(
      layer(W, H, ramp, (l) => {
        l.ellipse(15.5 + hx, 8.2 + Y, 3, 2.6, K);
        l.rect(13 + hx, 9 + Y, 5, 2, K);
      }),
      P.dark,
      'back',
    );
    b.set(15 + hx, 8 + Y, P.dark)
      .set(16 + hx, 8 + Y, P.eye)
      .set(17 + hx, 8 + Y, P.eyeHi);
    b.hline(15 + hx, 18 + hx, 7 + Y, P.dark);
    b.tint(14 + hx, 6 + Y, P.mossL).tint(15 + hx, 6 + Y, P.moss);
  };
  if (raised) {
    // arms go up behind the head
    arm([14 + bx, 11 + by], fists[1], false);
    head();
  } else {
    head();
    arm([14 + bx, 12 + by], fists[1], false);
  }
  b.outline(INK);
  if (slam) {
    for (const [x, y, c] of [
      [12, 22, ramp[2]],
      [23, 21, ramp[2]],
      [22, 17, ramp[1]],
      [11, 19, ramp[1]],
      [23, 18, ramp[3]],
      [10, 21, ramp[3]],
    ] as [number, number, Col][]) {
      b.set(x, y, c);
    }
  } else if (raised) {
    b.set(12, 0, ramp[3]).set(20, 1, ramp[3]);
  }
  return b;
}

// --------------------------------------------------------------- fire imp ---

function flameTongue(b: Buf, x: number, y: number, h: number, ramp: Ramp): void {
  for (let i = 0; i < h; i++)
    b.set(x, y - i, ramp[Math.min(ramp.length - 1, Math.floor((i / h) * ramp.length))]);
}

function fireImp(anim: AnimName, f: number): Buf {
  const b = new Buf(16, 16);
  let by = [0, -1, -1, 0][f % 4];
  let arms: 'rest' | 'back' | 'swipe' | 'raise' | 'raise2' = 'rest';
  let lean = 0;
  if (anim === 'move') lean = 1;
  if (anim === 'attack') {
    arms = f === 0 ? 'back' : 'swipe';
    lean = f === 0 ? -1 : 1;
    by = 0;
  }
  if (anim === 'cast') {
    arms = f === 0 ? 'raise' : 'raise2';
    by = -1;
  }
  const RED: Ramp = [PAL.darkRed, PAL.red, '#ff7f7f'];
  // flame trail below
  const fl: Ramp = [PAL.darkRed, PAL.orange, PAL.gold, PAL.yellow];
  const flick = f % 2;
  const tail = new Buf(16, 16);
  tail.poly(
    [
      [5.5 + lean, 10 + by],
      [10.5 + lean, 10 + by],
      [8.5 + lean - flick, 14.6],
      [7 - flick, 13 + flick],
    ],
    K,
  );
  shade(tail, [PAL.rust, PAL.orange, PAL.gold], { ly: 1, lx: 0, rim: 0.1 });
  b.blit(tail);
  // wings (back)
  const wing = new Buf(16, 16);
  wing.poly(
    [
      [6 + lean, 7 + by],
      [1.5 + lean, 3 + by + flick],
      [2.5 + lean, 6 + by],
      [1 + lean, 7.5 + by + flick],
      [5.5 + lean, 9 + by],
    ],
    K,
  );
  shade(wing, [PAL.plum, PAL.purple, PAL.magenta], { rim: 0.2 });
  b.blit(wing);
  // tail with spade
  b.line(5 + lean, 11 + by, 3, 12 + by, PAL.darkRed);
  b.set(2, 11 + by, PAL.red)
    .set(2, 12 + by, PAL.red)
    .set(2, 13 + by, PAL.darkRed)
    .set(1, 12 + by, PAL.darkRed);
  // body
  const body = layer(16, 16, RED, (l) => {
    l.ellipse(8.5 + lean, 7.8 + by, 3.6, 3.4, K);
    l.ellipse(8 + lean, 10.5 + by, 2.4, 1.8, K);
  });
  b.blit(body);
  // belly
  b.tint(8 + lean, 10 + by, PAL.orange)
    .tint(9 + lean, 10 + by, PAL.gold)
    .tint(8 + lean, 11 + by, PAL.orange);
  // horns
  const hx = lean;
  b.set(6 + hx, 4 + by, PAL.sand)
    .set(5 + hx, 3 + by, PAL.sand)
    .set(5 + hx, 2 + by, '#ffffff');
  b.set(10 + hx, 4 + by, PAL.sand)
    .set(11 + hx, 3 + by, PAL.sand)
    .set(11 + hx, 2 + by, '#ffffff');
  // face
  b.set(9 + hx, 7 + by, PAL.yellow).set(11 + hx, 7 + by, PAL.yellow);
  b.set(9 + hx, 6 + by, PAL.darkRed).set(11 + hx, 6 + by, PAL.darkRed);
  b.set(9 + hx, 9 + by, INK)
    .set(10 + hx, 9 + by, '#ffffff')
    .set(11 + hx, 9 + by, INK);
  // arms
  const armCol = PAL.red;
  if (arms === 'rest') {
    b.line(11 + hx, 9 + by, 12 + hx, 10 + by, armCol).set(13 + hx, 10 + by, PAL.darkRed);
  } else if (arms === 'back') {
    b.line(7 + hx, 9 + by, 4 + hx, 8 + by, armCol).set(3 + hx, 7 + by, '#ffffff');
  } else if (arms === 'swipe') {
    b.line(11 + hx, 8 + by, 14, 8 + by, armCol)
      .set(15, 7 + by, '#ffffff')
      .set(15, 9 + by, '#ffffff');
  } else {
    b.line(7 + hx, 8 + by, 7 + hx, 5 + by, armCol).line(10 + hx, 8 + by, 11 + hx, 5 + by, armCol);
  }
  b.outline(INK);
  if (arms === 'raise' || arms === 'raise2') {
    const big = arms === 'raise2';
    const orb = layer(
      16,
      16,
      [PAL.orange, PAL.gold, PAL.yellow, '#ffffff'],
      (l) => l.ellipse(9 + hx, 3.4, big ? 2.4 : 1.7, big ? 2.1 : 1.5, K),
      0.1,
    );
    b.blit(orb);
    if (big)
      b.set(6 + hx, 0, PAL.gold)
        .set(12 + hx, 1, PAL.gold)
        .set(9 + hx, 0, '#ffffff');
  }
  // tongue flicker at the bottom
  flameTongue(b, 8 - flick, 15, 1, fl);
  return b;
}

// ------------------------------------------------------------- salamander ---

function salamander(anim: AnimName, f: number): Buf {
  const W = 24;
  const b = new Buf(W, 16);
  const BODY: Ramp = [PAL.darkRed, PAL.rust, PAL.orange, PAL.gold];
  let bx = 0;
  let hy = 0;
  let hx = 0;
  let wig = 0;
  let paws = [0, 0, 0, 0];
  let mouth: 'shut' | 'glow' | 'fire' = 'shut';
  if (anim === 'idle') {
    hy = f;
    wig = f;
  } else if (anim === 'move') {
    paws = [
      [-1, 1, 1, -1],
      [0, 0, 0, 0],
      [1, -1, -1, 1],
      [0, 0, 0, 0],
    ][f];
    wig = [1, 0, -1, 0][f];
  } else if (anim === 'attack') {
    if (f === 0) {
      bx = -1;
      hy = -2;
      hx = -1;
      mouth = 'glow';
    } else {
      bx = 1;
      hx = 1;
      hy = 0;
      mouth = 'fire';
    }
  }
  // legs (far first)
  const leg = (x: number, dx: number, far: boolean): void => {
    const c = far ? PAL.darkRed : PAL.rust;
    b.line(x + bx, 11, x + bx + dx, 13, c);
    b.set(x + bx + dx, 14, far ? PAL.darkRed : PAL.orange).set(
      x + bx + dx + 1,
      14,
      far ? PAL.darkRed : PAL.orange,
    );
  };
  leg(8, paws[0], true);
  leg(15, paws[2], true);
  // tail
  const tl = new Buf(W, 16);
  limb(tl, [7 + bx, 10], [3 + bx, 11 + wig], 3, 2, K);
  limb(tl, [3 + bx, 11 + wig], [1, 8 + wig], 2, 1, K);
  shade(tl, BODY, { rim: 0.25 });
  b.blit(tl);
  // body
  const body = layer(W, 16, BODY, (l) => {
    l.ellipse(12 + bx, 10.2, 6.4, 2.6, K);
  });
  b.blit(body);
  // belly
  for (let x = 8; x <= 16; x++) b.tint(x + bx, 12, PAL.gold);
  // head
  const hd = layer(W, 16, BODY, (l) => {
    l.ellipse(19 + bx + hx, 9 + hy, 3.2, 2.3, K);
    l.poly(
      [
        [19 + bx + hx, 8 + hy],
        [23 + bx + hx, 9 + hy],
        [22.5 + bx + hx, 11 + hy],
        [19 + bx + hx, 11 + hy],
      ],
      K,
    );
  });
  b.blit(hd);
  const X = bx + hx;
  b.set(20 + X, 8 + hy, PAL.yellow).set(21 + X, 8 + hy, INK);
  b.set(22 + X, 9 + hy, PAL.darkRed);
  if (mouth === 'shut') b.hline(20 + X, 22 + X, 10 + hy, PAL.darkRed);
  else {
    b.hline(19 + X, 22 + X, 10 + hy, INK).hline(
      20 + X,
      22 + X,
      11 + hy,
      mouth === 'fire' ? PAL.yellow : PAL.orange,
    );
    b.set(22 + X, 10 + hy, PAL.gold);
  }
  // spots
  for (const x of [9, 12, 15]) b.tint(x + bx, 9, PAL.darkRed);
  // near legs
  leg(10, paws[1], false);
  leg(17, paws[3], false);
  b.outline(INK);
  // flame crest along the back + tail tip
  const fl: Ramp = [PAL.orange, PAL.gold, PAL.yellow];
  const flick = f % 2;
  for (const [x, h] of [
    [9, 2],
    [11, 3],
    [13, 2 + flick],
    [15, 2],
  ] as const) {
    flameTongue(b, x + bx, 6, h - (x === 11 ? flick : 0), fl);
  }
  flameTongue(b, 1, 7 + wig, 2 + flick, [PAL.orange, PAL.gold, PAL.yellow]);
  b.set(0, 8 + wig, PAL.orange);
  if (mouth === 'fire') {
    b.set(23, 10, PAL.yellow).set(23, 11, PAL.gold).set(23, 9, PAL.orange);
  }
  return b;
}

// ------------------------------------------------------------------ wisps ---

interface WispPal {
  ramp: Ramp;
  core: Col;
  eye: Col;
  spark: Col;
}

const WISPS: Record<'ember_wisp' | 'hollow_wisp', WispPal> = {
  ember_wisp: {
    ramp: [PAL.rust, PAL.orange, PAL.gold, PAL.yellow],
    core: '#fff6c8',
    eye: PAL.darkRed,
    spark: PAL.gold,
  },
  hollow_wisp: {
    ramp: ['#40215e', PAL.purple, PAL.magenta, '#e8a8e0'],
    core: '#ffffff',
    eye: '#170b22',
    spark: '#e8a8e0',
  },
};

function wisp(P: WispPal, anim: AnimName, f: number): Buf {
  const b = new Buf(16, 16);
  const by = [0, -1, -1, 0][f % 4];
  let r = 3.8;
  let mouth: 'o' | 'grin' | 'roar' = 'grin';
  let dx = anim === 'move' ? 1 : 0;
  if (anim === 'attack') {
    r = f === 0 ? 3.2 : 4.4;
    mouth = f === 0 ? 'o' : 'roar';
    dx = f === 0 ? -1 : 1;
  }
  const cx = 8 + dx;
  const cy = 10 + by;
  const flame = new Buf(16, 16);
  flame.ellipse(cx, cy + 0.5, r, r, K);
  // teardrop tongue + two side licks that flicker per frame
  const tip = [-1, 0.5, 1.5, 0][f % 4] + (anim === 'move' ? -2.5 : 0);
  const th = [4, 5, 4.5, 5][f % 4] + (anim === 'attack' && f === 1 ? 0.5 : 0);
  flame.poly(
    [
      [cx - r * 0.95, cy],
      [cx + tip, cy - r - th + 2],
      [cx + r * 0.95, cy],
    ],
    K,
  );
  const lw = [0, 1, 0, -1][f % 4];
  tri(
    flame,
    [cx - r, cy + 1],
    [cx - r - 0.5 + lw * 0.5 + (anim === 'move' ? -1 : 0), cy - r - 0.5 + lw],
    [cx - r * 0.2, cy - r * 0.4],
    K,
  );
  tri(flame, [cx + r * 0.2, cy - r * 0.4], [cx + r + 0.3 - lw * 0.5, cy - r + 0.5 - lw], [cx + r, cy + 1], K);
  shade(flame, P.ramp, { lx: 0.2, ly: 1, rim: 0.15, cy: cy - 1 });
  b.blit(flame);
  // bright core
  const core = layer(
    16,
    16,
    [P.ramp[2], P.ramp[3], P.core],
    (l) => l.ellipse(cx - 0.5, cy + 0.5, r * 0.55, r * 0.55, K),
    0,
  );
  b.blitClip(core);
  // face (looking right)
  const e = P.eye;
  b.set(cx, cy - 1, e)
    .set(cx, cy, e)
    .set(cx + 2, cy - 1, e)
    .set(cx + 2, cy, e);
  if (mouth === 'grin') b.set(cx + 1, cy + 2, e);
  else if (mouth === 'o') b.set(cx + 1, cy + 2, e).set(cx + 1, cy + 1, e);
  else b.rect(cx, cy + 1, 3, 2, e).set(cx + 1, cy + 2, P.ramp[0]);
  b.outline((n) => mix(n, INK, 0.7));
  // sparks
  const sp = [
    [3, 3],
    [13, 4],
    [2, 12],
    [14, 11],
  ][f % 4];
  b.set(sp[0], sp[1] + by, P.spark);
  return b;
}

// ------------------------------------------------------------------- yeti ---

function yeti(anim: AnimName, f: number): Buf {
  const W = 24;
  const b = new Buf(W, 24);
  const FUR: Ramp = [PAL.gray, PAL.lightGray, '#e8eef6', PAL.white];
  const SKIN: Ramp = [PAL.darkSlate, PAL.slate, PAL.gray];
  let by = 0;
  let bx = 0;
  let lifts = [0, 0];
  let hands: [Pt, Pt] = [
    [8, 19],
    [15, 19],
  ];
  let mouth: 'shut' | 'roar' = 'shut';
  if (anim === 'idle') by = f;
  else if (anim === 'move') {
    lifts = [
      [0, 0],
      [2, 0],
      [0, 0],
      [0, 2],
    ][f];
    by = f % 2 ? -1 : 0;
    bx = f === 1 ? 1 : f === 3 ? -1 : 0;
    hands = [
      [8 + (f === 1 ? -1 : 1), 19],
      [15 + (f === 1 ? 1 : -1), 19],
    ];
  } else if (anim === 'attack') {
    if (f === 0) {
      by = -1;
      bx = -1;
      hands = [
        [6, 4],
        [13, 3],
      ];
      mouth = 'roar';
    } else {
      by = 1;
      bx = 1;
      hands = [
        [16, 20],
        [20, 20],
      ];
      mouth = 'roar';
    }
  }
  // legs
  const leg = (x: number, lift: number, far: boolean): void => {
    b.blit(layer(W, 24, far ? [PAL.slate, PAL.gray] : FUR, (l) => l.rect(x, 18 - lift, 4, 5, K)));
    b.hline(x, x + 3, 22 - lift, far ? PAL.darkSlate : PAL.slate);
  };
  leg(7, lifts[0], true);
  leg(12, lifts[1], false);
  const arm = (sh: Pt, h: Pt, far: boolean): void => {
    const l = new Buf(W, 24);
    limb(l, sh, h, 4, 3, K);
    l.ellipse(h[0] + 0.5, h[1] + 0.5, 2.2, 2, K);
    shade(l, far ? [PAL.slate, PAL.gray, PAL.lightGray] : FUR, { rim: 0.3 });
    if (far) b.blit(l);
    else b.overlay(l, PAL.slate, 'all');
    b.set(h[0] + 1, h[1] + 1, SKIN[1]).set(h[0], h[1] + 1, SKIN[1]);
  };
  arm([8 + bx, 10 + by], hands[0], true);
  // body
  const body = layer(W, 24, FUR, (l) => {
    l.ellipse(11.5 + bx, 12.5 + by, 7, 6.6, K);
    l.ellipse(13 + bx, 6.5 + by, 4.6, 4, K);
  });
  b.blit(body);
  // shaggy fur tufts on the silhouette
  for (const [x, y] of [
    [5, 9],
    [4, 12],
    [5, 16],
    [9, 3],
    [11, 2],
    [18, 11],
  ] as const) {
    b.set(x + bx, y + by, FUR[1]);
  }
  // face
  const face = layer(W, 24, SKIN, (l) => l.ellipse(15.5 + bx, 7.5 + by, 2.6, 2.4, K), 0.2);
  b.blit(face);
  const X = bx;
  const Y = by;
  b.set(15 + X, 6 + Y, INK)
    .set(17 + X, 6 + Y, INK)
    .set(15 + X, 5 + Y, FUR[0])
    .set(16 + X, 5 + Y, FUR[0])
    .set(17 + X, 5 + Y, FUR[0]);
  if (mouth === 'shut') b.hline(15 + X, 17 + X, 9 + Y, INK);
  else {
    b.rect(15 + X, 8 + Y, 3, 2, INK);
    b.set(15 + X, 8 + Y, '#ffffff')
      .set(17 + X, 8 + Y, '#ffffff')
      .set(16 + X, 9 + Y, PAL.darkRed);
  }
  // horns
  b.set(10 + X, 3 + Y, PAL.tan)
    .set(9 + X, 2 + Y, PAL.sand)
    .set(8 + X, 2 + Y, PAL.sand);
  arm([12 + bx, 10 + by], hands[1], false);
  b.outline(INK);
  return b;
}

// ------------------------------------------------------------ frost wraith ---

function frostWraith(anim: AnimName, f: number): Buf {
  const b = new Buf(16, 24);
  const ROBE: Ramp = [PAL.blue, PAL.sky, '#8fe0f5', '#e9fdff'];
  const by = [1, 0, 0, 1][f % 4];
  let hands: 'rest' | 'back' | 'swipe' | 'raise' = 'rest';
  let lean = anim === 'move' ? 1 : 0;
  if (anim === 'attack') {
    hands = f === 0 ? 'back' : 'swipe';
    lean = f === 0 ? -1 : 1;
  }
  if (anim === 'cast') hands = 'raise';
  const fl = f % 2;
  // robe body (tapering, tattered bottom)
  const robe = new Buf(16, 24);
  robe.poly(
    [
      [5 + lean, 8 + by],
      [11 + lean, 8 + by],
      [12.5 + lean, 15 + by],
      [11, 19 + by],
      [9.5 - fl, 21 + by],
      [8, 19.5 + by],
      [6.5 - fl, 21.5 + by],
      [5.5, 18.5 + by],
      [3 - fl, 20 + by],
      [4 + lean, 14 + by],
    ],
    K,
  );
  shade(robe, ROBE, { rim: 0.25 });
  b.blit(robe);
  // hood
  const hood = layer(16, 24, ROBE, (l) => {
    l.ellipse(8.5 + lean, 6.5 + by, 4.2, 4.3, K);
    l.poly(
      [
        [5 + lean, 3.5 + by],
        [3 + lean, 2 + by],
        [6 + lean, 3 + by],
      ],
      K,
    );
  });
  b.blit(hood);
  // face void + eyes
  const X = lean;
  const Y = by;
  b.rect(9 + X, 5 + Y, 3, 4, PAL.navy);
  b.set(12 + X, 6 + Y, PAL.navy)
    .set(12 + X, 7 + Y, PAL.navy)
    .set(9 + X, 8 + Y, INK)
    .set(10 + X, 8 + Y, INK);
  b.set(10 + X, 6 + Y, PAL.cyan)
    .set(12 + X, 6 + Y, PAL.cyan)
    .set(11 + X, 6 + Y, INK);
  // hood rim highlight
  b.set(9 + X, 4 + Y, '#e9fdff')
    .set(10 + X, 4 + Y, '#e9fdff')
    .set(11 + X, 4 + Y, '#8fe0f5');
  // ice claws
  const claw = (x: number, y: number): void => {
    b.set(x, y, PAL.cyan)
      .set(x + 1, y, '#ffffff')
      .set(x + 1, y + 1, PAL.cyan)
      .set(x, y + 1, PAL.sky);
  };
  if (hands === 'rest') {
    b.line(10 + X, 11 + Y, 12 + X, 13 + Y, PAL.sky);
    claw(12 + X, 13 + Y);
  } else if (hands === 'back') {
    b.line(7 + X, 11 + Y, 4 + X, 10 + Y, PAL.sky);
    claw(2, 9 + Y);
  } else if (hands === 'swipe') {
    b.line(10 + X, 11 + Y, 12 + X, 10 + Y, PAL.sky);
    claw(12 + X, 9 + Y);
  } else {
    b.line(7 + X, 10 + Y, 5 + X, 7 + Y, PAL.sky).line(11 + X, 10 + Y, 13 + X, 7 + Y, PAL.sky);
    claw(4 + X, 5 + Y);
    claw(13 + X, 5 + Y);
  }
  b.outline((n) => mix(n, INK, 0.75));
  if (hands === 'raise') {
    // ice crystal forming overhead
    const c = f === 0 ? 1 : 2;
    const cx = 9 + X;
    b.set(cx, 1 + Y - c + 1, '#ffffff');
    for (let i = 0; i <= c; i++)
      b.set(cx - i, 2 + Y + i - c + 1, PAL.cyan).set(cx + i, 2 + Y + i - c + 1, PAL.sky);
    b.set(cx, 3 + Y, '#ffffff');
  }
  // snow motes
  b.set(fl ? 2 : 14, 16 + by, '#e9fdff').set(fl ? 13 : 1, 12 + by, PAL.cyan);
  return b;
}

// ----------------------------------------------------------- shadow knight ---

function shadowKnight(anim: AnimName, f: number): Buf {
  const b = new Buf(16, 24);
  const ARM: Ramp = [INK, PAL.navy, PAL.darkSlate, PAL.slate];
  const GLOW = PAL.magenta;
  let bob = 0;
  let lifts = [0, 0];
  let sword: 'rest' | 'raise' | 'swing' = 'rest';
  let lean = 0;
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
  }
  // cape
  const cape = new Buf(16, 24);
  cape.poly(
    [
      [5 + lean, 10 + bob],
      [8 + lean, 10 + bob],
      [6, 21],
      [4.5, 20],
      [3, 21.5],
      [2.5 - (anim === 'move' ? f % 2 : 0), 18],
    ],
    K,
  );
  shade(cape, ['#1f1030', PAL.purple, PAL.magenta], { rim: 0.2 });
  b.blit(cape);
  // legs
  const leg = (x: number, lift: number, far: boolean): void => {
    b.blit(layer(16, 24, far ? [INK, PAL.navy] : ARM, (l) => l.rect(x, 17, 2, 6 - lift, K)));
    b.set(x + 2, 22 - lift, far ? INK : PAL.navy);
  };
  leg(6, lifts[0], true);
  leg(8, lifts[1], false);
  // torso
  b.blit(
    layer(16, 24, ARM, (l) => {
      l.rect(5 + lean, 10 + bob, 6, 7, K);
      l.rect(4 + lean, 10 + bob, 8, 2, K);
    }),
  );
  b.hline(5 + lean, 10 + lean, 16 + bob, PAL.purple);
  b.set(9 + lean, 12 + bob, GLOW).set(9 + lean, 13 + bob, PAL.purple);
  // helmet
  b.blit(
    layer(16, 24, ARM, (l) => {
      l.ellipse(8.5 + lean, 6 + bob, 3.6, 3.8, K);
      l.rect(6 + lean, 7 + bob, 6, 3, K);
    }),
  );
  const X = lean;
  const Y = bob;
  // horns
  b.set(6 + X, 2 + Y, PAL.darkSlate)
    .set(5 + X, 1 + Y, PAL.slate)
    .set(10 + X, 2 + Y, PAL.darkSlate)
    .set(11 + X, 1 + Y, PAL.slate);
  // visor slit glow
  b.hline(9 + X, 12 + X, 6 + Y, INK)
    .set(10 + X, 6 + Y, PAL.pink)
    .set(12 + X, 6 + Y, GLOW);
  b.set(10 + X, 7 + Y, PAL.purple);
  // greatsword
  const BL: Ramp = [PAL.navy, PAL.darkSlate, PAL.gray];
  const big = (x0: number, y0: number, x1: number, y1: number, glowSide: number): void => {
    b.line(x0, y0, x1, y1, BL[1], 2);
    b.line(x0, y0, x1, y1, BL[2]);
    b.line(x0 + glowSide, y0, x1 + glowSide, y1, PAL.purple);
    b.set(x1, y1, PAL.pink);
  };
  if (sword === 'rest') {
    big(12 + X, 14 + Y, 12 + X, 3 + Y, 2);
    b.hline(10 + X, 14 + X, 15 + Y, PAL.slate).set(12 + X, 15 + Y, GLOW);
    b.set(12 + X, 16 + Y, PAL.purple).set(12 + X, 17 + Y, PAL.navy);
    b.set(11 + X, 16 + Y, PAL.darkSlate);
  } else if (sword === 'raise') {
    big(7 + X, 7, 3 + X, 2, -1);
    b.line(8 + X, 11, 8 + X, 8, PAL.darkSlate).line(6 + X, 9, 9 + X, 6, PAL.slate);
  } else {
    big(12, 14, 13, 21, -1);
    b.line(9 + X, 12, 11, 12, PAL.darkSlate).line(10, 13, 13, 12, PAL.slate);
  }
  b.outline(INK);
  if (sword === 'swing') {
    for (const [x, y] of [
      [14, 9],
      [15, 11],
      [15, 13],
    ] as const)
      b.set(x, y, '#b55088c0');
  }
  return b;
}

// --------------------------------------------------------------- void mage ---

function voidMage(anim: AnimName, f: number): Buf {
  const b = new Buf(16, 24);
  const ROBE: Ramp = ['#1c0f2a', '#3a1f4f', PAL.purple, PAL.magenta];
  const by = anim === 'idle' || anim === 'cast' ? [0, -1, -1, 0][f % 4] : 0;
  let orb: Pt = [12, 13];
  let orbR = 1.6;
  let lean = 0;
  if (anim === 'move') lean = 1;
  if (anim === 'attack') {
    orb = f === 0 ? [11, 12] : [12, 11];
    orbR = f === 0 ? 1.6 : 2;
    lean = f === 0 ? -1 : 1;
  }
  if (anim === 'cast') {
    orb = [10, 5];
    orbR = f === 0 ? 1.8 : 2.3;
  }
  const sway = anim === 'move' ? (f % 2 ? 1 : -1) : 0;
  // robe
  const robe = new Buf(16, 24);
  robe.poly(
    [
      [6 + lean, 9 + by],
      [10.5 + lean, 9 + by],
      [12.5 + sway, 22],
      [3 + sway, 22],
    ],
    K,
  );
  shade(robe, ROBE, { rim: 0.25 });
  b.blit(robe);
  // hem runes
  for (const x of [5, 8, 11]) b.set(x + sway, 21, PAL.magenta);
  b.vline(9 + lean, 12 + by, 21, '#1c0f2a');
  // hood
  b.blit(
    layer(16, 24, ROBE, (l) => {
      l.ellipse(8.4 + lean, 6.5 + by, 3.8, 4.2, K);
      tri(l, [5 + lean, 5 + by], [6.5 + lean, 1.8 + by], [9 + lean, 3 + by], K);
    }),
  );
  const X = lean;
  const Y = by;
  b.rect(9 + X, 6 + Y, 3, 3, INK);
  b.set(12 + X, 7 + Y, INK);
  b.set(10 + X, 7 + Y, PAL.pink).set(12 + X, 7 + Y, PAL.magenta);
  // sleeve + hand to orb
  const handFrom: Pt = [9 + X, 12 + Y];
  b.line(handFrom[0], handFrom[1], orb[0] - 1, orb[1] + 1 + (anim === 'cast' ? 0 : Y), PAL.purple);
  b.outline(INK);
  // orb with glow (drawn after outline so the halo is soft)
  const oy = orb[1] + (anim === 'cast' ? 0 : Y);
  const halo = new Buf(16, 24).ellipse(orb[0] + 0.5, oy + 0.5, orbR + 1.2, orbR + 1.2, '#b5508855');
  b.blit(halo);
  const o = layer(
    16,
    24,
    [PAL.purple, PAL.magenta, PAL.pink, '#ffffff'],
    (l) => l.ellipse(orb[0] + 0.5, oy + 0.5, orbR, orbR, K),
    0.2,
  );
  b.blit(o);
  b.set(orb[0], oy, '#ffffff');
  if (anim === 'cast' && f === 1) {
    for (const [x, y] of [
      [6, 1],
      [14, 2],
      [7, 6],
      [13, 6],
    ] as const)
      b.set(x, y, PAL.pink);
  }
  return b;
}

// ---------------------------------------------------------------- gargoyle ---

function gargoyle(anim: AnimName, f: number): Buf {
  const W = 24;
  const b = new Buf(W, 24);
  const STONE: Ramp = [PAL.darkSlate, PAL.slate, PAL.gray, PAL.lightGray];
  let by = 0;
  let bx = 0;
  let wing: 'fold' | 'up' | 'mid' | 'spread' = 'fold';
  let pose: 'crouch' | 'rear' | 'dive' = 'crouch';
  if (anim === 'idle') {
    by = f;
    wing = f ? 'fold' : 'mid';
  } else if (anim === 'move') {
    wing = (['up', 'mid', 'spread', 'mid'] as const)[f];
    by = [-1, -1, 0, -1][f];
  } else if (anim === 'attack') {
    if (f === 0) {
      wing = 'spread';
      pose = 'rear';
      by = -1;
      bx = 0;
    } else {
      wing = 'up';
      pose = 'dive';
      bx = 2;
      by = 1;
    }
  }
  // wings (behind)
  const WP: Record<typeof wing, Pt[]> = {
    fold: [
      [8, 9],
      [4, 4],
      [6, 3],
      [10, 8],
    ],
    mid: [
      [8, 9],
      [2, 4],
      [1, 8],
      [3, 8],
      [4, 11],
      [7, 11],
    ],
    up: [
      [9, 9],
      [4, 2.2],
      [2, 3],
      [2, 6],
      [4, 6],
      [5, 9],
      [8, 11],
    ],
    spread: [
      [9, 9],
      [1.6, 3],
      [1.3, 10],
      [2.5, 9],
      [3.5, 12],
      [5.5, 11],
      [7, 13],
    ],
  };
  const wl = new Buf(W, 24);
  wl.poly(
    WP[wing].map(([x, y]) => [Math.max(1.3, x + bx), Math.max(1.3, y + by)] as Pt),
    K,
  );
  // second wing peeking on the other side
  wl.poly(
    WP[wing].map(([x, y]) => [x + bx + 5, Math.max(1.3, y + by - 1)] as Pt),
    K,
  );
  shade(wl, [PAL.navy, PAL.darkSlate, PAL.slate], { rim: 0.2 });
  b.blit(wl);
  // legs (crouched, clawed)
  const legs = layer(W, 24, STONE, (l) => {
    if (pose === 'dive') {
      l.rect(8 + bx, 15 + by, 3, 4, K);
      l.rect(11 + bx, 16 + by, 3, 3, K);
    } else {
      l.ellipse(9.5 + bx, 18.5 + by * 0, 2.6, 3, K);
      l.rect(8 + bx, 19, 4, 3, K);
      l.ellipse(14.5 + bx, 18.5, 2.4, 2.8, K);
      l.rect(14 + bx, 19, 3, 3, K);
    }
  });
  b.blit(legs);
  if (pose !== 'dive') {
    b.set(12 + bx, 22, PAL.gray)
      .set(17 + bx, 22, PAL.gray)
      .set(18 + bx, 22, PAL.slate);
  }
  // torso
  b.blit(
    layer(W, 24, STONE, (l) => {
      l.ellipse(12 + bx, 13 + by, 4.5, 5, K);
    }),
  );
  // tail
  b.line(8 + bx, 17 + by, 4 + bx, 20, PAL.slate).line(4 + bx, 20, 2 + bx, 19, PAL.slate);
  b.set(1 + bx, 18, PAL.gray)
    .set(1 + bx, 19, PAL.slate)
    .set(2 + bx, 20, PAL.slate);
  // head
  const hx = bx + (pose === 'dive' ? 1 : 0);
  const hy = by + (pose === 'dive' ? 3 : 0);
  b.blit(
    layer(W, 24, STONE, (l) => {
      l.ellipse(15.5 + hx, 7 + hy, 3.2, 2.8, K);
      l.poly(
        [
          [16 + hx, 6 + hy],
          [20.5 + hx, 7 + hy],
          [20 + hx, 9.5 + hy],
          [16 + hx, 9.5 + hy],
        ],
        K,
      );
    }),
  );
  // horns + ear
  b.line(14 + hx, 5 + hy, 12 + hx, 2 + hy, PAL.gray).set(12 + hx, 1 + hy, PAL.lightGray);
  b.line(16 + hx, 4 + hy, 16 + hx, 2 + hy, PAL.slate).set(17 + hx, 1 + hy, PAL.gray);
  // eyes
  b.set(17 + hx, 6 + hy, PAL.orange)
    .set(18 + hx, 6 + hy, PAL.yellow)
    .set(17 + hx, 5 + hy, PAL.darkSlate)
    .set(18 + hx, 5 + hy, PAL.darkSlate);
  // fangs
  b.hline(17 + hx, 20 + hx, 8 + hy, INK);
  b.set(17 + hx, 9 + hy, '#ffffff')
    .set(18 + hx, 9 + hy, PAL.slate)
    .set(19 + hx, 9 + hy, '#ffffff')
    .set(20 + hx, 9 + hy, PAL.slate);
  // arm + claws
  if (pose === 'rear') {
    b.line(14 + bx, 11 + by, 18 + bx, 6 + by, PAL.gray);
    b.set(19 + bx, 5 + by, PAL.lightGray)
      .set(19 + bx, 6 + by, PAL.gray)
      .set(20 + bx, 4 + by, '#ffffff');
  } else if (pose === 'dive') {
    b.line(14 + bx, 13 + by, 20, 15, PAL.gray);
    b.set(21, 15, PAL.gray).set(22, 14, '#ffffff').set(22, 16, PAL.lightGray);
  } else {
    b.line(14 + bx, 12 + by, 16 + bx, 16 + by, PAL.gray)
      .set(17 + bx, 17 + by, PAL.lightGray)
      .set(16 + bx, 17 + by, PAL.lightGray);
  }
  // cracks / chips
  b.tint(11 + bx, 12 + by, PAL.darkSlate)
    .tint(12 + bx, 13 + by, PAL.darkSlate)
    .tint(10 + bx, 15 + by, PAL.darkSlate);
  b.outline(INK);
  return b;
}

// ------------------------------------------------------------------- defs ---

function side(
  info: Omit<SpriteDef['info'], 'dirs'>,
  fn: (anim: AnimName, f: number) => Buf,
  dirs: 1 | 2 = 2,
): SpriteDef {
  return { info: { ...info, dirs }, draw: (anim, f) => fn(anim, f) };
}

const BIG = { w: 24, h: 24, anchorX: 12, anchorY: 23 } as const;
const SMALL = { w: 16, h: 16, anchorX: 8, anchorY: 15 } as const;
const TALL = { w: 16, h: 24, anchorX: 8, anchorY: 23 } as const;

export const CREATURE_B_DEFS: Partial<Record<CreatureId, SpriteDef>> = {
  golem: side({ ...BIG, anims: anims({ idle: [2, 2], move: [4, 5], attack: [2, 3] }) }, (a, f) =>
    golem(GOLEMS.golem, a, f),
  ),
  golem_ice: side({ ...BIG, anims: anims({ idle: [2, 2], move: [4, 5], attack: [2, 3] }) }, (a, f) =>
    golem(GOLEMS.golem_ice, a, f),
  ),
  fire_imp: side(
    { ...SMALL, anims: anims({ idle: [4, 6], move: [4, 8], attack: [2, 6], cast: [2, 4] }) },
    fireImp,
  ),
  salamander: side(
    { w: 24, h: 16, anchorX: 12, anchorY: 15, anims: anims({ idle: [2, 3], move: [4, 8], attack: [2, 5] }) },
    salamander,
  ),
  ember_wisp: side({ ...SMALL, anims: anims({ idle: [4, 8], move: [4, 10], attack: [2, 5] }) }, (a, f) =>
    wisp(WISPS.ember_wisp, a, f),
  ),
  hollow_wisp: side({ ...SMALL, anims: anims({ idle: [4, 8], move: [4, 10], attack: [2, 5] }) }, (a, f) =>
    wisp(WISPS.hollow_wisp, a, f),
  ),
  yeti: side({ ...BIG, anims: anims({ idle: [2, 2], move: [4, 6], attack: [2, 3] }) }, yeti),
  frost_wraith: side(
    { ...TALL, anims: anims({ idle: [4, 5], move: [4, 6], attack: [2, 5], cast: [2, 3] }) },
    frostWraith,
  ),
  shadow_knight: side(
    { ...TALL, anims: anims({ idle: [2, 2], move: [4, 6], attack: [2, 4] }) },
    shadowKnight,
  ),
  void_mage: side(
    { ...TALL, anims: anims({ idle: [4, 4], move: [4, 6], attack: [2, 4], cast: [2, 3] }) },
    voidMage,
  ),
  gargoyle: side({ ...BIG, anims: anims({ idle: [2, 2], move: [4, 8], attack: [2, 4] }) }, gargoyle),
};
