/** Flashback: Seraphine (Order knight) with young Lyra in a snowy field — muted blue-sepia, falling snow, vignette. */
import { C, HEX, RGB, lum } from '../pal';
import { Raster, bayer } from '../raster';
import { renderBust } from '../face';
import { seraphine } from '../characters/seraphine';
import { lyra } from '../characters/lyra';
import { rng } from '../geom';
import { blit, layer, lut } from './kit';
import { glowInto, ridge, ridgeFn, skyGradient } from './scenery';

const COOL = [C.mem0, C.mem1, C.mem2, C.mem3, C.mem4, C.mem5, C.mem6];
const WARM = [C.mem1, C.memWarm1, C.memWarm2, C.memWarm3, C.mem6];

/** Map every palette color into the flashback ramp by luminance (warm hues keep a sepia tint). */
export const MEMORY = lut((i) => {
  const [r, , b] = RGB[i];
  const l = lum(i);
  if (r > b + 40 && l > 0.25) return WARM[Math.min(WARM.length - 1, Math.floor(l * WARM.length))];
  return COOL[Math.min(COOL.length - 1, Math.floor(Math.pow(l, 0.9) * COOL.length))];
});

export function drawSeraphineMemory(ctx: CanvasRenderingContext2D, t: number, w: number, h: number): void {
  const cx = Math.round(w / 2);
  const scene = layer('mem/scene', w, h, (r) => {
    skyGradient(r, [C.gray, C.lightGray, C.lightGray, C.white], 0, 170);
    glowInto(r, cx + 40, 60, 160, [C.white, C.white, C.lightGray], 0.8);
    // distant hills and pines
    ridge(r, ridgeFn(160, 12, 60, 71), C.gray, C.lightGray);
    const rand = rng(31);
    r.setTransform(1, 0, 0);
    for (let i = 0; i < 40; i++) {
      const x = cx + (rand() - 0.5) * 700;
      const th = 10 + rand() * 18;
      const by = 168 + rand() * 6;
      r.fillPx([x, by - th, x + th * 0.3, by, x - th * 0.3, by], rand() > 0.5 ? C.slate : C.gray);
      r.fillPx([x, by - th, x + th * 0.12, by - th * 0.5, x - th * 0.05, by - th * 0.5], C.lightGray);
    }
    ridge(r, ridgeFn(186, 8, 80, 72), C.white, C.white);
    // characters
    const sera = new Raster(w, h).place(1.95, 0, 51, 60, cx - 62, 150);
    renderBust(sera, seraphine, 'happy', { variant: 'knight', windX: 2, phase: 1 });
    const kid = new Raster(w, h).place(1.45, 0, 51, 60, cx + 92, 178, true);
    renderBust(kid, lyra, 'happy', { variant: 'child', windX: -1.5, phase: 2 });
    r.over(kid);
    r.over(sera);
    // snow drifts in front
    ridge(r, ridgeFn(246, 6, 50, 73), C.white, C.white);
    r.remap(MEMORY);
    // vignette
    const rx = w * 0.62;
    const ry = h * 0.72;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = (x - w / 2) / rx;
        const dy = (y - h / 2) / ry;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 0.75) continue;
        const k = Math.min(1, (d - 0.75) / 0.45);
        const i = y * w + x;
        if (bayer(x, y) < k) r.data[i] = k > 0.75 && bayer(x + 1, y) < k - 0.4 ? C.mem0 : C.mem1;
      }
    }
  });
  blit(ctx, scene);

  // falling snow (two depths)
  const rand = rng(8);
  for (let i = 0; i < 90; i++) {
    const near = i % 5 === 0;
    const sp = near ? 26 + rand() * 10 : 9 + rand() * 9;
    const x0 = (rand() - 0.5) * 700;
    const y0 = rand() * 300;
    const y = ((y0 + t * sp) % 290) - 10;
    const x = Math.round(w / 2 + x0 + Math.sin(t * 0.8 + i) * (near ? 8 : 4));
    ctx.fillStyle = HEX[near ? C.mem6 : C.mem5];
    if (near) ctx.fillRect(x, Math.round(y), 2, 2);
    else ctx.fillRect(x, Math.round(y), 1, 1);
  }
}
