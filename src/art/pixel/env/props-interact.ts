/**
 * Interactable props: chests, waypoint, save crystal, sign, boss gate, portal
 * and wall torches.
 */
import { PAL } from '../../palette';
import { R, def, foot, ink, type PropTable } from './kit';
import { flame } from './props-dungeon';
import { Grid, alpha, bayer, mix, ramp, sphereLight, type Col } from './raster';

// ----------------------------------------------------------------- chests ---

interface ChestPal {
  body: readonly Col[]; // dark → light (4)
  band: readonly Col[]; // dark → light (3)
  lock: Col;
  lockHi: Col;
  gem?: Col;
}

const CHEST_WOOD: ChestPal = {
  body: [PAL.plum, PAL.darkBrown, '#9a5b45', PAL.brown],
  band: [R.iron[1], R.iron[3], R.iron[4]],
  lock: PAL.gold,
  lockHi: PAL.yellow,
};

const CHEST_GOLD: ChestPal = {
  body: [PAL.rust, PAL.orange, PAL.gold, PAL.yellow],
  band: [PAL.plum, PAL.purple, PAL.magenta],
  lock: PAL.cyan,
  lockHi: PAL.white,
  gem: PAL.red,
};

function chest(p: ChestPal, open: boolean): Grid {
  const g = new Grid(16, 16);
  const B = p.body;
  // body (front face) y 8..14
  for (let y = 8; y < 15; y++)
    for (let x = 1; x < 15; x++) {
      let col: Col = y === 8 ? B[3] : y === 14 ? B[0] : (y - 8) % 3 === 0 ? B[1] : B[2];
      if (x === 1) col = mix(col, B[3], 0.5);
      if (x === 14) col = B[1];
      g.set(x, y, col);
    }
  // vertical bands
  for (const x of [3, 12]) for (let y = 8; y < 15; y++) g.set(x, y, y === 8 ? p.band[2] : p.band[1]);
  if (!open) {
    // closed lid: rounded top seen from above-front, y 3..8
    for (let y = 3; y < 9; y++)
      for (let x = 1; x < 15; x++) {
        const t = (y - 3) / 5;
        if (y === 3 && (x === 1 || x === 14)) continue;
        let col: Col = t < 0.2 ? B[3] : t < 0.6 ? B[2] : B[1];
        if (x === 1) col = mix(col, B[3], 0.5);
        if (x === 14) col = B[1];
        g.set(x, y, col);
      }
    for (const x of [3, 12]) for (let y = 3; y < 9; y++) g.set(x, y, y < 5 ? p.band[2] : p.band[1]);
    g.hline(1, 14, 8, p.band[0]);
    // lock plate
    g.rect(6, 7, 4, 4, p.lock);
    g.set(6, 7, p.lockHi).set(7, 9, p.band[0]).set(8, 9, p.band[0]);
    if (p.gem) g.set(7, 5, p.gem).set(8, 5, p.gem).set(7, 4, PAL.white);
  } else {
    // lid swung back (we see its dark inside), treasure glowing in the box
    for (let y = 0; y < 4; y++)
      for (let x = 1; x < 15; x++) {
        let col: Col = y === 0 ? B[2] : y === 3 ? B[0] : B[1];
        if (x === 1 || x === 14) col = B[0];
        g.set(x, y, col);
      }
    for (const x of [3, 12]) for (let y = 0; y < 4; y++) g.set(x, y, p.band[1]);
    // interior
    g.rect(2, 4, 12, 4, PAL.plum);
    g.hline(2, 13, 4, PAL.black);
    for (let x = 3; x < 13; x++) {
      g.set(x, 6, x % 3 === 0 ? PAL.yellow : PAL.gold);
      g.set(x, 7, x % 2 ? PAL.gold : PAL.orange);
    }
    g.set(5, 5, PAL.yellow).set(9, 5, PAL.white).set(10, 5, PAL.gold);
    if (p.gem) g.set(7, 6, PAL.cyan).set(11, 6, PAL.magenta);
    g.hline(1, 14, 8, p.band[0]);
    g.rect(6, 8, 4, 3, p.lock);
    g.set(6, 8, p.lockHi);
  }
  return ink(g, 0.1);
}

// ------------------------------------------------------------- waypoint ---

