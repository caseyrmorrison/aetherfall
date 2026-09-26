/**
 * Villain reveal: Grandmaster Aurelian in the black-and-gold sanctum hall, low
 * angle. The eclipsed sun blazes through the great round window right behind
 * his head like a halo; he holds up the Dusk Shard, whose violet-gold light
 * under-lights his face. Corona flickers, hair and mantle stir, motes rise,
 * violet sparks spiral into the shard. Loops.
 */
import { C, HEX } from '../pal';
import { Raster, bayer, type Ink } from '../raster';
import { cel, faceGeom, renderBust } from '../face';
import { aurelian } from '../characters/aurelian';
import { rng, spline, type P } from '../geom';
import { blit, blitC, frame, glow, layer, lut, sparkleSprite } from './kit';
import { glowInto, raysInto, skyGradient } from './scenery';
import { part } from './figure';
import { corona, duskShard } from './solenne';

const S = 1.9;
const FACE_Y = 124;
const SUN_R = 36;
const WIN_R = 124;
const CORONA = Math.ceil(SUN_R * 8.6);

/** Backlit: the front of the figure falls into shadow. */
const SHADE = lut((i) => {
  const m: Record<number, number> = {
    [C.white]: C.lightGray,
    [C.lightGray]: C.gray,
    [C.gray]: C.slate,
    [C.slate]: C.darkSlate,
    [C.darkSlate]: C.navy,
    [C.navy]: C.black,
    [C.paleSkin]: C.paleShade,
    [C.paleShade]: C.memWarm1,
    [C.plat0]: C.plat1,
    [C.plat1]: C.plat2,
    [C.plat2]: C.plat3,
    [C.plat3]: C.darkBrown,
    [C.yellow]: C.gold,
    [C.gold]: C.orange,
    [C.orange]: C.rust,
    [C.darkBrown]: C.plum,
  };
  return m[i] ?? i;
});

/** Violet under-light from the shard. */
const VIOLET = lut((i) => {
  const m: Record<number, number> = {
    [C.white]: C.pink,
    [C.lightGray]: C.pink,
    [C.gray]: C.magenta,
    [C.slate]: C.purple,
    [C.paleSkin]: C.pink,
    [C.paleShade]: C.magenta,
    [C.memWarm1]: C.purple,
    [C.plat1]: C.pink,
    [C.plat2]: C.magenta,
    [C.plat3]: C.purple,
  };
  return m[i] ?? i;
});

function place(r: Raster, w: number): Raster {
  return r.place(S, 0, 51, 50, w / 2 + 2, FACE_Y);
}

function sunPos(w: number): P {
  return [Math.round(w / 2 + 2), 46];
}

/** Shard position (screen) — floats above his raised left hand. */
function shardPos(w: number): P {
  const r = place(new Raster(1, 1), w);
  return [Math.round(r.X(50, 101)), Math.round(r.Y(50, 101))];
}

