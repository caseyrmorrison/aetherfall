/** Pure item logic: generation, stat totals, naming, scoring and descriptions. */
import type { IconId, WeaponKind } from '../art/pixel/types';
import {
  AFFIXES,
  LEGENDARIES,
  SLOT_ICON,
  SLOT_LABEL,
  TIER_NAMES,
  WEAPON_KINDS,
  WEAPON_LABEL,
  slotBaseStats,
} from '../data/items';
import type { RNG } from '../engine/rng';
import { upgradeMult } from './balance';
import { gemEffect, socketGroup } from './gems';
import type {
  Affix,
  CharmSize,
  EquipSlot,
  GearSlot,
  Item,
  LegendaryId,
  Rarity,
  Slot,
  StatKey,
  Stats,
} from './types';
import { CHARM_LIMIT, GEAR_SLOTS, RARITIES, STAT_INFO, equipSlotsFor } from './types';

export const RARITY_INDEX: Record<Rarity, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
  abyssal: 5,
};
const RARITY_MULT = [1, 1.1, 1.22, 1.38, 1.55, 1.9];
const AFFIX_COUNT = [0, 1, 2, 3, 3, 4];
/** Abyssal items never roll by chance (weight 0); they come from `generateAbyssal`. */
const RARITY_WEIGHTS = [600, 280, 90, 25, 5, 0];

export const tierForLevel = (ilvl: number): number => Math.max(0, Math.min(5, Math.floor((ilvl - 1) / 6)));

let uidCounter = 0;
export function newUid(rng: RNG): string {
  uidCounter = (uidCounter + 1) % 1_000_000;
  return `${Date.now().toString(36)}${uidCounter.toString(36)}${Math.floor(rng.next() * 1e6).toString(36)}`;
}

export interface RarityRoll {
  magicFind?: number;
  /** Lowest rarity allowed. */
  min?: Rarity;
  /** Extra shift toward high rarities (elites/bosses/difficulty). */
  bonus?: number;
}

export function rollRarity(rng: RNG, opts: RarityRoll = {}): Rarity {
  const mf = Math.max(0, (opts.magicFind ?? 0) + (opts.bonus ?? 0));
  const minIdx = RARITY_INDEX[opts.min ?? 'common'];
  const entries = RARITIES.map((r, i) => {
    let w = RARITY_WEIGHTS[i];
    if (i === 1) w *= 1 + mf * 0.5;
    if (i >= 2) w *= 1 + mf * (1 + (i - 2) * 0.5);
    if (i < minIdx) w = 0;
    return [r, w] as const;
  });
  return rng.weighted(entries);
}

const round = (stat: StatKey, v: number): number =>
  STAT_INFO[stat].pct
    ? Math.round(v * 100) / 100
    : stat === 'hpRegen' || stat === 'mpRegen'
      ? Math.round(v * 10) / 10
      : v < 0
        ? Math.min(-1, Math.round(v))
        : Math.max(1, Math.round(v));

/** Where affixes roll: `floor` is the lowest fraction of the min–max range, `mult` scales the result. */
interface AffixRoll {
  floor: number;
  mult: number;
}
const NORMAL_ROLL: AffixRoll = { floor: 0, mult: 1 };

function rollAffixes(
  rng: RNG,
  slot: Slot,
  ilvl: number,
  count: number,
  exclude: StatKey[] = [],
  roll: AffixRoll = NORMAL_ROLL,
): Affix[] {
  const pool = AFFIXES.filter((a) => a.slots.includes(slot) && !exclude.includes(a.stat));
  const out: Affix[] = [];
  for (let i = 0; i < count && pool.length; i++) {
    const def = rng.weighted(pool.map((a) => [a, a.weight] as const));
    pool.splice(pool.indexOf(def), 1);
    const lo = def.min(ilvl);
    const hi = def.max(ilvl);
    const t = roll.floor + (1 - roll.floor) * rng.next();
    out.push({ stat: def.stat, value: round(def.stat, (lo + (hi - lo) * t) * roll.mult) });
  }
  return out;
}

