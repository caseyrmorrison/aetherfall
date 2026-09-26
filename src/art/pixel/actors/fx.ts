/**
 * Projectiles (image points RIGHT, anchor = centre, anim 'fly') and one-shot
 * effects (anchor = centre, anim 'fly' played once).
 */
import { PAL } from '../../palette';
import type { AnimName, FxId, ProjectileId } from '../types';
import { alpha, Buf, h2, INK, mix, shade, type Col, type Pt, type Ramp } from './buf';
import { anims, type SpriteDef } from './defs';
import { rng } from './shapes';

const K = '#000000';

function orb(b: Buf, cx: number, cy: number, r: number, ramp: Ramp, rim = 0.2): void {
  const l = new Buf(b.w, b.h).ellipse(cx, cy, r, r, K);
  shade(l, ramp, { rim });
  b.blit(l);
}

// ------------------------------------------------------------ projectiles ---

function arrow(): Buf {
  const b = new Buf(12, 5);
  b.hline(3, 9, 2, PAL.brown).set(9, 2, PAL.darkBrown);
  // head
  b.set(10, 1, PAL.gray).set(10, 2, PAL.lightGray).set(10, 3, PAL.gray).set(11, 2, '#ffffff');
  // fletching
  b.set(1, 1, PAL.red)
    .set(2, 1, PAL.pink)
    .set(1, 3, PAL.red)
    .set(2, 3, PAL.darkRed)
    .set(1, 2, PAL.sand)
    .set(2, 2, PAL.brown);
  return b.outline(INK);
}

function fireball(f: number): Buf {
  const b = new Buf(12, 9);
  const r = rng(f + 1);
  // trailing flames (to the left), flickering per frame
  const tail = new Buf(12, 9);
  const wob = [0, 1, 0, -1][f % 4];
  tail.poly(
    [
      [6, 1.5],
      [1 - (f % 2), 3 + wob * 0.5],
      [3, 4.5],
      [0.5 + (f % 2), 6 - wob * 0.5],
      [6, 7.5],
    ],
    K,
  );
  tail.each((_c, x, y) => {
    const t = x / 7 + (r() - 0.5) * 0.25;
    tail.set(x, y, t < 0.35 ? PAL.darkRed : t < 0.6 ? PAL.rust : PAL.orange);
  });
  b.blit(tail);
  orb(b, 7.5, 4.5, 3.4, [PAL.rust, PAL.orange, PAL.gold, PAL.yellow], 0.1);
  b.set(8, 3, '#fffbe0').set(9, 3, '#ffffff').set(8, 4, PAL.yellow);
  b.outline((n) => mix(n, INK, 0.55));
  // loose embers
  b.set(0, f % 2 ? 1 : 7, PAL.gold);
  return b;
}

function iceshard(f: number): Buf {
  const b = new Buf(12, 5);
  b.poly(
    [
      [2, 2],
      [5, 0.5],
      [11.5, 2.5],
      [5, 4.5],
    ],
    K,
  );
  b.each((_c, x, y) => b.set(x, y, y < 2 ? '#e6fcff' : y === 2 ? PAL.cyan : PAL.sky));
  b.set(10, 2, '#ffffff');
  b.outline(PAL.blue);
  b.set(0, 2, alpha(PAL.cyan, 0.6));
  if (f === 1) b.set(6, 1, '#ffffff').set(1, 1, alpha('#ffffff', 0.7));
  return b;
}

function magicOrb(f: number): Buf {
  const b = new Buf(9, 9);
  const r = f % 2 ? 3.1 : 2.7;
  b.ellipse(4.5, 4.5, r + 1.1, r + 1.1, alpha(PAL.magenta, 0.35));
  orb(b, 4.5, 4.5, r, [PAL.purple, PAL.magenta, PAL.pink, '#ffffff'], 0.2);
  b.set(3, 3, '#ffffff');
  const sp: Pt[] = [
    [0, 4],
    [4, 0],
    [8, 4],
    [4, 8],
  ];
  const [x, y] = sp[f % 4];
  b.set(x, y, PAL.pink);
  return b;
}

