/**
 * Cave, volcano, tundra, citadel & abyss props.
 */
import { PAL } from '../../palette';
import { R, cyl, def, foot, ink, type PropTable } from './kit';
import { Grid, alpha, bayer, ramp, rng, sphereLight, type Col } from './raster';

// ---------------------------------------------------------------- helpers ---

/**
 * A crystal shard: pointed top, lit left facet, bright ridge, darker right facet.
 * cols: [dark, mid-dark, mid, light, highlight]
 */
export function shard(
  g: Grid,
  bx: number,
  by: number,
  h: number,
  hw: number,
  lean: number,
  cols: readonly Col[],
): void {
  const top = by - h;
  for (let y = Math.floor(top); y <= by; y++) {
    const t = (y - top) / h;
    const w = t < 0.35 ? Math.max(0.5, hw * (t / 0.35)) : hw;
    const cx = bx + lean * (1 - t) * h * 0.25;
    for (let x = Math.floor(cx - w); x <= Math.ceil(cx + w) - 1; x++) {
      const rel = (x + 0.5 - cx) / Math.max(w, 0.5);
      if (rel < -1.05 || rel > 1.05) continue;
      let c: Col;
      if (rel < -0.45) c = cols[3];
      else if (rel < 0.05) c = t < 0.35 ? cols[4] : cols[3];
      else if (rel < 0.4) c = cols[2];
      else c = cols[1];
      if (Math.abs(rel - 0.05) < 0.22 && t > 0.2) c = t < 0.6 ? cols[4] : cols[3];
      if (t > 0.85) c = cols[Math.max(0, cols.indexOf(c) - 1)];
      g.set(x, y, c);
    }
  }
}

/**
 * Flame: tapered tongue that wobbles with the frame. Base at (cx, by), height h, half-width w.
 */
export function flame(g: Grid, cx: number, by: number, w: number, h: number, frame: number, seed = 0): void {
  const cols = [PAL.darkRed, PAL.red, PAL.orange, PAL.gold, PAL.yellow, PAL.white];
  const ph = frame * 1.7 + seed;
  const hh = h * (0.85 + 0.15 * Math.sin(ph * 1.3));
  for (let y = Math.floor(by - hh); y <= by; y++) {
    const t = (by - y) / hh; // 0 base → 1 tip
    if (t < 0 || t > 1) continue;
    const width = w * Math.pow(1 - t, 0.9) * (t < 0.15 ? 0.75 + t * 1.6 : 1);
    const off = Math.sin(t * 3.2 + ph) * t * 1.6;
    for (let x = Math.floor(cx - width + off); x <= Math.ceil(cx + width + off); x++) {
      const d = Math.abs(x + 0.5 - (cx + off)) / Math.max(width, 0.6);
      if (d > 1) continue;
      const heat = (1 - d) * 0.75 + (1 - t) * 0.55 - 0.25;
      g.set(x, y, ramp(cols, heat, x, y, 0.4));
    }
  }
  // detached flicker
  const r = rng(frame * 13 + seed * 7 + 3);
  const fx = Math.round(cx + (r() - 0.5) * w * 1.5);
  const fy = Math.round(by - hh - 1 - r() * 2);
  g.set(fx, fy, PAL.orange);
  if (r() > 0.5) g.set(fx, fy - 1, PAL.gold);
}

// ------------------------------------------------------------------- cave ---

const CRYSTAL_INK = '#0b1f3a';
const AMETHYST = [PAL.purple, PAL.magenta, '#d77bba', PAL.pink, '#ffd6f0'] as const;

function crystalSmall(): Grid {
  const g = new Grid(12, 12);
  shard(g, 3.5, 10, 6, 1.6, -1, R.crystal);
  shard(g, 8.5, 10, 7, 1.6, 1, R.crystal);
  shard(g, 6, 11, 10, 2.1, 0, R.crystal);
  g.hline(3, 9, 11, PAL.darkSlate);
  return ink(g, 0.1, CRYSTAL_INK);
}

