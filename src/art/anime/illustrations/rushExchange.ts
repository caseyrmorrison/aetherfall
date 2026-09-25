/**
 * Mid-air rush battle: afterimage clashes of Kai (cyan) and Malachar (purple)
 * popping around the sky with starburst impacts, speed lines, and one crisp
 * central pair locked in a blade clash. Loops (2.8s cycle).
 */
import { C, HEX } from '../pal';
import { Raster } from '../raster';
import { renderBust } from '../face';
import { kai } from '../characters/kai';
import { malachar } from '../characters/malachar';
import { rng, starPts, strand, type P } from '../geom';
import { blit, blitC, frame, glow, layer, sparkleSprite } from './kit';
import { cloudBand, ridge, ridgeFn, skyGradient } from './scenery';
import { speedLines } from '../fx';
import { ditherMask } from './skyShatter';
import { OUTFIT, cape, legs, limb, part, scarfTail, type Who } from './figure';

type Pose = 'punch' | 'kick' | 'guard' | 'dash';

const POSES: Record<Pose, Record<string, P>> = {
  punch: {
    neck: [2, -20],
    head: [5, -27],
    eF: [11, -19],
    hF: [21, -20],
    eB: [-3, -12],
    hB: [5, -15],
    kF: [6, 6],
    fF: [2, 15],
    kB: [-8, 5],
    fB: [-17, 9],
  },
  kick: {
    neck: [-3, -19],
    head: [-4, -26],
    eF: [5, -15],
    hF: [3, -22],
    eB: [-9, -13],
    hB: [-15, -8],
    kF: [10, -3],
    fF: [22, -8],
    kB: [-4, 8],
    fB: [-6, 17],
  },
  guard: {
    neck: [0, -20],
    head: [1, -27],
    eF: [8, -17],
    hF: [5, -25],
    eB: [7, -14],
    hB: [7, -22],
    kF: [7, 5],
    fF: [4, 14],
    kB: [-5, 6],
    fB: [-9, 15],
  },
  dash: {
    neck: [8, -15],
    head: [13, -20],
    eF: [6, -7],
    hF: [-2, -2],
    eB: [2, -9],
    hB: [-6, -6],
    kF: [-8, 4],
    fF: [-17, 6],
    kB: [-10, -1],
    fB: [-19, -2],
  },
};

/** Single-color fighter silhouette (facing right unless flipped). */
function silhouetteSprite(who: Who, pose: Pose, ink: number, rim: number): HTMLCanvasElement {
  const D = 72;
  return layer(`rush/sil_${who}_${pose}_${ink}`, D, D, (r) => {
    const p = POSES[pose];
    const s = 1.35;
    r.setTransform(s, D / 2, D / 2 + 6);
    const J = (k: string): P => p[k];
    if (who === 'malachar') {
      // cape + long hair trailing behind
      const n = J('neck');
      r.poly([n[0], n[1], n[0] - 16, n[1] + 10, n[0] - 22, n[1] + 24, n[0] - 4, n[1] + 14], ink);
      const hd = J('head');
      r.poly(
        strand(
          [
            [hd[0], hd[1] - 2],
            [hd[0] - 10, hd[1] + 4],
            [hd[0] - 16, hd[1] + 12],
          ],
          7,
          {},
        ),
        ink,
      );
    }
    r.poly(strand([J('neck'), [0, 0]], 9, { tipW: 7 }), ink);
    for (const [a, b, c, wd] of [
      ['neck', 'eB', 'hB', 4.2],
      ['neck', 'eF', 'hF', 4.2],
    ] as const) {
      r.poly(strand([J(a), J(b)], wd, { tipW: wd * 0.9 }), ink);
      r.poly(strand([J(b), J(c)], wd * 0.9, { tipW: wd * 0.8 }), ink);
      r.ellipse(J(c)[0], J(c)[1], 2.2, 2.2, ink);
    }
    for (const [b, c] of [
      ['kB', 'fB'],
      ['kF', 'fF'],
    ] as const) {
      r.poly(strand([[0, 0], J(b)], 6, { tipW: 5 }), ink);
      r.poly(strand([J(b), J(c)], 5, { tipW: 4 }), ink);
    }
    const hd = J('head');
    r.ellipse(hd[0], hd[1], 4.8, 5.2, ink);
    if (who === 'kai') {
      for (const [dx, dy] of [
        [-6, -4],
        [-3, -7],
        [1, -7.5],
        [-7, 1],
      ]) {
        r.poly(
          strand(
            [
              [hd[0], hd[1] - 1],
              [hd[0] + dx, hd[1] + dy],
            ],
            4,
            {},
          ),
          ink,
        );
      }
    } else {
      r.poly(
        strand(
          [
            [hd[0] - 1, hd[1] - 3],
            [hd[0] - 3, hd[1] - 8],
            [hd[0] - 6, hd[1] - 10],
          ],
          2.4,
          {},
        ),
        ink,
      );
      r.poly(
        strand(
          [
            [hd[0] + 2, hd[1] - 3],
            [hd[0] + 3, hd[1] - 8],
            [hd[0] + 5, hd[1] - 10],
          ],
          2.4,
          {},
        ),
        ink,
      );
    }
    r.rim(rim, 1, 0);
    r.rim(rim, 0, -1);
    r.outline(C.white);
  });
}