// ------------------------------------------------------------------ charms ----

export const CHARM_INFO: Record<CharmSize, { name: string; affixes: number; scale: number; rarity: Rarity }> =
  {
    small: { name: 'Small Charm', affixes: 1, scale: 0.5, rarity: 'uncommon' },
    large: { name: 'Large Charm', affixes: 2, scale: 0.45, rarity: 'rare' },
    grand: { name: 'Grand Charm', affixes: 3, scale: 0.42, rarity: 'epic' },
  };

/** Drawbacks carried by cursed charms (values are negative). */
const CURSES: readonly {
  stat: StatKey;
  lo: (l: number) => number;
  hi: (l: number) => number;
  name: string;
}[] = [
  { stat: 'maxHp', lo: (l) => 6 + 3 * l, hi: (l) => 10 + 5 * l, name: 'Frailty' },
  { stat: 'def', lo: (l) => 1 + 0.5 * l, hi: (l) => 2 + 0.9 * l, name: 'Brittleness' },
  { stat: 'moveSpeed', lo: () => 0.04, hi: () => 0.08, name: 'Lethargy' },
  { stat: 'atkSpeed', lo: () => 0.04, hi: () => 0.1, name: 'Sloth' },
  { stat: 'crit', lo: () => 0.02, hi: () => 0.05, name: 'Clumsiness' },
  { stat: 'goldFind', lo: () => 0.1, hi: () => 0.25, name: 'Poverty' },
  { stat: 'mpRegen', lo: (l) => 0.3 + 0.05 * l, hi: (l) => 0.6 + 0.1 * l, name: 'Silence' },
];
/** Cursed charms roll their bonuses this much stronger. */
export const CURSE_BONUS = 1.8;
export const CURSE_CHANCE = 0.3;

export interface CharmOptions {
  size?: CharmSize;
  cursed?: boolean;
}

/** Charms work from the bag. Small ones roll 1 bonus, large 2, grand 3; cursed ones add a drawback. */
export function generateCharm(rng: RNG, ilvl: number, opts: CharmOptions = {}): Item {
  ilvl = Math.max(1, Math.round(ilvl));
  const size: CharmSize =
    opts.size ??
    rng.weighted([
      ['small', 6],
      ['large', 3],
      ['grand', 1],
    ] as const);
  const cursed = opts.cursed ?? rng.chance(CURSE_CHANCE);
  const info = CHARM_INFO[size];
  const pool = [...AFFIXES];
  const affixes: Affix[] = [];
  for (let i = 0; i < info.affixes && pool.length; i++) {
    const def = rng.weighted(pool.map((a) => [a, a.weight] as const));
    pool.splice(pool.indexOf(def), 1);
    const lo = def.min(ilvl);
    const hi = def.max(ilvl);
    const v = (lo + (hi - lo) * rng.next()) * info.scale * (cursed ? CURSE_BONUS : 1);
    affixes.push({ stat: def.stat, value: round(def.stat, v) });
  }
  let curseName = '';
  if (cursed) {
    const options = CURSES.filter((c) => !affixes.some((a) => a.stat === c.stat));
    const c = rng.pick(options);
    const v = c.lo(ilvl) + (c.hi(ilvl) - c.lo(ilvl)) * rng.next();
    affixes.push({ stat: c.stat, value: round(c.stat, -v) });
    curseName = ` of ${c.name}`;
  }
  const prefix = AFFIXES.find((a) => a.stat === affixes[0].stat)?.prefix ?? '';
  return {
    uid: newUid(rng),
    slot: 'charm',
    tier: tierForLevel(ilvl),
    ilvl,
    rarity: info.rarity,
    name: `${cursed ? 'Cursed ' : ''}${prefix} ${info.name}${curseName}`,
    base: {},
    affixes,
    upgrade: 0,
    charmSize: size,
    cursed,
    isNew: true,
  };
}

