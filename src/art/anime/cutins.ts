/**
 * Ultimate-attack cut-ins: a slanted band slams in across the screen showing
 * an extreme close-up of the character's eyes, with streaming speed lines, a
 * light streak and energy particles, then collapses. Drawn OVER gameplay.
 */
import { C, HEX } from './pal';
import { Raster, vgrad } from './raster';
import { renderBust, type Expression, type Spec } from './face';
import { kai } from './characters/kai';
import { lyra } from './characters/lyra';
import { malachar } from './characters/malachar';
import { blitC, fade, fillPolyCtx, glow, layer, sparkleSprite } from './illustrations/kit';
import { OUTFIT, limb, palm } from './illustrations/figure';
import { lightning } from './aura';
import { speedLines } from './fx';
import { rng, smooth } from './geom';
import type { CutInId } from './index';

interface CutDef {
  spec: Spec;
  expr: Expression;
  iris?: readonly [number, number, number];
  eyeGlow?: number;
  bg: readonly number[];
  streak: readonly number[];
  edge: number;
  edge2: number;
  lines: string;
  glowCols: readonly number[];
  sparks: readonly number[];
  duration: number;
}

const DEFS: Record<CutInId, CutDef> = {
  kai_surge: {
    spec: kai,
    expr: 'angry',
    iris: [C.blue, C.cyan, C.white],
    eyeGlow: C.white,
    bg: [C.navy, C.blue, C.sky, C.cyan],
    streak: [C.white, C.cyan, C.ice1],
    edge: C.white,
    edge2: C.cyan,
    lines: '#2ce8f5',
    glowCols: [C.white, C.cyan, C.sky],
    sparks: [C.white, C.cyan, C.cyan],
    duration: 1.4,
  },
  lyra_support: {
    spec: lyra,
    expr: 'determined',
    eyeGlow: C.white,
    bg: [C.navy, C.purple, C.magenta, C.pink],
    streak: [C.white, C.pink, C.yellow],
    edge: C.white,
    edge2: C.yellow,
    lines: '#fee761',
    glowCols: [C.white, C.pink, C.magenta],
    sparks: [C.yellow, C.white, C.pink],
    duration: 1.3,
  },
  kai_cannon: {
    spec: kai,
    expr: 'shout',
    iris: [C.blue, C.cyan, C.white],
    eyeGlow: C.white,
    bg: [C.navy, C.blue, C.sky, C.cyan],
    streak: [C.white, C.cyan, C.ice1],
    edge: C.white,
    edge2: C.cyan,
    lines: '#2ce8f5',
    glowCols: [C.white, C.cyan, C.sky],
    sparks: [C.white, C.cyan, C.cyan],
    duration: 1.6,
  },
  malachar_rage: {
    spec: malachar,
    expr: 'angry',
    iris: [C.red, C.hotPink, C.white],
    eyeGlow: C.pink,
    bg: [C.black, C.void0, C.purple, C.darkRed],
    streak: [C.hotPink, C.red, C.magenta],
    edge: C.hotPink,
    edge2: C.black,
    lines: '#ff0044',
    glowCols: [C.hotPink, C.red, C.darkRed],
    sparks: [C.hotPink, C.magenta, C.purple],
    duration: 1.4,
  },
};

export function cutInLength(id: CutInId): number {
  return (DEFS[id] ?? DEFS.kai_surge).duration;
}

const BAND_H = 100;
const SLOPE = -0.14;

/** Top edge of the band at column x (pixel space). */
function bandTop(x: number, w: number, h: number): number {
  return h / 2 - 8 - BAND_H / 2 + SLOPE * (x - w / 2);
}

function faceScale(): number {
  return 4.7;
}

