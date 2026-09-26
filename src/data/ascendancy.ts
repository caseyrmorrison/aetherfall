/**
 * Ascendancy classes (Path of Exile 2 style): after the first Trial of Ascension the
 * hero picks one specialization. Each trial grants 2 points; every notable costs 2.
 * Tiers: two starting notables, one follow-up for each, and two capstones that need
 * either follow-up.
 */
import type { IconId } from '../art/pixel/types';
import type { Stats } from '../game/types';
import type { PassiveEffects } from './skills';

export type AscClass = 'blademaster' | 'warbringer' | 'shadowblade' | 'archmage';

export const ASC_CLASSES: readonly AscClass[] = ['blademaster', 'warbringer', 'shadowblade', 'archmage'];

export interface AscClassDef {
  id: AscClass;
  name: string;
  icon: IconId;
  color: string;
  /** Weapon it's built around (a suggestion, not a requirement). */
  weapon: string;
  blurb: string;
}

export const ASC_CLASS_INFO: Record<AscClass, AscClassDef> = {
  blademaster: {
    id: 'blademaster',
    name: 'Blademaster',
    icon: 'asc_blademaster',
    color: '#e43b44',
    weapon: 'Sword',
    blurb: 'Flowing combos, guaranteed crits after perfect dodges, and endless Aether Slashes.',
  },
  warbringer: {
    id: 'warbringer',
    name: 'Warbringer',
    icon: 'asc_warbringer',
    color: '#f77622',
    weapon: 'Greatsword',
    blurb: 'An unbreakable juggernaut: shockwaves, counterattacks and rolls that smash enemies.',
  },
  shadowblade: {
    id: 'shadowblade',
    name: 'Shadowblade',
    icon: 'asc_shadowblade',
    color: '#63c74d',
    weapon: 'Dagger',
    blurb: 'Poison, speed and assassinations. Strike from the shadows after every roll.',
  },
  archmage: {
    id: 'archmage',
    name: 'Archmage',
    icon: 'asc_archmage',
    color: '#0099db',
    weapon: 'Staff',
    blurb: 'Spells that echo, a shield made of mana, and staff bolts that chain between foes.',
  },
};

export interface AscNodeDef {
  id: string;
  cls: AscClass;
  name: string;
  /** 0 = starting notable, 1 = follow-up, 2 = capstone. */
  tier: 0 | 1 | 2;
  /** Column 0 (left) or 1 (right) for layout. */
  col: 0 | 1;
  /** Needs any one of these notables first. */
  requires?: readonly string[];
  desc: string;
  /** Plain stat bonuses (the rest are special effects checked in combat). */
  stats?: Partial<Stats>;
  passives?: Partial<PassiveEffects>;
  /** Multiplier on damage taken. */
  damageTaken?: number;
}

/** Points granted by each completed Trial of Ascension, and the cost of each notable. */
export const ASC_POINTS_PER_TRIAL = 2;
export const ASC_NODE_COST = 2;

