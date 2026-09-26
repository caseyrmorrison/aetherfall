/**
 * Pure gem logic: naming, socket effects, the gem pouch, combining (3 → 1 better gem),
 * socketing and Abyss gem drops. Gems are stackable and live in `save.gems`, not the bag.
 */
import {
  GEM_COMBINE_GOLD,
  GEM_EFFECTS,
  GEM_INFO,
  GEM_LADDER,
  GEM_QUALITIES,
  GEM_TYPES,
  GEMS_PER_COMBINE,
  MAX_DROP_QUALITY,
  MAX_GEM_QUALITY,
} from '../data/gems';
import type { IconId } from '../art/pixel/types';
import type { RNG } from '../engine/rng';
import type { SaveData } from './state';
import type { Gem, GemType, Item, Slot, SocketGroup, StatKey } from './types';
import { STAT_INFO } from './types';

type Pouch = Pick<SaveData, 'gems'>;
type Wallet = Pouch & { hero: { gold: number } };

export const gemKey = (g: Gem): string => `${g.type}_${g.q}`;

export function parseGemKey(key: string): Gem | null {
  const [type, q] = key.split('_');
  const n = Number(q);
  if (!GEM_TYPES.includes(type as GemType) || !Number.isInteger(n) || n < 0 || n > MAX_GEM_QUALITY)
    return null;
  return { type: type as GemType, q: n };
}

export function gemName(g: Gem): string {
  const q = GEM_QUALITIES[g.q];
  return q ? `${q} ${GEM_INFO[g.type].name}` : GEM_INFO[g.type].name;
}

export const gemIcon = (g: Gem): IconId => `icon_gem_${g.type}_${g.q}` as IconId;

/** The gem's name wrapped in its color markup. */
export const gemLabel = (g: Gem): string => `{${GEM_INFO[g.type].markup}}${gemName(g)}{/}`;

export function socketGroup(slot: Slot): SocketGroup {
  return slot === 'weapon' ? 'weapon' : slot === 'helm' ? 'helm' : 'armor';
}

/** The stat a gem grants in a given socket group. */
export function gemEffect(g: Gem, group: SocketGroup): { stat: StatKey; value: number } {
  const e = GEM_EFFECTS[g.type][group];
  const raw = e.base * GEM_LADDER[g.q];
  const value = STAT_INFO[e.stat].pct ? Math.round(raw * 1000) / 1000 : Math.round(raw * 10) / 10;
  return { stat: e.stat, value };
}

// ------------------------------------------------------------------ pouch ----

export function gemCount(s: Pouch, g: Gem): number {
  return s.gems[gemKey(g)] ?? 0;
}

export function addGem(s: Pouch, g: Gem, n = 1): void {
  const k = gemKey(g);
  const v = (s.gems[k] ?? 0) + n;
  if (v > 0) s.gems[k] = v;
  else delete s.gems[k];
}

export function totalGems(s: Pouch): number {
  return Object.values(s.gems).reduce((a, b) => a + b, 0);
}

export type CombineResult = 'ok' | 'max' | 'few' | 'gold';

/** Combine three gems of one kind into one of the next quality, for gold. */
export function combineGem(s: Wallet, g: Gem): CombineResult {
  if (g.q >= MAX_GEM_QUALITY) return 'max';
  if (gemCount(s, g) < GEMS_PER_COMBINE) return 'few';
  const cost = GEM_COMBINE_GOLD[g.q];
  if (s.hero.gold < cost) return 'gold';
  s.hero.gold -= cost;
  addGem(s, g, -GEMS_PER_COMBINE);
  addGem(s, { type: g.type, q: g.q + 1 });
  return 'ok';
}

export interface CombinePlan {
  /** Number of combines performed. */
  combines: number;
  gold: number;
  /** Best gem created, if any. */
  best: Gem | null;
}

/**
 * Combine everything possible, lowest quality first, so gems cascade upward
 * (e.g. 9 Chipped → 3 Flawed → 1 regular) until gold runs out.
 * With `dryRun` the pouch and gold are left untouched.
 */
export function combineAll(s: Wallet, dryRun = false): CombinePlan {
  const sim: Wallet = dryRun ? { gems: { ...s.gems }, hero: { gold: s.hero.gold } } : s;
  const plan: CombinePlan = { combines: 0, gold: 0, best: null };
  for (let q = 0; q < MAX_GEM_QUALITY; q++) {
    for (const type of GEM_TYPES) {
      const g = { type, q };
      while (gemCount(sim, g) >= GEMS_PER_COMBINE && sim.hero.gold >= GEM_COMBINE_GOLD[q]) {
        combineGem(sim, g);
        plan.combines++;
        plan.gold += GEM_COMBINE_GOLD[q];
        if (!plan.best || q + 1 > plan.best.q) plan.best = { type, q: q + 1 };
      }
    }
  }
  return plan;
}

// -------------------------------------------------------------- sockets ----

export const socketCount = (item: Item): number => item.sockets?.length ?? 0;

/** Put a gem from the pouch into a socket. A gem already there goes back to the pouch. */
export function socketGem(s: Pouch, item: Item, index: number, g: Gem): boolean {
  if (!item.sockets || index < 0 || index >= item.sockets.length || gemCount(s, g) < 1) return false;
  const prev = item.sockets[index];
  if (prev) addGem(s, prev);
  addGem(s, g, -1);
  item.sockets[index] = { type: g.type, q: g.q };
  return true;
}

/** Take a gem out of a socket (free, like modern Diablo) and return it to the pouch. */
export function unsocketGem(s: Pouch, item: Item, index: number): Gem | null {
  const g = item.sockets?.[index];
  if (!g || !item.sockets) return null;
  item.sockets[index] = null;
  addGem(s, g);
  return g;
}

/** Return every socketed gem to the pouch (before an item is sold or salvaged). */
export function returnGems(s: Pouch, item: Item): number {
  let n = 0;
  item.sockets?.forEach((_, i) => {
    if (unsocketGem(s, item, i)) n++;
  });
  return n;
}

// ----------------------------------------------------------------- drops ----

/**
 * A gem dropped on Abyss floor `floor`. Deeper floors drop better gems: Chipped on the
 * first floors, up to Radiant far down. Elites and bosses (`good`) roll higher more often.
 */
export function rollGemDrop(rng: RNG, floor: number, good = false): Gem {
  let q = Math.min(4, Math.floor((Math.max(1, floor) - 1) / 6));
  const r = rng.next();
  if (r < (good ? 0.35 : 0.2)) q++;
  else if (r > 0.85 && q > 0) q--;
  return { type: rng.pick(GEM_TYPES), q: Math.min(MAX_DROP_QUALITY, q) };
}
