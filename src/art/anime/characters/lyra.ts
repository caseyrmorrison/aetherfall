/** Lyra — mage of the Order of Stars. Long silver-white hair, star hairpin, violet eyes, blue mantle. */
import { C } from '../pal';
import { angelRing, blow, cel, drawNeck, lock, torsoPts, type DrawCtx, type Spec } from '../face';
import { spline, starPts, strand, type P } from '../geom';

const HAIR = C.lightGray;
const HAIR_SH = C.gray;
const HAIR_HI = C.white;

function star(dc: DrawCtx, x: number, y: number, r0: number, rot = -Math.PI / 2): void {
  const r = dc.L.front;
  cel(r, dc.L.scratch, starPts(x, y, r0, r0 * 0.45, 5, rot), C.yellow, C.gold, -0.6, -0.6);
}

export const lyra: Spec = {
  id: 'lyra',
  skin: C.fair,
  skinShade: C.fairShade,
  skinLine: C.darkBrown,
  mouthLine: C.skinLine,
  lash: C.plum,
  iris: [C.purple, C.magenta, C.pink],
  pupil: C.plum,
  sclera: C.white,
  scleraShade: C.lightGray,
  brow: C.slate,
  hairLine: C.darkSlate,
  clothLine: C.black,
  backLine: C.darkSlate,
  female: true,
  happyEyes: 'arc',
  shape: { turn: 0.5, eyeW: 13.6, eyeH: 15, jaw: -1.2, chin: -1, cheek: 0.6 },
  lashW: 1.05,

  back(dc) {
    const r = dc.L.back;
    const sc = dc.L.scratch;
    const v = dc.variant;
    const low = v === 'child' ? 0.75 : 1;
    // long back hair, flowing with the wind
    const mass: P[] = [
      [50, 10],
      [70, 14],
      [80, 28],
      [84, 50],
      blow(dc, [87, 76], 0.4 * low),
      blow(dc, [90, 100 * low + 10], 0.8),
      blow(dc, [93, 126], 1.1),
      blow(dc, [7, 126], 1.1),
      blow(dc, [10, 100 * low + 10], 0.8),
      blow(dc, [13, 76], 0.4),
      [16, 50],
      [20, 28],
      [30, 14],
    ];
    cel(r, sc, spline(mass, true, 4), HAIR_SH, C.slate, 2.5, 0);
    // strand ends at the edges
    for (const [pts, w] of [
      [
        [
          [16, 70],
          [10, 95],
          [4, 118],
        ],
        8,
      ],
      [
        [
          [84, 70],
          [90, 95],
          [96, 116],
        ],
        8,
      ],
    ] as [P[], number][]) {
      lock(dc, r, pts, w, HAIR_SH, C.slate, { edge: -1 });
    }
    if (v !== 'child') {
      // hood lying on the shoulders behind the neck
      const hood = spline(
        [
          [27, 70],
          [36, 62],
          [50, 60],
          [64, 62],
          [73, 70],
          [80, 86],
          [20, 86],
        ],
        true,
        4,
      );
      cel(r, sc, hood, C.blue, C.navy, 1.5, 1.5);
      r.with({ self: true }, () =>
        r.stroke(
          spline(
            [
              [29, 69],
              [38, 62.5],
              [50, 61],
              [62, 62.5],
              [71, 69],
            ],
            false,
            3,
          ),
          1.2,
          1.2,
          C.gold,
        ),
      );
    }
  },

  body(dc) {
    const r = dc.L.body;
    const sc = dc.L.scratch;
    const child = dc.variant === 'child';
    drawNeck(dc, 6.2);
    if (child) {
      // simple winter coat for young Lyra
      cel(r, sc, torsoPts(dc, 0.8, 82), C.blue, C.navy, 3, -1);
      r.poly(
        spline(
          [
            [38, 82],
            [50, 90],
            [62, 82],
            [66, 88],
            [50, 96],
            [34, 88],
          ],
          true,
          3,
        ),
        C.white,
      );
      r.with({ self: true, only: C.white }, () => r.poly([30, 90, 70, 90, 70, 97, 30, 97], C.lightGray));
      return;
    }
    // mantle body
    cel(r, sc, torsoPts(dc, 0.94, 81), C.blue, C.navy, 3.2, -1);
    // blouse opening
    const open = spline(
      [
        [42, 79.5],
        [58, 79.5],
        [55, 90],
        [50, 99],
        [45, 90],
      ],
      true,
      3,
    );
    r.poly(open, C.white);
    r.with({ only: C.white }, () => r.poly([52, 79, 60, 79, 54, 100, 50, 100], C.lightGray));
    // ribbon
    r.poly([46, 83, 50, 85.5, 54, 83, 54, 88, 50, 86.5, 46, 88], C.magenta);
    // capelet with gold trim
    const cape = spline(
      [
        [38, 79.5],
        [22, 84],
        [9, 94],
        [5, 106],
        [18, 109],
        [33, 104],
        [45, 101],
        [50, 104],
        [55, 101],
        [67, 104],
        [82, 109],
        [95, 106],
        [92, 94],
        [78, 84],
        [62, 79.5],
        [56, 88],
        [50, 95],
        [44, 88],
      ],
      true,
      4,
    );
    cel(r, sc, cape, C.blue, C.navy, 2.5, -2);
    r.with({ self: true }, () => {
      r.stroke(
        spline(
          [
            [5.5, 105],
            [18, 108],
            [33, 103.2],
            [45, 100.2],
            [50, 103],
            [55, 100.2],
            [67, 103.2],
            [82, 108],
            [94.5, 105],
          ],
          false,
          4,
        ),
        1.4,
        1.4,
        C.gold,
      );
      r.stroke(
        spline(
          [
            [43.5, 80],
            [45, 88],
            [50, 94.5],
            [55, 88],
            [56.5, 80],
          ],
          false,
          3,
        ),
        1.2,
        1.2,
        C.gold,
      );
      r.stroke(
        spline(
          [
            [16, 88],
            [24, 84],
            [34, 81],
          ],
          false,
          3,
        ),
        1,
        0.4,
        C.sky,
      );
    });
    // star clasp
    cel(r, sc, starPts(50, 95, 4.2, 1.9, 5), C.yellow, C.gold, -0.6, -0.6);
  },

  front(dc) {
    const r = dc.L.front;
    const sc = dc.L.scratch;
    // ahoge
    lock(
      dc,
      r,
      [
        [50, 11],
        [53, 4],
        [59, 3.5],
        [61, 6],
      ],
      3.2,
      HAIR,
      HAIR_SH,
      { pow: 1.4, edge: -1 },
    );
    const cap = spline(
      [
        [22, 55],
        [20, 38],
        [25, 21],
        [37, 11],
        [52, 8],
        [67, 11],
        [77, 21],
        [81, 38],
        [79, 55],
        [74, 44],
        [69, 33],
        [58, 27.5],
        [44, 28],
        [33, 32],
        [27, 42],
        [25.5, 55],
      ],
      true,
      4,
    );
    cel(r, sc, cap, HAIR, HAIR_SH, -2.5, -2.5);
    // long side locks framing the face
    const child = dc.variant === 'child';
    const L = child ? 0.8 : 1;
    lock(
      dc,
      r,
      [
        [24, 36],
        [20, 56],
        blow(dc, [18, 56 + 24 * L], 0.3),
        blow(dc, [22, 56 + 46 * L], 0.6),
        blow(dc, [19, 56 + 60 * L], 0.9),
      ],
      10.5,
      HAIR,
      HAIR_SH,
      { pow: 2.2, edgeFrom: 0.3 },
    );
    lock(dc, r, [[27, 44], [24.5, 64], blow(dc, [25.5, 64 + 22 * L], 0.5)], 6, HAIR, HAIR_SH, { pow: 1.4 });
    lock(
      dc,
      r,
      [
        [77, 36],
        [80, 56],
        blow(dc, [81, 56 + 24 * L], 0.3),
        blow(dc, [78, 56 + 44 * L], 0.6),
        blow(dc, [81, 56 + 56 * L], 0.9),
      ],
      9.5,
      HAIR,
      HAIR_SH,
      { pow: 2.2, edgeFrom: 0.3 },
    );
    lock(dc, r, [[74, 46], [76, 64], blow(dc, [75, 64 + 20 * L], 0.5)], 5, HAIR, HAIR_SH, { pow: 1.4 });
    // bangs (side-swept)
    const bangs: [P[], number][] = [
      [
        [
          [29, 26],
          [25, 38],
          [23.5, 52],
        ],
        9,
      ],
      [
        [
          [36, 24],
          [33, 35],
          [31.5, 45.5],
        ],
        9,
      ],
      [
        [
          [44, 23],
          [44, 34],
          [47.5, 46.5],
        ],
        9,
      ],
      [
        [
          [51, 23],
          [54, 33],
          [55, 44],
        ],
        8.5,
      ],
      [
        [
          [58, 24],
          [62, 33],
          [63.5, 43],
        ],
        8.5,
      ],
      [
        [
          [65, 25],
          [70, 34],
          [72.5, 45.5],
        ],
        8,
      ],
      [
        [
          [72, 28],
          [77, 38],
          [78.5, 52],
        ],
        7,
      ],
    ];
    for (const [pts, w] of bangs)
      lock(dc, r, pts, w, HAIR, HAIR_SH, { wind: 0.12, pow: 1.1, edge: C.slate, edgeFrom: 0.5 });
    angelRing(r, 51, 29, 24, 16.5, Math.PI * 1.08, Math.PI * 1.9, HAIR_HI, { n: 8, len: 3.6, w: 2.4 });
    // star hairpin
    star(dc, 29.5, 31, 4.6, -Math.PI / 2 - 0.25);
    r.with({ self: true }, () => r.ellipse(28.8, 30, 0.9, 0.9, C.white));
    if (!child) {
      r.poly(
        strand(
          [
            [31.5, 34],
            [33, 40],
            [32, 44],
          ],
          1.6,
          { pow: 0.8 },
        ),
        C.gold,
      );
      r.ellipse(32.2, 44.6, 1.1, 1.1, C.cyan);
    }
  },
};