export interface GenerateOptions {
  slot?: Slot;
  kind?: WeaponKind;
  rarity?: Rarity;
  rarityRoll?: RarityRoll;
  legendary?: LegendaryId;
}

export function generateItem(rng: RNG, ilvl: number, opts: GenerateOptions = {}): Item {
  ilvl = Math.max(1, Math.round(ilvl));
  if (opts.slot === 'charm') return generateCharm(rng, ilvl);
  if (opts.rarity === 'abyssal') return generateAbyssal(rng, ilvl, opts);
  let rarity = opts.rarity ?? rollRarity(rng, opts.rarityRoll);
  let legendary = opts.legendary;
  if (legendary) rarity = 'legendary';
  let slot: Slot;
  let kind: WeaponKind | undefined;
  if (rarity === 'legendary') {
    const def = legendary
      ? LEGENDARIES.find((l) => l.id === legendary)!
      : rng.pick(opts.slot ? LEGENDARIES.filter((l) => l.slot === opts.slot) : LEGENDARIES);
    legendary = def.id;
    slot = def.slot;
    kind = def.kind;
  } else {
    slot = opts.slot ?? rng.weighted(GEAR_SLOTS.map((s) => [s, s === 'weapon' ? 3 : 2] as const));
    if (slot === 'weapon')
      kind = opts.kind ?? rng.weighted(WEAPON_KINDS.map((k) => [k, k === 'sword' ? 3 : 2] as const));
  }
  const ri = RARITY_INDEX[rarity];
  const tier = tierForLevel(ilvl);
  const baseRaw = slotBaseStats(slot, kind, ilvl);
  const base: Partial<Stats> = {};
  for (const [k, v] of Object.entries(baseRaw) as [StatKey, number][]) {
    base[k] = round(k, STAT_INFO[k].pct ? v : v * RARITY_MULT[ri]);
  }
  const affixes = rollAffixes(rng, slot, ilvl, AFFIX_COUNT[ri]);
  let name: string;
  if (legendary) {
    const def = LEGENDARIES.find((l) => l.id === legendary)!;
    name = def.name;
    for (const [k, v] of Object.entries(def.bonus) as [StatKey, number][])
      affixes.unshift({ stat: k, value: v });
  } else {
    const baseName = TIER_NAMES[kind ?? slot][tier];
    const pre = affixes[0] ? AFFIXES.find((a) => a.stat === affixes[0].stat)!.prefix + ' ' : '';
    const suf = affixes[1] && ri >= 2 ? ' ' + AFFIXES.find((a) => a.stat === affixes[1].stat)!.suffix : '';
    name = `${pre}${baseName}${suf}`;
  }
  return {
    uid: newUid(rng),
    slot,
    kind,
    tier,
    ilvl,
    rarity,
    name,
    base,
    affixes,
    upgrade: 0,
    legendary,
    isNew: true,
  };
}

// ---------------------------------------------------------------- abyssal ----

/** Most sockets each gear type can roll (Diablo-style: chest pieces hold the most). */
export const MAX_SOCKETS: Record<GearSlot, number> = {
  weapon: 2,
  armor: 3,
  helm: 1,
  gloves: 1,
  belt: 1,
  boots: 1,
  ring: 1,
  amulet: 1,
};

/** Abyssal affixes roll in the top 40% of their range, then 25% stronger. */
const ABYSSAL_ROLL: AffixRoll = { floor: 0.6, mult: 1.25 };

/** Every Abyssal item also carries one of these big offensive bonuses. */
const ABYSSAL_BONUS: readonly { stat: StatKey; lo: number; hi: number }[] = [
  { stat: 'dmgBonus', lo: 0.08, hi: 0.15 },
  { stat: 'skillDmg', lo: 0.1, hi: 0.2 },
  { stat: 'critDmg', lo: 0.25, hi: 0.45 },
  { stat: 'atkSpeed', lo: 0.06, hi: 0.12 },
  { stat: 'cdr', lo: 0.05, hi: 0.1 },
];

