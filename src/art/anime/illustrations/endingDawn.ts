/** Ending: Kai and Lyra seen from behind on a grassy hill at sunrise, the restored crystal glowing, petals drifting. */
import { C, HEX } from '../pal';
import { Raster } from '../raster';
import { cel } from '../face';
import { rng, spline, starPts, strand, type P } from '../geom';
import { blit, blitC, crystal, frame, glow, layer, lut } from './kit';
import { cloudBand, glowInto, raysInto, ridge, ridgeFn, skyGradient } from './scenery';

/** Back-lit shading: figures facing the sun are mostly in shadow. */
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

/** Kai seen from behind (design units, feet at 0,0, ~64 tall), scarf and hair blowing right. */
export function kaiBack(r: Raster, sc: Raster, ph: number): void {
  const wv = (k: number): number => Math.sin(ph + k) * 1.6;
  // scarf tails behind everything (blowing right)
  const tail = (y0: number, len: number, wd: number, k: number): void => {
    const pts: P[] = [];
    for (let i = 0; i <= 5; i++) {
      const u = i / 5;
      pts.push([2 + u * len, y0 + u * 3 + Math.sin(ph * 2 + u * 4 + k) * 2.2 * u]);
    }
    cel(r, sc, strand(pts, wd, { tipW: wd * 0.7, pow: 1 }), C.red, C.darkRed, 0, 1);
  };
  tail(-45, 24, 4, 0);
  tail(-44, 18, 3.4, 1.5);
  // boots & legs
  cel(
    r,
    sc,
    strand(
      [
        [-3.4, -24],
        [-4.2, -12],
        [-4.8, -3],
      ],
      5.6,
      { tipW: 4.6 },
    ),
    C.navy,
    C.black,
    1,
    0,
  );
  cel(
    r,
    sc,
    strand(
      [
        [3.4, -24],
        [4.2, -12],
        [4.8, -3],
      ],
      5.6,
      { tipW: 4.6 },
    ),
    C.navy,
    C.black,
    1,
    0,
  );
  r.poly(
    spline(
      [
        [-8, 0],
        [-2, 0],
        [-2, -6],
        [-7.5, -6],
      ],
      true,
      2,
    ),
    C.brown,
  );
  r.poly(
    spline(
      [
        [2, 0],
        [8, 0],
        [7.5, -6],
        [2, -6],
      ],
      true,
      2,
    ),
    C.brown,
  );
  // arms
  cel(
    r,
    sc,
    strand(
      [
        [-8.5, -41],
        [-10.5, -32],
        [-10.5, -24],
      ],
      4.4,
      { tipW: 3.6 },
    ),
    C.blue,
    C.navy,
    1,
    0,
  );
  cel(
    r,
    sc,
    strand(
      [
        [8.5, -41],
        [11, -33],
        [13.5, -26],
      ],
      4.4,
      { tipW: 3.6 },
    ),
    C.blue,
    C.navy,
    1,
    0,
  );
  r.ellipse(-10.5, -23, 2, 2.2, C.skin);
  // tunic
  cel(
    r,
    sc,
    spline(
      [
        [-8, -44],
        [8, -44],
        [9, -32],
        [10 + wv(0), -19],
        [-10 + wv(1) * 0.5, -19],
        [-9, -32],
      ],
      true,
      3,
    ),
    C.blue,
    C.navy,
    1.5,
    0,
  );
  r.poly([-9.3, -27, 9.3, -27, 9.4, -25, -9.4, -25], C.brown);
  // sheath on the back + hilt over the shoulder
  r.poly([-7, -47, -5, -48, 7, -26, 5, -25], C.darkBrown);
  r.poly([-8.5, -50, -6.5, -51, -5, -47, -7, -46.5], C.lightGray);
  r.poly([-10, -48.5, -4.5, -50.5, -4.2, -49.5, -9.6, -47.5], C.gold);
  // pauldron (his right shoulder = viewer right from behind)
  cel(
    r,
    sc,
    spline(
      [
        [4, -45],
        [10, -46],
        [13, -41],
        [11, -38],
        [5, -40],
      ],
      true,
      3,
    ),
    C.brown,
    C.darkBrown,
    0.8,
    -0.8,
  );
  // scarf wrap
  cel(
    r,
    sc,
    spline(
      [
        [-5.5, -47],
        [5.5, -47],
        [6, -43.5],
        [-6, -43.5],
      ],
      true,
      3,
    ),
    C.red,
    C.darkRed,
    0.5,
    0,
  );
  // head (back): spiky hair
  r.ellipse(0, -52.5, 6.2, 6.4, C.darkSlate);
  for (const [a, b, c, w] of [
    [[-3, -55], [-8, -58], [-11 + wv(2) * 0.3, -57], 5],
    [[0, -56], [-1, -61], [2, -64], 5],
    [[3, -55], [7, -59], [11 + wv(3) * 0.4, -59], 5],
    [[4, -52], [9, -52], [13 + wv(4) * 0.5, -49.5], 4.5],
    [[-4, -51], [-8.5, -50], [-10.5, -47], 4.5],
    [[-2, -48], [-3, -45], [-2, -43.5], 4],
    [[2, -48], [3.5, -45], [4.5, -43.5], 4],
  ] as [P, P, P, number][]) {
    cel(r, sc, strand([a, b, c], w, { pow: 1.2 }), C.darkSlate, C.navy, 0.8, 0.5);
  }
}