function hall(r: Raster, w: number): void {
  const h = r.h;
  const cx = w / 2;
  const [sx, sy] = sunPos(w);
  // dark wall with a faint warm falloff toward the window
  r.rectPx(0, 0, w, h, (x, y) => {
    const d = Math.hypot(x - sx, (y - sy) * 0.9) - WIN_R;
    const b = bayer(x, y);
    if (d < 30) return b < 0.5 - d / 60 ? C.plum : C.void0;
    if (d < 90) return b < 0.4 - (d - 30) / 150 ? C.void0 : C.black;
    return C.black;
  });
  // gold sunburst inlay radiating from the window across the wall
  r.setTransform(1, 0, 0);
  for (let k = 0; k < 40; k++) {
    const a = (k / 40) * Math.PI * 2 + 0.04;
    const r0 = WIN_R + 10;
    const r1 = WIN_R + (k % 2 ? 90 : 190);
    const pts: number[] = [];
    for (let j = 0; j <= 24; j++) {
      const rr = r0 + ((r1 - r0) * j) / 24;
      pts.push(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr);
    }
    for (let j = 0; j < pts.length; j += 2) {
      const u = j / pts.length;
      const x = Math.floor(pts[j]);
      const y = Math.floor(pts[j + 1]);
      if (bayer(x, y) < 0.85 - u) r.px(x, y, u < 0.3 ? C.orange : u < 0.6 ? C.rust : C.darkBrown);
    }
  }
  // concentric gold arcs of the inlay
  for (const [rad, col] of [
    [WIN_R + 22, C.rust],
    [WIN_R + 48, C.darkBrown],
  ] as const) {
    for (let k = 0; k < 720; k++) {
      const a = (k / 720) * Math.PI * 2;
      r.px(sx + Math.cos(a) * rad, sy + Math.sin(a) * rad * 1, col);
    }
  }
  // the round window: open sky with the eclipse glow
  const win = new Raster(w, h);
  skyGradient(win, [C.gold, C.orange, C.rust, C.darkRed, C.plum, C.purple], sy - WIN_R, sy + WIN_R);
  glowInto(win, sx, sy, 110, [C.white, C.yellow, C.yellow, C.gold, C.orange, C.rust], 1);
  const mask = new Raster(w, h);
  mask.discPx(sx, sy, WIN_R, 1);
  for (let i = 0; i < r.data.length; i++) if (mask.data[i]) r.data[i] = win.data[i];
  // light shafts pouring from the window
  raysInto(r, sx, sy, 16, WIN_R * 0.6, 420, 0.1, C.gold, 3, 0.035, 11);
  raysInto(r, sx, sy, 10, WIN_R * 0.6, 380, 0.3, C.yellow, 2, 0.02, 12);
  // tracery: rim, inner rings and radial mullions (silhouettes with a gold edge)
  const ring = (rad: number, wd: number): void => {
    for (let y = Math.floor(sy - rad - wd); y <= sy + rad + wd; y++) {
      for (let x = Math.floor(sx - rad - wd); x <= sx + rad + wd; x++) {
        const d = Math.hypot(x + 0.5 - sx, y + 0.5 - sy);
        if (Math.abs(d - rad) <= wd / 2) r.px(x, y, d < rad - wd / 2 + 1 ? C.gold : C.black);
      }
    }
  };
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2 + Math.PI / 16;
    const x0 = sx + Math.cos(a) * (SUN_R + 44);
    const y0 = sy + Math.sin(a) * (SUN_R + 44);
    const x1 = sx + Math.cos(a) * WIN_R;
    const y1 = sy + Math.sin(a) * WIN_R;
    const nx = -Math.sin(a) * 1.8;
    const ny = Math.cos(a) * 1.8;
    r.fillPx(
      [x0 - nx, y0 - ny, x1 - nx * 1.6, y1 - ny * 1.6, x1 + nx * 1.6, y1 + ny * 1.6, x0 + nx, y0 + ny],
      C.black,
    );
    r.linePx([x0 + nx, y0 + ny, x1 + nx * 1.6, y1 + ny * 1.6], C.rust);
  }
  ring(SUN_R + 44, 4);
  ring(WIN_R - 30, 3);
  ring(WIN_R + 2, 9);
  ring(WIN_R + 9, 2);
  // foreground pillars converging upward (low angle)
  for (const side of [-1, 1]) {
    const bx0 = cx + side * (cx + 10);
    const bx1 = cx + side * (cx - 46);
    const tx0 = cx + side * (cx - 24);
    const tx1 = cx + side * (cx - 64);
    const poly = [bx0, h, bx1, h, tx1, -2, tx0, -2];
    const ink: Ink = (x, y) => {
      const u =
        (x - (tx1 + (bx1 - tx1) * (y / h))) / (tx0 + (bx0 - tx0) * (y / h) - (tx1 + (bx1 - tx1) * (y / h)));
      const b = bayer(x, y);
      if (u < 0.08) return C.gold;
      if (u < 0.3) return b < 0.3 ? C.darkBrown : C.plum;
      if ((Math.floor(u * 7) & 1) === 1 && (u * 7) % 1 < 0.15) return C.black;
      return b < 0.15 ? C.plum : C.black;
    };
    r.fillPx(poly, ink);
    for (const yy of [40, 46, 226, 232]) {
      const k0 = yy / h;
      const xa = tx0 + (bx0 - tx0) * k0;
      const xb = tx1 + (bx1 - tx1) * k0;
      r.rectPx(Math.min(xa, xb), yy, Math.abs(xb - xa), yy === 46 || yy === 226 ? 1 : 3, C.gold);
    }
  }
}

