/** Havenbrook — the hand-laid hub town. Built in code for readability and easy tweaking. */
import type { PropId } from '../art/pixel/types';
import { ZONES } from '../data/zones';
import { RNG } from '../engine/rng';
import {
  CELL,
  GROUND,
  TILE,
  type BuildingKind,
  type MapData,
  type MapObject,
  type PropPlacement,
} from './mapdata';

const W = 46;
const H = 38;

export function buildTown(): MapData {
  const cells = new Uint8Array(W * H).fill(CELL.Floor);
  const ground = new Uint8Array(W * H);
  const rng = new RNG('havenbrook');
  const idx = (x: number, y: number): number => y * W + x;
  const setCell = (x: number, y: number, c: number): void => {
    if (x >= 0 && y >= 0 && x < W && y < H) cells[idx(x, y)] = c;
  };
  const setGround = (x: number, y: number, v: number): void => {
    if (x >= 0 && y >= 0 && x < W && y < H) ground[idx(x, y)] = v;
  };
  const rectGround = (x0: number, y0: number, x1: number, y1: number, v: number): void => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) setGround(x, y, v);
  };

  // Meadow patches
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const n = Math.sin(x * 0.35 + 1.3) * Math.cos(y * 0.3 - 0.7) + Math.sin((x + y) * 0.17);
      if (n > 0.9) setGround(x, y, GROUND.Alt);
    }
  }

  // Tree border with gaps for the four exits
  const gapN = (x: number): boolean => x >= 21 && x <= 24;
  const gapEW = (y: number): boolean => y >= 17 && y <= 20;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.min(x, y, W - 1 - x, H - 1 - y);
      const thick = 2 + (Math.sin(x * 0.9 + y * 0.4) > 0.3 ? 1 : 0);
      if (d < thick) {
        const isGap = ((y < 4 || y > H - 5) && gapN(x)) || ((x < 4 || x > W - 5) && gapEW(y));
        if (!isGap) setCell(x, y, CELL.Tree);
      }
    }
  }

  // Roads (2 wide) and the central plaza
  rectGround(22, 0, 23, H - 1, GROUND.Path);
  rectGround(0, 18, W - 1, 19, GROUND.Path);
  rectGround(16, 13, 29, 24, GROUND.Path);

  // Ponds
  const pond = (cx: number, cy: number, rx: number, ry: number): void => {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
      for (let x = Math.floor(cx - rx); x <= cx + rx; x++)
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) setCell(x, y, CELL.Liquid);
  };
  pond(8, 31, 4.2, 2.6);
  pond(39, 6, 3.2, 2.2);

  const props: PropPlacement[] = [];
  const objects: MapObject[] = [];
  const P = (id: PropId, tx: number, ty: number, ox = 0, oy = 0): void => {
    props.push({ id, x: tx * TILE + ox, y: ty * TILE + oy });
  };

  // Buildings: anchor = bottom-center (tile coords of the bottom edge)
  const building = (id: PropId, kind: BuildingKind, label: string, cx: number, by: number): void => {
    P(id, cx, by);
    objects.push({
      kind: 'door',
      id: `door_${id}_${cx}`,
      x: cx * TILE,
      y: by * TILE + 6,
      building: kind,
      label,
    });
    // little path from the door to the nearest road
    rectGround(Math.floor(cx) - 1, by, Math.floor(cx), by + 1, GROUND.Path);
  };
  building('elder_house', 'elder', "Elder Maren's House", 10, 11);
  building('inn', 'inn', 'The Sleeping Griffin Inn', 35, 12);
  building('shop', 'shop', "Mira's Curios", 10, 18);
  building('smithy', 'smithy', "Brom's Forge", 35, 18);
  building('house_a', 'house', 'Cottage', 9, 28);
  building('house_b', 'house', 'Cottage', 36, 29);
  building('house_a', 'house', 'Cottage', 30, 33);
  rectGround(9, 12, 21, 12, GROUND.Path);
  rectGround(24, 13, 35, 13, GROUND.Path);
  rectGround(9, 29, 21, 29, GROUND.Path);
  rectGround(24, 30, 36, 30, GROUND.Path);

  // Plaza furniture
  P('fountain', 22.5, 19.5, 8, 0);
  P('statue', 22, 14, 8, 0);
  objects.push({ kind: 'trial', id: 'ascension_statue', x: 22 * TILE + 8, y: 14 * TILE + 6 });
  // the stash chest, on the east side of the square
  objects.push({ kind: 'stash', id: 'town_stash', x: 29 * TILE + 8, y: 19 * TILE + 2 });
  P('lamp_post', 17, 14, 0, 0);
  P('lamp_post', 29, 14, 0, 0);
  P('lamp_post', 17, 24, 0, 0);
  P('lamp_post', 29, 24, 0, 0);
  P('quest_board', 19, 15, 0, 0);
  objects.push({ kind: 'board', id: 'town_board', x: 19 * TILE, y: 15 * TILE + 6 });
  P('save_crystal', 26, 22, 8, 0);
  objects.push({
    kind: 'crystal',
    id: 'town_crystal',
    x: 26 * TILE + 8,
    y: 22 * TILE,
    name: 'Havenbrook Square',
  });
  P('market_stall', 18, 22, 0, 0);
  P('market_stall', 27, 16, 8, 0);

  // Clutter around shops and houses
  P('crate', 13, 18, 4, 0);
  P('barrel', 14, 18, 6, 0);
  P('barrel', 31, 18, 0, 0);
  P('crate', 31, 17, 2, 0);
  P('hay_bale', 5, 26, 0, 0);
  P('hay_bale', 6, 27, 4, 0);
  P('well', 13, 26, 0, 0);
  P('barrel', 38, 12, 6, 0);
  P('crate', 39, 13, 0, 0);
  for (let x = 4; x <= 14; x++) if (x < 8 || x > 11) P('fence_h', x, 23, 8, 0);
  for (let x = 32; x <= 41; x++) if (x < 35 || x > 37) P('fence_h', x, 25, 8, 0);
  P('sign', 22, 4, 12, 0);
  objects.push({
    kind: 'sign',
    id: 'sign_north',
    x: 22 * TILE + 12,
    y: 4 * TILE,
    text: '{gold}North:{/} Whispering Woods\n{gray}"Mind the wolves after dusk." — Guard Rowan{/}',
  });

  // Flowers & trees inside town
  for (let i = 0; i < 70; i++) {
    const x = rng.int(3, W - 4);
    const y = rng.int(3, H - 4);
    if (cells[idx(x, y)] !== CELL.Floor || ground[idx(x, y)] === GROUND.Path) continue;
    const id = rng.pick<PropId>([
      'flowers_red',
      'flowers_yellow',
      'flowers_blue',
      'grass_tuft',
      'grass_tuft',
    ]);
    P(id, x, y, rng.int(2, 14), rng.int(4, 14));
  }
  for (const [tx, ty] of [
    [4, 7],
    [15, 5],
    [28, 5],
    [42, 11],
    [4, 13],
    [42, 24],
    [16, 34],
    [25, 34],
    [4, 21],
    [41, 30],
  ]) {
    P('tree_oak', tx, ty, 8, 14);
  }
  P('reeds', 4, 31, 4, 0);
  P('reeds', 12, 30, 2, 0);

  // Exits
  const z = ZONES;
  objects.push({
    kind: 'warp',
    id: 'town_n',
    x: 21 * TILE,
    y: 0,
    w: 4 * TILE,
    h: TILE,
    to: 'forest',
    spawn: 'entry',
  });
  objects.push({
    kind: 'warp',
    id: 'town_e',
    x: (W - 1) * TILE,
    y: 17 * TILE,
    w: TILE,
    h: 4 * TILE,
    to: 'cave',
    spawn: 'entry',
    requires: { flag: z.cave.unlockFlag!, message: z.cave.lockedMessage! },
  });
  objects.push({
    kind: 'warp',
    id: 'town_s',
    x: 21 * TILE,
    y: (H - 1) * TILE,
    w: 4 * TILE,
    h: TILE,
    to: 'volcano',
    spawn: 'entry',
    requires: { flag: z.volcano.unlockFlag!, message: z.volcano.lockedMessage! },
  });
  objects.push({
    kind: 'warp',
    id: 'town_w',
    x: 0,
    y: 17 * TILE,
    w: TILE,
    h: 4 * TILE,
    to: 'tundra',
    spawn: 'entry',
    requires: { flag: z.tundra.unlockFlag!, message: z.tundra.lockedMessage! },
  });
  objects.push({
    kind: 'portal',
    id: 'citadel_portal',
    x: 22 * TILE + 8,
    y: 11 * TILE,
    to: 'citadel',
    spawn: 'entry',
    requires: { flag: 'portal_open', message: '' },
  });

  // NPCs
  const npc = (id: string, tx: number, ty: number): void => {
    objects.push({ kind: 'npc', id, x: tx * TILE, y: ty * TILE });
  };
  npc('maren', 12, 12.6);
  npc('mira', 12.5, 19.6);
  npc('brom', 37.5, 19.6);
  npc('innkeeper', 37.5, 13.6);
  npc('rowan', 25.5, 5);
  npc('villager_a', 20, 26);
  npc('villager_b', 31, 22);
  npc('child', 24, 23);
  npc('guard_e', 41, 16.5);
  npc('guard_s', 25.5, 34);
  npc('guard_w', 4, 16.5);
  npc('lyra', 20.5, 12.5);

  return {
    id: 'town',
    name: 'Havenbrook',
    theme: 'town',
    levels: [1, 1],
    music: 'town',
    darkness: 0,
    ambient: 'petals',
    w: W,
    h: H,
    cells,
    ground,
    props,
    objects,
    spawns: [],
    spawnPoints: {
      start: { x: 10.8 * TILE, y: 12.9 * TILE },
      north: { x: 22.5 * TILE + 8, y: 3 * TILE },
      east: { x: (W - 3) * TILE, y: 19 * TILE },
      south: { x: 22.5 * TILE + 8, y: (H - 3) * TILE },
      west: { x: 3 * TILE, y: 19 * TILE },
      portal: { x: 22 * TILE + 8, y: 12.2 * TILE },
      town_crystal: { x: 26 * TILE + 8, y: 23 * TILE },
      // where the return portal of a town portal stands (you arrive just below it)
      town_portal_gate: { x: 20 * TILE + 8, y: 23 * TILE },
      town_portal: { x: 20 * TILE + 8, y: 24 * TILE },
    },
  };
}
