/**
 * Act II bosses (Solenne, the desert port under the black sun). Same
 * conventions as ./bosses.ts: the big monsters are front-facing set pieces
 * (dirs 1), the humanoid / naga bosses are side-view (dirs 2, facing RIGHT).
 */
import { PAL } from '../../palette';
import type { AnimName, BossId } from '../types';
import { alpha, Buf, INK, shade, type Col, type Pt, type Ramp, type ShadeOpts } from './buf';
import { anims, type SpriteDef } from './defs';
import { bez, rng, stroke, tri } from './shapes';

const K = '#000000';
const TAU = Math.PI * 2;

/** Draw into a fresh layer and volume-shade it. */
function lay(w: number, h: number, ramp: Ramp, draw: (l: Buf) => void, o: ShadeOpts = {}): Buf {
  const l = new Buf(w, h);
  draw(l);
  return shade(l, ramp, { rim: 0.28, ...o });
}

/** Points every half pixel along a polyline, so stroke() leaves no gaps. */
function dense(pts: readonly Pt[]): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) * 2));
    for (let k = 0; k < n; k++) out.push([ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n]);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/** Point on an ellipse around (cx, cy); angle 0 = right, +PI/2 = down. */
function polar(cx: number, cy: number, r: number, a: number, ky = 1): Pt {
  return [cx + Math.cos(a) * r, cy + Math.sin(a) * r * ky];
}

/** Closed polygon of an annular sector (ring slice) from angle a0 to a1. */
function sector(cx: number, cy: number, ri: number, ro: number, a0: number, a1: number, ky = 1): Pt[] {
  const n = Math.max(4, Math.ceil(((a1 - a0) * ro) / 2));
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) pts.push(polar(cx, cy, ro, a0 + ((a1 - a0) * i) / n, ky));
  for (let i = n; i >= 0; i--) pts.push(polar(cx, cy, ri, a0 + ((a1 - a0) * i) / n, ky));
  return pts;
}

/** A pointed tooth / spike from `base` toward `tip`, coloured root → tip along `ramp`. */
function fang(b: Buf, base: Pt, tip: Pt, width: number, ramp: Ramp): void {
  const dx = tip[0] - base[0];
  const dy = tip[1] - base[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * (width / 2);
  const ny = (dx / len) * (width / 2);
  const l = new Buf(b.w, b.h);
  tri(l, [base[0] + nx, base[1] + ny], tip, [base[0] - nx, base[1] - ny], K);
  l.set(tip[0], tip[1], K);
  l.each((_c, x, y) => {
    const t = ((x + 0.5 - base[0]) * dx + (y + 0.5 - base[1]) * dy) / (len * len);
    l.set(x, y, ramp[Math.max(0, Math.min(ramp.length - 1, Math.floor(t * ramp.length)))]);
  });
  b.blit(l);
}

/** A small glowing eye: socket, iris, hot centre and a soft halo. */
function glowEye(b: Buf, x: number, y: number, big: boolean, iris: Col, hot: Col, halo: Col): void {
  for (const [dx, dy] of [
    [-1, 0],
    [2 + (big ? 1 : 0), 0],
    [0, -1],
    [1, -1],
    [0, 2],
    [1, 2],
  ] as const)
    if (!b.has(x + dx, y + dy) || b.get(x + dx, y + dy) !== INK) b.set(x + dx, y + dy, halo);
  b.rect(x, y, 2 + (big ? 1 : 0), 2, iris);
  b.set(x, y, hot);
  if (big) b.set(x + 1, y, '#ffffff');
}

// =============================================================== SANDMAW ===

const SM = {
  armor: [PAL.plum, PAL.darkBrown, PAL.brown, PAL.tan] as Ramp,
  plate: [PAL.brown, PAL.tan, PAL.sand, '#f6e7c8'] as Ramp,
  mound: [PAL.brown, PAL.tan, PAL.sand, '#f6e7c8'] as Ramp,
  flesh: [PAL.plum, PAL.darkRed, PAL.red] as Ramp,
  tooth: [PAL.sand, '#fff4dc', '#ffffff'] as Ramp,
  bone: [PAL.darkBrown, PAL.brown, PAL.tan, PAL.sand] as Ramp,
};

interface WormPose {
  /** Lateral sway of the neck (px). */
  sway: number;
  /** Extra vertical offset of the head (px, + = lower / toward the camera). */
  headDy: number;
  /** Head size multiplier (lunging toward the camera reads as bigger). */
  headK: number;
  /** Maw opening: 0 = clenched, 1 = breathing, 2+ = gaping. */
  op: number;
  eyes: 'open' | 'shut' | 'flare';
}

/** Front-on lamprey maw: armoured lips around rings of teeth and a black gullet. */
function sandmawHead(b: Buf, hx: number, hy: number, p: WormPose, f: number): void {
  const W = b.w;
  const H = b.h;
  const R = 15 * p.headK;
  const ky = 0.9;
  // heavy bone horns sweeping back from the crown
  for (const [a, len, w] of [
    [-Math.PI / 2 - 1.25, 10, 6],
    [-Math.PI / 2 + 1.25, 10, 6],
    [-Math.PI / 2 - 0.62, 12, 7],
    [-Math.PI / 2 + 0.62, 12, 7],
    [-Math.PI / 2, 10, 6.5],
  ] as const) {
    const base = polar(hx, hy, R - 4, a, ky);
    const tip = polar(hx, hy, R - 4 + len * p.headK, a + (a + Math.PI / 2) * 0.35, ky);
    const l = new Buf(W, H);
    fang(l, base, tip, w, SM.bone);
    shade(l, SM.bone, { rim: 0.35 });
    b.overlay(l, INK, 'all');
  }
  const spread = Math.max(0, p.op - 0.6) * 1.4 * p.headK;
  const mawR = (2.5 + p.op * 3.1) * p.headK;
  // flesh disc showing between the lips
  const fr = R - 1 + spread * 0.5;
  const gul = lay(W, H, SM.flesh, (l) => l.ellipse(hx, hy, fr, fr * ky, K), {
    lx: 0.6,
    ly: 0.8,
    rim: 0,
  });
  b.overlay(gul, INK, 'all');
  // gullet: darkening rings, a second row of teeth, black throat
  if (p.op > 0.4) {
    const g = mawR;
    b.ellipse(hx, hy, g, g * ky, PAL.darkRed);
    b.ellipse(hx + 0.4, hy + 0.4, g * 0.72, g * 0.72 * ky, PAL.plum);
    b.ellipse(hx + 0.5, hy + 0.6, g * 0.45, g * 0.45 * ky, '#1a0d1c');
    b.ellipse(hx + 0.5, hy + 0.6, g * 0.28, g * 0.28 * ky, INK);
    if (p.op >= 1) {
      const n = Math.max(6, Math.round(g * 1.3));
      for (let k = 0; k < n; k++) {
        const a = (k / n) * TAU + 0.3 + f * 0.08;
        fang(b, polar(hx, hy, g * 0.74, a, ky), polar(hx + 0.5, hy + 0.6, g * 0.5, a, ky), 1.8, SM.tooth);
      }
    }
  }
  // four armoured lips
  const ri = mawR;
  const ro = R + spread * 0.4;
  const gap = p.op < 0.4 ? 0.035 : 0.07 + p.op * 0.05;
  const plates: number[] = [-Math.PI * 0.75, -Math.PI * 0.25, Math.PI * 0.25, Math.PI * 0.75];
  plates.forEach((ac, idx) => {
    const ox = Math.cos(ac) * spread;
    const oy = Math.sin(ac) * spread * ky;
    const a0 = ac - Math.PI / 4 + gap;
    const a1 = ac + Math.PI / 4 - gap;
    const cx = hx + ox;
    const cy = hy + oy;
    const l = new Buf(W, H);
    l.poly(sector(cx, cy, ri, ro, a0, a1, ky), K);
    shade(l, SM.armor, { rim: 0.32, bias: idx < 2 ? 0.12 : -0.08 });
    b.overlay(l, INK, 'all');
    // fleshy inner lip
    for (let k = 0; k <= 12; k++) {
      const a = a0 + ((a1 - a0) * k) / 12;
      const [x, y] = polar(cx, cy, ri + 0.6, a, ky);
      b.tint(x, y, idx < 2 ? PAL.red : PAL.darkRed);
    }
    // plate seam + rim highlight
    const mid = ri + (ro - ri) * 0.58;
    for (let k = 1; k < 12; k++) {
      const a = a0 + ((a1 - a0) * k) / 12;
      const [sx, sy] = polar(cx, cy, mid, a, ky);
      if (b.get(sx, sy) !== INK) b.tint(sx, sy, PAL.darkBrown);
      if (idx < 2 && k % 3 !== 0) {
        const [tx, ty] = polar(cx, cy, ro - 1, a, ky);
        if (b.get(tx, ty) !== INK) b.tint(tx, ty, idx === 0 ? PAL.sand : PAL.tan);
      }
    }
    // fangs lining the lip, pointing into the gullet
    if (p.op > 0.5) {
      const nT = 3;
      for (let k = 0; k < nT; k++) {
        const a = a0 + ((a1 - a0) * (k + 0.5)) / nT;
        const len = 2.2 + Math.min(1.6, p.op * 0.6);
        fang(b, polar(cx, cy, ri + 1.2, a, ky), polar(cx, cy, Math.max(0.5, ri - len), a, ky), 2.4, SM.tooth);
      }
    }
  });
  // amber eyes: a crescent of three on each upper lip
  for (const s of [-1, 1]) {
    const ac = -Math.PI / 2 + s * (Math.PI / 4);
    const cx = hx + Math.cos(ac) * spread;
    const cy = hy + Math.sin(ac) * spread * ky;
    const er = ri + (ro - ri) * 0.3 + 0.8;
    const list: [number, boolean][] = [
      [-0.36 * s, false],
      [0.02 * s, true],
      [0.4 * s, false],
    ];
    for (const [da, big] of list) {
      const [ex, ey] = polar(cx, cy, Math.max(er, 7.5 * p.headK), ac + da, ky);
      const x = Math.round(ex - (big ? 1.5 : 1));
      const y = Math.round(ey - 1);
      if (p.eyes === 'shut') {
        b.hline(x, x + (big ? 2 : 1), y + 1, INK);
        continue;
      }
      const fl = p.eyes === 'flare';
      glowEye(
        b,
        x,
        y,
        big,
        fl ? PAL.yellow : PAL.gold,
        fl ? '#ffffff' : PAL.yellow,
        alpha(PAL.orange, fl ? 0.85 : 0.5),
      );
    }
  }
}

/** The worm itself (body column + head), drawn with its base at y = 64. */
function sandmawWorm(W: number, H: number, p: WormPose, f: number): Buf {
  const b = new Buf(W, H);
  const B: Pt = [32, 64];
  const N: Pt = [33 + p.sway, 30 + p.headDy * 0.6];
  const C: Pt = [25 - p.sway * 1.5, 50];
  const curve = bez(B, C, N, 60);
  const at = (t: number): Pt => curve[Math.round(Math.max(0, Math.min(1, t)) * 60)];
  // ---- armoured body rings (bottom → top, each overlapping the one below)
  const SEG = 5;
  for (let i = 0; i < SEG; i++) {
    const t0 = i / SEG;
    const t1 = (i + 1.25) / SEG;
    const c0 = at(t0);
    const c1 = at(t1);
    const r0 = 13.5 - 3 * t0;
    const r1 = 13.5 - 3 * Math.min(1, t1);
    const flare = 1.06;
    const sag0 = r0 * 0.3;
    const sag1 = r1 * 0.3;
    const pts: Pt[] = [];
    for (let k = 0; k <= 12; k++) {
      const u = -1 + k / 6;
      pts.push([c0[0] + u * r0 * flare, c0[1] + sag0 * (1 - u * u)]);
    }
    for (let k = 12; k >= 0; k--) {
      const u = -1 + k / 6;
      pts.push([c1[0] + u * r1, c1[1] + sag1 * (1 - u * u) - 1]);
    }
    const l = new Buf(W, H);
    l.poly(pts, K);
    shade(l, SM.armor, { lx: -1, ly: -0.5, rim: 0.2, cx: (c0[0] + c1[0]) / 2 + 0.5, rx: r0 * flare });
    // pale ventral plate down the front of each ring
    const v = new Buf(W, H);
    const vw0 = r0 * 0.46;
    const vw1 = r1 * 0.42;
    v.poly(
      [
        [c0[0] - vw0, c0[1] + sag0 * 0.8],
        [c0[0], c0[1] + sag0 + 0.5],
        [c0[0] + vw0, c0[1] + sag0 * 0.8],
        [c1[0] + vw1, c1[1] + sag1 * 0.8],
        [c1[0] - vw1, c1[1] + sag1 * 0.8],
      ],
      K,
    );
    shade(v, SM.plate, { lx: -1, ly: -0.4, rim: 0.12 });
    l.blitClip(v);
    b.overlay(l, INK, 'all');
    // bright lip along the bottom edge of the ring, gritty pits on the armour
    for (let k = -5; k <= 5; k++) {
      const u = k / 6;
      const x = c0[0] + u * r0 * flare;
      const y = c0[1] + sag0 * (1 - u * u) - 1;
      if (b.get(x, y) !== INK && b.has(x, y)) b.set(x, y, k < 1 ? PAL.sand : PAL.tan);
    }
    const r = rng(i + 4);
    for (let k = 0; k < 5; k++) {
      const x = c0[0] + (r() * 2 - 1) * r0 * 0.9;
      const y = c0[1] - 1 - r() * 4;
      if (Math.abs(x - c0[0]) > vw0 && b.get(x, y) !== INK) b.tint(x, y, PAL.darkBrown);
    }
    // a pair of bony barbs on alternate rings
    if (i % 2 === 1) {
      for (const s of [-1, 1]) {
        const bx = c0[0] + s * r0 * flare;
        const by = c0[1] - 1;
        const sp = new Buf(W, H);
        fang(sp, [bx - s * 2, by], [bx + s * 3.5, by - 3], 3.2, SM.bone);
        shade(sp, SM.bone, { rim: 0.3 });
        b.overlay(sp, INK, 'all');
      }
    }
  }
  sandmawHead(b, N[0], N[1] - 9 + p.headDy * 0.4, p, f);
  return b;
}

/** Sand mound around the worm's base; `front` draws only the lip in front of the body. */
function mound(b: Buf, cx: number, rx: number, ry: number, front: boolean, f: number): void {
  const W = b.w;
  const H = b.h;
  const cy = 60;
  const l = new Buf(W, H);
  if (front) {
    l.ellipse(cx, cy + 1.5, rx * 0.58, ry * 0.8, K);
    for (let y = 0; y < cy - 1; y++) for (let x = 0; x < W; x++) l.set(x, y, null);
  } else l.ellipse(cx, cy, rx, ry, K);
  shade(l, SM.mound, { rim: 0.3, ly: -1, lx: -0.3 });
  b.overlay(l, front ? PAL.brown : INK, 'all');
  // wind ripples
  const r = rng(front ? 3 : 5);
  for (let i = 0; i < (front ? 3 : 6); i++) {
    const x = Math.round(cx - rx * 0.8 + r() * rx * 1.6);
    const y = Math.round(cy - ry * 0.4 + r() * ry);
    const len = 2 + Math.floor(r() * 3);
    for (let k = 0; k < len; k++)
      if (l.has(x + k, y)) b.set(x + k, y, (k + f) % 5 === 0 ? PAL.sand : PAL.tan);
  }
}

/** Loose sand: falling streams, drifting grains, bursts. */
function sandBits(b: Buf, seed: number, n: number, x0: number, y0: number, w: number, h: number): void {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const x = Math.round(x0 + r() * w);
    const y = Math.round(y0 + r() * h);
    if (b.has(x, y)) continue;
    b.set(x, y, i % 3 === 0 ? PAL.sand : i % 3 === 1 ? PAL.tan : PAL.brown);
    if (i % 4 === 0 && !b.has(x, y + 1)) b.set(x, y + 1, alpha(PAL.tan, 0.6));
  }
}