/** Roll 1..max sockets, favouring fewer. */
export function rollSockets(rng: RNG, slot: GearSlot): number {
  const max = MAX_SOCKETS[slot];
  const weights = [6, 3, 1.2];
  return rng.weighted(weights.slice(0, max).map((w, i) => [i + 1, w] as const));
}

/**
 * Abyssal items: the rarest gear, found only in the Abyss. Much stronger base stats,
 * four high-rolled affixes, a big bonus and gem sockets.
 */
export function generateAbyssal(rng: RNG, ilvl: number, opts: GenerateOptions = {}): Item {
  ilvl = Math.max(1, Math.round(ilvl));
  const slot: GearSlot =
    opts.slot && isGear(opts.slot)
      ? opts.slot
      : rng.weighted(GEAR_SLOTS.map((s) => [s, s === 'weapon' ? 3 : 2] as const));
  const kind =
    slot === 'weapon'
      ? (opts.kind ?? rng.weighted(WEAPON_KINDS.map((k) => [k, k === 'sword' ? 3 : 2] as const)))
      : undefined;
  const ri = RARITY_INDEX.abyssal;
  const tier = tierForLevel(ilvl);
  const base: Partial<Stats> = {};
  for (const [k, v] of Object.entries(slotBaseStats(slot, kind, ilvl)) as [StatKey, number][])
    base[k] = round(k, STAT_INFO[k].pct ? v : v * RARITY_MULT[ri]);
  const affixes = rollAffixes(rng, slot, ilvl, AFFIX_COUNT[ri], [], ABYSSAL_ROLL);
  // one Abyssal bonus, plus more if the slot's own affix pool ran short (e.g. chest armor)
  const bonuses = ABYSSAL_BONUS.filter((b) => !affixes.some((a) => a.stat === b.stat));
  const want = AFFIX_COUNT[ri] + 1;
  do {
    const b = bonuses.splice(rng.int(0, bonuses.length - 1), 1)[0];
    affixes.push({ stat: b.stat, value: round(b.stat, b.lo + (b.hi - b.lo) * rng.next()) });
  } while (affixes.length < want && bonuses.length);
  const suffix = AFFIXES.find((a) => a.stat === affixes[0].stat)?.suffix ?? '';
  return {
    uid: newUid(rng),
    slot,
    kind,
    tier,
    ilvl,
    rarity: 'abyssal',
    name: `Abyssal ${TIER_NAMES[kind ?? slot][tier]} ${suffix}`.trim(),
    base,
    affixes,
    upgrade: 0,
    sockets: new Array<null>(rollSockets(rng, slot)).fill(null),
    isNew: true,
  };
}

/** Give gear an empty socket (Abyss-touched drops). Charms and already-socketed items are skipped. */
export function addSocket(item: Item): void {
  if (!isGear(item.slot) || item.sockets?.length) return;
  item.sockets = [null];
}

/** Total stats an item grants (base scaled by upgrade + affixes + socketed gems). */
export function itemStats(item: Item): Partial<Stats> {
  const out: Partial<Stats> = {};
  const m = upgradeMult(item.upgrade);
  for (const [k, v] of Object.entries(item.base) as [StatKey, number][]) {
    out[k] = (out[k] ?? 0) + (STAT_INFO[k].pct ? v : v * m);
  }
  for (const a of item.affixes) out[a.stat] = (out[a.stat] ?? 0) + a.value;
  if (item.sockets) {
    const group = socketGroup(item.slot);
    for (const g of item.sockets) {
      if (!g) continue;
      const e = gemEffect(g, group);
      out[e.stat] = (out[e.stat] ?? 0) + e.value;
    }
  }
  return out;
}

/** Weights for a single "power" number used to sort & compare gear. */
const SCORE_WEIGHTS: Record<StatKey, number> = {
  maxHp: 0.25,
  maxMp: 0.3,
  atk: 2,
  def: 1.6,
  mag: 2,
  crit: 120,
  critDmg: 40,
  atkSpeed: 90,
  moveSpeed: 80,
  lifesteal: 250,
  cdr: 100,
  goldFind: 25,
  magicFind: 40,
  xpBonus: 60,
  hpRegen: 6,
  mpRegen: 8,
  burnChance: 60,
  skillDmg: 90,
  dmgBonus: 150,
  dodgeCost: 40,
};

