/**
 * DBZ-style power-ups (Kai and Malachar): shouting, fists clenched, a huge
 * flame aura, crackling lightning, floating debris, cracked glowing ground and
 * a dust shockwave. Timeline: 0–1.5s aura builds, ~1.5s burst, then a loop.
 */
import { C, HEX } from '../pal';
import { Raster, bayer } from '../raster';
import { cel, faceGeom, renderBust, type Spec } from '../face';
import { kai } from '../characters/kai';
import { malachar } from '../characters/malachar';
import { rng, spline, strand } from '../geom';
import { auraBox, auraInto, lightning, type AuraPalette } from '../aura';
import { blit, blitC, fade, frame, glow, layer, lut } from './kit';
import { cloudBand, glowInto, ridge, ridgeFn, skyGradient } from './scenery';

const S = 1.62;
const BURST = 1.5;
const AURA_H = 250;
const AURA_WF = 0.9;

interface PowerCfg {
  key: string;
  spec: Spec;
  pal: AuraPalette;
  sky: readonly number[];
  mesa: number;
  mesaRim: number;
  ground: readonly number[];
  crack: number;
  crackHot: number;
  rock: number;
  rockLit: number;
  bolt: [number, number];
  eyeGlow: readonly number[];
  iris: readonly [number, number, number];
  tipLut: Uint8Array;
  dust: readonly number[];
  body: (r: Raster, sc: Raster) => void;
  streaks?: boolean;
}

/* ---------------------------------------------------------------- bodies */

function fist(
  r: Raster,
  sc: Raster,
  x: number,
  y: number,
  side: number,
  skin: number,
  shade: number,
  line: number,
): void {
  const p = new Raster(r.w, r.h).copyTransform(r);
  cel(
    p,
    sc,
    spline(
      [
        [x - 6, y - 5],
        [x + 6, y - 5.5],
        [x + 7, y + 1],
        [x + 5, y + 6],
        [x - 5, y + 6],
        [x - 7, y + 1],
      ],
      true,
      3,
    ),
    skin,
    shade,
    -side * 1,
    -1.2,
  );
  for (let k = -1; k <= 1; k++)
    p.stroke([x + k * 3.2, y - 4.5, x + k * 3.2 + 0.3, y - 1.4], 0.6, 0.6, shade, 1);
  p.stroke([x - 5.5 * side, y + 1.5, x + 3 * side, y + 1.2], 0.9, 0.9, shade, 1);
  p.outline(line);
  r.over(p);
}

function upperArms(r: Raster, sc: Raster, base: number, shade: number, line: number): void {
  for (const side of [-1, 1]) {
    const k = (x: number): number => 51 + side * x;
    const arm = new Raster(r.w, r.h).copyTransform(r);
    cel(
      arm,
      sc,
      strand(
        [
          [k(38), 92],
          [k(44), 104],
          [k(47), 117],
        ],
        14,
        { tipW: 11.5 },
      ),
      base,
      shade,
      side * 2,
      -1,
    );
    arm.outline(line);
    r.over(arm);
  }
}

