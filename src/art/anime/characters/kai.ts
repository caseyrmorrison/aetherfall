/** Kai — the hero. Spiky navy hair, amber eyes, red scarf, blue tunic, leather pauldron. */
import { C } from '../pal';
import { angelRing, cel, drawNeck, lock, torsoPts, blow, type Spec } from '../face';
import { spline, strand, type P } from '../geom';
import { dither } from '../raster';

export const flags = { kaiMark: true };

const HAIR = C.darkSlate;
const HAIR_SH = C.navy;
const HAIR_HI = C.slate;

export const kai: Spec = {
  id: 'kai',
  skin: C.skin,
  skinShade: C.skinShade,
  skinLine: C.darkBrown,
  mouthLine: C.skinLine,
  lash: C.black,
  iris: [C.rust, C.gold, C.yellow],
  pupil: C.plum,
  sclera: C.white,
  scleraShade: C.lightGray,
  brow: C.black,
  hairLine: C.black,
  clothLine: C.black,
  female: false,
  happyEyes: 'open',
  shape: { turn: 0.55, eyeW: 13, eyeH: 12.5, jaw: 0.6, chin: 0.2, cheek: 0 },
  lashW: 1.1,

  back(dc) {
    const r = dc.L.back;
    // nape spikes behind the neck
    for (const pts of [
      [
        [33, 50],
        [27, 62],
        [22, 72],
      ],
      [
        [66, 50],
        [73, 60],
        [78, 70],
      ],
      [
        [40, 56],
        [37, 66],
        [36, 74],
      ],
    ] as P[][]) {
      lock(dc, r, pts, 9, HAIR_SH, C.navy, { wind: 0.3 });
    }
  },

  body(dc) {
    const r = dc.L.body;
    const sc = dc.L.scratch;
    drawNeck(dc, 7.6);
    // tunic
    cel(r, sc, torsoPts(dc, 1, 80), C.blue, C.navy, 3.5, -1);
    // tunic collar V
    r.poly(
      spline(
        [
          [41, 80],
          [50, 96],
          [59, 80],
          [55, 80],
          [50, 90],
          [45, 80],
        ],
        true,
        2,
      ),
      C.navy,
    );
    // chest strap
    r.poly([60, 82, 68, 84, 36, 124, 27, 124], C.darkBrown);
    r.poly([62, 83, 66, 84, 33, 124, 30, 124], C.brown);
    r.ellipse(52, 100, 2.6, 2.6, C.gold);
    r.ellipse(51.5, 99.5, 1.1, 1.1, C.yellow);
    // leather pauldron hugging the near shoulder
    const lower = spline(
      [
        [3, 101],
        [4.5, 111],
        [10, 112],
        [15, 104],
        [24, 98.5],
        [29, 96],
        [22, 94],
        [12, 97],
      ],
      true,
      4,
    );
    cel(r, sc, lower, C.brown, C.darkBrown, 1.5, -1.5);
    const dome = spline(
      [
        [33, 86],
        [24, 84],
        [14, 86.5],
        [7, 91],
        [3.5, 100],
        [8.5, 103],
        [15, 97.5],
        [24, 93.5],
        [32, 92.5],
      ],
      true,
      5,
    );
    cel(r, sc, dome, C.brown, C.darkBrown, 2, -2.4);
    r.with({ self: true }, () => {
      r.stroke(
        spline(
          [
            [7.5, 95],
            [12.5, 89],
            [22, 86.2],
            [30, 86.8],
          ],
          false,
          3,
        ),
        1.3,
        0.6,
        C.tan,
      );
      r.stroke(
        spline(
          [
            [5, 100.5],
            [9.5, 101],
            [15.5, 96.5],
            [24, 92.8],
            [32, 92],
          ],
          false,
          3,
        ),
        0.8,
        0.8,
        C.darkBrown,
      );
      r.stroke(
        spline(
          [
            [5, 110],
            [10, 109.5],
            [15.5, 103],
            [25, 97.8],
          ],
          false,
          3,
        ),
        0.8,
        0.8,
        C.darkBrown,
      );
    });
    for (const [x, y] of [
      [10, 97.5],
      [18, 92.5],
      [27, 89.8],
    ] as P[]) {
      r.ellipse(x, y, 1.15, 1.15, C.lightGray);
    }
    // scarf wrap around the neck
    const wrap = spline(
      [
        [34, 80],
        [44, 76.5],
        [56, 76.5],
        [65, 79.5],
        [66, 86],
        [58, 91],
        [44, 92],
        [34, 88],
      ],
      true,
      4,
    );
    cel(r, sc, wrap, C.red, C.darkRed, 2, -2);
    r.with({ self: true, only: C.red }, () => {
      r.stroke(
        spline(
          [
            [37, 83],
            [48, 87],
            [62, 83],
          ],
          false,
          3,
        ),
        0.9,
        0.9,
        C.darkRed,
      );
      r.stroke(
        spline(
          [
            [40, 80],
            [50, 82.5],
            [60, 80],
          ],
          false,
          3,
        ),
        0.8,
        0.8,
        C.pink,
      );
    });
    // scarf tail (wind-blown)
    const tail: P[] = [[60, 87], blow(dc, [67, 97], 0.4), blow(dc, [70, 108], 0.8), blow(dc, [69, 122], 1.2)];
    cel(r, sc, strand(tail, 11, { tipW: 8, pow: 1 }), C.red, C.darkRed, 2, -1);
  },

  front(dc) {
    const r = dc.L.front;
    const sc = dc.L.scratch;
    // spikes (behind the cap)
    const spikes: [P[], number][] = [
      [
        [
          [40, 18],
          [29, 9],
          [17, 5],
        ],
        12,
      ],
      [
        [
          [51, 15],
          [53, 7],
          [60, 1.5],
        ],
        10,
      ],
      [
        [
          [60, 17],
          [71, 9],
          [84, 8],
        ],
        12,
      ],
      [
        [
          [69, 24],
          [82, 21],
          [94, 28],
        ],
        11,
      ],
      [
        [
          [73, 34],
          [84, 40],
          [90, 51],
        ],
        9,
      ],
      [
        [
          [31, 22],
          [18, 19],
          [6, 25],
        ],
        11,
      ],
      [
        [
          [26, 32],
          [15, 38],
          [9, 49],
        ],
        9,
      ],
    ];
    for (const [pts, w] of spikes) lock(dc, r, pts, w, HAIR, HAIR_SH, { wind: 0.25, pow: 1.4 });
    // cap
    const cap = spline(
      [
        [22, 52],
        [20.5, 36],
        [26, 20],
        [38, 11],
        [53, 8.5],
        [68, 12],
        [77, 22],
        [80, 36],
        [78.5, 50],
        [74, 43],
        [70, 33],
        [58, 28],
        [44, 29],
        [32, 33],
        [26, 42],
        [25, 52],
      ],
      true,
      4,
    );
    cel(r, sc, cap, HAIR, HAIR_SH, -2.5, -2.5);
    // side locks
    lock(
      dc,
      r,
      [
        [25, 36],
        [22, 49],
        [24.5, 63],
      ],
      7.5,
      HAIR,
      HAIR_SH,
      { wind: 0.2 },
    );
    lock(
      dc,
      r,
      [
        [76, 36],
        [78.5, 48],
        [76.5, 60],
      ],
      6.5,
      HAIR,
      HAIR_SH,
      { wind: 0.2 },
    );
    // bangs
    const bangs: [P[], number][] = [
      [
        [
          [30, 26],
          [26.5, 37],
          [24.5, 48],
        ],
        9,
      ],
      [
        [
          [38.5, 25],
          [36.5, 35],
          [34.5, 45],
        ],
        9.5,
      ],
      [
        [
          [46, 25],
          [47, 38],
          [50.5, 55],
        ],
        8.5,
      ],
      [
        [
          [55, 25],
          [57.5, 35],
          [57, 46],
        ],
        8.5,
      ],
      [
        [
          [63, 25],
          [67, 36],
          [67.5, 48],
        ],
        9.5,
      ],
      [
        [
          [70.5, 28],
          [75.5, 37],
          [77.5, 46],
        ],
        7.5,
      ],
    ];
    for (const [pts, w] of bangs)
      lock(dc, r, pts, w, HAIR, HAIR_SH, { wind: 0.15, pow: 1.05, edge: C.black, edgeFrom: 0.45 });
    angelRing(r, 51, 30, 24, 17, Math.PI * 1.08, Math.PI * 1.9, HAIR_HI, {
      n: 8,
      len: 4,
      w: 2.6,
      color2: C.gray,
    });
  },

  featExtra(dc) {
    if (!flags.kaiMark) return;
    // faint glowing shard mark under his left eye
    const r = dc.L.feat;
    const E = dc.g.far;
    const x = E.x + 1;
    const y = E.y + 9.5;
    r.stroke([x - 0.6, y - 1.4, x, y + 2.4], 0.5, 0.5, C.cyan, 1);
    r.stroke([x + 1.4, y - 0.6, x + 1.8, y + 0.8], 0.5, 0.5, dither(C.skin, C.cyan, 0.5), 1);
  },
};