function voidOrb(f: number): Buf {
  const b = new Buf(11, 11);
  b.ellipse(5.5, 5.5, 5.5, 5.5, alpha(PAL.purple, 0.45));
  b.ellipse(5.5, 5.5, 4.6, 4.6, alpha(PAL.magenta, 0.35));
  orb(b, 5.5, 5.5, 3.5, ['#12091c', '#2b1440', PAL.purple], 0.1);
  // swirling rim
  const a0 = (f / 4) * Math.PI * 2;
  for (let i = 0; i < 3; i++) {
    const a = a0 + (i / 3) * Math.PI * 2;
    b.set(5.5 + Math.cos(a) * 3.2, 5.5 + Math.sin(a) * 3.2, PAL.magenta);
    b.set(5.5 + Math.cos(a + 0.5) * 3.2, 5.5 + Math.sin(a + 0.5) * 3.2, PAL.pink);
  }
  b.set(5, 5, '#170b22').set(4, 4, PAL.pink);
  return b;
}

function seed(f: number): Buf {
  const b = new Buf(6, 6);
  const s = new Buf(6, 6);
  s.ellipse(3, 3, 2.2, 1.6, K);
  shade(s, [PAL.darkBrown, PAL.brown, PAL.tan], { rim: 0.3 });
  const rot = s.rot90(f % 4);
  b.blit(rot);
  const tipPts: Pt[] = [
    [5, 2],
    [3, 5],
    [0, 3],
    [2, 0],
  ];
  const [x, y] = tipPts[f % 4];
  b.set(x, y, PAL.green);
  return b.outline(INK);
}

function rock(f: number): Buf {
  const r = new Buf(9, 9);
  r.poly(
    [
      [1.5, 3],
      [4, 1],
      [7.5, 2],
      [8, 6],
      [5, 8],
      [1, 6.5],
    ],
    K,
  );
  shade(r, [PAL.darkSlate, PAL.slate, PAL.gray, PAL.lightGray], { rim: 0.3 });
  r.set(4, 5, PAL.darkSlate).set(5, 4, PAL.darkSlate);
  const b = r.rot90(f % 4);
  // lighting stays top-left after rotation
  shade(b, [PAL.darkSlate, PAL.slate, PAL.gray, PAL.lightGray], { rim: 0.35 });
  const cr: Pt[] = [
    [4, 5],
    [4, 4],
    [5, 4],
    [5, 5],
  ];
  b.tint(cr[f % 4][0], cr[f % 4][1], PAL.darkSlate);
  return b.outline(INK);
}

function snowball(f: number): Buf {
  const b = new Buf(8, 8);
  orb(b, 4, 4, 2.9, [PAL.gray, PAL.lightGray, '#eef6ff', '#ffffff'], 0.3);
  b.outline(PAL.slate);
  if (f === 1) b.set(0, 3, alpha('#ffffff', 0.6));
  else b.set(0, 5, alpha('#ffffff', 0.6));
  return b;
}

function bolt(f: number): Buf {
  const b = new Buf(10, 5);
  const len = [8, 9, 7][f % 3];
  for (let x = 9 - len; x <= 9; x++) {
    const t = (x - (9 - len)) / len;
    b.set(x, 2, t > 0.6 ? '#ffffff' : t > 0.3 ? PAL.cyan : alpha(PAL.cyan, 0.6));
    if (t > 0.35)
      b.set(x, 1, t > 0.7 ? PAL.cyan : alpha(PAL.sky, 0.8)).set(
        x,
        3,
        t > 0.7 ? PAL.cyan : alpha(PAL.sky, 0.8),
      );
  }
  b.set(9, 1, alpha(PAL.cyan, 0.6)).set(9, 3, alpha(PAL.cyan, 0.6));
  // zig spark
  const zx = [3, 5, 2][f % 3];
  b.set(zx, f % 2 ? 0 : 4, PAL.cyan);
  return b;
}