function kaiBody(r: Raster, sc: Raster): void {
  const body = new Raster(r.w, r.h).copyTransform(r);
  // legs (wide stance)
  cel(
    body,
    sc,
    strand(
      [
        [40, 136],
        [33, 156],
        [26, 180],
      ],
      16,
      { tipW: 13 },
    ),
    C.navy,
    C.black,
    2,
    -1,
  );
  cel(
    body,
    sc,
    strand(
      [
        [62, 136],
        [69, 156],
        [77, 180],
      ],
      16,
      { tipW: 13 },
    ),
    C.navy,
    C.black,
    2,
    -1,
  );
  // tunic skirt + belt
  cel(
    body,
    sc,
    spline(
      [
        [26, 124],
        [76, 124],
        [84, 146],
        [66, 142],
        [51, 147],
        [36, 142],
        [18, 146],
      ],
      true,
      3,
    ),
    C.blue,
    C.navy,
    2.5,
    -1,
  );
  body.poly([25.5, 123, 76.5, 123, 77, 129, 25, 129], C.darkBrown);
  body.poly([26, 124, 76, 124, 76.2, 125.4, 25.8, 125.4], C.brown);
  cel(body, sc, [47, 122.5, 55, 122.5, 55, 129.5, 47, 129.5], C.gold, C.orange, -0.5, -0.5);
  body.outline(C.black);
  r.over(body);
  // forearms bent in toward the hips + bracers
  for (const side of [-1, 1]) {
    const k = (x: number): number => 51 + side * x;
    const arm = new Raster(r.w, r.h).copyTransform(r);
    cel(
      arm,
      sc,
      strand(
        [
          [k(47), 115],
          [k(45), 124],
          [k(39), 132],
        ],
        11,
        { tipW: 9.5 },
      ),
      C.skin,
      C.skinShade,
      side * 1.5,
      -1,
    );
    cel(
      arm,
      sc,
      strand(
        [
          [k(46.5), 120],
          [k(43.5), 126],
          [k(40), 131],
        ],
        11.5,
        { tipW: 10.5 },
      ),
      C.brown,
      C.darkBrown,
      side * 1.5,
      -1,
    );
    arm.with({ self: true }, () => arm.stroke([k(46), 121, k(41), 128], 0.8, 0.8, C.tan));
    arm.outline(C.black);
    r.over(arm);
    fist(r, sc, k(38), 135, side, C.skin, C.skinShade, C.darkBrown);
  }
}

function malBody(r: Raster, sc: Raster): void {
  const body = new Raster(r.w, r.h).copyTransform(r);
  // armored legs + tassets
  cel(
    body,
    sc,
    strand(
      [
        [40, 136],
        [33, 156],
        [26, 180],
      ],
      16,
      { tipW: 13 },
    ),
    C.darkSlate,
    C.black,
    2,
    -1,
  );
  cel(
    body,
    sc,
    strand(
      [
        [62, 136],
        [69, 156],
        [77, 180],
      ],
      16,
      { tipW: 13 },
    ),
    C.darkSlate,
    C.black,
    2,
    -1,
  );
  cel(
    body,
    sc,
    spline(
      [
        [25, 124],
        [77, 124],
        [86, 150],
        [68, 142],
        [51, 152],
        [34, 142],
        [16, 150],
      ],
      true,
      3,
    ),
    C.navy,
    C.black,
    2.5,
    -1,
  );
  body.poly([24.5, 122, 77.5, 122, 78, 128, 24, 128], C.black);
  body.with({ self: true }, () => body.stroke([24, 128, 78, 128], 0.9, 0.9, C.darkRed));
  cel(body, sc, [51, 120, 55, 125, 51, 130, 47, 125], C.magenta, C.purple, -0.5, -0.5);
  body.outline(C.black);
  r.over(body);
  for (const side of [-1, 1]) {
    const k = (x: number): number => 51 + side * x;
    const arm = new Raster(r.w, r.h).copyTransform(r);
    cel(
      arm,
      sc,
      strand(
        [
          [k(47), 115],
          [k(45), 124],
          [k(39), 132],
        ],
        12,
        { tipW: 10.5 },
      ),
      C.darkSlate,
      C.black,
      side * 1.5,
      -1,
    );
    arm.with({ self: true }, () => arm.stroke([k(47), 118, k(41), 129], 0.9, 0.9, C.darkRed));
    // gauntlet spikes
    arm.poly(
      strand(
        [
          [k(47), 122],
          [k(53), 120],
          [k(57), 116],
        ],
        3.4,
        {},
      ),
      C.black,
    );
    arm.outline(C.black);
    r.over(arm);
    fist(r, sc, k(38), 135, side, C.darkSlate, C.navy, C.black);
    // claws
    const cl = new Raster(r.w, r.h).copyTransform(r);
    for (let q = -1; q <= 1; q++)
      cl.poly(
        strand(
          [
            [k(38) + q * 3.2, 139],
            [k(38) + q * 3.4, 142.5],
          ],
          1.8,
          {},
        ),
        C.gray,
      );
    r.over(cl);
  }
}

