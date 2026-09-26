import { describe, expect, it } from 'vitest';
import { GEM_COMBINE_GOLD, MAX_DROP_QUALITY, MAX_GEM_QUALITY } from '../src/data/gems';
import { LEGENDARIES } from '../src/data/items';
import { RNG } from '../src/engine/rng';
import {
  addGem,
  combineAll,
  combineGem,
  gemCount,
  gemEffect,
  gemName,
  parseGemKey,
  returnGems,
  rollGemDrop,
  socketGem,
  unsocketGem,
} from '../src/game/gems';
import {
  formatStat,
  generateAbyssal,
  generateItem,
  itemStats,
  MAX_SOCKETS,
  rollRarity,
} from '../src/game/items';
import { migrate, newGame } from '../src/game/state';
import type { Item } from '../src/game/types';

const socketed = (slot: Item['slot'], n: number): Item => ({
  ...generateItem(new RNG(9), 30, { slot, rarity: 'rare', kind: slot === 'weapon' ? 'sword' : undefined }),
  sockets: new Array(n).fill(null),
});

describe('gems', () => {
  it('have quality names and round-trip through their pouch keys', () => {
    expect(gemName({ type: 'ruby', q: 0 })).toBe('Chipped Ruby');
    expect(gemName({ type: 'emerald', q: 2 })).toBe('Emerald');
    expect(gemName({ type: 'diamond', q: MAX_GEM_QUALITY })).toBe('Royal Diamond');
    expect(parseGemKey('topaz_4')).toEqual({ type: 'topaz', q: 4 });
    expect(parseGemKey('opal_1')).toBeNull();
    expect(parseGemKey('ruby_9')).toBeNull();
  });

  it('grant different stats by socket group and grow with quality', () => {
    const ruby = { type: 'ruby' as const, q: 0 };
    expect(gemEffect(ruby, 'weapon').stat).toBe('dmgBonus');
    expect(gemEffect(ruby, 'helm').stat).toBe('xpBonus');
    expect(gemEffect(ruby, 'armor').stat).toBe('atk');
    let prev = 0;
    for (let q = 0; q <= MAX_GEM_QUALITY; q++) {
      const v = gemEffect({ type: 'amethyst', q }, 'armor').value;
      expect(v).toBeGreaterThan(prev);
      prev = v;
    }
  });

  it('combine three of a kind into the next quality for gold', () => {
    const s = newGame(0, 'G', 'normal');
    const g = { type: 'ruby' as const, q: 0 };
    addGem(s, g, 2);
    expect(combineGem(s, g)).toBe('few');
    addGem(s, g);
    s.hero.gold = 0;
    expect(combineGem(s, g)).toBe('gold');
    s.hero.gold = 1000;
    expect(combineGem(s, g)).toBe('ok');
    expect(gemCount(s, g)).toBe(0);
    expect(gemCount(s, { type: 'ruby', q: 1 })).toBe(1);
    expect(s.hero.gold).toBe(1000 - GEM_COMBINE_GOLD[0]);
    expect(s.gems['ruby_0']).toBeUndefined(); // empty stacks are removed
    addGem(s, { type: 'ruby', q: MAX_GEM_QUALITY }, 3);
    expect(combineGem(s, { type: 'ruby', q: MAX_GEM_QUALITY })).toBe('max');
  });

  it('combine all cascades upward, and a dry run changes nothing', () => {
    const s = newGame(0, 'G', 'normal');
    addGem(s, { type: 'topaz', q: 0 }, 10);
    s.hero.gold = 10_000;
    const plan = combineAll(s, true);
    expect(plan).toEqual({
      combines: 4,
      gold: 3 * GEM_COMBINE_GOLD[0] + GEM_COMBINE_GOLD[1],
      best: { type: 'topaz', q: 2 },
    });
    expect(gemCount(s, { type: 'topaz', q: 0 })).toBe(10);
    expect(s.hero.gold).toBe(10_000);
    combineAll(s);
    expect(gemCount(s, { type: 'topaz', q: 0 })).toBe(1);
    expect(gemCount(s, { type: 'topaz', q: 1 })).toBe(0);
    expect(gemCount(s, { type: 'topaz', q: 2 })).toBe(1);
    expect(s.hero.gold).toBe(10_000 - plan.gold);
  });

  it('socket into gear, swap back to the pouch and add their stats to the item', () => {
    const s = newGame(0, 'G', 'normal');
    const helm = socketed('helm', 1);
    const ruby = { type: 'ruby' as const, q: 3 };
    const emerald = { type: 'emerald' as const, q: 1 };
    addGem(s, ruby);
    addGem(s, emerald);
    const before = itemStats(helm).xpBonus ?? 0;
    expect(socketGem(s, helm, 0, ruby)).toBe(true);
    expect(gemCount(s, ruby)).toBe(0);
    expect(itemStats(helm).xpBonus).toBeCloseTo(before + gemEffect(ruby, 'helm').value);
    // replacing returns the old gem
    expect(socketGem(s, helm, 0, emerald)).toBe(true);
    expect(gemCount(s, ruby)).toBe(1);
    expect(helm.sockets![0]).toEqual(emerald);
    expect(unsocketGem(s, helm, 0)).toEqual(emerald);
    expect(gemCount(s, emerald)).toBe(1);
    // no gem in the pouch: nothing happens
    expect(socketGem(s, helm, 0, { type: 'diamond', q: 0 })).toBe(false);
  });

  it('come back to the pouch before gear is sold or salvaged', () => {
    const s = newGame(0, 'G', 'normal');
    const armor = socketed('armor', 3);
    addGem(s, { type: 'diamond', q: 2 }, 2);
    socketGem(s, armor, 0, { type: 'diamond', q: 2 });
    socketGem(s, armor, 2, { type: 'diamond', q: 2 });
    expect(returnGems(s, armor)).toBe(2);
    expect(gemCount(s, { type: 'diamond', q: 2 })).toBe(2);
    expect(armor.sockets).toEqual([null, null, null]);
  });

  it('drop better the deeper you go, capped below Imperial', () => {
    const rng = new RNG(4);
    const avg = (floor: number): number => {
      let t = 0;
      for (let i = 0; i < 400; i++) t += rollGemDrop(rng, floor).q;
      return t / 400;
    };
    expect(avg(1)).toBeLessThan(0.5);
    expect(avg(20)).toBeGreaterThan(avg(8));
    for (let i = 0; i < 500; i++) expect(rollGemDrop(rng, 999, true).q).toBeLessThanOrEqual(MAX_DROP_QUALITY);
  });

  it('show fractional percentages with one decimal', () => {
    expect(formatStat('crit', 0.005)).toBe('+0.5% Crit Chance');
    expect(formatStat('crit', 0.05)).toBe('+5% Crit Chance');
    expect(formatStat('critDmg', 0.07)).toBe('+7% Crit Damage');
  });
});

