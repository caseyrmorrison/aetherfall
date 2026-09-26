import { describe, expect, it } from 'vitest';
import { RNG } from '../src/engine/rng';
import {
  BASE_BAG,
  BASE_CHARMS,
  bagUpgradeCost,
  charmUpgradeCost,
  FREE_STASH_TABS,
  MAX_BAG_UPGRADES,
  MAX_CHARM_UPGRADES,
  MAX_STASH_TABS,
  STASH_TAB_SIZE,
  stashTabCost,
} from '../src/game/balance';
import { absorbLegacyStash, newStash, StashStore } from '../src/game/stash';
import { activeCharms, generateCharm, generateItem } from '../src/game/items';
import { addItem, bagSize, charmLimit, inventoryFull, migrate, moveInList, newGame } from '../src/game/state';

describe('bag and charm upgrades', () => {
  it('start small and grow with each purchase', () => {
    const s = newGame(0, 'B', 'normal');
    expect(bagSize(s)).toBe(BASE_BAG);
    expect(charmLimit(s)).toBe(BASE_CHARMS);
    s.hero.bagUpgrades = MAX_BAG_UPGRADES;
    s.hero.charmUpgrades = MAX_CHARM_UPGRADES;
    expect(bagSize(s)).toBe(96);
    expect(charmLimit(s)).toBe(14);
    for (let i = 1; i < MAX_BAG_UPGRADES; i++)
      expect(bagUpgradeCost(i)).toBeGreaterThan(bagUpgradeCost(i - 1));
    for (let i = 1; i < MAX_CHARM_UPGRADES; i++)
      expect(charmUpgradeCost(i)).toBeGreaterThan(charmUpgradeCost(i - 1));
    expect(bagUpgradeCost(MAX_BAG_UPGRADES)).toBe(Infinity);
  });

  it('decide when the bag is full and how many charms are active', () => {
    const s = newGame(0, 'B', 'normal');
    const rng = new RNG(1);
    for (let i = 0; i < BASE_BAG; i++) addItem(s, generateCharm(rng, 5, { cursed: false }));
    expect(inventoryFull(s)).toBe(true);
    expect(activeCharms(s)).toHaveLength(BASE_CHARMS);
    s.hero.bagUpgrades = 1;
    s.hero.charmUpgrades = 1;
    expect(inventoryFull(s)).toBe(false);
    expect(activeCharms(s)).toHaveLength(BASE_CHARMS + 2);
  });

  it('keep older saves at the sizes they already had', () => {
    const old = JSON.parse(JSON.stringify(newGame(0, 'Old', 'normal'))) as Record<string, unknown>;
    old.version = 4;
    delete old.stash;
    const hero = old.hero as Record<string, unknown>;
    delete hero.bagUpgrades;
    delete hero.charmUpgrades;
    const s = migrate(old)!;
    expect(bagSize(s)).toBeGreaterThanOrEqual(60);
    expect(charmLimit(s)).toBe(10);
    // the stash is shared now; an empty per-slot stash isn't kept
    expect(s.stash).toBeUndefined();
    // a new save isn't grandfathered
    const fresh = migrate(JSON.parse(JSON.stringify(newGame(1, 'New', 'normal'))))!;
    expect(bagSize(fresh)).toBe(BASE_BAG);
  });
});

describe('manual sorting', () => {
  const items = () => [1, 2, 3, 4].map((i) => generateItem(new RNG(i), 5));

  it('swaps two items, or moves one to the end when dropped on an empty slot', () => {
    const list = items();
    const [a, b, c, d] = list;
    expect(moveInList(list, 0, 2)).toBe(true);
    expect(list).toEqual([c, b, a, d]);
    expect(moveInList(list, 1, 10)).toBe(true);
    expect(list).toEqual([c, a, d, b]);
    expect(moveInList(list, 2, 2)).toBe(false);
    expect(moveInList(list, 9, 0)).toBe(false);
  });

  it('lets you pick which charms are active by moving them forward', () => {
    const s = newGame(0, 'C', 'normal');
    const rng = new RNG(2);
    for (let i = 0; i < BASE_CHARMS + 1; i++) addItem(s, generateCharm(rng, 5, { cursed: false }));
    const last = s.inventory[BASE_CHARMS];
    expect(activeCharms(s)).not.toContain(last);
    moveInList(s.inventory, BASE_CHARMS, 0);
    expect(activeCharms(s)).toContain(last);
  });
});

describe('shared stash', () => {
  const memory = (): Pick<Storage, 'getItem' | 'setItem'> => {
    const m = new Map<string, string>();
    return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
  };

  it('starts with free tabs and sells more, up to a limit', () => {
    expect(newStash().tabs).toHaveLength(FREE_STASH_TABS);
    expect(stashTabCost(FREE_STASH_TABS)).toBeGreaterThan(0);
    expect(stashTabCost(MAX_STASH_TABS)).toBe(Infinity);
  });

  it('is stored on its own, outside every save slot', () => {
    const store = new StashStore(memory());
    const stash = store.load();
    stash.tabs[1].push(generateItem(new RNG(1), 10));
    stash.tabs.push([]);
    expect(store.write(stash)).toBe(true);
    const again = store.load();
    expect(again.tabs).toHaveLength(FREE_STASH_TABS + 1);
    expect(again.tabs[1][0].uid).toBe(stash.tabs[1][0].uid);
    expect(new StashStore(null).load().tabs).toHaveLength(FREE_STASH_TABS);
    expect(newGame(0, 'N', 'normal').stash).toBeUndefined();
  });

  it('takes in the old per-slot stash of a v5 save, including bought tabs', () => {
    const shared = newStash();
    shared.tabs[0].push(generateItem(new RNG(9), 10));
    const legacy = {
      tabs: [[1, 2].map((i) => generateItem(new RNG(i), 5)), [], [generateItem(new RNG(3), 5)]],
    };
    const old = JSON.parse(JSON.stringify({ ...newGame(0, 'Old', 'normal'), version: 5, stash: legacy }));
    const s = migrate(old)!;
    expect(s.stash?.tabs.flat()).toHaveLength(3);
    expect(absorbLegacyStash(shared, s.stash)).toBe(3);
    expect(shared.tabs).toHaveLength(3);
    expect(shared.tabs.flat()).toHaveLength(4);
    expect(s.stash?.tabs).toEqual([]);
    expect(absorbLegacyStash(shared, s.stash)).toBe(0);
  });

  it('never drops items, even past its tab limit', () => {
    const shared = newStash();
    const many = Array.from({ length: MAX_STASH_TABS * STASH_TAB_SIZE + 5 }, (_, i) =>
      generateItem(new RNG(i), 3),
    );
    expect(absorbLegacyStash(shared, { tabs: [many] })).toBe(many.length);
    expect(shared.tabs.flat()).toHaveLength(many.length);
    expect(shared.tabs.every((t) => t.length <= STASH_TAB_SIZE)).toBe(true);
  });
});
