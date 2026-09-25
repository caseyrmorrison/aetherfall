/** Active skills and the passive talent tree. */
import type { IconId } from '../art/pixel/types';

export type SkillId =
  'slash' | 'whirlwind' | 'fireball' | 'frostnova' | 'heal' | 'lightning' | 'blades' | 'meteor';

export interface SkillDef {
  id: SkillId;
  name: string;
  icon: IconId;
  unlockLevel: number;
  mp: number;
  cooldown: number;
  maxRank: number;
  scaling: 'atk' | 'mag' | 'none';
  /** Damage multiplier at rank 1 and per extra rank. */
  mult: number;
  multPerRank: number;
  /** Cooldown reduction per extra rank (seconds). */
  cdPerRank: number;
  desc: (rank: number) => string;
}

const pct = (v: number): string => `${Math.round(v * 100)}%`;

export const SKILLS: Record<SkillId, SkillDef> = {
  slash: {
    id: 'slash',
    name: 'Aether Slash',
    icon: 'skill_slash',
    unlockLevel: 1,
    mp: 8,
    cooldown: 4,
    maxRank: 5,
    scaling: 'atk',
    mult: 1.8,
    multPerRank: 0.3,
    cdPerRank: 0.3,
    desc: (r) =>
      `Dash forward, slicing through every foe in your path for ${pct(1.8 + 0.3 * (r - 1))} ATK. Grants brief invulnerability.`,
  },
  whirlwind: {
    id: 'whirlwind',
    name: 'Whirlwind',
    icon: 'skill_whirlwind',
    unlockLevel: 3,
    mp: 12,
    cooldown: 6,
    maxRank: 5,
    scaling: 'atk',
    mult: 0.7,
    multPerRank: 0.12,
    cdPerRank: 0.4,
    desc: (r) =>
      `Spin with your blade, striking all nearby enemies 4 times for ${pct(0.7 + 0.12 * (r - 1))} ATK each. You can move while spinning.`,
  },
  fireball: {
    id: 'fireball',
    name: 'Fireball',
    icon: 'skill_fireball',
    unlockLevel: 5,
    mp: 10,
    cooldown: 3,
    maxRank: 5,
    scaling: 'mag',
    mult: 2.2,
    multPerRank: 0.35,
    cdPerRank: 0.2,
    desc: (r) =>
      `Hurl a fireball that explodes for ${pct(2.2 + 0.35 * (r - 1))} MAG and sets enemies ablaze.`,
  },
  frostnova: {
    id: 'frostnova',
    name: 'Frost Nova',
    icon: 'skill_frostnova',
    unlockLevel: 8,
    mp: 18,
    cooldown: 10,
    maxRank: 5,
    scaling: 'mag',
    mult: 1.5,
    multPerRank: 0.25,
    cdPerRank: 0.6,
    desc: (r) =>
      `Blast frost around you for ${pct(1.5 + 0.25 * (r - 1))} MAG, freezing enemies for ${(1.5 + 0.2 * (r - 1)).toFixed(1)}s (bosses are slowed).`,
  },
  heal: {
    id: 'heal',
    name: 'Healing Light',
    icon: 'skill_heal',
    unlockLevel: 10,
    mp: 25,
    cooldown: 18,
    maxRank: 5,
    scaling: 'none',
    mult: 0.3,
    multPerRank: 0.05,
    cdPerRank: 1,
    desc: (r) => `Restore ${pct(0.3 + 0.05 * (r - 1))} of max HP over 3s and cleanse all ailments.`,
  },
  lightning: {
    id: 'lightning',
    name: 'Chain Lightning',
    icon: 'skill_lightning',
    unlockLevel: 13,
    mp: 15,
    cooldown: 5,
    maxRank: 5,
    scaling: 'mag',
    mult: 1.6,
    multPerRank: 0.25,
    cdPerRank: 0.3,
    desc: (r) => `Lightning arcs between up to ${3 + r} enemies for ${pct(1.6 + 0.25 * (r - 1))} MAG each.`,
  },
  blades: {
    id: 'blades',
    name: 'Spectral Blades',
    icon: 'skill_blades',
    unlockLevel: 16,
    mp: 20,
    cooldown: 14,
    maxRank: 5,
    scaling: 'atk',
    mult: 0.6,
    multPerRank: 0.1,
    cdPerRank: 0.8,
    desc: (r) =>
      `Summon ${3 + Math.floor((r - 1) / 2)} blades that orbit you for 7s, cutting enemies for ${pct(0.6 + 0.1 * (r - 1))} ATK.`,
  },
  meteor: {
    id: 'meteor',
    name: 'Meteor',
    icon: 'skill_meteor',
    unlockLevel: 20,
    mp: 30,
    cooldown: 16,
    maxRank: 5,
    scaling: 'mag',
    mult: 4.5,
    multPerRank: 0.7,
    cdPerRank: 1,
    desc: (r) =>
      `Call down a meteor at your target that crashes for ${pct(4.5 + 0.7 * (r - 1))} MAG and leaves burning ground.`,
  },
};