export function itemScore(item: Item): number {
  let s = 0;
  for (const [k, v] of Object.entries(itemStats(item)) as [StatKey, number][]) s += v * SCORE_WEIGHTS[k];
  if (item.legendary) s *= 1.25;
  // an empty socket is worth something: it can hold a gem later
  s += (item.sockets?.filter((g) => !g).length ?? 0) * 12;
  return Math.round(s);
}

export function formatStat(stat: StatKey, value: number, signed = true): string {
  const info = STAT_INFO[stat];
  const sign = signed && value > 0 ? '+' : '';
  if (info.pct) {
    // one decimal for small fractional percentages (e.g. 0.5% from a Chipped Emerald)
    const p = Math.round(value * 1000) / 10;
    return `${sign}${Number.isInteger(p) ? p : p.toFixed(1)}% ${info.label}`;
  }
  const v =
    Math.abs(value) < 10 && !Number.isInteger(value) ? value.toFixed(1) : Math.round(value).toString();
  return `${sign}${v} ${info.label}`;
}

export function itemTypeLabel(item: Item): string {
  if (item.slot === 'charm')
    return `${item.cursed ? 'Cursed ' : ''}${CHARM_INFO[item.charmSize ?? 'small'].name}`;
  return item.slot === 'weapon' && item.kind ? WEAPON_LABEL[item.kind] : SLOT_LABEL[item.slot];
}

export function displayName(item: Item): string {
  return item.upgrade > 0 ? `${item.name} +${item.upgrade}` : item.name;
}

export function legendaryPower(item: Item): string | undefined {
  return item.legendary ? LEGENDARIES.find((l) => l.id === item.legendary)?.power : undefined;
}

/** Stat difference (candidate - current) for tooltips. */
export function statDiff(candidate: Item, current: Item | null): Partial<Record<StatKey, number>> {
  const a = itemStats(candidate);
  const b = current ? itemStats(current) : {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)] as StatKey[]);
  const out: Partial<Record<StatKey, number>> = {};
  for (const k of keys) {
    const d = (a[k] ?? 0) - (b[k] ?? 0);
    if (Math.abs(d) > 1e-6) out[k] = d;
  }
  return out;
}

// -------------------------------------------------------------- equipment ----

interface EquipView {
  equipment: Record<EquipSlot, Item | null>;
  inventory: Item[];
}

/** The body slot an item would go into (empty ring finger first, else the weaker ring). */
export function equipTargetFor(s: EquipView, item: Item): EquipSlot | null {
  const slots = equipSlotsFor(item.slot);
  if (!slots.length) return null;
  const empty = slots.find((sl) => !s.equipment[sl]);
  if (empty) return empty;
  return slots.reduce((a, b) => (itemScore(s.equipment[a]!) <= itemScore(s.equipment[b]!) ? a : b));
}

/** The equipped item a bag item would replace (for comparisons). */
export function compareTarget(s: EquipView, item: Item): Item | null {
  const t = equipTargetFor(s, item);
  return t ? s.equipment[t] : null;
}

/** Charms that are currently empowering the hero (the first CHARM_LIMIT in the bag). */
export function activeCharms(s: EquipView): Item[] {
  return s.inventory.filter((i) => i.slot === 'charm').slice(0, CHARM_LIMIT);
}

export function isGear(slot: Slot): slot is GearSlot {
  return slot !== 'charm';
}

/** Icon for any item (weapons by kind, charms by size). */
export function itemIcon(item: Item): IconId {
  if (item.slot === 'charm') return `icon_charm_${item.charmSize ?? 'small'}`;
  return SLOT_ICON[item.slot === 'weapon' ? (item.kind ?? 'sword') : item.slot];
}
