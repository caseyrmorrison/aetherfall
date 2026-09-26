/** Map registry: builds (and caches) the town, zones, boss arenas and abyss floors. */
import { ZONES } from '../data/zones';
import { generateAbyssFloor } from './abyss';
import type { MapData } from './mapdata';
import { generateArena, generateZone } from './mapgen';
import { buildTown } from './town';
import { generateTrialMap } from './trial';

const cache = new Map<string, MapData>();

export function getMap(id: string): MapData {
  if (id.startsWith('abyss')) return generateAbyssFloor(Number(id.split('_')[1] ?? 1));
  if (id.startsWith('trial_')) return generateTrialMap(Number(id.split('_')[1] ?? 1));
  let m = cache.get(id);
  if (m) return m;
  if (id === 'town') m = buildTown();
  else if (id.endsWith('_boss')) m = generateArena(id.replace(/_boss$/, ''));
  else if (ZONES[id]) m = generateZone(ZONES[id]);
  else throw new Error(`Unknown map ${id}`);
  cache.set(id, m);
  return m;
}

/** Human-readable name of an area (for portal prompts and the HUD). */
export function areaName(id: string): string {
  if (id === 'town') return 'Havenbrook';
  if (id.startsWith('abyss')) return `Abyss Floor ${Number(id.split('_')[1] ?? 1)}`;
  if (id.startsWith('trial_')) return 'Trial of Ascension';
  const zone = ZONES[id.replace(/_boss$/, '')];
  if (zone) return id.endsWith('_boss') ? `${zone.name} (Guardian)` : zone.name;
  return id;
}
