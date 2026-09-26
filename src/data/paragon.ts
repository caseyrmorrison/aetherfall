/**
 * Paragon (Diablo 3 style): after the level cap, XP keeps earning Paragon levels.
 * Each level grants one point in a category, rotating Core → Offense → Defense → Utility.
 * Main stats are uncapped; everything else caps at 50 points.
 */
import type { StatKey } from '../game/types';

export type ParagonCategory = 'core' | 'offense' | 'defense' | 'utility';

export const PARAGON_CATEGORIES: readonly ParagonCategory[] = ['core', 'offense', 'defense', 'utility'];

export const PARAGON_CATEGORY_INFO: Record<ParagonCategory, { name: string; color: string; markup: string }> =
  {
    core: { name: 'Core', color: '#feae34', markup: 'gold' },
    offense: { name: 'Offense', color: '#e43b44', markup: 'red' },
    defense: { name: 'Defense', color: '#63c74d', markup: 'green' },
    utility: { name: 'Utility', color: '#0099db', markup: 'blue' },
  };

/** What a paragon stat changes, per point (`atkmag` raises both Attack and Magic). */
export type ParagonEffect =
  | { kind: 'stat'; stat: StatKey | 'atkmag' }
  | { kind: 'passive'; key: 'hpPct' | 'defPct' | 'flaskPotency' }
  | { kind: 'damageTaken' };

export interface ParagonStatDef {
  id: string;
  name: string;
  category: ParagonCategory;
  /** Bonus per point. */
  per: number;
  /** Most points this stat can take (0 = uncapped). */
  cap: number;
  pct: boolean;
  effect: ParagonEffect;
  label: string;
}

export const PARAGON_STATS: readonly ParagonStatDef[] = [
  // core
  {
    id: 'might',
    name: 'Might',
    category: 'core',
    per: 1.5,
    cap: 0,
    pct: false,
    effect: { kind: 'stat', stat: 'atkmag' },
    label: 'Attack & Magic',
  },
  {
    id: 'vitality',
    name: 'Vitality',
    category: 'core',
    per: 12,
    cap: 0,
    pct: false,
    effect: { kind: 'stat', stat: 'maxHp' },
    label: 'Max HP',
  },
  {
    id: 'swiftness',
    name: 'Swiftness',
    category: 'core',
    per: 0.005,
    cap: 20,
    pct: true,
    effect: { kind: 'stat', stat: 'moveSpeed' },
    label: 'Move Speed',
  },
  {
    id: 'focus',
    name: 'Focus',
    category: 'core',
    per: 3,
    cap: 50,
    pct: false,
    effect: { kind: 'stat', stat: 'maxMp' },
    label: 'Max MP',
  },
  // offense
  {
    id: 'haste',
    name: 'Haste',
    category: 'offense',
    per: 0.002,
    cap: 50,
    pct: true,
    effect: { kind: 'stat', stat: 'atkSpeed' },
    label: 'Attack Speed',
  },
  {
    id: 'precision',
    name: 'Precision',
    category: 'offense',
    per: 0.001,
    cap: 50,
    pct: true,
    effect: { kind: 'stat', stat: 'crit' },
    label: 'Crit Chance',
  },
  {
    id: 'ferocity',
    name: 'Ferocity',
    category: 'offense',
    per: 0.01,
    cap: 50,
    pct: true,
    effect: { kind: 'stat', stat: 'critDmg' },
    label: 'Crit Damage',
  },
  {
    id: 'alacrity',
    name: 'Alacrity',
    category: 'offense',
    per: 0.002,
    cap: 50,
    pct: true,
    effect: { kind: 'stat', stat: 'cdr' },
    label: 'Cooldown Reduction',
  },
  // defense
  {
    id: 'fortitude',
    name: 'Fortitude',
    category: 'defense',
    per: 0.005,
    cap: 50,
    pct: true,
    effect: { kind: 'passive', key: 'hpPct' },
    label: 'Max HP',
  },
  {
    id: 'plating',
    name: 'Plating',
    category: 'defense',
    per: 0.005,
    cap: 50,
    pct: true,
    effect: { kind: 'passive', key: 'defPct' },
    label: 'Defense',
  },
  {
    id: 'regrowth',
    name: 'Regrowth',
    category: 'defense',
    per: 0.5,
    cap: 50,
    pct: false,
    effect: { kind: 'stat', stat: 'hpRegen' },
    label: 'HP Regen/s',
  },
  {
    id: 'resilience',
    name: 'Resilience',
    category: 'defense',
    per: 0.002,
    cap: 50,
    pct: true,
    effect: { kind: 'damageTaken' },
    label: 'Damage Reduction',
  },
  // utility
  {
    id: 'fortune',
    name: 'Fortune',
    category: 'utility',
    per: 0.01,
    cap: 50,
    pct: true,
    effect: { kind: 'stat', stat: 'goldFind' },
    label: 'Gold Find',
  },
  {
    id: 'treasure',
    name: 'Treasure',
    category: 'utility',
    per: 0.01,
    cap: 50,
    pct: true,
    effect: { kind: 'stat', stat: 'magicFind' },
    label: 'Magic Find',
  },
  {
    id: 'sorcery',
    name: 'Sorcery',
    category: 'utility',
    per: 0.003,
    cap: 50,
    pct: true,
    effect: { kind: 'stat', stat: 'skillDmg' },
    label: 'Skill Damage',
  },
  {
    id: 'alchemy',
    name: 'Alchemy',
    category: 'utility',
    per: 0.01,
    cap: 50,
    pct: true,
    effect: { kind: 'passive', key: 'flaskPotency' },
    label: 'Flask Healing',
  },
];

export const PARAGON_BY_ID: Readonly<Record<string, ParagonStatDef>> = Object.fromEntries(
  PARAGON_STATS.map((p) => [p.id, p]),
);
