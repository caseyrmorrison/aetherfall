/**
 * Consumable and material icons.
 */
import { PAL } from '../../palette';
import { shard, flame } from '../env/props-dungeon';
import { Grid, alpha, mix, ramp, sphereLight, type Col } from '../env/raster';

const S = 16;
const INK = PAL.black;

function done(g: Grid, ink: Col = INK): Grid {
  return g.outline((inner) => mix(ink, inner, 0.12));
}

/** Sparkle: 4-point star centred at (x, y). */
export function sparkle(
  g: Grid,
  x: number,
  y: number,
  c: Col = PAL.white,
  arm: Col = alpha(PAL.cyan, 0.8),
  big = false,
): void {
  g.set(x, y, c);
  g.set(x - 1, y, arm)
    .set(x + 1, y, arm)
    .set(x, y - 1, arm)
    .set(x, y + 1, arm);
  if (big)
    g.set(x - 2, y, alpha(arm, 0.5))
      .set(x + 2, y, alpha(arm, 0.5))
      .set(x, y - 2, alpha(arm, 0.5))
      .set(x, y + 2, alpha(arm, 0.5));
}

// ----------------------------------------------------------------- potions --

function potion(liquid: readonly [Col, Col, Col, Col]): Grid {
  const g = new Grid(S, S);
  const glass = ['#8b9bb4', '#c0cbdc', '#e6ecf4'];
  // body
  g.ellipse(8, 10, 5, 4.6, (x, y, nx, ny) => {
    if (ny < -0.15) return nx < -0.4 ? glass[2] : glass[1];
    return ramp(liquid, sphereLight(nx, ny, 0.3) + 0.1, x, y, 0.3);
  });
  // surface line
  for (let x = 4; x < 13; x++) if (g.get(x, 9)) g.set(x, 9, liquid[3]);
  // neck + cork
  g.rect(7, 3, 2, 3, glass[1]).set(7, 3, glass[2]);
  g.rect(6, 1, 4, 2, PAL.brown).hline(6, 9, 1, PAL.tan).set(9, 2, PAL.darkBrown);
  // glints
  g.set(5, 8, PAL.white).set(4, 10, PAL.white).set(5, 11, alpha(PAL.white, 0.7));
  return done(g, '#1a1830');
}

function elixir(): Grid {
  const g = new Grid(S, S);
  const liq = [PAL.purple, PAL.magenta, PAL.pink, '#ffd6f0'] as const;
  // tall bottle
  for (let y = 5; y < 15; y++)
    for (let x = 4; x < 12; x++) {
      if ((y === 5 || y === 14) && (x === 4 || x === 11)) continue;
      const nx = (x + 0.5 - 8) / 4;
      g.set(x, y, y < 7 ? (nx < -0.3 ? '#e6ecf4' : '#c0cbdc') : ramp(liq, 0.7 - nx * 0.45, x, y, 0.3));
    }
  // gold label band + star
  g.hline(4, 11, 10, PAL.gold).hline(4, 11, 11, PAL.rust);
  g.set(7, 10, PAL.yellow).set(8, 10, PAL.white);
  // neck & gold cap
  g.rect(6, 2, 4, 3, PAL.gold).hline(6, 9, 2, PAL.yellow).set(9, 3, PAL.rust).set(9, 4, PAL.rust);
  g.rect(7, 0, 2, 2, PAL.gold).set(7, 0, PAL.yellow);
  // sparkles in the liquid
  g.set(6, 8, PAL.white).set(9, 13, PAL.yellow).set(5, 12, '#ffd6f0');
  return done(g, '#1a0b24');
}

function phoenix(): Grid {
  const g = new Grid(S, S);
  const ax = 2.5;
  const ay = 13.5;
  const bx = 13.5;
  const by = 1.5;
  const L = Math.hypot(bx - ax, by - ay);
  const ux = (bx - ax) / L;
  const uy = (by - ay) / L;
  const cols = [PAL.darkRed, PAL.red, PAL.orange, PAL.gold, PAL.yellow] as const;
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const px = x + 0.5 - ax;
      const py = y + 0.5 - ay;
      const t = (px * ux + py * uy) / L;
      const d = px * -uy + py * ux; // signed perpendicular (negative = upper-left side)
      if (t < 0.18 || t > 1.02) continue;
      const w = Math.pow(Math.sin(Math.PI * Math.min(1, (t - 0.18) / 0.84)), 0.6) * 3.4;
      if (Math.abs(d) > w) continue;
      let l = 0.35 + t * 0.55 + (d < 0 ? 0.15 : -0.1);
      // barbs
      if (Math.round((t * L + d * 0.8) * 0.9) % 3 === 0) l -= 0.18;
      g.set(x, y, ramp(cols, l, x, y, 0.3));
    }
  // quill
  g.line(2, 14, 11, 5, (_x, _y, t) => (t < 0.35 ? PAL.sand : alpha(PAL.white, 0.85)));
  g.set(1, 15, PAL.tan);
  g.set(12, 3, PAL.white);
  return done(g, '#2a0f14');
}

