/**
 * Equipment icons, tinted per tier material.
 */
import { PAL } from '../../palette';
import { Grid, alpha, mix, ramp, sphereLight } from '../env/raster';
import type { Material } from './materials';

export const S = 16;

/** Outline + (for glowing tiers) a few soft glow pixels around the silhouette. */
export function finish(g: Grid, m: Material): Grid {
  g.outline((inner) => mix(m.outline, inner, 0.12));
  if (m.glow) {
    const src = g.clone();
    let n = 0;
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        if (src.get(x, y)) continue;
        const near = src.get(x - 1, y) || src.get(x + 1, y) || src.get(x, y - 1) || src.get(x, y + 1);
        if (near && (x * 7 + y * 3) % 13 === 0 && n < 3) {
          g.set(x, y, alpha(m.glow, 0.55));
          n++;
        }
      }
    if (!g.get(1, 1)) g.set(1, 1, alpha(m.glow, 0.85));
  }
  return g;
}

/** Diagonal blade from the tip (top-right) toward the bottom-left. */
function blade(g: Grid, m: Material, tipX: number, tipY: number, len: number, width: 2 | 3): void {
  const M = m.metal;
  for (let k = 0; k < len; k++) {
    const x = tipX - k;
    const y = tipY + k;
    if (k === 0) {
      g.set(x, y, M[4]);
      continue;
    }
    g.set(x, y, M[4]);
    g.set(x + 1, y, width === 3 ? M[3] : M[2]);
    if (width === 3) g.set(x + 2, y, M[1]);
    // fuller groove on big blades
    if (width === 3 && k > 2 && k < len - 1) g.set(x + 1, y, M[2]);
  }
}

function guard(g: Grid, m: Material, cx: number, cy: number, half: number): void {
  const T = m.trim;
  for (let i = -half; i <= half; i++) {
    g.set(cx + i, cy + i, i < 0 ? T[2] : T[1]);
    g.set(cx + i + 1, cy + i, T[0]);
  }
  g.set(cx, cy, m.gem);
}

function grip(g: Grid, m: Material, x: number, y: number, len: number): [number, number] {
  const G = m.grip;
  for (let j = 0; j < len; j++) {
    g.set(x - j, y + j, j % 2 ? G[1] : G[2]);
    g.set(x - j + 1, y + j, G[0]);
  }
  return [x - len, y + len];
}

function pommel(g: Grid, m: Material, x: number, y: number): void {
  const T = m.trim;
  g.set(x, y, T[2])
    .set(x + 1, y, T[1])
    .set(x, y + 1, T[1])
    .set(x + 1, y + 1, T[0]);
}

export function sword(m: Material): Grid {
  const g = new Grid(S, S);
  blade(g, m, 13, 2, 8, 2);
  guard(g, m, 5, 10, 2);
  const [px, py] = grip(g, m, 4, 11, 2);
  pommel(g, m, px - 1, py);
  return finish(g, m);
}

export function greatsword(m: Material): Grid {
  const g = new Grid(S, S);
  blade(g, m, 14, 1, 10, 3);
  guard(g, m, 5, 10, 3);
  const [px, py] = grip(g, m, 4, 11, 3);
  pommel(g, m, px - 1, py);
  return finish(g, m);
}

export function dagger(m: Material): Grid {
  const g = new Grid(S, S);
  blade(g, m, 12, 3, 5, 2);
  // wide swept-back guard
  const T = m.trim;
  for (const [x, y, c] of [
    [6, 6, T[2]],
    [5, 7, T[2]],
    [6, 8, T[1]],
    [7, 9, T[1]],
    [8, 10, T[0]],
    [7, 8, T[0]],
  ] as const)
    g.set(x, y, c);
  g.set(6, 7, m.gem);
  const [px, py] = grip(g, m, 5, 9, 3);
  pommel(g, m, px - 1, py);
  return finish(g, m);
}

export function staff(m: Material, tier: number): Grid {
  const g = new Grid(S, S);
  const W = tier === 0 ? m.metal : m.grip;
  // shaft
  for (let k = 0; k < 10; k++) {
    const x = 10 - k;
    const y = 5 + k;
    g.set(x, y, k % 4 === 3 ? W[1] : W[2]);
    g.set(x + 1, y, W[0]);
  }
  if (tier === 0) {
    // gnarled wooden top with a knot
    g.set(11, 4, W[3]).set(12, 3, W[3]).set(13, 2, W[4]).set(12, 2, W[2]).set(11, 3, W[2]).set(13, 3, W[1]);
    g.set(10, 3, W[3]).set(9, 2, W[3]).set(14, 1, W[3]);
    g.set(12, 4, PAL.darkGreen).set(10, 2, PAL.green);
    return finish(g, m);
  }
  // prongs holding an orb
  const T = m.trim;
  g.set(9, 4, T[2]).set(9, 3, T[2]).set(10, 2, T[1]);
  g.set(12, 6, T[1]).set(13, 6, T[0]).set(14, 5, T[0]);
  g.set(10, 5, T[1]);
  g.ellipse(12, 4, 2.6, 2.6, (x, y, nx, ny) =>
    ramp(
      [mix(m.gem, PAL.black, 0.5), m.gem, mix(m.gem, PAL.white, 0.4), m.gemHi],
      sphereLight(nx, ny, 0.3),
      x,
      y,
      0.2,
    ),
  );
  g.set(11, 3, PAL.white);
  return finish(g, m);
}

