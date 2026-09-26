/**
 * Solenne — the Act II hub: a walled desert port city and home of the Order of Stars.
 * Built by hand like Havenbrook: plaza in the middle, gates west (Sunscar Dunes),
 * south (Sunken Temple) and east (Stormspire), the sky portal to the Eclipse Sanctum
 * in the north and the portal home to Havenbrook in the plaza.
 */
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

const W = 48;
const H = 40;

export function buildSolenne(): MapData {
  const cells = new Uint8Array(W * H).fill(CELL.Floor);
  const ground = new Uint8Array(W * H);
  const rng = new RNG('solenne');
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

  // Drifted sand patches
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const n = Math.sin(x * 0.3 + 0.7) * Math.cos(y * 0.33 - 1.1) + Math.sin((x - y) * 0.19);
      if (n > 0.85) setGround(x, y, GROUND.Alt);
    }

  // City walls with three gates
  const gateEW = (y: number): boolean => y >= 18 && y <= 21;
  const gateS = (x: number): boolean => x >= 22 && x <= 25;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const d = Math.min(x, y, W - 1 - x, H - 1 - y);
      if (d >= 2) continue;
      const gate = ((x < 2 || x > W - 3) && gateEW(y)) || (y > H - 3 && gateS(x));
      if (!gate) setCell(x, y, CELL.Wall);
    }

  // Paved streets: the gates' roads and the plaza, plus the stair up to the sky portal
  rectGround(0, 19, W - 1, 20, GROUND.Path);
  rectGround(23, 3, 24, H - 1, GROUND.Path);
  rectGround(16, 13, 31, 25, GROUND.Path);
  rectGround(20, 3, 27, 6, GROUND.Path);

  // The oasis pool (north-west) and a smaller harbor basin (south-east)
  const pool = (cx: number, cy: number, rx: number, ry: number): void => {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
      for (let x = Math.floor(cx - rx); x <= cx + rx; x++)
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) setCell(x, y, CELL.Liquid);
  };
  pool(12, 6, 5, 2.4);
  pool(39, 33, 4.2, 2.6);

  const props: PropPlacement[] = [];
  const objects: MapObject[] = [];
  const P = (id: PropId, tx: number, ty: number, ox = 0, oy = 0): void => {
    props.push({ id, x: tx * TILE + ox, y: ty * TILE + oy });
  };
  const building = (id: PropId, kind: BuildingKind, label: string, cx: number, by: number): void => {
    P(id, cx, by);
    objects.push({ kind: 'door', id: `door_${id}_${cx}`, x: cx * TILE, y: by * TILE + 6, building: kind, label });
    rectGround(Math.floor(cx) - 1, by, Math.floor(cx), by + 1, GROUND.Path);
  };
  building('adobe_hall', 'hall', 'Harbor Hall', 10, 12);
  building('adobe_inn', 'inn', 'The Salted Lantern', 37, 12);
  building('adobe_shop', 'shop', "Farid's Bazaar", 10, 18);
  building('adobe_smithy', 'smithy', "Kesh's Anvil", 37, 18);
  building('adobe_house', 'house', 'House', 9, 29);
  building('adobe_house', 'house', 'House', 36, 27);
  building('adobe_house', 'house', 'House', 30, 34);
  rectGround(9, 13, 21, 13, GROUND.Path);
  rectGround(24, 13, 37, 13, GROUND.Path);
  rectGround(9, 30, 21, 30, GROUND.Path);

  // Plaza
  P('statue', 22, 14, 8, 0);
  P('lamp_post', 17, 14);
  P('lamp_post', 29, 14);
  P('lamp_post', 17, 24);
  P('lamp_post', 29, 24);
  P('quest_board', 19, 15);
  objects.push({ kind: 'board', id: 'solenne_board', x: 19 * TILE, y: 15 * TILE + 6 });
  P('save_crystal', 26, 22, 8, 0);
  objects.push({ kind: 'crystal', id: 'solenne_crystal', x: 26 * TILE + 8, y: 22 * TILE, name: 'Solenne Plaza' });
  objects.push({ kind: 'stash', id: 'solenne_stash', x: 29 * TILE + 8, y: 19 * TILE + 2 });
  P('market_awning', 18, 22);
  P('market_awning', 27, 16, 8, 0);
  P('sand_crate', 13, 18, 4, 0);
  P('sand_crate', 31, 18);
  P('sand_crate', 31, 17, 2, 0);

  // Portals: home to Havenbrook (plaza) and up to the Eclipse Sanctum (north stair)
  objects.push({ kind: 'portal', id: 'havenbrook_portal', x: 18 * TILE, y: 18 * TILE - 2, to: 'town', spawn: 'portal' });
  objects.push({
    kind: 'portal',
    id: 'sanctum_portal',
    x: 23 * TILE + 8,
    y: 4 * TILE,
    to: 'sanctum',
    spawn: 'entry',
    requires: {
      flag: ZONES.sanctum.unlockFlag!,
      message: 'The sky portal is dark. It needs the storm’s key from atop the Stormspire.',
    },
  });

  // Palms around the oasis and along the walls
  for (const [tx, ty] of [
    [6, 4],
    [17, 4],
    [7, 9],
    [16, 9],
    [4, 14],
    [43, 9],
    [5, 24],
    [43, 24],
    [15, 33],
    [34, 31],
    [44, 34],
    [30, 5],
    [35, 5],
  ])
    P('palm_tree', tx, ty, 8, 14);
  for (let i = 0; i < 40; i++) {
    const x = rng.int(3, W - 4);
    const y = rng.int(3, H - 4);
    if (cells[idx(x, y)] !== CELL.Floor || ground[idx(x, y)] === GROUND.Path) continue;
    P(rng.pick<PropId>(['dry_bush', 'dry_bush', 'desert_bones', 'sand_crate']), x, y, rng.int(2, 14), rng.int(4, 14));
  }

  // Gates and signs
  const z = ZONES;
  objects.push({
    kind: 'warp',
    id: 'solenne_w',
    x: 0,
    y: 18 * TILE,
    w: TILE,
    h: 4 * TILE,
    to: 'desert',
    spawn: 'entry',
    requires: { flag: z.desert.unlockFlag!, message: z.desert.lockedMessage! },
  });
  objects.push({
    kind: 'warp',
    id: 'solenne_s',
    x: 22 * TILE,
    y: (H - 1) * TILE,
    w: 4 * TILE,
    h: TILE,
    to: 'ruins',
    spawn: 'entry',
    requires: { flag: z.ruins.unlockFlag!, message: z.ruins.lockedMessage! },
  });
  objects.push({
    kind: 'warp',
    id: 'solenne_e',
    x: (W - 1) * TILE,
    y: 18 * TILE,
    w: TILE,
    h: 4 * TILE,
    to: 'storm',
    spawn: 'entry',
    requires: { flag: z.storm.unlockFlag!, message: z.storm.lockedMessage! },
  });
  P('sign', 3, 17, 8, 0);
  objects.push({
    kind: 'sign',
    id: 'sign_solenne_w',
    x: 3 * TILE + 8,
    y: 17 * TILE,
    text: '{gold}West Gate:{/} Sunscar Dunes\n{gray}"No caravan has returned in a month." — Harbor Hall{/}',
  });
  P('sign', 43, 17, 8, 0);
  objects.push({
    kind: 'sign',
    id: 'sign_solenne_e',
    x: 43 * TILE + 8,
    y: 17 * TILE,
    text: '{gold}East Gate:{/} Stormspire\n{gray}The cliff road. Lightning strikes it twice, and often.{/}',
  });
  P('sign', 21, 36, 8, 0);
  objects.push({
    kind: 'sign',
    id: 'sign_solenne_s',
    x: 21 * TILE + 8,
    y: 36 * TILE,
    text: '{gold}Harbor Stairs:{/} Sunken Temple\n{gray}The old temple of the tides, under the bay.{/}',
  });

  // People
  const npc = (id: string, tx: number, ty: number): void => {
    objects.push({ kind: 'npc', id, x: tx * TILE, y: ty * TILE });
  };
  npc('tessaly', 12, 13.6);
  npc('farid', 12.5, 19.6);
  npc('kesh', 37.5, 19.6);
  npc('lyra_solenne', 21, 12.5);
  npc('sella', 20, 26);
  npc('orin', 31, 22);
  npc('guard_solenne_w', 4, 17.5);
  npc('guard_solenne_e', 43, 22.5);
  npc('guard_solenne_s', 26.5, 35);

  return {
    id: 'solenne',
    name: 'Solenne',
    theme: 'oasis',
    levels: [30, 30],
    music: 'solenne',
    darkness: 0.25,
    ambient: 'sand',
    w: W,
    h: H,
    cells,
    ground,
    props,
    objects,
    spawns: [],
    spawnPoints: {
      start: { x: 23 * TILE + 8, y: 16 * TILE },
      west: { x: 3 * TILE, y: 20 * TILE },
      east: { x: (W - 3) * TILE, y: 20 * TILE },
      south: { x: 23 * TILE + 8, y: (H - 3) * TILE },
      portal: { x: 18 * TILE, y: 19 * TILE + 4 },
      sanctum: { x: 23 * TILE + 8, y: 6 * TILE },
      solenne_crystal: { x: 26 * TILE + 8, y: 23 * TILE },
      town_portal_gate: { x: 20 * TILE + 8, y: 23 * TILE },
      town_portal: { x: 20 * TILE + 8, y: 24 * TILE },
    },
    tint: 'rgba(104,56,108,0.10)',
  };
}
