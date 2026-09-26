/**
 * Ending: dawn breaks over Solenne harbor. Kai and Lyra (from behind) stand on
 * the harbor wall; the black disc slides off the low sun (diamond-ring flash at
 * ~1.1s), golden light floods outward across the sky, sea and white city
 * (1.1–4s, dithered palette sweep), the sun climbs, gulls take off and the sea
 * sparkles. Steady loop from ~4.5s.
 */
import { C, HEX } from '../pal';
import { Raster, bayer } from '../raster';
import { clamp, rng, smooth, type P } from '../geom';
import { blit, blitC, fade, frame, glow, layer, lut, sparkleSprite } from './kit';
import { cloudBand, glowInto, raysInto, skyGradient } from './scenery';
import { kaiBack, lyraBack } from './endingDawn';
import { DUSK, box, city, corona, lighthouse, sanctum, ship, type Lamp } from './solenne';

const HZ = 150;
const SUN_R = 15;
const LEVELS = 16;
const CORONA = Math.ceil(SUN_R * 8.6);

/** Figures facing the sunrise: back-lit. */
const BACKLIT = lut((i) => {
  const m: Record<number, number> = {
    [C.blue]: C.navy,
    [C.navy]: C.black,
    [C.lightGray]: C.gray,
    [C.gray]: C.slate,
    [C.white]: C.lightGray,
    [C.darkSlate]: C.navy,
    [C.slate]: C.darkSlate,
    [C.red]: C.darkRed,
    [C.darkRed]: C.plum,
    [C.brown]: C.darkBrown,
    [C.darkBrown]: C.plum,
    [C.skin]: C.skinShade,
    [C.fair]: C.fairShade,
    [C.gold]: C.orange,
  };
  return m[i] ?? i;
});

/** Light level 0 (eclipse dusk) → 1 (full dawn). */
function lightAt(t: number): number {
  return smooth((t - 1.1) / 2.9);
}

function sunPos(t: number, w: number): P {
  return [Math.round(w / 2 + 44), Math.round(124 - 16 * smooth((t - 1) / 4))];
}

/** Moon offset (pixels) from the sun center as it slides off to the upper left. */
function moonOffset(t: number): P {
  const u = smooth((t - 1) / 2.6);
  return [-u * SUN_R * 3.4, -u * SUN_R * 1.9];
}

/** Shoreline of the city (left): x at row y. */
function shore(y: number, cx: number): number {
  const u = (y - HZ) / (240 - HZ);
  return cx - 36 - u * 160 + Math.sin(u * 7) * 5;
}

interface Env {
  day: Raster;
  dusk: Raster;
  lamps: Lamp[];
  light: P;
}

const envCache = new Map<string, Env>();