function crystalShard(f: number): Buf {
  const b = new Buf(10, 7);
  b.poly(
    [
      [0.6, 3.5],
      [3.5, 1.6],
      [9.8, 3.5],
      [3.5, 5.4],
    ],
    K,
  );
  b.each((_c, x, y) =>
    b.set(
      x,
      y,
      y < 3 ? (x < 4 ? PAL.sky : PAL.cyan) : y === 3 ? '#c9fbff' : x < 5 ? PAL.purple : PAL.magenta,
    ),
  );
  b.set(8, 3, '#ffffff').set(5, 2, '#ffffff');
  b.outline(INK);
  if (f === 1) b.set(6, 0, PAL.cyan).set(0, 1, alpha(PAL.pink, 0.7));
  else b.set(2, 6, alpha(PAL.cyan, 0.7));
  return b;
}

// Act II projectiles --------------------------------------------------------

/** A whirling ball of sand: spiral streaks spin through it, grit trails behind. */
function sandBall(f: number): Buf {
  const b = new Buf(12, 10);
  const cx = 7.5;
  const cy = 5;
  orb(b, cx, cy, 3.4, [PAL.brown, PAL.tan, PAL.sand, '#f6e7c8'], 0.25);
  // two spiral arms, a quarter turn per frame
  for (let arm = 0; arm < 2; arm++) {
    const a0 = (f / 4) * Math.PI * 2 + arm * Math.PI;
    for (let r = 0.6; r <= 3.4; r += 0.35) {
      const a = a0 + r * 1.1;
      b.tint(cx + Math.cos(a) * r, cy + Math.sin(a) * r, r > 2.4 ? PAL.darkBrown : PAL.brown);
    }
  }
  b.set(6, 3, '#fff4dc');
  b.outline((n) => mix(n, INK, 0.55));
  // grit streaming behind and orbiting grains
  const r = rng(f + 11);
  for (let i = 0; i < 6; i++) {
    const x = Math.floor(r() * 4);
    const y = 2 + Math.floor(r() * 6);
    if (!b.has(x, y)) b.set(x, y, alpha(i % 2 ? PAL.tan : PAL.sand, 0.55 + x * 0.1));
  }
  const oa = (f / 4) * Math.PI * 2;
  b.set(cx + Math.cos(oa) * 5, cy + Math.sin(oa) * 4.2, PAL.sand);
  return b;
}

/** A wobbling, translucent orb of seawater. */
function bubble(f: number): Buf {
  const b = new Buf(10, 10);
  const rx = [4.1, 4.4, 4.1, 3.8][f % 4];
  const ry = [4.1, 3.8, 4.1, 4.4][f % 4];
  b.ellipse(5, 5, rx, ry, alpha(PAL.sky, 0.55));
  b.ellipse(5.6, 5.8, rx - 1.8, ry - 1.8, alpha(PAL.cyan, 0.35));
  // thin rim: dark along the top-left, catching light along the bottom-right
  const rim = new Buf(10, 10).ellipse(5, 5, rx, ry, K);
  rim.each((_c, x, y) => {
    const edge = !rim.has(x - 1, y) || !rim.has(x + 1, y) || !rim.has(x, y - 1) || !rim.has(x, y + 1);
    if (!edge) return;
    const lit = x + y > 10;
    b.set(x, y, lit ? alpha('#c9fbff', 0.95) : alpha(PAL.blue, 0.85));
  });
  // specular highlight
  b.set(3, 3, '#ffffff').set(4, 2, alpha('#ffffff', 0.9)).set(2, 4, alpha('#ffffff', 0.7));
  b.set(6 + (f % 2), 7 - (f % 2), alpha('#ffffff', 0.6));
  return b;
}

/** A crackling ball of lightning with arcs jumping off it. */
function lightningBall(f: number): Buf {
  const b = new Buf(12, 12);
  const c = 6;
  b.ellipse(c, c, 4.2, 4.2, alpha(PAL.sky, 0.3));
  b.ellipse(c, c, 3, 3, alpha(PAL.cyan, 0.6));
  b.ellipse(c, c, 2, 2, '#c9fbff');
  b.ellipse(c, c, 1.2, 1.2, '#ffffff');
  const r = rng(f * 7 + 3);
  for (let i = 0; i < 3; i++) {
    const a = r() * Math.PI * 2;
    let x = c + Math.cos(a) * 1.5;
    let y = c + Math.sin(a) * 1.5;
    for (let k = 0; k < 4; k++) {
      const aa = a + (r() - 0.5) * 1.6;
      const nx = x + Math.cos(aa) * 1.4;
      const ny = y + Math.sin(aa) * 1.4;
      for (const [px, py] of Buf.linePts(x, y, nx, ny)) {
        b.set(px, py, k < 2 ? '#ffffff' : PAL.cyan);
      }
      x = nx;
      y = ny;
    }
  }
  // stray spark trailing behind
  b.set(1, f % 2 ? 4 : 8, PAL.cyan).set(0, f % 2 ? 5 : 7, alpha(PAL.cyan, 0.6));
  return b;
}

