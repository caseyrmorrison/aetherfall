/** Telegraphed ground effects: they warn first, then hurt (optionally lingering). */
import type { StatusSpec } from '../../data/enemies';
import { circleHitsLine, circleInSector, dist, TAU } from '../../engine/math';
import type { World } from '../world';
import { Entity, type Actor, type Faction } from './actor';

export interface HazardSpec {
  shape: 'circle' | 'line' | 'cone';
  x: number;
  y: number;
  radius: number;
  angle?: number;
  length?: number;
  width?: number;
  arc?: number;
  /** Telegraph time before the hazard triggers. */
  delay: number;
  /** Lingering damage time after triggering (0 = one-shot). */
  duration: number;
  tick?: number;
  mult: number;
  status?: StatusSpec;
  color: string;
  visual?: 'fire' | 'ice' | 'void' | 'earth' | 'meteor' | 'nature' | 'arcane' | 'wind';
}

export interface HazardOwner {
  faction: Faction;
  power: number;
  level: number;
  source?: Actor;
  stat?: 'atk' | 'mag';
  isSkill?: boolean;
}

export class Hazard extends Entity {
  t = 0;
  triggered = false;
  tickT = 0;
  hitOnce = new Set<Actor>();

  constructor(
    public spec: HazardSpec,
    public owner: HazardOwner,
  ) {
    super();
    this.x = spec.x;
    this.y = spec.y;
  }

  get faction(): Faction {
    return this.owner.faction;
  }

  contains(a: Actor): boolean {
    const s = this.spec;
    switch (s.shape) {
      case 'circle':
        return dist(a.x, a.y, s.x, s.y) < s.radius + a.radius;
      case 'line': {
        const ex = s.x + Math.cos(s.angle ?? 0) * (s.length ?? 0);
        const ey = s.y + Math.sin(s.angle ?? 0) * (s.length ?? 0);
        return circleHitsLine(a.x, a.y, a.radius, s.x, s.y, ex, ey, (s.width ?? 10) / 2);
      }
      case 'cone':
        return circleInSector(
          a.x,
          a.y,
          a.radius,
          s.x,
          s.y,
          s.length ?? s.radius,
          s.angle ?? 0,
          (s.arc ?? 1) / 2,
        );
    }
  }

  update(dt: number, world: World): void {
    this.t += dt;
    const s = this.spec;
    if (!this.triggered && this.t >= s.delay) {
      this.triggered = true;
      world.hazardTriggered(this);
      this.applyDamage(world);
      if (s.duration <= 0) {
        this.removed = true;
        return;
      }
    }
    if (this.triggered) {
      this.tickT -= dt;
      if (this.tickT <= 0) {
        this.tickT = s.tick ?? 0.4;
        this.hitOnce.clear();
        this.applyDamage(world);
      }
      if (this.t >= s.delay + s.duration) this.removed = true;
      // ambient particles for lingering effects
      if (Math.random() < dt * 20) {
        const a = Math.random() * TAU;
        const r = Math.random() * s.radius;
        const colors =
          s.visual === 'ice'
            ? ['#2ce8f5', '#ffffff', '#c0cbdc']
            : s.visual === 'void'
              ? ['#b55088', '#68386c', '#3e2731']
              : ['#feae34', '#f77622', '#e43b44'];
        world.particles.emit(s.x + Math.cos(a) * r, s.y + Math.sin(a) * r * 0.7, {
          count: 1,
          color: colors,
          speed: [2, 8],
          vz: [10, 30],
          gravity: -5,
          life: [0.4, 0.8],
          size: [1, 2],
          emissive: s.visual !== 'ice',
        });
      }
    }
  }

  private applyDamage(world: World): void {
    if (this.faction === 'enemy') {
      const p = world.player;
      if (!this.hitOnce.has(p) && this.contains(p)) {
        this.hitOnce.add(p);
        world.hazardHitsPlayer(this);
      }
    } else {
      for (const e of world.enemiesNear(
        this.spec.x,
        this.spec.y,
        (this.spec.length ?? this.spec.radius) + 24,
      )) {
        if (this.hitOnce.has(e) || !e.targetable) continue;
        if (this.contains(e)) {
          this.hitOnce.add(e);
          world.hazardHitsEnemy(this, e);
        }
      }
    }
  }

  /** Ground-layer drawing: telegraph fill or lingering pool. */
  render(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
    const s = this.spec;
    const x = s.x - camX;
    const y = s.y - camY;
    const warn = !this.triggered;
    const k = warn ? Math.min(1, this.t / Math.max(0.01, s.delay)) : 1;
    ctx.save();
    ctx.fillStyle = s.color;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 1;
    const pathShape = (scale: number): void => {
      ctx.beginPath();
      if (s.shape === 'circle') {
        ctx.ellipse(Math.round(x), Math.round(y), s.radius * scale, s.radius * scale * 0.75, 0, 0, TAU);
      } else if (s.shape === 'line') {
        const a = s.angle ?? 0;
        const len = (s.length ?? 0) * (warn ? 1 : scale);
        const hw = (s.width ?? 10) / 2;
        const nx = -Math.sin(a) * hw;
        const ny = Math.cos(a) * hw;
        ctx.moveTo(x + nx, y + ny);
        ctx.lineTo(x + nx + Math.cos(a) * len, y + ny + Math.sin(a) * len);
        ctx.lineTo(x - nx + Math.cos(a) * len, y - ny + Math.sin(a) * len);
        ctx.lineTo(x - nx, y - ny);
        ctx.closePath();
      } else {
        const a = s.angle ?? 0;
        const arc = s.arc ?? 1;
        ctx.moveTo(x, y);
        ctx.arc(x, y, (s.length ?? s.radius) * scale, a - arc / 2, a + arc / 2);
        ctx.closePath();
      }
    };
    if (warn) {
      ctx.globalAlpha = 0.18 + 0.1 * Math.sin(this.t * 20);
      pathShape(1);
      ctx.fill();
      ctx.globalAlpha = 0.45;
      pathShape(s.shape === 'line' ? 1 : k);
      ctx.fill();
      ctx.globalAlpha = 0.9;
      pathShape(1);
      ctx.stroke();
    } else if (s.duration > 0) {
      const fade = Math.min(1, (s.delay + s.duration - this.t) * 2);
      ctx.globalAlpha = 0.35 * fade;
      pathShape(1);
      ctx.fill();
      ctx.globalAlpha = 0.6 * fade;
      pathShape(0.6 + Math.sin(this.t * 6) * 0.05);
      ctx.fill();
    }
    ctx.restore();
  }
}
