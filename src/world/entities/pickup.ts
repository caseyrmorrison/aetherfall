/** Loot on the ground: gold, gear, materials and health/mana orbs. */
import { getIcon } from '../../art/pixel';
import type { IconId } from '../../art/pixel/types';
import { RARITY_COLORS } from '../../art/palette';
import { MATERIALS } from '../../data/items';
import { dist } from '../../engine/math';
import { GEM_INFO } from '../../data/gems';
import { gemIcon, gemLabel } from '../../game/gems';
import { itemIcon } from '../../game/items';
import type { Gem, Item, MaterialId } from '../../game/types';
import type { World } from '../world';
import { Entity } from './actor';

/** Seconds a stranded pickup takes to hop back onto solid ground. */
const HOP_TIME = 0.6;

export type PickupKind = 'gold' | 'item' | 'material' | 'gem' | 'orb_hp' | 'orb_mp' | 'soul';

export class Pickup extends Entity {
  vx: number;
  vy: number;
  vz: number;
  t = 0;
  magnet = false;
  /** Checked once it lands: loot that settles somewhere unreachable hops back to solid ground. */
  private settled = false;
  private hop: { fx: number; fy: number; tx: number; ty: number; t: number } | null = null;

  constructor(
    x: number,
    y: number,
    public kind: PickupKind,
    public amount = 1,
    public item?: Item,
    public material?: MaterialId,
    public gem?: Gem,
  ) {
    super();
    this.x = x;
    this.y = y;
    const a = Math.random() * Math.PI * 2;
    const sp = kind === 'item' ? 25 : 10 + Math.random() * 35;
    this.vx = Math.cos(a) * sp;
    this.vy = Math.sin(a) * sp;
    this.vz = 60 + Math.random() * 40;
    this.z = 2;
    this.radius = 6;
  }

  /** Auto-collected by walking near it? */
  autoCollect(world: World): boolean {
    return this.kind !== 'item' || world.game.settings.autoLoot;
  }

  update(dt: number, world: World): void {
    this.t += dt;
    // bounce
    this.vz -= 260 * dt;
    this.z += this.vz * dt;
    if (this.z <= 0) {
      this.z = 0;
      this.vz = Math.abs(this.vz) > 30 ? -this.vz * 0.35 : 0;
      this.vx *= 0.5;
      this.vy *= 0.5;
    }
    const d = Math.max(0, 1 - 3 * dt);
    this.vx *= d;
    this.vy *= d;
    const p = world.player;
    const pd = dist(this.x, this.y, p.x, p.y);
    if (this.t > 0.45 && p.state !== 'dead' && this.autoCollect(world)) {
      const range = this.kind === 'gold' || this.kind === 'soul' ? 48 : this.kind === 'item' ? 16 : 36;
      if (pd < range) this.magnet = true;
    }
    if (this.magnet) {
      const sp = 180 + this.t * 60;
      this.x += ((p.x - this.x) / Math.max(1, pd)) * sp * dt;
      this.y += ((p.y - 4 - this.y) / Math.max(1, pd)) * sp * dt;
      if (pd < 8) world.collect(this);
    } else if (this.hop) {
      const h = this.hop;
      h.t = Math.min(1, h.t + dt / HOP_TIME);
      this.x = h.fx + (h.tx - h.fx) * h.t;
      this.y = h.fy + (h.ty - h.fy) * h.t;
      if (h.t >= 1) this.hop = null;
    } else {
      // loot slides like a walker so it can't drift out over void pools or chasms
      world.moveActor(this, this.vx * dt, this.vy * dt);
      if (!this.settled && this.z === 0 && this.vz === 0) this.settle(world);
    }
    if (this.t > 120 && this.kind !== 'item' && this.kind !== 'soul') this.removed = true;
  }

