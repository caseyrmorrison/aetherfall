/** Core gameplay types shared between systems, UI and save data. */
import type { IconId, WeaponKind } from '../art/pixel/types';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export const RARITIES: readonly Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

/** Item types. Charms are never equipped: they work from the bag. */
export type Slot = 'weapon' | 'helm' | 'armor' | 'gloves' | 'belt' | 'boots' | 'ring' | 'amulet' | 'charm';
/** Equippable item types (everything except charms). */
export type GearSlot = Exclude<Slot, 'charm'>;
export const GEAR_SLOTS: readonly GearSlot[] = [
  'weapon',
  'helm',
  'armor',
  'gloves',
  'belt',
  'boots',
  'ring',
  'amulet',
];

/** Places on the hero's body where gear is worn (two ring fingers). */
export type EquipSlot =
  'weapon' | 'helm' | 'amulet' | 'armor' | 'gloves' | 'belt' | 'ring1' | 'ring2' | 'boots';
export const EQUIP_SLOTS: readonly EquipSlot[] = [
  'helm',
  'amulet',
  'armor',
  'weapon',
  'gloves',
  'ring1',
  'ring2',
  'belt',
  'boots',
];

/** Which body slots an item type can go into. */
export function equipSlotsFor(slot: Slot): EquipSlot[] {
  if (slot === 'charm') return [];
  if (slot === 'ring') return ['ring1', 'ring2'];
  return [slot];
}

export type CharmSize = 'small' | 'large' | 'grand';
/** How many charms in the bag can be active at once. */
export const CHARM_LIMIT = 10;

export type Difficulty = 'story' | 'normal' | 'hard' | 'nightmare';

/** Every numeric stat an actor can have. Percent-like stats are fractions (0.05 = 5%). */
export interface Stats {
  maxHp: number;
  maxMp: number;
  atk: number;
  def: number;
  mag: number;
  crit: number;
  critDmg: number;
  atkSpeed: number;
  moveSpeed: number;
  lifesteal: number;
  cdr: number;
  goldFind: number;
  magicFind: number;
  xpBonus: number;
  hpRegen: number;
  mpRegen: number;
  burnChance: number;
  skillDmg: number;
  dmgBonus: number;
  dodgeCost: number;
}

export type StatKey = keyof Stats;

export const ZERO_STATS: Readonly<Stats> = Object.freeze({
  maxHp: 0,
  maxMp: 0,
  atk: 0,
  def: 0,
  mag: 0,
  crit: 0,
  critDmg: 0,
  atkSpeed: 0,
  moveSpeed: 0,
  lifesteal: 0,
  cdr: 0,
  goldFind: 0,
  magicFind: 0,
  xpBonus: 0,
  hpRegen: 0,
  mpRegen: 0,
  burnChance: 0,
  skillDmg: 0,
  dmgBonus: 0,
  dodgeCost: 0,
});

/** How to display a stat in the UI. */
export const STAT_INFO: Record<StatKey, { label: string; pct: boolean }> = {
  maxHp: { label: 'Max HP', pct: false },
  maxMp: { label: 'Max MP', pct: false },
  atk: { label: 'Attack', pct: false },
  def: { label: 'Defense', pct: false },
  mag: { label: 'Magic', pct: false },
  crit: { label: 'Crit Chance', pct: true },
  critDmg: { label: 'Crit Damage', pct: true },
  atkSpeed: { label: 'Attack Speed', pct: true },
  moveSpeed: { label: 'Move Speed', pct: true },
  lifesteal: { label: 'Lifesteal', pct: true },
  cdr: { label: 'Cooldown Red.', pct: true },
  goldFind: { label: 'Gold Find', pct: true },
  magicFind: { label: 'Magic Find', pct: true },
  xpBonus: { label: 'XP Bonus', pct: true },
  hpRegen: { label: 'HP Regen/s', pct: false },
  mpRegen: { label: 'MP Regen/s', pct: false },
  burnChance: { label: 'Burn Chance', pct: true },
  skillDmg: { label: 'Skill Damage', pct: true },
  dmgBonus: { label: 'Damage', pct: true },
  dodgeCost: { label: 'Dodge Cost', pct: true },
};

export type LegendaryId =
  | 'thornfang'
  | 'mountain_heart'
  | 'dragonbreath'
  | 'seraphs_tear'
  | 'hollow_crown'
  | 'windwalkers'
  | 'phoenix_band'
  | 'stormcaller'
  | 'vampire_kiss'
  | 'echo_blade';

export interface Affix {
  stat: StatKey;
  value: number;
}

export interface Item {
  uid: string;
  slot: Slot;
  /** Weapon kind for weapons. */
  kind?: WeaponKind;
  /** Visual/material tier 0-5 (derived from item level). */
  tier: number;
  ilvl: number;
  rarity: Rarity;
  name: string;
  /** Implicit stats from the base type (scaled by upgrade level). */
  base: Partial<Stats>;
  affixes: Affix[];
  /** Blacksmith upgrade level 0..10. */
  upgrade: number;
  legendary?: LegendaryId;
  locked?: boolean;
  isNew?: boolean;
  /** Charms only. */
  charmSize?: CharmSize;
  /** Cursed charms: stronger bonuses plus a drawback (a negative affix). */
  cursed?: boolean;
}

export type ConsumableId = 'elixir' | 'phoenix' | 'tonic_might' | 'tonic_guard';
export type MaterialId = 'dust' | 'herb' | 'pelt' | 'crystal' | 'ember' | 'frost' | 'void';

export interface ConsumableDef {
  id: ConsumableId;
  name: string;
  icon: IconId;
  desc: string;
  price: number;
}

export interface MaterialDef {
  id: MaterialId;
  name: string;
  icon: IconId;
  desc: string;
  sell: number;
}
