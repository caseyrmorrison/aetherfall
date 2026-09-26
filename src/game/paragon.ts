/** Paragon progression: levels past the cap, rotating category points and their bonuses. */
import type { PassiveEffects } from '../data/skills';
import {
  PARAGON_BY_ID,
  PARAGON_CATEGORIES,
  PARAGON_STATS,
  type ParagonCategory,
  type ParagonStatDef,
} from '../data/paragon';
import { MAX_LEVEL, xpToNext } from './balance';
import type { Stats } from './types';

export interface ParagonState {
  level: number;
  xp: number;
  /** Points spent per paragon stat id. */
  alloc: Record<string, number>;
}

export const newParagon = (): ParagonState => ({ level: 0, xp: 0, alloc: {} });

/** XP from paragon level `p` to `p + 1`. Grows slowly so it never truly ends. */
export function paragonXpToNext(p: number): number {
  return Math.round(xpToNext(MAX_LEVEL - 1) * (1.2 + 0.05 * p));
}

/** The category that paragon level `level` (1-based) grants its point in. */
export function categoryForLevel(level: number): ParagonCategory {
  return PARAGON_CATEGORIES[(level - 1) % PARAGON_CATEGORIES.length];
}

/** Points earned in a category so far. */
export function earnedIn(p: ParagonState, cat: ParagonCategory): number {
  const i = PARAGON_CATEGORIES.indexOf(cat);
  return p.level > i ? Math.floor((p.level - 1 - i) / PARAGON_CATEGORIES.length) + 1 : 0;
}

export function spentIn(p: ParagonState, cat: ParagonCategory): number {
  return PARAGON_STATS.filter((d) => d.category === cat).reduce((n, d) => n + (p.alloc[d.id] ?? 0), 0);
}

export const unspentIn = (p: ParagonState, cat: ParagonCategory): number =>
  earnedIn(p, cat) - spentIn(p, cat);

export function totalUnspent(p: ParagonState): number {
  return PARAGON_CATEGORIES.reduce((n, c) => n + Math.max(0, unspentIn(p, c)), 0);
}

/** Add (+1) or remove (-1) a point. Returns why not, or null on success. */
export function allocate(p: ParagonState, id: string, delta: 1 | -1): string | null {
  const def = PARAGON_BY_ID[id];
  if (!def) return 'Unknown stat.';
  const cur = p.alloc[id] ?? 0;
  if (delta < 0) {
    if (cur <= 0) return 'No points to remove.';
    p.alloc[id] = cur - 1;
    return null;
  }
  if (def.cap && cur >= def.cap) return 'This stat is maxed out.';
  if (unspentIn(p, def.category) <= 0) return 'No points left in this category.';
  p.alloc[id] = cur + 1;
  return null;
}

/** Refund every point in a category (free, like Diablo 3). */
export function resetCategory(p: ParagonState, cat: ParagonCategory): void {
  for (const d of PARAGON_STATS) if (d.category === cat) delete p.alloc[d.id];
}

/** Total bonus value of a stat (per point × points). */
export const paragonValue = (p: ParagonState, def: ParagonStatDef): number =>
  (p.alloc[def.id] ?? 0) * def.per;

export interface ParagonBonuses {
  stats: Partial<Stats>;
  passives: Partial<PassiveEffects>;
  /** Multiplier on damage taken (1 = none). */
  damageTaken: number;
}

export function paragonBonuses(p: ParagonState | undefined): ParagonBonuses {
  const out: ParagonBonuses = { stats: {}, passives: {}, damageTaken: 1 };
  if (!p) return out;
  for (const def of PARAGON_STATS) {
    const v = paragonValue(p, def);
    if (!v) continue;
    const e = def.effect;
    if (e.kind === 'stat') {
      if (e.stat === 'atkmag') {
        out.stats.atk = (out.stats.atk ?? 0) + v;
        out.stats.mag = (out.stats.mag ?? 0) + v;
      } else out.stats[e.stat] = (out.stats[e.stat] ?? 0) + v;
    } else if (e.kind === 'passive') out.passives[e.key] = (out.passives[e.key] ?? 0) + v;
    else out.damageTaken *= 1 - v;
  }
  return out;
}
