/**
 * Skill icons: a bevelled frame (square for actives, octagonal for passives)
 * over a glowing background, with a bright symbol and a dark drop shadow.
 */
import { PAL } from '../../palette';
import { Grid, alpha, mix, ramp, sphereLight, type Col } from '../env/raster';

const S = 16;

export interface SkillPal {
  /** background dark → light */
  bg: readonly [Col, Col, Col];
  /** frame bevel: dark, light */
  rim: readonly [Col, Col];
  /** symbol: edge, core */
  sym: readonly [Col, Col];
}

export function frame(p: SkillPal, octagon: boolean): Grid {
  const g = new Grid(S, S);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const cx = Math.min(x, S - 1 - x);
      const cy = Math.min(y, S - 1 - y);
      const cut = octagon ? 3 : 1;
      if (cx + cy < cut - 1) continue;
      const ring = Math.min(cx, cy, cx + cy - (cut - 1));
      let c: Col;
      if (ring === 0) c = PAL.black;
      else if (ring === 1) c = x + y < S ? p.rim[1] : p.rim[0];
      else if (ring === 2) c = mix(p.bg[0], PAL.black, 0.3);
      else {
        const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 7.5) / 7;
        c = ramp(p.bg, 1 - d, x, y, 0.6);
      }
      g.set(x, y, c);
    }
  return g;
}

/** Draw a symbol with a 1px drop shadow, clipped to the frame interior. */
export function symbol(g: Grid, draw: (s: Grid) => void, shadow: Col = alpha(PAL.black, 0.6)): Grid {
  const s = new Grid(S, S);
  draw(s);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const c = s.get(x, y);
      if (c && !s.get(x + 1, y + 1) && inside(x + 1, y + 1)) g.set(x + 1, y + 1, shadow);
    }
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const c = s.get(x, y);
      if (c && inside(x, y)) g.set(x, y, c);
    }
  return g;
}

function inside(x: number, y: number): boolean {
  return x >= 2 && y >= 2 && x <= 13 && y <= 13;
}

export function thick(s: Grid, pts: readonly [number, number][], edge: Col, core: Col): void {
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[i + 1];
    s.line(ax + 1, ay, bx + 1, by, edge);
    s.line(ax, ay + 1, bx, by + 1, edge);
  }
  for (let i = 0; i + 1 < pts.length; i++) s.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], core);
}

// ------------------------------------------------------------------ skills --

const P = {
  slash: { bg: [PAL.darkRed, PAL.red, PAL.pink], rim: [PAL.darkRed, PAL.pink], sym: ['#ffb3b8', PAL.white] },
  whirl: {
    bg: [PAL.deepTeal, PAL.forest, PAL.darkGreen],
    rim: [PAL.forest, PAL.green],
    sym: ['#9cd455', PAL.white],
  },
  fire: {
    bg: [PAL.plum, PAL.darkRed, PAL.rust],
    rim: [PAL.darkRed, PAL.orange],
    sym: [PAL.orange, PAL.yellow],
  },
  frost: { bg: [PAL.navy, PAL.blue, PAL.sky], rim: [PAL.blue, '#9fdcf7'], sym: ['#9fdcf7', PAL.white] },
  heal: {
    bg: [PAL.deepTeal, PAL.darkGreen, PAL.green],
    rim: [PAL.forest, '#9cd455'],
    sym: ['#c8f0a0', PAL.white],
  },
  bolt: {
    bg: [PAL.navy, PAL.purple, PAL.magenta],
    rim: [PAL.purple, PAL.yellow],
    sym: [PAL.yellow, PAL.white],
  },
  blades: {
    bg: [PAL.navy, PAL.darkSlate, PAL.slate],
    rim: [PAL.darkSlate, PAL.lightGray],
    sym: [PAL.lightGray, PAL.white],
  },
  meteor: {
    bg: [PAL.black, PAL.plum, PAL.darkRed],
    rim: [PAL.plum, PAL.orange],
    sym: [PAL.orange, PAL.yellow],
  },
  surge: { bg: [PAL.navy, PAL.blue, PAL.sky], rim: [PAL.rust, PAL.yellow], sym: [PAL.cyan, PAL.white] },
  pBlade: {
    bg: [PAL.plum, PAL.darkRed, PAL.red],
    rim: [PAL.rust, PAL.gold],
    sym: [PAL.lightGray, PAL.white],
  },
  pArcane: { bg: [PAL.navy, PAL.purple, PAL.blue], rim: [PAL.purple, PAL.sky], sym: ['#b8a0ff', PAL.white] },
  pGuard: {
    bg: [PAL.deepTeal, PAL.forest, PAL.darkGreen],
    rim: [PAL.rust, PAL.gold],
    sym: [PAL.gold, PAL.yellow],
  },
  shadow: {
    bg: [PAL.black, '#2b1d45', '#553785'],
    rim: [PAL.purple, '#b8a0ff'],
    sym: ['#b8a0ff', PAL.white],
  },
  quake: {
    bg: [PAL.plum, PAL.rust, PAL.orangeBrown],
    rim: [PAL.darkBrown, PAL.orange],
    sym: [PAL.orange, PAL.yellow],
  },
  blizzard: {
    bg: [PAL.navy, PAL.blue, PAL.sky],
    rim: [PAL.darkSlate, PAL.lightGray],
    sym: ['#9fdcf7', PAL.white],
  },
  blood: {
    bg: [PAL.black, PAL.plum, PAL.darkRed],
    rim: [PAL.plum, PAL.red],
    sym: [PAL.red, '#ffb3b8'],
  },
} satisfies Record<string, SkillPal>;