function sandmaw(anim: AnimName, f: number): Buf {
  const W = 64;
  const H = 64;
  const b = new Buf(W, H);
  const pose: WormPose = {
    sway: [0, 1, 0, -1][f % 4],
    headDy: [0, 0, 1, 1][f % 4],
    headK: 1,
    op: [1.5, 1.7, 1.85, 1.7][f % 4],
    eyes: 'open',
  };
  let emerge = 1;
  let moundRx = 26;
  let moundRy = 5;
  let burst = 0;
  if (anim === 'attack') {
    if (f === 0) {
      Object.assign(pose, { sway: 0, headDy: -5, headK: 0.94, op: 0.15, eyes: 'flare' });
    } else {
      Object.assign(pose, { sway: 0, headDy: 7, headK: 1.14, op: 2.5, eyes: 'flare' });
      burst = 1;
    }
  } else if (anim === 'special') {
    if (f === 0) {
      Object.assign(pose, { sway: 0, headDy: 2, op: 0.2, eyes: 'open' });
      emerge = 0.45;
      moundRx = 28;
      moundRy = 6;
    } else if (f === 1) {
      emerge = 0;
      moundRx = 24;
      moundRy = 7;
    } else if (f === 2) {
      Object.assign(pose, { sway: 0, headDy: -2, op: 2.2, eyes: 'flare' });
      emerge = 0.72;
      moundRx = 29;
      moundRy = 6;
      burst = 2;
    } else {
      Object.assign(pose, { sway: 0, headDy: -3, op: 2.3, eyes: 'flare' });
      burst = 3;
    }
  } else if (anim === 'hurt') {
    Object.assign(pose, { sway: -2, headDy: -3, headK: 0.97, op: 0.3, eyes: 'shut' });
  }

  mound(b, 32, moundRx, moundRy, false, f);
  if (emerge > 0) {
    const worm = sandmawWorm(W, H, pose, f);
    const drop = Math.round((1 - emerge) * 40);
    const groundY = 58;
    worm.each((c, x, y) => {
      const ny = y + drop;
      if (ny <= groundY || (emerge === 1 && ny < H)) b.set(x, ny, c);
    });
    b.outline(INK);
    mound(b, 32, moundRx, moundRy, true, f);
  } else {
    // submerged: a churning bulge with the dorsal barbs just breaking the surface
    const l = lay(W, H, SM.mound, (m) => m.ellipse(32, 56, 17, 8, K), { rim: 0.3 });
    b.overlay(l, INK, 'all');
    for (let k = 0; k < 3; k++) {
      const a = k * 2.1 + f;
      const pts = Buf.linePts(
        32 + Math.cos(a) * 12,
        56 + Math.sin(a) * 5,
        32 + Math.cos(a + 1.4) * 5,
        56 + Math.sin(a + 1.4) * 2.5,
      );
      for (const [x, y] of pts) b.tint(x, y, PAL.brown);
    }
    for (const [x, h] of [
      [25, 5],
      [32, 8],
      [39, 5],
    ] as const) {
      const sp = new Buf(W, H);
      fang(sp, [x, 52], [x + 1, 52 - h], 4, SM.bone);
      shade(sp, SM.bone, { rim: 0.35 });
      b.overlay(sp, INK, 'all');
    }
    b.outline(INK);
  }

  // ---- loose sand
  if (anim === 'idle' || anim === 'hurt') {
    // trickles pouring off the armour rings
    for (const s of [-1, 1]) {
      const x = 32 + s * 13 + (s < 0 ? pose.sway : 0);
      for (let y = 36 + ((f * 2) % 4); y < 56; y += 4) {
        if (!b.has(x, y)) b.set(x, y, PAL.sand);
        if (!b.has(x, y + 1)) b.set(x, y + 1, alpha(PAL.tan, 0.7));
      }
    }
    sandBits(b, 11 + f, 6, 4, 40, 56, 16);
  }
  if (anim === 'special' && f === 0) sandBits(b, 21, 26, 6, 30, 52, 28);
  if (anim === 'special' && f === 1) sandBits(b, 22, 30, 6, 34, 52, 24);
  if (burst) {
    // geyser of sand thrown out around the base / maw
    const r = rng(burst * 17);
    const n = burst === 1 ? 26 : burst === 2 ? 44 : 24;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI * (0.05 + r() * 0.9);
      const d = 16 + r() * (burst === 2 ? 30 : 18);
      const x = 32 + Math.cos(a) * d * 1.1;
      const y = (burst === 3 ? 44 : 58) + Math.sin(a) * d * (burst === 2 ? 1.2 : 0.7);
      if (b.has(x, y)) continue;
      const big = i % 4 === 0;
      b.set(x, y, i % 2 ? PAL.sand : PAL.tan);
      if (big) b.set(x + 1, y, PAL.brown).set(x, y + 1, PAL.brown);
    }
    if (burst === 3) sandBits(b, 33, 30, 2, 2, 60, 30);
    if (burst === 2) {
      // arcs of sand clods flung out to both sides
      const q = rng(9);
      for (let i = 0; i < 36; i++) {
        const s = i % 2 ? 1 : -1;
        const t = q();
        const x = 32 + s * (12 + t * 19);
        const y = 57 - Math.sin(t * Math.PI * 0.9) * 16 - q() * 4 + t * 4;
        if (b.has(x, y)) continue;
        b.set(x, y, i % 3 ? PAL.sand : PAL.tan);
        if (i % 3 === 0) b.set(x + s, y, PAL.tan).set(x, y + 1, PAL.brown);
      }
    }
  }
  return b;
}

// ================================================================ NERETH ===

const NE = {
  tail: [PAL.deepTeal, '#1d5e5c', '#2a8c83', '#58c2ae'] as Ramp,
  fin: ['#1d5e5c', '#2a8c83', '#7fd9c4'] as Ramp,
  skin: ['#6f8fa0', '#a9c6cc', '#dcecec'] as Ramp,
  hair: [PAL.deepTeal, PAL.forest, PAL.darkGreen, PAL.green] as Ramp,
  coral: [PAL.darkRed, PAL.red, PAL.pink, '#ffc9c9'] as Ramp,
  pearl: ['#8a78b8', '#c9c0e8', '#f4f0ff', '#ffffff'] as Ramp,
};

