import { describe, expect, it } from 'vitest';
import {
  computeDamage,
  defenseReduction,
  heroBaseStats,
  levelDiffMod,
  MAX_LEVEL,
  upgradeCost,
  xpReward,
  xpToNext,
} from '../src/game/balance';

describe('xp curve', () => {
  it('is strictly increasing and finite below the cap', () => {
    for (let l = 1; l < MAX_LEVEL - 1; l++) {
      expect(xpToNext(l + 1)).toBeGreaterThan(xpToNext(l));
      expect(Number.isFinite(xpToNext(l))).toBe(true);
    }
    expect(xpToNext(MAX_LEVEL)).toBe(Infinity);
  });

  it('rewards fighting stronger foes and penalizes farming weak ones', () => {
    const even = xpReward(10, 10, 10);
    expect(xpReward(10, 13, 10)).toBeGreaterThan(even);
    expect(xpReward(10, 3, 10)).toBeLessThan(even);
    expect(xpReward(10, 1, 20)).toBeGreaterThanOrEqual(1);
  });
});

describe('damage', () => {
  const base = {
    power: 50,
    mult: 1,
    attackerLevel: 10,
    defenderLevel: 10,
    defenderDef: 20,
    critChance: 0,
    critDmg: 0.5,
    rollCrit: 0.99,
    rollVar: 0.5,
  };

  it('is always at least 1', () => {
    expect(computeDamage({ ...base, power: 0 }).amount).toBe(1);
  });

  it('crits multiply damage', () => {
    const normal = computeDamage(base).amount;
    const crit = computeDamage({ ...base, critChance: 1, rollCrit: 0 });
    expect(crit.crit).toBe(true);
    expect(crit.amount).toBeGreaterThan(normal * 1.4);
  });

  it('defense reduces damage but is capped', () => {
    expect(defenseReduction(0, 10)).toBe(0);
    expect(defenseReduction(1e9, 10)).toBeLessThanOrEqual(0.75);
    expect(computeDamage({ ...base, defenderDef: 200 }).amount).toBeLessThan(computeDamage(base).amount);
  });

  it('level difference matters in both directions', () => {
    expect(levelDiffMod(15, 10)).toBeGreaterThan(1);
    expect(levelDiffMod(5, 10)).toBeLessThan(1);
    expect(levelDiffMod(100, 1)).toBeLessThanOrEqual(1.3);
    expect(levelDiffMod(1, 100)).toBeGreaterThanOrEqual(0.6);
  });
});

describe('hero stats & upgrades', () => {
  it('grow with level', () => {
    const a = heroBaseStats(1);
    const b = heroBaseStats(20);
    expect(b.maxHp).toBeGreaterThan(a.maxHp);
    expect(b.atk).toBeGreaterThan(a.atk);
  });

  it('upgrade costs escalate', () => {
    expect(upgradeCost(10, 5, 2).gold).toBeGreaterThan(upgradeCost(10, 1, 2).gold);
    expect(upgradeCost(10, 1, 4).dust).toBeGreaterThan(upgradeCost(10, 1, 0).dust);
  });
});