/* --------------------------------------------------------------- configs */

const KAI_TIPS = lut((i) => {
  const m: Record<number, number> = {
    [C.navy]: C.blue,
    [C.darkSlate]: C.sky,
    [C.slate]: C.cyan,
    [C.gray]: C.white,
    [C.black]: C.blue,
  };
  return m[i] ?? i;
});
const MAL_TIPS = lut((i) => {
  const m: Record<number, number> = {
    [C.black]: C.void0,
    [C.navy]: C.purple,
    [C.darkSlate]: C.magenta,
    [C.purple]: C.hotPink,
  };
  return m[i] ?? i;
});

const KAI: PowerCfg = {
  key: 'pu/kai',
  spec: kai,
  pal: 'aether',
  sky: [C.black, C.navy, C.navy, C.darkSlate, C.blue],
  mesa: C.navy,
  mesaRim: C.slate,
  ground: [C.darkSlate, C.navy, C.black],
  crack: C.black,
  crackHot: C.cyan,
  rock: C.darkSlate,
  rockLit: C.cyan,
  bolt: [C.white, C.cyan],
  eyeGlow: [C.white, C.cyan, C.sky],
  iris: [C.blue, C.cyan, C.white],
  tipLut: KAI_TIPS,
  dust: [C.lightGray, C.gray, C.sand],
  body: kaiBody,
  streaks: true,
};

const MAL: PowerCfg = {
  key: 'pu/mal',
  spec: malachar,
  pal: 'void',
  sky: [C.black, C.void0, C.plum, C.darkRed, C.red],
  mesa: C.plum,
  mesaRim: C.darkRed,
  ground: [C.plum, C.void0, C.black],
  crack: C.black,
  crackHot: C.hotPink,
  rock: C.plum,
  rockLit: C.hotPink,
  bolt: [C.white, C.red],
  eyeGlow: [C.white, C.hotPink, C.red],
  iris: [C.red, C.hotPink, C.white],
  tipLut: MAL_TIPS,
  dust: [C.gray, C.slate, C.plum],
  body: malBody,
};

/* ------------------------------------------------------------ rendering */

function place(r: Raster, w: number): Raster {
  return r.place(S, 0, 51, 50, w / 2, 90);
}

const GROUND_Y = 232;

function crackLines(cx: number, w: number): [number, number][][] {
  const rand = rng(77);
  const out: [number, number][][] = [];
  for (let i = 0; i < 11; i++) {
    const a = Math.PI * (0.02 + (i / 10) * 0.96);
    let x = cx + Math.cos(a) * 20;
    let y = 262 - Math.sin(a) * 4;
    const pts: [number, number][] = [[x, y]];
    const len = 6 + Math.floor(rand() * 8);
    let dir = a;
    for (let k = 0; k < len; k++) {
      dir += (rand() - 0.5) * 0.7;
      x += Math.cos(dir) * 14;
      y -= Math.sin(dir) * 2.6;
      pts.push([x, Math.max(GROUND_Y + 2, y)]);
      if (x < -10 || x > w + 10) break;
    }
    out.push(pts);
  }
  return out;
}