export const ASC_NODES: readonly AscNodeDef[] = [
  // ---------------------------------------------------------- Blademaster ----
  {
    id: 'bm_flowing',
    cls: 'blademaster',
    name: 'Flowing Steel',
    tier: 0,
    col: 0,
    desc: '+15% Attack Speed. The third hit of your combo strikes a second time for 60% damage.',
    stats: { atkSpeed: 0.15 },
  },
  {
    id: 'bm_duelist',
    cls: 'blademaster',
    name: 'Duelist',
    tier: 0,
    col: 1,
    desc: '+8% Crit Chance and +30% Crit Damage.',
    stats: { crit: 0.08, critDmg: 0.3 },
  },
  {
    id: 'bm_riposte',
    cls: 'blademaster',
    name: 'Riposte',
    tier: 1,
    col: 0,
    requires: ['bm_flowing'],
    desc: 'A perfect dodge makes your next 3 hits guaranteed critical hits.',
  },
  {
    id: 'bm_saint',
    cls: 'blademaster',
    name: 'Sword Saint',
    tier: 1,
    col: 1,
    requires: ['bm_duelist'],
    desc: 'Aether Slash has half the cooldown, and killing an enemy resets it.',
  },
  {
    id: 'bm_thousand',
    cls: 'blademaster',
    name: 'Thousand Cuts',
    tier: 2,
    col: 0,
    requires: ['bm_riposte', 'bm_saint'],
    desc: 'Every basic attack hit shortens all skill cooldowns by 0.25s.',
  },
  {
    id: 'bm_tempest',
    cls: 'blademaster',
    name: 'Blade Tempest',
    tier: 2,
    col: 1,
    requires: ['bm_riposte', 'bm_saint'],
    desc: 'Killing an enemy releases a slashing gale in the direction you face for 90% ATK.',
  },
  // ----------------------------------------------------------- Warbringer ----
  {
    id: 'wb_unbreakable',
    cls: 'warbringer',
    name: 'Unbreakable',
    tier: 0,
    col: 0,
    desc: '+20% Max HP and +20% Defense.',
    passives: { hpPct: 0.2, defPct: 0.2 },
  },
  {
    id: 'wb_earthshaker',
    cls: 'warbringer',
    name: 'Earthshaker',
    tier: 0,
    col: 1,
    desc: 'The third hit of your combo sends out a shockwave for 70% ATK around it.',
  },
  {
    id: 'wb_bulwark',
    cls: 'warbringer',
    name: 'Bulwark',
    tier: 1,
    col: 0,
    requires: ['wb_unbreakable'],
    desc: 'Take 12% less damage and never get knocked back.',
    damageTaken: 0.88,
  },
  {
    id: 'wb_retaliate',
    cls: 'warbringer',
    name: 'Retaliation',
    tier: 1,
    col: 1,
    requires: ['wb_earthshaker'],
    desc: 'When hit, blast nearby enemies for 100% ATK (once every 1.5s).',
  },
  {
    id: 'wb_bloodiron',
    cls: 'warbringer',
    name: 'Blood and Iron',
    tier: 2,
    col: 0,
    requires: ['wb_bulwark', 'wb_retaliate'],
    desc: '+3% Lifesteal. Below 35% HP, regenerate 2% of Max HP per second.',
    stats: { lifesteal: 0.03 },
  },
  {
    id: 'wb_juggernaut',
    cls: 'warbringer',
    name: 'Juggernaut',
    tier: 2,
    col: 1,
    requires: ['wb_bulwark', 'wb_retaliate'],
    desc: 'Dodge rolls cost 30% less stamina and smash through enemies for 120% ATK.',
    passives: { dodgeCost: 0.3 },
  },
  // ---------------------------------------------------------- Shadowblade ----
  {
    id: 'sb_venom',
    cls: 'shadowblade',
    name: 'Venom',
    tier: 0,
    col: 0,
    desc: 'Basic attacks poison enemies for 40% ATK over 3s.',
  },
  {
    id: 'sb_fleet',
    cls: 'shadowblade',
    name: 'Fleet',
    tier: 0,
    col: 1,
    desc: '+15% Move Speed and dodge rolls cost 25% less stamina.',
    stats: { moveSpeed: 0.15 },
    passives: { dodgeCost: 0.25 },
  },
  {
    id: 'sb_assassin',
    cls: 'shadowblade',
    name: 'Assassinate',
    tier: 1,
    col: 0,
    requires: ['sb_venom'],
    desc: 'Deal +50% damage to enemies below 35% HP.',
  },
  {
    id: 'sb_veil',
    cls: 'shadowblade',
    name: 'Shadow Veil',
    tier: 1,
    col: 1,
    requires: ['sb_fleet'],
    desc: 'After a dodge roll, your next hit (within 1.5s) is a guaranteed crit with +50% damage.',
  },
  {
    id: 'sb_bloom',
    cls: 'shadowblade',
    name: 'Toxic Bloom',
    tier: 2,
    col: 0,
    requires: ['sb_assassin', 'sb_veil'],
    desc: 'Poisoned enemies burst when they die, poisoning everything nearby.',
  },
  {
    id: 'sb_deathmark',
    cls: 'shadowblade',
    name: 'Deathmark',
    tier: 2,
    col: 1,
    requires: ['sb_assassin', 'sb_veil'],
    desc: '+10% Crit Chance and +40% Crit Damage. Kills restore 20 stamina and 5% MP.',
    stats: { crit: 0.1, critDmg: 0.4 },
  },
  // -------------------------------------------------------------- Archmage ----
  {
    id: 'am_surge',
    cls: 'archmage',
    name: 'Arcane Surge',
    tier: 0,
    col: 0,
    desc: '+20% Skill Damage and +15% Magic.',
    stats: { skillDmg: 0.2 },
    passives: { magPct: 0.15 },
  },
  {
    id: 'am_manashield',
    cls: 'archmage',
    name: 'Mana Shield',
    tier: 0,
    col: 1,
    desc: '25% of damage you take is drained from your MP instead.',
  },
  {
    id: 'am_mastery',
    cls: 'archmage',
    name: 'Elemental Mastery',
    tier: 1,
    col: 0,
    requires: ['am_surge'],
    desc: 'Burning and frozen enemies take 25% more damage. Your burns last 50% longer.',
  },
  {
    id: 'am_quicken',
    cls: 'archmage',
    name: 'Quickening',
    tier: 1,
    col: 1,
    requires: ['am_manashield'],
    desc: '20% Cooldown Reduction and +40% MP regeneration.',
    stats: { cdr: 0.2 },
    passives: { mpRegenPct: 0.4 },
  },
  {
    id: 'am_echo',
    cls: 'archmage',
    name: 'Spell Echo',
    tier: 2,
    col: 0,
    requires: ['am_mastery', 'am_quicken'],
    desc: 'Fireball, Frost Nova, Chain Lightning, Meteor and Blizzard have a 25% chance to cast twice.',
  },
  {
    id: 'am_archon',
    cls: 'archmage',
    name: 'Archon',
    tier: 2,
    col: 1,
    requires: ['am_mastery', 'am_quicken'],
    desc: 'Staff bolts chain to 2 more enemies, and basic attack hits restore 1 MP.',
  },
];

export const ASC_NODE_BY_ID: Readonly<Record<string, AscNodeDef>> = Object.fromEntries(
  ASC_NODES.map((n) => [n.id, n]),
);
