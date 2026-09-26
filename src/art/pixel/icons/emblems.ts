/**
 * Ascendancy class emblems: the octagonal passive frame dressed up as a crest
 * (four gem studs on the rim), each with its own colour identity and a bold
 * symbol with a drop shadow.
 */
import { PAL } from '../../palette';
import { Grid, alpha, mix, ramp, sphereLight, type Col } from '../env/raster';
import { frame, symbol, type SkillPal } from './skills';

interface CrestPal extends SkillPal {
  /** rim studs: dark, light */
  gem: readonly [Col, Col];
}

const P = {
  blademaster: {
    bg: [PAL.black, PAL.darkRed, PAL.red],
    rim: [PAL.darkRed, PAL.pink],
    sym: [PAL.lightGray, PAL.white],
    gem: [PAL.gray, PAL.white],
  },
  warbringer: {
    bg: [PAL.plum, PAL.rust, PAL.orange],
    rim: [PAL.darkBrown, PAL.gold],
    sym: [PAL.gold, PAL.yellow],
    gem: [PAL.rust, PAL.orange],
  },
  shadowblade: {
    bg: [PAL.forest, PAL.darkGreen, PAL.green],
    rim: [PAL.deepTeal, PAL.green],
    sym: ['#9cd455', '#e4ffb0'],
    gem: [PAL.darkGreen, '#9cd455'],
  },
  archmage: {
    bg: [PAL.black, PAL.navy, PAL.blue],
    rim: [PAL.blue, PAL.cyan],
    sym: [PAL.cyan, PAL.white],
    gem: [PAL.sky, PAL.white],
  },
} satisfies Record<string, CrestPal>;

/** Octagonal frame with a gem stud set into the middle of each rim edge. */
function crest(p: CrestPal): Grid {
  const g = frame(p, true);
  for (const [x, y] of [
    [7, 1],
    [1, 7],
    [14, 7],
    [7, 14],
  ] as const) {
    const horiz = y === 1 || y === 14;
    g.set(x, y, p.gem[1]).set(horiz ? x + 1 : x, horiz ? y : y + 1, p.gem[0]);
  }
  return g;
}

/**
 * Diagonal sword along `dir` (+1 = tip top-right, -1 = tip top-left), tip at
 * (tx, ty), with a 2px blade, perpendicular guard, grip and pommel.
 */
function sword(
  s: Grid,
  tx: number,
  ty: number,
  dir: 1 | -1,
  len: number,
  c: { edge: Col; core: Col; guard: Col; guardHi: Col; grip: Col; pommel: Col },
): void {
  const at = (t: number): [number, number] => [tx - dir * t, ty + t];
  for (let t = 0; t < len; t++) {
    const [x, y] = at(t);
    s.set(x, y, c.core);
    if (t > 0) s.set(x + dir, y, c.edge);
  }
  const [gx, gy] = at(len);
  s.set(gx, gy, c.guard)
    .set(gx - dir, gy - 1, c.guardHi)
    .set(gx + dir, gy + 1, c.guard);
  const [ax, ay] = at(len + 1);
  s.set(ax, ay, c.grip);
  const [px, py] = at(len + 2);
  s.set(px, py, c.pommel);
}

function blademaster(): Grid {
  const p = P.blademaster;
  return symbol(crest(p), (s) => {
    const steel = {
      edge: PAL.gray,
      core: p.sym[1],
      guard: PAL.gold,
      guardHi: PAL.yellow,
      grip: PAL.darkBrown,
      pommel: PAL.hotPink,
    };
    sword(s, 12, 2, 1, 8, steel);
    sword(s, 3, 2, -1, 8, { ...steel, edge: p.sym[0] });
  });
}

function warbringer(): Grid {
  const p = P.warbringer;
  return symbol(crest(p), (s) => {
    // earth mound the blade is driven into
    s.ellipse(8, 13.6, 5.6, 2.6, (x, y, nx, ny) =>
      ramp([PAL.plum, PAL.darkBrown, PAL.brown, PAL.tan], sphereLight(nx, ny, 0.3), x, y, 0.3),
    );
    // pommel, grip, crossguard
    s.set(7, 2, p.sym[1]).set(8, 2, p.sym[0]);
    s.set(7, 3, PAL.brown).set(8, 3, PAL.darkBrown).set(7, 4, PAL.darkBrown).set(8, 4, PAL.plum);
    s.hline(3, 12, 5, p.sym[0]).hline(4, 11, 5, p.sym[1]).hline(4, 11, 6, PAL.rust);
    s.set(3, 6, PAL.rust).set(12, 6, PAL.darkBrown).set(7, 5, PAL.white).set(8, 6, PAL.red);
    // broad blade, lit from the left, sinking into the ground
    for (let y = 7; y <= 11; y++) {
      s.set(6, y, PAL.lightGray).set(7, y, PAL.white).set(8, y, PAL.gray).set(9, y, PAL.slate);
    }
    s.set(7, 12, PAL.gray).set(8, 12, PAL.slate);
    s.hline(4, 11, 12, PAL.darkBrown).set(6, 12, PAL.brown).set(9, 12, PAL.brown);
    // cracks and flying grit
    s.set(4, 13, PAL.plum)
      .set(11, 13, PAL.plum)
      .set(3, 10, PAL.tan)
      .set(12, 9, PAL.tan)
      .set(13, 11, PAL.brown);
  });
}

