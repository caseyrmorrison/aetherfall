/** Map registry: builds (and caches) the town, zones, boss arenas and abyss floors. */
import { ZONES } from '../data/zones';
import { generateAbyssFloor } from './abyss';
import type { MapData } from './mapdata';
import { generateArena, generateZone } from './mapgen';
import { buildTown } from './town';

const cache = new Map<string, MapData>();

export function getMap(id: string): MapData {
  if (id.startsWith('abyss')) return generateAbyssFloor(Number(id.split('_')[1] ?? 1));
  let m = cache.get(id);
  if (m) return m;
  if (id === 'town') m = buildTown();
  else if (id.endsWith('_boss')) m = generateArena(id.replace(/_boss$/, ''));
  else if (ZONES[id]) m = generateZone(ZONES[id]);
  else throw new Error(`Unknown map ${id}`);
  cache.set(id, m);
  return m;
}