/** Lyra seen from behind (design units, feet at 0,0), staff in her right hand. */
export function lyraBack(r: Raster, sc: Raster, ph: number): void {
  const wv = (k: number): number => Math.sin(ph + k) * 2;
  // staff (in her right hand = viewer right)
  r.stroke([12, -58, 13.5, 0], 1.6, 1.6, C.darkBrown);
  const moon = new Raster(r.w, r.h).copyTransform(r);
  moon.poly(starPts(12, -61, 4, 1.7, 5), C.yellow);
  moon.outline(C.gold);
  r.over(moon);
  // boots
  r.poly(
    spline(
      [
        [-5, 0],
        [-0.8, 0],
        [-1, -5],
        [-4.6, -5],
      ],
      true,
      2,
    ),
    C.darkBrown,
  );
  r.poly(
    spline(
      [
        [1, 0],
        [5.4, 0],
        [4.8, -5],
        [1.2, -5],
      ],
      true,
      2,
    ),
    C.darkBrown,
  );
  r.poly([-4, -5, -1, -5, -1.5, -10, -3.5, -10], C.white);
  r.poly([1.2, -5, 4.3, -5, 3.8, -10, 1.7, -10], C.white);
  // mantle (bell shape, hem blowing right)
  const mantle = spline(
    [
      [-6, -44],
      [6, -44],
      [10, -30],
      [13 + wv(0), -12],
      [9 + wv(1), -9],
      [0, -9.5],
      [-9 + wv(2) * 0.5, -10],
      [-11, -14],
      [-9.5, -30],
    ],
    true,
    4,
  );
  cel(r, sc, mantle, C.blue, C.navy, 1.5, 0);
  r.with({ self: true }, () =>
    r.stroke(
      spline(
        [
          [-10.5, -12],
          [-9, -10.2],
          [0, -10],
          [9 + wv(1), -9.8],
          [12.5 + wv(0), -12],
        ],
        false,
        3,
      ),
      1.2,
      1.2,
      C.gold,
    ),
  );
  // arms / hands
  r.ellipse(12.4, -25, 2, 2.2, C.fair);
  r.ellipse(-9.6, -24.5, 2, 2.2, C.fair);
  // hood lying on the shoulders
  cel(
    r,
    sc,
    spline(
      [
        [-6.5, -46],
        [6.5, -46],
        [5.5, -39],
        [0, -37],
        [-5.5, -39],
      ],
      true,
      3,
    ),
    C.blue,
    C.navy,
    0.5,
    0.5,
  );
  r.with({ self: true }, () =>
    r.stroke(
      spline(
        [
          [-6, -45.5],
          [0, -46.5],
          [6, -45.5],
        ],
        false,
        2,
      ),
      0.8,
      0.8,
      C.gold,
    ),
  );
  // long hair over the back, flowing right
  const hair = spline(
    [
      [-5.5, -54],
      [5.5, -55],
      [7, -46],
      [8 + wv(2), -34],
      [12 + wv(3), -24],
      [6 + wv(4), -26],
      [2 + wv(4) * 0.6, -21],
      [-2, -25],
      [-6, -23],
      [-6.5, -34],
      [-7, -46],
    ],
    true,
    4,
  );
  cel(r, sc, hair, C.lightGray, C.gray, 1.2, 0);
  r.with({ self: true }, () => {
    r.stroke(
      spline(
        [
          [-2, -46],
          [-2.5, -36],
          [-3.5, -26],
        ],
        false,
        2,
      ),
      0.5,
      0.5,
      C.gray,
    );
    r.stroke(
      spline(
        [
          [2.5, -46],
          [3.5, -36],
          [5 + wv(3) * 0.5, -27],
        ],
        false,
        2,
      ),
      0.5,
      0.5,
      C.gray,
    );
    r.stroke(
      spline(
        [
          [-4, -52],
          [0, -54],
          [4, -52],
        ],
        false,
        2,
      ),
      1,
      1,
      C.white,
    );
  });
  // head top + ahoge + star pin
  r.ellipse(0, -52, 6, 5.6, C.lightGray);
  r.with({ self: true }, () =>
    r.stroke(
      spline(
        [
          [-4, -54],
          [0, -56],
          [4, -54],
        ],
        false,
        2,
      ),
      0.9,
      0.9,
      C.white,
    ),
  );
  r.poly(
    strand(
      [
        [0, -57],
        [2, -61],
        [5, -61.5],
      ],
      1.6,
      {},
    ),
    C.lightGray,
  );
  r.poly(starPts(-4.8, -54, 2.4, 1, 5), C.yellow);
}

