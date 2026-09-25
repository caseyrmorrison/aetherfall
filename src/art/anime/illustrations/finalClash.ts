/** Kai vs Malachar: blades crossing at center, split diagonal (cyan vs red/purple), sparks, heavy speed lines. */
import { C, HEX } from '../pal';
import { Raster } from '../raster';
import { renderBust } from '../face';
import { kai } from '../characters/kai';
import { malachar } from '../characters/malachar';
import { rng, starPts } from '../geom';
import { blit, blitC, fade, fillPolyCtx, glow, layer, sparkleSprite } from './kit';
import { glowInto, skyGradient } from './scenery';
import { speedLines } from '../fx';

/** Signed side of the split line: < 0 = Kai (left), > 0 = Malachar (right). */
function side(x: number, y: number, w: number, h: number): number {
  const x0 = w / 2 + 64;
  const x1 = w / 2 - 64;
  // line from (x0, 0) to (x1, h)
  return (x - (x0 + ((x1 - x0) * y) / h)) * 1;
}

function clipSide(r: Raster, keep: -1 | 1): void {
  for (let y = 0; y < r.h; y++) {
    for (let x = 0; x < r.w; x++) {
      const s = side(x + 0.5, y + 0.5, r.w, r.h);
      if ((keep < 0 && s > -1) || (keep > 0 && s < 1)) r.data[y * r.w + x] = 0;
    }
  }
}

