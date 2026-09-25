/** Pure item logic: generation, stat totals, naming, scoring and descriptions. */
import type { WeaponKind } from '../art/pixel/types';
import {
  AFFIXES,
  LEGENDARIES,
  SLOT_LABEL,
  TIER_NAMES,
  WEAPON_KINDS,
  WEAPON_LABEL,
  slotBaseStats,
} from '../data/items';
import type { RNG } from '../engine/rng';
import { upgradeMult } from './balance';
import type { Affix, Item, LegendaryId, Rarity, Slot, StatKey, Stats } from './types';
import { RARITIES, SLOTS, STAT_INFO } from './types';

export const RARITY_INDEX: Record<Rarity, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
};
const RARITY_MULT = [1, 1.1, 1.22, 1.38, 1.55];
const AFFIX_COUNT = [0, 1, 2, 3, 3];
const RARITY_WEIGHTS = [600, 280, 90, 25, 5];

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
      : Math.max(1, Math.round(v));

function rollAffixes(rng: RNG, slot: Slot, ilvl: number, count: number, exclude: StatKey[] = []): Affix[] {
  const pool = AFFIXES.filter((a) => a.slots.includes(slot) && !exclude.includes(a.stat));
  const out: Affix[] = [];
  for (let i = 0; i < count && pool.length; i++) {
    const def = rng.weighted(pool.map((a) => [a, a.weight] as const));
    pool.splice(pool.indexOf(def), 1);
    const lo = def.min(ilvl);
    const hi = def.max(ilvl);
    out.push({ stat: def.stat, value: round(def.stat, lo + (hi - lo) * rng.next()) });
  }
  return out;
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
    slot = opts.slot ?? rng.weighted(SLOTS.map((s) => [s, s === 'weapon' ? 3 : 2] as const));
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

/** Total stats an item grants (base scaled by upgrade + affixes). */
export function itemStats(item: Item): Partial<Stats> {
  const out: Partial<Stats> = {};
  const m = upgradeMult(item.upgrade);
  for (const [k, v] of Object.entries(item.base) as [StatKey, number][]) {
    out[k] = (out[k] ?? 0) + (STAT_INFO[k].pct ? v : v * m);
  }
  for (const a of item.affixes) out[a.stat] = (out[a.stat] ?? 0) + a.value;
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
  return Math.round(s);
}

export function formatStat(stat: StatKey, value: number, signed = true): string {
  const info = STAT_INFO[stat];
  const sign = signed && value > 0 ? '+' : '';
  if (info.pct) return `${sign}${Math.round(value * 100)}% ${info.label}`;
  const v =
    Math.abs(value) < 10 && !Number.isInteger(value) ? value.toFixed(1) : Math.round(value).toString();
  return `${sign}${v} ${info.label}`;
}

export function itemTypeLabel(item: Item): string {
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