export function drawEndingDawn(ctx: CanvasRenderingContext2D, t: number, w: number, h: number): void {
  const cx = Math.round(w / 2);
  const sunX = cx + 70;
  const sunY = 176;
  const sky = layer('dawn/sky', w, h, (r) => {
    skyGradient(r, [C.navy, C.purple, C.magenta, C.pink, C.orange, C.gold, C.yellow], 0, 184);
    glowInto(r, sunX, sunY, 150, [C.yellow, C.gold, C.orange], 0.7);
    cloudBand(r, 41, 70, 10, 700, C.purple, C.magenta, [40, 90], [3, 6]);
    cloudBand(r, 42, 118, 12, 700, C.magenta, C.pink, [30, 80], [2, 5]);
    cloudBand(r, 43, 150, 9, 600, C.pink, C.orange, [30, 70], [2, 4]);
  });
  blit(ctx, sky);

  // sun + slow rays
  const rl = frame('dawn/rays', Math.floor(t * 2) % 4, 4, w, h, (r, i) =>
    raysInto(r, sunX, sunY, 12, 26, 230, i * 0.012, C.yellow, 3, 0.05, 31),
  );
  blit(ctx, rl);
  blitC(ctx, glow(40, [C.white, C.yellow, C.gold]), sunX, sunY);

  // the restored crystal
  const bob = Math.round(Math.sin(t * 0.9) * 2);
  const kx = cx - 150;
  blitC(ctx, glow(30, [C.white, C.ice0, C.ice1, C.pink]), kx, 64 + bob);
  const cr = layer('dawn/crystal', 40, 70, (r) => crystal(r, 20, 34, 30, 14, { palette: 'dawn' }));
  blitC(ctx, cr, kx, 64 + bob);

  // hills
  const land = layer('dawn/land', w, h, (r) => {
    ridge(r, ridgeFn(180, 8, 60, 51), C.purple, C.magenta);
    ridge(r, ridgeFn(194, 10, 70, 52), C.plum, C.purple);
    // foreground hill with the characters' hilltop left of center
    const hill = (dx: number): number =>
      214 + Math.pow(Math.abs(dx + 40) / 190, 2) * 40 + Math.sin(dx * 0.05) * 1.5;
    const top = ridge(
      r,
      hill,
      (_x, y) => (y > 240 ? C.forest : C.darkGreen),
      -1,
      (_x, slope) => (slope < 0.4 ? C.green : C.darkGreen),
    );
    const rand = rng(9);
    for (let x = 0; x < w; x++) {
      if (rand() > 0.55) continue;
      const hh = 2 + rand() * 5;
      r.linePx([x, top[x], x + 1, top[x] - hh], rand() > 0.5 ? C.green : C.darkGreen);
    }
  });
  blit(ctx, land);

  // Kai & Lyra (8 wind frames)
  const fi = Math.floor(t * 8) % 8;
  const duo = frame('dawn/duo', fi, 8, 120, 110, (r, i) => {
    const ph = (i / 8) * Math.PI * 2;
    const sc = new Raster(120, 110);
    const k = new Raster(120, 110);
    k.setTransform(1.55, 42, 106);
    sc.copyTransform(k);
    kaiBack(k, sc, ph);
    k.outline(C.black);
    const l = new Raster(120, 110);
    l.setTransform(1.5, 76, 106);
    sc.copyTransform(l);
    lyraBack(l, sc, ph + 1);
    l.outline(C.black);
    r.over(l);
    r.over(k);
    // clasped hands between them
    r.setTransform(1, 0, 0);
    r.ellipse(59, 67, 2.8, 2.4, C.skin);
    r.rectPx(50, 66, 7, 2, C.navy);
    r.remap(BACKLIT);
    r.rim(C.yellow, 1, 0);
    r.rim(C.gold, 0, -1);
    r.rim(C.orange, -1, 0);
  });
  blit(ctx, duo, cx - 40 - 60, 214 - 104);

  // swaying foreground grass
  const gi = Math.floor(t * 6) % 6;
  const grass = frame('dawn/grass', gi, 6, w, 40, (r, i) => {
    const rand = rng(19);
    const ph = (i / 6) * Math.PI * 2;
    for (let n = 0; n < w * 0.7; n++) {
      const x = rand() * w;
      const y = 40;
      const hh = 8 + rand() * 18;
      const b = Math.sin(ph + x * 0.04) * 3 + 2;
      r.stroke(
        [x, y, x + b * 0.4, y - hh * 0.5, x + b, y - hh],
        2.4,
        0.6,
        rand() > 0.6 ? C.forest : rand() > 0.5 ? C.deepTeal : C.darkGreen,
      );
    }
    r.rim(C.green, 0, -1);
  });
  blit(ctx, grass, 0, h - 40);

  // drifting petals
  const rand = rng(61);
  for (let i = 0; i < 36; i++) {
    const sp = 18 + rand() * 22;
    const x0 = rand() * 800;
    const y0 = rand() * 280;
    const x = ((x0 + t * sp) % (w + 60)) - 30;
    const y = (y0 + t * sp * 0.35 + Math.sin(t * 1.5 + i) * 10) % 280;
    const flip = Math.floor(t * 6 + i) % 3;
    ctx.fillStyle = HEX[i % 3 === 0 ? C.white : C.pink];
    const xi = Math.round(x);
    const yi = Math.round(y);
    if (flip === 0) ctx.fillRect(xi, yi, 2, 1);
    else if (flip === 1) ctx.fillRect(xi, yi, 1, 2);
    else ctx.fillRect(xi, yi, 2, 2);
    if (i % 4 === 0) {
      ctx.fillStyle = HEX[C.magenta];
      ctx.fillRect(xi + 1, yi + (flip === 1 ? 1 : 0), 1, 1);
    }
  }
}
