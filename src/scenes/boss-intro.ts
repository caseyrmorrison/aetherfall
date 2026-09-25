/** Anime "VS" splash when a boss fight begins. */
import { drawPortrait, drawSpeedLines } from '../art/anime';
import { getSprite, spriteInfo } from '../art/pixel';
import type { Scene } from '../engine/app';
import { drawText, measureText } from '../engine/font';
import { easeOutBack, easeOutCubic } from '../engine/math';
import type { Game } from '../game/game';
import type { Enemy } from '../world/entities/enemy';
import { UI } from '../ui/widgets';

const DURATION = 2.6;

export class BossIntroScene implements Scene {
  readonly opaque = false;
  private t = 0;

  constructor(
    private game: Game,
    private boss: Enemy,
    private onDone: () => void,
  ) {}

  update(dt: number): void {
    this.t += dt;
    const input = this.game.app.input;
    if (
      this.t > DURATION ||
      (this.t > 0.8 && (input.pressed('confirm') || input.pressed('cancel') || input.mouse.clicked))
    ) {
      this.game.app.remove(this);
      this.onDone();
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const W = this.game.app.width;
    const H = this.game.app.height;
    const t = this.t;
    const out = Math.max(0, (t - (DURATION - 0.3)) / 0.3);
    const inK = easeOutCubic(Math.min(1, t / 0.25));
    // darken
    ctx.fillStyle = `rgba(11,10,18,${0.55 * inK * (1 - out)})`;
    ctx.fillRect(0, 0, W, H);
    // diagonal band
    const bandH = 110;
    const cy = H / 2;
    ctx.save();
    ctx.translate(W / 2, cy);
    ctx.rotate(-0.12);
    const slide = (1 - inK) * W + out * -W;
    ctx.translate(slide, 0);
    ctx.fillStyle = '#a22633';
    ctx.fillRect(-W, -bandH / 2 - 4, W * 2, bandH + 8);
    ctx.fillStyle = '#181425';
    ctx.fillRect(-W, -bandH / 2, W * 2, bandH);
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, cy - bandH / 2 - 20, W, bandH + 40);
    ctx.clip();
    ctx.globalAlpha = 0.4;
    drawSpeedLines(ctx, W * 0.7, cy, W, H, t * 3, '#e43b44', 0.8);
    ctx.globalAlpha = 1;
    // boss art: portrait for humanoids, big sprite for monsters
    const bx = W * 0.68 + (1 - inK) * 80 - out * 80;
    const portrait = this.boss.def.boss?.portrait;
    if (portrait) {
      drawPortrait(ctx, portrait, 'smirk', Math.round(bx - 60), Math.round(cy - 70), 120, 140, {
        flip: true,
      });
    } else {
      const info = spriteInfo(this.boss.def.sprite);
      const img = getSprite(
        this.boss.def.sprite,
        'idle',
        Math.floor(t * 4) % (info.anims.idle?.frames ?? 1),
        'left',
      );
      const scale = Math.max(2, Math.floor(110 / Math.max(img.width, img.height)));
      ctx.drawImage(
        img,
        Math.round(bx - (img.width * scale) / 2),
        Math.round(cy - (img.height * scale) / 2),
        img.width * scale,
        img.height * scale,
      );
    }
    ctx.restore();
    // text
    const tk = easeOutBack(Math.min(1, Math.max(0, (t - 0.2) / 0.35)));
    const tx = W * 0.08 - (1 - tk) * 60 - out * 100;
    drawText(ctx, 'VS', tx, cy - 40, { color: UI.accent, outline: '#181425', scale: 2, alpha: tk });
    const name = this.boss.def.name.toUpperCase();
    // shrink long names so they never run into the boss art
    const nameScale = measureText(name) * 3 > W * 0.42 ? 2 : 3;
    drawText(ctx, name, tx, cy - 16 + (3 - nameScale) * 4, {
      color: '#ffffff',
      outline: '#a22633',
      scale: nameScale,
      alpha: tk,
    });
    drawText(ctx, this.boss.def.boss?.title ?? '', tx, cy + 14, {
      color: '#f6757a',
      outline: '#181425',
      scale: 1,
      alpha: tk,
    });
    drawText(ctx, `Level ${this.boss.level}`, tx, cy + 26, { color: UI.dim, alpha: tk });
  }
}
