/** Pooled particle system for sparks, dust, embers, snow and magic effects. */
export interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
  size: number;
  color: string;
  gravity: number;
  drag: number;
  /** 'square' pixel, 'glow' (additive-ish), 'line' streak. */
  shape: 'square' | 'glow' | 'line';
  fadeSize: boolean;
  active: boolean;
  /** Draw above the lighting layer (emissive). */
  emissive: boolean;
}

export interface EmitOptions {
  count?: number;
  color?: string | readonly string[];
  speed?: [number, number];
  angle?: number;
  spread?: number;
  life?: [number, number];
  size?: [number, number];
  gravity?: number;
  drag?: number;
  vz?: [number, number];
  shape?: Particle['shape'];
  fadeSize?: boolean;
  emissive?: boolean;
  z?: number;
  jitter?: number;
}

const MAX = 1400;

export class Particles {
  private pool: Particle[] = [];
  private cursor = 0;

  constructor() {
    for (let i = 0; i < MAX; i++) {
      this.pool.push({
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        max: 1,
        size: 1,
        color: '#fff',
        gravity: 0,
        drag: 0,
        shape: 'square',
        fadeSize: false,
        active: false,
        emissive: false,
      });
    }
  }

  emit(x: number, y: number, o: EmitOptions = {}): void {
    const n = o.count ?? 8;
    const colors = typeof o.color === 'string' ? [o.color] : (o.color ?? ['#ffffff']);
    for (let i = 0; i < n; i++) {
      const p = this.pool[this.cursor];
      this.cursor = (this.cursor + 1) % MAX;
      const a = (o.angle ?? 0) + (Math.random() - 0.5) * (o.spread ?? Math.PI * 2);
      const sp = rand(o.speed ?? [20, 60]);
      const j = o.jitter ?? 0;
      p.x = x + (Math.random() - 0.5) * j * 2;
      p.y = y + (Math.random() - 0.5) * j * 2;
      p.z = o.z ?? 0;
      p.vx = Math.cos(a) * sp;
      p.vy = Math.sin(a) * sp;
      p.vz = rand(o.vz ?? [0, 0]);
      p.max = p.life = rand(o.life ?? [0.3, 0.7]);
      p.size = rand(o.size ?? [1, 2]);
      p.color = colors[Math.floor(Math.random() * colors.length)];
      p.gravity = o.gravity ?? 0;
      p.drag = o.drag ?? 2;
      p.shape = o.shape ?? 'square';
      p.fadeSize = o.fadeSize ?? true;
      p.emissive = o.emissive ?? false;
      p.active = true;
    }
  }

  update(dt: number): void {
    for (const p of this.pool) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      const d = Math.max(0, 1 - p.drag * dt);
      p.vx *= d;
      p.vy *= d;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.gravity !== 0 || p.vz !== 0) {
        p.vz -= p.gravity * dt;
        p.z += p.vz * dt;
        if (p.z < 0) {
          p.z = 0;
          p.vz = -p.vz * 0.3;
          p.vx *= 0.6;
          p.vy *= 0.6;
        }
      }
    }
  }

  render(ctx: CanvasRenderingContext2D, camX: number, camY: number, emissive: boolean): void {
    for (const p of this.pool) {
      if (!p.active || p.emissive !== emissive) continue;
      const k = p.life / p.max;
      const s = p.fadeSize ? Math.max(1, Math.round(p.size * k)) : Math.round(p.size);
      const x = Math.round(p.x - camX);
      const y = Math.round(p.y - p.z - camY);
      ctx.fillStyle = p.color;
      if (p.shape === 'glow') {
        ctx.globalAlpha = Math.min(1, k * 1.5) * 0.35;
        ctx.fillRect(x - s, y - s, s * 2 + 1, s * 2 + 1);
        ctx.globalAlpha = Math.min(1, k * 1.5);
        ctx.fillRect(x, y, Math.max(1, s - 1) || 1, Math.max(1, s - 1) || 1);
        ctx.globalAlpha = 1;
      } else if (p.shape === 'line') {
        ctx.globalAlpha = Math.min(1, k * 2);
        const len = Math.hypot(p.vx, p.vy) * 0.04;
        const a = Math.atan2(p.vy, p.vx);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 0.5, y + 0.5);
        ctx.lineTo(x + 0.5 - Math.cos(a) * len, y + 0.5 - Math.sin(a) * len);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else {
        if (!p.fadeSize) ctx.globalAlpha = Math.min(1, k * 2);
        ctx.fillRect(x, y, s, s);
        ctx.globalAlpha = 1;
      }
    }
  }

  clear(): void {
    for (const p of this.pool) p.active = false;
  }
}

function rand([a, b]: readonly [number, number]): number {
  return a + Math.random() * (b - a);
}
