/**
 * World boss events (Diablo 4 style): every so often a powerful boss appears somewhere
 * in an unlocked zone. It's announced everywhere, marked on the HUD, stays for a while
 * (never leaving mid-fight), keeps its wounds if you leave, and drops a hoard.
 */
import { audio } from '../audio';
import { enemyDef, WORLD_BOSS_BY_ZONE } from '../data/enemies';
import { ZONES } from '../data/zones';
import { dist } from '../engine/math';
import { rng, type RNG } from '../engine/rng';
import {
  WORLD_BOSS_DURATION,
  WORLD_BOSS_FIRST_DELAY,
  WORLD_BOSS_INTERVAL,
  WORLD_BOSS_LEVEL_BONUS,
} from '../game/balance';
import { hasFlag, type SaveData, type WorldBossEvent } from '../game/state';
import { Enemy } from './entities/enemy';
import { CELL, TILE, type MapData } from './mapdata';
import { areaName, getMap } from './maps';
import type { World } from './world';

/** Walkable for ground monsters. */
const open = (c: number): boolean => c === CELL.Floor || c === CELL.Bridge;

/**
 * Where a world boss stands in a zone: open ground (clear for 2 tiles around) that can be
 * walked to from the zone's entrances, as far from them as practical.
 */
export function worldBossSpot(map: MapData, r: RNG): { x: number; y: number } {
  const { w, h, cells } = map;
  const starts = Object.values(map.spawnPoints);
  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  for (const s of starts) {
    const k = Math.floor(s.y / TILE) * w + Math.floor(s.x / TILE);
    if (k >= 0 && k < w * h && open(cells[k]) && !seen[k]) {
      seen[k] = 1;
      stack.push(k);
    }
  }
  while (stack.length) {
    const k = stack.pop()!;
    const x = k % w;
    const y = (k / w) | 0;
    for (const n of [
      x > 0 ? k - 1 : -1,
      x < w - 1 ? k + 1 : -1,
      y > 0 ? k - w : -1,
      y < h - 1 ? k + w : -1,
    ]) {
      if (n < 0 || seen[n] || !open(cells[n])) continue;
      seen[n] = 1;
      stack.push(n);
    }
  }
  const clear = (x: number, y: number, c: number): boolean => {
    for (let oy = -c; oy <= c; oy++)
      for (let ox = -c; ox <= c; ox++) {
        const k = (y + oy) * w + x + ox;
        if (x + ox < 0 || y + oy < 0 || x + ox >= w || y + oy >= h || !seen[k]) return false;
      }
    return true;
  };
  const farFromEntries = (x: number, y: number, d: number): boolean =>
    starts.every((s) => Math.hypot(s.x / TILE - x, s.y / TILE - y) >= d);
  for (const [c, d] of [
    [2, 18],
    [2, 10],
    [1, 6],
    [0, 0],
  ] as const) {
    const options: number[] = [];
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        if (seen[y * w + x] && clear(x, y, c) && farFromEntries(x, y, d)) options.push(y * w + x);
    if (options.length) {
      const k = r.pick(options);
      return { x: (k % w) * TILE + TILE / 2, y: Math.floor(k / w) * TILE + TILE - 2 };
    }
  }
  const s = starts[0] ?? { x: TILE, y: TILE };
  return { x: s.x, y: s.y };
}

/** A new world boss event in one of `zones`, or null if none of them has a world boss. */
export function rollWorldBossEvent(
  save: Pick<SaveData, 'hero' | 'ngPlus' | 'playTime'>,
  zones: readonly string[],
  r: RNG,
): WorldBossEvent | null {
  const options = zones.filter((z) => WORLD_BOSS_BY_ZONE[z]);
  if (!options.length) return null;
  const zone = r.pick(options);
  const spot = worldBossSpot(getMap(zone), r);
  return {
    boss: WORLD_BOSS_BY_ZONE[zone],
    zone,
    level: Math.max(ZONES[zone].levels[1], save.hero.level) + WORLD_BOSS_LEVEL_BONUS + save.ngPlus * 30,
    x: spot.x,
    y: spot.y,
    endsAt: save.playTime + WORLD_BOSS_DURATION,
    hpFrac: 1,
  };
}

export const nextWorldBossTime = (playTime: number, r: RNG): number =>
  playTime + r.range(WORLD_BOSS_INTERVAL[0], WORLD_BOSS_INTERVAL[1]);

/** World boss events start once the first guardian (Thornmaw) has fallen. */
export const worldBossesUnlocked = (save: SaveData): boolean => hasFlag(save, 'boss_thornmaw');

export class WorldBossDirector {
  /** The world boss on the current map, if it's here. */
  enemy: Enemy | null = null;
  /** The fight has started (boss bar and music). */
  engaged = false;

