/** Records tab: journey statistics and achievements. */
import { drawText } from '../../engine/font';
import type { Rect } from '../../engine/math';
import { ACHIEVEMENTS, type AchievementDef } from '../../game/achievements';
import { formatPlayTime } from '../../game/saves';
import { drawIcon, drawTooltip, ellipsize, ListView, UI } from '../../ui/widgets';
import type { MenuScene, TabView } from './menu';

export class RecordsTab implements TabView {
  readonly label = 'Records';
  private list = new ListView<AchievementDef>([...ACHIEVEMENTS], 12, 14, false);

  constructor(private menu: MenuScene) {}

  update(): 'close' | void {
    if (this.list.update(this.menu.game.app.input) === 'cancel') return 'close';
  }

  hints(): [string, string][] {
    return [];
  }

  render(ctx: CanvasRenderingContext2D, r: Rect): void {
    const g = this.menu.game;
    const s = g.save;
    // stats column
    let y = r.y + 2;
    const sw = 150;
    const row = (k: string, v: string): void => {
      drawText(ctx, k, r.x + 2, y, { color: UI.dim });
      drawText(ctx, v, r.x + sw, y, { align: 'right' });
      y += 10;
    };
    drawText(ctx, 'Journey', r.x + 2, y, { color: UI.accent });
    y += 13;
    row('Play time', formatPlayTime(s.playTime));
    row(
      'Difficulty',
      s.difficulty[0].toUpperCase() + s.difficulty.slice(1) + (s.ngPlus ? ` NG+${s.ngPlus}` : ''),
    );
    row('Monsters slain', `${s.stats.kills}`);
    row('Elites slain', `${s.flags['elites'] ?? 0}`);
    row('Bosses defeated', `${s.stats.bosses}`);
    row('Perfect dodges', `${s.flags['perfects'] ?? 0}`);
    row('Deaths', `${s.stats.deaths}`);
    row('Gold earned', `${s.stats.goldEarned}`);
    row('Items found', `${s.stats.itemsFound}`);
    row('Legendaries', `${s.stats.legendaries}`);
    row('Damage dealt', `${Math.round(s.stats.damageDealt)}`);
    row('Deepest Abyss floor', `${s.stats.abyssBest}`);
    // achievements
    const ax = r.x + sw + 16;
    const aw = Math.min(170, r.w - sw - 20);
    drawText(ctx, `Achievements ${g.achievements.count}/${ACHIEVEMENTS.length}`, ax, r.y + 2, {
      color: UI.accent,
    });
    this.list.visibleRows = Math.floor((r.h - 20) / 12);
    this.list.draw(ctx, ax, r.y + 14, aw, (a, x, yy) => {
      const got = g.achievements.has(a.id);
      drawIcon(ctx, got ? 'ui_star' : 'ui_lock', x - 3, yy - 4, 0, got ? 1 : 0.5);
      drawText(ctx, got || !a.secret ? ellipsize(a.name, aw - 22) : '???', x + 14, yy, {
        color: got ? UI.accent : UI.dim,
      });
    });
    const a = this.list.selected;
    const tx = ax + aw + 8;
    if (a && r.x + r.w - tx > 80) {
      const got = g.achievements.has(a.id);
      const lines =
        got || !a.secret
          ? [`{gold}${a.name}{/}`, '', a.desc, '', got ? '{green}Unlocked!{/}' : '{gray}Locked{/}']
          : ['{gray}Secret achievement{/}', '', 'Keep playing to discover it.'];
      drawTooltip(ctx, lines, tx, r.y + 14, r.x + r.w - tx);
    }
  }
}