function crystalBig(): Grid {
  const g = new Grid(22, 30);
  // rocky base
  g.ellipse(11, 26, 9, 3.5, (x, y, nx, ny) => ramp(R.stone, sphereLight(nx, ny, 0.25) * 0.8, x, y, 0.3));
  shard(g, 5, 25, 12, 2.3, -1.2, AMETHYST);
  shard(g, 17, 25, 14, 2.5, 1.1, R.crystal);
  shard(g, 11, 26, 24, 3.6, 0.1, R.crystal);
  shard(g, 14.5, 27, 8, 1.8, 0.6, AMETHYST);
  shard(g, 7.5, 27, 7, 1.6, -0.6, R.crystal);
  // sparkles
  g.set(9, 7, PAL.white).set(10, 6, PAL.white);
  return ink(g, 0.1, CRYSTAL_INK);
}

function stalagmite(): Grid {
  const g = new Grid(12, 20);
  for (let y = 1; y <= 19; y++) {
    const t = (y - 1) / 18;
    const w = 0.6 + t * 4.4 + (y > 16 ? (y - 16) * 0.6 : 0);
    const cx = 6 + Math.sin(t * 2) * 0.4;
    for (let x = Math.floor(cx - w); x <= Math.ceil(cx + w) - 1; x++) {
      const nx = (x + 0.5 - cx) / w;
      if (Math.abs(nx) > 1) continue;
      let c = cyl(R.stone, nx, x, y, -0.05);
      if ((y + Math.round(nx * 2)) % 5 === 0) c = R.stone[Math.max(1, R.stone.indexOf(c as never) - 1)];
      g.set(x, y, c);
    }
  }
  g.set(6, 1, PAL.lightGray).set(5, 3, PAL.lightGray);
  return ink(g);
}

function bones(): Grid {
  const g = new Grid(14, 8);
  const bone = [PAL.tan, PAL.sand, PAL.white];
  // crossed bones
  g.line(6, 2, 12, 6, bone[1]);
  g.line(6, 6, 12, 2, bone[0]);
  for (const [x, y] of [
    [6, 2],
    [12, 6],
    [6, 6],
    [12, 2],
  ] as const) {
    g.set(x - 1, y, bone[1])
      .set(x, y - 1, bone[2])
      .set(x, y + 1, bone[0]);
  }
  // skull
  g.ellipse(3.5, 3.5, 3, 2.8, (x, y, nx, ny) => ramp(bone, sphereLight(nx, ny, 0.3), x, y, 0.2));
  g.rect(2, 6, 3, 1, PAL.tan);
  g.set(2, 4, PAL.plum).set(4, 4, PAL.plum).set(3, 5, PAL.darkBrown);
  g.set(2, 6, PAL.plum).set(4, 6, PAL.plum);
  return ink(g, 0.3, PAL.plum);
}

// ---------------------------------------------------------------- volcano ---

function basaltRock(w: number, h: number, seed: number): Grid {
  const g = new Grid(w, h);
  const B = ['#140f1a', '#241a28', '#3a2a3a', '#553e50', '#6e5266'] as const;
  g.ellipse(w / 2, h / 2 + 1, w / 2 - 1, h / 2 - 1.5, (x, y, nx, ny) =>
    ramp(B, Math.round(sphereLight(nx, ny, 0.25) * 4) / 4 + 0.05, x, y, 0.2),
  );
  g.ellipse(w / 2 - 2.5, h / 2 - 0.5, w / 3, h / 3, (x, y, nx, ny) =>
    ramp(B, Math.round(sphereLight(nx, ny, 0.3) * 4) / 4 + 0.15, x, y, 0.2),
  );
  // branching glowing fissure
  const r = rng(seed);
  const hot = (x: number, y: number, i: number) => {
    if (g.get(x, y)) g.set(x, y, i % 4 === 1 ? PAL.yellow : i % 2 ? PAL.gold : PAL.orange);
  };
  let x = 3;
  let y = Math.floor(h * 0.45);
  for (let i = 0; i < w - 5; i++) {
    hot(x, y, i);
    if (i === 4 || i === 9) {
      let bx = x;
      let by = y;
      for (let k = 0; k < 3; k++) {
        by += i === 4 ? -1 : 1;
        bx += r() < 0.5 ? 1 : 0;
        hot(bx, by, k + 1);
      }
    }
    x++;
    if (r() < 0.4) y += r() < 0.5 ? 1 : -1;
    y = Math.max(3, Math.min(h - 4, y));
  }
  // under-glow along the base
  for (let xx = 2; xx < w - 2; xx++) {
    let yy = h - 1;
    while (yy > 0 && !g.get(xx, yy)) yy--;
    if (yy > 0 && bayer(xx, yy) > 0.3) g.set(xx, yy, '#8a2230');
  }
  return ink(g, 0.05);
}

