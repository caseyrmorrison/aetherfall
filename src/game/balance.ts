/**
 * All tunable balance formulas live here so they can be unit-tested and tweaked
 * in one place.
 */
import type { Difficulty, Stats } from './types';
import { ZERO_STATS } from './types';

export const MAX_LEVEL = 60;

/** XP needed to go from `level` to `level + 1`. */
export function xpToNext(level: number): number {
  if (level >= MAX_LEVEL) return Infinity;
  return Math.round(30 * Math.pow(level, 1.55) + 20);
}

/** Hero base stats before gear / passives. */
export function heroBaseStats(level: number): Stats {
  const l = level - 1;
  return {
    ...ZERO_STATS,
    maxHp: Math.round(100 + 18 * l),
    maxMp: Math.round(40 + 4 * l),
    atk: 8 + 2 * l,
    def: 4 + 1.4 * l,
    mag: 8 + 2 * l,
    crit: 0.05,
    critDmg: 0.5,
    hpRegen: 0.4 + 0.05 * l,
    mpRegen: 1.2 + 0.04 * l,
  };
}

export interface DifficultyMods {
  enemyHp: number;
  enemyDmg: number;
  enemySpeed: number;
  eliteChance: number;
  lootBonus: number;
  goldLossOnDeath: number;
  /** Enemy attack cooldowns are multiplied by this (lower = more aggressive). */
  aggression: number;
  /** How many enemies may be mid-attack at the same time. */
  tokens: number;
  /** Elite health and damage multipliers. */
  eliteHp: number;
  eliteDmg: number;
  /** XP and gold multipliers (harder difficulties pay more). */
  xpMult: number;
  goldMult: number;
  label: string;
  desc: string;
}

export const DIFFICULTY: Record<Difficulty, DifficultyMods> = {
  story: {
    enemyHp: 0.7,
    enemyDmg: 0.5,
    enemySpeed: 0.9,
    eliteChance: 0.03,
    lootBonus: 0,
    goldLossOnDeath: 0,
    aggression: 1.15,
    tokens: 1,
    eliteHp: 2.2,
    eliteDmg: 1.15,
    xpMult: 1,
    goldMult: 1,
    label: 'Story',
    desc: 'Enjoy the tale. Enemies hit softly and you keep all gold on death.',
  },
  normal: {
    enemyHp: 1.2,
    enemyDmg: 1.35,
    enemySpeed: 1,
    eliteChance: 0.08,
    lootBonus: 0,
    goldLossOnDeath: 0.2,
    aggression: 0.95,
    tokens: 2,
    eliteHp: 2.8,
    eliteDmg: 1.35,
    xpMult: 1,
    goldMult: 1,
    label: 'Normal',
    desc: 'The intended challenge. Enemies hit hard: learn their patterns, dodge, and grind if stuck.',
  },
  hard: {
    enemyHp: 1.85,
    enemyDmg: 2.1,
    enemySpeed: 1.1,
    eliteChance: 0.14,
    lootBonus: 0.3,
    goldLossOnDeath: 0.3,
    aggression: 0.85,
    tokens: 4,
    eliteHp: 3.2,
    eliteDmg: 1.5,
    xpMult: 1.2,
    goldMult: 1.2,
    label: 'Hard',
    desc: 'Tough, fast, aggressive enemies and many elites. +30% rare loot, +20% XP and gold.',
  },
  nightmare: {
    enemyHp: 2.7,
    enemyDmg: 3.1,
    enemySpeed: 1.18,
    eliteChance: 0.22,
    lootBonus: 0.7,
    goldLossOnDeath: 0.5,
    aggression: 0.75,
    tokens: 6,
    eliteHp: 3.6,
    eliteDmg: 1.6,
    xpMult: 1.4,
    goldMult: 1.4,
    label: 'Nightmare',
    desc: 'Punishing. Everything hits like a truck and swarms you. +70% rare loot, +40% XP and gold.',
  },
};

/** Torment tiers stack on top of Nightmare once the story is beaten. */
export const MAX_TORMENT = 6;
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