describe('abyssal items', () => {
  it('never roll by chance', () => {
    const rng = new RNG(5);
    for (let i = 0; i < 3000; i++) expect(rollRarity(rng, { bonus: 10, min: 'epic' })).not.toBe('abyssal');
  });

  it('have sockets, five bonuses and outclass legendaries', () => {
    const rng = new RNG(6);
    for (let i = 0; i < 200; i++) {
      const it = generateAbyssal(rng, 40);
      expect(it.rarity).toBe('abyssal');
      expect(it.name.startsWith('Abyssal')).toBe(true);
      expect(it.affixes).toHaveLength(5);
      expect(new Set(it.affixes.map((a) => a.stat)).size).toBe(5);
      const n = it.sockets!.length;
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(MAX_SOCKETS[it.slot as keyof typeof MAX_SOCKETS]);
    }
    const abyssal = generateAbyssal(rng, 40, { slot: 'armor' });
    const legendary = generateItem(rng, 40, { legendary: LEGENDARIES.find((l) => l.slot === 'armor')!.id });
    expect(abyssal.base.def!).toBeGreaterThan(legendary.base.def!);
    expect(generateItem(rng, 40, { rarity: 'abyssal' }).rarity).toBe('abyssal');
  });
});

describe('save migration', () => {
  it('gives v2 saves an empty gem pouch', () => {
    const old = JSON.parse(JSON.stringify(newGame(0, 'Old', 'normal'))) as Record<string, unknown>;
    old.version = 2;
    delete old.gems;
    const s = migrate(old)!;
    expect(s.gems).toEqual({});
    expect(s.stats.abyssals).toBe(0);
  });
});