/** A bolt of the black sun: a dark core in a gold corona, trailing flame. */
function sunbolt(f: number): Buf {
  const b = new Buf(14, 10);
  const cx = 9;
  const cy = 5;
  // trailing flare
  const tail = new Buf(14, 10);
  const wob = [0, 0.5, 0, -0.5][f % 4];
  tail.poly(
    [
      [cx - 1, cy - 3.2],
      [1 - (f % 2), cy - 1.2 + wob],
      [3, cy],
      [0.5 + (f % 2), cy + 1.2 + wob],
      [cx - 1, cy + 3.2],
    ],
    K,
  );
  tail.each((_c, x, y) => {
    const t = x / cx;
    tail.set(x, y, t < 0.3 ? alpha(PAL.orange, 0.6) : t < 0.6 ? PAL.gold : PAL.yellow);
    if (Math.abs(y + 0.5 - cy) < 0.8 && t > 0.3) tail.set(x, y, '#fffbe0');
  });
  b.blit(tail);
  // corona and rays
  b.ellipse(cx, cy, 3.9, 3.9, PAL.gold);
  b.ring(cx, cy, 3.9, 0.9, PAL.yellow);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + f * 0.26;
    b.set(cx + Math.cos(a) * 4.6, cy + Math.sin(a) * 4.6, i % 2 ? PAL.yellow : '#ffffff');
  }
  // the dark disc
  b.ellipse(cx, cy, 2.6, 2.6, INK);
  b.ellipse(cx - 0.3, cy - 0.3, 1.6, 1.6, '#0d0a14');
  b.set(cx + 1, cy + 1, PAL.orange);
  b.outline((n) => (n === INK ? null : mix(n, INK, 0.6)));
  return b;
}

// -------------------------------------------------------------------- fx ---

function star(b: Buf, cx: number, cy: number, arm: number, core: Col, ray: Col, diag = false): void {
  b.set(cx, cy, core);
  for (let i = 1; i <= arm; i++) {
    const c = i === arm ? ray : i === 1 ? core : ray;
    b.set(cx + i, cy, c)
      .set(cx - i, cy, c)
      .set(cx, cy + i, c)
      .set(cx, cy - i, c);
    if (diag && i < arm)
      b.set(cx + i, cy + i, ray)
        .set(cx - i, cy - i, ray)
        .set(cx + i, cy - i, ray)
        .set(cx - i, cy + i, ray);
  }
}

function fxHit(f: number): Buf {
  const b = new Buf(12, 12);
  if (f === 0) {
    b.ellipse(6, 6, 2, 2, '#ffffff');
    star(b, 6, 6, 3, '#ffffff', PAL.yellow);
  } else if (f === 1) {
    b.ellipse(6, 6, 2.6, 2.6, '#ffffff');
    star(b, 6, 6, 5, '#ffffff', PAL.yellow, true);
    b.set(1, 1, PAL.gold).set(10, 10, PAL.gold).set(10, 1, PAL.gold).set(1, 10, PAL.gold);
  } else if (f === 2) {
    b.ring(6, 6, 4.5, 1.2, PAL.yellow);
    star(b, 6, 6, 5, PAL.gold, alpha(PAL.orange, 0.8));
    b.set(6, 6, null).set(5, 6, null).set(7, 6, null).set(6, 5, null).set(6, 7, null);
  } else {
    for (const [x, y] of [
      [1, 6],
      [10, 5],
      [6, 0],
      [5, 11],
      [2, 2],
      [9, 9],
    ] as const)
      b.set(x, y, alpha(PAL.gold, 0.8));
  }
  return b;
}

