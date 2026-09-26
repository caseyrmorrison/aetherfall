import { describe, expect, it } from 'vitest';
import { ASC_CLASSES, ASC_NODE_BY_ID, ASC_NODES } from '../src/data/ascendancy';
import { PARAGON_STATS } from '../src/data/paragon';
import { QUESTS } from '../src/data/quests';
import { RECIPES } from '../src/data/recipes';
import { PASSIVES, PASSIVE_BY_ID, SKILLS, SKILL_ORDER } from '../src/data/skills';
import { TRIALS } from '../src/data/trials';
import { RNG } from '../src/engine/rng';
import { ascBlocker, ascUnspent, resetAscendancy, takeAscNode } from '../src/game/ascendancy';
import { DIFFICULTY, effectiveDifficulty, MAX_LEVEL, MAX_TORMENT } from '../src/game/balance';
import { craft, craftBlocker, socketTargets } from '../src/game/crafting';
import { generateItem } from '../src/game/items';
import {
  allocate,
  categoryForLevel,
  earnedIn,
  paragonBonuses,
  paragonXpToNext,
  totalUnspent,
} from '../src/game/paragon';
import { addItem, grantXp, INVENTORY_SIZE, migrate, newGame, syncUnlockedSkills } from '../src/game/state';
import { computeHeroStats } from '../src/game/stats';
import { floodFloor } from '../src/world/abyss';
import { CELL, TILE } from '../src/world/mapdata';
import { generateTrialMap } from '../src/world/trial';

const recipe = (id: string) => RECIPES.find((r) => r.id === id)!;

describe('difficulty', () => {
  it('gets strictly harder from Story to Nightmare', () => {
    const order = ['story', 'normal', 'hard', 'nightmare'] as const;
    for (let i = 1; i < order.length; i++) {
      const a = DIFFICULTY[order[i - 1]];
      const b = DIFFICULTY[order[i]];
      expect(b.enemyHp).toBeGreaterThan(a.enemyHp);
      expect(b.enemyDmg).toBeGreaterThan(a.enemyDmg);
      expect(b.aggression).toBeLessThan(a.aggression);
      expect(b.tokens).toBeGreaterThanOrEqual(a.tokens);
    }
  });

  it('only applies Torment on Nightmare, scaling health, damage and rewards', () => {
    expect(effectiveDifficulty('hard', 3)).toBe(DIFFICULTY.hard);
    expect(effectiveDifficulty('nightmare', 0)).toBe(DIFFICULTY.nightmare);
    let prev = DIFFICULTY.nightmare;
    for (let t = 1; t <= MAX_TORMENT; t++) {
      const d = effectiveDifficulty('nightmare', t);
      expect(d.enemyHp).toBeGreaterThan(prev.enemyHp);
      expect(d.enemyDmg).toBeGreaterThan(prev.enemyDmg);
      expect(d.lootBonus).toBeGreaterThan(prev.lootBonus);
      expect(d.xpMult).toBeGreaterThan(prev.xpMult);
      expect(d.label).toMatch(/^Torment [IVX]+$/);
      prev = d;
    }
    expect(effectiveDifficulty('nightmare', 99).label).toBe(`Torment ${'VI'}`);
  });
});

describe('paragon', () => {
  it('turns XP past the level cap into paragon levels', () => {
    const s = newGame(0, 'P', 'normal');
    s.hero.level = MAX_LEVEL;
    const r = grantXp(s, paragonXpToNext(0) + paragonXpToNext(1) + 5);
    expect(r.paragonLevels).toBe(2);
    expect(s.hero.paragon.level).toBe(2);
    expect(s.hero.paragon.xp).toBe(5);
    expect(s.hero.level).toBe(MAX_LEVEL);
  });

  it('rotates points through the four categories', () => {
    expect([1, 2, 3, 4, 5].map(categoryForLevel)).toEqual(['core', 'offense', 'defense', 'utility', 'core']);
    const p = { level: 9, xp: 0, alloc: {} };
    expect(earnedIn(p, 'core')).toBe(3);
    expect(earnedIn(p, 'offense')).toBe(2);
    expect(earnedIn(p, 'utility')).toBe(2);
    expect(totalUnspent(p)).toBe(9);
  });

  it('spends only points earned in that category and respects caps', () => {
    const p = { level: 4, xp: 0, alloc: {} as Record<string, number> };
    expect(allocate(p, 'might', 1)).toBeNull();
    expect(allocate(p, 'vitality', 1)).toMatch(/No points/);
    expect(allocate(p, 'precision', 1)).toBeNull();
    const big = { level: 400, xp: 0, alloc: {} as Record<string, number> };
    for (let i = 0; i < 20; i++) expect(allocate(big, 'swiftness', 1)).toBeNull();
    expect(allocate(big, 'swiftness', 1)).toMatch(/maxed/);
    expect(allocate(big, 'swiftness', -1)).toBeNull();
    expect(big.alloc.swiftness).toBe(19);
  });

  it('adds its bonuses to hero stats', () => {
    const s = newGame(0, 'P', 'normal');
    const base = computeHeroStats(s);
    s.hero.paragon = { level: 40, xp: 0, alloc: { might: 10, ferocity: 10, resilience: 10 } };
    const st = computeHeroStats(s);
    expect(st.atk).toBeCloseTo(base.atk + 15);
    expect(st.mag).toBeCloseTo(base.mag + 15);
    expect(st.critDmg).toBeCloseTo(base.critDmg + 0.1);
    expect(st.damageTaken).toBeCloseTo(base.damageTaken * 0.98);
    expect(paragonBonuses(undefined).damageTaken).toBe(1);
    expect(PARAGON_STATS).toHaveLength(16);
  });
});

