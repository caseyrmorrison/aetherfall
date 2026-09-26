/**
 * Aurelian — Grandmaster of the Order of Stars. Late 40s, serene and handsome:
 * long straight platinum hair, pale gold eyes, white-and-gold high-collared
 * armor robes with a black-sun emblem, a faint black-sun halo behind his head.
 */
import { C } from '../pal';
import { angelRing, blow, cel, drawNeck, lock, torsoPts, type Spec } from '../face';
import { spline, type P } from '../geom';
import { blackSun } from './common';

const HAIR = C.plat1;
const HAIR_SH = C.plat2;
const HAIR_HI = C.plat0;

export const aurelian: Spec = {
  id: 'aurelian',
  skin: C.paleSkin,
  skinShade: C.paleShade,
  skinLine: C.plum,
  mouthLine: C.skinLine,
  lash: C.plum,
  iris: [C.orangeBrown, C.gold, C.yellow],
  pupil: C.darkBrown,
  sclera: C.white,
  scleraShade: C.lightGray,
  brow: C.darkBrown,
  hairLine: C.plum,
  clothLine: C.plum,
  female: false,
  happyEyes: 'arc',
  shape: { turn: 0.42, eyeW: 12.4, eyeH: 8.8, jaw: 1.2, chin: 3.4, cheek: -2 },
  irisScale: 0.84,
  lashW: 1.15,

  tweak(e, p) {
    // serene, heavy-lidded calm; he rarely loses composure
    const calm = { ...p.near, open: Math.min(p.near.open, 0.74), low: Math.max(p.near.low, 0.2), tilt: 0.06 };
    switch (e) {
      case 'neutral':
        return {
          ...p,
          near: calm,
          far: { ...calm },
          browNear: { inner: 0.15, mid: -0.1, outer: 0.1 },
          browFar: { inner: 0.15, mid: -0.1, outer: 0.1 },
          lookX: 0.08,
        };
      case 'happy':
        return { ...p, mouth: 'smile', talk: 'open', blush: 0 };
      case 'sad':
        return { ...p, tears: false, blush: 0, mouth: 'line' };
      case 'angry':
        return { ...p, mouth: 'set', talk: 'teeth' };
      case 'surprised':
        return { ...p, sweat: false, mouth: 'line', talk: 'o' };
      case 'hurt':
        return { ...p, blush: 0 };
      case 'shout':
        return { ...p, sweat: false };
      default:
        return p;
    }
  },

  back(dc) {
    const r = dc.L.back;
    const sc = dc.L.scratch;
    // faint black-sun halo behind the head (scenes with a real eclipse use variant 'nohalo')
    if (dc.variant !== 'nohalo') {
      blackSun(r, 51, 32, 33, {
        rays: 14,
        long: 9,
        short: 4.5,
        ringW: 2,
        ring: C.orange,
        ray: C.rust,
        rayShade: C.darkRed,
        disc: C.black,
      });
      r.with({ self: true }, () => {
        r.ellipse(51, 32, 32.2, 32.2, C.gold);
        r.ellipse(51, 32, 31, 31, C.black);
        r.ellipse(51, 32, 29.5, 29.5, C.void0);
        r.ellipse(52.5, 30.5, 28.5, 28.5, C.black);
      });
    }
    // white mantle behind the shoulders, gold lining
    cel(
      r,
      sc,
      spline(
        [
          [18, 86],
          [82, 86],
          blow(dc, [100, 104], 0.3),
          blow(dc, [104, 126], 0.6),
          blow(dc, [-4, 126], 0.6),
          blow(dc, [0, 104], 0.3),
        ],
        true,
        4,
      ),
      C.gold,
      C.orange,
      3,
      -2,
    );
    // long straight back hair
    const mass: P[] = [
      [50, 10],
      [70, 14],
      [80, 28],
      [83, 50],
      blow(dc, [85, 80], 0.4),
      blow(dc, [86, 108], 0.8),
      blow(dc, [84, 124], 1),
      blow(dc, [16, 124], 1),
      blow(dc, [14, 108], 0.8),
      blow(dc, [15, 80], 0.4),
      [17, 50],
      [20, 28],
      [30, 14],
    ];
    cel(r, sc, spline(mass, true, 4), HAIR_SH, C.plat3, 2.5, 0);
  },

  body(dc) {
    const r = dc.L.body;
    const sc = dc.L.scratch;
    drawNeck(dc, 6.6);
    // white robe
    cel(r, sc, torsoPts(dc, 1, 82), C.white, C.lightGray, 3, -1);
    // dark undercoat showing at the collar opening
    r.poly(
      spline(
        [
          [41, 78],
          [59, 78],
          [56, 92],
          [50, 99],
          [44, 92],
        ],
        true,
        3,
      ),
      C.navy,
    );
    r.with({ only: C.navy }, () => r.poly([51, 78, 60, 78, 52, 100], C.black));
    // gold-edged front panels
    r.with({ self: true }, () => {
      r.stroke(
        spline(
          [
            [40, 79],
            [44, 92],
            [50, 100],
            [56, 92],
            [60, 79],
          ],
          false,
          3,
        ),
        1.3,
        1.3,
        C.gold,
      );
      r.stroke([44.5, 112, 43, 124], 1.1, 1.1, C.gold);
      r.stroke([55.5, 112, 57, 124], 1.1, 1.1, C.gold);
      // filigree curling out from the collar opening
      for (const side of [-1, 1]) {
        const k = (x: number): number => 50 + side * x;
        r.stroke(
          spline(
            [
              [k(8), 99],
              [k(16), 101],
              [k(22), 97],
              [k(20), 93],
            ],
            false,
            3,
          ),
          0.7,
          0.7,
          C.gold,
          1,
        );
      }
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
        C.lightGray,
      );
    });
    // layered pauldrons, gold edged
    for (const side of [-1, 1]) {
      const k = (x: number): number => 50 + side * x;
      for (const [dy, s] of [
        [7, 0.92],
        [0, 1],
      ] as const) {
        const pa = spline(
          [
            [k(16 * s), 84 + dy],
            [k(30 * s), 81 + dy],
            [k(44 * s), 88 + dy],
            [k(48 * s), 100 + dy],
            [k(41 * s), 104 + dy],
            [k(30 * s), 96 + dy],
            [k(18 * s), 92 + dy],
          ],
          true,
          4,
        );
        cel(r, sc, pa, C.white, C.lightGray, -side * 2, -2);
        r.with({ self: true }, () =>
          r.stroke(
            spline(
              [
                [k(43 * s), 102.5 + dy],
                [k(31 * s), 95.5 + dy],
                [k(19 * s), 91.5 + dy],
              ],
              false,
              3,
            ),
            1,
            1,
            C.gold,
          ),
        );
      }
      r.ellipse(k(30), 88, 1.3, 1.3, C.gold);
    }
    // high standing collar rising behind the jaw
    for (const side of [-1, 1]) {
      const k = (x: number): number => 50 + side * x;
      const plate = spline(
        [
          [k(13), 92],
          [k(18), 74],
          [k(25), 59],
          [k(28), 64],
          [k(31), 76],
          [k(40), 88],
          [k(36), 95],
        ],
        true,
        4,
      );
      cel(r, sc, plate, C.white, C.lightGray, -side * 2, -1);
      r.with({ self: true }, () => {
        r.poly(
          spline(
            [
              [k(15.5), 91],
              [k(19.5), 74],
              [k(25), 62],
              [k(24), 74],
              [k(20), 90],
            ],
            true,
            3,
          ),
          side < 0 ? C.darkSlate : C.navy,
        );
        r.stroke(
          spline(
            [
              [k(14.5), 91],
              [k(18.5), 74],
              [k(25.5), 60],
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
    // black-sun emblem on the chest
    blackSun(r, 50, 107, 5.6, { rays: 8, long: 4.2, short: 2.2, ringW: 1.1 });
    r.ellipse(48.8, 105.8, 0.9, 0.9, C.darkSlate);
  },

  headExtra(dc) {
    const r = dc.L.head;
    const g = dc.g;
    r.with({ only: C.paleSkin }, () => {
      // a faint line of age beside the mouth
      r.stroke([g.noseX - 3.6, g.noseY + 2.2, g.mouthX - 4.6, g.mouthY - 0.6], 0.45, 0.45, C.paleShade, 1);
      // crow's feet at the outer corners of the eyes
      const n = g.near;
      const f = g.far;
      r.stroke([n.x - n.w * 0.62, g.eyeY + 1.6, n.x - n.w * 0.8, g.eyeY + 2.8], 0.4, 0.4, C.paleShade, 1);
      r.stroke([f.x + f.w * 0.6, g.eyeY + 1.8, f.x + f.w * 0.76, g.eyeY + 2.8], 0.4, 0.4, C.paleShade, 1);
    });
  },

  front(dc) {
    const r = dc.L.front;
    const sc = dc.L.scratch;
    // swept-back crown with a center part (forehead visible)
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
        [74.5, 44],
        [71, 32],
        [63, 24],
        [53, 20.5],
        [41, 23],
        [32, 30],
        [27, 42],
        [25.5, 55],
      ],
      true,
      4,
    );
    cel(r, sc, cap, HAIR, HAIR_SH, -2.5, -2.5);
    r.with({ self: true, only: HAIR }, () => {
      for (const [a, b, c] of [
        [
          [51, 20],
          [42, 14],
          [30, 18],
        ],
        [
          [53, 20],
          [62, 14],
          [72, 19],
        ],
      ] as P[][]) {
        r.stroke(spline([a, b, c], false, 3), 0.6, 0.4, HAIR_SH, 1);
      }
    });
    // a single long lock falling in front of the near shoulder
    lock(
      dc,
      r,
      [[27, 48], [24.5, 70], blow(dc, [25.5, 94], 0.5), blow(dc, [23.5, 118], 0.8)],
      5,
      HAIR,
      HAIR_SH,
      {
        pow: 1.3,
        edge: C.plat2,
        edgeFrom: 0.3,
      },
    );
    // curtain locks from the part, framing the face
    lock(
      dc,
      r,
      [
        [50, 20],
        [40, 24],
        [32, 33],
        [28, 46],
        [27.5, 60],
      ],
      8,
      HAIR,
      HAIR_SH,
      { wind: 0.15, pow: 1.4, edge: C.plat2, edgeFrom: 0.5 },
    );
    lock(
      dc,
      r,
      [
        [53, 20],
        [62, 24],
        [70, 32],
        [73, 46],
        [74, 58],
      ],
      7.5,
      HAIR,
      HAIR_SH,
      { wind: 0.15, pow: 1.4, edge: C.plat2, edgeFrom: 0.5 },
    );
    // loose strands falling over the forehead
    lock(
      dc,
      r,
      [
        [50, 21],
        [45.5, 28],
        [44, 38],
        [45.5, 48],
      ],
      2.6,
      HAIR,
      HAIR_SH,
      { wind: 0.25, pow: 1, edge: -1 },
    );
    lock(
      dc,
      r,
      [
        [54, 21],
        [58, 29],
        [59, 38],
      ],
      1.8,
      HAIR,
      HAIR_SH,
      { wind: 0.25, pow: 1, edge: -1 },
    );
    angelRing(r, 51, 25, 25, 15, Math.PI * 1.08, Math.PI * 1.9, HAIR_HI, {
      n: 8,
      len: 3,
      w: 2.2,
      color2: C.white,
    });
  },
};
