/** Zone definitions: layout parameters for the procedural generator and progression gates. */
import type { PropId, Theme } from '../art/pixel/types';
import type { MusicId } from '../audio';
import type { Ambient } from '../world/mapdata';

export type Edge = 'north' | 'south' | 'east' | 'west';

export interface ZoneDef {
  id: string;
  name: string;
  theme: Theme;
  levels: [number, number];
  music: MusicId;
  darkness: number;
  ambient: Ambient;
  w: number;
  h: number;
  seed: string;
  /** Which edge connects back toward town. The boss gate is on the opposite side. */
  entry: Edge;
  /** Where the entry leads back to. */
  back: { map: string; spawn: string };
  blocker: 'tree' | 'wall' | 'mixed';
  treeProp: PropId;
  enemies: readonly (readonly [string, number])[];
  packs: number;
  packSize: [number, number];
  decor: readonly (readonly [PropId, number])[];
  solids: readonly (readonly [PropId, number])[];
  liquidChance: number;
  /** Chance of an 'alt' ground patch. */
  altAmount: number;
  pathTrail: boolean;
  boss: { enemy: string; arena: string };
  lightProps?: readonly PropId[];
  tint?: string;
  unlockFlag?: string;
  lockedMessage?: string;
}

export const ZONES: Record<string, ZoneDef> = {
  forest: {
    id: 'forest',
    name: 'Whispering Woods',
    theme: 'forest',
    levels: [1, 6],
    music: 'forest',
    darkness: 0,
    ambient: 'leaves',
    w: 72,
    h: 90,
    seed: 'woods-v1',
    entry: 'south',
    back: { map: 'town', spawn: 'north' },
    blocker: 'tree',
    treeProp: 'tree_oak',
    enemies: [
      ['slime', 5],
      ['wolf', 3],
      ['mushroom', 3],
      ['goblin', 3],
    ],
    packs: 13,
    packSize: [2, 4],
    decor: [
      ['grass_tuft', 0.06],
      ['flowers_red', 0.012],
      ['flowers_yellow', 0.012],
      ['flowers_blue', 0.008],
      ['mushroom_cluster', 0.006],
    ],
    solids: [
      ['bush', 0.02],
      ['rock_small', 0.008],
      ['stump', 0.005],
      ['log', 0.004],
      ['tree_pine', 0.01],
    ],
    liquidChance: 0.35,
    altAmount: 0.35,
    pathTrail: true,
    boss: { enemy: 'thornmaw', arena: 'forest_boss' },
  },
  cave: {
    id: 'cave',
    name: 'Crystal Caverns',
    theme: 'cave',
    levels: [6, 12],
    music: 'cave',
    darkness: 0.82,
    ambient: 'dust',
    w: 90,
    h: 70,
    seed: 'caverns-v1',
    entry: 'west',
    back: { map: 'town', spawn: 'east' },
    blocker: 'wall',
    treeProp: 'stalagmite',
    enemies: [
      ['bat', 4],
      ['slime_crystal', 3],
      ['skeleton', 3],
      ['golem', 2],
    ],
    packs: 15,
    packSize: [2, 4],
    decor: [
      ['crystal_small', 0.02],
      ['bones', 0.008],
    ],
    solids: [
      ['stalagmite', 0.015],
      ['crystal_big', 0.006],
      ['rock_small', 0.01],
      ['rock_big', 0.004],
    ],
    liquidChance: 0.4,
    altAmount: 0.25,
    pathTrail: false,
    boss: { enemy: 'crystal_golem', arena: 'cave_boss' },
    unlockFlag: 'boss_thornmaw',
    lockedMessage:
      'A shimmering barrier seals the cavern mouth. It pulses in time with the Verdant Shard… but you need its power first.',
  },
  volcano: {
    id: 'volcano',
    name: 'Emberpeak',
    theme: 'volcano',
    levels: [12, 18],
    music: 'volcano',
    darkness: 0.35,
    ambient: 'embers',
    w: 80,
    h: 88,
    seed: 'ember-v1',
    entry: 'north',
    back: { map: 'town', spawn: 'south' },
    blocker: 'mixed',
    treeProp: 'tree_dead',
    enemies: [
      ['fire_imp', 3],
      ['slime_magma', 3],
      ['salamander', 3],
      ['ember_wisp', 2],
    ],
    packs: 15,
    packSize: [2, 4],
    decor: [['bones', 0.004]],
    solids: [
      ['lava_rock', 0.012],
      ['obsidian_spike', 0.01],
      ['vent', 0.006],
      ['rock_big', 0.004],
    ],
    liquidChance: 0.6,
    altAmount: 0.3,
    pathTrail: false,
    boss: { enemy: 'ignis', arena: 'volcano_boss' },
    tint: 'rgba(247,118,34,0.06)',
    unlockFlag: 'boss_crystal_golem',
    lockedMessage:
      'Scorching winds howl down the southern pass. Only one who carries two shards could withstand them.',
  },
  tundra: {
    id: 'tundra',
    name: 'Frostveil',
    theme: 'tundra',
    levels: [18, 24],
    music: 'tundra',
    darkness: 0.1,
    ambient: 'snow',
    w: 92,
    h: 72,
    seed: 'frost-v1',
    entry: 'east',
    back: { map: 'town', spawn: 'west' },
    blocker: 'mixed',
    treeProp: 'tree_snowpine',
    enemies: [
      ['wolf_ice', 4],
      ['yeti', 2],
      ['frost_wraith', 3],
      ['golem_ice', 2],
    ],
    packs: 16,
    packSize: [2, 4],
    decor: [],
    solids: [
      ['snow_rock', 0.012],
      ['ice_spike', 0.01],
      ['tree_snowpine', 0.012],
    ],
    liquidChance: 0.4,
    altAmount: 0.3,
    pathTrail: false,
    boss: { enemy: 'seraphine', arena: 'tundra_boss' },
    tint: 'rgba(44,232,245,0.05)',
    unlockFlag: 'boss_ignis',
    lockedMessage:
      'The western road is buried under an unnatural blizzard. The Ember Shard’s warmth could melt a way through.',
  },
  citadel: {
    id: 'citadel',
    name: 'Sky Citadel',
    theme: 'citadel',
    levels: [24, 30],
    music: 'citadel',
    darkness: 0.5,
    ambient: 'void',
    w: 80,
    h: 96,
    seed: 'citadel-v1',
    entry: 'south',
    back: { map: 'town', spawn: 'portal' },
    blocker: 'wall',
    treeProp: 'pillar',
    enemies: [
      ['shadow_knight', 3],
      ['void_mage', 3],
      ['hollow_wisp', 2],
      ['gargoyle', 2],
    ],
    packs: 17,
    packSize: [2, 4],
    decor: [['banner', 0.004]],
    solids: [
      ['pillar', 0.01],
      ['pillar_broken', 0.008],
      ['brazier', 0.005],
      ['void_crystal', 0.005],
    ],
    liquidChance: 0.5,
    altAmount: 0.25,
    pathTrail: true,
    boss: { enemy: 'malachar', arena: 'citadel_boss' },
    tint: 'rgba(104,56,108,0.08)',
    unlockFlag: 'boss_seraphine',
  },
};

export const ZONE_ORDER = ['forest', 'cave', 'volcano', 'tundra', 'citadel'] as const;

/** Display names for every map id (zones, arenas, town, abyss). */
export function mapName(id: string): string {
  if (id === 'town') return 'Havenbrook';
  if (id.startsWith('abyss')) return 'The Abyss';
  const z = ZONES[id.replace(/_boss$/, '')];
  if (!z) return id;
  return id.endsWith('_boss') ? `${z.name} — Depths` : z.name;
}
