/**
 * Beam struggle: Kai (left) fires a cyan beam, Malachar (right) a void beam;
 * the collision sphere wobbles (0–3s), pushes toward Kai (3–4.5s), then Kai's
 * beam surges (5–6.5s) and overpowers Malachar, followed by a steady loop.
 */
import { C, HEX } from '../pal';
import { Raster, bayer } from '../raster';
import { renderBust, type Expression } from '../face';
import { kai } from '../characters/kai';
import { malachar } from '../characters/malachar';
import { rng, smooth } from '../geom';
import { lightning } from '../aura';
import { blit, blitC, fade, frame, glow, layer, sparkleSprite } from './kit';
import { cloudBand, ridge, ridgeFn, skyGradient } from './scenery';
import { speedLines } from '../fx';
import { OUTFIT, cape, legs, limb, palm, scarfTail, waist, type Who } from './figure';

const S = 1.02;
const FACE_Y = 112;
const BEAM_Y = 146;

/** Face anchor x for each fighter. */
function anchorX(who: Who, w: number): number {
  return w / 2 + (who === 'kai' ? -162 : 162);
}

function placeFig(r: Raster, who: Who, w: number): Raster {
  return r.place(S, 0, 51, 50, anchorX(who, w), FACE_Y, who === 'malachar');
}

/** Hands position (screen) where the beam starts. */
function handX(who: Who, w: number): number {
  const r = placeFig(new Raster(1, 1), who, w);
  return r.X(124, 97);
}

function drawFighter(r: Raster, who: Who, w: number, expr: Expression, ph: number): void {
  placeFig(r, who, w);
  const o = OUTFIT[who];
  if (who === 'malachar') cape(r, ph, 10);
  else scarfTail(r, ph, false, 6);
  // back (far) arm first
  limb(
    r,
    o,
    [
      [82, 92],
      [104, 100],
      [122, 95],
    ],
    12,
    10,
    o.sleeve,
    o.sleeveSh,
    o.fore,
    o.foreSh,
    who === 'kai',
  );
  legs(r, o, [40, 132], [28, 156], [16, 178], [62, 132], [84, 152], [98, 178]);
  waist(r, who);
  const bust = new Raster(r.w, r.h).copyTransform(r);
  renderBust(bust, who === 'kai' ? kai : malachar, expr, {
    variant: 'full',
    windX: -6,
    windY: -2,
    phase: ph,
    iris: who === 'kai' ? [C.blue, C.cyan, C.white] : [C.red, C.hotPink, C.white],
    eyeGlow: C.white,
  });
  r.over(bust);
  // near arm reaching across the body
  limb(
    r,
    o,
    [
      [18, 94],
      [70, 106],
      [120, 100],
    ],
    13,
    10.5,
    o.sleeve,
    o.sleeveSh,
    o.fore,
    o.foreSh,
    who === 'kai',
  );
  palm(r, o, 124, 95);
  palm(r, o, 122, 101, 0.3);
}

/** Clash x position over time. */
export function clashX(t: number, w: number): number {
  const kx = handX('kai', w) + 40;
  const mx = handX('malachar', w) - 14;
  const cx = w / 2;
  if (t < 3) return cx + Math.sin(t * 2.2) * 14 + Math.sin(t * 5.3) * 5;
  const c3 = cx + Math.sin(3 * 2.2) * 14 + Math.sin(3 * 5.3) * 5;
  if (t < 4.5) return c3 + (kx - c3) * smooth((t - 3) / 1.5) + Math.sin(t * 30) * 2;
  if (t < 5) return kx + Math.sin(t * 40) * 3;
  if (t < 6.5) {
    const u = (t - 5) / 1.5;
    return kx + (mx - kx) * (u * u * (3 - 2 * u));
  }
  return mx + Math.sin(t * 20) * 2;
}

/** Cached wavy beam texture (horizontal, layered thickness), animated by frame index. */
function beamStrip(
  name: string,
  w: number,
  thick: number,
  cols: readonly number[],
  fi: number,
): HTMLCanvasElement {
  const th = Math.max(3, Math.round(thick / 3) * 3);
  const H = th * 2 + 10;
  const W = w + 40;
  return frame(`beam/strip_${name}_${th}`, fi, 4, W, H, (r, i) => {
    const y = H / 2;
    const radii = [th, th * 0.72, th * 0.45, th * 0.2];
    const ph = (i / 4) * Math.PI * 2;
    for (let L = 0; L < 4; L++) {
      for (let x = 0; x < W; x += 2) {
        const wob = Math.sin(x * 0.21 + ph * 2 + L) * (L === 0 ? 2 : 1) + Math.sin(x * 0.07 - ph) * 1.2;
        const hr = Math.max(1, radii[L] + wob * (1 - L * 0.25));
        r.rectPx(x, Math.round(y - hr), 2, Math.round(hr * 2), cols[L]);
      }
    }
    const rand = rng(i * 13 + th);
    for (let k = 0; k < W / 30; k++) {
      const yy = Math.round(y + (rand() - 0.5) * th * 1.2);
      r.rectPx(Math.round(rand() * W), yy, Math.round(8 + rand() * 24), 1, cols[3]);
    }
  });
}

