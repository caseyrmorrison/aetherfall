/**
 * Crafting recipes. Mira brews tonics (alchemy); Brom forges gear, charms, dust and
 * gem sockets. Materials come from monsters in each zone.
 */
import type { IconId } from '../art/pixel/types';
import type { CharmSize, ConsumableId, GearSlot, MaterialId } from '../game/types';

export type Station = 'alchemy' | 'forge';

export type RecipeResult =
  | { kind: 'consumable'; id: ConsumableId; count: number }
  | { kind: 'material'; id: MaterialId; count: number }
  /** A rare-or-better item for one of `slots` (weapons match your equipped weapon type). */
  | { kind: 'gear'; slots: readonly GearSlot[] }
  /** A charm that is never cursed. */
  | { kind: 'charm'; size: CharmSize }
  /** Adds one gem socket to a chosen item. */
  | { kind: 'socket' };

export interface Recipe {
  id: string;
  name: string;
  station: Station;
  icon: IconId;
  desc: string;
  materials: Partial<Record<MaterialId, number>>;
  /** Gold cost at a hero level. */
  gold: (level: number) => number;
  result: RecipeResult;
}

const flat = (g: number) => (): number => g;
const scaled =
  (base: number, perLevel: number) =>
  (level: number): number =>
    Math.round(base + perLevel * level);

export const RECIPES: readonly Recipe[] = [
  // ------------------------------------------------------------ alchemy ----
  {
    id: 'brew_elixir',
    name: 'Elixir',
    station: 'alchemy',
    icon: 'icon_elixir',
    desc: 'Fully restores HP and MP.',
    materials: { herb: 3, crystal: 1 },
    gold: flat(40),
    result: { kind: 'consumable', id: 'elixir', count: 1 },
  },
  {
    id: 'brew_might',
    name: 'Tonic of Might',
    station: 'alchemy',
    icon: 'icon_potion_hp',
    desc: '+20% damage for 3 minutes.',
    materials: { ember: 2, pelt: 2 },
    gold: flat(60),
    result: { kind: 'consumable', id: 'tonic_might', count: 1 },
  },
  {
    id: 'brew_guard',
    name: 'Tonic of Guarding',
    station: 'alchemy',
    icon: 'icon_potion_mp',
    desc: 'Take 20% less damage for 3 minutes.',
    materials: { frost: 2, pelt: 2 },
    gold: flat(60),
    result: { kind: 'consumable', id: 'tonic_guard', count: 1 },
  },
  {
    id: 'brew_fortune',
    name: 'Tonic of Fortune',
    station: 'alchemy',
    icon: 'icon_elixir',
    desc: '+50% Magic Find and Gold Find for 5 minutes. Only available by brewing.',
    materials: { herb: 2, crystal: 2, void: 1 },
    gold: flat(100),
    result: { kind: 'consumable', id: 'tonic_fortune', count: 1 },
  },
  {
    id: 'brew_phoenix',
    name: 'Phoenix Feather',
    station: 'alchemy',
    icon: 'icon_phoenix',
    desc: 'Auto-revives you with 50% HP when you fall.',
    materials: { ember: 3, frost: 2, void: 2 },
    gold: flat(250),
    result: { kind: 'consumable', id: 'phoenix', count: 1 },
  },
  // -------------------------------------------------------------- forge ----
  {
    id: 'forge_weapon',
    name: 'Emberforged Weapon',
    station: 'forge',
    icon: 'icon_sword',
    desc: 'A rare-or-better weapon of your equipped type, forged at your level +2.',
    materials: { ember: 4, crystal: 2 },
    gold: scaled(80, 25),
    result: { kind: 'gear', slots: ['weapon'] },
  },
  {
    id: 'forge_plate',
    name: 'Frostforged Plate',
    station: 'forge',
    icon: 'icon_armor',
    desc: 'A rare-or-better helm or chest armor, forged at your level +2.',
    materials: { frost: 4, pelt: 3 },
    gold: scaled(80, 25),
    result: { kind: 'gear', slots: ['helm', 'armor'] },
  },
  {
    id: 'forge_leather',
    name: "Hunter's Leathers",
    station: 'forge',
    icon: 'icon_boots',
    desc: 'Rare-or-better gloves, boots or a belt, stitched at your level +2.',
    materials: { pelt: 5, herb: 2 },
    gold: scaled(60, 20),
    result: { kind: 'gear', slots: ['gloves', 'boots', 'belt'] },
  },
  {
    id: 'forge_jewelry',
    name: 'Crystal Jewelry',
    station: 'forge',
    icon: 'icon_ring',
    desc: 'A rare-or-better ring or amulet, cut at your level +2.',
    materials: { crystal: 5, void: 1 },
    gold: scaled(80, 25),
    result: { kind: 'gear', slots: ['ring', 'amulet'] },
  },
  {
    id: 'forge_charm_small',
    name: 'Bound Charm (Small)',
    station: 'forge',
    icon: 'icon_charm_small',
    desc: 'A small charm that is never cursed.',
    materials: { void: 2, herb: 2 },
    gold: scaled(50, 10),
    result: { kind: 'charm', size: 'small' },
  },
  {
    id: 'forge_charm_large',
    name: 'Bound Charm (Large)',
    station: 'forge',
    icon: 'icon_charm_large',
    desc: 'A large charm that is never cursed.',
    materials: { void: 4, crystal: 2 },
    gold: scaled(100, 20),
    result: { kind: 'charm', size: 'large' },
  },
  {
    id: 'forge_charm_grand',
    name: 'Bound Charm (Grand)',
    station: 'forge',
    icon: 'icon_charm_grand',
    desc: 'A grand charm that is never cursed.',
    materials: { void: 7, ember: 2, frost: 2 },
    gold: scaled(200, 40),
    result: { kind: 'charm', size: 'grand' },
  },
  {
    id: 'forge_socket',
    name: 'Socket Punch',
    station: 'forge',
    icon: 'icon_void',
    desc: 'Add a gem socket to a rare-or-better item that has none.',
    materials: { void: 5, crystal: 3 },
    gold: scaled(300, 40),
    result: { kind: 'socket' },
  },
  {
    id: 'forge_dust',
    name: 'Refine Aether Dust',
    station: 'forge',
    icon: 'icon_dust',
    desc: 'Grind Cave Crystals into Aether Dust for upgrades.',
    materials: { crystal: 2 },
    gold: flat(20),
    result: { kind: 'material', id: 'dust', count: 10 },
  },
];

export const recipesFor = (station: Station): Recipe[] => RECIPES.filter((r) => r.station === station);