export function cutIn(ctx: CanvasRenderingContext2D, id: CutInId, t: number, w: number, h: number): void {
  const d = DEFS[id] ?? DEFS.kai_surge;
  const T = d.duration;
  if (t < 0 || t > T) return;
  const cy = h / 2 - 8;

  // timing: slam in (0–0.14), hold, collapse (last 0.18)
  const inP = smooth(t / 0.14);
  const outP = smooth((t - (T - 0.18)) / 0.18);
  const slide = (1 - inP) * -(w + 80);
  const bh = BAND_H * (1 - outP);
  const hold = Math.max(0, t - 0.14);

  // dim the gameplay + global focus lines
  fade(ctx, C.black, 0.5 * inP * (1 - outP), 0, 0, w, h);
  if (t > 0.08 && outP < 0.6) speedLines(ctx, w / 2, cy, w, h, t, d.lines, 0.7);

  if (bh < 1) return;

  // band polygon (with slide offset)
  const x0 = slide - 40;
  const x1 = slide + w + 40;
  const mid = (x: number): number => bandTop(x - slide, w, h) + BAND_H / 2;
  const poly = [x0, mid(x0) - bh / 2, x1, mid(x1) - bh / 2, x1, mid(x1) + bh / 2, x0, mid(x0) + bh / 2];

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(poly[0], poly[1]);
  for (let i = 2; i < poly.length; i += 2) ctx.lineTo(poly[i], poly[i + 1]);
  ctx.closePath();
  ctx.clip();

  // background gradient
  const bg = layer(`cut/${id}/bg`, w, h, (r) => {
    const top = cy - BAND_H / 2 - 50;
    r.rectPx(0, 0, w, h, vgrad(top, top + BAND_H + 100, [...d.bg, ...[...d.bg].reverse().slice(1)]));
  });
  ctx.drawImage(bg, Math.round(slide), 0);

  // streaming horizontal streaks (fast, right → left)
  const rand = rng(7);
  for (let i = 0; i < 46; i++) {
    const y = Math.round(cy - 70 + rand() * 140);
    const len = 20 + rand() * 120;
    const sp = 700 + rand() * 900;
    const x = ((((rand() * (w + 300) - hold * sp) % (w + 300)) + w + 300) % (w + 300)) - 150 + slide;
    ctx.fillStyle = HEX[d.streak[i % d.streak.length]];
    ctx.fillRect(Math.round(x), y, Math.round(len), rand() > 0.85 ? 2 : 1);
  }

  const drift = Math.round(-hold * 14);
  if (id === 'kai_cannon') {
    cannonCharge(ctx, t, w, h, slide);
  } else {
    // eye close-up (drifts slowly to the left during the hold)
    const face = layer(`cut/${id}/face`, w, h, (r) => {
      const s = faceScale();
      r.place(s, -0.06, 52, 50, w / 2 + 16, cy + 2);
      renderBust(r, d.spec, d.expr, { iris: d.iris, eyeGlow: d.eyeGlow, noBody: true, noMarks: true });
      r.rim(d.edge2, 0, -1);
    });
    ctx.drawImage(face, Math.round(slide) + drift, 0);

    // eye glow
    const s = faceScale();
    const eyeRaster = new Raster(1, 1).place(s, -0.06, 52, 50, w / 2 + 16, cy + 2);
    const pulse = (Math.sin(t * 24) + 1) / 2;
    const ex = [eyeRaster.X(40, 51), eyeRaster.X(64.5, 51)];
    const ey = [eyeRaster.Y(40, 51), eyeRaster.Y(64.5, 51)];
    for (let k = 0; k < 2; k++) {
      if (id === 'kai_surge')
        blitC(ctx, glow(10 + Math.round(pulse * 2) * 2, d.glowCols), ex[k] + slide + drift, ey[k]);
      blitC(ctx, sparkleSprite(pulse > 0.5 ? 6 : 4, d.glowCols[1]), ex[k] + slide + drift - 8, ey[k] - 10);
    }
  }

  // light streak sweeping across the eyes
  const sw = (t - 0.22) / 0.35;
  if (sw > 0 && sw < 1) {
    const lx = -60 + sw * (w + 120) + slide;
    fillPolyCtx(ctx, [lx, cy - 80, lx + 26, cy - 80, lx - 4, cy + 80, lx - 30, cy + 80], HEX[C.white], w, h);
    fillPolyCtx(
      ctx,
      [lx + 30, cy - 80, lx + 36, cy - 80, lx + 6, cy + 80, lx, cy + 80],
      HEX[d.edge2 === C.black ? C.hotPink : d.edge2],
      w,
      h,
    );
  }

  // energy particles rising / sparks
  const pr = rng(31);
  for (let i = 0; i < 40; i++) {
    const x = pr() * w + slide;
    const sp = 40 + pr() * 90;
    const y = cy + 60 - ((hold * sp + pr() * 140) % 140);
    const c = d.sparks[i % d.sparks.length];
    if (id === 'lyra_support' && i % 4 === 0) {
      blitC(ctx, sparkleSprite(2, C.yellow), x, y);
    } else {
      ctx.fillStyle = HEX[c];
      ctx.fillRect(Math.round(x), Math.round(y), pr() > 0.7 ? 2 : 1, 2);
    }
  }
  ctx.restore();

  // crisp band borders
  const edge = (off: number, th: number, col: number): void => {
    const e = [x0, mid(x0) + off, x1, mid(x1) + off, x1, mid(x1) + off + th, x0, mid(x0) + off + th];
    fillPolyCtx(ctx, e, HEX[col], w, h);
  };
  edge(-bh / 2 - 3, 3, d.edge);
  edge(-bh / 2 - 6, 2, d.edge2);
  edge(bh / 2, 3, d.edge);
  edge(bh / 2 + 3, 2, d.edge2);

  // impact flash as the band lands
  if (t > 0.12 && t < 0.24) fade(ctx, C.white, 1 - (t - 0.12) / 0.12, 0, 0, w, h);

  if (id === 'kai_cannon') cannonBeam(ctx, t, w, h, T);
}