export const SKILL_ORDER: readonly SkillId[] = [
  'slash',
  'whirlwind',
  'fireball',
  'frostnova',
  'heal',
  'lightning',
  'blades',
  'meteor',
];

export function skillMult(def: SkillDef, rank: number): number {
  return def.mult + def.multPerRank * Math.max(0, rank - 1);
}

export function skillCooldown(def: SkillDef, rank: number): number {
  return Math.max(0.5, def.cooldown - def.cdPerRank * Math.max(0, rank - 1));
}

// ------------------------------------------------------------- passives ----

export type Branch = 'blade' | 'arcane' | 'guard';

export interface PassiveEffects {
  atkPct: number;
  magPct: number;
  hpPct: number;
  defPct: number;
  mpFlat: number;
  crit: number;
  critDmg: number;
  lifesteal: number;
  atkSpeed: number;
  cdr: number;
  skillDmg: number;
  mpRegenPct: number;
  hpRegenPctMax: number;
  dodgeCost: number;
  flaskCharges: number;
  flaskPotency: number;
  executioner: number;
  overload: number;
  lastStand: number;
}

export const EMPTY_PASSIVES: Readonly<PassiveEffects> = Object.freeze({
  atkPct: 0,
  magPct: 0,
  hpPct: 0,
  defPct: 0,
  mpFlat: 0,
  crit: 0,
  critDmg: 0,
  lifesteal: 0,
  atkSpeed: 0,
  cdr: 0,
  skillDmg: 0,
  mpRegenPct: 0,
  hpRegenPctMax: 0,
  dodgeCost: 0,
  flaskCharges: 0,
  flaskPotency: 0,
  executioner: 0,
  overload: 0,
  lastStand: 0,
});

export interface PassiveDef {
  id: string;
  name: string;
  branch: Branch;
  row: number;
  maxRank: number;
  requires?: string;
  effect: Partial<PassiveEffects>;
  desc: (rank: number) => string;
}

export const BRANCH_INFO: Record<Branch, { name: string; icon: IconId; color: string }> = {
  blade: { name: 'Blade', icon: 'passive_blade', color: '#e43b44' },
  arcane: { name: 'Arcane', icon: 'passive_arcane', color: '#0099db' },
  guard: { name: 'Guardian', icon: 'passive_guard', color: '#63c74d' },
};

