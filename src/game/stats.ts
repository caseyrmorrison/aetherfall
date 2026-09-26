/** Computes the hero's final stats from level, gear, passives and buffs. */
import { EMPTY_PASSIVES, PASSIVE_BY_ID, type PassiveEffects } from '../data/skills';
import type { WeaponKind } from '../art/pixel/types';
import { WEAPON_FEEL } from '../data/items';
import { defenseReduction, heroBaseStats } from './balance';
import { itemStats } from './items';
import type { SaveData } from './state';
import { BASE_FLASK_HP, BASE_FLASK_MP } from './state';
import type { Item, LegendaryId, StatKey, Stats } from './types';
import { activeCharms, equipTargetFor } from './items';
import { EQUIP_SLOTS } from './types';

export interface Buffs {
  might: number; // seconds remaining
  guard: number;
}

export interface HeroStats extends Stats {
  legendaries: Set<LegendaryId>;
  passives: PassiveEffects;
  flaskHpMax: number;
  flaskMpMax: number;
  flaskPotency: number;
  /** Incoming damage multiplier. */
  damageTaken: number;
}

export function passiveEffects(s: SaveData): PassiveEffects {
  const out: PassiveEffects = { ...EMPTY_PASSIVES };
  for (const [id, rank] of Object.entries(s.hero.passives)) {
    const def = PASSIVE_BY_ID[id];
    if (!def || rank <= 0) continue;
    for (const [k, v] of Object.entries(def.effect) as [keyof PassiveEffects, number][]) out[k] += v * rank;
  }
  return out;
}

export function computeHeroStats(s: SaveData, buffs?: Buffs): HeroStats {
  const base = heroBaseStats(s.hero.level);
  const gear: Partial<Stats> = {};
  const legendaries = new Set<LegendaryId>();
  const sources = [...EQUIP_SLOTS.map((sl) => s.equipment[sl]), ...activeCharms(s)];
  for (const it of sources) {
    if (!it) continue;
    for (const [k, v] of Object.entries(itemStats(it)) as [StatKey, number][]) gear[k] = (gear[k] ?? 0) + v;
    if (it.legendary) legendaries.add(it.legendary);
  }
  const p = passiveEffects(s);
  const st: Stats = { ...base };
  for (const [k, v] of Object.entries(gear) as [StatKey, number][]) st[k] += v;

  st.atk *= 1 + p.atkPct;
  st.mag *= 1 + p.magPct;
  st.def *= 1 + p.defPct;
  st.maxMp += p.mpFlat;
  st.crit += p.crit;
  st.critDmg += p.critDmg;
  st.lifesteal += p.lifesteal;
  st.atkSpeed += p.atkSpeed;
  st.cdr += p.cdr;
  st.skillDmg += p.skillDmg;
  st.mpRegen *= 1 + p.mpRegenPct;
  st.dodgeCost += p.dodgeCost;

  let hpMult = 1 + p.hpPct;
  if (legendaries.has('mountain_heart')) hpMult += 0.25;
  if (legendaries.has('hollow_crown')) hpMult -= 0.15;
  st.maxHp *= hpMult;
  st.hpRegen += st.maxHp * p.hpRegenPctMax;
  if (legendaries.has('windwalkers')) st.dodgeCost += 0.5;

  let damageTaken = 1;
  if (buffs && buffs.might > 0) st.dmgBonus += 0.2;
  if (buffs && buffs.guard > 0) damageTaken *= 0.8;

  // caps
  st.crit = Math.max(0, Math.min(0.75, st.crit));
  st.cdr = Math.min(0.5, st.cdr);
  st.lifesteal = Math.min(0.2, st.lifesteal);
  st.atkSpeed = Math.max(-0.5, Math.min(1, st.atkSpeed));
  st.moveSpeed = Math.max(-0.4, Math.min(0.5, st.moveSpeed));
  st.def = Math.max(0, st.def);
  st.mpRegen = Math.max(0, st.mpRegen);
  st.goldFind = Math.max(-0.9, st.goldFind);
  st.dodgeCost = Math.min(0.75, st.dodgeCost);
  st.maxHp = Math.max(1, Math.round(st.maxHp));
  st.maxMp = Math.round(st.maxMp);

  const flaskBonus = Math.round(p.flaskCharges);
  return {
    ...st,
    legendaries,
    passives: p,
    flaskHpMax: BASE_FLASK_HP + s.hero.flaskUpgrades + flaskBonus,
    flaskMpMax: BASE_FLASK_MP + Math.floor(s.hero.flaskUpgrades / 2) + flaskBonus,
    flaskPotency: 1 + p.flaskPotency,
    damageTaken,
  };
}

