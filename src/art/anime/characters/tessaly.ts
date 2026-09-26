/**
 * Tessaly — harbormistress of Solenne. Confident woman in her 40s: dark skin,
 * grey-streaked braid over one shoulder, tricorn hat, long blue sea-captain
 * coat with gold buttons, a scar across her left eyebrow.
 */
import { C } from '../pal';
import {
  angelRing,
  blow,
  cel,
  drawNeck,
  lock,
  outlinedMark,
  torsoPts,
  type DrawCtx,
  type Spec,
} from '../face';
import { ellipsePts, spline, strand, type P } from '../geom';

const HAIR = C.plum;
const HAIR_SH = C.black;
const HAIR_HI = C.darkBrown;
const GREY = C.gray;
const GREY_SH = C.slate;
const HAT = C.navy;
const HAT_SH = C.black;

/** Braid lobes along a path (root → tip); every `greyEvery`-th lobe is a grey streak. */
function braid(dc: DrawCtx, pts: readonly P[], w: number, greyAt: readonly number[]): void {
  const r = dc.L.front;
  const sc = dc.L.scratch;
  const path = spline(
    pts.map((p, i) => blow(dc, p, (i / (pts.length - 1)) * 0.4)),
    false,
    8,
  );
  const n = path.length / 2;
  // cumulative length → evenly spaced lobes
  const cum = [0];
  for (let i = 1; i < n; i++)
    cum.push(cum[i - 1] + Math.hypot(path[i * 2] - path[i * 2 - 2], path[i * 2 + 1] - path[i * 2 - 1]));
  const L = cum[n - 1];
  const step = w * 0.62;
  const count = Math.floor(L / step);
  let j = 0;
  for (let k = 0; k <= count; k++) {
    const d = k * step;
    while (j < n - 2 && cum[j + 1] < d) j++;
    const u = (d - cum[j]) / (cum[j + 1] - cum[j] || 1);
    const x = path[j * 2] + (path[j * 2 + 2] - path[j * 2]) * u;
    const y = path[j * 2 + 1] + (path[j * 2 + 3] - path[j * 2 + 1]) * u;
    const a = Math.atan2(path[j * 2 + 3] - path[j * 2 + 1], path[j * 2 + 2] - path[j * 2]);
    const side = k % 2 === 0 ? -1 : 1;
    const taper = 1 - (d / L) * 0.35;
    const ox = -Math.sin(a) * side * w * 0.2;
    const oy = Math.cos(a) * side * w * 0.2;
    const grey = greyAt.includes(k);
    const base = grey ? GREY : HAIR;
    const shade = grey ? GREY_SH : HAIR_SH;
    const rot = a + side * 0.55;
    cel(
      r,
      sc,
      ellipsePts(x + ox, y + oy, w * 0.52 * taper, w * 0.36 * taper, 16, rot),
      base,
      shade,
      -0.7,
      -0.7,
    );
    // lobe separation line on the lower edge
    const lo = ellipsePts(x + ox, y + oy, w * 0.52 * taper, w * 0.36 * taper, 10, rot, 0.2, Math.PI - 0.2);
    r.line(lo, grey ? C.darkSlate : C.black);
  }
}