export const PASSIVES: readonly PassiveDef[] = [
  // Blade
  {
    id: 'sharpen',
    name: 'Sharpened Edge',
    branch: 'blade',
    row: 0,
    maxRank: 5,
    effect: { atkPct: 0.05 },
    desc: (r) => `+${r * 5}% Attack.`,
  },
  {
    id: 'keen',
    name: 'Keen Eye',
    branch: 'blade',
    row: 1,
    maxRank: 5,
    requires: 'sharpen',
    effect: { crit: 0.02 },
    desc: (r) => `+${r * 2}% Crit Chance.`,
  },
  {
    id: 'brutality',
    name: 'Brutality',
    branch: 'blade',
    row: 2,
    maxRank: 5,
    requires: 'keen',
    effect: { critDmg: 0.1 },
    desc: (r) => `+${r * 10}% Crit Damage.`,
  },
  {
    id: 'flurry',
    name: 'Flurry',
    branch: 'blade',
    row: 3,
    maxRank: 3,
    requires: 'brutality',
    effect: { atkSpeed: 0.05 },
    desc: (r) => `+${r * 5}% Attack Speed.`,
  },
  {
    id: 'bloodthirst',
    name: 'Bloodthirst',
    branch: 'blade',
    row: 4,
    maxRank: 3,
    requires: 'flurry',
    effect: { lifesteal: 0.01 },
    desc: (r) => `+${r}% Lifesteal.`,
  },
  {
    id: 'executioner',
    name: 'Executioner',
    branch: 'blade',
    row: 5,
    maxRank: 1,
    requires: 'bloodthirst',
    effect: { executioner: 1 },
    desc: () => `Deal +35% damage to enemies below 30% HP.`,
  },
  // Arcane
  {
    id: 'arcane_mind',
    name: 'Arcane Mind',
    branch: 'arcane',
    row: 0,
    maxRank: 5,
    effect: { magPct: 0.05 },
    desc: (r) => `+${r * 5}% Magic.`,
  },
  {
    id: 'deep_well',
    name: 'Deep Well',
    branch: 'arcane',
    row: 1,
    maxRank: 5,
    requires: 'arcane_mind',
    effect: { mpFlat: 8, mpRegenPct: 0.1 },
    desc: (r) => `+${r * 8} Max MP and +${r * 10}% MP regen.`,
  },
  {
    id: 'quickcast',
    name: 'Quickcast',
    branch: 'arcane',
    row: 2,
    maxRank: 5,
    requires: 'deep_well',
    effect: { cdr: 0.04 },
    desc: (r) => `-${r * 4}% skill cooldowns.`,
  },
  {
    id: 'empower',
    name: 'Empower',
    branch: 'arcane',
    row: 3,
    maxRank: 3,
    requires: 'quickcast',
    effect: { skillDmg: 0.06 },
    desc: (r) => `+${r * 6}% skill damage.`,
  },
  {
    id: 'channel',
    name: 'Aether Channel',
    branch: 'arcane',
    row: 4,
    maxRank: 3,
    requires: 'empower',
    effect: { mpRegenPct: 0.2 },
    desc: (r) => `+${r * 20}% MP regen.`,
  },
  {
    id: 'overload',
    name: 'Overload',
    branch: 'arcane',
    row: 5,
    maxRank: 1,
    requires: 'channel',
    effect: { overload: 1 },
    desc: () => `Skills have +15% crit chance and critical skills refund 30% of their cost.`,
  },
  // Guardian
  {
    id: 'vitality',
    name: 'Vitality',
    branch: 'guard',
    row: 0,
    maxRank: 5,
    effect: { hpPct: 0.05 },
    desc: (r) => `+${r * 5}% Max HP.`,
  },
  {
    id: 'iron_skin',
    name: 'Iron Skin',
    branch: 'guard',
    row: 1,
    maxRank: 5,
    requires: 'vitality',
    effect: { defPct: 0.06 },
    desc: (r) => `+${r * 6}% Defense.`,
  },
  {
    id: 'nimble',
    name: 'Nimble',
    branch: 'guard',
    row: 2,
    maxRank: 3,
    requires: 'iron_skin',
    effect: { dodgeCost: 0.1 },
    desc: (r) => `Dodge rolls cost ${r * 10}% less stamina.`,
  },
  {
    id: 'potion_master',
    name: 'Alchemist',
    branch: 'guard',
    row: 3,
    maxRank: 3,
    requires: 'nimble',
    effect: { flaskCharges: 1, flaskPotency: 0.1 },
    desc: (r) => `+${r} flask charge and +${r * 10}% flask healing.`,
  },
  {
    id: 'second_wind',
    name: 'Second Wind',
    branch: 'guard',
    row: 4,
    maxRank: 3,
    requires: 'potion_master',
    effect: { hpRegenPctMax: 0.003 },
    desc: (r) => `Regenerate ${(r * 0.3).toFixed(1)}% of Max HP per second.`,
  },
  {
    id: 'last_stand',
    name: 'Last Stand',
    branch: 'guard',
    row: 5,
    maxRank: 1,
    requires: 'second_wind',
    effect: { lastStand: 1 },
    desc: () => `Survive a fatal blow with 1 HP and become invulnerable for 2s (90s cooldown).`,
  },
];

export const PASSIVE_BY_ID: Readonly<Record<string, PassiveDef>> = Object.fromEntries(
  PASSIVES.map((p) => [p.id, p]),
);
