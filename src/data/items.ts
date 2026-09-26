/** Static item data: base types, affix pools, legendary uniques, consumables and materials. */
import type { IconId, WeaponKind } from '../art/pixel/types';
import type {
  ConsumableDef,
  ConsumableId,
  LegendaryId,
  MaterialDef,
  MaterialId,
  Slot,
  StatKey,
  Stats,
} from '../game/types';

export const TIER_NAMES: Record<Slot | WeaponKind, readonly string[]> = {
  weapon: ['Blade', 'Blade', 'Blade', 'Blade', 'Blade', 'Blade'],
  sword: ['Rusty Blade', 'Iron Sword', 'Steel Sword', 'Crystal Edge', 'Emberbrand', 'Aetherblade'],
  greatsword: [
    'Heavy Cleaver',
    'Iron Greatsword',
    'Steel Zweihander',
    'Crystal Greatblade',
    'Inferno Claymore',
    'Aether Colossus',
  ],
  dagger: ['Chipped Knife', 'Iron Dagger', 'Steel Stiletto', 'Crystal Fang', 'Ember Kris', 'Aether Needle'],
  staff: ['Oak Staff', 'Iron Rod', 'Mage Staff', 'Crystal Scepter', 'Ember Staff', 'Aether Stave'],
  helm: ['Leather Cap', 'Iron Helm', 'Steel Visor', 'Crystal Circlet', 'Ember Crown', 'Aether Diadem'],
  armor: ['Padded Vest', 'Chainmail', 'Steel Plate', 'Crystal Mail', 'Ember Plate', 'Aether Raiment'],
  boots: ['Sandals', 'Iron Boots', 'Steel Greaves', 'Crystal Treads', 'Ember Striders', 'Aether Walkers'],
  ring: ['Copper Ring', 'Iron Band', 'Silver Ring', 'Crystal Ring', 'Ember Signet', 'Aether Loop'],
  gloves: [
    'Leather Gloves',
    'Iron Gauntlets',
    'Steel Gauntlets',
    'Crystal Grips',
    'Ember Fists',
    'Aether Gauntlets',
  ],
  belt: ['Rope Belt', 'Leather Belt', 'Iron Girdle', 'Crystal Sash', 'Ember Cinch', 'Aether Girdle'],
  charm: ['Charm', 'Charm', 'Charm', 'Charm', 'Charm', 'Charm'],
  amulet: [
    'Wooden Charm',
    'Iron Pendant',
    'Silver Amulet',
    'Crystal Locket',
    'Ember Talisman',
    'Aether Heart',
  ],
};

export const SLOT_ICON: Record<Slot | WeaponKind, IconId> = {
  weapon: 'icon_sword',
  sword: 'icon_sword',
  greatsword: 'icon_greatsword',
  dagger: 'icon_dagger',
  staff: 'icon_staff',
  helm: 'icon_helm',
  armor: 'icon_armor',
  boots: 'icon_boots',
  ring: 'icon_ring',
  amulet: 'icon_amulet',
  gloves: 'icon_gloves',
  belt: 'icon_belt',
  charm: 'icon_charm_small',
};

export const SLOT_LABEL: Record<Slot, string> = {
  weapon: 'Weapon',
  helm: 'Helm',
  armor: 'Armor',
  boots: 'Boots',
  ring: 'Ring',
  amulet: 'Amulet',
  gloves: 'Gloves',
  belt: 'Belt',
  charm: 'Charm',
};

export const WEAPON_LABEL: Record<WeaponKind, string> = {
  sword: 'Sword',
  greatsword: 'Greatsword',
  dagger: 'Dagger',
  staff: 'Staff',
};

export const WEAPON_KINDS: readonly WeaponKind[] = ['sword', 'greatsword', 'dagger', 'staff'];

/** Per-weapon combat feel. Timings are in seconds (before attack speed). */
export interface WeaponFeel {
  range: number;
  arc: number; // full arc in radians
  windup: number;
  active: number;
  recover: number;
  dmg: number; // combo hit multiplier
  knockback: number;
  lunge: number;
  ranged: boolean;
  desc: string;
}

