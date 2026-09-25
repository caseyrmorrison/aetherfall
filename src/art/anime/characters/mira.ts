/** Mira — merchant. Brown side ponytail, orange bandana, green eyes, freckles, apron. */
import { C } from '../pal';
import { angelRing, blow, cel, drawNeck, lock, torsoPts, type Spec } from '../face';
import { spline, type P } from '../geom';

const HAIR = C.brown;
const HAIR_SH = C.darkBrown;
const HAIR_HI = C.tan;

export const mira: Spec = {
  id: 'mira',
  skin: C.skin,
  skinShade: C.skinShade,
  skinLine: C.darkBrown,
  mouthLine: C.skinLine,
  lash: C.plum,
  iris: [C.forest, C.darkGreen, C.green],
  pupil: C.deepTeal,
  sclera: C.white,
  scleraShade: C.lightGray,
  brow: C.darkBrown,
  hairLine: C.plum,
  clothLine: C.plum,
  female: true,
  happyEyes: 'arc',
  shape: { turn: 0.5, eyeW: 13, eyeH: 14, jaw: -0.8, chin: -1, cheek: 0.9 },

  back(dc) {
    const r = dc.L.back;
    // back of the hair / bandana knot tails
    cel(
      r,
      dc.L.scratch,
      spline(
        [
          [22, 40],
          [24, 20],
          [50, 8],
          [76, 20],
          [79, 42],
          [72, 60],
          [28, 60],
        ],
        true,
        4,
      ),
      HAIR_SH,
      C.plum,
      2,
      0,
    );
    lock(dc, r, [[21, 25], blow(dc, [12, 19], 0.5), blow(dc, [5, 21], 1)], 5.5, C.orange, C.rust, {
      edge: -1,
      tipW: 2,
    });
    lock(dc, r, [[21, 28], blow(dc, [13, 32], 0.5), blow(dc, [8, 38], 1)], 5, C.orange, C.rust, {
      edge: -1,
      tipW: 2,
    });
  },

  body(dc) {
    const r = dc.L.body;
    const sc = dc.L.scratch;
    drawNeck(dc, 6.3);
    cel(r, sc, torsoPts(dc, 0.9, 82), C.sand, C.tan, 3, -1);
    // rolled collar
    for (const pts of [
      [
        [42, 79.5],
        [50, 86],
        [45, 91],
        [36, 84],
      ],
      [
        [58, 79.5],
        [50, 86],
        [55, 91],
        [64, 84],
      ],
    ] as P[][]) {
      cel(r, sc, spline(pts, true, 2), C.white, C.lightGray, 1, -1);
    }
    // apron bib + straps
    r.poly([35, 83, 39, 83, 42, 97, 38.5, 97], C.forest);
    r.poly([61, 83, 65, 83, 61.5, 97, 58, 97], C.forest);
    cel(
      r,
      sc,
      spline(
        [
          [37, 96],
          [63, 96],
          [64, 124],
          [36, 124],
        ],
        true,
        2,
      ),
      C.darkGreen,
      C.forest,
      2,
      -1,
    );
    r.with({ self: true, only: C.darkGreen }, () => {
      r.stroke([37.5, 97.5, 62.5, 97.5], 0.9, 0.9, C.green);
      // coin pouch pocket
      r.poly(
        spline(
          [
            [44, 106],
            [56, 106],
            [55, 114],
            [45, 114],
          ],
          true,
          2,
        ),
        C.forest,
      );
    });
    r.ellipse(50, 107, 1.4, 1.4, C.gold);
    // buttons on the blouse
    r.ellipse(50, 91, 0.9, 0.9, C.brown);
  },

  front(dc) {
    const r = dc.L.front;
    const sc = dc.L.scratch;
    // side ponytail over the far shoulder
    const tieX = 77;
    const tieY = 46;
    lock(
      dc,
      r,
      [
        [tieX, tieY],
        blow(dc, [83, 62], 0.3),
        blow(dc, [80, 82], 0.6),
        blow(dc, [84, 100], 0.9),
        blow(dc, [79, 112], 1.1),
      ],
      14,
      HAIR,
      HAIR_SH,
      {
        pow: 1.8,
        bulge: 0.25,
        edgeFrom: 0.2,
      },
    );
    lock(dc, r, [[tieX - 1, tieY + 2], blow(dc, [78, 66], 0.4), blow(dc, [74, 84], 0.8)], 6, HAIR, HAIR_SH, {
      pow: 1.3,
    });
    // hair under the bandana
    const cap = spline(
      [
        [23, 52],
        [21.5, 36],
        [27, 24],
        [73, 24],
        [79, 36],
        [78, 48],
        [73, 42],
        [69, 33],
        [56, 29],
        [44, 30],
        [32, 34],
        [27, 43],
        [25.5, 52],
      ],
      true,
      4,
    );
    cel(r, sc, cap, HAIR, HAIR_SH, -2, -2);
    lock(
      dc,
      r,
      [
        [24, 36],
        [21.5, 50],
        [23.5, 62],
      ],
      7,
      HAIR,
      HAIR_SH,
      {},
    );
    const bangs: [P[], number][] = [
      [
        [
          [30, 27],
          [27, 37],
          [25.5, 46],
        ],
        8,
      ],
      [
        [
          [37, 26],
          [35.5, 36],
          [34, 43.5],
        ],
        8.5,
      ],
      [
        [
          [44, 26],
          [45, 35],
          [46.5, 44],
        ],
        8,
      ],
      [
        [
          [51, 26],
          [53, 35],
          [54, 42.5],
        ],
        8,
      ],
      [
        [
          [58, 26],
          [61.5, 35],
          [62.5, 43.5],
        ],
        8.5,
      ],
      [
        [
          [66, 27],
          [70, 35],
          [71.5, 44.5],
        ],
        8,
      ],
      [
        [
          [72, 29],
          [77, 38],
          [77.5, 48],
        ],
        6.5,
      ],
    ];
    for (const [pts, w] of bangs)
      lock(dc, r, pts, w, HAIR, HAIR_SH, { wind: 0.12, pow: 1.1, edge: C.plum, edgeFrom: 0.55 });
    angelRing(r, 51, 32, 22, 6, Math.PI * 1.15, Math.PI * 1.85, HAIR_HI, { n: 7, len: 2.2, w: 1.8 });
    // hair tie
    r.ellipse(tieX, tieY, 2.6, 2.2, C.green);
    r.ellipse(tieX - 0.6, tieY - 0.6, 0.9, 0.8, C.white);
    // bandana
    const band = spline(
      [
        [20.5, 38],
        [20.5, 24],
        [28, 13],
        [40, 7],
        [54, 5.5],
        [68, 9],
        [77, 18],
        [80.5, 31],
        [78, 35],
        [70, 27.5],
        [58, 25],
        [46, 25.5],
        [34, 28.5],
        [25.5, 34],
      ],
      true,
      4,
    );
    cel(r, sc, band, C.orange, C.rust, -2.5, -2);
    r.with({ self: true }, () => {
      r.stroke(
        spline(
          [
            [23, 34],
            [34, 26.5],
            [46, 23.5],
            [58, 23],
            [70, 25.5],
            [79, 32],
          ],
          false,
          4,
        ),
        1,
        1,
        C.rust,
      );
      r.stroke(
        spline(
          [
            [30, 14],
            [42, 9],
            [56, 8],
          ],
          false,
          3,
        ),
        1.2,
        0.5,
        C.gold,
      );
      for (const [x, y] of [
        [34, 18],
        [46, 13],
        [60, 14],
        [70, 20],
        [28, 26],
        [52, 20],
        [40, 23],
        [64, 22],
      ] as P[]) {
        r.ellipse(x, y, 1.1, 1.1, C.sand);
      }
    });
    // knot
    cel(
      r,
      sc,
      spline(
        [
          [18, 23],
          [23, 21],
          [25, 27],
          [20, 30],
        ],
        true,
        3,
      ),
      C.orange,
      C.rust,
      -0.8,
      -0.8,
    );
  },

  featExtra(dc) {
    // freckles
    const r = dc.L.head;
    const g = dc.g;
    r.with({ only: C.skin }, () => {
      for (const [x, y] of [
        [-3, 8],
        [-0.5, 9.2],
        [2, 8.2],
        [-1.5, 10.6],
      ] as P[]) {
        r.px(r.X(g.near.x + x, g.eyeY + y), r.Y(g.near.x + x, g.eyeY + y), C.skinShade);
        r.px(r.X(g.far.x - x * 0.6 + 1, g.eyeY + y), r.Y(g.far.x - x * 0.6 + 1, g.eyeY + y), C.skinShade);
      }
    });
  },
};
