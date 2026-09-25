/** Seraphine — the Frost Queen (variant 'knight' = her Order knight past). */
import { C } from '../pal';
import { angelRing, blow, cel, drawNeck, lock, torsoPts, type DrawCtx, type Spec } from '../face';
import { spline, starPts, type P } from '../geom';
import { shard } from './common';

const HAIR = C.ice1;
const HAIR_SH = C.ice2;
const HAIR_HI = C.ice0;

function iceShard(dc: DrawCtx, x: number, y0: number, y1: number, w: number, lean = 0): void {
  shard(dc.L.front, dc.L.scratch, x, y0, y1, w, C.ice0, C.ice2, lean);
}

export const seraphine: Spec = {
  id: 'seraphine',
  skin: C.paleSkin,
  skinShade: C.paleShade,
  skinLine: C.plum,
  mouthLine: C.skinLine,
  lash: C.navy,
  iris: [C.blue, C.sky, C.ice1],
  pupil: C.navy,
  sclera: C.white,
  scleraShade: C.ice1,
  brow: C.ice3,
  hairLine: C.darkSlate,
  clothLine: C.black,
  female: true,
  happyEyes: 'open',
  shape: { turn: 0.45, eyeW: 13.2, eyeH: 13.6, jaw: -1.8, chin: 0.8, cheek: -0.4 },
  lashW: 1.15,

  tweak(e, p) {
    if (e === 'neutral')
      return { ...p, near: { ...p.near, open: 0.8, tilt: 0.12 }, far: { ...p.far, open: 0.8, tilt: 0.12 } };
    if (e === 'happy') return { ...p, mouth: 'smile', talk: 'open', blush: 0.25 };
    return p;
  },

  back(dc) {
    const r = dc.L.back;
    const sc = dc.L.scratch;
    const knight = dc.variant === 'knight';
    if (!knight) {
      // ice collar fanning out behind the shoulders
      for (const [x, y0, y1, w, lean] of [
        [22, 58, 90, 5, -8],
        [30, 52, 86, 5, -4],
        [70, 52, 86, 5, 4],
        [78, 58, 90, 5, 8],
        [14, 70, 96, 4, -9],
        [86, 70, 96, 4, 9],
      ] as const) {
        shard(r, sc, x, y0, y1, w, C.ice1, C.ice3, lean);
      }
    }
    const mass: P[] = [
      [50, 10],
      [70, 14],
      [80, 28],
      [83, 50],
      blow(dc, [86, 76], 0.4),
      blow(dc, [88, 104], 0.8),
      blow(dc, [90, 126], 1.1),
      blow(dc, [10, 126], 1.1),
      blow(dc, [12, 104], 0.8),
      blow(dc, [14, 76], 0.4),
      [17, 50],
      [20, 28],
      [30, 14],
    ];
    cel(r, sc, spline(mass, true, 4), HAIR_SH, C.ice3, 2.5, 0);
  },

  body(dc) {
    const r = dc.L.body;
    const sc = dc.L.scratch;
    drawNeck(dc, 6);
    if (dc.variant === 'knight') {
      // Order knight: blue tabard, steel gorget and pauldrons
      cel(r, sc, torsoPts(dc, 0.92, 82), C.blue, C.navy, 3, -1);
      cel(
        r,
        sc,
        spline(
          [
            [38, 76],
            [62, 76],
            [64, 86],
            [50, 90],
            [36, 86],
          ],
          true,
          3,
        ),
        C.lightGray,
        C.gray,
        1.5,
        -1.5,
      );
      r.with({ self: true, only: C.lightGray }, () => r.stroke([39, 80, 61, 80], 0.8, 0.8, C.white));
      for (const side of [-1, 1]) {
        const pa = spline(
          [
            [50 + side * 16, 84],
            [50 + side * 30, 81],
            [50 + side * 44, 88],
            [50 + side * 47, 100],
            [50 + side * 40, 104],
            [50 + side * 30, 96],
            [50 + side * 18, 92],
          ],
          true,
          4,
        );
        cel(r, sc, pa, C.lightGray, C.gray, -side * 2, -2);
        r.with({ self: true }, () => {
          r.stroke(
            spline(
              [
                [50 + side * 20, 88],
                [50 + side * 32, 85],
                [50 + side * 42, 92],
              ],
              false,
              3,
            ),
            1,
            1,
            C.white,
          );
          r.stroke(
            spline(
              [
                [50 + side * 42, 102],
                [50 + side * 31, 95.5],
                [50 + side * 19, 91.5],
              ],
              false,
              3,
            ),
            0.9,
            0.9,
            C.gold,
          );
        });
      }
      cel(r, sc, starPts(50, 104, 5, 2.2, 5), C.gold, C.orange, -0.6, -0.6);
      return;
    }
    // Frost Queen gown with a V neckline
    cel(r, sc, torsoPts(dc, 0.9, 83), C.darkSlate, C.navy, 3, -1);
    r.poly(
      spline(
        [
          [40, 80],
          [60, 80],
          [55, 94],
          [50, 100],
          [45, 94],
        ],
        true,
        3,
      ),
      C.paleSkin,
    );
    r.with({ only: C.paleSkin }, () => r.poly([52, 80, 62, 80, 52, 101], C.paleShade));
    r.with({ self: true }, () => {
      r.stroke(
        spline(
          [
            [38.5, 80],
            [44, 93],
            [50, 101.5],
            [56, 93],
            [61.5, 80],
          ],
          false,
          3,
        ),
        1.2,
        1.2,
        C.ice2,
      );
      r.stroke(
        spline(
          [
            [12, 96],
            [22, 88],
            [34, 84],
          ],
          false,
          3,
        ),
        1,
        0.4,
        C.slate,
      );
    });
    // ice shoulder clusters
    for (const side of [-1, 1]) {
      const bx = 50 + side * 30;
      shard(r, sc, bx, 76, 94, 4.5, C.ice1, C.ice3, side * 4);
      shard(r, sc, bx + side * 7, 80, 97, 4, C.ice1, C.ice3, side * 6);
      shard(r, sc, bx - side * 6, 82, 95, 3.2, C.ice0, C.ice2, side * 2);
    }
    // pendant
    shard(r, sc, 50, 99, 108, 2.4, C.cyan, C.sky, 0);
  },

  front(dc) {
    const r = dc.L.front;
    const sc = dc.L.scratch;
    const knight = dc.variant === 'knight';
    const cap = spline(
      [
        [22, 55],
        [20.5, 38],
        [25, 21],
        [37, 11],
        [52, 8],
        [67, 11],
        [77, 21],
        [80.5, 38],
        [79, 55],
        [74.5, 43],
        [68, 31],
        [56, 25],
        [45, 26],
        [33, 31],
        [27, 42],
        [25.5, 55],
      ],
      true,
      4,
    );
    cel(r, sc, cap, HAIR, HAIR_SH, -2.5, -2.5);
    // long straight side locks
    lock(
      dc,
      r,
      [[24.5, 36], [21, 58], blow(dc, [20, 82], 0.3), blow(dc, [22, 104], 0.6), blow(dc, [20, 118], 0.9)],
      10.5,
      HAIR,
      HAIR_SH,
      { pow: 2.4, edgeFrom: 0.3 },
    );
    lock(
      dc,
      r,
      [[76.5, 36], [79.5, 58], blow(dc, [80, 82], 0.3), blow(dc, [78, 104], 0.6), blow(dc, [80, 116], 0.9)],
      9.5,
      HAIR,
      HAIR_SH,
      { pow: 2.4, edgeFrom: 0.3 },
    );
    lock(dc, r, [[28, 44], [26, 66], blow(dc, [27, 90], 0.5)], 5.5, HAIR, HAIR_SH, { pow: 1.4 });
    // long parted bangs sweeping aside
    const bangs: [P[], number][] = [
      [
        [
          [30, 26],
          [26, 38],
          [24.5, 54],
        ],
        9,
      ],
      [
        [
          [38, 24],
          [34.5, 36],
          [32, 50],
        ],
        9,
      ],
      [
        [
          [46, 23],
          [44, 34],
          [41.5, 44],
        ],
        8,
      ],
      [
        [
          [54, 23],
          [58, 32],
          [60.5, 42],
        ],
        8,
      ],
      [
        [
          [61, 24],
          [67, 33],
          [70, 46],
        ],
        9,
      ],
      [
        [
          [70, 27],
          [76, 38],
          [78, 54],
        ],
        8,
      ],
      [
        [
          [50, 24],
          [51, 40],
          [53, 54],
        ],
        4.5,
      ],
    ];
    for (const [pts, w] of bangs)
      lock(dc, r, pts, w, HAIR, HAIR_SH, { wind: 0.12, pow: 1.2, edge: C.ice3, edgeFrom: 0.5 });
    angelRing(r, 51, 29, 24, 16.5, Math.PI * 1.08, Math.PI * 1.9, HAIR_HI, {
      n: 8,
      len: 3.6,
      w: 2.4,
      color2: C.white,
    });
    if (knight) {
      // simple blue ribbon
      cel(
        r,
        sc,
        spline(
          [
            [24, 30],
            [29, 27],
            [30, 33],
            [25, 35],
          ],
          true,
          3,
        ),
        C.blue,
        C.navy,
        -0.6,
        -0.6,
      );
      return;
    }
    // crystalline ice tiara
    r.with({}, () => {
      const band = spline(
        [
          [26, 25],
          [38, 17.5],
          [51, 15.5],
          [64, 17.5],
          [76, 25],
        ],
        false,
        4,
      );
      r.stroke(band, 1.6, 1.6, C.lightGray);
      iceShard(dc, 51, 1.5, 19, 3.6, 0);
      iceShard(dc, 43, 6, 19, 2.8, -1.5);
      iceShard(dc, 59, 6, 19, 2.8, 1.5);
      iceShard(dc, 36, 11, 21.5, 2.2, -2.5);
      iceShard(dc, 66, 11, 21.5, 2.2, 2.5);
      r.ellipse(51, 17.5, 1.6, 1.6, C.cyan);
    });
  },
};