/** Centripetal-ish Catmull-Rom through `pts`, `n` samples per span. */
function spline(pts: readonly Pt[], n: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b2: number, c: number, d: number): number =>
        0.5 * (2 * b2 + (-a + c) * t + (2 * a - 5 * b2 + 4 * c - d) * t2 + (-a + 3 * b2 - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

interface NagaPose {
  /** Upper body offset (lean forward +x, bob +y). */
  X: number;
  Y: number;
  staff: 'hold' | 'back' | 'thrust' | 'cast' | 'high';
  hand: 'rest' | 'reach' | 'up';
  eyes: 'glow' | 'blaze' | 'shut';
  /** Hair / tail-tip sway phase. */
  ph: number;
  /** Coil undulation (slither). */
  wave: number;
  /** Tidal magic 0-3. */
  water: number;
  pearl: number;
}

function nereth(anim: AnimName, f: number): Buf {
  const W = 56;
  const H = 56;
  const b = new Buf(W, H);
  const p: NagaPose = {
    X: 0,
    Y: [0, 1, 1, 0][f % 4],
    staff: 'hold',
    hand: 'rest',
    eyes: 'glow',
    ph: f % 4,
    wave: 0,
    water: 0,
    pearl: [0, 1, 2, 1][f % 4],
  };
  if (anim === 'move') Object.assign(p, { X: 1, Y: [0, 1, 0, 1][f], wave: f, ph: f });
  else if (anim === 'attack') {
    if (f === 0) Object.assign(p, { X: -2, Y: 0, staff: 'back', hand: 'reach', eyes: 'blaze' });
    else Object.assign(p, { X: 3, Y: 1, staff: 'thrust', hand: 'rest', eyes: 'blaze', water: 1 });
  } else if (anim === 'cast') {
    Object.assign(p, {
      X: 1,
      Y: 0,
      staff: 'cast',
      hand: 'reach',
      eyes: 'blaze',
      pearl: 3 + f,
      water: f === 1 ? 1 : 0,
    });
  } else if (anim === 'special') {
    Object.assign(p, {
      X: 0,
      Y: f === 0 ? -1 : -2,
      staff: 'high',
      hand: 'up',
      eyes: 'blaze',
      pearl: 4,
      water: f + 1,
    });
  } else if (anim === 'hurt') {
    Object.assign(p, { X: -2, Y: 1, eyes: 'shut', ph: 2 });
  }
  const X = p.X;
  const Y = p.Y;
  const sw = [0, 1, 0, -1][p.ph % 4];

  // ---- dusk shadow pooling under the coils
  const aura = new Buf(W, H);
  aura.ellipse(25, 51, 20, 4.5, alpha(PAL.purple, 0.3));
  aura.ellipse(25, 51, 13, 3, alpha(PAL.magenta, 0.2));
  b.blit(aura);

  const wv = (k: number): number => Math.sin(p.wave * (Math.PI / 2) + k) * 1.2;
  /** Serpent scales: fine dither on the mid tones. */
  const scales = (l: Buf): void => {
    l.each((c, x, y) => {
      if (c === NE.tail[2] && (x * 2 + y) % 4 === 0) l.set(x, y, NE.tail[1]);
      else if (c === NE.tail[3] && (x + y * 3) % 5 === 0) l.set(x, y, NE.tail[2]);
    });
  };
  /** Pale belly scutes along the bottom edge of a coil (`side` = which edge). */
  const belly = (l: Buf, band: number, side: 'down' | 'right'): void => {
    const src = l.clone();
    src.each((_c, x, y) => {
      const dx = side === 'right' ? band : 0;
      const dy = side === 'down' ? band : 0;
      if (src.has(x + dx, y + dy)) return;
      const edge = !src.has(x + Math.sign(dx), y + Math.sign(dy));
      const seam = side === 'down' ? x % 3 === 0 : y % 3 === 0;
      l.set(x, y, edge || seam ? PAL.tan : PAL.sand);
    });
  };
  const fin = (base0: Pt, base1: Pt, tipP: Pt): void => {
    const l = new Buf(W, H);
    tri(l, base0, tipP, base1, K);
    shade(l, NE.fin, { rim: 0.3 });
    b.overlay(l, INK, 'all');
  };

  // tail tip rising behind her back, with a fin fluke
  const tipPath = spline(
    [
      [12, 46],
      [6 + wv(0), 41],
      [8, 35 + sw * 0.5],
      [5 + sw, 30],
      [7 + sw * 1.5, 26 - (p.water ? 2 : 0)],
    ],
    8,
  );
  const tt = new Buf(W, H);
  stroke(tt, tipPath, 6.5, 2, K);
  shade(tt, NE.tail, { rim: 0.3 });
  scales(tt);
  belly(tt, 2, 'right');
  b.overlay(tt, INK, 'all');
  for (let i = 6; i < tipPath.length - 4; i += 7) {
    const [x, y] = tipPath[i];
    const r = 3.2 - (i / tipPath.length) * 2;
    fin([x - r + 0.5, y - 1.5], [x - r + 0.5, y + 1.5], [x - r - 3, y - 2]);
  }
  const tp = tipPath[tipPath.length - 1];
  fin([tp[0] - 1, tp[1] + 1], [tp[0] + 1.5, tp[1]], [tp[0] - 3, tp[1] - 5]);
  fin([tp[0], tp[1] + 1], [tp[0] + 1.5, tp[1] - 0.5], [tp[0] + 3, tp[1] - 4]);

  // two stacked coils (a big one on the ground, a tighter one on top)
  const coil = (cx: number, cy: number, rx: number, ry: number): void => {
    const l = new Buf(W, H);
    l.ellipse(cx, cy, rx, ry, K);
    shade(l, NE.tail, { rim: 0.32, lx: -0.45, ly: -1 });
    scales(l);
    belly(l, 3, 'down');
    // a groove where the coil turns under itself
    for (let x = Math.ceil(cx - rx * 0.55); x <= cx + rx * 0.55; x++) {
      const u = (x + 0.5 - cx) / (rx * 0.6);
      l.tint(x, cy - ry * 0.25 + (1 - u * u) * ry * 0.35, NE.tail[0]);
    }
    b.overlay(l, INK, 'all');
    // ragged dorsal fins along the top of the coil
    for (const u of [-0.75, -0.35, 0.35]) {
      const x = cx + u * rx;
      const y = cy - ry * Math.sqrt(1 - u * u) + 0.5;
      fin([x - 1.8, y + 0.5], [x + 1.8, y + 0.5], [x - 1 + u * 2, y - 3]);
    }
  };
  coil(25, 47.5, 17.5, 6.5);
  coil(26 + wv(1) * 0.5, 41.5, 12, 5.5);
  // waist stem rising out of the top coil
  const stem = new Buf(W, H);
  stroke(
    stem,
    dense([
      [30 + wv(1) * 0.5, 41],
      [29 + X * 0.6, 37 + Y * 0.5],
      [26.5 + X, 32 + Y],
    ]),
    9,
    8,
    K,
  );
  shade(stem, NE.tail, { rim: 0.3 });
  scales(stem);
  belly(stem, 3, 'right');
  b.overlay(stem, INK, 'all');
  // corrupted dusk veins crawling over the scales
  const vr = rng(5);
  for (let v = 0; v < 5; v++) {
    let x = 12 + vr() * 28;
    let y = 40 + vr() * 10;
    for (let k = 0; k < 6; k++) {
      if (b.get(x, y) !== INK) b.tint(x, y, k % 2 ? PAL.purple : '#2b1440');
      x += (vr() - 0.5) * 2.5;
      y += vr() < 0.5 ? 1 : 0;
    }
  }
  if (anim === 'idle' || anim === 'cast') b.tint(18 + (f % 2) * 10, 44 + (f % 2), PAL.magenta);

  // ---- seaweed hair streaming behind (drawn before the torso)
  const hx = 27 + X;
  const hy = 14 + Y;
  const trail = anim === 'move' ? -2 : anim === 'hurt' ? -3 : 0;
  const strands: [number, number, number][] = [
    [-2, 22, 3.6],
    [-4, 19, 3.2],
    [0, 20, 2.8],
    [-6, 14, 2.6],
  ];
  strands.forEach(([dx0, len, wd], i) => {
    const pts: Pt[] = [];
    for (let k = 0; k <= 5; k++) {
      const t = k / 5;
      const wob = Math.sin(t * 5 + p.ph * 1.2 + i) * 1.3 * t;
      pts.push([hx - 2 + dx0 * t - t * 4 + trail * t + wob, hy - 1 + t * len]);
    }
    const l = new Buf(W, H);
    stroke(l, spline(pts, 4), wd, 1.2, K);
    shade(l, NE.hair, { rim: 0.3, bias: i === 2 ? 0.15 : 0 });
    b.overlay(l, INK, 'all');
    // kelp bladders
    const e = pts[3];
    b.set(e[0] + 1, e[1], PAL.darkGreen).set(e[0] + 1, e[1] - 1, PAL.green);
  });

  // ---- coral crown (behind the head so it grows out of her hair)
  const coralBranch = (a: Pt, c: Pt, wd: number): void => {
    const l = new Buf(W, H);
    stroke(l, dense([a, c]), wd, Math.max(1, wd - 1.1), K);
    shade(l, NE.coral, { rim: 0.35 });
    b.overlay(l, INK, 'all');
    b.set(c[0], c[1], NE.coral[3]);
  };
  coralBranch([hx - 2, hy - 2], [hx - 6, hy - 9], 2.4);
  coralBranch([hx - 4, hy - 6], [hx - 8, hy - 6], 1.4);
  coralBranch([hx, hy - 3], [hx - 1, hy - 12], 2.6);
  coralBranch([hx - 0.5, hy - 8], [hx - 3.5, hy - 11], 1.4);
  coralBranch([hx + 2, hy - 3], [hx + 4, hy - 10], 2.2);
  coralBranch([hx + 3, hy - 7], [hx + 6, hy - 8], 1.4);

  // ---- far arm (behind the torso)
  const far = new Buf(W, H);
  const fsh: Pt = [25 + X, 22.5 + Y];
  let fh: Pt = [22 + X, 30 + Y];
  if (p.hand === 'reach') fh = [38 + X, 20 + Y];
  else if (p.hand === 'up') fh = [21 + X, 8 + Y];
  stroke(far, dense([fsh, [(fsh[0] + fh[0]) / 2 - 1, (fsh[1] + fh[1]) / 2 + 1], fh]), 2.8, 2.2, K);
  shade(far, NE.skin, { rim: 0.2, bias: -0.25 });
  b.overlay(far, INK, 'all');

  // ---- torso: slender, shoulders back, flaring into the serpent hips
  const torso = lay(W, H, NE.skin, (l) => {
    l.poly(
      [
        [24.2 + X, 34 + Y],
        [30.3 + X, 34 + Y],
        [29.6 + X, 30.5 + Y],
        [31 + X, 27 + Y],
        [31.4 + X, 23 + Y],
        [29.8 + X, 21 + Y],
        [24.6 + X, 21 + Y],
        [23.2 + X, 23 + Y],
        [23.8 + X, 27 + Y],
        [24.9 + X, 30.5 + Y],
      ],
      K,
    );
  });
  b.overlay(torso, INK, 'all');
  // scales creeping up the hips
  for (let y = 30; y <= 34; y++)
    for (let x = 23; x <= 31; x++)
      if ((x + y) % 2 === 0 && y > 32 - ((x * 7) % 3)) b.tint(x + X, y + Y, y > 32 ? NE.tail[2] : NE.tail[3]);
  // shell bodice, pearl strand, Order-of-Stars pendant
  b.overlay(
    lay(W, H, NE.coral, (l) => l.ellipse(29.6 + X, 24.8 + Y, 2.1, 1.7, K), { rim: 0.3 }),
    PAL.darkRed,
    'all',
  );
  b.set(29 + X, 24 + Y, '#ffc9c9').set(30 + X, 26 + Y, PAL.darkRed);
  for (const [x, y] of [
    [25, 22],
    [26, 23],
    [27, 23],
    [28, 22],
  ] as const)
    b.set(x + X, y + Y, (x + y) % 2 ? '#ffffff' : NE.pearl[1]);
  b.set(27 + X, 24 + Y, PAL.gold)
    .set(27 + X, 25 + Y, PAL.yellow)
    .set(26 + X, 24 + Y, PAL.rust);
  // belt of gold and pearls where flesh turns to scale
  b.hline(24 + X, 30 + X, 31 + Y, PAL.gold).hline(24 + X, 30 + X, 32 + Y, PAL.rust);
  for (let x = 25; x <= 30; x += 2) b.set(x + X, 31 + Y, '#fffbe0');

  // ---- head (profile, facing right)
  b.overlay(
    lay(W, H, NE.skin, (l) => {
      l.ellipse(hx + 0.5, hy, 3.8, 4.1, K);
      l.poly(
        [
          [hx + 1.5, hy - 3.4],
          [hx + 4, hy - 1.8],
          [hx + 4.3, hy + 0.3],
          [hx + 5.2, hy + 1.8],
          [hx + 4.3, hy + 2.4],
          [hx + 4.4, hy + 3.1],
          [hx + 3.4, hy + 4.2],
          [hx + 1.4, hy + 4.2],
        ],
        K,
      );
      l.rect(hx - 1, hy + 3, 3, 4, K);
    }),
    INK,
    'all',
  );
  // hair cap sweeping back over the crown
  const cap = lay(W, H, NE.hair, (l) => {
    l.poly(
      [
        [hx + 3.6, hy - 2.6],
        [hx + 1.6, hy - 4.6],
        [hx - 2, hy - 4.4],
        [hx - 3.8, hy - 2],
        [hx - 4, hy + 2],
        [hx - 2.8, hy + 4.5],
        [hx - 0.8, hy + 2.5],
        [hx + 0.2, hy - 0.8],
        [hx + 2.2, hy - 1.6],
      ],
      K,
    );
  });
  b.overlay(cap, INK, 'all');
  // fin-like ear
  b.overlay(
    lay(W, H, NE.fin, (l) =>
      l.poly(
        [
          [hx, hy - 0.5],
          [hx - 3, hy - 2.5],
          [hx - 2.2, hy + 1.2],
          [hx, hy + 1.8],
        ],
        K,
      ),
    ),
    INK,
    'all',
  );
  // face: glowing dusk eye, dark streak of corruption, lips
  if (p.eyes === 'shut') b.hline(hx + 2, hx + 3, hy + 0.5, PAL.navy);
  else {
    const hot = p.eyes === 'blaze' ? '#ffffff' : PAL.pink;
    b.hline(hx + 2, hx + 3, hy - 1, INK);
    b.set(hx + 2, hy, PAL.magenta).set(hx + 3, hy, hot);
    b.set(hx + 4, hy - 1, alpha(PAL.magenta, 0.6));
    if (p.eyes === 'blaze')
      b.set(hx + 5, hy - 1, alpha(PAL.pink, 0.55)).set(hx + 6, hy - 2, alpha(PAL.pink, 0.3));
  }
  b.set(hx + 2, hy + 1, PAL.purple).set(hx + 2, hy + 2, '#2b1440');
  b.set(hx + 4, hy + 3, PAL.darkRed);
  // gold star of the Order on the brow
  b.set(hx + 3, hy - 3, PAL.yellow)
    .set(hx + 3, hy - 2, PAL.gold)
    .set(hx + 2, hy - 3, PAL.gold)
    .set(hx + 4, hy - 3, PAL.rust);
  // ---- coral staff
  const staffAt = (grip: Pt, dir: Pt, up: number, down: number): Pt => {
    const n = Math.hypot(dir[0], dir[1]) || 1;
    const d: Pt = [dir[0] / n, dir[1] / n];
    const top: Pt = [grip[0] + d[0] * up, grip[1] + d[1] * up];
    const bot: Pt = [grip[0] - d[0] * down, grip[1] - d[1] * down];
    const l = new Buf(W, H);
    stroke(l, dense([bot, grip, top]), 2.2, 2.2, K);
    shade(l, [PAL.plum, PAL.darkRed, PAL.rust, PAL.orangeBrown], { rim: 0.35 });
    // twisted coral bands
    Buf.linePts(bot[0], bot[1], top[0], top[1]).forEach(([x, y], i) => {
      if (i % 4 === 0) l.tint(x, y, PAL.pink);
    });
    b.overlay(l, INK, 'all');
    // coral fork cradling the pearl
    const nx = -d[1];
    const ny = d[0];
    for (const s of [-1, 1]) {
      const c0: Pt = [top[0] - d[0] * 2, top[1] - d[1] * 2];
      const c1: Pt = [top[0] + nx * s * 3 + d[0] * 1.5, top[1] + ny * s * 3 + d[1] * 1.5];
      const c2: Pt = [c1[0] + d[0] * 2.5 - nx * s * 0.8, c1[1] + d[1] * 2.5 - ny * s * 0.8];
      const cl = new Buf(W, H);
      stroke(cl, dense([c0, c1, c2]), 1.8, 1.2, K);
      shade(cl, NE.coral, { rim: 0.35 });
      b.overlay(cl, INK, 'all');
    }
    const pc: Pt = [top[0] + d[0] * 1.5, top[1] + d[1] * 1.5];
    return pc;
  };
  let pearlAt: Pt;
  let grip: Pt;
  switch (p.staff) {
    case 'back':
      grip = [24 + X, 18 + Y];
      pearlAt = staffAt(grip, [-0.7, -0.72], 13, 13);
      break;
    case 'thrust':
      grip = [34 + X, 25 + Y];
      pearlAt = staffAt(grip, [0.96, 0.28], 10, 14);
      break;
    case 'cast':
      grip = [34 + X, 20 + Y];
      pearlAt = staffAt(grip, [0.55, -0.83], 15, 14);
      break;
    case 'high':
      grip = [33 + X, 17 + Y];
      pearlAt = staffAt(grip, [0.2, -1], 10, 20);
      break;
    default:
      grip = [37 + X, 27 + Y];
      pearlAt = staffAt(grip, [0.04, -1], 19, 20);
  }
  // near arm to the staff
  const nsh: Pt = [28 + X, 23 + Y];
  const near = new Buf(W, H);
  stroke(near, dense([nsh, [(nsh[0] + grip[0]) / 2, (nsh[1] + grip[1]) / 2 + 1.5], grip]), 2.8, 2.2, K);
  shade(near, NE.skin, { rim: 0.25 });
  b.overlay(near, INK, 'all');
  b.set(grip[0], grip[1], NE.skin[1]).set(grip[0] - 1, grip[1], NE.skin[0]);
  // gold armlet
  const am: Pt = [(nsh[0] * 2 + grip[0]) / 3, (nsh[1] * 2 + grip[1]) / 3];
  b.set(am[0], am[1], PAL.gold).set(am[0], am[1] + 1, PAL.rust);
  // the dusk pearl
  const pr = 2.4 + (p.pearl >= 3 ? 0.5 : 0);
  b.overlay(
    lay(W, H, NE.pearl, (l) => l.ellipse(pearlAt[0], pearlAt[1], pr, pr, K), {
      rim: 0.2,
      bias: p.pearl * 0.05,
    }),
    PAL.purple,
    'all',
  );
  b.set(pearlAt[0] - 1, pearlAt[1] - 1, '#ffffff');
  if (p.pearl % 2 === 1 || p.pearl >= 3) b.set(pearlAt[0] + 1, pearlAt[1] + 1, PAL.pink);
  b.outline(INK);
  // pearl glow (outside the outline)
  const gl = p.pearl >= 3 ? 0.55 : 0.25 + p.pearl * 0.08;
  for (let a = 0; a < 12; a++) {
    const t = (a / 12) * TAU + f * 0.3;
    const x = Math.round(pearlAt[0] + Math.cos(t) * (pr + 2.2));
    const y = Math.round(pearlAt[1] + Math.sin(t) * (pr + 2.2));
    if (!b.has(x, y)) b.set(x, y, alpha(a % 3 ? PAL.magenta : PAL.pink, gl));
  }

  // ---- tidal magic
  const WATER: Col[] = ['#ffffff', '#c9fbff', PAL.cyan, PAL.sky, PAL.blue];
  /** A 2px blob of water; `v` 0 = foam .. 4 = deep. */
  const splash = (x: number, y: number, v: number, behind = false): void => {
    const c = WATER[Math.max(0, Math.min(4, Math.round(v)))];
    for (const [dx, dy] of [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ] as const) {
      const xx = Math.round(x) + dx;
      const yy = Math.round(y) + dy;
      if (behind && b.has(xx, yy)) continue;
      b.set(xx, yy, dy === 0 && dx === 0 ? c : WATER[Math.min(4, Math.round(v) + 1)]);
    }
  };
  if (p.hand === 'reach' && anim === 'cast') {
    // a bubble forming in the free hand
    const c: Pt = [40 + X, 20 + Y];
    b.ring(c[0], c[1], 2.6 + f * 0.7, 1, alpha(PAL.cyan, 0.9));
    b.ellipse(c[0], c[1], 1.8 + f * 0.7, 1.8 + f * 0.7, alpha(PAL.sky, 0.35));
    b.set(c[0] - 1, c[1] - 1, '#ffffff');
  }
  if (p.water >= 1 && anim === 'attack') {
    // a crescent of water flung off the pearl
    for (let k = 0; k < 9; k++) {
      const t = k / 8;
      const a = -1.2 + t * 2.2;
      splash(pearlAt[0] + 1 + Math.cos(a) * 6, pearlAt[1] + Math.sin(a) * 7, k % 3 === 0 ? 0 : 1 + (k % 2));
    }
  }
  if (anim === 'special') {
    // a column of water spiralling up around her, then a wave rolling outward
    const turns = p.water >= 2 ? 1.6 : 0.9;
    const n = 42;
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const a = t * TAU * turns + f * 1.1;
      const rx = 19 - t * 7;
      const x = 26 + Math.cos(a) * rx;
      const y = 50 - t * (8 + p.water * 9) + Math.sin(a) * 3.5;
      const back = Math.sin(a) < 0;
      splash(x, y, back ? 3 : k % 5 === 0 ? 0 : 1 + (k % 3 === 0 ? 1 : 0), back);
    }
    if (p.water >= 3) {
      for (let k = 0; k < 48; k++) {
        const a = (k / 48) * TAU;
        const x = 26 + Math.cos(a) * 25;
        const y = 50 + Math.sin(a) * 4.5;
        splash(x, y, Math.sin(a) < 0 ? 3 : k % 4 === 0 ? 0 : 2, Math.sin(a) < 0);
      }
      const r = rng(31);
      for (let i = 0; i < 16; i++) {
        const a = r() * TAU;
        splash(26 + Math.cos(a) * (22 + r() * 5), 46 + Math.sin(a) * 4 - r() * 6, r() < 0.4 ? 0 : 2, true);
      }
    }
  }
  if (p.eyes !== 'shut' && anim !== 'hurt') {
    // drifting motes of dusk
    const r = rng(20 + f + (anim === 'idle' ? 0 : 7));
    for (let i = 0; i < 4; i++) {
      const x = Math.round(4 + r() * 46);
      const y = Math.round(20 + r() * 30);
      if (!b.has(x, y)) b.set(x, y, alpha(i % 2 ? PAL.magenta : PAL.pink, 0.7));
    }
  }
  // centre her mass on the frame so the mirrored (left-facing) frame lines up
  return b.place(W, H, 2, 0);
}

// ============================================================== VOLTARIS ===

const VO = {
  feather: [INK, PAL.navy, '#1d3560', PAL.blue, '#2f6aa3'] as Ramp,
  tipF: [PAL.navy, PAL.darkSlate, PAL.slate, PAL.gray] as Ramp,
  covert: [PAL.navy, '#23365e', '#2f4a7a', PAL.slate, PAL.gray] as Ramp,
  body: [INK, PAL.navy, '#1d3560', '#2a4f86'] as Ramp,
  chest: [PAL.navy, PAL.darkSlate, PAL.slate, PAL.gray] as Ramp,
  beak: [PAL.darkBrown, PAL.orange, PAL.gold, PAL.yellow] as Ramp,
  leg: [PAL.darkBrown, PAL.rust, PAL.orange, PAL.gold] as Ramp,
  claw: [PAL.darkSlate, PAL.lightGray, '#ffffff'] as Ramp,
};

/**
 * A jagged lightning arc from a to c: white core, cyan fringe. `jag` is the
 * max sideways kink, `seg` the number of kinks.
 */
function lightning(b: Buf, a: Pt, c: Pt, seed: number, jag = 2.5, seg = 5, fringe: Col = PAL.cyan): void {
  const r = rng(seed);
  const dx = c[0] - a[0];
  const dy = c[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const pts: Pt[] = [a];
  for (let i = 1; i < seg; i++) {
    const t = i / seg;
    const o = (i % 2 ? 1 : -1) * (0.4 + r() * 0.6) * jag;
    pts.push([a[0] + dx * t + nx * o, a[1] + dy * t + ny * o]);
  }
  pts.push(c);
  const core: Pt[] = [];
  for (let i = 0; i + 1 < pts.length; i++)
    core.push(...Buf.linePts(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]));
  const glowC = alpha(fringe, 0.8);
  for (const [x, y] of core)
    for (const [ox, oy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const)
      if (b.get(x + ox, y + oy) !== '#ffffff') b.set(x + ox, y + oy, glowC);
  for (const [x, y] of core) b.set(x, y, '#ffffff');
}

interface RocPose {
  /** Wing elevation per side (radians, + = raised). */
  wl: number;
  wr: number;
  by: number;
  beak: 'shut' | 'open' | 'scream';
  eyes: 'glow' | 'blaze' | 'shut';
  talons: 'tuck' | 'hang' | 'strike';
  /** Crackle intensity 0-4. */
  zap: number;
  headTilt: number;
}

interface WingPts {
  sh: Pt;
  wrist: Pt;
  tip: Pt;
  /** A few points on the feathers, for lightning to jump between. */
  mid: Pt[];
}

function unit(a: Pt, c: Pt): Pt {
  const dx = c[0] - a[0];
  const dy = c[1] - a[1];
  const n = Math.hypot(dx, dy) || 1;
  return [dx / n, dy / n];
}

/** One broad, fingered wing seen from the front. s = -1 left, 1 right. */
function rocWing(b: Buf, cx: number, s: number, wa: number, by: number): WingPts {
  const W = b.w;
  const H = b.h;
  const sh: Pt = [cx + s * 5, 21 + by];
  const wr: Pt = [sh[0] + s * Math.cos(wa) * 11, sh[1] - 1 - Math.sin(wa) * 11];
  const ha = wa - 0.35;
  const tip: Pt = [wr[0] + s * Math.cos(ha) * 12, wr[1] - Math.sin(ha) * 12];
  const dh = unit(wr, tip);
  const da = unit(sh, wr);
  // the normal that points away from the leading edge (toward the trailing feathers)
  const trail = (d: Pt): Pt => {
    const n1: Pt = [-d[1], d[0]];
    return n1[1] >= 0 ? n1 : [d[1], -d[0]];
  };
  const nh = trail(dh);
  const na = trail(da);
  const mid: Pt[] = [];
  const feather = (base: Pt, d: Pt, len: number, wd: number): void => {
    const l = new Buf(W, H);
    const end: Pt = [base[0] + d[0] * len, base[1] + d[1] * len];
    stroke(l, bez(base, [base[0] + d[0] * len * 0.5, base[1] + d[1] * len * 0.5], end, 14), wd, 2.2, K);
    shade(l, VO.feather, { rim: 0.25, lx: -0.5 * s, ly: -1 });
    // pale banded tip
    l.each((_c, x, y) => {
      const t = ((x + 0.5 - base[0]) * d[0] + (y + 0.5 - base[1]) * d[1]) / len;
      if (t > 0.78) l.set(x, y, t > 0.9 ? VO.tipF[2] : VO.tipF[1]);
    });
    b.overlay(l, INK, 'all');
    mid.push([base[0] + d[0] * len * 0.6, base[1] + d[1] * len * 0.6]);
  };
  // primaries: long fingers fanning off the hand (outermost first)
  const NP = 6;
  for (let k = NP - 1; k >= 0; k--) {
    const t = k / (NP - 1);
    const base: Pt = [wr[0] + (tip[0] - wr[0]) * (0.1 + t * 0.9), wr[1] + (tip[1] - wr[1]) * (0.1 + t * 0.9)];
    const m = 0.08 + t * 0.5;
    const d: Pt = [nh[0] * (1 - m) + dh[0] * m, nh[1] * (1 - m) + dh[1] * m];
    const n = Math.hypot(d[0], d[1]) || 1;
    feather(base, [d[0] / n, d[1] / n], 12.5 + Math.sin(t * Math.PI) * 3 - t * 1.5, 4.5);
  }
  // secondaries hanging off the arm
  const NS = 5;
  for (let k = NS - 1; k >= 0; k--) {
    const t = k / (NS - 1);
    const base: Pt = [sh[0] + (wr[0] - sh[0]) * t, sh[1] + (wr[1] - sh[1]) * t + 1];
    const d: Pt = [na[0] - s * 0.15 * (1 - t), na[1]];
    const n = Math.hypot(d[0], d[1]) || 1;
    feather(base, [d[0] / n, d[1] / n], 11 + t, 5.5);
  }
  // coverts: scalloped band along the leading edge
  const cov = new Buf(W, H);
  cov.poly(
    [
      [sh[0] - s * 2, sh[1] - 2.5],
      [wr[0], wr[1] - 2],
      [tip[0] + dh[0] * 1, tip[1] + dh[1] * 1 - 1],
      [tip[0] - dh[0] * 4 + nh[0] * 3, tip[1] - dh[1] * 4 + nh[1] * 3],
      [wr[0] + nh[0] * 6, wr[1] + nh[1] * 6],
      [sh[0] + na[0] * 6.5, sh[1] + na[1] * 6.5],
    ],
    K,
  );
  shade(cov, VO.covert, { rim: 0.3, lx: -0.3 * s, ly: -1 });
  // rows of small overlapping feathers
  cov.each((_c, x, y) => {
    const along = (x - sh[0]) * dh[0] * s + (y - sh[1]) * dh[1];
    const across = (x - sh[0]) * nh[0] + (y - sh[1]) * nh[1];
    const row = Math.floor(across / 3);
    if (Math.abs(((along + row * 1.5) % 3) - 1.5) < 0.5 && across > 1) cov.set(x, y, VO.covert[0]);
  });
  b.overlay(cov, INK, 'all');
  // bright leading edge
  for (const [x, y] of [
    ...Buf.linePts(sh[0] - s, sh[1] - 2.5, wr[0], wr[1] - 2),
    ...Buf.linePts(wr[0], wr[1] - 2, tip[0], tip[1] - 1),
  ])
    if (b.has(x, y) && b.get(x, y) !== INK) b.set(x, y, VO.covert[3]);
  return { sh, wrist: wr, tip, mid };
}

function voltaris(anim: AnimName, f: number): Buf {
  const W = 64;
  const H = 64;
  const b = new Buf(W, H);
  const flap = [0.95, 0.35, -0.35, 0.35][f % 4];
  const p: RocPose = {
    wl: flap,
    wr: flap,
    by: [0, 1, 2, 1][f % 4],
    beak: 'shut',
    eyes: 'glow',
    talons: 'hang',
    zap: 1,
    headTilt: 0,
  };
  if (anim === 'move') {
    const m = [1.05, 0.3, -0.45, 0.3][f % 4];
    Object.assign(p, { wl: m, wr: m, talons: 'tuck' });
  } else if (anim === 'attack') {
    if (f === 0) Object.assign(p, { wl: 1.15, wr: 1.15, by: -2, beak: 'scream', talons: 'tuck', zap: 1 });
    else
      Object.assign(p, { wl: -0.5, wr: -0.5, by: 3, beak: 'open', eyes: 'blaze', talons: 'strike', zap: 2 });
  } else if (anim === 'special') {
    if (f === 0) Object.assign(p, { wl: 1.1, wr: 1.1, by: 0, eyes: 'blaze', talons: 'tuck', zap: 2 });
    else if (f === 1) Object.assign(p, { wl: 0.5, wr: 0.5, by: -1, beak: 'scream', eyes: 'blaze', zap: 3 });
    else Object.assign(p, { wl: 0.75, wr: 0.75, by: -2, beak: 'scream', eyes: 'blaze', zap: 4 });
  } else if (anim === 'hurt') {
    Object.assign(p, { wl: 0.15, wr: -0.3, by: -1, beak: 'open', eyes: 'shut', zap: 0, headTilt: 1 });
  }
  const cx = 32;
  const by = p.by;

  // ---- tail fan (behind everything), banded tips
  for (const k of [-2, 2, -1, 1, 0]) {
    const l = new Buf(W, H);
    const base: Pt = [cx + k, 34 + by];
    const end: Pt = [cx + k * 4.5, 47 + by - Math.abs(k) * 1.5];
    stroke(l, bez(base, [cx + k * 2.5, 41 + by], end, 14), 3.5, 5, K);
    shade(l, VO.feather, { rim: 0.25 });
    l.each((_c, x, y) => {
      if (y > end[1] - 3) l.set(x, y, y > end[1] - 1 ? VO.tipF[2] : VO.tipF[1]);
    });
    b.overlay(l, INK, 'all');
  }
  // ---- wings
  const wl = rocWing(b, cx, -1, p.wl, by);
  const wrg = rocWing(b, cx, 1, p.wr, by);

  // ---- legs: feathered thighs, golden scaled shins, black hooked talons
  const foot = (s: number): void => {
    let ankle: Pt = [cx + s * 5, 43 + by];
    let spread = 1;
    let big = 1;
    if (p.talons === 'tuck') {
      ankle = [cx + s * 4, 41 + by];
      spread = 0.55;
    } else if (p.talons === 'strike') {
      ankle = [cx + s * 9, 49 + by];
      spread = 1.5;
      big = 1.3;
    }
    const thigh = lay(W, H, VO.body, (l) => l.ellipse(cx + s * 4, 35 + by, 3.6, 4, K), { bias: 0.15 });
    b.overlay(thigh, INK, 'all');
    const knee: Pt = [cx + s * 4.2, 38 + by];
    const l = new Buf(W, H);
    stroke(l, dense([knee, ankle]), 3.2 * big, 2.6 * big, K);
    shade(l, VO.leg, { rim: 0.3 });
    b.overlay(l, INK, 'all');
    for (let y = Math.round(knee[1]) + 2; y < ankle[1]; y += 2)
      b.tint(Math.round((knee[0] + ankle[0]) / 2), y, PAL.rust);
    for (const k of [-1, 0, 1]) {
      const a = Math.PI / 2 + k * 0.6 * spread;
      const len = (k === 0 ? 3.2 : 2.6) * big;
      const toe: Pt = [ankle[0] + Math.cos(a) * len, ankle[1] + Math.sin(a) * len];
      const tl = new Buf(W, H);
      stroke(tl, dense([ankle, toe]), 2.2 * big, 1.8 * big, K);
      shade(tl, VO.leg, { rim: 0.3 });
      b.overlay(tl, INK, 'all');
      const hook = a + (k === 0 ? 0 : -k * 0.5);
      const clawTip: Pt = [toe[0] + Math.cos(hook) * 2.8 * big, toe[1] + Math.sin(hook) * 2.8 * big + 0.5];
      fang(b, toe, clawTip, 2.2, VO.claw);
    }
  };
  foot(-1);
  foot(1);

  // ---- body: a compact keel of storm-blue feathers
  b.overlay(
    lay(W, H, VO.body, (l) => {
      l.ellipse(cx, 28 + by, 7.5, 9, K);
      l.ellipse(cx, 21 + by, 7, 4.5, K);
    }),
    INK,
    'all',
  );
  const chest = lay(W, H, VO.chest, (l) => l.ellipse(cx, 30 + by, 4, 6.5, K), { rim: 0.15, bias: -0.15 });
  b.blitClip(chest);
  // chevron barring down the breast
  for (let row = 0; row < 4; row++) {
    const y = 26 + by + row * 3;
    for (let k = -3; k <= 3; k++) {
      const yy = y + Math.round(Math.abs(k) * 0.5) - 1;
      if (b.get(cx + k, yy) !== INK) b.tint(cx + k, yy, row % 2 ? PAL.navy : '#23365e');
    }
  }
  // hackles around the neck
  for (const k of [-3, 3, -2, 2, -1, 1, 0]) {
    const x = cx + k * 2.3;
    const y = 20 + by + Math.abs(k) * 0.7;
    const l = new Buf(W, H);
    tri(l, [x - 2.2, y - 2], [x + 2.2, y - 2], [x + k * 0.5, y + 4.5], K);
    shade(l, VO.feather, { rim: 0.3, bias: 0.3 });
    b.overlay(l, INK, 'all');
  }

  // ---- head
  const hx = cx + p.headTilt;
  const hy = 13 + by + p.headTilt;
  // crest: lightning-bolt horns of stiff feathers, plus a central spike
  const crest = (pts: Pt[], tipP: Pt): void => {
    const l = new Buf(W, H);
    l.poly(pts, K);
    shade(l, VO.feather, { rim: 0.35, bias: 0.35 });
    b.overlay(l, INK, 'all');
    b.tint(tipP[0], tipP[1], PAL.cyan);
  };
  for (const s of [-1, 1])
    crest(
      [
        [hx + s * 1, hy - 3],
        [hx + s * 7, hy - 7.5],
        [hx + s * 6.5, hy - 9],
        [hx + s * 13.5, hy - 12],
        [hx + s * 9, hy - 6.5],
        [hx + s * 9.5, hy - 5],
        [hx + s * 5, hy - 1],
      ],
      [hx + s * 12 - (s > 0 ? 1 : 0), hy - 11],
    );
  crest(
    [
      [hx - 2.5, hy - 3],
      [hx + 2.5, hy - 3],
      [hx + 1.5, hy - 8],
      [hx + 2.5, hy - 8.5],
      [hx + 0.5, hy - 14],
      [hx - 1, hy - 8.5],
      [hx - 2, hy - 8],
    ],
    [hx, hy - 12],
  );
  b.overlay(
    lay(
      W,
      H,
      VO.body,
      (l) => {
        l.ellipse(hx, hy, 7, 6, K);
        l.ellipse(hx, hy + 3, 5.5, 3.5, K);
      },
      { bias: 0.2 },
    ),
    INK,
    'all',
  );
  // hooked golden beak pointing at the camera
  const open = p.beak === 'scream' ? 3 : p.beak === 'open' ? 2 : 0;
  if (open) {
    const lo = lay(W, H, VO.beak, (l) =>
      l.poly(
        [
          [hx - 2.2, hy + 4],
          [hx + 2.6, hy + 4],
          [hx + 0.5, hy + 7 + open],
        ],
        K,
      ),
    );
    b.overlay(lo, INK, 'all');
    b.rect(hx - 1, hy + 4, 3, open + 1, PAL.navy);
    b.set(hx, hy + 5, open > 2 ? '#ffffff' : PAL.cyan).set(hx, hy + 4, PAL.cyan);
  }
  const bl = new Buf(W, H);
  bl.poly(
    [
      [hx - 3.2, hy + 0.5],
      [hx + 3.6, hy + 0.5],
      [hx + 1.8, hy + 5.5],
      [hx + 0.5, hy + 8 - (open ? 2 : 0)],
      [hx - 0.8, hy + 5.5],
    ],
    K,
  );
  shade(bl, VO.beak, { rim: 0.35 });
  b.overlay(bl, INK, 'all');
  b.set(hx - 1, hy + 1, '#fffbe0').set(hx, hy + 7 - (open ? 2 : 0), PAL.darkBrown);
  // heavy brows over burning white eyes
  for (const s of [-1, 1]) {
    const ex = hx + s * 3.5 - (s > 0 ? 1 : 0);
    const ey = hy - 1;
    b.hline(ex - 1, ex + 2, ey - 1, INK);
    b.set(s > 0 ? ex + 2 : ex - 1, ey, INK);
    b.set(s > 0 ? ex - 1 : ex + 2, ey - 2, INK);
    if (p.eyes === 'shut') {
      b.hline(ex, ex + 1, ey + 1, INK);
      continue;
    }
    const blaze = p.eyes === 'blaze';
    b.rect(ex, ey, 2, 2, '#ffffff');
    b.set(s > 0 ? ex : ex + 1, ey + 1, blaze ? '#ffffff' : PAL.cyan);
    const ox = s > 0 ? ex + 3 : ex - 2;
    b.set(ox, ey, alpha(PAL.cyan, 0.85));
    if (blaze) b.set(ox + s, ey - 1, alpha(PAL.cyan, 0.6)).set(ox + s * 2, ey - 1, alpha('#ffffff', 0.5));
  }
  b.outline(INK);

  // ---- lightning
  const wings = [wl, wrg];
  if (p.zap >= 1) {
    // arcs jumping between the flight feathers (alternating wings)
    wings.forEach((w, i) => {
      if ((f + i) % 2 === 0 || p.zap >= 2) {
        const a = w.mid[(f * 2 + i) % w.mid.length];
        const c = w.mid[(f * 2 + i + 4) % w.mid.length];
        lightning(b, a, c, f * 7 + i * 3 + 1, 2, 4);
      }
    });
    const t = wings[f % 2].tip;
    b.set(t[0], t[1] - 2, '#ffffff').set(t[0] + 1, t[1] - 3, alpha(PAL.cyan, 0.8));
  }
  if (p.zap >= 2) {
    wings.forEach((w, i) => {
      lightning(b, w.sh, w.wrist, f * 11 + i + 5, 2.2, 4);
      lightning(b, w.wrist, w.tip, f * 13 + i + 9, 2, 4);
    });
  }
  if (p.talons === 'strike') {
    for (const s of [-1, 1]) {
      lightning(b, [cx + s * 9, 53 + by], [cx + s * 15, 63], 40 + s, 2, 4);
      lightning(b, [cx + s * 9, 53 + by], [cx + s * 4, 63], 50 + s, 1.5, 3);
    }
  }
  if (p.zap >= 3) {
    // static crawling over the whole silhouette
    const r = rng(70 + f);
    for (let i = 0; i < 30; i++) {
      const a = r() * TAU;
      const d = 16 + r() * 14;
      const x = cx + Math.cos(a) * d * 1.1;
      const y = 26 + by + Math.sin(a) * d * 0.8;
      if (!b.has(x, y)) b.set(x, y, i % 3 ? alpha(PAL.cyan, 0.9) : '#ffffff');
    }
  }
  if (p.zap >= 4) {
    // bolts hammer down from the wingtips and talons
    wings.forEach((w, i) => {
      const s = i === 0 ? -1 : 1;
      lightning(b, w.tip, [w.tip[0] + s * 2, 63], 90 + i * 13, 3, 7);
    });
    lightning(b, [cx, 46 + by], [cx - 1, 63], 97, 2.5, 4);
  }
  if (anim === 'hurt') {
    // loose feathers knocked free
    for (const [x, y] of [
      [8, 44],
      [55, 36],
      [47, 54],
    ] as const)
      b.set(x, y, PAL.slate)
        .set(x + 1, y + 1, PAL.darkSlate)
        .set(x + 2, y + 1, PAL.navy);
  }
  return b;
}

// ============================================================== AURELIAN ===

const AU = {
  robe: [PAL.gray, PAL.lightGray, '#eef1f6', PAL.white] as Ramp,
  robeFar: [PAL.slate, PAL.gray, PAL.lightGray] as Ramp,
  cape: [PAL.darkSlate, PAL.slate, PAL.gray] as Ramp,
  gold: [PAL.darkBrown, PAL.orange, PAL.gold, PAL.yellow] as Ramp,
  goldFar: [PAL.darkBrown, PAL.rust, PAL.orange] as Ramp,
  hair: ['#a88d5e', '#dcc79a', '#f5ebc8', '#fffbe8'] as Ramp,
  skin: ['#d3a78f', '#f0cfb9', '#fbe9dc'] as Ramp,
  blade: [PAL.orange, PAL.gold, PAL.yellow, '#fffbe0', '#ffffff'] as Ramp,
  lining: [INK, '#1f1a2e', PAL.navy] as Ramp,
};

/** The black sun: a dark disc ringed by a burning corona with rays. */
function eclipse(b: Buf, cx: number, cy: number, r: number, rays: number, flare: number, rot: number): void {
  // rays: alternating long / short spikes
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * TAU + rot;
    const len = (i % 2 ? 2.2 : 3.6) + flare;
    const p0 = polar(cx, cy, r + 0.5, a);
    const p1 = polar(cx, cy, r + len, a);
    const pts = Buf.linePts(p0[0], p0[1], p1[0], p1[1]);
    pts.forEach(([x, y], k) => b.set(x, y, k < pts.length / 2 ? PAL.gold : alpha(PAL.yellow, 0.75)));
  }
  b.ellipse(cx, cy, r + 1.2, r + 1.2, PAL.gold);
  b.ring(cx, cy, r + 1.2, 0.8, PAL.yellow);
  b.ellipse(cx, cy, r, r, INK);
  // thin inner rim of light on the dark disc (bottom-right)
  for (let a = 0.2; a < 1.6; a += 0.12) {
    const [x, y] = polar(cx, cy, r - 0.4, a);
    b.set(x, y, PAL.orange);
  }
  b.ellipse(cx - 0.4, cy - 0.4, r - 1.2, r - 1.2, '#0d0a14');
}

/** Soft corona around an eclipse, only on empty pixels (call after outlining). */
function eclipseGlow(b: Buf, cx: number, cy: number, r: number, flare: number): void {
  if (flare < 0) return;
  const R = r + 2.5 + flare;
  for (let y = Math.floor(cy - R); y <= cy + R; y++)
    for (let x = Math.floor(cx - R); x <= cx + R; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d > R || b.has(x, y) || (x + y) % 2 !== 0) continue;
      b.set(x, y, alpha(d < R - 1.5 ? PAL.yellow : PAL.gold, 0.3 + flare * 0.1));
    }
}