function dust(): Grid {
  const g = new Grid(S, S);
  const cols = [PAL.purple, PAL.magenta, PAL.pink, '#ffd6f0'] as const;
  g.ellipse(8, 12.5, 6.2, 3.2, (x, y, nx, ny) =>
    ny < -1
      ? undefined
      : ramp(cols, sphereLight(nx, ny, 0.3) + ((x * 5 + y * 3) % 7 === 0 ? 0.25 : 0), x, y, 0.5),
  );
  g.set(6, 11, PAL.cyan).set(10, 12, PAL.cyan).set(8, 10, PAL.white).set(4, 13, '#9ff6ff');
  const d = done(g, '#1a0b24');
  sparkle(d, 4, 5, PAL.white, alpha(PAL.pink, 0.8));
  sparkle(d, 11, 3, PAL.white, alpha(PAL.cyan, 0.85), true);
  d.set(8, 7, PAL.cyan).set(13, 8, PAL.pink);
  return d;
}

function skyShard(): Grid {
  const g = new Grid(S, S);
  shard(g, 8, 14, 12, 3.2, 0.5, [PAL.blue, PAL.sky, PAL.cyan, '#9ff6ff', PAL.white]);
  const d = done(g, '#0b1f3a');
  sparkle(d, 3, 4, PAL.white, alpha(PAL.cyan, 0.8));
  sparkle(d, 13, 9, PAL.white, alpha(PAL.cyan, 0.7));
  d.set(2, 11, alpha(PAL.cyan, 0.6)).set(14, 3, alpha(PAL.cyan, 0.6));
  return d;
}

function key(): Grid {
  const g = new Grid(S, S);
  const G = [PAL.rust, PAL.gold, PAL.yellow] as const;
  // bow
  g.ellipse(5, 5, 3.6, 3.6, (x, y, nx, ny) =>
    Math.hypot(nx, ny) < 0.45 ? undefined : ramp(G, sphereLight(nx, ny, 0.3), x, y, 0.2),
  );
  // shaft
  for (let k = 0; k < 8; k++) {
    g.set(7 + k, 7 + k, G[2]);
    g.set(8 + k, 7 + k, G[0]);
  }
  // bit teeth
  g.set(11, 13, G[1]).set(10, 14, G[1]).set(13, 11, G[1]).set(14, 10, G[0]);
  g.set(3, 3, PAL.white);
  return done(g, '#2a1a10');
}

function coins(): Grid {
  const g = new Grid(S, S);
  const coin = (cx: number, y: number) => {
    g.ellipse(cx, y + 1.5, 3.5, 1.2, PAL.rust);
    g.ellipse(cx, y + 0.5, 3.5, 1.2, (_x, _yy, nx) => (nx < -0.2 ? PAL.yellow : PAL.gold));
  };
  for (let i = 0; i < 4; i++) coin(10.5, 11 - i * 2);
  for (let i = 0; i < 3; i++) coin(5, 12 - i * 2);
  // lying coin at the front
  g.ellipse(8, 13.5, 3.6, 1.6, (_x, _y, nx) => (nx < -0.3 ? PAL.yellow : PAL.gold));
  g.set(8, 13, PAL.rust);
  g.set(9, 4, PAL.white).set(4, 7, PAL.white);
  return done(g, '#2a1a10');
}

function letter(): Grid {
  const g = new Grid(S, S);
  for (let y = 4; y < 13; y++) for (let x = 1; x < 15; x++) g.set(x, y, y === 12 ? '#d9bb8f' : PAL.sand);
  // flap
  g.line(1, 4, 8, 9, PAL.tan);
  g.line(14, 4, 8, 9, PAL.tan);
  g.line(1, 12, 6, 8, '#d9bb8f');
  g.line(14, 12, 10, 8, '#d9bb8f');
  // wax seal
  g.ellipse(8, 9, 2, 2, (x, y, nx, ny) =>
    ramp([PAL.darkRed, PAL.red, PAL.pink], sphereLight(nx, ny, 0.3), x, y, 0.2),
  );
  return done(g, PAL.plum);
}

function herb(): Grid {
  const g = new Grid(S, S);
  const L = [PAL.forest, PAL.darkGreen, PAL.green, '#9cd455'] as const;
  const leaf = (cx: number, cy: number, rx: number, ry: number, rot: number) => {
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        const u = dx * Math.cos(rot) + dy * Math.sin(rot);
        const v = -dx * Math.sin(rot) + dy * Math.cos(rot);
        const q = (u / rx) ** 2 + (v / ry) ** 2;
        if (q > 1) continue;
        g.set(x, y, Math.abs(v) < 0.5 ? L[3] : ramp(L, 0.7 - (v / ry) * 0.4 - (u / rx) * 0.15, x, y, 0.3));
      }
  };
  // stem
  g.line(7, 15, 8, 6, PAL.darkGreen);
  leaf(5, 8, 4, 1.8, -0.9);
  leaf(11, 7, 4, 1.8, -2.3);
  leaf(8, 3.5, 3, 1.6, -1.57);
  leaf(5, 12, 3, 1.4, -0.5);
  g.set(8, 1, PAL.white).set(9, 2, PAL.pink);
  return done(g, '#0f2418');
}

