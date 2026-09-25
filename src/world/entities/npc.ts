/** Friendly townsfolk: idle/wander, face the hero, show quest markers. */
import { getIcon, getSprite, spriteInfo } from '../../art/pixel';
import type { Dir } from '../../art/pixel/types';
import type { NpcDef } from '../../data/npcs';
import { angleTo, dirFromAngle, dist } from '../../engine/math';
import { rng } from '../../engine/rng';
import type { World } from '../world';
import { Entity } from './actor';

export class Npc extends Entity {
  dir: Dir;
  animT = Math.random() * 2;
  homeX: number;
  homeY: number;
  private tx: number;
  private ty: number;
  private waitT = rng.range(1, 3);
  moving = false;

  constructor(
    public def: NpcDef,
    x: number,
    y: number,
  ) {
    super();
    this.x = this.homeX = this.tx = x;
    this.y = this.homeY = this.ty = y;
    this.dir = def.facing ?? 'down';
    this.radius = 6;
  }

  update(dt: number, world: World): void {
    this.animT += dt;
    const p = world.player;
    const pd = dist(this.x, this.y, p.x, p.y);
    this.moving = false;
    if (pd < 36) {
      this.dir = dirFromAngle(angleTo(this.x, this.y, p.x, p.y));
      return;
    }
    if (!this.def.wander) return;
    this.waitT -= dt;
    if (this.waitT <= 0) {
      this.waitT = rng.range(2, 5);
      const a = rng.range(0, Math.PI * 2);
      const r = rng.range(0, this.def.wander);
      this.tx = this.homeX + Math.cos(a) * r;
      this.ty = this.homeY + Math.sin(a) * r;
    }
    const d = dist(this.x, this.y, this.tx, this.ty);
    if (d > 2) {
      const sp = 26;
      world.moveActor(this, ((this.tx - this.x) / d) * sp * dt, ((this.ty - this.y) / d) * sp * dt);
      this.dir = dirFromAngle(angleTo(this.x, this.y, this.tx, this.ty));
      this.moving = true;
    }
  }

  render(ctx: CanvasRenderingContext2D, camX: number, camY: number, world: World): void {
    const info = spriteInfo(this.def.sprite);
    const anim = this.moving && info.anims.walk ? 'walk' : 'idle';
    const ai = info.anims[anim] ?? { frames: 1, fps: 1 };
    const frame = Math.floor(this.animT * ai.fps) % ai.frames;
    const img = getSprite(this.def.sprite, anim, frame, this.dir);
    const x = Math.round(this.x - camX);
    const y = Math.round(this.y - camY);
    ctx.drawImage(img, x - info.anchorX, y - info.anchorY);
    const news = world.quests.hasNews(this.def.id);
    if (news) {
      const bob = Math.round(Math.sin(this.animT * 5) * 1.5);
      const icon = getIcon(news === 'turnin' ? 'ui_check' : 'ui_quest');
      ctx.drawImage(icon, x - 8, y - info.anchorY - 16 + bob);
    }
  }
}
