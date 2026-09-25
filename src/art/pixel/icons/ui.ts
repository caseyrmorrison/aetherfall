/**
 * Small UI glyphs (drawn inside a 16x16 canvas, often smaller than the cell).
 */
import { PAL } from '../../palette';
import { Grid, alpha, mix, ramp, sphereLight, type Col } from '../env/raster';

const S = 16;

function done(g: Grid, ink: Col = PAL.black): Grid {
  return g.outline((inner) => mix(ink, inner, 0.1));
}

function heart(): Grid {
  const g = new Grid(S, S);
  const R = [PAL.darkRed, PAL.red, PAL.pink, '#ffd0d4'] as const;
  const inHeart = (x: number, y: number) => {
    const px = x + 0.5;
    const py = y + 0.5;
    const c1 = Math.hypot(px - 5.5, py - 6) < 3.2;
    const c2 = Math.hypot(px - 10.5, py - 6) < 3.2;
    const tri = py >= 6 && py <= 13.5 && Math.abs(px - 8) <= (13.5 - py) * 0.85;
    return c1 || c2 || tri;
  };
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      if (!inHeart(x, y)) continue;
      const nx = (x + 0.5 - 8) / 6;
      const ny = (y + 0.5 - 8) / 6;
      g.set(x, y, ramp(R, sphereLight(nx, ny, 0.35) + 0.1, x, y, 0.3));
    }
  g.set(4, 5, PAL.white).set(5, 4, R[3]).set(4, 6, R[3]);
  return done(g, '#2a0f14');
}

function mana(): Grid {
  const g = new Grid(S, S);
  const B = [PAL.navy, PAL.blue, PAL.sky, '#9fdcf7'] as const;
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const inDrop =
        Math.hypot(px - 8, py - 9.5) < 4.2 || (py > 2 && py < 9.5 && Math.abs(px - 8) < (py - 2) * 0.55);
      if (!inDrop) continue;
      g.set(x, y, ramp(B, sphereLight((px - 8) / 4.5, (py - 9) / 5, 0.3) + 0.1, x, y, 0.3));
    }
  g.set(6, 8, PAL.white).set(6, 9, B[3]).set(7, 6, B[3]);
  return done(g, '#0b1030');
}

function coin(): Grid {
  const g = new Grid(S, S);
  g.ellipse(8, 8, 5.2, 5.2, (x, y, nx, ny) =>
    ramp([PAL.rust, PAL.gold, PAL.yellow, '#fff3b0'], sphereLight(nx, ny, 0.3) + 0.05, x, y, 0.3),
  );
  g.ellipse(8, 8, 3.2, 3.2, (_x, _y, nx, ny) => (Math.hypot(nx, ny) > 0.8 ? PAL.rust : undefined));
  g.vline(8, 6, 9, PAL.rust).vline(7, 6, 9, PAL.yellow);
  g.set(5, 5, PAL.white);
  return done(g, '#2a1a10');
}

function star(): Grid {
  const g = new Grid(S, S);
  const pts: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? 2.6 : 6.4;
    pts.push([8 + Math.cos(ang) * r, 8.4 + Math.sin(ang) * r]);
  }
  g.poly(pts, (x, y, nx, ny) =>
    ramp([PAL.rust, PAL.gold, PAL.yellow, '#fff3b0'], 0.75 - nx * 0.25 - ny * 0.3, x, y, 0.3),
  );
  g.set(7, 6, PAL.white);
  return done(g, '#2a1a10');
}

function lock(): Grid {
  const g = new Grid(S, S);
  // shackle
  g.ellipse(8, 6, 3.6, 3.6, (_x, y, nx, ny) =>
    Math.hypot(nx, ny) < 0.55 || y > 7 ? undefined : nx < 0 ? PAL.lightGray : PAL.gray,
  );
  // body
  g.rect(3, 7, 10, 7, PAL.gold);
  g.hline(3, 12, 7, PAL.yellow).vline(12, 8, 13, PAL.rust).hline(3, 12, 13, PAL.rust);
  // keyhole
  g.set(7, 9, PAL.plum).set(8, 9, PAL.plum).vline(7, 10, 11, PAL.plum);
  return done(g, '#1a1420');
}

function check(): Grid {
  const g = new Grid(S, S);
  const pts: [number, number][] = [
    [2, 8],
    [6, 12],
    [13, 4],
  ];
  for (let i = 0; i < 2; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[i + 1];
    g.line(ax, ay + 1, bx, by + 1, PAL.darkGreen);
    g.line(ax + 1, ay, bx + 1, by, PAL.green);
    g.line(ax, ay, bx, by, '#9cd455');
  }
  return done(g, '#0f2418');
}

function quest(): Grid {
  const g = new Grid(S, S);
  // bold exclamation mark
  for (let y = 2; y < 10; y++) {
    const w = y < 8 ? 2 : 1;
    for (let x = 8 - w; x < 8 + w; x++) g.set(x, y, x < 8 ? PAL.yellow : PAL.gold);
  }
  g.rect(6, 11, 4, 3, PAL.gold).rect(6, 11, 2, 2, PAL.yellow);
  g.set(6, 2, '#fff3b0');
  return done(g, '#2a1a10');
}

