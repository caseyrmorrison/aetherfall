import { describe, expect, it } from 'vitest';
import { RNG } from '../src/engine/rng';
import {
  activeCharms,
  compareTarget,
  CURSE_BONUS,
  generateCharm,
  generateItem,
  itemScore,
} from '../src/game/items';
import { addItem, charmLimit, equipItem, migrate, newGame } from '../src/game/state';
import { computeHeroStats, deriveStats, equipDelta } from '../src/game/stats';

describe('charms', () => {
  it('roll 1/2/3 bonuses by size and never equip', () => {
    const rng = new RNG(1);
    expect(generateCharm(rng, 10, { size: 'small', cursed: false }).affixes).toHaveLength(1);
    expect(generateCharm(rng, 10, { size: 'large', cursed: false }).affixes).toHaveLength(2);
    expect(generateCharm(rng, 10, { size: 'grand', cursed: false }).affixes).toHaveLength(3);
    const s = newGame(0, 'C', 'normal');
    const c = generateCharm(rng, 5);
    addItem(s, c);
    expect(equipItem(s, c.uid)).toBeNull();
    expect(s.inventory).toContain(c);
  });

  it('cursed charms carry exactly one drawback and stronger bonuses', () => {
    const rng = new RNG(2);
    for (let i = 0; i < 100; i++) {
      const c = generateCharm(rng, 15, { size: 'large', cursed: true });
      const negatives = c.affixes.filter((a) => a.value < 0);
      expect(negatives).toHaveLength(1);
      expect(c.affixes.filter((a) => a.value > 0)).toHaveLength(2);
      expect(c.name.startsWith('Cursed')).toBe(true);
    }
    expect(CURSE_BONUS).toBeGreaterThan(1);
  });

  it('only the first few charms in the bag count (the charm limit)', () => {
    const rng = new RNG(3);
    const s = newGame(0, 'C', 'normal');
    for (let i = 0; i < charmLimit(s) + 4; i++)
      addItem(s, generateCharm(rng, 10, { size: 'small', cursed: false }));
    expect(activeCharms(s)).toHaveLength(charmLimit(s));
    expect(activeCharms(s)[0]).toBe(s.inventory[0]);
  });

  it('add their bonuses (and curses) to hero stats', () => {
    const s = newGame(0, 'C', 'normal');
    const before = computeHeroStats(s);
    const charm = generateCharm(new RNG(4), 10, { size: 'small', cursed: false });
    charm.affixes = [{ stat: 'atk', value: 10 }];
    addItem(s, charm);
    expect(computeHeroStats(s).atk).toBeCloseTo(before.atk + 10);
    charm.affixes = [{ stat: 'crit', value: -1 }];
    expect(computeHeroStats(s).crit).toBe(0); // never below zero
  });
});

describe('two ring fingers', () => {
  it('fills empty fingers first, then replaces the weaker ring', () => {
    const rng = new RNG(5);
    const s = newGame(0, 'R', 'normal');
    const weak = generateItem(rng, 2, { slot: 'ring', rarity: 'common' });
    const mid = generateItem(rng, 10, { slot: 'ring', rarity: 'rare' });
    const strong = generateItem(rng, 25, { slot: 'ring', rarity: 'epic' });
    for (const r of [weak, mid, strong]) addItem(s, r);
    equipItem(s, weak.uid);
    equipItem(s, mid.uid);
    expect(s.equipment.ring1?.uid).toBe(weak.uid);
    expect(s.equipment.ring2?.uid).toBe(mid.uid);
    expect(compareTarget(s, strong)?.uid).toBe(weak.uid);
    equipItem(s, strong.uid);
    expect([s.equipment.ring1?.uid, s.equipment.ring2?.uid].sort()).toEqual([mid.uid, strong.uid].sort());
    expect(itemScore(strong)).toBeGreaterThan(itemScore(weak));
  });

  it('migrates v1 saves with a single ring slot', () => {
    const old = newGame(0, 'Old', 'normal') as unknown as Record<string, unknown>;
    const ring = generateItem(new RNG(6), 5, { slot: 'ring' });
    old.version = 1;
    old.equipment = { weapon: null, helm: null, armor: null, boots: null, ring, amulet: null };
    const m = migrate(old)!;
    expect(m.equipment.ring1?.uid).toBe(ring.uid);
    expect(m.equipment.ring2).toBeNull();
    expect(m.equipment.gloves).toBeNull();
    expect('ring' in m.equipment).toBe(false);
  });
});

describe('character sheet', () => {
  it('derives sensible offense and defense numbers', () => {
    const s = newGame(0, 'D', 'normal');
    const st = computeHeroStats(s);
    const d = deriveStats(1, st, 'sword');
    expect(d.dps).toBeGreaterThan(0);
    expect(d.hitMax).toBeGreaterThanOrEqual(d.hitMin);
    expect(d.toughness).toBeGreaterThanOrEqual(st.maxHp);
    const faster = deriveStats(1, { ...st, atkSpeed: 0.5 }, 'sword');
    expect(faster.dps).toBeGreaterThan(d.dps);
    expect(deriveStats(1, st, 'dagger').attacksPerSec).toBeGreaterThan(
      deriveStats(1, st, 'greatsword').attacksPerSec,
    );
    expect(deriveStats(1, st, 'staff').scaling).toBe('mag');
  });
});

describe('equip preview', () => {
  it('reports DPS gains for a stronger weapon and nothing for charms', () => {
    const rng = new RNG(9);
    const s = newGame(0, 'P', 'normal');
    s.equipment.weapon = generateItem(rng, 1, { slot: 'weapon', kind: 'sword', rarity: 'common' });
    const better = generateItem(rng, 20, { slot: 'weapon', kind: 'sword', rarity: 'epic' });
    addItem(s, better);
    const d = equipDelta(s, better)!;
    expect(d.dps).toBeGreaterThan(0);
    expect(d.dpsPct).toBeGreaterThan(0);
    const charm = generateCharm(rng, 5);
    addItem(s, charm);
    expect(equipDelta(s, charm)).toBeNull();
  });
});
