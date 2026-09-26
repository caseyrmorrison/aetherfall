/**
 * Autotiled liquid tiles. The body texture is periodic in 16px (seamless between
 * cells) and animates in a 4-frame loop. Shores are drawn inside the liquid cell
 * on every side whose neighbour is not liquid, using a rounded-rect distance
 * field so outer corners curve naturally. The north shore shows the bank's
 * vertical face (3/4 view); south/east/west shores show a lip + foam line.
 */
import { PAL } from '../../palette';
import type { Theme } from '../types';
import { Grid, bayer, fbm16, rnd, type Col } from './raster';

const T = 16;
const N = 1;
const E = 2;
const S = 4;
const W = 8;

interface LiquidStyle {
  body: (x: number, y: number, f: number) => Col;
  /** bank top strip, north bank face (light/dark), lip right next to the liquid */
  top: Col;
  topDark: Col;
  face: Col;
  faceDark: Col;
  rim: Col;
  /** foam / edge line, secondary foam, and the band right under the north face */
  foam: Col;
  foam2: Col;
  under: Col;
  insN: number;
  insS: number;
  insWE: number;
  pebble?: Col;
  /** height of the north face in px */
  faceH?: number;
  /** vertical striations on the north face */
  striate?: boolean;
  /** extra decoration close to the shore (d = distance from the shoreline in px) */
  nearShore?: (x: number, y: number, f: number, d: number) => Col | undefined;
}

// --------------------------------------------------------------- bodies ----

/** Positions that repeat every tile — computed once per body. */
function marks(seed: number, n: number, salt: number): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (let k = 0; k < n; k++)
    out.push([
      Math.floor(rnd(k, salt, seed) * T),
      Math.floor(rnd(k, salt + 1, seed) * T),
      rnd(k, salt + 2, seed),
    ]);
  return out;
}

function waterBody(deep: Col, mid: Col, hi: Col, spark: Col, seed: number) {
  const waves = marks(seed, 2, 10);
  const glints = marks(seed, 4, 20);
  return (x: number, y: number, f: number): Col => {
    let c: Col = deep;
    // soft static swells: "⌒" arcs in the mid tone that sway 1px every other frame
    for (const [mx, my, r] of waves) {
      const len = 4 + Math.floor(r * 3);
      const sway = (f >> 1) & 1;
      const dx = (x - mx - sway + T * 2) % T;
      const dy = (y - my + T) % T;
      if (dy === 0 && dx >= 1 && dx < len - 1) c = mid;
      if (dy === 1 && (dx === 0 || dx === len - 1)) c = mid;
    }
    // glints with a 4-frame life: grow, hold, shrink, gone
    glints.forEach(([gx, gy], k) => {
      const ph = (f + k) % 4;
      const len = [1, 3, 2, 0][ph];
      if (len === 0) return;
      const dx = (x - gx - ph + T * 2) % T;
      const dy = (y - gy + T) % T;
      if (dy === 0 && dx < len) c = len === 3 && dx === 1 ? spark : hi;
    });
    return c;
  };
}

