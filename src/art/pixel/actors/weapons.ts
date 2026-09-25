/**
 * Hero weapons. Images point RIGHT with the grip on the left; the engine
 * rotates them around (gripX, gripY). `tier` 0-5 selects the material:
 * 0 wood/rusty iron · 1 iron · 2 polished steel · 3 crystal · 4 ember · 5 aether.
 */
import { PAL } from '../../palette';
import type { WeaponInfo, WeaponKind } from '../types';
import { Buf, INK, shade, type Col, type Ramp } from './buf';

interface Mat {
  /** blade: dark, mid, light, edge highlight */
  blade: readonly [Col, Col, Col, Col];
  guard: readonly [Col, Col, Col];
  grip: readonly [Col, Col];
  shaft: readonly [Col, Col];
  orb: Ramp;
  gem: Col;
  rust?: Col;
  glow?: Col;
  hot?: Col;
}

const MATS: readonly Mat[] = [
  {
    blade: ['#4f4547', '#7b6f70', '#a29591', '#c2b4a8'],
    guard: [PAL.plum, PAL.darkBrown, PAL.brown],
    grip: [PAL.plum, PAL.darkBrown],
    shaft: [PAL.darkBrown, PAL.brown],
    orb: [PAL.darkSlate, PAL.slate, PAL.gray],
    gem: PAL.gray,
    rust: PAL.rust,
  },
  {
    blade: [PAL.slate, PAL.gray, PAL.lightGray, '#e3e9f2'],
    guard: [PAL.navy, PAL.darkSlate, PAL.slate],
    grip: [PAL.darkBrown, PAL.brown],
    shaft: [PAL.darkBrown, PAL.brown],
    orb: [PAL.blue, PAL.sky, PAL.cyan],
    gem: PAL.sky,
  },
  {
    blade: [PAL.gray, PAL.lightGray, '#eef3fa', '#ffffff'],
    guard: [PAL.rust, PAL.gold, PAL.yellow],
    grip: [PAL.navy, PAL.blue],
    shaft: [PAL.navy, PAL.darkSlate],
    orb: [PAL.darkRed, PAL.red, PAL.pink, '#ffffff'],
    gem: PAL.red,
  },
  {
    blade: [PAL.blue, PAL.sky, PAL.cyan, '#ffffff'],
    guard: [PAL.slate, PAL.lightGray, '#ffffff'],
    grip: [PAL.navy, PAL.blue],
    shaft: [PAL.slate, PAL.lightGray],
    orb: [PAL.blue, PAL.sky, PAL.cyan, '#ffffff'],
    gem: PAL.cyan,
  },
  {
    blade: [PAL.darkRed, PAL.orange, PAL.gold, PAL.yellow],
    guard: [PAL.darkBrown, PAL.gold, PAL.yellow],
    grip: [PAL.plum, PAL.darkRed],
    shaft: [PAL.plum, PAL.darkRed],
    orb: [PAL.darkRed, PAL.orange, PAL.gold, PAL.yellow],
    gem: PAL.orange,
    hot: '#fff6c8',
  },
  {
    blade: [PAL.purple, PAL.magenta, PAL.pink, '#ffffff'],
    guard: [PAL.blue, PAL.cyan, '#ffffff'],
    grip: ['#1c0f2a', PAL.purple],
    shaft: ['#1c0f2a', PAL.purple],
    orb: [PAL.purple, PAL.magenta, PAL.pink, '#ffffff'],
    gem: PAL.cyan,
    glow: PAL.cyan,
  },
];

const INFO: Record<WeaponKind, WeaponInfo> = {
  sword: { w: 16, h: 7, gripX: 3, gripY: 3 },
  greatsword: { w: 24, h: 9, gripX: 3, gripY: 4 },
  dagger: { w: 10, h: 5, gripX: 1, gripY: 2 },
  staff: { w: 20, h: 8, gripX: 5, gripY: 4 },
};

export function weaponSize(kind: WeaponKind): WeaponInfo {
  return INFO[kind] ?? INFO.sword;
}

function gripWrap(b: Buf, x0: number, x1: number, y: number, m: Mat): void {
  for (let x = x0; x <= x1; x++) b.set(x, y, (x - x0) % 2 ? m.grip[0] : m.grip[1]);
}

function sword(m: Mat): Buf {
  const b = new Buf(16, 7);
  b.set(1, 3, m.guard[2]);
  gripWrap(b, 2, 3, 3, m);
  b.vline(4, 1, 5, m.guard[1]).set(4, 1, m.guard[2]).set(4, 5, m.guard[0]);
  b.set(5, 3, m.guard[0]);
  for (let x = 5; x <= 12; x++) {
    b.set(x, 2, m.blade[2]).set(x, 3, m.blade[1]).set(x, 4, m.blade[0]);
  }
  b.set(13, 2, m.blade[2]).set(13, 3, m.blade[1]).set(14, 3, m.blade[3]);
  b.set(6, 2, m.blade[3]).set(7, 2, m.blade[3]);
  b.hline(6, 11, 3, m.blade[1]);
  if (m.rust) b.set(8, 4, m.rust).set(10, 3, m.rust).set(11, 4, m.rust).set(12, 2, m.blade[1]);
  if (m.hot) b.hline(6, 12, 3, m.blade[2]).set(9, 3, m.hot).set(10, 3, m.hot);
  if (m.glow) b.set(8, 2, m.glow).set(10, 2, m.glow).set(12, 2, m.glow).set(14, 3, m.glow);
  b.set(1, 3, m.gem);
  return b.outline(INK);
}

