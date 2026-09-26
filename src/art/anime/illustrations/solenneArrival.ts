/**
 * Arrival at Solenne: Kai and Lyra (small, seen from behind) on a cliff road
 * above the white sandstone city and its harbor, under a dusk sky with the
 * black sun and its flickering gold corona. Sand drifts past, lamps flicker in
 * the windows, the lighthouse pulses. Loops.
 */
import { C, HEX } from '../pal';
import { Raster, bayer } from '../raster';
import { rng, spline, type P } from '../geom';
import {
  blit,
  blitC,
  fillPolyCtx,
  ditherPat,
  frame,
  glow,
  layer,
  lut,
  starList,
  stars,
  twinkle,
} from './kit';
import { cloudBand, glowInto, skyGradient } from './scenery';
import { kaiBack, lyraBack } from './endingDawn';
import { DUSK, city, corona, lighthouse, palm, sanctum, ship, type Lamp } from './solenne';

const HZ = 128;
const SUN_R = 17;
const CORONA = Math.ceil(SUN_R * 8.6);

/** Figures facing the black sun: mostly in shadow. */
const SHADOWED = lut((i) => {
  const m: Record<number, number> = {
    [C.blue]: C.navy,
    [C.navy]: C.black,
    [C.lightGray]: C.slate,
    [C.gray]: C.darkSlate,
    [C.white]: C.gray,
    [C.darkSlate]: C.navy,
    [C.slate]: C.darkSlate,
    [C.red]: C.darkRed,
    [C.darkRed]: C.plum,
    [C.brown]: C.darkBrown,
    [C.darkBrown]: C.plum,
    [C.skin]: C.darkBrown,
    [C.fair]: C.skinShade,
    [C.gold]: C.orange,
    [C.yellow]: C.gold,
  };
  return m[i] ?? i;
});

function sunPos(w: number): P {
  return [Math.round(w / 2 + 96), 56];
}

/** Shoreline x at row y: the city is left of it, the harbor right. */
function shore(y: number, cx: number): number {
  const u = (y - HZ) / (270 - HZ);
  return cx + 156 - u * 128 + Math.sin(u * 9) * 6 - Math.sin(u * Math.PI) * 10;
}

/** Cliff top y at column x (pixel), NaN past the cliff edge. */
function cliffTop(x: number, cx: number): number {
  const edge = cx - 74;
  if (x > edge) return NaN;
  return 203 + Math.sin(x * 0.07) * 1.5 + (edge - x) * 0.02 + Math.max(0, (x - (edge - 14)) * 0.25);
}

const lampCache = new Map<number, { lamps: Lamp[]; light: P; windowAt: P }>();

function landInfo(w: number): { lamps: Lamp[]; light: P; windowAt: P } {
  let info = lampCache.get(w);
  if (!info) {
    // re-run the (cheap) layout to recover lamp positions
    const r = new Raster(w, 270);
    info = drawLand(r, w);
    lampCache.set(w, info);
  }
  return info;
}

