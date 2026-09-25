/** Lyra arrives: hair and mantle blowing, a rotating star-sigil magic circle behind her, sparkles. */
import { C } from '../pal';
import { Raster } from '../raster';
import { cel, renderBust } from '../face';
import { lyra } from '../characters/lyra';
import { ellipsePts, rng, spline, starPts, strand, type P } from '../geom';
import { blit, blitC, frame, glow, layer, sparkleSprite, starList, stars, twinkle } from './kit';
import { glowInto, skyGradient } from './scenery';

const CR = 112; // circle radius
const CS = CR * 2 + 12;

function circleRing(r: Raster, rot: number): void {
  const c = CS / 2;
  r.setTransform(1, 0, 0);
  const ring = (rad: number, w: number, ink: number): void =>
    r.stroke(ellipsePts(c, c, rad, rad, Math.ceil(rad * 1.6)).concat([c + rad, c]), w, w, ink);
  ring(CR, 2, C.gold);
  ring(CR, 1, C.yellow);
  ring(CR - 14, 1, C.gold);
  // rune marks between the two rings
  const n = 24;
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2;
    const rr = CR - 7;
    const x = c + Math.cos(a) * rr;
    const y = c + Math.sin(a) * rr;
    const tx = -Math.sin(a);
    const ty = Math.cos(a);
    const k = i % 3;
    if (k === 0) r.fillPx(starPts(x, y, 3.5, 1.4, 4, a), C.yellow);
    else {
      r.linePx(
        [
          x - tx * 3 - Math.cos(a) * 2,
          y - ty * 3 - Math.sin(a) * 2,
          x + tx * 3 + Math.cos(a) * 2,
          y + ty * 3 + Math.sin(a) * 2,
        ],
        C.yellow,
      );
      if (k === 2) r.px(x + Math.cos(a) * 3, y + Math.sin(a) * 3, C.white);
    }
  }
}

function circleStar(r: Raster, rot: number): void {
  const c = CS / 2;
  r.setTransform(1, 0, 0);
  const R = CR - 20;
  // eight-point star from two squares
  for (const off of [0, Math.PI / 4]) {
    const pts: number[] = [];
    for (let i = 0; i <= 4; i++) {
      const a = rot + off + (i / 4) * Math.PI * 2;
      pts.push(c + Math.cos(a) * R, c + Math.sin(a) * R);
    }
    r.stroke(pts, 1.4, 1.4, C.gold);
    r.linePx(pts, C.yellow);
  }
  const inner = R * 0.48;
  r.stroke(ellipsePts(c, c, inner, inner, 60).concat([c + inner, c]), 1.2, 1.2, C.yellow);
  for (let i = 0; i < 8; i++) {
    const a = rot + (i / 8) * Math.PI * 2;
    r.ellipse(c + Math.cos(a) * R, c + Math.sin(a) * R, 2.4, 2.4, C.white);
  }
  r.fillPx(starPts(c, c, inner * 0.8, inner * 0.33, 5, rot * 2 - Math.PI / 2), C.gold);
  r.with({ self: true }, () =>
    r.fillPx(starPts(c, c, inner * 0.6, inner * 0.22, 5, rot * 2 - Math.PI / 2), C.yellow),
  );
}