function greatsword(m: Mat): Buf {
  const b = new Buf(24, 9);
  b.set(1, 4, m.gem).set(1, 3, m.guard[1]).set(1, 5, m.guard[0]);
  gripWrap(b, 2, 5, 4, m);
  b.vline(6, 1, 7, m.guard[1]).vline(7, 2, 6, m.guard[0]);
  b.set(6, 1, m.guard[2]).set(6, 7, m.guard[0]).set(7, 4, m.gem);
  for (let x = 8; x <= 20; x++) {
    b.set(x, 2, m.blade[2])
      .set(x, 3, m.blade[2])
      .set(x, 4, m.blade[1])
      .set(x, 5, m.blade[1])
      .set(x, 6, m.blade[0]);
  }
  // fuller groove
  b.hline(9, 17, 4, m.blade[0]);
  b.set(21, 3, m.blade[2]).set(21, 4, m.blade[1]).set(21, 5, m.blade[0]).set(22, 4, m.blade[3]);
  b.set(9, 2, m.blade[3]).set(10, 2, m.blade[3]).set(11, 2, m.blade[3]);
  if (m.rust)
    b.set(12, 6, m.rust).set(15, 5, m.rust).set(18, 2, m.rust).set(19, 6, m.rust).set(20, 2, m.blade[1]);
  if (m.hot) b.hline(9, 17, 4, m.hot).set(13, 4, PAL.yellow);
  if (m.glow) {
    for (let x = 9; x <= 20; x += 2) b.set(x, 2, m.glow);
    b.set(22, 4, m.glow);
  }
  return b.outline(INK);
}

function dagger(m: Mat): Buf {
  const b = new Buf(10, 5);
  gripWrap(b, 1, 2, 2, m);
  b.vline(3, 1, 3, m.guard[1]).set(3, 1, m.guard[2]);
  for (let x = 4; x <= 6; x++) b.set(x, 1, m.blade[2]).set(x, 2, m.blade[1]).set(x, 3, m.blade[0]);
  b.set(7, 1, m.blade[2]).set(7, 2, m.blade[1]).set(8, 2, m.blade[3]);
  b.set(5, 1, m.blade[3]);
  if (m.rust) b.set(6, 3, m.rust);
  if (m.hot) b.set(5, 2, m.hot);
  if (m.glow) b.set(8, 2, m.glow).set(6, 1, m.glow);
  return b.outline(INK);
}

function staff(m: Mat, tier: number): Buf {
  const b = new Buf(20, 8);
  for (let x = 1; x <= 14; x++) b.set(x, 3, m.shaft[1]).set(x, 4, m.shaft[0]);
  b.set(1, 3, m.guard[1]).set(1, 4, m.guard[0]);
  for (let x = 4; x <= 7; x++) b.set(x, 3, x % 2 ? m.grip[1] : m.grip[0]).set(x, 4, m.grip[0]);
  const orb = (cx: number, cy: number, r: number): void => {
    const l = new Buf(20, 8).ellipse(cx, cy, r, r, '#000000');
    shade(l, m.orb, { rim: 0.25 });
    b.blit(l);
  };
  if (tier === 0) {
    // gnarled wooden staff with a stone knob
    b.set(13, 2, m.shaft[1]).set(14, 2, m.shaft[1]).set(15, 2, m.shaft[0]);
    orb(16.5, 4, 2.2);
    b.set(10, 4, PAL.plum);
  } else if (tier === 3) {
    // cyan crystal held in silver prongs
    b.set(14, 2, m.guard[1]).set(15, 1, m.guard[2]).set(14, 5, m.guard[0]).set(15, 6, m.guard[1]);
    b.poly(
      [
        [14.5, 3.5],
        [16.5, 1],
        [19.2, 4],
        [16.5, 7],
      ],
      PAL.sky,
    );
    b.set(16, 2, '#ffffff')
      .set(16, 3, PAL.cyan)
      .set(17, 3, PAL.cyan)
      .set(17, 4, PAL.cyan)
      .set(16, 4, '#c9fbff')
      .set(17, 5, PAL.blue)
      .set(16, 6, PAL.blue);
  } else {
    // prongs + orb
    b.set(14, 2, m.guard[1]).set(15, 1, m.guard[2]).set(14, 5, m.guard[0]).set(15, 6, m.guard[1]);
    orb(16.8, 3.8, tier >= 4 ? 2.5 : 2.2);
    b.set(16, 3, '#ffffff');
  }
  if (tier === 4) b.set(18, 1, PAL.gold).set(17, 0, PAL.yellow);
  b.outline(INK);
  if (tier === 5) {
    // cyan halo ring around the aether orb
    for (const [x, y] of [
      [16, 0],
      [19, 2],
      [19, 5],
      [16, 7],
      [14, 1],
    ] as const)
      if (!b.has(x, y) || b.get(x, y) === INK) b.set(x, y, PAL.cyan);
  }
  return b;
}

export function drawWeapon(kind: WeaponKind, tier: number): Buf {
  const t = Math.max(0, Math.min(5, Math.floor(Number.isFinite(tier) ? tier : 0)));
  const m = MATS[t];
  switch (kind) {
    case 'greatsword':
      return greatsword(m);
    case 'dagger':
      return dagger(m);
    case 'staff':
      return staff(m, t);
    default:
      return sword(m);
  }
}