/** Dissolve a layer: pixels further from (cx, cy) vanish first, with noise. */
function erode(b: Buf, cx: number, cy: number, amount: number, seed: number): Buf {
  let maxD = 1;
  b.each((_c, x, y) => {
    maxD = Math.max(maxD, Math.hypot(x + 0.5 - cx, y + 0.5 - cy));
  });
  b.each((_c, x, y) => {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / maxD;
    const n = h2(x, y, seed);
    if (n * 0.8 + d * 0.5 < amount) b.set(x, y, null);
  });
  return b;
}

function cloud(
  b: Buf,
  cx: number,
  cy: number,
  spread: number,
  r: number,
  count: number,
  ramp: Ramp,
  seed: number,
  core = 0,
): Buf {
  const l = new Buf(b.w, b.h);
  const rr = rng(seed);
  if (core > 0) l.ellipse(cx, cy, core, core * 0.9, K);
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + rr() * 0.5;
    const pr = r * (0.8 + rr() * 0.4);
    l.ellipse(cx + Math.cos(a) * spread, cy + Math.sin(a) * spread * 0.85, pr, pr, K);
  }
  shade(l, ramp, { rim: 0.35 });
  return l;
}

function fxExplosion(f: number): Buf {
  const S = 32;
  const b = new Buf(S, S);
  const c = 16;
  const r = rng(40 + f);
  const FIRE: Ramp = [PAL.darkRed, PAL.orange, PAL.gold, PAL.yellow, '#fffbe0'];
  const SMOKE: Ramp = [PAL.navy, PAL.darkSlate, PAL.slate, PAL.gray];
  const SMOKE_L: Ramp = [PAL.darkSlate, PAL.slate, PAL.gray, PAL.lightGray];
  if (f === 0) {
    b.ellipse(c, c, 4, 4, PAL.yellow);
    b.ellipse(c, c, 2.5, 2.5, '#ffffff');
    star(b, c, c, 7, '#ffffff', PAL.gold);
    return b;
  }
  const R = [0, 8, 11, 13, 14, 15][f];
  // smoke ring (rises and dissolves)
  if (f >= 2) {
    const sm = cloud(b, c, c - (f - 2) * 1.2, R * 0.62, 2.8 + f * 0.7, 9, f >= 4 ? SMOKE_L : SMOKE, 7);
    if (f >= 4) erode(sm, c, c - (f - 2) * 1.2, f === 4 ? 0.45 : 0.75, 90 + f);
    b.blit(sm);
  }
  // fireball core
  const fr = f === 1 ? 7 : f === 2 ? 8.5 : f === 3 ? 6 : f === 4 ? 3 : 0;
  if (fr > 0) {
    const fire = new Buf(S, S);
    fire.ellipse(c, c - (f >= 3 ? 1 : 0), fr, fr * 0.95, K);
    fire.each((_col, x, y) => {
      const d = Math.hypot(x + 0.5 - c, y + 0.5 - c) / fr;
      const v = 1.05 - d * 0.9 + (r() - 0.5) * 0.3 - (f - 1) * 0.12;
      fire.set(x, y, FIRE[Math.max(0, Math.min(FIRE.length - 1, Math.floor(v * FIRE.length)))]);
    });
    if (f >= 3) erode(fire, c, c, f === 3 ? 0.3 : 0.5, 70 + f);
    b.blit(fire);
  }
  // sparks / debris
  if (f >= 1 && f <= 4) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.3 + f * 0.1;
      const d = R + 1 + f;
      b.set(c + Math.cos(a) * d, c + Math.sin(a) * d, i % 2 ? PAL.gold : PAL.orange);
      if (f <= 2) b.set(c + Math.cos(a) * (d - 1), c + Math.sin(a) * (d - 1), PAL.yellow);
    }
  }
  return b;
}