function drawLand(r: Raster, w: number): { lamps: Lamp[]; light: P; windowAt: P } {
  const cx = Math.round(w / 2);
  const h = r.h;
  const [sx] = sunPos(w);
  // sea: reflects the dusk sky, glitter column under the black sun
  for (let y = HZ; y < h; y++) {
    const u = (y - HZ) / (h - HZ);
    for (let x = 0; x < w; x++) {
      const b = bayer(x, y);
      const near = Math.abs(x - sx) < 26 - u * 10 ? 1 : 0;
      let c: number;
      if (u < 0.05) c = b < 0.5 ? C.rust : C.darkRed;
      else if (u < 0.2) c = b < (u - 0.05) / 0.15 ? C.purple : C.darkRed;
      else if (u < 0.5) c = b < (u - 0.2) / 0.3 ? C.navy : C.purple;
      else c = C.navy;
      if (near && (y + (x >> 2)) % 3 === 0 && b < 0.6 - u) c = u < 0.25 ? C.gold : C.orange;
      r.data[y * w + x] = c;
    }
  }
  // wave dashes
  const wr = rng(8);
  for (let i = 0; i < 160; i++) {
    const y = Math.round(HZ + 3 + wr() * wr() * (h - HZ));
    const x = Math.round(wr() * w);
    const len = 2 + Math.round(wr() * 6 * (1 + (y - HZ) / 60));
    r.rectPx(x, y, len, 1, y < HZ + 30 ? C.magenta : C.purple);
  }
  // distant desert mesas on the far left horizon
  const mr = rng(21);
  r.setTransform(1, 0, 0);
  for (let i = 0; i < 7; i++) {
    const mx = cx - 330 + i * 60 + mr() * 30;
    const mw = 30 + mr() * 50;
    const mh = 5 + mr() * 12;
    const base = HZ + 3;
    r.fillPx(
      [mx - mw / 2 - 6, base, mx - mw / 2, base - mh, mx + mw / 2, base - mh, mx + mw / 2 + 8, base],
      C.purple,
    );
    r.rectPx(mx - mw / 2, base - mh, mw, 1, C.magenta);
  }
  // land under the city (plain ground between houses)
  const ground: number[] = [];
  for (let y = HZ + 2; y <= h; y += 4) ground.push(shore(y, cx) + 3, y);
  ground.push(-10, h, -10, HZ + 2);
  const cityR = new Raster(w, h);
  cityR.fillPx(ground, C.tan);
  // quay wall along the shore
  const quay: number[] = [];
  for (let y = HZ + 2; y <= h; y += 4) quay.push(shore(y, cx) + 3, y);
  for (let y = h; y >= HZ + 2; y -= 4) quay.push(shore(y, cx) + 6, y + 2);
  cityR.fillPx(quay, C.sand);
  const lamps: Lamp[] = [];
  const rows = (y0: number, y1: number, step: number): { y: number; s: number; x0: number; x1: number }[] => {
    const out = [];
    for (let y = y0; y <= y1; y += step) {
      const u = (y - HZ) / (230 - HZ);
      out.push({ y, s: 0.38 + Math.pow(u, 1.2) * 0.95, x0: -20, x1: shore(y, cx) - 10 * (0.4 + u) });
    }
    return out;
  };
  city(cityR, 404, rows(HZ + 8, 170, 7), lamps);
  const windowAt = sanctum(cityR, cx - 44, 178, 0.95, lamps);
  city(cityR, 405, rows(184, 268, 9), lamps);
  // wooden piers with moored boats
  for (const [py, len] of [
    [150, 16],
    [196, 30],
    [224, 36],
    [252, 44],
  ] as const) {
    const px = Math.round(shore(py, cx)) + 4;
    const th = Math.max(1, Math.round((py - HZ) / 60));
    cityR.rectPx(px, py, len, th, C.brown);
    cityR.rectPx(px, py + th, len, 1, C.darkBrown);
    for (let x = px + 3; x < px + len; x += 5) cityR.rectPx(x, py + th, 1, th + 2, C.darkBrown);
  }
  // breakwater + lighthouse
  const bw = shore(172, cx);
  cityR.fillPx([bw - 4, 171, cx + 214, 166, cx + 216, 170, bw - 2, 176], C.sand);
  cityR.fillPx([bw - 2, 176, cx + 216, 170, cx + 216, 172, bw, 178], C.tan);
  for (let x = Math.round(bw); x < cx + 214; x += 7)
    cityR.px(x, 172 - Math.round(((x - bw) / (cx + 214 - bw)) * 5), C.brown);
  const light = lighthouse(cityR, cx + 212, 168, 0.75);
  // relight for the eclipse: dusk colors, gold rim on edges facing the corona
  cityR.remap(DUSK);
  cityR.rim(C.orange, 0, -1);
  cityR.rim(C.gold, 1, 0);
  // ships in the harbor (dusk colors, lanterns)
  const ships = new Raster(w, h);
  for (const [x, y, s, flip, m] of [
    [cx + 150, 152, 0.55, true, 1],
    [cx + 128, 162, 0.7, false, 2],
    [cx + 186, 184, 1, true, 2],
    [cx + 112, 204, 1.3, false, 2],
    [cx + 214, 222, 1.1, true, 1],
  ] as const) {
    ship(ships, x, y, s, flip, m);
    lamps.push({ x: Math.round(x + (flip ? -9 : 9) * s), y: Math.round(y - 5 * s) });
  }
  ships.remap(DUSK);
  ships.rim(C.rust, 0, -1);
  cityR.over(ships);
  // aerial haze over the far rows
  for (let y = HZ; y < 160; y++) {
    const k = 1 - (y - HZ) / 32;
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const v = cityR.data[i];
      if (v && bayer(x, y) < k * 0.5) cityR.data[i] = v === C.orange || v === C.gold ? C.rust : C.purple;
    }
  }
  r.over(cityR);
  return { lamps, light, windowAt };
}