/* ------------------------------------------------------------ kai_cannon */

const CAN_S = 1.3;
const FIRE = 0.92;

function cannonPlace(r: Raster, w: number, h: number): Raster {
  return r.place(CAN_S, Math.atan(SLOPE), 51, 50, w / 2 - 128, h / 2 - 8 - 4);
}

/** Energy ball position (screen). */
function ballPos(w: number, h: number): [number, number] {
  const r = cannonPlace(new Raster(1, 1), w, h);
  return [r.X(150, 62), r.Y(150, 62)];
}

function cannonCharge(ctx: CanvasRenderingContext2D, t: number, w: number, h: number, slide: number): void {
  const fig = layer('cut/kai_cannon/fig', w, h, (r) => {
    cannonPlace(r, w, h);
    const o = OUTFIT.kai;
    limb(
      r,
      o,
      [
        [82, 92],
        [112, 78],
        [142, 58],
      ],
      12,
      10,
      o.sleeve,
      o.sleeveSh,
      o.fore,
      o.foreSh,
    );
    const bust = new Raster(w, h).copyTransform(r);
    renderBust(bust, kai, 'shout', {
      variant: 'full',
      iris: [C.blue, C.cyan, C.white],
      eyeGlow: C.white,
      windX: -6,
      windY: -3,
      noMarks: true,
    });
    r.over(bust);
    limb(
      r,
      o,
      [
        [18, 94],
        [80, 84],
        [138, 66],
      ],
      13,
      10.5,
      o.sleeve,
      o.sleeveSh,
      o.fore,
      o.foreSh,
    );
    palm(r, o, 144, 58);
    palm(r, o, 142, 66, 0.3);
    r.rim(C.cyan, 1, 0);
    r.rim(C.white, 0, -1);
  });
  ctx.drawImage(fig, Math.round(slide), 0);
  const [bx0, by] = ballPos(w, h);
  const bx = bx0 + slide;
  const ch = Math.min(1, Math.max(0, (t - 0.12) / (FIRE - 0.12)));
  const pulse = (Math.sin(t * 40) + 1) / 2;
  // converging energy
  if (t < FIRE) {
    const pr = rng(5);
    for (let i = 0; i < 26; i++) {
      const a = pr() * Math.PI * 2;
      const u = (t * (1.5 + pr()) + pr()) % 1;
      const rr = (1 - u) * (40 + pr() * 40);
      ctx.fillStyle = HEX[u > 0.7 ? C.white : C.cyan];
      ctx.fillRect(Math.round(bx + Math.cos(a) * rr), Math.round(by + Math.sin(a) * rr), u > 0.5 ? 2 : 1, 1);
    }
  }
  const R = Math.round(3 + ch * 14 + pulse * 2);
  blitC(ctx, glow(R + 6, [C.white, C.cyan, C.sky, C.blue]), bx, by);
  blitC(ctx, glow(Math.max(2, R - 2), [C.white, C.white, C.cyan]), bx, by);
  // crackling arcs
  const slot = Math.floor(t * 15);
  const ar = rng(slot);
  const nb = 1 + Math.round(ch * 3);
  for (let i = 0; i < nb; i++) {
    const a = ar() * Math.PI * 2;
    const r1 = R + 6 + ar() * 14;
    lightning(
      ctx,
      bx + Math.cos(a) * R * 0.6,
      by + Math.sin(a) * R * 0.6,
      bx + Math.cos(a) * r1,
      by + Math.sin(a) * r1,
      slot * 3 + i,
      C.white,
      C.cyan,
      1,
      0.5,
    );
  }
}

