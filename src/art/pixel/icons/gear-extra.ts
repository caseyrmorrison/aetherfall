/**
 * Extra gear icons: gloves, belts and charms (small / large / grand).
 * Same material ramps and finishing pass as the other equipment icons.
 */
import { PAL } from '../../palette';
import { Grid, mix, ramp, sphereLight } from '../env/raster';
import { finish, S } from './equip';
import type { Material } from './materials';

export function gloves(m: Material): Grid {
  const g = new Grid(S, S);
  const M = m.metal;
  const T = m.trim;
  const glove = (ox: number, dark: number): void => {
    // cuff
    for (let y = 9; y < 14; y++)
      for (let x = ox; x < ox + 5; x++) g.set(x, y, T[Math.max(0, (x === ox ? 2 : 1) - dark)]);
    g.hline(ox, ox + 4, 13, T[0]);
    // palm / back of hand
    for (let y = 4; y < 10; y++)
      for (let x = ox; x < ox + 5; x++) {
        const nx = (x + 0.5 - (ox + 2.5)) / 2.5;
        g.set(x, y, ramp(M, 0.7 - nx * 0.35 - dark * 0.25 - (y - 4) * 0.03, x, y, 0.3));
      }
    // fingers (plated knuckles)
    for (let f = 0; f < 4; f++) {
      const fx = ox + f + (f > 1 ? 1 : 0) - (f === 3 ? 1 : 0);
      g.vline(fx, 2 + (f === 0 || f === 3 ? 1 : 0), 4, M[Math.max(0, 3 - dark - (f % 2))]);
    }
    g.hline(ox, ox + 4, 5, M[Math.max(0, 1 - dark)]);
    // thumb
    g.set(ox + (dark ? 5 : -1), 6, M[2 - dark]).set(ox + (dark ? 5 : -1), 7, M[1]);
  };
  glove(8, 1);
  glove(2, 0);
  if (m.glow) g.set(4, 7, m.glow).set(10, 7, m.glow);
  return finish(g, m);
}

export function belt(m: Material): Grid {
  const g = new Grid(S, S);
  const T = m.trim;
  const L = [mix(m.grip[0], PAL.black, 0.2), m.grip[0], m.grip[1], m.grip[2]];
  // strap, slightly curved like a worn belt
  for (let x = 1; x < 15; x++) {
    const sag = Math.round(Math.abs(x - 7.5) / 4);
    const y0 = 6 - sag;
    for (let y = y0; y < y0 + 5; y++) g.set(x, y, ramp(L, 0.75 - (y - y0) * 0.14, x, y, 0.25));
    g.set(x, y0, L[3]);
    if (x % 3 === 0) g.set(x, y0 + 2, L[0]);
  }
  // buckle
  g.rect(5, 4, 6, 7, T[0]);
  g.rect(6, 5, 4, 5, (x, y, nx, ny) => ramp([T[0], T[1], T[2]], sphereLight(nx, ny, 0.3), x, y, 0.2));
  g.rect(7, 6, 2, 3, m.gem);
  g.set(7, 6, m.gemHi);
  // pouch hanging off the side
  g.rect(11, 9, 3, 4, L[1]);
  g.hline(11, 13, 9, L[3]);
  g.set(12, 10, T[2]);
  return finish(g, m);
}

type CharmSize = 'small' | 'large' | 'grand';

/** Charms: rune stones that glow with the item's material colors. */
export function charm(m: Material, size: CharmSize): Grid {
  const g = new Grid(S, S);
  const T = m.trim;
  const stone = [PAL.navy, PAL.darkSlate, PAL.slate, PAL.gray];
  const rune = m.glow ?? m.gem;
  if (size === 'small') {
    // a smooth pebble with a single rune
    g.ellipse(8, 9, 4.5, 4, (x, y, nx, ny) => ramp(stone, sphereLight(nx, ny, 0.25), x, y, 0.3));
    g.vline(8, 7, 11, rune).set(7, 8, rune).set(9, 10, rune);
    // cord loop
    g.set(7, 4, T[1]).set(8, 3, T[2]).set(9, 4, T[1]);
  } else if (size === 'large') {
    // a carved diamond talisman on a cord
    g.poly(
      [
        [8, 2],
        [13, 8],
        [8, 14],
        [3, 8],
      ],
      (x, y, nx, ny) => ramp(stone, sphereLight(nx, ny, 0.25), x, y, 0.3),
    );
    g.poly(
      [
        [8, 5],
        [10, 8],
        [8, 11],
        [6, 8],
      ],
      (x, y, nx, ny) =>
        ramp([mix(m.gem, PAL.black, 0.4), m.gem, m.gemHi], sphereLight(nx, ny, 0.25), x, y, 0.2),
    );
    g.set(7, 7, PAL.white);
    g.set(8, 1, T[2]).set(7, 1, T[1]).set(9, 1, T[1]);
  } else {
    // grand: an ornate eye idol with a framed gem
    g.rect(3, 2, 10, 12, (x, y, nx, ny) =>
      ramp(stone, sphereLight(nx, ny, 0.3) - (y > 11 ? 0.2 : 0), x, y, 0.3),
    );
    g.set(3, 2, null).set(12, 2, null).set(3, 13, null).set(12, 13, null);
    g.hline(4, 11, 2, T[2]).hline(4, 11, 13, T[0]).vline(3, 3, 12, T[1]).vline(12, 3, 12, T[0]);
    g.ellipse(8, 7.5, 3.5, 2.2, (x, y, nx, ny) =>
      ramp([mix(m.gem, PAL.black, 0.5), m.gem, m.gemHi], sphereLight(nx, ny, 0.25), x, y, 0.2),
    );
    g.set(8, 7, PAL.black).set(8, 8, PAL.black).set(7, 7, PAL.white);
    g.hline(5, 11, 11, rune).set(8, 10, rune);
  }
  return finish(g, m);
}
