/**
 * Full-figure helpers built around the bust renderer: legs, skirts, arms,
 * hands and capes for Kai and Malachar in design space (character facing
 * right; mirror with a flipped transform).
 */
import { C } from '../pal';
import { Raster } from '../raster';
import { cel } from '../face';
import { spline, strand, type P } from '../geom';

export type Who = 'kai' | 'malachar';

interface Outfit {
  sleeve: number;
  sleeveSh: number;
  fore: number;
  foreSh: number;
  bracer: number;
  bracerSh: number;
  pants: number;
  pantsSh: number;
  boot: number;
  bootSh: number;
  skirt: number;
  skirtSh: number;
  belt: number;
  trim: number;
  hand: number;
  handSh: number;
  line: number;
}

export const OUTFIT: Record<Who, Outfit> = {
  kai: {
    sleeve: C.blue,
    sleeveSh: C.navy,
    fore: C.skin,
    foreSh: C.skinShade,
    bracer: C.brown,
    bracerSh: C.darkBrown,
    pants: C.navy,
    pantsSh: C.black,
    boot: C.brown,
    bootSh: C.darkBrown,
    skirt: C.blue,
    skirtSh: C.navy,
    belt: C.darkBrown,
    trim: C.gold,
    hand: C.skin,
    handSh: C.skinShade,
    line: C.black,
  },
  malachar: {
    sleeve: C.darkSlate,
    sleeveSh: C.black,
    fore: C.darkSlate,
    foreSh: C.black,
    bracer: C.darkSlate,
    bracerSh: C.navy,
    pants: C.darkSlate,
    pantsSh: C.black,
    boot: C.black,
    bootSh: C.black,
    skirt: C.navy,
    skirtSh: C.black,
    belt: C.black,
    trim: C.darkRed,
    hand: C.lightGray,
    handSh: C.gray,
    line: C.black,
  },
};

/** Draw into a temp layer, outline it, composite. */
export function part(r: Raster, line: number, fn: (p: Raster, sc: Raster) => void): void {
  const p = new Raster(r.w, r.h).copyTransform(r);
  const sc = new Raster(r.w, r.h).copyTransform(r);
  fn(p, sc);
  p.outline(line);
  r.over(p);
}

/** Limb from a → b → c with a sleeve covering the first `sleeveK` of it. */
export function limb(
  r: Raster,
  o: Outfit,
  pts: readonly P[],
  w0: number,
  w1: number,
  upper: number,
  upperSh: number,
  lower: number,
  lowerSh: number,
  bracer = true,
): void {
  part(r, o.line, (p, sc) => {
    cel(p, sc, strand([pts[1], pts[2]], w1 + 0.5, { tipW: w1 * 0.85 }), lower, lowerSh, -1, -1.2);
    cel(p, sc, strand([pts[0], pts[1]], w0, { tipW: w1 + 1 }), upper, upperSh, -1, -1.2);
    if (bracer) {
      const [bx, by] = pts[1];
      const [cx, cy] = pts[2];
      const mx = bx + (cx - bx) * 0.55;
      const my = by + (cy - by) * 0.55;
      cel(
        p,
        sc,
        strand(
          [
            [bx + (cx - bx) * 0.3, by + (cy - by) * 0.3],
            [mx, my],
            [bx + (cx - bx) * 0.8, by + (cy - by) * 0.8],
          ],
          w1 + 1.4,
          { tipW: w1 + 1 },
        ),
        o.bracer,
        o.bracerSh,
        -1,
        -1,
      );
    }
  });
}

/** Open palm facing +x (for beam poses). */
export function palm(r: Raster, o: Outfit, x: number, y: number, rot = 0): void {
  part(r, o.line, (p, sc) => {
    cel(
      p,
      sc,
      strand(
        [
          [x - 3, y + 1],
          [x + 1, y],
          [x + 3.5, y - 1],
        ],
        8,
        { tipW: 6 },
      ),
      o.hand,
      o.handSh,
      -0.6,
      -0.6,
    );
    for (let k = 0; k < 4; k++) {
      const a = rot - 1.2 + k * 0.55;
      p.stroke(
        [x + 2, y - 2.5 + k * 1.6, x + 2 + Math.cos(a) * 5, y - 2.5 + k * 1.6 + Math.sin(a) * 5],
        1.8,
        1.4,
        o.hand,
      );
    }
  });
}

/** Clenched fist. */
export function fist(r: Raster, o: Outfit, x: number, y: number, side = 1): void {
  part(r, o.line, (p, sc) => {
    cel(
      p,
      sc,
      spline(
        [
          [x - 5, y - 4.5],
          [x + 5, y - 5],
          [x + 6, y + 1],
          [x + 4, y + 5],
          [x - 4, y + 5],
          [x - 6, y + 1],
        ],
        true,
        3,
      ),
      o.hand,
      o.handSh,
      -side,
      -1,
    );
    for (let k = -1; k <= 1; k++)
      p.stroke([x + k * 2.8, y - 4, x + k * 2.8 + 0.3, y - 1.2], 0.6, 0.6, o.handSh, 1);
  });
}

