/** Crafting logic: can this recipe be made, and making it (pure, on the save). */
import { MATERIALS } from '../data/items';
import type { Recipe } from '../data/recipes';
import type { RNG } from '../engine/rng';
import { addSocket, generateCharm, generateItem, isGear, RARITY_INDEX } from './items';
import { addConsumable, addItem, addMaterial, inventoryFull, type SaveData } from './state';
import type { ConsumableId, Item, MaterialId } from './types';
import { EQUIP_SLOTS } from './types';

/** Crafted gear rolls at the hero's level + this. */
export const CRAFT_ILVL_BONUS = 2;

export type CraftResult =
  | { kind: 'item'; item: Item }
  | { kind: 'consumable'; id: ConsumableId; count: number }
  | { kind: 'material'; id: MaterialId; count: number }
  | { kind: 'socket'; item: Item };

/** Why a recipe can't be crafted right now, or null if it can. */
export function craftBlocker(s: SaveData, r: Recipe): string | null {
  for (const [id, n] of Object.entries(r.materials) as [MaterialId, number][])
    if ((s.materials[id] ?? 0) < n) return `Not enough ${MATERIALS[id].name}.`;
  if (s.hero.gold < r.gold(s.hero.level)) return 'Not enough gold.';
  const k = r.result.kind;
  if ((k === 'gear' || k === 'charm') && inventoryFull(s)) return 'Your bag is full.';
  if (k === 'socket' && !socketTargets(s).length) return 'No rare-or-better gear without sockets.';
  return null;
}

/** Items a Socket Punch can be used on: rare-or-better gear with no sockets yet. */
export function socketTargets(s: SaveData): Item[] {
  const worn = EQUIP_SLOTS.map((sl) => s.equipment[sl]).filter((i): i is Item => !!i);
  return [...worn, ...s.inventory].filter(
    (i) => isGear(i.slot) && RARITY_INDEX[i.rarity] >= 2 && !i.sockets?.length,
  );
}

/**
 * Pay for and make a recipe. `target` is required for socket recipes.
 * Returns null (and changes nothing) if it can't be crafted.
 */
export function craft(s: SaveData, r: Recipe, rng: RNG, target?: Item): CraftResult | null {
  if (craftBlocker(s, r)) return null;
  const res = r.result;
  if (res.kind === 'socket' && (!target || !socketTargets(s).includes(target))) return null;
  for (const [id, n] of Object.entries(r.materials) as [MaterialId, number][]) addMaterial(s, id, -n);
  s.hero.gold -= r.gold(s.hero.level);
  switch (res.kind) {
    case 'consumable':
      addConsumable(s, res.id, res.count);
      return { kind: 'consumable', id: res.id, count: res.count };
    case 'material':
      addMaterial(s, res.id, res.count);
      return { kind: 'material', id: res.id, count: res.count };
    case 'charm': {
      const item = generateCharm(rng, s.hero.level, { size: res.size, cursed: false });
      addItem(s, item);
      return { kind: 'item', item };
    }
    case 'gear': {
      const slot = rng.pick(res.slots);
      const kind = slot === 'weapon' ? (s.equipment.weapon?.kind ?? 'sword') : undefined;
      const item = generateItem(rng, s.hero.level + CRAFT_ILVL_BONUS, {
        slot,
        kind,
        rarityRoll: { min: 'rare', bonus: 1.2 },
      });
      addItem(s, item);
      return { kind: 'item', item };
    }
    case 'socket':
      addSocket(target!);
      return { kind: 'socket', item: target! };
  }
}