function drawPowerup(cfg: PowerCfg, ctx: CanvasRenderingContext2D, t: number, w: number, h: number): void {
  const cx = Math.round(w / 2);
  const burst = t >= BURST;
  const bt = t - BURST;
  // shake: strong at the burst, rumble afterwards
  const shakeA = burst ? (bt < 0.5 ? 4 * (1 - bt / 0.5) + 1 : 1) : (t / BURST) * 1.5;
  const sx = Math.round(Math.sin(t * 71) * shakeA);
  const sy = Math.round(Math.cos(t * 53) * shakeA * 0.6);

  const bg = layer(`${cfg.key}/bg`, w, h, (r) => {
    skyGradient(r, cfg.sky, -10, GROUND_Y + 10);
    glowInto(r, cx, 150, 200, [cfg.eyeGlow[2], cfg.sky[2]], 0.9);
    cloudBand(r, 5, 60, 12, 700, cfg.sky[1], cfg.sky[2], [40, 90], [3, 7]);
    // distant mesas
    ridge(r, ridgeFn(206, 26, 38, 11, 3), cfg.mesa, -1, (_x, slope) => (slope < -0.6 ? cfg.mesaRim : -1));
    // ground plane with perspective bands
    for (let y = GROUND_Y; y < h; y++) {
      const tt = (y - GROUND_Y) / (h - GROUND_Y);
      for (let x = 0; x < w; x++)
        r.data[y * w + x] =
          tt < 0.35
            ? bayer(x, y) < tt / 0.35
              ? cfg.ground[1]
              : cfg.ground[0]
            : bayer(x, y) < (tt - 0.35) / 0.65
              ? cfg.ground[2]
              : cfg.ground[1];
    }
    r.setTransform(1, 0, 0);
    for (let i = 0; i < w; i += 3) r.px(i, GROUND_Y, cfg.mesaRim);
    // cracks
    for (const pts of crackLines(cx, w)) r.linePx(pts.flat(), cfg.crack);
    // scattered rocks on the ground
    const rand = rng(3);
    for (let i = 0; i < 30; i++) {
      const x = rand() * w;
      const y = GROUND_Y + 4 + rand() * 34;
      const s = 1 + rand() * 3 * ((y - GROUND_Y) / 30);
      r.ellipse(x, y, s * 1.4, s * 0.8, cfg.rock);
      r.px(x - s * 0.5, y - s * 0.5, cfg.rockLit);
    }
  });
  blit(ctx, bg, sx, sy);

  // rising energy streaks in the background
  if (cfg.streaks || burst) {
    const rand = rng(12);
    const n = burst ? 26 : Math.floor((t / BURST) * 12);
    for (let i = 0; i < n; i++) {
      const x = Math.round(cx + (rand() - 0.5) * (w + 40));
      const sp = 180 + rand() * 220;
      const len = 10 + rand() * 30;
      const y = ((((rand() * 300 - t * sp) % 300) + 300) % 300) - 20;
      ctx.fillStyle = HEX[i % 3 === 0 ? cfg.eyeGlow[1] : cfg.eyeGlow[2]];
      ctx.fillRect(x + sx, Math.round(y) + sy, 1, Math.round(len));
    }
  }

  // aura (back)
  const [aw, ah, afx, afy] = auraBox(AURA_H, AURA_WF);
  const level = burst ? 3 : Math.min(2, Math.floor((t / BURST) * 3));
  const kLev = [0.35, 0.6, 0.85, 1.12][level];
  const fcount = burst ? 8 : 4;
  const fi = Math.floor(t * 14) % fcount;
  const auraFy = 292;
  if (t > 0.1) {
    const back = frame(`${cfg.key}/aura${level}`, fi, fcount, aw, ah, (r, i) =>
      auraInto(r, afx, afy, AURA_H * (0.8 + 0.2 * (level / 3)), cfg.pal, i, 'back', kLev, AURA_WF),
    );
    blit(ctx, back, cx - afx + sx, auraFy - afy + sy);
  }

  // glowing cracks (pulse after the burst)
  if (t > BURST * 0.6) {
    const hot = layer(`${cfg.key}/cracks`, w, h, (r) => {
      r.setTransform(1, 0, 0);
      for (const pts of crackLines(cx, w)) {
        r.linePx(pts.flat(), cfg.crackHot);
        r.linePx(pts.map(([x, y]) => [x, y - 1]).flat(), C.white);
      }
    });
    const pulse = Math.sin(t * 8) > -0.2 || !burst;
    if (pulse) blit(ctx, hot, sx, sy);
  }

  // debris rising (behind the body)
  drawRocks(ctx, cfg, t, w, sx, sy, 0);

  // the character (charging vs powered-up hair)
  const state = burst ? 1 : 0;
  const hairPh = burst ? Math.floor(t * 8) % 3 : 0;
  const figure = frame(`${cfg.key}/fig${state}`, hairPh, burst ? 3 : 1, w, h, (r, i) => {
    place(r, w);
    const sc = new Raster(w, h).copyTransform(r);
    const topY = r.Y(51, 26);
    const glowTips = state === 1;
    if (cfg.key === 'pu/kai') upperArms(r, sc, C.blue, C.navy, C.black);
    else upperArms(r, sc, C.darkSlate, C.black, C.black);
    const bust = new Raster(w, h).copyTransform(r);
    renderBust(bust, cfg.spec, 'shout', {
      variant: 'full',
      windX: Math.sin(i * 2.1) * 1.5,
      windY: glowTips ? -17 : -5,
      phase: i * 2.1,
      iris: cfg.iris,
      eyeGlow: C.white,
      noMarks: false,
      postHair: glowTips
        ? (L) => {
            for (let y = 0; y < L.h; y++) {
              const tt = (topY - y) / 40 + 0.35;
              if (tt <= 0) continue;
              for (let x = 0; x < L.w; x++) {
                const idx = y * L.w + x;
                const v = L.data[idx];
                if (v && bayer(x, y) < tt) L.data[idx] = cfg.tipLut[v];
              }
            }
          }
        : undefined,
    });
    const lower = new Raster(w, h).copyTransform(r);
    cfg.body(lower, sc);
    // legs/skirt behind the bust, forearms + fists in front: body() draws both, so split by drawing twice
    r.over(bust);
    r.over(lower);
    // aura-lit rim
    r.rim(cfg.eyeGlow[1], 1, 0);
    r.rim(cfg.eyeGlow[1], -1, 0);
    r.rim(cfg.eyeGlow[0], 0, -1);
  });
  blit(ctx, figure, sx, sy);

  // blazing eyes
  const g = faceGeom(cfg.spec.shape);
  const pr = place(new Raster(1, 1), w);
  const pulse = (Math.sin(t * 16) + 1) / 2;
  const intensity = burst ? 1 : t / BURST;
  for (const E of [g.near, g.far]) {
    const x = pr.X(E.x, E.y + 0.5) + sx;
    const y = pr.Y(E.x, E.y + 0.5) + sy;
    if (intensity > 0.4) blitC(ctx, glow(4 + Math.round(pulse * 2 + intensity * 2), cfg.eyeGlow), x, y);
    if (cfg.key === 'pu/mal' && burst) {
      // glowing red eye streaks trailing outward
      const dir = E.dir;
      for (let k = 0; k < 3; k++) {
        const len = 14 + k * 8 + Math.round(pulse * 6);
        ctx.fillStyle = HEX[k === 0 ? C.white : k === 1 ? C.hotPink : C.red];
        const off = E.w * 0.5 * S + 1;
        ctx.fillRect(Math.round(dir < 0 ? x - off - len : x + off), Math.round(y) - 2 + k, len - k * 3, 1);
      }
    }
  }

  // aura front wisps + sparks
  if (t > 0.1) {
    const front = frame(`${cfg.key}/front${level}`, fi, fcount, aw, ah, (r, i) =>
      auraInto(r, afx, afy, AURA_H * (0.8 + 0.2 * (level / 3)), cfg.pal, i, 'front', kLev, AURA_WF),
    );
    blit(ctx, front, cx - afx + sx, auraFy - afy + sy);
  }

  // lightning crackling around the aura
  const slot = Math.floor(t / 0.22);
  const inSlot = t - slot * 0.22;
  const rs = rng(slot * 31 + (cfg.key === 'pu/mal' ? 7 : 0));
  const chance = burst ? 0.75 : (t / BURST) * 0.4;
  if (rs() < chance && inSlot < 0.13) {
    const bolts = burst ? 2 : 1;
    for (let b = 0; b < bolts; b++) {
      const side = rs() > 0.5 ? 1 : -1;
      const x0 = cx + side * (40 + rs() * 110);
      const y0 = 30 + rs() * 150;
      const x1 = x0 + side * (10 + rs() * 40);
      const y1 = y0 + 30 + rs() * 60;
      lightning(ctx, x0 + sx, y0 + sy, x1 + sx, y1 + sy, slot * 7 + b, cfg.bolt[0], cfg.bolt[1], 2, 0.4);
    }
  }

  // debris in front
  drawRocks(ctx, cfg, t, w, sx, sy, 1);

  // burst: flash + dust shockwave
  if (burst && bt < 1.6) {
    const rx = bt * 520;
    const ry = rx * 0.1;
    const cy = 262;
    const n = 240;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      if (Math.sin(a) < -0.2) continue;
      const k = 1 - bt / 1.6;
      if (((i * 2654435761) >>> 0) / 4294967296 > k) continue;
      const x = cx + Math.cos(a) * rx + sx;
      const y = cy + Math.sin(a) * ry + sy;
      ctx.fillStyle = HEX[cfg.dust[i % cfg.dust.length]];
      ctx.fillRect(Math.round(x), Math.round(y), 3, 2);
    }
    // dust clouds rolling outward
    const rd = rng(9);
    const k = Math.max(0, 1 - bt / 1.6);
    for (let i = 0; i < 16; i++) {
      const side = i % 2 ? 1 : -1;
      const x = cx + side * (40 + bt * (140 + rd() * 160));
      const y = 252 + rd() * 14 - bt * 8;
      const rr = Math.round((5 + rd() * 6 + bt * 8) / 2) * 2;
      if (rd() < k + 0.2) blitC(ctx, glow(rr, [cfg.dust[0], cfg.dust[1]], 0.55), x + sx, y + sy);
    }
  }
  if (burst && bt < 0.35) fade(ctx, C.white, 1 - bt / 0.35, 0, 0, w, h);
  // building charge: faint flicker
  if (!burst && t > 1.1)
    fade(ctx, cfg.eyeGlow[1], ((t - 1.1) / 0.4) * 0.12 * (Math.sin(t * 40) > 0 ? 1 : 0.4), 0, 0, w, h);
}

