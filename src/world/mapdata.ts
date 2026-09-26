/** Runtime map representation shared by generators, the world and the renderer. */
import type { PropId, Theme } from '../art/pixel/types';
import type { MusicId } from '../audio';

/** Cell types. */
export const CELL = {
  Floor: 0,
  Wall: 1,
  Liquid: 2,
  Tree: 3,
  Bridge: 4,
  Void: 5,
} as const;
export type Cell = (typeof CELL)[keyof typeof CELL];

/** Id of the town-side portal that leads back to where a town portal was opened. */
export const TOWN_PORTAL_ID = 'town_portal';

/** Ground kinds for floor cells. */
export const GROUND = { Floor: 0, Alt: 1, Path: 2 } as const;

export type Ambient =
  'leaves' | 'fireflies' | 'dust' | 'embers' | 'snow' | 'void' | 'petals' | 'sand' | 'rain' | null;

export interface PropPlacement {
  id: PropId;
  /** Anchor position in pixels. */
  x: number;
  y: number;
  frame?: number;
}

export type BuildingKind = 'inn' | 'shop' | 'smithy' | 'elder' | 'hall' | 'house';

export type MapObject =
  | { kind: 'chest'; id: string; x: number; y: number; rare: boolean; ilvl: number; questFlag?: string }
  | { kind: 'crystal'; id: string; x: number; y: number; name: string }
  | {
      kind: 'warp';
      id: string;
      x: number;
      y: number;
      w: number;
      h: number;
      to: string;
      spawn: string;
      requires?: { flag: string; message: string };
    }
  | { kind: 'npc'; id: string; x: number; y: number }
  | { kind: 'sign'; id: string; x: number; y: number; text: string }
  | { kind: 'door'; id: string; x: number; y: number; building: BuildingKind; label: string }
  | { kind: 'bossGate'; id: string; x: number; y: number; to: string; boss: string }
  | {
      kind: 'portal';
      id: string;
      x: number;
      y: number;
      to: string;
      spawn: string;
      requires?: { flag: string; message: string };
    }
  | { kind: 'marker'; id: string; x: number; y: number }
  /** The Statue of the First Hero: Trials of Ascension. */
  | { kind: 'trial'; id: string; x: number; y: number }
  /** The stash chest in town. */
  | { kind: 'stash'; id: string; x: number; y: number }
  | { kind: 'board'; id: string; x: number; y: number };

export interface EnemySpawn {
  enemy: string;
  level: number;
  x: number;
  y: number;
  elite?: boolean;
  group: number;
}

export interface MapData {
  id: string;
  name: string;
  theme: Theme;
  levels: [number, number];
  music: MusicId;
  /** 0 = fully lit, 1 = pitch black (needs lights). */
  darkness: number;
  ambient: Ambient;
  w: number;
  h: number;
  cells: Uint8Array;
  ground: Uint8Array;
  props: PropPlacement[];
  objects: MapObject[];
  spawns: EnemySpawn[];
  spawnPoints: Record<string, { x: number; y: number }>;
  boss?: { enemy: string; x: number; y: number };
  /** Arena maps lock the exit until the boss dies. */
  arena?: boolean;
  /** Tint drawn over the scene (CSS color with alpha) for mood. */
  tint?: string;
}

export const TILE = 16;