function vent(frame: number): Grid {
  const g = new Grid(16, 24);
  // crater cone
  g.ellipse(8, 19.5, 7.5, 4, (x, y, nx, ny) => ramp(R.basalt, sphereLight(nx, ny, 0.3), x, y, 0.3));
  g.ellipse(8, 18.5, 4.5, 2, (_x, _y, nx, ny) => {
    const d = Math.hypot(nx, ny);
    return d < 0.45 ? PAL.yellow : d < 0.75 ? PAL.orange : PAL.rust;
  });
  g.hline(4, 12, 17, PAL.black);
  // smoke puffs rising, swelling and fading (loop of 4)
  for (let p = 0; p < 4; p++) {
    const age = (frame + p) % 4;
    const y = 15 - age * 4;
    const x = 8 + Math.sin(p * 2.3 + age * 0.9) * 1.8;
    const rr = 1.3 + age * 0.7;
    const a = [0.85, 0.65, 0.45, 0.25][age];
    g.ellipse(x, y, rr, rr * 0.8, (px, py, nx, ny) => {
      if (age === 3 && bayer(px, py) > 0.6) return undefined;
      return alpha(nx + ny < -0.5 ? '#b3a8b8' : '#7d7285', a);
    });
  }
  // embers
  for (let k = 0; k < 3; k++) {
    const age = (frame + k * 2) % 4;
    g.set(5 + k * 3 + (age % 2), 16 - age * 3 - k, age < 2 ? PAL.yellow : PAL.orange);
  }
  return g;
}

const OBSIDIAN = ['#0f0b14', '#1b1420', '#2e2238', '#4a3a5e', '#9a7ac0'] as const;

function obsidianSpike(): Grid {
  const g = new Grid(12, 20);
  shard(g, 4, 18, 9, 2, -1.2, OBSIDIAN);
  shard(g, 6.5, 19, 18, 3, 0.2, OBSIDIAN);
  shard(g, 9, 19, 7, 1.6, 1, OBSIDIAN);
  g.set(6, 3, PAL.white);
  return ink(g, 0, PAL.black);
}

// ----------------------------------------------------------------- tundra ---

function iceSpike(): Grid {
  const g = new Grid(12, 22);
  const ice = ['#3f7fb8', '#5fa3d4', '#8fcbee', '#c4ecff', PAL.white] as const;
  shard(g, 3.5, 21, 9, 1.8, -1, ice);
  shard(g, 6.5, 21, 20, 2.8, 0.2, ice);
  shard(g, 9.5, 21, 11, 1.8, 0.9, ice);
  g.hline(2, 10, 21, '#dfe6f0');
  return ink(g, 0.1, '#1f3f6a');
}

// ---------------------------------------------------------- citadel/abyss ---

const MARBLE = ['#1c1f33', '#2c3150', '#454e74', '#5f6a92', '#7d88ab', '#a3acc8'] as const;

function pillarBase(g: Grid, broken: number | null): void {
  const H = g.h;
  // plinth
  for (let y = H - 6; y < H; y++)
    for (let x = 1; x < 15; x++) {
      let c: Col = MARBLE[3];
      if (y === H - 6) c = MARBLE[5];
      else if (y === H - 5) c = MARBLE[4];
      else if (y === H - 1) c = MARBLE[1];
      else if (x === 14) c = MARBLE[2];
      else if (x === 1) c = MARBLE[4];
      g.set(x, y, c);
    }
  g.hline(2, 13, H - 7, MARBLE[4]).hline(2, 13, H - 8, MARBLE[3]);
  // shaft with fluting
  const top = broken ?? 8;
  for (let y = top; y < H - 8; y++)
    for (let x = 3; x < 13; x++) {
      const nx = (x + 0.5 - 8) / 5;
      let c = cyl(MARBLE, nx, x, y, 0.05);
      if (x === 5 || x === 8 || x === 11) c = MARBLE[Math.max(1, MARBLE.indexOf(c as never) - 1)];
      g.set(x, y, c);
    }
}