export function drawFinalClash(ctx: CanvasRenderingContext2D, t: number, w: number, h: number): void {
  const cx = Math.round(w / 2);
  const px = cx + 4;
  const py = 126;
  const shakeAmt = t < 0.6 ? 3 * (1 - t / 0.6) + 1 : 1;
  const sx = Math.round(Math.sin(t * 83) * shakeAmt);
  const sy = Math.round(Math.cos(t * 61) * shakeAmt * 0.7);

  const bg = layer('clash/bg', w, h, (r) => {
    const left = new Raster(w, h);
    skyGradient(left, [C.navy, C.blue, C.sky], 0, h);
    glowInto(left, px, py, 260, [C.white, C.cyan, C.sky, C.blue], 1);
    const right = new Raster(w, h);
    skyGradient(right, [C.void0, C.purple, C.darkRed], 0, h);
    glowInto(right, px, py, 260, [C.white, C.hotPink, C.red, C.darkRed, C.purple], 1);
    clipSide(left, -1);
    clipSide(right, 1);
    r.over(left);
    r.over(right);
  });
  blit(ctx, bg, sx, sy);

  // speed lines per side
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(w / 2 + 64 + sx, 0);
  ctx.lineTo(w / 2 - 64 + sx, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.clip();
  speedLines(ctx, px, py, w, h, t, '#ffffff', 1.2);
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(w, 0);
  ctx.lineTo(w / 2 + 64 + sx, 0);
  ctx.lineTo(w / 2 - 64 + sx, h);
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.clip();
  speedLines(ctx, px, py, w, h, t + 0.37, '#181425', 1.2);
  ctx.restore();

  // fighters (static layers, clipped to their halves)
  const fighters = layer('clash/fighters', w, h, (r) => {
    const k = new Raster(w, h).place(2.5, -0.08, 51, 52, cx - 150, 112);
    renderBust(k, kai, 'angry', { iris: [C.blue, C.sky, C.cyan], eyeGlow: C.white, windX: 5, phase: 1 });
    k.rim(C.cyan, 1, 0);
    k.rim(C.white, 0, -1);
    clipSide(k, -1);
    const m = new Raster(w, h).place(2.5, 0.08, 51, 52, cx + 150, 112, true);
    renderBust(m, malachar, 'angry', { windX: 5, phase: 2 });
    m.rim(C.hotPink, -1, 0);
    m.rim(C.red, 0, -1);
    clipSide(m, 1);
    r.over(k);
    r.over(m);
  });
  blit(ctx, fighters, sx, sy);

  // split line
  fillPolyCtx(
    ctx,
    [w / 2 + 62 + sx, 0, w / 2 + 66 + sx, 0, w / 2 - 62 + sx, h, w / 2 - 66 + sx, h],
    HEX[C.white],
    w,
    h,
  );
  fillPolyCtx(
    ctx,
    [w / 2 + 66 + sx, 0, w / 2 + 68 + sx, 0, w / 2 - 60 + sx, h, w / 2 - 62 + sx, h],
    HEX[C.black],
    w,
    h,
  );

  // crossing blades (vibrating)
  const vib = Math.round(Math.sin(t * 50));
  const blades = layer('clash/blades', w, h, (r) => {
    r.setTransform(1, 0, 0);
    // Kai's sword: bottom-left → upper-right
    const k0 = [cx - 150, h + 20];
    const k1 = [cx + 96, 52];
    const kd = Math.hypot(k1[0] - k0[0], k1[1] - k0[1]);
    const knx = -(k1[1] - k0[1]) / kd;
    const kny = (k1[0] - k0[0]) / kd;
    const kb = 8;
    r.fillPx(
      [k0[0] + knx * kb, k0[1] + kny * kb, k1[0], k1[1], k0[0] - knx * kb, k0[1] - kny * kb],
      C.lightGray,
    );
    r.fillPx([k0[0] + knx * kb, k0[1] + kny * kb, k1[0], k1[1], k0[0] + knx * 1, k0[1] + kny * 1], C.white);
    r.linePx([k0[0] - knx * kb, k0[1] - kny * kb, k1[0], k1[1]], C.cyan);
    // Malachar's blade: bottom-right → upper-left
    const m0 = [cx + 160, h + 20];
    const m1 = [cx - 92, 50];
    const md = Math.hypot(m1[0] - m0[0], m1[1] - m0[1]);
    const mnx = -(m1[1] - m0[1]) / md;
    const mny = (m1[0] - m0[0]) / md;
    const mb = 9;
    r.fillPx([m0[0] + mnx * mb, m0[1] + mny * mb, m1[0], m1[1], m0[0] - mnx * mb, m0[1] - mny * mb], C.navy);
    r.fillPx([m0[0] + mnx * mb, m0[1] + mny * mb, m1[0], m1[1], m0[0], m0[1]], C.purple);
    r.linePx([m0[0] - mnx * mb, m0[1] - mny * mb, m1[0], m1[1]], C.hotPink);
    r.outline(C.black);
  });
  blit(ctx, blades, sx + vib, sy);

  // impact burst
  const pulse = (Math.sin(t * 20) + 1) / 2;
  blitC(ctx, glow(26 + Math.round(pulse * 3) * 2, [C.white, C.white, C.yellow, C.orange]), px + sx, py + sy);
  const star = layer(`clash/star${Math.floor(t * 12) % 2}`, 90, 90, (r) => {
    r.setTransform(1, 0, 0);
    const rot = Math.floor(t * 12) % 2 ? 0.2 : 0;
    r.fillPx(starPts(45, 45, 44, 5, 4, rot), C.white);
    r.fillPx(starPts(45, 45, 28, 4, 4, rot + Math.PI / 4), C.white);
    r.outline(C.yellow);
  });
  blitC(ctx, star, px + sx, py + sy);

  // sparks flying out (ballistic, looping)
  const rand = rng(5);
  for (let i = 0; i < 46; i++) {
    const period = 0.5 + rand() * 0.6;
    const ph = rand() * period;
    const u = ((t + ph) % period) / period;
    const a = rand() * Math.PI * 2;
    const sp = 90 + rand() * 170;
    const dist = u * sp * period;
    const x = px + Math.cos(a) * dist;
    const y = py + Math.sin(a) * dist + u * u * 40;
    const col = u < 0.3 ? C.white : u < 0.6 ? C.yellow : C.orange;
    ctx.fillStyle = HEX[col];
    const len = u < 0.5 ? 3 : 2;
    for (let k = 0; k < len; k++)
      ctx.fillRect(Math.round(x - Math.cos(a) * k) + sx, Math.round(y - Math.sin(a) * k) + sy, 1, 1);
  }
  const tw = Math.floor(t * 10) % 3;
  blitC(ctx, sparkleSprite(5 + tw, C.cyan), px - 40 + sx, py - 30 + sy);
  blitC(ctx, sparkleSprite(4 + ((tw + 1) % 3), C.hotPink), px + 38 + sx, py + 26 + sy);

  // opening impact flash
  if (t < 0.45) fade(ctx, C.white, 1 - t / 0.45, 0, 0, w, h);
}
