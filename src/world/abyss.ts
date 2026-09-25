/**
 * The Abyss: an endless post-game tower of procedurally generated arena floors with
 * mixed enemies from every region, scaling forever. Every 5th floor holds a boss echo.
 */
import { ZONES, ZONE_ORDER } from '../data/zones';
import { RNG } from '../engine/rng';
import {
  CELL,
  GROUND,
  TILE,
  type EnemySpawn,
  type MapData,
  type MapObject,
  type PropPlacement,
} from './mapdata';

export const ABYSS_BASE_LEVEL = 28;
const BOSS_ROTATION = ['thornmaw', 'crystal_golem', 'ignis', 'seraphine', 'malachar'];

export function abyssLevel(floor: number): number {
  return ABYSS_BASE_LEVEL + floor * 2;
}

export function generateAbyssFloor(floor: number): MapData {
  const rng = new RNG(`abyss-${floor}`);
  const w = 40;
  const h = 32;
  const cells = new Uint8Array(w * h).fill(CELL.Wall);
  const ground = new Uint8Array(w * h);
  const cx = w / 2;
  const cy = h / 2;
  // union of a few overlapping blobs for varied arena shapes
  const blobs = rng.int(3, 5);
  for (let b = 0; b < blobs; b++) {
    const bx = cx + rng.range(-8, 8);
    const by = cy + rng.range(-5, 5);
    const rx = rng.range(7, 12);
    const ry = rng.range(5, 8);
    for (let y = 2; y < h - 2; y++)
      for (let x = 2; x < w - 2; x++)
        if (((x - bx) / rx) ** 2 + ((y - by) / ry) ** 2 <= 1) cells[y * w + x] = CELL.Floor;
  }
  for (let y = 2; y < h - 2; y++)
    for (let x = Math.floor(cx) - 2; x <= cx + 1; x++) if (y > cy) cells[y * w + x] = CELL.Floor;
  // void pools
  for (let i = 0; i < rng.int(1, 3); i++) {
    const px = cx + rng.range(-10, 10);
    const py = cy + rng.range(-6, 4);
    for (let y = Math.floor(py - 2); y <= py + 2; y++)
      for (let x = Math.floor(px - 2); x <= px + 2; x++)
        if (cells[y * w + x] === CELL.Floor && (x - px) ** 2 + (y - py) ** 2 <= 3.5)
          cells[y * w + x] = CELL.Liquid;
  }
  for (let i = 0; i < w * h; i++) if (rng.chance(0.3)) ground[i] = GROUND.Alt;

  const props: PropPlacement[] = [];
  for (let i = 0; i < 6; i++) {
    const x = rng.int(4, w - 5);
    const y = rng.int(4, h - 5);
    if (cells[y * w + x] === CELL.Floor && Math.abs(x - cx) > 3)
      props.push({
        id: rng.chance(0.5) ? 'void_crystal' : 'pillar_broken',
        x: x * TILE + 8,
        y: (y + 1) * TILE - 2,
      });
  }
  for (let x = 3; x < w - 3; x += 6)
    for (let y = 1; y < h - 1; y++)
      if (cells[y * w + x] === CELL.Wall && cells[(y + 1) * w + x] === CELL.Floor) {
        props.push({ id: 'brazier', x: x * TILE + 8, y: (y + 2) * TILE - 2 });
        break;
      }

  const level = abyssLevel(floor);
  const spawns: EnemySpawn[] = [];
  const isBossFloor = floor % 5 === 0;
  const pool = ZONE_ORDER.flatMap((z) => ZONES[z].enemies.map(([id]) => id));
  if (!isBossFloor) {
    const n = 8 + Math.min(12, floor);
    for (let i = 0; i < n; i++) {
      for (let tries = 0; tries < 30; tries++) {
        const x = rng.int(3, w - 4);
        const y = rng.int(3, h - 8);
        if (cells[y * w + x] !== CELL.Floor) continue;
        spawns.push({
          enemy: rng.pick(pool),
          level,
          x: x * TILE + 8,
          y: y * TILE + 8,
          group: 0,
          elite: rng.chance(0.12 + floor * 0.01),
        });
        break;
      }
    }
  }
  const objects: MapObject[] = [
    {
      kind: 'warp',
      id: 'abyss_exit',
      x: (cx - 2) * TILE,
      y: (h - 2) * TILE,
      w: 4 * TILE,
      h: TILE,
      to: 'town',
      spawn: 'portal',
    },
  ];
  return {
    id: `abyss_${floor}`,
    name: `The Abyss — Floor ${floor}`,
    theme: 'abyss',
    levels: [level, level],
    music: isBossFloor ? 'boss' : 'abyss',
    darkness: 0.55,
    ambient: 'void',
    w,
    h,
    cells,
    ground,
    props,
    objects,
    spawns,
    spawnPoints: { entry: { x: cx * TILE, y: (h - 4) * TILE } },
    boss: isBossFloor
      ? { enemy: BOSS_ROTATION[(floor / 5 - 1) % BOSS_ROTATION.length], x: cx * TILE, y: (cy - 4) * TILE }
      : undefined,
    tint: 'rgba(104,56,108,0.1)',
  };
}