function lavaBody(seed: number) {
  const bubbles = marks(seed, 2, 30);
  const hot = marks(seed, 3, 80);
  const flow = marks(seed, 3, 100);
  const wrapD = (a: number, b: number) => {
    const d = Math.abs(a - b) % T;
    return Math.min(d, T - d);
  };
  return (x: number, y: number, f: number): Col => {
    const n = fbm16(x, y, seed);
    let c: Col = PAL.orange;
    if (n < 0.36 || (n < 0.42 && bayer(x, y) > 0.5)) c = '#e05a2a';
    if (n > 0.66 || (n > 0.62 && bayer(x, y) > 0.6)) c = '#fb9a2c';
    // darker cooling swirls (ridges of a second noise field)
    const r2 = Math.abs(fbm16(x + 3, y + 7, seed + 11) - 0.5);
    if (r2 < 0.035) c = PAL.rust;
    else if (r2 < 0.07 && bayer(x, y) > 0.5) c = '#e05a2a';
    // hot spots that breathe over the 4-frame loop
    hot.forEach(([hx, hy, r], k) => {
      const ph = Math.sin(Math.PI * 2 * (f / 4 + k / 3));
      const rad = 1.4 + r * 0.8 + ph * 0.45;
      const d = Math.hypot(wrapD(x + 0.5, hx + 0.5), wrapD(y + 0.5, hy + 0.5) * 1.5);
      if (d < rad) c = d < rad - 1 ? PAL.yellow : PAL.gold;
    });
    // flow streaks sliding right
    flow.forEach(([fx, fy], k) => {
      const ph = (f + k) % 4;
      const len = [2, 3, 2, 0][ph];
      if (!len) return;
      const dx = (x - fx - ph + T * 2) % T;
      if ((y - fy + T) % T === 0 && dx < len) c = dx === 1 ? PAL.yellow : PAL.gold;
    });
    bubbles.forEach(([bx, by], k) => {
      const ph = (f + k * 2) % 4;
      const dx = x - (2 + (bx % 12));
      const dy = y - (2 + (by % 12));
      if (ph === 1 && dx === 0 && dy === 0) c = PAL.yellow;
      if (ph === 2 && Math.abs(dx) + Math.abs(dy) === 1) c = PAL.yellow;
      if (ph === 2 && dx === 0 && dy === 0) c = PAL.darkRed;
      if (ph === 3 && Math.abs(dx) === 1 && Math.abs(dy) === 1) c = PAL.gold;
    });
    return c;
  };
}

function voidBody(seed: number, haze: Col, haze2: Col) {
  const stars = marks(seed, 1, 40);
  const motes = marks(seed, 1, 50);
  return (x: number, y: number, f: number): Col => {
    const n = fbm16(x, y, seed);
    let c: Col = PAL.black;
    if (n > 0.6 || (n > 0.56 && bayer(x, y) > 0.5)) c = haze;
    if (n > 0.68 || (n > 0.65 && bayer(x, y) > 0.5)) c = haze2;
    // twinkling stars
    stars.forEach(([sx, sy], k) => {
      const ph = (f + k * 2) % 4;
      if (x === sx && y === sy) c = ph === 0 ? PAL.darkSlate : ph === 2 ? PAL.white : PAL.lightGray;
      if (ph === 2 && Math.abs(x - sx) + Math.abs(y - sy) === 1) c = PAL.slate;
    });
    // a drifting mote
    motes.forEach(([mx, my], k) => {
      const px = (mx + f) % T;
      const py = (my + (f >> 1)) % T;
      if (x === px && y === py) c = k % 2 ? PAL.cyan : PAL.magenta;
    });
    return c;
  };
}

function frigidBody(seed: number) {
  return waterBody('#1a3560', '#1f4577', '#4a8ac4', '#bfe8ff', seed);
}

/** Small ice floes drifting close to the shore. */
function iceFloes(x: number, y: number, f: number, d: number): Col | undefined {
  if (d < 2 || d > 4.5) return undefined;
  const bx = (x + ((f >> 1) & 1)) >> 1;
  const by = y >> 1;
  const h = rnd(bx, by, 61);
  if (h > 0.72) return (x + y) % 3 === 0 ? PAL.lightGray : PAL.white;
  if (h > 0.62 && d < 3) return '#9fc3e0';
  return undefined;
}

