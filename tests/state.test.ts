import { describe, expect, it } from 'vitest';
import { RNG } from '../src/engine/rng';
import { generateItem } from '../src/game/items';
import { SaveStore } from '../src/game/saves';
import {
  addItem,
  bagSize,
  decodeBits,
  encodeBits,
  equipItem,
  grantXp,
  migrate,
  newGame,
  unequip,
} from '../src/game/state';
import { computeHeroStats } from '../src/game/stats';

class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string): string | null {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.m.set(k, v);
  }
  removeItem(k: string): void {
    this.m.delete(k);
  }
}

describe('leveling', () => {
  it('grants skill points and unlocks skills', () => {
    const s = newGame(0, 'Test', 'normal');
    const r = grantXp(s, 100000);
    expect(r.levels).toBeGreaterThan(5);
    expect(s.hero.skillPoints).toBe(r.levels);
    expect(s.hero.skills.whirlwind).toBe(1);
    expect(s.hero.skills.fireball).toBe(1);
    expect(r.newSkills).toContain('whirlwind');
    expect(s.hero.slots).toContain('whirlwind');
  });
});

describe('inventory & equipment', () => {
  it('equips and swaps items', () => {
    const s = newGame(0, 'Test', 'normal');
    const rng = new RNG(1);
    const a = generateItem(rng, 5, { slot: 'weapon', kind: 'sword', rarity: 'common' });
    const b = generateItem(rng, 9, { slot: 'weapon', kind: 'dagger', rarity: 'rare' });
    addItem(s, a);
    addItem(s, b);
    equipItem(s, a.uid);
    expect(s.equipment.weapon?.uid).toBe(a.uid);
    equipItem(s, b.uid);
    expect(s.equipment.weapon?.uid).toBe(b.uid);
    expect(s.inventory.some((i) => i.uid === a.uid)).toBe(true);
    expect(unequip(s, 'weapon')).toBe(true);
    expect(s.equipment.weapon).toBeNull();
  });

  it('refuses items when the bag is full', () => {
    const s = newGame(0, 'Test', 'normal');
    const rng = new RNG(2);
    for (let i = 0; i < bagSize(s); i++) expect(addItem(s, generateItem(rng, 3))).toBe(true);
    expect(addItem(s, generateItem(rng, 3))).toBe(false);
  });

  it('gear changes computed stats', () => {
    const s = newGame(0, 'Test', 'normal');
    const before = computeHeroStats(s).atk;
    s.equipment.weapon = generateItem(new RNG(4), 10, { slot: 'weapon', kind: 'greatsword', rarity: 'epic' });
    expect(computeHeroStats(s).atk).toBeGreaterThan(before);
  });
});

describe('persistence', () => {
  it('round-trips a save through storage', () => {
    const store = new SaveStore(new MemStorage());
    const s = newGame(1, 'Round', 'hard');
    s.hero.gold = 1234;
    expect(store.write(s)).toBe(true);
    const back = store.load(1)!;
    expect(back.hero.name).toBe('Round');
    expect(back.hero.gold).toBe(1234);
    expect(back.difficulty).toBe('hard');
    expect(store.mostRecent()).toBe(1);
    expect(store.firstEmpty()).toBe(0);
  });

  it('rejects garbage and migrates partial saves', () => {
    expect(migrate(null)).toBeNull();
    expect(migrate({ foo: 1 })).toBeNull();
    const s = newGame(0, 'Old', 'normal') as unknown as Record<string, unknown>;
    delete s.stats;
    delete s.shop;
    const m = migrate(s)!;
    expect(m.stats.kills).toBe(0);
    expect(m.shop.stock).toEqual([]);
  });

  it('import rejects invalid json', () => {
    const store = new SaveStore(new MemStorage());
    expect(store.importString(0, 'not json')).toBe(false);
    expect(store.importString(0, JSON.stringify(newGame(0, 'Imp', 'story')))).toBe(true);
    expect(store.load(0)?.hero.name).toBe('Imp');
  });

  it('encodes explored bitsets compactly', () => {
    const bits = new Uint8Array(1000);
    for (let i = 0; i < 1000; i += 7) bits[i] = 1;
    const enc = encodeBits(bits);
    expect(enc.length).toBeLessThan(200);
    expect(Array.from(decodeBits(enc, 1000))).toEqual(Array.from(bits));
    expect(decodeBits('%%%corrupt', 10).every((b) => b === 0)).toBe(true);
  });
});

describe('quests', () => {
  it('skips boss objectives that were already completed', async () => {
    const { QuestSystem } = await import('../src/game/quests');
    const save = newGame(0, 'Q', 'normal');
    const events = { on: () => () => undefined, emit: () => undefined };
    const fakeGame = {
      save,
      events,
      toast: () => undefined,
      giveGold: () => undefined,
      giveXp: () => undefined,
      giveItem: () => true,
      rollItem: () => generateItem(new RNG(1), 5),
      invalidateStats: () => undefined,
      banner: null,
    } as unknown as ConstructorParameters<typeof QuestSystem>[0];
    const qs = new QuestSystem(fakeGame);
    qs.start('mq_fallen_star', true);
    qs.onBoss('thornmaw'); // killed before talking to Maren
    expect(save.quests.mq_fallen_star.stage).toBe(0);
    qs.talk('maren'); // stage 0 -> boss stage (already done) -> return to Maren
    expect(save.quests.mq_fallen_star.stage).toBe(2);
    qs.talk('maren');
    expect(save.quests.mq_fallen_star.done).toBe(true);
    expect(save.quests.mq_deep).toBeDefined();
  });
});
