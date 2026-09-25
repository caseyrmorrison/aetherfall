/**
 * Close-up of Kai lying in the grass at night; his eyes slowly open (~2.5s),
 * cyan shard-light glinting in them.
 */
import { C, HEX } from '../pal';
import { Raster, bayer } from '../raster';
import { renderBust } from '../face';
import { kai } from '../characters/kai';
import { blit, blitC, fade, glow, layer, lut, sparkleSprite } from './kit';
import { drawMotes, makeMotes, rays } from './scenery';
import { rng, smooth } from '../geom';

const MOTES = makeMotes(71, 26, [C.cyan, C.cyan, C.white, C.sky]);
const frontMasks = new Map<number, Raster>();

/** Night palette: darken & cool everything. */
export const NIGHT = lut((i) => {
  const m: Record<number, number> = {
    [C.skin]: C.skinShade,
    [C.skinShade]: C.darkBrown,
    [C.darkBrown]: C.plum,
    [C.brown]: C.darkBrown,
    [C.tan]: C.brown,
    [C.red]: C.darkRed,
    [C.darkRed]: C.plum,
    [C.pink]: C.darkRed,
    [C.blue]: C.navy,
    [C.navy]: C.black,
    [C.darkSlate]: C.navy,
    [C.slate]: C.darkSlate,
    [C.gray]: C.slate,
    [C.lightGray]: C.gray,
    [C.white]: C.lightGray,
    [C.gold]: C.orange,
    [C.yellow]: C.gold,
    [C.skinLine]: C.darkBrown,
    [C.blush]: C.skinShade,
    [C.green]: C.darkGreen,
    [C.darkGreen]: C.forest,
    [C.forest]: C.deepTeal,
  };
  return m[i] ?? i;
});

/** Keep original colors near (lx, ly) and fade (dithered) to the `dark` LUT further away. */
export function lightFalloff(
  r: Raster,
  dark: Uint8Array,
  lx: number,
  ly: number,
  R: number,
  inner = 0,
): void {
  const d = r.data;
  for (let y = 0; y < r.h; y++) {
    for (let x = 0; x < r.w; x++) {
      const i = y * r.w + x;
      const v = d[i];
      if (!v) continue;
      const t = (Math.hypot(x - lx, y - ly) - inner) / R;
      if (t <= 0) continue;
      if (t >= 1 || bayer(x, y) < t) d[i] = dark[v];
    }
  }
}

function place(r: Raster, w: number): void {
  r.place(3.7, 0.32, 51, 52, w / 2 - 6, 118);
}

const LX = (w: number): number => w / 2 + 150;
const LY = 236;

function eyeLevel(t: number): number {
  if (t < 0.8) return 0;
  if (t < 1.35) return smooth((t - 0.8) / 0.55) * 0.35;
  if (t < 1.65) return 0.35 - smooth((t - 1.35) / 0.3) * 0.25;
  if (t < 2.7) return 0.1 + smooth((t - 1.65) / 1.05) * 0.9;
  // occasional slow blink afterwards
  const b = (t - 2.7) % 4.2;
  if (b > 3.9) return 0.2;
  return 1;
}