export const WEAPON_FEEL: Record<WeaponKind, WeaponFeel> = {
  sword: {
    range: 26,
    arc: 2.4,
    windup: 0.05,
    active: 0.09,
    recover: 0.16,
    dmg: 1,
    knockback: 90,
    lunge: 40,
    ranged: false,
    desc: 'Balanced reach and speed.',
  },
  greatsword: {
    range: 34,
    arc: 3.0,
    windup: 0.12,
    active: 0.12,
    recover: 0.28,
    dmg: 1.55,
    knockback: 170,
    lunge: 30,
    ranged: false,
    desc: 'Slow, wide, devastating swings.',
  },
  dagger: {
    range: 20,
    arc: 1.8,
    windup: 0.03,
    active: 0.06,
    recover: 0.09,
    dmg: 0.62,
    knockback: 50,
    lunge: 55,
    ranged: false,
    desc: 'Lightning-fast stabs. High crit.',
  },
  staff: {
    range: 150,
    arc: 0,
    windup: 0.08,
    active: 0.05,
    recover: 0.22,
    dmg: 0.9,
    knockback: 50,
    lunge: 0,
    ranged: true,
    desc: 'Fires magic bolts scaling with Magic.',
  },
};

/** Implicit base stats for a slot at an item level (before rarity/upgrade multipliers). */
export function slotBaseStats(slot: Slot, kind: WeaponKind | undefined, ilvl: number): Partial<Stats> {
  const w = 5 + 2.4 * ilvl;
  switch (slot) {
    case 'weapon':
      switch (kind ?? 'sword') {
        case 'sword':
          return { atk: w };
        case 'greatsword':
          return { atk: w * 1.5 };
        case 'dagger':
          return { atk: w * 0.75, crit: 0.06 };
        case 'staff':
          return { atk: w * 0.45, mag: w * 1.35 };
      }
      break;
    case 'helm':
      return { def: 2 + 0.8 * ilvl, maxHp: 4 + 2 * ilvl };
    case 'armor':
      return { def: 4 + 1.6 * ilvl, maxHp: 8 + 4 * ilvl };
    case 'boots':
      return { def: 1.5 + 0.6 * ilvl, moveSpeed: 0.04 };
    case 'ring':
      return { atk: 1 + 0.6 * ilvl };
    case 'amulet':
      return { maxMp: 5 + 1.5 * ilvl, mag: 1 + 0.6 * ilvl };
    case 'gloves':
      return { def: 1 + 0.5 * ilvl, atk: 0.5 + 0.4 * ilvl };
    case 'belt':
      return { def: 1 + 0.5 * ilvl, maxHp: 6 + 3 * ilvl };
    case 'charm':
      return {};
  }
  return {};
}

export interface AffixDef {
  stat: StatKey;
  slots: readonly Slot[];
  weight: number;
  min: (ilvl: number) => number;
  max: (ilvl: number) => number;
  prefix: string;
  suffix: string;
}

const flat =
  (a: number, b: number) =>
  (ilvl: number): number =>
    a + b * ilvl;
const fixed = (v: number) => (): number => v;