describe('crafting', () => {
  it('checks materials, gold and bag space', () => {
    const s = newGame(0, 'C', 'normal');
    const elixir = recipe('brew_elixir');
    expect(craftBlocker(s, elixir)).toMatch(/Moonpetal/);
    s.materials = { herb: 3, crystal: 1 };
    s.hero.gold = 0;
    expect(craftBlocker(s, elixir)).toMatch(/gold/);
    s.hero.gold = 1000;
    expect(craftBlocker(s, elixir)).toBeNull();
    expect(craft(s, elixir, new RNG(1))).toEqual({ kind: 'consumable', id: 'elixir', count: 1 });
    expect(s.materials.herb).toBe(0);
    expect(s.consumables.elixir).toBe(2);
    expect(craft(s, elixir, new RNG(1))).toBeNull();
    s.materials = { pelt: 5, herb: 2 };
    for (let i = 0; i < INVENTORY_SIZE; i++) addItem(s, generateItem(new RNG(i), 5));
    expect(craftBlocker(s, recipe('forge_leather'))).toMatch(/bag/);
  });

  it('forges rare-or-better gear above your level and charms that are never cursed', () => {
    const s = newGame(0, 'C', 'normal');
    s.hero.level = 20;
    s.hero.gold = 1e6;
    s.materials = { pelt: 50, herb: 50, void: 50, ember: 50, frost: 50, crystal: 50 };
    const rng = new RNG(3);
    for (let i = 0; i < 5; i++) {
      const r = craft(s, recipe('forge_leather'), rng);
      expect(r?.kind).toBe('item');
      if (r?.kind !== 'item') continue;
      expect(['gloves', 'boots', 'belt']).toContain(r.item.slot);
      expect(['rare', 'epic', 'legendary']).toContain(r.item.rarity);
      expect(r.item.ilvl).toBe(22);
    }
    const c = craft(s, recipe('forge_charm_grand'), rng);
    expect(c?.kind === 'item' && c.item.charmSize === 'grand' && !c.item.cursed).toBe(true);
  });

  it('punches a socket only into rare-or-better gear without one', () => {
    const s = newGame(0, 'C', 'normal');
    s.hero.gold = 1e6;
    s.materials = { void: 50, crystal: 50 };
    const common = generateItem(new RNG(1), 10, { slot: 'helm', rarity: 'common' });
    const rare = generateItem(new RNG(2), 10, { slot: 'armor', rarity: 'rare' });
    addItem(s, common);
    addItem(s, rare);
    expect(socketTargets(s)).toEqual([rare]);
    expect(craft(s, recipe('forge_socket'), new RNG(1), common)).toBeNull();
    expect(craft(s, recipe('forge_socket'), new RNG(1), rare)?.kind).toBe('socket');
    expect(rare.sockets).toEqual([null]);
    expect(socketTargets(s)).toEqual([]);
  });
});

