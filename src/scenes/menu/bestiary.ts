/** Bestiary tab: monsters you have met, with lore, stats and drops unlocked by kills. */
import { getSprite, spriteInfo } from '../../art/pixel';
import { ENEMIES, type EnemyDef } from '../../data/enemies';
import { MATERIALS } from '../../data/items';
import { drawText } from '../../engine/font';
import type { Rect } from '../../engine/math';
import { drawTooltip, ellipsize, ListView, UI } from '../../ui/widgets';
import type { MenuScene, TabView } from './menu';

export class BestiaryTab implements TabView {
  readonly label = 'Bestiary';
  private list = new ListView<EnemyDef>(Object.values(ENEMIES), 12, 14, false);
  private t = 0;

  constructor(private menu: MenuScene) {}

  update(dt: number): 'close' | void {
    this.t += dt;
    if (this.list.update(this.menu.game.app.input) === 'cancel') return 'close';
  }

  hints(): [string, string][] {
    return [];
  }

  render(ctx: CanvasRenderingContext2D, r: Rect): void {
    const b = this.menu.game.save.bestiary;
    const known = Object.keys(b).length;
    drawText(ctx, `Discovered ${known}/${this.list.items.length}`, r.x + 2, r.y + 2, { color: UI.dim });
    const listW = Math.min(150, r.w / 3);
    this.list.visibleRows = Math.floor((r.h - 20) / 12);
    this.list.draw(ctx, r.x, r.y + 14, listW, (e, x, y) => {
      const k = b[e.id] ?? 0;
      drawText(ctx, k ? ellipsize(e.name, listW - 30) : '???', x, y, {
        color: k ? (e.boss ? UI.accent : '#ffffff') : UI.dim,
      });
      if (k) drawText(ctx, `${k}`, x + listW - 10, y, { align: 'right', color: UI.dim });
    });
    const e = this.list.selected;
    if (!e) return;
    const kills = b[e.id] ?? 0;
    const px = r.x + listW + 14;
    const pw = r.w - listW - 14;
    // portrait of the sprite
    ctx.fillStyle = UI.bg2;
    ctx.fillRect(px, r.y + 2, 76, 76);
    const info = spriteInfo(e.sprite);
    const idle = info.anims.idle ?? info.anims.move ?? info.anims.fly ?? { frames: 1, fps: 1 };
    const img = getSprite(e.sprite, 'idle', Math.floor(this.t * idle.fps) % idle.frames, 'left');
    const scale = Math.max(1, Math.floor(64 / Math.max(img.width, img.height)));
    ctx.globalAlpha = kills ? 1 : 1;
    if (kills)
      ctx.drawImage(
        img,
        Math.round(px + 38 - (img.width * scale) / 2),
        Math.round(r.y + 40 - (img.height * scale) / 2),
        img.width * scale,
        img.height * scale,
      );
    else drawText(ctx, '?', px + 38, r.y + 32, { align: 'center', scale: 2, color: UI.dim });
    const lines: string[] = [];
    if (!kills) lines.push('{gray}Defeat this creature to learn about it.{/}');
    else {
      lines.push(`{gold}${e.name}{/}`, `Defeated: ${kills}`, '', e.lore);
      if (kills >= 5) {
        lines.push('', `{gray}Base HP ${e.hp} • ATK ${e.atk} • DEF ${e.def}{/}`);
        if (e.immune?.length) lines.push(`{gray}Immune: ${e.immune.join(', ')}{/}`);
      } else lines.push('', `{gray}Defeat ${5 - kills} more to reveal stats.{/}`);
      if (kills >= 10 && e.drops?.length)
        lines.push(`{gray}Drops: ${e.drops.map((d) => MATERIALS[d.material].name).join(', ')}{/}`);
      else if (e.drops?.length)
        lines.push(`{gray}Defeat ${Math.max(0, 10 - kills)} more to reveal drops.{/}`);
    }
    drawTooltip(ctx, lines, px + 80, r.y + 2, pw - 80, r.h - 6);
  }
}
