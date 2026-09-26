/** Static gem data: the five gem types, quality names, socket effects and combine costs. */
import type { GemType, SocketGroup, StatKey } from '../game/types';

export const GEM_TYPES: readonly GemType[] = ['ruby', 'emerald', 'topaz', 'amethyst', 'diamond'];

/** Quality names from worst to best (index = quality). The plain gem has no prefix. */
export const GEM_QUALITIES = [
  'Chipped',
  'Flawed',
  '',
  'Flawless',
  'Perfect',
  'Radiant',
  'Imperial',
  'Royal',
] as const;
export const MAX_GEM_QUALITY = GEM_QUALITIES.length - 1;

/** Best quality that drops from monsters; Imperial and Royal gems can only be combined. */
export const MAX_DROP_QUALITY = 5;

/** How many gems of one quality combine into a single gem of the next quality. */
export const GEMS_PER_COMBINE = 3;

/** Gold to combine three gems of quality `q` into one of `q + 1`. */
export const GEM_COMBINE_GOLD: readonly number[] = [50, 150, 400, 1000, 2500, 6000, 15000];

/** `markup` is the text color tag used for the gem's name. */
export const GEM_INFO: Record<GemType, { name: string; color: string; markup: string }> = {
  ruby: { name: 'Ruby', color: '#e43b44', markup: 'red' },
  emerald: { name: 'Emerald', color: '#63c74d', markup: 'green' },
  topaz: { name: 'Topaz', color: '#feae34', markup: 'gold' },
  amethyst: { name: 'Amethyst', color: '#b55088', markup: 'purple' },
  diamond: { name: 'Diamond', color: '#c0cbdc', markup: 'light' },
};

/** Multiplier on a gem's Chipped value for each quality. */
export const GEM_LADDER: readonly number[] = [1, 1.6, 2.4, 3.4, 4.7, 6.3, 8.3, 11];

/**
 * What each gem grants by socket group (Diablo-style): weapons get offense, helms get
 * utility, everything else (armor, gloves, belts, boots, jewelry) gets core stats.
 * `base` is the Chipped value; higher qualities scale it by GEM_LADDER.
 */
export const GEM_EFFECTS: Record<GemType, Record<SocketGroup, { stat: StatKey; base: number }>> = {
  ruby: {
    weapon: { stat: 'dmgBonus', base: 0.02 },
    helm: { stat: 'xpBonus', base: 0.04 },
    armor: { stat: 'atk', base: 5 },
  },
  emerald: {
    weapon: { stat: 'critDmg', base: 0.05 },
    helm: { stat: 'goldFind', base: 0.08 },
    armor: { stat: 'crit', base: 0.005 },
  },
  topaz: {
    weapon: { stat: 'skillDmg', base: 0.02 },
    helm: { stat: 'magicFind', base: 0.03 },
    armor: { stat: 'mag', base: 5 },
  },
  amethyst: {
    weapon: { stat: 'lifesteal', base: 0.004 },
    helm: { stat: 'hpRegen', base: 1 },
    armor: { stat: 'maxHp', base: 30 },
  },
  diamond: {
    weapon: { stat: 'atkSpeed', base: 0.01 },
    helm: { stat: 'cdr', base: 0.01 },
    armor: { stat: 'def', base: 4 },
  },
};

export const SOCKET_GROUP_LABEL: Record<SocketGroup, string> = {
  weapon: 'Weapon',
  helm: 'Helm',
  armor: 'Armor & Jewelry',
};