function buildEnv(w: number, h: number): Env {
  const key = `${w}x${h}`;
  const hit = envCache.get(key);
  if (hit) return hit;
  const cx = Math.round(w / 2);
  const [sx, sy] = sunPos(5, w);
  // skies + seas
  const day = new Raster(w, h);
  skyGradient(day, [C.blue, C.sky, C.sky, C.lightGray, C.sand, C.gold, C.yellow], -20, HZ);
  glowInto(day, sx, sy, 96, [C.white, C.yellow, C.yellow, C.gold], 0.8);
  cloudBand(day, 91, 70, 9, 700, C.lightGray, C.white, [40, 90], [2, 5]);
  cloudBand(day, 92, 112, 8, 640, C.sand, C.white, [30, 80], [1, 3]);
  const dusk = new Raster(w, h);
  skyGradient(dusk, [C.black, C.void0, C.purple, C.plum, C.magenta, C.rust, C.orange], 0, HZ);
  cloudBand(dusk, 91, 70, 9, 700, C.void0, C.plum, [40, 90], [2, 5]);
  cloudBand(dusk, 92, 112, 8, 640, C.plum, C.purple, [30, 80], [1, 3]);
  for (let y = HZ; y < h; y++) {
    const u = (y - HZ) / (h - HZ);
    for (let x = 0; x < w; x++) {
      const b = bayer(x, y);
      const i = y * w + x;
      // dawn sea: pale near the horizon, deepening blue
      day.data[i] =
        u < 0.08 ? (b < 0.5 ? C.sand : C.sky) : u < 0.4 ? (b < (u - 0.08) / 0.32 ? C.blue : C.sky) : C.blue;
      dusk.data[i] =
        u < 0.06
          ? b < 0.5
            ? C.rust
            : C.darkRed
          : u < 0.3
            ? b < (u - 0.06) / 0.24
              ? C.navy
              : C.purple
            : C.navy;
    }
  }
  // wave dashes
  const wr = rng(18);
  for (let i = 0; i < 180; i++) {
    const y = Math.round(HZ + 2 + wr() * wr() * (h - HZ));
    const x = Math.round(wr() * w);
    const len = 2 + Math.round(wr() * 6 * (1 + (y - HZ) / 50));
    day.rectPx(x, y, len, 1, y < HZ + 20 ? C.lightGray : C.sky);
    dusk.rectPx(x, y, len, 1, C.purple);
  }
  // glitter path under the sun: broken horizontal dashes
  for (let i = 0; i < 260; i++) {
    const u = wr();
    const y = Math.round(HZ + 1 + u * u * (h - HZ));
    const spread = 14 + (y - HZ) * 0.7;
    const x = Math.round(sx + (wr() - 0.5) * 2 * spread * wr());
    const len = 2 + Math.round(wr() * (3 + (y - HZ) / 12));
    day.rectPx(x - (len >> 1), y, len, 1, wr() < 0.5 - u * 0.3 ? C.white : u < 0.35 ? C.yellow : C.gold);
    if (i % 2 === 0) dusk.rectPx(x - (len >> 1), y, len, 1, u < 0.3 ? C.orange : C.rust);
  }
  // land: city on the left shore, breakwater + lighthouse on the right, quay wall in front
  const land = new Raster(w, h);
  const ground: number[] = [];
  for (let y = HZ; y <= h; y += 4) ground.push(shore(y, cx) + 4, y);
  ground.push(-10, h, -10, HZ);
  land.fillPx(ground, C.tan);
  const quay: number[] = [];
  for (let y = HZ; y <= h; y += 4) quay.push(shore(y, cx) + 4, y);
  for (let y = h; y >= HZ; y -= 4) quay.push(shore(y, cx) + 7, y + 2);
  land.fillPx(quay, C.sand);
  const lamps: Lamp[] = [];
  const rows = (y0: number, y1: number, step: number): { y: number; s: number; x0: number; x1: number }[] => {
    const out = [];
    for (let y = y0; y <= y1; y += step) {
      const u = (y - HZ) / (230 - HZ);
      out.push({ y, s: 0.35 + Math.pow(u, 1.2) * 1.1, x0: -24, x1: shore(y, cx) - 6 - 10 * u });
    }
    return out;
  };
  city(land, 707, rows(HZ + 5, 184, 7), lamps);
  sanctum(land, cx - 196, 196, 0.72, lamps);
  city(land, 708, rows(198, 236, 9), lamps);
  // breakwater from the right edge + lighthouse
  land.setTransform(1, 0, 0);
  land.fillPx([cx + 118, 164, w + 10, 158, w + 10, 163, cx + 118, 168], C.sand);
  land.fillPx([cx + 118, 168, w + 10, 163, w + 10, 166, cx + 118, 171], C.tan);
  for (let x = cx + 124; x < w; x += 8) land.px(x, 165 - Math.round((x - cx - 118) * 0.02), C.brown);
  const light = lighthouse(land, cx + 128, 166, 0.8);
  // distant headland buildings on the right
  city(land, 709, [{ y: 158, s: 0.4, x0: cx + 150, x1: w + 20 }], lamps);
  // ships
  ship(land, cx + 70, 176, 0.75, true, 2);
  ship(land, cx - 10, 196, 1.05, false, 2);
  ship(land, cx + 160, 190, 0.9, true, 1);
  ship(land, cx + 30, 160, 0.45, false, 1);
  // harbor wall in the foreground
  const WT = 232;
  land.rectPx(0, WT, w, 6, C.sand);
  land.rectPx(0, WT, w, 1, C.white);
  land.rectPx(0, WT + 6, w, h - WT - 6, C.tan);
  for (let x = (cx % 22) - 22; x < w; x += 22) land.rectPx(x, WT + 1, 1, 5, C.tan);
  for (let row = 0; row < 4; row++) {
    const y = WT + 6 + row * 8;
    land.rectPx(0, y, w, 1, C.brown);
    for (let x = ((row * 11 + cx) % 26) - 26; x < w; x += 26) land.rectPx(x, y, 1, 8, C.brown);
  }
  land.rectPx(0, WT + 6, w, 1, C.brown);
  for (let y = WT + 30; y < h; y++)
    for (let x = 0; x < w; x++) if (bayer(x, y) < (y - WT - 30) / 12) land.px(x, y, C.brown);
  // bollards, rope coil, lamp post
  for (const bx of [cx - 150, cx + 40, cx + 170]) {
    box(land, bx, WT - 5, 5, 6, 2);
    land.rectPx(bx - 1, WT - 6, 7, 1, C.brown);
  }
  land.fillPx([cx + 70, WT + 1, cx + 84, WT + 1, cx + 82, WT - 2, cx + 72, WT - 2], C.brown);
  land.rectPx(cx + 72, WT - 2, 10, 1, C.tan);
  land.rectPx(cx - 196, WT - 44, 2, 44, C.darkSlate);
  land.rectPx(cx - 199, WT - 50, 8, 7, C.darkSlate);
  land.rectPx(cx - 198, WT - 49, 6, 5, C.gold);
  land.rectPx(cx - 200, WT - 51, 10, 1, C.navy);
  lamps.push({ x: cx - 195, y: WT - 47 });

  const landDusk = new Raster(w, h);
  landDusk.over(land);
  landDusk.remap(DUSK);
  landDusk.rim(C.orange, 0, -1);
  landDusk.rim(C.rust, 1, 0);
  land.rim(C.white, 0, -1);
  land.rim(C.yellow, 1, 0);
  day.over(land);
  dusk.over(landDusk);
  const env = { day, dusk, lamps, light };
  envCache.set(key, env);
  return env;
}