export const tessaly: Spec = {
  id: 'tessaly',
  skin: C.umber,
  skinShade: C.umberShade,
  skinLine: C.plum,
  mouthLine: C.plum,
  lash: C.black,
  iris: [C.plum, C.darkBrown, C.orangeBrown],
  pupil: C.black,
  sclera: C.white,
  scleraShade: C.lightGray,
  brow: C.black,
  hairLine: C.black,
  clothLine: C.black,
  female: true,
  happyEyes: 'arc',
  shape: { turn: 0.45, eyeW: 12.6, eyeH: 10.4, jaw: 0.5, chin: 1.4, cheek: -0.9 },
  lashW: 1.05,
  irisScale: 0.9,

  tweak(e, p) {
    const q = { ...p, blush: 0 };
    switch (e) {
      case 'neutral':
        return {
          ...q,
          near: { ...q.near, open: 0.86, low: 0.2 },
          far: { ...q.far, open: 0.86, low: 0.2 },
          mouth: 'smile',
        };
      case 'determined':
        return { ...q, mouth: 'smirk', talk: 'smirkOpen' };
      default:
        return q;
    }
  },

  back(dc) {
    const r = dc.L.back;
    const sc = dc.L.scratch;
    // hair gathered at the nape
    cel(
      r,
      sc,
      spline(
        [
          [24, 40],
          [26, 22],
          [50, 12],
          [74, 22],
          [78, 42],
          [70, 62],
          [30, 64],
        ],
        true,
        4,
      ),
      HAIR,
      HAIR_SH,
      2,
      0,
    );
    // coat collar standing up behind the neck
    cel(
      r,
      sc,
      spline(
        [
          [33, 84],
          [34, 70],
          [42, 64],
          [58, 64],
          [66, 70],
          [67, 84],
        ],
        true,
        3,
      ),
      C.blue,
      C.navy,
      1.5,
      0,
    );
    r.with({ self: true }, () =>
      r.stroke(
        spline(
          [
            [34.5, 72],
            [42, 65.5],
            [58, 65.5],
            [65.5, 72],
          ],
          false,
          3,
        ),
        0.9,
        0.9,
        C.gold,
      ),
    );
  },

  body(dc) {
    const r = dc.L.body;
    const sc = dc.L.scratch;
    drawNeck(dc, 6.4);
    // long blue coat
    cel(r, sc, torsoPts(dc, 0.95, 82), C.blue, C.navy, 3, -1);
    // white shirt + cravat
    r.poly(
      spline(
        [
          [42, 79],
          [58, 79],
          [55.5, 92],
          [50, 99],
          [44.5, 92],
        ],
        true,
        3,
      ),
      C.white,
    );
    r.with({ only: C.white }, () => {
      r.poly([51, 78, 60, 78, 53, 100, 50, 100], C.lightGray);
      for (const y of [85, 89.5, 94]) r.stroke([46.5, y, 50, y + 1.4, 53.5, y], 0.5, 0.5, C.gray, 1);
    });
    // lapels with gold piping
    for (const side of [-1, 1]) {
      const k = (x: number): number => 50 + side * x;
      const lap = spline(
        [
          [k(8), 79],
          [k(17), 82],
          [k(20), 92],
          [k(15), 104],
          [k(9), 112],
          [k(5), 98],
        ],
        true,
        3,
      );
      cel(r, sc, lap, C.navy, C.black, -side * 1.2, -1);
      r.with({ self: true }, () =>
        r.stroke(
          spline(
            [
              [k(8.5), 79.5],
              [k(5.6), 98],
              [k(9), 111],
            ],
            false,
            3,
          ),
          0.9,
          0.9,
          C.gold,
        ),
      );
    }
    // shoulder seams / fold highlight
    r.with({ self: true, only: C.blue }, () =>
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
        C.sky,
      ),
    );
    // double row of gold buttons
    for (const side of [-1, 1]) {
      for (const y of [106, 114, 122]) {
        const x = 50 + side * (12 + (y - 106) * 0.05);
        r.ellipse(x, y, 1.9, 1.9, C.darkBrown);
        r.ellipse(x - 0.2, y - 0.2, 1.4, 1.4, C.gold);
        r.px(r.X(x - 0.6, y - 0.6), r.Y(x - 0.6, y - 0.6), C.yellow);
      }
    }
  },

  headExtra(dc) {
    const r = dc.L.head;
    const g = dc.g;
    r.with({ only: C.umber }, () => {
      // warm highlight on the nose bridge
      r.stroke([g.noseX - 0.6, g.noseY - 7, g.noseX - 0.3, g.noseY - 2.5], 0.6, 0.5, C.brown, 1);
      // smile lines
      r.stroke(
        spline(
          [
            [g.noseX - 4, g.noseY + 2],
            [g.mouthX - 4.8, g.mouthY - 0.8],
            [g.mouthX - 4.2, g.mouthY + 1.6],
          ],
          false,
          3,
        ),
        0.5,
        0.5,
        C.umberShade,
        1,
      );
    });
  },

  front(dc) {
    const r = dc.L.front;
    const sc = dc.L.scratch;
    // hair swept back under the hat, exposing the forehead
    lock(
      dc,
      r,
      [
        [31, 24],
        [25.5, 34],
        [24, 46],
        [25.5, 55],
      ],
      9,
      HAIR,
      HAIR_SH,
      { pow: 1.6, wind: 0.1 },
    );
    lock(
      dc,
      r,
      [
        [70, 24],
        [76, 34],
        [77.5, 46],
      ],
      7,
      HAIR,
      HAIR_SH,
      { pow: 1.4, wind: 0.1 },
    );
    // grey streak at the near temple
    lock(
      dc,
      r,
      [
        [33, 25],
        [28, 33],
        [26.5, 42],
        [27.5, 50],
      ],
      3.8,
      GREY,
      GREY_SH,
      { pow: 1.2, wind: 0.1, edge: -1 },
    );
    // a few loose strands at the far temple
    lock(
      dc,
      r,
      [
        [66, 25],
        [71, 34],
        [72, 44],
        [70.5, 52],
      ],
      2.6,
      HAIR,
      HAIR_SH,
      { pow: 1, wind: 0.3, edge: -1 },
    );
    angelRing(r, 50, 30, 25, 14, Math.PI * 0.95, Math.PI * 1.25, HAIR_HI, { n: 4, len: 2.2, w: 1.6 });
    // braid over the near shoulder
    braid(
      dc,
      [
        [24, 54],
        [19.5, 70],
        [19, 86],
        [22, 102],
        [23.5, 114],
      ],
      8.4,
      [1, 4, 5, 8, 11],
    );
    // tie + tuft
    cel(
      r,
      sc,
      ellipsePts(blow(dc, [23.5, 116], 0.4)[0], blow(dc, [23.5, 116], 0.4)[1], 3, 1.6, 12),
      C.gold,
      C.orange,
      -0.5,
      -0.5,
    );
    lock(
      dc,
      r,
      [blow(dc, [23.5, 117], 0.4), blow(dc, [22.5, 122], 0.5), blow(dc, [24, 128], 0.6)],
      5.5,
      HAIR,
      HAIR_SH,
      {
        pow: 0.8,
        wind: 0,
      },
    );

    // tricorn hat: crown peeking over the upturned brim
    cel(
      r,
      sc,
      spline(
        [
          [31, 24],
          [32, 9],
          [41, 2.5],
          [53, 1],
          [64, 3.5],
          [72, 10],
          [73, 24],
        ],
        true,
        4,
      ),
      HAT,
      HAT_SH,
      -1.8,
      -1.2,
    );
    r.with({ self: true, only: HAT }, () =>
      r.stroke(
        spline(
          [
            [36, 10],
            [43, 5],
            [53, 3.6],
          ],
          false,
          3,
        ),
        1,
        0.5,
        C.darkSlate,
      ),
    );
    // upturned brim: high side corners, front corner dipping toward the viewer
    const brimTop: P[] = [
      [5, 1],
      [17, 10],
      [33, 18],
      [47, 23],
      [57, 25.5],
      [69, 19],
      [83, 9],
      [95, -1],
    ];
    const brim = spline(
      [...brimTop, [94, 7], [85, 19], [71, 29], [59, 35], [47, 32], [31, 27], [16, 20], [7, 10]],
      true,
      4,
    );
    cel(r, sc, brim, HAT, HAT_SH, 1.4, 1.6);
    r.with({ self: true }, () => {
      r.stroke(spline(brimTop, false, 4), 1.3, 1.3, C.gold);
      // crease where the brim folds up at the front corner
      r.stroke(
        spline(
          [
            [57, 26.5],
            [58, 30],
            [59, 34],
          ],
          false,
          2,
        ),
        0.6,
        0.6,
        HAT_SH,
        1,
      );
    });
    // gold anchor cockade on the near side of the brim
    const ax = 22;
    const ay = 16;
    r.ellipse(ax, ay, 3.4, 3.4, C.darkBrown);
    r.ellipse(ax, ay, 2.8, 2.8, C.gold);
    r.with({ self: true }, () => {
      r.stroke([ax, ay - 2, ax, ay + 2], 0.6, 0.6, C.darkBrown, 1);
      r.stroke([ax - 1.6, ay + 0.8, ax, ay + 2, ax + 1.6, ay + 0.8], 0.6, 0.6, C.darkBrown, 1);
      r.stroke([ax - 1.1, ay - 1, ax + 1.1, ay - 1], 0.5, 0.5, C.darkBrown, 1);
    });
    // white plume sweeping back from the cockade
    lock(dc, r, [[20, 13], blow(dc, [12, 5], 0.5), blow(dc, [3, 3], 1)], 5.5, C.white, C.lightGray, {
      pow: 0.9,
      wind: 0.6,
      tipW: 1.2,
      edge: C.lightGray,
    });
  },

  over(dc) {
    // old scar across the near eyebrow (cuts through the brow)
    const E = dc.g.near;
    const x = E.x - E.w * 0.08;
    const y = E.y - E.h * 0.86;
    outlinedMark(dc, C.umberShade, (m) => {
      m.poly(
        strand(
          [
            [x + 2.4, y - 5.6],
            [x + 0.6, y - 0.8],
            [x - 1.4, y + 3.6],
          ],
          1.9,
          { pow: 0.9, tipW: 0.7 },
        ),
        C.tan,
      );
    });
  },
};