export function drawKaiAwakens(ctx: CanvasRenderingContext2D, t: number, w: number, h: number): void {
  const lx = LX(w);
  // grass background (static)
  const bg = layer('awake/bg', w, h, (r) => {
    const rand = rng(5);
    r.rectPx(0, 0, w, h, (x, y) => ((x * 7 + y * 13) % 11 === 0 ? C.forest : C.deepTeal));
    for (let i = 0; i < w * 3.2; i++) {
      const x = rand() * w;
      const y = rand() * (h + 20);
      const len = 6 + rand() * 16;
      const a = -Math.PI / 2 + 0.4 + (rand() - 0.5) * 0.9;
      const near = Math.hypot(x - lx, y - LY) < 150;
      const col = rand() > 0.7 ? (near ? C.green : C.darkGreen) : near ? C.darkGreen : C.forest;
      r.linePx(
        [
          x,
          y,
          x + Math.cos(a) * len * 0.5 + 1,
          y + Math.sin(a) * len * 0.5,
          x + Math.cos(a) * len,
          y + Math.sin(a) * len,
        ],
        col,
      );
    }
    lightFalloff(r, NIGHT, lx, LY, 60, 110);
    // cool shadow where the head lies
    r.with({}, () => {
      r.setTransform(1, 0, 0);
      r.ellipse(w / 2 - 6, 150, 140, 110, (x, y) => (bayer(x, y) < 0.5 ? C.black : r.data[y * r.w + x]));
    });
  });
  blit(ctx, bg);

  // Kai (static base with eyes closed)
  const base = layer('awake/kai', w, h, (r) => {
    place(r, w);
    const L = renderBust(r, kai, 'neutral', { eyeOpen: 0, windX: 0 });
    frontMasks.set(w, L.front);
    r.rim(C.cyan, 1, 0);
    r.rim(C.cyan, 0, 1);
    lightFalloff(r, NIGHT, lx, LY, 36, 150);
  });
  blit(ctx, base);

  // eye overlay for the current openness (quantized to 6 levels)
  const lvl = Math.round(eyeLevel(t) * 5);
  if (lvl > 0) {
    const eyes = layer(`awake/eyes${lvl}`, w, h, (r) => {
      place(r, w);
      const L = renderBust(r, kai, 'neutral', { eyeOpen: lvl / 5, eyesOnly: true, eyeGlow: C.cyan });
      let fm = frontMasks.get(w);
      if (!fm) {
        const tmp = new Raster(w, h);
        place(tmp, w);
        fm = renderBust(tmp, kai, 'neutral', { eyeOpen: 0 }).front;
        frontMasks.set(w, fm);
      }
      const f = L.feat.data;
      const m = fm.data;
      for (let i = 0; i < f.length; i++) if (m[i]) f[i] = 0;
      r.over(L.feat);
      lightFalloff(r, NIGHT, lx, LY, 36, 150);
    });
    blit(ctx, eyes);
    if (lvl >= 4) {
      // cyan glint in the eyes
      const tw = (Math.sin(t * 5) + 1) / 2;
      if (tw > 0.4) {
        const pts = eyeGlints(w);
        for (const [x, y] of pts) blitC(ctx, sparkleSprite(tw > 0.8 ? 3 : 2, C.cyan), x, y);
      }
    }
  }

  // the shard lying in the grass, glowing
  const pulse = (Math.sin(t * 2.2) + 1) / 2;
  rays(ctx, lx, LY, 8, 8, 70 + pulse * 10, t * 0.2, C.cyan, 3, 0.09, 12, w, h);
  blitC(ctx, glow(26 + Math.round(pulse * 2) * 2, [C.white, C.cyan, C.sky, C.blue]), lx, LY);
  ctx.fillStyle = HEX[C.white];
  ctx.fillRect(lx - 1, LY - 5, 2, 9);
  ctx.fillStyle = HEX[C.cyan];
  ctx.fillRect(lx - 2, LY - 2, 1, 4);
  ctx.fillRect(lx + 1, LY - 3, 1, 5);

  // swaying foreground grass
  const fi = Math.floor(t * 6) % 6;
  const fg = layer(`awake/fg${fi}`, w, h, (r) => {
    const rand = rng(33);
    const ph = (fi / 6) * Math.PI * 2;
    for (let i = 0; i < 70; i++) {
      const zone = rand();
      let x: number;
      let y: number;
      if (zone < 0.6) {
        x = rand() * w;
        y = h + 2 - rand() * 10;
      } else if (zone < 0.8) {
        x = rand() * 60;
        y = h - rand() * 120;
      } else {
        x = w - rand() * 60;
        y = h - rand() * 150;
      }
      const len = 10 + rand() * 22;
      const a = -Math.PI / 2 + (rand() - 0.5) * 0.9;
      const bend = Math.sin(ph + i * 0.7) * 2.2;
      const col = rand() > 0.55 ? C.black : rand() > 0.5 ? C.deepTeal : C.forest;
      r.stroke(
        [
          x,
          y,
          x + Math.cos(a) * len * 0.5 + bend * 0.4,
          y + Math.sin(a) * len * 0.5,
          x + Math.cos(a) * len + bend,
          y + Math.sin(a) * len,
        ],
        3.2,
        0.8,
        col,
      );
    }
  });
  blit(ctx, fg);

  drawMotes(ctx, MOTES, t, w, h, -1, 4, 60);

  // fade in from black at the start
  if (t < 0.8) fade(ctx, C.black, 1 - t / 0.8, 0, 0, w, h);
}

function eyeGlints(w: number): [number, number][] {
  const r = new Raster(1, 1);
  place(r, w);
  // iris highlight positions in design space (near / far eye)
  return [
    [r.X(40.5, 48), r.Y(40.5, 48)],
    [r.X(65, 48), r.Y(65, 48)],
  ];
}