interface KnightPose {
  X: number;
  Y: number;
  sword: 'plant' | 'carry' | 'wind' | 'slash' | 'salute' | 'slam';
  hand: 'pommel' | 'cast';
  eyes: 'calm' | 'blaze' | 'shut';
  step: number;
  halo: number;
  cape: number;
}

function aurelian(anim: AnimName, f: number): Buf {
  const W = 40;
  const H = 48;
  const b = new Buf(W, H);
  const p: KnightPose = {
    X: 0,
    Y: [0, 0, 1, 1][f % 4],
    sword: 'plant',
    hand: 'pommel',
    eyes: 'calm',
    step: 0,
    halo: 0,
    cape: [0, 1, 1, 0][f % 4],
  };
  if (anim === 'move') Object.assign(p, { X: 1, Y: f % 2, sword: 'carry', step: f, cape: -2 - (f % 2) });
  else if (anim === 'attack') {
    if (f === 0) Object.assign(p, { X: -1, Y: 0, sword: 'wind', eyes: 'blaze', cape: 1 });
    else Object.assign(p, { X: 2, Y: 1, sword: 'slash', eyes: 'blaze', cape: -2 });
  } else if (anim === 'cast') Object.assign(p, { hand: 'cast', eyes: 'blaze', halo: 1 + f });
  else if (anim === 'special') {
    if (f < 2) Object.assign(p, { Y: 0, sword: 'salute', eyes: 'blaze', halo: 1 + f * 2 });
    else Object.assign(p, { X: 1, Y: 2, sword: 'slam', eyes: 'blaze', halo: 2, cape: -1 });
  } else if (anim === 'hurt') Object.assign(p, { X: -2, Y: 1, eyes: 'shut', halo: -1, cape: 2 });
  const X = p.X;
  const Y = p.Y;
  const hx = 20 + X;
  const hy = 11 + Y;
  const sway = p.cape;
  const stepA = [0, 1, 0, -1][p.step % 4];

  // ---- the black sun behind his head
  const hr = 4.8 + Math.max(0, Math.min(1, p.halo * 0.4));
  eclipse(b, hx - 2.5, hy - 1, hr, 12, p.halo < 0 ? -1 : p.halo * 0.8, f * 0.13);

  // ---- cape (in his own shadow): pale outside, black lining, gold hem
  const cape = new Buf(W, H);
  cape.poly(
    [
      [17 + X, 16 + Y],
      [20 + X, 16 + Y],
      [18 + X * 0.5, 30],
      [17, 46],
      [13 + sway * 0.5, 47],
      [9 + sway, 46],
      [10.5 + sway * 0.8, 36],
      [13.5 + X * 0.5 + sway * 0.3, 24 + Y],
    ],
    K,
  );
  shade(cape, AU.cape, { rim: 0.25 });
  cape.each((_c, x, y) => {
    if (!cape.has(x - 1, y) || !cape.has(x - 2, y)) cape.set(x, y, y > 30 ? AU.lining[1] : AU.lining[2]);
  });
  for (let x = 0; x < W; x++) {
    for (let y = H - 1; y >= 0; y--) {
      if (!cape.has(x, y)) continue;
      cape.set(x, y, PAL.gold);
      if (cape.has(x, y - 1)) cape.set(x, y - 1, PAL.orange);
      break;
    }
  }
  b.overlay(cape, INK, 'all');

  // ---- long platinum hair falling down his back
  const hair = lay(W, H, AU.hair, (l) => {
    l.poly(
      [
        [hx - 2.5, hy - 3.2],
        [hx + 0.5, hy - 3.6],
        [hx - 1.5, hy + 4],
        [hx - 3 + sway * 0.3, hy + 11],
        [hx - 4 + sway * 0.6, hy + 17],
        [hx - 6.5 + sway * 0.5, hy + 14],
        [hx - 5, hy + 3],
      ],
      K,
    );
  });
  b.overlay(hair, INK, 'all');
  b.line(hx - 4.5, hy + 4, hx - 5 + sway * 0.5, hy + 13, AU.hair[0]);
  b.line(hx - 3, hy + 5, hx - 4 + sway * 0.4, hy + 12, AU.hair[3]);

  // ---- feet (gold sabatons under the robe)
  for (const [fx, far] of [
    [15.5 - stepA, true],
    [20.5 + stepA, false],
  ] as const) {
    b.overlay(
      lay(W, H, far ? AU.goldFar : AU.gold, (l) => {
        l.rect(fx + X * 0.5, 44, 3, 3, K);
        l.rect(fx + X * 0.5 + 2, 45, 3, 2, K);
      }),
      INK,
      'all',
    );
  }

  // ---- robe: long white skirt with a gold front edge and hem
  const skirt = lay(W, H, AU.robe, (l) => {
    l.poly(
      [
        [16.8 + X, 27 + Y],
        [23.2 + X, 27 + Y],
        [24 + X * 0.6 + stepA * 0.3, 36],
        [25.5 + stepA, 45],
        [15 - stepA * 0.5, 45],
        [15.8 + X * 0.6, 36],
      ],
      K,
    );
  });
  // fold shadows
  skirt.each((_c, x, y) => {
    const t = (y - 27 - Y) / (18 - Y);
    if (Math.abs(x - (19.5 + X * (1 - t) + t * stepA * 0.4)) < 0.5 && y > 30 + Y) skirt.set(x, y, AU.robe[1]);
  });
  b.overlay(skirt, INK, 'all');
  for (let y = 28 + Y; y <= 44; y++) {
    // gold trim down the leading edge of the robe
    for (let x = W - 1; x >= 0; x--) {
      const c = b.get(x, y);
      if (c === null || c === INK) continue;
      b.set(x, y, PAL.gold);
      break;
    }
  }
  for (let x = 0; x < W; x++) {
    const c = b.get(x, 44);
    if (c !== null && c !== INK && skirt.has(x, 44))
      b.set(x, 44, PAL.gold).set(x, 43, x % 3 === 0 ? PAL.yellow : b.get(x, 43));
  }

  const arm = (sh: Pt, hand: Pt, far: boolean): void => {
    const l = new Buf(W, H);
    stroke(l, dense([sh, [(sh[0] + hand[0]) / 2 - 0.5, (sh[1] + hand[1]) / 2 + 1], hand]), 3, 2.4, K);
    shade(l, far ? AU.robeFar : AU.robe, { rim: 0.25 });
    b.overlay(l, INK, 'all');
    // gold vambrace + gauntlet
    const mx = (sh[0] + hand[0] * 2) / 3;
    const my = (sh[1] + hand[1] * 2) / 3 + 0.5;
    b.tint(mx, my, far ? PAL.orange : PAL.gold);
    b.set(hand[0], hand[1], far ? PAL.orange : PAL.gold).set(
      hand[0] - 1,
      hand[1],
      far ? PAL.rust : PAL.orange,
    );
  };
  const shN: Pt = [20 + X, 18.5 + Y];
  const shF: Pt = [18 + X, 18.5 + Y];
  interface Grip {
    grip: Pt;
    dir: Pt;
    len: number;
    hot: boolean;
    far: Pt;
    near: Pt;
  }
  const g = (grip: Pt, dir: Pt, len: number, hot: boolean, far: Pt, near: Pt = grip): Grip => ({
    grip,
    dir,
    len,
    hot,
    far,
    near,
  });
  let cfg: Grip;
  switch (p.sword) {
    case 'carry':
      cfg = g([24 + X, 26 + Y], [0.62, 0.78], 19, false, [22 + X, 26 + Y]);
      break;
    case 'wind':
      cfg = g([18 + X, 12 + Y], [-0.72, -0.7], 14, false, [18 + X, 13 + Y]);
      break;
    case 'slash':
      cfg = g([27 + X, 24 + Y], [0.55, 0.84], 18, true, [26 + X, 24 + Y]);
      break;
    case 'salute':
      cfg = g([25 + X, 25 + Y], [0.05, -1], 19, p.halo >= 3, [24 + X, 25 + Y], [25 + X, 26 + Y]);
      break;
    case 'slam':
      cfg = g([27 + X, 24 + Y], [0.1, 1], 18, true, [26 + X, 24 + Y]);
      break;
    default:
      // both hands resting on the pommel, blade planted before him
      cfg =
        p.hand === 'cast'
          ? g([27 + X, 22 + Y], [0, 1], 21 - Y, false, [26 + X, 22 + Y], [28 + X, 14 + Y])
          : g([27 + X, 22 + Y], [0, 1], 21 - Y, false, [26 + X, 22 + Y]);
  }
  // the far arm sits behind the body
  arm(shF, cfg.far, true);

  // ---- torso: white robe beneath a gold breastplate
  b.overlay(
    lay(W, H, AU.robe, (l) => {
      l.poly(
        [
          [16.8 + X, 28 + Y],
          [23.2 + X, 28 + Y],
          [23.6 + X, 20 + Y],
          [22 + X, 16 + Y],
          [17.5 + X, 16 + Y],
          [16 + X, 20 + Y],
        ],
        K,
      );
    }),
    INK,
    'all',
  );
  b.overlay(
    lay(
      W,
      H,
      AU.gold,
      (l) => {
        l.poly(
          [
            [18.5 + X, 17 + Y],
            [23 + X, 17.5 + Y],
            [23.9 + X, 21 + Y],
            [22.6 + X, 25 + Y],
            [18.8 + X, 25 + Y],
          ],
          K,
        );
      },
      { rim: 0.3, bias: 0.3 },
    ),
    PAL.darkBrown,
    'all',
  );
  // black-sun emblem on the breastplate
  b.set(21 + X, 20 + Y, INK)
    .set(22 + X, 20 + Y, INK)
    .set(21 + X, 21 + Y, INK)
    .set(22 + X, 21 + Y, '#0d0a14');
  b.set(21 + X, 19 + Y, PAL.yellow)
    .set(23 + X, 21 + Y, PAL.yellow)
    .set(20 + X, 20 + Y, PAL.orange)
    .set(22 + X, 22 + Y, PAL.orange);
  // belt
  b.hline(17 + X, 23 + X, 26 + Y, PAL.gold).hline(17 + X, 23 + X, 27 + Y, PAL.darkBrown);
  b.set(22 + X, 26 + Y, PAL.yellow);
  // high collar
  b.rect(18 + X, 14 + Y, 3, 2, PAL.gold).set(18 + X, 14 + Y, PAL.yellow);

  // ---- head (profile, facing right)
  b.overlay(
    lay(W, H, AU.skin, (l) => {
      l.ellipse(hx, hy, 3, 3.3, K);
      l.poly(
        [
          [hx + 0.8, hy - 2.6],
          [hx + 3, hy - 1.2],
          [hx + 3.2, hy + 0.4],
          [hx + 3.9, hy + 1.3],
          [hx + 3.1, hy + 1.9],
          [hx + 2.7, hy + 3.1],
          [hx + 0.4, hy + 3.5],
        ],
        K,
      );
    }),
    INK,
    'all',
  );
  // hair: parted back from the brow, one lock framing the face
  const cap = lay(W, H, AU.hair, (l) => {
    l.poly(
      [
        [hx + 2.8, hy - 2.2],
        [hx + 1.2, hy - 3.8],
        [hx - 2, hy - 3.6],
        [hx - 3.2, hy - 0.5],
        [hx - 2.4, hy + 4],
        [hx - 1.2, hy + 4],
        [hx - 1, hy - 1.2],
        [hx + 1.4, hy - 2.2],
      ],
      K,
    );
  });
  b.overlay(cap, INK, 'all');
  // golden circlet
  b.hline(hx - 1, hx + 2, hy - 2, PAL.gold).set(hx + 2, hy - 2, PAL.yellow);
  // serene, half-lidded eye that burns gold
  if (p.eyes === 'shut') b.hline(hx + 1, hx + 2, hy, AU.skin[0]);
  else {
    b.hline(hx + 1, hx + 2, hy - 1, PAL.darkBrown);
    b.set(hx + 2, hy, p.eyes === 'blaze' ? '#ffffff' : PAL.yellow).set(hx + 1, hy, PAL.gold);
    if (p.eyes === 'blaze') b.set(hx + 3, hy - 1, alpha(PAL.yellow, 0.7));
  }
  b.set(hx + 3, hy + 2, AU.skin[0]);

  // ---- gold pauldron
  b.overlay(
    lay(W, H, AU.gold, (l) => l.ellipse(19.5 + X, 17.5 + Y, 3.1, 2.3, K), { rim: 0.35 }),
    INK,
    'all',
  );
  b.hline(17 + X, 22 + X, 18 + Y, PAL.orange).set(18 + X, 16 + Y, PAL.yellow);

  // ---- greatsword + arms
  const glows: [Pt, Pt, boolean][] = [];
  const sword = (grip: Pt, dir: Pt, len: number, hot: boolean): Pt => {
    const n = Math.hypot(dir[0], dir[1]) || 1;
    const d: Pt = [dir[0] / n, dir[1] / n];
    const nx = -d[1];
    const ny = d[0];
    const guard: Pt = [grip[0] + d[0] * 2, grip[1] + d[1] * 2];
    const tip: Pt = [guard[0] + d[0] * len, guard[1] + d[1] * len];
    glows.push([guard, tip, hot]);
    // blade: bright edge on the lit side, golden flat, white when blazing
    const bl = new Buf(W, H);
    stroke(bl, dense([guard, [tip[0] - d[0], tip[1] - d[1]]]), 3, 2.2, K);
    bl.set(tip[0], tip[1], K);
    bl.each((_c, x, y) => {
      const across = (x + 0.5 - guard[0]) * nx + (y + 0.5 - guard[1]) * ny;
      const v = hot ? 4 : across < -0.6 ? 3 : across > 0.6 ? 1 : 2;
      bl.set(x, y, AU.blade[v]);
    });
    b.overlay(bl, PAL.darkBrown, 'all');
    Buf.linePts(guard[0] + d[0] * 2, guard[1] + d[1] * 2, tip[0] - d[0] * 2, tip[1] - d[1] * 2).forEach(
      ([x, y], i) => {
        if (i % 6 === (f * 2) % 6) b.set(x, y, '#ffffff');
      },
    );
    // crossguard: sun wings with a black eclipse stone
    b.line(guard[0] - nx * 3, guard[1] - ny * 3, guard[0] + nx * 3, guard[1] + ny * 3, PAL.gold);
    b.set(guard[0] - nx * 3, guard[1] - ny * 3, PAL.yellow).set(
      guard[0] + nx * 3,
      guard[1] + ny * 3,
      PAL.orange,
    );
    b.set(guard[0], guard[1], INK);
    // grip + pommel
    const pom: Pt = [grip[0] - d[0] * 2, grip[1] - d[1] * 2];
    b.line(grip[0], grip[1], pom[0], pom[1], PAL.darkBrown);
    b.set(pom[0], pom[1], PAL.yellow);
    return tip;
  };
  const tip = sword(cfg.grip, cfg.dir, cfg.len, cfg.hot);
  arm(shN, cfg.near, false);
  b.outline(INK);

  // ---- light (drawn after the outline so it stays soft)
  eclipseGlow(b, hx - 2.5, hy - 1, hr, p.halo < 0 ? -1 : p.halo * 0.8);
  for (const [g0, g1, hot] of glows) {
    const gl = new Buf(W, H);
    stroke(gl, dense([g0, g1]), hot ? 7 : 5, 3, K);
    gl.each((_c, x, y) => {
      if (!b.has(x, y)) b.set(x, y, alpha(PAL.gold, hot ? 0.45 : 0.22));
    });
  }
  if (p.sword === 'slash') {
    // golden crescent left by the swing (thin at the start, bright at the blade)
    for (let k = 0; k <= 48; k++) {
      const t = k / 48;
      const a = -1.95 + t * 2.75;
      const w = 0.6 + t * 2.2;
      for (let dr = 0; dr < w; dr += 0.5) {
        const [x, y] = polar(21 + X, 22 + Y, 15.5 - dr, a);
        if (b.has(x, y)) continue;
        b.set(
          x,
          y,
          dr < 0.6 ? (t > 0.55 ? '#ffffff' : alpha(PAL.yellow, 0.9)) : alpha(PAL.gold, 0.3 + t * 0.5),
        );
      }
    }
  }
  if (p.hand === 'cast') {
    // a small black sun kindled above his open hand
    eclipse(b, 31 + X, 11 + Y, 1.8 + f * 0.6, 8, -1.2 + f * 0.6, f * 0.4);
  }
  if (anim === 'special') {
    if (f < 2) {
      // light converging on the raised blade
      const r = rng(60 + f);
      for (let i = 0; i < 10 + f * 8; i++) {
        const a = r() * TAU;
        const d = 5 + r() * (12 - f * 4);
        const x = tip[0] + Math.cos(a) * d;
        const y = tip[1] + 6 + Math.sin(a) * d;
        if (!b.has(x, y)) b.set(x, y, i % 3 ? alpha(PAL.yellow, 0.9) : '#ffffff');
      }
      if (f === 1) {
        for (let k = 1; k <= 3; k++) {
          const a = 1 - k * 0.25;
          b.set(tip[0], tip[1] - k, alpha(PAL.yellow, a));
          b.set(tip[0] - k, tip[1] + 1, alpha(PAL.yellow, a)).set(
            tip[0] + k,
            tip[1] + 1,
            alpha(PAL.yellow, a),
          );
        }
      }
    } else {
      // eclipse shockwave: a black ring edged in gold racing across the ground
      for (let k = 0; k < 80; k++) {
        const a = (k / 80) * TAU;
        const [x, y] = polar(21, 45, 18, a, 0.2);
        const [x2, y2] = polar(21, 45, 16.5, a, 0.2);
        const back = Math.sin(a) < 0;
        if (!back || !b.has(x, y)) b.set(x, y, k % 2 ? PAL.gold : PAL.yellow);
        if (!back || !b.has(x2, y2)) b.set(x2, y2, alpha(INK, 0.85));
      }
      // pillars of light
      for (const x of [5, 36, 32]) {
        for (let y = 26; y < 45; y++)
          if (!b.has(x, y)) b.set(x, y, alpha(y % 4 ? PAL.yellow : '#ffffff', 0.25 + (y - 26) * 0.035));
      }
      b.set(tip[0] - 2, 44, '#ffffff')
        .set(tip[0] + 2, 44, '#ffffff')
        .set(tip[0] - 3, 43, PAL.yellow)
        .set(tip[0] + 3, 43, PAL.yellow);
    }
  }
  return b;
}