function waypoint(frame: number): Grid {
  const g = new Grid(16, 34);
  const S = R.stone;
  // stepped base
  g.rect(1, 29, 14, 4, S[2])
    .hline(1, 14, 29, S[4])
    .hline(1, 14, 32, S[1])
    .set(14, 30, S[1])
    .set(14, 31, S[1]);
  g.rect(3, 26, 10, 3, S[2]).hline(3, 12, 26, S[4]).set(12, 27, S[1]).set(12, 28, S[1]);
  // tapered obelisk
  for (let y = 3; y < 26; y++) {
    const t = (y - 3) / 23;
    const hw = 2.2 + t * 2.3;
    for (let x = Math.floor(8 - hw); x < Math.ceil(8 + hw); x++) {
      const nx = (x + 0.5 - 8) / hw;
      let col: Col = nx < -0.45 ? S[4] : nx < 0.35 ? S[3] : S[2];
      if (Math.abs(nx) > 0.92) col = nx < 0 ? S[3] : S[1];
      g.set(x, y, col);
    }
  }
  // pyramidion tip
  g.set(7, 1, S[4]).set(8, 1, S[3]).set(6, 2, S[4]).set(7, 2, S[4]).set(8, 2, S[3]).set(9, 2, S[2]);
  // rune (pulses through 4 brightness steps)
  const glow = [PAL.sky, PAL.cyan, '#9ff6ff', PAL.cyan][frame];
  const core = [PAL.cyan, '#9ff6ff', PAL.white, '#9ff6ff'][frame];
  const rune = ['..x..', '.x.x.', 'x.o.x', '.x.x.', '..x..', '..x..', '.xxx.'];
  g.stamp(rune, { x: glow, o: core }, 6, 10);
  // floating motes
  const my = [0, 1, 2, 1][frame];
  g.set(3, 8 - my, alpha(PAL.cyan, 0.9))
    .set(12, 14 + my, alpha(PAL.cyan, 0.8))
    .set(13, 6 - my, alpha('#9ff6ff', 0.7));
  // soft glow on the base
  g.set(6, 26, glow).set(9, 26, glow);
  return ink(g, 0.1);
}

// --------------------------------------------------------- save crystal ---

function saveCrystal(frame: number): Grid {
  const g = new Grid(16, 30);
  const S = R.stone;
  // pedestal
  g.ellipse(8, 25.5, 6.5, 2.5, (x, y, nx, ny) => ramp(S, sphereLight(nx, ny, 0.3) + 0.1, x, y, 0.2));
  g.rect(3, 26, 10, 3, S[2]).hline(3, 12, 28, S[1]).vline(3, 26, 28, S[3]).vline(12, 26, 28, S[1]);
  g.ellipse(8, 25, 4, 1.3, (x, y) => (bayer(x, y) > 0.3 ? PAL.cyan : PAL.sky));
  // floating crystal (octahedron) bobbing
  const bob = [0, -1, -2, -1][frame];
  const cy = 13 + bob;
  const cols = [PAL.blue, PAL.sky, PAL.cyan, '#9ff6ff', PAL.white] as const;
  for (let y = -8; y <= 8; y++) {
    const w = Math.round((1 - Math.abs(y) / 8.5) * 5);
    for (let x = -w; x <= w; x++) {
      let col: Col;
      if (y < 0) col = x < 0 ? cols[3] : x === 0 ? cols[4] : cols[2];
      else col = x < 0 ? cols[2] : x === 0 ? cols[3] : cols[1];
      if (y === 0) col = cols[4];
      g.set(8 + x, cy + y, col);
    }
  }
  // sparkle
  const sp = [
    [3, 6],
    [13, 9],
    [4, 17],
    [12, 3],
  ][frame];
  g.set(sp[0], sp[1] + bob, PAL.white)
    .set(sp[0] - 1, sp[1] + bob, alpha(PAL.cyan, 0.7))
    .set(sp[0] + 1, sp[1] + bob, alpha(PAL.cyan, 0.7));
  g.set(sp[0], sp[1] + bob - 1, alpha(PAL.cyan, 0.7)).set(sp[0], sp[1] + bob + 1, alpha(PAL.cyan, 0.7));
  return g.outline((inner, _x, y) =>
    y > 22 ? mix(PAL.black, inner, 0.15) : inner === PAL.white || inner.length > 7 ? undefined : '#0b1f3a',
  );
}

