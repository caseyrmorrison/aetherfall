/**
 * Trials of Ascension: the arena map and the wave run (spawning, afflictions, completion).
 */
import { ENEMIES } from '../data/enemies';
import { TRIALS, type TrialDef } from '../data/trials';
import { ZONES, ZONE_ORDER } from '../data/zones';
import { dist } from '../engine/math';
import { RNG, rng } from '../engine/rng';
import { enemyAtkScale } from '../game/balance';
import { Enemy } from './entities/enemy';
import { Hazard } from './entities/hazard';
import { CELL, GROUND, TILE, type MapData, type PropPlacement } from './mapdata';
import type { World } from './world';

export function trialDef(tier: number): TrialDef {
  return TRIALS[Math.max(0, Math.min(TRIALS.length - 1, tier - 1))];
}

/** An oval citadel arena with four pillars and an exit (forfeit) to the south. */
export function generateTrialMap(tier: number): MapData {
  const def = trialDef(tier);
  const w = 36;
  const h = 28;
  const cx = 18;
  const cy = 12;
  const cells = new Uint8Array(w * h).fill(CELL.Wall);
  const ground = new Uint8Array(w * h);
  const r = new RNG(`trial-${tier}`);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (((x - cx) / 14.5) ** 2 + ((y - cy) / 10) ** 2 <= 1) cells[y * w + x] = CELL.Floor;
      if (r.chance(0.25)) ground[y * w + x] = GROUND.Alt;
    }
  for (let y = cy + 8; y < h; y++) for (let x = cx - 2; x <= cx + 1; x++) cells[y * w + x] = CELL.Floor;
  const props: PropPlacement[] = [];
  for (const [ox, oy] of [
    [-8, -4],
    [8, -4],
    [-8, 4],
    [8, 4],
  ])
    props.push({ id: 'pillar', x: (cx + ox) * TILE + 8, y: (cy + oy + 1) * TILE - 2 });
  for (let x = 3; x < w - 3; x += 5)
    for (let y = 1; y < h - 1; y++)
      if (cells[y * w + x] === CELL.Wall && cells[(y + 1) * w + x] === CELL.Floor) {
        props.push({ id: 'brazier', x: x * TILE + 8, y: (y + 2) * TILE - 2 });
        break;
      }
  return {
    id: `trial_${tier}`,
    name: `${def.name}`,
    theme: 'citadel',
    levels: [def.level, def.level],
    music: 'boss',
    darkness: 0.35,
    ambient: 'embers',
    w,
    h,
    cells,
    ground,
    props,
    objects: [
      {
        kind: 'warp',
        id: 'trial_exit',
        x: (cx - 2) * TILE,
        y: (h - 1) * TILE,
        w: 4 * TILE,
        h: TILE,
        to: 'town',
        spawn: 'town_crystal',
      },
    ],
    spawns: [],
    spawnPoints: { entry: { x: cx * TILE, y: (cy + 7) * TILE }, center: { x: cx * TILE + 8, y: cy * TILE } },
    arena: true,
    tint: 'rgba(254,174,52,0.05)',
  };
}

/** One attempt at a trial: waves of monsters, an affliction, and the reward. */
export class TrialRun {
  readonly def: TrialDef;
  readonly level: number;
  wave = 0;
  /** Countdown to the next wave (null while a wave is being fought). */
  nextWaveT: number | null = 2.5;
  done = false;
  private fireT = 3;
  private pool: string[];

  constructor(
    tier: number,
    heroLevel: number,
    readonly firstClear: boolean,
    /** Regions whose monsters can appear (defaults to all). */
    zones: readonly string[] = ZONE_ORDER,
  ) {
    this.def = trialDef(tier);
    this.level = Math.max(this.def.level, heroLevel);
    // monsters from the regions you've reached, excluding bosses
    this.pool = zones
      .flatMap((z) => ZONES[z]?.enemies.map(([id]) => id) ?? [])
      .filter((id) => !ENEMIES[id]?.boss);
    if (!this.pool.length) this.pool = ZONES.forest.enemies.map(([id]) => id);
  }

  get noFlasks(): boolean {
    return this.def.tier === 4;
  }

  update(dt: number, world: World): void {
    if (this.done) return;
    if (this.def.tier === 3) this.rainFire(dt, world);
    if (this.nextWaveT !== null) {
      this.nextWaveT -= dt;
      if (this.nextWaveT <= 0) {
        this.nextWaveT = null;
        this.spawnWave(world);
      }
      return;
    }
    if (world.enemies.some((e) => !e.dead && !e.removed)) return;
    if (this.wave >= this.def.waves) {
      this.done = true;
      world.onTrialComplete(this);
    } else this.nextWaveT = 2;
  }

  private spawnWave(world: World): void {
    this.wave++;
    const last = this.wave === this.def.waves;
    const diff = world.game.difficulty;
    const n = 5 + this.wave * 2;
    world.game.banner = {
      title: last ? 'FINAL WAVE' : `WAVE ${this.wave}/${this.def.waves}`,
      sub: this.def.affliction ? `${this.def.name} • ${this.def.affliction.name}` : this.def.name,
      t: 0,
      color: '#feae34',
    };
    const spots = world.openSpots(n + 2, 90);
    spots.forEach((s, i) => {
      const champion = last && i < 2;
      const eliteChance = 0.15 + this.wave * 0.08;
      const elite = champion || rng.chance(eliteChance) ? world.randomEliteMod(champion) : null;
      const e = new Enemy(world.enemyDefById(rng.pick(this.pool)), this.level, s.x, s.y, diff, { elite });
      if (this.def.tier === 2) e.speed *= 1.25;
      e.aggro = true;
      world.enemies.push(e);
      world.summonEffect(s.x, s.y);
    });
  }

  /** Scorched Earth: fire strikes near the hero every few seconds. */
  private rainFire(dt: number, world: World): void {
    this.fireT -= dt;
    if (this.fireT > 0) return;
    this.fireT = 2.2;
    const p = world.player;
    for (let i = 0; i < 3; i++) {
      const x = p.x + rng.range(-70, 70);
      const y = p.y + rng.range(-50, 50);
      if (!world.map.walkableAt(x, y) || dist(x, y, p.x, p.y) < 8) continue;
      world.hazards.push(
        new Hazard(
          {
            shape: 'circle',
            x,
            y,
            radius: 22,
            delay: 1.1,
            duration: 0,
            mult: 1.1,
            color: '#f77622',
            visual: 'fire',
          },
          {
            faction: 'enemy',
            power: 12 * enemyAtkScale(this.level) * world.game.difficulty.enemyDmg,
            level: this.level,
          },
        ),
      );
    }
  }
}