/** Difficulty modifiers including Torment (only applies on Nightmare). */
export function effectiveDifficulty(d: Difficulty, torment = 0): DifficultyMods {
  const base = DIFFICULTY[d];
  const t = d === 'nightmare' ? Math.max(0, Math.min(MAX_TORMENT, Math.floor(torment))) : 0;
  if (!t) return base;
  return {
    ...base,
    enemyHp: base.enemyHp * 1.45 ** t,
    enemyDmg: base.enemyDmg * 1.3 ** t,
    enemySpeed: base.enemySpeed * (1 + 0.02 * t),
    eliteChance: base.eliteChance + 0.02 * t,
    lootBonus: base.lootBonus + 0.25 * t,
    aggression: base.aggression * 0.97 ** t,
    xpMult: base.xpMult * (1 + 0.35 * t),
    goldMult: base.goldMult * (1 + 0.3 * t),
    label: `Torment ${ROMAN[t]}`,
    desc: `Nightmare, but ${Math.round((1.45 ** t - 1) * 100)}% more enemy health and ${Math.round((1.3 ** t - 1) * 100)}% more damage. Much better loot, XP and gold.`,
  };
}

/** Multiplier applied to enemy base HP for its level. */
export const enemyHpScale = (level: number): number => 1 + 0.32 * (level - 1) + 0.004 * (level - 1) ** 2;
/** Multiplier applied to enemy base attack for its level. */
export const enemyAtkScale = (level: number): number => 1 + 0.2 * (level - 1);
export const enemyDefScale = (level: number): number => 1 + 0.18 * (level - 1);

/** XP awarded for killing an enemy of `enemyLevel` as a hero of `heroLevel`. */
export function xpReward(baseXp: number, enemyLevel: number, heroLevel: number): number {
  const raw = baseXp * (1 + 0.45 * (enemyLevel - 1));
  const diff = enemyLevel - heroLevel;
  let mod = 1;
  if (diff > 0) mod = 1 + Math.min(0.5, diff * 0.1);
  else if (diff < -10) mod = 0.1;
  else if (diff < -5) mod = 0.5;
  return Math.max(1, Math.round(raw * mod));
}

/** Level difference damage modifier: being over-leveled helps (so grinding works), but only so much. */
export function levelDiffMod(attackerLevel: number, defenderLevel: number): number {
  const d = attackerLevel - defenderLevel;
  if (d >= 0) return 1 + Math.min(0.3, d * 0.04);
  return Math.max(0.6, 1 + d * 0.04);
}

/** Fraction of damage blocked by defense (0..0.75). */
export function defenseReduction(def: number, attackerLevel: number): number {
  if (def <= 0) return 0;
  return Math.min(0.75, def / (def + 9 * attackerLevel + 60));
}

export interface DamageInput {
  power: number;
  mult: number;
  attackerLevel: number;
  defenderLevel: number;
  defenderDef: number;
  critChance: number;
  critDmg: number;
  /** Additional multiplicative bonus (e.g. dmgBonus + skillDmg). */
  bonus?: number;
  /** Random roll in [0,1) for crit, and in [0,1) for variance. */
  rollCrit: number;
  rollVar: number;
}

export interface DamageResult {
  amount: number;
  crit: boolean;
}

export function computeDamage(i: DamageInput): DamageResult {
  const variance = 0.9 + i.rollVar * 0.2;
  let dmg = i.power * i.mult * variance * (1 + (i.bonus ?? 0));
  dmg *= 1 - defenseReduction(i.defenderDef, i.attackerLevel);
  dmg *= levelDiffMod(i.attackerLevel, i.defenderLevel);
  const crit = i.rollCrit < i.critChance;
  if (crit) dmg *= 1 + i.critDmg;
  return { amount: Math.max(1, Math.round(dmg)), crit };
}

/** Gold dropped by an enemy. */
export const goldDrop = (baseGold: number, level: number, roll: number): number =>
  Math.max(1, Math.round(baseGold * (1 + 0.3 * (level - 1)) * (0.7 + roll * 0.6)));

/** Blacksmith upgrade cost for taking an item from `upgrade` to `upgrade + 1`. */
export function upgradeCost(
  ilvl: number,
  upgrade: number,
  rarityIndex: number,
): { gold: number; dust: number } {
  const n = upgrade + 1;
  return {
    gold: Math.round(40 * Math.pow(n, 1.6) * (1 + ilvl / 8) * (1 + rarityIndex * 0.25)),
    dust: Math.round(n * 2 * (1 + rarityIndex * 0.5)),
  };
}

export const MAX_UPGRADE = 10;
/** Each upgrade level multiplies an item's base stats. */
export const upgradeMult = (upgrade: number): number => 1 + 0.1 * upgrade;