// ------------------------------------------------------------------- sign ---

function signpost(): Grid {
  const g = new Grid(16, 18);
  const W = R.wood;
  for (let y = 7; y < 17; y++) g.set(7, y, W[3]).set(8, y, W[1]);
  g.rect(1, 2, 14, 7, W[1]);
  g.rect(2, 3, 12, 5, W[3]);
  g.hline(2, 13, 3, W[4]);
  g.hline(3, 11, 5, W[1]).hline(4, 9, 7, W[1]).set(12, 5, W[1]);
  g.set(1, 2, null).set(14, 2, null);
  g.set(7, 17, PAL.darkGreen).set(9, 17, PAL.green).set(6, 17, PAL.forest);
  return ink(g, 0.15);
}

// -------------------------------------------------------------- boss gate ---

function bossGate(open: boolean): Grid {
  const g = new Grid(32, 34);
  const S = ['#15131f', '#262b44', '#3a4466', '#5a6988', '#7d88ab'] as const;
  // outer arch frame
  for (let y = 0; y < 34; y++)
    for (let x = 0; x < 32; x++) {
      const dx = x + 0.5 - 16;
      const archTop = 12 - Math.sqrt(Math.max(0, 16 * 16 - dx * dx)) * 0.7;
      if (y < archTop) continue;
      g.set(
        x,
        y,
        (x + Math.floor(y / 4)) % 6 === 0 || y % 4 === 3 ? S[1] : x < 4 ? S[3] : x > 27 ? S[1] : S[2],
      );
    }
  // inner doorway region
  const inDoor = (x: number, y: number) => {
    const dx = x + 0.5 - 16;
    const top = 15 - Math.sqrt(Math.max(0, 10 * 10 - dx * dx)) * 0.75;
    return Math.abs(dx) < 10 && y >= top && y < 33;
  };
  // gold trim around the opening
  for (let y = 0; y < 34; y++)
    for (let x = 0; x < 32; x++) {
      if (inDoor(x, y)) continue;
      if (inDoor(x - 1, y) || inDoor(x + 1, y) || inDoor(x, y + 1)) g.set(x, y, y < 12 ? PAL.gold : PAL.rust);
    }
  // keystone skull-ish ornament
  g.rect(14, 1, 4, 4, S[3]).set(15, 2, PAL.black).set(16, 2, PAL.black).hline(14, 17, 4, S[1]);
  for (let y = 0; y < 34; y++)
    for (let x = 0; x < 32; x++) {
      if (!inDoor(x, y)) continue;
      if (open) {
        // dark passage fading to black, faint violet mist at the floor
        let col: Col = y > 29 ? PAL.purple : y > 26 ? '#1d1630' : PAL.black;
        if (y > 26 && y <= 29 && bayer(x, y) > 0.5) col = '#2a1c42';
        if (y > 29 && bayer(x, y) > 0.6) col = '#1d1630';
        g.set(x, y, col);
      } else {
        // two heavy iron-bound doors
        let col: Col = (x - 6) % 5 === 0 ? '#2a2233' : x < 16 ? '#4a3a4a' : '#3a2a3a';
        if (y % 6 === 0) col = R.iron[3];
        if (x === 15 || x === 16) col = PAL.black;
        g.set(x, y, col);
      }
    }
  if (!open) {
    // glowing red sigil across the seam
    const sig = ['..rrrrr..', '.r..o..r.', 'r..ooo..r', 'r.o.y.o.r', 'r..ooo..r', '.r..o..r.', '..rrrrr..'];
    g.stamp(sig, { r: PAL.red, o: PAL.hotPink, y: PAL.yellow }, 12, 17);
    g.set(16, 20, PAL.white);
  }
  // pillars' plinths
  g.rect(0, 30, 6, 4, S[3]).hline(0, 5, 30, S[4]);
  g.rect(26, 30, 6, 4, S[2]).hline(26, 31, 30, S[3]);
  return ink(g, 0.05);
}

// ----------------------------------------------------------------- portal ---