export function drawLyraArrives(ctx: CanvasRenderingContext2D, t: number, w: number, h: number): void {
  const cx = Math.round(w / 2);
  const ccy = 122;
  const bg = layer('lyra/bg', w, h, (r) => {
    skyGradient(r, [C.black, C.navy, C.navy, C.purple, C.magenta], 0, h + 40);
    stars(r, 44, 200, 250);
    glowInto(r, cx + 8, ccy, 170, [C.purple, C.navy], 1);
  });
  blit(ctx, bg);
  twinkle(ctx, starList(44, 200, 250, w), t, 5);

  // magic circle: soft glow + counter-rotating ring and star (pre-rendered steps)
  blitC(ctx, glow(CR + 18, [C.magenta, C.purple, C.navy]), cx + 8, ccy);
  const ringI = Math.floor(t * 16) % 20; // 20 steps across one 15° rune period
  const ring = frame('lyra/ring', ringI, 20, CS, CS, (r, i) =>
    circleRing(r, (i / 20) * ((Math.PI * 2) / 24)),
  );
  blitC(ctx, ring, cx + 8, ccy);
  const starI = Math.floor(t * 10) % 24; // 24 steps across the 45° star period (reverse)
  const st = frame('lyra/star', starI, 24, CS, CS, (r, i) => circleStar(r, -(i / 24) * (Math.PI / 4)));
  blitC(ctx, st, cx + 8, ccy);

  // lower mantle flowing behind (static base)
  const fi = Math.floor(t * 8) % 6;
  const body = frame('lyra/body', fi, 6, w, h, (r, i) => {
    const ph = (i / 6) * Math.PI * 2;
    r.place(2.05, 0, 51, 60, cx - 12, 130);
    const sc = new Raster(w, h).copyTransform(r);
    const flap = (k: number): number => Math.sin(ph + k) * 3;
    // mantle skirt below the bust, blowing to the right
    const skirt = spline(
      [
        [6, 100],
        [94, 100],
        [104 + flap(0), 118],
        [118 + flap(1), 132],
        [104 + flap(2), 140],
        [-4 + flap(3) * 0.5, 140],
        [2, 118],
      ],
      true,
      4,
    );
    cel(r, sc, skirt, C.blue, C.navy, 3, -1);
    r.with({ self: true }, () => {
      r.stroke(
        spline(
          [
            [104 + flap(0), 119],
            [117 + flap(1), 132],
            [104 + flap(2), 139.5],
          ],
          false,
          3,
        ),
        1.4,
        1.4,
        C.gold,
      );
      r.stroke(
        spline(
          [
            [60, 104],
            [64, 122],
            [62, 140],
          ],
          false,
          3,
        ),
        0.8,
        0.8,
        C.navy,
      );
      r.stroke(
        spline(
          [
            [36, 104],
            [34, 122],
            [36, 140],
          ],
          false,
          3,
        ),
        0.8,
        0.8,
        C.navy,
      );
    });
    // hair ends streaming right
    for (const [pts, wd] of [
      [
        [
          [80, 60],
          [96 + flap(1), 80],
          [114 + flap(2), 96],
        ],
        12,
      ],
      [
        [
          [82, 72],
          [102 + flap(2), 92],
          [122 + flap(3), 106],
        ],
        9,
      ],
      [
        [
          [20, 70],
          [14 + flap(0) * 0.5, 96],
          [10, 116],
        ],
        9,
      ],
    ] as [P[], number][]) {
      cel(r, sc, strand(pts, wd, { pow: 1.5 }), C.gray, C.slate, 1.5, 0);
    }
    r.outline(C.darkSlate);
    const bust = new Raster(w, h).copyTransform(r);
    renderBust(bust, lyra, 'determined', {
      windX: 5 + Math.sin(ph) * 1.5,
      windY: -0.5,
      phase: ph,
      mouth: 'smile',
    });
    r.over(bust);
    // rim light from the circle behind
    r.rim(C.yellow, 1, 0);
    r.rim(C.gold, -1, 0);
    r.rim(C.yellow, 0, -1);
  });
  blit(ctx, body);

  // staff held in her near hand
  const staff = layer('lyra/staff', w, h, (r) => {
    r.place(2.05, 0, 51, 60, cx - 12, 130);
    const sx = 8;
    r.stroke([sx, -10, sx + 1, 150], 3, 3, C.darkBrown);
    r.stroke([sx - 0.6, -10, sx + 0.4, 150], 1, 1, C.brown);
    for (const y of [4, 88]) r.stroke([sx - 2.4, y, sx + 3.4, y], 1.6, 1.6, C.gold);
    // crescent + star head
    const moon = new Raster(w, h).copyTransform(r);
    moon.ellipse(sx, -18, 11, 11, C.gold);
    moon.ellipse(sx + 4, -21, 9, 9, 0);
    moon.poly(starPts(sx - 1, -18, 6.5, 2.8, 5), C.yellow);
    moon.ellipse(sx - 1, -18, 2, 2, C.cyan);
    moon.outline(C.plum);
    r.over(moon);
    // hand gripping the staff
    const hand = new Raster(w, h).copyTransform(r);
    hand.ellipse(sx + 0.5, 100, 5, 4.2, C.fair);
    hand.with({ self: true }, () =>
      hand.poly([sx - 5, 101, sx + 6, 101, sx + 6, 105, sx - 5, 105], C.fairShade),
    );
    hand.stroke([sx - 3.5, 99, sx + 4.5, 99], 0.5, 0.5, C.fairShade, 1);
    hand.poly(
      spline(
        [
          [sx + 3, 97],
          [sx + 14, 100],
          [sx + 13, 109],
          [sx + 3, 106],
        ],
        true,
        3,
      ),
      C.blue,
    );
    hand.outline(C.plum);
    r.over(hand);
    r.outline(C.black);
  });
  blit(ctx, staff);
  const tw = (Math.sin(t * 4) + 1) / 2;
  const sr = new Raster(1, 1).place(2.05, 0, 51, 60, cx - 12, 130);
  blitC(ctx, sparkleSprite(tw > 0.5 ? 5 : 3, C.cyan), sr.X(7, -18), sr.Y(7, -18));

  // sparkles
  const rand = rng(90);
  for (let i = 0; i < 26; i++) {
    const x = cx + (rand() - 0.5) * 360 + Math.sin(t * 0.7 + i) * 6;
    const y = ((((rand() * 300 - t * (8 + rand() * 10)) % 300) + 300) % 300) - 15;
    const v = Math.sin(t * 3 + i * 2.1);
    if (v < 0) continue;
    blitC(ctx, sparkleSprite(v > 0.8 ? 3 : v > 0.4 ? 2 : 1, i % 3 === 0 ? C.yellow : C.white), x, y);
  }
}