/** Local light: floods outward from the sun as `k` rises. */
function localK(k: number, x: number, y: number, sx: number, sy: number): number {
  const d = Math.hypot(x - sx, (y - sy) * 1.4) / 360;
  return clamp(k * 1.9 - d * 0.9, 0, 1);
}

export function drawEclipseEnding(ctx: CanvasRenderingContext2D, t: number, w: number, h: number): void {
  const cx = Math.round(w / 2);
  const k = lightAt(t);
  const [sx, sy] = sunPos(t, w);
  const [fx, fy] = sunPos(5, w);

  // environment at the current light level (dithered sweep dusk → dawn)
  const L = Math.round(k * LEVELS);
  const envL = frame('ecl/env', L, LEVELS + 1, w, h, (r, lv) => {
    const env = buildEnv(w, h);
    const kk = lv / LEVELS;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        r.data[i] = bayer(x, y) < localK(kk, x, y, fx, fy) ? env.day.data[i] : env.dusk.data[i];
      }
    }
  });
  blit(ctx, envL);
  const env = buildEnv(w, h);

  // lamps still burning where the light hasn't arrived yet
  for (let i = 0; i < env.lamps.length; i++) {
    const l = env.lamps[i];
    if (localK(k, l.x, l.y, fx, fy) > 0.4) continue;
    const f = Math.sin(t * (2 + (i % 5)) + i * 1.3);
    if (f < -0.7) continue;
    ctx.fillStyle = HEX[f > 0.5 ? C.yellow : C.gold];
    ctx.fillRect(l.x, l.y, 1, 1);
  }
  if (k < 0.8) blitC(ctx, glow(5, [C.white, C.yellow, C.gold, C.orange]), env.light[0], env.light[1]);

  // dawn rays sweeping out from the sun
  if (k > 0.05) {
    const ri = Math.floor(t * 2) % 4;
    const rl = frame('ecl/rays', ri, 4, w, h, (r, i) => {
      raysInto(r, fx, fy - 4, 12, SUN_R + 10, 240, i * 0.01, C.white, 2, 0.04, 71);
      r.rectPx(0, HZ - 16, w, h, 0);
    });
    if (k > 0.5 || Math.floor(t * 20) % 2 === 0) blit(ctx, rl, sx - fx, sy - fy);
  }

  // the sun: outer glow grows with the light, the white face
  const pulse = (Math.sin(t * 2) + 1) / 2;
  const gR = Math.round(18 + k * 16 + pulse * 3);
  blitC(ctx, glow(gR, k > 0.4 ? [C.white, C.yellow, C.gold] : [C.yellow, C.gold, C.orange]), sx, sy);

  // corona flickers while the sun is covered, then fades
  const cf = clamp((t - 1.0) / 1.3, 0, 1);
  const fl = Math.min(4, Math.floor(cf * 5));
  if (fl < 4) {
    const ci = Math.floor(t * 7) % 8;
    const cor = frame('ecl/corona', ci + fl * 8, 40, CORONA, CORONA, (r, i) => {
      const f = Math.floor(i / 8) / 4;
      corona(r, CORONA / 2, CORONA / 2, SUN_R, (i % 8) / 8, 5, 22, false);
      if (f > 0)
        for (let y = 0; y < r.h; y++)
          for (let x = 0; x < r.w; x++) if (bayer(x, y) < f) r.data[y * r.w + x] = 0;
    });
    blitC(ctx, cor, sx, sy);
  }
  const sunFace = layer('ecl/sunface', SUN_R * 2 + 4, SUN_R * 2 + 4, (r) => {
    r.discPx(SUN_R + 2, SUN_R + 2, SUN_R + 1, C.yellow);
    r.discPx(SUN_R + 2, SUN_R + 2, SUN_R, C.white);
  });
  blitC(ctx, sunFace, sx, sy);

  // the black disc sliding off (dither-fading once clear)
  const [mx, my] = moonOffset(t);
  const mf = clamp((t - 2.4) / 1.6, 0, 1);
  if (mf < 1) {
    const lv = Math.round((1 - mf) * 4);
    const moon = frame('ecl/moon', lv, 5, SUN_R * 2 + 6, SUN_R * 2 + 6, (r, i) => {
      const a = i / 4;
      const c = SUN_R + 3;
      r.discPx(c, c, SUN_R + 1, C.black);
      r.with({ only: C.black }, () =>
        r.discPx(c - 4, c - 4, SUN_R * 0.7, (x, y) => (bayer(x, y) < 0.35 ? C.void0 : C.black)),
      );
      for (let y = 0; y < r.h; y++)
        for (let x = 0; x < r.w; x++) if (bayer(x, y) >= a) r.data[y * r.w + x] = 0;
    });
    blitC(ctx, moon, sx + mx, sy + my);
    // violet motes shed from its edge as it dissolves
    if (t > 1.6) {
      const vr = rng(5);
      for (let i = 0; i < 16; i++) {
        const u = ((t - 1.6) * (0.6 + vr() * 0.8) + vr()) % 1;
        const a = vr() * Math.PI * 2;
        const rr = SUN_R + u * 30;
        ctx.fillStyle = HEX[i % 3 ? C.purple : C.magenta];
        ctx.fillRect(
          Math.round(sx + mx + Math.cos(a) * rr - u * 20),
          Math.round(sy + my + Math.sin(a) * rr - u * 10),
          1,
          1,
        );
      }
    }
  }

  // diamond-ring flash as the first sliver of sun appears
  if (t > 0.95 && t < 1.8) {
    const u = (t - 0.95) / 0.85;
    const size = Math.round(3 + Math.sin(u * Math.PI) * 9);
    const bx = sx + Math.round(SUN_R * 0.75);
    const by = sy + Math.round(SUN_R * 0.55);
    blitC(ctx, glow(Math.max(3, Math.round(size * 1.2)), [C.white, C.white, C.yellow]), bx, by);
    blitC(ctx, sparkleSprite(size, C.white), bx, by);
    if (u > 0.1 && u < 0.3) fade(ctx, C.white, 0.25 * (1 - Math.abs(u - 0.2) / 0.1), 0, 0, w, h);
  }

  // sparkles dancing on the water (more as the light comes)
  const sp = rng(Math.floor(t * 8));
  const n = Math.round(4 + k * 30);
  for (let i = 0; i < n; i++) {
    const u = sp();
    const y = HZ + 3 + Math.round(u * u * 76);
    const x = sx + Math.round((sp() - 0.5) * (40 + u * 140));
    if (x < shore(y, cx) + 8) continue;
    const v = sp();
    if (v > 0.8) blitC(ctx, sparkleSprite(v > 0.93 ? 2 : 1, C.white, C.white), x, y);
    else {
      ctx.fillStyle = HEX[k > 0.5 ? C.white : C.gold];
      ctx.fillRect(x, y, 1 + Math.floor(v * 3), 1);
    }
  }

  // gulls taking off with the light
  drawGulls(ctx, t, w, k);

  // Kai & Lyra on the harbor wall (wind frames), back-lit
  const fi = Math.floor(t * 8) % 8;
  const lit = k > 0.5 ? 1 : 0;
  const duo = frame(`ecl/duo${lit}`, fi, 8, 120, 110, (r, i) => {
    const ph = (i / 8) * Math.PI * 2;
    const sc = new Raster(120, 110);
    const kr = new Raster(120, 110);
    kr.setTransform(1.45, 42, 106);
    sc.copyTransform(kr);
    kaiBack(kr, sc, ph);
    kr.outline(C.black);
    const lr = new Raster(120, 110);
    lr.setTransform(1.4, 78, 106);
    sc.copyTransform(lr);
    lyraBack(lr, sc, ph + 1);
    lr.outline(C.black);
    r.over(lr);
    r.over(kr);
    r.remap(BACKLIT);
    if (!lit) r.remap(BACKLIT);
    r.rim(lit ? C.yellow : C.orange, 1, 0);
    r.rim(lit ? C.white : C.gold, 0, -1);
    r.rim(lit ? C.gold : C.rust, -1, 0);
  });
  blit(ctx, duo, cx - 118, 234 - 106);
}