export function helm(m: Material): Grid {
  const g = new Grid(S, S);
  const M = m.metal;
  // dome
  g.ellipse(8, 8, 6, 6, (x, y, nx, ny) => (y > 9 ? undefined : ramp(M, sphereLight(nx, ny, 0.2), x, y, 0.3)));
  // cheek guards
  for (let y = 9; y < 14; y++)
    for (let x = 2; x < 14; x++) {
      if (x > 5 && x < 10 && y > 10) continue;
      const nx = (x + 0.5 - 8) / 6;
      g.set(x, y, ramp(M, 0.62 - nx * 0.45 - (y - 9) * 0.05, x, y, 0.3));
    }
  // visor slit + breathing holes
  g.hline(3, 12, 9, M[0]).hline(4, 11, 10, M[1]);
  g.set(5, 12, M[0]).set(10, 12, M[0]);
  // crest / trim
  const T = m.trim;
  g.vline(8, 2, 8, T[1]).vline(7, 2, 8, T[2]);
  g.set(7, 1, T[2]).set(8, 1, T[1]);
  g.set(2, 13, T[1]).set(13, 13, T[0]);
  if (m.glow) g.hline(4, 11, 9, m.glow);
  return finish(g, m);
}

export function armor(m: Material): Grid {
  const g = new Grid(S, S);
  const M = m.metal;
  const T = m.trim;
  // torso silhouette
  const rows: [number, number][] = [
    [4, 11], // y2 (shoulders top)
    [2, 13],
    [1, 14],
    [1, 14],
    [2, 13],
    [3, 12],
    [3, 12],
    [3, 12],
    [4, 11],
    [4, 11],
    [4, 11],
    [3, 12],
    [3, 12],
  ];
  rows.forEach(([a, b], i) => {
    const y = 2 + i;
    for (let x = a; x <= b; x++) {
      const nx = (x + 0.5 - 8) / 6;
      g.set(x, y, ramp(M, 0.66 - nx * 0.4 - i * 0.02, x, y, 0.3));
    }
  });
  // neck hole
  g.set(6, 2, null).set(7, 2, null).set(8, 2, null).set(9, 2, null).set(7, 3, null).set(8, 3, null);
  g.hline(6, 9, 3, T[1]).set(5, 2, T[2]).set(10, 2, T[1]).set(6, 4, T[1]).set(9, 4, T[0]);
  // pauldron seams
  g.set(3, 5, M[1]).set(4, 6, M[1]).set(12, 5, M[0]).set(11, 6, M[0]);
  // central ridge + belt
  g.vline(8, 5, 11, M[1]).vline(7, 5, 11, M[4]);
  g.hline(3, 12, 12, T[1]).hline(3, 12, 13, T[0]).set(7, 12, m.gem).set(8, 12, m.gem).set(7, 13, T[2]);
  return finish(g, m);
}

export function boots(m: Material): Grid {
  const g = new Grid(S, S);
  const M = m.metal;
  const T = m.trim;
  const boot = (ox: number, dark: number) => {
    // shaft
    for (let y = 3; y < 11; y++)
      for (let x = ox; x < ox + 4; x++)
        g.set(x, y, M[Math.max(0, (x === ox ? 3 : x === ox + 3 ? 1 : 2) - dark)]);
    // foot
    for (let y = 10; y < 13; y++)
      for (let x = ox; x < ox + 7; x++) g.set(x, y, M[Math.max(0, (y === 10 ? 3 : 2) - dark)]);
    g.set(ox + 6, 10, null);
    // sole
    g.hline(ox, ox + 6, 13, M[0]);
    // cuff
    g.hline(ox, ox + 3, 3, T[2 - dark]).hline(ox, ox + 3, 4, T[1 - dark]);
    g.set(ox + 1, 8, M[Math.max(0, 1 - dark)]);
  };
  boot(6, 1);
  boot(2, 0);
  return finish(g, m);
}

export function ring(m: Material): Grid {
  const g = new Grid(S, S);
  const T = m.trim;
  const band = [mix(T[0], PAL.black, 0.3), T[0], T[1], T[2]];
  g.ellipse(8, 10, 5.5, 4.5, (x, y, nx, ny) => {
    const d = Math.hypot(nx, ny);
    if (d < 0.62) return undefined;
    return ramp(band, sphereLight(nx, ny, 0.25), x, y, 0.3);
  });
  // setting + gem
  g.rect(6, 3, 4, 3, T[1]);
  g.ellipse(8, 4.5, 2.2, 2.2, (x, y, nx, ny) =>
    ramp([mix(m.gem, PAL.black, 0.45), m.gem, m.gemHi], sphereLight(nx, ny, 0.25), x, y, 0.2),
  );
  g.set(7, 3, PAL.white);
  return finish(g, m);
}

export function amulet(m: Material): Grid {
  const g = new Grid(S, S);
  const T = m.trim;
  // chain (beads in a V)
  for (let i = 0; i < 6; i++) {
    g.set(2 + i, 1 + i, i % 2 ? T[0] : T[2]);
    g.set(13 - i, 1 + i, i % 2 ? T[0] : T[1]);
  }
  // pendant frame
  g.ellipse(8, 10.5, 4, 4, (x, y, nx, ny) => ramp([T[0], T[1], T[2]], sphereLight(nx, ny, 0.3), x, y, 0.2));
  g.ellipse(8, 10.5, 2.4, 2.4, (x, y, nx, ny) =>
    ramp([mix(m.gem, PAL.black, 0.5), m.gem, m.gemHi], sphereLight(nx, ny, 0.25), x, y, 0.2),
  );
  g.set(7, 9, PAL.white);
  g.set(8, 15, T[1]).set(8, 6, T[2]);
  return finish(g, m);
}
