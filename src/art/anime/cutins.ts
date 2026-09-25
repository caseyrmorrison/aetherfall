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

  // eye close-up (drifts slowly to the left during the hold)
  const face = layer(`cut/${id}/face`, w, h, (r) => {
    const s = faceScale();
    r.place(s, -0.06, 52, 50, w / 2 + 16, cy + 2);
    renderBust(r, d.spec, d.expr, { iris: d.iris, eyeGlow: d.eyeGlow, noBody: true, noMarks: true });
    r.rim(d.edge2, 0, -1);
  });
  const drift = Math.round(-hold * 14);
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
}
