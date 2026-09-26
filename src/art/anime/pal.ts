/**
 * Indexed palette for the anime renderer. Index 0 is transparent; the rest is
 * ENDESGA-32 (`PAL`) plus a handful of extra shades the portraits and
 * illustrations genuinely need (ice hair ramp, pale skin, flashback monotone).
 */
import { PAL } from '../palette';

const EXTRA = {
  /** Softer skin line used for inner facial lines on warm skin. */
  skinLine: '#9a5745',
  blush: '#ee8f86',
  /** Fair skin (Lyra). */
  fair: '#f5d0b5',
  fairShade: '#db9f83',
  paleSkin: '#f6dccb',
  paleShade: '#d9a996',
  /** Ice-blue hair ramp (Seraphine). */
  ice0: '#eefbff',
  ice1: '#b4e4f0',
  ice2: '#7fb6d6',
  ice3: '#4f7aa8',
  /** Deep void purple for Malachar's energy. */
  void0: '#2a1633',
  /** Muted blue-sepia ramp for flashbacks (dark → light). */
  mem0: '#1b1f2e',
  mem1: '#2e3649',
  mem2: '#4a5670',
  mem3: '#72809a',
  mem4: '#a0abbf',
  mem5: '#cfd5df',
  mem6: '#f1efe9',
  /** Warm accents inside the flashback ramp. */
  memWarm1: '#8f8177',
  memWarm2: '#c7b8a8',
  memWarm3: '#e9ddcf',
  /** Warm platinum hair ramp (Aurelian), light → dark. */
  plat0: '#fdf8ea',
  plat1: '#e8dcc0',
  plat2: '#c2ad8a',
  plat3: '#8a7560',
  /** Deep brown skin (Tessaly). */
  umber: '#8f5a43',
  umberShade: '#663b33',
} as const;

export type ColorName = keyof typeof PAL | keyof typeof EXTRA;

const entries: [string, string][] = [['none', '#000000'], ...Object.entries(PAL), ...Object.entries(EXTRA)];

/** Palette index by name. `C.none` (0) is transparent. */
export const C = {} as Record<ColorName | 'none', number>;
/** Hex color by palette index. */
export const HEX: string[] = [];
/** RGBA (little-endian ABGR uint32, for ImageData Uint32 views) by palette index. */
export const RGBA = new Uint32Array(entries.length);
/** [r, g, b] by palette index. */
export const RGB: [number, number, number][] = [];

entries.forEach(([name, hex], i) => {
  (C as Record<string, number>)[name] = i;
  HEX[i] = hex;
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  RGB[i] = [r, g, b];
  RGBA[i] = i === 0 ? 0 : ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
});

export const PALETTE_SIZE = entries.length;

/** Nearest palette index (perceptually weighted RGB), optionally restricted to a subset. */
export function nearest(r: number, g: number, b: number, subset?: readonly number[]): number {
  let best = 1;
  let bd = Infinity;
  const list = subset ?? null;
  const n = list ? list.length : PALETTE_SIZE;
  for (let k = list ? 0 : 1; k < n; k++) {
    const i = list ? list[k] : k;
    const c = RGB[i];
    const dr = r - c[0];
    const dg = g - c[1];
    const db = b - c[2];
    const rm = (r + c[0]) / 2;
    const d = (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return best;
}

/** Luminance (0..1) of a palette index. */
export function lum(i: number): number {
  const c = RGB[i];
  return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255;
}
