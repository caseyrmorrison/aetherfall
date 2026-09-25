/** Base classes for everything that lives in the world. */
import type { StatusKind, StatusSpec } from '../../data/enemies';
import type { World } from '../world';

export abstract class Entity {
  x = 0;
  y = 0;
  /** Height above ground (for jumps/flying visuals). */
  z = 0;
  radius = 6;
  dead = false;
  /** Remove from the world at the end of the frame. */
  removed = false;

  abstract update(dt: number, world: World): void;
  abstract render(ctx: CanvasRenderingContext2D, camX: number, camY: number, world: World): void;

  /** Y used for depth sorting. */
  get sortY(): number {
    return this.y;
  }
}

export interface StatusState {
  t: number;
  /** DoT damage per second, or slow fraction. */
  power: number;
}

export type Faction = 'player' | 'enemy' | 'neutral';

export abstract class Actor extends Entity {
  hp = 1;
  maxHp = 1;
  level = 1;
  faction: Faction = 'enemy';
  /** Knockback velocity (decays). */
  kx = 0;
  ky = 0;
  flash = 0;
  invuln = 0;
  statuses: Partial<Record<StatusKind, StatusState>> = {};
  private dotAcc = 0;

  get frozen(): boolean {
    return (this.statuses.freeze?.t ?? 0) > 0;
  }

  /** Multiplier on movement speed from statuses. */
  get speedMult(): number {
    if (this.frozen) return 0;
    const s = this.statuses.slow;
    return s && s.t > 0 ? 1 - s.power : 1;
  }

  applyStatus(spec: StatusSpec, power: number, immune: readonly StatusKind[] = []): boolean {
    if (immune.includes(spec.kind)) {
      // frozen-immune bosses are slowed instead
      if (spec.kind === 'freeze' && !immune.includes('slow')) {
        this.statuses.slow = { t: spec.duration, power: 0.4 };
        return true;
      }
      return false;
    }
    const cur = this.statuses[spec.kind];
    const p =
      spec.kind === 'slow' ? (spec.power ?? 0.3) : spec.kind === 'freeze' ? 1 : (spec.power ?? 0.2) * power;
    if (!cur || cur.t < spec.duration || cur.power < p)
      this.statuses[spec.kind] = { t: spec.duration, power: p };
    return true;
  }

  clearStatuses(): void {
    this.statuses = {};
  }

  /** Ticks statuses; returns DoT damage dealt this frame (already applied by caller). */
  tickStatuses(dt: number): number {
    let dot = 0;
    for (const k of Object.keys(this.statuses) as StatusKind[]) {
      const s = this.statuses[k]!;
      s.t -= dt;
      if ((k === 'burn' || k === 'poison') && s.t > 0) dot += s.power * dt;
      if (s.t <= 0) delete this.statuses[k];
    }
    this.dotAcc += dot;
    if (this.dotAcc >= 1) {
      const whole = Math.floor(this.dotAcc);
      this.dotAcc -= whole;
      return whole;
    }
    return 0;
  }

  /** Apply and decay knockback velocity. */
  applyKnockback(dt: number, world: World, flying = false): void {
    if (Math.abs(this.kx) + Math.abs(this.ky) < 1) {
      this.kx = this.ky = 0;
      return;
    }
    world.moveActor(this, this.kx * dt, this.ky * dt, flying);
    const d = Math.max(0, 1 - 9 * dt);
    this.kx *= d;
    this.ky *= d;
  }
}