function slash(): Grid {
  const p = P.slash;
  return symbol(frame(p, false), (s) => {
    // crescent swoosh between two offset circles
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const px = x + 0.5;
        const py = y + 0.5;
        const d1 = Math.hypot(px - 4.5, py - 11.5);
        const d2 = Math.hypot(px - 2.5, py - 13.5);
        if (d1 < 9 && d2 >= 8.4 && px > 3 && py < 12.5)
          s.set(x, y, d2 > 9.4 && d1 < 8.2 ? p.sym[1] : p.sym[0]);
      }
    // dash streaks behind the cut
    s.hline(2, 4, 12, alpha(p.sym[0], 0.8))
      .hline(3, 6, 10, alpha(p.sym[0], 0.6))
      .set(12, 13, alpha(p.sym[1], 0.8));
  });
}

function whirlwind(): Grid {
  const p = P.whirl;
  return symbol(frame(p, false), (s) => {
    let px = 8;
    let py = 8;
    for (let th = 0; th < Math.PI * 3.6; th += 0.15) {
      const r = 0.6 + th * 0.52;
      const x = 8 + Math.cos(th) * r;
      const y = 8 + Math.sin(th) * r * 0.85;
      s.line(px, py, x, y, th < Math.PI * 1.6 ? p.sym[1] : p.sym[0]);
      px = x;
      py = y;
    }
    s.set(3, 3, p.sym[0]).set(12, 12, p.sym[0]);
  });
}

function fireball(): Grid {
  const p = P.fire;
  return symbol(frame(p, false), (s) => {
    // trail
    thick(
      s,
      [
        [3, 12],
        [8, 8],
      ],
      PAL.red,
      PAL.orange,
    );
    s.line(3, 9, 7, 7, PAL.red).line(6, 13, 9, 9, PAL.red).set(2, 11, PAL.orange);
    s.ellipse(9.5, 6.5, 3.4, 3.4, (x, y, nx, ny) =>
      ramp(
        [PAL.red, PAL.orange, PAL.gold, PAL.yellow, PAL.white],
        sphereLight(nx, ny, 0.35) + 0.15,
        x,
        y,
        0.3,
      ),
    );
  });
}

function frostnova(): Grid {
  const p = P.frost;
  return symbol(frame(p, false), (s) => {
    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * Math.PI * 2;
      const len = a % 2 ? 3.8 : 5.4;
      for (let r = 0; r <= len; r += 0.5)
        s.set(
          Math.floor(8 + Math.cos(ang) * r),
          Math.floor(8 + Math.sin(ang) * r),
          r > len - 1.5 ? p.sym[0] : p.sym[1],
        );
    }
    s.set(7, 7, PAL.white).set(8, 7, PAL.white).set(7, 8, PAL.white).set(8, 8, PAL.cyan);
  });
}