const ROCKS = (() => {
  const rand = rng(55);
  const out: { x: number; sp: number; ph: number; s: number; front: number; delay: number; shape: number }[] =
    [];
  for (let i = 0; i < 26; i++) {
    out.push({
      x: (rand() - 0.5) * 620,
      sp: 18 + rand() * 40,
      ph: rand() * 10,
      s: 3 + Math.floor(rand() * 5) + (rand() > 0.8 ? 5 : 0),
      front: rand() > 0.6 ? 1 : 0,
      delay: rand() * 1.4,
      shape: Math.floor(rand() * 6),
    });
  }
  return out;
})();

function drawRocks(
  ctx: CanvasRenderingContext2D,
  cfg: PowerCfg,
  t: number,
  w: number,
  sx: number,
  sy: number,
  front: number,
): void {
  const cx = w / 2;
  for (const rk of ROCKS) {
    if (rk.front !== front) continue;
    if (t < rk.delay) continue;
    const range = 300;
    const age = (t - rk.delay) * rk.sp * (t > BURST ? 1.8 : 0.6);
    const y = 262 - ((age + rk.ph * 20) % range);
    const x = cx + rk.x + Math.sin(t * 2 + rk.ph) * 3;
    if (x < -10 || x > w + 10) continue;
    // before lift-off, rocks tremble on the ground
    const yy = t < BURST && age < 6 ? 262 - (rk.ph % 3) + Math.round(Math.sin(t * 60 + rk.ph)) : y;
    const spr = rockSprite(cfg, rk.s, rk.shape);
    ctx.drawImage(spr, Math.round(x - spr.width / 2) + sx, Math.round(yy - spr.height / 2) + sy);
  }
}

