/** Maren — village elder. Bald, long white beard, bushy white brows, kind squint, green robe. */
import { C } from '../pal';
import { cel, drawNeck, lock, outlinedMark, torsoPts, type Spec } from '../face';
import { spline, strand, type P } from '../geom';
import { dither } from '../raster';
import { beard, mustache } from './common';

const WH = C.white;
const WH_SH = C.lightGray;

export const maren: Spec = {
  id: 'maren',
  skin: C.skin,
  skinShade: C.skinShade,
  skinLine: C.darkBrown,
  mouthLine: C.skinLine,
  lash: C.darkBrown,
  iris: [C.deepTeal, C.forest, C.darkGreen],
  pupil: C.black,
  sclera: C.white,
  scleraShade: C.lightGray,
  brow: C.white,
  hairLine: C.gray,
  clothLine: C.black,
  female: false,
  happyEyes: 'arc',
  beard: true,
  shape: { turn: 0.35, eyeW: 12, eyeH: 10, jaw: 0.5, chin: 1.5, cheek: -0.3, eyeDy: 1, mouthDy: 2 },

  tweak(e, p) {
    // kind, squinting old eyes
    const sq = (o: typeof p.near): typeof p.near =>
      o.shape === 'open'
        ? {
            ...o,
            open: e === 'surprised' ? 0.75 : Math.min(o.open, 0.42) * (e === 'angry' ? 1.25 : 1),
            low: Math.max(o.low, 0.35),
            iris: Math.min(o.iris, 0.85),
          }
        : o;
    return { ...p, near: sq(p.near), far: sq(p.far), lookX: 0.1 };
  },

  body(dc) {
    const r = dc.L.body;
    const sc = dc.L.scratch;
    drawNeck(dc, 7);
    cel(r, sc, torsoPts(dc, 0.95, 82), C.darkGreen, C.forest, 3.2, -1);
    // collar trim
    r.poly(
      spline(
        [
          [38, 80],
          [50, 100],
          [62, 80],
          [58, 79],
          [50, 93],
          [42, 79],
        ],
        true,
        2,
      ),
      C.sand,
    );
    r.with({ only: C.sand }, () => r.poly([50, 78, 64, 78, 50, 102], C.tan));
    r.with({ self: true, only: C.darkGreen }, () => {
      r.stroke(
        spline(
          [
            [14, 92],
            [22, 88],
            [32, 86],
          ],
          false,
          3,
        ),
        1,
        0.4,
        C.green,
      );
    });
    // wooden beads
    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      const x = 34 + t * 32;
      const y = 96 + Math.sin(t * Math.PI) * 9;
      r.ellipse(x, y, 1.7, 1.7, C.brown);
      r.px(r.X(x - 0.5, y - 0.5), r.Y(x - 0.5, y - 0.5), C.tan);
    }
  },

  headExtra(dc) {
    const r = dc.L.head;
    r.with({ only: C.skin }, () => {
      // scalp shine
      r.ellipse(40, 20, 6, 2.6, dither(C.skin, C.sand, 0.6), -0.35);
      r.ellipse(38.5, 19.5, 2.5, 1, C.sand, -0.35);
      // forehead wrinkles
      r.stroke(
        spline(
          [
            [38, 31],
            [50, 29.5],
            [62, 31],
          ],
          false,
          3,
        ),
        0.6,
        0.6,
        C.skinShade,
        1,
      );
      r.stroke(
        spline(
          [
            [41, 35],
            [50, 33.8],
            [59, 35],
          ],
          false,
          3,
        ),
        0.6,
        0.6,
        C.skinShade,
        1,
      );
      // crow's feet
      const g = dc.g;
      r.stroke([g.near.x - 7.5, g.eyeY - 1, g.near.x - 9.5, g.eyeY - 2], 0.5, 0.5, C.skinShade, 1);
      r.stroke([g.near.x - 7.5, g.eyeY + 1.5, g.near.x - 9.5, g.eyeY + 2.5], 0.5, 0.5, C.skinShade, 1);
      r.stroke([g.far.x + 6.5, g.eyeY + 1, g.far.x + 8, g.eyeY + 2], 0.5, 0.5, C.skinShade, 1);
      // under-eye bags
      r.stroke(
        spline(
          [
            [g.near.x - 4, g.eyeY + 5.5],
            [g.near.x, g.eyeY + 6.5],
            [g.near.x + 4, g.eyeY + 5.5],
          ],
          false,
          2,
        ),
        0.5,
        0.5,
        C.skinShade,
        1,
      );
    });
  },

  front(dc) {
    const r = dc.L.front;
    // white tufts above the ears
    for (const [pts, w] of [
      [
        [
          [27, 36],
          [21, 42],
          [18, 50],
        ],
        8,
      ],
      [
        [
          [26, 42],
          [20, 50],
          [19, 58],
        ],
        7,
      ],
      [
        [
          [29, 32],
          [22, 34],
          [16, 40],
        ],
        6,
      ],
      [
        [
          [74, 36],
          [80, 42],
          [82, 50],
        ],
        7,
      ],
      [
        [
          [75, 42],
          [80.5, 50],
          [80, 57],
        ],
        6,
      ],
    ] as [P[], number][]) {
      lock(dc, r, pts, w, WH, WH_SH, { pow: 1.1, wind: 0.4 });
    }
    // long beard
    beard(
      dc,
      r,
      [
        [25, 48],
        [26, 62],
        [29.5, 78],
        [34, 96],
        [40, 112],
        [47, 124],
        [60, 123],
        [66, 108],
        [70, 92],
        [73, 74],
        [75, 58],
        [75.5, 48],
      ],
      WH,
      WH_SH,
      C.white,
      {
        top: 50,
        hollow: 3.6,
        cheek: 3,
        tips: [
          [
            [
              [34, 100],
              [30, 112],
              [33, 122],
            ],
            8,
          ],
          [
            [
              [64, 100],
              [70, 110],
              [66, 121],
            ],
            8,
          ],
        ],
      },
    );
  },

  brows(dc) {
    // big bushy white brows drooping outward
    const g = dc.g;
    const e = dc.e;
    for (const [E, b] of [
      [g.near, e.browNear],
      [g.far, e.browFar],
    ] as const) {
      outlinedMark(dc, C.gray, (m) => {
        const d = E.dir;
        const y = E.y - E.h * 0.78;
        const inner: P = [E.x - d * E.w * 0.5, y + b.inner * 1.5];
        const mid: P = [E.x + d * E.w * 0.1, y - 1.6 + b.mid];
        const outer: P = [E.x + d * E.w * 0.75, y + 2.2 + b.outer * 1.2];
        m.poly(strand([inner, mid, outer], 4.6, { pow: 1.6, tipW: 1.2 }), WH);
        m.poly(
          strand(
            [
              [inner[0] + d * 2, inner[1] + 0.4],
              [mid[0] + d * 3, mid[1] + 1.8],
              [outer[0] + d * 1.5, outer[1] + 3],
            ],
            2.4,
            { pow: 1.2 },
          ),
          WH,
        );
        m.with({ self: true }, () => m.stroke(spline([inner, mid, outer], false, 3), 0.8, 0.5, WH_SH));
      });
    }
  },

  over(dc) {
    outlinedMark(dc, C.gray, (m) => mustache(dc, m, WH, WH_SH, 1.8, 1.1));
  },
};