/** Dark pool dimpled by rain: drops land, ring out and fade over the 4-frame loop. */
function rainBody(seed: number) {
  const base = waterBody('#1b2038', '#222a48', '#4a5680', '#8b9bb4', seed);
  const drops = marks(seed, 3, 70);
  const wrapD = (a: number, b: number) => {
    const d = (((a - b) % T) + T) % T;
    return d > T / 2 ? d - T : d;
  };
  return (x: number, y: number, f: number): Col => {
    let c = base(x, y, f);
    drops.forEach(([dx, dy], k) => {
      const ph = (f + k) % 4;
      const ox = wrapD(x, dx);
      const oy = wrapD(y, dy);
      if (ph === 0 && ox === 0 && oy === 0) c = PAL.lightGray;
      else if (ph > 0 && ph < 3) {
        const d = Math.hypot(ox / ph, oy / (ph * 0.55));
        if (Math.abs(d - 1) < 0.34) c = ph === 1 ? '#6a78a4' : '#3c4670';
      }
    });
    return c;
  };
}

/** A night sky seen through the floor: indigo haze, twinkling white stars, a drifting gold mote. */
function starBody(seed: number) {
  const stars = marks(seed, 2, 40);
  const mote = marks(seed, 1, 50)[0];
  return (x: number, y: number, f: number): Col => {
    const n = fbm16(x, y, seed);
    let c: Col = PAL.black;
    if (n > 0.55 || (n > 0.51 && bayer(x, y) > 0.5)) c = '#11112b';
    if (n > 0.66 || (n > 0.63 && bayer(x, y) > 0.5)) c = '#191b42';
    stars.forEach(([sx, sy], k) => {
      const ph = (f + k * 3) % 4;
      if (x === sx && y === sy) c = [PAL.slate, PAL.lightGray, PAL.white, PAL.gray][ph];
      if (ph === 2 && Math.abs(x - sx) + Math.abs(y - sy) === 1) c = k === 0 ? '#8a5a2a' : PAL.darkSlate;
    });
    const px = (mote[0] + f) % T;
    const py = (mote[1] + (f >> 1)) % T;
    if (x === px && y === py) c = PAL.gold;
    return c;
  };
}

/** Lily pads resting near the bank (static, so the pads don't jitter). */
function lilyPads(x: number, y: number, _f: number, d: number): Col | undefined {
  if (d < 1.5 || d > 5) return undefined;
  const cx = x >> 2;
  const cy = y >> 2;
  const h = rnd(cx, cy, 71);
  if (h < 0.84) return undefined;
  // a flattened round pad (4x2) with a notch, sometimes carrying a pink bloom
  const pad = ['....', '.ab.', 'cbbd', '....'][y & 3][x & 3];
  if (pad === '.') return undefined;
  if (h > 0.95 && pad === 'a') return PAL.pink;
  return { a: '#7fc06a', b: '#3e8948', c: '#2f6a52', d: '#1f5a4a' }[pad];
}

/** Murky scum, weed and floating leaves close to the bank. */
function algae(x: number, y: number, f: number, d: number): Col | undefined {
  if (d < 1.5 || d > 4.5) return undefined;
  const h = rnd((x + ((f >> 1) & 1)) >> 1, y >> 1, 83);
  if (h > 0.84) return (x + y) % 3 ? '#3e6a4a' : '#5a8a50';
  if (h > 0.78 && d < 3) return '#2c5244';
  return undefined;
}

// ---------------------------------------------------------------- styles ----

