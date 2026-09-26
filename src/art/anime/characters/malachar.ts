/** Malachar — the Hollow King. Long black hair, pale grey skin, red eyes, horned crown, armored collar, cape. */
import { C } from '../pal';
import { angelRing, blow, cel, drawNeck, lock, torsoPts, type Spec } from '../face';
import { spline, strand, type P } from '../geom';

const HAIR = C.navy;
const HAIR_SH = C.black;
const HAIR_HI = C.darkSlate;

export const malachar: Spec = {
  id: 'malachar',
  skin: C.lightGray,
  skinShade: C.gray,
  skinLine: C.darkSlate,
  mouthLine: C.darkSlate,
  lash: C.black,
  iris: [C.darkRed, C.red, C.hotPink],
  pupil: C.black,
  sclera: C.navy,
  scleraShade: C.black,
  brow: C.black,
  hairLine: C.black,
  clothLine: C.black,
  female: false,
  happyEyes: 'open',
  slit: true,
  shape: { turn: 0.45, eyeW: 13.4, eyeH: 9.8, jaw: 0.2, chin: 2.4, cheek: -1.2 },
  irisScale: 0.88,
  lashW: 1.25,

  tweak(e, p) {
    const menace = { ...p.near, open: Math.min(p.near.open, 0.82), tilt: Math.max(p.near.tilt, 0.25) };
    switch (e) {
      case 'neutral':
        return {
          ...p,
          near: menace,
          far: { ...menace },
          browNear: { inner: 0.4, mid: 0, outer: -0.2 },
          browFar: { inner: 0.4, mid: 0, outer: -0.2 },
        };
      case 'happy':
        return {
          ...p,
          near: { ...menace, low: 0.35 },
          far: { ...menace, low: 0.35 },
          mouth: 'cruel',
          talk: 'cruel',
          blush: 0,
        };
      case 'sad':
        return { ...p, tears: false, blush: 0 };
      case 'surprised':
        return { ...p, sweat: false };
      case 'shout':
        return { ...p, sweat: false };
      case 'hurt':
        return { ...p, blush: 0 };
      default:
        return p;
    }
  },

  back(dc) {
    const r = dc.L.back;
    const sc = dc.L.scratch;
    // cape (red lining visible at the sides)
    cel(
      r,
      sc,
      spline(
        [
          [20, 84],
          [80, 84],
          blow(dc, [100, 100], 0.4),
          blow(dc, [104, 126], 0.8),
          blow(dc, [-4, 126], 0.8),
          blow(dc, [0, 100], 0.4),
        ],
        true,
        4,
      ),
      C.darkRed,
      C.plum,
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
      blow(dc, [86, 110], 0.8),
      blow(dc, [84, 126], 1),
      blow(dc, [16, 126], 1),
      blow(dc, [14, 110], 0.8),
      blow(dc, [15, 80], 0.4),
      [17, 50],
      [20, 28],
      [30, 14],
    ];
    cel(r, sc, spline(mass, true, 4), HAIR, HAIR_SH, 2.5, 0);
  },

  body(dc) {
    const r = dc.L.body;
    const sc = dc.L.scratch;
    drawNeck(dc, 6.8);
    // dark armor
    cel(r, sc, torsoPts(dc, 0.98, 82), C.darkSlate, C.navy, 3, -1);
    r.with({ self: true, only: C.darkSlate }, () => {
      r.stroke(
        spline(
          [
            [30, 100],
            [50, 106],
            [70, 100],
          ],
          false,
          3,
        ),
        1,
        1,
        C.black,
      );
      r.stroke(
        spline(
          [
            [12, 94],
            [22, 88],
            [32, 86],
          ],
          false,
          3,
        ),
        1,
        0.4,
        C.slate,
      );
    });
    // gorget
    cel(
      r,
      sc,
      spline(
        [
          [38, 76],
          [62, 76],
          [65, 88],
          [50, 93],
          [35, 88],
        ],
        true,
        3,
      ),
      C.darkSlate,
      C.black,
      1.5,
      -1.5,
    );
    r.with({ self: true }, () =>
      r.stroke(
        spline(
          [
            [36, 87],
            [50, 92],
            [64, 87],
          ],
          false,
          3,
        ),
        0.9,
        0.9,
        C.darkRed,
      ),
    );
    // high armored collar plates rising behind the jaw
    for (const side of [-1, 1]) {
      const k = (x: number): number => 50 + side * x;
      const plate = spline(
        [
          [k(14), 92],
          [k(20), 70],
          [k(28), 54],
          [k(29), 66],
          [k(34), 78],
          [k(44), 88],
          [k(40), 96],
        ],
        true,
        4,
      );
      cel(r, sc, plate, C.darkSlate, C.black, -side * 2, -1);
      r.with({ self: true }, () =>
        r.stroke(
          spline(
            [
              [k(18), 90],
              [k(22), 72],
              [k(28), 57],
            ],
            false,
            3,
          ),
          0.9,
          0.9,
          C.darkRed,
        ),
      );
      // pauldron spike
      cel(
        r,
        sc,
        spline(
          [
            [k(30), 90],
            [k(42), 84],
            [k(48), 88],
            [k(47), 96],
            [k(36), 100],
          ],
          true,
          3,
        ),
        C.darkSlate,
        C.black,
        -side * 1.5,
        -1.5,
      );
      r.poly(
        strand(
          [
            [k(42), 86],
            [k(47), 79],
            [k(50), 74],
          ],
          3.5,
          {},
        ),
        C.black,
      );
    }
    // void gem brooch
    cel(r, sc, [50, 95, 53, 99, 50, 103, 47, 99], C.magenta, C.purple, -0.5, -0.5);
  },

  front(dc) {
    const r = dc.L.front;
    const sc = dc.L.scratch;
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
        [74, 42],
        [66, 29],
        [55, 24],
        [47, 24],
        [35, 30],
        [27, 42],
        [25.5, 55],
      ],
      true,
      4,
    );
    cel(r, sc, cap, HAIR, HAIR_SH, -2.5, -2.5);
    // long straight locks framing the face
    lock(
      dc,
      r,
      [[24.5, 34], [21.5, 60], blow(dc, [21, 86], 0.3), blow(dc, [22, 110], 0.6), blow(dc, [21, 124], 0.9)],
      11,
      HAIR,
      HAIR_SH,
      { pow: 3, edge: C.darkSlate, edgeFrom: 0.2 },
    );
    lock(
      dc,
      r,
      [[76.5, 34], [79.5, 60], blow(dc, [80, 86], 0.3), blow(dc, [79, 110], 0.6), blow(dc, [80, 124], 0.9)],
      10,
      HAIR,
      HAIR_SH,
      { pow: 3, edge: C.darkSlate, edgeFrom: 0.2 },
    );
    // center-parted curtain bangs
    const bangs: [P[], number][] = [
      [
        [
          [47, 22],
          [38, 30],
          [30, 42],
          [27, 56],
        ],
        10,
      ],
      [
        [
          [44, 24],
          [38, 34],
          [34, 48],
        ],
        6,
      ],
      [
        [
          [55, 22],
          [64, 30],
          [71, 42],
          [74, 56],
        ],
        10,
      ],
      [
        [
          [58, 24],
          [64, 34],
          [67.5, 46],
        ],
        6,
      ],
      [
        [
          [51, 23],
          [49.5, 36],
          [51, 52],
        ],
        3.2,
      ],
    ];
    for (const [pts, w] of bangs)
      lock(dc, r, pts, w, HAIR, HAIR_SH, { wind: 0.15, pow: 1.5, edge: C.darkSlate, edgeFrom: 0.4 });
    angelRing(r, 51, 28, 24, 16, Math.PI * 1.08, Math.PI * 1.9, HAIR_HI, {
      n: 8,
      len: 3.4,
      w: 2.2,
      color2: C.purple,
    });

    // horned crown
    const band = spline(
      [
        [25.5, 25],
        [37, 17],
        [51, 14.5],
        [65, 17],
        [77, 25],
        [76, 29],
        [65, 22],
        [51, 20],
        [37, 22],
        [26.5, 29],
      ],
      true,
      4,
    );
    cel(r, sc, band, C.darkSlate, C.black, -1, -1.5);
    r.with({ self: true }, () =>
      r.stroke(
        spline(
          [
            [27, 25],
            [37, 18.5],
            [51, 16],
            [65, 18.5],
            [75, 25],
          ],
          false,
          3,
        ),
        0.8,
        0.8,
        C.slate,
      ),
    );
    // spikes on the band
    for (const [x, h] of [
      [38, 6],
      [44, 8],
      [58, 8],
      [64, 6],
    ] as P[]) {
      r.poly(
        strand(
          [
            [x, 19],
            [x, 19 - h * 0.6],
            [x + (x < 51 ? -0.8 : 0.8), 19 - h],
          ],
          3.4,
          { pow: 1 },
        ),
        C.black,
      );
    }
    // horns
    for (const side of [-1, 1]) {
      const k = (x: number): number => 51 + side * x;
      const horn = strand(
        [
          [k(22), 24],
          [k(30), 16],
          [k(34), 7],
          [k(40), 1],
        ],
        7,
        { pow: 1 },
      );
      cel(r, sc, horn, C.darkSlate, C.black, -side * 1.2, -1);
      r.with({ self: true }, () =>
        r.stroke(
          spline(
            [
              [k(24), 21],
              [k(31), 13],
              [k(35), 6],
            ],
            false,
            3,
          ),
          0.7,
          0.3,
          C.slate,
        ),
      );
    }
    // void gem
    cel(r, sc, [51, 13.5, 55, 18.5, 51, 24, 47, 18.5], C.magenta, C.purple, -0.8, -0.8);
    r.with({ self: true }, () => {
      r.poly([51, 16, 53, 18.5, 51, 21.5, 49, 18.5], C.void0);
      r.ellipse(49.8, 16.8, 0.8, 0.8, C.pink);
    });
  },
};
