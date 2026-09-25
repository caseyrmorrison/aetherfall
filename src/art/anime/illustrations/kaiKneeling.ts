/**
 * Aftermath: Kai on one knee, battered, torn scarf, breathing hard, sword
 * planted in the ground; Malachar's silhouette floats above with glowing red
 * eyes; embers and dust drift. Loops.
 */
import { C, HEX } from '../pal';
import { Raster, bayer } from '../raster';
import { renderBust } from '../face';
import { kai } from '../characters/kai';
import { malachar } from '../characters/malachar';
import { rng } from '../geom';
import { auraBox, auraInto } from '../aura';
import { blit, blitC, frame, glow, layer, lut } from './kit';
import { cloudBand, glowInto, ridge, ridgeFn, skyGradient } from './scenery';
import { OUTFIT, cape, legs, limb, part, scarfTail } from './figure';

const SIL = lut((i) => {
  if (i === C.red || i === C.hotPink || i === C.white || i === C.pink) return i;
  return C.black;
});
const BRIGHT = lut((i) => {
  const m: Record<number, number> = {
    [C.void0]: C.purple,
    [C.purple]: C.magenta,
    [C.magenta]: C.pink,
    [C.pink]: C.white,
  };
  return m[i] ?? i;
});

function kaiPlace(r: Raster, w: number): Raster {
  return r.place(0.98, 0.12, 51, 50, w / 2 - 70, 112);
}

function drawKaiKneel(r: Raster, w: number, breath: number): void {
  kaiPlace(r, w);
  r.f += breath;
  const o = OUTFIT.kai;
  scarfTail(r, 0.4 + breath * 0.3, true, -10);
  // far arm resting on the raised knee
  limb(
    r,
    o,
    [
      [82, 92],
      [96, 112],
      [98, 128],
    ],
    12,
    10,
    o.sleeve,
    o.sleeveSh,
    o.fore,
    o.foreSh,
  );
  // legs: front knee up, back knee on the ground
  legs(r, o, [42, 130], [44, 170], [6, 178], [62, 130], [94, 136], [96, 176]);
  // tunic skirt + belt
  part(r, C.black, (p) => {
    p.poly([26, 124, 76, 124, 84, 144, 66, 140, 51, 146, 36, 140, 20, 144], C.navy);
    p.poly([26, 124, 76, 124, 80, 134, 22, 134], C.blue);
    p.poly([25.5, 123, 76.5, 123, 77, 129, 25, 129], C.darkBrown);
    // torn edge
    p.poly([60, 140, 64, 146, 68, 139], 0);
  });
  const bust = new Raster(r.w, r.h).copyTransform(r);
  renderBust(bust, kai, 'hurt', { variant: 'full', windX: 1, windY: 1, phase: breath });
  r.over(bust);
  // battle damage: scratches and a tear on the tunic
  r.with({ only: C.blue }, () => {
    r.stroke([34, 104, 42, 112], 0.8, 0.8, C.navy);
    r.stroke([60, 98, 66, 108], 0.8, 0.8, C.navy);
  });
  // sword planted in the ground, gripped by the near hand
  part(r, C.black, (p) => {
    p.poly([117, 118, 121, 118, 120, 190, 118, 190], C.lightGray);
    p.poly([117, 118, 118.5, 118, 118.5, 190, 118, 190], C.white);
    p.stroke([110, 117, 128, 117], 3, 3, C.gold);
    p.stroke([119, 98, 119, 116], 3.4, 3.4, C.darkBrown);
    p.ellipse(119, 97, 2.4, 2.4, C.gold);
  });
  limb(
    r,
    o,
    [
      [18, 94],
      [66, 114],
      [114, 108],
    ],
    13,
    10.5,
    o.sleeve,
    o.sleeveSh,
    o.fore,
    o.foreSh,
  );
  part(r, o.line, (p) => {
    p.ellipse(118, 107, 5, 4.4, o.hand);
    p.stroke([114, 105, 122, 105], 0.6, 0.6, o.handSh, 1);
  });
}

function malPlace(r: Raster, w: number): Raster {
  return r.place(0.86, 0, 51, 50, w / 2 + 118, 62, true);
}