function cannonBeam(ctx: CanvasRenderingContext2D, t: number, w: number, h: number, T: number): void {
  if (t < FIRE) return;
  const bt = t - FIRE;
  const [bx, by] = ballPos(w, h);
  const reach = Math.min(1, bt / 0.08);
  const x1 = bx + (w + 40 - bx) * reach;
  const grow = Math.min(1, bt / 0.16);
  const fadeOut = Math.max(0, (t - (T - 0.22)) / 0.22);
  const half = (18 + grow * 44) * (1 - fadeOut * 0.85);
  const cols = [C.blue, C.sky, C.cyan, C.white];
  const radii = [half, half * 0.76, half * 0.5, half * 0.26];
  for (let L = 0; L < 4; L++) {
    ctx.fillStyle = HEX[cols[L]];
    for (let x = Math.floor(bx - radii[L] * 0.6); x <= x1; x += 2) {
      const yc = by + SLOPE * (x - bx);
      const wob = Math.sin(x * 0.19 + t * 30 + L) * (L === 0 ? 3 : 1.5);
      // rounded muzzle end
      const dx = x - bx;
      const cap = dx < 0 ? Math.sqrt(Math.max(0, 1 - (dx / (radii[L] * 0.6)) ** 2)) : 1;
      const hr = Math.max(1, (radii[L] + wob) * cap);
      ctx.fillRect(x, Math.round(yc - hr), 2, Math.round(hr * 2));
    }
  }
  // streaks inside the beam
  const rs = rng(Math.floor(t * 30));
  ctx.fillStyle = HEX[C.white];
  for (let i = 0; i < 10; i++) {
    const x = bx + rs() * (x1 - bx);
    const yc = by + SLOPE * (x - bx) + (rs() - 0.5) * half;
    ctx.fillRect(Math.round(x), Math.round(yc), Math.round(12 + rs() * 30), 1);
  }
  blitC(ctx, glow(Math.round(half * 0.8), [C.white, C.white, C.cyan]), bx, by);
  if (bt < 0.14) fade(ctx, C.white, 1 - bt / 0.14, 0, 0, w, h);
}