const STYLES: Record<Theme, LiquidStyle> = {
  town: {
    body: waterBody('#1b5d9c', '#1f6aad', '#5ab8ea', '#d6f7ff', 3),
    top: '#8a5a45',
    topDark: PAL.darkBrown,
    face: '#6a4238',
    faceDark: PAL.plum,
    rim: '#b98a64',
    foam: '#e9fbff',
    foam2: '#8fd3f2',
    under: '#123f6e',
    insN: 5,
    insS: 2,
    insWE: 2,
    pebble: PAL.gray,
  },
  forest: {
    body: waterBody('#15557f', '#1a628e', '#4aa6cf', '#d6f7ff', 5),
    top: '#6e4a3c',
    topDark: '#553530',
    face: '#553530',
    faceDark: PAL.plum,
    rim: '#9a6e52',
    foam: '#e0f7fb',
    foam2: '#86c6dc',
    under: '#0d3552',
    insN: 5,
    insS: 2,
    insWE: 2,
    pebble: PAL.slate,
  },
  cave: {
    body: waterBody('#172444', '#1d2d52', '#3b6c9c', '#9ff6ff', 8),
    top: '#3a4466',
    topDark: '#262b44',
    face: '#2a2f4a',
    faceDark: PAL.black,
    rim: PAL.slate,
    foam: '#7fb6d6',
    foam2: '#3f709a',
    under: '#0e1428',
    insN: 5,
    insS: 2,
    insWE: 2,
  },
  volcano: {
    body: lavaBody(4),
    top: '#3a2630',
    topDark: '#1f141c',
    face: '#2a1a24',
    faceDark: '#5a1a22',
    rim: '#2a1a24',
    foam: PAL.yellow,
    foam2: PAL.gold,
    under: PAL.darkRed,
    insN: 5,
    insS: 2,
    insWE: 2,
  },
  tundra: {
    body: frigidBody(6),
    nearShore: iceFloes,
    top: PAL.white,
    topDark: '#dbe8f5',
    face: '#9fd0ec',
    faceDark: '#5f9cc9',
    rim: '#eaf6ff',
    foam: '#bfe4fa',
    foam2: '#6fa8d4',
    under: '#10284a',
    insN: 5,
    insS: 3,
    insWE: 3,
  },
  citadel: {
    body: voidBody(9, '#1d1630', '#2a1c42'),
    top: '#363d5e',
    topDark: '#1c1f33',
    face: '#2a2f4b',
    faceDark: '#15131f',
    rim: '#4a5378',
    foam: PAL.magenta,
    foam2: PAL.purple,
    under: '#2a1c42',
    insN: 7,
    insS: 2,
    insWE: 2,
    faceH: 5,
    striate: false,
  },
  abyss: {
    body: voidBody(13, '#1f1433', '#2e1a47'),
    top: '#312a4c',
    topDark: '#120e1c',
    face: '#241d3a',
    faceDark: '#100c18',
    rim: '#4a3a70',
    foam: PAL.magenta,
    foam2: PAL.purple,
    under: '#2e1a47',
    insN: 7,
    insS: 2,
    insWE: 2,
    faceH: 5,
    striate: false,
  },
  desert: {
    // an oasis pool: clear turquoise water in a sandstone basin
    body: waterBody('#136b7d', '#1a8090', '#4fcac8', '#e0fff8', 21),
    nearShore: lilyPads,
    top: '#c99474',
    topDark: '#a8735f',
    face: '#9a6452',
    faceDark: '#6a4250',
    rim: '#b07c66',
    foam: '#dffaf2',
    foam2: '#8fe0d8',
    under: '#0e5064',
    insN: 5,
    insS: 2,
    insWE: 2,
    pebble: '#e4bf96',
  },
  ruins: {
    // murky flood water over sunken flagstones
    body: waterBody('#1c4541', '#23534d', '#4c8a76', '#a6dcc0', 23),
    nearShore: algae,
    top: '#3a5c56',
    topDark: '#23403c',
    face: '#2c4846',
    faceDark: '#152a2b',
    rim: '#3e8948',
    foam: '#9fd0b0',
    foam2: '#4c8a76',
    under: '#12302e',
    insN: 5,
    insS: 2,
    insWE: 2,
    pebble: '#2f6a4a',
  },
  storm: {
    // dark rain pools on the slate
    body: rainBody(25),
    top: '#3c4462',
    topDark: '#23283f',
    face: '#2b3151',
    faceDark: '#141729',
    rim: '#4a5476',
    foam: '#8b9bb4',
    foam2: '#4a5680',
    under: '#10132a',
    insN: 5,
    insS: 2,
    insWE: 2,
    pebble: '#2e3452',
  },
  eclipse: {
    // the starry void beneath the floating sanctum, rimmed with gold
    body: starBody(27),
    top: '#241e33',
    topDark: '#0e0b16',
    face: '#1a1527',
    faceDark: '#0b0912',
    rim: '#c48a2c',
    foam: PAL.gold,
    foam2: '#8a5a2a',
    under: '#1f2150',
    insN: 7,
    insS: 2,
    insWE: 2,
    faceH: 5,
    striate: false,
  },
  oasis: {
    // town pools and canals: bright turquoise, sandstone kerb
    body: waterBody('#157585', '#1c8a98', '#5ad4d0', '#e6fffa', 29),
    nearShore: lilyPads,
    top: '#d9ab80',
    topDark: '#bd8866',
    face: '#a86e56',
    faceDark: '#7a4a42',
    rim: '#efcfa4',
    foam: '#e6fffa',
    foam2: '#8fe6dc',
    under: '#0f5868',
    insN: 5,
    insS: 2,
    insWE: 2,
  },
};

