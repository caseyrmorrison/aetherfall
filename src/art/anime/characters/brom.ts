/** Brom — blacksmith. Burly, short red-brown hair, big beard, headband, soot, leather apron. */
import { C } from '../pal';
import { angelRing, cel, drawNeck, lock, outlinedMark, torsoPts, type Spec } from '../face';
import { spline } from '../geom';
import { dither } from '../raster';
import { beard, mustache } from './common';

const HAIR = C.rust;
const HAIR_SH = C.darkBrown;
const HAIR_HI = C.orangeBrown;

export const brom: Spec = {
  id: 'brom',
  skin: C.tan,
  skinShade: C.brown,
  skinLine: C.darkBrown,
  mouthLine: C.darkBrown,
  lash: C.black,
  iris: [C.plum, C.darkBrown, C.brown],
  pupil: C.black,
  sclera: C.white,
  scleraShade: C.lightGray,
  brow: C.darkBrown,
  hairLine: C.black,
  clothLine: C.black,
  female: false,
  happyEyes: 'arc',
  beard: true,
  shape: { turn: 0.4, eyeW: 11, eyeH: 8.6, jaw: 3, chin: 2, cheek: 0.3, eyeDy: 0.5, mouthDy: 1.5 },
  lashW: 0.95,
  irisScale: 0.82,

  body(dc) {
    const r = dc.L.body;
    const sc = dc.L.scratch;
    drawNeck(dc, 10.5);
    // bare, broad shoulders
    cel(r, sc, torsoPts(dc, 1.12, 77), C.tan, C.brown, 4, -1);
    r.with({ only: C.tan }, () => {
      r.stroke(
        spline(
          [
            [8, 96],
            [14, 90],
            [24, 88],
          ],
          false,
          3,
        ),
        0.8,
        0.8,
        C.brown,
      );
      r.stroke(
        spline(
          [
            [92, 96],
            [86, 90],
            [76, 88],
          ],
          false,
          3,
        ),
        0.8,
        0.8,
        C.brown,
      );
    });
    // dark undershirt
    cel(
      r,
      sc,
      spline(
        [
          [30, 84],
          [40, 80],
          [60, 80],
          [70, 84],
          [74, 124],
          [26, 124],
        ],
        true,
        3,
      ),
      C.darkSlate,
      C.navy,
      2,
      -1,
    );
    // leather apron with straps
    r.poly([28, 83, 33, 82, 40, 100, 35, 101], C.darkBrown);
    r.poly([72, 83, 67, 82, 60, 100, 65, 101], C.darkBrown);
    cel(
      r,
      sc,
      spline(
        [
          [34, 98],
          [66, 98],
          [68, 124],
          [32, 124],
        ],
        true,
        2,
      ),
      C.brown,
      C.darkBrown,
      2,
      -1,
    );
    r.with({ self: true, only: C.brown }, () => {
      r.stroke([35, 99.5, 65, 99.5], 0.9, 0.9, C.tan);
      r.ellipse(44, 112, 4, 2, dither(C.brown, C.darkBrown, 0.5), 0.3);
    });
    r.ellipse(36.5, 100, 1.3, 1.3, C.lightGray);
    r.ellipse(63.5, 100, 1.3, 1.3, C.lightGray);
  },

  headExtra(dc) {
    // soot smudges
    const r = dc.L.head;
    r.with({ only: C.tan }, () => {
      r.ellipse(33, 62, 3.5, 1.6, dither(C.tan, C.gray, 0.35), -0.3);
      r.ellipse(62, 36, 3, 1.3, dither(C.tan, C.gray, 0.3), 0.2);
    });
  },

  front(dc) {
    const r = dc.L.front;
    const sc = dc.L.scratch;
    // beard
    beard(
      dc,
      r,
      [
        [25.5, 44],
        [25.5, 58],
        [29, 72],
        [37, 84],
        [48, 91],
        [59, 90],
        [67, 82],
        [72.5, 68],
        [75.5, 52],
        [76, 44],
      ],
      HAIR,
      HAIR_SH,
      HAIR_HI,
      {
        top: 44,
        cheek: 4,
        tips: [
          [
            [
              [40, 84],
              [42, 92],
              [40, 97],
            ],
            7,
          ],
          [
            [
              [50, 86],
              [52, 94],
              [50, 100],
            ],
            8,
          ],
          [
            [
              [60, 84],
              [62, 91],
              [63, 96],
            ],
            6,
          ],
        ],
      },
    );
    const cap = spline(
      [
        [23, 46],
        [22, 30],
        [28, 18],
        [40, 12],
        [54, 11],
        [68, 14],
        [77, 22],
        [80, 34],
        [78.5, 46],
        [75, 38],
        [62, 31],
        [48, 31],
        [35, 33],
        [27, 39],
      ],
      true,
      4,
    );
    cel(r, sc, cap, HAIR, HAIR_SH, -2.5, -2.5);
    // short messy hair: chunky tufts over the crown (drawn over the cap)
    const tufts: [number, number, number, number][] = [
      [1.1, 7, 8, -1.5],
      [1.22, 8, 8.5, -1],
      [1.34, 8.5, 9, -0.6],
      [1.46, 9, 9, 0.3],
      [1.58, 8.5, 9, 0.8],
      [1.7, 8, 8.5, 1.3],
      [1.82, 7, 8, 1.6],
      [1.92, 6, 7, 2],
    ];
    for (const [a, len, wd, lean] of tufts) {
      const ang = Math.PI * a;
      const bx = 51 + Math.cos(ang) * 20;
      const by = 30 + Math.sin(ang) * 17;
      const dx = Math.cos(ang);
      const dy = Math.sin(ang);
      lock(
        dc,
        r,
        [
          [bx - dx * 4, by - dy * 4],
          [bx + dx * len * 0.5 + lean, by + dy * len * 0.5],
          [bx + dx * len + lean * 1.8, by + dy * len - 0.5],
        ],
        wd,
        HAIR,
        HAIR_SH,
        { pow: 1.1, wind: 0.2 },
      );
    }
    angelRing(r, 51, 22, 22, 11, Math.PI * 1.1, Math.PI * 1.9, HAIR_HI, { n: 7, len: 2.6, w: 2 });
    // headband
    const band = spline(
      [
        [21.5, 38],
        [25, 28.5],
        [38, 24.5],
        [52, 23.5],
        [66, 25],
        [77.5, 29],
        [80, 37],
        [76.5, 35.5],
        [66, 31.5],
        [52, 30.5],
        [38, 31.5],
        [26, 36],
      ],
      true,
      4,
    );
    cel(r, sc, band, C.slate, C.darkSlate, -1.5, -1.5);
    r.with({ self: true }, () =>
      r.stroke(
        spline(
          [
            [26, 32],
            [40, 27],
            [54, 26.3],
            [70, 28],
          ],
          false,
          3,
        ),
        0.8,
        0.8,
        C.gray,
      ),
    );
    // headband knot tails at the near side
    lock(
      dc,
      r,
      [
        [22, 34],
        [15, 36],
        [10, 42],
      ],
      4.5,
      C.slate,
      C.darkSlate,
      { tipW: 2 },
    );
    lock(
      dc,
      r,
      [
        [22, 33],
        [14, 30],
        [8, 32],
      ],
      4,
      C.slate,
      C.darkSlate,
      { tipW: 2 },
    );
    // sideburns into the beard
    lock(
      dc,
      r,
      [
        [24.5, 36],
        [24, 44],
        [26, 50],
      ],
      5,
      HAIR,
      HAIR_SH,
      { edge: -1 },
    );
    lock(
      dc,
      r,
      [
        [77.5, 36],
        [77, 44],
        [75.5, 50],
      ],
      4.5,
      HAIR,
      HAIR_SH,
      { edge: -1 },
    );
  },

  over(dc) {
    outlinedMark(dc, C.black, (m) => mustache(dc, m, HAIR, HAIR_SH, 1.2, 1.1));
  },
};
