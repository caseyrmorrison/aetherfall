/**
 * Gem icons: five gem types across eight qualities. Low qualities are small rough
 * shards; higher ones get cleaner cuts, then sparkles, a gold setting and a crown.
 */
import { Grid, ramp } from '../env/raster';

export type GemArtType = 'ruby' | 'emerald' | 'topaz' | 'amethyst' | 'diamond';

const RAMPS: Record<GemArtType, { cols: readonly string[]; outline: string; glint: string }> = {
  ruby: { cols: ['#a22633', '#e43b44', '#f6757a', '#ffffff'], outline: '#3e2731', glint: '#ffffff' },
  emerald: { cols: ['#265c42', '#3e8948', '#63c74d', '#d4f5c4'], outline: '#193c3e', glint: '#ffffff' },
  topaz: { cols: ['#be4a2f', '#f77622', '#feae34', '#fee761'], outline: '#733e39', glint: '#ffffff' },
  amethyst: { cols: ['#68386c', '#b55088', '#e08ad0', '#ffffff'], outline: '#3e2731', glint: '#ffffff' },
  diamond: { cols: ['#5a6988', '#8b9bb4', '#c0cbdc', '#ffffff'], outline: '#262b44', glint: '#2ce8f5' },
};

const GOLD = ['#733e39', '#be4a2f', '#feae34', '#fee761'];

/** Brightness of a cut facet, lit from the top-left; the flat table on top is bright. */
function facet(nx: number, ny: number, table = 0.42): number {
  if (Math.hypot(nx, ny) < table) return 0.78;
  const k = Math.round(Math.atan2(ny, nx) / (Math.PI / 4));
  const fa = (k * Math.PI) / 4;
  return 0.5 - 0.42 * (Math.cos(fa) * 0.6 + Math.sin(fa) * 0.8);
}

/** An octagon centred on (cx, cy) with half-size r and corner cut c. */
function octagon(cx: number, cy: number, rx: number, ry: number, c: number): [number, number][] {
  return [
    [cx - rx + c, cy - ry],
    [cx + rx - c, cy - ry],
    [cx + rx, cy - ry + c],
    [cx + rx, cy + ry - c],
    [cx + rx - c, cy + ry],
    [cx - rx + c, cy + ry],
    [cx - rx, cy + ry - c],
    [cx - rx, cy - ry + c],
  ];
}

function sparkle(g: Grid, x: number, y: number, c: string, big = false): void {
  g.set(x, y, '#ffffff')
    .set(x - 1, y, c)
    .set(x + 1, y, c)
    .set(x, y - 1, c)
    .set(x, y + 1, c);
  if (big)
    g.set(x - 2, y, c)
      .set(x + 2, y, c)
      .set(x, y - 2, c)
      .set(x, y + 2, c);
}

export function gem(type: GemArtType, q: number): Grid {
  const g = new Grid(16, 16);
  const { cols, outline, glint } = RAMPS[type];
  const paint =
    (table = 0.42) =>
    (x: number, y: number, nx: number, ny: number) =>
      ramp(cols, facet(nx, ny, table), x, y, 0);
  switch (q) {
    case 0: // Chipped: a rough little shard
      g.poly(
        [
          [6, 8],
          [9, 6],
          [11, 8],
          [10, 11],
          [7, 11],
        ],
        paint(0.3),
      );
      break;
    case 1: // Flawed: a small stone with a crack
      g.ellipse(8.5, 9, 3.2, 3, paint(0.35));
      g.set(8, 8, cols[0]).set(9, 9, cols[0]).set(9, 10, cols[0]);
      break;
    case 2: // plain: a round brilliant cut
      g.ellipse(8, 8.5, 4.2, 4, paint());
      break;
    case 3: // Flawless: a clean octagon
      g.poly(octagon(8, 8.5, 4.6, 4.6, 2), paint());
      break;
    case 4: // Perfect: a square step cut
    case 5: {
      // Radiant: bigger, with sparkles
      const r = q === 4 ? 4.6 : 5.2;
      g.poly(octagon(8, 8.5, r, r, 1.4), paint(0.1));
      g.rect(6, 6, 5, 5, (x, y, nx, ny) => ramp(cols, 0.62 - (nx + ny) * 0.14, x, y, 0));
      break;
    }
    case 6: // Imperial: a large cushion cut in a gold prong setting
    default: {
      const top = q >= 7 ? 5 : 2;
      g.poly(octagon(8, top + 6.2, 5.6, q >= 7 ? 4.8 : 5.4, 2.4), paint(0.38));
      const cy = top + 6.2;
      for (const [px, py] of [
        [3, cy - 4],
        [12, cy - 4],
        [3, cy + 3.5],
        [12, cy + 3.5],
      ] as const)
        g.set(px, py, GOLD[2]).set(px, py + 1, GOLD[1]);
      if (q >= 7) {
        // Royal: a tiny gold crown on top
        g.hline(5, 10, 3, GOLD[1]).hline(5, 10, 2, GOLD[2]);
        g.set(5, 1, GOLD[3]).set(7, 0, GOLD[3]).set(8, 0, GOLD[3]).set(10, 1, GOLD[3]);
        g.set(7, 1, GOLD[2]).set(8, 1, GOLD[2]).set(7, 2, '#e43b44');
      }
      break;
    }
  }
  g.outline(outline);
  // glints go on after the outline so they sparkle over it
  if (q >= 2) g.set(6, q >= 6 ? 6 : 7, '#ffffff');
  if (q >= 5) sparkle(g, 13, 3, glint);
  if (q >= 6) sparkle(g, 2, 13, glint);
  if (q >= 7) sparkle(g, 13, 12, glint, false);
  return g;
}
