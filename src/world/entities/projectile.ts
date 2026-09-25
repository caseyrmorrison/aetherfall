/** Projectiles for both factions, with homing, piercing, explosions and puddles. */
import { getSprite, spriteInfo } from '../../art/pixel';
import type { ProjectileSpec } from '../../data/enemies';
import { angleDiff, dist } from '../../engine/math';
import type { World } from '../world';
import { Entity, type Actor, type Faction } from './actor';

export interface ProjectileOwner {
  power: number;
  level: number;
  faction: Faction;
  /** Player projectiles scale with atk or mag. */
  stat?: 'atk' | 'mag';
  isSkill?: boolean;
  source?: Actor;
}

export class Projectile extends Entity {
  vx: number;
  vy: number;
  life: number;
  t = 0;
  hit = new Set<Actor>();
  pierce = 0;
  target: Actor | null = null;
  /** Chain lightning on hit (Stormcaller). */
  chain = 0;
  glow: string | null = null;

  constructor(
    x: number,
    y: number,
    public angle: number,
    public spec: ProjectileSpec,
    public owner: ProjectileOwner,
    public mult: number,
  ) {
    super();
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * spec.speed;
    this.vy = Math.sin(angle) * spec.speed;
    this.life = spec.life ?? 3;
    this.radius = spec.radius;
  }

  get faction(): Faction {
    return this.owner.faction;
  }

  update(dt: number, world: World): void {
    this.t += dt;
    if (this.t >= this.life) {
      this.expire(world);
      return;
    }
    if (this.spec.homing) {
      const tgt = this.faction === 'enemy' ? world.player : this.target;
      if (tgt && !tgt.dead) {
        const want = Math.atan2(tgt.y - 6 - this.y, tgt.x - this.x);
        const d = angleDiff(this.angle, want);
        const turn = this.spec.homing * dt;
        this.angle += Math.max(-turn, Math.min(turn, d));
        const sp = Math.hypot(this.vx, this.vy);
        this.vx = Math.cos(this.angle) * sp;
        this.vy = Math.sin(this.angle) * sp;
      }
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    // walls stop projectiles (liquids don't)
    const c = world.map.cell(Math.floor(this.x / 16), Math.floor((this.y + 6) / 16));
    if (c === 1 || c === 3 || c === 5) {
      this.expire(world);
      return;
    }
    if (this.faction === 'enemy') {
      const p = world.player;
      if (dist(this.x, this.y + 6, p.x, p.y - 2) < this.radius + p.radius + 1)
        world.projectileHitsPlayer(this);
    } else {
      for (const e of world.enemiesNear(this.x, this.y + 6, this.radius + 16)) {
        if (this.hit.has(e) || !e.targetable) continue;
        if (dist(this.x, this.y + 6, e.x, e.y - 4 * e.scale) < this.radius + e.radius + 1) {
          world.projectileHitsEnemy(this, e);
          if (this.removed) break;
        }
      }
    }
  }

  expire(world: World): void {
    if (this.removed) return;
    this.removed = true;
    world.projectileExpired(this);
  }

  render(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
    const info = spriteInfo(this.spec.sprite);
    const fi = info.anims.fly;
    const frame = fi ? Math.floor(this.t * fi.fps) % fi.frames : 0;
    const img = getSprite(this.spec.sprite, 'fly', frame, 'right');
    const s = this.spec.scale ?? 1;
    ctx.save();
    ctx.translate(Math.round(this.x - camX), Math.round(this.y - camY));
    ctx.rotate(this.angle);
    if (s !== 1) ctx.scale(s, s);
    ctx.drawImage(img, -info.anchorX, -info.anchorY);
    ctx.restore();
  }
}