export function drawSolenneArrival(ctx: CanvasRenderingContext2D, t: number, w: number, h: number): void {
  const cx = Math.round(w / 2);
  const [sx, sy] = sunPos(w);

  const sky = layer('sol/sky', w, h, (r) => {
    skyGradient(r, [C.black, C.void0, C.purple, C.plum, C.magenta, C.rust, C.orange], 0, HZ + 4);
    stars(r, 17, 70, 64);
    glowInto(r, sx, sy, 128, [C.gold, C.orange, C.rust, C.darkRed, C.purple], 1);
    cloudBand(r, 81, 112, 8, 700, C.plum, C.purple, [40, 90], [1, 3]);
    cloudBand(r, 82, 96, 6, 640, C.purple, C.magenta, [30, 70], [1, 2]);
  });
  blit(ctx, sky);
  twinkle(ctx, starList(17, 70, 64, w), t, 6, C.lightGray);

  // flickering corona + black disc
  const ci = Math.floor(t * 7) % 8;
  const cor = frame('sol/corona', ci, 8, CORONA, CORONA, (r, i) =>
    corona(r, CORONA / 2, CORONA / 2, SUN_R, i / 8, 5),
  );
  blitC(ctx, cor, sx, sy);

  // city, harbor and sea (static)
  const land = layer('sol/land', w, h, (r) => {
    const info = drawLand(r, w);
    lampCache.set(w, info);
  });
  blit(ctx, land);
  const info = landInfo(w);

  // lamps flickering in the windows
  for (let i = 0; i < info.lamps.length; i++) {
    const l = info.lamps[i];
    const f = Math.sin(t * (2 + (i % 5)) + i * 1.3);
    if (f < -0.7) continue;
    ctx.fillStyle = HEX[f > 0.5 ? C.yellow : C.gold];
    ctx.fillRect(l.x, l.y, 1, 1);
  }
  // sun-window of the sanctum tower + lighthouse lamp pulse
  const pulse = (Math.sin(t * 2.4) + 1) / 2;
  blitC(
    ctx,
    glow(3 + Math.round(pulse * 2), [C.yellow, C.gold, C.orange]),
    info.windowAt[0],
    info.windowAt[1],
  );
  blitC(
    ctx,
    glow(5 + Math.round(pulse * 3), [C.white, C.yellow, C.gold, C.orange]),
    info.light[0],
    info.light[1],
  );

  // glitter on the water under the black sun
  const gr = rng(Math.floor(t * 6));
  for (let i = 0; i < 14; i++) {
    const y = HZ + 2 + Math.floor(gr() * gr() * 60);
    const x = sx + Math.round((gr() - 0.5) * (30 - (y - HZ) * 0.2));
    if (x > shore(y, cx) + 6) {
      ctx.fillStyle = HEX[gr() > 0.5 ? C.yellow : C.gold];
      ctx.fillRect(x, y, 2 + Math.floor(gr() * 3), 1);
    }
  }

  // drifting sand haze over the city (behind the cliff)
  for (let b = 0; b < 2; b++) {
    const y0 = 176 + b * 38;
    const off = ((t * (26 + b * 14)) % 160) - 80;
    const pts: number[] = [];
    for (let x = -40; x <= w + 40; x += 20) pts.push(x, y0 + Math.sin((x - off) * 0.03 + b) * 6);
    for (let x = w + 40; x >= -40; x -= 20) pts.push(x, y0 + 10 + Math.sin((x - off) * 0.045 + b * 2) * 5);
    fillPolyCtx(ctx, pts, ditherPat(ctx, b ? C.rust : C.orange, 2), w, h);
  }
  // cliff + road (foreground, static)
  const fg = layer('sol/cliff', w, h, (r) => {
    const edge = cx - 74;
    const tops = new Float64Array(w);
    for (let x = 0; x < w; x++) {
      let y = cliffTop(x, cx);
      if (Number.isNaN(y)) {
        // cliff face dropping away to the right of the edge
        const dx = x - edge;
        if (dx > 30) continue;
        y = 206 + dx * dx * 0.09 + dx * 0.8;
      }
      tops[x] = y;
      for (let yy = Math.round(y); yy < h; yy++) {
        const d = yy - y;
        r.px(x, yy, d < 2 ? C.plum : bayer(x, yy) < 0.35 - d * 0.01 ? C.plum : C.black);
      }
    }
    // rock strata
    const rr = rng(3);
    r.setTransform(1, 0, 0);
    for (let i = 0; i < 40; i++) {
      const x = rr() * (edge + 24);
      const top = tops[Math.max(0, Math.min(w - 1, Math.round(x)))];
      const y = top + 8 + rr() * (h - top);
      r.linePx([x, y, x + 6 + rr() * 16, y + rr() * 2 - 1], rr() > 0.5 ? C.plum : C.darkBrown);
    }
    // road along the cliff top toward the edge
    const road = spline(
      [
        [-10, 250],
        [cx - 190, 226],
        [cx - 130, 212],
        [cx - 86, 206],
        [cx - 84, 210],
        [cx - 128, 220],
        [cx - 186, 240],
        [-10, 272],
      ],
      true,
      6,
    );
    r.fillPx(road, (x, y) => (bayer(x, y) < 0.2 ? C.darkBrown : C.plum));
    // wheel ruts
    r.linePx(
      spline(
        [
          [0, 256],
          [cx - 186, 232],
          [cx - 128, 215],
          [cx - 90, 208],
        ],
        false,
        6,
      ),
      C.darkBrown,
    );
    // rim light on the cliff top and edge facing the corona
    for (let x = 0; x < w; x++) {
      if (!tops[x]) continue;
      const y = Math.round(tops[x]);
      r.px(x, y, x > edge - 60 ? C.gold : C.rust);
      if (x > edge - 20) r.px(x, y + 1, C.orange);
    }
    // scrubby tufts on the cliff top
    for (let i = 0; i < 26; i++) {
      const x = Math.round(rr() * (edge - 4));
      const y = Math.round(tops[x]);
      const hh = 2 + Math.round(rr() * 4);
      r.linePx([x, y, x + 1, y - hh], C.plum);
      r.linePx([x + 2, y, x + 3, y - hh + 1], C.plum);
      r.px(x + 1, y - hh, C.rust);
    }
    // milestone at the edge
    r.rectPx(cx - 96, 196, 5, 9, C.plum);
    r.rectPx(cx - 96, 195, 5, 1, C.darkBrown);
    r.px(cx - 92, 196, C.gold);
    r.rectPx(cx - 92, 197, 1, 7, C.rust);
  });
  blit(ctx, fg);

  // palm + Kai & Lyra (wind frames)
  const fi = Math.floor(t * 8) % 8;
  const palmF = frame('sol/palm', fi, 8, 130, 150, (r, i) => {
    const ph = (i / 8) * Math.PI * 2;
    palm(r, 40, 148, 112, 20, ph, [C.plum, C.black, C.plum, C.black]);
    r.rim(C.gold, 1, 0);
    r.rim(C.rust, 0, -1);
  });
  blit(ctx, palmF, cx - 250, 216 - 148);

  const duo = frame('sol/duo', fi, 8, 96, 76, (r, i) => {
    const ph = (i / 8) * Math.PI * 2;
    const sc = new Raster(96, 76);
    const k = new Raster(96, 76);
    k.setTransform(0.86, 30, 72);
    sc.copyTransform(k);
    kaiBack(k, sc, ph);
    k.outline(C.black);
    const l = new Raster(96, 76);
    l.setTransform(0.82, 56, 70);
    sc.copyTransform(l);
    lyraBack(l, sc, ph + 1);
    l.outline(C.black);
    r.over(l);
    r.over(k);
    r.remap(SHADOWED);
    r.rim(C.gold, 1, 0);
    r.rim(C.orange, 0, -1);
  });
  blit(ctx, duo, cx - 152, 212 - 72);

  // drifting sand grains blown to the right
  const sr = rng(55);
  for (let i = 0; i < 120; i++) {
    const sp = 40 + sr() * 80;
    const x0 = sr() * (w + 60);
    const near = sr() < 0.6;
    const y0 = near ? 186 + sr() * 84 : 130 + sr() * 70;
    const x = ((x0 + t * sp) % (w + 60)) - 30;
    const y = y0 + Math.sin(t * 2 + i) * 3 + ((t * sp * 0.08) % 12);
    const c = i % 4 === 0 ? C.yellow : i % 4 === 1 ? C.gold : i % 4 === 2 ? C.tan : C.orange;
    ctx.fillStyle = HEX[c];
    const len = sp > 100 ? 4 : sp > 75 ? 2 : 1;
    ctx.fillRect(Math.round(x), Math.round(y), len, 1);
  }
  // wisps of sand streaming off the cliff edge
  for (let i = 0; i < 5; i++) {
    const u = (t * 0.7 + i / 5) % 1;
    const x = cx - 150 + u * 150;
    const y = 200 + i * 5 - u * 10;
    const len = Math.round(12 + Math.sin(i * 2.3) * 5);
    fillPolyCtx(
      ctx,
      [x, y, x + len, y - 1, x + len, y, x, y + 1],
      ditherPat(ctx, C.tan, Math.round(6 * (1 - u))),
      w,
      h,
    );
  }
}
