/** Kai's hand gripping a blazing cyan shard; energy lines and runes swirl; light intensifies with t. */
import { C, HEX } from '../pal';
import { Raster } from '../raster';
import { cel } from '../face';
import { rng, smooth, spline, strand } from '../geom';
import { blit, blitC, frame, glow, layer, layerCtx, sparkleSprite } from './kit';
import { glowInto, raysInto, skyGradient } from './scenery';

const S = 1.9; // px per hand unit

/** Hand + shard in local units around the grip center (0,0). */
function drawHand(r: Raster, ox: number, oy: number): void {
  r.setTransform(S, ox, oy);
  const sc = new Raster(r.w, r.h).copyTransform(r);
  const body = new Raster(r.w, r.h).copyTransform(r);
  // forearm: sleeve + leather bracer
  cel(
    body,
    sc,
    strand(
      [
        [12, 20],
        [34, 58],
        [52, 100],
      ],
      30,
      { tipW: 38, pow: 1 },
    ),
    C.blue,
    C.navy,
    -2,
    -1,
  );
  cel(
    body,
    sc,
    strand(
      [
        [10, 18],
        [20, 36],
        [26, 48],
      ],
      27,
      { tipW: 30, pow: 1 },
    ),
    C.brown,
    C.darkBrown,
    -2,
    -1.5,
  );
  body.with({ self: true }, () => {
    body.stroke(
      spline(
        [
          [-1, 30],
          [11, 23],
          [23, 19],
        ],
        false,
        3,
      ),
      1.2,
      1.2,
      C.tan,
    );
    body.stroke(
      spline(
        [
          [8, 44],
          [21, 37],
          [32, 32],
        ],
        false,
        3,
      ),
      1,
      1,
      C.darkBrown,
    );
    body.stroke(
      spline(
        [
          [4, 37],
          [16, 30],
          [28, 26],
        ],
        false,
        3,
      ),
      0.8,
      0.8,
      C.gold,
    );
  });
  body.outline(C.black);

  // shard (through the fist)
  const shard = new Raster(r.w, r.h).copyTransform(r);
  shard.poly([0, -74, 7, -40, 5.5, 26, 0, 36, -6, 26, -7, -40], C.cyan);
  shard.poly([0, -74, 7, -40, 5.5, 26, 0, 36, 0.5, -40], C.sky);
  shard.poly([0, -74, -7, -40, -3.5, -40], C.white);
  shard.stroke([-2.5, -40, -2, 20], 1.4, 1, C.white);
  shard.stroke([3.5, -55, 3, 10], 0.8, 0.8, C.ice1);
  shard.outline(C.blue);

  // fist: palm/back of hand, then each finger and the thumb as separately outlined parts
  const hand = new Raster(r.w, r.h).copyTransform(r);
  const part = (fn: (p: Raster) => void): void => {
    const p = new Raster(r.w, r.h).copyTransform(r);
    fn(p);
    p.outline(C.darkBrown);
    hand.over(p);
  };
  part((p) =>
    cel(
      p,
      sc,
      spline(
        [
          [-12, -12],
          [10, -16],
          [24, -6],
          [27, 14],
          [18, 28],
          [-2, 30],
          [-14, 20],
        ],
        true,
        4,
      ),
      C.skin,
      C.skinShade,
      -2,
      -2,
    ),
  );
  const fingers: [number, number][] = [
    [-15.5, 8.6],
    [-6.4, 8.6],
    [2.7, 8.2],
    [11.4, 7.4],
  ];
  fingers.forEach(([y, hgt], i) => {
    const x0 = -20 + i * 1.2;
    const x1 = 18 - i * 1.6;
    part((p) => {
      const pts = spline(
        [
          [x0 + 3, y],
          [x1 - 3.5, y - 0.9],
          [x1 + 0.8, y + hgt * 0.42],
          [x1 - 3, y + hgt],
          [x0 + 3, y + hgt + 0.3],
          [x0 - 0.5, y + hgt * 0.5],
        ],
        true,
        4,
      );
      cel(p, sc, pts, C.skin, C.skinShade, -1.2, -1.8);
      p.with({ self: true }, () => {
        p.stroke([x1 - 6, y + 1.8, x1 - 1.8, y + 2.6], 1.2, 0.7, C.sand);
        p.stroke([x0 + 5, y + 1.5, x0 + 11, y + 1.2], 0.8, 0.5, C.sand);
        p.stroke([x1 - 9, y + hgt * 0.55, x1 - 8, y + hgt * 0.8], 0.6, 0.6, C.skinShade);
      });
    });
  });
  // thumb wrapping over the index finger
  part((p) => {
    cel(
      p,
      sc,
      strand(
        [
          [-25, 24],
          [-21, 5],
          [-11, -8],
          [-1, -11],
        ],
        12,
        { tipW: 8, pow: 1.2 },
      ),
      C.skin,
      C.skinShade,
      -1.5,
      -1.5,
    );
    p.ellipse(-3.2, -10.2, 3.3, 2.4, C.pink, -0.3);
    p.ellipse(-3.8, -10.8, 1.4, 0.9, C.white, -0.3);
    p.with({ self: true }, () =>
      p.stroke(
        spline(
          [
            [-20, 14],
            [-17, 3],
            [-10, -5],
          ],
          false,
          3,
        ),
        1,
        0.6,
        C.sand,
      ),
    );
  });
  hand.outline(C.black);
  // cyan rim light from the shard above
  hand.rim(C.cyan, 0, -1);
  body.rim(C.sky, 0, -1);

  r.over(body);
  r.over(shard);
  r.over(hand);
}

