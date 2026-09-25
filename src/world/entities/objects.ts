/** Interactive map objects: chests, crystals, signs, doors, gates, portals, boards, quest spots. */
import { getProp, propInfo } from '../../art/pixel';
import type { PropId } from '../../art/pixel/types';
import { dist } from '../../engine/math';
import { bossCleared, hasFlag } from '../../game/state';
import type { MapObject } from '../mapdata';
import type { World } from '../world';
import { Entity } from './actor';

export class WorldObject extends Entity {
  t = Math.random() * 3;
  constructor(public obj: Exclude<MapObject, { kind: 'warp' | 'npc' }>) {
    super();
    this.x = obj.x;
    this.y = obj.y;
    this.radius = 10;
  }

  /** Prop drawn for this object (with dynamic state), if any. */
  private prop(world: World): { id: PropId; frame: number } | null {
    const o = this.obj;
    switch (o.kind) {
      case 'chest':
        return { id: o.rare ? 'chest_rare' : 'chest', frame: world.isChestOpen(o.id) ? 1 : 0 };
      case 'crystal': {
        const pi = propInfo('save_crystal');
        return { id: 'save_crystal', frame: Math.floor(this.t * pi.fps) % pi.frames };
      }
      case 'bossGate':
        return { id: 'boss_gate', frame: bossCleared(world.game.save, o.boss) ? 1 : 0 };
      case 'portal': {
        if (!this.portalOpen(world)) return null;
        const pi = propInfo('portal');
        return { id: 'portal', frame: Math.floor(this.t * pi.fps) % pi.frames };
      }
      default:
        return null;
    }
  }

  portalOpen(world: World): boolean {
    const o = this.obj;
    return o.kind === 'portal' && (!o.requires || hasFlag(world.game.save, o.requires.flag));
  }

  /** Interaction prompt when the player stands nearby, or null. */
  prompt(world: World): string | null {
    const o = this.obj;
    switch (o.kind) {
      case 'chest':
        return world.isChestOpen(o.id) ? null : 'Open';
      case 'crystal':
        return 'Rest / Travel';
      case 'sign':
        return 'Read';
      case 'door':
        return o.label;
      case 'bossGate':
        return bossCleared(world.game.save, o.boss) ? 'Enter (cleared)' : 'Challenge';
      case 'portal':
        return this.portalOpen(world)
          ? world.game.save.flags['game_clear']
            ? 'Enter portal'
            : 'Enter the Sky Citadel'
          : null;
      case 'board':
        return 'Bounty Board';
      case 'marker':
        return world.markerActive(o.id) ? 'Search' : null;
    }
  }

  get reach(): number {
    return this.obj.kind === 'door' ? 14 : this.obj.kind === 'bossGate' ? 22 : 18;
  }

  update(dt: number, world: World): void {
    this.t += dt;
    const o = this.obj;
    if (o.kind === 'crystal' && !world.game.save.discovered.includes(o.id)) {
      if (dist(this.x, this.y, world.player.x, world.player.y) < 40) world.discoverCrystal(o.id, o.name);
    }
    if (o.kind === 'marker' && world.markerActive(o.id) && Math.random() < dt * 8) {
      world.particles.emit(this.x + (Math.random() - 0.5) * 12, this.y, {
        count: 1,
        color: ['#fee761', '#feae34'],
        vz: [20, 40],
        speed: [1, 4],
        gravity: -10,
        life: [0.6, 1],
        emissive: true,
        shape: 'glow',
      });
    }
    if (o.kind === 'crystal' && Math.random() < dt * 4) {
      world.particles.emit(this.x + (Math.random() - 0.5) * 10, this.y - 10, {
        count: 1,
        color: ['#2ce8f5', '#ffffff'],
        vz: [8, 20],
        speed: [1, 3],
        gravity: -6,
        life: [0.8, 1.4],
        emissive: true,
      });
    }
  }

  render(ctx: CanvasRenderingContext2D, camX: number, camY: number, world: World): void {
    const p = this.prop(world);
    if (!p) {
      if (this.obj.kind === 'marker' && world.markerActive(this.obj.id)) {
        const img = getProp('crate', 0);
        const pi = propInfo('crate');
        ctx.drawImage(img, Math.round(this.x - camX - pi.anchorX), Math.round(this.y - camY - pi.anchorY));
      }
      return;
    }
    const pi = propInfo(p.id);
    const img = getProp(p.id, p.frame);
    ctx.drawImage(img, Math.round(this.x - camX - pi.anchorX), Math.round(this.y - camY - pi.anchorY));
  }
}

/** Prop ids drawn by WorldObject instead of the static prop layer. */
export const DYNAMIC_PROPS: ReadonlySet<PropId> = new Set<PropId>([
  'chest',
  'chest_rare',
  'save_crystal',
  'boss_gate',
  'portal',
]);