/** One cradling hand (design units), fingers curling up toward the shard; side +1 = fingers toward +x. */
function hand(p: Raster, sc: Raster, x: number, y: number, side: number): void {
  const q = 1.25;
  const X = (u: number): number => x + side * u * q;
  const Y = (v: number): number => y + v * q;
  const fingers: P[][] = [];
  for (let k = 0; k < 4; k++) {
    fingers.push([
      [X(1.5), Y(-3 + k * 2)],
      [X(5.5), Y(-4.2 + k * 1.6)],
      [X(8), Y(-7 + k * 1.4)],
    ]);
  }
  // back of the hand
  cel(
    p,
    sc,
    spline(
      [
        [X(-5), Y(4)],
        [X(-5), Y(-2)],
        [X(1), Y(-4)],
        [X(4), Y(2)],
        [X(1), Y(5)],
      ],
      true,
      3,
    ),
    C.paleSkin,
    C.paleShade,
    -side * 0.6,
    0.6,
  );
  for (let k = 3; k >= 0; k--)
    p.stroke(spline(fingers[k], false, 3), 2.3 * q, 1.7 * q, k === 3 ? C.paleShade : C.paleSkin);
  // separations between the fingers
  for (let k = 0; k < 3; k++) {
    const f = fingers[k];
    p.stroke(
      spline(
        [
          [f[0][0], f[0][1] + 1.1 * q],
          [f[1][0], f[1][1] + 1 * q],
          [f[2][0] - side * 0.6, f[2][1] + 0.8 * q],
        ],
        false,
        3,
      ),
      0.5,
      0.5,
      C.paleShade,
      1,
    );
  }
  // thumb rising along the shard
  p.stroke(
    spline(
      [
        [X(-2), Y(-2)],
        [X(0.5), Y(-7)],
        [X(3), Y(-10)],
      ],
      false,
      3,
    ),
    2.6 * q,
    2 * q,
    C.paleSkin,
  );
}