export const AFFIXES: readonly AffixDef[] = [
  {
    stat: 'atk',
    slots: ['weapon', 'ring', 'amulet', 'helm', 'gloves'],
    weight: 10,
    min: flat(1, 0.5),
    max: flat(2, 1),
    prefix: 'Vicious',
    suffix: 'of Might',
  },
  {
    stat: 'mag',
    slots: ['weapon', 'ring', 'amulet', 'helm'],
    weight: 10,
    min: flat(1, 0.5),
    max: flat(2, 1),
    prefix: 'Arcane',
    suffix: 'of the Magi',
  },
  {
    stat: 'def',
    slots: ['armor', 'helm', 'boots', 'ring', 'gloves', 'belt'],
    weight: 10,
    min: flat(1, 0.4),
    max: flat(2, 0.8),
    prefix: 'Sturdy',
    suffix: 'of the Bulwark',
  },
  {
    stat: 'maxHp',
    slots: ['weapon', 'helm', 'armor', 'boots', 'ring', 'amulet', 'gloves', 'belt'],
    weight: 12,
    min: flat(5, 3),
    max: flat(10, 6),
    prefix: 'Hale',
    suffix: 'of Vigor',
  },
  {
    stat: 'maxMp',
    slots: ['helm', 'amulet', 'ring', 'weapon', 'belt'],
    weight: 7,
    min: flat(3, 1),
    max: flat(6, 2),
    prefix: 'Mystic',
    suffix: 'of Insight',
  },
  {
    stat: 'crit',
    slots: ['weapon', 'ring', 'amulet', 'helm', 'gloves'],
    weight: 7,
    min: fixed(0.02),
    max: fixed(0.06),
    prefix: 'Keen',
    suffix: 'of Precision',
  },
  {
    stat: 'critDmg',
    slots: ['weapon', 'amulet', 'ring', 'gloves'],
    weight: 6,
    min: fixed(0.08),
    max: fixed(0.3),
    prefix: 'Brutal',
    suffix: 'of Slaughter',
  },
  {
    stat: 'atkSpeed',
    slots: ['weapon', 'ring', 'boots', 'gloves'],
    weight: 6,
    min: fixed(0.04),
    max: fixed(0.12),
    prefix: 'Swift',
    suffix: 'of Haste',
  },
  {
    stat: 'moveSpeed',
    slots: ['boots', 'amulet'],
    weight: 5,
    min: fixed(0.03),
    max: fixed(0.08),
    prefix: 'Fleet',
    suffix: 'of the Wind',
  },
  {
    stat: 'lifesteal',
    slots: ['weapon', 'ring', 'amulet', 'gloves'],
    weight: 4,
    min: fixed(0.01),
    max: fixed(0.03),
    prefix: 'Vampiric',
    suffix: 'of the Leech',
  },
  {
    stat: 'cdr',
    slots: ['helm', 'amulet', 'ring'],
    weight: 5,
    min: fixed(0.03),
    max: fixed(0.1),
    prefix: 'Focused',
    suffix: 'of Clarity',
  },
  {
    stat: 'goldFind',
    slots: ['ring', 'amulet', 'helm', 'boots', 'belt', 'gloves'],
    weight: 5,
    min: fixed(0.08),
    max: fixed(0.25),
    prefix: 'Gilded',
    suffix: 'of Fortune',
  },
  {
    stat: 'magicFind',
    slots: ['ring', 'amulet', 'helm'],
    weight: 4,
    min: fixed(0.05),
    max: fixed(0.2),
    prefix: 'Lucky',
    suffix: 'of Treasure',
  },
  {
    stat: 'xpBonus',
    slots: ['amulet', 'helm', 'belt'],
    weight: 4,
    min: fixed(0.03),
    max: fixed(0.1),
    prefix: 'Wise',
    suffix: 'of Learning',
  },
  {
    stat: 'hpRegen',
    slots: ['armor', 'amulet', 'ring', 'belt'],
    weight: 6,
    min: flat(0.3, 0.1),
    max: flat(0.6, 0.25),
    prefix: 'Mending',
    suffix: 'of Renewal',
  },
  {
    stat: 'mpRegen',
    slots: ['amulet', 'weapon', 'helm', 'belt'],
    weight: 5,
    min: flat(0.2, 0.05),
    max: flat(0.5, 0.1),
    prefix: 'Flowing',
    suffix: 'of the Spring',
  },
  {
    stat: 'burnChance',
    slots: ['weapon', 'gloves'],
    weight: 3,
    min: fixed(0.04),
    max: fixed(0.12),
    prefix: 'Blazing',
    suffix: 'of Embers',
  },
  {
    stat: 'skillDmg',
    slots: ['amulet', 'helm', 'weapon', 'gloves'],
    weight: 5,
    min: fixed(0.05),
    max: fixed(0.15),
    prefix: 'Empowered',
    suffix: 'of Sorcery',
  },
];

export interface LegendaryDef {
  id: LegendaryId;
  name: string;
  slot: Slot;
  kind?: WeaponKind;
  power: string;
  bonus: Partial<Stats>;
}

