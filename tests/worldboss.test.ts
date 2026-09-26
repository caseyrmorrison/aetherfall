import { describe, expect, it } from 'vitest';
import { ENEMIES, WORLD_BOSS_BY_ZONE } from '../src/data/enemies';
import { ZONES } from '../src/data/zones';
import { RNG } from '../src/engine/rng';
import { WORLD_BOSS_DURATION, WORLD_BOSS_INTERVAL } from '../src/game/balance';
import { migrate, newGame } from '../src/game/state';
import { CELL, TILE } from '../src/world/mapdata';
import { getMap } from '../src/world/maps';
import { nextWorldBossTime, rollWorldBossEvent, worldBossSpot } from '../src/world/worldboss';

describe('world bosses', () => {
  it('exist for every zone, as bosses that only notice you up close', () => {
    for (const [zone, id] of Object.entries(WORLD_BOSS_BY_ZONE)) {
      expect(ZONES[zone]).toBeDefined();
      const def = ENEMIES[id];
      expect(def.boss?.title).toMatch(/World Boss/);
      expect(def.aggro).toBeLessThan(400);
      for (const a of def.attacks) if (a.type === 'summon') expect(ENEMIES[a.enemy]).toBeDefined();
      for (const ph of def.boss!.phases) if (ph.summon) expect(ENEMIES[ph.summon.enemy]).toBeDefined();
    }
  });

  it('stand on open ground you can reach, away from the entrances', () => {
    for (const zone of Object.keys(WORLD_BOSS_BY_ZONE)) {
      const map = getMap(zone);
      for (let seed = 0; seed < 5; seed++) {
        const p = worldBossSpot(map, new RNG(`${zone}-${seed}`));
        const tx = Math.floor(p.x / TILE);
        const ty = Math.floor(p.y / TILE);
        for (let oy = -1; oy <= 1; oy++)
          for (let ox = -1; ox <= 1; ox++) {
            const c = map.cells[(ty + oy) * map.w + tx + ox];
            expect(c === CELL.Floor || c === CELL.Bridge).toBe(true);
          }
        const nearest = Math.min(
          ...Object.values(map.spawnPoints).map((s) => Math.hypot(s.x - p.x, s.y - p.y)),
        );
        expect(nearest).toBeGreaterThan(6 * TILE);
      }
    }
  });

  it('pick an unlocked zone and scale to the zone or to you', () => {
    const s = newGame(0, 'W', 'normal');
    s.playTime = 1000;
    s.hero.level = 3;
    const ev = rollWorldBossEvent(s, ['forest'], new RNG(1))!;
    expect(ev.zone).toBe('forest');
    expect(ev.boss).toBe(WORLD_BOSS_BY_ZONE.forest);
    expect(ev.level).toBe(ZONES.forest.levels[1] + 2);
    expect(ev.endsAt).toBe(1000 + WORLD_BOSS_DURATION);
    expect(ev.hpFrac).toBe(1);
    s.hero.level = 50;
    expect(rollWorldBossEvent(s, ['forest'], new RNG(1))!.level).toBe(52);
    expect(rollWorldBossEvent(s, ['town'], new RNG(1))).toBeNull();
  });

  it('come back every so often', () => {
    const r = new RNG(3);
    for (let i = 0; i < 50; i++) {
      const t = nextWorldBossTime(100, r);
      expect(t).toBeGreaterThanOrEqual(100 + WORLD_BOSS_INTERVAL[0]);
      expect(t).toBeLessThanOrEqual(100 + WORLD_BOSS_INTERVAL[1]);
    }
  });

  it('are added to older saves without an event running', () => {
    const old = JSON.parse(JSON.stringify(newGame(0, 'Old', 'normal'))) as Record<string, unknown>;
    old.version = 6;
    delete old.worldBoss;
    delete old.worldBossNext;
    const s = migrate(old)!;
    expect(s.worldBoss).toBeNull();
    expect(s.worldBossNext).toBe(-1);
    expect(s.stats.worldBosses).toBe(0);
  });
});