function figure(r: Raster, w: number, ph: number): void {
  place(r, w);
  const wv = (k: number): number => Math.sin(ph + k) * 3;
  // mantle flaring out behind him
  part(r, C.plum, (p, sc) => {
    const pts: P[] = [
      [16, 86],
      [86, 86],
      [116 + wv(0), 110],
      [138 + wv(1), 150],
      [-38 + wv(2), 150],
      [-16 + wv(3), 110],
    ];
    cel(p, sc, spline(pts, true, 4), C.white, C.lightGray, -2, -1);
    p.with({ self: true }, () => {
      p.stroke(spline([pts[1], pts[2], pts[3]], false, 4), 1.4, 1.4, C.gold);
      p.stroke(spline([pts[0], pts[5], pts[4]], false, 4), 1.4, 1.4, C.gold);
    });
  });
  // bust
  const bust = new Raster(r.w, r.h).copyTransform(r);
  renderBust(bust, aurelian, 'neutral', {
    variant: 'nohalo',
    eyeOpen: 0.6,
    mouth: 'smirk',
    windX: 1.2 + Math.sin(ph) * 0.8,
    windY: -1,
    phase: ph,
    noMarks: true,
  });
  r.over(bust);
  // robes continuing below the bust
  part(r, C.plum, (p, sc) => {
    cel(
      p,
      sc,
      spline(
        [
          [3, 118],
          [97, 118],
          [100, 150],
          [0, 150],
        ],
        true,
        2,
      ),
      C.white,
      C.lightGray,
      3,
      -1,
    );
    p.with({ self: true }, () => {
      p.stroke([44, 118, 42, 150], 1.1, 1.1, C.gold);
      p.stroke([56, 118, 58, 150], 1.1, 1.1, C.gold);
    });
  });
  // both forearms rising from below, wide sleeves with gold cuffs, hands cradling the shard
  for (const side of [-1, 1]) {
    const k = (x: number): number => 50 + side * x;
    part(r, C.plum, (p, sc) => {
      cel(
        p,
        sc,
        spline(
          [
            [k(44), 150],
            [k(40), 128],
            [k(26), 116],
            [k(16), 118],
            [k(18), 130],
            [k(22), 150],
          ],
          true,
          4,
        ),
        C.white,
        C.lightGray,
        -side * 1.5,
        -1,
      );
      p.with({ self: true }, () => {
        p.stroke(
          spline(
            [
              [k(40), 150],
              [k(36), 132],
              [k(28), 122],
            ],
            false,
            3,
          ),
          0.8,
          0.8,
          C.lightGray,
        );
      });
      // gold cuff
      cel(
        p,
        sc,
        spline(
          [
            [k(27), 114],
            [k(17), 116],
            [k(15), 121],
            [k(19), 124],
            [k(29), 120],
          ],
          true,
          3,
        ),
        C.gold,
        C.orange,
        -side * 0.5,
        -0.5,
      );
      p.with({ self: true }, () => p.stroke([k(26), 116, k(18), 118], 0.7, 0.7, C.yellow));
    });
  }
}

/** The cradling hands (drawn over the shard's glow). */
function hands(r: Raster, w: number): void {
  place(r, w);
  for (const side of [-1, 1]) {
    part(r, C.plum, (p, sc) => hand(p, sc, 50 + side * 13, 111, -side));
  }
  r.remap(VIOLET);
  r.rim(C.white, 0, -1);
  r.rim(C.pink, 1, 0);
  r.rim(C.pink, -1, 0);
}