export function drawKaiKneeling(ctx: CanvasRenderingContext2D, t: number, w: number, h: number): void {
  const cx = Math.round(w / 2);
  const sky = layer('kneel/sky', w, h, (r) => {
    skyGradient(r, [C.black, C.void0, C.plum, C.darkRed, C.plum], 0, 236);
    glowInto(r, cx + 118, 80, 150, [C.purple, C.plum, C.void0], 1);
    cloudBand(r, 71, 150, 14, 700, C.plum, C.darkRed, [40, 100], [4, 8]);
    cloudBand(r, 72, 196, 12, 700, C.void0, C.plum, [40, 90], [3, 6]);
    ridge(r, ridgeFn(214, 12, 50, 61), C.void0, C.plum);
    // ruined ground
    for (let y = 228; y < h; y++)
      for (let x = 0; x < w; x++) r.data[y * w + x] = bayer(x, y) < (y - 228) / 42 ? C.black : C.navy;
    r.setTransform(1, 0, 0);
    for (let x = 0; x < w; x += 2) r.px(x, 228, C.plum);
    const rand = rng(5);
    for (let i = 0; i < 36; i++) {
      const x = rand() * w;
      const y = 232 + rand() * 34;
      const s = 1 + rand() * 4;
      r.ellipse(x, y, s * 1.6, s * 0.8, C.darkSlate);
      r.px(x - s, y - s * 0.6, C.darkRed);
    }
    // cracks
    for (let i = 0; i < 7; i++) {
      let x = rand() * w;
      let y = 232 + rand() * 20;
      const pts: number[] = [x, y];
      for (let k = 0; k < 6; k++) {
        x += (rand() - 0.5) * 30;
        y += rand() * 5;
        pts.push(x, y);
      }
      r.linePx(pts, C.black);
    }
  });
  blit(ctx, sky);

  // Malachar floating above: void aura + silhouette with glowing eyes
  const bob = Math.round(Math.sin(t * 1.4) * 3);
  const [aw, ah, afx, afy] = auraBox(150, 0.85);
  const af = frame('kneel/aura', Math.floor(t * 10) % 8, 8, aw, ah, (r, i) => {
    auraInto(r, afx, afy, 150, 'void', i, 'back', 0.6, 0.85, false);
    r.remap(BRIGHT);
  });
  blit(ctx, af, cx + 118 - afx, 176 - afy + bob);
  const mi = Math.floor(t * 6) % 4;
  const mal = frame('kneel/mal', mi, 4, w, h, (r, i) => {
    malPlace(r, w);
    cape(r, (i / 4) * Math.PI * 2, 30);
    const b = new Raster(w, h).copyTransform(r);
    renderBust(b, malachar, 'smirk', {
      variant: 'full',
      windX: -4,
      windY: -3,
      phase: i * 1.6,
      noMarks: true,
      eyeGlow: C.white,
    });
    r.over(b);
    r.remap(SIL);
    r.rim(C.purple, -1, 0);
    r.rim(C.purple, 1, 0);
    r.rim(C.magenta, 0, -1);
    r.outline(C.void0);
  });
  blit(ctx, mal, 0, bob);
  // eye glow
  const pr = malPlace(new Raster(1, 1), w);
  const pulse = (Math.sin(t * 3.2) + 1) / 2;
  for (const ex of [40, 64.5]) {
    blitC(
      ctx,
      glow(3 + Math.round(pulse * 2), [C.white, C.hotPink, C.red]),
      pr.X(ex, 50.5),
      pr.Y(ex, 50.5) + bob,
    );
  }

  // Kai kneeling (breathing hard: 4-frame cycle)
  const bi = Math.floor(t * 3.2) % 4;
  const k = frame('kneel/kai', bi, 4, w, h, (r, i) => {
    drawKaiKneel(r, w, [0, 0.8, 1.6, 0.8][i]);
    r.rim(C.hotPink, 1, 0);
    r.rim(C.purple, 0, -1);
  });
  blit(ctx, k);

  // breath puffs
  const pb = (t * 3.2) % 4;
  if (pb < 1.2) {
    const kr = kaiPlace(new Raster(1, 1), w);
    const mx = kr.X(58, 68) + pb * 6;
    const my = kr.Y(58, 68) - pb * 3;
    ctx.fillStyle = HEX[C.gray];
    if (pb < 0.8) ctx.fillRect(Math.round(mx), Math.round(my), 2, 1);
    ctx.fillRect(Math.round(mx + 3), Math.round(my - 2), 1, 1);
  }

  // embers and dust drifting
  const rand = rng(41);
  for (let i = 0; i < 46; i++) {
    const ember = i % 3 !== 0;
    const sp = ember ? 8 + rand() * 14 : 4 + rand() * 6;
    const x0 = (rand() - 0.5) * 700;
    const y0 = rand() * 280;
    const x = Math.round(cx + x0 + Math.sin(t * 0.7 + i) * 8 + t * (ember ? 6 : 10));
    const y = Math.round((((y0 - t * sp) % 280) + 280) % 280);
    if (x < 0 || x >= w) continue;
    if (ember && Math.sin(t * 5 + i * 2) < -0.4) continue;
    ctx.fillStyle = HEX[ember ? (i % 2 ? C.orange : C.red) : C.gray];
    ctx.fillRect(x, y, 1, 1);
  }
}