function pillar(): Grid {
  const g = new Grid(16, 40);
  pillarBase(g, null);
  // capital
  for (let x = 0; x < 16; x++) {
    g.set(x, 1, MARBLE[5]);
    g.set(x, 2, x === 0 ? MARBLE[4] : x === 15 ? MARBLE[2] : MARBLE[4]);
    g.set(x, 3, MARBLE[2]);
  }
  for (let y = 4; y < 7; y++)
    for (let x = 2; x < 14; x++) g.set(x, y, cyl(MARBLE, (x + 0.5 - 8) / 6, x, y, 0.1));
  g.hline(2, 13, 7, MARBLE[1]);
  // violet band with a gold boss
  for (let x = 3; x < 13; x++) g.set(x, 9, x === 7 || x === 8 ? PAL.gold : PAL.purple).set(x, 10, PAL.plum);
  g.set(7, 10, PAL.rust);
  return ink(g, 0.05);
}

function pillarBroken(): Grid {
  const g = new Grid(16, 26);
  pillarBase(g, 7);
  // jagged break
  const edge = [2, 0, 1, 3, 1, 0, 2, 4, 2, 1];
  for (let x = 3; x < 13; x++) {
    const d = edge[x - 3];
    for (let y = 7; y < 7 + d; y++) g.set(x, y, null);
    g.set(x, 7 + d, MARBLE[5]);
    g.set(x, 8 + d, MARBLE[4]);
  }
  // rubble
  for (const [x, y, s] of [
    [1, 23, 2],
    [13, 24, 2],
    [15, 22, 1],
  ] as const) {
    g.rect(x, y, s, s, MARBLE[3]);
    g.set(x, y, MARBLE[5]);
  }
  return ink(g, 0.05);
}

function brazier(frame: number): Grid {
  const g = new Grid(16, 26);
  // feet + stand
  g.rect(7, 16, 2, 7, R.iron[2]).vline(7, 16, 22, R.iron[3]);
  g.line(3, 25, 7, 21, R.iron[2]).line(12, 25, 8, 21, R.iron[1]);
  g.hline(5, 10, 23, R.iron[2]);
  // bowl
  g.ellipse(8, 13, 6.5, 3.5, (x, y, nx, ny) =>
    ny < -0.2 ? null : ramp(R.iron, sphereLight(nx, ny, 0.3) + 0.1, x, y, 0.3),
  );
  g.hline(1, 14, 12, R.iron[4]).hline(2, 13, 11, R.iron[3]);
  g.set(1, 12, R.iron[3]).set(14, 12, R.iron[2]);
  // coals
  for (let x = 3; x < 13; x++)
    g.set(x, 11, (x + frame) % 3 === 0 ? PAL.yellow : x % 2 ? PAL.orange : PAL.rust);
  // gold trim studs
  g.set(4, 14, PAL.gold).set(8, 15, PAL.gold).set(12, 14, PAL.gold);
  flame(g, 8, 10, 4.2, 10, frame, 1);
  flame(g, 5.5, 10, 2, 5, frame + 2, 3);
  flame(g, 10.5, 10, 2, 6, frame + 1, 5);
  return ink(g, 0.2);
}