function heal(): Grid {
  const p = P.heal;
  return symbol(frame(p, false), (s) => {
    s.rect(6, 3, 4, 10, p.sym[0]).rect(3, 6, 10, 4, p.sym[0]);
    s.rect(7, 4, 2, 8, p.sym[1]).rect(4, 7, 8, 2, p.sym[1]);
    s.set(12, 3, PAL.white).set(3, 12, alpha(PAL.white, 0.8));
  });
}

function lightning(): Grid {
  const p = P.bolt;
  return symbol(frame(p, false), (s) => {
    thick(
      s,
      [
        [11, 2],
        [6, 8],
        [9, 8],
        [4, 13],
      ],
      p.sym[0],
      p.sym[1],
    );
    // chain arc to a second target
    s.line(9, 8, 12, 10, PAL.cyan).line(12, 10, 11, 13, PAL.cyan);
    s.set(12, 10, PAL.white);
  });
}

function blades(): Grid {
  const p = P.blades;
  return symbol(frame(p, false), (s) => {
    for (let a = 0; a < 3; a++) {
      const ang = (a / 3) * Math.PI * 2 - Math.PI / 2;
      const bx = 8 + Math.cos(ang) * 4.2;
      const by = 8 + Math.sin(ang) * 4.2;
      const tx = Math.cos(ang + Math.PI / 2);
      const ty = Math.sin(ang + Math.PI / 2);
      s.line(bx - tx * 2, by - ty * 2, bx + tx * 2, by + ty * 2, p.sym[1]);
      s.set(Math.round(bx - tx * 2.4), Math.round(by - ty * 2.4), PAL.gold);
      // motion trail
      s.set(
        Math.round(bx - Math.cos(ang) * 1.5 + tx * 1.5),
        Math.round(by - Math.sin(ang) * 1.5 + ty * 1.5),
        alpha(p.sym[0], 0.6),
      );
    }
    s.ellipse(8, 8, 1.4, 1.4, PAL.cyan);
  });
}

function meteor(): Grid {
  const p = P.meteor;
  return symbol(frame(p, false), (s) => {
    thick(
      s,
      [
        [2, 2],
        [8, 8],
      ],
      PAL.red,
      PAL.gold,
    );
    s.line(5, 2, 9, 6, PAL.orange).line(2, 5, 6, 9, PAL.orange);
    s.ellipse(10, 10, 3.3, 3.3, (x, y, nx, ny) =>
      nx + ny < -0.7
        ? PAL.yellow
        : ramp([PAL.plum, PAL.darkBrown, PAL.brown, PAL.tan], sphereLight(nx, ny, 0.3), x, y, 0.3),
    );
    s.set(11, 11, PAL.plum).set(9, 11, PAL.darkBrown);
  });
}

function surge(): Grid {
  const p = P.surge;
  const g = frame(p, false);
  // gold corner studs for the ultimate
  for (const [x, y] of [
    [1, 1],
    [14, 1],
    [1, 14],
    [14, 14],
  ] as const)
    g.set(x, y, PAL.yellow);
  return symbol(g, (s) => {
    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * Math.PI * 2 + Math.PI / 8;
      const len = a % 2 ? 3.5 : 6;
      for (let r = 1; r <= len; r += 0.5) {
        s.set(
          Math.floor(8 + Math.cos(ang) * r),
          Math.floor(8 + Math.sin(ang) * r),
          r < 3 ? PAL.white : a % 2 ? PAL.gold : p.sym[0],
        );
      }
    }
    s.ellipse(8, 8, 2, 2, PAL.white);
    s.set(3, 3, PAL.yellow).set(12, 4, PAL.yellow).set(4, 12, PAL.gold);
  });
}