interface Glyph {
  c: HTMLCanvasElement;
}

function glyphs(): Glyph[] {
  const out: Glyph[] = [];
  const rand = rng(404);
  for (let g = 0; g < 10; g++) {
    const c = layerCtx(`rune|${g}`, 9, 11, (ctx) => {
      ctx.fillStyle = HEX[C.cyan];
      const pts: [number, number][] = [];
      for (let k = 0; k < 4; k++) pts.push([1 + Math.floor(rand() * 3) * 3, 1 + Math.floor(rand() * 4) * 3]);
      for (let k = 0; k < pts.length - 1; k++) {
        const [x0, y0] = pts[k];
        const [x1, y1] = pts[k + 1];
        const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
        for (let i = 0; i <= n; i++)
          ctx.fillRect(
            Math.round(x0 + ((x1 - x0) * i) / (n || 1)),
            Math.round(y0 + ((y1 - y0) * i) / (n || 1)),
            1,
            1,
          );
      }
      ctx.fillStyle = HEX[C.white];
      ctx.fillRect(pts[0][0], pts[0][1], 1, 1);
    });
    out.push({ c });
  }
  return out;
}
let GLYPHS: Glyph[] | null = null;

export function drawShardFusion(ctx: CanvasRenderingContext2D, t: number, w: number, h: number): void {
  const I = smooth(t / 4.2);
  const cx = Math.round(w / 2);
  const cy = 168;
  const tipY = cy - 74 * S * 0.62;
  const step = Math.min(4, Math.floor(I * 5));
  const bg = layer(`fusion/bg${step}`, w, h, (r) => {
    skyGradient(r, [C.black, C.navy, C.black], 0, h);
    glowInto(r, cx, tipY, 110 + step * 45, [C.sky, C.blue, C.darkSlate, C.navy], 0.8);
  });
  blit(ctx, bg);

  // rays
  const rstep = Math.min(5, Math.floor(I * 6)) * 2 + (Math.floor(t * 5) % 2);
  const rl = frame('fusion/rays', rstep, 12, w, h, (r, i) => {
    const q = Math.floor(i / 2) / 5;
    const rot = (i % 2) * 0.09;
    raysInto(
      r,
      cx,
      tipY,
      6 + Math.round(q * 10),
      10,
      150 + q * 170,
      rot,
      C.cyan,
      2 + Math.round(q * 3),
      0.05 + q * 0.04,
      21,
    );
    raysInto(r, cx, tipY, 5, 10, 120 + q * 100, -rot, C.white, 2 + Math.round(q * 2), 0.03, 22);
  });
  blit(ctx, rl);

  // runes ring (back half)
  if (!GLYPHS) GLYPHS = glyphs();
  const ringR = 120 + I * 12;
  const drawRunes = (front: boolean): void => {
    const N = 16;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + t * 0.6;
      const s = Math.sin(a);
      if (front !== s > 0) continue;
      const x = cx + Math.cos(a) * ringR;
      const y = cy + 6 + s * 30;
      if (!front && (i + Math.floor(t * 4)) % 5 === 0) continue;
      blitC(ctx, GLYPHS![i % GLYPHS!.length].c, x, y);
    }
  };
  drawRunes(false);

  // energy lines spiralling into the shard
  const lines = 7;
  for (let k = 0; k < lines; k++) {
    const a0 = (k / lines) * Math.PI * 2;
    for (let j = 0; j < 22; j++) {
      const u = (j / 22 + t * (0.45 + I * 0.5)) % 1;
      const rr = (1 - u) * (200 + k * 8);
      const a = a0 + u * 2.6 + t * 0.3;
      const x = Math.round(cx + Math.cos(a) * rr);
      const y = Math.round(tipY + 40 + Math.sin(a) * rr * 0.55);
      ctx.fillStyle = HEX[u > 0.8 ? C.white : u > 0.4 ? C.cyan : C.sky];
      ctx.fillRect(x, y, u > 0.6 ? 2 : 1, 1);
    }
  }

  // glow at the shard
  blitC(ctx, glow(30 + Math.round(I * 8) * 5, [C.cyan, C.sky, C.blue]), cx, tipY + 10);

  // the hand (trembles as power grows)
  const shake = I > 0.5 ? Math.round(Math.sin(t * 60) * I) : 0;
  const hand = layer('fusion/hand', w, h, (r) => drawHand(r, cx, cy));
  blit(ctx, hand, shake, 0);

  // blazing core over the shard
  const core = 12 + Math.round(I * 6) * 4;
  blitC(ctx, glow(core, [C.white, C.white, C.cyan, C.sky]), cx + shake, tipY - 6);
  if (I > 0.35) {
    const tw = (Math.sin(t * 9) + 1) / 2;
    blitC(ctx, sparkleSprite(tw > 0.5 ? 6 : 4, C.cyan), cx + shake, tipY - 34);
  }

  drawRunes(true);

  // floating sparks
  const rand = rng(Math.floor(t * 12));
  for (let i = 0; i < 10 + I * 20; i++) {
    ctx.fillStyle = HEX[rand() > 0.5 ? C.white : C.cyan];
    ctx.fillRect(Math.round(cx + (rand() - 0.5) * 300), Math.round(tipY + (rand() - 0.5) * 200), 1, 1);
  }

  // near white-out at full power: a huge pulsing light bloom
  if (t > 4.2) {
    const p = Math.min(1, (t - 4.2) / 0.8);
    const pul = (Math.sin(t * 6) + 1) / 2;
    blitC(ctx, glow(40 + Math.round(p * 5 + pul * 2) * 10, [C.white, C.cyan, C.sky]), cx, tipY);
  }
}