function shadowblade(): Grid {
  const p = P.shadowblade;
  return symbol(
    crest(p),
    (s) => {
      // crescent moon behind the hood
      s.ellipse(11, 5, 2.6, 2.6, (x, y) =>
        Math.hypot(x + 0.5 - 12.2, y + 0.5 - 4) < 2.2 ? undefined : p.sym[1],
      );
      // pointed hood silhouette, rim-lit by the toxic glow
      const inHood = (x: number, y: number) => {
        const px = x + 0.5 - 7;
        const py = y + 0.5;
        if (y < 2 || y > 13) return false;
        const hw = py < 9 ? 3.9 * Math.sqrt(Math.max(0, 1 - ((py - 9) / 6.2) ** 2)) : 3.9 + (py - 9) * 0.5;
        return Math.abs(px) < hw;
      };
      for (let y = 2; y <= 13; y++)
        for (let x = 2; x <= 13; x++) {
          if (!inHood(x, y)) continue;
          const lit = !inHood(x - 1, y) || (!inHood(x, y - 1) && x < 7);
          s.set(x, y, lit ? PAL.darkGreen : '#0e1a1c');
        }
      // hood fold + face opening
      s.set(6, 4, PAL.deepTeal).set(6, 5, PAL.deepTeal).set(5, 6, PAL.deepTeal);
      s.ellipse(7, 8.6, 2.5, 2.4, PAL.black);
      // poison-green eyes
      s.set(5, 8, p.sym[0]).set(6, 8, p.sym[1]).set(8, 8, p.sym[1]).set(9, 8, p.sym[0]);
      // cloth mask over the lower face
      s.hline(5, 9, 10, PAL.forest).hline(5, 9, 11, PAL.deepTeal).set(5, 10, PAL.darkGreen);
      // envenomed dagger held across the shoulder
      s.set(13, 8, PAL.white).set(12, 9, PAL.white).set(11, 10, PAL.lightGray);
      s.set(13, 9, PAL.gray).set(12, 10, PAL.gray).set(11, 11, PAL.slate);
      s.set(10, 11, PAL.green).set(9, 10, '#9cd455').set(11, 12, PAL.darkGreen);
      s.set(9, 12, PAL.darkBrown).set(8, 13, PAL.green);
      s.set(13, 11, p.sym[0]).set(13, 12, alpha(p.sym[0], 0.6));
    },
    alpha(PAL.black, 0.5),
  );
}

function archmage(): Grid {
  const p = P.archmage;
  return symbol(crest(p), (s) => {
    // staff shaft (bottom-left → head)
    for (let k = 0; k < 7; k++) {
      s.set(3 + k, 13 - k, k % 3 === 2 ? PAL.gold : PAL.brown);
      s.set(4 + k, 13 - k, PAL.darkBrown);
    }
    // forked head cradling the star
    s.set(9, 6, PAL.gold).set(8, 5, PAL.gold).set(10, 7, PAL.rust).set(11, 8, PAL.rust);
    // arcane star with a soft halo
    const cx = 10;
    const cy = 5;
    s.ellipse(cx + 0.5, cy + 0.5, 2.6, 2.6, alpha(PAL.sky, 0.45));
    s.vline(cx, cy - 3, cy + 3, p.sym[0]).hline(cx - 3, cx + 3, cy, p.sym[0]);
    s.set(cx - 1, cy - 1, PAL.sky)
      .set(cx + 1, cy - 1, PAL.sky)
      .set(cx - 1, cy + 1, PAL.sky)
      .set(cx + 1, cy + 1, PAL.sky);
    s.vline(cx, cy - 1, cy + 1, p.sym[1]).hline(cx - 1, cx + 1, cy, p.sym[1]);
    s.set(cx, cy - 3, p.sym[1]);
    // orbiting motes
    s.set(4, 4, mix(p.sym[0], PAL.white, 0.4))
      .set(13, 10, alpha(p.sym[0], 0.8))
      .set(6, 2, alpha(PAL.sky, 0.8));
  });
}

export const EMBLEM_ICONS = {
  asc_blademaster: blademaster,
  asc_warbringer: warbringer,
  asc_shadowblade: shadowblade,
  asc_archmage: archmage,
} as const;