function banner(): Grid {
  const g = new Grid(16, 16);
  const cloth = [PAL.plum, PAL.purple, '#8a4a90', PAL.magenta] as const;
  for (let y = 2; y < 15; y++)
    for (let x = 3; x < 13; x++) {
      // swallowtail
      if (y >= 12 && Math.abs(x + 0.5 - 8) < (y - 11) * 1.2) continue;
      const fold = [2, 2, 1, 1, 2, 3, 2, 1, 1, 2][x - 3];
      let c: Col = cloth[fold];
      if (x === 3 || x === 12) c = PAL.gold;
      if (y === 2) c = PAL.gold;
      g.set(x, y, c);
    }
  // emblem: gold eye / sunburst
  g.set(7, 5, PAL.gold).set(8, 5, PAL.gold);
  g.set(6, 6, PAL.gold).set(9, 6, PAL.gold).set(7, 6, PAL.yellow).set(8, 6, PAL.cyan);
  g.set(6, 7, PAL.gold).set(9, 7, PAL.gold).set(7, 7, PAL.yellow).set(8, 7, PAL.yellow);
  g.set(7, 8, PAL.gold).set(8, 8, PAL.gold).set(7, 9, PAL.gold).set(8, 10, PAL.gold);
  // rod
  g.hline(1, 14, 1, R.iron[3]).set(1, 1, PAL.gold).set(14, 1, PAL.gold).hline(2, 13, 0, R.iron[4]);
  return ink(g, 0.15);
}

function voidCrystal(): Grid {
  const g = new Grid(16, 26);
  const base = ['#120e1c', '#1d1630', '#2e2248', '#453868', '#6a5a90'] as const;
  g.ellipse(8, 23, 7, 2.5, (x, y, nx, ny) => ramp(base, sphereLight(nx, ny, 0.3), x, y, 0.3));
  shard(g, 3.5, 23, 8, 1.8, -1.3, base);
  shard(g, 12.5, 23, 9, 1.8, 1.2, base);
  shard(g, 8, 23, 21, 3.4, 0, AMETHYST);
  // inner glow core
  for (let y = 9; y < 20; y++) if (y % 3 !== 0) g.set(8, y, y < 14 ? '#ffd6f0' : PAL.pink);
  g.set(6, 6, PAL.white);
  // floating motes
  g.set(1, 8, PAL.magenta).set(14, 5, PAL.pink).set(13, 12, PAL.magenta);
  return ink(g, 0.05, PAL.black);
}

export const DUNGEON: PropTable = {
  crystal_small: def(12, 12, crystalSmall, {
    anchorX: 6,
    anchorY: 11,
    light: { radius: 24, color: '#2ce8f5' },
  }),
  crystal_big: def(22, 30, crystalBig, {
    anchorX: 11,
    anchorY: 28,
    collider: foot(16, 6),
    light: { radius: 48, color: '#6fd8f5' },
  }),
  stalagmite: def(12, 20, stalagmite, { anchorX: 6, anchorY: 19, collider: foot(8, 4) }),
  bones: def(14, 8, bones, { anchorX: 7, anchorY: 7 }),
  lava_rock: def(18, 14, () => basaltRock(18, 14, 5), {
    anchorX: 9,
    anchorY: 13,
    collider: foot(14, 5),
    light: { radius: 22, color: '#f77622' },
  }),
  vent: def(16, 24, vent, {
    anchorX: 8,
    anchorY: 22,
    frames: 4,
    fps: 6,
    collider: foot(12, 5),
    light: { radius: 32, color: '#f77622' },
  }),
  obsidian_spike: def(12, 20, obsidianSpike, { anchorX: 6, anchorY: 19, collider: foot(8, 4) }),
  ice_spike: def(12, 22, iceSpike, {
    anchorX: 6,
    anchorY: 21,
    collider: foot(8, 4),
    light: { radius: 20, color: '#c4ecff' },
  }),
  pillar: def(16, 40, pillar, { anchorX: 8, anchorY: 39, collider: foot(14, 6) }),
  pillar_broken: def(16, 26, pillarBroken, { anchorX: 8, anchorY: 25, collider: foot(14, 6) }),
  brazier: def(16, 26, brazier, {
    anchorX: 8,
    anchorY: 25,
    frames: 4,
    fps: 8,
    collider: foot(10, 4),
    light: { radius: 56, color: '#f77622' },
  }),
  banner: def(16, 16, banner, { anchorX: 8, anchorY: 15 }),
  void_crystal: def(16, 26, voidCrystal, {
    anchorX: 8,
    anchorY: 24,
    collider: foot(12, 5),
    light: { radius: 44, color: '#b55088' },
  }),
};