function pelt(): Grid {
  const g = new Grid(S, S);
  const F = [PAL.darkBrown, '#8f5a44', PAL.brown, PAL.tan] as const;
  g.ellipse(8, 8, 5.5, 5, (x, y, nx, ny) => ramp(F, sphereLight(nx, ny, 0.3) + 0.1, x, y, 0.4));
  // legs / tail flaps
  for (const [x, y] of [
    [2, 3],
    [13, 3],
    [2, 12],
    [13, 12],
  ] as const)
    g.rect(x - (x < 8 ? 0 : 1), y - (y < 8 ? 0 : 1), 2, 2, F[1]);
  g.set(8, 14, F[1]).set(8, 15, F[0]);
  // fur tufts & stripes
  for (let x = 4; x < 12; x += 2) g.set(x, 6 + (x % 4 === 0 ? 1 : 0), F[0]);
  g.set(6, 10, F[3]).set(9, 9, F[3]).set(7, 5, F[3]);
  return done(g, PAL.plum);
}

function crystal(): Grid {
  const g = new Grid(S, S);
  const C = [PAL.blue, PAL.sky, PAL.cyan, '#9ff6ff', PAL.white] as const;
  shard(g, 4.5, 14, 7, 2, -1, C);
  shard(g, 11.5, 14, 8, 2, 1, C);
  shard(g, 8, 14, 12, 2.8, 0, C);
  return done(g, '#0b1f3a');
}

function ember(): Grid {
  const g = new Grid(S, S);
  flame(g, 8, 12, 4.2, 10, 1, 4);
  g.ellipse(8, 12.5, 4, 2.2, (x, y, nx, ny) =>
    ramp([PAL.darkRed, PAL.rust, PAL.orange, PAL.gold], sphereLight(nx, ny, 0.3), x, y, 0.3),
  );
  g.set(7, 12, PAL.yellow).set(9, 13, PAL.yellow);
  return done(g, '#2a0f14');
}

function frost(): Grid {
  const g = new Grid(S, S);
  const c = [PAL.sky, '#9fdcf7', PAL.white] as const;
  const arms = 6;
  for (let a = 0; a < arms; a++) {
    const ang = (a / arms) * Math.PI * 2 - Math.PI / 2;
    for (let r = 0; r <= 6; r++) {
      const x = Math.round(8 + Math.cos(ang) * r - 0.5);
      const y = Math.round(8 + Math.sin(ang) * r - 0.5);
      g.set(x, y, r > 4 ? c[1] : c[2]);
      if (r === 4) {
        for (const s of [-1, 1]) {
          const b = ang + s * 0.8;
          g.set(Math.round(x + Math.cos(b) * 1.6), Math.round(y + Math.sin(b) * 1.6), c[0]);
        }
      }
    }
  }
  g.set(7, 7, PAL.cyan).set(8, 8, PAL.white);
  return done(g, '#0b1f3a');
}

function voidOrb(): Grid {
  const g = new Grid(S, S);
  g.ellipse(8, 8, 6, 6, (_x, _y, nx, ny) => {
    const d = Math.hypot(nx, ny);
    const ang = Math.atan2(ny, nx);
    const sw = Math.sin(ang * 2 + d * 6);
    if (d > 0.82) return nx + ny < -0.3 ? PAL.magenta : PAL.purple;
    if (sw > 0.55) return d < 0.5 ? PAL.magenta : PAL.purple;
    return d < 0.35 ? '#2a1c42' : PAL.black;
  });
  g.set(5, 5, PAL.pink).set(6, 4, '#ffd6f0');
  const d = done(g, PAL.black);
  d.set(14, 3, alpha(PAL.magenta, 0.8)).set(2, 13, alpha(PAL.cyan, 0.7));
  return d;
}

export const ITEM_ICONS = {
  icon_potion_hp: () => potion([PAL.darkRed, PAL.red, PAL.pink, '#ffb3b8']),
  icon_potion_mp: () => potion([PAL.navy, PAL.blue, PAL.sky, '#9fdcf7']),
  icon_elixir: elixir,
  icon_phoenix: phoenix,
  icon_dust: dust,
  icon_shard: skyShard,
  icon_key: key,
  icon_gold: coins,
  icon_letter: letter,
  icon_herb: herb,
  icon_pelt: pelt,
  icon_crystal: crystal,
  icon_ember: ember,
  icon_frost: frost,
  icon_void: voidOrb,
} as const;