// ------------------------------------------------------------------ build --

export function buildLiquid(theme: Theme, mask: number, frame: number): Grid {
  const st = STYLES[theme];
  const f = ((frame % 4) + 4) % 4;
  const m = mask & 15;
  const landN = !(m & N);
  const landE = !(m & E);
  const landS = !(m & S);
  const landW = !(m & W);
  const g = new Grid(T, T);
  const R = 3.2;
  const BIG = 99;
  const iN = st.insN;
  const iS = st.insS;
  const iW = st.insWE;
  const faceH = st.faceH ?? 3;

  for (let y = 0; y < T; y++)
    for (let x = 0; x < T; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const aw = landW ? px - iW : BIG;
      const ae = landE ? T - iW - px : BIG;
      const an = landN ? py - iN : BIG;
      const as = landS ? T - iS - py : BIG;
      let d = Math.min(aw, ae, an, as);
      const corner = (a: boolean, b: boolean, da: number, db: number) => {
        if (a && b && da < R && db < R) d = Math.min(d, R - Math.hypot(R - da, R - db));
      };
      corner(landN, landW, an, aw);
      corner(landN, landE, an, ae);
      corner(landS, landW, as, aw);
      corner(landS, landE, as, ae);

      const nearN = landN && an <= Math.min(aw, ae, as) + 0.01;

      if (d < 0) {
        if (nearN) {
          // north bank: top strip, then the vertical face down to the surface
          const faceTop = iN - faceH;
          if (y < faceTop) g.set(x, y, y === faceTop - 1 ? st.topDark : st.top);
          else {
            const t = (y - faceTop + 1) / faceH;
            let col = t > 0.7 ? st.faceDark : st.face;
            if (st.striate !== false && (x * 7 + 3) % 5 === 0 && t > 0.3) col = st.faceDark;
            if (t > 0.5 && t <= 0.7 && bayer(x, y) > 0.5) col = st.faceDark;
            g.set(x, y, col);
          }
        } else {
          g.set(x, y, d > -1 ? st.rim : st.top);
          if (d <= -1 && st.pebble && rnd(x, y, mask + 17) > 0.86) g.set(x, y, st.pebble);
        }
        continue;
      }

      let col = st.body(x, y, f);
      if (st.nearShore && (landN || landE || landS || landW)) col = st.nearShore(x, y, f, d) ?? col;
      if (d < 1) {
        col = nearN ? st.under : (x + y + f) % 4 === 0 ? st.foam2 : st.foam;
      } else if (d < 2) {
        if (nearN) col = (x + f) % 4 < 2 ? st.foam : st.foam2;
        else if ((x * 3 + y * 5 + f) % 5 === 0) col = st.foam2;
      } else if (d < 3 && nearN) {
        if ((x + f * 2) % 7 === 0) col = st.foam2;
      }
      g.set(x, y, col);
    }
  return g;
}