function rockSprite(cfg: PowerCfg, size: number, shape: number): HTMLCanvasElement {
  const d = size + 4;
  return layer(`${cfg.key}/rock${size}_${shape}`, d, d, (r) => {
    const rand = rng(shape * 17 + size);
    const pts: number[] = [];
    const n = 5 + (shape % 3);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand() * 0.4;
      const rr = (size / 2) * (0.7 + rand() * 0.4);
      pts.push(d / 2 + Math.cos(a) * rr, d / 2 + Math.sin(a) * rr * 0.85);
    }
    r.fillPx(pts, cfg.rock);
    r.rim(cfg.rockLit, 0, -1);
    r.rim(cfg.rockLit, -1, 0);
    r.outline(C.black);
  });
}

export function drawKaiPowerup(ctx: CanvasRenderingContext2D, t: number, w: number, h: number): void {
  drawPowerup(KAI, ctx, t, w, h);
}

export function drawMalacharPowerup(ctx: CanvasRenderingContext2D, t: number, w: number, h: number): void {
  drawPowerup(MAL, ctx, t, w, h);
  // reality cracking into void shards around him
  drawVoidShards(ctx, t, w);
}

function drawVoidShards(ctx: CanvasRenderingContext2D, t: number, w: number): void {
  if (t < BURST * 0.7) return;
  const cx = w / 2;
  const grow = Math.min(1, (t - BURST * 0.7) / 1.2);
  const rand = rng(404);
  const gq = Math.max(1, Math.round(grow * 4));
  for (let i = 0; i < 14; i++) {
    const side = i % 2 ? 1 : -1;
    const bx = cx + side * (118 + rand() * 170);
    const by = 20 + rand() * 200;
    const baseSize = 6 + rand() * 11;
    const spin = (0.4 + rand() * 0.6) * (i % 2 ? 1 : -1);
    if (bx < -30 || bx > w + 30) continue;
    const drift = Math.sin(t * 0.8 + i) * 4 - (t - BURST) * (2 + (i % 3));
    const step = ((Math.floor((t * spin * 16) / (Math.PI * 2)) % 16) + 16) % 16;
    const spr = shardSprite(i, step, (baseSize * gq) / 4);
    ctx.drawImage(spr, Math.round(bx - spr.width / 2), Math.round(by + drift - spr.height / 2));
  }
  // crack lines across the sky
  const cr = rng(9);
  ctx.fillStyle = HEX[C.magenta];
  for (let i = 0; i < 5; i++) {
    let x = cx + (cr() - 0.5) * w;
    let y = 10 + cr() * 100;
    const len = Math.floor(18 * grow);
    for (let k = 0; k < len; k++) {
      x += (cr() - 0.5) * 6;
      y += cr() * 3;
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
      if (k % 4 === 0) {
        ctx.fillStyle = HEX[C.white];
        ctx.fillRect(Math.round(x) + 1, Math.round(y), 1, 1);
        ctx.fillStyle = HEX[C.magenta];
      }
    }
  }
}

function shardSprite(i: number, step: number, size: number): HTMLCanvasElement {
  const sz = Math.max(3, Math.round(size));
  const d = sz * 2 + 6;
  return layer(`pu/shard${i}_${step}_${sz}`, d, d, (r) => {
    const rr = rng(900 + i);
    const nv = 3 + (i % 3);
    const rot = (step / 16) * Math.PI * 2;
    const pts: number[] = [];
    for (let k = 0; k < nv; k++) {
      const aa = rot + (k / nv) * Math.PI * 2 + rr() * 0.5;
      const rad = sz * (0.6 + rr() * 0.5);
      pts.push(d / 2 + Math.cos(aa) * rad, d / 2 + Math.sin(aa) * rad);
    }
    r.fillPx(pts, C.void0);
    r.with({ self: true }, () => {
      for (let y = 0; y < d; y += 3) r.px(d / 2 + ((y * 7) % 5) - 2, y, C.black);
    });
    r.outline(C.magenta);
    r.rim(C.white, 0, -1, C.magenta);
  });
}
