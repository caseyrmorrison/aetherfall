/** Title background: starry night, colossal cracked crystal, mountains, Kai on a cliff. Loops. */
import { C } from '../pal';
import { blit, blitC, crystal, frame, glow, layer, starList, stars, twinkle } from './kit';
import {
  cloudBand,
  drawMotes,
  glowInto,
  kaiSilhouette,
  makeMotes,
  raysInto,
  ridge,
  ridgeFn,
  skyGradient,
} from './scenery';
import { rng } from '../geom';

const MOTES = makeMotes(11, 46, [C.cyan, C.cyan, C.white, C.yellow, C.sky]);

function crystalPos(w: number): [number, number] {
  return [Math.round(w / 2 + 112), 92];
}

export function drawTitle(ctx: CanvasRenderingContext2D, t: number, w: number, h: number): void {
  const [kx, ky] = crystalPos(w);
  const cx = w / 2;
  const sky = layer('title/sky', w, h, (r) => {
    skyGradient(r, [C.black, C.black, C.navy, C.navy, C.darkSlate, C.purple], 0, 215);
    glowInto(r, kx, ky, 150, [C.blue, C.darkSlate, C.navy], 0.9);
    stars(r, 5, 260, 200);
    cloudBand(r, 21, 168, 16, 700, C.darkSlate, C.slate, [26, 70], [3, 6]);
    cloudBand(r, 22, 150, 8, 520, C.navy, C.darkSlate, [30, 60], [2, 4]);
  });
  blit(ctx, sky);
  twinkle(ctx, starList(5, 260, 200, w), t);

  // crystal light rays + halo (slow rotation, pulse)
  const pulse = (Math.sin(t * 1.6) + 1) / 2;
  const ri = Math.floor(t * 3) % 6;
  const rl = frame('title/rays', ri, 6, w, h, (r, i) => {
    raysInto(r, kx, ky, 9, 30, 190, i * 0.012, C.cyan, 2 + (i % 2), 0.07, 9);
    raysInto(r, kx, ky, 6, 30, 130, 0.2 - i * 0.01, C.sky, 3, 0.05, 4);
  });
  blit(ctx, rl);
  blitC(ctx, glow(58 + Math.round(pulse * 4), [C.sky, C.blue, C.darkSlate]), kx, ky);
  blitC(ctx, glow(34, [C.white, C.cyan, C.sky]), kx, ky);

  const bob = Math.round(Math.sin(t * 1.1) * 2);
  const cr = layer('title/crystal', 76, 130, (r) => crystal(r, 38, 62, 56, 27, { cracks: 8, seed: 3 }));
  blitC(ctx, cr, kx, ky + bob);

  // mountains & cliff
  const fg = layer('title/fg', w, h, (r) => {
    ridge(r, ridgeFn(176, 26, 70, 3), C.darkSlate, -1, (x, slope) => {
      const near = Math.abs(x - kx) < 170;
      return slope < -0.2 ? (near ? C.sky : C.slate) : slope < 0.3 && near ? C.slate : -1;
    });
    ridge(r, ridgeFn(204, 18, 46, 8), C.navy, -1, (x, slope) =>
      slope < -0.25 && Math.abs(x - kx) < 200 ? C.darkSlate : -1,
    );
    // foreground cliff (left) and low ground (right)
    const edge = cx - 88;
    const rand = rng(4);
    for (let x = 0; x < w; x++) {
      let y: number;
      if (x < edge) y = 206 + Math.round(Math.sin(x * 0.05) * 2 + (edge - x) * 0.05 + rand() * 1.2);
      else if (x < edge + 10) y = 206 + (x - edge) * 5;
      else y = 247 + Math.round(Math.sin(x * 0.03) * 3 + rand());
      for (let yy = y; yy < h; yy++) r.px(x, yy, C.black);
      if (x < edge && rand() > 0.35) {
        const gh = 1 + Math.floor(rand() * 4);
        for (let k = 1; k <= gh; k++) r.px(x + (k > 2 ? 1 : 0), y - k, C.black);
      }
    }
    // pines on the right-hand ground
    const tr = rng(12);
    for (let i = 0; i < 14; i++) {
      const x = Math.round(cx - 40 + tr() * 420);
      if (x < 0 || x >= w) continue;
      const th = 12 + tr() * 22;
      const base = 250;
      r.setTransform(1, 0, 0);
      for (let k = 0; k < 4; k++) {
        const y0 = base - th + k * th * 0.22;
        const ww = 3 + k * th * 0.09;
        r.fillPx([x, y0 - 2, x + ww, y0 + th * 0.3, x - ww, y0 + th * 0.3], C.black);
      }
      r.rectPx(x - 1, base - 3, 2, 6, C.black);
    }
    // rim light along the cliff edge facing the crystal
    for (let y = 206; y < 255; y++)
      r.px(edge + Math.floor((y - 206) / 5) + 1, y, y < 230 ? C.deepTeal : C.navy);
  });
  blit(ctx, fg);

  // Kai on the cliff edge (8 wind frames, ~10 fps)
  const fi = Math.floor(t * 10) % 8;
  const kai = frame('title/kai', fi, 8, 100, 96, (r, i) => {
    kaiSilhouette(r, 40, 92, 1.4, (i / 8) * Math.PI * 2);
    r.rim(C.cyan, 1, 0);
    r.rim(C.deepTeal, 0, -1, C.black);
  });
  blit(ctx, kai, cx - 112 - 40, 207 - 92);

  drawMotes(ctx, MOTES, t, w, h, -1, 6, 40);
}