/** Legs in a stance: back foot and front foot positions (design space). */
export function legs(
  r: Raster,
  o: Outfit,
  hipBack: P,
  kneeBack: P,
  footBack: P,
  hipFront: P,
  kneeFront: P,
  footFront: P,
): void {
  for (const [hip, knee, foot] of [
    [hipBack, kneeBack, footBack],
    [hipFront, kneeFront, footFront],
  ] as const) {
    part(r, o.line, (p, sc) => {
      cel(p, sc, strand([hip, knee], 15, { tipW: 12 }), o.pants, o.pantsSh, -1.2, -1);
      cel(p, sc, strand([knee, foot], 12.5, { tipW: 10 }), o.pants, o.pantsSh, -1.2, -1);
      // boot
      const dx = foot[0] - knee[0];
      const dy = foot[1] - knee[1];
      const l = Math.hypot(dx, dy) || 1;
      const bx = foot[0] - (dx / l) * 10;
      const by = foot[1] - (dy / l) * 10;
      cel(p, sc, strand([[bx, by], foot], 13, { tipW: 12 }), o.boot, o.bootSh, -1, -1);
      cel(
        p,
        sc,
        spline(
          [
            [foot[0] - 5, foot[1] - 3],
            [foot[0] + 9, foot[1] - 2],
            [foot[0] + 10, foot[1] + 2.5],
            [foot[0] - 5, foot[1] + 2.5],
          ],
          true,
          2,
        ),
        o.boot,
        o.bootSh,
        -0.5,
        -0.5,
      );
    });
  }
}

/** Tunic skirt + belt (Kai) / armored tassets (Malachar) around the waist. */
export function waist(r: Raster, who: Who): void {
  const o = OUTFIT[who];
  part(r, o.line, (p, sc) => {
    const low = who === 'kai' ? 146 : 152;
    cel(
      p,
      sc,
      spline(
        [
          [26, 124],
          [76, 124],
          [84, low],
          [66, low - 4],
          [51, low + 1],
          [36, low - 4],
          [18, low],
        ],
        true,
        3,
      ),
      o.skirt,
      o.skirtSh,
      2.5,
      -1,
    );
    p.poly([25.5, 123, 76.5, 123, 77, 129, 25, 129], o.belt);
    p.with({ self: true }, () => p.stroke([25, 129, 77, 129], 0.9, 0.9, o.trim));
    if (who === 'kai') cel(p, sc, [47, 122.5, 55, 122.5, 55, 129.5, 47, 129.5], C.gold, C.orange, -0.5, -0.5);
    else cel(p, sc, [51, 120, 55, 125, 51, 130, 47, 125], C.magenta, C.purple, -0.5, -0.5);
  });
}

/** Malachar's long cape streaming behind him (-x in design space). */
export function cape(r: Raster, ph: number, lift = 0): void {
  part(r, C.black, (p, sc) => {
    const wv = (k: number): number => Math.sin(ph + k) * 5;
    const pts: P[] = [
      [20, 88],
      [80, 88],
      [60, 150],
      [20 + wv(1), 190],
      [-30 + wv(2), 178 - lift],
      [-60 + wv(3), 150 - lift * 1.4],
      [-40 + wv(4), 130 - lift],
      [-10, 100],
    ];
    cel(p, sc, spline(pts, true, 4), C.darkRed, C.plum, 2, 2);
    cel(
      p,
      sc,
      spline(
        [
          [26, 90],
          [70, 92],
          [48, 146],
          [10 + wv(1), 176],
          [-24 + wv(2), 164 - lift],
          [-44 + wv(3), 140 - lift * 1.2],
          [-6, 104],
        ],
        true,
        4,
      ),
      C.navy,
      C.black,
      -2,
      -1,
    );
  });
}

/** Kai's scarf tail streaming behind (-x). `torn` shortens it with ragged ends. */
export function scarfTail(r: Raster, ph: number, torn = false, lift = 0): void {
  part(r, C.black, (p, sc) => {
    const len = torn ? 0.6 : 1;
    const pts: P[] = [];
    for (let i = 0; i <= 5; i++) {
      const u = i / 5;
      pts.push([40 - u * 60 * len, 86 + u * (6 - lift) + Math.sin(ph * 2 + u * 4) * 4 * u]);
    }
    cel(p, sc, strand(pts, 10, { tipW: torn ? 4 : 8, pow: 1 }), C.red, C.darkRed, 1, 1);
    if (torn) {
      const e = pts[pts.length - 1];
      p.poly(
        [e[0] + 2, e[1] - 4, e[0] - 5, e[1] - 2, e[0] - 1, e[1], e[0] - 6, e[1] + 3, e[0] + 2, e[1] + 4],
        0,
      );
    }
  });
}