function waypointMark(): Grid {
  const g = new Grid(S, S);
  // stylised obelisk
  g.poly(
    [
      [8, 1],
      [11, 4],
      [10.5, 13],
      [5.5, 13],
      [5, 4],
    ],
    (x) => (x < 8 ? PAL.lightGray : PAL.gray),
  );
  g.rect(4, 13, 8, 2, PAL.slate).hline(4, 11, 13, PAL.gray);
  g.vline(8, 5, 9, PAL.cyan).set(7, 7, PAL.cyan).set(9, 7, PAL.cyan).set(8, 7, PAL.white);
  const d = done(g, '#0b1f3a');
  d.set(3, 3, alpha(PAL.cyan, 0.8)).set(13, 6, alpha(PAL.cyan, 0.7)).set(2, 9, alpha(PAL.cyan, 0.5));
  return d;
}

function skull(): Grid {
  const g = new Grid(S, S);
  const B = [PAL.gray, PAL.lightGray, '#e8eef6', PAL.white] as const;
  g.ellipse(8, 7, 5.2, 4.8, (x, y, nx, ny) => ramp(B, sphereLight(nx, ny, 0.35) + 0.1, x, y, 0.3));
  g.rect(5, 10, 6, 3, B[1]).hline(5, 10, 12, B[0]);
  // eyes + nose + teeth
  g.rect(5, 7, 2, 2, PAL.black).rect(9, 7, 2, 2, PAL.black);
  g.set(8, 10, PAL.black).set(7, 10, PAL.navy);
  g.set(6, 12, PAL.navy).set(8, 12, PAL.navy).set(10, 12, PAL.navy);
  g.set(5, 4, PAL.white);
  return done(g, PAL.black);
}

function chestGlyph(): Grid {
  const g = new Grid(S, S);
  const W = [PAL.plum, PAL.darkBrown, '#9a5b45', PAL.brown] as const;
  for (let y = 4; y < 13; y++)
    for (let x = 2; x < 14; x++) {
      let c: Col = y < 8 ? (y === 4 ? W[3] : W[2]) : y === 12 ? W[0] : W[1];
      if (x === 4 || x === 11) c = PAL.gray;
      g.set(x, y, c);
    }
  g.hline(2, 13, 8, PAL.plum);
  g.rect(7, 7, 2, 3, PAL.gold).set(7, 7, PAL.yellow);
  return done(g, '#1a1420');
}

function saveGlyph(): Grid {
  const g = new Grid(S, S);
  for (let y = -6; y <= 6; y++) {
    const w = Math.round((1 - Math.abs(y) / 6.5) * 4);
    for (let x = -w; x <= w; x++) {
      let c: Col =
        y < 0
          ? x < 0
            ? '#9ff6ff'
            : x === 0
              ? PAL.white
              : PAL.cyan
          : x < 0
            ? PAL.cyan
            : x === 0
              ? '#9ff6ff'
              : PAL.sky;
      if (y === 0) c = PAL.white;
      g.set(8 + x, 8 + y, c);
    }
  }
  const d = done(g, '#0b1f3a');
  d.set(2, 3, alpha(PAL.cyan, 0.8)).set(13, 12, alpha(PAL.cyan, 0.8));
  return d;
}

function swordGlyph(): Grid {
  const g = new Grid(S, S);
  for (let k = 0; k < 8; k++) {
    g.set(12 - k, 2 + k, PAL.white);
    g.set(13 - k, 2 + k, PAL.gray);
  }
  g.set(12, 1, PAL.white);
  // guard
  g.line(3, 8, 7, 12, PAL.gold);
  g.set(3, 8, PAL.yellow);
  // grip + pommel
  g.set(4, 11, PAL.darkBrown).set(3, 12, PAL.brown).set(2, 13, PAL.gold);
  return done(g, PAL.black);
}

function shieldGlyph(): Grid {
  const g = new Grid(S, S);
  for (let y = 2; y <= 14; y++) {
    const t = (y - 2) / 12;
    const hw = t < 0.5 ? 5.5 : 5.5 * (1 - (t - 0.5) / 0.5) + 0.5;
    for (let x = Math.floor(8 - hw); x < Math.ceil(8 + hw); x++) {
      const edge = x === Math.floor(8 - hw) || x === Math.ceil(8 + hw) - 1 || y === 2;
      g.set(x, y, edge ? (x < 8 ? PAL.yellow : PAL.gold) : x < 8 ? PAL.sky : PAL.blue);
    }
  }
  g.vline(7, 4, 11, PAL.gold).hline(4, 11, 6, PAL.gold).set(7, 6, PAL.yellow);
  g.set(4, 4, PAL.white);
  return done(g, '#0b1030');
}

export const UI_ICONS = {
  ui_heart: heart,
  ui_mana: mana,
  ui_coin: coin,
  ui_star: star,
  ui_lock: lock,
  ui_check: check,
  ui_quest: quest,
  ui_waypoint: waypointMark,
  ui_skull: skull,
  ui_chest: chestGlyph,
  ui_save: saveGlyph,
  ui_sword: swordGlyph,
  ui_shield: shieldGlyph,
} as const;