export const LEGENDARIES: readonly LegendaryDef[] = [
  {
    id: 'thornfang',
    name: "Thornmaw's Fang",
    slot: 'weapon',
    kind: 'dagger',
    power: 'Hits poison enemies for 40% ATK over 3s.',
    bonus: { crit: 0.05 },
  },
  {
    id: 'mountain_heart',
    name: 'Heart of the Mountain',
    slot: 'armor',
    power: '+25% Max HP. Reflects 25% of melee damage taken.',
    bonus: {},
  },
  {
    id: 'dragonbreath',
    name: 'Dragonbreath',
    slot: 'weapon',
    kind: 'sword',
    power: 'Every 3rd combo hit unleashes a wave of fire.',
    bonus: { burnChance: 0.1 },
  },
  {
    id: 'seraphs_tear',
    name: "Seraphine's Tear",
    slot: 'amulet',
    power: 'When hit, release a Frost Nova (8s cooldown).',
    bonus: { maxMp: 20 },
  },
  {
    id: 'hollow_crown',
    name: 'The Hollow Crown',
    slot: 'helm',
    power: '+30% damage dealt, but -15% Max HP.',
    bonus: { dmgBonus: 0.3 },
  },
  {
    id: 'windwalkers',
    name: 'Windwalker Treads',
    slot: 'boots',
    power: 'Dodge rolls cost 50% less and leave a slashing gust.',
    bonus: { moveSpeed: 0.06 },
  },
  {
    id: 'phoenix_band',
    name: 'Phoenix Band',
    slot: 'ring',
    power: 'Once per area, cheat death and revive with 40% HP.',
    bonus: { hpRegen: 2 },
  },
  {
    id: 'stormcaller',
    name: 'Stormcaller',
    slot: 'weapon',
    kind: 'staff',
    power: 'Staff bolts chain lightning to 2 nearby enemies.',
    bonus: { mpRegen: 1 },
  },
  {
    id: 'vampire_kiss',
    name: 'Crimson Kiss',
    slot: 'ring',
    power: 'Kills restore 3% Max HP.',
    bonus: { lifesteal: 0.06 },
  },
  {
    id: 'echo_blade',
    name: 'Echo of the First Hero',
    slot: 'weapon',
    kind: 'greatsword',
    power: 'Each swing echoes with a second slash (60% dmg).',
    bonus: { atkSpeed: 0.08 },
  },
];

export const CONSUMABLES: Record<ConsumableId, ConsumableDef> = {
  elixir: {
    id: 'elixir',
    name: 'Elixir',
    icon: 'icon_elixir',
    desc: 'Fully restores HP and MP.',
    price: 240,
  },
  phoenix: {
    id: 'phoenix',
    name: 'Phoenix Feather',
    icon: 'icon_phoenix',
    desc: 'Auto-revives you with 50% HP when you fall.',
    price: 600,
  },
  tonic_might: {
    id: 'tonic_might',
    name: 'Tonic of Might',
    icon: 'icon_potion_hp',
    desc: '+20% damage for 3 minutes.',
    price: 160,
  },
  tonic_guard: {
    id: 'tonic_guard',
    name: 'Tonic of Guarding',
    icon: 'icon_potion_mp',
    desc: 'Take 20% less damage for 3 minutes.',
    price: 160,
  },
  tonic_fortune: {
    id: 'tonic_fortune',
    name: 'Tonic of Fortune',
    icon: 'icon_elixir',
    desc: '+50% Magic Find and Gold Find for 5 minutes. (Crafted only.)',
    price: 0,
  },
};

/** Consumables sold by Mira (crafted-only ones have no price). */
export const SHOP_CONSUMABLES = (Object.keys(CONSUMABLES) as ConsumableId[]).filter(
  (id) => CONSUMABLES[id].price > 0,
);

export const MATERIALS: Record<MaterialId, MaterialDef> = {
  dust: {
    id: 'dust',
    name: 'Aether Dust',
    icon: 'icon_dust',
    desc: 'Salvaged essence. Used by the blacksmith.',
    sell: 0,
  },
  herb: {
    id: 'herb',
    name: 'Moonpetal',
    icon: 'icon_herb',
    desc: 'A glowing herb from the Whispering Woods. Used in brewing.',
    sell: 6,
  },
  pelt: {
    id: 'pelt',
    name: 'Thick Pelt',
    icon: 'icon_pelt',
    desc: 'Warm fur from a wild beast. Used to craft armor and tonics.',
    sell: 8,
  },
  crystal: {
    id: 'crystal',
    name: 'Cave Crystal',
    icon: 'icon_crystal',
    desc: 'Resonates with faint aether. Used to craft jewelry, weapons and dust.',
    sell: 14,
  },
  ember: {
    id: 'ember',
    name: 'Ember Core',
    icon: 'icon_ember',
    desc: 'Still warm to the touch. Used to forge weapons and brew tonics.',
    sell: 20,
  },
  frost: {
    id: 'frost',
    name: 'Frost Essence',
    icon: 'icon_frost',
    desc: 'Never melts. Used to forge armor and brew tonics.',
    sell: 26,
  },
  void: {
    id: 'void',
    name: 'Void Fragment',
    icon: 'icon_void',
    desc: 'A sliver of nothing. Unsettling. Used for charms and sockets.',
    sell: 34,
  },
};