function fxSmoke(f: number): Buf {
  const b = new Buf(12, 12);
  const cy = 7 - f * 0.7;
  const l = cloud(
    b,
    6,
    cy,
    1.2 + f * 0.6,
    1.9 + f * 0.5,
    4,
    [PAL.slate, PAL.gray, PAL.lightGray, '#e4ebf5'],
    3,
    1.5 + f * 0.4,
  );
  if (f >= 2) erode(l, 6, cy, f === 2 ? 0.35 : 0.65, 20 + f);
  b.blit(l);
  return b;
}

function fxSparkle(f: number): Buf {
  const b = new Buf(9, 9);
  const arm = [1, 3, 4, 2][f];
  star(b, 4, 4, arm, '#ffffff', f === 2 ? PAL.gold : PAL.yellow);
  if (f === 2)
    b.set(3, 3, alpha('#ffffff', 0.6))
      .set(5, 5, alpha('#ffffff', 0.6))
      .set(5, 3, alpha('#ffffff', 0.6))
      .set(3, 5, alpha('#ffffff', 0.6));
  return b;
}

function fxPoof(f: number): Buf {
  const b = new Buf(16, 16);
  const P: Ramp = [PAL.gray, PAL.lightGray, '#eef3fa', '#ffffff'];
  const spread = [2.2, 3.6, 4.8, 5.6, 6.2][f];
  const pr = [2.4, 2.8, 2.6, 2, 1.3][f];
  const core = [3, 2.5, 0, 0, 0][f];
  const cy = 8.5 - f * 0.4;
  const l = cloud(b, 8, cy, spread, pr, 7, P, 5, core);
  if (f === 2) {
    // hollow centre as the puff expands
    l.ellipse(8, cy, 2, 1.8, null);
  }
  if (f >= 3) erode(l, 8, cy, f === 3 ? 0.25 : 0.55, 30 + f);
  b.blit(l);
  if (f <= 2) b.outline(alpha(PAL.slate, 0.85));
  // sparkle bits
  const sp: [number, number][] = [
    [1, 3],
    [14, 2],
    [2, 13],
    [13, 12],
  ];
  if (f >= 1)
    for (const [x, y] of sp) {
      const o = f >= 3 ? 1 : 0;
      b.set(x + (x < 8 ? -o : o), y - o, f >= 3 ? alpha('#ffffff', 0.75) : '#ffffff');
    }
  return b;
}

// ------------------------------------------------------------------ defs ---

function one(w: number, h: number, frames: number, fps: number, fn: (f: number) => Buf): SpriteDef {
  return {
    info: {
      w,
      h,
      anchorX: Math.floor(w / 2),
      anchorY: Math.floor(h / 2),
      dirs: 1,
      anims: anims({ fly: [frames, fps] }),
    },
    draw: (_a: AnimName, f: number) => fn(f),
  };
}

export const PROJECTILE_DEFS: Record<ProjectileId, SpriteDef> = {
  proj_arrow: one(12, 5, 1, 1, () => arrow()),
  proj_fireball: one(12, 9, 4, 12, fireball),
  proj_iceshard: one(12, 5, 2, 8, iceshard),
  proj_magic: one(9, 9, 4, 10, magicOrb),
  proj_void: one(11, 11, 4, 10, voidOrb),
  proj_seed: one(6, 6, 4, 12, seed),
  proj_rock: one(9, 9, 4, 12, rock),
  proj_snowball: one(8, 8, 2, 6, snowball),
  proj_bolt: one(10, 5, 3, 15, bolt),
  proj_crystal: one(10, 7, 2, 8, crystalShard),
  proj_sand: one(12, 10, 4, 14, sandBall),
  proj_bubble: one(10, 10, 4, 8, bubble),
  proj_lightning: one(12, 12, 4, 15, lightningBall),
  proj_sunbolt: one(14, 10, 4, 12, sunbolt),
};

export const FX_DEFS: Record<FxId, SpriteDef> = {
  fx_hit: one(12, 12, 4, 20, fxHit),
  fx_explosion: one(32, 32, 6, 14, fxExplosion),
  fx_smoke: one(12, 12, 4, 8, fxSmoke),
  fx_sparkle: one(9, 9, 4, 10, fxSparkle),
  fx_poof: one(16, 16, 5, 12, fxPoof),
};