  /** Abyssal loot: a tall, flickering crimson pillar with a hot core, drifting motes and a ground ring. */
  private abyssalBeam(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const hgt = 96;
    const flick = 0.75 + Math.sin(this.t * 7) * 0.15 + Math.sin(this.t * 17) * 0.06;
    const beam = (w: number, top: string, bottom: string, alpha: number): void => {
      const grd = ctx.createLinearGradient(0, y - hgt, 0, y);
      grd.addColorStop(0, 'rgba(255,0,68,0)');
      grd.addColorStop(0.45, top);
      grd.addColorStop(1, bottom);
      ctx.globalAlpha = alpha * flick;
      ctx.fillStyle = grd;
      ctx.fillRect(x - w / 2, y - hgt, w, hgt);
    };
    beam(12, 'rgba(162,38,51,0.35)', 'rgba(255,0,68,0.6)', 1);
    beam(6, 'rgba(255,0,68,0.8)', '#ff0044', 1);
    beam(2, 'rgba(255,208,220,0.8)', '#ffffff', 0.9);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ff0044';
    for (let i = 0; i < 5; i++) {
      const k = (this.t * 0.6 + i / 5) % 1;
      const mx = x + Math.sin(this.t * 3 + i * 2.1) * 7;
      ctx.globalAlpha = 1 - k;
      ctx.fillRect(Math.round(mx), Math.round(y - k * hgt), 1, 2);
    }
    ctx.globalAlpha = 1;
    // a ring pulsing on the ground
    const r = 6 + ((this.t * 14) % 10);
    ctx.strokeStyle = `rgba(255,0,68,${(1 - (r - 6) / 10) * 0.8})`;
    ctx.beginPath();
    ctx.ellipse(x, y + 1, r, r * 0.4, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  /** If this landed somewhere the hero can't walk to, bounce it back onto reachable floor. */
  private settle(world: World): void {
    this.settled = true;
    const spot = world.safeSpot(this.x, this.y);
    if (Math.abs(spot.x - this.x) < 1 && Math.abs(spot.y - this.y) < 1) return;
    this.hop = { fx: this.x, fy: this.y, tx: spot.x, ty: spot.y, t: 0 };
    this.vx = this.vy = 0;
    this.vz = 110;
  }

  get label(): string {
    if (this.kind === 'item' && this.item) return `{${this.item.rarity}}${this.item.name}{/}`;
    if (this.kind === 'material' && this.material) return MATERIALS[this.material].name;
    if (this.kind === 'gem' && this.gem) return gemLabel(this.gem);
    return '';
  }

  render(ctx: CanvasRenderingContext2D, camX: number, camY: number, world: World): void {
    const x = Math.round(this.x - camX);
    const y = Math.round(this.y - camY - this.z);
    switch (this.kind) {
      case 'gold': {
        const glint = Math.floor(this.t * 6) % 6 === 0;
        ctx.fillStyle = '#733e39';
        ctx.fillRect(x - 2, y - 2, 5, 4);
        ctx.fillStyle = '#feae34';
        ctx.fillRect(x - 2, y - 3, 4, 4);
        ctx.fillStyle = glint ? '#ffffff' : '#fee761';
        ctx.fillRect(x - 1, y - 3, 1, 1);
        break;
      }
      case 'orb_hp':
      case 'orb_mp': {
        const c = this.kind === 'orb_hp' ? '#e43b44' : '#0099db';
        const pulse = 1 + Math.sin(this.t * 8) * 0.5;
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = c;
        ctx.fillRect(x - 3 - pulse, y - 6 - pulse, 6 + pulse * 2, 6 + pulse * 2);
        ctx.globalAlpha = 1;
        ctx.fillRect(x - 2, y - 5, 4, 4);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x - 1, y - 5, 1, 1);
        break;
      }
      case 'soul': {
        ctx.globalAlpha = 0.6 + Math.sin(this.t * 5) * 0.3;
        ctx.fillStyle = '#feae34';
        ctx.fillRect(x - 3, y - 9 + Math.sin(this.t * 3) * 2, 6, 6);
        ctx.globalAlpha = 1;
        break;
      }
      case 'gem': {
        if (!this.gem) break;
        const col = GEM_INFO[this.gem.type].color;
        const pulse = 0.35 + Math.sin(this.t * 5) * 0.15;
        ctx.globalAlpha = pulse;
        ctx.fillStyle = col;
        ctx.fillRect(x - 1, y - 16 - this.gem.q * 2, 2, 12 + this.gem.q * 2);
        ctx.globalAlpha = 1;
        const bob = this.z === 0 ? Math.round(Math.sin(this.t * 3) * 1) : 0;
        ctx.drawImage(getIcon(gemIcon(this.gem)), x - 8, y - 14 + bob);
        if (dist(this.x, this.y, world.player.x, world.player.y) < 40)
          world.labels.push({ x, y: y - 20, text: this.label });
        break;
      }
      case 'material':
      case 'item': {
        const icon: IconId =
          this.kind === 'material' && this.material
            ? MATERIALS[this.material].icon
            : this.item
              ? itemIcon(this.item)
              : 'icon_dust';
        const img = getIcon(icon, this.item?.tier ?? 0);
        if (this.item?.rarity === 'abyssal') this.abyssalBeam(ctx, x, y);
        else if (this.item && this.item.rarity !== 'common') {
          // loot beam
          const col = RARITY_COLORS[this.item.rarity];
          const hgt = this.item.rarity === 'legendary' ? 60 : this.item.rarity === 'epic' ? 44 : 30;
          const grd = ctx.createLinearGradient(0, y - hgt, 0, y);
          grd.addColorStop(0, 'rgba(0,0,0,0)');
          grd.addColorStop(1, col);
          ctx.globalAlpha = 0.45 + Math.sin(this.t * 4) * 0.15;
          ctx.fillStyle = grd;
          ctx.fillRect(x - 2, y - hgt, 4, hgt);
          ctx.fillRect(x - 1, y - hgt - 8, 2, hgt + 8);
          ctx.globalAlpha = 1;
        }
        const bob = this.z === 0 ? Math.round(Math.sin(this.t * 3) * 1) : 0;
        ctx.drawImage(img, x - 8, y - 14 + bob);
        if (this.kind === 'item' && dist(this.x, this.y, world.player.x, world.player.y) < 40)
          world.labels.push({ x, y: y - 20, text: this.label });
        break;
      }
    }
  }
}