function beam(
  ctx: CanvasRenderingContext2D,
  name: string,
  x0: number,
  x1: number,
  y: number,
  t: number,
  cols: readonly number[],
  thick: number,
  w: number,
): void {
  const len = Math.round(Math.abs(x1 - x0));
  if (len < 1) return;
  const strip = beamStrip(name, w, thick, cols, Math.floor(t * 15) % 4);
  const a = Math.round(Math.min(x0, x1));
  ctx.drawImage(strip, 0, 0, len, strip.height, a, Math.round(y - strip.height / 2), len, strip.height);
}

export function drawBeamClash(ctx: CanvasRenderingContext2D, t: number, w: number, h: number): void {
  const cx = Math.round(w / 2);
  const X = Math.round(clashX(t, w));
  const surge = t >= 5 ? Math.min(1, (t - 5) / 1.5) : 0;
  const won = t >= 6.5;
  const danger = t >= 3 && t < 5;
  const shake = danger || (t >= 5 && t < 7) ? 2 : 1;
  const sx = Math.round(Math.sin(t * 77) * shake);
  const sy = Math.round(Math.cos(t * 59) * shake * 0.6);

  const bg = layer('beam/bg', w, h, (r) => {
    const left = new Raster(w, h);
    skyGradient(left, [C.black, C.navy, C.blue, C.darkSlate], 0, 230);
    const right = new Raster(w, h);
    skyGradient(right, [C.black, C.void0, C.purple, C.darkRed], 0, 230);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const u = (x - cx) / 90;
        const i = y * w + x;
        r.data[i] = bayer(x, y) < 0.5 + u * 0.5 ? right.data[i] : left.data[i];
      }
    }
    cloudBand(r, 31, 60, 16, 700, C.darkSlate, C.slate, [40, 100], [4, 9]);
    cloudBand(r, 32, 120, 12, 700, C.navy, C.darkSlate, [40, 90], [3, 6]);
    ridge(r, ridgeFn(214, 16, 60, 21), C.navy, C.darkSlate);
    // ground
    for (let y = 236; y < h; y++)
      for (let x = 0; x < w; x++) r.data[y * w + x] = bayer(x, y) < (y - 236) / 34 ? C.black : C.darkSlate;
    r.setTransform(1, 0, 0);
    const rand = rng(8);
    for (let i = 0; i < 40; i++) {
      const x = rand() * w;
      const y = 240 + rand() * 28;
      r.ellipse(x, y, 1 + rand() * 3, 1 + rand(), C.slate);
    }
  });
  blit(ctx, bg, sx, sy);

  // light from the clash on the sky
  blitC(
    ctx,
    glow(86 + Math.round(Math.sin(t * 9) * 2) * 3, [C.white, C.cyan, C.magenta, C.purple]),
    X + sx,
    BEAM_Y + sy,
  );
  speedLines(ctx, X + sx, BEAM_Y + sy, w, h, t, '#ffffff', 0.55);

  // torn ground: trench under the beams (static) + deeper gouge + debris at the clash
  const kh = handX('kai', w);
  const mh = handX('malachar', w);
  const trench = layer('beam/trench', w, h, (r) => {
    for (let x = Math.round(kh); x < mh; x++) {
      const d = 3 + Math.round(Math.abs(Math.sin(x * 0.31)) * 3);
      r.rectPx(x, 238, 1, d, C.black);
      if (x % 3 === 0) r.px(x, 238, C.magenta);
    }
  });
  blit(ctx, trench, sx, sy);
  ctx.fillStyle = HEX[C.black];
  ctx.fillRect(X - 26 + sx, 238 + sy, 52, 7);
  ctx.fillStyle = HEX[won ? C.cyan : C.hotPink];
  ctx.fillRect(X - 26 + sx, 238 + sy, 52, 1);
  const dr = rng(Math.floor(t * 12));
  for (let i = 0; i < 16; i++) {
    const x = X + (dr() - 0.5) * 60;
    const y = 236 - dr() * 60 * ((t * 3 + i) % 1);
    ctx.fillStyle = HEX[i % 2 ? C.slate : C.darkSlate];
    ctx.fillRect(Math.round(x) + sx, Math.round(y) + sy, 2 + (i % 3), 2);
  }

  // fighters
  const ph = Math.floor(t * 8) % 4;
  const kaiExpr: Expression = danger ? 'hurt' : 'shout';
  const kf = frame(`beam/kai_${kaiExpr}`, ph, 4, w, h, (r, i) => {
    drawFighter(r, 'kai', w, kaiExpr, (i / 4) * Math.PI * 2);
    r.rim(C.cyan, 1, 0);
    r.rim(C.white, 0, -1);
  });
  blit(ctx, kf, sx, sy);
  const malExpr: Expression = won ? 'hurt' : 'shout';
  const mf = frame(`beam/mal_${malExpr}`, ph, 4, w, h, (r, i) => {
    drawFighter(r, 'malachar', w, malExpr, (i / 4) * Math.PI * 2);
    r.rim(C.hotPink, -1, 0);
    r.rim(C.red, 0, -1);
  });
  blit(ctx, mf, sx, sy);

  // beams
  const kThick = 15 + surge * 12 + (won ? 5 : 0) - (danger ? 3 : 0);
  const mThick = won ? 0 : 15 + (danger ? 4 : 0) - surge * 6;
  beam(ctx, 'k', kh + sx, X + sx, BEAM_Y + sy, t, [C.blue, C.sky, C.cyan, C.white], kThick, w);
  if (mThick > 1)
    beam(ctx, 'm', X + sx, mh + sx, BEAM_Y + sy, t, [C.void0, C.purple, C.magenta, C.pink], mThick, w);
  // hand glows
  blitC(ctx, glow(18 + Math.round(surge * 3) * 3, [C.white, C.cyan, C.sky]), kh + sx, BEAM_Y + sy);
  if (!won) blitC(ctx, glow(17, [C.white, C.hotPink, C.purple]), mh + sx, BEAM_Y + sy);

  // collision sphere
  const pulse = (Math.sin(t * 26) + 1) / 2;
  const R = Math.round(26 + pulse * 6 + surge * 10 + (won ? 16 : 0));
  blitC(
    ctx,
    glow(R, won ? [C.white, C.white, C.cyan, C.sky] : [C.white, C.white, C.cyan, C.magenta, C.purple]),
    X + sx,
    BEAM_Y + sy,
  );
  // electric arcs around the sphere
  const slot = Math.floor(t * 12);
  const ar = rng(slot);
  for (let i = 0; i < 3; i++) {
    const a = ar() * Math.PI * 2;
    const r0 = R * 0.5;
    const r1 = R + 10 + ar() * 18;
    lightning(
      ctx,
      X + Math.cos(a) * r0 + sx,
      BEAM_Y + Math.sin(a) * r0 + sy,
      X + Math.cos(a) * r1 + sx,
      BEAM_Y + Math.sin(a) * r1 + sy,
      slot * 5 + i,
      C.white,
      i % 2 ? C.cyan : C.magenta,
      1,
      0.5,
    );
  }
  // spark spray
  const sp = rng(17);
  for (let i = 0; i < 60; i++) {
    const period = 0.35 + sp() * 0.5;
    const u = ((t + sp() * period) % period) / period;
    const a = sp() * Math.PI * 2;
    const v = 60 + sp() * 160;
    const x = X + Math.cos(a) * v * u * period * 1.6;
    const y = BEAM_Y + Math.sin(a) * v * u * period * 1.2 + u * u * 30;
    ctx.fillStyle = HEX[u < 0.3 ? C.white : i % 2 ? C.cyan : C.hotPink];
    ctx.fillRect(Math.round(x) + sx, Math.round(y) + sy, u < 0.5 ? 2 : 1, 1);
  }
  blitC(ctx, sparkleSprite(6 + (slot % 3), C.white), X + sx, BEAM_Y + sy);

  // overpowered: engulfing blast at Malachar
  if (won) {
    const bt = t - 6.5;
    const big = 70 + Math.round(Math.sin(t * 7) * 3) * 4 + Math.min(40, Math.round(bt * 40));
    blitC(ctx, glow(big, [C.white, C.white, C.cyan, C.sky, C.blue]), mh + 20 + sx, BEAM_Y - 10 + sy);
    if (bt < 0.3) fade(ctx, C.white, 1 - bt / 0.3, 0, 0, w, h);
  }
  // surge flash
  if (t >= 5 && t < 5.2) fade(ctx, C.cyan, 1 - (t - 5) / 0.2, 0, 0, w, h);
}