describe('talents', () => {
  it('form six chains of six, each node requiring the one above it', () => {
    expect(PASSIVES).toHaveLength(36);
    const seen = new Set<string>();
    for (const p of PASSIVES) {
      const key = `${p.branch}/${p.col}/${p.row}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
      if (p.row === 0) expect(p.requires).toBeUndefined();
      else {
        const req = PASSIVE_BY_ID[p.requires!];
        expect(req.branch).toBe(p.branch);
        expect(req.col).toBe(p.col);
        expect(req.row).toBe(p.row - 1);
      }
    }
  });
});

describe('ascendancy', () => {
  it('gives each class two starts, two follow-ups and two capstones', () => {
    for (const cls of ASC_CLASSES) {
      const nodes = ASC_NODES.filter((n) => n.cls === cls);
      expect(nodes.map((n) => n.tier).sort()).toEqual([0, 0, 1, 1, 2, 2]);
      for (const n of nodes) for (const r of n.requires ?? []) expect(ASC_NODE_BY_ID[r].cls).toBe(cls);
    }
  });

  it('spends trial points on notables in order', () => {
    const a = { cls: null as null | 'blademaster', trials: 1, nodes: [] as string[] };
    expect(ascBlocker(a, ASC_NODE_BY_ID.bm_duelist)).toMatch(/Choose/);
    a.cls = 'blademaster';
    expect(ascBlocker(a, ASC_NODE_BY_ID.wb_unbreakable)).toMatch(/another/);
    expect(ascBlocker(a, ASC_NODE_BY_ID.bm_riposte)).toMatch(/Requires/);
    expect(takeAscNode(a, 'bm_flowing')).toBeNull();
    expect(ascUnspent(a)).toBe(0);
    expect(takeAscNode(a, 'bm_riposte')).toMatch(/Trials/);
    a.trials = 3;
    expect(takeAscNode(a, 'bm_riposte')).toBeNull();
    expect(takeAscNode(a, 'bm_tempest')).toBeNull();
    resetAscendancy(a, true);
    expect(a.nodes).toEqual([]);
    expect(a.cls).toBe('blademaster');
  });

  it('applies notable stats only for the chosen class', () => {
    const s = newGame(0, 'A', 'normal');
    const base = computeHeroStats(s);
    s.ascendancy = { cls: 'blademaster', trials: 1, nodes: ['bm_duelist'] };
    const st = computeHeroStats(s);
    expect(st.crit).toBeCloseTo(base.crit + 0.08);
    expect(st.asc.has('bm_duelist')).toBe(true);
    s.ascendancy.cls = 'archmage';
    expect(computeHeroStats(s).asc.size).toBe(0);
  });

  it('has four trials whose arenas are fully connected', () => {
    expect(TRIALS.map((t) => t.tier)).toEqual([1, 2, 3, 4]);
    for (const t of TRIALS) {
      const m = generateTrialMap(t.tier);
      const e = m.spawnPoints.entry;
      const reach = floodFloor(m.cells, m.w, m.h, Math.floor(e.x / TILE), Math.floor(e.y / TILE));
      for (let i = 0; i < m.w * m.h; i++) if (m.cells[i] === CELL.Floor) expect(reach[i]).toBe(1);
    }
  });
});

describe('challenge skills', () => {
  it('are taught only by their challenge, never by leveling', () => {
    const challengeSkills = SKILL_ORDER.filter((id) => SKILLS[id].challenge);
    expect(challengeSkills).toEqual(['shadowstep', 'earthshatter', 'blizzard', 'bloodrite']);
    for (const id of challengeSkills) {
      const q = QUESTS[SKILLS[id].challenge!];
      expect(q.challenge).toBe(true);
      expect(q.reward.skill).toBe(id);
    }
    const s = newGame(0, 'S', 'normal');
    s.hero.level = MAX_LEVEL;
    syncUnlockedSkills(s);
    for (const id of challengeSkills) expect(s.hero.skills[id]).toBeUndefined();
    const fresh = newGame(0, 'S', 'normal');
    grantXp(fresh, 1e9);
    for (const id of challengeSkills) expect(fresh.hero.skills[id]).toBeUndefined();
  });
});

describe('save migration v3 -> v4', () => {
  it('adds paragon, ascendancy, Torment and the town portal', () => {
    const old = JSON.parse(JSON.stringify(newGame(0, 'Old', 'nightmare'))) as Record<string, unknown>;
    old.version = 3;
    delete old.ascendancy;
    delete old.torment;
    delete old.townPortal;
    delete (old.hero as Record<string, unknown>).paragon;
    const s = migrate(old)!;
    expect(s.hero.paragon).toEqual({ level: 0, xp: 0, alloc: {} });
    expect(s.ascendancy).toEqual({ cls: null, trials: 0, nodes: [] });
    expect(s.torment).toBe(0);
    expect(s.townPortal).toBeNull();
  });
});