function starburst(size: number, core: number, edge: number): HTMLCanvasElement {
  const d = size * 2 + 4;
  return layer(`rush/burst${size}_${core}`, d, d, (r) => {
    r.setTransform(1, 0, 0);
    r.fillPx(starPts(d / 2, d / 2, size, size * 0.38, 8, 0.2), edge);
    r.fillPx(starPts(d / 2, d / 2, size * 0.7, size * 0.25, 8, 0.2), core);
    r.ellipse(d / 2, d / 2, size * 0.28, size * 0.28, C.white);
  });
}

interface Spot {
  x: number;
  y: number;
  k: Pose;
  m: Pose;
  t0: number;
}

const CYCLE = 2.8;
const SPOTS: Spot[] = [
  { x: -150, y: 70, k: 'punch', m: 'guard', t0: 0 },
  { x: 140, y: 190, k: 'kick', m: 'punch', t0: 0.4 },
  { x: -170, y: 200, k: 'dash', m: 'kick', t0: 0.8 },
  { x: 165, y: 60, k: 'punch', m: 'punch', t0: 1.2 },
  { x: -60, y: 225, k: 'guard', m: 'kick', t0: 1.6 },
  { x: 70, y: 40, k: 'kick', m: 'guard', t0: 2.0 },
  { x: -215, y: 130, k: 'punch', m: 'dash', t0: 2.4 },
];

/** Central crisp pair locked in a blade clash. */
function drawDuelist(r: Raster, who: Who, w: number, ph: number): void {
  const flip = who === 'malachar';
  r.place(0.66, flip ? -0.08 : 0.08, 51, 50, w / 2 + (flip ? 60 : -60), 116, flip);
  const o = OUTFIT[who];
  if (who === 'malachar') cape(r, ph, 18);
  else scarfTail(r, ph, false, 8);
  limb(
    r,
    o,
    [
      [82, 92],
      [100, 106],
      [98, 97],
    ],
    12,
    10,
    o.sleeve,
    o.sleeveSh,
    o.fore,
    o.foreSh,
    who === 'kai',
  );
  legs(r, o, [40, 132], [20, 148], [2, 166], [62, 132], [82, 144], [72, 166]);
  const bust = new Raster(r.w, r.h).copyTransform(r);
  renderBust(bust, who === 'kai' ? kai : malachar, 'angry', {
    variant: 'full',
    windX: -7,
    windY: -2,
    phase: ph,
    iris: who === 'kai' ? [C.blue, C.cyan, C.white] : undefined,
    noMarks: true,
  });
  r.over(bust);
  // sword / blade held with both hands, rising toward the opponent
  part(r, C.black, (p) => {
    if (who === 'kai') {
      p.poly([100, 94, 104, 98, 196, 30, 192, 26], C.lightGray);
      p.poly([100, 94, 102, 96, 194, 28, 192, 26], C.white);
      p.stroke([96, 90, 108, 102], 3, 3, C.gold);
      p.stroke([92, 104, 99, 97], 3.2, 3.2, C.darkBrown);
    } else {
      p.poly([100, 94, 105, 99, 190, 40, 186, 34], C.purple);
      p.poly([100, 94, 102, 96, 188, 37, 186, 34], C.magenta);
      p.stroke([96, 90, 108, 102], 3, 3, C.black);
      p.stroke([92, 104, 99, 97], 3.2, 3.2, C.darkRed);
    }
  });
  limb(
    r,
    o,
    [
      [18, 94],
      [62, 110],
      [96, 99],
    ],
    13,
    10.5,
    o.sleeve,
    o.sleeveSh,
    o.fore,
    o.foreSh,
    who === 'kai',
  );
  part(r, o.line, (p) => {
    p.ellipse(97, 99, 5, 4.4, o.hand);
    p.ellipse(101, 95, 4.4, 4, o.hand);
  });
}

