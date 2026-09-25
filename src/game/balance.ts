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
    label: 'Story',
    desc: 'Enjoy the tale. Enemies hit softly and you keep all gold on death.',
  },
  normal: {
    enemyHp: 1,
    enemyDmg: 1,
    enemySpeed: 1,
    eliteChance: 0.06,
    lootBonus: 0,
    goldLossOnDeath: 0.2,
    label: 'Normal',
    desc: 'The intended challenge. Learn patterns, dodge, and grind if stuck.',
  },
  hard: {
    enemyHp: 1.35,
    enemyDmg: 1.4,
    enemySpeed: 1.08,
    eliteChance: 0.1,
    lootBonus: 0.25,
    goldLossOnDeath: 0.3,
    label: 'Hard',
    desc: 'Tougher, faster enemies and more elites. +25% rare loot.',
  },
  nightmare: {
    enemyHp: 1.8,
    enemyDmg: 1.9,
    enemySpeed: 1.15,
    eliteChance: 0.15,
    lootBonus: 0.6,
    goldLossOnDeath: 0.5,
    label: 'Nightmare',
    desc: 'For masochists. Brutal damage, many elites. +60% rare loot.',
  },
};

/** Multiplier applied to enemy base HP for its level. */
export const enemyHpScale = (level: number): number => 1 + 0.32 * (level - 1) + 0.004 * (level - 1) ** 2;
/** Multiplier applied to enemy base attack for its level. */
export const enemyAtkScale = (level: number): number => 1 + 0.2 * (level - 1);
export const enemyDefScale = (level: number): number => 1 + 0.25 * (level - 1);

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

/** Level difference damage modifier: being over-leveled matters, so grinding helps. */
export function levelDiffMod(attackerLevel: number, defenderLevel: number): number {
  const d = attackerLevel - defenderLevel;
  if (d >= 0) return 1 + Math.min(0.5, d * 0.05);
  return Math.max(0.5, 1 + d * 0.05);
}

/** Fraction of damage blocked by defense (0..0.8). */
export function defenseReduction(def: number, attackerLevel: number): number {
  if (def <= 0) return 0;
  return Math.min(0.8, def / (def + 6 * attackerLevel + 40));
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
  Math.round([1, 3, 8, 20, 50][rarityIndex] * (1 + ilvl / 12));

/** Gold for selling an item. */
export const sellPrice = (ilvl: number, rarityIndex: number, upgrade: number): number =>
  Math.round((5 + ilvl * 3) * [1, 2, 4, 8, 16][rarityIndex] * (1 + upgrade * 0.2));

/** Shop price for buying an item. */
export const buyPrice = (ilvl: number, rarityIndex: number): number => sellPrice(ilvl, rarityIndex, 0) * 4;

/** Cost of the next flask expansion (charges beyond the base). */
export const flaskUpgradeCost = (purchased: number): number => Math.round(150 * Math.pow(2.1, purchased));
export const MAX_FLASK_UPGRADES = 5;

/** Cost to reset the passive tree. */
export const respecCost = (level: number): number => 50 + level * 25;