function portal(frame: number): Grid {
  const g = new Grid(26, 34);
  const cx = 13;
  const cy = 15;
  const rx = 10;
  const ry = 14;
  for (let y = 0; y < 34; y++)
    for (let x = 0; x < 26; x++) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      const d = Math.hypot(nx, ny);
      if (d > 1) continue;
      const ang = Math.atan2(ny, nx);
      const swirl = ang * 2 + d * 7 - (frame * Math.PI) / 2;
      const band = (Math.sin(swirl) + 1) / 2;
      let col: Col;
      if (d > 0.88) col = band > 0.5 ? PAL.cyan : '#9ff6ff';
      else if (d > 0.72) col = band > 0.55 ? PAL.magenta : PAL.purple;
      else if (d < 0.25) col = d < 0.14 ? '#4a2a66' : '#2a1c42';
      else col = band > 0.72 ? PAL.cyan : band > 0.45 ? PAL.magenta : band > 0.2 ? PAL.purple : '#2a1c42';
      if (d < 0.5 && d >= 0.25 && band < 0.45) col = PAL.black;
      g.set(x, y, col);
    }
  // stone foot ring
  g.ellipse(13, 30.5, 9, 2.6, (x, y, nx, ny) => ramp(R.stone, sphereLight(nx, ny, 0.3), x, y, 0.3));
  g.ellipse(13, 30, 6, 1.2, PAL.purple);
  // escaping sparks
  const sp = [
    [3, 5],
    [22, 9],
    [2, 22],
    [23, 24],
  ];
  sp.forEach(([x, y], k) => {
    const ph = (frame + k) % 4;
    g.set(x, y - ph, ph < 2 ? PAL.cyan : PAL.pink);
  });
  return g;
}

// ------------------------------------------------------------ wall torch ---

function torchWall(frame: number): Grid {
  const g = new Grid(16, 16);
  // wall plate + bracket
  g.rect(6, 11, 4, 4, R.iron[1]).set(6, 11, R.iron[3]).set(7, 13, R.iron[4]);
  // handle (wrapped in a cup)
  for (let y = 7; y < 13; y++) g.set(7, y, R.wood[3]).set(8, y, R.wood[1]);
  g.hline(6, 9, 7, R.iron[3]).hline(6, 9, 8, R.iron[1]).set(5, 7, R.iron[2]).set(10, 7, R.iron[1]);
  flame(g, 7.5, 7, 3, 8, frame * 1.4, 2);
  return ink(g, 0.2);
}

export const INTERACT: PropTable = {
  chest: def(16, 16, (f) => chest(CHEST_WOOD, f === 1), {
    anchorX: 8,
    anchorY: 14,
    frames: 2,
    fps: 0,
    collider: foot(14, 6),
  }),
  chest_rare: def(16, 16, (f) => chest(CHEST_GOLD, f === 1), {
    anchorX: 8,
    anchorY: 14,
    frames: 2,
    fps: 0,
    collider: foot(14, 6),
    light: { radius: 20, color: '#feae34' },
  }),
  waypoint: def(16, 34, waypoint, {
    anchorX: 8,
    anchorY: 32,
    frames: 4,
    fps: 5,
    collider: foot(12, 4),
    light: { radius: 40, color: '#2ce8f5' },
  }),
  save_crystal: def(16, 30, saveCrystal, {
    anchorX: 8,
    anchorY: 28,
    frames: 4,
    fps: 4,
    collider: foot(10, 4),
    light: { radius: 44, color: '#2ce8f5' },
  }),
  sign: def(16, 18, signpost, { anchorX: 8, anchorY: 17, collider: foot(4, 3) }),
  boss_gate: def(32, 34, (f) => bossGate(f === 1), {
    anchorX: 16,
    anchorY: 33,
    frames: 2,
    fps: 0,
    collider: { x: -16, y: -7, w: 32, h: 8 },
    light: { radius: 36, color: '#e43b44' },
  }),
  portal: def(26, 34, portal, {
    anchorX: 13,
    anchorY: 32,
    frames: 4,
    fps: 8,
    light: { radius: 56, color: '#b55088' },
  }),
  torch_wall: def(16, 16, torchWall, {
    anchorX: 8,
    anchorY: 15,
    frames: 3,
    fps: 8,
    light: { radius: 40, color: '#feae34' },
  }),
};