/** Aether dust yielded by salvaging an item. */
export const salvageYield = (ilvl: number, rarityIndex: number): number =>
  Math.round([1, 3, 8, 20, 50, 120][rarityIndex] * (1 + ilvl / 12));

/** Gold for selling an item. */
export const sellPrice = (ilvl: number, rarityIndex: number, upgrade: number): number =>
  Math.round((5 + ilvl * 3) * [1, 2, 4, 8, 16, 40][rarityIndex] * (1 + upgrade * 0.2));

/** Shop price for buying an item. */
export const buyPrice = (ilvl: number, rarityIndex: number): number => sellPrice(ilvl, rarityIndex, 0) * 4;

/** Cost of the next flask expansion (charges beyond the base). */
export const flaskUpgradeCost = (purchased: number): number => Math.round(150 * Math.pow(2.1, purchased));
export const MAX_FLASK_UPGRADES = 5;

// ------------------------------------------------------ storage upgrades ----

/** Bag slots: 40 to start, +8 (one row) per expansion bought from Mira. */
export const BASE_BAG = 40;
export const BAG_STEP = 8;
const BAG_COSTS = [500, 1500, 4000, 9000, 18000, 32000, 50000];
export const MAX_BAG_UPGRADES = BAG_COSTS.length;
export const bagSizeFor = (upgrades: number): number => BASE_BAG + BAG_STEP * upgrades;
export const bagUpgradeCost = (bought: number): number => BAG_COSTS[bought] ?? Infinity;

/** Active charms: 6 to start, +2 per Charm Satchel bought from Mira. */
export const BASE_CHARMS = 6;
export const CHARM_STEP = 2;
const CHARM_COSTS = [1000, 4000, 12000, 30000];
export const MAX_CHARM_UPGRADES = CHARM_COSTS.length;
export const charmLimitFor = (upgrades: number): number => BASE_CHARMS + CHARM_STEP * (upgrades ?? 0);
export const charmUpgradeCost = (bought: number): number => CHARM_COSTS[bought] ?? Infinity;

/** Stash: tabs of 48 slots. Two are free; more can be bought at the stash. */
export const STASH_TAB_SIZE = 48;
export const FREE_STASH_TABS = 2;
const STASH_TAB_COSTS = [5000, 20000, 60000, 150000];
export const MAX_STASH_TABS = FREE_STASH_TABS + STASH_TAB_COSTS.length;
export const stashTabCost = (owned: number): number => STASH_TAB_COSTS[owned - FREE_STASH_TABS] ?? Infinity;

// ---------------------------------------------------------- world bosses ----

/** Play time (seconds) before the first world boss, once events are unlocked. */
export const WORLD_BOSS_FIRST_DELAY = 180;
/** Play time between world boss events: [min, max] seconds. */
export const WORLD_BOSS_INTERVAL: readonly [number, number] = [720, 1080];
/** How long a world boss stays before leaving (it won't leave mid-fight). */
export const WORLD_BOSS_DURATION = 480;
/** World bosses are this many levels above the zone (or you, if you're higher). */
export const WORLD_BOSS_LEVEL_BONUS = 2;

/** Cost to reset the passive tree. */
export const respecCost = (level: number): number => 50 + level * 25;

// ----------------------------------------------------------- abyss loot ----

export type AbyssLootSource = 'normal' | 'elite' | 'boss' | 'chest' | 'rareChest';

/** Base chance of an Abyssal item per source (scaled up by depth, magic find and difficulty). */
export const ABYSSAL_CHANCE: Record<AbyssLootSource, number> = {
  normal: 0.0015,
  elite: 0.012,
  boss: 0.3,
  chest: 0.02,
  rareChest: 0.2,
};

/** Abyssal drop chances never go above this, however deep or lucky. */
export const ABYSSAL_MAX_CHANCE = 0.75;

/** Gem drops per source: [rolls, chance per roll]. Gems only drop in the Abyss. */
export const GEM_DROPS: Record<AbyssLootSource, readonly [number, number]> = {
  normal: [1, 0.05],
  elite: [2, 0.35],
  boss: [3, 1],
  chest: [2, 0.6],
  rareChest: [3, 1],
};

/** Chance that rare-or-better gear found in the Abyss has a gem socket. */
export const ABYSS_SOCKET_CHANCE = 0.15;