  constructor(private world: World) {}

  private get save(): SaveData {
    return this.world.game.save;
  }

  update(): void {
    const save = this.save;
    if (!worldBossesUnlocked(save)) return;
    const t = save.playTime;
    if (save.worldBossNext < 0) save.worldBossNext = t + WORLD_BOSS_FIRST_DELAY;
    const ev = save.worldBoss;
    if (!ev) {
      if (t >= save.worldBossNext) this.begin();
      return;
    }
    const e = this.enemy;
    if (e && !e.dead) {
      ev.hpFrac = e.hp / e.maxHp;
      const p = this.world.player;
      if (!this.engaged && (e.aggro || dist(e.x, e.y, p.x, p.y) < 170)) this.engage();
    }
    const fighting = this.engaged && !!e && !e.dead;
    if (t >= ev.endsAt && !fighting) this.depart();
  }

  private begin(): void {
    const save = this.save;
    const ev = rollWorldBossEvent(save, this.world.quests.unlockedZones(), rng);
    if (!ev) {
      save.worldBossNext = save.playTime + 60;
      return;
    }
    save.worldBoss = ev;
    const name = enemyDef(ev.boss).name;
    audio.playSfx('roar');
    audio.playSfx('stinger_boss_intro', { volume: 0.7 });
    this.world.game.banner = {
      title: 'WORLD BOSS',
      sub: `${name} has appeared in ${areaName(ev.zone)}!`,
      t: 0,
      color: '#ff0044',
    };
    this.world.game.toast(`World boss: {red}${name}{/} in ${areaName(ev.zone)}`, 'ui_skull');
    if (this.world.data.id === ev.zone) this.spawn(ev);
  }

  /** A map finished loading: put the world boss there if the event is in this zone. */
  onLoad(mapId: string): void {
    this.enemy = null;
    this.engaged = false;
    const ev = this.save.worldBoss;
    if (!ev || ev.zone !== mapId) return;
    // back through a town portal: the boss (and the fight) was restored with the area
    const kept = this.world.enemies.find((e) => e.worldBoss && !e.dead);
    if (kept) {
      this.enemy = kept;
      this.engaged = this.world.boss === kept;
      return;
    }
    this.spawn(ev);
  }

  private spawn(ev: WorldBossEvent): void {
    const e = new Enemy(enemyDef(ev.boss), ev.level, ev.x, ev.y, this.world.game.difficulty);
    e.worldBoss = true;
    e.hp = Math.max(1, Math.round(e.maxHp * ev.hpFrac));
    this.world.enemies.push(e);
    this.world.summonEffect(ev.x, ev.y);
    this.enemy = e;
  }

  private engage(): void {
    const e = this.enemy!;
    this.engaged = true;
    this.world.boss = e;
    // world bosses skip the story VS splash
    this.world.bossIntroDone = true;
    this.world.startBossFight();
    audio.playSfx('roar');
    audio.playMusic('boss');
    this.world.shake(6, 0.6);
    this.world.game.banner = {
      title: e.def.name.toUpperCase(),
      sub: e.def.boss?.title,
      t: 0,
      color: '#ff0044',
    };
  }

  /** Time's up: the boss leaves (never in the middle of a fight). */
  private depart(): void {
    const save = this.save;
    const ev = save.worldBoss!;
    const name = enemyDef(ev.boss).name;
    const e = this.enemy;
    if (e && !e.dead) {
      this.world.summonEffect(e.x, e.y);
      e.removed = true;
      e.releaseToken(this.world);
      if (this.world.boss === e) this.world.boss = null;
      if (this.engaged) audio.playMusic(this.world.data.music);
    }
    this.enemy = null;
    this.engaged = false;
    save.worldBoss = null;
    save.worldBossNext = nextWorldBossTime(save.playTime, rng);
    this.world.game.toast(`${name} has left ${areaName(ev.zone)}.`, 'ui_skull');
  }

  /** The world boss died. */
  onDefeated(): void {
    const save = this.save;
    save.worldBoss = null;
    save.worldBossNext = nextWorldBossTime(save.playTime, rng);
    save.stats.worldBosses++;
    this.enemy = null;
    this.engaged = false;
    setTimeout(() => {
      audio.playSfx('stinger_victory');
      this.world.game.banner = {
        title: 'WORLD BOSS DEFEATED',
        sub: 'Its hoard is yours',
        t: 0,
        color: '#feae34',
      };
      audio.playMusic(this.world.data.music);
    }, 1400);
  }

  /** Seconds until the current world boss leaves (0 if none). */
  timeLeft(): number {
    const ev = this.save.worldBoss;
    return ev ? Math.max(0, ev.endsAt - this.save.playTime) : 0;
  }
}