/** Gulls: little "v" silhouettes flapping across the sky, lifting off from the harbor. */
function drawGulls(ctx: CanvasRenderingContext2D, t: number, w: number, k: number): void {
  if (t < 1.8) return;
  const gr = rng(33);
  const cx = w / 2;
  for (let i = 0; i < 9; i++) {
    const t0 = 1.8 + gr() * 1.6;
    const period = 7 + gr() * 4;
    const u = ((t - t0) % period) / period;
    if (t < t0) {
      gr();
      gr();
      continue;
    }
    const x0 = cx - 200 + gr() * 160;
    const y0 = 200 + gr() * 20;
    const x = x0 + u * (340 + i * 10);
    const y = y0 - Math.sin(Math.min(1, u * 1.6) * Math.PI * 0.5) * (110 + i * 6) + Math.sin(t * 1.3 + i) * 3;
    const big = i % 2 === 0;
    const flap = Math.floor(t * (6 + (i % 3)) + i) % 4;
    ctx.fillStyle = HEX[k > 0.5 ? C.darkSlate : C.black];
    const X = Math.round(x);
    const Y = Math.round(y);
    const s = big ? 2 : 1;
    const wy = flap === 0 ? -1 : flap === 2 ? 1 : 0;
    ctx.fillRect(X - s, Y, s * 2 + 1, 1);
    ctx.fillRect(X - 2 * s, Y + wy, s, 1);
    ctx.fillRect(X + s + 1, Y + wy, s, 1);
    if (big) {
      ctx.fillRect(X - 3 * s, Y + wy * 2, s, 1);
      ctx.fillRect(X + 2 * s + 1, Y + wy * 2, s, 1);
    }
  }
}
