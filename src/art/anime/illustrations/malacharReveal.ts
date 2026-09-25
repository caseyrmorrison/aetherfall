/** Malachar looms against a blood-red / void-purple sky: eclipse, billowing cape, glowing eyes, void tendrils. */
import { C, HEX } from '../pal';
import { Raster, bayer } from '../raster';
import { cel, faceGeom, renderBust } from '../face';
import { malachar } from '../characters/malachar';
import { rng, spline, strand, type P } from '../geom';
import { blit, blitC, frame, glow, layer, lut } from './kit';
import { cloudBand, glowInto, skyGradient } from './scenery';

const S = 2.75;
const DARK = lut((i) => {
  const m: Record<number, number> = {
    [C.lightGray]: C.gray,
    [C.gray]: C.slate,
    [C.slate]: C.darkSlate,
    [C.darkSlate]: C.navy,
    [C.navy]: C.black,
    [C.darkRed]: C.plum,
    [C.red]: C.darkRed,
    [C.magenta]: C.purple,
  };
  return m[i] ?? i;
});

function place(r: Raster, w: number): Raster {
  return r.place(S, 0, 51, 50, w / 2, 112);
}

export function drawMalacharReveal(ctx: CanvasRenderingContext2D, t: number, w: number, h: number): void {
  const cx = Math.round(w / 2);
  const ey = 58;
  const sky = layer('mal/sky', w, h, (r) => {
    skyGradient(r, [C.black, C.void0, C.purple, C.plum, C.darkRed, C.red], 0, h);
    // eclipse with a burning corona
    glowInto(r, cx, ey, 160, [C.hotPink, C.hotPink, C.hotPink, C.hotPink, C.red, C.darkRed, C.purple], 1);
    r.setTransform(1, 0, 0);
    r.ellipse(cx, ey, 100, 100, C.black);
    r.stroke([cx - 70, ey - 70, cx - 36, ey - 93, cx + 6, ey - 100], 1, 1, C.void0);
    cloudBand(r, 6, 196, 18, 700, C.plum, C.darkRed, [30, 80], [3, 7]);
    cloudBand(r, 7, 150, 10, 700, C.void0, C.plum, [30, 70], [2, 5]);
  });
  blit(ctx, sky);

  // cape billowing (frames)
  const fi = Math.floor(t * 8) % 8;
  const cape = frame('mal/cape', fi, 8, w, h, (r, i) => {
    const ph = (i / 8) * Math.PI * 2;
    place(r, w);
    const sc = new Raster(w, h).copyTransform(r);
    for (const side of [-1, 1]) {
      const k = (x: number): number => 51 + side * x;
      const wv = (a: number): number => Math.sin(ph + a) * 4;
      const pts: P[] = [
        [k(20), 84],
        [k(40), 70 + wv(0)],
        [k(62), 58 + wv(1)],
        [k(86), 54 + wv(2)],
        [k(100), 70 + wv(3)],
        [k(94), 88 + wv(4)],
        [k(108), 102 + wv(5)],
        [k(96), 118 + wv(6)],
        [k(104), 136],
        [k(10), 136],
      ];
      cel(r, sc, spline(pts, true, 4), C.darkRed, C.plum, side * 3, 3);
      // dark outer fold
      cel(
        r,
        sc,
        spline(
          [
            [k(24), 86],
            [k(46), 76 + wv(0)],
            [k(70), 68 + wv(1)],
            [k(84), 78 + wv(3)],
            [k(80), 100 + wv(5)],
            [k(84), 136],
            [k(12), 136],
          ],
          true,
          4,
        ),
        C.navy,
        C.black,
        side * 2,
        2,
      );
    }
    r.outline(C.black);
    r.rim(C.hotPink, 0, -1);
  });
  blit(ctx, cape);

  // Malachar (static), face half in shadow, red under-light
  const body = layer('mal/body', w, h, (r) => {
    place(r, w);
    renderBust(r, malachar, 'smirk', { windX: 2, eyeOpen: 0.62, mouth: 'cruel' });
    // shadow cast by the crown over the upper face (dithered into the lit lower face)
    const top = r.Y(51, 40);
    const bot = r.Y(51, 58);
    for (let y = 0; y < h; y++) {
      const tt = (y - top) / (bot - top);
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const v = r.data[i];
        if (!v) continue;
        if (tt < 0) r.data[i] = DARK[DARK[v]];
        else if (bayer(x, y) > tt) r.data[i] = DARK[v];
      }
    }
    r.rim(C.red, 0, 1);
    r.rim(C.hotPink, -1, 0);
  });
  blit(ctx, body);

  // glowing eyes (pulse)
  const g = faceGeom(malachar.shape);
  const pr = place(new Raster(1, 1), w);
  const pulse = (Math.sin(t * 3) + 1) / 2;
  for (const E of [g.near, g.far]) {
    const x = pr.X(E.x, E.y + 0.5);
    const y = pr.Y(E.x, E.y + 0.5);
    blitC(ctx, glow(7 + Math.round(pulse * 2), [C.hotPink, C.red, C.darkRed]), x, y);
    ctx.fillStyle = HEX[C.white];
    ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
  }

  // void tendrils rising from the bottom corners
  const ti = Math.floor(t * 10) % 10;
  const tend = frame('mal/tendrils', ti, 10, w, h, (r, i) => {
    const ph = (i / 10) * Math.PI * 2;
    const rand = rng(3);
    const sc = new Raster(w, h);
    for (let k = 0; k < 9; k++) {
      const side = k % 2 === 0 ? -1 : 1;
      const bx = cx + side * (110 + rand() * 150);
      const ht = 90 + rand() * 120;
      const pts: P[] = [];
      for (let j = 0; j <= 6; j++) {
        const u = j / 6;
        pts.push([bx + Math.sin(ph + u * 4 + k) * 14 * u - side * u * 30, h + 10 - u * ht]);
      }
      const poly = strand(pts, 16 + rand() * 10, { pow: 1.1 });
      cel(r, sc, poly, C.purple, C.void0, side * 2, 1);
      r.with({ self: true }, () =>
        r.line(
          spline(pts, false, 3).map((v, j) => (j % 2 === 0 ? v - side * 2 : v)),
          C.magenta,
        ),
      );
    }
    r.outline(C.black);
  });
  blit(ctx, tend);

  // embers
  const rand = rng(12);
  for (let i = 0; i < 40; i++) {
    const x = cx + (rand() - 0.5) * 640 + Math.sin(t + i) * 5;
    const y = (((rand() * 290 - t * (12 + rand() * 20)) % 290) + 290) % 290;
    if (Math.sin(t * 4 + i) < -0.3) continue;
    ctx.fillStyle = HEX[rand() > 0.6 ? C.hotPink : rand() > 0.5 ? C.red : C.orange];
    ctx.fillRect(Math.round(x), Math.round(y), 1, rand() > 0.8 ? 2 : 1);
  }
}