function passiveBlade(): Grid {
  const p = P.pBlade;
  return symbol(frame(p, true), (s) => {
    s.vline(7, 3, 10, p.sym[1]).vline(8, 3, 10, p.sym[0]);
    s.set(7, 2, p.sym[1]);
    s.hline(4, 11, 11, PAL.gold).set(4, 11, PAL.yellow);
    s.vline(7, 12, 13, PAL.darkBrown).vline(8, 12, 13, PAL.plum);
    s.set(7, 14, PAL.gold);
  });
}

function passiveArcane(): Grid {
  const p = P.pArcane;
  return symbol(frame(p, true), (s) => {
    // rune ring
    for (let a = 0; a < 24; a++) {
      const ang = (a / 24) * Math.PI * 2;
      if (a % 3 === 0) continue;
      s.set(Math.floor(8 + Math.cos(ang) * 5), Math.floor(8 + Math.sin(ang) * 5), alpha(p.sym[0], 0.8));
    }
    // four-point star
    s.vline(7, 3, 12, p.sym[0]).hline(3, 12, 7, p.sym[0]);
    s.rect(6, 6, 3, 3, p.sym[1]);
    s.set(7, 4, p.sym[1]).set(7, 10, p.sym[1]).set(4, 7, p.sym[1]).set(10, 7, p.sym[1]);
  });
}

function passiveGuard(): Grid {
  const p = P.pGuard;
  return symbol(frame(p, true), (s) => {
    for (let y = 3; y <= 13; y++) {
      const t = (y - 3) / 10;
      const hw = t < 0.55 ? 4.5 : 4.5 * (1 - (t - 0.55) / 0.45) + 0.5;
      for (let x = Math.floor(8 - hw); x < Math.ceil(8 + hw); x++) {
        const edge = x === Math.floor(8 - hw) || x === Math.ceil(8 + hw) - 1 || y === 3;
        s.set(x, y, edge ? p.sym[0] : x < 8 ? PAL.green : PAL.darkGreen);
      }
    }
    s.vline(7, 5, 11, p.sym[1]).hline(5, 9, 7, p.sym[1]);
  });
}

/** Reverse-grip dagger pointing down, centred on column cx. */
function downDagger(
  s: Grid,
  cx: number,
  c: { lit: Col; core: Col; shade: Col; guard: Col; grip: Col; pommel: Col },
): void {
  s.set(cx, 2, c.pommel).vline(cx, 3, 4, c.grip);
  s.hline(cx - 2, cx + 2, 5, c.guard)
    .set(cx - 2, 4, c.guard)
    .set(cx + 2, 4, c.guard);
  for (let y = 6; y <= 10; y++)
    s.set(cx - 1, y, c.lit)
      .set(cx, y, c.core)
      .set(cx + 1, y, c.shade);
  s.set(cx - 1, 11, c.lit).vline(cx, 11, 13, c.core);
}

function shadowstep(): Grid {
  const p = P.shadow;
  const VIO = '#8f6ad6';
  const echo = (a: number) => ({
    lit: alpha(VIO, a),
    core: alpha(p.sym[0], a),
    shade: alpha(VIO, a * 0.8),
    guard: alpha(VIO, a),
    grip: alpha(VIO, a * 0.8),
    pommel: alpha(VIO, a),
  });
  return symbol(frame(p, false), (s) => {
    // fading afterimages left behind by the blink
    downDagger(s, 4, echo(0.35));
    downDagger(s, 7, echo(0.6));
    s.set(2, 12, alpha(VIO, 0.5)).set(5, 3, alpha(p.sym[0], 0.4));
    downDagger(s, 11, {
      lit: p.sym[1],
      core: '#e8e0ff',
      shade: p.sym[0],
      guard: PAL.magenta,
      grip: PAL.purple,
      pommel: '#d9c8ff',
    });
    s.set(11, 13, p.sym[1]).set(9, 4, '#ff9ecb').set(13, 4, PAL.magenta);
  });
}