// ================================================================== defs ===

export const ACT2_BOSS_DEFS = {
  boss_sandmaw: {
    info: {
      w: 64,
      h: 64,
      anchorX: 32,
      anchorY: 60,
      dirs: 1,
      anims: anims({ idle: [4, 4], attack: [2, 4], special: [4, 5], hurt: [1, 1] }),
    },
    draw: (a, f) => sandmaw(a, f),
  },
  boss_nereth: {
    info: {
      w: 56,
      h: 56,
      anchorX: 28,
      anchorY: 54,
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
    draw: (a, f) => nereth(a, f),
  },
  boss_voltaris: {
    info: {
      w: 64,
      h: 64,
      anchorX: 32,
      anchorY: 63,
      dirs: 1,
      anims: anims({ idle: [4, 6], move: [4, 8], attack: [2, 4], special: [3, 5], hurt: [1, 1] }),
    },
    draw: (a, f) => voltaris(a, f),
  },
  boss_aurelian: {
    info: {
      w: 40,
      h: 48,
      anchorX: 20,
      anchorY: 47,
      dirs: 2,
      anims: anims({
        idle: [4, 3],
        move: [4, 6],
        attack: [2, 5],
        cast: [2, 4],
        special: [3, 5],
        hurt: [1, 1],
      }),
    },
    draw: (a, f) => aurelian(a, f),
  },
} satisfies Partial<Record<BossId, SpriteDef>>;