/** Rough "power level" shown in the UI (like modern ARPG gear score). */
export function powerRating(st: Stats): number {
  const offense =
    Math.max(st.atk, st.mag) * (1 + st.crit * st.critDmg) * (1 + st.atkSpeed * 0.5) * (1 + st.dmgBonus);
  const defense = st.maxHp / 10 + st.def;
  return Math.round(offense * 2 + defense);
}

// ------------------------------------------------------------ derived ----

export interface DerivedStats {
  /** Weapon hit range before crits (per basic-attack hit, combo-averaged). */
  hitMin: number;
  hitMax: number;
  attacksPerSec: number;
  /** Expected basic-attack damage per second (crits, bonuses; before enemy defense). */
  dps: number;
  critMultiplier: number;
  /** Fraction of damage blocked by defense against an enemy of the hero's level. */
  damageReduction: number;
  /** Raw damage needed to kill the hero (HP adjusted for mitigation). */
  toughness: number;
  /** Life regained per second from regeneration + lifesteal at full DPS. */
  recovery: number;
  moveSpeed: number;
  rollCost: number;
  flaskHeal: number;
  /** Primary damage stat (Magic for staves, Attack otherwise). */
  scaling: 'atk' | 'mag';
}

/** Numbers for the character sheet, like the "details" panel in Diablo or Path of Exile. */
export function deriveStats(level: number, st: HeroStats, weapon: WeaponKind): DerivedStats {
  const feel = WEAPON_FEEL[weapon];
  const speed = 1 + st.atkSpeed;
  const combo = [
    { mult: 1, time: feel.windup + feel.active + feel.recover },
    { mult: 1.1, time: feel.windup + feel.active + feel.recover },
    { mult: 1.5, time: feel.windup * 1.4 + feel.active + feel.recover * 1.35 },
  ];
  const cycle = combo.reduce((n, c) => n + c.time, 0) / speed;
  const scaling = feel.ranged ? 'mag' : 'atk';
  const power = scaling === 'mag' ? st.mag : st.atk;
  const avgMult = combo.reduce((n, c) => n + c.mult, 0) / combo.length;
  const hitAvg = power * feel.dmg * avgMult * (1 + st.dmgBonus);
  const critMultiplier = 1 + st.crit * st.critDmg;
  const attacksPerSec = combo.length / cycle;
  const dps = hitAvg * critMultiplier * attacksPerSec;
  const damageReduction = defenseReduction(st.def, level);
  const toughness = st.maxHp / Math.max(0.05, 1 - damageReduction) / st.damageTaken;
  return {
    hitMin: Math.round(hitAvg * 0.9),
    hitMax: Math.round(hitAvg * 1.1),
    attacksPerSec,
    dps,
    critMultiplier,
    damageReduction,
    toughness,
    recovery: st.hpRegen + st.lifesteal * dps,
    moveSpeed: 82 * (1 + st.moveSpeed),
    rollCost: 28 * (1 - st.dodgeCost),
    flaskHeal: st.maxHp * 0.45 * st.flaskPotency,
    scaling,
  };
}

/** How DPS / toughness / recovery would change if `item` replaced the gear in its slot. */
export function equipDelta(
  s: SaveData,
  item: Item,
  buffs?: Buffs,
): { dps: number; toughness: number; recovery: number; dpsPct: number; toughPct: number } | null {
  const target = equipTargetFor(s, item);
  if (!target) return null;
  const before = computeHeroStats(s, buffs);
  const trial: SaveData = {
    ...s,
    equipment: { ...s.equipment, [target]: item },
    inventory: s.inventory.filter((i) => i !== item),
  };
  const after = computeHeroStats(trial, buffs);
  const kindBefore = s.equipment.weapon?.kind ?? 'sword';
  const kindAfter = trial.equipment.weapon?.kind ?? 'sword';
  const a = deriveStats(s.hero.level, before, kindBefore);
  const b = deriveStats(s.hero.level, after, kindAfter);
  return {
    dps: b.dps - a.dps,
    toughness: b.toughness - a.toughness,
    recovery: b.recovery - a.recovery,
    dpsPct: a.dps > 0 ? (b.dps - a.dps) / a.dps : 0,
    toughPct: a.toughness > 0 ? (b.toughness - a.toughness) / a.toughness : 0,
  };
}