function earthshatter(): Grid {
  const p = P.quake;
  return symbol(frame(p, false), (s) => {
    // x=2..13; the fissure opens between two slabs heaved up toward it
    s.stamp(
      [
        '......s.....',
        '......d.st..',
        '..st...sttb.',
        '..bd....bbd.',
        '.......Y.d..',
        '.....o....t.',
        '.....s....d.',
        '...sstYO....',
        '.ssttdkYss..',
        'sttbbdYkdtss',
        'tbbdddkOdbtt',
        'bdddppRppddb',
      ],
      {
        s: PAL.sand,
        t: PAL.tan,
        b: PAL.brown,
        d: PAL.darkBrown,
        p: PAL.plum,
        y: PAL.yellow,
        o: alpha(PAL.orange, 0.8),
        Y: PAL.yellow,
        O: PAL.orange,
        R: PAL.darkRed,
        k: PAL.darkRed,
      },
      2,
      2,
    );
  });
}

function blizzard(): Grid {
  const p = P.blizzard;
  return symbol(frame(p, false), (s) => {
    const C = [PAL.gray, PAL.lightGray, '#e8eef6', PAL.white] as const;
    const cloud = (x: number, y: number, nx: number, ny: number) =>
      y > 6 ? C[0] : ramp(C, sphereLight(nx, ny, 0.4) + 0.1, x, y, 0.2);
    s.ellipse(5.5, 5.5, 2.6, 2.2, cloud).ellipse(9, 4.5, 3, 2.6, cloud).ellipse(11.5, 6, 2, 1.6, cloud);
    s.hline(4, 12, 7, C[0]);
    // wind-driven ice shards falling down-left
    for (const [x, y] of [
      [3, 11],
      [7, 10],
      [11, 10],
      [5, 13],
      [9, 13],
    ] as const)
      s.set(x, y, p.sym[1])
        .set(x + 1, y - 1, p.sym[0])
        .set(x + 2, y - 2, alpha(p.sym[0], 0.45));
    s.set(13, 12, PAL.white).set(2, 9, alpha(PAL.white, 0.8)).set(12, 13, alpha(PAL.cyan, 0.9));
  });
}

function bloodrite(): Grid {
  const p = P.blood;
  return symbol(frame(p, false), (s) => {
    // rune circle behind the drop, with four glowing ticks
    for (let y = 2; y <= 13; y++)
      for (let x = 2; x <= 13; x++) {
        const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 8);
        if (Math.abs(d - 5.4) < 0.5) s.set(x, y, alpha(PAL.hotPink, 0.55));
      }
    s.set(7, 2, PAL.gold).set(8, 2, PAL.gold).set(2, 7, PAL.gold).set(2, 8, PAL.gold);
    s.set(13, 7, PAL.gold).set(13, 8, PAL.gold).set(7, 13, PAL.gold).set(8, 13, PAL.gold);
    const D = [PAL.darkRed, PAL.red, PAL.red, PAL.pink] as const;
    for (let y = 2; y < 14; y++)
      for (let x = 3; x < 13; x++) {
        const px = x + 0.5;
        const py = y + 0.5;
        const inDrop =
          Math.hypot(px - 8, py - 9.3) < 3.6 ||
          (py > 2.5 && py < 9.3 && Math.abs(px - 8) < (py - 2.5) * 0.52);
        if (inDrop) s.set(x, y, ramp(D, sphereLight((px - 8) / 4, (py - 9) / 4.5, 0.2), x, y, 0.3));
      }
    // glowing rune carved into the drop
    s.vline(8, 8, 11, PAL.yellow)
      .set(7, 9, PAL.gold)
      .set(6, 8, PAL.gold)
      .set(9, 9, PAL.gold)
      .set(10, 8, PAL.gold);
    s.set(8, 8, '#fff3b0').set(6, 6, PAL.white).set(7, 5, '#ffd0d4');
  });
}

export const SKILL_ICONS = {
  skill_slash: slash,
  skill_whirlwind: whirlwind,
  skill_fireball: fireball,
  skill_frostnova: frostnova,
  skill_heal: heal,
  skill_lightning: lightning,
  skill_blades: blades,
  skill_meteor: meteor,
  skill_surge: surge,
  passive_blade: passiveBlade,
  passive_arcane: passiveArcane,
  passive_guard: passiveGuard,
  skill_shadowstep: shadowstep,
  skill_earthshatter: earthshatter,
  skill_blizzard: blizzard,
  skill_bloodrite: bloodrite,
} as const;
