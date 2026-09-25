/** Computes the hero's final stats from level, gear, passives and buffs. */
import { EMPTY_PASSIVES, PASSIVE_BY_ID, type PassiveEffects } from '../data/skills';
import { heroBaseStats } from './balance';
import { itemStats } from './items';
import type { SaveData } from './state';
import { BASE_FLASK_HP, BASE_FLASK_MP } from './state';
import type { LegendaryId, StatKey, Stats } from './types';
import { SLOTS } from './types';

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
  for (const slot of SLOTS) {
    const it = s.equipment[slot];
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
  st.crit = Math.min(0.75, st.crit);
  st.cdr = Math.min(0.5, st.cdr);
  st.lifesteal = Math.min(0.2, st.lifesteal);
  st.atkSpeed = Math.min(1, st.atkSpeed);
  st.moveSpeed = Math.min(0.5, st.moveSpeed);
  st.dodgeCost = Math.min(0.75, st.dodgeCost);
  st.maxHp = Math.round(st.maxHp);
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