export function drawAurelianReveal(ctx: CanvasRenderingContext2D, t: number, w: number, h: number): void {
  const [sx, sy] = sunPos(w);
  const bg = layer('aur/hall', w, h, (r) => hall(r, w));
  blit(ctx, bg);

  // blazing corona behind his head
  const ci = Math.floor(t * 7) % 8;
  const cor = frame('aur/corona', ci, 8, CORONA, CORONA, (r, i) =>
    corona(r, CORONA / 2, CORONA / 2, SUN_R, i / 8, 9, 26),
  );
  blitC(ctx, cor, sx, sy);

  const [px, py] = shardPos(w);
  // Aurelian (wind frames): backlit, under-lit violet by the shard
  const fi = Math.floor(t * 6) % 6;
  const fig = frame('aur/fig', fi, 6, w, h, (r, i) => {
    figure(r, w, (i / 6) * Math.PI * 2);
    const pr = place(new Raster(1, 1), w);
    const chin = pr.Y(50, 76);
    const brow = pr.Y(50, 46);
    const crown = pr.Y(50, 12);
    // lighting: violet near the shard, the rest backlit
    const d = r.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const k = y * w + x;
        const v = d[k];
        if (!v) continue;
        const u = (Math.hypot(x - px, (y - py) * 1.15) - 24) / 14;
        if (u < 1 && bayer(x, y) > u) d[k] = VIOLET[v];
        else if (y < brow && bayer(x, y) < ((brow - y) / (brow - crown)) * 0.9) {
          // the blazing window behind leaves the top of his head in shadow
          d[k] = SHADE[v];
        } else if (bayer(x, y) < (y - chin) / 14) {
          // below the chin the backlit robes fall into shadow, deeper toward the edges
          const o = (Math.abs(x - px) - 60) / 80;
          d[k] = o > 0 && bayer(x, y) < o ? SHADE[SHADE[v]] : SHADE[v];
        }
      }
    }
    r.rim(C.yellow, 0, -1);
    r.rim(C.gold, -1, 0);
    r.rim(C.gold, 1, 0);
    r.rim(C.magenta, 0, 1);
  });
  blit(ctx, fig);

  // pale gold glint in his eyes
  const g = faceGeom(aurelian.shape);
  const pr = place(new Raster(1, 1), w);
  const ep = (Math.sin(t * 1.8) + 1) / 2;
  for (const E of [g.near, g.far]) {
    const x = pr.X(E.x + E.dir * 1.2, E.y + 1);
    const y = pr.Y(E.x + E.dir * 1.2, E.y + 1);
    if (ep > 0.6) blitC(ctx, sparkleSprite(ep > 0.9 ? 3 : 2, C.yellow), x + 3, y - 3);
    ctx.fillStyle = HEX[C.white];
    ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
  }

  // the Dusk Shard: violet-gold radiance, slow rotating rays, bobbing crystal
  const pulse = (Math.sin(t * 2.6) + 1) / 2;
  const bob = Math.round(Math.sin(t * 1.7) * 2);
  const ri = Math.floor(t * 5) % 12;
  const rays = frame('aur/shardRays', ri, 12, 200, 200, (r, i) => {
    raysInto(r, 100, 100, 10, 10, 70, (i / 12) * ((Math.PI * 2) / 10), C.magenta, 4, 0.07, 21);
    raysInto(r, 100, 100, 8, 10, 60, -(i / 12) * ((Math.PI * 2) / 8) + 0.2, C.gold, 4, 0.05, 22);
  });
  blitC(
    ctx,
    glow(30 + Math.round(pulse * 3) * 2, [C.white, C.white, C.pink, C.pink, C.magenta]),
    px,
    py + bob,
  );
  blit(
    ctx,
    layer('aur/hands', w, h, (r) => hands(r, w)),
  );
  // light spilling over the fingers: rays and a bright bloom right around the crystal
  blitC(ctx, rays, px, py + bob);
  blitC(ctx, glow(20 + Math.round(pulse * 2), [C.white, C.white, C.white, C.yellow, C.pink]), px, py + bob);
  const shard = layer('aur/shard', 40, 68, (r) => {
    duskShard(r, 20, 34, 28, 11);
    r.outline(C.white);
    r.outline((x, y) => (bayer(x, y) < 0.5 ? C.yellow : 0));
  });
  blitC(ctx, shard, px, py + bob);
  if (pulse > 0.6) blitC(ctx, sparkleSprite(pulse > 0.85 ? 5 : 3, C.yellow), px + 4, py - 24 + bob);

  // violet sparks spiralling into the shard
  const sr = rng(41);
  for (let i = 0; i < 22; i++) {
    const period = 1.4 + sr() * 1.2;
    const u = ((t + sr() * period) % period) / period;
    const a0 = sr() * Math.PI * 2;
    const a = a0 + u * 3.2;
    const rad = (1 - u) * (40 + sr() * 40);
    const x = px + Math.cos(a) * rad;
    const y = py + bob + Math.sin(a) * rad * 0.7;
    ctx.fillStyle = HEX[u > 0.75 ? C.white : i % 3 === 0 ? C.gold : C.pink];
    ctx.fillRect(Math.round(x), Math.round(y), u > 0.5 ? 1 : 2, 1);
  }
  // golden motes rising through the light shafts
  const mr = rng(77);
  for (let i = 0; i < 40; i++) {
    const sp = 6 + mr() * 12;
    const x = sx + (mr() - 0.5) * w * 0.9 + Math.sin(t * 0.8 + i) * 4;
    const y = (((mr() * h - t * sp) % h) + h) % h;
    if (Math.sin(t * 2.5 + i * 1.9) < -0.3) continue;
    ctx.fillStyle = HEX[mr() > 0.6 ? C.yellow : C.gold];
    ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
  }
}