let crossCache: { w: number; p: [number, number] } | null = null;
function bladeCross(w: number): [number, number] {
  if (crossCache && crossCache.w === w) return crossCache.p;
  const a = new Raster(1, 1).place(0.66, 0.08, 51, 50, w / 2 - 60, 116);
  const b = new Raster(1, 1).place(0.66, -0.08, 51, 50, w / 2 + 60, 116, true);
  const p1: P = [a.X(100, 94), a.Y(100, 94)];
  const p2: P = [a.X(196, 30), a.Y(196, 30)];
  const q1: P = [b.X(100, 94), b.Y(100, 94)];
  const q2: P = [b.X(190, 40), b.Y(190, 40)];
  const d = (p2[0] - p1[0]) * (q2[1] - q1[1]) - (p2[1] - p1[1]) * (q2[0] - q1[0]);
  const u = d === 0 ? 0.5 : ((q1[0] - p1[0]) * (q2[1] - q1[1]) - (q1[1] - p1[1]) * (q2[0] - q1[0])) / d;
  const p: [number, number] = [p1[0] + (p2[0] - p1[0]) * u, p1[1] + (p2[1] - p1[1]) * u];
  crossCache = { w, p };
  return p;
}

export function drawRushExchange(ctx: CanvasRenderingContext2D, t: number, w: number, h: number): void {
  const cx = Math.round(w / 2);
  const sky = layer('rush/sky', w, h, (r) => {
    skyGradient(r, [C.blue, C.sky, C.sky, C.lightGray, C.white], -20, h);
    cloudBand(r, 61, 80, 10, 700, C.lightGray, C.white, [40, 100], [5, 12]);
    cloudBand(r, 62, 150, 12, 700, C.gray, C.lightGray, [40, 110], [6, 12]);
    cloudBand(r, 63, 226, 16, 700, C.lightGray, C.white, [50, 120], [6, 12]);
    ridge(r, ridgeFn(254, 8, 60, 64), C.gray, C.lightGray);
  });
  blit(ctx, sky);
  speedLines(ctx, cx, 120, w, h, t, '#ffffff', 1.1);

  // afterimage clashes popping in sequence
  const ct = t % CYCLE;
  for (const sp of SPOTS) {
    let u = (ct - sp.t0) / 0.62;
    if (u < 0) u += CYCLE / 0.62;
    if (u > 1) continue;
    const x = cx + sp.x;
    const y = sp.y;
    const amt = u < 0.55 ? 1 : 1 - (u - 0.55) / 0.45;
    const k = silhouetteSprite('kai', sp.k, C.cyan, C.white);
    const m = silhouetteSprite('malachar', sp.m, C.purple, C.magenta);
    const kk = amt >= 0.99 ? k : ditherMask(k, amt);
    const mm = amt >= 0.99 ? m : ditherMask(m, amt);
    ctx.save();
    ctx.translate(Math.round(x + 14), 0);
    ctx.scale(-1, 1);
    ctx.drawImage(mm, -Math.round(mm.width / 2), Math.round(y - mm.height / 2));
    ctx.restore();
    ctx.drawImage(kk, Math.round(x - 14 - kk.width / 2), Math.round(y - kk.height / 2));
    if (u < 0.4) {
      const sz = u < 0.12 ? 10 : u < 0.25 ? 16 : 12;
      blitC(ctx, starburst(sz, C.yellow, C.white), x, y - 14);
    }
  }

  // central duel
  const ph = Math.floor(t * 8) % 4;
  const push = Math.round(Math.sin(t * 18) * 1.5);
  const duo = frame('rush/duo', ph, 4, w, h, (r, i) => {
    const a = new Raster(w, h);
    drawDuelist(a, 'kai', w, (i / 4) * Math.PI * 2);
    a.rim(C.white, 0, -1);
    const b = new Raster(w, h);
    drawDuelist(b, 'malachar', w, (i / 4) * Math.PI * 2 + 1);
    b.rim(C.magenta, 0, -1);
    r.over(b);
    r.over(a);
  });
  blit(ctx, duo, push, 0);

  // blade contact sparks (intersection of both blades)
  const [ix, iy] = bladeCross(w);
  const bx = ix + push;
  const by = iy;
  const pulse = (Math.sin(t * 30) + 1) / 2;
  blitC(ctx, glow(12 + Math.round(pulse * 3) * 2, [C.white, C.yellow, C.orange]), bx, by);
  blitC(ctx, starburst(9 + Math.round(pulse * 4), C.yellow, C.white), bx, by);
  const sr = rng(7);
  for (let i = 0; i < 30; i++) {
    const period = 0.3 + sr() * 0.4;
    const u = ((t + sr() * period) % period) / period;
    const a = sr() * Math.PI * 2;
    const v = 40 + sr() * 90;
    const x = bx + Math.cos(a) * v * u * period * 2;
    const y = by + Math.sin(a) * v * u * period * 2 + u * u * 16;
    ctx.fillStyle = HEX[u < 0.4 ? C.white : C.yellow];
    ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
  }
  blitC(ctx, sparkleSprite(5, C.cyan), bx - 30, by + 30);
}
