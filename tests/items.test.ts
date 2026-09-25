import { describe, expect, it } from 'vitest';
import { LEGENDARIES } from '../src/data/items';
import { RNG } from '../src/engine/rng';
import { generateItem, itemScore, itemStats, rollRarity, statDiff, tierForLevel } from '../src/game/items';
import { RARITIES } from '../src/game/types';

describe('item generation', () => {
  it('is deterministic for a seed', () => {
    const a = generateItem(new RNG(42), 10);
    const b = generateItem(new RNG(42), 10);
    expect({ ...a, uid: '' }).toEqual({ ...b, uid: '' });
  });

  it('gives more affixes to rarer items', () => {
    const rng = new RNG(1);
    const count = (r: (typeof RARITIES)[number]): number =>
      generateItem(rng, 12, { rarity: r, slot: 'ring' }).affixes.length;
    expect(count('common')).toBe(0);
    expect(count('uncommon')).toBe(1);
    expect(count('rare')).toBe(2);
    expect(count('epic')).toBe(3);
  });

  it('never rolls the same affix twice on one item', () => {
    const rng = new RNG(7);
    for (let i = 0; i < 200; i++) {
      const it = generateItem(rng, rng.int(1, 40), { rarity: 'epic' });
      const stats = it.affixes.map((a) => a.stat);
      expect(new Set(stats).size).toBe(stats.length);
    }
  });

  it('creates every legendary with its unique power', () => {
    const rng = new RNG(3);
    for (const l of LEGENDARIES) {
      const it = generateItem(rng, 20, { legendary: l.id });
      expect(it.rarity).toBe('legendary');
      expect(it.slot).toBe(l.slot);
      expect(it.name).toBe(l.name);
    }
  });

  it('respects the minimum rarity', () => {
    const rng = new RNG(9);
    for (let i = 0; i < 300; i++)
      expect(['rare', 'epic', 'legendary']).toContain(rollRarity(rng, { min: 'rare' }));
  });

  it('magic find shifts the distribution upward', () => {
    const tally = (mf: number): number => {
      const rng = new RNG(11);
      let good = 0;
      for (let i = 0; i < 4000; i++)
        if (['rare', 'epic', 'legendary'].includes(rollRarity(rng, { magicFind: mf }))) good++;
      return good;
    };
    expect(tally(2)).toBeGreaterThan(tally(0) * 1.5);
  });

  it('scales with item level and upgrades', () => {
    const rng = new RNG(5);
    const low = generateItem(rng, 2, { slot: 'armor', rarity: 'common' });
    const high = generateItem(rng, 30, { slot: 'armor', rarity: 'common' });
    expect(itemScore(high)).toBeGreaterThan(itemScore(low));
    const upgraded = { ...high, upgrade: 5 };
    expect(itemStats(upgraded).def!).toBeGreaterThan(itemStats(high).def!);
    expect(tierForLevel(1)).toBe(0);
    expect(tierForLevel(99)).toBe(5);
  });

  it('diffs stats against the equipped item', () => {
    const rng = new RNG(8);
    const a = generateItem(rng, 10, { slot: 'boots', rarity: 'common' });
    const b = generateItem(rng, 20, { slot: 'boots', rarity: 'common' });
    const d = statDiff(b, a);
    expect(d.def).toBeGreaterThan(0);
    expect(statDiff(a, a)).toEqual({});
  });
});
